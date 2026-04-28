import React, { useState, useEffect } from 'react';
import { Trophy, Target, AlertOctagon, Calendar, CheckCircle2, XCircle, TrendingUp, ShieldAlert, Award, ChevronRight, Lock, Activity, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { useTradingContext } from '../contexts/TradingContext';
import { toast } from 'sonner';

// Types
interface ChallengeConfig {
  id: string;
  name: string;
  initialBalance: number;
  profitTarget: number; // Percentage
  maxDailyLoss: number; // Percentage
  maxTotalLoss: number; // Percentage
  minTradingDays: number;
  durationDays: number; // 0 for unlimited
}

interface ChallengeState {
    status: 'IDLE' | 'ACTIVE' | 'PASSED' | 'FAILED';
    challengeId: string;
    startDate: number;
    startBalance: number;
    highestEquity: number; // For Trailing Drawdown if needed, or just max point
    dailyStartEquity: number;
    lastDayChecked: string; // ISO Date string to reset daily metrics
    tradingDays: number;
    history: { day: number; equity: number }[];
}

const CHALLENGES: ChallengeConfig[] = [
  {
    id: 'std_100k',
    name: "Standard Challenge (100k)",
    initialBalance: 100000,
    profitTarget: 10,
    maxDailyLoss: 5,
    maxTotalLoss: 10,
    minTradingDays: 5,
    durationDays: 30
  },
  {
    id: 'agg_50k',
    name: "Aggressive Mode (50k)",
    initialBalance: 50000,
    profitTarget: 20,
    maxDailyLoss: 10,
    maxTotalLoss: 20,
    minTradingDays: 3,
    durationDays: 0
  },
  {
    id: 'swg_200k',
    name: "Swing Trader (200k)",
    initialBalance: 200000,
    profitTarget: 8,
    maxDailyLoss: 4,
    maxTotalLoss: 8,
    minTradingDays: 5,
    durationDays: 60
  }
];

export function PropChallenge() {
  const { portfolio, activeOrders } = useTradingContext();
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeConfig>(CHALLENGES[0]);
  
  // Persisted State
  const [challengeState, setChallengeState] = useState<ChallengeState>({
      status: 'IDLE',
      challengeId: 'std_100k',
      startDate: 0,
      startBalance: 0,
      highestEquity: 0,
      dailyStartEquity: 0,
      lastDayChecked: '',
      tradingDays: 0,
      history: []
  });

  // Load from Storage on Mount
  useEffect(() => {
      const saved = localStorage.getItem('apex_prop_challenge_v2');
      if (saved) {
          try {
              setChallengeState(JSON.parse(saved));
          } catch(e) { console.error("Failed to load challenge state", e); }
      }
  }, []);

  // Save to Storage on Change
  useEffect(() => {
      if (challengeState.status !== 'IDLE') {
        localStorage.setItem('apex_prop_challenge_v2', JSON.stringify(challengeState));
      }
  }, [challengeState]);

  // --- CORE LOGIC ENGINE ---
  useEffect(() => {
      if (challengeState.status !== 'ACTIVE') return;

      const currentEquity = portfolio.equity;
      const today = new Date().toISOString().split('T')[0];
      
      setChallengeState(prev => {
          let newState = { ...prev };
          let updated = false;

          // 1. Daily Reset Logic
          if (newState.lastDayChecked !== today) {
              newState.lastDayChecked = today;
              newState.dailyStartEquity = currentEquity; // Reset daily reference
              
              // Increment trading days if there was activity yesterday (implied by checking today)
              // Simplified: Increment if orders exist or changed. 
              // Better: Just increment on new day if active.
              if (activeOrders.length > 0 || currentEquity !== newState.history[newState.history.length-1]?.equity) {
                  newState.tradingDays += 1;
              }
              
              // Push history point
              newState.history = [...newState.history, { day: newState.history.length + 1, equity: currentEquity }];
              updated = true;
          }

          // 2. Update Highest Equity (High Water Mark)
          if (currentEquity > newState.highestEquity) {
              newState.highestEquity = currentEquity;
              updated = true;
          }

          // 3. CHECK FAILURE RULES
          const config = CHALLENGES.find(c => c.id === newState.challengeId) || selectedChallenge; 
          
          const dailyDD = ((newState.dailyStartEquity - currentEquity) / newState.dailyStartEquity) * 100;
          const totalDD = ((newState.startBalance - currentEquity) / newState.startBalance) * 100;
          const profitPct = ((currentEquity - newState.startBalance) / newState.startBalance) * 100;

          if (totalDD >= config.maxTotalLoss) {
              newState.status = 'FAILED';
              toast.error("DESAFIO REPROVADO: Limite de Perda Total Atingido!");
              updated = true;
          } else if (dailyDD >= config.maxDailyLoss) {
              newState.status = 'FAILED';
              toast.error("DESAFIO REPROVADO: Limite de Perda Diária Atingido!");
              updated = true;
          } else if (profitPct >= config.profitTarget && newState.tradingDays >= config.minTradingDays) {
              newState.status = 'PASSED';
              toast.success("PARABÉNS! DESAFIO APROVADO!");
              updated = true;
          }

          return updated ? newState : prev;
      });

  }, [portfolio.equity, activeOrders, selectedChallenge]);

  const startChallenge = () => {
      const config = selectedChallenge;
      
      // Use REAL Portfolio Equity as the starting point.
      // This ensures we track performance relative to ACTUAL funds available.
      const startingEquity = portfolio.equity;

      if (startingEquity <= 0) {
          toast.error("Saldo insuficiente para iniciar o desafio.");
          return;
      }
      
      setChallengeState({
          status: 'ACTIVE',
          challengeId: config.id,
          startDate: Date.now(),
          startBalance: startingEquity, 
          highestEquity: startingEquity,
          dailyStartEquity: startingEquity,
          lastDayChecked: new Date().toISOString().split('T')[0],
          tradingDays: 0,
          history: [{ day: 0, equity: startingEquity }]
      });
      toast.success(`Desafio ${config.name} Iniciado!`);
  };

  const resetChallenge = () => {
      setChallengeState({ ...challengeState, status: 'IDLE' });
      localStorage.removeItem('apex_prop_challenge_v2');
  };

  // derived metrics for UI
  const config = CHALLENGES.find(c => c.id === challengeState.challengeId) || selectedChallenge;
  // If active, use simulated equity based on portfolio performance delta?
  // Problem: If I have $50 real dollars, how do I trade a $100k challenge?
  // Solution: Percentage mirroring.
  // We display the $100k numbers, but they are driven by the % change of the real portfolio.
  // Wait, that's complex.
  // Let's Simplify: The "Prop Firm Simulator" tracks the REAL portfolio values.
  // If you have $10,000, you should select a custom challenge or we just track your $10,000.
  // Let's assume the user wants to track their CURRENT REAL portfolio against these rules.
  
  const currentEquity = challengeState.status === 'IDLE' ? portfolio.equity : portfolio.equity; // Always real
  const startBal = challengeState.status === 'IDLE' ? portfolio.equity : challengeState.startBalance;
  
  // IF logic was: "Simulate 100k", we would need to virtualize.
  // User said "Real". Real usually means "My Real Money".
  // So we track the Portfolio Equity against the Rules percentages.
  
  const profit = currentEquity - startBal;
  const profitPercent = (profit / startBal) * 100;
  const dailyPnL = currentEquity - challengeState.dailyStartEquity;
  const dailyDrawdownPercent = challengeState.status === 'IDLE' ? 0 : ((challengeState.dailyStartEquity - currentEquity) / challengeState.dailyStartEquity) * 100;
  const totalDrawdownPercent = challengeState.status === 'IDLE' ? 0 : ((startBal - currentEquity) / startBal) * 100;

  const targetAmount = startBal * (config.profitTarget / 100);
  const maxDailyLossAmount = challengeState.dailyStartEquity * (config.maxDailyLoss / 100);
  const maxTotalLossAmount = startBal * (config.maxTotalLoss / 100);

  // Chart Data Merge
  const displayChartData = challengeState.history.length > 0 
      ? [...challengeState.history, { day: challengeState.history.length + 1, equity: currentEquity }]
      : [{ day: 1, equity: currentEquity }];

  return (
    <div className="p-6 md:p-8 space-y-8 bg-black min-h-full text-slate-200 font-sans pb-24">
      
      {/* Header com ícone + título + subtítulo (padrão Marketplace) */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/5">
        <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
          <Trophy className="w-8 h-8 text-yellow-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            Prop Firm Simulator
            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 ml-2">
                REAL-TIME TRACKING
            </Badge>
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Monitoramento em tempo real da sua performance baseada no saldo atual da carteira
          </p>
        </div>

        <div className="flex items-center gap-4">
           {challengeState.status === 'IDLE' ? (
               <div className="flex items-center gap-4">
                   {/* Challenge Selector */}
                   <div className="relative group">
                      <button className="flex items-center gap-2 bg-neutral-900 border border-white/10 px-4 py-2 rounded-lg text-sm hover:border-emerald-500/50 transition-colors">
                         <span className="text-slate-300">Regras:</span>
                         <span className="font-bold text-emerald-400">{selectedChallenge.name}</span>
                         <ChevronRight className="w-4 h-4 text-slate-500 rotate-90" />
                      </button>
                      <div className="absolute top-full right-0 mt-2 w-64 bg-neutral-900 border border-white/10 rounded-lg shadow-xl p-2 hidden group-hover:block z-50">
                         {CHALLENGES.map((c, i) => (
                            <div 
                              key={i} 
                              onClick={() => setSelectedChallenge(c)}
                              className="p-3 hover:bg-white/5 rounded cursor-pointer transition-colors"
                            >
                               <div className="text-sm font-bold text-white">{c.name}</div>
                               <div className="text-xs text-slate-500">Target: {c.profitTarget}% | Max DD: {c.maxTotalLoss}%</div>
                            </div>
                         ))}
                      </div>
                   </div>
                   <Button onClick={startChallenge} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase">
                       Iniciar Desafio
                   </Button>
               </div>
           ) : (
               <div className="flex items-center gap-4">
                   <div className="text-right">
                       <div className="text-[10px] uppercase text-slate-500 font-bold">Início</div>
                       <div className="text-xs font-mono text-white">{new Date(challengeState.startDate).toLocaleDateString()}</div>
                   </div>
                   <Button onClick={resetChallenge} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                       <RotateCcw className="w-4 h-4 mr-2" />
                       Reiniciar
                   </Button>
               </div>
           )}
        </div>
      </div>

      {/* Status Banner */}
      {challengeState.status === 'FAILED' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-center gap-4"
        >
           <XCircle className="w-10 h-10 text-red-500" />
           <div>
              <h3 className="text-lg font-bold text-red-400 uppercase">Desafio Reprovado</h3>
              <p className="text-slate-400 text-sm">
                  {totalDrawdownPercent >= config.maxTotalLoss ? 'Limite de Perda Total Excedido.' : 'Limite de Perda Diária Excedido.'}
              </p>
           </div>
        </motion.div>
      )}

      {challengeState.status === 'PASSED' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 flex items-center gap-4"
        >
           <Award className="w-10 h-10 text-emerald-400" />
           <div>
              <h3 className="text-lg font-bold text-emerald-400 uppercase">Desafio Aprovado!</h3>
              <p className="text-slate-400 text-sm">Parabéns! Você atingiu a meta respeitando todas as regras de risco.</p>
           </div>
           <Button className="ml-auto bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
             Solicitar Certificado
           </Button>
        </motion.div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         
         {/* Profit Target Card */}
         <Card className="bg-neutral-950 border-white/5">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex justify-between">
                  Meta de Lucro
                  <Target className="w-4 h-4 text-emerald-500" />
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-white">${profit.toFixed(2)}</span>
                  <span className="text-sm text-slate-500">/ ${targetAmount.toFixed(2)}</span>
               </div>
               <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                     <span className={profitPercent >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {profitPercent.toFixed(2)}% Concluído
                     </span>
                     <span className="text-slate-500">Meta: {config.profitTarget}%</span>
                  </div>
                  <Progress value={(profitPercent / config.profitTarget) * 100} className="h-2 bg-white/5" indicatorClassName="bg-emerald-500" />
               </div>
            </CardContent>
         </Card>

         {/* Daily Loss Limit */}
         <Card className="bg-neutral-950 border-white/5 relative overflow-hidden">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex justify-between">
                  Limite de Perda Diária
                  <AlertOctagon className="w-4 h-4 text-orange-500" />
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-baseline gap-2 mb-4">
                  {/* If dailyPnL is positive, loss is 0. If negative, it shows the loss amount */}
                  <span className={`text-3xl font-bold ${dailyPnL < 0 ? 'text-red-400' : 'text-white'}`}>
                     ${Math.min(0, dailyPnL).toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-500">/ -${maxDailyLossAmount.toFixed(2)}</span>
               </div>
               
               <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                     <span className="text-slate-500">Drawdown Atual</span>
                     <span className="text-red-400 font-bold">{Math.max(0, dailyDrawdownPercent).toFixed(2)}%</span>
                  </div>
                  {/* Progress bar fills up as you approach the loss limit */}
                  <Progress 
                    value={(Math.max(0, dailyDrawdownPercent) / config.maxDailyLoss) * 100} 
                    className="h-2 bg-white/5" 
                    indicatorClassName="bg-red-500" 
                  />
                  <p className="text-[10px] text-slate-600 pt-1">Reseta às 00:00 UTC</p>
               </div>
            </CardContent>
         </Card>

         {/* Max Total Drawdown */}
         <Card className="bg-neutral-950 border-white/5">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex justify-between">
                  Perda Máxima Total
                  <ShieldAlert className="w-4 h-4 text-red-600" />
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-baseline gap-2 mb-4">
                   {/* Drawdown is distance from initial balance */}
                  <span className="text-3xl font-bold text-white">
                     -${Math.max(0, startBal - currentEquity).toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-500">/ -${maxTotalLossAmount.toFixed(2)}</span>
               </div>
               
               <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                     <span className="text-slate-500">Permitido Restante</span>
                     <span className="text-slate-300">${(currentEquity - (startBal - maxTotalLossAmount)).toFixed(2)}</span>
                  </div>
                  <Progress 
                    value={(Math.max(0, totalDrawdownPercent) / config.maxTotalLoss) * 100} 
                    className="h-2 bg-white/5" 
                    indicatorClassName="bg-red-600" 
                  />
               </div>
            </CardContent>
         </Card>
      </div>

      {/* Equity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-neutral-950 border border-white/5 rounded-xl p-6">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Curva de Equity (Ao Vivo)
                </h3>
                <div className="flex gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        {challengeState.status}
                    </Badge>
                </div>
             </div>
             
             <div className="h-[300px] w-full" style={{ minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={250}>
                  <AreaChart data={displayChartData}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="day" stroke="#525252" tick={{fontSize: 10}} tickFormatter={(val) => `D${val}`} />
                    <YAxis domain={['auto', 'auto']} stroke="#525252" tick={{fontSize: 10}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(val: number) => [`$${val.toFixed(2)}`, 'Equity']}
                    />
                    <ReferenceLine y={startBal} stroke="#666" strokeDasharray="3 3" />
                    <ReferenceLine y={startBal + targetAmount} stroke="#10b981" label={{ value: 'TARGET', fill: '#10b981', fontSize: 10, position: 'right' }} />
                    <ReferenceLine y={startBal - maxTotalLossAmount} stroke="#ef4444" label={{ value: 'MAX LOSS', fill: '#ef4444', fontSize: 10, position: 'right' }} />
                    
                    <Area type="monotone" dataKey="equity" stroke="#10b981" fillOpacity={1} fill="url(#colorEquity)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
         </div>

         {/* Rules Checklist */}
         <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Regras & Objetivos
            </h3>
            
            <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1 rounded-full ${challengeState.tradingDays >= config.minTradingDays ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {challengeState.tradingDays >= config.minTradingDays ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">Dias Mínimos de Trading</p>
                        <p className="text-xs text-slate-500">Atual: {challengeState.tradingDays} / Meta: {config.minTradingDays} dias</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1 rounded-full ${profitPercent >= config.profitTarget ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {profitPercent >= config.profitTarget ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">Meta de Lucro ({config.profitTarget}%)</p>
                        <p className="text-xs text-slate-500">Alcance ${(startBal + targetAmount).toLocaleString()} em equity.</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1 rounded-full ${dailyDrawdownPercent < config.maxDailyLoss ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {dailyDrawdownPercent < config.maxDailyLoss ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">Respeitar Max Drawdown Diário</p>
                        <p className="text-xs text-slate-500">Nunca perder mais de {config.maxDailyLoss}% num único dia.</p>
                    </div>
                </div>
                
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1 rounded-full ${totalDrawdownPercent < config.maxTotalLoss ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {totalDrawdownPercent < config.maxTotalLoss ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">Respeitar Perda Total</p>
                        <p className="text-xs text-slate-500">Nunca perder mais de {config.maxTotalLoss}% do saldo inicial.</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5">
                <Button variant="ghost" className="w-full text-slate-500 hover:text-white hover:bg-white/5">
                    Ver Termos Completos
                </Button>
            </div>
         </div>
      </div>
    </div>
  );
}