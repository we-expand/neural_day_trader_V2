/**
 * 🔌 INFINOX ADAPTER (MetaTrader 5 via MetaAPI)
 * 
 * Conecta com contas MT5 da Infinox usando MetaAPI.
 * 
 * Documentação: https://metaapi.cloud/docs/client/
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

interface InfinoxCredentials {
  accountId: string;      // MetaAPI Account ID
  token: string;          // MetaAPI Token
}

/**
 * 🎯 INFINOX ADAPTER
 */
export class InfinoxAdapter implements IBrokerAdapter {
  private credentials: InfinoxCredentials | null = null;
  private connected = false;
  private priceSubscriptions = new Map<string, Set<(price: MarketPrice) => void>>();
  private apiBaseUrl = 'https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai';

  getName(): string {
    return 'Infinox (MetaTrader 5)';
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 🔐 Conectar ao MetaAPI
   */
  async connect(credentials: InfinoxCredentials): Promise<void> {
    console.log('[InfinoxAdapter] 🚀 Conectando ao MetaAPI...', {
      accountId: credentials.accountId
    });

    this.credentials = credentials;

    try {
      // Testar conexão buscando informações da conta
      const accountInfo = await this.fetchAccountInfo();
      
      if (accountInfo) {
        this.connected = true;
        console.log('[InfinoxAdapter] ✅ Conectado com sucesso!', accountInfo);
        
        // Iniciar streaming de preços
        this.startPriceStreaming();
      } else {
        throw new Error('Falha ao obter informações da conta');
      }
    } catch (error) {
      console.error('[InfinoxAdapter] ❌ Erro ao conectar:', error);
      throw error;
    }
  }

  /**
   * 🔌 Desconectar
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.credentials = null;
    this.priceSubscriptions.clear();
    console.log('[InfinoxAdapter] 🔌 Desconectado');
  }

  /**
   * 📊 Buscar assets disponíveis (auto-discovery)
   */
  async getAvailableAssets(): Promise<Asset[]> {
    if (!this.connected || !this.credentials) {
      throw new Error('Não conectado');
    }

    console.log('[InfinoxAdapter] 📊 Buscando assets disponíveis...');

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/current/accounts/${this.credentials.accountId}/symbols`,
        {
          headers: {
            'auth-token': this.credentials.token
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const symbols = await response.json();

      const assets: Asset[] = symbols.map((symbol: any) => {
        // Detectar tipo de ativo
        let type: Asset['type'] = 'forex';
        
        if (symbol.symbol.includes('BTC') || symbol.symbol.includes('ETH') || symbol.symbol.includes('CRYPTO')) {
          type = 'crypto';
        } else if (symbol.symbol.includes('US30') || symbol.symbol.includes('NAS') || symbol.symbol.includes('SPX')) {
          type = 'index';
        } else if (symbol.symbol.includes('XAU') || symbol.symbol.includes('WTI') || symbol.symbol.includes('BRENT')) {
          type = 'commodity';
        } else if (symbol.symbol.match(/^[A-Z]{3}[A-Z]{3}$/)) {
          type = 'forex';
        } else {
          type = 'stock';
        }

        return {
          symbol: symbol.symbol,
          name: symbol.description || symbol.symbol,
          type,
          baseAsset: symbol.baseCurrency,
          quoteAsset: symbol.quoteCurrency || symbol.profitCurrency,
          minLot: symbol.minVolume || 0.01,
          maxLot: symbol.maxVolume || 100,
          lotStep: symbol.volumeStep || 0.01,
          tickSize: symbol.tickSize || 0.00001,
          pipSize: symbol.pipSize || 0.0001,
          contractSize: symbol.contractSize || 100000,
          leverage: symbol.leverage || 100,
          isActive: symbol.tradeMode !== 'TRADE_MODE_DISABLED'
        };
      });

      console.log(`[InfinoxAdapter] ✅ ${assets.length} assets encontrados`);
      return assets;
    } catch (error) {
      console.error('[InfinoxAdapter] ❌ Erro ao buscar assets:', error);
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
    if (!this.connected || !this.credentials) {
      throw new Error('Não conectado');
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/current/accounts/${this.credentials.accountId}/symbols/${symbol}/current-price`,
        {
          headers: {
            'auth-token': this.credentials.token
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        symbol,
        bid: data.bid || data.price,
        ask: data.ask || data.price,
        last: data.price,
        spread: (data.ask - data.bid) || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || 0,
        high: data.high || data.price,
        low: data.low || data.price,
        open: data.open || data.price,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`[InfinoxAdapter] ❌ Erro ao buscar preço de ${symbol}:`, error);
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
    
    console.log(`[InfinoxAdapter] 📡 Subscribed to ${symbol}`);

    // Retornar função de cleanup
    return () => {
      const callbacks = this.priceSubscriptions.get(symbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.priceSubscriptions.delete(symbol);
        }
      }
      console.log(`[InfinoxAdapter] 🔌 Unsubscribed from ${symbol}`);
    };
  }

  /**
   * 📈 Buscar candles históricos
   */
  async getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    if (!this.connected || !this.credentials) {
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

      const metaTimeframe = tfMap[timeframe] || '1h';

      const response = await fetch(
        `${this.apiBaseUrl}/users/current/accounts/${this.credentials.accountId}/historical-market-data/symbols/${symbol}/timeframes/${metaTimeframe}/candles?limit=${limit}`,
        {
          headers: {
            'auth-token': this.credentials.token
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map((candle: any) => ({
        timestamp: new Date(candle.time).getTime(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.tickVolume || candle.realVolume || 0
      }));
    } catch (error) {
      console.error(`[InfinoxAdapter] ❌ Erro ao buscar candles de ${symbol}:`, error);
      return [];
    }
  }

  /**
   * 💰 Buscar saldo da conta
   */
  async getBalance(): Promise<Balance> {
    if (!this.connected || !this.credentials) {
      throw new Error('Não conectado');
    }

    try {
      const accountInfo = await this.fetchAccountInfo();

      return {
        equity: accountInfo.equity,
        balance: accountInfo.balance,
        margin: accountInfo.margin,
        freeMargin: accountInfo.freeMargin,
        marginLevel: accountInfo.marginLevel,
        profit: accountInfo.profit,
        currency: accountInfo.currency
      };
    } catch (error) {
      console.error('[InfinoxAdapter] ❌ Erro ao buscar saldo:', error);
      throw error;
    }
  }

  /**
   * 📊 Buscar posições abertas
   */
  async getPositions(): Promise<Position[]> {
    if (!this.connected || !this.credentials) {
      throw new Error('Não conectado');
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/current/accounts/${this.credentials.accountId}/positions`,
        {
          headers: {
            'auth-token': this.credentials.token
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map((pos: any) => ({
        id: pos.id,
        symbol: pos.symbol,
        type: pos.type === 'POSITION_TYPE_BUY' ? 'buy' : 'sell',
        volume: pos.volume,
        openPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        profit: pos.profit,
        profitPercent: (pos.profit / (pos.openPrice * pos.volume * pos.contractSize)) * 100,
        swap: pos.swap,
        commission: pos.commission,
        openTime: new Date(pos.time).getTime(),
        magic: pos.magic
      }));
    } catch (error) {
      console.error('[InfinoxAdapter] ❌ Erro ao buscar posições:', error);
      return [];
    }
  }

  /**
   * 📋 Buscar ordens pendentes
   */
  async getOrders(): Promise<Order[]> {
    if (!this.connected || !this.credentials) {
      throw new Error('Não conectado');
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/current/accounts/${this.credentials.accountId}/orders`,
        {
          headers: {
            'auth-token': this.credentials.token
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map((order: any) => ({
        id: order.id,
        symbol: order.symbol,
        type: this.mapOrderType(order.type),
        volume: order.volume,
        price: order.openPrice,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        status: 'pending',
        openTime: new Date(order.time).getTime()
      }));
    } catch (error) {
      console.error('[InfinoxAdapter] ❌ Erro ao buscar ordens:', error);
      return [];
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  private async fetchAccountInfo(): Promise<any> {
    if (!this.credentials) {
      throw new Error('Credenciais não definidas');
    }

    const response = await fetch(
      `${this.apiBaseUrl}/users/current/accounts/${this.credentials.accountId}/account-information`,
      {
        headers: {
          'auth-token': this.credentials.token
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

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
          console.error(`[InfinoxAdapter] ❌ Erro ao atualizar preço de ${symbol}:`, error);
        }
      }
    }, 1000);
  }

  private mapOrderType(metaType: string): Order['type'] {
    const map: Record<string, Order['type']> = {
      'ORDER_TYPE_BUY': 'buy',
      'ORDER_TYPE_SELL': 'sell',
      'ORDER_TYPE_BUY_LIMIT': 'buy_limit',
      'ORDER_TYPE_SELL_LIMIT': 'sell_limit',
      'ORDER_TYPE_BUY_STOP': 'buy_stop',
      'ORDER_TYPE_SELL_STOP': 'sell_stop'
    };
    return map[metaType] || 'buy';
  }
}
