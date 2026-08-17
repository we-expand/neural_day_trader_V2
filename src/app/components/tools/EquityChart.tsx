import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';

function CustomTooltip({ active, payload, isProfit }: any) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0].value as number;
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-950/90 backdrop-blur-md px-3 py-2 shadow-2xl">
      <p className="font-mono text-sm font-semibold text-white tabular-nums">
        ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className={`text-[10px] font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
        {payload[0].payload.time}
      </p>
    </div>
  );
}

export function EquityChart() {
  const { portfolio } = useTradingContext();
  const [data, setData] = useState<{ time: string; value: number }[]>([]);
  const [startBalance, setStartBalance] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (portfolio?.equity && data.length === 0) {
        setStartBalance(portfolio.initialBalance || portfolio.equity);
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

  useEffect(() => {
    if (!portfolio) return;

    const updateChart = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setData(prev => {
            const last = prev[prev.length - 1];
            if (last && last.time === timeStr && last.value === portfolio.equity) return prev;

            const newData = [...prev, { time: timeStr, value: portfolio.equity }];
            if (newData.length > 50) return newData.slice(newData.length - 50);
            return newData;
        });
    };

    updateChart();

    const interval = setInterval(updateChart, 10000);
    return () => clearInterval(interval);

  }, [portfolio?.equity]);

  const { minVal, maxVal } = useMemo(() => {
    if (data.length === 0) return { minVal: 0, maxVal: 0 };
    const values = data.map(d => d.value);
    return { minVal: Math.min(...values), maxVal: Math.max(...values) };
  }, [data]);

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
  const lineColor = isProfit ? '#34d399' : '#f87171';
  const glowColor = isProfit ? '#10b981' : '#ef4444';

  return (
    <div className="w-full h-full relative bg-neutral-950/60 border border-white/10 rounded-xl shadow-xl overflow-hidden">
      {/* Subtle ambient glow backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ background: `radial-gradient(600px 200px at 15% 0%, ${glowColor}, transparent 70%)` }}
      />

      {/* Header */}
      <div className="relative px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isProfit ? 'bg-emerald-400' : 'bg-red-400'} opacity-60`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isProfit ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Curva de Capital (Equity)
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-[10px] text-slate-500 font-mono">
              Máx ${maxVal.toFixed(0)} · Mín ${minVal.toFixed(0)}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${
            isProfit
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isProfit ? '+' : ''}{pl.toFixed(2)} USD ({plPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative p-4" style={{ height: '300px' }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={glowColor} stopOpacity={0.28} />
                  <stop offset="60%" stopColor={glowColor} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={glowColor} stopOpacity={0} />
                </linearGradient>
                <filter id="equityGlow" x="-20%" y="-50%" width="140%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <CartesianGrid strokeDasharray="0" stroke="#ffffff" strokeOpacity={0.04} vertical={false} />

              <ReferenceLine
                y={startBalance}
                stroke="#64748b"
                strokeOpacity={0.35}
                strokeDasharray="4 4"
              />

              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#52525b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#52525b' }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickCount={5}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip
                content={<CustomTooltip isProfit={isProfit} />}
                cursor={{ stroke: '#71717a', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.75}
                fillOpacity={1}
                fill="url(#colorEquity)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: lineColor, stroke: '#000', strokeWidth: 2 }}
                style={{ filter: 'url(#equityGlow)' }}
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
