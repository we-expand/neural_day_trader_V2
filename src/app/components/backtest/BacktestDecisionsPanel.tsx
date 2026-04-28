/**
 * 📋 BACKTEST DECISIONS PANEL - Histórico de Decisões da IA
 * 
 * Painel lateral que mostra todas as decisões tomadas durante o backtest
 * com análise detalhada da IA para cada trade
 */

import React, { useState } from 'react';
import { 
  X, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  Search,
  ChevronDown,
  Clock,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  Eye,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TradeDecision } from './BacktestTradeMarker';

// ══════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════

interface BacktestDecisionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  decisions: TradeDecision[];
  onDecisionClick?: (decision: TradeDecision) => void;
  onJumpToCandle?: (candleIndex: number) => void;
}

type FilterType = 'all' | 'buy' | 'sell' | 'win' | 'loss';

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

export function BacktestDecisionsPanel({
  isOpen,
  onClose,
  decisions,
  onDecisionClick,
  onJumpToCandle
}: BacktestDecisionsPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtrar decisões
  const filteredDecisions = decisions.filter(decision => {
    // Filtro por tipo
    if (filter === 'buy' && decision.type !== 'BUY') return false;
    if (filter === 'sell' && decision.type !== 'SELL') return false;
    if (filter === 'win' && decision.result?.status !== 'win') return false;
    if (filter === 'loss' && decision.result?.status !== 'loss') return false;
    
    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        decision.aiAnalysis.mainReason.toLowerCase().includes(term) ||
        decision.aiAnalysis.supportingFactors.some(f => f.toLowerCase().includes(term)) ||
        decision.aiAnalysis.indicators.some(i => i.name.toLowerCase().includes(term))
      );
    }
    
    return true;
  });

  // Estatísticas
  const stats = {
    total: decisions.length,
    buy: decisions.filter(d => d.type === 'BUY').length,
    sell: decisions.filter(d => d.type === 'SELL').length,
    win: decisions.filter(d => d.result?.status === 'win').length,
    loss: decisions.filter(d => d.result?.status === 'loss').length
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-[450px] bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border-l border-zinc-800 shadow-2xl z-[110] flex flex-col"
      >
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center shadow-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Decisões da IA</h3>
              <p className="text-xs text-slate-400">{stats.total} decisões tomadas</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ═══ STATS BAR ═══ */}
        <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-900/30">
          <div className="text-center">
            <div className="text-xs text-slate-500">Buy</div>
            <div className="text-sm font-bold text-emerald-400">{stats.buy}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">Sell</div>
            <div className="text-sm font-bold text-red-400">{stats.sell}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">Win</div>
            <div className="text-sm font-bold text-emerald-400">{stats.win}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">Loss</div>
            <div className="text-sm font-bold text-red-400">{stats.loss}</div>
          </div>
        </div>

        {/* ═══ FILTERS ═══ */}
        <div className="px-6 py-3 border-b border-zinc-800">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar nas análises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'Todos', count: stats.total },
              { id: 'buy', label: 'Buy', count: stats.buy },
              { id: 'sell', label: 'Sell', count: stats.sell },
              { id: 'win', label: 'Win', count: stats.win },
              { id: 'loss', label: 'Loss', count: stats.loss }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as FilterType)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f.id
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-zinc-800/50 text-slate-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-70">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ DECISIONS LIST ═══ */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredDecisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Brain className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">Nenhuma decisão encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDecisions.map((decision) => {
                const isExpanded = expandedId === decision.id;
                const isBuy = decision.type === 'BUY';
                const hasResult = !!decision.result;
                
                return (
                  <motion.div
                    key={decision.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-gradient-to-br from-zinc-900 to-zinc-900/50 border rounded-xl overflow-hidden transition-all ${
                      isExpanded ? 'border-purple-600/50' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : decision.id)}
                      className="p-4 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {/* Type Badge */}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
                            isBuy ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-red-600 to-red-700'
                          }`}>
                            {isBuy ? (
                              <TrendingUp className="w-5 h-5 text-white" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-white" />
                            )}
                          </div>
                          
                          <div>
                            <div className="text-sm font-bold text-white">{decision.type} @ ${decision.price.toFixed(2)}</div>
                            <div className="text-xs text-slate-500">
                              Candle #{decision.candleIndex}
                            </div>
                          </div>
                        </div>
                        
                        {/* Confidence Badge */}
                        <div className="text-right">
                          <div className={`text-sm font-bold ${
                            decision.aiAnalysis.confidence >= 70 ? 'text-emerald-400' :
                            decision.aiAnalysis.confidence >= 50 ? 'text-yellow-400' :
                            'text-orange-400'
                          }`}>
                            {decision.aiAnalysis.confidence}%
                          </div>
                          <div className="text-xs text-slate-500">confiança</div>
                        </div>
                      </div>
                      
                      {/* Main Reason */}
                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        {decision.aiAnalysis.mainReason}
                      </p>
                      
                      {/* Result Badge */}
                      {hasResult && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                          decision.result!.status === 'win'
                            ? 'bg-emerald-900/20 border border-emerald-700/30'
                            : 'bg-red-900/20 border border-red-700/30'
                        }`}>
                          {decision.result!.status === 'win' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className={`text-xs font-bold ${
                            decision.result!.status === 'win' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {decision.result!.profit >= 0 ? '+' : ''}${decision.result!.profit.toFixed(2)} ({decision.result!.profitPercent >= 0 ? '+' : ''}{decision.result!.profitPercent.toFixed(2)}%)
                          </span>
                        </div>
                      )}
                      
                      {/* Expand Indicator */}
                      <div className="flex items-center justify-center mt-3">
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`} />
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-zinc-800"
                        >
                          <div className="p-4 space-y-4">
                            {/* Supporting Factors */}
                            {decision.aiAnalysis.supportingFactors.length > 0 && (
                              <div>
                                <div className="text-xs font-bold text-slate-400 mb-2">Fatores de Confirmação:</div>
                                <div className="space-y-1">
                                  {decision.aiAnalysis.supportingFactors.map((factor, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                                      <Zap className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                                      <span>{factor}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Indicators */}
                            {decision.aiAnalysis.indicators.length > 0 && (
                              <div>
                                <div className="text-xs font-bold text-slate-400 mb-2">Indicadores:</div>
                                <div className="grid grid-cols-2 gap-2">
                                  {decision.aiAnalysis.indicators.map((indicator, idx) => (
                                    <div key={idx} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2">
                                      <div className="text-xs text-slate-500">{indicator.name}</div>
                                      <div className={`text-sm font-bold ${
                                        indicator.signal === 'bullish' ? 'text-emerald-400' :
                                        indicator.signal === 'bearish' ? 'text-red-400' :
                                        'text-slate-400'
                                      }`}>
                                        {indicator.value}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Market Context */}
                            <div>
                              <div className="text-xs font-bold text-slate-400 mb-2">Contexto de Mercado:</div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {decision.aiAnalysis.marketContext}
                              </p>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => onJumpToCandle?.(decision.candleIndex)}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Ver no Gráfico
                              </button>
                              {onDecisionClick && (
                                <button
                                  onClick={() => onDecisionClick(decision)}
                                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Detalhes
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/50">
          <div className="text-xs text-slate-500 text-center">
            Mostrando {filteredDecisions.length} de {stats.total} decisões
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
