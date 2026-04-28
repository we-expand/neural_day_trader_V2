/**
 * PERFORMANCE MODULE TYPES
 * Tipos e interfaces para o módulo de Performance
 */

export interface TradeHistory {
  id: string;
  asset_symbol: string;
  type: 'BUY' | 'SELL';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  profit_loss?: number;
  profit_loss_percent?: number;
  opened_at: string;
  closed_at?: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  strategy?: string;
  notes?: string;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldingTime: number; // em horas
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  roi: number; // Return on Investment %
  totalVolume: number;
}

export interface DailyPerformance {
  date: string;
  profit_loss: number;
  trades_count: number;
  win_rate: number;
  volume: number;
}

export interface AssetPerformance {
  asset_symbol: string;
  trades_count: number;
  net_profit: number;
  win_rate: number;
  avg_profit: number;
  best_trade: number;
  worst_trade: number;
}

export interface MonthlyStats {
  month: string;
  profit: number;
  loss: number;
  net: number;
  trades: number;
  winRate: number;
}

export interface RiskMetrics {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  valueAtRisk: number; // VaR 95%
  expectedShortfall: number; // CVaR
  calmarRatio: number;
}

export type TimeFrame = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface PerformanceFilters {
  timeFrame: TimeFrame;
  assetSymbol?: string;
  strategy?: string;
  minProfit?: number;
  maxLoss?: number;
  status?: 'OPEN' | 'CLOSED' | 'ALL';
}
