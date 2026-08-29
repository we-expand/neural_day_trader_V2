/**
 * Histórico de preço em memória, construído a partir do ÚNICO dado que
 * comprovadamente funciona pra esta conta MetaAPI: `/mt5-prices` (tick real
 * bid/ask, ver mt5Broker.ts). Existe porque `/mt5-candles` (usado por
 * atr.ts pra tendência/volatilidade/volume) devolve HTTP 404 pra todos os
 * símbolos desta cesta -- achado confirmado em produção, 2026-08-29 --
 * deixando trend/volume SEMPRE null desde que essas métricas foram
 * introduzidas. Isso fazia o LLM decidir literalmente sem noção de direção
 * (achado do Cleber: "não está conseguindo ver pra onde o mercado está
 * indo"), porque a única fonte de tendência dependia de um endpoint quebrado.
 *
 * Em vez de esperar um fix de infraestrutura fora deste repo, o próprio
 * processo agora constrói sua própria série de preço real: toda vez que
 * `getQuote` (mt5Broker.ts) recebe um tick REAL (nunca SIMULATED), grava
 * aqui. Ao longo de um processo rodando por horas isso vira uma série
 * temporal genuína -- não um candle oficial da corretora, mas 100% preço
 * real, nunca fabricado. `atr.ts` usa isso como FALLBACK quando o candle
 * oficial não vem (ou seja, sempre, no estado atual).
 */

interface Tick {
  t: number;
  price: number;
}

const MAX_HISTORY_MS = 65 * 60 * 1000; // guarda um pouco mais que 1h, margem pra janelas de lookback
const history = new Map<string, Tick[]>();

/** Registra um tick real de preço. Nunca lança -- histórico é best-effort. */
export function recordTick(symbol: string, price: number, timestamp: number = Date.now()): void {
  if (!Number.isFinite(price) || price <= 0) return;
  let arr = history.get(symbol);
  if (!arr) {
    arr = [];
    history.set(symbol, arr);
  }
  arr.push({ t: timestamp, price });
  const cutoff = timestamp - MAX_HISTORY_MS;
  while (arr.length > 0 && arr[0].t < cutoff) arr.shift();
}

function samplesSince(symbol: string, lookbackMinutes: number, now: number = Date.now()): Tick[] | null {
  const arr = history.get(symbol);
  if (!arr || arr.length < 2) return null;
  const cutoff = now - lookbackMinutes * 60 * 1000;
  const window = arr.filter((s) => s.t >= cutoff);
  return window.length >= 2 ? window : null;
}

export interface TickTrend {
  changePct: number;
  label: "ALTA" | "BAIXA" | "LATERAL";
  /** Janela REAL coberta pelas amostras (pode ser menor que o lookback pedido, se o histórico ainda for curto). */
  lookbackMinutes: number;
  sampleCount: number;
}

const FLAT_THRESHOLD_PCT = 0.1;
const MIN_SAMPLES_FOR_TREND = 4;

/**
 * Tendência calculada a partir do histórico REAL de tick deste processo.
 * Tenta janelas decrescentes (60min -> 30min -> 15min) e usa a primeira com
 * amostras suficientes E span temporal real de pelo menos metade do
 * lookback pedido (evita "tendência" calculada em cima de 2 ticks
 * consecutivos de 5 segundos, que seria ruído, não direção real).
 */
export function getTickTrend(symbol: string, now: number = Date.now()): TickTrend | null {
  for (const lookbackMinutes of [60, 30, 15]) {
    const window = samplesSince(symbol, lookbackMinutes, now);
    if (!window || window.length < MIN_SAMPLES_FOR_TREND) continue;
    const actualSpanMinutes = (window[window.length - 1].t - window[0].t) / 60000;
    if (actualSpanMinutes < lookbackMinutes / 2) continue;

    const startPrice = window[0].price;
    const endPrice = window[window.length - 1].price;
    if (!(startPrice > 0)) continue;

    const changePct = ((endPrice - startPrice) / startPrice) * 100;
    const label: TickTrend["label"] =
      Math.abs(changePct) < FLAT_THRESHOLD_PCT ? "LATERAL" : changePct > 0 ? "ALTA" : "BAIXA";
    return {
      changePct: Number(changePct.toFixed(3)),
      label,
      lookbackMinutes: Number(actualSpanMinutes.toFixed(1)),
      sampleCount: window.length,
    };
  }
  return null;
}

export interface TickVolatility {
  /** Amplitude (máxima - mínima) / preço atual, na janela -- proxy real de volatilidade recente. */
  rangePct: number;
  lookbackMinutes: number;
  sampleCount: number;
}

const MIN_SAMPLES_FOR_VOLATILITY = 5;

/** Volatilidade recente real (amplitude de preço), usada como fallback de ATR quando o candle oficial não vem. */
export function getTickVolatility(symbol: string, now: number = Date.now()): TickVolatility | null {
  for (const lookbackMinutes of [60, 30, 15]) {
    const window = samplesSince(symbol, lookbackMinutes, now);
    if (!window || window.length < MIN_SAMPLES_FOR_VOLATILITY) continue;
    const actualSpanMinutes = (window[window.length - 1].t - window[0].t) / 60000;
    if (actualSpanMinutes < lookbackMinutes / 2) continue;

    const prices = window.map((s) => s.price);
    const hi = Math.max(...prices);
    const lo = Math.min(...prices);
    const last = prices[prices.length - 1];
    if (!(last > 0)) continue;

    return {
      rangePct: (hi - lo) / last,
      lookbackMinutes: Number(actualSpanMinutes.toFixed(1)),
      sampleCount: window.length,
    };
  }
  return null;
}

export interface MomentumAcceleration {
  recentSlopePct: number;
  priorSlopePct: number;
  /** true quando o movimento recente (5min) está claramente mais forte que o ritmo anterior (5-20min), na MESMA direção. */
  accelerating: boolean;
}

/**
 * Proxy honesto de "participação crescente" sem volume real disponível:
 * compara a inclinação recente (últimos 5min) com a inclinação anterior
 * (5-20min atrás). Um movimento que acelera na mesma direção é mais
 * consistente com dinheiro real entrando do que um movimento que já vinha
 * andando no mesmo ritmo há tempo (mais parecido com ruído/continuação
 * fraca). Não é volume de verdade -- é derivado só de preço, mas não é
 * fabricado: 100% de amostras reais deste processo.
 */
export function getMomentumAcceleration(symbol: string, now: number = Date.now()): MomentumAcceleration | null {
  const recentWindow = samplesSince(symbol, 5, now);
  const arr = history.get(symbol);
  if (!recentWindow || recentWindow.length < 3 || !arr) return null;

  const priorCutoffEnd = now - 5 * 60 * 1000;
  const priorCutoffStart = now - 20 * 60 * 1000;
  const priorWindow = arr.filter((s) => s.t >= priorCutoffStart && s.t < priorCutoffEnd);
  if (priorWindow.length < 3) return null;

  const recentPct = ((recentWindow[recentWindow.length - 1].price - recentWindow[0].price) / recentWindow[0].price) * 100;
  const priorPct = ((priorWindow[priorWindow.length - 1].price - priorWindow[0].price) / priorWindow[0].price) * 100;

  const sameDirection = Math.sign(recentPct) !== 0 && Math.sign(recentPct) === Math.sign(priorPct);
  const accelerating = sameDirection && Math.abs(recentPct) > Math.abs(priorPct) * 1.3 && Math.abs(recentPct) > 0.05;

  return {
    recentSlopePct: Number(recentPct.toFixed(3)),
    priorSlopePct: Number(priorPct.toFixed(3)),
    accelerating,
  };
}
