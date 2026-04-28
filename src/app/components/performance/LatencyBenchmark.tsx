import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Zap, Clock, Cpu, Wifi, TrendingUp, AlertCircle } from 'lucide-react';
import { useSupabaseRealtimeTurbo, TURBO_CONFIGS } from '@/app/hooks/useSupabaseRealtimeTurbo';

/**
 * LATENCY BENCHMARK COMPONENT
 * Visual comparison of different optimization modes
 */

export const LatencyBenchmark = () => {
  const [mode, setMode] = useState<'ULTRA' | 'FAST' | 'SAFE'>('ULTRA');
  const [enableWorker, setEnableWorker] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<Array<{
    mode: string;
    latency: number;
    timestamp: number;
  }>>([]);

  // Test with BTC only
  const { 
    prices, 
    latency, 
    stats, 
    isConnected,
    broadcastPrice 
  } = useSupabaseRealtimeTurbo(
    ['BTC'],
    {
      ...TURBO_CONFIGS[mode],
      enableWebWorker: enableWorker
    }
  );

  // Record latency for benchmarking
  useEffect(() => {
    if (latency > 0) {
      setBenchmarkResults(prev => [
        ...prev,
        {
          mode: `${mode}${enableWorker ? '+Worker' : ''}`,
          latency,
          timestamp: Date.now()
        }
      ].slice(-20)); // Keep last 20 measurements
    }
  }, [latency, mode, enableWorker]);

  // Calculate average latency
  const avgLatency = benchmarkResults.length > 0
    ? benchmarkResults.reduce((sum, r) => sum + r.latency, 0) / benchmarkResults.length
    : 0;

  // Simulate price update for testing
  const sendTestUpdate = async () => {
    const testPrice = {
      asset_symbol: 'BTC',
      price: Math.random() * 65000 + 60000,
      bid: Math.random() * 64900 + 60000,
      ask: Math.random() * 65100 + 60000,
      volume: Math.random() * 1000000,
      change_24h: Math.random() * 2000 - 1000,
      change_percent_24h: Math.random() * 4 - 2,
      timestamp: new Date().toISOString(),
    };

    await broadcastPrice(testPrice);
  };

  return (
    <div className="p-8 bg-neutral-950 text-white min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Zap className="w-10 h-10 text-yellow-400" />
          Latency Benchmark
        </h1>
        <p className="text-neutral-400">
          Real-time performance comparison of optimization modes
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-6 p-4 rounded-lg bg-neutral-900 border border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              {isConnected ? '🟢 Connected to Supabase Realtime' : '🔴 Disconnected'}
            </span>
          </div>
          <div className="text-sm text-neutral-400">
            Events/sec: {stats?.config?.eventsPerSecond || 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Current Latency */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="p-6 rounded-xl bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm text-indigo-300 font-medium mb-1">Current Latency</h3>
              <div className="flex items-baseline gap-2">
                <motion.span
                  key={latency}
                  initial={{ scale: 1.2, color: '#60a5fa' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  className="text-5xl font-bold font-mono"
                >
                  {latency.toFixed(1)}
                </motion.span>
                <span className="text-2xl text-neutral-400">ms</span>
              </div>
            </div>
            <Clock className="w-8 h-8 text-indigo-400" />
          </div>

          {/* Latency Bar */}
          <div className="relative h-3 bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${Math.min((latency / 100) * 100, 100)}%` }}
              className={`h-full rounded-full ${
                latency < 20 ? 'bg-green-500' :
                latency < 40 ? 'bg-yellow-500' :
                latency < 60 ? 'bg-orange-500' :
                'bg-red-500'
              }`}
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-neutral-400">
            <span>0ms</span>
            <span className={`font-bold ${
              latency < 20 ? 'text-green-400' :
              latency < 40 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {latency < 20 ? '⚡ Ultra Fast' :
               latency < 40 ? '✅ Fast' :
               latency < 60 ? '⚠️ Moderate' :
               '🐢 Slow'}
            </span>
            <span>100ms</span>
          </div>
        </motion.div>

        {/* Average Latency */}
        <div className="p-6 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm text-neutral-400 font-medium mb-1">Average Latency</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold font-mono">
                  {avgLatency.toFixed(1)}
                </span>
                <span className="text-2xl text-neutral-400">ms</span>
              </div>
            </div>
            <TrendingUp className="w-8 h-8 text-cyan-400" />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 rounded bg-neutral-800">
              <div className="text-xs text-neutral-400 mb-1">Min</div>
              <div className="text-xl font-bold text-green-400">
                {benchmarkResults.length > 0
                  ? Math.min(...benchmarkResults.map(r => r.latency)).toFixed(1)
                  : '0.0'}ms
              </div>
            </div>
            <div className="p-3 rounded bg-neutral-800">
              <div className="text-xs text-neutral-400 mb-1">Max</div>
              <div className="text-xl font-bold text-red-400">
                {benchmarkResults.length > 0
                  ? Math.max(...benchmarkResults.map(r => r.latency)).toFixed(1)
                  : '0.0'}ms
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="mb-6 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          Optimization Mode
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {(['ULTRA', 'FAST', 'SAFE'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`p-4 rounded-lg border-2 transition-all ${
                mode === m
                  ? 'border-indigo-500 bg-indigo-500/20'
                  : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">{m}</span>
                <div className={`w-2 h-2 rounded-full ${
                  m === 'ULTRA' ? 'bg-green-500' :
                  m === 'FAST' ? 'bg-yellow-500' :
                  'bg-orange-500'
                }`}></div>
              </div>
              <div className="text-xs text-neutral-400 mb-2">
                {m === 'ULTRA' ? '10-25ms • Broadcast only' :
                 m === 'FAST' ? '20-40ms • With database' :
                 '40-80ms • Conservative'}
              </div>
              <div className="text-xs font-mono text-neutral-500">
                {TURBO_CONFIGS[m].eventsPerSecond} events/sec
              </div>
            </button>
          ))}
        </div>

        {/* WebWorker Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-neutral-800 border border-neutral-700">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="font-medium">WebWorker Processing</div>
              <div className="text-xs text-neutral-400">
                Offload JSON parsing to background thread (gain: -2 to -5ms)
              </div>
            </div>
          </div>
          <button
            onClick={() => setEnableWorker(!enableWorker)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              enableWorker ? 'bg-green-600' : 'bg-neutral-700'
            }`}
          >
            <motion.div
              animate={{ x: enableWorker ? 28 : 4 }}
              className="absolute top-1 w-5 h-5 bg-white rounded-full"
            />
          </button>
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-6 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-green-400" />
          Test Controls
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={sendTestUpdate}
            className="p-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors font-medium"
          >
            Send Test Update
          </button>
          <button
            onClick={() => setBenchmarkResults([])}
            className="p-4 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors font-medium border border-neutral-700"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Benchmark Results */}
      <div className="p-6 rounded-xl bg-neutral-900 border border-neutral-800">
        <h3 className="text-lg font-bold mb-4">Recent Measurements</h3>

        {benchmarkResults.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No measurements yet. Click "Send Test Update" to start.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {benchmarkResults.slice().reverse().map((result, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 rounded bg-neutral-800 hover:bg-neutral-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    result.latency < 20 ? 'bg-green-500' :
                    result.latency < 40 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                  <span className="font-mono text-sm text-neutral-400">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-neutral-300">
                    {result.mode}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono">
                    {result.latency.toFixed(1)}
                  </span>
                  <span className="text-sm text-neutral-400">ms</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
          <div className="text-sm text-yellow-200/90">
            <p className="font-bold mb-2">Network Latency Limits:</p>
            <ul className="space-y-1 text-xs text-yellow-200/70">
              <li>• <strong>LAN (local):</strong> 1-5ms - Best possible</li>
              <li>• <strong>Regional:</strong> 10-30ms - CDN optimized</li>
              <li>• <strong>Global:</strong> 30-100ms - Physics limit (speed of light)</li>
              <li>• <strong>WebWorker:</strong> Saves 2-5ms processing time (not network)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};