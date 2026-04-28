/**
 * 🔀 SYMBOL MAPPING SERVICE
 * 
 * Normaliza nomenclaturas de símbolos entre diferentes brokers:
 * - Infinox: BTCUSD, EURUSD, XAUUSD
 * - Binance: BTCUSDT, ETHUSDT
 * - Yahoo: BTC-USD, ^GSPC
 * - TradingView: BTCUSD, SPX500
 * 
 * Este serviço converte automaticamente entre formatos.
 */

export interface SymbolMapping {
  unified: string;          // Formato unificado interno (ex: "BTCUSD")
  infinox?: string;         // Formato Infinox/MT5
  binance?: string;         // Formato Binance
  yahoo?: string;           // Formato Yahoo Finance
  tradingview?: string;     // Formato TradingView
  displayName: string;      // Nome para exibição
  type: 'forex' | 'crypto' | 'stock' | 'index' | 'commodity';
}

/**
 * 🎯 SYMBOL MAPPING SERVICE
 */
export class SymbolMappingService {
  private mappings = new Map<string, SymbolMapping>();

  constructor() {
    this.initializeDefaultMappings();
  }

  /**
   * 📊 Inicializar mapeamentos padrão
   */
  private initializeDefaultMappings(): void {
    const defaults: SymbolMapping[] = [
      // === CRYPTO ===
      {
        unified: 'BTCUSD',
        infinox: 'BTCUSD',
        binance: 'BTCUSDT',
        yahoo: 'BTC-USD',
        tradingview: 'BTCUSD',
        displayName: 'Bitcoin',
        type: 'crypto'
      },
      {
        unified: 'ETHUSD',
        infinox: 'ETHUSD',
        binance: 'ETHUSDT',
        yahoo: 'ETH-USD',
        tradingview: 'ETHUSD',
        displayName: 'Ethereum',
        type: 'crypto'
      },
      {
        unified: 'SOLUSD',
        infinox: 'SOLUSD',
        binance: 'SOLUSDT',
        yahoo: 'SOL-USD',
        tradingview: 'SOLUSD',
        displayName: 'Solana',
        type: 'crypto'
      },
      {
        unified: 'BNBUSD',
        infinox: 'BNBUSD',
        binance: 'BNBUSDT',
        yahoo: 'BNB-USD',
        tradingview: 'BNBUSD',
        displayName: 'Binance Coin',
        type: 'crypto'
      },
      {
        unified: 'XRPUSD',
        infinox: 'XRPUSD',
        binance: 'XRPUSDT',
        yahoo: 'XRP-USD',
        tradingview: 'XRPUSD',
        displayName: 'Ripple',
        type: 'crypto'
      },
      {
        unified: 'ADAUSD',
        infinox: 'ADAUSD',
        binance: 'ADAUSDT',
        yahoo: 'ADA-USD',
        tradingview: 'ADAUSD',
        displayName: 'Cardano',
        type: 'crypto'
      },

      // === FOREX ===
      {
        unified: 'EURUSD',
        infinox: 'EURUSD',
        binance: undefined,
        yahoo: 'EURUSD=X',
        tradingview: 'EURUSD',
        displayName: 'Euro vs US Dollar',
        type: 'forex'
      },
      {
        unified: 'GBPUSD',
        infinox: 'GBPUSD',
        binance: undefined,
        yahoo: 'GBPUSD=X',
        tradingview: 'GBPUSD',
        displayName: 'British Pound vs US Dollar',
        type: 'forex'
      },
      {
        unified: 'USDJPY',
        infinox: 'USDJPY',
        binance: undefined,
        yahoo: 'USDJPY=X',
        tradingview: 'USDJPY',
        displayName: 'US Dollar vs Japanese Yen',
        type: 'forex'
      },
      {
        unified: 'AUDUSD',
        infinox: 'AUDUSD',
        binance: undefined,
        yahoo: 'AUDUSD=X',
        tradingview: 'AUDUSD',
        displayName: 'Australian Dollar vs US Dollar',
        type: 'forex'
      },
      {
        unified: 'USDCAD',
        infinox: 'USDCAD',
        binance: undefined,
        yahoo: 'USDCAD=X',
        tradingview: 'USDCAD',
        displayName: 'US Dollar vs Canadian Dollar',
        type: 'forex'
      },
      {
        unified: 'USDCHF',
        infinox: 'USDCHF',
        binance: undefined,
        yahoo: 'USDCHF=X',
        tradingview: 'USDCHF',
        displayName: 'US Dollar vs Swiss Franc',
        type: 'forex'
      },

      // === INDICES ===
      {
        unified: 'US30',
        infinox: 'DJI',        // ✅ CORRIGIDO: MetaAPI usa "DJI" não "US30"
        binance: undefined,
        yahoo: '^DJI',
        tradingview: 'DJ:DJI',
        displayName: 'Dow Jones Industrial Average',
        type: 'index'
      },
      {
        unified: 'SPX500',
        infinox: 'US500',      // ✅ CORRIGIDO: MetaAPI usa "US500" não "SPX500"
        binance: undefined,
        yahoo: '^GSPC',
        tradingview: 'SP:SPX',
        displayName: 'S&P 500',
        type: 'index'
      },
      {
        unified: 'US2000',
        infinox: 'US2000',
        binance: undefined,
        yahoo: '^RUT',
        tradingview: 'RUSSELL:RUT',
        displayName: 'Russell 2000',
        type: 'index'
      },
      {
        unified: 'NAS100',
        infinox: 'NQ',         // ✅ CORRIGIDO: MetaAPI usa "NQ" não "NAS100"
        binance: undefined,
        yahoo: '^IXIC',
        tradingview: 'NASDAQ:NDX',
        displayName: 'NASDAQ 100',
        type: 'index'
      },
      {
        unified: 'DAX',
        infinox: 'GER40',
        binance: undefined,
        yahoo: '^GDAXI',
        tradingview: 'XETR:DAX',
        displayName: 'DAX 40',
        type: 'index'
      },
      {
        unified: 'FRA40',
        infinox: 'FRA40',
        binance: undefined,
        yahoo: '^FCHI',
        tradingview: 'EURONEXT:PX1',
        displayName: 'CAC 40',
        type: 'index'
      },
      {
        unified: 'FTSE',
        infinox: 'UK100',
        binance: undefined,
        yahoo: '^FTSE',
        tradingview: 'LSE:FTSE',
        displayName: 'FTSE 100',
        type: 'index'
      },
      {
        unified: 'JPN225',
        infinox: 'JPN225',
        binance: undefined,
        yahoo: '^N225',
        tradingview: 'TSE:NI225',
        displayName: 'Nikkei 225',
        type: 'index'
      },
      {
        unified: 'HK50',
        infinox: 'HK50f',
        binance: undefined,
        yahoo: '^HSI',
        tradingview: 'HSI',
        displayName: 'Hang Seng Index',
        type: 'index'
      },

      // === COMMODITIES ===
      {
        unified: 'XAUUSD',
        infinox: 'XAUUSD',
        binance: undefined,
        yahoo: 'GC=F',
        tradingview: 'GOLD',
        displayName: 'Gold',
        type: 'commodity'
      },
      {
        unified: 'XAGUSD',
        infinox: 'XAGUSD',
        binance: undefined,
        yahoo: 'SI=F',
        tradingview: 'SILVER',
        displayName: 'Silver',
        type: 'commodity'
      },
      {
        unified: 'WTI',
        infinox: 'USOUSD',
        binance: undefined,
        yahoo: 'CL=F',
        tradingview: 'NYMEX:CL1!',
        displayName: 'Crude Oil WTI',
        type: 'commodity'
      },
      {
        unified: 'BRENT',
        infinox: 'UKOUSD',
        binance: undefined,
        yahoo: 'BZ=F',
        tradingview: 'ICE:BRN1!',
        displayName: 'Brent Crude Oil',
        type: 'commodity'
      },

      // === STOCKS (exemplos) ===
      {
        unified: 'AAPL',
        infinox: undefined,
        binance: undefined,
        yahoo: 'AAPL',
        tradingview: 'NASDAQ:AAPL',
        displayName: 'Apple Inc.',
        type: 'stock'
      },
      {
        unified: 'GOOGL',
        infinox: undefined,
        binance: undefined,
        yahoo: 'GOOGL',
        tradingview: 'NASDAQ:GOOGL',
        displayName: 'Alphabet Inc.',
        type: 'stock'
      },
      {
        unified: 'MSFT',
        infinox: undefined,
        binance: undefined,
        yahoo: 'MSFT',
        tradingview: 'NASDAQ:MSFT',
        displayName: 'Microsoft Corporation',
        type: 'stock'
      },
      {
        unified: 'TSLA',
        infinox: undefined,
        binance: undefined,
        yahoo: 'TSLA',
        tradingview: 'NASDAQ:TSLA',
        displayName: 'Tesla, Inc.',
        type: 'stock'
      }
    ];

    defaults.forEach(mapping => {
      this.mappings.set(mapping.unified, mapping);
    });

    console.log(`[SymbolMappingService] ✅ ${this.mappings.size} mapeamentos carregados`);
  }

  /**
   * 🔍 Buscar mapeamento por símbolo unificado
   */
  getMapping(unifiedSymbol: string): SymbolMapping | undefined {
    return this.mappings.get(unifiedSymbol);
  }

  /**
   * 🔀 Converter de qualquer formato para unificado
   */
  toUnified(symbol: string, source: 'infinox' | 'binance' | 'yahoo' | 'tradingview'): string {
    // Procurar por correspondência
    for (const [unified, mapping] of this.mappings) {
      if (mapping[source] === symbol) {
        return unified;
      }
    }

    // Se não encontrou mapeamento, tentar heurísticas
    if (source === 'binance' && symbol.endsWith('USDT')) {
      return symbol.replace('USDT', 'USD');
    }

    if (source === 'yahoo' && symbol.includes('-')) {
      return symbol.replace('-', '');
    }

    // Retornar o próprio símbolo se não houver mapeamento
    console.warn(`[SymbolMappingService] ⚠️ Mapeamento não encontrado: ${symbol} (${source})`);
    return symbol;
  }

  /**
   * 🔀 Converter de unificado para formato específico
   */
  fromUnified(unifiedSymbol: string, target: 'infinox' | 'binance' | 'yahoo' | 'tradingview'): string {
    const mapping = this.getMapping(unifiedSymbol);
    
    if (mapping && mapping[target]) {
      return mapping[target]!;
    }

    // Fallback: tentar heurísticas
    if (target === 'binance') {
      // BTCUSD → BTCUSDT
      if (unifiedSymbol.endsWith('USD') && !unifiedSymbol.includes('EUR') && !unifiedSymbol.includes('GBP')) {
        return unifiedSymbol.replace('USD', 'USDT');
      }
    }

    if (target === 'yahoo') {
      // BTCUSD → BTC-USD
      if (unifiedSymbol.length === 6 && unifiedSymbol.endsWith('USD')) {
        const base = unifiedSymbol.substring(0, 3);
        return `${base}-USD`;
      }
    }

    console.warn(`[SymbolMappingService] ⚠️ Conversão não disponível: ${unifiedSymbol} → ${target}`);
    return unifiedSymbol;
  }

  /**
   * 📝 Adicionar ou atualizar mapeamento
   */
  addMapping(mapping: SymbolMapping): void {
    this.mappings.set(mapping.unified, mapping);
    console.log(`[SymbolMappingService] ✅ Mapeamento adicionado: ${mapping.unified}`);
  }

  /**
   * 📋 Listar todos os símbolos unificados
   */
  getAllUnifiedSymbols(): string[] {
    return Array.from(this.mappings.keys());
  }

  /**
   * 🔍 Buscar símbolos por tipo
   */
  getSymbolsByType(type: SymbolMapping['type']): SymbolMapping[] {
    return Array.from(this.mappings.values()).filter(m => m.type === type);
  }

  /**
   * 🔍 Buscar mapeamento por qualquer formato
   */
  findMapping(symbol: string): SymbolMapping | undefined {
    // Primeiro, tentar como símbolo unificado
    let mapping = this.mappings.get(symbol);
    if (mapping) return mapping;

    // Procurar em todos os formatos
    for (const m of this.mappings.values()) {
      if (
        m.infinox === symbol ||
        m.binance === symbol ||
        m.yahoo === symbol ||
        m.tradingview === symbol
      ) {
        return m;
      }
    }

    return undefined;
  }
}

// 🌍 Instância global
export const symbolMappingService = new SymbolMappingService();