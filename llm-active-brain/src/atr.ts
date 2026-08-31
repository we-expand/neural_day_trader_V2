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
const CANDLES_CACHE_TTL_MS = 5 * 60 * 1000; // 5min -- teto de segurança pro maior timeframe suportado (5m); timeframes menores usam um TTL mais curto, ver CACHE_TTL_BY_TIMEFRAME abaixo

// 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Timeframe Operacional"):
// TTL do cache precisa ser <= a duracao de 1 vela do timeframe escolhido,
// senao um timeframe curto (1m) fica lendo candle "fresco" que na verdade
// tem ate 5min de idade (o TTL fixo antigo, calibrado so pro caso de 5m).
const CACHE_TTL_BY_TIMEFRAME: Record<string, number> = {
  "1m": 30 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 5 * 60 * 1000,
  "1H": 5 * 60 * 1000,
  "4H": 15 * 60 * 1000,
};

/** Timeframes suportados pelo endpoint /mt5-candles (ver timeframeMap em supabase/functions/server/index.ts) -- mesmos valores que o campo `timeframe` do Setup do AI Trader (AIConfig) já usa no frontend. */
export const SUPPORTED_TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H"] as const;
export type SupportedTimeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

/**
 * Busca (com cache) as últimas velas reais do símbolo no timeframe pedido,
 * MESMA fonte que `getAtrPercent`/`getTrendInfo` usam -- extraído pra um só
 * fetch por símbolo/timeframe/ciclo em vez de duplicar a chamada de rede
 * pra cada métrica derivada dela (2026-08-29, otimização urgente pós-perda
 * do dia). 🔴 2026-08-31: timeframe agora é parâmetro (Setup do AI Trader) --
 * default "5m" preserva o comportamento de todas as sessões que não
 * configuraram nada.
 */
async function fetchRecentCandles(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<Candle[] | null> {
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = candlesCache.get(cacheKey);
  const ttl = CACHE_TTL_BY_TIMEFRAME[timeframe] ?? CANDLES_CACHE_TTL_MS;
  if (cached && Date.now() - cached.fetchedAt < ttl) return cached.candles;

  const url = `${config.neuralSupabaseUrl}/functions/v1/server/mt5-candles`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.neuralSupabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      // 🔴 2026-08-30 (implementação de MACD real, pedido do Cleber pós
      // XETUSD SHORT com tese fraca): limit subiu de 30 pra 60 velas. MACD
      // clássico (EMA12/26/9) precisa de aquecimento real -- com 30 velas a
      // EMA26 mal teria 4-5 velas de warm-up antes do primeiro valor
      // usável, ficando instável logo no início da série. 60 velas dá
      // warm-up de verdade pras 3 EMAs sem pesar demais o fetch, em
      // qualquer timeframe (mesmo endpoint).
      body: JSON.stringify({ symbol, timeframe, limit: 60 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const result = (await res.json()) as Mt5CandlesResponse;
    if (result.source === "SIMULATED") return null; // mesma trava de mt5Broker.ts -- nunca decide em cima de candle fabricado
    const candles = result.candles;
    // 🔴 2026-08-30: mínimo subiu de 15 pra 35 -- abaixo disso o MACD (que
    // agora também consome esta mesma função) sairia capenga (EMA26 sem
    // warm-up suficiente). ATR/tendência/volume/S&R continuam funcionando
    // bem acima desse mínimo, então não perdem precisão com o ajuste.
    if (!Array.isArray(candles) || candles.length < 35) return null;

    candlesCache.set(cacheKey, { candles, fetchedAt: Date.now() });
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
/** Minutos por vela de cada timeframe suportado -- só pra reportar `lookbackMinutes` corretamente quando o timeframe não é o default de 5m. */
const TIMEFRAME_MINUTES: Record<string, number> = { "1m": 1, "5m": 5, "15m": 15, "1H": 60, "4H": 240 };

export async function getAtrPercent(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<number | null> {
  const candles = await fetchRecentCandles(symbol, timeframe);
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
export async function getTrendInfo(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<TrendInfo | null> {
  const candles = await fetchRecentCandles(symbol, timeframe);
  if (candles && candles.length >= TREND_LOOKBACK_CANDLES + 1) {
    const recent = candles.slice(-TREND_LOOKBACK_CANDLES - 1);
    const startClose = recent[0].close;
    const endClose = recent[recent.length - 1].close;
    if (Number.isFinite(startClose) && startClose > 0 && Number.isFinite(endClose)) {
      const changePct = ((endClose - startClose) / startClose) * 100;
      const label: TrendInfo["label"] =
        Math.abs(changePct) < TREND_FLAT_THRESHOLD_PCT ? "LATERAL" : changePct > 0 ? "ALTA" : "BAIXA";
      return { changePct: Number(changePct.toFixed(3)), label, lookbackMinutes: TREND_LOOKBACK_CANDLES * (TIMEFRAME_MINUTES[timeframe] ?? 5), source: "candle" };
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
const VOLUME_ELEVATED_RATIO = 1.05; // 2026-08-31: baixado de 1.15 a pedido do Cleber (achou restritivo demais)

/**
 * 🔴 2026-08-29 (mesmo achado do Cleber): fallback quando o candle (e o
 * volume real dele) não vem -- usa aceleração de momentum por tick real
 * (tickHistory.ts) como proxy de participação. Não é volume de verdade, é
 * derivado só de preço, mas é dado real deste processo, nunca fabricado.
 */
export async function getVolumeConfirmation(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<VolumeConfirmation | null> {
  const candles = await fetchRecentCandles(symbol, timeframe);
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
export async function getSupportResistance(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<SupportResistance | null> {
  const candles = await fetchRecentCandles(symbol, timeframe);
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
    lookbackMinutes: candles.length * (TIMEFRAME_MINUTES[timeframe] ?? 5),
  };
}

export interface MacdResult {
  /** Linha MACD (EMA12 - EMA26), em unidade de preço (mesma unidade do símbolo). */
  macd: number;
  /** EMA9 da linha MACD -- linha de sinal. */
  signal: number;
  /** macd - signal -- o que realmente importa pra leitura de momentum. */
  histogram: number;
  /** ALTA = histograma positivo (momentum comprador), BAIXA = negativo, NEUTRO = perto de zero. */
  label: "ALTA" | "BAIXA" | "NEUTRO";
  /** Histograma mudou de sinal na última vela vs a penúltima -- sinal de virada real, não só direção atual. null quando não houve troca de sinal. */
  crossing: "CRUZOU_PARA_CIMA" | "CRUZOU_PARA_BAIXO" | null;
}

const MACD_FAST_PERIOD = 12;
const MACD_SLOW_PERIOD = 26;
const MACD_SIGNAL_PERIOD = 9;
// Limiar de "perto de zero" pra rotular NEUTRO em vez de forçar ALTA/BAIXA
// num histograma tecnicamente positivo/negativo mas irrisório -- mesmo
// espírito do TREND_FLAT_THRESHOLD_PCT acima, só que relativo ao preço do
// símbolo (histograma de BTCUSD e de XETUSD vivem em escalas bem diferentes).
const MACD_NEUTRAL_THRESHOLD_RATIO = 0.0001; // 0,01% do preço de fechamento

/** Calcula a série completa de EMA (não só o último valor) -- necessário pra poder derivar a EMA9 da própria série de MACD depois. Seed = SMA dos primeiros `period` valores, mesmo espírito do seed de `calculateAtr` acima. */
function calculateEmaSeries(values: number[], period: number): number[] | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const emaSeries: number[] = new Array(values.length).fill(NaN);
  emaSeries[period - 1] = seed;
  let ema = seed;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    emaSeries[i] = ema;
  }
  return emaSeries;
}

/**
 * 🔴 2026-08-30 (pedido direto do Cleber): MACD clássico (EMA12 - EMA26,
 * linha de sinal EMA9 da linha MACD) -- fica viável de calcular de verdade
 * agora que `/mt5-candles` entrega candle OHLC oficial real pra esta cesta
 * (era 404/SIMULATED até uma sessão anterior, ver histórico). Reaproveita
 * `fetchRecentCandles` (mesmo fetch, mesmo cache de 5min, mesmos closes que
 * trend/volume/extension/S&R já usam) -- não fabrica nenhum número: se não
 * houver candle real suficiente (mínimo 35 velas, ver ajuste acima),
 * retorna `null`, MESMA disciplina do resto deste arquivo.
 */
export async function getMacd(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<MacdResult | null> {
  const candles = await fetchRecentCandles(symbol, timeframe);
  if (!candles || candles.length < MACD_SLOW_PERIOD + MACD_SIGNAL_PERIOD) return null;

  const closes = candles.map((c) => c.close).filter((v) => Number.isFinite(v));
  if (closes.length !== candles.length) return null; // algum close inválido -- não tenta calcular em cima de dado incompleto

  const emaFastSeries = calculateEmaSeries(closes, MACD_FAST_PERIOD);
  const emaSlowSeries = calculateEmaSeries(closes, MACD_SLOW_PERIOD);
  if (!emaFastSeries || !emaSlowSeries) return null;

  // Linha MACD só existe a partir de onde a EMA lenta (26) começa a existir.
  const macdSeries: number[] = [];
  for (let i = MACD_SLOW_PERIOD - 1; i < closes.length; i++) {
    macdSeries.push(emaFastSeries[i] - emaSlowSeries[i]);
  }
  if (macdSeries.length < MACD_SIGNAL_PERIOD) return null; // sem warm-up suficiente pra linha de sinal

  const signalSeries = calculateEmaSeries(macdSeries, MACD_SIGNAL_PERIOD);
  if (!signalSeries) return null;

  const lastIdx = macdSeries.length - 1;
  const macd = macdSeries[lastIdx];
  const signal = signalSeries[lastIdx];
  if (!Number.isFinite(macd) || !Number.isFinite(signal)) return null;
  const histogram = macd - signal;

  const lastClose = closes[closes.length - 1];
  const neutralThreshold = Number.isFinite(lastClose) && lastClose > 0 ? lastClose * MACD_NEUTRAL_THRESHOLD_RATIO : 0;
  const label: MacdResult["label"] =
    Math.abs(histogram) < neutralThreshold ? "NEUTRO" : histogram > 0 ? "ALTA" : "BAIXA";

  // Crossing: compara o sinal do histograma da última vela vs a penúltima
  // (precisa de pelo menos 2 pontos de sinal calculados).
  let crossing: MacdResult["crossing"] = null;
  const prevIdx = lastIdx - 1;
  if (prevIdx >= 0 && Number.isFinite(signalSeries[prevIdx])) {
    const prevHistogram = macdSeries[prevIdx] - signalSeries[prevIdx];
    if (Number.isFinite(prevHistogram)) {
      if (prevHistogram <= 0 && histogram > 0) crossing = "CRUZOU_PARA_CIMA";
      else if (prevHistogram >= 0 && histogram < 0) crossing = "CRUZOU_PARA_BAIXO";
    }
  }

  return {
    macd: Number(macd.toFixed(6)),
    signal: Number(signal.toFixed(6)),
    histogram: Number(histogram.toFixed(6)),
    label,
    crossing,
  };
}

export interface SlowStochasticResult {
  /** %K lento (media movel de 3 periodos do %K rapido), 0-100. */
  k: number;
  /** %D -- media movel de 3 periodos do %K lento (linha de sinal). */
  d: number;
  /** k >= 80 = SOBRECOMPRADO, k <= 20 = SOBREVENDIDO, senao NEUTRO. */
  label: "SOBRECOMPRADO" | "SOBREVENDIDO" | "NEUTRO";
  /** %K cruzou %D na ultima vela vs a penultima -- sinal classico de reversao/continuacao. null quando nao houve cruzamento. */
  crossing: "CRUZOU_PARA_CIMA" | "CRUZOU_PARA_BAIXO" | null;
}

const STOCH_PERIOD = 14;
const STOCH_K_SMOOTHING = 3;
const STOCH_D_SMOOTHING = 3;
const STOCH_OVERBOUGHT = 80;
const STOCH_OVERSOLD = 20;

/** Media movel simples de janela `period`, retorna série completa (NaN onde não há dados suficientes). */
function calculateSmaSeries(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result[i] = sum / period;
  }
  return result;
}

/**
 * 🔴 2026-08-30 (pedido direto do Cleber, junto do MACD): Estocástico LENTO
 * clássico -- %K rápido de cada vela = (close - menor_low_periodo) /
 * (maior_high_periodo - menor_low_periodo) * 100 (período 14), %K lento =
 * SMA3 do %K rápido, %D = SMA3 do %K lento. Mesma fonte/cache de
 * `fetchRecentCandles` que MACD/ATR/tendência já usam -- se não houver
 * candle real suficiente, retorna `null`, nunca fabrica indicador.
 */
export async function getSlowStochastic(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<SlowStochasticResult | null> {
  const candles = await fetchRecentCandles(symbol, timeframe);
  const minCandles = STOCH_PERIOD + STOCH_K_SMOOTHING + STOCH_D_SMOOTHING; // warm-up real pra dupla suavização
  if (!candles || candles.length < minCandles) return null;

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  if (!closes.every(Number.isFinite) || !highs.every(Number.isFinite) || !lows.every(Number.isFinite)) return null;

  // %K rápido pra série completa (a partir de onde há janela de 14 velas).
  const fastK: number[] = new Array(candles.length).fill(NaN);
  for (let i = STOCH_PERIOD - 1; i < candles.length; i++) {
    const windowHigh = Math.max(...highs.slice(i - STOCH_PERIOD + 1, i + 1));
    const windowLow = Math.min(...lows.slice(i - STOCH_PERIOD + 1, i + 1));
    const range = windowHigh - windowLow;
    fastK[i] = range > 0 ? ((closes[i] - windowLow) / range) * 100 : 50; // range 0 = preço parado, neutro
  }

  const validFastK = fastK.filter((v) => Number.isFinite(v));
  if (validFastK.length < STOCH_K_SMOOTHING + STOCH_D_SMOOTHING) return null;

  const slowKSeries = calculateSmaSeries(validFastK, STOCH_K_SMOOTHING);
  const validSlowK = slowKSeries.filter((v) => Number.isFinite(v));
  if (validSlowK.length < STOCH_D_SMOOTHING) return null;

  const dSeries = calculateSmaSeries(validSlowK, STOCH_D_SMOOTHING);

  const lastK = validSlowK[validSlowK.length - 1];
  const lastD = dSeries[dSeries.length - 1];
  if (!Number.isFinite(lastK) || !Number.isFinite(lastD)) return null;

  const label: SlowStochasticResult["label"] =
    lastK >= STOCH_OVERBOUGHT ? "SOBRECOMPRADO" : lastK <= STOCH_OVERSOLD ? "SOBREVENDIDO" : "NEUTRO";

  let crossing: SlowStochasticResult["crossing"] = null;
  const prevK = validSlowK[validSlowK.length - 2];
  const prevD = dSeries[dSeries.length - 2];
  if (Number.isFinite(prevK) && Number.isFinite(prevD)) {
    const prevDiff = prevK - prevD;
    const lastDiff = lastK - lastD;
    if (prevDiff <= 0 && lastDiff > 0) crossing = "CRUZOU_PARA_CIMA";
    else if (prevDiff >= 0 && lastDiff < 0) crossing = "CRUZOU_PARA_BAIXO";
  }

  return {
    k: Number(lastK.toFixed(2)),
    d: Number(lastD.toFixed(2)),
    label,
    crossing,
  };
}

// 🔴 2026-08-30 (pedido direto do Cleber, "10 padroes de candle mais
// famosos"): reconhecimento de padroes classicos de candlestick, calculado
// EM CIMA do MESMO candle OHLC oficial (fetchRecentCandles) que os outros
// indicadores deste arquivo ja usam -- nenhum candle sintetico, nunca
// fabrica padrao. Ao contrario de trend/volume/MACD/estocastico (que leem
// so o FECHAMENTO das velas), isto e o primeiro indicador deste arquivo que
// olha a FORMA da vela (corpo vs pavio superior/inferior) -- ate agora o
// LLM nunca teve acesso a essa dimensao do candle (auditado nesta mesma
// sessao: nenhum campo devolvido por get_mt5_quote expunha open/high/low/
// close individual de vela nenhuma). Os 10 padroes: Doji, Martelo, Estrela
// Cadente, Engolfo de Alta, Engolfo de Baixa, Harami de Alta, Harami de
// Baixa, Estrela da Manha, Estrela da Noite, Marubozu (Alta/Baixa). Mesma
// disciplina do resto do arquivo: `null` quando nao ha candle real
// suficiente, deteccao puramente geometrica (razao corpo/pavio/range), sem
// nenhum numero inventado.
export interface CandlePatternResult {
  /** Nomes dos padroes detectados terminando na ULTIMA vela fechada (pode ser mais de um). Vazio quando nenhum padrao bateu os criterios. */
  detected: string[];
  /** Vies classico agregado dos padroes detectados -- "ALTA" (reversao/continuacao compradora), "BAIXA" (vendedora), null quando nenhum padrao detectado ou padroes contraditorios entre si. */
  bias: "ALTA" | "BAIXA" | null;
  lookbackMinutes: number;
}

const CANDLE_PATTERN_TREND_CONTEXT_CANDLES = 5; // ~25min antes do padrao, pra achar "veio de alta/baixa" (martelo/estrela cadente exigem contexto de tendencia pra fazer sentido classico)
const CANDLE_PATTERN_TREND_MIN_PCT = 0.15; // mesmo limiar de TREND_FLAT_THRESHOLD_PCT acima -- abaixo disso nao conta como "vindo de tendencia" nenhuma

interface CandleShape {
  body: number;
  range: number;
  upperWick: number;
  lowerWick: number;
  bullish: boolean;
  bodyRatio: number; // body / range, 0 quando range=0 (vela sem movimento nenhum)
}

function shapeOf(c: Candle): CandleShape {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const bullish = c.close > c.open;
  return { body, range, upperWick, lowerWick, bullish, bodyRatio: range > 0 ? body / range : 0 };
}

/** Tendência simples de contexto (não é o mesmo TrendInfo público -- só olha o trecho ANTES do candle-alvo, pra padrões que exigem "veio de alta"/"veio de baixa" pra fazer sentido classico). */
function priorTrendDirection(candles: Candle[], beforeIndex: number): "ALTA" | "BAIXA" | "LATERAL" {
  const fromIdx = beforeIndex - CANDLE_PATTERN_TREND_CONTEXT_CANDLES;
  if (fromIdx < 0) return "LATERAL";
  const startClose = candles[fromIdx].close;
  const endClose = candles[beforeIndex - 1]?.close;
  if (!Number.isFinite(startClose) || !Number.isFinite(endClose) || startClose <= 0) return "LATERAL";
  const changePct = ((endClose - startClose) / startClose) * 100;
  if (Math.abs(changePct) < CANDLE_PATTERN_TREND_MIN_PCT) return "LATERAL";
  return changePct > 0 ? "ALTA" : "BAIXA";
}

const MIN_CANDLES_FOR_PATTERNS = CANDLE_PATTERN_TREND_CONTEXT_CANDLES + 3; // contexto de tendencia + as ate 3 velas do padrao maior (estrela)

/**
 * Reconhece os 10 padrões de candlestick clássicos mais conhecidos, olhando
 * as últimas 1-3 velas fechadas (a mais recente é sempre a última do
 * padrão). Critérios geométricos padrão de mercado, deliberadamente
 * simples e conservadores -- prefere não detectar (falso negativo) a
 * inventar um padrão que não está lá (falso positivo).
 */
export async function getCandlePatterns(symbol: string, timeframe: SupportedTimeframe = "5m"): Promise<CandlePatternResult | null> {
  const candles = await fetchRecentCandles(symbol, timeframe);
  if (!candles || candles.length < MIN_CANDLES_FOR_PATTERNS) return null;

  const n = candles.length;
  const c0 = candles[n - 3]; // só existe/usado nos padrões de 3 velas
  const c1 = candles[n - 2];
  const c2 = candles[n - 1]; // vela mais recente fechada -- padrão sempre "termina" aqui
  const s1 = shapeOf(c1);
  const s2 = shapeOf(c2);
  if (s2.range <= 0) return { detected: [], bias: null, lookbackMinutes: candles.length * 5 };

  const detected: string[] = [];
  const biases: Array<"ALTA" | "BAIXA"> = [];

  // --- Padrões de 1 vela (avaliados na vela mais recente, c2) ---
  const trendBeforeC2 = priorTrendDirection(candles, n - 1);

  // Doji: corpo praticamente inexistente perto do range da vela -- indecisão.
  if (s2.bodyRatio <= 0.1) {
    detected.push("DOJI");
    // Doji não tem viés direcional próprio -- só sinaliza indecisão/possível virada, sem contar pro bias agregado.
  }

  // Marubozu: corpo domina quase todo o range (pavios mínimos) -- convicção forte na direção do candle.
  if (s2.bodyRatio >= 0.9) {
    if (s2.bullish) {
      detected.push("MARUBOZU_ALTA");
      biases.push("ALTA");
    } else {
      detected.push("MARUBOZU_BAIXA");
      biases.push("BAIXA");
    }
  }

  // Martelo (Hammer): corpo pequeno no topo do range, pavio inferior longo (>=2x corpo), pavio superior mínimo -- reversão compradora, só faz sentido clássico depois de uma BAIXA.
  if (
    s2.body > 0 &&
    s2.bodyRatio <= 0.35 &&
    s2.lowerWick >= s2.body * 2 &&
    s2.upperWick <= s2.range * 0.15 &&
    trendBeforeC2 === "BAIXA"
  ) {
    detected.push("MARTELO");
    biases.push("ALTA");
  }

  // Estrela Cadente (Shooting Star): espelho do martelo -- pavio superior longo, corpo pequeno na base, só faz sentido depois de uma ALTA.
  if (
    s2.body > 0 &&
    s2.bodyRatio <= 0.35 &&
    s2.upperWick >= s2.body * 2 &&
    s2.lowerWick <= s2.range * 0.15 &&
    trendBeforeC2 === "ALTA"
  ) {
    detected.push("ESTRELA_CADENTE");
    biases.push("BAIXA");
  }

  // --- Padrões de 2 velas (c1 -> c2) ---
  // Engolfo de Alta: c1 vermelha, c2 verde, e o corpo de c2 "engole" o corpo inteiro de c1.
  if (!s1.bullish && s2.bullish && c2.open <= c1.close && c2.close >= c1.open && s2.body > s1.body) {
    detected.push("ENGOLFO_ALTA");
    biases.push("ALTA");
  }
  // Engolfo de Baixa: espelho.
  if (s1.bullish && !s2.bullish && c2.open >= c1.close && c2.close <= c1.open && s2.body > s1.body) {
    detected.push("ENGOLFO_BAIXA");
    biases.push("BAIXA");
  }

  // Harami de Alta: c1 vermelha com corpo grande, c2 verde com corpo pequeno TOTALMENTE dentro do corpo de c1.
  if (
    !s1.bullish &&
    s1.bodyRatio >= 0.5 &&
    s2.bullish &&
    s2.body < s1.body * 0.6 &&
    c2.open >= c1.close &&
    c2.close <= c1.open
  ) {
    detected.push("HARAMI_ALTA");
    biases.push("ALTA");
  }
  // Harami de Baixa: espelho.
  if (
    s1.bullish &&
    s1.bodyRatio >= 0.5 &&
    !s2.bullish &&
    s2.body < s1.body * 0.6 &&
    c2.open <= c1.close &&
    c2.close >= c1.open
  ) {
    detected.push("HARAMI_BAIXA");
    biases.push("BAIXA");
  }

  // --- Padrões de 3 velas (c0 -> c1 -> c2), só avaliados se houver candle suficiente antes de c0 pro contexto ---
  if (n - 3 - CANDLE_PATTERN_TREND_CONTEXT_CANDLES >= 0) {
    const s0 = shapeOf(c0);
    const midpointC0 = (c0.open + c0.close) / 2;

    // Estrela da Manhã: vela 1 vermelha grande (queda), vela 2 pequena (indecisão, "estrela"), vela 3 verde grande fechando acima do meio da vela 1 -- reversão compradora clássica.
    if (
      !s0.bullish &&
      s0.bodyRatio >= 0.5 &&
      s1.bodyRatio <= 0.35 &&
      Math.max(c1.open, c1.close) <= c0.close + s0.range * 0.1 &&
      s2.bullish &&
      s2.bodyRatio >= 0.5 &&
      c2.close > midpointC0
    ) {
      detected.push("ESTRELA_DA_MANHA");
      biases.push("ALTA");
    }

    // Estrela da Noite: espelho -- vela 1 verde grande, vela 2 pequena, vela 3 vermelha grande fechando abaixo do meio da vela 1.
    if (
      s0.bullish &&
      s0.bodyRatio >= 0.5 &&
      s1.bodyRatio <= 0.35 &&
      Math.min(c1.open, c1.close) >= c0.close - s0.range * 0.1 &&
      !s2.bullish &&
      s2.bodyRatio >= 0.5 &&
      c2.close < midpointC0
    ) {
      detected.push("ESTRELA_DA_NOITE");
      biases.push("BAIXA");
    }
  }

  const uniqueBiases = new Set(biases);
  const bias: CandlePatternResult["bias"] = uniqueBiases.size === 1 ? [...uniqueBiases][0] : null;

  return { detected, bias, lookbackMinutes: candles.length * 5 };
}
