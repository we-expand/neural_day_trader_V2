import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, ColorType } from 'lightweight-charts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ChartViewSimpleProps {
  symbol?: string;
}

export function ChartViewSimple({ symbol = 'EURUSD' }: ChartViewSimpleProps) {
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      // Create chart
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#0a0a0a' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: '#1a1a1a' },
          horzLines: { color: '#1a1a1a' },
        },
        timeScale: {
          borderColor: '#2a2a2a',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#f97316',  // 🔥 LARANJA (como no anexo)
        borderUpColor: '#22c55e',
        borderDownColor: '#f97316',  // 🔥 LARANJA
        wickUpColor: '#22c55e',
        wickDownColor: '#f97316',  // 🔥 LARANJA
      });

      // Generate mock data
      const data: CandlestickData[] = [];
      const now = Date.now();
      let price = 1.12;

      for (let i = 300; i >= 0; i--) {
        const timestamp = now - (i * 3600000);
        const open = price;
        const close = price + (Math.random() - 0.5) * 0.002;
        const high = Math.max(open, close) + Math.random() * 0.001;
        const low = Math.min(open, close) - Math.random() * 0.001;

        data.push({
          time: Math.floor(timestamp / 1000) as Time,
          open,
          high,
          low,
          close,
        });

        price = close;
      }

      candleSeries.setData(data);
      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

      // Handle resize
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    } catch (error) {
      console.error('[ChartViewSimple] Error:', error);
      setIsError(true);
      setErrorMsg(error instanceof Error ? error.message : 'Unknown error');
      return undefined;
    }
  }, []);

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-white">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">Erro ao carregar gráfico</h2>
          <p className="text-sm text-gray-400">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-xl font-semibold text-white">{symbol}</h2>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}