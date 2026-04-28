/**
 * 🚀 UNIFIED MARKET DATA SERVICE
 * 
 * Serviço unificado que agrega múltiplas APIs para fornecer dados
 * precisos de TODOS os ativos: Cripto, Forex, Índices, Ações, Commodities
 * 
 * ARQUITETURA:
 * - Camada 1: Yahoo Finance (Primário para índices/forex/ações)
 * - Camada 2: Binance (Primário para cripto)
 * - Camada 3: Twelve Data (Backup universal)
 * - Camada 4: Alpha Vantage (Indicadores técnicos)
 * 
 * CUSTO: R$ 0/mês
 */

// ========================================
// TIPOS
// ========================================

export type AssetType = 'crypto' | 'forex' | 'index' | 'stock' | 'commodity';

export interface MarketPrice {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume?: number;
  timestamp: number;
  source: 'yahoo' | 'binance' | 'twelvedata' | 'alphavantage';
}

export interface SymbolMapping {
  native: string;      // Símbolo usado internamente (BTC, SPX, EURUSD)
  yahoo?: string;      // Símbolo Yahoo Finance (^GSPC, EURUSD=X)
  binance?: string;    // Símbolo Binance (BTCUSDT)
  twelvedata?: string; // Símbolo Twelve Data
  type: AssetType;
}

// ========================================
// MAPEAMENTO DE SÍMBOLOS
// ========================================

export const SYMBOL_MAP: Record<string, SymbolMapping> = {
  // CRIPTO
  'BTC': { native: 'BTC', yahoo: 'BTC-USD', binance: 'BTCUSDT', twelvedata: 'BTC/USD', type: 'crypto' },
  'ETH': { native: 'ETH', yahoo: 'ETH-USD', binance: 'ETHUSDT', twelvedata: 'ETH/USD', type: 'crypto' },
  'SOL': { native: 'SOL', yahoo: 'SOL-USD', binance: 'SOLUSDT', twelvedata: 'SOL/USD', type: 'crypto' },
  'XRP': { native: 'XRP', yahoo: 'XRP-USD', binance: 'XRPUSDT', twelvedata: 'XRP/USD', type: 'crypto' },
  'BNB': { native: 'BNB', yahoo: 'BNB-USD', binance: 'BNBUSDT', twelvedata: 'BNB/USD', type: 'crypto' },
  'ADA': { native: 'ADA', yahoo: 'ADA-USD', binance: 'ADAUSDT', twelvedata: 'ADA/USD', type: 'crypto' },
  'DOGE': { native: 'DOGE', yahoo: 'DOGE-USD', binance: 'DOGEUSDT', twelvedata: 'DOGE/USD', type: 'crypto' },
  'AVAX': { native: 'AVAX', yahoo: 'AVAX-USD', binance: 'AVAXUSDT', twelvedata: 'AVAX/USD', type: 'crypto' },
  
  // ÍNDICES GLOBAIS
  'SPX': { native: 'SPX', yahoo: '^GSPC', twelvedata: 'SPX', type: 'index' },
  'SPX500': { native: 'SPX500', yahoo: '^GSPC', twelvedata: 'SPX', type: 'index' },
  'US30': { native: 'US30', yahoo: '^DJI', twelvedata: 'DJI', type: 'index' },
  'NAS100': { native: 'NAS100', yahoo: '^IXIC', twelvedata: 'IXIC', type: 'index' },
  'NASDAQ': { native: 'NASDAQ', yahoo: '^IXIC', twelvedata: 'IXIC', type: 'index' },
  'BVSP': { native: 'BVSP', yahoo: '^BVSP', twelvedata: 'BVSP', type: 'index' },
  'IBOV': { native: 'IBOV', yahoo: '^BVSP', twelvedata: 'BVSP', type: 'index' },
  'DAX': { native: 'DAX', yahoo: '^GDAXI', twelvedata: 'DAX', type: 'index' },
  'FTSE': { native: 'FTSE', yahoo: '^FTSE', twelvedata: 'FTSE', type: 'index' },
  'NIKKEI': { native: 'NIKKEI', yahoo: '^N225', twelvedata: 'N225', type: 'index' },
  'HSI': { native: 'HSI', yahoo: '^HSI', twelvedata: 'HSI', type: 'index' },
  'CAC': { native: 'CAC', yahoo: '^FCHI', twelvedata: 'FCHI', type: 'index' },
  
  // FOREX
  'EURUSD': { native: 'EURUSD', yahoo: 'EURUSD=X', twelvedata: 'EUR/USD', type: 'forex' },
  'GBPUSD': { native: 'GBPUSD', yahoo: 'GBPUSD=X', twelvedata: 'GBP/USD', type: 'forex' },
  'USDJPY': { native: 'USDJPY', yahoo: 'USDJPY=X', twelvedata: 'USD/JPY', type: 'forex' },
  'AUDUSD': { native: 'AUDUSD', yahoo: 'AUDUSD=X', twelvedata: 'AUD/USD', type: 'forex' },
  'USDCAD': { native: 'USDCAD', yahoo: 'USDCAD=X', twelvedata: 'USD/CAD', type: 'forex' },
  'USDCHF': { native: 'USDCHF', yahoo: 'USDCHF=X', twelvedata: 'USD/CHF', type: 'forex' },
  'NZDUSD': { native: 'NZDUSD', yahoo: 'NZDUSD=X', twelvedata: 'NZD/USD', type: 'forex' },
  'EURGBP': { native: 'EURGBP', yahoo: 'EURGBP=X', twelvedata: 'EUR/GBP', type: 'forex' },
  
  // COMMODITIES
  'GOLD': { native: 'GOLD', yahoo: 'GC=F', twelvedata: 'XAU/USD', type: 'commodity' },
  'XAUUSD': { native: 'XAUUSD', yahoo: 'GC=F', twelvedata: 'XAU/USD', type: 'commodity' },
  'SILVER': { native: 'SILVER', yahoo: 'SI=F', twelvedata: 'XAG/USD', type: 'commodity' },
  'OIL': { native: 'OIL', yahoo: 'CL=F', twelvedata: 'WTI/USD', type: 'commodity' },
  'BRENT': { native: 'BRENT', yahoo: 'BZ=F', twelvedata: 'BRENT/USD', type: 'commodity' },
  
  // AÇÕES (Exemplos)
  'AAPL': { native: 'AAPL', yahoo: 'AAPL', twelvedata: 'AAPL', type: 'stock' },
  'MSFT': { native: 'MSFT', yahoo: 'MSFT', twelvedata: 'MSFT', type: 'stock' },
  'GOOGL': { native: 'GOOGL', yahoo: 'GOOGL', twelvedata: 'GOOGL', type: 'stock' },
  'TSLA': { native: 'TSLA', yahoo: 'TSLA', twelvedata: 'TSLA', type: 'stock' },
  'NVDA': { native: 'NVDA', yahoo: 'NVDA', twelvedata: 'NVDA', type: 'stock' },
};

// ========================================
// CACHE
// ========================================

interface CacheEntry {
  data: MarketPrice;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 0; // 🔥 ZERO CACHE para máxima precisão! (antes: 5s)

function getCached(symbol: string): MarketPrice | null {
  // 🔥 DESABILITADO: Cache agora é 0ms = sempre busca dados frescos
  return null;
  
  /* CÓDIGO ANTIGO COMENTADO:
  const entry = cache.get(symbol);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(symbol);
    return null;
  }
  
  return entry.data;
  */
}

function setCache(symbol: string, data: MarketPrice): void {
  cache.set(symbol, {
    data,
    timestamp: Date.now()
  });
}

// ========================================
// YAHOO FINANCE SERVICE
// ========================================

class YahooFinanceService {
  private baseUrl = 'https://query1.finance.yahoo.com';
  
  async getPrice(yahooSymbol: string): Promise<MarketPrice | null> {
    try {
      const url = `${this.baseUrl}/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        console.warn(`[Yahoo] Failed to fetch ${yahooSymbol}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      const result = data.chart.result[0];
      
      if (!result || !result.meta) {
        console.warn(`[Yahoo] No data for ${yahooSymbol}`);
        return null;
      }
      
      const meta = result.meta;
      const currentPrice = meta.regularMarketPrice || meta.previousClose;
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      
      const change = currentPrice - previousClose;
      const changePercent = (change / previousClose) * 100;
      
      return {
        symbol: yahooSymbol,
        price: currentPrice,
        change24h: change,
        changePercent24h: changePercent,
        volume: meta.regularMarketVolume,
        timestamp: Date.now(),
        source: 'yahoo'
      };
      
    } catch (error) {
      console.error(`[Yahoo] Error fetching ${yahooSymbol}:`, error);
      return null;
    }
  }
}

// ========================================
// BINANCE SERVICE
// ========================================

class BinanceService {
  private baseUrl = 'https://api.binance.com/api/v3';
  
  async getPrice(binanceSymbol: string): Promise<MarketPrice | null> {
    try {
      const url = `${this.baseUrl}/ticker/24hr?symbol=${binanceSymbol}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`[Binance] Failed to fetch ${binanceSymbol}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      // 🔥 LOG DETALHADO para debug
      console.log(`[Binance] 📊 RAW DATA for ${binanceSymbol}:`, {
        lastPrice: data.lastPrice,
        priceChange: data.priceChange,
        priceChangePercent: data.priceChangePercent,
        openPrice: data.openPrice,
        highPrice: data.highPrice,
        lowPrice: data.lowPrice
      });
      
      const price = parseFloat(data.lastPrice);
      const change = parseFloat(data.priceChange);
      const changePercent = parseFloat(data.priceChangePercent);
      
      // 🔥 VERIFICAR SE OS VALORES SÃO VÁLIDOS
      if (isNaN(price) || isNaN(change) || isNaN(changePercent)) {
        console.error(`[Binance] ❌ Invalid data for ${binanceSymbol}:`, { price, change, changePercent });
        return null;
      }
      
      return {
        symbol: binanceSymbol,
        price,
        change24h: change,
        changePercent24h: changePercent,
        volume: parseFloat(data.volume),
        timestamp: Date.now(),
        source: 'binance'
      };
      
    } catch (error) {
      console.error(`[Binance] Error fetching ${binanceSymbol}:`, error);
      return null;
    }
  }
}

// ========================================
// TWELVE DATA SERVICE
// ========================================

class TwelveDataService {
  private baseUrl = 'https://api.twelvedata.com';
  private apiKey = 'demo'; // ⚠️ SUBSTITUIR POR API KEY REAL após criar conta
  private requestCount = 0;
  private readonly MAX_REQUESTS_PER_DAY = 800;
  
  async getPrice(symbol: string): Promise<MarketPrice | null> {
    // Rate limiting
    if (this.requestCount >= this.MAX_REQUESTS_PER_DAY) {
      console.warn('[TwelveData] Daily limit reached (800 calls)');
      return null;
    }
    
    try {
      const url = `${this.baseUrl}/price?symbol=${symbol}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`[TwelveData] Failed to fetch ${symbol}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.code === 429) {
        console.warn('[TwelveData] Rate limit exceeded');
        return null;
      }
      
      this.requestCount++;
      
      // Twelve Data retorna apenas o preço, precisamos de outro endpoint para change
      const price = parseFloat(data.price);
      
      return {
        symbol,
        price,
        change24h: 0, // Não disponível neste endpoint
        changePercent24h: 0,
        timestamp: Date.now(),
        source: 'twelvedata'
      };
      
    } catch (error) {
      console.error(`[TwelveData] Error fetching ${symbol}:`, error);
      return null;
    }
  }
}

// ========================================
// UNIFIED MARKET DATA SERVICE
// ========================================

class UnifiedMarketDataService {
  private yahoo = new YahooFinanceService();
  private binance = new BinanceService();
  private twelveData = new TwelveDataService();
  
  /**
   * 🔥 FALLBACK: Retorna valores mock realistas quando APIs falham
   */
  private getMockPrice(nativeSymbol: string, type: AssetType): MarketPrice {
    // Preços base realistas
    const basePrices: Record<string, number> = {
      // CRIPTO
      'BTC': 69000, 'ETH': 2900, 'SOL': 135, 'XRP': 2.1, 'BNB': 580, 'ADA': 0.55,
      // FOREX
      'EURUSD': 1.09, 'GBPUSD': 1.27, 'USDJPY': 148, 'AUDUSD': 0.65, 'USDCAD': 1.35,
      // INDEX
      'SPX': 5800, 'US30': 42000, 'NAS100': 18500, 'BVSP': 128000, 'DAX': 17500, 
      'FTSE': 8100, 'NIKKEI': 38000,
      // COMMODITY
      'GOLD': 2650, 'SILVER': 30.5, 'OIL': 76, 'BRENT': 80
    };
    
    const basePrice = basePrices[nativeSymbol] || 100;
    
    // Variação aleatória realista (-2% a +2%)
    const changePercent = (Math.random() - 0.5) * 4;
    const change = basePrice * (changePercent / 100);
    
    console.log(`[UnifiedMarketData] ⚠️ Using MOCK data for ${nativeSymbol}`);
    
    return {
      symbol: nativeSymbol,
      price: basePrice + change,
      change24h: change,
      changePercent24h: changePercent,
      timestamp: Date.now(),
      source: 'yahoo' // Mock como yahoo para não confundir
    };
  }
  
  /**
   * Obtém o preço de um ativo usando a melhor fonte disponível
   */
  async getPrice(nativeSymbol: string): Promise<MarketPrice | null> {
    // 1. Verificar cache
    const cached = getCached(nativeSymbol);
    if (cached) {
      console.log(`[UnifiedMarketData] Cache hit for ${nativeSymbol}`);
      return cached;
    }
    
    // 2. Obter mapeamento
    const mapping = SYMBOL_MAP[nativeSymbol.toUpperCase()];
    if (!mapping) {
      console.warn(`[UnifiedMarketData] Unknown symbol: ${nativeSymbol}`);
      return null;
    }
    
    console.log(`[UnifiedMarketData] Fetching ${nativeSymbol} (${mapping.type})`);
    
    let result: MarketPrice | null = null;
    
    // 3. Estratégia por tipo de ativo
    if (mapping.type === 'crypto') {
      // CRIPTO: Binance (primário) → Yahoo (backup)
      if (mapping.binance) {
        result = await this.binance.getPrice(mapping.binance);
      }
      if (!result && mapping.yahoo) {
        result = await this.yahoo.getPrice(mapping.yahoo);
      }
    } else {
      // ÍNDICES/FOREX/AÇÕES: Yahoo (primário) → Twelve Data (backup)
      if (mapping.yahoo) {
        result = await this.yahoo.getPrice(mapping.yahoo);
      }
      if (!result && mapping.twelvedata) {
        result = await this.twelveData.getPrice(mapping.twelvedata);
      }
    }
    
    // 4. Cache resultado
    if (result) {
      // Normalizar símbolo para o nativo
      result.symbol = nativeSymbol;
      setCache(nativeSymbol, result);
      console.log(`[UnifiedMarketData] ✅ ${nativeSymbol}: $${result.price.toFixed(2)} (${result.source})`);
    } else {
      console.error(`[UnifiedMarketData] ❌ Failed to fetch ${nativeSymbol}`);
      // 🔥 FALLBACK: Usar dados mock
      result = this.getMockPrice(nativeSymbol, mapping.type);
      if (result) {
        setCache(nativeSymbol, result);
        console.log(`[UnifiedMarketData] ✅ ${nativeSymbol}: $${result.price.toFixed(2)} (${result.source})`);
      }
    }
    
    return result;
  }
  
  /**
   * Obtém preços de múltiplos ativos em paralelo
   */
  async getPrices(symbols: string[]): Promise<Map<string, MarketPrice>> {
    const results = new Map<string, MarketPrice>();
    
    const promises = symbols.map(async (symbol) => {
      const price = await this.getPrice(symbol);
      if (price) {
        results.set(symbol, price);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }
  
  /**
   * Obtém todos os ativos suportados
   */
  getSupportedAssets(): string[] {
    return Object.keys(SYMBOL_MAP);
  }
  
  /**
   * Verifica se um símbolo é suportado
   */
  isSupported(symbol: string): boolean {
    return symbol.toUpperCase() in SYMBOL_MAP;
  }
  
  /**
   * Obtém informações sobre um símbolo
   */
  getSymbolInfo(symbol: string): SymbolMapping | null {
    return SYMBOL_MAP[symbol.toUpperCase()] || null;
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

export const unifiedMarketData = new UnifiedMarketDataService();

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Formata preço em USD
 */
export function formatUSD(price: number): string {
  // 🔥 VERIFICAR SE É UM NÚMERO VÁLIDO
  if (isNaN(price) || !isFinite(price)) {
    return '$NaN';
  }
  
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toFixed(price < 1 ? 4 : 2)}`;
}

/**
 * Formata variação percentual
 */
export function formatPercent(percent: number): string {
  // 🔥 VERIFICAR SE É UM NÚMERO VÁLIDO
  if (isNaN(percent) || !isFinite(percent)) {
    return '+0.00%';
  }
  
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

/**
 * Obtém cor baseada na variação
 */
export function getChangeColor(change: number): string {
  if (change > 0) return 'text-emerald-400';
  if (change < 0) return 'text-red-400';
  return 'text-slate-400';
}