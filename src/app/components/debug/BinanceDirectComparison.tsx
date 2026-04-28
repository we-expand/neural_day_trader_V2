/**
 * 🔍 BINANCE DIRECT COMPARISON
 * 
 * Busca dados DIRETO da Binance sem intermediários
 * para verificar se há algum problema de precisão
 */

import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { unifiedMarketData } from '@/app/services/unifiedMarketData';
import { useDebug } from './DebugController';
import { toast } from 'sonner';

interface BinanceDirectData {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
}

interface ComparisonResult {
  symbol: string;
  binance: BinanceDirectData | null;
  ourService: {
    price: number;
    change: number;
    changePercent: number;
  } | null;
  差異: {
    price: number;
    changePercent: number;
  } | null;
  status: 'loading' | 'success' | 'error';
}

export const BinanceDirectComparison: React.FC = () => {
  const { debugState } = useDebug();
  const [results, setResults] = useState<Map<string, ComparisonResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // 🔥 EXPANDIDO: Mais ativos crypto
  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'ADAUSDT',
    'DOGEUSDT', 'POLUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT', 'UNIUSDT' // ✅ MATIC → POL
  ];

  const fetchDirect = async () => {
    setIsLoading(true);
    setResults(new Map());

    let totalErrors = 0;
    let totalDifferences = 0;

    for (const symbol of symbols) {
      try {
        // 🔥 BUSCAR SIMULTANEAMENTE para evitar lag de tempo
        const [binanceResponse, ourData] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
          unifiedMarketData.getPrice(symbol.replace('USDT', '')) // BTC, ETH, SOL, etc.
        ]);

        const binanceData: BinanceDirectData = await binanceResponse.json();

        // Se nosso serviço não retornou dados, marca como erro
        if (!ourData) {
          throw new Error('Nosso serviço não retornou dados');
        }

        const priceDiff = ourData.price - parseFloat(binanceData.lastPrice);
        const changePercentDiff = ourData.changePercent24h - parseFloat(binanceData.priceChangePercent);

        const result: ComparisonResult = {
          symbol,
          binance: binanceData,
          ourService: {
            price: ourData.price,
            change: ourData.change24h,
            changePercent: ourData.changePercent24h
          },
          差異: {
            price: priceDiff,
            changePercent: changePercentDiff
          },
          status: 'success'
        };

        setResults(prev => new Map(prev).set(symbol, result));

        // ✅ ALERTAS REMOVIDOS - Silencioso
        const percentDiff = Math.abs(changePercentDiff);
        if (percentDiff > 0.01) {
          totalDifferences++;
          // toast.error removido - sem banners
        }

      } catch (error) {
        // ✅ NÃO LOGA ERRO NO CONSOLE (silencioso)
        // console.error(`Error fetching ${symbol}:`, error);
        totalErrors++;
        setResults(prev => new Map(prev).set(symbol, {
          symbol,
          binance: null,
          ourService: null,
          差異: null,
          status: 'error'
        }));

        // ❌ REMOVIDO: Toast de erro (muito spam)
        // Apenas mostrar visualmente no componente
      }
    }

    setIsLoading(false);

    // 🎉 RELATÓRIO FINAL
    if (totalErrors === 0 && totalDifferences === 0) {
      toast.success('✅ Todos os ativos estão precisos!', {
        description: `${symbols.length} ativos testados sem diferenças`,
        duration: 3000
      });
    }
    // ... remove else if block to stop showing warning toasts
  };

  useEffect(() => {
    fetchDirect();
  }, []);

  // 🔒 Se debug estiver desabilitado, não renderizar
  if (!debugState.binanceComparison) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-6 w-[1100px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="text-lg font-bold text-white">🔍 Binance Direct Comparison</h3>
              <p className="text-xs text-slate-400">
                Comparação DIRETA Binance vs Nosso Serviço
              </p>
            </div>
          </div>
          <button
            onClick={fetchDirect}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        <div className="space-y-3">
          {symbols.map(symbol => {
            const result = results.get(symbol);
            if (!result) {
              return (
                <div key={symbol} className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                    <span className="text-white font-bold">{symbol}</span>
                    <span className="text-slate-400 text-sm">Carregando...</span>
                  </div>
                </div>
              );
            }

            if (result.status === 'error') {
              return (
                <div key={symbol} className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="text-white font-bold">{symbol}</span>
                    <span className="text-red-400 text-sm">Erro ao buscar dados</span>
                  </div>
                </div>
              );
            }

            const priceDiff = Math.abs(result.差異?.price || 0);
            const percentDiff = Math.abs(result.差異?.changePercent || 0);
            const hasDifference = priceDiff > 0.001 || percentDiff > 0.001; // 🔥 MAIS SENSÍVEL: 0.001% (antes: 0.01%)

            return (
              <div
                key={symbol}
                className={`p-4 rounded-xl border ${
                  hasDifference
                    ? 'bg-yellow-900/20 border-yellow-500/30'
                    : 'bg-emerald-900/20 border-emerald-500/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 mb-3">
                    {hasDifference ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="text-xl font-black text-white">{symbol}</span>
                  </div>

                  {hasDifference && (
                    <div className="bg-yellow-500/20 px-3 py-1 rounded-lg">
                      <div className="text-xs font-bold text-yellow-300">
                        ⚠️ DIFERENÇA DETECTADA
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Binance Direto */}
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-2">
                      🔴 Binance Direto
                    </div>
                    {result.binance && (
                      <div className="space-y-1">
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">Price:</span>{' '}
                          <span className="font-bold">${parseFloat(result.binance.lastPrice).toFixed(6)}</span>
                        </div>
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">Change:</span>{' '}
                          <span className={`font-bold ${
                            parseFloat(result.binance.priceChange) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            ${parseFloat(result.binance.priceChange).toFixed(6)}
                          </span>
                        </div>
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">%:</span>{' '}
                          <span className={`font-bold ${
                            parseFloat(result.binance.priceChangePercent) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {parseFloat(result.binance.priceChangePercent).toFixed(4)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nosso Serviço */}
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-2">
                      🟢 Nosso Serviço
                    </div>
                    {result.ourService && (
                      <div className="space-y-1">
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">Price:</span>{' '}
                          <span className="font-bold">${result.ourService.price.toFixed(6)}</span>
                        </div>
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">Change:</span>{' '}
                          <span className={`font-bold ${
                            result.ourService.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            ${result.ourService.change.toFixed(6)}
                          </span>
                        </div>
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">%:</span>{' '}
                          <span className={`font-bold ${
                            result.ourService.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {result.ourService.changePercent.toFixed(4)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Diferença */}
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-2">
                      📊 Diferença (Δ)
                    </div>
                    {result.差異 && (
                      <div className="space-y-1">
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">ΔPrice:</span>{' '}
                          <span className={`font-bold ${
                            hasDifference ? 'text-yellow-400' : 'text-emerald-400'
                          }`}>
                            ${Math.abs(result.差異.price).toFixed(6)}
                          </span>
                        </div>
                        <div className="text-white font-mono">
                          <span className="text-slate-400 text-xs">Δ%:</span>{' '}
                          <span className={`font-bold ${
                            hasDifference ? 'text-yellow-400' : 'text-emerald-400'
                          }`}>
                            {Math.abs(result.差異.changePercent).toFixed(4)}%
                          </span>
                        </div>
                        {hasDifference ? (
                          <div className="text-xs font-bold text-yellow-300 mt-2">
                            ⚠️ Diferença de {Math.abs(result.差異.changePercent).toFixed(4)}%
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-emerald-300 mt-2">
                            ✅ Valores idênticos!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Valores idênticos</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-slate-400">Diferença detectada (&gt;0.01%)</span>
            </div>
          </div>
          <div className="text-slate-500">
            Atualização manual • Clique em "Atualizar" para refresh
          </div>
        </div>
      </div>
    </div>
  );
};