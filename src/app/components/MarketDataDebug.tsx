import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/market-data`;
const REAL_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/real`;

export function MarketDataDebug() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const testEndpoint = async (name: string, url: string) => {
    const startTime = Date.now();
    try {
      console.log(`[Debug] Testing ${name}:`, url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;
      const data = await response.json();

      return {
        name,
        status: response.status,
        ok: response.ok,
        duration: `${duration}ms`,
        data: JSON.stringify(data, null, 2).substring(0, 500) + '...',
        error: null,
      };
    } catch (error: any) {
      return {
        name,
        status: 'ERROR',
        ok: false,
        duration: `${Date.now() - startTime}ms`,
        data: null,
        error: error.message,
      };
    }
  };

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);

    const tests = [
      {
        name: '1. ✅ Binance BTCUSDT (REAL)',
        url: `${REAL_API_BASE}/binance/BTCUSDT`,
      },
      {
        name: '2. ✅ Binance ETHUSDT (REAL)',
        url: `${REAL_API_BASE}/binance/ETHUSDT`,
      },
      {
        name: '3. ✅ Yahoo S&P500 (REAL)',
        url: `${REAL_API_BASE}/yahoo/^GSPC`,
      },
      {
        name: '4. ✅ Twelve Data EURUSD (REAL)',
        url: `${REAL_API_BASE}/twelve/EURUSD`,
      },
      {
        name: '5. ✅ Unified BTCUSDT (REAL)',
        url: `${REAL_API_BASE}/price/BTCUSDT`,
      },
      {
        name: '6. ✅ Unified SPX (REAL)',
        url: `${REAL_API_BASE}/price/SPX`,
      },
    ];

    const results = [];
    for (const test of tests) {
      const result = await testEndpoint(test.name, test.url);
      results.push(result);
      setTestResults([...results]);
      
      // Wait 300ms between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setTesting(false);
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[600px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">🔍 Market Data Debug</h3>
        <button
          onClick={runTests}
          disabled={testing}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
        >
          {testing ? '⏳ Testing...' : '🔄 Retest'}
        </button>
      </div>
      
      <div className="overflow-y-auto max-h-[500px] p-4 space-y-3">
        {testResults.length === 0 && testing && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">Running tests...</p>
          </div>
        )}

        {testResults.map((result, i) => (
          <div
            key={i}
            className={`p-3 rounded border ${
              result.ok
                ? 'bg-green-900/20 border-green-700'
                : 'bg-red-900/20 border-red-700'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-bold text-white">{result.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                result.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {result.status}
              </span>
            </div>
            
            <div className="text-xs text-gray-400 mb-2">
              ⏱️ {result.duration}
            </div>

            {result.error && (
              <div className="text-xs text-red-400 bg-red-950/50 p-2 rounded mb-2">
                ❌ {result.error}
              </div>
            )}

            {result.data && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-400 hover:text-white">
                  View Response
                </summary>
                <pre className="mt-2 p-2 bg-black/50 rounded overflow-x-auto text-gray-300">
                  {result.data}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
        💡 Tip: Check console for detailed logs
      </div>
    </div>
  );
}