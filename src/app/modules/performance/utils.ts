/**
 * PERFORMANCE MODULE UTILS
 * Funções auxiliares para cálculos de performance
 */

import { TradeHistory, PerformanceMetrics, DailyPerformance, AssetPerformance, MonthlyStats } from './types';

/**
 * Calcula métricas de performance a partir do histórico de trades
 */
export function calculatePerformanceMetrics(trades: TradeHistory[]): PerformanceMetrics {
  console.log('[PERFORMANCE] 📊 Calculating performance metrics...', { tradesCount: trades.length });

  const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.profit_loss !== undefined);
  
  if (closedTrades.length === 0) {
    console.log('[PERFORMANCE] ⚠️ No closed trades found');
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      avgHoldingTime: 0,
      bestTrade: 0,
      worstTrade: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      roi: 0,
      totalVolume: 0,
    };
  }

  const winningTrades = closedTrades.filter(t => (t.profit_loss || 0) > 0);
  const losingTrades = closedTrades.filter(t => (t.profit_loss || 0) < 0);

  const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0));
  const netProfit = totalProfit - totalLoss;

  const averageWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  // Sharpe Ratio simplificado (assumindo risk-free rate = 0)
  const returns = closedTrades.map(t => (t.profit_loss || 0));
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Max Drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  
  closedTrades.forEach(trade => {
    cumulative += trade.profit_loss || 0;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  // Holding time médio
  const holdingTimes = closedTrades
    .filter(t => t.opened_at && t.closed_at)
    .map(t => {
      const opened = new Date(t.opened_at).getTime();
      const closed = new Date(t.closed_at!).getTime();
      return (closed - opened) / (1000 * 60 * 60); // horas
    });
  const avgHoldingTime = holdingTimes.length > 0
    ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length
    : 0;

  const bestTrade = Math.max(...closedTrades.map(t => t.profit_loss || 0), 0);
  const worstTrade = Math.min(...closedTrades.map(t => t.profit_loss || 0), 0);

  // Consecutive wins/losses
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  closedTrades.forEach(trade => {
    if ((trade.profit_loss || 0) > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else if ((trade.profit_loss || 0) < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    }
  });

  const totalVolume = closedTrades.reduce(
    (sum, t) => sum + (t.entry_price * t.quantity),
    0
  );

  const initialCapital = 10000; // Assumir capital inicial
  const roi = (netProfit / initialCapital) * 100;

  const metrics: PerformanceMetrics = {
    totalTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: (winningTrades.length / closedTrades.length) * 100,
    totalProfit,
    totalLoss,
    netProfit,
    averageWin,
    averageLoss,
    profitFactor,
    sharpeRatio,
    maxDrawdown,
    avgHoldingTime,
    bestTrade,
    worstTrade,
    consecutiveWins: maxWinStreak,
    consecutiveLosses: maxLossStreak,
    roi,
    totalVolume,
  };

  console.log('[PERFORMANCE] ✅ Metrics calculated:', metrics);
  return metrics;
}

/**
 * Agrupa trades por dia
 */
export function groupTradesByDay(trades: TradeHistory[]): DailyPerformance[] {
  const grouped = new Map<string, TradeHistory[]>();

  trades
    .filter(t => t.status === 'CLOSED')
    .forEach(trade => {
      const date = new Date(trade.closed_at || trade.opened_at).toISOString().split('T')[0];
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(trade);
    });

  const daily: DailyPerformance[] = Array.from(grouped.entries())
    .map(([date, dayTrades]) => {
      const profit_loss = dayTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
      const winningTrades = dayTrades.filter(t => (t.profit_loss || 0) > 0).length;
      const volume = dayTrades.reduce((sum, t) => sum + (t.entry_price * t.quantity), 0);

      return {
        date,
        profit_loss,
        trades_count: dayTrades.length,
        win_rate: dayTrades.length > 0 ? (winningTrades / dayTrades.length) * 100 : 0,
        volume,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log('[PERFORMANCE] 📅 Grouped by day:', daily.length);
  return daily;
}

/**
 * Agrupa performance por ativo
 */
export function groupPerformanceByAsset(trades: TradeHistory[]): AssetPerformance[] {
  const grouped = new Map<string, TradeHistory[]>();

  trades
    .filter(t => t.status === 'CLOSED')
    .forEach(trade => {
      if (!grouped.has(trade.asset_symbol)) {
        grouped.set(trade.asset_symbol, []);
      }
      grouped.get(trade.asset_symbol)!.push(trade);
    });

  const byAsset: AssetPerformance[] = Array.from(grouped.entries())
    .map(([asset_symbol, assetTrades]) => {
      const net_profit = assetTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
      const winningTrades = assetTrades.filter(t => (t.profit_loss || 0) > 0);
      const profits = assetTrades.map(t => t.profit_loss || 0);

      return {
        asset_symbol,
        trades_count: assetTrades.length,
        net_profit,
        win_rate: (winningTrades.length / assetTrades.length) * 100,
        avg_profit: net_profit / assetTrades.length,
        best_trade: Math.max(...profits, 0),
        worst_trade: Math.min(...profits, 0),
      };
    })
    .sort((a, b) => b.net_profit - a.net_profit);

  console.log('[PERFORMANCE] 💹 Grouped by asset:', byAsset.length);
  return byAsset;
}

/**
 * Agrupa por mês
 */
export function groupTradesByMonth(trades: TradeHistory[]): MonthlyStats[] {
  const grouped = new Map<string, TradeHistory[]>();

  trades
    .filter(t => t.status === 'CLOSED')
    .forEach(trade => {
      const date = new Date(trade.closed_at || trade.opened_at);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped.has(month)) {
        grouped.set(month, []);
      }
      grouped.get(month)!.push(trade);
    });

  const monthly: MonthlyStats[] = Array.from(grouped.entries())
    .map(([month, monthTrades]) => {
      const profit = monthTrades
        .filter(t => (t.profit_loss || 0) > 0)
        .reduce((sum, t) => sum + (t.profit_loss || 0), 0);
      const loss = Math.abs(
        monthTrades
          .filter(t => (t.profit_loss || 0) < 0)
          .reduce((sum, t) => sum + (t.profit_loss || 0), 0)
      );
      const winningTrades = monthTrades.filter(t => (t.profit_loss || 0) > 0).length;

      return {
        month,
        profit,
        loss,
        net: profit - loss,
        trades: monthTrades.length,
        winRate: monthTrades.length > 0 ? (winningTrades / monthTrades.length) * 100 : 0,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  console.log('[PERFORMANCE] 📆 Grouped by month:', monthly.length);
  return monthly;
}

/**
 * Formata valores monetários
 */
export function formatCurrency(value: number): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formata percentual
 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Gera dados mock para testes
 */
export function generateMockTrades(count: number = 50): TradeHistory[] {
  console.log('[PERFORMANCE] 🎲 Generating mock trades:', count);

  const assets = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'LINK', 'AVAX'];
  const strategies = ['Scalping', 'Day Trade', 'Swing', 'Grid Bot', 'DCA'];
  const trades: TradeHistory[] = [];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const isWin = Math.random() > 0.4; // 60% win rate
    
    const entryPrice = 100 + Math.random() * 10000;
    const priceChange = isWin
      ? Math.random() * 0.05 + 0.01 // +1% a +6%
      : -(Math.random() * 0.04 + 0.005); // -0.5% a -4.5%
    
    const exitPrice = entryPrice * (1 + priceChange);
    const quantity = Math.random() * 10 + 0.1;
    const profitLoss = (exitPrice - entryPrice) * quantity;

    const openedAt = new Date(now - Math.random() * 30 * dayMs);
    const closedAt = new Date(openedAt.getTime() + Math.random() * 24 * 60 * 60 * 1000);

    trades.push({
      id: `trade_${i}`,
      asset_symbol: asset,
      type: Math.random() > 0.5 ? 'BUY' : 'SELL',
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity,
      profit_loss: profitLoss,
      profit_loss_percent: priceChange * 100,
      opened_at: openedAt.toISOString(),
      closed_at: closedAt.toISOString(),
      status: 'CLOSED',
      strategy,
      notes: isWin ? 'Trade vencedor' : 'Stop loss acionado',
    });
  }

  // Adicionar alguns trades abertos
  for (let i = 0; i < 5; i++) {
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const entryPrice = 100 + Math.random() * 10000;
    const quantity = Math.random() * 10 + 0.1;

    trades.push({
      id: `trade_open_${i}`,
      asset_symbol: asset,
      type: Math.random() > 0.5 ? 'BUY' : 'SELL',
      entry_price: entryPrice,
      quantity,
      opened_at: new Date(now - Math.random() * 7 * dayMs).toISOString(),
      status: 'OPEN',
      strategy,
      notes: 'Trade em andamento',
    });
  }

  return trades.sort((a, b) => 
    new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
  );
}
