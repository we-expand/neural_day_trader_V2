/**
 * 🏁 BACKTEST RESULTS MODAL
 *
 * Tela final exibida quando um backtest termina de rodar (isCompleted=true
 * em useBacktestLiveProgress). Antes disso não existia nenhuma tela de
 * resultado — o BacktestLiveProgress some da tela assim que isRunning vira
 * false e o usuário fica sem ver o resumo final nem a lista completa de trades.
 */

import React from 'react';
import {
  X, TrendingUp, TrendingDown, Target, BarChart3, Percent, DollarSign,
  Brain, RotateCcw, CheckCircle, XCircle, ArrowDownRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Trade {
  id: string;
  symbol: string;
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

interface BacktestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyName: string;
  symbol: string;
  timeframe: string;
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: Array<{ time: number; equity: number }>;
  onShowDecisions?: () => void;
  onRunAnother?: () => void;
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(num);
}

function generateEquityPath(data: Array<{ time: number; equity: number }>, width: number, height: number): string {
  if (data.length === 0) return '';
  const maxEquity = Math.max(...data.map(d => d.equity));
  const minEquity = Math.min(...data.map(d => d.equity));
  const range = maxEquity - minEquity || 1;
  const points = data.map((point, index) => {
    const x = (index / Math.max(1, data.length - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * (height - 10) - 5;
    return `${x},${y}`;
  });
  const firstX = points[0].split(',')[0];
  const lastX = points[points.length - 1].split(',')[0];
  return `M ${firstX},${height} L ${points.join(' L ')} L ${lastX},${height} Z`;
}

export function BacktestResultsModal({
  isOpen,
  onClose,
  strategyName,
  symbol,
  timeframe,
  metrics,
  trades,
  equityCurve,
  onShowDecisions,
  onRunAnother,
}: BacktestResultsModalProps) {
  if (!isOpen) return null;

  const roi = metrics.totalProfitPercent;
  const isProfit = metrics.totalProfit >= 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl"
        >
          {/* ═══ HEADER ═══ */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center shadow-lg ${
                isProfit ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-red-600 to-red-700'
              }`}>
                {isProfit ? <TrendingUp className="w-5 h-5 text-white" /> : <TrendingDown className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Backtest concluído</h3>
                <p className="text-xs text-slate-400">{strategyName} · {symbol} · {timeframe}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ═══ RESUMO PRINCIPAL ═══ */}
          <div className="px-6 py-5 border-b border-zinc-800">
            <div className={`rounded-xl p-5 border ${
              isProfit ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-red-900/10 border-red-700/30'
            }`}>
              <div className="text-xs text-slate-400 mb-1">Resultado final</div>
              <div className={`text-4xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}{roi.toFixed(2)}%
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {formatCurrency(metrics.initialCapital)} → {formatCurrency(metrics.currentEquity)}
                {' '}({isProfit ? '+' : ''}{formatCurrency(metrics.totalProfit)})
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Resultado líquido — já descontado o custo estimado de execução (spread + comissão + slippage, ida e volta, calibrado por classe de ativo).
              </div>
            </div>
          </div>

          {/* ═══ MÉTRICAS ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-5 border-b border-zinc-800">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-slate-400">Win Rate</span>
              </div>
              <div className="text-lg font-bold text-white">{metrics.winRate.toFixed(1)}%</div>
              <div className="text-xs text-slate-500">{metrics.winningTrades}W / {metrics.losingTrades}L</div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-slate-400">Trades</span>
              </div>
              <div className="text-lg font-bold text-white">{metrics.totalTrades}</div>
              <div className="text-xs text-slate-500">PF: {metrics.profitFactor.toFixed(2)}</div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-slate-400">Max Drawdown</span>
              </div>
              <div className="text-lg font-bold text-orange-400">{metrics.maxDrawdownPercent.toFixed(2)}%</div>
              <div className="text-xs text-slate-500">{formatCurrency(metrics.maxDrawdown)}</div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs text-slate-400">Sharpe</span>
              </div>
              <div className="text-lg font-bold text-white">{metrics.sharpeRatio.toFixed(2)}</div>
              <div className="text-xs text-slate-500">
                Avg W {formatCurrency(metrics.averageWin)} / L {formatCurrency(metrics.averageLoss)}
              </div>
            </div>
          </div>

          {/* ═══ EQUITY CURVE ═══ */}
          <div className="px-6 py-5 border-b border-zinc-800">
            <div className="text-xs font-bold text-slate-300 mb-2">Curva de Equity</div>
            <div className="relative h-28 bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
              <svg width="100%" height="100%" viewBox="0 0 700 112" preserveAspectRatio="none" className="absolute inset-0">
                {equityCurve.length > 1 && (
                  <>
                    <defs>
                      <linearGradient id="resultsEquityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={generateEquityPath(equityCurve, 700, 112)} fill="url(#resultsEquityGradient)" stroke="none" />
                    <path d={generateEquityPath(equityCurve, 700, 112)} fill="none" stroke={isProfit ? '#10b981' : '#ef4444'} strokeWidth="2" />
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* ═══ LISTA COMPLETA DE TRADES ═══ */}
          <div className="px-6 py-5">
            <div className="text-xs font-bold text-slate-300 mb-2">
              Todos os trades ({trades.length})
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {trades.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500">
                  Nenhum trade foi aberto no período — a estratégia não encontrou nenhuma condição de entrada.
                </div>
              )}
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    trade.status === 'win' ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-red-900/10 border-red-700/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {trade.status === 'win' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-medium text-white">
                        {trade.type} @ ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(trade.timestamp).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-bold ${trade.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.profit >= 0 ? '+' : ''}{formatCurrency(trade.profit)}
                    </div>
                    <div className={`text-xs ${trade.profitPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {trade.profitPercent >= 0 ? '+' : ''}{trade.profitPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ AÇÕES ═══ */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 sticky bottom-0">
            {onShowDecisions && trades.length > 0 && (
              <button
                onClick={onShowDecisions}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
              >
                <Brain className="w-4 h-4" />
                Ver Decisões da IA
              </button>
            )}
            {onRunAnother && (
              <button
                onClick={onRunAnother}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Rodar outro
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-lg text-sm font-medium transition-all"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
