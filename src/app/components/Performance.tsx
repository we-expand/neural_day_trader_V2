import React, { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Calendar, DollarSign, Target, Zap, ArrowLeftRight, Settings, AlertTriangle, Activity } from 'lucide-react';
import { useTradingContext } from '../contexts/TradingContext';
import { SlippageSimulator } from './admin/SlippageSimulator';
import { LatencyBenchmark } from './performance/LatencyBenchmark'; // Added import
import { ErrorBoundary } from './ErrorBoundary';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

const periods: { value: Period; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1A' },
  { value: 'all', label: 'MAX' },
];

export function Performance() {
  const { portfolio, houseStats, activeOrders, tradeHistory } = useTradingContext();
  const [period, setPeriod] = useState<Period>('30d');
  const [mounted, setMounted] = useState(false);
  
  // Simulation State
  const [showSimulator, setShowSimulator] = useState(false);

  // SAFE GUARDS (Moved to top level)
  const safePortfolio = React.useMemo(() => ({
    equity: Number(portfolio?.equity) || 0,
    initialBalance: Number(portfolio?.initialBalance) || 100,
    balance: Number(portfolio?.balance) || 0
  }), [portfolio]);

  const safeStats = React.useMemo(() => ({
    totalTrades: Number(houseStats?.totalTrades) || 0,
    totalWins: Number(houseStats?.totalWins) || 0,
    grossProfit: Number(houseStats?.grossProfit) || 0,
    grossLoss: Number(houseStats?.grossLoss) || 0
  }), [houseStats]);

  React.useEffect(() => {
    // Delay rendering of charts to ensure container has dimensions
    let timer: any;
    const raf = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          setMounted(true);
        }, 200);
      });
    });

    return () => {
        if (timer) clearTimeout(timer);
        cancelAnimationFrame(raf);
    };
  }, []);

  // Base Data (Computed from History or Mock)
  const baseData = React.useMemo(() => {
    try {
        // Ensure tradeHistory is an array
        const validHistory = Array.isArray(tradeHistory) ? tradeHistory : [];

        if (validHistory.length > 0) {
            // REAL DATA MODE
            // Filter out invalid entries and Sort by timestamp descending
            const sorted = [...validHistory]
                .filter(t => t && typeof t === 'object' && t.timestamp && !isNaN(Number(t.timestamp)))
                .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
            
            const trades = sorted.map(t => {
                const profit = Number(t.currentProfit) || 0;
                const amount = Number(t.amount) || 0;
                const leverage = Number(t.leverage) || 0;
                
                let dateStr = '--:--';
                try {
                    const d = new Date(Number(t.timestamp));
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }
                } catch (e) {
                    console.warn("Date parse error", e);
                }

                return {
                    id: t.id || Math.random(),
                    date: dateStr,
                    asset: t.symbol || 'Unknown',
                    type: t.side === 'LONG' ? 'BUY' : 'SELL',
                    result: profit >= 0 ? 'WIN' : 'LOSS',
                    profit: profit,
                    roi: (amount && leverage) ? (profit / (amount * leverage)) * 100 : 0
                };
            });

            // Equity Curve Construction
            let runningBalance = safePortfolio.initialBalance;
            if (isNaN(runningBalance)) runningBalance = 100;

            const equity = [];
            
            // Add start point
            equity.push({
                date: 'Inicio',
                balance: runningBalance,
                ai: runningBalance,
                manual: runningBalance
            });

            // Add points for each trade (simplified)
            // Sort ascending for curve
            const chronological = [...validHistory]
                .filter(t => t && typeof t === 'object' && t.timestamp && !isNaN(Number(t.timestamp)))
                .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
            
            chronological.forEach((t) => {
                 const p = Number(t.currentProfit) || 0;
                 if (!isNaN(p)) {
                     runningBalance += p;
                 }
                 
                 let dateStr = '.';
                 try {
                     const d = new Date(Number(t.timestamp));
                     if (!isNaN(d.getTime())) {
                         dateStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                     }
                 } catch (e) {}

                 equity.push({
                     date: dateStr,
                     balance: runningBalance,
                     ai: runningBalance, // Assuming all AI
                     manual: runningBalance // Placeholder
                 });
            });
            
            // Fill to at least 10 points for chart look
            while(equity.length < 10) {
                 equity.push({ ...equity[equity.length-1], date: '.' });
            }

            return { equity, trades };

        } else {
             // ✅ SEM TRADES: Retornar dados vazios ao invés de mockados
             const equity = [
                 { date: 'Inicio', balance: safePortfolio.initialBalance || 100, ai: 100, manual: 100 }
             ];
             
             // Preencher 10 pontos para o gráfico não ficar vazio
             for (let i = 1; i < 10; i++) {
                 equity.push({ ...equity[0], date: '.' });
             }
             
             return { equity, trades: [] }; // ✅ Array vazio de trades
        }
    } catch (err) {
        // ✅ FALLBACK: Dados vazios ao invés de mockados
        const equity = [
            { date: 'Inicio', balance: safePortfolio.initialBalance || 100, ai: 100, manual: 100 }
        ];
        
        // Preencher 10 pontos para o gráfico não ficar vazio
        for (let i = 1; i < 10; i++) {
            equity.push({ ...equity[0], date: '.' });
        }
        
        return { equity, trades: [] }; // ✅ Array vazio de trades
    }
  }, [tradeHistory, safePortfolio.initialBalance]);

  // Computed Data based on Simulation
  const { simulatedEquity } = React.useMemo(() => {
    // Basic equity curve without real-time slippage modification on this chart
    // The advanced simulator handles its own visualization
    return { 
      simulatedEquity: baseData.equity
    };
  }, [baseData]);

  const monthlyReturns = [
    { month: 'Jan', return: 8.5 },
    { month: 'Fev', return: -2.3 },
    { month: 'Mar', return: 12.7 },
    { month: 'Abr', return: 5.2 },
    { month: 'Mai', return: 15.8 },
    { month: 'Jun', return: 3.4 },
    { month: 'Jul', return: 9.1 },
    { month: 'Ago', return: -1.5 },
    { month: 'Set', return: 11.3 },
    { month: 'Out', return: 7.8 },
    { month: 'Nov', return: 14.2 },
    { month: 'Dez', return: 6.5 },
  ];

  const assetDistribution = [
    { name: 'Forex', value: 45, color: '#10b981' },
    { name: 'Ações', value: 25, color: '#3b82f6' },
    { name: 'Índices', value: 20, color: '#f59e0b' },
    { name: 'Cripto', value: 10, color: '#8b5cf6' },
  ];

  // Real Metrics Calculation - Safety Checks
  const initialBalance = safePortfolio.initialBalance;
  const currentEquity = safePortfolio.equity;

  const totalProfit = currentEquity - initialBalance;
  const profitPercentage = initialBalance > 0 
      ? ((currentEquity - initialBalance) / initialBalance) * 100
      : 0;
  
  const winRate = safeStats.totalTrades > 0 
    ? ((safeStats.totalWins / safeStats.totalTrades) * 100) 
    : 0;
    
  const profitFactor = safeStats.grossLoss > 0 
    ? (safeStats.grossProfit / safeStats.grossLoss) 
    : safeStats.grossProfit > 0 ? 100 : 0; // Cap at 100 instead of infinite/99.9 for cleaner UI

  const bestDay = 0; // Requires daily tracking, leaving as 0 or could track separately

  if (!portfolio) {
      return <div className="p-8 text-center text-slate-500">Carregando dados de performance...</div>;
  }

  return (
    <div className="p-8 space-y-8 bg-black min-h-full">
      {/* Header com ícone + título + subtítulo (padrão Marketplace) */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/5">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <TrendingUp className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            Performance Analytics
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Análise Detalhada de Resultados, Métricas e KPIs Profissionais
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-4 items-center">
           <button 
             onClick={() => setShowSimulator(!showSimulator)}
             className={`p-2 rounded-lg border transition-all ${showSimulator ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' : 'border-white/10 text-slate-500 hover:text-white hover:border-white/20'}`}
             title="Simulador de Latência e Slippage"
           >
             <Settings className="w-5 h-5" />
           </button>
           
           <div className="flex gap-1 bg-black border border-white/10 rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  period === p.value
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Simulator Panel */}
      {showSimulator && (
        <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-1 animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <SlippageSimulator />
        </div>
      )}

      {/* Latency Benchmark Section (New) */}
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-6 relative overflow-hidden">
           <ErrorBoundary>
               <LatencyBenchmark />
           </ErrorBoundary>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-950 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-emerald-400 mb-3">
            <div className="p-1.5 bg-emerald-500/10 rounded border border-emerald-500/20">
               <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Lucro Total</span>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight">
            {totalProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
          </p>
          <p className={`text-[10px] mt-2 uppercase tracking-wider font-bold ${profitPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {profitPercentage > 0 ? '+' : ''}{profitPercentage.toFixed(2)}% no período
          </p>
        </div>

        <div className="bg-neutral-950 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-blue-400 mb-3">
            <div className="p-1.5 bg-blue-500/10 rounded border border-blue-500/20">
               <Target className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Win Rate</span>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight">{winRate.toFixed(1)}%</p>
          <p className="text-[10px] text-blue-400 mt-2 uppercase tracking-wider font-bold">
            {safeStats.totalWins} wins de {safeStats.totalTrades} trades
          </p>
        </div>

        <div className="bg-neutral-950 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-purple-400 mb-3">
            <div className="p-1.5 bg-purple-500/10 rounded border border-purple-500/20">
               <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Profit Factor</span>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight">{profitFactor.toFixed(2)}</p>
          <p className="text-[10px] text-purple-400 mt-2 uppercase tracking-wider font-bold">
            Bruto: ${safeStats.grossProfit.toFixed(0)} / Perda: ${safeStats.grossLoss.toFixed(0)}
          </p>
        </div>

        <div className="bg-neutral-950 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-yellow-400 mb-3">
            <div className="p-1.5 bg-yellow-500/10 rounded border border-yellow-500/20">
               <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Melhor Dia</span>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight">$8,400</p>
          <p className="text-[10px] text-yellow-400 mt-2 uppercase tracking-wider font-bold">15 de Dezembro</p>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Curva de Capital</h2>
        <div className="h-[300px] w-full" style={{ minWidth: '100px', minHeight: '300px' }}>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={300}>
              <AreaChart data={simulatedEquity}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorManual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="date" stroke="#525252" tick={{fontSize: 10}} />
                <YAxis stroke="#525252" tick={{fontSize: 10}} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#000',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorBalance)"
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="ai"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorAI)"
                  name="AI Trader"
                />
                <Area
                  type="monotone"
                  dataKey="manual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorManual)"
                  name="Manual"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full bg-white/5 animate-pulse rounded" />
          )}
        </div>
      </div>

      {/* Monthly Returns & Asset Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Returns */}
        <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Retornos Mensais</h2>
          <div className="h-[300px] w-full" style={{ minWidth: '100px', minHeight: '300px' }}>
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={300}>
                <BarChart data={monthlyReturns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="month" stroke="#525252" tick={{fontSize: 10}} />
                  <YAxis stroke="#525252" tick={{fontSize: 10}} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#000',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  />
                  <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                    {monthlyReturns.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.return >= 0 ? '#10b981' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-white/5 animate-pulse rounded" />
            )}
          </div>
        </div>

        {/* Asset Distribution */}
        <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Distribuição por Ativo</h2>
          <div className="h-[300px] flex items-center justify-center w-full" style={{ minWidth: '100px', minHeight: '300px' }}>
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={300}>
                <PieChart>
                  <Pie
                    data={assetDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {assetDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#000',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-white/5 animate-pulse rounded-full" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 border-t border-white/5 pt-4">
            {assetDistribution.map((asset) => (
              <div key={asset.name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: asset.color }}
                />
                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">{asset.name}</span>
                <span className="text-xs font-mono font-bold ml-auto text-white">{asset.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Histórico de Trades</h2>
        
        {baseData.trades.length === 0 ? (
          // ✅ MENSAGEM QUANDO NÃO HÁ TRADES
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">
              Nenhum trade executado ainda
            </p>
            <p className="text-slate-600 text-xs">
              Inicie a AI ou execute operações manuais para ver o histórico
            </p>
          </div>
        ) : (
          // ✅ TABELA DE TRADES (quando houver dados)
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Data/Hora</th>
                  <th className="text-left py-3 px-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ativo</th>
                  <th className="text-left py-3 px-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tipo</th>
                  <th className="text-left py-3 px-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Resultado</th>
                  <th className="text-right py-3 px-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lucro</th>
                  <th className="text-right py-3 px-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">ROI</th>
                </tr>
              </thead>
              <tbody>
                {baseData.trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs text-slate-400 font-mono">{trade.date}</td>
                    <td className="py-3 px-4 text-xs font-bold text-white tracking-wide">{trade.asset}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          trade.type === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          trade.result === 'WIN'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {trade.result}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-sm font-bold font-mono text-right ${
                        trade.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-4 text-sm font-bold font-mono text-right ${
                        trade.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {trade.roi >= 0 ? '+' : ''}{trade.roi.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}