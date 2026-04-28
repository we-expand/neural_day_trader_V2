/**
 * 🔌 BROKER ADAPTER SYSTEM
 * 
 * Interface universal para conectar QUALQUER broker/exchange:
 * - Infinox
 * - MetaTrader 5 (via MetaAPI)
 * - Binance
 * - Interactive Brokers
 * - etc.
 * 
 * Cada broker implementa esta interface, garantindo compatibilidade total.
 */

export interface Asset {
  symbol: string;           // Símbolo no broker (ex: "BTCUSD", "EURUSD", "AAPL")
  name: string;             // Nome legível (ex: "Bitcoin", "Euro vs Dollar")
  type: 'forex' | 'crypto' | 'stock' | 'index' | 'commodity';
  baseAsset?: string;       // Ativo base (ex: "BTC", "EUR")
  quoteAsset?: string;      // Ativo cotação (ex: "USD", "USDT")
  minLot: number;           // Lote mínimo
  maxLot: number;           // Lote máximo
  lotStep: number;          // Incremento do lote
  tickSize: number;         // Tamanho do tick
  pipSize: number;          // Tamanho do pip (Forex)
  contractSize: number;     // Tamanho do contrato
  leverage: number;         // Alavancagem disponível
  tradingHours?: {
    open: string;
    close: string;
    timezone: string;
  };
  isActive: boolean;        // Disponível para trading
}

export interface MarketPrice {
  symbol: string;
  bid: number;              // Preço de venda
  ask: number;              // Preço de compra
  last: number;             // Último preço negociado
  spread: number;           // Spread (ask - bid)
  change: number;           // Variação absoluta do dia
  changePercent: number;    // Variação % do dia
  volume: number;           // Volume do dia
  high: number;             // Máxima do dia
  low: number;              // Mínima do dia
  open: number;             // Abertura do dia
  timestamp: number;        // Timestamp da cotação
}

export interface Balance {
  equity: number;           // Patrimônio total
  balance: number;          // Saldo em conta
  margin: number;           // Margem utilizada
  freeMargin: number;       // Margem livre
  marginLevel: number;      // Nível de margem (%)
  profit: number;           // Lucro/prejuízo aberto
  currency: string;         // Moeda da conta (USD, BRL, etc.)
}

export interface Position {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;           // Lotes
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  profitPercent: number;
  swap: number;             // Swap (overnight fee)
  commission: number;
  openTime: number;
  magic?: number;           // Magic number (MT5)
}

export interface Order {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
  volume: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  openTime: number;
  fillTime?: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 🎯 INTERFACE UNIVERSAL DE BROKER
 * 
 * Todos os adapters devem implementar esta interface.
 */
export interface IBrokerAdapter {
  // Informações do broker
  getName(): string;
  isConnected(): boolean;
  
  // Conexão
  connect(credentials: any): Promise<void>;
  disconnect(): Promise<void>;
  
  // Assets (auto-discovery)
  getAvailableAssets(): Promise<Asset[]>;
  getAssetInfo(symbol: string): Promise<Asset | null>;
  
  // Preços em tempo real
  getCurrentPrice(symbol: string): Promise<MarketPrice>;
  subscribeToPrice(symbol: string, callback: (price: MarketPrice) => void): () => void;
  
  // Dados históricos
  getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;
  
  // Conta
  getBalance(): Promise<Balance>;
  
  // Posições e ordens
  getPositions(): Promise<Position[]>;
  getOrders(): Promise<Order[]>;
  
  // Trading (opcional - nem todos os adapters precisam implementar)
  placeOrder?(order: Partial<Order>): Promise<Order>;
  closePosition?(positionId: string): Promise<void>;
  modifyPosition?(positionId: string, stopLoss?: number, takeProfit?: number): Promise<void>;
}

/**
 * 🔥 BROKER MANAGER
 * 
 * Gerencia múltiplos brokers conectados.
 */
export class BrokerManager {
  private adapters: Map<string, IBrokerAdapter> = new Map();
  private activeAdapterId: string | null = null;

  /**
   * Registrar um adapter
   */
  registerAdapter(id: string, adapter: IBrokerAdapter): void {
    this.adapters.set(id, adapter);
    console.log(`[BrokerManager] ✅ Adapter registrado: ${id} (${adapter.getName()})`);
  }

  /**
   * Definir adapter ativo
   */
  setActiveAdapter(id: string): void {
    if (!this.adapters.has(id)) {
      throw new Error(`Adapter não encontrado: ${id}`);
    }
    this.activeAdapterId = id;
    console.log(`[BrokerManager] 🎯 Adapter ativo: ${id}`);
  }

  /**
   * Obter adapter ativo
   */
  getActiveAdapter(): IBrokerAdapter | null {
    if (!this.activeAdapterId) {
      return null;
    }
    return this.adapters.get(this.activeAdapterId) || null;
  }

  /**
   * Listar todos os adapters
   */
  getAdapters(): Map<string, IBrokerAdapter> {
    return this.adapters;
  }

  /**
   * Verificar se há algum adapter conectado
   */
  hasConnectedAdapter(): boolean {
    for (const adapter of this.adapters.values()) {
      if (adapter.isConnected()) {
        return true;
      }
    }
    return false;
  }
}

// 🌍 Instância global
export const brokerManager = new BrokerManager();
