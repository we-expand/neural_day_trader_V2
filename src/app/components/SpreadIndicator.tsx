/**
 * 📊 INDICADOR DE SPREAD
 * 
 * Exibe spread aplicado em modo DEMO de forma transparente
 */

import { Info } from 'lucide-react';
import { getSpread, pipsToDecimal } from '@/config/spreads';

interface SpreadIndicatorProps {
  symbol: string;
  mode: 'DEMO' | 'LIVE';
  className?: string;
}

export function SpreadIndicator({ symbol, mode, className = '' }: SpreadIndicatorProps) {
  // Modo LIVE usa spreads do broker
  if (mode === 'LIVE') {
    return (
      <div className={`flex items-center gap-1 text-xs text-gray-500 ${className}`}>
        <Info className="w-3 h-3" />
        <span>Spread: Real (Broker)</span>
      </div>
    );
  }

  // Modo DEMO mostra spread simulado
  const spreadPips = getSpread(symbol);
  const spreadDecimal = pipsToDecimal(symbol, spreadPips);
  
  if (spreadPips === 0) {
    return (
      <div className={`flex items-center gap-1 text-xs text-yellow-500 ${className}`}>
        <Info className="w-3 h-3" />
        <span>Spread: N/A</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-xs text-blue-500 ${className}`}>
      <Info className="w-3 h-3" />
      <span>Spread: {spreadPips} pips ({(spreadDecimal * 100).toFixed(4)}%)</span>
    </div>
  );
}

/**
 * Componente mais compacto - apenas o valor
 */
export function SpreadBadge({ symbol, mode }: { symbol: string; mode: 'DEMO' | 'LIVE' }) {
  if (mode === 'LIVE') {
    return <span className="text-xs text-gray-400">Spread Real</span>;
  }

  const spreadPips = getSpread(symbol);
  
  if (spreadPips === 0) return null;

  return (
    <span className="text-xs text-blue-400">
      {spreadPips} pips
    </span>
  );
}
