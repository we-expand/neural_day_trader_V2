/**
 * 📊 PERFORMANCE COMPARISON - Comparação Detalhada AI vs Trader
 * 
 * Dashboard comparativo completo mostrando TODAS as métricas:
 * - Performance geral
 * - Análise de trades
 * - Scores detalhados
 * - Gráficos comparativos
 * - Insights e recomendações
 */

import React, { useState } from 'react';
import {
  Brain,
  User,
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Zap,
  BarChart3,
  Activity,
  DollarSign,
  Percent,
  Clock,
  Award,
  Star,
  Crown,
  ChevronDown,
  ChevronUp,
  Eye,
  ThumbsUp,
  ThumbsDown,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ══════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════

interface PerformanceMetrics {
  // Métricas básicas
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalProfitPercent: number;
  
  // Métricas avançadas
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
  
  // Scores
  consistencyScore: number;
  riskManagementScore: number;
  timingScore: number;
  overallScore: number;
}

interface ComparisonProps {
  ai: PerformanceMetrics;
  human: PerformanceMetrics;
  initialCapital: number;
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

export function PerformanceComparison({ ai, human, initialCapital }: ComparisonProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');
  
  const winner = ai.overallScore > human.overallScore ? 'ai' : human.overallScore > ai.overallScore ? 'human' : 'tie';
  
  return (
    <div className="space-y-6">
      {/* ═══ WINNER CARD ═══ */}
      <WinnerCard ai={ai} human={human} winner={winner} />
      
      {/* ═══ OVERVIEW ═══ */}
      <Section
        title="Visão Geral"
        icon={BarChart3}
        isExpanded={expandedSection === 'overview'}
        onToggle={() => setExpandedSection(expandedSection === 'overview' ? null : 'overview')}
      >
        <OverviewGrid ai={ai} human={human} initialCapital={initialCapital} />
      </Section>
      
      {/* ═══ DETAILED METRICS ═══ */}
      <Section
        title="Métricas Detalhadas"
        icon={Activity}
        isExpanded={expandedSection === 'metrics'}
        onToggle={() => setExpandedSection(expandedSection === 'metrics' ? null : 'metrics')}
      >
        <DetailedMetrics ai={ai} human={human} />
      </Section>
      
      {/* ═══ SCORE BREAKDOWN ═══ */}
      <Section
        title="Análise de Scores"
        icon={Star}
        isExpanded={expandedSection === 'scores'}
        onToggle={() => setExpandedSection(expandedSection === 'scores' ? null : 'scores')}
      >
        <ScoreBreakdown ai={ai} human={human} />
      </Section>
      
      {/* ═══ INSIGHTS ═══ */}
      <Section
        title="Insights & Recomendações"
        icon={Award}
        isExpanded={expandedSection === 'insights'}
        onToggle={() => setExpandedSection(expandedSection === 'insights' ? null : 'insights')}
      >
        <Insights ai={ai} human={human} winner={winner} />
      </Section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// WINNER CARD
// ══════════════════════════════════════════════════════════════

function WinnerCard({ ai, human, winner }: { ai: PerformanceMetrics; human: PerformanceMetrics; winner: 'ai' | 'human' | 'tie' }) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-gradient-to-br from-yellow-900/30 via-orange-900/20 to-yellow-900/30 border border-yellow-700/50 rounded-2xl p-8 text-center relative overflow-hidden"
    >
      {/* Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.1),transparent_50%)]" />
      
      <div className="relative z-10">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30"
        >
          <Trophy className="w-10 h-10 text-white" />
        </motion.div>
        
        <h2 className="text-3xl font-bold text-white mb-2">
          {winner === 'ai' && '🤖 Neural AI Venceu!'}
          {winner === 'human' && '🎉 Parabéns! Você Venceu!'}
          {winner === 'tie' && '🤝 Empate Técnico!'}
        </h2>
        
        <p className="text-slate-300 mb-6">
          {winner === 'ai' && 'A IA demonstrou superior consistência e gerenciamento de risco nesta simulação'}
          {winner === 'human' && 'Excelente performance! Você superou a IA em múltiplas métricas'}
          {winner === 'tie' && 'Ambos demonstraram performance equivalente com pontos fortes diferentes'}
        </p>
        
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <div className={`p-4 rounded-xl ${winner === 'ai' ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-zinc-800/50 border border-zinc-700'}`}>
            <Brain className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{ai.overallScore.toFixed(0)}</div>
            <div className="text-xs text-slate-400">Neural AI</div>
          </div>
          <div className={`p-4 rounded-xl ${winner === 'human' ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-zinc-800/50 border border-zinc-700'}`}>
            <User className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{human.overallScore.toFixed(0)}</div>
            <div className="text-xs text-slate-400">Você</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION WRAPPER
// ══════════════════════════════════════════════════════════════

interface SectionProps {
  title: string;
  icon: React.ElementType;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, isExpanded, onToggle, children }: SectionProps) {
  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800"
          >
            <div className="p-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// OVERVIEW GRID
// ══════════════════════════════════════════════════════════════

function OverviewGrid({ ai, human, initialCapital }: { ai: PerformanceMetrics; human: PerformanceMetrics; initialCapital: number }) {
  const metrics = [
    { 
      label: 'ROI', 
      aiValue: ai.totalProfitPercent, 
      humanValue: human.totalProfitPercent, 
      suffix: '%', 
      icon: TrendingUp,
      higherIsBetter: true
    },
    { 
      label: 'Win Rate', 
      aiValue: ai.winRate, 
      humanValue: human.winRate, 
      suffix: '%', 
      icon: Target,
      higherIsBetter: true
    },
    { 
      label: 'Total Trades', 
      aiValue: ai.totalTrades, 
      humanValue: human.totalTrades, 
      suffix: '', 
      icon: BarChart3,
      higherIsBetter: false
    },
    { 
      label: 'Profit Factor', 
      aiValue: ai.profitFactor, 
      humanValue: human.profitFactor, 
      suffix: 'x', 
      icon: DollarSign,
      higherIsBetter: true
    },
    { 
      label: 'Sharpe Ratio', 
      aiValue: ai.sharpeRatio, 
      humanValue: human.sharpeRatio, 
      suffix: '', 
      icon: Activity,
      higherIsBetter: true
    },
    { 
      label: 'Max Drawdown', 
      aiValue: ai.maxDrawdownPercent, 
      humanValue: human.maxDrawdownPercent, 
      suffix: '%', 
      icon: TrendingDown,
      higherIsBetter: false
    }
  ];
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const aiWins = metric.higherIsBetter 
          ? metric.aiValue > metric.humanValue 
          : metric.aiValue < metric.humanValue;
        
        return (
          <div key={metric.label} className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">{metric.label}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {/* AI */}
              <div className={`p-3 rounded-lg ${aiWins ? 'bg-purple-900/30 border border-purple-700/40' : 'bg-zinc-800/50'}`}>
                <div className={`text-sm font-bold ${aiWins ? 'text-purple-400' : 'text-slate-400'}`}>
                  {metric.aiValue.toFixed(metric.suffix === '' && metric.aiValue < 10 ? 2 : 1)}{metric.suffix}
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  AI
                </div>
              </div>
              
              {/* Human */}
              <div className={`p-3 rounded-lg ${!aiWins ? 'bg-blue-900/30 border border-blue-700/40' : 'bg-zinc-800/50'}`}>
                <div className={`text-sm font-bold ${!aiWins ? 'text-blue-400' : 'text-slate-400'}`}>
                  {metric.humanValue.toFixed(metric.suffix === '' && metric.humanValue < 10 ? 2 : 1)}{metric.suffix}
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Você
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DETAILED METRICS
// ══════════════════════════════════════════════════════════════

function DetailedMetrics({ ai, human }: { ai: PerformanceMetrics; human: PerformanceMetrics }) {
  const formatCurrency = (num: number) => `$${num.toFixed(2)}`;
  
  const details = [
    { label: 'Média de Ganho', aiValue: formatCurrency(ai.averageWin), humanValue: formatCurrency(human.averageWin) },
    { label: 'Média de Perda', aiValue: formatCurrency(ai.averageLoss), humanValue: formatCurrency(human.averageLoss) },
    { label: 'Melhor Trade', aiValue: formatCurrency(ai.bestTrade), humanValue: formatCurrency(human.bestTrade) },
    { label: 'Pior Trade', aiValue: formatCurrency(ai.worstTrade), humanValue: formatCurrency(human.worstTrade) },
    { label: 'Avg Risk:Reward', aiValue: `${ai.averageRiskReward.toFixed(2)}:1`, humanValue: `${human.averageRiskReward.toFixed(2)}:1` },
    { label: 'Avg Hold Time', aiValue: `${ai.averageHoldTime.toFixed(0)} candles`, humanValue: `${human.averageHoldTime.toFixed(0)} candles` },
    { label: 'Equity Final', aiValue: formatCurrency(ai.currentEquity), humanValue: formatCurrency(human.currentEquity) },
    { label: 'Max Drawdown $', aiValue: formatCurrency(ai.maxDrawdown), humanValue: formatCurrency(human.maxDrawdown) }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {details.map((detail) => (
        <div key={detail.label} className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
          <span className="text-sm text-slate-400">{detail.label}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-purple-400">{detail.aiValue}</span>
            <span className="text-xs text-slate-600">vs</span>
            <span className="text-sm font-bold text-blue-400">{detail.humanValue}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SCORE BREAKDOWN
// ══════════════════════════════════════════════════════════════

function ScoreBreakdown({ ai, human }: { ai: PerformanceMetrics; human: PerformanceMetrics }) {
  const scores = [
    { label: 'Consistência', aiValue: ai.consistencyScore, humanValue: human.consistencyScore, color: 'emerald' },
    { label: 'Gerenciamento de Risco', aiValue: ai.riskManagementScore, humanValue: human.riskManagementScore, color: 'orange' },
    { label: 'Timing de Entrada/Saída', aiValue: ai.timingScore, humanValue: human.timingScore, color: 'cyan' }
  ];
  
  return (
    <div className="space-y-6">
      {scores.map((score) => (
        <div key={score.label}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">{score.label}</span>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-purple-400">AI: {score.aiValue.toFixed(0)}</span>
              <span className="text-blue-400">Você: {score.humanValue.toFixed(0)}</span>
            </div>
          </div>
          
          <div className="relative h-8 bg-zinc-800 rounded-lg overflow-hidden">
            {/* AI Bar */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-end pr-2"
              style={{ width: `${score.aiValue}%` }}
            >
              {score.aiValue > 15 && (
                <span className="text-xs font-bold text-white">{score.aiValue.toFixed(0)}%</span>
              )}
            </div>
            
            {/* Human Bar */}
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-blue-600 to-blue-700 flex items-center justify-start pl-2"
              style={{ width: `${score.humanValue}%` }}
            >
              {score.humanValue > 15 && (
                <span className="text-xs font-bold text-white">{score.humanValue.toFixed(0)}%</span>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {/* Overall Score */}
      <div className="pt-4 border-t border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-bold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Score Geral
          </span>
        </div>
        
        <div className="relative h-12 bg-zinc-800 rounded-lg overflow-hidden">
          {/* AI Bar */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 via-purple-500 to-yellow-500 flex items-center justify-end pr-3"
            style={{ width: `${ai.overallScore}%` }}
          >
            <span className="text-sm font-bold text-white">{ai.overallScore.toFixed(0)}</span>
          </div>
          
          {/* Human Bar */}
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-blue-600 via-blue-500 to-yellow-500 flex items-center justify-start pl-3"
            style={{ width: `${human.overallScore}%` }}
          >
            <span className="text-sm font-bold text-white">{human.overallScore.toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// INSIGHTS
// ══════════════════════════════════════════════════════════════

function Insights({ ai, human, winner }: { ai: PerformanceMetrics; human: PerformanceMetrics; winner: 'ai' | 'human' | 'tie' }) {
  const generateInsights = () => {
    const insights = [];
    
    // Win Rate
    if (Math.abs(ai.winRate - human.winRate) > 10) {
      insights.push({
        type: ai.winRate > human.winRate ? 'ai' : 'human',
        category: 'Precisão',
        message: ai.winRate > human.winRate
          ? 'A IA demonstrou maior taxa de acerto, indicando melhor seleção de setups'
          : 'Você teve melhor taxa de acerto! Excelente identificação de oportunidades'
      });
    }
    
    // Risk Management
    if (ai.riskManagementScore > human.riskManagementScore + 15) {
      insights.push({
        type: 'ai',
        category: 'Gestão de Risco',
        message: 'A IA foi superior em gerenciamento de risco, mantendo drawdown controlado'
      });
    } else if (human.riskManagementScore > ai.riskManagementScore + 15) {
      insights.push({
        type: 'human',
        category: 'Gestão de Risco',
        message: 'Excelente gestão de risco! Você protegeu seu capital eficientemente'
      });
    }
    
    // Consistency
    if (ai.consistencyScore > 80) {
      insights.push({
        type: 'ai',
        category: 'Consistência',
        message: 'A IA manteve resultados consistentes ao longo do período'
      });
    }
    if (human.consistencyScore > 80) {
      insights.push({
        type: 'human',
        category: 'Consistência',
        message: 'Você demonstrou alta consistência - um sinal de trading disciplinado!'
      });
    }
    
    return insights;
  };
  
  const insights = generateInsights();
  
  return (
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <div
          key={index}
          className={`p-4 rounded-xl border ${
            insight.type === 'ai'
              ? 'bg-purple-900/20 border-purple-700/40'
              : 'bg-blue-900/20 border-blue-700/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              insight.type === 'ai' ? 'bg-purple-600' : 'bg-blue-600'
            }`}>
              {insight.type === 'ai' ? (
                <Brain className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-400 mb-1">{insight.category}</div>
              <p className="text-sm text-slate-300">{insight.message}</p>
            </div>
          </div>
        </div>
      ))}
      
      {insights.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Performance equilibrada - continue operando para gerar mais insights!</p>
        </div>
      )}
    </div>
  );
}
