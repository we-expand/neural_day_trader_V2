import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface CorrelatedAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  correlation: number; // -1 to 1
  leadTime: number; // seconds before impact
  isLeading: boolean;
}

interface ButterflyMatrixProps {
  targetSymbol: string;
  onLeadAssetDetected?: (asset: CorrelatedAsset) => void;
}

export const ButterflyMatrix: React.FC<ButterflyMatrixProps> = ({
  targetSymbol,
  onLeadAssetDetected
}) => {
  const [correlatedAssets, setCorrelatedAssets] = useState<CorrelatedAsset[]>([
    {
      symbol: 'US10Y',
      name: 'Tesouro Americano',
      price: 4.225,
      change: 0.018,
      changePercent: 0.43,
      correlation: -0.72,
      leadTime: 15,
      isLeading: false
    },
    {
      symbol: 'DXY',
      name: 'Índice do Dólar',
      price: 103.45,
      change: -0.12,
      changePercent: -0.12,
      correlation: 0.85,
      leadTime: 10,
      isLeading: false
    },
    {
      symbol: 'GOLD',
      name: 'Ouro',
      price: 2042.50,
      change: 5.80,
      changePercent: 0.28,
      correlation: -0.68,
      leadTime: 20,
      isLeading: false
    },
    {
      symbol: 'NIKKEI',
      name: 'Índice Nikkei',
      price: 38420.0,
      change: -185.40,
      changePercent: -0.48,
      correlation: 0.54,
      leadTime: 30,
      isLeading: false
    }
  ]);

  // Simulate real-time price updates and correlation detection
  useEffect(() => {
    const interval = setInterval(() => {
      setCorrelatedAssets(prev => {
        return prev.map(asset => {
          // Random price movement
          const priceChange = (Math.random() - 0.5) * (asset.price * 0.0005);
          const newPrice = asset.price + priceChange;
          const newChange = asset.change + priceChange;
          const newChangePercent = (newChange / asset.price) * 100;
          
          // Detect if asset is leading (significant move)
          const isLeading = Math.abs(newChangePercent) > 0.3 && Math.random() > 0.8;
          
          if (isLeading && !asset.isLeading) {
            // Fire callback when lead asset detected
            const updatedAsset = {
              ...asset,
              price: newPrice,
              change: newChange,
              changePercent: newChangePercent,
              isLeading: true
            };
            onLeadAssetDetected?.(updatedAsset);
          }
          
          return {
            ...asset,
            price: newPrice,
            change: newChange,
            changePercent: newChangePercent,
            isLeading
          };
        });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [onLeadAssetDetected]);

  // Reset leading status after 10 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCorrelatedAssets(prev => 
        prev.map(asset => ({ ...asset, isLeading: false }))
      );
    }, 10000);

    return () => clearTimeout(timeout);
  }, [correlatedAssets]);

  const getCorrelationColor = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs > 0.7) return 'text-purple-400';
    if (abs > 0.5) return 'text-blue-400';
    return 'text-slate-400';
  };

  const getCorrelationStrength = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs > 0.7) return 'Forte';
    if (abs > 0.5) return 'Média';
    return 'Fraca';
  };

  return (
    <div className="bg-gradient-to-br from-purple-950/20 to-black border border-purple-500/30 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-purple-500/20 border border-purple-500/30">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">RADAR DE CORRELAÇÃO</h3>
            <p className="text-[9px] text-slate-400">Butterfly Matrix • Inter-Market</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[9px] font-bold text-purple-400 uppercase">Scanning</span>
        </div>
      </div>

      {/* Correlated Assets Grid */}
      <div className="space-y-2">
        {correlatedAssets.map((asset) => (
          <motion.div
            key={asset.symbol}
            animate={{
              scale: asset.isLeading ? 1.02 : 1,
              borderColor: asset.isLeading ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.05)'
            }}
            transition={{ duration: 0.3 }}
            className={`bg-black/40 border rounded-lg p-2.5 relative overflow-hidden ${
              asset.isLeading ? 'shadow-[0_0_20px_rgba(168,85,247,0.3)]' : ''
            }`}
          >
            {/* Leading Asset Indicator */}
            {asset.isLeading && (
              <motion.div
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse" />
              </motion.div>
            )}

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{asset.symbol}</span>
                <span className="text-[9px] text-slate-400">{asset.name}</span>
              </div>
              
              {asset.isLeading && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase border border-purple-500/30"
                >
                  LEAD ASSET
                </motion.div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-2">
              {/* Price */}
              <div>
                <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Preço</span>
                <span className="text-xs font-mono font-bold text-white">
                  {asset.price.toFixed(asset.symbol === 'US10Y' ? 3 : 2)}
                </span>
              </div>

              {/* Change */}
              <div>
                <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Variação</span>
                <div className="flex items-center gap-1">
                  {asset.changePercent >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-rose-400" />
                  )}
                  <span className={`text-xs font-bold ${
                    asset.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Correlation */}
              <div>
                <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Correlação</span>
                <span className={`text-xs font-bold ${getCorrelationColor(asset.correlation)}`}>
                  {getCorrelationStrength(asset.correlation)} {asset.correlation > 0 ? '↑' : '↓'}
                </span>
              </div>
            </div>

            {/* Correlation Bar */}
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden relative">
              <motion.div
                className={`absolute top-0 h-full ${
                  asset.correlation > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                initial={{ width: 0 }}
                animate={{ 
                  width: `${Math.abs(asset.correlation) * 100}%`,
                  left: asset.correlation > 0 ? '50%' : 'auto',
                  right: asset.correlation < 0 ? '50%' : 'auto'
                }}
                transition={{ duration: 0.5 }}
              />
              <div className="absolute left-1/2 top-0 w-px h-full bg-white/20" />
            </div>

            {/* Lead Time Warning */}
            {asset.isLeading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 pt-2 border-t border-purple-500/20"
              >
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-purple-400 font-bold">
                      Impacto em {targetSymbol} previsto para T-{asset.leadTime}s
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Matrix Summary */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-slate-500">Convergência Inter-Market</span>
          <span className="text-purple-400 font-bold">
            {correlatedAssets.filter(a => a.isLeading).length > 0 ? 'ATIVA' : 'Monitorando...'}
          </span>
        </div>
      </div>
    </div>
  );
};
