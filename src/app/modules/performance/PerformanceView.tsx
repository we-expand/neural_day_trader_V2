/**
 * 📊 PERFORMANCE VIEW
 * Componente principal do módulo de Performance Analytics
 * 
 * Features:
 * - Overview de métricas gerais
 * - Gráfico de P&L acumulado
 * - Histórico de trades
 * - Análise por ativo
 * - Métricas de risco
 * - Comparação mensal
 * 
 * Logs: [PERFORMANCE]
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  BarChart3,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  Award,
  AlertTriangle,
  Filter,
  Download,
  RefreshCw,
  PieChart,
  LineChart,
} from 'lucide-react';
import {
  LineChart as RechartsLine,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';
import { TradeHistory, PerformanceMetrics, TimeFrame } from './types';
import {
  calculatePerformanceMetrics,
  groupTradesByDay,
  groupPerformanceByAsset,
  groupTradesByMonth,
  formatCurrency,
  formatPercent,
  generateMockTrades,
} from './utils';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

export const PerformanceView = () => {
  console.log('[PERFORMANCE] 🚀 Performance View mounted');

  // State
  const [trades, setTrades] = useState<TradeHistory[]>([]);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30d');
  const [selectedAsset, setSelectedAsset] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Load trades (mock data for now)
  useEffect(() => {
    console.log('[PERFORMANCE] 📥 Loading trades...');
    setIsLoading(true);

    // Simular delay de API
    setTimeout(() => {
      const mockTrades = generateMockTrades(100);
      setTrades(mockTrades);
      setIsLoading(false);
      console.log('[PERFORMANCE] ✅ Trades loaded:', mockTrades.length);
    }, 500);
  }, []);

  // Filter trades by timeframe
  const filteredTrades = useMemo(() => {
    const now = Date.now();
    const timeFrameMs: Record<TimeFrame, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };

    const cutoff = now - timeFrameMs[timeFrame];

    return trades.filter(trade => {
      const tradeDate = new Date(trade.opened_at).getTime();
      const matchesTime = tradeDate >= cutoff;
      const matchesAsset = selectedAsset === 'ALL' || trade.asset_symbol === selectedAsset;
      return matchesTime && matchesAsset;
    });
  }, [trades, timeFrame, selectedAsset]);

  // Calculate metrics
  const metrics = useMemo(() => {
    return calculatePerformanceMetrics(filteredTrades);
  }, [filteredTrades]);

  const dailyPerformance = useMemo(() => {
    return groupTradesByDay(filteredTrades);
  }, [filteredTrades]);

  const assetPerformance = useMemo(() => {
    return groupPerformanceByAsset(filteredTrades);
  }, [filteredTrades]);

  const monthlyStats = useMemo(() => {
    return groupTradesByMonth(filteredTrades);
  }, [filteredTrades]);

  // Cumulative P&L for chart
  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return dailyPerformance.map(day => {
      cumulative += day.profit_loss;
      return {
        date: day.date,
        cumulative,
        daily: day.profit_loss,
      };
    });
  }, [dailyPerformance]);

  // Get unique assets
  const assets = useMemo(() => {
    const unique = Array.from(new Set(trades.map(t => t.asset_symbol)));
    return ['ALL', ...unique.sort()];
  }, [trades]);

  const handleRefresh = () => {
    console.log('[PERFORMANCE] 🔄 Refreshing data...');
    setIsLoading(true);
    setTimeout(() => {
      const mockTrades = generateMockTrades(100);
      setTrades(mockTrades);
      setIsLoading(false);
    }, 500);
  };

  const handleExport = () => {
    console.log('[PERFORMANCE] 💾 Exporting data...');
    // TODO: Implementar exportação CSV
    alert('Export feature coming soon!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Carregando Performance...</p>
          <p className="text-neutral-500 text-sm mt-2">Analisando histórico de trades</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full bg-neutral-950 text-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-white/5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <BarChart3 className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
              Performance Analytics
            </h1>
            <p className="text-slate-400 mt-1 tracking-wide font-light">
              Análise Completa de Resultados e Métricas de Trading
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:border-indigo-500/50 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Time Frame */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-500" />
          <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
            {(['24h', '7d', '30d', '90d', '1y', 'all'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  timeFrame === tf
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tf === 'all' ? 'Tudo' : tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Asset Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-500" />
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {assets.map(asset => (
              <option key={asset} value={asset}>
                {asset === 'ALL' ? 'Todos os Ativos' : asset}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-sm text-neutral-500">
          {filteredTrades.length} trades encontrados
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Net Profit */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-xl border ${
            metrics.netProfit >= 0
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-black/30">
              <DollarSign className={`w-5 h-5 ${metrics.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            {metrics.netProfit >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
          <h3 className="text-sm text-neutral-400 mb-1">Lucro Líquido</h3>
          <p className={`text-2xl font-bold font-mono ${
            metrics.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatCurrency(metrics.netProfit)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            ROI: {formatPercent(metrics.roi)}
          </p>
        </motion.div>

        {/* Win Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-xl border bg-neutral-900/50 border-neutral-800"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Target className="w-5 h-5 text-purple-400" />
            </div>
            <Percent className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-sm text-neutral-400 mb-1">Taxa de Acerto</h3>
          <p className="text-2xl font-bold font-mono text-white">
            {metrics.winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {metrics.winningTrades}W / {metrics.losingTrades}L
          </p>
        </motion.div>

        {/* Profit Factor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-xl border bg-neutral-900/50 border-neutral-800"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <BarChart3 className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-sm text-neutral-400 mb-1">Profit Factor</h3>
          <p className="text-2xl font-bold font-mono text-white">
            {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Avg Win: {formatCurrency(metrics.averageWin)}
          </p>
        </motion.div>

        {/* Total Trades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-xl border bg-neutral-900/50 border-neutral-800"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <LineChart className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-sm text-neutral-400 mb-1">Total de Trades</h3>
          <p className="text-2xl font-bold font-mono text-white">
            {metrics.totalTrades}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Volume: {formatCurrency(metrics.totalVolume)}
          </p>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cumulative P&L Chart */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            P&L Acumulado
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis
                  stroke="#666"
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171717',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
                  formatter={(value: number) => [formatCurrency(value), 'P&L']}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorCumulative)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Performance Mensal
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis
                  dataKey="month"
                  stroke="#666"
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickFormatter={(month) => {
                    const [year, m] = month.split('-');
                    return `${m}/${year.slice(2)}`;
                  }}
                />
                <YAxis
                  stroke="#666"
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171717',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Bar dataKey="profit" fill="#10b981" name="Lucro" />
                <Bar dataKey="loss" fill="#ef4444" name="Prejuízo" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Asset Performance & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Asset Performance */}
        <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-cyan-400" />
            Performance por Ativo
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {assetPerformance.map((asset, idx) => (
              <div
                key={asset.asset_symbol}
                className="flex items-center justify-between p-4 rounded-lg bg-neutral-800/40 hover:bg-neutral-800 transition-all border border-neutral-700/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <div>
                    <div className="font-bold text-white">{asset.asset_symbol}</div>
                    <div className="text-xs text-neutral-500">
                      {asset.trades_count} trades • Win: {asset.win_rate.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-bold font-mono ${
                      asset.net_profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(asset.net_profit)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Avg: {formatCurrency(asset.avg_profit)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Stats */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            Estatísticas
          </h3>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-neutral-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Sharpe Ratio</span>
                <span className="text-sm font-bold text-white">
                  {metrics.sharpeRatio.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${Math.min(Math.max(metrics.sharpeRatio * 20, 0), 100)}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Max Drawdown</span>
                <span className="text-sm font-bold text-red-400">
                  {formatCurrency(metrics.maxDrawdown)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Melhor Trade</span>
                <span className="text-sm font-bold text-green-400">
                  {formatCurrency(metrics.bestTrade)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Pior Trade</span>
                <span className="text-sm font-bold text-red-400">
                  {formatCurrency(metrics.worstTrade)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Tempo Médio</span>
                <span className="text-sm font-bold text-white">
                  {metrics.avgHoldingTime.toFixed(1)}h
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Wins Consecutivos</span>
                <span className="text-sm font-bold text-green-400">
                  {metrics.consecutiveWins}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400">Losses Consecutivos</span>
                <span className="text-sm font-bold text-red-400">
                  {metrics.consecutiveLosses}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades Table */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-400" />
          Trades Recentes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left py-3 px-4 text-neutral-400 font-medium">Data</th>
                <th className="text-left py-3 px-4 text-neutral-400 font-medium">Ativo</th>
                <th className="text-left py-3 px-4 text-neutral-400 font-medium">Tipo</th>
                <th className="text-right py-3 px-4 text-neutral-400 font-medium">Entrada</th>
                <th className="text-right py-3 px-4 text-neutral-400 font-medium">Saída</th>
                <th className="text-right py-3 px-4 text-neutral-400 font-medium">Quantidade</th>
                <th className="text-right py-3 px-4 text-neutral-400 font-medium">P&L</th>
                <th className="text-center py-3 px-4 text-neutral-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.slice(0, 20).map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                >
                  <td className="py-3 px-4 text-neutral-300">
                    {new Date(trade.opened_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">{trade.asset_symbol}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.type === 'BUY'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {trade.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-300">
                    {formatCurrency(trade.entry_price)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-300">
                    {trade.exit_price ? formatCurrency(trade.exit_price) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-300">
                    {trade.quantity.toFixed(4)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {trade.profit_loss !== undefined ? (
                      <span
                        className={
                          trade.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'
                        }
                      >
                        {formatCurrency(trade.profit_loss)}
                      </span>
                    ) : (
                      <span className="text-neutral-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.status === 'CLOSED'
                          ? 'bg-neutral-700 text-neutral-300'
                          : trade.status === 'OPEN'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
