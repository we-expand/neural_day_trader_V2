/**
 * 🔌 BINANCE ADAPTER
 * 
 * Conecta diretamente com a API da Binance para crypto.
 */

import type {
  IBrokerAdapter,
  Asset,
  MarketPrice,
  Balance,
  Position,
  Order,
  Candle
} from './BrokerAdapter';

/**
 * 🎯 BINANCE ADAPTER
 */
export class BinanceAdapter implements IBrokerAdapter {
  private connected = false;
  private priceSubscriptions = new Map<string, Set<(price: MarketPrice) => void>>();
  private apiBaseUrl = 'https://api.binance.com/api/v3';

  getName(): string {
    return 'Binance';
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 🔐 Conectar (Binance não precisa de credenciais para dados públicos)
   */
  async connect(credentials?: any): Promise<void> {
    console.log('[BinanceAdapter] 🚀 Conectando à Binance...');
    
    try {
      // Testar conexão com ping
      const response = await fetch(`${this.apiBaseUrl}/ping`);
      
      if (response.ok) {
        this.connected = true;
        console.log('[BinanceAdapter] ✅ Conectado com sucesso!');
        
        // Iniciar streaming de preços
        this.startPriceStreaming();
      } else {
        throw new Error('Falha ao conectar');
      }
    } catch (error) {
      console.error('[BinanceAdapter] ❌ Erro ao conectar:', error);
      throw error;
    }
  }

  /**
   * 🔌 Desconectar
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.priceSubscriptions.clear();
    console.log('[BinanceAdapter] 🔌 Desconectado');
  }

  /**
   * 📊 Buscar assets disponíveis
   */
  async getAvailableAssets(): Promise<Asset[]> {
    if (!this.connected) {
      throw new Error('Não conectado');
    }

    console.log('[BinanceAdapter] 📊 Buscando assets disponíveis...');

    try {
      const response = await fetch(`${this.apiBaseUrl}/exchangeInfo`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const assets: Asset[] = data.symbols
        .filter((s: any) => s.status === 'TRADING')
        .map((symbol: any) => ({
          symbol: symbol.symbol,
          name: `${symbol.baseAsset}/${symbol.quoteAsset}`,
          type: 'crypto' as const,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          minLot: parseFloat(symbol.filters.find((f: any) => f.filterType === 'LOT_SIZE')?.minQty || '0.001'),
          maxLot: parseFloat(symbol.filters.find((f: any) => f.filterType === 'LOT_SIZE')?.maxQty || '10000'),
          lotStep: parseFloat(symbol.filters.find((f: any) => f.filterType === 'LOT_SIZE')?.stepSize || '0.001'),
          tickSize: parseFloat(symbol.filters.find((f: any) => f.filterType === 'PRICE_FILTER')?.tickSize || '0.01'),
          pipSize: 0.01,
          contractSize: 1,
          leverage: 1,
          isActive: true
        }));

      console.log(`[BinanceAdapter] ✅ ${assets.length} assets encontrados`);
      return assets;
    } catch (error) {
      console.error('[BinanceAdapter] ❌ Erro ao buscar assets:', error);
      return [];
    }
  }

  /**
   * 📊 Buscar informações de um asset específico
   */
  async getAssetInfo(symbol: string): Promise<Asset | null> {
    const assets = await this.getAvailableAssets();
    return assets.find(a => a.symbol === symbol) || null;
  }

  /**
   * 💰 Buscar preço atual
   */
  async getCurrentPrice(symbol: string): Promise<MarketPrice> {
    if (!this.connected) {
      throw new Error('Não conectado');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/ticker/24hr?symbol=${symbol}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const lastPrice = parseFloat(data.lastPrice);
      const priceChange = parseFloat(data.priceChange);
      const priceChangePercent = parseFloat(data.priceChangePercent);

      return {
        symbol,
        bid: lastPrice, // Binance não fornece bid/ask no ticker 24hr
        ask: lastPrice,
        last: lastPrice,
        spread: 0,
        change: priceChange,
        changePercent: priceChangePercent,
        volume: parseFloat(data.volume),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        open: parseFloat(data.openPrice),
        timestamp: data.closeTime
      };
    } catch (error) {
      console.error(`[BinanceAdapter] ❌ Erro ao buscar preço de ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 📡 Subscribe a preços em tempo real
   */
  subscribeToPrice(symbol: string, callback: (price: MarketPrice) => void): () => void {
    if (!this.priceSubscriptions.has(symbol)) {
      this.priceSubscriptions.set(symbol, new Set());
    }
    
    this.priceSubscriptions.get(symbol)!.add(callback);
    
    console.log(`[BinanceAdapter] 📡 Subscribed to ${symbol}`);

    // Retornar função de cleanup
    return () => {
      const callbacks = this.priceSubscriptions.get(symbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.priceSubscriptions.delete(symbol);
        }
      }
      console.log(`[BinanceAdapter] 🔌 Unsubscribed from ${symbol}`);
    };
  }

  /**
   * 📈 Buscar candles históricos
   */
  async getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    if (!this.connected) {
      throw new Error('Não conectado');
    }

    try {
      // Mapear timeframes
      const tfMap: Record<string, string> = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d'
      };

      const binanceTimeframe = tfMap[timeframe] || '1h';

      const response = await fetch(
        `${this.apiBaseUrl}/klines?symbol=${symbol}&interval=${binanceTimeframe}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map((candle: any) => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));
    } catch (error) {
      console.error(`[BinanceAdapter] ❌ Erro ao buscar candles de ${symbol}:`, error);
      return [];
    }
  }

  /**
   * 💰 Buscar saldo da conta (não implementado - requer API key)
   */
  async getBalance(): Promise<Balance> {
    throw new Error('getBalance() requer autenticação com API key');
  }

  /**
   * 📊 Buscar posições abertas (não implementado - requer API key)
   */
  async getPositions(): Promise<Position[]> {
    throw new Error('getPositions() requer autenticação com API key');
  }

  /**
   * 📋 Buscar ordens pendentes (não implementado - requer API key)
   */
  async getOrders(): Promise<Order[]> {
    throw new Error('getOrders() requer autenticação com API key');
  }

  // ===== MÉTODOS PRIVADOS =====

  private startPriceStreaming(): void {
    // Polling a cada 1 segundo para símbolos subscritos
    setInterval(async () => {
      for (const symbol of this.priceSubscriptions.keys()) {
        try {
          const price = await this.getCurrentPrice(symbol);
          const callbacks = this.priceSubscriptions.get(symbol);
          
          if (callbacks) {
            callbacks.forEach(callback => callback(price));
          }
        } catch (error) {
          console.error(`[BinanceAdapter] ❌ Erro ao atualizar preço de ${symbol}:`, error);
        }
      }
    }, 1000);
  }
}
