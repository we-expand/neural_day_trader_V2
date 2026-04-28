import React from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface PrecisionIndicatorProps {
  discrepancy?: number;
  source: 'ticker' | 'candle';
  dataAge?: number; // em milissegundos
  className?: string;
}

/**
 * 🎯 Indicador Visual de Precisão Profissional
 * 
 * Mostra se os dados estão com precisão aceitável (< 0.05%)
 */
export function PrecisionIndicator({ discrepancy, source, dataAge, className = '' }: PrecisionIndicatorProps) {
  // Determinar nível de precisão
  const isProfessional = !discrepancy || discrepancy < 0.05;
  const isAcceptable = discrepancy && discrepancy < 0.10;
  const isRealTime = source === 'ticker';
  const isStale = dataAge && dataAge > 60000; // Mais de 1 minuto
  
  // Cor baseada na precisão
  let statusColor = 'emerald'; // Profissional
  let statusText = 'PROFISSIONAL';
  let StatusIcon = CheckCircle2;
  
  if (!isProfessional && isAcceptable) {
    statusColor = 'yellow';
    statusText = 'ACEITÁVEL';
    StatusIcon = Activity;
  } else if (!isAcceptable) {
    statusColor = 'rose';
    statusText = 'IMPRECISO';
    StatusIcon = AlertTriangle;
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Indicador de Fonte */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
        isRealTime
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
      }`}>
        <div className={`w-1 h-1 rounded-full ${isRealTime ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
        {isRealTime ? 'Real-Time' : 'Delayed'}
      </div>
      
      {/* Indicador de Precisão (só mostra se tiver discrepância) */}
      {discrepancy !== undefined && (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider bg-${statusColor}-500/10 border-${statusColor}-500/20 text-${statusColor}-400`}>
          <StatusIcon className="w-3 h-3" />
          {statusText}
          <span className="text-[9px] opacity-70">
            ({discrepancy.toFixed(3)}%)
          </span>
        </div>
      )}
      
      {/* Alerta de dados antigos */}
      {isStale && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 border-orange-500/20 text-orange-400">
          <AlertTriangle className="w-3 h-3" />
          Atrasado ({Math.floor((dataAge || 0) / 1000)}s)
        </div>
      )}
    </div>
  );
}

/**
 * 🎯 Indicador Compacto (para cards pequenos)
 */
export function PrecisionBadge({ discrepancy }: { discrepancy?: number }) {
  if (!discrepancy) return null;
  
  const isProfessional = discrepancy < 0.05;
  
  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
      isProfessional
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-yellow-500/10 text-yellow-400'
    }`}>
      {isProfessional ? '🎯' : '⚠️'}
      {discrepancy.toFixed(3)}%
    </div>
  );
}
