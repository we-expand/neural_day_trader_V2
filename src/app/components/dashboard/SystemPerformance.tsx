import React, { useState, useEffect, useRef } from 'react';
import { Activity, Server, Zap, Globe, Clock, BarChart3, ShieldCheck } from 'lucide-react';

export function SystemPerformance() {
  const [metrics, setMetrics] = useState({
    latency: 24,
    uptime: 99.99,
    requests: 1240,
    errors: 0,
    mttr: '45ms',
    benchmark: 'TOP 1%'
  });
  
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Simulate real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        latency: Math.floor(Math.random() * 20) + 15, // 15-35ms
        requests: prev.requests + Math.floor(Math.random() * 5),
        errors: Math.random() > 0.98 ? prev.errors + 1 : prev.errors
      }));

      if (Math.random() > 0.7) {
        const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        const events = [
          `[NET] Pacote sincronizado (${Math.floor(Math.random() * 10)}ms)`,
          `[DB] Query otimizada: index_scan_v2`,
          `[API] Heartbeat recebido: Node_Alpha`,
          `[SYS] Garbage collection: 12mb freed`,
          `[SEC] Handshake TLSv1.3 validado`,
          `[CACHE] Hit ratio: 98.4%`
        ];
        const newLog = `${timestamp} ${events[Math.floor(Math.random() * events.length)]}`;
        setLogs(prev => [newLog, ...prev].slice(0, 50));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl flex flex-col h-[320px] overflow-hidden group">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">System Performance</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 tracking-wider">OPERATIONAL</span>
           </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3 bg-white/[0.01]">
         {/* KPI 1: MTTR */}
         <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex flex-col">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Tempo Médio Recup.</span>
            <div className="flex items-end gap-1">
               <span className="text-lg font-mono font-bold text-cyan-400">{metrics.mttr}</span>
               <span className="text-[9px] text-emerald-400 font-bold mb-1">▼ 12%</span>
            </div>
         </div>
         
         {/* KPI 2: Benchmark */}
         <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex flex-col">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Benchmark Público</span>
            <div className="flex items-end gap-1">
               <span className="text-lg font-mono font-bold text-purple-400">{metrics.benchmark}</span>
               <span className="text-[9px] text-slate-400 font-bold mb-1">GLOBAL</span>
            </div>
         </div>
      </div>

      {/* Real-time Grid */}
      <div className="px-4 pb-2 grid grid-cols-3 gap-2 text-[10px]">
          <div className="flex flex-col items-center p-2 rounded bg-white/5 border border-white/5">
             <Zap className="w-3 h-3 text-amber-400 mb-1" />
             <span className="text-slate-400 font-bold">LATENCY</span>
             <span className="text-white font-mono">{metrics.latency}ms</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded bg-white/5 border border-white/5">
             <Globe className="w-3 h-3 text-blue-400 mb-1" />
             <span className="text-slate-400 font-bold">REQUESTS</span>
             <span className="text-white font-mono">{metrics.requests}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded bg-white/5 border border-white/5">
             <ShieldCheck className="w-3 h-3 text-emerald-400 mb-1" />
             <span className="text-slate-400 font-bold">UPTIME</span>
             <span className="text-white font-mono">{metrics.uptime}%</span>
          </div>
      </div>

      {/* Scrollable Logs */}
      <div className="flex-1 overflow-y-auto bg-black/20 p-2 font-mono text-[9px] space-y-1 mx-1 mb-1 rounded border border-white/5 custom-scrollbar relative">
         <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
         {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-400 border-b border-white/5 pb-0.5 last:border-0">
               <span className="w-1 h-1 rounded-full bg-cyan-500/50" />
               <span className="opacity-80">{log}</span>
            </div>
         ))}
      </div>
      
      {/* Footer Status */}
      <div className="bg-white/[0.02] p-2 border-t border-white/5 text-[9px] text-slate-500 flex justify-between uppercase font-bold tracking-wider">
         <span>Region: us-east-1</span>
         <span className="text-cyan-600">Encrypted (AES-256)</span>
      </div>
    </div>
  );
}
