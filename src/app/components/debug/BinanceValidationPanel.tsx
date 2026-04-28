import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { getBinanceRawData, validateAgainstBinance, type BinanceTickerData, type ValidationResult } from '@/app/utils/binanceValidator';

interface Props {
  symbol: string;
  appPrice: number;
  appChange: number;
  appChangePercent: number;
}

export function BinanceValidationPanel({ symbol, appPrice, appChange, appChangePercent }: Props) {
  const [binanceData, setBinanceData] = useState<BinanceTickerData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const runValidation = async () => {
    setLoading(true);
    
    try {
      // Buscar dados da Binance
      const data = await getBinanceRawData(symbol);
      setBinanceData(data);

      // Validar contra app
      const result = await validateAgainstBinance(symbol, appPrice, appChange, appChangePercent);
      setValidation(result);
      
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (error: any) {
      console.error('[ValidationPanel] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runValidation();
    const interval = setInterval(runValidation, 3000); // Validar a cada 3s
    return () => clearInterval(interval);
  }, [symbol, appPrice, appChange, appChangePercent]);

  if (!binanceData || !validation) {
    return (
      <div className="fixed bottom-4 left-4 w-[500px] bg-black border border-yellow-500 rounded-lg p-4 shadow-2xl z-30">
        <div className="text-center text-gray-400">Loading validation...</div>
      </div>
    );
  }

  const isValid = validation.isValid;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <div className={`fixed bottom-4 left-4 w-[600px] border rounded-lg p-4 shadow-2xl z-30 ${
      isValid 
        ? 'bg-emerald-950/90 border-emerald-500' 
        : 'bg-red-950/90 border-red-500'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-bold flex items-center gap-2 ${
          isValid ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {isValid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          BINANCE VALIDATION - {symbol}
        </h3>
        <button
          onClick={runValidation}
          disabled={loading}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isValid ? 'text-emerald-400' : 'text-red-400'} ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="text-[10px] text-gray-400 mb-3">
        Last update: {lastUpdate}
      </div>

      {/* Comparação Lado a Lado */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* BINANCE (SOURCE OF TRUTH) */}
        <div className="bg-black/40 border border-emerald-500/30 rounded p-3">
          <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            BINANCE (Truth)
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400">Price:</span>
              <span className="text-sm text-white font-mono font-bold">
                ${binanceData.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400">Change $:</span>
              <span className={`text-sm font-mono font-bold ${binanceData.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {binanceData.priceChange >= 0 ? '+' : ''}{binanceData.priceChange.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400">Change %:</span>
              <span className={`text-sm font-mono font-bold ${binanceData.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {binanceData.priceChangePercent >= 0 ? '+' : ''}{binanceData.priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* APP (UNDER TEST) */}
        <div className={`bg-black/40 border rounded p-3 ${
          isValid ? 'border-emerald-500/30' : 'border-red-500/50'
        }`}>
          <div className={`text-xs font-bold mb-2 flex items-center gap-1 ${
            isValid ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {isValid ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            APP (Test)
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400">Price:</span>
              <span className={`text-sm font-mono font-bold ${
                Math.abs(binanceData.lastPrice - appPrice) < 1 ? 'text-white' : 'text-red-400'
              }`}>
                ${appPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400">Change $:</span>
              <span className={`text-sm font-mono font-bold ${
                Math.abs(binanceData.priceChange - appChange) < 0.01 
                  ? (appChange >= 0 ? 'text-emerald-400' : 'text-red-400')
                  : 'text-red-400'
              }`}>
                {appChange >= 0 ? '+' : ''}{appChange.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400">Change %:</span>
              <span className={`text-sm font-mono font-bold ${
                Math.abs(binanceData.priceChangePercent - appChangePercent) < 0.01
                  ? (appChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400')
                  : 'text-red-400'
              }`}>
                {appChangePercent >= 0 ? '+' : ''}{appChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Discrepâncias */}
      <div className={`border rounded p-2 mb-3 ${
        isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="text-xs font-bold text-white mb-1">Discrepancy Analysis:</div>
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-gray-400">Price Diff:</span>
            <span className={`font-mono font-bold ${
              validation.discrepancy.priceDiff < 1 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {validation.discrepancy.priceDiff.toFixed(2)} 
              ({((validation.discrepancy.priceDiff / binanceData.lastPrice) * 100).toFixed(4)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Change $ Diff:</span>
            <span className={`font-mono font-bold ${
              validation.discrepancy.changeDiff < 0.01 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {validation.discrepancy.changeDiff.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Change % Diff:</span>
            <span className={`font-mono font-bold ${
              validation.discrepancy.changePercentDiff < 0.01 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {validation.discrepancy.changePercentDiff.toFixed(4)}%
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">Warnings:</span>
          </div>
          <div className="space-y-1">
            {validation.warnings.map((warning, idx) => (
              <div key={idx} className="text-[10px] text-yellow-300">
                • {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`text-center text-xs font-bold mt-3 pt-2 border-t ${
        isValid 
          ? 'border-emerald-500/30 text-emerald-400' 
          : 'border-red-500/30 text-red-400'
      }`}>
        {isValid ? '✅ VALUES MATCH BINANCE' : '❌ VALUES DO NOT MATCH BINANCE'}
      </div>
    </div>
  );
}