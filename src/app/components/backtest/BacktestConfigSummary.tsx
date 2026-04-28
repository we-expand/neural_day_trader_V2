/**
 * 📋 BACKTEST CONFIG SUMMARY
 * 
 * Componente de resumo visual das configurações do backtest
 * Mostra todas as configurações escolhidas antes da execução
 */

import React from 'react';
import { Calendar, Clock, TrendingUp, ArrowUp, ArrowDown, ArrowUpDown, Zap } from 'lucide-react';

interface BacktestConfigSummaryProps {
  config: {
    asset: string;
    timeframe: string;
    periodPreset: string;
    startDate: string;
    endDate: string;
    tradeDirection: 'long' | 'short' | 'both';
    tradingHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
    quantity: number;
    strategyName?: string;
  };
}

export function BacktestConfigSummary({ config }: BacktestConfigSummaryProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDirectionInfo = () => {
    switch (config.tradeDirection) {
      case 'long':
        return { icon: ArrowUp, label: 'Comprado (Long)', color: 'text-emerald-400' };
      case 'short':
        return { icon: ArrowDown, label: 'Vendido (Short)', color: 'text-red-400' };
      case 'both':
        return { icon: ArrowUpDown, label: 'Ambos (Long & Short)', color: 'text-blue-400' };
    }
  };

  const direction = getDirectionInfo();
  const DirectionIcon = direction.icon;

  // Calcular duração do período
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
      <h4 className="text-sm font-bold text-white mb-3">Resumo da Configuração</h4>
      
      <div className="space-y-2.5">
        {/* Ativo + Timeframe */}
        <div className="flex items-center gap-3 text-xs">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">Ativo:</span>
          <span className="text-white font-medium">{config.asset}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Timeframe:</span>
          <span className="text-white font-medium">{config.timeframe}</span>
        </div>

        {/* Período */}
        <div className="flex items-center gap-3 text-xs">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">Período:</span>
          <span className="text-white font-medium">
            {formatDate(config.startDate)} até {formatDate(config.endDate)}
          </span>
          <span className="text-slate-600">({days} dias)</span>
        </div>

        {/* Direção */}
        <div className="flex items-center gap-3 text-xs">
          <DirectionIcon className={`w-4 h-4 ${direction.color}`} />
          <span className="text-slate-400">Direção:</span>
          <span className={`font-medium ${direction.color}`}>{direction.label}</span>
        </div>

        {/* Horários */}
        <div className="flex items-center gap-3 text-xs">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">Horários:</span>
          <span className="text-white font-medium">
            {config.tradingHours.enabled 
              ? `${config.tradingHours.startTime} - ${config.tradingHours.endTime}`
              : '24 horas (sem restrição)'}
          </span>
        </div>

        {/* Quantidade */}
        <div className="flex items-center gap-3 text-xs">
          <Zap className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">Quantidade:</span>
          <span className="text-white font-medium">{config.quantity} contrato(s)</span>
        </div>

        {/* Estratégia */}
        {config.strategyName && (
          <div className="mt-3 pt-3 border-t border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-blue-400 font-medium">
                Estratégia: {config.strategyName}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
