/**
 * 📊 ORDERS PANEL
 * Lista de ordens abertas com P&L em tempo real
 */

import React, { useState } from 'react';
import { useSimulator } from '@/app/contexts/SimulatorContext';
import { TrendingUp, TrendingDown, X, DollarSign, Clock, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function OrdersPanel() {
  const { openOrders, closeOrder } = useSimulator();
  const [confirmingClose, setConfirmingClose] = useState<string | null>(null);

  const handleCloseOrder = (orderId: string) => {
    closeOrder(orderId, 'MANUAL');
    setConfirmingClose(null);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Ordens Ativas</h3>
            <p className="text-xs text-slate-400">
              {openOrders.length} {openOrders.length === 1 ? 'ordem aberta' : 'ordens abertas'}
            </p>
          </div>
        </div>

        {/* Total Open P&L */}
        {openOrders.length > 0 && (
          <div className={`px-4 py-2 rounded-lg ${
            openOrders.reduce((sum, o) => sum + (o.pnl || 0), 0) >= 0
              ? 'bg-green-500/20 border border-green-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            <div className="text-xs text-slate-400 mb-1">Total P&L</div>
            <div className={`font-bold ${
              openOrders.reduce((sum, o) => sum + (o.pnl || 0), 0) >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }`}>
              {openOrders.reduce((sum, o) => sum + (o.pnl || 0), 0) >= 0 ? '+' : ''}
              ${openOrders.reduce((sum, o) => sum + (o.pnl || 0), 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {openOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart2 className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">Nenhuma ordem aberta</p>
              <p className="text-slate-600 text-xs mt-1">
                Abra sua primeira ordem para começar!
              </p>
            </motion.div>
          ) : (
            openOrders.map((order, index) => {
              const isProfitable = (order.pnl || 0) >= 0;
              const isConfirming = confirmingClose === order.id;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative bg-slate-800/50 rounded-lg p-4 border ${
                    isProfitable
                      ? 'border-green-500/30 hover:border-green-500/50'
                      : 'border-red-500/30 hover:border-red-500/50'
                  } transition-all`}
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {/* Type Badge */}
                      <div className={`px-3 py-1 rounded-md text-xs font-bold ${
                        order.type === 'BUY'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {order.type}
                      </div>

                      {/* Symbol */}
                      <div>
                        <div className="font-bold text-white text-sm">{order.symbol}</div>
                        <div className="text-xs text-slate-400">
                          {order.volume} {order.volume === 1 ? 'lote' : 'lotes'}
                        </div>
                      </div>
                    </div>

                    {/* Close Button */}
                    {!isConfirming ? (
                      <button
                        onClick={() => setConfirmingClose(order.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
                        title="Fechar ordem"
                      >
                        <X className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCloseOrder(order.id)}
                          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded border border-red-500/30"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmingClose(null)}
                          className="px-3 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-400 text-xs rounded"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Open Price */}
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Abertura</div>
                      <div className="text-sm font-mono text-white">
                        ${order.openPrice.toFixed(5)}
                      </div>
                    </div>

                    {/* Current Price */}
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Atual</div>
                      <div className="text-sm font-mono text-white flex items-center gap-1">
                        ${(order.currentPrice || order.openPrice).toFixed(5)}
                        {isProfitable ? (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                    </div>

                    {/* P&L */}
                    <div>
                      <div className="text-xs text-slate-400 mb-1">P&L</div>
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
                  </div>

                  {/* SL/TP Info */}
                  {(order.stopLoss || order.takeProfit) && (
                    <div className="mt-3 pt-3 border-t border-slate-700/30 flex gap-4 text-xs">
                      {order.stopLoss && (
                        <div className="flex items-center gap-1 text-red-400">
                          <span className="text-slate-400">SL:</span>
                          <span className="font-mono">${order.stopLoss.toFixed(2)}</span>
                        </div>
                      )}
                      {order.takeProfit && (
                        <div className="flex items-center gap-1 text-green-400">
                          <span className="text-slate-400">TP:</span>
                          <span className="font-mono">${order.takeProfit.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Time */}
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>
                      Aberta há {Math.floor((Date.now() - order.openTime.getTime()) / 60000)} min
                    </span>
                  </div>

                  {/* P&L Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full h-1 bg-slate-700/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(Math.abs(order.pnlPercentage || 0), 100)}%` }}
                        className={`h-full ${
                          isProfitable
                            ? 'bg-gradient-to-r from-green-500 to-green-400'
                            : 'bg-gradient-to-r from-red-500 to-red-400'
                        }`}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
