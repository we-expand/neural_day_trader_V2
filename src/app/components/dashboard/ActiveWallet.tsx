import React from 'react';
import { useTradingContext } from '../../contexts/TradingContext';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, TrendingDown, TrendingUp, X } from 'lucide-react';

export function ActiveWallet() {
  const { activeOrders, status } = useTradingContext();

  if (activeOrders.length === 0) return null;

  return (
    <div className="flex flex-col border-b border-white/10 bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="p-3 border-b border-white/5 flex items-center justify-between bg-[#0f0f11]">
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
            Carteira Ativa ({activeOrders.length})
            </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400 font-bold uppercase tracking-wide animate-pulse">
            <ShieldCheck className="w-3 h-3" />
            <span>Risco: ON</span>
        </div>
      </div>

      {/* LISTA DE ORDENS */}
      <div className="flex flex-col max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <AnimatePresence initial={false}>
            {activeOrders.map((order) => {
                const currentPrice = order.currentPrice || order.price;
                const pnlPercent = order.side === 'LONG' 
                    ? (currentPrice - order.price) / order.price 
                    : (order.price - currentPrice) / order.price;
                
                const pnlValue = order.amount * pnlPercent * order.leverage;
                const isProfit = pnlValue >= 0;

                return (
                    <motion.div
                        key={order.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors group relative"
                    >
                        {/* ROW 1: Direction & Asset */}
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    order.side === 'LONG' 
                                    ? 'bg-emerald-500/20 text-emerald-400' 
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                    {order.side === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {order.side === 'LONG' ? 'COMPRADO' : 'VENDIDO'}
                                </span>
                                <span className="text-xs font-bold text-white font-mono">{order.symbol.replace('USDT', '/USD')}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">lev {(order.leverage || 0).toFixed(1)}x</span>
                        </div>

                        {/* ROW 2: Entry & Size */}
                        <div className="flex justify-between items-center mb-2 px-0.5">
                            <div className="text-[10px] text-slate-400 font-mono">
                                <span className="opacity-50 mr-1">Entry:</span>
                                ${(order.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                                <span className="opacity-50 mr-1">Size:</span>
                                ${(order.amount || 0).toFixed(2)}
                            </div>
                        </div>

                        {/* ROW 3: PnL Big Display */}
                        <div className={`flex items-baseline justify-between rounded px-2 py-1 ${
                            isProfit ? 'bg-emerald-500/5' : 'bg-red-500/5'
                        }`}>
                            <span className={`text-xs font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isProfit ? '+' : ''}{(pnlPercent * 100 * (order.leverage || 1)).toFixed(2)}%
                            </span>
                            <span className={`text-sm font-bold tracking-tight font-mono ${isProfit ? 'text-emerald-300' : 'text-red-300'}`}>
                                {isProfit ? '+' : ''}${pnlValue.toFixed(2)}
                            </span>
                        </div>

                        {/* Hover Action (Close) - Visual Only for now */}
                        <button className="absolute top-2 right-2 p-1 text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                        </button>
                    </motion.div>
                );
            })}
        </AnimatePresence>
      </div>
    </div>
  );
}
