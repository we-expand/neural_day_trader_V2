/**
 * 📊 US30 SCALPING PRESET
 * 
 * Configuração otimizada para scalping no Dow Jones (US30)
 * Estratégia de poucos pontos com alta precisão
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 */

import React from 'react';
import { TrendingUp, Zap, Clock, Target, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface US30ScalpPresetProps {
  onApply: (config: any) => void;
}

export function US30ScalpPreset({ onApply }: US30ScalpPresetProps) {
  const applyUS30Scalp = () => {
    const config = {
      // 🎯 ATIVO
      activeAssets: ['US30'],
      
      // ⚡ ESTRATÉGIA: SCALPING
      targetPoints: 'POUCOS', // 10-30 pontos
      stopLossMode: 'FIXO',
      marketMode: 'TREND', // Seguir tendência intraday
      direction: 'AUTO',
      
      // 📊 TIMEFRAME
      timeframe: '5M', // 5 minutos para scalping
      
      // 💰 GESTÃO DE RISCO
      maxPositions: 3, // Máximo 3 posições simultâneas
      maxContracts: 0.1, // 0.1 lote (US$ 1 por ponto)
      dailyLossLimit: 2.0, // 2% de perda diária máxima
      
      // 🎲 ALAVANCAGEM
      leverage: 10, // Conservador para US30
      
      // 🎯 ALVOS ESPECÍFICOS US30
      takeProfit: 20, // 20 pontos de lucro
      stopLoss: 15, // 15 pontos de stop
      
      // ⏰ HORÁRIOS
      tradingStartHour: 9, // 9h AM (abertura NY)
      tradingEndHour: 16, // 4h PM (antes do fechamento)
    };

    onApply(config);
    
    toast.success('✅ Preset US30 Scalping Aplicado!', {
      description: 'Alvo: 20 pontos | Stop: 15 pontos | Lote: 0.1',
      duration: 5000
    });
  };

  return (
    <div
      className="p-4 rounded-xl bg-gradient-to-br from-blue-950/30 to-purple-950/30 border-2 border-blue-500/30"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            US30 Scalping
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Estratégia de poucos pontos para Dow Jones
          </p>
        </div>
        <button
          onClick={applyUS30Scalp}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-500/20"
        >
          Aplicar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-black/30 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Take Profit</span>
          </div>
          <p className="text-xl font-bold text-green-400">20 pontos</p>
          <p className="text-[10px] text-gray-500">~$20 com 0.1 lote</p>
        </div>

        <div className="p-3 rounded-lg bg-black/30 border border-red-500/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400">Stop Loss</span>
          </div>
          <p className="text-xl font-bold text-red-400">15 pontos</p>
          <p className="text-[10px] text-gray-500">~$15 com 0.1 lote</p>
        </div>

        <div className="p-3 rounded-lg bg-black/30 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Timeframe</span>
          </div>
          <p className="text-xl font-bold text-yellow-400">5 Min</p>
          <p className="text-[10px] text-gray-500">Alta frequência</p>
        </div>

        <div className="p-3 rounded-lg bg-black/30 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Horário</span>
          </div>
          <p className="text-xl font-bold text-purple-400">9h-16h</p>
          <p className="text-[10px] text-gray-500">Sessão NY</p>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <TrendingUp className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-blue-300">Estratégia</p>
            <p className="text-gray-400">Seguir tendência intraday com entradas rápidas</p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
          <Zap className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-yellow-300">Risco/Retorno</p>
            <p className="text-gray-400">1.33:1 - Risco de $15 para ganho de $20</p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-300">⚠️ Atenção</p>
            <p className="text-gray-400">Spread US30: 2-5 pontos. Melhor operar 9h-16h NY</p>
          </div>
        </div>
      </div>
    </div>
  );
}