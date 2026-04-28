/**
 * 📜 TRADE HISTORY
 * Histórico de trades fechados com filtros e estatísticas
 */

import React, { useState, useMemo } from 'react';
import { useSimulator } from '@/app/contexts/SimulatorContext';
import { History, TrendingUp, TrendingDown, Filter, Download, X } from 'lucide-react';
import { motion } from 'motion/react';

type FilterType = 'ALL' | 'WINNERS' | 'LOSERS';

export function TradeHistory() {
  const { closedOrders, stats } = useSimulator();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Filtrar ordens
  const filteredOrders = useMemo(() => {
    switch (filter) {
      case 'WINNERS':
        return closedOrders.filter(o => (o.pnl || 0) > 0);
      case 'LOSERS':
        return closedOrders.filter(o => (o.pnl || 0) < 0);
      default:
        return closedOrders;
    }
  }, [closedOrders, filter]);

  // Export para CSV
  const exportToCSV = () => {
    const headers = ['ID', 'Símbolo', 'Tipo', 'Volume', 'Abertura', 'Fechamento', 'P&L', 'P&L%', 'Duração', 'Motivo'];
    const rows = closedOrders.map(order => [
      order.id,
      order.symbol,
      order.type,
      order.volume,
      order.openPrice.toFixed(5),
      (order.closePrice || 0).toFixed(5),
      (order.pnl || 0).toFixed(2),
      (order.pnlPercentage || 0).toFixed(2),
      order.closeTime && order.openTime 
        ? `${Math.floor((order.closeTime.getTime() - order.openTime.getTime()) / 60000)} min`
        : 'N/A',
      order.closeReason || 'MANUAL'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <History className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Histórico de Trades</h3>
            <p className="text-xs text-slate-400">
              {closedOrders.length} {closedOrders.length === 1 ? 'trade fechado' : 'trades fechados'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Export Button */}
          {closedOrders.length > 0 && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-500/30"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {closedOrders.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Todos ({closedOrders.length})
            </button>
            <button
              onClick={() => setFilter('WINNERS')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'WINNERS'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Ganhos ({stats.winningTrades})
            </button>
            <button
              onClick={() => setFilter('LOSERS')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'LOSERS'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Perdas ({stats.losingTrades})
            </button>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 text-sm">
              {closedOrders.length === 0 
                ? 'Nenhum trade fechado ainda' 
                : 'Nenhum trade neste filtro'}
            </p>
            <p className="text-slate-600 text-xs mt-1">
              {closedOrders.length === 0 
                ? 'Feche sua primeira ordem para ver o histórico' 
                : 'Tente outro filtro'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order, index) => {
            const isProfitable = (order.pnl || 0) >= 0;
            const isExpanded = expandedOrder === order.id;
            const duration = order.closeTime && order.openTime
              ? Math.floor((order.closeTime.getTime() - order.openTime.getTime()) / 60000)
              : 0;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`bg-slate-800/30 rounded-lg p-3 border ${
                  isProfitable
                    ? 'border-green-500/20 hover:border-green-500/40'
                    : 'border-red-500/20 hover:border-red-500/40'
                } transition-all cursor-pointer`}
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              >
                {/* Compact View */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Type Badge */}
                    <div className={`px-2 py-1 rounded text-xs font-bold ${
                      order.type === 'BUY'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {order.type}
                    </div>

                    {/* Symbol */}
                    <div className="text-sm font-bold text-white">
                      {order.symbol}
                    </div>

                    {/* Volume */}
                    <div className="text-xs text-slate-400">
                      {order.volume} {order.volume === 1 ? 'lote' : 'lotes'}
                    </div>

                    {/* Duration */}
                    <div className="text-xs text-slate-500">
                      {duration} min
                    </div>

                    {/* Close Reason */}
                    {order.closeReason && order.closeReason !== 'MANUAL' && (
                      <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {order.closeReason === 'STOP_LOSS' && 'SL'}
                        {order.closeReason === 'TAKE_PROFIT' && 'TP'}
                        {order.closeReason === 'TRAILING_STOP' && 'TS'}
                      </div>
                    )}
                  </div>

                  {/* P&L */}
                  <div className="text-right">
                    <div className={`text-sm font-bold ${
                      isProfitable ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {isProfitable ? '+' : ''}${(order.pnl || 0).toFixed(2)}
                    </div>
                    <div className={`text-xs ${
                      isProfitable ? 'text-green-400/70' : 'text-red-400/70'
                    }`}>
                      ({isProfitable ? '+' : ''}{(order.pnlPercentage || 0).toFixed(2)}%)
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <div className={`ml-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    {isProfitable ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>

                {/* Expanded View */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-slate-700/30"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-slate-400 mb-1">Abertura</div>
                        <div className="font-mono text-white">${order.openPrice.toFixed(5)}</div>
                        <div className="text-slate-500 text-[10px]">
                          {order.openTime.toLocaleTimeString()}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 mb-1">Fechamento</div>
                        <div className="font-mono text-white">${(order.closePrice || 0).toFixed(5)}</div>
                        <div className="text-slate-500 text-[10px]">
                          {order.closeTime?.toLocaleTimeString()}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 mb-1">Variação</div>
                        <div className={`font-mono ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                          {((order.closePrice || 0) - order.openPrice).toFixed(5)}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 mb-1">ID</div>
                        <div className="font-mono text-slate-500 text-[10px]">
                          {order.id.slice(0, 12)}...
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Custom Scrollbar CSS */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
      `}</style>
    </div>
  );
}
