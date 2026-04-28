/**
 * 📊 SMART DATA EXAMPLE
 * 
 * Exemplo prático de uso do sistema de roteamento e validação de dados.
 * Pode ser usado como referência para integração em outros componentes.
 */

import { useState } from 'react';
import { useSmartMarketData } from '@/app/hooks/useSmartMarketData';
import { DataQualityBadge } from '@/app/components/dashboard/DataQualityBadge';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

export function SmartDataExample() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
  
  // 🎯 Hook que busca dados automaticamente da melhor fonte
  const { data, validation, loading, error, refresh } = useSmartMarketData(selectedSymbol);

  const symbols = [
    { symbol: 'BTCUSD', name: 'Bitcoin', type: 'Crypto' },
    { symbol: 'ETHUSD', name: 'Ethereum', type: 'Crypto' },
    { symbol: 'EURUSD', name: 'EUR/USD', type: 'Forex' },
    { symbol: 'US30', name: 'Dow Jones', type: 'Índice' },
    { symbol: 'SPX500', name: 'S&P 500', type: 'Índice' },
    { symbol: 'XAUUSD', name: 'Ouro', type: 'Commodity' }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          🎯 Sistema Inteligente de Dados de Mercado
        </h1>
        <p className="text-slate-400">
          Roteamento automático para fonte correta + Validação de qualidade em tempo real
        </p>
      </div>

      {/* SELEÇÃO DE SÍMBOLO */}
      <div className="grid grid-cols-3 gap-3">
        {symbols.map(({ symbol, name, type }) => (
          <button
            key={symbol}
            onClick={() => setSelectedSymbol(symbol)}
            className={`p-3 rounded-lg border transition-all ${
              selectedSymbol === symbol
                ? 'bg-cyan-500/20 border-cyan-500/50'
                : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <div className="text-left">
              <div className="text-sm font-bold text-white">{symbol}</div>
              <div className="text-xs text-slate-400">{name}</div>
              <div className="text-[10px] text-slate-500 mt-1">{type}</div>
            </div>
          </button>
        ))}
      </div>

      {/* DADOS PRINCIPAIS */}
      {loading && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 text-center">
          <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-slate-400">Carregando dados de {selectedSymbol}...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
          <p className="text-red-400">❌ Erro: {error.message}</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* CARD PRINCIPAL */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold text-white">
                    ${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  {data.changePercent >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  )}
                </div>
                <div className={`text-sm mt-1 ${data.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {data.changePercent >= 0 ? '+' : ''}
                  {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
                </div>
              </div>

              <button
                onClick={refresh}
                className="p-2 hover:bg-zinc-700 rounded transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* METADADOS */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-700">
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Fonte de Dados</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    data.source === 'binance' ? 'bg-yellow-400' :
                    data.source === 'metaapi' ? 'bg-blue-400' :
                    data.source === 'yahoo' ? 'bg-purple-400' :
                    'bg-slate-400'
                  }`}></div>
                  <span className="text-sm text-white font-medium uppercase">{data.source}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Qualidade</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    data.quality === 'excellent' ? 'bg-green-400' :
                    data.quality === 'good' ? 'bg-blue-400' :
                    data.quality === 'fair' ? 'bg-yellow-400' :
                    'bg-red-400'
                  }`}></div>
                  <span className="text-sm text-white font-medium capitalize">{data.quality}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Fallback Usado</p>
                <span className={`text-sm font-medium ${data.fallbackUsed ? 'text-yellow-400' : 'text-green-400'}`}>
                  {data.fallbackUsed ? 'Sim' : 'Não'}
                </span>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Timestamp</p>
                <span className="text-sm text-white">
                  {new Date(data.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* VALIDAÇÃO DE QUALIDADE */}
          {validation && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
              <h3 className="text-sm font-bold text-white mb-4 uppercase">Validação de Qualidade</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium uppercase ${
                      validation.status === 'excellent' || validation.status === 'good' ? 'text-green-400' :
                      validation.status === 'acceptable' ? 'text-blue-400' :
                      validation.status === 'warning' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {validation.status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Confiança</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          validation.confidence >= 80 ? 'bg-green-500' :
                          validation.confidence >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${validation.confidence}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-white font-medium">{validation.confidence}%</span>
                  </div>
                </div>

                {validation.discrepancy > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 uppercase mb-1">Discrepância entre Fontes</p>
                    <span className={`text-sm font-medium ${
                      validation.discrepancy < 1 ? 'text-green-400' :
                      validation.discrepancy < 5 ? 'text-blue-400' :
                      validation.discrepancy < 10 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {validation.discrepancy.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              {/* RECOMENDAÇÃO */}
              <div className="mt-4 p-3 bg-zinc-900 rounded border border-zinc-700">
                <p className="text-xs text-slate-400">{validation.recommendation}</p>
              </div>

              {/* ISSUES */}
              {validation.issues.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-500 uppercase">Issues Detectados</p>
                  {validation.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs border ${
                        issue.severity === 'error'
                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : issue.severity === 'warning'
                          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      }`}
                    >
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}

              {/* FONTE ALTERNATIVA */}
              {validation.alternative && (
                <div className="mt-4 p-3 bg-zinc-900 rounded border border-zinc-700">
                  <p className="text-xs text-slate-500 uppercase mb-2">Fonte Alternativa</p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Fonte:</span>
                      <span className="ml-2 text-white font-medium uppercase">{validation.alternative.source}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Preço:</span>
                      <span className="ml-2 text-white font-medium">${validation.alternative.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BADGE COMPACTO (EXEMPLO) */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
            <h3 className="text-sm font-bold text-white mb-3 uppercase">Badge Compacto (Para UI)</h3>
            <DataQualityBadge symbol={selectedSymbol} compact={true} />
          </div>
        </div>
      )}

      {/* INFO */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-bold text-blue-400 mb-2">ℹ️ Como Funciona</h4>
        <ul className="text-xs text-blue-300 space-y-1">
          <li>✅ Roteamento automático: Crypto → Binance, Forex/Índices → MT5/Yahoo</li>
          <li>✅ Fallback inteligente: Se fonte primária falhar, usa alternativa</li>
          <li>✅ Validação contínua: Compara dados entre fontes</li>
          <li>✅ Alertas automáticos: Notifica se discrepância > 5%</li>
        </ul>
      </div>
    </div>
  );
}
