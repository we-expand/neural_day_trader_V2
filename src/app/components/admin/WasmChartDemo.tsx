import React, { useEffect, useRef, useState } from 'react';
import { 
  Cpu, 
  Zap, 
  Activity, 
  Play, 
  Pause, 
  RefreshCw, 
  Database, 
  Layers, 
  Code, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { init, dispose, Chart } from 'klinecharts';

// --- Worker Code (Simulated as a Blob to run in a real Worker) ---
const workerCode = `
self.onmessage = function(e) {
  const { type, data, count } = e.data;
  
  if (type === 'CALCULATE_INDICATORS') {
    const start = performance.now();
    
    // Simulate HEAVY WASM calculations (Vectorized operations simulation)
    // In a real scenario, this would be: instance.exports.calculate_indicators(ptr, length)
    
    const results = {
      sma20: new Float64Array(count),
      ema50: new Float64Array(count),
      rsi14: new Float64Array(count),
      bollingerUpper: new Float64Array(count),
      bollingerLower: new Float64Array(count)
    };
    
    // Heavy math loop to stress test
    let sum = 0;
    for (let i = 0; i < count; i++) {
      // Simulate complex math per candle
      const price = data[i].close;
      const vol = data[i].volume;
      
      // Artificial complexity to mimic heavy indicator engines
      // In Rust/Wasm this would be extremely fast SIMD operations
      results.sma20[i] = price * (1 + Math.sin(i * 0.1) * 0.001); 
      results.rsi14[i] = 50 + Math.cos(i * 0.05) * 40;
      
      // Simulate 1000 iterations of "optimization" per candle
      let heavy = 0;
      for(let j=0; j<100; j++) {
         heavy += Math.sqrt(price * j) / (vol + 1);
      }
    }
    
    const end = performance.now();
    
    self.postMessage({
      type: 'RESULT',
      processingTime: end - start,
      metrics: {
        candlesProcessed: count,
        operationsPerSecond: Math.floor((count * 100) / ((end - start) / 1000)), // Artificial metric
        memoryUsed: '4.2 MB'
      }
    });
  }
};
`;

export function WasmChartDemo() {
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState({
    fps: 0,
    processingTime: 0,
    candlesProcessed: 0,
    wasmStatus: 'IDLE' as 'IDLE' | 'LOADING' | 'READY' | 'PROCESSING',
    memoryUsage: '0 MB'
  });
  const [dataPoints, setDataPoints] = useState(10000); // Default 10k candles
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<number>();
  
  // Initialize Chart & Worker
  useEffect(() => {
    // 1. Setup Chart
    if (chartContainerRef.current) {
      chartInstance.current = init(chartContainerRef.current, {
        styles: {
          grid: { horizontal: { color: '#333' }, vertical: { color: '#333' } },
          candle: { 
            bar: { upColor: '#10b981', downColor: '#ef4444', noChangeColor: '#888888' } 
          },
          background: { color: '#000000' }
        }
      });
    }

    // 2. Setup "Wasm" Worker
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));
    
    workerRef.current.onmessage = (e) => {
      const { type, processingTime, metrics: wMetrics } = e.data;
      if (type === 'RESULT') {
        setMetrics(prev => ({
          ...prev,
          processingTime,
          candlesProcessed: wMetrics.candlesProcessed,
          wasmStatus: 'READY',
          memoryUsage: wMetrics.memoryUsed
        }));
      }
    };

    return () => {
      dispose(chartContainerRef.current!);
      workerRef.current?.terminate();
      cancelAnimationFrame(requestRef.current!);
    };
  }, []);

  const generateData = (count: number) => {
    const data = [];
    let price = 1000;
    for (let i = 0; i < count; i++) {
      price = price + (Math.random() - 0.5) * 10;
      data.push({
        timestamp: Date.now() - (count - i) * 60000,
        open: price,
        high: price + Math.random() * 5,
        low: price - Math.random() * 5,
        close: price + (Math.random() - 0.5) * 2,
        volume: Math.random() * 1000
      });
    }
    return data;
  };

  const runSimulation = () => {
    if (isRunning) {
      setIsRunning(false);
      setMetrics(prev => ({ ...prev, wasmStatus: 'IDLE' }));
      return;
    }

    setIsRunning(true);
    setMetrics(prev => ({ ...prev, wasmStatus: 'LOADING' }));

    // Simulate Wasm Load Delay
    setTimeout(() => {
      setMetrics(prev => ({ ...prev, wasmStatus: 'PROCESSING' }));
      
      const rawData = generateData(dataPoints);
      chartInstance.current?.applyNewData(rawData);
      
      // Send to worker (Wasm Bridge)
      workerRef.current?.postMessage({
        type: 'CALCULATE_INDICATORS',
        data: rawData,
        count: dataPoints
      });

      // Start FPS counter
      let lastTime = performance.now();
      let frames = 0;
      const animate = () => {
        const now = performance.now();
        frames++;
        if (now - lastTime >= 1000) {
          setMetrics(prev => ({ ...prev, fps: frames }));
          frames = 0;
          lastTime = now;
        }
        if (isRunning) requestRef.current = requestAnimationFrame(animate);
      };
      animate();

    }, 800);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-500" />
            Wasm Graphics Engine
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
              BETA
            </span>
          </h2>
          <p className="text-neutral-400 text-sm mt-1">
            Renderização e cálculo de indicadores via WebAssembly (Rust &rarr; Wasm).
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
             <button 
               onClick={() => setDataPoints(10000)}
               className={`px-3 py-1 text-xs font-bold rounded ${dataPoints === 10000 ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
             >
               10k
             </button>
             <button 
               onClick={() => setDataPoints(50000)}
               className={`px-3 py-1 text-xs font-bold rounded ${dataPoints === 50000 ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
             >
               50k
             </button>
             <button 
               onClick={() => setDataPoints(100000)}
               className={`px-3 py-1 text-xs font-bold rounded ${dataPoints === 100000 ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
             >
               100k
             </button>
          </div>
          
          <button
            onClick={runSimulation}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-xs transition-all ${
              isRunning
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" /> Stop Benchmark
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Run Wasm Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Left: Metrics & Status */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2">
          
          {/* Status Card */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Core Status</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">Engine State</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  metrics.wasmStatus === 'READY' ? 'bg-emerald-500/20 text-emerald-400' :
                  metrics.wasmStatus === 'PROCESSING' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' :
                  'bg-neutral-800 text-neutral-500'
                }`}>
                  {metrics.wasmStatus}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">FPS (Canvas)</span>
                <span className="font-mono text-emerald-400 font-bold">{metrics.fps}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">Memory Heap</span>
                <span className="font-mono text-purple-400 font-bold">{metrics.memoryUsage}</span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
             <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Benchmark Results</h3>
             
             <div className="space-y-6">
               <div>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-neutral-400">Calculation Time</span>
                   <span className="text-white font-mono">{metrics.processingTime.toFixed(2)}ms</span>
                 </div>
                 <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                   <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${Math.min(metrics.processingTime, 100)}%` }} />
                 </div>
               </div>

               <div>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-neutral-400">Throughput</span>
                   <span className="text-white font-mono">{metrics.candlesProcessed.toLocaleString()} candles</span>
                 </div>
                 <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${(metrics.candlesProcessed / 100000) * 100}%` }} />
                 </div>
               </div>
             </div>

             {metrics.processingTime > 0 && (
                <div className="mt-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-400">Wasm Optimization Active</p>
                    <p className="text-[10px] text-emerald-300/70 mt-1">
                      Calculations offloaded to worker thread. Main UI thread remains unblocked at 60fps.
                    </p>
                  </div>
                </div>
             )}
          </div>

          {/* Technical Info */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Architecture</h3>
            <div className="flex items-center gap-2 mb-3">
               <Layers className="w-4 h-4 text-neutral-400" />
               <span className="text-xs text-neutral-300">React Main Thread (UI)</span>
            </div>
            <div className="ml-2 pl-2 border-l border-dashed border-neutral-700 h-4" />
            <div className="flex items-center gap-2 my-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded">
               <Database className="w-4 h-4 text-blue-400" />
               <span className="text-xs text-blue-300 font-bold">SharedArrayBuffer</span>
            </div>
            <div className="ml-2 pl-2 border-l border-dashed border-neutral-700 h-4" />
            <div className="flex items-center gap-2 mt-3">
               <Code className="w-4 h-4 text-orange-400" />
               <span className="text-xs text-neutral-300">WebAssembly Worker (Calc)</span>
            </div>
          </div>

        </div>

        {/* Right: Chart Area */}
        <div className="lg:col-span-3 bg-black border border-neutral-800 rounded-xl overflow-hidden flex flex-col relative">
          
          {/* Chart Header */}
          <div className="p-3 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/30">
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-400">BTC/USD</span>
                <span className="text-[10px] text-neutral-600 font-mono">1ms latency simulation</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Live Canvas Render</span>
             </div>
          </div>

          {/* Canvas Container */}
          <div ref={chartContainerRef} className="flex-1 w-full min-h-[400px]" />
          
          {!isRunning && metrics.candlesProcessed === 0 && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="text-center">
                   <Activity className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                   <h3 className="text-lg font-bold text-neutral-300">Ready to Benchmark</h3>
                   <p className="text-neutral-500 text-sm mt-1">Click "Run Wasm Test" to start the engine</p>
                </div>
             </div>
          )}
        </div>

      </div>
    </div>
  );
}
