/**
 * 🥊 AI vs TRADER MODE - Competição de Performance
 * 
 * Modo especial onde a IA e o Trader operam simultaneamente
 * no mesmo período histórico para comparar performance
 * 
 * FEATURES:
 * - IA usa TODA sua potência (Price Action, Fibonacci, Gerenciamento de Risco)
 * - Trader opera manualmente no mesmo gráfico
 * - Dashboard comparativo em tempo real
 * - Análise detalhada de cada decisão
 * - Sistema de pontuação e ranking
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  User, 
  TrendingUp, 
  TrendingDown,
  Target,
  Shield,
  Zap,
  Trophy,
  Medal,
  Star,
  Clock,
  DollarSign,
  Percent,
  BarChart3,
  Activity,
  Eye,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Award,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ══════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════

interface Trader {
  id: 'ai' | 'human';
  name: string;
  type: 'AI' | 'TRADER';
  avatar: React.ReactNode;
  color: string;
}

interface TradeDecision {
  id: string;
  traderId: 'ai' | 'human';
  type: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
  candleIndex: number;
  
  // Análise (para IA)
  aiAnalysis?: {
    confidence: number;
    priceAction: string;
    fibonacci: string;
    riskManagement: string;
    indicators: { name: string; value: string; signal: string }[];
    marketStructure: string;
    confluence: string[];
  };
  
  // Resultado
  result?: {
    exitPrice: number;
    profit: number;
    profitPercent: number;
    riskRewardRatio: number;
    status: 'win' | 'loss';
    exitReason: string;
    holdTime: number; // em candles
  };
}

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalProfitPercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageRiskReward: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldTime: number;
  currentEquity: number;
  
  // Scores específicos
  consistencyScore: number; // 0-100
  riskManagementScore: number; // 0-100
  timingScore: number; // 0-100
  overallScore: number; // 0-100
}

interface ComparisonData {
  ai: PerformanceMetrics;
  human: PerformanceMetrics;
  winner: 'ai' | 'human' | 'tie';
}

interface AIvsTraderModeProps {
  isOpen: boolean;
  onClose: () => void;
  initialCapital?: number;
  symbol?: string;
  timeframe?: string;
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

export function AIvsTraderMode({
  isOpen,
  onClose,
  initialCapital = 10000,
  symbol = 'BTCUSD',
  timeframe = '15m'
}: AIvsTraderModeProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentCandle, setCurrentCandle] = useState(0);
  const [totalCandles] = useState(500);
  const [showComparison, setShowComparison] = useState(false);
  
  // Traders
  const traders: Trader[] = [
    {
      id: 'ai',
      name: 'Neural AI',
      type: 'AI',
      avatar: <Brain className="w-6 h-6" />,
      color: 'from-purple-600 to-purple-700'
    },
    {
      id: 'human',
      name: 'Você',
      type: 'TRADER',
      avatar: <User className="w-6 h-6" />,
      color: 'from-blue-600 to-blue-700'
    }
  ];
  
  // Métricas iniciais
  const initialMetrics: PerformanceMetrics = {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalProfit: 0,
    totalProfitPercent: 0,
    averageWin: 0,
    averageLoss: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    averageRiskReward: 0,
    bestTrade: 0,
    worstTrade: 0,
    averageHoldTime: 0,
    currentEquity: initialCapital,
    consistencyScore: 0,
    riskManagementScore: 0,
    timingScore: 0,
    overallScore: 0
  };
  
  const [aiMetrics, setAiMetrics] = useState<PerformanceMetrics>(initialMetrics);
  const [humanMetrics, setHumanMetrics] = useState<PerformanceMetrics>(initialMetrics);
  const [aiTrades, setAiTrades] = useState<TradeDecision[]>([]);
  const [humanTrades, setHumanTrades] = useState<TradeDecision[]>([]);
  
  // Calcular vencedor
  const winner = aiMetrics.overallScore > humanMetrics.overallScore 
    ? 'ai' 
    : humanMetrics.overallScore > aiMetrics.overallScore 
      ? 'human' 
      : 'tie';
  
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[120] flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-7xl h-[90vh] bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* ═══ HEADER ═══ */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  AI vs TRADER
                  <span className="text-xs px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-400">
                    COMPETIÇÃO
                  </span>
                </h2>
                <p className="text-sm text-slate-400">
                  Quem terá a melhor performance? {symbol} • {timeframe}
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* ═══ COMPETITORS HEADER ═══ */}
          <div className="grid grid-cols-2 gap-4 p-6 border-b border-zinc-800 bg-zinc-900/30">
            {traders.map((trader) => {
              const metrics = trader.id === 'ai' ? aiMetrics : humanMetrics;
              const isWinner = winner === trader.id;
              
              return (
                <div
                  key={trader.id}
                  className={`relative bg-gradient-to-br from-zinc-900 to-zinc-900/50 border rounded-xl p-4 transition-all ${
                    isWinner && showComparison
                      ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/20'
                      : 'border-zinc-800'
                  }`}
                >
                  {/* Winner Badge */}
                  {isWinner && showComparison && (
                    <div className="absolute -top-3 -right-3 w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30 border-2 border-yellow-400 z-10">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${trader.color} rounded-xl flex items-center justify-center shadow-lg`}>
                      {trader.avatar}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{trader.name}</h3>
                      <p className="text-sm text-slate-400">{trader.type}</p>
                    </div>
                    {showComparison && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-yellow-400">
                          {metrics.overallScore.toFixed(0)}
                        </div>
                        <div className="text-xs text-slate-500">SCORE</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                      <div className={`text-lg font-bold ${
                        metrics.totalProfitPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {metrics.totalProfitPercent >= 0 ? '+' : ''}{metrics.totalProfitPercent.toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500">ROI</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-white">
                        {metrics.winRate.toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-500">Win Rate</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-purple-400">
                        {metrics.totalTrades}
                      </div>
                      <div className="text-xs text-slate-500">Trades</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══ MAIN CONTENT ═══ */}
          <div className="flex-1 overflow-y-auto">
            {!showComparison ? (
              // MODO TRADING
              <TradingView
                currentCandle={currentCandle}
                totalCandles={totalCandles}
                isRunning={isRunning}
                onStart={() => setIsRunning(true)}
                onPause={() => setIsRunning(false)}
                onReset={() => {
                  setCurrentCandle(0);
                  setIsRunning(false);
                  setAiMetrics(initialMetrics);
                  setHumanMetrics(initialMetrics);
                  setAiTrades([]);
                  setHumanTrades([]);
                }}
                onNext={() => setCurrentCandle(prev => Math.min(prev + 1, totalCandles))}
                onBuy={(traderId) => console.log('BUY', traderId)}
                onSell={(traderId) => console.log('SELL', traderId)}
              />
            ) : (
              // COMPARAÇÃO FINAL
              <ComparisonView
                ai={aiMetrics}
                human={humanMetrics}
                winner={winner}
                aiTrades={aiTrades}
                humanTrades={humanTrades}
              />
            )}
          </div>

          {/* ═══ FOOTER ═══ */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="w-4 h-4" />
              <span>Candle {currentCandle} / {totalCandles}</span>
            </div>
            
            <button
              onClick={() => setShowComparison(!showComparison)}
              disabled={currentCandle < 10}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {showComparison ? (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  Voltar ao Trading
                </>
              ) : (
                <>
                  Ver Comparação
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════════════
// TRADING VIEW - Modo de operação
// ══════════════════════════════════════════════════════════════

interface TradingViewProps {
  currentCandle: number;
  totalCandles: number;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onNext: () => void;
  onBuy: (traderId: 'ai' | 'human') => void;
  onSell: (traderId: 'ai' | 'human') => void;
}

function TradingView({
  currentCandle,
  totalCandles,
  isRunning,
  onStart,
  onPause,
  onReset,
  onNext,
  onBuy,
  onSell
}: TradingViewProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Progress Bar */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Progresso</span>
          <span className="text-sm font-bold text-emerald-400">
            {((currentCandle / totalCandles) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
            animate={{ width: `${(currentCandle / totalCandles) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-96 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">Gráfico de Trading</p>
          <p className="text-xs text-slate-600 mt-2">Integrar com ChartView existente</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4">
        {/* AI Controls */}
        <div className="bg-gradient-to-br from-purple-900/20 to-purple-900/10 border border-purple-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-purple-400" />
            <h4 className="text-sm font-bold text-purple-400">Neural AI</h4>
            <span className="ml-auto text-xs px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400">
              AUTO
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p>✓ Price Action Expert</p>
            <p>✓ Fibonacci Analysis</p>
            <p>✓ Risk Management 2%</p>
            <p>✓ Multi-Indicator Confluence</p>
          </div>
        </div>

        {/* Human Controls */}
        <div className="bg-gradient-to-br from-blue-900/20 to-blue-900/10 border border-blue-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-blue-400" />
            <h4 className="text-sm font-bold text-blue-400">Você (Manual)</h4>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onBuy('human')}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              BUY
            </button>
            <button
              onClick={() => onSell('human')}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <TrendingDown className="w-4 h-4" />
              SELL
            </button>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onReset}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={isRunning ? onPause : onStart}
          className="w-12 h-12 flex items-center justify-center rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
        >
          {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button
          onClick={onNext}
          disabled={isRunning}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-slate-600 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPARISON VIEW - Análise comparativa
// ══════════════════════════════════════════════════════════════

interface ComparisonViewProps {
  ai: PerformanceMetrics;
  human: PerformanceMetrics;
  winner: 'ai' | 'human' | 'tie';
  aiTrades: TradeDecision[];
  humanTrades: TradeDecision[];
}

function ComparisonView({ ai, human, winner, aiTrades, humanTrades }: ComparisonViewProps) {
  const metrics = [
    { label: 'ROI', key: 'totalProfitPercent', suffix: '%', icon: TrendingUp },
    { label: 'Win Rate', key: 'winRate', suffix: '%', icon: Target },
    { label: 'Profit Factor', key: 'profitFactor', suffix: 'x', icon: BarChart3 },
    { label: 'Sharpe Ratio', key: 'sharpeRatio', suffix: '', icon: Activity },
    { label: 'Avg R:R', key: 'averageRiskReward', suffix: '', icon: Shield },
    { label: 'Max DD', key: 'maxDrawdownPercent', suffix: '%', icon: TrendingDown }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Winner Announcement */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/10 border border-yellow-700/50 rounded-xl p-6 text-center"
      >
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">
          {winner === 'ai' ? '🤖 Neural AI Venceu!' : winner === 'human' ? '🎉 Você Venceu!' : '🤝 Empate!'}
        </h3>
        <p className="text-slate-400">
          {winner === 'ai' 
            ? 'A IA demonstrou superior consistência e gerenciamento de risco' 
            : winner === 'human'
              ? 'Excelente performance! Você superou a IA!'
              : 'Ambos demonstraram performance equivalente'}
        </p>
      </motion.div>

      {/* Metrics Comparison */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const aiValue = ai[metric.key as keyof PerformanceMetrics] as number;
          const humanValue = human[metric.key as keyof PerformanceMetrics] as number;
          const aiWins = aiValue > humanValue;
          
          return (
            <div key={metric.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-500">{metric.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={`text-center p-2 rounded-lg ${
                  aiWins ? 'bg-purple-900/30 border border-purple-700/30' : 'bg-zinc-800/50'
                }`}>
                  <div className={`text-sm font-bold ${aiWins ? 'text-purple-400' : 'text-slate-400'}`}>
                    {aiValue.toFixed(2)}{metric.suffix}
                  </div>
                  <div className="text-xs text-slate-600">AI</div>
                </div>
                <div className={`text-center p-2 rounded-lg ${
                  !aiWins ? 'bg-blue-900/30 border border-blue-700/30' : 'bg-zinc-800/50'
                }`}>
                  <div className={`text-sm font-bold ${!aiWins ? 'text-blue-400' : 'text-slate-400'}`}>
                    {humanValue.toFixed(2)}{metric.suffix}
                  </div>
                  <div className="text-xs text-slate-600">Você</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { trader: 'ai', name: 'Neural AI', metrics: ai, color: 'purple' },
          { trader: 'human', name: 'Você', metrics: human, color: 'blue' }
        ].map(({ trader, name, metrics, color }) => (
          <div key={trader} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h4 className="text-sm font-bold text-white mb-4">{name} - Breakdown</h4>
            <div className="space-y-3">
              {[
                { label: 'Consistência', value: metrics.consistencyScore },
                { label: 'Gerenciamento de Risco', value: metrics.riskManagementScore },
                { label: 'Timing', value: metrics.timingScore }
              ].map((score) => (
                <div key={score.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">{score.label}</span>
                    <span className={`text-xs font-bold text-${color}-400`}>
                      {score.value.toFixed(0)}
                    </span>
                  </div>
                  <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`absolute inset-y-0 left-0 bg-${color}-500 rounded-full`}
                      style={{ width: `${score.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}