import React, { useState, useEffect, useRef } from 'react';
import { Bell, Volume2, VolumeX, AlertTriangle, XCircle, CheckCircle2, X, Zap, TrendingDown } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  read: boolean;
  symbol?: string;
  data?: {
    price?: number;
    change24h?: number;
    discrepancy?: number;
  };
}

export function AlertSystemPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar AudioContext
  useEffect(() => {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      audioContextRef.current = new AudioContext();
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Função para tocar som de alerta
  const playAlertSound = (type: 'critical' | 'warning' | 'info') => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Diferentes frequências para diferentes tipos
    const frequency = type === 'critical' ? 800 : type === 'warning' ? 600 : 400;
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    // Envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
    
    // Para alertas críticos, tocar duas vezes
    if (type === 'critical') {
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = frequency;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.5);
      }, 300);
    }
  };

  // Adicionar novo alerta
  const addAlert = (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => {
    const newAlert: Alert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false
    };
    
    setAlerts(prev => [newAlert, ...prev]);
    
    // Tocar som
    playAlertSound(alert.type);
    
    console.log(`[AlertSystemPanel] 🚨 Alerta: [${alert.type.toUpperCase()}] ${alert.title}`);
  };

  // 🔥 MONITORAMENTO REAL DE ATIVOS
  const checkAssetForProblems = async () => {
    try {
      // Lista de ativos críticos para monitorar
      const criticalAssets = ['BTCUSD', 'EURUSD', 'GBPUSD', 'XAUUSD'];
      
      for (const symbol of criticalAssets) {
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/server/market-data/${symbol}`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );

          if (!response.ok) continue;

          const data = await response.json();

          // 🚨 ALERTA: Variação zerada (problema de timezone) - ✅ CORRIGIDO: changePercent
          if (data.changePercent === 0 || data.changePercent === null) {
            addAlert({
              type: 'warning',
              title: `${symbol}: Variação 24h Zerada`,
              message: `Variação diária está em 0.00%. Possível problema com timezone MT5 ou D1 candle.`,
              source: 'Asset Monitor',
              symbol,
              data: {
                price: data.last, // ✅ CORRIGIDO: last ao invés de price
                change24h: data.changePercent
              }
            });
          }

          // 🚨 ALERTA CRÍTICO: Discrepância entre fontes
          if (data.sources?.metaapi && data.sources?.fallback) {
            const diff = Math.abs(data.sources.metaapi - data.sources.fallback);
            const discrepancy = (diff / data.sources.metaapi) * 100;
            
            if (discrepancy > 2) {
              addAlert({
                type: 'critical',
                title: `${symbol}: DISCREPÂNCIA CRÍTICA`,
                message: `Diferença de ${discrepancy.toFixed(2)}% entre MetaAPI ($${data.sources.metaapi.toFixed(4)}) e fallback ($${data.sources.fallback.toFixed(4)})`,
                source: 'Data Validation',
                symbol,
                data: {
                  price: data.last, // ✅ CORRIGIDO: last ao invés de price
                  discrepancy
                }
              });
            } else if (discrepancy > 0.5) {
              addAlert({
                type: 'warning',
                title: `${symbol}: Discrepância Detectada`,
                message: `Diferença de ${discrepancy.toFixed(2)}% entre fontes. Monitorar.`,
                source: 'Data Validation',
                symbol,
                data: {
                  price: data.last, // ✅ CORRIGIDO: last ao invés de price
                  discrepancy
                }
              });
            }
          }

          // 🚨 ALERTA: Preço indisponível
          if (!data.price || data.price === 0) {
            addAlert({
              type: 'error',
              title: `${symbol}: Preço Indisponível`,
              message: `Não foi possível obter preço válido. Fonte: ${data.source || 'unknown'}`,
              source: 'Asset Monitor',
              symbol
            });
          }

          // 🚨 ALERTA: Qualidade baixa
          if (data.quality === 'poor' || data.quality === 'unavailable') {
            addAlert({
              type: 'warning',
              title: `${symbol}: Qualidade de Dados Baixa`,
              message: `Qualidade: ${data.quality}. Dados podem estar desatualizados.`,
              source: 'Data Quality Monitor',
              symbol,
              data: {
                price: data.price,
                change24h: data.change24h
              }
            });
          }

        } catch (error) {
          // Silenciar erros individuais
        }
      }
    } catch (error) {
      console.error('[AlertSystemPanel] Erro no monitoramento:', error);
    }
  };

  // Setup do monitoramento a cada 30 segundos
  useEffect(() => {
    // Alerta inicial
    addAlert({
      type: 'info',
      title: 'Sistema de Alertas Ativo',
      message: 'Monitoramento em tempo real iniciado. Validando dados de ativos críticos.',
      source: 'System'
    });

    // Primeira verificação imediata
    setTimeout(() => {
      checkAssetForProblems();
    }, 5000);

    // Intervalo de 30 segundos
    monitoringIntervalRef.current = setInterval(() => {
      checkAssetForProblems();
    }, 30000);

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  // Marcar alerta como lido
  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  // Remover alerta
  const removeAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  // Limpar todos os alertas lidos
  const clearReadAlerts = () => {
    setAlerts(prev => prev.filter(alert => !alert.read));
  };

  // Filtrar alertas
  const filteredAlerts = alerts.filter(alert => 
    filter === 'all' || alert.type === filter
  );

  // Contadores
  const unreadCount = alerts.filter(a => !a.read).length;
  const criticalCount = alerts.filter(a => a.type === 'critical' && !a.read).length;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/30 relative">
            <Bell className="w-6 h-6 text-red-400" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{unreadCount}</span>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Sistema de Alertas (DADOS REAIS)</h3>
            <p className="text-slate-400 text-sm">
              {unreadCount} não lidos • {criticalCount} críticos
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
              soundEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-slate-300'
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4" />
                Som Ativo
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                Som Desligado
              </>
            )}
          </button>
          
          {alerts.some(a => a.read) && (
            <button
              onClick={clearReadAlerts}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-semibold text-sm rounded-lg transition-all"
            >
              Limpar Lidos
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 text-xs font-semibold uppercase">Críticos</p>
          </div>
          <p className="text-white text-3xl font-bold">
            {alerts.filter(a => a.type === 'critical').length}
          </p>
          <p className="text-red-400/70 text-xs mt-1">
            {criticalCount} não resolvidos
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <p className="text-yellow-400 text-xs font-semibold uppercase">Avisos</p>
          </div>
          <p className="text-white text-3xl font-bold">
            {alerts.filter(a => a.type === 'warning').length}
          </p>
          <p className="text-yellow-400/70 text-xs mt-1">
            {alerts.filter(a => a.type === 'warning' && !a.read).length} não lidos
          </p>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
            <p className="text-blue-400 text-xs font-semibold uppercase">Informativos</p>
          </div>
          <p className="text-white text-3xl font-bold">
            {alerts.filter(a => a.type === 'info').length}
          </p>
          <p className="text-blue-400/70 text-xs mt-1">
            {alerts.filter(a => a.type === 'info' && !a.read).length} não lidos
          </p>
        </div>

        <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-purple-400" />
            <p className="text-purple-400 text-xs font-semibold uppercase">Total</p>
          </div>
          <p className="text-white text-3xl font-bold">{alerts.length}</p>
          <p className="text-purple-400/70 text-xs mt-1">
            últimas 24h
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
          }`}
        >
          Todos ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'critical'
              ? 'bg-red-600 text-white'
              : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
          }`}
        >
          Críticos ({alerts.filter(a => a.type === 'critical').length})
        </button>
        <button
          onClick={() => setFilter('warning')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'warning'
              ? 'bg-yellow-600 text-white'
              : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
          }`}
        >
          Avisos ({alerts.filter(a => a.type === 'warning').length})
        </button>
        <button
          onClick={() => setFilter('info')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'info'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
          }`}
        >
          Info ({alerts.filter(a => a.type === 'info').length})
        </button>
      </div>

      {/* Alerts List */}
      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-slate-400 text-lg font-semibold mb-2">
              Nenhum alerta para exibir
            </p>
            <p className="text-slate-500 text-sm">
              Sistema operando normalmente
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => !alert.read && markAsRead(alert.id)}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                !alert.read ? 'opacity-100' : 'opacity-50'
              } ${
                alert.type === 'critical'
                  ? 'bg-red-900/20 border-red-800/30 hover:bg-red-900/30'
                  : alert.type === 'warning'
                  ? 'bg-yellow-900/20 border-yellow-800/30 hover:bg-yellow-900/30'
                  : 'bg-blue-900/20 border-blue-800/30 hover:bg-blue-900/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Icon */}
                  {alert.type === 'critical' ? (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : alert.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={`font-bold text-sm ${
                        alert.type === 'critical' ? 'text-red-300' :
                        alert.type === 'warning' ? 'text-yellow-300' :
                        'text-blue-300'
                      }`}>
                        {alert.title}
                        {!alert.read && (
                          <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                      </h4>
                      <span className="text-slate-500 text-xs whitespace-nowrap">
                        {alert.timestamp.toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    
                    <p className="text-slate-300 text-sm mb-2">{alert.message}</p>
                    
                    {/* Dados adicionais */}
                    {alert.data && (
                      <div className="flex gap-3 text-xs mb-2">
                        {alert.data.price !== undefined && (
                          <span className="text-slate-400">
                            Preço: <span className="text-white font-mono">${alert.data.price.toFixed(4)}</span>
                          </span>
                        )}
                        {alert.data.change24h !== undefined && (
                          <span className="text-slate-400">
                            24h: <span className={alert.data.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {alert.data.change24h >= 0 ? '+' : ''}{alert.data.change24h.toFixed(2)}%
                            </span>
                          </span>
                        )}
                        {alert.data.discrepancy !== undefined && (
                          <span className="text-red-400 font-semibold">
                            Discrepância: {alert.data.discrepancy.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-zinc-800 text-slate-400 text-xs rounded">
                        {alert.source}
                      </span>
                      {alert.symbol && (
                        <span className="px-2 py-0.5 bg-cyan-900/30 text-cyan-400 text-xs rounded font-semibold">
                          {alert.symbol}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAlert(alert.id);
                  }}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}