/**
 * 📍 BACKTEST TRADE MARKER - Marcadores de Trade no Gráfico
 * 
 * Marcadores visuais que aparecem no gráfico mostrando:
 * - Onde a ordem foi executada (BUY/SELL)
 * - Análise da IA explicando o motivo
 * - Resultado do trade (profit/loss)
 * - Indicadores que confirmaram a decisão
 */

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Brain, Target, Activity, Zap, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ══════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════

export interface TradeDecision {
  id: string;
  type: 'BUY' | 'SELL';
  price: number;
  timestamp: number;
  candleIndex: number;
  
  // Análise da IA
  aiAnalysis: {
    confidence: number; // 0-100
    mainReason: string;
    supportingFactors: string[];
    indicators: {
      name: string;
      value: string;
      signal: 'bullish' | 'bearish' | 'neutral';
    }[];
    marketContext: string;
  };
  
  // Resultado (se já finalizado)
  result?: {
    exitPrice: number;
    profit: number;
    profitPercent: number;
    status: 'win' | 'loss';
    exitReason: string;
  };
}

interface BacktestTradeMarkerProps {
  trade: TradeDecision;
  position: { x: number; y: number }; // Posição no gráfico
  isActive?: boolean;
  onClick?: () => void;
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

export function BacktestTradeMarker({ trade, position, isActive = false, onClick }: BacktestTradeMarkerProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const isBuy = trade.type === 'BUY';
  const hasResult = !!trade.result;
  
  // Cores baseadas no tipo
  const colors = {
    buy: {
      bg: 'bg-emerald-500',
      border: 'border-emerald-400',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/50'
    },
    sell: {
      bg: 'bg-red-500',
      border: 'border-red-400',
      text: 'text-red-400',
      glow: 'shadow-red-500/50'
    }
  };
  
  const color = isBuy ? colors.buy : colors.sell;
  
  return (
    <div
      className="absolute z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      {/* Marcador Principal */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: isActive ? 1.2 : 1, 
          opacity: 1 
        }}
        whileHover={{ scale: 1.3 }}
        className={`relative cursor-pointer ${color.bg} rounded-full p-2 border-2 ${color.border} shadow-lg ${color.glow} transition-all`}
      >
        {/* Ícone */}
        {isBuy ? (
          <TrendingUp className="w-4 h-4 text-white" strokeWidth={3} />
        ) : (
          <TrendingDown className="w-4 h-4 text-white" strokeWidth={3} />
        )}
        
        {/* Badge de Resultado */}
        {hasResult && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${
            trade.result!.status === 'win' ? 'bg-emerald-600' : 'bg-red-600'
          } border-2 border-white flex items-center justify-center`}>
            {trade.result!.status === 'win' ? (
              <CheckCircle className="w-2.5 h-2.5 text-white" />
            ) : (
              <XCircle className="w-2.5 h-2.5 text-white" />
            )}
          </div>
        )}
        
        {/* Pulso de Ativação */}
        {isActive && (
          <motion.div
            className={`absolute inset-0 ${color.bg} rounded-full`}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>
      
      {/* Linha vertical para o preço */}
      <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-4 ${color.bg} opacity-30`} />
      
      {/* Tooltip com Análise da IA */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-4 pointer-events-none"
            style={{ zIndex: 9999 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${color.bg} rounded-lg flex items-center justify-center shadow-lg`}>
                  {isBuy ? (
                    <TrendingUp className="w-4 h-4 text-white" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-white" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{trade.type} Order</div>
                  <div className="text-xs text-slate-400">@ ${trade.price.toFixed(2)}</div>
                </div>
              </div>
              
              {/* Confiança da IA */}
              <div className="text-right">
                <div className="text-xs text-slate-500">Confiança</div>
                <div className={`text-sm font-bold ${
                  trade.aiAnalysis.confidence >= 70 ? 'text-emerald-400' :
                  trade.aiAnalysis.confidence >= 50 ? 'text-yellow-400' :
                  'text-orange-400'
                }`}>
                  {trade.aiAnalysis.confidence}%
                </div>
              </div>
            </div>
            
            {/* Análise Principal */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-purple-400">ANÁLISE DA IA</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {trade.aiAnalysis.mainReason}
              </p>
            </div>
            
            {/* Fatores de Suporte */}
            {trade.aiAnalysis.supportingFactors.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-bold text-slate-500 mb-2">Fatores de Confirmação:</div>
                <div className="space-y-1">
                  {trade.aiAnalysis.supportingFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                      <Zap className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Indicadores */}
            {trade.aiAnalysis.indicators.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-bold text-slate-500 mb-2">Indicadores:</div>
                <div className="grid grid-cols-2 gap-2">
                  {trade.aiAnalysis.indicators.map((indicator, idx) => (
                    <div key={idx} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2">
                      <div className="text-xs text-slate-400">{indicator.name}</div>
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
            
            {/* Contexto de Mercado */}
            <div className="pt-3 border-t border-zinc-800">
              <div className="text-xs text-slate-500 mb-1">Contexto:</div>
              <p className="text-xs text-slate-400">{trade.aiAnalysis.marketContext}</p>
            </div>
            
            {/* Resultado (se disponível) */}
            {hasResult && (
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">Resultado:</div>
                  <div className={`text-sm font-bold ${
                    trade.result!.status === 'win' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {trade.result!.profit >= 0 ? '+' : ''}${trade.result!.profit.toFixed(2)} ({trade.result!.profitPercent >= 0 ? '+' : ''}{trade.result!.profitPercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Saída: ${trade.result!.exitPrice.toFixed(2)} - {trade.result!.exitReason}
                </div>
              </div>
            )}
            
            {/* Seta apontando para o marcador */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-3 h-3 bg-zinc-900 border-r border-b border-zinc-800 transform rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
