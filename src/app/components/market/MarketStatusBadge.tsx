import React from 'react';
import { getMarketStatus, getMarketStatusEmoji, getMarketStatusText, getMarketStatusColor, type MarketStatus } from '@/utils/marketHours';

interface MarketStatusBadgeProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

/**
 * 🟢 MARKET STATUS BADGE
 * 
 * Exibe status do mercado (ABERTO/FECHADO) para um ativo
 */
export function MarketStatusBadge({ symbol, size = 'sm', showText = true }: MarketStatusBadgeProps) {
  const marketInfo = getMarketStatus(symbol);
  const emoji = getMarketStatusEmoji(marketInfo.status);
  const text = getMarketStatusText(marketInfo.status);
  const colorClass = getMarketStatusColor(marketInfo.status);
  
  // Tamanhos
  const sizes = {
    sm: {
      container: 'px-1.5 py-0.5 text-[9px]',
      emoji: 'text-[10px]',
    },
    md: {
      container: 'px-2 py-1 text-[10px]',
      emoji: 'text-[12px]',
    },
    lg: {
      container: 'px-3 py-1.5 text-xs',
      emoji: 'text-sm',
    },
  };
  
  const sizeClasses = sizes[size];
  
  return (
    <div 
      className={`inline-flex items-center gap-1 ${sizeClasses.container} bg-black/30 border border-white/10 rounded font-bold uppercase tracking-wider`}
      title={`${text} | ${marketInfo.timezone}`}
    >
      <span className={sizeClasses.emoji}>{emoji}</span>
      {showText && (
        <span className={colorClass}>{text}</span>
      )}
    </div>
  );
}
