/**
 * 🎯 BINANCE WEBSOCKET MANAGER - v3.0 (REAL DATA INTEGRATION)
 * Integrado com RealMarketDataService para dados validados
 */

import { getRealMarketData } from './RealMarketDataService';

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
}

type TickerCallback = (data: TickerData) => void;

class BinanceWebSocketManager {
  private callbacks: Map<string, TickerCallback[]> = new Map();
  private isActive = false;
  private updateIntervals: Map<string, any> = new Map();

  connect(symbols: string[]) {
    if (this.isActive) return;

    console.log('[BinanceWS] 🎯 Starting REAL DATA mode (via RealMarketDataService)...');
    this.startRealDataPolling(symbols);
  }

  private startRealDataPolling(symbols: string[]) {
    this.isActive = true;
    
    symbols.forEach(symbol => {
      // Normalizar símbolo para formato da API
      const apiSymbol = this.normalizeSymbol(symbol);
      
      // Buscar dados imediatamente
      this.fetchAndNotify(apiSymbol, symbol);
      
      // Configurar polling a cada 5 segundos
      const interval = setInterval(() => {
        this.fetchAndNotify(apiSymbol, symbol);
      }, 5000);
      
      this.updateIntervals.set(symbol, interval);
    });
  }

  private async fetchAndNotify(apiSymbol: string, displaySymbol: string) {
    try {
      const marketData = await getRealMarketData(apiSymbol);
      
      const data: TickerData = {
        symbol: displaySymbol,
        price: marketData.price,
        change24h: marketData.change || 0,
        changePercent: marketData.changePercent || 0,
        volume: marketData.volume || 0,
        high: marketData.high || marketData.price,
        low: marketData.low || marketData.price,
      };
      
      console.log(`[BinanceWS] ✅ ${displaySymbol}: $${data.price.toFixed(2)} (${data.changePercent.toFixed(2)}%)`);
      this.notifyCallbacks(displaySymbol, data);
    } catch (error) {
      console.error(`[BinanceWS] ❌ Error fetching ${displaySymbol}:`, error);
    }
  }

  private normalizeSymbol(symbol: string): string {
    // Converter formatos comuns para formato da API
    const normalized = symbol.toUpperCase().replace('/', '');
    
    // BTC/USD -> BTCUSDT
    if (normalized === 'BTCUSD') return 'BTCUSDT';
    if (normalized === 'ETHUSD') return 'ETHUSDT';
    if (normalized === 'SOLUSD') return 'SOLUSDT';
    
    return normalized;
  }

  private notifyCallbacks(symbol: string, data: TickerData) {
    const callbacks = this.callbacks.get(symbol) || [];
    callbacks.forEach(cb => cb(data));
  }

  subscribe(symbol: string, callback: TickerCallback) {
    if (!this.callbacks.has(symbol)) {
      this.callbacks.set(symbol, []);
    }
    this.callbacks.get(symbol)!.push(callback);
  }

  disconnect() {
    console.log('[BinanceWS] 🔌 Disconnecting...');
    this.isActive = false;
    
    // Limpar todos os intervals
    this.updateIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.updateIntervals.clear();
  }
}

export const binanceWS = new BinanceWebSocketManager();