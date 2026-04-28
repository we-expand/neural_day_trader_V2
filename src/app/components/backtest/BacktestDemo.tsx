/**
 * 🧪 BACKTEST DEMO
 * 
 * Componente de demonstração do sistema de Backtest/Replay
 * Útil para testar a funcionalidade de forma isolada
 */

import React from 'react';
import { BacktestReplayBar } from './BacktestReplayBar';

export function BacktestDemo() {
  const [showReplay, setShowReplay] = React.useState(true);

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Área do "gráfico" simulado */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            📊 Gráfico Bitcoin
          </h1>
          <p className="text-slate-400 mb-8">
            Área onde o gráfico será renderizado durante o replay
          </p>
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 inline-block">
            <p className="text-sm text-slate-500 mb-2">Status:</p>
            <p className="text-lg font-mono text-emerald-400">
              Aguardando dados do replay...
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Replay */}
      {showReplay && (
        <BacktestReplayBar
          onClose={() => setShowReplay(false)}
          onCandleChange={(candle) => {
            console.log('📊 [DEMO] Candle recebido:', {
              time: new Date(candle.time).toLocaleString(),
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume
            });
          }}
        />
      )}
    </div>
  );
}
