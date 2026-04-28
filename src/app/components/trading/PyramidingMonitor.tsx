/**
 * 🏔️ NEURAL DAY TRADER - PYRAMIDING MONITOR
 * 
 * Dashboard em tempo real do Pyramiding ativo
 * Monitora TUDO que está acontecendo com análise de IA contínua
 * 
 * CARACTERÍSTICAS:
 * - ⚡ Atualizações em tempo real (cada tick)
 * - 🧠 AI Risk Analysis contínua
 * - 📊 Métricas de performance
 * - 🎯 Próxima entrada estimada
 * - 🛡️ Status de proteções ativas
 * - 📈 Projeções de lucro
 */

import React, { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, TrendingDown, Shield,
  Zap, Brain, AlertTriangle, CheckCircle2,
  Target, Clock, DollarSign, Percent,
  ArrowUpRight, ArrowDownRight, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AIRiskAnalysis, PyramidPosition } from '@/app/services/pyramidingManager';

interface PyramidingMonitorProps {
  pyramid: PyramidPosition | null;
  currentPrice: number;
  className?: string;
}

export function PyramidingMonitor({ pyramid, currentPrice, className = '' }: PyramidingMonitorProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Atualizar tempo decorrido
  useEffect(() => {
    if (!pyramid) return;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - pyramid.basePosition.openTime;
      setTimeElapsed(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [pyramid]);

  if (!pyramid) {
    return null;
  }

  const { 
    layers, 
    totalSize, 
    averageEntry, 
    totalPnL, 
    totalPnLPercent, 
    config, 
    canAddMore, 
    aiAnalysis 
  } = pyramid;

  const direction = pyramid.basePosition.direction;
  const isProfit = totalPnL > 0;

  // Calcular distância até próxima entrada
  const nextLayerNumber = layers.length + 1;
  const canAddNextLayer = canAddMore && nextLayerNumber <= config.maxLayers && aiAnalysis.canAddPosition;

  // Calcular preço da próxima entrada
  const distanceToNext = direction === 'long'
    ? currentPrice - layers[layers.length - 1].entryPrice
    : layers[layers.length - 1].entryPrice - currentPrice;

  // Formatar tempo decorrido
  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  // Cor do momentum
  const getMomentumColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-rose-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed bottom-6 right-6 z-50 ${className}`}
    >
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* ========== HEADER (SEMPRE VISÍVEL) ========== */}
        <div 
          className="px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Status Indicator */}
              <motion.div
                className={`w-2 h-2 rounded-full ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              
              <div>
                <div className="text-sm font-bold text-white">Pyramiding Monitor</div>
                <div className="text-[10px] text-slate-500">
                  {layers.length}/{config.maxLayers} layers • {totalSize.toFixed(2)} contratos
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Total P&L Badge */}
              <div className={`px-3 py-1.5 rounded-lg border ${
                isProfit 
                  ? 'bg-emerald-500/20 border-emerald-500/30' 
                  : 'bg-rose-500/20 border-rose-500/30'
              }`}>
                <div className={`text-xs font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isProfit ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                </div>
              </div>
              
              <button className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                {isMinimized ? (
                  <Eye className="w-4 h-4 text-slate-400" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ========== CONTENT (EXPANSÍVEL) ========== */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4 w-[400px]">
                {/* ========== AI RISK ANALYSIS ========== */}
                <div className="bg-[#080808] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">AI Risk Analysis</span>
                    <div className="ml-auto text-[10px] text-slate-500">
                      Atualizado há {Math.floor((Date.now() - aiAnalysis.timestamp) / 1000)}s
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Momentum */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-400">Momentum</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${getMomentumColor(aiAnalysis.momentum.score)}`}>
                          {aiAnalysis.momentum.score}/100
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          aiAnalysis.momentum.trend === 'strong' ? 'bg-emerald-500/20 text-emerald-400' :
                          aiAnalysis.momentum.trend === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                          aiAnalysis.momentum.trend === 'weak' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {aiAnalysis.momentum.trend}
                        </span>
                      </div>
                    </div>

                    {/* Volatilidade */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-400">Volatilidade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">
                          {aiAnalysis.volatility.atrPercent.toFixed(2)}%
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          aiAnalysis.volatility.level === 'low' ? 'bg-emerald-500/20 text-emerald-400' :
                          aiAnalysis.volatility.level === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                          aiAnalysis.volatility.level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {aiAnalysis.volatility.level}
                        </span>
                        {aiAnalysis.volatility.increasing && (
                          <ArrowUpRight className="w-3 h-3 text-orange-400" />
                        )}
                      </div>
                    </div>

                    {/* Divergência */}
                    {aiAnalysis.divergence.detected && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-slate-400">Divergência</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400">
                          {aiAnalysis.divergence.type} • {aiAnalysis.divergence.severity}
                        </span>
                      </div>
                    )}

                    {/* Risk Level Geral */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold">Risk Level</span>
                        <span className={`px-2 py-1 rounded font-bold ${
                          aiAnalysis.riskLevel === 'very-low' ? 'bg-emerald-500/20 text-emerald-400' :
                          aiAnalysis.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                          aiAnalysis.riskLevel === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                          aiAnalysis.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {aiAnalysis.riskLevel.replace('-', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========== PRÓXIMA ENTRADA ========== */}
                <div className={`border rounded-xl p-4 ${
                  canAddNextLayer
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-500/10 border-slate-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {canAddNextLayer ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-slate-400" />
                    )}
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      canAddNextLayer ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      Próxima Entrada
                    </span>
                  </div>

                  {canAddNextLayer ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Layer #{nextLayerNumber}</span>
                        <span className="font-bold text-white">
                          Aguardando +{Math.abs(distanceToNext * 10000).toFixed(1)} pips
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Tamanho estimado</span>
                        <span className="font-bold text-emerald-400">
                          {/* Calcular tamanho aqui baseado em strategy */}
                          1.0 contratos
                        </span>
                      </div>

                      <div className="pt-2 border-t border-emerald-500/30">
                        <p className="text-[10px] text-emerald-300">
                          ✅ {aiAnalysis.reason}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {!canAddMore && layers.length >= config.maxLayers 
                        ? `Máximo de layers atingido (${config.maxLayers})`
                        : !aiAnalysis.canAddPosition
                        ? `⚠️ ${aiAnalysis.reason}`
                        : 'Aguardando condições favoráveis'}
                    </p>
                  )}
                </div>

                {/* ========== PROTEÇÕES ATIVAS ========== */}
                <div className="bg-[#080808] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Proteções Ativas</span>
                  </div>

                  <div className="space-y-2">
                    {/* Trailing Stop */}
                    {config.trailingStopEnabled && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-slate-400">Trailing Stop</span>
                        </div>
                        <span className="font-bold text-emerald-400">Ativo</span>
                      </div>
                    )}

                    {/* Break-Even */}
                    {config.breakEvenEnabled && layers.length >= config.breakEvenAfterLayers && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-slate-400">Break-Even</span>
                        </div>
                        <span className="font-bold text-blue-400">Ativo</span>
                      </div>
                    )}

                    {/* Partial TP */}
                    {config.partialTakeProfitEnabled && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span className="text-slate-400">Take Profit Parcial</span>
                        </div>
                        <span className="font-bold text-yellow-400">
                          {config.partialTakeProfitPercent}% nos layers {config.partialTakeProfitLayers.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Emergency Stop */}
                    {config.emergencyStopEnabled && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-slate-400">Stop de Emergência</span>
                        </div>
                        <span className="font-bold text-rose-400">
                          -{config.emergencyStopLossPercent}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ========== MÉTRICAS ========== */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#080808] border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500">Tempo</span>
                    </div>
                    <div className="text-sm font-bold text-white">{formatElapsed(timeElapsed)}</div>
                  </div>

                  <div className="bg-[#080808] border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500">Preço Médio</span>
                    </div>
                    <div className="text-sm font-bold text-blue-400">${averageEntry.toFixed(5)}</div>
                  </div>

                  <div className="bg-[#080808] border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500">Preço Atual</span>
                    </div>
                    <div className="text-sm font-bold text-yellow-400">${currentPrice.toFixed(5)}</div>
                  </div>

                  <div className={`border rounded-lg p-3 ${
                    isProfit 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-3 h-3 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`} />
                      <span className="text-[10px] text-slate-500">P&L Total</span>
                    </div>
                    <div className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${totalPnL.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
