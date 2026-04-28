import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BoxSelect, ArrowUp, ArrowDown, Target, Zap } from 'lucide-react';
import { TacticalButton } from '../ui/TacticalButton';
import { useMarketContext } from '../../contexts/MarketContext';
import { toast } from 'sonner';

interface BoxBuilderProps {
  symbol: string;
  onApply: (box: { high: number; low: number; type: 'BREAKOUT' | 'BOUNCE' }) => void;
}

export function BoxBuilder({ symbol, onApply }: BoxBuilderProps) {
  const { marketState } = useMarketContext();
  const currentPrice = marketState.prices[symbol] || 0;
  
  // Default range around current price
  const [highPrice, setHighPrice] = useState<number>(0);
  const [lowPrice, setLowPrice] = useState<number>(0);
  const [strategyType, setStrategyType] = useState<'BREAKOUT' | 'BOUNCE'>('BREAKOUT');

  // Initialize prices when symbol loads
  useEffect(() => {
    if (currentPrice > 0 && highPrice === 0) {
      const spread = symbol.includes('JPY') ? 0.20 : 0.0020;
      setHighPrice(currentPrice + spread);
      setLowPrice(currentPrice - spread);
    }
  }, [currentPrice, symbol]);

  const rangePoints = ((highPrice - lowPrice) * (symbol.includes('JPY') ? 100 : 10000)).toFixed(1);
  const isPriceInside = currentPrice <= highPrice && currentPrice >= lowPrice;

  const handleDeploy = () => {
    if (highPrice <= lowPrice) {
      toast.error("O preço Superior deve ser maior que o Inferior.");
      return;
    }
    
    // Haptic feedback simulation via Toast
    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-bold">Estratégia BOX Ativada</span>
        <span className="text-xs text-slate-400">Monitorando ruptura de {highPrice.toFixed(5)} / {lowPrice.toFixed(5)}</span>
      </div>
    );
    
    onApply({ high: highPrice, low: lowPrice, type: strategyType });
  };

  return (
    <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-6 relative overflow-hidden group">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px] opacity-20 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <BoxSelect className="w-5 h-5 text-purple-400" />
                Configurador de Box
            </h3>
            <div className="flex bg-black p-1 rounded-lg border border-white/10">
                <button 
                    onClick={() => setStrategyType('BREAKOUT')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${strategyType === 'BREAKOUT' ? 'bg-purple-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    ROMPIMENTO
                </button>
                <button 
                    onClick={() => setStrategyType('BOUNCE')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${strategyType === 'BOUNCE' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    RETRAÇÃO
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Visualizer */}
            <div className="relative h-48 bg-black/50 border border-white/10 rounded-lg flex flex-col justify-between p-4">
                {/* Top Line */}
                <div className="border-b-2 border-dashed border-red-500/50 relative group-hover:border-red-500 transition-colors">
                    <span className="absolute -top-5 right-0 text-[10px] text-red-400 font-mono">RESISTÊNCIA (H)</span>
                    <input 
                        type="number" 
                        value={highPrice}
                        onChange={(e) => setHighPrice(parseFloat(e.target.value))}
                        className="bg-transparent text-right w-full text-red-400 font-mono font-bold focus:outline-none"
                    />
                </div>

                {/* Middle Content (Current Price) */}
                <div className="flex items-center justify-center relative">
                    <div className="absolute w-full h-px bg-white/5 top-1/2 -z-10" />
                    <motion.div 
                        animate={{ 
                             y: isPriceInside ? 0 : currentPrice > highPrice ? -20 : 20,
                             scale: isPriceInside ? 1 : 0.9,
                             opacity: isPriceInside ? 1 : 0.5
                        }}
                        className="bg-white/10 px-3 py-1 rounded text-xs font-mono text-slate-300 border border-white/10 backdrop-blur-md"
                    >
                        PREÇO ATUAL: {currentPrice.toFixed(5)}
                    </motion.div>
                </div>

                {/* Bottom Line */}
                <div className="border-t-2 border-dashed border-emerald-500/50 relative group-hover:border-emerald-500 transition-colors">
                    <span className="absolute -bottom-5 right-0 text-[10px] text-emerald-400 font-mono">SUPORTE (L)</span>
                    <input 
                        type="number" 
                        value={lowPrice}
                        onChange={(e) => setLowPrice(parseFloat(e.target.value))}
                        className="bg-transparent text-right w-full text-emerald-400 font-mono font-bold focus:outline-none"
                    />
                </div>
            </div>

            {/* Controls */}
            <div className="space-y-6">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-2">
                    <span>Amplitude (Range):</span>
                    <span className="text-white font-mono">{rangePoints} pts</span>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Ajuste Fino (Pips)</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => { setHighPrice(h => h + 0.0005); setLowPrice(l => l - 0.0005); }}
                            className="bg-white/5 hover:bg-white/10 p-2 rounded text-xs text-slate-300 flex items-center justify-center gap-1 transition-colors"
                        >
                            <ArrowUp className="w-3 h-3" /> Expandir
                        </button>
                        <button 
                            onClick={() => { setHighPrice(h => h - 0.0005); setLowPrice(l => l + 0.0005); }}
                            className="bg-white/5 hover:bg-white/10 p-2 rounded text-xs text-slate-300 flex items-center justify-center gap-1 transition-colors"
                        >
                            <ArrowDown className="w-3 h-3" /> Contrair
                        </button>
                    </div>
                </div>

                <TacticalButton 
                    onClick={handleDeploy} 
                    className="w-full"
                    icon={<Target className="w-4 h-4" />}
                >
                    IMPLANTAR ESTRATÉGIA
                </TacticalButton>
            </div>
        </div>
      </div>
    </div>
  );
}
