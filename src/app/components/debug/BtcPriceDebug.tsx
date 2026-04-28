import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export function BtcPriceDebug() {
  const [apiData, setApiData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchBtcPrice = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT`;
      console.log('🔍 Fetching:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📦 Raw data:', data);

      setApiData({
        symbol: data.symbol,
        lastPrice: parseFloat(data.lastPrice),
        openPrice: parseFloat(data.openPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
      });
      
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
      
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBtcPrice();
    const interval = setInterval(fetchBtcPrice, 1500); // 🚀 OTIMIZADO: Atualizar a cada 1.5 segundos (foi 5s)
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-black border border-yellow-500 rounded-lg p-4 shadow-2xl z-[9999]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
          🐛 BTC PRICE DEBUG
        </h3>
        <button
          onClick={fetchBtcPrice}
          disabled={loading}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-yellow-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-300">{error}</div>
        </div>
      )}

      {apiData && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle className="w-3 h-3" />
            <span>API Connected - {lastUpdate}</span>
          </div>

          <div className="bg-white/5 rounded p-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Symbol:</span>
              <span className="text-white font-bold">{apiData.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Current Price:</span>
              <span className="text-white font-bold font-mono">
                ${apiData.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Open Price:</span>
              <span className="text-white font-mono">
                ${apiData.openPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">24h Change:</span>
              <span className={`font-bold font-mono ${apiData.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {apiData.priceChange >= 0 ? '+' : ''}${apiData.priceChange.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">24h Change %:</span>
              <span className={`font-bold font-mono ${apiData.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {apiData.priceChangePercent >= 0 ? '+' : ''}{apiData.priceChangePercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">24h High:</span>
              <span className="text-white font-mono">${apiData.highPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">24h Low:</span>
              <span className="text-white font-mono">${apiData.lowPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">24h Volume:</span>
              <span className="text-white font-mono">{apiData.volume.toFixed(2)} BTC</span>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 text-center pt-2 border-t border-white/10">
            Press F12 to see console logs
          </div>
        </div>
      )}

      {loading && !apiData && (
        <div className="text-center text-gray-400 text-sm py-4">
          Loading...
        </div>
      )}
    </div>
  );
}