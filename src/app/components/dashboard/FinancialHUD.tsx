import React, { useEffect, useState, useMemo, memo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Bot, User, Activity, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTradingContext } from '../../contexts/TradingContext';
import { toast } from 'sonner';

export const FinancialHUD = memo(function FinancialHUD() {
  const { user } = useAuth();
  const { portfolio, activeOrders, houseStats } = useTradingContext(); 
  const [loading, setLoading] = useState(false);
  const [mathUpgradeActive, setMathUpgradeActive] = useState(false);
  
  // Real-time PnL Calculation State - usando useMemo para evitar recalcular
  const startBalance = useMemo(() => 
    portfolio.initialBalance || portfolio.balance, 
    [portfolio.initialBalance, portfolio.balance]
  );
  
  const currentEquity = portfolio.equity;
  const currentBalance = portfolio.balance;
  
  const pnlValue = useMemo(() => 
    currentEquity - startBalance,
    [currentEquity, startBalance]
  );
  
  const pnlPercent = useMemo(() => 
    startBalance > 0 ? (pnlValue / startBalance) * 100 : 0,
    [pnlValue, startBalance]
  );
  
  const isPositive = pnlValue >= 0;
  
  // 🔥 NOVO: Capital Líquido em Aberto (Equity - Balance = P&L Flutuante)
  const floatingPnL = useMemo(() => 
    currentEquity - currentBalance,
    [currentEquity, currentBalance]
  );
  
  const hasOpenPositions = activeOrders.length > 0;

  // Win Rate Calculation (Dynamic)
  const realWinRate = useMemo(() => 
    houseStats.totalTrades > 0 
      ? ((houseStats.totalWins / houseStats.totalTrades) * 100).toFixed(1) 
      : "0.0",
    [houseStats.totalTrades, houseStats.totalWins]
  );

  // ROI Calculation (Total Profit / Initial Invested)
  const initialCapital = portfolio.initialBalance || 100;
  const totalGrowth = useMemo(() => 
    portfolio.equity - initialCapital,
    [portfolio.equity, initialCapital]
  );
  
  const roiPercent = useMemo(() => 
    (totalGrowth / initialCapital) * 100,
    [totalGrowth, initialCapital]
  );
  
  const roiColor = roiPercent >= 0 ? 'text-emerald-400' : 'text-amber-500';

  // Simulate AI "Upgrading" the Math Logic - REMOVIDO TOAST para evitar re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setMathUpgradeActive(true);
      setTimeout(() => setMathUpgradeActive(false), 2000);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Derived Profit Stats
  const aiProfit = useMemo(() => 
    pnlValue > 0 ? pnlValue * 0.8 : 0,
    [pnlValue]
  );
  
  const userProfit = useMemo(() => 
    pnlValue > 0 ? pnlValue * 0.2 : 0,
    [pnlValue]
  );

  if (loading) {
    return <div className="animate-pulse flex gap-4"><div className="h-32 bg-white/5 rounded-xl w-full"></div></div>;
  }

  return (
    <div className="flex gap-4 min-w-max">
      {/* 🔥 CAPITAL LÍQUIDO EM ABERTO - Card Principal Destacado */}
      <div className="bg-gradient-to-br from-blue-950/50 to-purple-950/30 border-2 border-blue-500/40 rounded-xl p-5 relative overflow-hidden group w-[280px] shrink-0 shadow-lg shadow-blue-500/20">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Animated Background Icon */}
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
           <Activity className="w-20 h-20 text-blue-400 transform rotate-12 animate-pulse" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-400/30 shadow-inner">
               <Activity className="w-5 h-5 text-blue-300 animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] text-blue-300 font-bold tracking-wider">CAPITAL LÍQUIDO</p>
              <p className="text-[8px] text-slate-400 font-mono">Em Tempo Real</p>
            </div>
          </div>
          <span className="text-[9px] text-blue-300 font-bold px-2 py-1 bg-blue-500/10 rounded-md border border-blue-400/20 tracking-widest animate-pulse">LIVE</span>
        </div>

        {/* Main Equity Value */}
        <div className="relative z-10 mb-3">
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-1">
            <span>Patrimônio Total</span>
            {mathUpgradeActive && (
               <span className="text-[8px] text-amber-400 animate-pulse font-mono">⚡ UPGRADING</span>
            )}
          </p>
          <div className="flex items-baseline gap-2">
            <p className={`text-4xl font-black tracking-tight ${currentEquity >= startBalance ? 'text-white' : 'text-red-400'}`}>
              {currentEquity.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-400 font-mono">USD</span>
          </div>
        </div>

        {/* Breakdown: Balance vs Floating P&L */}
        <div className="relative z-10 space-y-2 bg-black/20 rounded-lg p-3 border border-white/5">
          {/* Cash Balance */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-mono">💵 Saldo Livre (Cash)</span>
            <span className="text-sm font-bold text-emerald-400">
              {currentBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Floating P&L (Posições Abertas) */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              {hasOpenPositions ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  P&L em Aberto ({activeOrders.length})
                </>
              ) : (
                <>🔒 P&L em Aberto (0)</>
              )}
            </span>
            <span className={`text-sm font-bold ${floatingPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {floatingPnL >= 0 ? '+' : ''}{floatingPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Live Indicator */}
        {hasOpenPositions && (
          <div className="mt-3 relative z-10">
            <div className="flex items-center gap-2 text-[9px] text-blue-300 font-mono">
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
                <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse delay-75" />
                <div className="w-1 h-1 rounded-full bg-blue-300 animate-pulse delay-150" />
              </div>
              <span>Atualizando em tempo real</span>
            </div>
          </div>
        )}
      </div>

      {/* SALDO LIVRE (Balance) */}
      <div className="bg-neutral-950 border border-emerald-500/20 rounded-xl p-4 relative overflow-hidden group w-[240px] shrink-0">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
           <Wallet className="w-16 h-16 text-emerald-500 transform rotate-12" />
        </div>
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
             <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[9px] text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-500/5 rounded border border-emerald-500/10 tracking-widest">CASH</span>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">
            Saldo Disponível
        </p>
        <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-emerald-400 tracking-tight">
            {currentBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
            </p>
        </div>
        <p className="text-[9px] text-slate-500 mt-1 font-mono">
          Livre para novas operações
        </p>
      </div>
      
      {/* Total Equity (Real-time) - REMOVIDO, agora está no card principal */}

      {/* Session P&L */}
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-4 relative overflow-hidden group w-[240px] shrink-0">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
           {isPositive ? (
             <TrendingUp className="w-16 h-16 text-emerald-500 transform rotate-12" />
           ) : (
             <TrendingDown className="w-16 h-16 text-amber-500 transform rotate-12" />
           )}
        </div>
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className={`p-1.5 rounded-lg border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
            {isPositive ? (
              <TrendingUp className={`w-4 h-4 ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`} />
            ) : (
              <TrendingDown className={`w-4 h-4 ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`} />
            )}
          </div>
          <div className={`flex items-center gap-1 text-xs font-bold ${
            isPositive ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {isPositive ? '+' : ''}{(pnlPercent || 0).toFixed(2)}%
          </div>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Resultado Sessão</p>
        <p className={`text-2xl font-bold tracking-tight ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isPositive ? '+' : ''}{pnlValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* AI vs User Performance */}
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-4 relative overflow-hidden group w-[240px] shrink-0">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
           <Bot className="w-16 h-16 text-purple-500 transform rotate-12" />
        </div>
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="p-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
             <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-[9px] text-purple-400 font-bold px-1.5 py-0.5 bg-purple-500/5 rounded border border-purple-500/10 tracking-widest">AI</span>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Lucro AI Trader</p>
        <p className="text-2xl font-bold text-white tracking-tight">
          +{aiProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
        </p>
        <div className="mt-1 w-full bg-white/5 h-0.5 rounded-full overflow-hidden">
           <div className="h-full bg-purple-500" style={{ width: pnlValue > 0 ? `80%` : '0%' }}></div>
        </div>
      </div>

      {/* User Manual Performance */}
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-4 relative overflow-hidden group w-[240px] shrink-0">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
           <User className="w-16 h-16 text-blue-500 transform rotate-12" />
        </div>
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
             <User className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-[9px] text-blue-400 font-bold px-1.5 py-0.5 bg-blue-500/5 rounded border border-blue-500/10 tracking-widest">MANUAL</span>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Lucro Manual</p>
        <p className="text-2xl font-bold text-white tracking-tight">
          +{userProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
        </p>
        <p className="text-[9px] text-slate-500 mt-1 font-mono tracking-wide">
          {houseStats.totalTrades} TRADES • {realWinRate}% WR • <span className={roiColor}>{roiPercent > 0 ? '+' : ''}{(roiPercent || 0).toFixed(2)}% ROI</span>
        </p>
      </div>
    </div>
  );
});