/**
 * 🎮 TRADING SIMULATOR
 * Componente principal que integra todos os componentes do simulador
 */

import React, { useEffect } from 'react';
import { useSimulator } from '@/app/contexts/SimulatorContext';
import { VirtualAccount } from './VirtualAccount';
import { OrderEntry } from './OrderEntry';
import { OrdersPanel } from './OrdersPanel';
import { TradeHistory } from './TradeHistory';
import { RefreshCw } from 'lucide-react';

interface TradingSimulatorProps {
  symbol: string;
  currentPrice: number;
}

export function TradingSimulator({ symbol, currentPrice }: TradingSimulatorProps) {
  const { updateOrderPrices, resetAccount } = useSimulator();

  // Atualizar preços das ordens quando o preço mudar
  useEffect(() => {
    if (currentPrice > 0) {
      updateOrderPrices(symbol, currentPrice);
    }
  }, [symbol, currentPrice, updateOrderPrices]);

  return (
    <div className="space-y-6">
      {/* Header com botão de reset */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Simulador de Trading</h2>
          <p className="text-sm text-slate-400 mt-1">
            Pratique trading sem risco com dinheiro virtual
          </p>
        </div>

        <button
          onClick={resetAccount}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm font-medium transition-colors border border-orange-500/30"
        >
          <RefreshCw className="w-4 h-4" />
          Resetar Conta
        </button>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Conta Virtual */}
        <div className="lg:col-span-2">
          <VirtualAccount />
        </div>

        {/* Coluna 2: Abrir Ordem */}
        <div>
          <OrderEntry symbol={symbol} currentPrice={currentPrice} />
        </div>
      </div>

      {/* Ordens Ativas */}
      <div>
        <OrdersPanel />
      </div>

      {/* Histórico */}
      <div>
        <TradeHistory />
      </div>
    </div>
  );
}
