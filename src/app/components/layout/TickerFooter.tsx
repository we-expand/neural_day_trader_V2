import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, ChevronUp } from 'lucide-react';

interface TickerItem {
  symbol: string;
  change: number;
  price: number;
}

const ITEMS: TickerItem[] = [
  { symbol: 'BTCUSD', change: 1.51, price: 92104.1 },
  { symbol: 'ETHUSD', change: 1.20, price: 3128.75 },
  { symbol: 'SOLUSD', change: -0.28, price: 145.83 },
  { symbol: 'XAUUSD', change: 0.45, price: 2341.20 },
  { symbol: 'US500', change: 0.89, price: 5234.50 },
  { symbol: 'EURUSD', change: -0.12, price: 1.0845 },
  { symbol: 'GBPUSD', change: 0.05, price: 1.2678 },
  { symbol: 'USDJPY', change: 0.34, price: 151.23 },
  { symbol: 'BTCZ25', change: 1.79, price: 92250.0 },
  { symbol: 'US100', change: 1.12, price: 18450.2 },
  { symbol: 'BCHUSD', change: 6.32, price: 607.50 },
  { symbol: 'DOGEUSD', change: -1.65, price: 0.12597 },
  { symbol: 'XAGUSD', change: 1.15, price: 28.45 },
  { symbol: 'WTI', change: -0.56, price: 82.34 },
  { symbol: 'XRPUSD', change: -0.45, price: 0.5123 },
  { symbol: 'ADAUSD', change: 2.10, price: 0.456 },
  { symbol: 'GER40', change: 0.67, price: 18120.5 },
  { symbol: 'AVAXUSD', change: -1.2, price: 34.50 },
  { symbol: 'DOTUSD', change: 3.45, price: 7.23 },
  { symbol: 'LINKUSD', change: 1.23, price: 14.56 },
  { symbol: 'LTCUSD', change: -0.89, price: 85.40 },
  { symbol: 'MATICUSD', change: 0.45, price: 0.789 },
];

export function TickerFooter({ onAssetClick }: { onAssetClick: (symbol: string) => void }) {
  // We duplicate items to create seamless loop
  const tickerItems = [...ITEMS, ...ITEMS, ...ITEMS, ...ITEMS];

  return (
    <div className="h-7 bg-black border-t border-white/10 flex items-center text-[10px] font-mono select-none z-50 shrink-0 relative w-full">
      {/* Online Status */}
      <div className="px-3 flex items-center gap-2 border-r border-white/10 h-full bg-black z-20 shadow-[2px_0_10px_rgba(0,0,0,0.5)] shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        <span className="text-emerald-500 font-bold uppercase tracking-wider">Online</span>
      </div>

      {/* Ticker Content */}
      <div className="flex-1 overflow-hidden relative flex items-center h-full group">
         {/* Gradient Masks */}
         <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
         <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>

         <motion.div 
           className="flex items-center gap-8 whitespace-nowrap pl-6"
           animate={{ x: ["0%", "-50%"] }}
           transition={{ 
             duration: 60, 
             repeat: Infinity, 
             ease: "linear" 
           }}
         >
           {tickerItems.map((item, i) => (
             <div 
               key={`${item.symbol}-${i}`} 
               onClick={() => onAssetClick(item.symbol)}
               className="flex items-center gap-1.5 hover:bg-white/10 px-2 py-0.5 rounded transition-colors cursor-pointer group/item"
             >
               <span className="font-bold text-slate-300 group-hover/item:text-white">{item.symbol}</span>
               <span className={item.change >= 0 ? "text-emerald-400" : "text-red-400"}>
                 {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
               </span>
               <span className="text-slate-500 group-hover/item:text-slate-400">{item.price}</span>
             </div>
           ))}
         </motion.div>
      </div>

      {/* Trollbox */}
      <div className="px-3 flex items-center gap-2 border-l border-white/10 h-full hover:bg-white/5 cursor-pointer transition-colors bg-black z-20 shadow-[-2px_0_10px_rgba(0,0,0,0.5)]">
        <MessageSquare className="w-3 h-3 text-slate-400" />
        <span className="font-bold text-slate-300">Chat Global</span>
        <span className="text-slate-500">(206)</span>
        <ChevronUp className="w-3 h-3 text-slate-600" />
      </div>
    </div>
  );
}
