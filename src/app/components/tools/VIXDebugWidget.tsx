import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { fetchVIXData } from '@/app/utils/vixDataSources';
import type { VIXData } from '@/app/utils/vixDataSources';

/**
 * 🔍 VIX DEBUG WIDGET
 * 
 * Mostra em tempo real:
 * - Valor do VIX
 * - Fonte de dados
 * - Qualidade (HIGH/MEDIUM/LOW/FALLBACK)
 * - Timestamp
 * - OpenPrice e PreviousClose para debug
 * 
 * Use para validar se o VIX está correto!
 */

export function VIXDebugWidget() {
  const [vixData, setVixData] = useState<VIXData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchVIX = async () => {
    setIsLoading(true);
    try {
      const data = await fetchVIXData();
      setVixData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[VIX Debug] Erro ao buscar VIX:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVIX();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchVIX, 30000);
    return () => clearInterval(interval);
  }, []);

  const getQualityBadge = (quality: VIXData['dataQuality']) => {
    const badges = {
      HIGH: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
      MEDIUM: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertTriangle },
      LOW: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertTriangle },
      FALLBACK: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle }
    };
    
    const badge = badges[quality];
    const Icon = badge.icon;
    
    return (
      <Badge className={`${badge.color} border font-mono text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {quality}
      </Badge>
    );
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-red-400';
    if (change < 0) return 'text-emerald-400';
    return 'text-slate-400';
  };

  return (
    <Card className="bg-black/40 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-500" />
              VIX Debug Monitor
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Monitoramento de qualidade de dados do VIX
            </CardDescription>
          </div>
          <button
            onClick={fetchVIX}
            disabled={isLoading}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading && !vixData ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
            <span className="ml-3 text-slate-400 text-sm">Buscando VIX...</span>
          </div>
        ) : vixData ? (
          <>
            {/* Valor Principal */}
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                    VIX Index
                  </div>
                  <div className="text-4xl font-bold text-white font-mono">
                    {vixData.value.toFixed(2)}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono ${getChangeColor(vixData.change)}`}>
                    {vixData.change > 0 ? '+' : ''}{vixData.change.toFixed(2)}
                  </div>
                  <div className={`text-sm font-mono ${getChangeColor(vixData.change)}`}>
                    {vixData.changePercent > 0 ? '+' : ''}{vixData.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Fonte e Qualidade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Fonte
                </div>
                <div className="text-sm font-medium text-white">
                  {vixData.source}
                </div>
              </div>
              
              <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Qualidade
                </div>
                {getQualityBadge(vixData.dataQuality)}
              </div>
            </div>

            {/* Debug Info */}
            <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                Dados Técnicos (Debug)
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-slate-500 mb-1">Open Today</div>
                  <div className="text-white font-mono">
                    {vixData.openPrice ? vixData.openPrice.toFixed(2) : 'N/A'}
                  </div>
                </div>
                
                <div>
                  <div className="text-slate-500 mb-1">Prev Close</div>
                  <div className="text-white font-mono">
                    {vixData.previousClose ? vixData.previousClose.toFixed(2) : 'N/A'}
                  </div>
                </div>
                
                <div>
                  <div className="text-slate-500 mb-1">Timestamp</div>
                  <div className="text-white font-mono">
                    {vixData.timestamp.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Interpretação */}
            <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                Interpretação
              </div>
              
              <div className="space-y-1 text-xs">
                {vixData.value < 15 && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    Volatilidade Baixa - Mercado Calmo
                  </div>
                )}
                
                {vixData.value >= 15 && vixData.value < 20 && (
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Activity className="w-3 h-3" />
                    Volatilidade Normal - Mercado Estável
                  </div>
                )}
                
                {vixData.value >= 20 && vixData.value < 30 && (
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    Volatilidade Alta - Mercado Agitado
                  </div>
                )}
                
                {vixData.value >= 30 && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    Volatilidade Extrema - Mercado em Pânico
                  </div>
                )}
              </div>
            </div>

            {/* Última Atualização */}
            {lastUpdate && (
              <div className="text-center text-xs text-slate-500">
                Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
              </div>
            )}

            {/* Alerta de Qualidade */}
            {vixData.dataQuality === 'FALLBACK' && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-red-400 mb-1">
                      ATENÇÃO: Dados em Fallback
                    </div>
                    <div className="text-xs text-red-300">
                      Todas as fontes falharam. Usando estimativa baseada em média histórica.
                      NÃO USE PARA TRADING REAL!
                    </div>
                  </div>
                </div>
              </div>
            )}

            {vixData.dataQuality === 'MEDIUM' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-amber-400 mb-1">
                      Qualidade Média
                    </div>
                    <div className="text-xs text-amber-300">
                      Dados podem ter delay de 15-20 minutos. Use com cautela.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-slate-500">
            Erro ao buscar VIX. Clique no botão de atualizar.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
