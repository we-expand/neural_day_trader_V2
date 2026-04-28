/**
 * 📝 ORDER ENTRY
 * Formulário para abrir ordens simuladas
 */

import React, { useState } from 'react';
import { useSimulator } from '@/app/contexts/SimulatorContext';
import { TrendingUp, TrendingDown, Shield, Target } from 'lucide-react';
import { motion } from 'motion/react';

interface OrderEntryProps {
  symbol: string;
  currentPrice: number;
}

export function OrderEntry({ symbol, currentPrice }: OrderEntryProps) {
  const { openOrder, account } = useSimulator();
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [volume, setVolume] = useState(0.1);
  const [useStopLoss, setUseStopLoss] = useState(false);
  const [useTakeProfit, setUseTakeProfit] = useState(false);
  const [stopLossValue, setStopLossValue] = useState(50);
  const [takeProfitValue, setTakeProfitValue] = useState(100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const sl = useStopLoss ? stopLossValue : undefined;
    const tp = useTakeProfit ? takeProfitValue : undefined;

    openOrder(symbol, orderType, volume, sl, tp);

    // Reset form
    setVolume(0.1);
    setUseStopLoss(false);
    setUseTakeProfit(false);
  };

  const maxVolume = Math.floor(account.freeMargin / 100) / 10; // Simplificado

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
      <h3 className="text-lg font-bold text-white mb-6">Nova Ordem</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Type Selection */}
        <div>
          <label className="text-xs text-slate-400 mb-2 block">Tipo de Ordem</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOrderType('BUY')}
              className={`py-3 rounded-lg font-bold text-sm transition-all ${
                orderType === 'BUY'
                  ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50 shadow-lg shadow-green-500/20'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                BUY
              </div>
            </button>

            <button
              type="button"
              onClick={() => setOrderType('SELL')}
              className={`py-3 rounded-lg font-bold text-sm transition-all ${
                orderType === 'SELL'
                  ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 shadow-lg shadow-red-500/20'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/30 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingDown className="w-4 h-4" />
                SELL
              </div>
            </button>
          </div>
        </div>

        {/* Current Price Display */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Preço Atual</span>
            <span className="text-xs text-slate-400">{symbol}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ${currentPrice.toFixed(5)}
          </div>
        </div>

        {/* Volume */}
        <div>
          <label className="text-xs text-slate-400 mb-2 block">
            Volume (Lotes)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value) || 0.1)}
              min="0.01"
              max={maxVolume}
              step="0.01"
              className="flex-1 bg-slate-800/50 border border-slate-700/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <div className="text-xs text-slate-500">
              Máx: {maxVolume.toFixed(2)}
            </div>
          </div>

          {/* Volume Presets */}
          <div className="flex gap-2 mt-2">
            {[0.01, 0.1, 0.5, 1.0].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVolume(Math.min(v, maxVolume))}
                className="px-3 py-1 bg-slate-800/50 hover:bg-slate-800 text-slate-400 text-xs rounded border border-slate-700/30 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Stop Loss */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              <label className="text-xs text-slate-400">Stop Loss</label>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useStopLoss}
                onChange={(e) => setUseStopLoss(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          {useStopLoss && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                type="number"
                value={stopLossValue}
                onChange={(e) => setStopLossValue(parseFloat(e.target.value) || 0)}
                min="1"
                step="1"
                className="w-full bg-slate-800/50 border border-red-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="Valor em USD"
              />
              <div className="text-xs text-slate-500 mt-1">
                Perda máxima: ${stopLossValue.toFixed(2)}
              </div>
            </motion.div>
          )}
        </div>

        {/* Take Profit */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              <label className="text-xs text-slate-400">Take Profit</label>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useTakeProfit}
                onChange={(e) => setUseTakeProfit(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {useTakeProfit && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                type="number"
                value={takeProfitValue}
                onChange={(e) => setTakeProfitValue(parseFloat(e.target.value) || 0)}
                min="1"
                step="1"
                className="w-full bg-slate-800/50 border border-green-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                placeholder="Valor em USD"
              />
              <div className="text-xs text-slate-500 mt-1">
                Lucro alvo: ${takeProfitValue.toFixed(2)}
              </div>
            </motion.div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={volume <= 0 || volume > maxVolume}
          className={`w-full py-4 rounded-lg font-bold text-sm transition-all ${
            orderType === 'BUY'
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
              : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-opacity-100`}
        >
          Abrir Ordem {orderType} {volume} Lote(s)
        </button>

        {/* Warning */}
        {volume > maxVolume && (
          <div className="text-xs text-red-400 text-center">
            Volume excede margem disponível
          </div>
        )}
      </form>
    </div>
  );
}
