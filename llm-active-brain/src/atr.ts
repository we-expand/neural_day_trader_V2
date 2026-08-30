import { config } from "./config.js";
import { getTickTrend, getTickVolatility, getMomentumAcceleration } from "./tickHistory.js";

/**
 * Stop/alvo DINÂMICO por volatilidade real (2026-08-29, pedido do Cleber
 * pós-auditoria) -- substitui o % fixo (0,5% pra tudo) por um valor
 * calculado por símbolo a partir do ATR real (Average True Range, mesma
 * fórmula Wilder/período 14 que `calculateATR` usa em
 * `src/app/services/indicators/TechnicalIndicators.ts`, o motor mecânico do
 * produto -- copiada aqui deliberadamente, mesmo motivo do LOT_SIZE em
 * assetBasket.ts: este projeto Node/tsx não importa a árvore client-side).
 *
 * Por que ATR e não % fixo: 0,5% fixo pra BTCUSD, XETUSD e SOLUSD ignora que
 * cada ativo tem volatilidade intrínseca bem diferente -- um stop apertado
 * demais num ativo mais volátil bate por ruído (whipsaw), um stop largo
 * demais num ativo calmo deixa a perda crescer sem necessidade. ATR mede a
 * volatilidade real e recente do próprio ativo, então o stop respira com o
 * mercado em vez de ser um número arbitrário igual pra todo mundo.
 *
 * Fonte do candle: MESMO endpoint MetaAPI/Infinox que `/mt5-prices` usa
 * (`/mt5-candles`, conta de plataforma) -- nunca gera candle sintético. Se a
 * rota cair no fallback simulado dela (token ausente, MetaAPI fora do ar),
 * detecta e descarta (mesma trava que `getQuote` em mt5Broker.ts já tem para
 * preço) -- cai pro % fixo de config.ts como piso de segurança, nunca fica
 * sem stop.
 */

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Mt5CandlesResponse {
  success?: boolean;
  candles?: Candle[];
  source?: string; // "SIMULATED" quando a rota caiu em fallback -- descartar
  error?: string;
}

/** Mesma fórmula de `calculateATR` (TechnicalIndicators.ts) -- Wilder, período 14. */
function calculateAtr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  const trueRanges: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

const candlesCache = new Map<string, { candles: Candle[]; fetchedAt: number }>();
const CANDLES_CACHE_TTL_MS = 5 * 60 * 1000; // 5min -- candle de 5m não muda de forma relevante a cada ciclo (10s)

/**
 * Busca (com cache) as últimas velas de 5m reais do símbolo, MESMA fonte que
 * `getAtrPercent`/`getTrendInfo` usam -- extraído pra um só fetch por
 * símbolo/ciclo em vez de duplicar a chamada de rede pra cada métrica
 * derivada dela (2026-08-29, otimização urgente pós-perda do dia).
 */
async function fetchRecentCandles(symbol: string): Promise<Candle[] | null> {
  const cached = candlesCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < CANDLES_CACHE_TTL_MS) return cached.candles;

  const url = `${config.neuralSupabaseUrl}/functions/v1/server/mt5-candles`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.neuralSupabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbol, timeframe: "5m", limit: 30 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const result = (await res.json()) as Mt5CandlesResponse;
    if (result.source === "SIMULATED") return null; // mesma trava de mt5Broker.ts -- nunca decide em cima de candle fabricado
    const candles = result.candles;
    if (!Array.isArray(candles) || candles.length < 15) return null;

    candlesCache.set(symbol, { candles, fetchedAt: Date.now() });
    return candles;
  } catch {
    return null;
  }
}

/**
 * Retorna o ATR do símbolo como fração do preço (ex: 0.004 = 0.4%), ou
 * `null` se não deu pra calcular com dado real (chamador deve cair pro %
 * fixo de segurança nesse caso, nunca travar a abertura de posição).
 *
 * 🔴 2026-08-29 (achado do Cleber, "capacidade de análise direcional muito
 * fraca"): `/mt5-candles` (única fonte usada até aqui) devolve 404 em
 * produção pra todos os símbolos desta cesta -- confirmado nos logs, ATR
 * SEMPRE caía no % fixo de segurança. Agora tenta o candle oficial primeiro
 * (mais preciso, formula Wilder de verdade) e cai pro fallback de
 * volatilidade por TICK REAL (tickHistory.ts, construído pelo próprio
 * processo a partir de /mt5-prices, que funciona) antes do último recurso
 * (% fixo hardcoded).
 */
export async function getAtrPercent(symbol: string): Promise<number | null> {
  const candles = await fetchRecentCandles(symbol);
  if (candles) {
    const atr = calculateAtr(candles, 14);
    const lastClose = candles[candles.length - 1].close;
    if (atr != null && Number.isFinite(atr) && Number.isFinite(lastClose) && lastClose > 0) {
      return atr / lastClose;
    }
  }
  const tickVol = getTickVolatility(symbol);
  return tickVol ? tickVol.rangePct : null;
}

export interface TrendInfo {
  /** Variação % do fechamento nas últimas `lookback` velas de 5m (positivo = subiu). */
  changePct: number;
  /** Rótulo simples pro LLM não ter que interpretar o número sozinho. */
  label: "ALTA" | "BAIXA" | "LATERAL";
  lookbackMinutes: number;
  /** "candle" = veio do candle oficial da MetaAPI; "tick" = fallback por histórico de tick real deste processo. */
  source: "candle" | "tick";
}

// 🔴 2026-08-29 (otimização urgente pós-perda do dia, achado real: cérebro
// LLM empilhou SHORTs em BTCUSD/SOLUSD/XETUSD bem no meio de um rali de
// várias horas nesses 3 ativos, sem NENHUMA noção de tendência recente --
// só via o preço do instante, igual olhar uma foto sem saber se o carro
// estava acelerando ou freando). Contexto de tendência de curto prazo
// (1h = 12 velas de 5m) agora vai junto de get_mt5_quote, pra decisão
// deixar de ser cega à direção que o mercado já estava seguindo.
const TREND_LOOKBACK_CANDLES = 12; // 12 * 5min = 1h
const TREND_FLAT_THRESHOLD_PCT = 0.15; // abaixo disso, chama de LATERAL em vez de forcar rotulo de direcao

/**
 * 🔴 2026-08-29 (achado do Cleber, "capacidade de análise direcional muito
 * fraca" / "não está conseguindo ver pra onde o mercado está indo"): a
 * ÚNICA fonte usada até aqui (`/mt5-candles`) está 404 em produção pra toda
 * a cesta -- `trend` vinha `null` em 100% dos ciclos, confirmado nos logs.
 * Agora tenta o candle oficial primeiro; se não vier, cai pro histórico de
 * tick REAL deste processo (tickHistory.ts, alimentado por /mt5-prices, que
 * funciona) -- nunca fabrica tendência, só usa fonte diferente de dado real.
 */
export async function getTrendInfo(symbol: string): Promise<TrendInfo | null> {
  const candles = await fetchRecentCandles(symbol);
  if (candles && candles.length >= TREND_LOOKBACK_CANDLES + 1) {
    const recent = candles.slice(-TREND_LOOKBACK_CANDLES - 1);
    const startClose = recent[0].close;
    const endClose = recent[recent.length - 1].close;
    if (Number.isFinite(startClose) && startClose > 0 && Number.isFinite(endClose)) {
      const changePct = ((endClose - startClose) / startClose) * 100;
      const label: TrendInfo["label"] =
        Math.abs(changePct) < TREND_FLAT_THRESHOLD_PCT ? "LATERAL" : changePct > 0 ? "ALTA" : "BAIXA";
      return { changePct: Number(changePct.toFixed(3)), label, lookbackMinutes: TREND_LOOKBACK_CANDLES * 5, source: "candle" };
    }
  }

  const tickTrend = getTickTrend(symbol);
  if (!tickTrend) return null;
  return { changePct: tickTrend.changePct, label: tickTrend.label, lookbackMinutes: tickTrend.lookbackMinutes, source: "tick" };
}

export interface VolumeConfirmation {
  /** Volume das últimas 3 velas (15min) dividido pela média das 12 anteriores (1h) -- OU (fallback) razão entre inclinação recente e anterior do preço, ver "source". */
  ratio: number;
  /** true quando a participação (volume real, ou aceleração de momentum no fallback) está claramente acima do normal recente. */
  elevated: boolean;
  /** "candle_volume" = tickVolume real da MetaAPI; "tick_momentum" = fallback (aceleração de preço, sem volume disponível). */
  source: "candle_volume" | "tick_momentum";
}

// 🔴 2026-08-29 (otimização pós-conversa sobre Rotter/Pulcini/Antunes -- os
// três são scalpers de order flow/tape reading, técnica que depende de book
// de ofertas em tempo real que este sistema NÃO tem, ver CLAUDE.md/histórico
// da conversa). O que ESTE sistema tem de real e comparável é o tickVolume
// que a própria MetaAPI já devolve em /mt5-candles (campo `volume`,
// `formattedCandles` em supabase/functions/server/index.ts) -- nunca usado
// até agora neste projeto. Não é profundidade de book nem fluxo de ordens de
// verdade, mas é um proxy honesto e real (não fabricado) da mesma ideia por
// trás do "tape reading": um movimento de preço acompanhado de volume acima
// do normal tem mais probabilidade de ser participação real (dinheiro
// entrando) do que ruído -- e o oposto (mover contra a tendência com volume
// FRACO) é exatamente o tipo de entrada de baixa convicção que gerou o
// prejuízo de 2026-08-29 (SHORT repetido durante um rali sem nenhuma leitura
// de força/fraqueza por trás do movimento).
const VOLUME_RECENT_CANDLES = 3; // 15min
const VOLUME_BASELINE_CANDLES = 12; // 1h anterior
const VOLUME_ELEVATED_RATIO = 1.15;

/**
 * 🔴 2026-08-29 (mesmo achado do Cleber): fallback quando o candle (e o
 * volume real dele) não vem -- usa aceleração de momentum por tick real
 * (tickHistory.ts) como proxy de participação. Não é volume de verdade, é
 * derivado só de preço, mas é dado real deste processo, nunca fabricado.
 */
export async function getVolumeConfirmation(symbol: string): Promise<VolumeConfirmation | null> {
  const candles = await fetchRecentCandles(symbol);
  if (candles && candles.length >= VOLUME_RECENT_CANDLES + VOLUME_BASELINE_CANDLES) {
    const hasVolume = !candles.some((c) => typeof c.volume !== "number" || !Number.isFinite(c.volume));
    if (hasVolume) {
      const recent = candles.slice(-VOLUME_RECENT_CANDLES);
      const baseline = candles.slice(-VOLUME_RECENT_CANDLES - VOLUME_BASELINE_CANDLES, -VOLUME_RECENT_CANDLES);
      const recentAvg = recent.reduce((sum, c) => sum + (c.volume as number), 0) / recent.length;
      const baselineAvg = baseline.reduce((sum, c) => sum + (c.volume as number), 0) / baseline.length;
      if (baselineAvg > 0) {
        const ratio = recentAvg / baselineAvg;
        return { ratio: Number(ratio.toFixed(2)), elevated: ratio >= VOLUME_ELEVATED_RATIO, source: "candle_volume" };
      }
    }
  }

  const momentum = getMomentumAcceleration(symbol);
  if (!momentum) return null;
  const ratio = momentum.priorSlopePct !== 0 ? Math.abs(momentum.recentSlopePct / momentum.priorSlopePct) : momentum.accelerating ? 2 : 1;
  return { ratio: Number(ratio.toFixed(2)), elevated: momentum.accelerating, source: "tick_momentum" };
}

export interface SupportResistance {
  /** Máxima e mínima real da janela de candle recente (2,5h em velas de 5m) -- topo/fundo honesto, não projetado. */
  resistance: number;
  support: number;
  /** Distância % do preço atual até cada nível (sempre >= 0 -- preço nunca fica "acima" da resistência nem "abaixo" do suporte por definição de como são calculados). */
  distanceToResistancePct: number;
  distanceToSupportPct: number;
  /** true quando o preço está a menos de 0,15% de um dos dois níveis -- zona onde reação (rejeição ou rompimento) é mais provável. */
  nearLevel: "RESISTENCIA" | "SUPORTE" | null;
  lookbackMinutes: number;
}

const SR_NEAR_LEVEL_THRESHOLD_PCT = 0.15;

/**
 * 🔴 2026-08-29 (pedido do Cleber, "fundamentos completos de price action"):
 * suporte/resistência é o fundamento mais básico de price action e só agora
 * é honesto de calcular -- depende de candle OHLC real, que `/mt5-candles`
 * só passou a entregar de verdade depois do fix do endpoint (era 404 na
 * MetaAPI, caindo sempre em SIMULATED). Deliberadamente simples (máxima/
 * mínima da própria janela que já buscamos para ATR/tendência/volume, sem
 * fetch extra): não é zona de order block nem nível institucional, é o
 * topo/fundo real e recente que qualquer trader discricionário olharia
 * primeiro. `null` quando não há candle real disponível -- nunca fabrica.
 */
export async function getSupportResistance(symbol: string): Promise<SupportResistance | null> {
  const candles = await fetchRecentCandles(symbol);
  if (!candles || candles.length < 10) return null;

  const highs = candles.map((c) => c.high).filter((v) => Number.isFinite(v));
  const lows = candles.map((c) => c.low).filter((v) => Number.isFinite(v));
  if (highs.length === 0 || lows.length === 0) return null;

  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  const lastClose = candles[candles.length - 1].close;
  if (!Number.isFinite(lastClose) || lastClose <= 0 || resistance <= 0 || support <= 0) return null;

  const distanceToResistancePct = ((resistance - lastClose) / lastClose) * 100;
  const distanceToSupportPct = ((lastClose - support) / lastClose) * 100;
  const nearLevel: SupportResistance["nearLevel"] =
    distanceToResistancePct <= SR_NEAR_LEVEL_THRESHOLD_PCT
      ? "RESISTENCIA"
      : distanceToSupportPct <= SR_NEAR_LEVEL_THRESHOLD_PCT
      ? "SUPORTE"
      : null;

  return {
    resistance: Number(resistance.toFixed(6)),
    support: Number(support.toFixed(6)),
    distanceToResistancePct: Number(Math.max(0, distanceToResistancePct).toFixed(3)),
    distanceToSupportPct: Number(Math.max(0, distanceToSupportPct).toFixed(3)),
    nearLevel,
    lookbackMinutes: candles.length * 5,
  };
}
