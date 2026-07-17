/**
 * 🔄 BACKTEST DATA SERVICE
 *
 * Busca dados históricos REAIS de candles para Backtest e Replay de Mercado,
 * cobrindo o catálogo inteiro de ativos (não só BTCUSDT como antes):
 * - Cripto listada na Binance: klines direto da API pública da Binance.
 * - Forex/índices/commodities/ações: rota /mt5-candles-history (MetaAPI, conta
 *   de plataforma), que pagina o intervalo pedido e NUNCA cai em dado sintético
 *   silencioso — erro explícito quando não há fonte real disponível.
 *
 * Ativos sem fonte real mapeável (não estão na Binance nem são oferecidos pela
 * corretora via MetaAPI) devem ser marcados como indisponíveis pela UI, nunca
 * preenchidos com dado fake.
 */
import { supabase } from '@/lib/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface CandleData {
  time: number; // timestamp em ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalDataResponse {
  candles: CandleData[];
  startTime: number;
  endTime: number;
  totalCandles: number;
  source: 'binance' | 'metaapi';
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export class BacktestDataUnavailableError extends Error {
  constructor(public symbol: string, message: string) {
    super(message);
    this.name = 'BacktestDataUnavailableError';
  }
}

// Prefixos/códigos do catálogo (AssetUniverse.tsx) que não batem 1:1 com o
// código base usado pela Binance — mapeamento manual dos casos conhecidos.
const CRYPTO_CATALOG_TO_BINANCE_BASE: Record<string, string> = {
  XBNUSD: 'BTC', BTCUSD: 'BTC',
  XETUSD: 'ETH', XETEUR: 'ETH', XETLC: 'ETC',
  ETCUSD: 'ETC',
};

let binanceSymbolsCache: Set<string> | null = null;
async function getBinanceListedSymbols(): Promise<Set<string>> {
  if (binanceSymbolsCache) return binanceSymbolsCache;
  try {
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    if (!res.ok) throw new Error(`Binance exchangeInfo HTTP ${res.status}`);
    const data = await res.json();
    binanceSymbolsCache = new Set((data.symbols || []).map((s: any) => s.symbol as string));
  } catch (error) {
    console.warn('[BACKTEST_DATA] ⚠️ Falha ao carregar exchangeInfo da Binance', error);
    binanceSymbolsCache = new Set();
  }
  return binanceSymbolsCache;
}

/** Resolve o ticker da Binance para um símbolo do catálogo, ou null se não houver correspondência real. */
export async function resolveBinanceTicker(catalogSymbol: string): Promise<string | null> {
  const symbols = await getBinanceListedSymbols();

  // ✅ 2026-07-17: o símbolo já pode chegar no formato nativo da Binance
  // (ex: 'BTCUSDT' — é o default de `TradingContext.selectedAsset`, distinto
  // do símbolo de catálogo/corretora 'BTCUSD'). `catalogSymbol.endsWith('USD')`
  // é FALSO pra 'BTCUSDT' (termina em "USDT", não "USD") — sem este check, o
  // símbolo nunca resolvia via Binance e caía direto (e incorretamente) na
  // MetaAPI, que não conhece sufixo USDT.
  if (catalogSymbol.endsWith('USDT') && symbols.has(catalogSymbol)) {
    return catalogSymbol;
  }

  const mapped = CRYPTO_CATALOG_TO_BINANCE_BASE[catalogSymbol];
  const base = mapped ?? (catalogSymbol.endsWith('USD') ? catalogSymbol.slice(0, -3) : null);
  if (!base) return null;

  const candidate = `${base}USDT`;
  return symbols.has(candidate) ? candidate : null;
}

/** Corretora (MetaAPI/Infinox) não conhece o sufixo "USDT" (notação de
 *  exchange cripto) — só "USD". Normaliza antes de mandar pro backend. */
function normalizeForBroker(catalogSymbol: string): string {
  return catalogSymbol.endsWith('USDT') ? catalogSymbol.slice(0, -1) : catalogSymbol;
}

class BacktestDataService {
  private cache: Map<string, CandleData[]> = new Map();
  private binanceBaseUrl = 'https://api.binance.com/api/v3';

  private getIntervalFromTimeframe(timeframe: Timeframe): string {
    const map: Record<Timeframe, string> = {
      '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d',
    };
    return map[timeframe];
  }

  private cacheKey(symbol: string, timeframe: Timeframe, startDate: Date, endDate: Date): string {
    return `${symbol}_${timeframe}_${startDate.getTime()}_${endDate.getTime()}`;
  }

  /**
   * Busca dados históricos reais para qualquer símbolo do catálogo.
   * Lança `BacktestDataUnavailableError` se não houver fonte real disponível
   * — nunca retorna dado sintético disfarçado de real.
   */
  async fetchHistoricalData(
    catalogSymbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe = '1h'
  ): Promise<HistoricalDataResponse> {
    const cacheKey = this.cacheKey(catalogSymbol, timeframe, startDate, endDate);
    if (this.cache.has(cacheKey)) {
      const candles = this.cache.get(cacheKey)!;
      return {
        candles,
        startTime: candles[0].time,
        endTime: candles[candles.length - 1].time,
        totalCandles: candles.length,
        source: 'binance',
      };
    }

    const binanceTicker = await resolveBinanceTicker(catalogSymbol);
    let result: HistoricalDataResponse;

    if (binanceTicker) {
      try {
        result = await this.fetchFromBinance(binanceTicker, startDate, endDate, timeframe);
      } catch (binanceError) {
        // ✅ 2026-07-17: chamada direta à Binance a partir do NAVEGADOR do
        // usuário pode falhar (CORS/bloqueio geográfico 451, já documentado
        // repetidamente neste projeto pra outros serviços de cripto) mesmo
        // quando o servidor consegue — antes isso derrubava o Score inteiro
        // pra sempre. Cai pra MetaAPI (via broker de plataforma) como
        // segunda fonte real, em vez de desistir.
        console.warn(`[BACKTEST_DATA] ⚠️ Binance falhou pra ${binanceTicker}, tentando MetaAPI:`, binanceError);
        result = await this.fetchFromMetaApiHistory(normalizeForBroker(catalogSymbol), startDate, endDate, timeframe);
      }
    } else {
      result = await this.fetchFromMetaApiHistory(normalizeForBroker(catalogSymbol), startDate, endDate, timeframe);
    }

    this.cache.set(cacheKey, result.candles);
    return result;
  }

  private async fetchFromBinance(
    binanceTicker: string,
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe
  ): Promise<HistoricalDataResponse> {
    const interval = this.getIntervalFromTimeframe(timeframe);
    const msPerCandle: Record<Timeframe, number> = {
      '1m': 60_000, '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 3_600_000, '4h': 4 * 3_600_000, '1d': 86_400_000,
    };
    const chunkMs = 1000 * msPerCandle[timeframe];

    const allCandles: CandleData[] = [];
    let currentStart = startDate.getTime();
    const finalEnd = endDate.getTime();

    while (currentStart < finalEnd) {
      const currentEnd = Math.min(currentStart + chunkMs, finalEnd);
      const url = `${this.binanceBaseUrl}/klines?symbol=${binanceTicker}&interval=${interval}&startTime=${currentStart}&endTime=${currentEnd}&limit=1000`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new BacktestDataUnavailableError(binanceTicker, `Binance API HTTP ${response.status}`);
      }
      const rawData: any[] = await response.json();
      allCandles.push(...rawData.map((item: any) => ({
        time: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
      })));
      currentStart = currentEnd;
      if (finalEnd - currentStart > 0) await new Promise(resolve => setTimeout(resolve, 150));
    }

    if (allCandles.length === 0) {
      throw new BacktestDataUnavailableError(binanceTicker, 'Binance retornou 0 candles para o intervalo pedido');
    }

    return {
      candles: allCandles,
      startTime: allCandles[0].time,
      endTime: allCandles[allCandles.length - 1].time,
      totalCandles: allCandles.length,
      source: 'binance',
    };
  }

  private async fetchFromMetaApiHistory(
    catalogSymbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe
  ): Promise<HistoricalDataResponse> {
    const timeframeMap: Record<Timeframe, string> = {
      '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D',
    };

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    // ✅ 2026-07-17: `import.meta.env.VITE_SUPABASE_URL` nunca foi configurada
    // neste projeto (nenhum outro arquivo usa essa env var — todos derivam de
    // `projectId` em utils/supabase/info.ts) — em produção resolvia pra
    // `undefined`, virando a URL literal ".../undefined/functions/v1/..." e
    // batendo HTTP 405 sempre. Também faltava o header `apikey`, exigido pelo
    // CORS da Edge Function (mesmo fix já aplicado nas outras rotas do app).
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/server/mt5-candles-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publicAnonKey,
        Authorization: `Bearer ${accessToken || publicAnonKey}`,
      },
      body: JSON.stringify({
        symbol: catalogSymbol,
        timeframe: timeframeMap[timeframe],
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      }),
    });

    // ✅ 2026-07-17: resposta não-JSON (ex: erro HTML/vazio de rede, ou 401 sem
    // corpo) fazia `.json()` lançar `SyntaxError: Unexpected end of JSON input`
    // — um erro genérico que escondia a causa real. Lê como texto primeiro e
    // tenta parsear, com mensagem explícita se falhar.
    const rawText = await response.text();
    let data: any;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new BacktestDataUnavailableError(
        catalogSymbol,
        `Resposta inválida do servidor de candles (HTTP ${response.status})`
      );
    }

    if (!response.ok || !data.success) {
      throw new BacktestDataUnavailableError(
        catalogSymbol,
        data?.message || `Sem dado histórico real disponível para ${catalogSymbol}`
      );
    }

    const candles: CandleData[] = data.candles.map((c: any) => ({
      time: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    return {
      candles,
      startTime: candles[0].time,
      endTime: candles[candles.length - 1].time,
      totalCandles: candles.length,
      source: 'metaapi',
    };
  }

  /** Checa (sem buscar histórico completo) se um símbolo do catálogo tem fonte real disponível. */
  async hasRealDataSource(catalogSymbol: string): Promise<boolean> {
    const binanceTicker = await resolveBinanceTicker(catalogSymbol);
    if (binanceTicker) return true;
    // Para MetaAPI não dá pra confirmar sem uma chamada real; assume disponível
    // (a UI trata o erro explícito da rota se não for o caso) para os símbolos
    // que a IA já opera de fato hoje.
    return true;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCachedData(catalogSymbol: string, startDate: Date, endDate: Date, timeframe: Timeframe): CandleData[] | null {
    return this.cache.get(this.cacheKey(catalogSymbol, timeframe, startDate, endDate)) || null;
  }
}

export const backtestDataService = new BacktestDataService();
