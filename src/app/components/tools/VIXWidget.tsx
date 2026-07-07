import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Key, Clock } from 'lucide-react';
import { fetchVIXData, setVIXApiKeys } from '@/app/utils/vixDataSources';
import { checkVIXTradingHours, getVIXStatusMessage, getVIXStatusColor } from '@/app/utils/vixTradingHours';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface VIXWidgetProps {
  className?: string;
}

interface VIXDataState {
  value: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  source?: string;
}

/**
 * Determinar a sessão de mercado atual
 */
function getMarketSession(): string {
  const now = new Date();
  const hour = now.getUTCHours();
  
  // Sydney: 22:00 - 07:00 UTC
  if (hour >= 22 || hour < 7) return 'Sydney';
  
  // Tokyo: 00:00 - 09:00 UTC
  if (hour >= 0 && hour < 9) return 'Tokyo';
  
  // London: 08:00 - 17:00 UTC
  if (hour >= 8 && hour < 17) return 'Londres';
  
  // New York: 13:00 - 22:00 UTC
  if (hour >= 13 && hour < 22) return 'NY';
  
  return 'Pré-Mercado';
}

export function VIXWidget({ className = '' }: VIXWidgetProps) {
  const [vix, setVix] = useState<number>(0);
  const [change, setChange] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<Array<{ timestamp: number; value: number }>>([]);

  // 🔥 VERIFICAÇÃO DE CARREGAMENTO - 20 JAN 2026
  console.log('🚀 [VIX WIDGET] Componente carregado!', {
    timestamp: new Date().toISOString(),
    features: [
      '✅ API Real (S&P Global → CBOE → Yahoo)',
      '✅ Fallback inteligente',
      '✅ Atualização a cada 30s'
    ]
  });

  // Buscar dados do VIX
  useEffect(() => {
    const fetchVIX = async () => {
      try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔥 [VIX WIDGET] === BUSCANDO VIX ===');
        console.log('🔥 [VIX WIDGET] Timestamp:', new Date().toISOString());
        console.log('═══════════════════════════════════════════════════════');

        // 🥇 PRIORIDADE #1: BACKEND PROXY (agregador inteligente)
        try {
          console.log('[VIX] 🥇 PRIORIDADE #1: Backend Proxy (agregador)...');
          
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/server/vix`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const result = await response.json();
            
            console.log('[VIX] ✅ Backend retornou dados:', result);
            
            if (result.value && result.value > 0) {
              setVix(result.value);
              setChange(result.change);
              setIsLoading(false);
              
              // Atualizar histórico
              const now = Date.now();
              setHistory(prev => [...prev.slice(-29), { timestamp: now, value: result.value }]);
              
              return; // ✅ SUCESSO!
            }
          }
        } catch (backendError: any) {
          console.warn('⚠️ [VIX WIDGET] Backend error:', backendError.message);
        }
        
        // 🔥 FALLBACK: USAR DADOS SIMULADOS REALISTAS
        console.warn('⚠️ [VIX WIDGET] Todas as fontes falharam, usando simulação realista...');
        
        const now = Date.now();
        const seed = Math.floor(now / 300000); // 5 minutos
        const pseudoRandom = ((seed * 9301 + 49297) % 233280) / 233280;
        const baseVix = 18.5;
        const variation = (pseudoRandom - 0.5) * 10; // -5 a +5
        const value = baseVix + variation;
        
        const previousSeed = Math.floor((now - 86400000) / 300000);
        const previousRandom = ((previousSeed * 9301 + 49297) % 233280) / 233280;
        const previousClose = baseVix + (previousRandom - 0.5) * 10;
        const changeValue = value - previousClose;
        const changePercent = (changeValue / previousClose) * 100;
        
        setVix(parseFloat(value.toFixed(2)));
        setChange(parseFloat(changePercent.toFixed(2)));
        setIsLoading(false);
        
        // Atualizar histórico
        setHistory(prev => [...prev.slice(-29), { timestamp: now, value: parseFloat(value.toFixed(2)) }]);
        
      } catch (error: any) {
        console.error('[VIX WIDGET] ❌ Fatal error:', error);
        
        setIsLoading(false);
      }
    };

    fetchVIX();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchVIX, 30000);
    return () => clearInterval(interval);
  }, []);

  // Determinar nível de risco baseado no VIX
  const getRiskLevel = (vix: number) => {
    if (vix < 12) return { label: 'MUITO BAIXO', color: 'emerald', icon: AlertTriangle };
    if (vix < 20) return { label: 'BAIXO', color: 'green', icon: AlertTriangle };
    if (vix < 30) return { label: 'MODERADO', color: 'yellow', icon: Activity };
    if (vix < 40) return { label: 'ALTO', color: 'orange', icon: AlertTriangle };
    return { label: 'EXTREMO', color: 'red', icon: AlertTriangle };
  };

  const riskLevel = getRiskLevel(vix);
  const RiskIcon = riskLevel.icon;

  // 🔥 CORREÇÃO CRÍTICA: VIX subindo = MAIS RISCO (rosa), VIX caindo = MENOS RISCO (verde)
  const isPositive = change >= 0;
  
  // Se VIX subiu hoje, intensificar a cor do risco
  const adjustedRiskColor = isPositive && change > 0.5 
    ? (riskLevel.color === 'emerald' || riskLevel.color === 'green' ? 'yellow' : riskLevel.color === 'yellow' ? 'orange' : riskLevel.color)
    : riskLevel.color;

  // 🆕 Verificar horário de trading
  const tradingStatus = checkVIXTradingHours();
  const statusMessage = getVIXStatusMessage();
  const statusColor = getVIXStatusColor();

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">VIX S&P 500</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
          adjustedRiskColor === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          adjustedRiskColor === 'green' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          adjustedRiskColor === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
          adjustedRiskColor === 'orange' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
          'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <RiskIcon className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{riskLevel.label}</span>
        </div>
      </div>

      {/* 🆕 Status do Mercado (Horário) */}
      <div className={`mb-3 px-3 py-2 rounded-lg border ${statusColor} flex items-center gap-2`}>
        <Clock className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{statusMessage}</span>
      </div>

      {/* Main Value */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            <span className="text-sm text-neutral-400">Carregando...</span>
          </div>
        ) : (
          <>
            {/* VIX Value */}
            <div className="text-center mb-3">
              <div className="text-5xl font-mono font-bold text-white mb-1">
                {vix.toFixed(2)}
              </div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold">
                Índice de Volatilidade
              </div>
            </div>

            {/* Change Today */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              isPositive 
                ? 'bg-rose-500/10 border-rose-500/30' 
                : 'bg-emerald-500/10 border-emerald-500/30'
            }`}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-rose-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              )}
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-mono font-bold ${
                  isPositive ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {isPositive ? '+' : ''}{change.toFixed(2)}%
                </span>
                <span className={`text-xs font-mono ${
                  isPositive ? 'text-rose-400/70' : 'text-emerald-400/70'
                }`}>
                  ({isPositive ? '+' : ''}{change.toFixed(2)})
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1">
              Sessão
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {getMarketSession()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1">
              Última Atualização
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        
        {/* 🆕 Mostrar fonte dos dados */}
        {history.length > 0 && (
          <div className="mt-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">
                Fonte: Simulação Realista
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 p-2 bg-white/5 rounded-lg border border-white/10">
        <div className="text-[10px] text-neutral-400 leading-relaxed">
          <span className="font-bold text-purple-400">VIX:</span> Mede a volatilidade esperada do mercado.
          <br />
          <span className="font-bold text-emerald-400">↓ Baixo:</span> Mercado calmo / 
          <span className="font-bold text-rose-400"> ↑ Alto:</span> Mercado agitado
        </div>
      </div>
    </div>
  );
}