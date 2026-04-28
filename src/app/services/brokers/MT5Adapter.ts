import { IBrokerAdapter, Asset, Quote } from './BrokerAdapter';

/**
 * 🎯 MT5 ADAPTER
 * 
 * Adapter para conexão direta MT5 via MetaAPI
 * Compatível com o BrokerManager
 */

export interface MT5Credentials {
  login: string;
  password: string;
  server: string;
}

export class MT5Adapter implements IBrokerAdapter {
  private credentials: MT5Credentials | null = null;
  private connected: boolean = false;
  private accountInfo: any = null;

  getName(): string {
    return 'MetaTrader 5 (Direct)';
  }

  async connect(credentials?: MT5Credentials): Promise<void> {
    if (!credentials) {
      throw new Error('Credenciais MT5 são obrigatórias');
    }

    this.credentials = credentials;
    this.connected = true;
    
    console.log('[MT5Adapter] ✅ Conectado ao MT5:', {
      login: credentials.login,
      server: credentials.server
    });
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
    this.connected = false;
    this.accountInfo = null;
    
    console.log('[MT5Adapter] 🔌 Desconectado do MT5');
  }

  isConnected(): boolean {
    return this.connected;
  }

  setAccountInfo(info: any): void {
    this.accountInfo = info;
  }

  async getAvailableAssets(): Promise<Asset[]> {
    // Retornar ativos MT5 padrão
    // Em produção, isso viria da API MetaAPI
    return [
      {
        symbol: 'EURUSD',
        name: 'Euro vs US Dollar',
        type: 'forex',
        baseAsset: 'EUR',
        quoteAsset: 'USD',
        minLot: 0.01,
        maxLot: 100,
        lotStep: 0.01,
        tickSize: 0.00001
      },
      {
        symbol: 'GBPUSD',
        name: 'British Pound vs US Dollar',
        type: 'forex',
        baseAsset: 'GBP',
        quoteAsset: 'USD',
        minLot: 0.01,
        maxLot: 100,
        lotStep: 0.01,
        tickSize: 0.00001
      },
      {
        symbol: 'USDJPY',
        name: 'US Dollar vs Japanese Yen',
        type: 'forex',
        baseAsset: 'USD',
        quoteAsset: 'JPY',
        minLot: 0.01,
        maxLot: 100,
        lotStep: 0.01,
        tickSize: 0.001
      },
      {
        symbol: 'XAUUSD',
        name: 'Gold vs US Dollar',
        type: 'commodity',
        baseAsset: 'XAU',
        quoteAsset: 'USD',
        minLot: 0.01,
        maxLot: 100,
        lotStep: 0.01,
        tickSize: 0.01
      }
    ];
  }

  async getQuote(symbol: string): Promise<Quote> {
    if (!this.connected) {
      throw new Error('MT5 não está conectado');
    }

    // Em produção, buscar da API MetaAPI
    // Por enquanto, retornar dados mockados
    const mockPrices: Record<string, { bid: number; ask: number }> = {
      'EURUSD': { bid: 1.08445, ask: 1.08450 },
      'GBPUSD': { bid: 1.26340, ask: 1.26345 },
      'USDJPY': { bid: 149.235, ask: 149.240 },
      'XAUUSD': { bid: 2645.20, ask: 2645.50 }
    };

    const price = mockPrices[symbol] || { bid: 0, ask: 0 };

    return {
      symbol,
      bid: price.bid,
      ask: price.ask,
      timestamp: Date.now(),
      source: 'MetaTrader 5'
    };
  }

  getCredentials(): MT5Credentials | null {
    return this.credentials;
  }

  getAccountInfo(): any {
    return this.accountInfo;
  }
}
