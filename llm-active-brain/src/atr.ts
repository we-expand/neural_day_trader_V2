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

const atrCache = new Map<string, { pct: number; fetchedAt: number }>();
const ATR_CACHE_TTL_MS = 5 * 60 * 1000; // 5min -- ATR de candle de 5m não muda de forma relevante a cada ciclo (30s)

/**
 * Retorna o ATR do símbolo como fração do preço (ex: 0.004 = 0.4%), ou
 * `null` se não deu pra calcular com dado real (chamador deve cair pro %
 * fixo de segurança nesse caso, nunca travar a abertura de posição).
 */
export async function getAtrPercent(symbol: string): Promise<number | null> {
  const cached = atrCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < ATR_CACHE_TTL_MS) return cached.pct;

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

    const atr = calculateAtr(candles, 14);
    const lastClose = candles[candles.length - 1].close;
    if (atr == null || !Number.isFinite(atr) || !Number.isFinite(lastClose) || lastClose <= 0) return null;

    const pct = atr / lastClose;
    atrCache.set(symbol, { pct, fetchedAt: Date.now() });
    return pct;
  } catch {
    return null;
  }
}
