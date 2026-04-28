/**
 * 🎛️ DEBUG TOOLBAR
 * 
 * Barra de ferramentas flutuante para controlar debug panels
 */

import React from 'react';
import { Settings, Eye, EyeOff, Activity, TestTube } from 'lucide-react';
import { useDebug } from './DebugController';

export const DebugToolbar: React.FC = () => {
  const {
    debugState,
    toggleBinanceComparison,
    toggleUnifiedMarketTester,
    toggleMasterDebug,
    hideAll
  } = useDebug();

  // Se master debug estiver desabilitado, não mostrar nada
  if (!debugState.masterEnabled) {
    return (
      <button
        onClick={toggleMasterDebug}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110"
        title="Ativar Debug (Ctrl+Shift+D)"
      >
        <Settings className="w-5 h-5 text-slate-400" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="w-5 h-5 text-cyan-400" />
        <h3 className="text-white font-bold">Debug Tools</h3>
        <button
          onClick={toggleMasterDebug}
          className="ml-auto text-slate-400 hover:text-red-400 transition-colors"
          title="Fechar (Ctrl+Shift+D)"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {/* Binance Comparison */}
        <button
          onClick={toggleBinanceComparison}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
            debugState.binanceComparison
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-sm font-bold">Binance Comparison</span>
          {debugState.binanceComparison && (
            <Eye className="w-4 h-4 ml-auto" />
          )}
        </button>

        {/* Unified Market Tester */}
        <button
          onClick={toggleUnifiedMarketTester}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
            debugState.unifiedMarketTester
              ? 'bg-purple-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <TestTube className="w-4 h-4" />
          <span className="text-sm font-bold">Market Data Tester</span>
          {debugState.unifiedMarketTester && (
            <Eye className="w-4 h-4 ml-auto" />
          )}
        </button>

        {/* Hide All */}
        <button
          onClick={hideAll}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all text-sm font-bold mt-4"
        >
          <EyeOff className="w-4 h-4" />
          Ocultar Todos
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Atalho: <span className="text-cyan-400 font-mono">Ctrl+Shift+D</span>
        </p>
      </div>
    </div>
  );
};
