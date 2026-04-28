/**
 * 🧪 API TESTER - DIAGNÓSTICO DE PREÇOS REAIS
 * 
 * Testa TODAS as APIs e mostra exatamente o que está sendo retornado
 */

import { useState } from 'react';
import { Play, CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface ApiTestResult {
  name: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: any;
  error?: string;
  timestamp?: number;
}

export function ApiTester() {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<ApiTestResult[]>([
    { name: 'Binance BTCUSDT (REAL)', status: 'idle' },
    { name: 'Binance ETHUSDT (REAL)', status: 'idle' },
    { name: 'Yahoo S&P500 (REAL)', status: 'idle' },
    { name: 'Twelve Data EURUSD (REAL)', status: 'idle' },
    { name: 'Unified BTCUSDT (REAL)', status: 'idle' },
    { name: 'Unified SPX (REAL)', status: 'idle' },
  ]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold text-white shadow-2xl z-[200] flex items-center gap-2 border-2 border-emerald-400/50"
      >
        <Play className="w-4 h-4" />
        Testar APIs REAIS
      </button>
    );
  }

  const updateResult = (index: number, update: Partial<ApiTestResult>) => {
    setResults(prev => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...update };
      return newResults;
    });
  };

  const testBinance = async (symbol: string, index: number) => {
    updateResult(index, { status: 'loading' });
    
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      const data = await response.json();
      
      updateResult(index, {
        status: 'success',
        data: {
          price: parseFloat(data.lastPrice),
          change: parseFloat(data.priceChange),
          changePercent: parseFloat(data.priceChangePercent),
          high: parseFloat(data.highPrice),
          low: parseFloat(data.lowPrice),
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      updateResult(index, {
        status: 'error',
        error: error.message
      });
    }
  };

  const testYahooFinance = async (index: number) => {
    updateResult(index, { status: 'loading' });
    
    try {
      const response = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      
      if (!result?.meta) {
        throw new Error('Dados inválidos');
      }
      
      const currentPrice = result.meta.regularMarketPrice;
      const previousClose = result.meta.chartPreviousClose;
      
      updateResult(index, {
        status: 'success',
        data: {
          price: currentPrice,
          previousClose,
          change: currentPrice - previousClose,
          changePercent: ((currentPrice - previousClose) / previousClose) * 100,
          open: result.meta.regularMarketOpen,
          high: result.meta.regularMarketDayHigh,
          low: result.meta.regularMarketDayLow,
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      updateResult(index, {
        status: 'error',
        error: error.message
      });
    }
  };

  const testTwelveData = async (symbol: string, index: number) => {
    updateResult(index, { status: 'loading' });
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/real/twelve/${symbol}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      updateResult(index, {
        status: 'success',
        data,
        timestamp: Date.now()
      });
    } catch (error: any) {
      updateResult(index, {
        status: 'error',
        error: error.message
      });
    }
  };

  const testUnifiedBinance = async (symbol: string, index: number) => {
    updateResult(index, { status: 'loading' });
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/real/binance/${symbol}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      updateResult(index, {
        status: 'success',
        data,
        timestamp: Date.now()
      });
    } catch (error: any) {
      updateResult(index, {
        status: 'error',
        error: error.message
      });
    }
  };

  const testUnifiedYahoo = async (symbol: string, index: number) => {
    updateResult(index, { status: 'loading' });
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/real/yahoo/${symbol}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      updateResult(index, {
        status: 'success',
        data,
        timestamp: Date.now()
      });
    } catch (error: any) {
      updateResult(index, {
        status: 'error',
        error: error.message
      });
    }
  };

  const testAll = () => {
    testBinance('BTCUSDT', 0);
    testBinance('ETHUSDT', 1);
    testYahooFinance(2);
    testTwelveData('EURUSD', 3);
    testUnifiedBinance('BTCUSDT', 4);
    testUnifiedYahoo('^GSPC', 5);
  };

  const testServerDiagnostics = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/diagnostics/test-all`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DIAGNOSTICS:', data);
        alert('Veja o console (F12) para os resultados completos!');
      } else {
        console.error('❌ Erro ao testar:', response.status);
      }
    } catch (error) {
      console.error('❌ Erro:', error);
    }
  };

  return (
    <div className="fixed top-4 right-4 w-[500px] bg-black border border-white/20 rounded-xl p-4 z-[200] max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">🧪 API Tester</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={testServerDiagnostics}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-bold text-white transition-colors"
          >
            🔍 Diagnóstico Servidor
          </button>
          <button
            onClick={testAll}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold text-white transition-colors"
          >
            <Play className="w-4 h-4" />
            Testar Tudo
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {results.map((result, index) => (
          <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">{result.name}</span>
              {result.status === 'idle' && <AlertCircle className="w-4 h-4 text-gray-500" />}
              {result.status === 'loading' && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {result.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {result.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
            </div>

            {result.status === 'success' && result.data && (
              <pre className="text-xs text-green-400 bg-black/50 p-2 rounded overflow-x-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}

            {result.status === 'error' && (
              <p className="text-xs text-red-400">{result.error}</p>
            )}

            {result.timestamp && (
              <p className="text-[10px] text-gray-500 mt-1">
                {new Date(result.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}