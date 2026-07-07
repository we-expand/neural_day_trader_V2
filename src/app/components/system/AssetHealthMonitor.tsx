import React, { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface AssetHealth {
  symbol: string;
  name: string;
  category: string;
  status: 'healthy' | 'warning' | 'error';
  price: number | null;
  change24h: number | null;
  lastUpdate: Date | null;
  latency: number; // ms
  errorMessage?: string;
  discrepancy?: number; // % de discrepância entre fontes
  sources?: {
    metaapi?: number;
    fallback?: number;
  };
}

export function AssetHealthMonitor() {
  const [assets, setAssets] = useState<AssetHealth[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [stats, setStats] = useState({
    healthy: 0,
    warning: 0,
    error: 0,
    avgLatency: 0
  });
  const [filter, setFilter] = useState<'all' | 'healthy' | 'warning' | 'error'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Lista de ativos para monitorar (REDUZIDA para evitar rate limit do Yahoo Finance)
  const MONITORED_ASSETS = [
    { symbol: 'EURUSD', name: 'Euro/Dollar', category: 'Forex' },
    { symbol: 'GBPUSD', name: 'Pound/Dollar', category: 'Forex' },
    { symbol: 'USDJPY', name: 'Dollar/Yen', category: 'Forex' },
    { symbol: 'XAUUSD', name: 'Gold', category: 'Commodities' },
    { symbol: 'US30', name: 'Dow Jones', category: 'Indices' },
    { symbol: 'NAS100', name: 'Nasdaq 100', category: 'Indices' },
    { symbol: 'SPX500', name: 'S&P 500', category: 'Indices' },
    { symbol: 'BTCUSD', name: 'Bitcoin', category: 'Crypto' },
  ];

  // 🔥 FUNÇÃO REAL DE HEALTH CHECK - BUSCA DADOS DA API
  const checkAssetHealth = async (asset: { symbol: string; name: string; category: string }): Promise<AssetHealth> => {
    const startTime = Date.now();
    
    try {
      // Buscar dados REAIS da API (✅ CORRIGIDO: usar path parameter, não query string)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/market-data/${asset.symbol}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // 🚨 VALIDAÇÃO REAL
      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let errorMessage: string | undefined;
      const issues: string[] = [];

      // Verificar se temos preço (✅ CORRIGIDO: API retorna 'last', não 'price')
      if (!data.last || data.last === 0) {
        status = 'error';
        issues.push('Preço indisponível');
      }

      // 🔥 PROBLEMA CRÍTICO: Variação zerada (timezone/D1 candle issue)
      // ✅ CORRIGIDO: API retorna 'changePercent', não 'change24h'
      if (data.changePercent === 0 || data.changePercent === null) {
        if (status !== 'error') status = 'warning';
        issues.push('Variação 24h zerada - Possível problema de timezone MT5');
      }

      // Verificar latência
      if (latency > 3000) {
        if (status !== 'error') status = 'warning';
        issues.push(`Alta latência: ${latency}ms`);
      }

      // Verificar qualidade dos dados (source)
      if (data.source && data.source !== 'metaapi' && data.source !== 'metaapi-candles') {
        if (status !== 'error') status = 'warning';
        issues.push(`Fonte: ${data.source} (fallback)`);
      }

      // Verificar discrepância entre fontes
      let discrepancy: number | undefined;
      if (data.sources?.metaapi && data.sources?.fallback) {
        const diff = Math.abs(data.sources.metaapi - data.sources.fallback);
        discrepancy = (diff / data.sources.metaapi) * 100;
        
        if (discrepancy > 2) {
          status = 'error';
          issues.push(`Discrepância CRÍTICA: ${discrepancy.toFixed(2)}%`);
        } else if (discrepancy > 0.5) {
          if (status !== 'error') status = 'warning';
          issues.push(`Discrepância detectada: ${discrepancy.toFixed(2)}%`);
        }
      }

      if (issues.length > 0) {
        errorMessage = issues.join(' • ');
      }

      return {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
        status,
        price: data.last || null,
        change24h: data.changePercent || null,
        lastUpdate: new Date(),
        latency,
        errorMessage,
        discrepancy,
        sources: data.sources
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
        status: 'error',
        price: null,
        change24h: null,
        lastUpdate: null,
        latency,
        errorMessage: `Erro na API: ${error.message}`
      };
    }
  };

  // Executar health check em todos os ativos
  const runHealthCheck = async () => {
    console.log('[AssetHealthMonitor] 🔍 Iniciando health check com dados REAIS...');
    
    // ✅ RATE LIMITING: Espaçar requisições em 2s para evitar 429 do Yahoo Finance
    // Yahoo Finance tem rate limit muito agressivo - 300ms não é suficiente
    const results: AssetHealth[] = [];
    
    for (let i = 0; i < MONITORED_ASSETS.length; i++) {
      const asset = MONITORED_ASSETS[i];
      
      // Aguardar 2 segundos entre requisições (exceto na primeira)
      // Isso garante que não vamos ultrapassar o rate limit do Yahoo
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const result = await checkAssetHealth(asset);
      results.push(result);
      
      console.log(`[AssetHealthMonitor] ✅ ${i + 1}/${MONITORED_ASSETS.length} - ${asset.symbol}: ${result.status} (${result.price ? '$' + result.price.toFixed(4) : 'N/A'})`);
    }
    
    setAssets(results);
    setLastCheck(new Date());
    
    // Calcular estatísticas
    const healthy = results.filter(a => a.status === 'healthy').length;
    const warning = results.filter(a => a.status === 'warning').length;
    const error = results.filter(a => a.status === 'error').length;
    const avgLatency = results.reduce((sum, a) => sum + a.latency, 0) / results.length;
    
    setStats({ healthy, warning, error, avgLatency });
    
    // 🚨 LOG DE PROBLEMAS DETECTADOS
    const problemas = results.filter(r => r.status !== 'healthy');
    if (problemas.length > 0) {
      console.warn('[AssetHealthMonitor] ⚠️ PROBLEMAS DETECTADOS:', problemas.map(p => ({
        symbol: p.symbol,
        status: p.status,
        price: p.price,
        change24h: p.change24h,
        error: p.errorMessage
      })));
    }
    
    console.log('[AssetHealthMonitor] ✅ Health check completo:', {
      healthy,
      warning,
      error,
      avgLatency: Math.round(avgLatency)
    });
  };

  // Setup do polling de 10 segundos
  useEffect(() => {
    if (isMonitoring) {
      // Executar imediatamente
      runHealthCheck();
      
      // Setup do intervalo de 10 segundos
      intervalRef.current = setInterval(() => {
        runHealthCheck();
      }, 10000); // 10 segundos
      
      console.log('[AssetHealthMonitor] ⚡ Monitoramento iniciado (10s interval)');
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      console.log('[AssetHealthMonitor] ⏸️ Monitoramento pausado');
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMonitoring]);

  // Filtrar ativos
  const filteredAssets = assets.filter(asset => {
    if (filter !== 'all' && asset.status !== filter) return false;
    if (categoryFilter !== 'all' && asset.category !== categoryFilter) return false;
    return true;
  });

  // Categorias únicas
  const categories = ['all', ...Array.from(new Set(MONITORED_ASSETS.map(a => a.category)))];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <Activity className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Monitor de Ativos em Tempo Real</h3>
            <p className="text-slate-400 text-sm">
              Polling a cada 10s • Última atualização: {lastCheck.toLocaleTimeString('pt-BR')}
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
              <RefreshCw className="w-4 h-4" />
              Pausado
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-emerald-400 text-xs font-semibold uppercase">Saudáveis</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.healthy}</p>
          <p className="text-emerald-400/70 text-xs mt-1">
            {assets.length > 0 ? Math.round((stats.healthy / assets.length) * 100) : 0}% do total
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <p className="text-yellow-400 text-xs font-semibold uppercase">Avisos</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.warning}</p>
          <p className="text-yellow-400/70 text-xs mt-1">
            {assets.length > 0 ? Math.round((stats.warning / assets.length) * 100) : 0}% do total
          </p>
        </div>

        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 text-xs font-semibold uppercase">Erros</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.error}</p>
          <p className="text-red-400/70 text-xs mt-1">
            {assets.length > 0 ? Math.round((stats.error / assets.length) * 100) : 0}% do total
          </p>
        </div>

        <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <p className="text-cyan-400 text-xs font-semibold uppercase">Latência Média</p>
          </div>
          <p className="text-white text-3xl font-bold">{Math.round(stats.avgLatency)}</p>
          <p className="text-cyan-400/70 text-xs mt-1">milissegundos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
            }`}
          >
            Todos ({assets.length})
          </button>
          <button
            onClick={() => setFilter('healthy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'healthy'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
            }`}
          >
            Saudáveis ({stats.healthy})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'warning'
                ? 'bg-yellow-600 text-white'
                : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
            }`}
          >
            Avisos ({stats.warning})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
            }`}
          >
            Erros ({stats.error})
          </button>
        </div>

        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
              }`}
            >
              {cat === 'all' ? 'Todas Categorias' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Assets List */}
      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum ativo encontrado</p>
          </div>
        ) : (
          filteredAssets.map(asset => (
            <div
              key={asset.symbol}
              className={`p-3 rounded-lg border transition-all ${
                asset.status === 'healthy'
                  ? 'bg-emerald-900/10 border-emerald-800/30 hover:bg-emerald-900/20'
                  : asset.status === 'warning'
                  ? 'bg-yellow-900/10 border-yellow-800/30 hover:bg-yellow-900/20'
                  : 'bg-red-900/10 border-red-800/30 hover:bg-red-900/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {/* Status Icon */}
                  {asset.status === 'healthy' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : asset.status === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}

                  {/* Asset Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold text-sm">{asset.symbol}</p>
                      <span className="px-2 py-0.5 bg-zinc-800 text-slate-400 text-xs rounded">
                        {asset.category}
                      </span>
                      {asset.discrepancy !== undefined && asset.discrepancy > 0 && (
                        <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
                          asset.discrepancy > 2 
                            ? 'bg-red-900/30 text-red-400' 
                            : 'bg-yellow-900/30 text-yellow-400'
                        }`}>
                          ⚠️ Discrepância: {asset.discrepancy.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs truncate">{asset.name}</p>
                    {asset.errorMessage && (
                      <p className="text-red-400 text-xs mt-1 font-semibold">🚨 {asset.errorMessage}</p>
                    )}
                  </div>

                  {/* Price & Change */}
                  {asset.price !== null && (
                    <div className="text-right">
                      <p className="text-white font-mono text-sm">
                        ${asset.price.toFixed(asset.price > 100 ? 2 : 4)}
                      </p>
                      {asset.change24h !== null ? (
                        <div className="flex items-center justify-end gap-1 mt-1">
                          {asset.change24h >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                          <p
                            className={`text-xs font-semibold ${
                              asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {asset.change24h >= 0 ? '+' : ''}
                            {asset.change24h.toFixed(2)}%
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-yellow-400 mt-1">⚠️ 0.00%</p>
                      )}
                    </div>
                  )}

                  {/* Latency */}
                  <div className="text-right">
                    <p className="text-slate-500 text-xs">Latência</p>
                    <p
                      className={`text-sm font-mono font-semibold ${
                        asset.latency < 1000
                          ? 'text-emerald-400'
                          : asset.latency < 3000
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {asset.latency}ms
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}