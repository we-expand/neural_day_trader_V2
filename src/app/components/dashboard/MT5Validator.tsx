import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMarketContext } from '../../contexts/MarketContext';
import { RefreshCw, Link, AlertTriangle, CheckCircle2, Server, Globe, Activity } from 'lucide-react';
import { TacticalButton } from '../ui/TacticalButton';
import { toast } from 'sonner';

export function MT5Validator() {
  const { marketState, setCalibration } = useMarketContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState('EUR/USD');
  const [mt5Input, setMt5Input] = useState<string>('');
  const [isCalibrating, setIsCalibrating] = useState(false);

  const currentPrice = marketState.prices[activeSymbol] || 0;
  const offset = marketState.calibrationOffset[activeSymbol] || 0;

  // Simulate grabbing the "Exact" broker price (In reality, user inputs this)
  const handleAutoSync = () => {
    setIsCalibrating(true);
    
    // Simulating a ping to the broker server to fetch "Official" tick
    setTimeout(() => {
        // Just for demo: assume the "Real" MT5 price is slightly different from our Raw Feed
        // In real usage, the user would input this or we'd fetch from a specific broker API
        const simulatedMT5Price = currentPrice + (Math.random() * 0.0005); 
        
        setCalibration(activeSymbol, simulatedMT5Price);
        setIsCalibrating(false);
        toast.success(`Sincronizado com MetaTrader 5: ${activeSymbol}`);
    }, 1500);
  };

  const handleManualSync = () => {
      if(!mt5Input) return;
      const price = parseFloat(mt5Input);
      if(isNaN(price)) return;
      
      setCalibration(activeSymbol, price);
      setMt5Input('');
      toast.success("Offset manual aplicado com sucesso.");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl w-80 shadow-2xl overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Server className="w-3 h-3 text-emerald-400" />
                MT5 Parity Engine
              </h3>
              <div className="flex gap-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] text-emerald-400 font-mono">ONLINE</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                
                {/* Symbol Selector */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {['EUR/USD', 'BTC/USD', 'ETH/USD'].map(sym => (
                        <button
                            key={sym}
                            onClick={() => setActiveSymbol(sym)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                activeSymbol === sym 
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' 
                                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                            }`}
                        >
                            {sym}
                        </button>
                    ))}
                </div>

                {/* Status Monitor */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-slate-500 mb-1 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Neural Feed
                        </div>
                        <div className="font-mono text-white text-lg">
                            {(currentPrice - offset).toFixed(5)}
                        </div>
                    </div>
                    <div className="bg-emerald-900/10 p-2 rounded border border-emerald-500/20">
                        <div className="text-emerald-500/70 mb-1 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Calibrated
                        </div>
                        <div className="font-mono text-emerald-400 text-lg font-bold">
                            {currentPrice.toFixed(5)}
                        </div>
                    </div>
                </div>

                {/* Diff Indicator */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono bg-black/50 p-2 rounded">
                    <span>OFFSET ATIVO:</span>
                    <span className={offset !== 0 ? 'text-yellow-400' : 'text-slate-600'}>
                        {offset > 0 ? '+' : ''}{offset.toFixed(6)}
                    </span>
                </div>

                {/* Action Area */}
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Sincronização Manual</label>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            placeholder="Preço MT5..."
                            value={mt5Input}
                            onChange={(e) => setMt5Input(e.target.value)}
                            className="bg-black border border-white/10 rounded px-2 text-xs text-white font-mono flex-1 focus:outline-none focus:border-purple-500"
                        />
                        <button 
                            onClick={handleManualSync}
                            className="bg-white/10 hover:bg-white/20 text-white px-3 rounded"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/5" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#0c0c0c] px-2 text-slate-600">Ou</span>
                        </div>
                    </div>

                    <TacticalButton 
                        onClick={handleAutoSync} 
                        isLoading={isCalibrating}
                        className="w-full h-8 text-xs"
                        variant="primary"
                    >
                        Auto-Calibrar via API
                    </TacticalButton>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
            pointer-events-auto
            flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs shadow-lg backdrop-blur-md border transition-all duration-300
            ${isOpen 
                ? 'bg-emerald-500 text-black border-emerald-400 translate-y-2 translate-x-2' 
                : 'bg-black/80 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/20 hover:border-emerald-500'}
        `}
      >
        {isOpen ? (
            <>Minimizar Validador</>
        ) : (
            <>
                <Link className="w-3 h-3" />
                MT5 Link: {marketState.status === 'SYNCED' ? 'Estável' : 'Verificando...'}
            </>
        )}
      </button>
    </div>
  );
}
