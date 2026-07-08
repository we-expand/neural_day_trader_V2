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
import { getAssetBySymbol } from '@/app/config/assetDatabase';
import { getBrokerSymbol, isAvailableOnBroker } from '@/app/config/brokerRegistry';
import { projectId, publicAnonKey } from '/utils/supabase/info';

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

    // === INDICES → METAAPI (primário) / YAHOO (fallback) ===
    // ✅ CORRIGIDO 2026-07-07: era Yahoo primário — a variação % do Yahoo usa o
    // fechamento da bolsa à vista (NYSE, 21:00 UTC) como referência, que NÃO
    // bate com a variação que o MetaTrader/corretora mostra pro CFD do índice
    // (referência é a abertura do candle diário do próprio broker). Preço e
    // %/dia agora vêm da mesma fonte (MetaAPI) usada por forex/commodities,
    // pra bater com o terminal real do usuário. Yahoo continua como fallback
    // se a MetaAPI falhar.
    const indexAssets = symbolMappingService.getSymbolsByType('index');
    indexAssets.forEach(asset => {
      this.sourceConfigs.set(asset.unified, {
        primary: 'metaapi',
        fallback: ['yahoo', 'fallback'],
        priority: 2,
        requiresAuth: true,
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
    // ✅ CORRIGIDO 2026-07-08: `mapping?.infinox` vinha de `SymbolMappingService`,
    // uma lista manual incompleta (só ~70 ativos cadastrados) — pra qualquer coisa
    // fora dela, o nome usado era o símbolo unificado cru, o que já causou bugs
    // reais (ex: XPDUSD/JP225/HK50 com nome errado na corretora). Agora usa
    // `brokerRegistry.ts`, auditado contra a API real — se o ativo já é sabido
    // como indisponível nessa corretora, nem tenta a chamada.
    if (!isAvailableOnBroker(symbol, 'infinox')) {
      debugLog('ROUTER', `⏭️ ${symbol} não é ofertado pela Infinox (confirmado em auditoria)`);
      return null;
    }

    try {
      const brokerSymbol = getBrokerSymbol(symbol, 'infinox');

      // ✅ CORRIGIDO 2026-07-08: removido o caminho que passava pelo MT5PriceValidator
      // + candle D1 via getMetaApiCandles (rota legada /mt5-candles, com o mesmo bug de
      // host/endpoint documentado como nunca corrigido). Sempre que o candle falhava
      // (o que acontecia quase sempre, já que a rota é 404/errada), o código caía num
      // "estimativa" HARDCODED: changePercent = 0.1% pra QUALQUER ativo — essa era a
      // causa raiz de ativos completamente diferentes (prata, café, outros commodities)
      // mostrarem o mesmo "+0.09%"/"+0.10%" sem relação nenhuma com o preço real.
      // Agora usa direto a Edge Function /mt5-prices, que já calcula price/change/
      // changePercent corretos no servidor (mesma fonte que o Dashboard usa).
      const data = await getMetaApiData(brokerSymbol);

      if (!data || !data.isRealData) {
        return null;
      }

      // 🎯 PRINCÍPIO FUNDAMENTAL:
      // Se os dados vêm do MT5, eles JÁ estão corretos!
      // O tick JÁ traz change e changePercent calculados pelo servidor.

      const finalPrice = data.price || data.bid || 0;
      const finalChange = data.change || 0;
      const finalChangePercent = data.changePercent || 0;

      console.log(`[ROUTER] 🎯 Dados MT5 para ${symbol} (${brokerSymbol}):`, {
        price: finalPrice.toFixed(5),
        change: finalChange > 0 ? `+${finalChange.toFixed(5)}` : finalChange.toFixed(5),
        changePercent: finalChangePercent > 0 ? `+${finalChangePercent.toFixed(2)}%` : `${finalChangePercent.toFixed(2)}%`,
        source: 'MetaAPI - Usando dados do TICK (change já calculado pelo servidor)'
      });

      // ✅ Usar dados DIRETOS do tick (sem buscar candles!). Retorna sempre o
      // símbolo UNIFICADO (não o nome interno da corretora) — o resto do app
      // (Dashboard, Gráfico, AITradingEngine) só conhece o símbolo unificado.
      return {
        symbol,
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
   * 📡 Buscar do Yahoo Finance (dado real, não sintético)
   *
   * ✅ REESCRITO 2026-07-08: essa função era um stub morto que sempre
   * retornava `null` (nunca implementado de verdade, apesar do comentário
   * dizer "Yahoo Finance: GRÁTIS" na config de fonte de várias categorias).
   * Agora chama a mesma rota real do backend (`/real/yahoo/:symbol`) que o
   * Dashboard já usa via `RealMarketDataService.fetchYahooData` — mesma
   * fonte, sem duplicar lógica de tradução de ticker (o backend já sabe
   * traduzir XAUUSD->GC=F, COCUSD->CC=F etc.).
   */
  private async fetchFromYahoo(symbol: string, mapping?: SymbolMapping): Promise<Partial<SourcedMarketData> | null> {
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/server/real/yahoo/${encodeURIComponent(symbol)}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });

      if (!res.ok) {
        debugLog('ROUTER', `⏭️ Yahoo Finance sem dado pra ${symbol} (HTTP ${res.status})`);
        return null;
      }

      const data = await res.json();
      if (typeof data.price !== 'number' || data.price <= 0) {
        return null;
      }

      return {
        symbol,
        price: data.price,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        timestamp: data.timestamp || Date.now()
      };
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

    // ✅ CORRIGIDO 2026-07-08: a heurística antiga ("contém 'USD' e não contém
    // 'EUR'/'GBP' => provavelmente cripto") classificava qualquer commodity/
    // índice fora do `SymbolMappingService` (incompleto, ~70 de ~330 ativos)
    // como cripto por engano — ex. XPDUSD (Paládio) virava Binance. Agora
    // consulta a categoria real do catálogo canônico primeiro.
    const asset = getAssetBySymbol(symbol);
    if (asset) {
      switch (asset.category) {
        case 'CRYPTO':
          return { primary: 'binance', fallback: ['yahoo', 'fallback'], priority: 1, requiresAuth: false, cost: 'free', availability: 'always' };
        case 'STOCKS':
          return { primary: 'yahoo', fallback: ['trading_economics', 'fallback'], priority: 2, requiresAuth: false, cost: 'free', availability: 'trading_hours' };
        case 'FOREX':
        case 'INDICES':
        case 'COMMODITIES':
        default:
          return { primary: 'metaapi', fallback: ['yahoo', 'fallback'], priority: 2, requiresAuth: true, cost: 'free', availability: 'trading_hours' };
      }
    }

    // Símbolo fora do catálogo — não temos como saber o tipo, tenta MetaAPI
    // primeiro (mais completo hoje) com Yahoo como rede de segurança.
    return {
      primary: 'metaapi',
      fallback: ['yahoo', 'fallback'],
      priority: 3,
      requiresAuth: true,
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