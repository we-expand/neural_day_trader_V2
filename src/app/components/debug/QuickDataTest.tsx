/**
 * 🧪 QUICK DATA TEST
 * 
 * Componente de teste rápido para validar o sistema de dados.
 * Útil para debugging e demonstração.
 */

import { useState } from 'react';
import { dataSourceRouter } from '@/app/services/DataSourceRouter';
import { dataQualityMonitor } from '@/app/services/DataQualityMonitor';
import { CheckCircle, XCircle, AlertTriangle, Play } from 'lucide-react';

export function QuickDataTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    
    const testSymbols = [
      { symbol: 'BTCUSD', expected: 'binance', type: 'Crypto' },
      { symbol: 'ETHUSD', expected: 'binance', type: 'Crypto' },
      { symbol: 'EURUSD', expected: 'metaapi', type: 'Forex' },
      { symbol: 'US30', expected: 'yahoo', type: 'Índice' },
      { symbol: 'SPX500', expected: 'yahoo', type: 'Índice' },
      { symbol: 'XAUUSD', expected: 'metaapi', type: 'Commodity' }
    ];

    const testResults = [];

    for (const test of testSymbols) {
      try {
        // 1. Testar roteamento
        const data = await dataSourceRouter.getMarketData(test.symbol);
        
        // 2. Validar qualidade
        const validation = await dataQualityMonitor.validateSymbol(test.symbol);
        
        testResults.push({
          symbol: test.symbol,
          type: test.type,
          expected: test.expected,
          actual: data.source,
          price: data.price,
          quality: validation.status,
          discrepancy: validation.discrepancy,
          passed: validation.status !== 'critical' && data.price > 0,
          message: validation.recommendation
        });
      } catch (error: any) {
        testResults.push({
          symbol: test.symbol,
          type: test.type,
          expected: test.expected,
          actual: 'error',
          price: 0,
          quality: 'critical',
          discrepancy: 0,
          passed: false,
          message: error.message
        });
      }
    }

    setResults(testResults);
    setTesting(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg flex items-center gap-2 transition-colors"
      >
        <Play className="w-4 h-4" />
        <span className="text-sm font-medium">Testar Dados</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 w-[500px] max-h-[600px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Quick Data Test</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-4 space-y-4 max-h-[520px] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Valida roteamento e qualidade de dados
          </p>
          <button
            onClick={runTests}
            disabled={testing}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 text-white rounded text-sm font-medium transition-colors"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Testando...
              </span>
            ) : (
              'Executar Testes'
            )}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            {/* RESUMO */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-green-500/10 border border-green-500/30 rounded">
                <div className="text-lg font-bold text-green-400">
                  {results.filter(r => r.passed).length}
                </div>
                <div className="text-[10px] text-green-400/70 uppercase">Passed</div>
              </div>
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
                <div className="text-lg font-bold text-red-400">
                  {results.filter(r => !r.passed).length}
                </div>
                <div className="text-[10px] text-red-400/70 uppercase">Failed</div>
              </div>
              <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                <div className="text-lg font-bold text-blue-400">
                  {results.length}
                </div>
                <div className="text-[10px] text-blue-400/70 uppercase">Total</div>
              </div>
            </div>

            {/* RESULTADOS */}
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${
                    result.passed
                      ? 'bg-zinc-800 border-zinc-700'
                      : 'bg-red-500/5 border-red-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {result.passed ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-sm font-bold text-white">{result.symbol}</span>
                        <span className="text-xs text-slate-500">{result.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.quality === 'excellent' || result.quality === 'good' ? (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded uppercase">
                          {result.quality}
                        </span>
                      ) : result.quality === 'acceptable' ? (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded uppercase">
                          {result.quality}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded uppercase">
                          {result.quality}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Fonte:</span>
                      <span className={`ml-2 font-medium ${
                        result.actual === result.expected ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {result.actual}
                        {result.actual !== result.expected && (
                          <span className="text-slate-500"> (esperado: {result.expected})</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Preço:</span>
                      <span className="ml-2 text-white font-medium">
                        {result.price > 0 ? `$${result.price.toFixed(2)}` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {result.discrepancy > 0 && (
                    <div className="mt-2 text-xs">
                      <span className="text-slate-500">Discrepância:</span>
                      <span className={`ml-2 font-medium ${
                        result.discrepancy < 1 ? 'text-green-400' :
                        result.discrepancy < 5 ? 'text-blue-400' :
                        'text-yellow-400'
                      }`}>
                        {result.discrepancy.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && !testing && (
          <div className="text-center py-8 text-slate-500 text-sm">
            Clique em "Executar Testes" para iniciar
          </div>
        )}
      </div>
    </div>
  );
}
