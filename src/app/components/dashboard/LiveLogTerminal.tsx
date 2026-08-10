import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { Terminal, ShieldAlert, Wifi, Activity, Play, Square, XCircle, Loader2 } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';

interface LogEntry {
  id: string;
  timestamp: string;
  category: 'CORE' | 'CRITICAL' | 'EXEC' | 'NETWORK' | 'INFO';
  message: string;
}

/**
 * Terminal de eventos reais da sessão de trading — antes gerava latência de
 * broker, margin level, CPU/Memory/PID/Uptime inteiramente fabricados a cada
 * 2s via `Math.random()`. Reescrito (auditoria 2026-07-29) pra só logar
 * transições reais de estado (`useTradingContext`): conexão MT5, status
 * rodando/parado, ordens abertas/fechadas. Sem evento real, não loga nada —
 * nunca mais inventa telemetria.
 */
export function LiveLogTerminal({ embedded = false }: { embedded?: boolean }) {
  const { status, activeOrders, isConnectedToMT5 } = useTradingContext();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const sessionStartRef = useRef<number>(Date.now());
  const [uptimeLabel, setUptimeLabel] = useState('0s');

  const prevStatusRef = useRef(status);
  const prevConnectedRef = useRef(isConnectedToMT5);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  const { ref: topLoaderRef, inView } = useInView({ threshold: 0 });

  const pushLog = (category: LogEntry['category'], message: string) => {
    const now = new Date();
    setLogs(prev => [...prev.slice(-50), {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toLocaleTimeString('pt-BR', { hour12: false }),
      category,
      message
    }]);
  };

  // Log inicial real — reflete o estado de conexão no momento em que a tela abriu.
  useEffect(() => {
    pushLog('CORE', 'Terminal de eventos iniciado.');
    pushLog('NETWORK', isConnectedToMT5 ? 'MT5 conectado.' : 'MT5 não conectado.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uptime real da sessão (tempo desde que este terminal foi montado).
  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      setUptimeLabel(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Transição real de status (rodando/parado).
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      pushLog(status === 'running' ? 'EXEC' : 'INFO', status === 'running' ? 'Sessão iniciada.' : 'Sessão parada.');
      prevStatusRef.current = status;
    }
  }, [status]);

  // Transição real de conexão MT5.
  useEffect(() => {
    if (prevConnectedRef.current !== isConnectedToMT5) {
      pushLog(isConnectedToMT5 ? 'NETWORK' : 'CRITICAL', isConnectedToMT5 ? 'MT5 conectado.' : 'MT5 desconectado.');
      prevConnectedRef.current = isConnectedToMT5;
    }
  }, [isConnectedToMT5]);

  // Ordens reais abertas/fechadas (diff pelo id).
  useEffect(() => {
    const currentIds = new Set(activeOrders.map(o => o.id));
    const prevIds = prevOrderIdsRef.current;

    activeOrders.forEach(order => {
      if (!prevIds.has(order.id)) {
        pushLog('EXEC', `Ordem aberta: ${order.symbol ?? order.id}.`);
      }
    });
    prevIds.forEach(id => {
      if (!currentIds.has(id)) {
        pushLog('EXEC', `Ordem encerrada: ${id}.`);
      }
    });

    prevOrderIdsRef.current = currentIds;
  }, [activeOrders]);

  const loadMoreHistory = () => {
    setIsLoadingHistory(true);
    setTimeout(() => setIsLoadingHistory(false), 400);
  };

  useEffect(() => {
    if (inView && !isLoadingHistory) loadMoreHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const getCategoryColor = (cat: LogEntry['category']) => {
    switch (cat) {
      case 'CORE': return 'text-slate-400';
      case 'CRITICAL': return 'text-red-500 font-bold bg-red-500/10 px-1 rounded';
      case 'EXEC': return 'text-white font-bold';
      case 'NETWORK': return 'text-cyan-400';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className={`flex flex-col bg-black font-mono text-xs md:text-sm overflow-hidden border border-white/10 rounded-xl shadow-2xl relative ${embedded ? 'h-full' : 'h-[600px]'}`}>

      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
           <Terminal className="w-4 h-4 text-emerald-500" />
           <span className="font-bold text-slate-300">Neural Core Terminal</span>
           <div className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
        <div className="flex gap-1.5">
           <div className="w-3 h-3 rounded-full bg-slate-700" />
           <div className="w-3 h-3 rounded-full bg-slate-700" />
           <div className="w-3 h-3 rounded-full bg-slate-700" />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 bg-black/90 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent font-mono"
      >
        <div ref={topLoaderRef} className="h-4 flex justify-center items-center opacity-50">
            {isLoadingHistory && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
        </div>

        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 hover:bg-white/5 p-0.5 rounded transition-colors group"
            >
              <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
              <span className={`shrink-0 w-20 ${getCategoryColor(log.category)}`}>
                {log.category}:
              </span>
              <span className="text-slate-300 break-all group-hover:text-white transition-colors">
                {log.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {status === 'running' && (
            <motion.div
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-2 h-4 bg-emerald-500 mt-2"
            />
        )}
      </div>

      {/* Rodapé — só métricas reais (antes tinha CPU/Memory/PID hardcoded fixos) */}
      <div className="bg-neutral-900 border-t border-white/5 px-4 py-2 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest">
        <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
                <Wifi className={`w-3 h-3 ${isConnectedToMT5 ? 'text-emerald-500' : 'text-red-500'}`} />
                MT5: {isConnectedToMT5 ? 'Connected' : 'Disconnected'}
            </span>
            <span className="flex items-center gap-1.5">
                {status === 'running' ? <Play className="w-3 h-3 text-emerald-500" /> : <Square className="w-3 h-3 text-slate-500" />}
                {status === 'running' ? 'Running' : 'Idle'}
            </span>
            <span className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-blue-500" />
                Ordens ativas: {activeOrders.length}
            </span>
        </div>
        <div className="flex items-center gap-2">
            <span>Sessão: {uptimeLabel}</span>
        </div>
      </div>

      <AnimatePresence>
         {logs.length > 0 && logs[logs.length - 1].category === 'CRITICAL' && (
            <motion.div
                initial={{ opacity: 0, y: 20, x: 20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-12 right-4 max-w-sm bg-neutral-900 border border-red-500/30 rounded-lg shadow-2xl p-4 flex gap-3 z-10"
            >
                <div className="bg-red-500/10 p-2 rounded-full h-fit">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm mb-1">Alerta do Sistema</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        {logs[logs.length - 1].message}
                    </p>
                </div>
                <button className="text-slate-500 hover:text-white h-fit">
                    <XCircle className="w-4 h-4" />
                </button>
            </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
}
