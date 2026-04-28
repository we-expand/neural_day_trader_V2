/**
 * 🧪 UNIFIED DATA TESTER
 * 
 * Componente de teste para validar o novo serviço unificado de market data
 * Testa TODOS os ativos: Cripto, Forex, Índices, Ações, Commodities
 */

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { unifiedMarketData, MarketPrice, formatUSD, formatPercent, getChangeColor } from '@/app/services/unifiedMarketData';
import { useDebug } from './DebugController';
import { toast } from 'sonner';

interface TestResult {
  symbol: string;
  status: 'loading' | 'success' | 'error';
  data?: MarketPrice;
  error?: string;
  latency?: number;
}

export const UnifiedDataTester: React.FC = () => {
  const { debugState } = useDebug();
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'crypto' | 'forex' | 'index' | 'commodity'>('all');

  // 🔥 EXPANDIDO: Mais ativos em cada categoria
  const testSymbols = {
    crypto: ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX', 'LINK', 'UNI'],
    forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'EURJPY', 'GBPJPY'],
    index: ['SPX', 'US30', 'NAS100', 'BVSP', 'DAX', 'FTSE', 'NIKKEI', 'HSI', 'ASX200'],
    commodity: ['GOLD', 'SILVER', 'OIL', 'BRENT', 'NATGAS', 'COPPER']
  };

  const getSymbolsToTest = () => {
    if (selectedCategory === 'all') {
      return [...testSymbols.crypto, ...testSymbols.forex, ...testSymbols.index, ...testSymbols.commodity];
    }
    return testSymbols[selectedCategory];
  };

  const testSingleAsset = async (symbol: string) => {
    const startTime = Date.now();
    
    setResults(prev => new Map(prev).set(symbol, {
      symbol,
      status: 'loading'
    }));

    try {
      const data = await unifiedMarketData.getPrice(symbol);
      const latency = Date.now() - startTime;

      if (data) {
        setResults(prev => new Map(prev).set(symbol, {
          symbol,
          status: 'success',
          data,
          latency
        }));
      } else {
        setResults(prev => new Map(prev).set(symbol, {
          symbol,
          status: 'error',
          error: 'No data returned',
          latency
        }));
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      setResults(prev => new Map(prev).set(symbol, {
        symbol,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency
      }));
    }
  };

  const testAllAssets = async () => {
    setIsTestingAll(true);
    setResults(new Map());

    const symbols = getSymbolsToTest();
    let totalErrors = 0;
    
    // Testar em paralelo (max 10 simultâneos para não sobrecarregar)
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async symbol => {
        try {
          await testSingleAsset(symbol);
          return { symbol, success: true };
        } catch (error) {
          totalErrors++;
          return { symbol, success: false, error };
        }
      }));

      // 🚨 ALERTAS DE ERRO DURANTE O TESTE
      batchResults.forEach(({ symbol, success, error }) => {
        if (!success) {
          toast.error(`❌ Erro ao testar ${symbol}`, {
            description: error instanceof Error ? error.message : 'Erro desconhecido',
            duration: 3000
          });
        }
      });
    }

    setIsTestingAll(false);

    // 🎉 RELATÓRIO FINAL
    const finalStats = Array.from(results.values());
    const successCount = finalStats.filter(r => r.status === 'success').length;
    const errorCount = finalStats.filter(r => r.status === 'error').length;

    if (errorCount === 0) {
      toast.success('✅ Todos os testes passaram!', {
        description: `${successCount} ativos testados com sucesso`,
        duration: 5000
      });
    } else if (errorCount > 0 && successCount > 0) {
      toast.warning(`⚠️ ${errorCount} erros detectados`, {
        description: `${successCount} sucessos, ${errorCount} falhas`,
        duration: 5000
      });
    } else {
      toast.error(`❌ Todos os testes falharam`, {
        description: `Verifique a conexão com as APIs`,
        duration: 5000
      });
    }
  };

  // Calcular estatísticas
  const stats = React.useMemo(() => {
    const total = results.size;
    const success = Array.from(results.values()).filter(r => r.status === 'success').length;
    const errors = Array.from(results.values()).filter(r => r.status === 'error').length;
    const loading = Array.from(results.values()).filter(r => r.status === 'loading').length;
    
    const latencies = Array.from(results.values())
      .filter(r => r.latency !== undefined)
      .map(r => r.latency!);
    
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;

    // Agrupar por fonte
    const sources = Array.from(results.values())
      .filter(r => r.data?.source)
      .reduce((acc, r) => {
        const source = r.data!.source;
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return { total, success, errors, loading, avgLatency, sources };
  }, [results]);

  // 🔒 Se debug estiver desabilitado, não renderizar
  if (!debugState.unifiedMarketTester) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-6 w-[900px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-purple-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Unified Market Data Tester</h3>
              <p className="text-xs text-slate-400">
                Teste de APIs: Yahoo Finance • Binance • Twelve Data
              </p>
            </div>
          </div>
          <button
            onClick={testAllAssets}
            disabled={isTestingAll}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isTestingAll ? 'animate-spin' : ''}`} />
            {isTestingAll ? 'Testando...' : 'Testar Todos'}
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mt-4">
          {(['all', 'crypto', 'forex', 'index', 'commodity'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="bg-slate-800/50 p-4 border-b border-slate-700">
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-xs text-slate-500 uppercase">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">{stats.success}</div>
              <div className="text-xs text-slate-500 uppercase">Sucesso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-400">{stats.errors}</div>
              <div className="text-xs text-slate-500 uppercase">Erros</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-cyan-400">{Math.round(stats.avgLatency)}ms</div>
              <div className="text-xs text-slate-500 uppercase">Latência</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-purple-400">
                {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
              </div>
              <div className="text-xs text-slate-500 uppercase">Taxa Sucesso</div>
            </div>
          </div>

          {/* Sources Distribution */}
          {Object.keys(stats.sources).length > 0 && (
            <div className="flex gap-3 justify-center">
              {Object.entries(stats.sources).map(([source, count]) => (
                <div key={source} className="px-3 py-1 bg-slate-700 rounded-lg">
                  <span className="text-xs font-mono text-slate-400">{source}:</span>
                  <span className="text-xs font-bold text-white ml-2">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Grid */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {getSymbolsToTest().map(symbol => {
            const result = results.get(symbol);
            const info = unifiedMarketData.getSymbolInfo(symbol);

            return (
              <div
                key={symbol}
                className={`p-3 rounded-xl border transition-all ${
                  result?.status === 'success'
                    ? 'bg-emerald-900/20 border-emerald-500/30'
                    : result?.status === 'error'
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{symbol}</span>
                      {info && (
                        <span className="px-2 py-0.5 bg-slate-700 rounded text-[10px] font-mono text-slate-400">
                          {info.type}
                        </span>
                      )}
                    </div>
                    {result?.data?.source && (
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        Source: {result.data.source}
                      </div>
                    )}
                  </div>

                  {result?.status === 'loading' && (
                    <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                  )}
                  {result?.status === 'success' && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                  {result?.status === 'error' && (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>

                {result?.data && (
                  <div>
                    <div className="text-lg font-black text-white mb-1">
                      {formatUSD(result.data.price)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${getChangeColor(result.data.changePercent24h)}`}>
                        {result.data.changePercent24h >= 0 ? (
                          <TrendingUp className="w-3 h-3 inline mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 inline mr-1" />
                        )}
                        {formatPercent(result.data.changePercent24h)}
                      </span>
                      {result.latency && (
                        <span className="text-[10px] text-slate-500">
                          {result.latency}ms
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {result?.status === 'error' && (
                  <div className="text-xs text-red-400 mt-2">
                    {result.error}
                  </div>
                )}

                {!result && (
                  <button
                    onClick={() => testSingleAsset(symbol)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    Testar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};