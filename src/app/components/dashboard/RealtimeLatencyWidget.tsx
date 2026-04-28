import React from 'react';
import { motion } from 'motion/react';
import { Zap, Activity, TrendingUp, Wifi } from 'lucide-react';
import { useSupabaseRealtimeTurbo, TURBO_CONFIGS } from '@/app/hooks/useSupabaseRealtimeTurbo';

/**
 * REALTIME LATENCY MONITOR WIDGET
 * Shows current Supabase Realtime performance
 * Compact widget for Dashboard
 */

export const RealtimeLatencyWidget = () => {
  const { latency, stats, isConnected } = useSupabaseRealtimeTurbo(
    ['BTC', 'ETH', 'SOL'], // Monitor key assets
    TURBO_CONFIGS.ULTRA // 🔥 ULTRA MODE
  );

  const getLatencyColor = (lat: number) => {
    if (lat < 20) return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (lat < 40) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    if (lat < 60) return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  const getLatencyLabel = (lat: number) => {
    if (lat < 20) return '⚡ Ultra';
    if (lat < 40) return '✅ Rápido';
    if (lat < 60) return '⚠️ Moderado';
    return '🐢 Lento';
  };

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-indigo-500/30 transition-all group">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-indigo-500/10">
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Realtime Latency</h3>
            <p className="text-xs text-neutral-500">Supabase WebSocket</p>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
      </div>

      {/* Latency Display */}
      <div className="flex items-baseline gap-2 mb-3">
        <motion.span
          key={latency}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="text-3xl font-bold font-mono text-white"
        >
          {latency.toFixed(1)}
        </motion.span>
        <span className="text-lg text-neutral-400">ms</span>
        <span className={`ml-auto text-xs px-2 py-1 rounded border font-medium ${getLatencyColor(latency)}`}>
          {getLatencyLabel(latency)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden mb-3">
        <motion.div
          animate={{ width: `${Math.min((latency / 100) * 100, 100)}%` }}
          transition={{ type: 'spring', stiffness: 100 }}
          className={`h-full rounded-full ${
            latency < 20 ? 'bg-green-500' :
            latency < 40 ? 'bg-yellow-500' :
            latency < 60 ? 'bg-orange-500' :
            'bg-red-500'
          }`}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col p-2 rounded bg-neutral-800/50">
          <span className="text-neutral-500">Status</span>
          <span className="font-bold text-white">
            {isConnected ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        <div className="flex flex-col p-2 rounded bg-neutral-800/50">
          <span className="text-neutral-500">Prices</span>
          <span className="font-bold text-white">{stats.pricesCount}</span>
        </div>
        <div className="flex flex-col p-2 rounded bg-neutral-800/50">
          <span className="text-neutral-500">Events/s</span>
          <span className="font-bold text-white">{stats.config.eventsPerSecond}</span>
        </div>
      </div>

      {/* Mode Indicator */}
      <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs">
        <span className="text-neutral-500">Mode</span>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="font-bold text-yellow-400">ULTRA</span>
        </div>
      </div>
    </div>
  );
};
