import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';

export function EquityChart() {
  const { portfolio } = useTradingContext();
  const [data, setData] = useState<{ time: string; value: number }[]>([]);
  const [startBalance, setStartBalance] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Wait for mount to avoid SSR issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize with some history or current state
  useEffect(() => {
    if (portfolio?.equity && data.length === 0) {
        setStartBalance(portfolio.initialBalance || portfolio.equity);
        // Create a fake initial history line to look good (flat)
        const initialPoints = [];
        const now = new Date();
        for(let i = 10; i > 0; i--) {
            initialPoints.push({
                time: new Date(now.getTime() - i * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                value: portfolio.initialBalance || portfolio.equity
            });
        }
        setData(initialPoints);
    }
  }, [portfolio, data.length]);

  // Listen for equity updates & Heartbeat
  useEffect(() => {
    if (!portfolio) return;

    const updateChart = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        setData(prev => {
            // Avoid duplicates if called too fast
            const last = prev[prev.length - 1];
            if (last && last.time === timeStr && last.value === portfolio.equity) return prev;

            const newData = [...prev, { time: timeStr, value: portfolio.equity }];
            // Keep last 50 points to avoid memory leak / messy chart
            if (newData.length > 50) return newData.slice(newData.length - 50);
            return newData;
        });
    };

    // Update on change
    updateChart();

    // Heartbeat every 10 seconds to show "Liveness" even if flat
    const interval = setInterval(updateChart, 10000);
    return () => clearInterval(interval);

  }, [portfolio?.equity]);

  if (!portfolio || !mounted) {
    return (
      <div className="w-full h-full bg-neutral-900/50 border border-white/10 rounded-xl p-6 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 text-purple-400 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-slate-400">Carregando gráfico...</p>
        </div>
      </div>
    );
  }

  const currentEquity = portfolio.equity;
  const pl = currentEquity - startBalance;
  const plPercent = startBalance > 0 ? (pl / startBalance) * 100 : 0;
  const isProfit = pl >= 0;

  return (
    <div className="w-full h-full bg-neutral-900/50 border border-white/10 rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-500" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Curva de Capital (Equity)
          </h3>
        </div>
        <div className={`text-xs font-mono font-bold px-3 py-1 rounded ${
          isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {isProfit ? '+' : ''}{pl.toFixed(2)} USD ({plPercent.toFixed(2)}%)
        </div>
      </div>

      {/* Chart */}
      <div className="p-4" style={{ height: '300px' }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="time" 
                tick={{fontSize: 10, fill: '#64748b'}} 
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{fontSize: 10, fill: '#64748b'}} 
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#000', 
                  border: '1px solid #333', 
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                itemStyle={{color: '#fff', fontFamily: 'monospace'}}
                labelStyle={{display: 'none'}}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={isProfit ? "#10b981" : "#ef4444"} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorEquity)" 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-slate-500">Aguardando dados...</p>
          </div>
        )}
      </div>
    </div>
  );
}