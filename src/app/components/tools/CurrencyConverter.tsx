import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowRightLeft, DollarSign, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

interface CurrencyConverterProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CurrencyConverter({ isOpen, onClose }: CurrencyConverterProps) {
  const [amount, setAmount] = useState<number>(1);
  const [rate, setRate] = useState<number>(5.80); // Fallback
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Direction: USD -> BRL (true) or BRL -> USD (false)
  const [isUsdToBrl, setIsUsdToBrl] = useState(true);

  const fetchRate = async () => {
    setLoading(true);
    try {
        const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
        const data = await res.json();
        if (data.USDBRL) {
            setRate(parseFloat(data.USDBRL.bid));
            setLastUpdate(new Date());
        }
    } catch (e) {
        console.error("Failed to fetch rate", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchRate();
  }, [isOpen]);

  if (!isOpen) return null;

  const result = isUsdToBrl ? amount * rate : amount / rate;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <Card className="w-full max-w-sm bg-neutral-900 border-emerald-500/30 shadow-2xl shadow-emerald-900/10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-4">
                <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    Conversor Cambial
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-slate-400 hover:text-white">
                    <span className="sr-only">Close</span>
                    ✕
                </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                
                {/* Rate Display */}
                <div className="flex items-center justify-between text-xs text-slate-500 bg-black/40 p-2 rounded border border-white/5">
                    <span>Taxa PTAX (USD/BRL):</span>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 font-bold">{rate.toFixed(4)}</span>
                        <button onClick={fetchRate} disabled={loading} className={`p-1 hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`}>
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">
                            {isUsdToBrl ? 'Valor em Dólar (USD)' : 'Valor em Reais (BRL)'}
                        </Label>
                        <div className="relative">
                             <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                                 {isUsdToBrl ? '$' : 'R$'}
                             </div>
                             <Input 
                                type="number" 
                                value={amount} 
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                className="pl-8 bg-neutral-950 border-white/10 text-white font-mono text-lg"
                             />
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setIsUsdToBrl(!isUsdToBrl)}
                            className="rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
                        >
                            <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                        </Button>
                    </div>

                    <div className="relative">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">
                            {isUsdToBrl ? 'Convertido para Reais (BRL)' : 'Convertido para Dólar (USD)'}
                        </Label>
                        <div className="p-3 bg-emerald-900/10 border border-emerald-500/20 rounded-md text-center">
                             <span className="text-2xl font-bold font-mono text-emerald-400">
                                {isUsdToBrl ? 'R$ ' : '$ '}
                                {result.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                        </div>
                    </div>
                </div>

                <p className="text-[10px] text-slate-600 text-center pt-2">
                    * Cotação comercial aproximada. Atualizado em: {lastUpdate.toLocaleTimeString()}
                </p>

            </CardContent>
        </Card>
    </div>
  );
}
