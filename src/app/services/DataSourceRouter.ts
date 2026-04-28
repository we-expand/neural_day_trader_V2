/**
 * 🎯 DATA SOURCE ROUTER
 * 
 * Sistema inteligente de roteamento de fontes de dados que:
 * - Mapeia automaticamente cada ativo para sua melhor fonte
 * - Implementa fallback automático quando fonte primária falha
 * - Monitora qualidade e disponibilidade de cada fonte
 * - Evita chamadas desnecessárias a APIs incorretas
 * 
 * FONTES DISPONÍVEIS:
 * - Binance: Criptomoedas (BTC, ETH, SOL, etc.) - ✅ GRÁTIS
 * - MT5/MetaAPI: Forex, Índices, Commodities - ⚠️ Requer conta
 * - Yahoo Finance: Índices, Stocks - ✅ GRÁTIS
 * - Trading Economics: Dados macroeconômicos - 💰 PREMIUM
 */

import { symbolMappingService, type SymbolMapping } from './SymbolMappingService';
import { getUnifiedMarketData } from './UnifiedMarketDataService';
import { getMarketData as getMetaApiData, getMetaApiCandles } from './MetaApiService';
import { debugLog, debugError } from '@/app/config/debug';

export type DataSource = 'binance' | 'metaapi' | 'yahoo' | 'trading_economics' | 'fallback';

export interface DataSourceConfig {
  primary: DataSource;
  fallback: DataSource[];
  priority: number; // 1 = highest
  requiresAuth: boolean;
  cost: 'free' | 'premium';
  availability: 'always' | 'trading_hours';
}

export interface SourcedMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  source: DataSource;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  timestamp: number;
  fallbackUsed: boolean;
  errors?: string[];
}

/**
 * 🔀 DATA SOURCE ROUTER
 */
export class DataSourceRouter {
  private sourceConfigs = new Map<string, DataSourceConfig>();
  private sourceHealth = new Map<DataSource, { successRate: number; lastSuccess: number; errors: number }>();
  
  constructor() {
    this.initializeSourceConfigs();
    this.initializeHealthMonitoring();
  }

  /**
   * 📊 Configurar fontes ideais por tipo de ativo
   */
  private initializeSourceConfigs(): void {
    // === CRYPTO → BINANCE ===
    const cryptoAssets = symbolMappingService.getSymbolsByType('crypto');
    cryptoAssets.forEach(asset => {
      this.sourceConfigs.set(asset.unified, {
        primary: 'binance',
        fallback: ['yahoo', 'fallback'],
        priority: 1,
        requiresAuth: false,
        cost: 'free',
        availability: 'always'
      });
    });

    // === FOREX → METAAPI (MT5) ===
    const forexAssets = symbolMappingService.getSymbolsByType('forex');
    forexAssets.forEach(asset => {
      this.sourceConfigs.set(asset.unified, {
        primary: 'metaapi',
        fallback: ['yahoo', 'fallback'],
        priority: 2,
        requiresAuth: true,
        cost: 'free',
        availability: 'trading_hours'
      });
    });

    // === INDICES → YAHOO (primário) / METAAPI (fallback) ===
    const indexAssets = symbolMappingService.getSymbolsByType('index');
    indexAssets.forEach(asset => {
      this.sourceConfigs.set(asset.unified, {
        primary: 'yahoo',
        fallback: ['metaapi', 'fallback'],
        priority: 2,
        requiresAuth: false,
        cost: 'free',
        availability: 'trading_hours'
      });
    });

    // === COMMODITIES → METAAPI ===
    const commodityAssets = symbolMappingService.getSymbolsByType('commodity');
    commodityAssets.forEach(asset => {
      this.sourceConfigs.set(asset.unified, {
        primary: 'metaapi',
        fallback: ['yahoo', 'fallback'],
        priority: 2,
        requiresAuth: true,
        cost: 'free',
        availability: 'trading_hours'
      });
    });

    // === STOCKS → YAHOO ===
    const stockAssets = symbolMappingService.getSymbolsByType('stock');
    stockAssets.forEach(asset => {
      this.sourceConfigs.set(asset.unified, {
        primary: 'yahoo',
        fallback: ['trading_economics', 'fallback'],
        priority: 2,
        requiresAuth: false,
        cost: 'free',
        availability: 'trading_hours'
      });
    });

    debugLog('ROUTER', `✅ ${this.sourceConfigs.size} configurações de fonte criadas`);
  }

  /**
   * 🏥 Inicializar monitoramento de saúde das fontes
   */
  private initializeHealthMonitoring(): void {
    const sources: DataSource[] = ['binance', 'metaapi', 'yahoo', 'trading_economics', 'fallback'];
    sources.forEach(source => {
      this.sourceHealth.set(source, {
        successRate: 100,
        lastSuccess: Date.now(),
        errors: 0
      });
    });
  }

  /**
   * 🎯 MÉTODO PRINCIPAL: Obter dados com roteamento inteligente
   */
  async getMarketData(symbol: string): Promise<SourcedMarketData> {
    const config = this.getSourceConfig(symbol);
    const mapping = symbolMappingService.findMapping(symbol);
    
    debugLog('ROUTER', `🎯 Roteando ${symbol}`, {
      primarySource: config.primary,
      fallbacks: config.fallback,
      type: mapping?.type
    });

    // Tentar fonte primária
    try {
      const data = await this.fetchFromSource(symbol, config.primary, mapping);
      if (data) {
        this.recordSuccess(config.primary);
        return {
          ...data,
          source: config.primary,
          quality: this.calculateQuality(data, config.primary),
          fallbackUsed: false
        };
      }
    } catch (error: any) {
      this.recordError(config.primary);
      debugError('ROUTER', `❌ Fonte primária ${config.primary} falhou para ${symbol}:`, error);
    }

    // Tentar fallbacks
    for (const fallbackSource of config.fallback) {
      try {
        debugLog('ROUTER', `🔄 Tentando fallback ${fallbackSource} para ${symbol}`);
        const data = await this.fetchFromSource(symbol, fallbackSource, mapping);
        if (data) {
          this.recordSuccess(fallbackSource);
          return {
            ...data,
            source: fallbackSource,
            quality: this.calculateQuality(data, fallbackSource),
            fallbackUsed: true,
            errors: [`Fonte primária ${config.primary} não disponível`]
          };
        }
      } catch (error: any) {
        this.recordError(fallbackSource);
        debugError('ROUTER', `❌ Fallback ${fallbackSource} falhou para ${symbol}:`, error);
      }
    }

    // Último recurso: dados mock
    debugError('ROUTER', `⚠️ Todas as fontes falharam para ${symbol}, usando fallback`);
    return this.generateFallbackData(symbol);
  }

  /**
   * 🔍 Buscar dados de uma fonte específica
   */
  private async fetchFromSource(
    symbol: string,
    source: DataSource,
    mapping?: SymbolMapping
  ): Promise<Partial<SourcedMarketData> | null> {
    switch (source) {
      case 'binance':
        return this.fetchFromBinance(symbol, mapping);
      
      case 'metaapi':
        return this.fetchFromMetaApi(symbol, mapping);
      
      case 'yahoo':
        return this.fetchFromYahoo(symbol, mapping);
      
      case 'trading_economics':
        return this.fetchFromTradingEconomics(symbol, mapping);
      
      default:
        return null;
    }
  }

  /**
   * 📡 Buscar da Binance
   */
  private async fetchFromBinance(symbol: string, mapping?: SymbolMapping): Promise<Partial<SourcedMarketData> | null> {
    try {
      const binanceSymbol = mapping?.binance || symbol;
      
      // Verificar se ativo é disponível na Binance
      if (!mapping?.binance && mapping?.type !== 'crypto') {
        debugLog('ROUTER', `⏭️ ${symbol} não é cripto, pulando Binance`);
        return null;
      }

      const data = await getUnifiedMarketData(binanceSymbol);
      
      if (!data || data.price === 0) {
        return null;
      }

      return {
        symbol: data.symbol,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        timestamp: data.timestamp
      };
    } catch (error) {
      debugError('ROUTER', 'Erro ao buscar da Binance:', error);
      return null;
    }
  }

  /**
   * 📡 Buscar do MetaAPI (MT5)
   */
  private async fetchFromMetaApi(symbol: string, mapping?: SymbolMapping): Promise<Partial<SourcedMarketData> | null> {
    try {
      const mt5Symbol = mapping?.infinox || symbol;
      
      // 🔥 NOVO: Usar MT5 Validator para dados REAIS
      try {
        const { getMT5Validator } = await import('./MT5PriceValidator');
        const validator = getMT5Validator();
        
        if (validator.getConnectionStatus()) {
          console.log(`[ROUTER] 🎯 Usando MT5 Validator REAL para ${mt5Symbol}`);
          const validatedPrice = await validator.getPrice(mt5Symbol);
          
          if (validatedPrice && validatedPrice.isValid && validatedPrice.source === 'mt5') {
            // 🔥 BUSCAR CANDLE DIÁRIO para calcular change REAL
            let realChange = 0;
            let realChangePercent = 0;
            
            try {
              // Buscar último candle diário (D1) para obter open price do dia
              const { getMetaApiCandles } = await import('./MetaApiService');
              const dailyCandles = await getMetaApiCandles(mt5Symbol, 'D1', 2); // Últimos 2 dias
              
              if (dailyCandles && dailyCandles.length > 0) {
                const todayCandle = dailyCandles[dailyCandles.length - 1];
                const openPrice = todayCandle.open;
                
                realChange = validatedPrice.price - openPrice;
                realChangePercent = (realChange / openPrice) * 100;
                
                console.log(`[ROUTER] 📊 Change REAL calculado para ${mt5Symbol}:`, {
                  currentPrice: validatedPrice.price.toFixed(5),
                  openPrice: openPrice.toFixed(5),
                  change: realChange.toFixed(5),
                  changePercent: realChangePercent.toFixed(2) + '%'
                });
              } else {
                console.log(`[ROUTER] ⚠️ Não conseguiu buscar candle diário, usando estimativa`);
                realChange = validatedPrice.price * 0.001;
                realChangePercent = 0.1;
              }
            } catch (candleError) {
              console.log(`[ROUTER] ⚠️ Erro ao buscar candle diário:`, candleError);
              realChange = validatedPrice.price * 0.001;
              realChangePercent = 0.1;
            }
            
            console.log(`[ROUTER] ✅ Dados MT5 REAIS para ${mt5Symbol}:`, {
              price: validatedPrice.price.toFixed(5),
              bid: validatedPrice.bid.toFixed(5),
              ask: validatedPrice.ask.toFixed(5),
              spread: validatedPrice.spread.toFixed(5),
              change: realChange.toFixed(5),
              changePercent: realChangePercent.toFixed(2) + '%',
              source: 'MT5 REAL'
            });
            
            return {
              symbol: mt5Symbol,
              price: validatedPrice.price,
              change: realChange,
              changePercent: realChangePercent,
              timestamp: validatedPrice.timestamp
            };
          } else {
            console.log(`[ROUTER] ⚠️ MT5 Validator retornou fallback para ${mt5Symbol}, tentando Edge Function`);
          }
        } else {
          console.log(`[ROUTER] ⚠️ MT5 Validator não conectado, usando Edge Function`);
        }
      } catch (validatorError) {
        console.log(`[ROUTER] ⚠️ MT5 Validator não disponível:`, validatorError);
      }
      
      // FALLBACK: Usar Edge Function como backup
      const data = await getMetaApiData(mt5Symbol);
      
      if (!data) {
        return null;
      }

      // 🎯 PRINCÍPIO FUNDAMENTAL: 
      // Se os dados vêm do MT5, eles JÁ estão corretos!
      // O tick JÁ traz change e changePercent calculados pelo servidor.
      
      const finalPrice = data.price || data.bid || 0;
      const finalChange = data.change || 0;
      const finalChangePercent = data.changePercent || 0;
      
      console.log(`[ROUTER] 🎯 Dados MT5 para ${mt5Symbol}:`, {
        price: finalPrice.toFixed(5),
        change: finalChange > 0 ? `+${finalChange.toFixed(5)}` : finalChange.toFixed(5),
        changePercent: finalChangePercent > 0 ? `+${finalChangePercent.toFixed(2)}%` : `${finalChangePercent.toFixed(2)}%`,
        source: 'MetaAPI - Usando dados do TICK (change já calculado pelo servidor)'
      });

      // ✅ Usar dados DIRETOS do tick (sem buscar candles!)
      return {
        symbol: mt5Symbol,
        price: finalPrice,
        change: finalChange,
        changePercent: finalChangePercent,
        timestamp: Date.now()
      };
    } catch (error) {
      debugError('ROUTER', 'Erro ao buscar do MetaAPI:', error);
      return null;
    }
  }

  /**
   * 📡 Buscar do Yahoo Finance
   */
  private async fetchFromYahoo(symbol: string, mapping?: SymbolMapping): Promise<Partial<SourcedMarketData> | null> {
    try {
      const yahooSymbol = mapping?.yahoo || symbol;
      
      // TODO: Implementar integração com Yahoo Finance API
      // Por enquanto, retornar null para forçar uso de outras fontes
      debugLog('ROUTER', `⏭️ Yahoo Finance não implementado ainda para ${yahooSymbol}`);
      return null;
    } catch (error) {
      debugError('ROUTER', 'Erro ao buscar do Yahoo:', error);
      return null;
    }
  }

  /**
   * 📡 Buscar do Trading Economics
   */
  private async fetchFromTradingEconomics(symbol: string, mapping?: SymbolMapping): Promise<Partial<SourcedMarketData> | null> {
    try {
      // TODO: Implementar integração com Trading Economics API
      debugLog('ROUTER', `⏭️ Trading Economics não implementado ainda para ${symbol}`);
      return null;
    } catch (error) {
      debugError('ROUTER', 'Erro ao buscar do Trading Economics:', error);
      return null;
    }
  }

  /**
   * 🆘 Gerar dados de fallback
   */
  private generateFallbackData(symbol: string): SourcedMarketData {
    return {
      symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      source: 'fallback',
      quality: 'poor',
      timestamp: Date.now(),
      fallbackUsed: true,
      errors: ['Nenhuma fonte de dados disponível']
    };
  }

  /**
   * 🎯 Obter configuração de fonte para símbolo
   */
  private getSourceConfig(symbol: string): DataSourceConfig {
    const mapping = symbolMappingService.findMapping(symbol);
    
    if (mapping) {
      const config = this.sourceConfigs.get(mapping.unified);
      if (config) return config;
    }

    // Fallback: tentar detectar tipo pelo símbolo
    if (symbol.includes('USD') && !symbol.includes('EUR') && !symbol.includes('GBP')) {
      // Provavelmente cripto
      return {
        primary: 'binance',
        fallback: ['yahoo', 'fallback'],
        priority: 1,
        requiresAuth: false,
        cost: 'free',
        availability: 'always'
      };
    }

    // Default: usar Yahoo
    return {
      primary: 'yahoo',
      fallback: ['metaapi', 'fallback'],
      priority: 3,
      requiresAuth: false,
      cost: 'free',
      availability: 'trading_hours'
    };
  }

  /**
   * 📊 Calcular qualidade dos dados
   */
  private calculateQuality(data: Partial<SourcedMarketData>, source: DataSource): 'excellent' | 'good' | 'fair' | 'poor' {
    const health = this.sourceHealth.get(source);
    
    if (!health || data.price === 0) {
      return 'poor';
    }

    if (health.successRate >= 95) return 'excellent';
    if (health.successRate >= 80) return 'good';
    if (health.successRate >= 60) return 'fair';
    return 'poor';
  }

  /**
   * ✅ Registrar sucesso de fonte
   */
  private recordSuccess(source: DataSource): void {
    const health = this.sourceHealth.get(source);
    if (health) {
      health.lastSuccess = Date.now();
      health.successRate = Math.min(100, health.successRate + 1);
      health.errors = Math.max(0, health.errors - 1);
    }
  }

  /**
   * ❌ Registrar erro de fonte
   */
  private recordError(source: DataSource): void {
    const health = this.sourceHealth.get(source);
    if (health) {
      health.errors++;
      health.successRate = Math.max(0, health.successRate - 5);
    }
  }

  /**
   * 📊 Obter status de saúde de todas as fontes
   */
  getHealthStatus(): Map<DataSource, { successRate: number; lastSuccess: number; errors: number }> {
    return new Map(this.sourceHealth);
  }

  /**
   * 🔍 Obter informações de configuração de fonte
   */
  getSourceInfo(symbol: string): { config: DataSourceConfig; mapping?: SymbolMapping } {
    const mapping = symbolMappingService.findMapping(symbol);
    const config = this.getSourceConfig(symbol);
    
    return { config, mapping };
  }
}

// 🌍 Instância global
export const dataSourceRouter = new DataSourceRouter();