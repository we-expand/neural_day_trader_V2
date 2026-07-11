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

async function fetchOne(url: string): Promise<any> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchWithFallback(path: string): Promise<any | null> {
  const directUrl = `${BINANCE_BASE}${path}`;

  // 🚀 PERF: direto + proxies CORS disparados EM PARALELO (Promise.any) em vez de
  // sequencial — antes, se a chamada direta falhasse (comum: bloqueio de rede/CORS),
  // esperava o timeout de 5s dela e só então tentava o próximo, podendo somar até
  // ~15s por símbolo. Agora usa a primeira resposta que chegar.
  const urls = [directUrl, ...CORS_PROXIES.map(build => build(directUrl))];

  try {
    return await Promise.any(urls.map(fetchOne));
  } catch {
    return null; // Todas as tentativas falharam — retorna null sem lançar erro
  }
}

/**
 * Busca ticker de 24h de um símbolo diretamente da Binance
 */
export async function fetchDirectBinance(symbol: string): Promise<BinanceTickerData | null> {
  const normalizedSymbol = symbol.toUpperCase();

  const data = await fetchWithFallback(`/ticker/24hr?symbol=${normalizedSymbol}`);
  if (!data) return null;

  const price = parseFloat(data.lastPrice);
  const change = parseFloat(data.priceChange);
  const changePercent = parseFloat(data.priceChangePercent);

  // ✅ 2026-07-11: os proxies CORS (allorigins/corsproxy) às vezes respondem
  // HTTP 200 com um corpo válido em JSON mas sem os campos esperados (ex:
  // página de erro do proxy encapsulada) — como corre em paralelo com a
  // chamada direta via `Promise.any`, um proxy assim podia "vencer" a corrida
  // e virar preço `NaN` na tela (visto com ETHUSD/DOGEUSD/etc), sem cair no
  // fallback sintético porque tecnicamente não lançava erro nenhum. Validar
  // os números antes de aceitar a resposta.
  if (!isFinite(price) || !isFinite(change) || !isFinite(changePercent)) {
    return null;
  }

  return {
    symbol: normalizedSymbol,
    price,
    change,
    changePercent,
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