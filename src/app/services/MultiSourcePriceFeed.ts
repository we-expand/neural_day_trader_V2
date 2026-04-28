/**
 * 📡 MULTI-SOURCE PRICE FEED SERVICE
 * 
 * Combina múltiplas fontes de dados para fornecer preços de:
 * - Crypto (Binance)
 * - Forex (Forex APIs)
 * - Stocks (Yahoo Finance / Alpha Vantage)
 * - Indices (TradingEconomics / Yahoo)
 * - Commodities (Yahoo Finance)
 * 
 * Sistema de fallback: se uma API falhar, tenta outra.
 */

import type { MarketPrice } from './brokers/BrokerAdapter';

export interface PriceFeedSource {
  name: string;
  priority: number;          // Quanto menor, maior a prioridade
  supports: (symbol: string) => boolean;
  getPrice: (symbol: string) => Promise<MarketPrice>;
}

/**
 * 🎯 MULTI-SOURCE PRICE FEED
 */
export class MultiSourcePriceFeed {
  private sources: PriceFeedSource[] = [];
  private cache = new Map<string, { price: MarketPrice; timestamp: number }>();
  private cacheTimeout = 1000; // 1 segundo

  constructor() {
    this.registerDefaultSources();
  }

  /**
   * 📊 Registrar fontes padrão
   */
  private registerDefaultSources(): void {
    // 1. BINANCE (Crypto)
    this.registerSource({
      name: 'Binance',
      priority: 1,
      supports: (symbol) => {
        return symbol.endsWith('USDT') || 
               ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE'].some(c => symbol.includes(c));
      },
      getPrice: async (symbol) => {
        const binanceSymbol = symbol.endsWith('USDT') ? symbol : `${symbol.replace('USD', '')}USDT`;
        
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`);
        
        if (!response.ok) {
          throw new Error(`Binance API error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
          symbol,
          bid: parseFloat(data.lastPrice),
          ask: parseFloat(data.lastPrice),
          last: parseFloat(data.lastPrice),
          spread: 0,
          change: parseFloat(data.priceChange),
          changePercent: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume),
          high: parseFloat(data.highPrice),
          low: parseFloat(data.lowPrice),
          open: parseFloat(data.openPrice),
          timestamp: data.closeTime
        };
      }
    });

    // 2. YAHOO FINANCE (Stocks, Indices, Commodities)
    this.registerSource({
      name: 'Yahoo Finance',
      priority: 2,
      supports: (symbol) => {
        // Stocks: AAPL, GOOGL, etc.
        // Indices: ^GSPC (S&P 500), ^DJI (Dow Jones), etc.
        // Commodities: GC=F (Gold), CL=F (Crude Oil), etc.
        return !symbol.includes('USD') || symbol.includes('XAU') || symbol.includes('WTI');
      },
      getPrice: async (symbol) => {
        // Mapear símbolos para formato Yahoo
        const yahooSymbol = this.mapToYahooSymbol(symbol);
        
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`
        );
        
        if (!response.ok) {
          throw new Error(`Yahoo Finance API error: ${response.status}`);
        }

        const data = await response.json();
        const quote = data.chart.result[0];
        const meta = quote.meta;
        const indicators = quote.indicators.quote[0];
        
        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.previousClose;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;

        return {
          symbol,
          bid: currentPrice,
          ask: currentPrice,
          last: currentPrice,
          spread: 0,
          change,
          changePercent,
          volume: meta.regularMarketVolume || 0,
          high: meta.regularMarketDayHigh || currentPrice,
          low: meta.regularMarketDayLow || currentPrice,
          open: indicators.open?.[0] || previousClose,
          timestamp: meta.regularMarketTime * 1000
        };
      }
    });

    // 3. FOREX API (Forex)
    this.registerSource({
      name: 'Forex API',
      priority: 3,
      supports: (symbol) => {
        // Detectar pares Forex: EURUSD, GBPUSD, etc.
        const forexPattern = /^[A-Z]{3}[A-Z]{3}$/;
        return forexPattern.test(symbol) && !symbol.includes('BTC') && !symbol.includes('ETH');
      },
      getPrice: async (symbol) => {
        // Usar API de Forex (exemplo: frankfurter.app - free)
        const base = symbol.substring(0, 3);
        const quote = symbol.substring(3, 6);
        
        const response = await fetch(
          `https://api.frankfurter.app/latest?from=${base}&to=${quote}`
        );
        
        if (!response.ok) {
          throw new Error(`Forex API error: ${response.status}`);
        }

        const data = await response.json();
        const rate = data.rates[quote];

        // Buscar dados históricos para calcular mudança (simplificado)
        const yesterdayResponse = await fetch(
          `https://api.frankfurter.app/${this.getYesterdayDate()}?from=${base}&to=${quote}`
        );
        
        let previousRate = rate;
        if (yesterdayResponse.ok) {
          const yesterdayData = await yesterdayResponse.json();
          previousRate = yesterdayData.rates[quote];
        }

        const change = rate - previousRate;
        const changePercent = (change / previousRate) * 100;

        return {
          symbol,
          bid: rate,
          ask: rate,
          last: rate,
          spread: 0,
          change,
          changePercent,
          volume: 0,
          high: rate,
          low: rate,
          open: previousRate,
          timestamp: new Date(data.date).getTime()
        };
      }
    });
  }

  /**
   * 📝 Registrar uma fonte de dados
   */
  registerSource(source: PriceFeedSource): void {
    this.sources.push(source);
    this.sources.sort((a, b) => a.priority - b.priority);
    console.log(`[MultiSourcePriceFeed] ✅ Fonte registrada: ${source.name} (prioridade ${source.priority})`);
  }

  /**
   * 💰 Buscar preço (com fallback automático)
   */
  async getPrice(symbol: string): Promise<MarketPrice> {
    // Verificar cache
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.price;
    }

    // Buscar fontes compatíveis
    const compatibleSources = this.sources.filter(s => s.supports(symbol));
    
    if (compatibleSources.length === 0) {
      throw new Error(`Nenhuma fonte disponível para ${symbol}`);
    }

    // Tentar cada fonte em ordem de prioridade
    for (const source of compatibleSources) {
      try {
        console.log(`[MultiSourcePriceFeed] 🔍 Tentando ${source.name} para ${symbol}...`);
        
        const price = await source.getPrice(symbol);
        
        // Salvar em cache
        this.cache.set(symbol, { price, timestamp: Date.now() });
        
        console.log(`[MultiSourcePriceFeed] ✅ Preço obtido de ${source.name}: $${price.last.toFixed(2)}`);
        
        return price;
      } catch (error) {
        console.warn(`[MultiSourcePriceFeed] ⚠️ ${source.name} falhou para ${symbol}:`, error);
        // Continuar para próxima fonte
      }
    }

    throw new Error(`Todas as fontes falharam para ${symbol}`);
  }

  /**
   * 📊 Buscar preços de múltiplos símbolos em paralelo
   */
  async getPrices(symbols: string[]): Promise<Map<string, MarketPrice>> {
    const results = new Map<string, MarketPrice>();
    
    const promises = symbols.map(async (symbol) => {
      try {
        const price = await this.getPrice(symbol);
        results.set(symbol, price);
      } catch (error) {
        console.error(`[MultiSourcePriceFeed] ❌ Erro ao buscar ${symbol}:`, error);
      }
    });

    await Promise.all(promises);
    
    return results;
  }

  /**
   * 🔄 Limpar cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[MultiSourcePriceFeed] 🧹 Cache limpo');
  }

  // ===== MÉTODOS AUXILIARES =====

  private mapToYahooSymbol(symbol: string): string {
    // Mapear símbolos para formato Yahoo
    const map: Record<string, string> = {
      'SPX500': '^GSPC',
      'US30': '^DJI',
      'NAS100': '^IXIC',
      'DAX': '^GDAXI',
      'FTSE': '^FTSE',
      'XAUUSD': 'GC=F',
      'WTI': 'CL=F',
      'BRENT': 'BZ=F'
    };

    return map[symbol] || symbol;
  }

  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
}

// 🌍 Instância global
export const multiSourcePriceFeed = new MultiSourcePriceFeed();
