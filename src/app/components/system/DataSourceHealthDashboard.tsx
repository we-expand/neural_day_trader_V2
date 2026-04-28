import React, { useState, useEffect, useRef } from 'react';
import { Server, CheckCircle2, AlertTriangle, XCircle, Zap, Clock, TrendingUp, Activity } from 'lucide-react';

interface DataSourceStatus {
  name: string;
  priority: number;
  status: 'online' | 'degraded' | 'offline';
  responseTime: number; // ms
  successRate: number; // %
  lastCheck: Date;
  endpoints: {
    name: string;
    status: 'ok' | 'slow' | 'error';
    latency: number;
  }[];
  errorCount: number;
  requestsToday: number;
}

export function DataSourceHealthDashboard() {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Configuração das fontes de dados
  const DATA_SOURCES = [
    {
      name: 'MetaAPI (MT5)',
      priority: 1,
      endpoints: [
        { name: 'Price Stream', path: '/prices' },
        { name: 'Account Info', path: '/account' },
        { name: 'Order Execution', path: '/orders' },
        { name: 'Historical Data', path: '/history' }
      ]
    },
    {
      name: 'Trading Economics',
      priority: 2,
      endpoints: [
        { name: 'Macro Indicators', path: '/indicators' },
        { name: 'Calendar Events', path: '/calendar' },
        { name: 'Market Data', path: '/markets' }
      ]
    },
    {
      name: 'S&P Global',
      priority: 3,
      endpoints: [
        { name: 'Corporate Data', path: '/corporate' },
        { name: 'ESG Metrics', path: '/esg' },
        { name: 'Credit Ratings', path: '/ratings' }
      ]
    },
    {
      name: 'Alpha Vantage',
      priority: 4,
      endpoints: [
        { name: 'Stock Prices', path: '/stock' },
        { name: 'Forex Data', path: '/forex' },
        { name: 'Technical Indicators', path: '/indicators' }
      ]
    },
    {
      name: 'CoinGecko',
      priority: 5,
      endpoints: [
        { name: 'Crypto Prices', path: '/prices' },
        { name: 'Market Cap', path: '/market' },
        { name: 'Volume Data', path: '/volume' }
      ]
    }
  ];

  // Simular health check de uma fonte
  const checkDataSource = async (config: typeof DATA_SOURCES[0]): Promise<DataSourceStatus> => {
    const startTime = Date.now();
    
    try {
      // Simular verificação de endpoints
      const endpointResults = await Promise.all(
        config.endpoints.map(async (endpoint) => {
          const endpointStart = Date.now();
          
          // Simular latência variável
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
          
          const latency = Date.now() - endpointStart;
          const random = Math.random();
          
          let status: 'ok' | 'slow' | 'error' = 'ok';
          if (random < 0.1) {
            status = 'error';
          } else if (latency > 150 || random < 0.2) {
            status = 'slow';
          }
          
          return {
            name: endpoint.name,
            status,
            latency
          };
        })
      );
      
      // Calcular status geral
      const hasErrors = endpointResults.some(e => e.status === 'error');
      const hasSlow = endpointResults.some(e => e.status === 'slow');
      
      let overallStatus: 'online' | 'degraded' | 'offline' = 'online';
      if (hasErrors && endpointResults.every(e => e.status === 'error')) {
        overallStatus = 'offline';
      } else if (hasErrors || hasSlow) {
        overallStatus = 'degraded';
      }
      
      const avgResponseTime = endpointResults.reduce((sum, e) => sum + e.latency, 0) / endpointResults.length;
      const successRate = (endpointResults.filter(e => e.status === 'ok').length / endpointResults.length) * 100;
      
      return {
        name: config.name,
        priority: config.priority,
        status: overallStatus,
        responseTime: Math.round(avgResponseTime),
        successRate: Math.round(successRate),
        lastCheck: new Date(),
        endpoints: endpointResults,
        errorCount: endpointResults.filter(e => e.status === 'error').length,
        requestsToday: Math.floor(Math.random() * 10000) + 1000
      };
    } catch (error) {
      return {
        name: config.name,
        priority: config.priority,
        status: 'offline',
        responseTime: Date.now() - startTime,
        successRate: 0,
        lastCheck: new Date(),
        endpoints: config.endpoints.map(e => ({
          name: e.name,
          status: 'error' as const,
          latency: 0
        })),
        errorCount: config.endpoints.length,
        requestsToday: 0
      };
    }
  };

  // Executar health check em todas as fontes
  const runHealthChecks = async () => {
    console.log('[DataSourceHealthDashboard] 🔍 Verificando fontes de dados...');
    
    const results = await Promise.all(
      DATA_SOURCES.map(source => checkDataSource(source))
    );
    
    setSources(results);
    setLastUpdate(new Date());
    
    console.log('[DataSourceHealthDashboard] ✅ Verificação completa:', {
      online: results.filter(s => s.status === 'online').length,
      degraded: results.filter(s => s.status === 'degraded').length,
      offline: results.filter(s => s.status === 'offline').length
    });
  };

  // Setup do polling de 10 segundos
  useEffect(() => {
    if (isMonitoring) {
      runHealthChecks();
      
      intervalRef.current = setInterval(() => {
        runHealthChecks();
      }, 10000); // 10 segundos
      
      console.log('[DataSourceHealthDashboard] ⚡ Monitoramento iniciado (10s interval)');
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      console.log('[DataSourceHealthDashboard] ⏸️ Monitoramento pausado');
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMonitoring]);

  // Estatísticas gerais
  const stats = {
    online: sources.filter(s => s.status === 'online').length,
    degraded: sources.filter(s => s.status === 'degraded').length,
    offline: sources.filter(s => s.status === 'offline').length,
    avgResponseTime: sources.length > 0 
      ? Math.round(sources.reduce((sum, s) => sum + s.responseTime, 0) / sources.length)
      : 0,
    totalRequests: sources.reduce((sum, s) => sum + s.requestsToday, 0)
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <Server className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Status das Fontes de Dados</h3>
            <p className="text-slate-400 text-sm">
              Monitoramento em tempo real • Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            isMonitoring
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-slate-300'
          }`}
        >
          {isMonitoring ? (
            <>
              <Zap className="w-4 h-4" />
              Monitorando
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" />
              Pausado
            </>
          )}
        </button>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-emerald-400 text-xs font-semibold uppercase">Online</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.online}</p>
          <p className="text-emerald-400/70 text-xs mt-1">
            {sources.length > 0 ? Math.round((stats.online / sources.length) * 100) : 0}%
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <p className="text-yellow-400 text-xs font-semibold uppercase">Degradado</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.degraded}</p>
          <p className="text-yellow-400/70 text-xs mt-1">
            Performance reduzida
          </p>
        </div>

        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 text-xs font-semibold uppercase">Offline</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.offline}</p>
          <p className="text-red-400/70 text-xs mt-1">
            Requer atenção
          </p>
        </div>

        <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <p className="text-cyan-400 text-xs font-semibold uppercase">Latência Média</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.avgResponseTime}</p>
          <p className="text-cyan-400/70 text-xs mt-1">milissegundos</p>
        </div>

        <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <p className="text-purple-400 text-xs font-semibold uppercase">Requisições Hoje</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.totalRequests.toLocaleString()}</p>
          <p className="text-purple-400/70 text-xs mt-1">total acumulado</p>
        </div>
      </div>

      {/* Data Sources List */}
      <div className="space-y-4">
        {sources.length === 0 ? (
          <div className="text-center py-8">
            <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">Carregando fontes de dados...</p>
          </div>
        ) : (
          sources.map(source => (
            <div
              key={source.name}
              className={`border rounded-xl p-4 transition-all ${
                source.status === 'online'
                  ? 'bg-emerald-900/10 border-emerald-800/30'
                  : source.status === 'degraded'
                  ? 'bg-yellow-900/10 border-yellow-800/30'
                  : 'bg-red-900/10 border-red-800/30'
              }`}
            >
              {/* Source Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {source.status === 'online' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : source.status === 'degraded' ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400" />
                  )}
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-bold text-lg">{source.name}</h4>
                      <span className="px-2 py-0.5 bg-zinc-800 text-slate-400 text-xs rounded font-semibold">
                        Prioridade #{source.priority}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Última verificação: {source.lastCheck.toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-slate-500 text-xs">Tempo de Resposta</p>
                    <p className={`text-lg font-bold font-mono ${
                      source.responseTime < 100 ? 'text-emerald-400' :
                      source.responseTime < 300 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {source.responseTime}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Taxa de Sucesso</p>
                    <p className={`text-lg font-bold ${
                      source.successRate === 100 ? 'text-emerald-400' :
                      source.successRate >= 80 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {source.successRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Requisições</p>
                    <p className="text-white text-lg font-bold">
                      {source.requestsToday.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Endpoints */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {source.endpoints.map(endpoint => (
                  <div
                    key={endpoint.name}
                    className={`p-3 rounded-lg border ${
                      endpoint.status === 'ok'
                        ? 'bg-emerald-900/20 border-emerald-800/30'
                        : endpoint.status === 'slow'
                        ? 'bg-yellow-900/20 border-yellow-800/30'
                        : 'bg-red-900/20 border-red-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {endpoint.status === 'ok' ? (
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      ) : endpoint.status === 'slow' ? (
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      ) : (
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                      )}
                      <p className="text-white text-xs font-semibold">{endpoint.name}</p>
                    </div>
                    <p className={`text-xs font-mono font-semibold ${
                      endpoint.status === 'ok' ? 'text-emerald-400' :
                      endpoint.status === 'slow' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {endpoint.status === 'error' ? 'ERROR' : `${endpoint.latency}ms`}
                    </p>
                  </div>
                ))}
              </div>

              {/* Alerts */}
              {source.errorCount > 0 && (
                <div className="mt-3 p-2 bg-red-900/20 border border-red-800/30 rounded-lg">
                  <p className="text-red-400 text-xs font-semibold">
                    ⚠️ {source.errorCount} endpoint{source.errorCount > 1 ? 's' : ''} com erro
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
