import React, { useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, BarChart2, DollarSign, Settings, RefreshCw, Zap, ShieldAlert, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { toast } from 'sonner';

export function SlippageSimulator() {
  const [config, setConfig] = useState({
    spread: 1.5, // pips
    latency: 150, // ms
    slippage: 0.5, // pips
    volatility: 'MEDIUM', // LOW, MEDIUM, HIGH
    lotSize: 1.0,
    trades: 100 // simulation count
  });

  const [results, setResults] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = async () => {
    setIsSimulating(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    const simResults = [];
    let totalSlippageCost = 0;
    let maxSlippage = 0;
    let rejectedTrades = 0;

    const baseSlippage = config.slippage;
    const volMultiplier = config.volatility === 'HIGH' ? 3 : config.volatility === 'MEDIUM' ? 1.5 : 0.8;

    for (let i = 0; i < config.trades; i++) {
        // Random execution delay impact
        const delayImpact = (Math.random() * config.latency) / 1000; // impact in pips
        
        // Random market noise
        const noise = (Math.random() - 0.5) * volMultiplier;
        
        // Calculate realized slippage for this trade
        let currentSlippage = baseSlippage + Math.abs(noise) + (delayImpact * 0.5);
        
        // Occasional huge spike (liquidity gap)
        if (Math.random() > 0.95 && config.volatility === 'HIGH') {
            currentSlippage *= 5; // 5x slippage spike
        }

        // Cost in USD (Standard Lot = $10 per pip)
        const cost = currentSlippage * 10 * config.lotSize;
        
        totalSlippageCost += cost;
        if (currentSlippage > maxSlippage) maxSlippage = currentSlippage;

        // Rejection logic (if slippage > max allowed set by user in a real scenario)
        // Here we simulate "requote" or "off quotes"
        if (currentSlippage > 5.0) rejectedTrades++;

        simResults.push({
            id: i,
            slippage: parseFloat(currentSlippage.toFixed(2)),
            cost: parseFloat(cost.toFixed(2)),
            cumulative: parseFloat(totalSlippageCost.toFixed(2))
        });
    }

    setResults({
        data: simResults,
        summary: {
            totalCost: totalSlippageCost,
            avgSlippage: totalSlippageCost / (config.trades * 10 * config.lotSize),
            maxSlippage,
            rejectedTrades,
            netImpactPct: (totalSlippageCost / (config.trades * 200)) * 100 // Assuming avg trade win is $200
        }
    });

    setIsSimulating(false);
    toast.success("Simulação Concluída", {
        description: `Impacto total calculado: $${totalSlippageCost.toFixed(2)}`
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row gap-6">
            
            {/* CONFIG PANEL */}
            <Card className="w-full md:w-1/3 bg-neutral-900 border-neutral-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-400">
                        <Settings className="w-5 h-5" /> Parâmetros de Execução
                    </CardTitle>
                    <CardDescription>
                        Configure as condições adversas do mercado para testar a resiliência da estratégia.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    {/* Volatility Selector */}
                    <div className="space-y-3">
                        <Label>Volatilidade do Mercado</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {['LOW', 'MEDIUM', 'HIGH'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setConfig({...config, volatility: v as any})}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                                        config.volatility === v 
                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                                        : 'bg-neutral-800 border-transparent text-neutral-400 hover:bg-neutral-700'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <Label>Spread Base (Pips)</Label>
                            <span className="text-xs font-mono text-emerald-400">{config.spread.toFixed(1)}</span>
                        </div>
                        <Slider 
                            value={[config.spread]} 
                            min={0} max={10} step={0.1} 
                            onValueChange={([v]) => setConfig({...config, spread: v})} 
                            className="[&>.relative>.absolute]:bg-emerald-500"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <Label>Latência de Rede (ms)</Label>
                            <span className="text-xs font-mono text-emerald-400">{config.latency}ms</span>
                        </div>
                        <Slider 
                            value={[config.latency]} 
                            min={0} max={1000} step={10} 
                            onValueChange={([v]) => setConfig({...config, latency: v})} 
                            className="[&>.relative>.absolute]:bg-blue-500"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <Label>Slippage Esperado (Pips)</Label>
                            <span className="text-xs font-mono text-emerald-400">{config.slippage.toFixed(1)}</span>
                        </div>
                        <Slider 
                            value={[config.slippage]} 
                            min={0} max={5} step={0.1} 
                            onValueChange={([v]) => setConfig({...config, slippage: v})} 
                            className="[&>.relative>.absolute]:bg-purple-500"
                        />
                    </div>

                    <Button 
                        onClick={runSimulation} 
                        disabled={isSimulating}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold"
                    >
                        {isSimulating ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Processando Monte Carlo...
                            </>
                        ) : (
                            <>
                                <Zap className="w-4 h-4 mr-2" />
                                Executar Simulação
                            </>
                        )}
                    </Button>

                </CardContent>
            </Card>

            {/* RESULTS PANEL */}
            <div className="flex-1 space-y-6">
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-400">Custo Total (Slippage)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-400">
                                {results ? `-$${results.summary.totalCost.toFixed(2)}` : '---'}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">Perda financeira direta</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-400">Pior Execução</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-400">
                                {results ? `${results.summary.maxSlippage.toFixed(1)} pips` : '---'}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">Desvio máximo registrado</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-400">Impacto no Lucro</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-200">
                                {results ? `${results.summary.netImpactPct.toFixed(1)}%` : '---'}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">Redução do ROI estimado</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <Card className="bg-neutral-900 border-neutral-800 flex-1 min-h-[300px]">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-slate-300">Distribuição de Custo Cumulativo</CardTitle>
                        <CardDescription>Como o slippage corrói o lucro ao longo de {config.trades} trades.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                         {results ? (
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={results.data}>
                                    <defs>
                                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="id" hide />
                                    <YAxis stroke="#525252" fontSize={10} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040' }}
                                        labelStyle={{ color: '#a3a3a3' }}
                                    />
                                    <Area type="monotone" dataKey="cumulative" stroke="#f43f5e" fillOpacity={1} fill="url(#colorCost)" />
                                </AreaChart>
                             </ResponsiveContainer>
                         ) : (
                             <div className="h-full flex flex-col items-center justify-center text-neutral-600 border border-dashed border-neutral-800 rounded-lg">
                                 <BarChart2 className="w-10 h-10 mb-2 opacity-20" />
                                 <p className="text-sm">Execute a simulação para visualizar os dados</p>
                             </div>
                         )}
                    </CardContent>
                </Card>

                {/* Insight Box */}
                {results && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
                        <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-blue-400">Análise de IA</h4>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                Com base na simulação, sua estratégia perderia aproximadamente <span className="text-white font-bold">${results.summary.totalCost.toFixed(2)}</span> apenas em custos de execução. 
                                Recomenda-se aumentar o alvo mínimo (Take Profit) para compensar a volatilidade de {config.volatility} ou utilizar ordens Limitadas.
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
}
