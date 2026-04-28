/**
 * 📊 DATA SOURCE INDICATOR
 * 
 * Mostra de forma discreta qual fonte de dados está sendo usada
 * e alerta quando está usando dados simulados
 */

import { useState, useEffect } from 'react';
import { Database, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { useMarketContext } from '@/app/contexts/MarketContext';

export function DataSourceIndicator() {
  const { marketState } = useMarketContext();
  const [dataSource, setDataSource] = useState<'real' | 'simulated'>('real');
  const [sourceDetails, setSourceDetails] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    // Verifica se há credenciais MT5 configuradas
    const hasMT5 = localStorage.getItem('mt5_token') && localStorage.getItem('mt5_account_id');
    
    if (hasMT5) {
      setDataSource('real');
      setSourceDetails('MetaApi + Binance + S&P Global');
    } else {
      setDataSource('simulated');
      setSourceDetails('Dados Simulados (Configure MT5 para dados reais)');
    }
  }, [marketState]);
  
  // Não mostrar nada se estiver usando dados reais
  if (dataSource === 'real') {
    return (
      <div className="fixed top-20 right-4 z-40">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wide">
              Dados Reais
            </span>
          </div>
        </div>
      </div>
    );
  }
  
  // Alerta discreto mas visível para dados simulados
  return (
    <div className="fixed top-20 right-4 z-40">
      <div 
        className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm cursor-pointer hover:bg-amber-500/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="text-[10px] font-medium text-amber-300 uppercase tracking-wide">
            Modo Demo
          </span>
        </div>
        
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-amber-500/20">
            <p className="text-[9px] text-amber-200/80 max-w-[200px]">
              {sourceDetails}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
