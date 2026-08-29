import { config } from "./config.js";

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
 */
export async function getAtrPercent(symbol: string): Promise<number | null> {
  const candles = await fetchRecentCandles(symbol);
  if (!candles) return null;
  const atr = calculateAtr(candles, 14);
  const lastClose = candles[candles.length - 1].close;
  if (atr == null || !Number.isFinite(atr) || !Number.isFinite(lastClose) || lastClose <= 0) return null;
  return atr / lastClose;
}

export interface TrendInfo {
  /** Variação % do fechamento nas últimas `lookback` velas de 5m (positivo = subiu). */
  changePct: number;
  /** Rótulo simples pro LLM não ter que interpretar o número sozinho. */
  label: "ALTA" | "BAIXA" | "LATERAL";
  lookbackMinutes: number;
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

export async function getTrendInfo(symbol: string): Promise<TrendInfo | null> {
  const candles = await fetchRecentCandles(symbol);
  if (!candles || candles.length < TREND_LOOKBACK_CANDLES + 1) return null;

  const recent = candles.slice(-TREND_LOOKBACK_CANDLES - 1);
  const startClose = recent[0].close;
  const endClose = recent[recent.length - 1].close;
  if (!Number.isFinite(startClose) || startClose <= 0 || !Number.isFinite(endClose)) return null;

  const changePct = ((endClose - startClose) / startClose) * 100;
  const label: TrendInfo["label"] =
    Math.abs(changePct) < TREND_FLAT_THRESHOLD_PCT ? "LATERAL" : changePct > 0 ? "ALTA" : "BAIXA";

  return { changePct: Number(changePct.toFixed(3)), label, lookbackMinutes: TREND_LOOKBACK_CANDLES * 5 };
}

export interface VolumeConfirmation {
  /** Volume das últimas 3 velas (15min) dividido pela média das 12 anteriores (1h). >1 = participação crescente. */
  ratio: number;
  /** true quando a participação (volume) está claramente acima do normal recente -- proxy honesto de "força por trás do movimento". */
  elevated: boolean;
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

export async function getVolumeConfirmation(symbol: string): Promise<VolumeConfirmation | null> {
  const candles = await fetchRecentCandles(symbol);
  if (!candles || candles.length < VOLUME_RECENT_CANDLES + VOLUME_BASELINE_CANDLES) return null;
  if (candles.some((c) => typeof c.volume !== "number" || !Number.isFinite(c.volume))) return null; // sem volume real -- nao inventa

  const recent = candles.slice(-VOLUME_RECENT_CANDLES);
  const baseline = candles.slice(-VOLUME_RECENT_CANDLES - VOLUME_BASELINE_CANDLES, -VOLUME_RECENT_CANDLES);
  const recentAvg = recent.reduce((sum, c) => sum + (c.volume as number), 0) / recent.length;
  const baselineAvg = baseline.reduce((sum, c) => sum + (c.volume as number), 0) / baseline.length;
  if (!(baselineAvg > 0)) return null;

  const ratio = recentAvg / baselineAvg;
  return { ratio: Number(ratio.toFixed(2)), elevated: ratio >= VOLUME_ELEVATED_RATIO };
}
