import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { Terminal, AlertCircle, ShieldAlert, Wifi, Activity, Cpu, Play, Square, XCircle, RotateCw, Loader2 } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';

interface LogEntry {
  id: string;
  timestamp: string;
  category: 'CORE' | 'FAIL' | 'RETRY' | 'CRITICAL' | 'EXEC' | 'RISK' | 'NETWORK' | 'INFO';
  message: string;
  details?: string;
}

export function LiveLogTerminal({ embedded = false }: { embedded?: boolean }) {
  const { status, activeOrders } = useTradingContext();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Infinite Scroll Trigger
  const { ref: topLoaderRef, inView } = useInView({
    threshold: 0,
  });

  // Load History Effect
  useEffect(() => {
    if (inView && !isLoadingHistory) {
      loadMoreHistory();
    }
  }, [inView]);

  const loadMoreHistory = () => {
    setIsLoadingHistory(true);
    // Simulate API delay
    setTimeout(() => {
      const olderLogs: LogEntry[] = Array.from({ length: 10 }).map((_, i) => ({
        id: `history-${Date.now()}-${i}`,
        timestamp: new Date(Date.now() - (86400000 + i * 60000)).toLocaleTimeString('pt-BR'), // Yesterday
        category: 'INFO',
        message: `Log Histórico Recuperado #${i + 1} - Análise Retroativa`,
        details: 'Dados carregados do arquivo morto (Cold Storage)'
      }));
      
      setLogs(prev => [...olderLogs, ...prev]);
      setIsLoadingHistory(false);
      
      // Adjust scroll to prevent jump (Basic implementation)
      if (scrollRef.current) {
          scrollRef.current.scrollTop += 50; 
      }
    }, 1000);
  };

  // Initial Mock Data to match the image
  useEffect(() => {
    const initialLogs: LogEntry[] = [
      { id: '1', timestamp: '20:40:49', category: 'CORE', message: 'Sistema Neural Iniciado. Carregando modelos...' },
      { id: '5', timestamp: '20:40:50', category: 'EXEC', message: 'Conexão MT5 Estabelecida. Ping: 14ms' },
      { id: '7', timestamp: '20:40:51', category: 'NETWORK', message: 'Feed de Dados Sincronizado: MT5 + APIs' },
      { id: '8', timestamp: '20:40:51', category: 'INFO', message: 'Mapeamento Inteligente Ativo. Aguardando oportunidades.' },
    ];
    setLogs(initialLogs);
  }, []);

  // Simulating Live Logs based on context status
  useEffect(() => {
    if (status !== 'running') return;

    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false });
      
      const categories: LogEntry['category'][] = ['CORE', 'NETWORK', 'EXEC', 'RISK', 'INFO'];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      
      let message = '';
      switch (randomCategory) {
        case 'CORE':
          message = `Otimizando pesos da rede neural (Epoch ${Math.floor(Math.random() * 100)})...`;
          break;
        case 'NETWORK':
          message = `Latência do Broker: ${Math.floor(Math.random() * 50) + 10}ms. Conexão Estável.`;
          break;
        case 'EXEC':
          message = `Monitorando tick data para ${Math.random() > 0.5 ? 'BTCUSDT' : 'EURUSD'}... Spread: 0.2`;
          break;
        case 'RISK':
          message = `Verificação de exposição global: OK. Margin Level: ${(Math.random() * 500 + 100).toFixed(2)}%`;
          break;
        case 'INFO':
          message = `Análise de sentimento: ${Math.random() > 0.5 ? 'Bullish' : 'Bearish'}. Score: ${(Math.random() * 100).toFixed(0)}`;
          break;
      }

      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: timeStr,
        category: randomCategory,
        message
      };

      setLogs(prev => [...prev.slice(-50), newLog]); // Keep last 50
    }, 2000);

    return () => clearInterval(interval);
  }, [status]);

  // Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getCategoryColor = (cat: LogEntry['category']) => {
    switch (cat) {
      case 'CORE': return 'text-slate-400';
      case 'FAIL': return 'text-red-500 font-bold';
      case 'RETRY': return 'text-orange-400';
      case 'CRITICAL': return 'text-red-500 font-bold bg-red-500/10 px-1 rounded';
      case 'EXEC': return 'text-white font-bold';
      case 'RISK': return 'text-rose-400';
      case 'NETWORK': return 'text-cyan-400';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className={`flex flex-col bg-black font-mono text-xs md:text-sm overflow-hidden border border-white/10 rounded-xl shadow-2xl relative ${embedded ? 'h-full' : 'h-[600px]'}`}>
      
      {/* Terminal Header */}
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

      {/* Main Log Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 bg-black/90 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent font-mono"
      >
        {/* History Loader Trigger */}
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
                {log.details && (
                    <span className="block text-slate-500 text-xs mt-0.5 ml-2 border-l-2 border-slate-700 pl-2">
                        {log.details}
                    </span>
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Typing Cursor Effect */}
        {status === 'running' && (
            <motion.div 
                animate={{ opacity: [0, 1, 0] }} 
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-2 h-4 bg-emerald-500 mt-2"
            />
        )}
      </div>

      {/* Status Footer */}
      <div className="bg-neutral-900 border-t border-white/5 px-4 py-2 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest">
        <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-emerald-500" />
                MT5: Connected
            </span>
            <span className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-purple-500" />
                CPU: 12%
            </span>
            <span className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-blue-500" />
                Memory: 480MB
            </span>
        </div>
        <div className="flex items-center gap-2">
            <span>Pid: 8492</span>
            <span>Uptime: 4d 12h</span>
        </div>
      </div>

      {/* Toast Notification Simulation (Fixed Position inside Terminal) */}
      <AnimatePresence>
         {logs.some(l => (l.category === 'CRITICAL' || l.category === 'FAIL') && logs.indexOf(l) === logs.length - 1) && (
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
                        {logs.find(l => l.category === 'CRITICAL' || l.category === 'FAIL')?.message || "Erro detectado na execução."}
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded font-bold transition-colors">
                            Ver Detalhes
                        </button>
                        <button className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-1.5 rounded font-bold transition-colors">
                            Dispensar
                        </button>
                    </div>
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