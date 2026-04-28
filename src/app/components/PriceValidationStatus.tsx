import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { getRealMarketData } from '@/app/services/RealMarketDataService';

interface ValidationStatus {
  price: number;
  source: string;
  isRealData: boolean;
  validated: boolean;
  timestamp: number;
}

export function PriceValidationStatus() {
  const [status, setStatus] = useState<ValidationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      console.log('[ValidationStatus] 🔍 Checking BTC price validation...');
      const data = await getRealMarketData('BTCUSDT');
      
      setStatus({
        price: data.price,
        source: data.source,
        isRealData: data.isRealData,
        validated: data.isRealData,
        timestamp: Date.now()
      });
      setLoading(false);
      
      console.log('[ValidationStatus] ✅ Status updated:', {
        price: data.price,
        validated: data.isRealData,
        source: data.source
      });
    } catch (error) {
      console.error('[ValidationStatus] ❌ Error:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1500); // 🚀 OTIMIZADO: Atualiza a cada 1.5s (foi 5s)
    return () => clearInterval(interval);
  }, []);

  if (loading || !status) return null;

  const isValidated = status.isRealData && status.source === 'binance';
  const isDirectBinance = status.source === 'binance-direct';

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`px-4 py-2.5 rounded-lg border-2 backdrop-blur-sm shadow-xl ${
        isDirectBinance 
          ? 'bg-emerald-950/90 border-emerald-500' 
          : isValidated
          ? 'bg-emerald-950/90 border-emerald-600/50'
          : 'bg-amber-950/90 border-amber-500'
      }`}>
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`p-1.5 rounded ${
            isDirectBinance 
              ? 'bg-emerald-500/20' 
              : isValidated
              ? 'bg-emerald-600/20'
              : 'bg-amber-500/20'
          }`}>
            {isDirectBinance || isValidated ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">BTC/USDT</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                isDirectBinance
                  ? 'bg-emerald-500 text-white'
                  : isValidated
                  ? 'bg-emerald-600/50 text-emerald-200'
                  : 'bg-amber-500 text-white'
              }`}>
                {isDirectBinance ? '🎯 VALIDATED' : isValidated ? 'LIVE' : 'SIMULATED'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white">
                ${status.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-wide">
                {status.source}
              </span>
            </div>
          </div>

          {/* Refresh indicator */}
          <RefreshCw className="w-3 h-3 text-slate-600 opacity-50" />
        </div>

        {/* Info bar */}
        {isDirectBinance && (
          <div className="mt-2 pt-2 border-t border-emerald-500/20">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-400 font-medium">
                Aligned with Binance Direct API
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}