/**
 * 🏔️ NEURAL DAY TRADER - PYRAMIDING VISUALIZER
 * 
 * Visualização gráfica IMPECÁVEL das posições em layers
 * Mostra cada entrada, trailing stops, break-even, e análise de risco em tempo real
 * 
 * CARACTERÍSTICAS:
 * - 📊 Gráfico de layers com animações fluidas
 * - 🎯 Preço médio ponderado destacado
 * - 🛡️ Trailing stops dinâmicos por layer
 * - 💰 PnL individual e total
 * - 🧠 AI Risk Score visual
 * - ⚡ Atualizações em tempo real
 */

import React from 'react';
import { 
  Layers, TrendingUp, TrendingDown, Shield, 
  Target, AlertCircle, Activity, Zap,
  ArrowUp, ArrowDown, DollarSign, Percent
} from 'lucide-react';
import { motion } from 'motion/react';
import type { PyramidLayer } from '@/app/services/pyramidingManager';

interface PyramidingVisualizerProps {
  layers: PyramidLayer[];
  currentPrice: number;
  direction: 'long' | 'short';
  averageEntry: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalSize: number;
  aiRiskScore: number; // 0-100
  className?: string;
}

export function PyramidingVisualizer({
  layers,
  currentPrice,
  direction,
  averageEntry,
  totalPnL,
  totalPnLPercent,
  totalSize,
  aiRiskScore,
  className = ''
}: PyramidingVisualizerProps) {
  
  if (layers.length === 0) {
    return (
      <div className={`bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center text-slate-500">
          <Layers className="w-16 h-16 opacity-20 mb-4" />
          <p className="text-sm font-medium">Nenhuma posição pyramiding ativa</p>
          <p className="text-xs text-slate-600 mt-1">Posições aparecerão aqui quando pyramiding estiver ativo</p>
        </div>
      </div>
    );
  }

  // Calcular range de preços para escala do gráfico
  const allPrices = [
    ...layers.map(l => l.entryPrice),
    ...layers.map(l => l.stopLoss),
    ...layers.map(l => l.trailingStop),
    currentPrice,
    averageEntry
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1;

  // Função para converter preço em posição Y (0-100%)
  const priceToY = (price: number): number => {
    const adjustedMin = minPrice - padding;
    const adjustedMax = maxPrice + padding;
    const adjustedRange = adjustedMax - adjustedMin;
    return ((adjustedMax - price) / adjustedRange) * 100;
  };

  // Determinar cor do AI Risk Score
  const getRiskColor = (score: number) => {
    if (score >= 70) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    if (score >= 50) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
    if (score >= 30) return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
    return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' };
  };

  const riskColor = getRiskColor(aiRiskScore);

  return (
    <div className={`bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden ${className}`}>
      {/* ========== HEADER ========== */}
      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-amber-400" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-white">Pyramiding Layers</h3>
              <p className="text-xs text-slate-500">{layers.length} entradas ativas • {totalSize.toFixed(2)} contratos totais</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* AI Risk Score */}
            <div className={`px-4 py-2 rounded-lg border ${riskColor.bg} ${riskColor.border}`}>
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${riskColor.text}`} />
                <div>
                  <div className="text-[10px] text-slate-400">AI Risk Score</div>
                  <div className={`text-sm font-bold ${riskColor.text}`}>{aiRiskScore}/100</div>
                </div>
              </div>
            </div>
            
            {/* Total PnL */}
            <div className={`px-4 py-2 rounded-lg border ${
              totalPnL >= 0 
                ? 'bg-emerald-500/20 border-emerald-500/30' 
                : 'bg-rose-500/20 border-rose-500/30'
            }`}>
              <div className="flex items-center gap-2">
                {totalPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <div>
                  <div className="text-[10px] text-slate-400">Total P&L</div>
                  <div className={`text-sm font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== VISUALIZAÇÃO GRÁFICA ========== */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Layers */}
          <div className="relative h-[400px] bg-[#080808] rounded-xl border border-white/10 p-4">
            {/* Background Grid */}
            <div className="absolute inset-4 opacity-20">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-white/10"
                  style={{ top: `${i * 25}%` }}
                />
              ))}
            </div>

            {/* Linha do Preço Atual */}
            <motion.div
              className="absolute left-4 right-4 border-t-2 border-yellow-400 border-dashed z-10"
              style={{ top: `${priceToY(currentPrice)}%` }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="absolute -top-3 right-0 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded text-[10px] font-bold text-yellow-400">
                Preço Atual: ${currentPrice.toFixed(5)}
              </div>
            </motion.div>

            {/* Linha do Preço Médio */}
            <div
              className="absolute left-4 right-4 border-t-2 border-blue-400 z-10"
              style={{ top: `${priceToY(averageEntry)}%` }}
            >
              <div className="absolute -top-3 left-0 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] font-bold text-blue-400">
                Média: ${averageEntry.toFixed(5)}
              </div>
            </div>

            {/* Layers */}
            {layers.map((layer, index) => {
              const yEntry = priceToY(layer.entryPrice);
              const yStop = priceToY(layer.stopLoss);
              const yTrailing = priceToY(layer.trailingStop);
              const isProfit = layer.pnl > 0;

              return (
                <motion.div
                  key={layer.layerNumber}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="absolute left-4 right-4"
                  style={{ top: `${yEntry}%` }}
                >
                  {/* Entrada */}
                  <div className="relative flex items-center">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center z-20">
                      <span className="text-xs font-bold text-amber-400">{layer.layerNumber}</span>
                    </div>
                    
                    <div className="flex-1 h-px bg-gradient-to-r from-amber-500/50 to-transparent ml-2" />
                    
                    <div className="absolute left-10 top-full mt-1 bg-[#0A0A0A] border border-white/10 rounded px-2 py-1 text-[10px] whitespace-nowrap z-30">
                      <div className="font-bold text-white">${layer.entryPrice.toFixed(5)}</div>
                      <div className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{layer.pnl.toFixed(2)} ({isProfit ? '+' : ''}{layer.pnlPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* Stop Loss */}
                  <div
                    className="absolute left-0 w-4 h-4 rounded-full bg-rose-500/30 border-2 border-rose-500"
                    style={{ top: `${((yStop - yEntry) / 100) * 400}px` }}
                  />

                  {/* Trailing Stop */}
                  <div
                    className="absolute left-0 w-4 h-4 rounded-full bg-orange-500/30 border-2 border-orange-500"
                    style={{ top: `${((yTrailing - yEntry) / 100) * 400}px` }}
                  >
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-[#0A0A0A] border border-orange-500/30 rounded px-2 py-0.5 text-[9px] font-bold text-orange-400 whitespace-nowrap">
                      Trailing
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Legenda */}
            <div className="absolute bottom-4 left-4 bg-[#0A0A0A]/90 border border-white/10 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500" />
                <span className="text-slate-400">Layer Entry</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded-full bg-rose-500/30 border-2 border-rose-500" />
                <span className="text-slate-400">Stop Loss</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded-full bg-orange-500/30 border-2 border-orange-500" />
                <span className="text-slate-400">Trailing Stop</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-px bg-blue-400" />
                <span className="text-slate-400">Preço Médio</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-px border-t-2 border-yellow-400 border-dashed" />
                <span className="text-slate-400">Preço Atual</span>
              </div>
            </div>
          </div>

          {/* Tabela de Layers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 mb-3">
              <Target className="w-4 h-4" />
              <h4 className="text-sm font-bold uppercase tracking-wider">Layer Details</h4>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
              {layers.map((layer) => {
                const isProfit = layer.pnl > 0;
                const riskRewardRatio = Math.abs(layer.entryPrice - layer.trailingStop) / Math.abs(layer.entryPrice - layer.stopLoss);

                return (
                  <motion.div
                    key={layer.layerNumber}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#080808] border border-white/10 rounded-lg p-4"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                          <span className="text-xs font-bold text-amber-400">#{layer.layerNumber}</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Layer {layer.layerNumber}</div>
                          <div className="text-[10px] text-slate-500">{layer.size.toFixed(2)} contratos</div>
                        </div>
                      </div>
                      
                      <div className={`px-2 py-1 rounded text-[9px] font-bold ${
                        layer.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                        layer.status === 'closed' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {layer.status.toUpperCase()}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 mb-1">Entry</div>
                        <div className="font-mono font-bold text-white">${layer.entryPrice.toFixed(5)}</div>
                      </div>
                      
                      <div>
                        <div className="text-slate-500 mb-1">P&L</div>
                        <div className={`font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{layer.pnl.toFixed(2)} ({isProfit ? '+' : ''}{layer.pnlPercent.toFixed(2)}%)
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-slate-500 mb-1">Stop Loss</div>
                        <div className="font-mono font-bold text-rose-400">${layer.stopLoss.toFixed(5)}</div>
                      </div>
                      
                      <div>
                        <div className="text-slate-500 mb-1">Trailing Stop</div>
                        <div className="font-mono font-bold text-orange-400">${layer.trailingStop.toFixed(5)}</div>
                      </div>
                    </div>

                    {/* Risk/Reward Bar */}
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-500">Risk/Reward</span>
                        <span className="font-bold text-emerald-400">{riskRewardRatio.toFixed(2)}:1</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(riskRewardRatio * 20, 100)}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========== RESUMO GERAL ========== */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#080808] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-500">Total Layers</span>
            </div>
            <div className="text-2xl font-bold text-white">{layers.length}</div>
          </div>
          
          <div className="bg-[#080808] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-500">Preço Médio</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">${averageEntry.toFixed(5)}</div>
          </div>
          
          <div className="bg-[#080808] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-slate-500">Tamanho Total</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{totalSize.toFixed(2)}</div>
          </div>
          
          <div className={`border rounded-lg p-4 ${
            totalPnL >= 0 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Percent className={`w-4 h-4 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className="text-xs text-slate-500">Total P&L</span>
            </div>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
