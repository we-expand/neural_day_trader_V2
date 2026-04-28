/**
 * 🏷️ ASSET PRICE TAG - Componente para mostrar preço e variação
 */

import React from 'react';
import { useMarketData } from '@/app/hooks/useMarketData';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AssetPriceTagProps {
  symbol: string;
  compact?: boolean;
}

export function AssetPriceTag({ symbol, compact = false }: AssetPriceTagProps) {
  const { data, loading } = useMarketData(symbol, {
    updateInterval: 15000,
    realTime: false
  });
  
  if (loading || !data) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-12 h-3 bg-neutral-700 animate-pulse rounded"></div>
      </div>
    );
  }
  
  const isPositive = data.changePercent > 0;
  const isNegative = data.changePercent < 0;
  const isNeutral = Math.abs(data.changePercent) < 0.01;
  
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono text-white">
          ${data.price.toFixed(symbol.includes('JPY') ? 2 : 4)}
        </span>
        <span className={`text-[9px] font-mono ${
          isPositive ? 'text-emerald-400' :
          isNegative ? 'text-red-400' :
          'text-neutral-500'
        }`}>
          {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
        </span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-bold text-white">
          ${data.price.toLocaleString(undefined, { 
            minimumFractionDigits: symbol.includes('JPY') ? 2 : 4,
            maximumFractionDigits: symbol.includes('JPY') ? 2 : 4
          })}
        </span>
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
          isPositive ? 'bg-emerald-500/10 text-emerald-400' :
          isNegative ? 'bg-red-500/10 text-red-400' :
          'bg-neutral-700/50 text-neutral-400'
        }`}>
          {isPositive && <TrendingUp className="w-3 h-3" />}
          {isNegative && <TrendingDown className="w-3 h-3" />}
          {isNeutral && <Minus className="w-3 h-3" />}
          <span>{isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%</span>
        </div>
      </div>
      <div className="text-[9px] text-neutral-500 font-mono">
        {data.change >= 0 ? '+' : ''}{data.change.toFixed(symbol.includes('JPY') ? 2 : 4)} hoje
      </div>
    </div>
  );
}

// Componente para lista de ativos (mais compacto)
export function AssetListItem({ symbol, name, icon }: { symbol: string; name: string; icon?: string }) {
  const { data, loading } = useMarketData(symbol, {
    updateInterval: 15000,
    realTime: false
  });
  
  if (loading || !data) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-neutral-700"></div>
          <div>
            <div className="w-16 h-3 bg-neutral-700 rounded mb-1"></div>
            <div className="w-24 h-2 bg-neutral-700 rounded"></div>
          </div>
        </div>
        <div className="w-20 h-4 bg-neutral-700 rounded"></div>
      </div>
    );
  }
  
  const isPositive = data.changePercent > 0;
  const isNegative = data.changePercent < 0;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 hover:bg-neutral-800/50 transition-all border border-transparent hover:border-neutral-700">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-neutral-700/50 flex items-center justify-center text-lg">
          {icon || '💹'}
        </div>
        <div>
          <div className="font-bold text-sm text-white">{symbol}</div>
          <div className="text-xs text-neutral-500">{name}</div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="font-mono text-sm font-bold text-white">
          ${data.price.toLocaleString(undefined, { 
            minimumFractionDigits: 2,
            maximumFractionDigits: symbol.includes('JPY') ? 2 : 4
          })}
        </div>
        <div className={`flex items-center gap-1 justify-end text-xs font-mono font-bold ${
          isPositive ? 'text-emerald-400' :
          isNegative ? 'text-red-400' :
          'text-neutral-400'
        }`}>
          {data.signal}
          <span>{isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}
