import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, DollarSign, Percent, X, RefreshCw, AlertTriangle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { useTradingContext } from '../../contexts/TradingContext';

interface PositionSizeCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrice?: number;
}

export function PositionSizeCalculator({ isOpen, onClose, currentPrice = 0 }: PositionSizeCalculatorProps) {
  const { portfolio } = useTradingContext();
  
  // State
  const [accountBalance, setAccountBalance] = useState<number>(portfolio?.equity || 10000);
  const [riskPercentage, setRiskPercentage] = useState<number>(1.0);
  const [stopLossPips, setStopLossPips] = useState<number>(20);
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice || 0);
  const [stopLossPrice, setStopLossPrice] = useState<number>(0);
  
  // Results
  const [positionSize, setPositionSize] = useState<number>(0); // in Lots/Contracts
  const [riskAmount, setRiskAmount] = useState<number>(0);
  const [leverageRequired, setLeverageRequired] = useState<number>(0);

  // Sync with Portfolio
  useEffect(() => {
    if (portfolio?.equity) setAccountBalance(portfolio.equity);
  }, [portfolio?.equity]);

  // Update entry if prop changes
  useEffect(() => {
    if (currentPrice > 0 && entryPrice === 0) setEntryPrice(currentPrice);
  }, [currentPrice]);

  // Calculate Logic
  const calculate = () => {
    // 1. Calculate Risk Amount ($)
    const risk$ = accountBalance * (riskPercentage / 100);
    setRiskAmount(risk$);

    // 2. Determine Stop Loss Distance
    let distance = 0;
    
    // If SL Price is provided, use that
    if (stopLossPrice > 0 && entryPrice > 0) {
        distance = Math.abs(entryPrice - stopLossPrice);
    } else {
        // Otherwise use Pips (Simplified: 1 pip = 1 unit for now, or 0.0001 for forex)
        // For crypto/general, let's treat "pips" as raw price distance for simplicity in this MVP
        distance = stopLossPips; 
    }

    if (distance === 0) return;

    // 3. Calculate Position Size
    // Risk = PositionSize * Distance
    // PositionSize = Risk / Distance
    const rawSize = risk$ / distance;
    
    // Normalize for generic "Contracts" (e.g. 1 BTC, 1 Lot)
    setPositionSize(rawSize);

    // 4. Leverage Calculation
    // Notional Value = Size * Entry
    // Leverage = Notional / Equity
    if (entryPrice > 0) {
        const notional = rawSize * entryPrice;
        setLeverageRequired(notional / accountBalance);
    }
  };

  // Auto-calculate on changes
  useEffect(() => {
    calculate();
  }, [accountBalance, riskPercentage, stopLossPips, entryPrice, stopLossPrice]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <Card className="w-full max-w-md bg-neutral-900 border-purple-500/30 shadow-2xl shadow-purple-900/20">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-purple-400" />
              Calculadora de Risco
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            {/* Account & Risk */}
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-xs text-slate-400">Capital (USD)</Label>
                 <div className="relative">
                   <DollarSign className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                   <Input 
                      type="number" 
                      value={accountBalance} 
                      onChange={(e) => setAccountBalance(Number(e.target.value))}
                      className="pl-8 bg-neutral-950 border-white/10 text-white" 
                   />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label className="text-xs text-slate-400">Risco (%)</Label>
                 <div className="relative">
                   <Percent className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                   <Input 
                      type="number" 
                      value={riskPercentage} 
                      onChange={(e) => setRiskPercentage(Number(e.target.value))}
                      className="pl-8 bg-neutral-950 border-white/10 text-white" 
                   />
                 </div>
               </div>
            </div>

            {/* Slider for Risk */}
            <div>
               <Slider 
                 value={[riskPercentage]} 
                 max={5} 
                 step={0.1} 
                 onValueChange={([v]) => setRiskPercentage(v)}
                 className="py-2"
               />
               <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                 <span>Conservador (0.5%)</span>
                 <span>Agressivo (5.0%)</span>
               </div>
            </div>

            {/* Price Inputs */}
            <div className="space-y-4 pt-4 border-t border-white/10">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-xs text-slate-400">Preço Entrada</Label>
                    <Input 
                        type="number" 
                        value={entryPrice} 
                        onChange={(e) => setEntryPrice(Number(e.target.value))}
                        className="bg-neutral-950 border-white/10 text-white" 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-xs text-slate-400">Stop Loss (Distância)</Label>
                    <Input 
                        type="number" 
                        value={stopLossPips} 
                        onChange={(e) => {
                            setStopLossPips(Number(e.target.value));
                            setStopLossPrice(0); // Reset fixed price mode if editing distance
                        }}
                        className="bg-neutral-950 border-white/10 text-white" 
                    />
                 </div>
               </div>
            </div>

            {/* RESULTS DISPLAY */}
            <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                    <span className="text-sm text-slate-300 font-medium">Tamanho da Posição</span>
                    <span className="text-2xl font-bold text-white font-mono">{positionSize.toFixed(4)} <span className="text-sm text-purple-400">Lots</span></span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <span className="block text-slate-500 mb-1">Perda Máxima ($)</span>
                        <span className="text-red-400 font-bold font-mono">-${riskAmount.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-slate-500 mb-1">Alavancagem Nec.</span>
                        <span className={`font-bold font-mono ${leverageRequired > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {leverageRequired.toFixed(1)}x
                        </span>
                    </div>
                </div>
                
                {leverageRequired > 50 && (
                    <div className="flex items-start gap-2 text-[10px] text-amber-400 bg-amber-900/10 p-2 rounded">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        Atenção: Alavancagem alta detectada. Considere reduzir o tamanho da posição ou aumentar o Stop Loss.
                    </div>
                )}
            </div>

            <Button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold">
               <Target className="w-4 h-4 mr-2" />
               Aplicar Configuração
            </Button>

          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
