/**
 * 📊 BACKTEST LIVE PROGRESS - REAL-TIME VISUALIZATION
 * 
 * Visualização em tempo real do progresso do backtest
 * Mostra métricas, gráfico de equity curve e estatísticas
 * 
 * FEATURES:
 * - Equity curve em tempo real
 * - Métricas ao vivo (Win Rate, P&L, Drawdown)
 * - Barra de progresso animada
 * - Lista de trades recentes
 * - Animações fluidas
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target,
  DollarSign,
  Activity,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Minimize2,
  Maximize2,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ══════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════

interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  timestamp: number;
  status: 'win' | 'loss';
}

interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalProfitPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  currentEquity: number;
  initialCapital: number;
}

interface BacktestProgress {
  currentCandle: number;
  totalCandles: number;
  progress: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  candlesPerSecond: number;
}

interface BacktestLiveProgressProps {
  isRunning: boolean;
  progress: BacktestProgress;
  metrics: BacktestMetrics;
  recentTrades: Trade[];
  equityCurve: Array<{ time: number; equity: number }>;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onShowDecisions?: () => void;
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

export function BacktestLiveProgress({
  isRunning,
  progress,
  metrics,
  recentTrades,
  equityCurve,
  onPause,
  onResume,
  onStop,
  onShowDecisions
}: BacktestLiveProgressProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Formatar tempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Formatar número com sinal
  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toFixed(decimals);
  };

  // Formatar moeda
  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Calcular ROI
  const roi = ((metrics.currentEquity - metrics.initialCapital) / metrics.initialCapital) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={`fixed ${
          isMinimized 
            ? 'bottom-4 right-4 w-80' 
            : 'bottom-4 right-4 w-[600px]'
        } bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-[100] transition-all duration-300`}
      >
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${
              isRunning ? 'from-emerald-600 to-emerald-700' : 'from-orange-600 to-orange-700'
            } rounded-lg flex items-center justify-center shadow-lg`}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Backtest em Execução</h3>
              <p className="text-xs text-slate-400">
                {isRunning ? 'Processando...' : 'Pausado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* ═══ PROGRESS BAR ═══ */}
            <div className="px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400">
                  Progresso: {progress.currentCandle.toLocaleString()} / {progress.totalCandles.toLocaleString()} candles
                </div>
                <div className="text-xs font-bold text-emerald-400">
                  {progress.progress.toFixed(1)}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(progress.elapsedTime)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>{progress.candlesPerSecond.toFixed(0)} c/s</span>
                </div>
                <div>
                  ETA: {formatTime(progress.estimatedTimeRemaining)}
                </div>
              </div>
            </div>

            {/* ═══ MÉTRICAS PRINCIPAIS ═══ */}
            <div className="grid grid-cols-3 gap-3 p-4 border-b border-zinc-800">
              {/* ROI */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className={`w-4 h-4 ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span className="text-xs text-slate-400">ROI</span>
                </div>
                <div className={`text-xl font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {formatCurrency(metrics.currentEquity)}
                </div>
              </div>

              {/* Win Rate */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-400">Win Rate</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {metrics.winRate.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {metrics.winningTrades}W / {metrics.losingTrades}L
                </div>
              </div>

              {/* Total Trades */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-400">Trades</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {metrics.totalTrades}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  PF: {metrics.profitFactor.toFixed(2)}
                </div>
              </div>
            </div>

            {/* ═══ EQUITY CURVE (MINI GRAPH) ═══ */}
            <div className="px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300">Equity Curve</span>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                    <span className="text-slate-400">Max: {formatCurrency(Math.max(...equityCurve.map(e => e.equity)))}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3 text-red-400" />
                    <span className="text-slate-400">DD: {metrics.maxDrawdownPercent.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {/* Mini Chart */}
              <div className="relative h-20 bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
                <svg width="100%" height="100%" className="absolute inset-0">
                  {equityCurve.length > 1 && (
                    <>
                      {/* Gradient Fill */}
                      <defs>
                        <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Area Path */}
                      <path
                        d={generateEquityPath(equityCurve, 552, 80)}
                        fill="url(#equityGradient)"
                        stroke="none"
                      />

                      {/* Line Path */}
                      <path
                        d={generateEquityPath(equityCurve, 552, 80)}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                    </>
                  )}
                </svg>
              </div>
            </div>

            {/* ═══ TRADES RECENTES ═══ */}
            <div className="px-4 py-3 max-h-48 overflow-y-auto">
              <div className="text-xs font-bold text-slate-300 mb-2">Trades Recentes</div>
              <div className="space-y-2">
                {recentTrades.slice(0, 5).map((trade) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      trade.status === 'win'
                        ? 'bg-emerald-900/10 border-emerald-700/30'
                        : 'bg-red-900/10 border-red-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {trade.status === 'win' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <div>
                        <div className="text-xs font-medium text-white">
                          {trade.type} @ ${trade.entryPrice.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Exit: ${trade.exitPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold ${
                        trade.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {trade.profit >= 0 ? '+' : ''}{formatCurrency(trade.profit)}
                      </div>
                      <div className={`text-xs ${
                        trade.profitPercent >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {trade.profitPercent >= 0 ? '+' : ''}{trade.profitPercent.toFixed(2)}%
                      </div>
                    </div>
                  </motion.div>
                ))}

                {recentTrades.length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-500">
                    Aguardando primeiro trade...
                  </div>
                )}
              </div>
            </div>

            {/* ═══ ESTATÍSTICAS AVANÇADAS ═══ */}
            <div className="grid grid-cols-2 gap-3 px-4 py-3 border-t border-zinc-800 bg-zinc-900/30">
              <div>
                <div className="text-xs text-slate-500 mb-1">Avg Win</div>
                <div className="text-sm font-bold text-emerald-400">
                  {formatCurrency(metrics.averageWin)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Avg Loss</div>
                <div className="text-sm font-bold text-red-400">
                  {formatCurrency(metrics.averageLoss)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Sharpe Ratio</div>
                <div className="text-sm font-bold text-purple-400">
                  {metrics.sharpeRatio.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Max DD</div>
                <div className="text-sm font-bold text-orange-400">
                  {formatCurrency(metrics.maxDrawdown)}
                </div>
              </div>
            </div>

            {/* ═══ AI DECISIONS BUTTON ═══ */}
            {onShowDecisions && recentTrades.length > 0 && (
              <div className="px-4 pb-4">
                <button
                  onClick={onShowDecisions}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                >
                  <Brain className="w-4 h-4" />
                  Ver Análises da IA ({recentTrades.length})
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══ MINIMIZED VIEW ═══ */}
        {isMinimized && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-400">Progresso</div>
              <div className="text-xs font-bold text-emerald-400">{progress.progress.toFixed(1)}%</div>
            </div>
            <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-center">
                <div className="text-xs text-slate-500">ROI</div>
                <div className={`text-sm font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500">Trades</div>
                <div className="text-sm font-bold text-white">{metrics.totalTrades}</div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════

function generateEquityPath(
  data: Array<{ time: number; equity: number }>,
  width: number,
  height: number
): string {
  if (data.length === 0) return '';

  const maxEquity = Math.max(...data.map(d => d.equity));
  const minEquity = Math.min(...data.map(d => d.equity));
  const range = maxEquity - minEquity || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * (height - 10) - 5;
    return `${x},${y}`;
  });

  // Create path for area (fill)
  const firstPoint = points[0].split(',');
  const lastPoint = points[points.length - 1].split(',');
  
  return `M ${firstPoint[0]},${height} L ${points.join(' L ')} L ${lastPoint[0]},${height} Z`;
}