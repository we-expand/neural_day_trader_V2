/**
 * ⚙️ QUICK SETTINGS: Configuração Rápida de Valores
 * 
 * Permite ajustar manualmente os valores de fallback diretamente da interface
 */

import React, { useState } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { updateFallbackData } from '@/app/utils/spxRealDataProvider';
import { toast } from 'sonner';

interface QuickSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSettings({ isOpen, onClose }: QuickSettingsProps) {
  // Estado dos valores
  const [spx500, setSpx500] = useState({ value: 6020.00, changePercent: -0.25 });  // ✅ CORRIGIDO
  const [xauusd, setXauusd] = useState({ value: 2623.45, changePercent: -0.47 });
  const [eurusd, setEurusd] = useState({ value: 1.0345, changePercent: -0.22 });

  const handleSave = () => {
    // Calcular change a partir do changePercent
    const spxChange = (spx500.value * spx500.changePercent) / 100;
    const xauChange = (xauusd.value * xauusd.changePercent) / 100;
    const eurChange = (eurusd.value * eurusd.changePercent) / 100;

    // Atualizar fallback
    updateFallbackData('SPX500', {
      value: spx500.value,
      change: spxChange,
      changePercent: spx500.changePercent,
    });

    updateFallbackData('XAUUSD', {
      value: xauusd.value,
      change: xauChange,
      changePercent: xauusd.changePercent,
    });

    updateFallbackData('EURUSD', {
      value: eurusd.value,
      change: eurChange,
      changePercent: eurusd.changePercent,
    });

    toast.success('✅ Valores atualizados com sucesso!');
    onClose();
    
    // Forçar reload da página para aplicar novos valores
    setTimeout(() => window.location.reload(), 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-[#131722] rounded-xl border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">
              ⚙️ Configuração Rápida
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-300">
            ⚠️ <strong>IMPORTANTE:</strong> Copie os valores exatos do seu MetaTrader 5!
          </div>

          {/* SPX500 */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">
              📊 S&P 500 (SPX500)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Preço</div>
                <input
                  type="number"
                  step="0.01"
                  value={spx500.value}
                  onChange={(e) => setSpx500({ ...spx500, value: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Variação %</div>
                <input
                  type="number"
                  step="0.01"
                  value={spx500.changePercent}
                  onChange={(e) => setSpx500({ ...spx500, changePercent: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Ex: Se o MT5 mostra <span className="text-white font-mono">68,862.00</span> e <span className="text-red-400 font-mono">-1.20%</span>,
              digite: <span className="text-emerald-400 font-mono">6886.20</span> e <span className="text-red-400 font-mono">-1.20</span>
            </div>
          </div>

          {/* XAUUSD */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">
              🥇 Ouro (XAUUSD)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Preço</div>
                <input
                  type="number"
                  step="0.01"
                  value={xauusd.value}
                  onChange={(e) => setXauusd({ ...xauusd, value: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Variação %</div>
                <input
                  type="number"
                  step="0.01"
                  value={xauusd.changePercent}
                  onChange={(e) => setXauusd({ ...xauusd, changePercent: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* EURUSD */}
          <div>
            <label className="block text-sm font-bold text-white mb-2">
              💱 EUR/USD
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Preço</div>
                <input
                  type="number"
                  step="0.0001"
                  value={eurusd.value}
                  onChange={(e) => setEurusd({ ...eurusd, value: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Variação %</div>
                <input
                  type="number"
                  step="0.01"
                  value={eurusd.changePercent}
                  onChange={(e) => setEurusd({ ...eurusd, changePercent: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors font-bold text-sm"
          >
            <Save className="w-4 h-4" />
            Salvar e Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}