import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, RefreshCw, Zap } from 'lucide-react';

interface PriceComparison {
  symbol: string;
  ourPrice: number;
  binancePrice: number;
  difference: number;
  differencePercent: number;
  status: 'perfect' | 'good' | 'warning' | 'critical';
  lastUpdate: Date;
  source: string;
}

interface AccuracyThresholds {
  perfect: number;    // < 0.01% = Verde
  good: number;       // < 0.1% = Amarelo
  warning: number;    // < 0.5% = Laranja
  critical: number;   // >= 0.5% = Vermelho
}

const THRESHOLDS: AccuracyThresholds = {
  perfect: 0.01,
  good: 0.1,
  warning: 0.5,
  critical: 0.5
};

// 🎯 Símbolos prioritários para teste
const PRIORITY_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'LTCUSDT'
];

export function PriceAccuracyMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 🔥 Buscar preço DIRETO da Binance (fonte de verdade)
  const fetchBinancePrice = async (symbol: string): Promise<number> => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      const data = await response.json();
      return parseFloat(data.lastPrice);
    } catch (error) {
      console.error(`[PriceMonitor] ❌ Erro ao buscar ${symbol}:`, error);
      return 0;
    }
  };

  // 🎯 Buscar preço da NOSSA plataforma
  const fetchOurPrice = async (symbol: string): Promise<{ price: number; source: string }> => {
    try {
      // Importar dinamicamente para evitar loop
      const { getUnifiedMarketData } = await import('@/app/services/UnifiedMarketDataService');
      const data = await getUnifiedMarketData(symbol);
      return { price: data.price, source: data.source };
    } catch (error) {
      console.error(`[PriceMonitor] ❌ Erro ao buscar nosso preço de ${symbol}:`, error);
      return { price: 0, source: 'error' };
    }
  };

  // 📊 Comparar preços
  const comparePrice = (ourPrice: number, binancePrice: number, symbol: string, source: string): PriceComparison => {
    const difference = ourPrice - binancePrice;
    const differencePercent = Math.abs((difference / binancePrice) * 100);

    let status: 'perfect' | 'good' | 'warning' | 'critical';
    if (differencePercent < THRESHOLDS.perfect) {
      status = 'perfect';
    } else if (differencePercent < THRESHOLDS.good) {
      status = 'good';
    } else if (differencePercent < THRESHOLDS.warning) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      symbol,
      ourPrice,
      binancePrice,
      difference,
      differencePercent,
      status,
      lastUpdate: new Date(),
      source
    };
  };

  // 🔄 Executar testes
  const runTests = async () => {
    setIsRunning(true);
    console.log('[PriceMonitor] 🚀 Iniciando testes de precisão...');

    const results: PriceComparison[] = [];

    for (const symbol of PRIORITY_SYMBOLS) {
      try {
        // Buscar ambos os preços em paralelo
        const [binancePrice, ourData] = await Promise.all([
          fetchBinancePrice(symbol),
          fetchOurPrice(symbol)
        ]);

        if (binancePrice > 0 && ourData.price > 0) {
          const comparison = comparePrice(ourData.price, binancePrice, symbol, ourData.source);
          results.push(comparison);

          console.log(`[PriceMonitor] ${symbol}:`, {
            binance: binancePrice.toFixed(2),
            ours: ourData.price.toFixed(2),
            diff: comparison.differencePercent.toFixed(4) + '%',
            status: comparison.status
          });
        }
      } catch (error) {
        console.error(`[PriceMonitor] ❌ Erro ao testar ${symbol}:`, error);
      }
    }

    setComparisons(results);
    setIsRunning(false);
    console.log('[PriceMonitor] ✅ Testes concluídos!');
  };

  // 🔄 Auto-refresh
  useEffect(() => {
    if (autoRefresh && isOpen) {
      runTests(); // Executar imediatamente
      intervalRef.current = setInterval(runTests, 1500); // 🚀 OTIMIZADO: A cada 1.5 segundos (foi 5s)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, isOpen]);

  // 🎨 Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'perfect': return 'text-green-400';
      case 'good': return 'text-yellow-400';
      case 'warning': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'perfect': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'good': return <CheckCircle className="w-4 h-4 text-yellow-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return null;
    }
  };

  // 📊 Estatísticas
  const stats = {
    total: comparisons.length,
    perfect: comparisons.filter(c => c.status === 'perfect').length,
    good: comparisons.filter(c => c.status === 'good').length,
    warning: comparisons.filter(c => c.status === 'warning').length,
    critical: comparisons.filter(c => c.status === 'critical').length,
    avgDiff: comparisons.length > 0
      ? comparisons.reduce((sum, c) => sum + c.differencePercent, 0) / comparisons.length
      : 0
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
      >
        <Zap className="w-4 h-4" />
        Price Monitor
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6" />
              Price Accuracy Monitor
            </h2>
            <p className="text-white/80 text-sm mt-1">
              Teste de precisão em tempo real - Neural Day Trader vs Binance
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={runTests}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Testando...' : 'Rodar Testes'}
            </button>
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Auto-refresh (1.5s)</span>
            </label>
          </div>
          <div className="text-sm text-gray-400">
            Última atualização: {comparisons[0]?.lastUpdate.toLocaleTimeString() || '-'}
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 bg-[#242424] grid grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.perfect}</div>
            <div className="text-xs text-gray-400">Perfect</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.good}</div>
            <div className="text-xs text-gray-400">Good</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{stats.warning}</div>
            <div className="text-xs text-gray-400">Warning</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
            <div className="text-xs text-gray-400">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.avgDiff.toFixed(4)}%</div>
            <div className="text-xs text-gray-400">Média Diff</div>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-[#242424] sticky top-0">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">Símbolo</th>
                <th className="text-right p-3 text-xs font-medium text-gray-400 uppercase">Binance</th>
                <th className="text-right p-3 text-xs font-medium text-gray-400 uppercase">Neural DT</th>
                <th className="text-right p-3 text-xs font-medium text-gray-400 uppercase">Diferença</th>
                <th className="text-right p-3 text-xs font-medium text-gray-400 uppercase">%</th>
                <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((comp, idx) => (
                <tr
                  key={comp.symbol}
                  className={`border-t border-gray-700/50 hover:bg-gray-800/30 transition-colors ${
                    idx % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#1f1f1f]'
                  }`}
                >
                  <td className="p-3">
                    {getStatusIcon(comp.status)}
                  </td>
                  <td className="p-3">
                    <span className="font-mono font-medium text-white">{comp.symbol}</span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-white">${comp.binancePrice.toFixed(2)}</span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-white">${comp.ourPrice.toFixed(2)}</span>
                  </td>
                  <td className={`p-3 text-right font-mono ${comp.difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {comp.difference >= 0 ? '+' : ''}{comp.difference.toFixed(2)}
                  </td>
                  <td className={`p-3 text-right font-mono font-bold ${getStatusColor(comp.status)}`}>
                    {comp.differencePercent.toFixed(4)}%
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      comp.source === 'binance' ? 'bg-green-600/20 text-green-400' :
                      comp.source === 'cache' ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-gray-600/20 text-gray-400'
                    }`}>
                      {comp.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {comparisons.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Clique em "Rodar Testes" para começar</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 bg-[#242424] border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span>Perfect (&lt;0.01%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span>Good (&lt;0.1%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-400"></div>
              <span>Warning (&lt;0.5%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <span>Critical (&gt;=0.5%)</span>
            </div>
          </div>
          <div>
            Testando: {PRIORITY_SYMBOLS.length} símbolos prioritários
          </div>
        </div>
      </div>
    </div>
  );
}