/**
 * 📊 DATA QUALITY BADGE
 * 
 * Badge compacto mostrando a qualidade dos dados de um símbolo.
 * Usado no MarketScoreBoard e outros componentes.
 */

import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { dataQualityMonitor, type ValidationResult } from '@/app/services/DataQualityMonitor';

interface DataQualityBadgeProps {
  symbol: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function DataQualityBadge({ symbol, showDetails = true, compact = false }: DataQualityBadgeProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Validar ao montar
    validateSymbol();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(validateSymbol, 30000);
    
    return () => clearInterval(interval);
  }, [symbol]);

  const validateSymbol = async () => {
    setLoading(true);
    try {
      const result = await dataQualityMonitor.validateSymbol(symbol);
      setValidation(result);
    } catch (error) {
      console.error('[DataQualityBadge] Erro ao validar:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!validation) {
    if (loading) {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></div>
          {!compact && <span>Validando...</span>}
        </div>
      );
    }
    return null;
  }

  const getIcon = () => {
    switch (validation.status) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="w-3 h-3" />;
      case 'acceptable':
        return <Info className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      case 'critical':
        return <XCircle className="w-3 h-3" />;
    }
  };

  const getColor = () => {
    switch (validation.status) {
      case 'excellent':
      case 'good':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'acceptable':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
    }
  };

  const getSourceColor = () => {
    switch (validation.primary.source) {
      case 'binance':
        return 'text-yellow-400';
      case 'metaapi':
        return 'text-blue-400';
      case 'yahoo':
        return 'text-purple-400';
      case 'trading_economics':
        return 'text-green-400';
      case 'fallback':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${getColor()}`}
        title={validation.recommendation}
      >
        {getIcon()}
        <span className="uppercase font-medium">{validation.primary.source}</span>
        {validation.discrepancy > 0 && (
          <span className="opacity-70">±{validation.discrepancy.toFixed(1)}%</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border text-xs ${getColor()}`}>
        {getIcon()}
        <span className="font-medium uppercase">{validation.status}</span>
        <span className={`opacity-70 ${getSourceColor()}`}>
          {validation.primary.source}
        </span>
      </div>
      
      {showDetails && (
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between text-slate-400">
            <span>Confiança:</span>
            <span className="text-white font-medium">{validation.confidence}%</span>
          </div>
          
          {validation.discrepancy > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Discrepância:</span>
              <span className={validation.discrepancy > 5 ? 'text-yellow-400' : 'text-white'}>
                {validation.discrepancy.toFixed(2)}%
              </span>
            </div>
          )}
          
          {validation.alternative && (
            <div className="flex justify-between text-slate-400">
              <span>Fonte Alt:</span>
              <span className={getSourceColor()}>
                {validation.alternative.source}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
