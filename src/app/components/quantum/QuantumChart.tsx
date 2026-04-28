import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, LineData } from 'lightweight-charts';
import { AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpoofingAlert {
  id: string;
  price: number;
  time: number;
  type: 'sell' | 'buy';
  message: string;
}

interface CorrelationAlert {
  id: string;
  asset: string;
  message: string;
  time: number;
  impact: 'bullish' | 'bearish';
}

interface QuantumChartProps {
  symbol: string;
  timeframe: string;
  onSpoofingDetected?: (alert: SpoofingAlert) => void;
  onCorrelationDetected?: (alert: CorrelationAlert) => void;
}

export const QuantumChart: React.FC<QuantumChartProps> = ({
  symbol,
  timeframe,
  onSpoofingDetected,
  onCorrelationDetected
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const [spoofingAlerts, setSpoofingAlerts] = useState<SpoofingAlert[]>([]);
  const [correlationAlerts, setCorrelationAlerts] = useState<CorrelationAlert[]>([]);
  const [priceConfidence, setPriceConfidence] = useState(85);

  // Generate realistic candlestick data
  const generateCandleData = (): CandlestickData[] => {
    const data: CandlestickData[] = [];
    let basePrice = 1.28400;
    const now = Date.now() / 1000;
    const candleDuration = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600;
    
    for (let i = 200; i >= 0; i--) {
      const time = (now - (i * candleDuration)) as Time;
      const volatility = 0.0003 + Math.random() * 0.0005;
      
      const open = basePrice;
      const close = basePrice + (Math.random() - 0.52) * volatility * 100;
      const high = Math.max(open, close) + Math.random() * volatility * 50;
      const low = Math.min(open, close) - Math.random() * volatility * 50;
      
      data.push({
        time,
        open,
        high,
        low,
        close
      });
      
      basePrice = close;
    }
    
    return data;
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: '#0a0e14' },
        textColor: '#6b7280',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      grid: {
        vertLines: { color: '#1a1f2e', style: 1, visible: true },
        horzLines: { color: '#1a1f2e', style: 1, visible: true }
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#4b5563',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1f2937'
        },
        horzLine: {
          color: '#4b5563',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1f2937'
        }
      },
      rightPriceScale: {
        borderColor: '#1a1f2e',
        scaleMargins: {
          top: 0.05,
          bottom: 0.05
        }
      },
      timeScale: {
        borderColor: '#1a1f2e',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 12,
        minBarSpacing: 8
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      }
    });

    chartRef.current = chart;

    // Add candlestick series with ORANGE/GREEN colors (EXACTLY like the image)
    // UP = GREEN (#22c55e), DOWN = ORANGE (#f97316)
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#f97316',
      borderUpColor: '#22c55e',
      borderDownColor: '#f97316',
      wickUpColor: '#22c55e',
      wickDownColor: '#f97316'
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Set initial data
    const candleData = generateCandleData();
    candlestickSeries.setData(candleData);

    // Add CYAN moving average (like the image)
    const ema20Data: LineData[] = candleData.map((candle, i) => {
      if (i < 20) return null;
      const slice = candleData.slice(i - 19, i + 1);
      const avg = slice.reduce((sum, c) => sum + c.close, 0) / 20;
      return { time: candle.time, value: avg };
    }).filter(Boolean) as LineData[];

    const ema20Series = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 6,
      crosshairMarkerBorderColor: '#06b6d4',
      crosshairMarkerBackgroundColor: '#06b6d4'
    });
    ema20Series.setData(ema20Data);

    // Add YELLOW/GOLD moving average (like the image)
    const ema50Data: LineData[] = candleData.map((candle, i) => {
      if (i < 50) return null;
      const slice = candleData.slice(i - 49, i + 1);
      const avg = slice.reduce((sum, c) => sum + c.close, 0) / 50;
      return { time: candle.time, value: avg };
    }).filter(Boolean) as LineData[];

    const ema50Series = chart.addLineSeries({
      color: '#eab308',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 6,
      crosshairMarkerBorderColor: '#eab308',
      crosshairMarkerBackgroundColor: '#eab308'
    });
    ema50Series.setData(ema50Data);

    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Spoofing Detection Simulation (every 15 seconds)
    const spoofingInterval = setInterval(() => {
      if (Math.random() > 0.65) {
        const lastCandle = candleData[candleData.length - 1];
        const alert: SpoofingAlert = {
          id: `spoof-${Date.now()}`,
          price: lastCandle.high + 0.0005,
          time: Date.now(),
          type: 'sell',
          message: 'Ordem fantasma. Pressão artificial de venda.'
        };
        
        setSpoofingAlerts([alert]);
        onSpoofingDetected?.(alert);
        
        setPriceConfidence(prev => Math.max(prev - 20, 30));
        
        setTimeout(() => {
          setPriceConfidence(prev => Math.min(prev + 20, 95));
          setSpoofingAlerts([]);
        }, 8000);
      }
    }, 15000);

    // Correlation Detection Simulation (every 20 seconds)
    const correlationInterval = setInterval(() => {
      if (Math.random() > 0.6) {
        const alert: CorrelationAlert = {
          id: `corr-${Date.now()}`,
          asset: 'US10Y',
          message: 'Movimento no Tesouro Americano (US10Y) indica queda iminente aqui.',
          time: Date.now(),
          impact: 'bearish'
        };
        
        setCorrelationAlerts([alert]);
        onCorrelationDetected?.(alert);
        
        setTimeout(() => {
          setCorrelationAlerts([]);
        }, 10000);
      }
    }, 20000);

    // Real-time candle updates
    const updateInterval = setInterval(() => {
      if (candlestickSeriesRef.current) {
        const lastCandle = candleData[candleData.length - 1];
        const newClose = lastCandle.close + (Math.random() - 0.5) * 0.0002;
        
        const updatedCandle: CandlestickData = {
          time: lastCandle.time,
          open: lastCandle.open,
          high: Math.max(lastCandle.high, newClose),
          low: Math.min(lastCandle.low, newClose),
          close: newClose
        };
        
        candlestickSeriesRef.current.update(updatedCandle);
      }
    }, 2000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(spoofingInterval);
      clearInterval(correlationInterval);
      clearInterval(updateInterval);
      chart.remove();
    };
  }, [symbol, timeframe]);

  return (
    <div className="relative w-full h-full bg-[#0a0e14] rounded-lg overflow-hidden border border-gray-800">
      {/* Chart Header - EXACT layout from image */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">
            {symbol} • {timeframe}
          </span>
          <span className="text-xs text-gray-500">Comenetter • YORDURS</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-400">O</span>
            <span className="text-xs text-white">1.28400</span>
            <span className="text-xs text-gray-400">H</span>
            <span className="text-xs text-white">1.35780</span>
            <span className="text-xs text-gray-400">L</span>
            <span className="text-xs text-white">1.28400</span>
            <span className="text-xs text-rose-400">-0.7870 (-0.67%)</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">USD ~</div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* HEATMAP - Large blurred zones BEHIND candles */}
      <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
        {/* Large ORANGE/RED heat zone (spoofing area) */}
        <motion.div
          animate={{
            opacity: [0.15, 0.25, 0.15],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute w-[400px] h-[350px] rounded-full blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(249, 115, 22, 0.3) 50%, transparent 100%)',
            right: '25%',
            top: '15%'
          }}
        />

        {/* Large CYAN/GREEN heat zone (support area) */}
        <motion.div
          animate={{
            opacity: [0.12, 0.22, 0.12],
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute w-[450px] h-[400px] rounded-full blur-[90px]"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(34, 197, 94, 0.25) 50%, transparent 100%)',
            left: '20%',
            top: '30%'
          }}
        />
      </div>

      {/* Shield Icons - Yellow warning shields above candles */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute" style={{ left: '15%', top: '22%' }}>
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center backdrop-blur-sm border border-yellow-500/40">
            <Shield className="w-5 h-5 text-yellow-400" fill="currentColor" />
          </div>
        </div>
        <div className="absolute" style={{ left: '35%', top: '18%' }}>
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center backdrop-blur-sm border border-yellow-500/40">
            <Shield className="w-5 h-5 text-yellow-400" fill="currentColor" />
          </div>
        </div>
        <div className="absolute" style={{ left: '52%', top: '15%' }}>
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center backdrop-blur-sm border border-yellow-500/40">
            <Shield className="w-5 h-5 text-yellow-400" fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Spoofing Alert Box - RED/ORANGE box top right */}
      <AnimatePresence>
        {spoofingAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="absolute top-16 right-6 z-40 bg-gradient-to-br from-red-900/95 to-orange-800/95 border-2 border-red-500/60 rounded-lg px-4 py-3 shadow-2xl backdrop-blur-md max-w-[280px]"
          >
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 animate-pulse" />
              <div className="flex-1">
                <div className="text-xs font-black text-red-300 uppercase tracking-wide mb-1">
                  SPOOFING DETECTADO:
                </div>
                <p className="text-xs text-white/95 leading-relaxed">
                  {alert.message}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Correlation Alert Box - CYAN box bottom center */}
      <AnimatePresence>
        {correlationAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-br from-cyan-900/95 to-teal-800/95 border-2 border-cyan-500/60 rounded-lg px-4 py-3 shadow-2xl backdrop-blur-md max-w-[320px]"
          >
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 animate-pulse" />
              <div className="flex-1">
                <div className="text-xs font-black text-cyan-300 uppercase tracking-wide mb-1">
                  CORRELAÇÃO BORBOLETA:
                </div>
                <p className="text-xs text-white/95 leading-relaxed">
                  {alert.message}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Projection Arrow - Dashed cyan arrow pointing down */}
      {correlationAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute right-[15%] top-[40%] z-25 pointer-events-none"
        >
          <svg width="120" height="180" className="overflow-visible">
            <defs>
              <marker
                id="arrowhead-cyan"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#06b6d4" />
              </marker>
            </defs>
            <motion.path
              d="M 60 20 Q 80 80, 100 150"
              stroke="#06b6d4"
              strokeWidth="3"
              strokeDasharray="8 6"
              fill="none"
              markerEnd="url(#arrowhead-cyan)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          {/* Target point at arrow end */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-500/50"
          />
        </motion.div>
      )}

      {/* Current Price Display - Cyan box on right */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <div className="bg-cyan-500 text-black px-3 py-1.5 rounded text-sm font-bold shadow-lg">
          1.27800
          <div className="text-[10px] font-normal opacity-80">-18 -88.81</div>
        </div>
      </div>
    </div>
  );
};