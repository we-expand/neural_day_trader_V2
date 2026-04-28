/**
 * 🚀 DIRECT BINANCE SERVICE
 *
 * Busca dados DIRETAMENTE da Binance API pública.
 * Tentativa 1: api.binance.com direto
 * Tentativa 2: allorigins CORS proxy
 * Tentativa 3: corsproxy.io
 * Retorna null silenciosamente se todas falharem — sem erros críticos.
 */

export interface BinanceTickerData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  volume?: number;
  high?: number;
  low?: number;
}

// URL base da Binance
const BINANCE_BASE = 'https://api.binance.com/api/v3';

// Proxies CORS públicos para fallback (sandbox / iframe)
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithFallback(path: string): Promise<any | null> {
  const directUrl = `${BINANCE_BASE}${path}`;

  // 1️⃣ Tentativa direta (funciona em produção / sem sandbox)
  try {
    const res = await fetch(directUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return await res.json();
  } catch {
    // falha silenciosa — tenta proxy
  }

  // 2️⃣ Proxies CORS em sequência
  for (const buildProxy of CORS_PROXIES) {
    try {
      const res = await fetch(buildProxy(directUrl), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return await res.json();
    } catch {
      // próximo proxy
    }
  }

  return null; // Tudo falhou — retorna null sem lançar erro
}

/**
 * Busca ticker de 24h de um símbolo diretamente da Binance
 */
export async function fetchDirectBinance(symbol: string): Promise<BinanceTickerData | null> {
  const normalizedSymbol = symbol.toUpperCase();

  const data = await fetchWithFallback(`/ticker/24hr?symbol=${normalizedSymbol}`);
  if (!data) return null;

  return {
    symbol: normalizedSymbol,
    price: parseFloat(data.lastPrice),
    change: parseFloat(data.priceChange),
    changePercent: parseFloat(data.priceChangePercent),
    volume: parseFloat(data.volume),
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
    timestamp: Date.now(),
  };
}

/**
 * Busca múltiplos símbolos em paralelo
 */
export async function fetchMultipleBinance(symbols: string[]): Promise<Map<string, BinanceTickerData>> {
  const results = new Map<string, BinanceTickerData>();

  await Promise.all(
    symbols.map(async (symbol) => {
      const data = await fetchDirectBinance(symbol);
      if (data) results.set(symbol, data);
    })
  );

  return results;
}

/**
 * Verifica se um símbolo é crypto Binance
 */
export function isBinanceSymbol(symbol: string): boolean {
  const normalized = symbol.toUpperCase();
  const known = [
    'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT',
    'DOGEUSDT','DOTUSDT','LTCUSDT','AVAXUSDT','LINKUSDT','ATOMUSDT',
    'UNIUSDT','NEARUSDT','TRXUSDT','APTUSDT','FTMUSDT','MATICUSDT',
    'POLUSDT','GALAUSDT','AXSUSDT','BCHUSDT','XLMUSDT','ALGOUSDT',
  ];
  return known.includes(normalized) || normalized.endsWith('USDT');
}