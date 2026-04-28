/**
 * 🎯 UNIFIED DATA LAYER
 * 
 * FONTE ÚNICA DE VERDADE para TODOS os componentes da plataforma.
 * 
 * Arquitetura:
 * - Gerencia múltiplos brokers conectados
 * - Combina múltiplas fontes de preços
 * - Normaliza símbolos automaticamente
 * - Cache inteligente
 * - Sistema de fallback
 * - Subscriptions em tempo real
 * 
 * TODOS os componentes devem usar este serviço!
 */

import { brokerManager, type IBrokerAdapter } from './brokers/BrokerAdapter';
import { multiSourcePriceFeed } from './MultiSourcePriceFeed';
import { symbolMappingService } from './SymbolMappingService';
import type { Asset, MarketPrice, Balance, Position, Candle } from './brokers/BrokerAdapter';

export interface UnifiedMarketData {
  symbol: string;           // Símbolo unificado
  price: number;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  timestamp: number;
  source: 'broker' | 'binance' | 'yahoo' | 'forex' | 'cache';
}

type PriceCallback = (data: UnifiedMarketData) => void;

/**
 * 🎯 UNIFIED DATA LAYER
 */
export class UnifiedDataLayer {
  private subscriptions = new Map<string, Set<PriceCallback>>();
  private cache = new Map<string, { data: UnifiedMarketData; timestamp: number }>();
  private cacheTimeout = 1000; // 1 segundo
  private pollingIntervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    console.log('[UnifiedDataLayer] 🚀 Inicializado');
  }

  /**
   * 💰 Buscar preço de um símbolo
   * 
   * Ordem de prioridade:
   * 1. Broker conectado (se disponível)
   * 2. Multi-Source Price Feed (Binance, Yahoo, Forex APIs)
   * 3. Cache (se recente)
   */
  async getPrice(symbol: string): Promise<UnifiedMarketData> {
    // 1. Verificar cache
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // 2. Tentar broker conectado primeiro
    const broker = brokerManager.getActiveAdapter();
    if (broker && broker.isConnected()) {
      try {
        const brokerSymbol = this.getBrokerSymbol(symbol, broker);
        const price = await broker.getCurrentPrice(brokerSymbol);
        
        const data = this.convertToUnifiedData(symbol, price, 'broker');
        this.updateCache(symbol, data);
        return data;
      } catch (error) {
        console.warn(`[UnifiedDataLayer] ⚠️ Broker falhou, tentando fallback para ${symbol}`);
      }
    }

    // 3. Fallback: Multi-Source Price Feed
    try {
      const apiSymbol = this.getApiSymbol(symbol);
      const price = await multiSourcePriceFeed.getPrice(apiSymbol);
      
      const source = this.detectSource(apiSymbol);
      const data = this.convertToUnifiedData(symbol, price, source);
      this.updateCache(symbol, data);
      return data;
    } catch (error) {
      console.error(`[UnifiedDataLayer] ❌ Erro ao buscar preço de ${symbol}:`, error);
      
      // 4. Último recurso: cache antigo
      if (cached) {
        console.warn(`[UnifiedDataLayer] ⚠️ Usando cache antigo para ${symbol}`);
        return cached.data;
      }
      
      throw new Error(`Não foi possível obter preço de ${symbol}`);
    }
  }

  /**
   * 📡 Subscribe a atualizações em tempo real
   */
  subscribe(symbol: string, callback: PriceCallback): () => void {
    // Adicionar callback à lista de subscribers
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
    }
    
    this.subscriptions.get(symbol)!.add(callback);
    
    console.log(`[UnifiedDataLayer] 📡 Subscribed to ${symbol} (${this.subscriptions.get(symbol)!.size} total)`);

    // Iniciar polling se ainda não está rodando
    if (!this.pollingIntervals.has(symbol)) {
      this.startPolling(symbol);
    }

    // Buscar preço inicial imediatamente
    this.getPrice(symbol).then(data => {
      callback(data);
    }).catch(error => {
      console.error(`[UnifiedDataLayer] ❌ Erro ao buscar preço inicial de ${symbol}:`, error);
    });

    // Retornar função de cleanup
    return () => {
      const callbacks = this.subscriptions.get(symbol);
      if (callbacks) {
        callbacks.delete(callback);
        
        console.log(`[UnifiedDataLayer] 🔌 Unsubscribed from ${symbol} (${callbacks.size} remaining)`);
        
        // Parar polling se não há mais subscribers
        if (callbacks.size === 0) {
          this.stopPolling(symbol);
          this.subscriptions.delete(symbol);
        }
      }
    };
  }

  /**
   * 📊 Buscar assets disponíveis
   */
  async getAvailableAssets(): Promise<Asset[]> {
    const broker = brokerManager.getActiveAdapter();
    
    if (broker && broker.isConnected()) {
      // Buscar assets do broker conectado
      return broker.getAvailableAssets();
    }
    
    // Fallback: retornar assets do Symbol Mapping
    return symbolMappingService.getAllUnifiedSymbols().map(symbol => {
      const mapping = symbolMappingService.getMapping(symbol);
      return {
        symbol,
        name: mapping?.displayName || symbol,
        type: mapping?.type || 'forex',
        baseAsset: undefined,
        quoteAsset: undefined,
        minLot: 0.01,
        maxLot: 100,
        lotStep: 0.01,
        tickSize: 0.00001,
        pipSize: 0.0001,
        contractSize: 100000,
        leverage: 100,
        isActive: true
      };
    });
  }

  /**
   * 📈 Buscar candles históricos
   */
  async getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const broker = brokerManager.getActiveAdapter();
    
    if (broker && broker.isConnected()) {
      try {
        const brokerSymbol = this.getBrokerSymbol(symbol, broker);
        return broker.getCandles(brokerSymbol, timeframe, limit);
      } catch (error) {
        console.error(`[UnifiedDataLayer] ❌ Erro ao buscar candles de ${symbol}:`, error);
      }
    }
    
    // Fallback: usar Binance para crypto
    const mapping = symbolMappingService.getMapping(symbol);
    if (mapping?.type === 'crypto' && mapping.binance) {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${mapping.binance}&interval=${this.mapTimeframe(timeframe)}&limit=${limit}`
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.map((candle: any) => ({
            timestamp: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
          }));
        }
      } catch (error) {
        console.error(`[UnifiedDataLayer] ❌ Erro ao buscar candles do Binance:`, error);
      }
    }
    
    return [];
  }

  /**
   * 💰 Buscar saldo da conta
   */
  async getBalance(): Promise<Balance | null> {
    const broker = brokerManager.getActiveAdapter();
    
    if (broker && broker.isConnected()) {
      try {
        return broker.getBalance();
      } catch (error) {
        console.error('[UnifiedDataLayer] ❌ Erro ao buscar saldo:', error);
      }
    }
    
    return null;
  }

  /**
   * 📊 Buscar posições abertas
   */
  async getPositions(): Promise<Position[]> {
    const broker = brokerManager.getActiveAdapter();
    
    if (broker && broker.isConnected()) {
      try {
        return broker.getPositions();
      } catch (error) {
        console.error('[UnifiedDataLayer] ❌ Erro ao buscar posições:', error);
      }
    }
    
    return [];
  }

  /**
   * 🔄 Limpar cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[UnifiedDataLayer] 🧹 Cache limpo');
  }

  // ===== MÉTODOS PRIVADOS =====

  private startPolling(symbol: string): void {
    const interval = setInterval(async () => {
      try {
        const data = await this.getPrice(symbol);
        
        // Notificar todos os subscribers
        const callbacks = this.subscriptions.get(symbol);
        if (callbacks) {
          callbacks.forEach(callback => callback(data));
        }
      } catch (error) {
        console.error(`[UnifiedDataLayer] ❌ Erro no polling de ${symbol}:`, error);
      }
    }, 1000); // 1 segundo

    this.pollingIntervals.set(symbol, interval);
    console.log(`[UnifiedDataLayer] 🔄 Polling iniciado para ${symbol}`);
  }

  private stopPolling(symbol: string): void {
    const interval = this.pollingIntervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(symbol);
      console.log(`[UnifiedDataLayer] 🛑 Polling parado para ${symbol}`);
    }
  }

  private getBrokerSymbol(unifiedSymbol: string, broker: IBrokerAdapter): string {
    const brokerName = broker.getName().toLowerCase();
    
    if (brokerName.includes('infinox') || brokerName.includes('metatrader')) {
      return symbolMappingService.fromUnified(unifiedSymbol, 'infinox');
    }
    
    if (brokerName.includes('binance')) {
      return symbolMappingService.fromUnified(unifiedSymbol, 'binance');
    }
    
    return unifiedSymbol;
  }

  private getApiSymbol(unifiedSymbol: string): string {
    const mapping = symbolMappingService.getMapping(unifiedSymbol);
    
    if (!mapping) {
      return unifiedSymbol;
    }
    
    // Escolher API baseado no tipo
    if (mapping.type === 'crypto' && mapping.binance) {
      return mapping.binance;
    }
    
    if (mapping.type === 'forex') {
      return mapping.unified;
    }
    
    if ((mapping.type === 'stock' || mapping.type === 'index' || mapping.type === 'commodity') && mapping.yahoo) {
      return mapping.yahoo;
    }
    
    return mapping.unified;
  }

  private detectSource(apiSymbol: string): UnifiedMarketData['source'] {
    if (apiSymbol.endsWith('USDT')) return 'binance';
    if (apiSymbol.includes('^') || apiSymbol.includes('=F')) return 'yahoo';
    if (apiSymbol.match(/^[A-Z]{3}[A-Z]{3}$/)) return 'forex';
    return 'cache';
  }

  private convertToUnifiedData(
    symbol: string,
    price: MarketPrice,
    source: UnifiedMarketData['source']
  ): UnifiedMarketData {
    return {
      symbol,
      price: price.last,
      bid: price.bid,
      ask: price.ask,
      spread: price.spread,
      change: price.change,
      changePercent: price.changePercent,
      volume: price.volume,
      high: price.high,
      low: price.low,
      open: price.open,
      timestamp: price.timestamp,
      source
    };
  }

  private updateCache(symbol: string, data: UnifiedMarketData): void {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  private mapTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '1H': '1h',
      '4h': '4h',
      '4H': '4h',
      '1d': '1d',
      '1D': '1d'
    };
    return map[timeframe] || '1h';
  }
}

// 🌍 Instância global
export const unifiedDataLayer = new UnifiedDataLayer();

// 🔥 COMPAT: Manter compatibilidade com código existente
export const getUnifiedMarketData = (symbol: string) => unifiedDataLayer.getPrice(symbol);
export const subscribeToRealtimeData = (symbol: string, callback: PriceCallback) => unifiedDataLayer.subscribe(symbol, callback);
