import React, { useState, useEffect, useRef } from 'react';
import { Clock, Play, Pause, RotateCcw, Coffee, BrainCircuit, TrendingUp, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function SessionTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  const [sessionCount, setSessionCount] = useState(0); // 🆕 Contador de sessões concluídas
  const [totalFocusTime, setTotalFocusTime] = useState(0); // 🆕 Total de minutos focados hoje
  
  // Audio Ref (Optional, simulated with toast for now)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        
        // 🆕 Acumula tempo de foco
        if (mode === 'FOCUS') {
          setTotalFocusTime(prev => prev + (1/60)); // +1 segundo convertido em minutos
        }
      }, 1000);
    } else if (timeLeft === 0) {
      // Timer Finished
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      handleComplete();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, mode]);

  const handleComplete = () => {
    if (mode === 'FOCUS') {
        setSessionCount(prev => prev + 1); // 🆕 Incrementa contador
        toast.success("🎯 Sessão de Foco Concluída!", { 
            description: `${sessionCount + 1}ª sessão concluída. Performance mental em alta.`,
            icon: <Coffee className="w-5 h-5 text-amber-500" />
        });
        setMode('BREAK');
        setTimeLeft(5 * 60); // 5 min break
    } else {
        toast.success("💪 Descanso Concluído!", { 
            description: "Energia restaurada. Volte com foco máximo.",
            icon: <BrainCircuit className="w-5 h-5 text-purple-500" />
        });
        setMode('FOCUS');
        setTimeLeft(25 * 60); // 25 min focus
    }
  };

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
      setIsActive(false);
      setTimeLeft(mode === 'FOCUS' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = mode === 'FOCUS' 
     ? ((25 * 60 - timeLeft) / (25 * 60)) * 100 
     : ((5 * 60 - timeLeft) / (5 * 60)) * 100;

  return (
    <div className="relative group">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            isActive 
              ? 'bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
        }`}>
            {mode === 'FOCUS' ? <BrainCircuit className="w-4 h-4" /> : <Coffee className="w-4 h-4 text-amber-400" />}
            
            <span className="font-mono font-bold text-sm min-w-[48px]">
                {formatTime(timeLeft)}
            </span>

            <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-2">
                <button onClick={toggleTimer} className="hover:text-white transition-colors" title={isActive ? 'Pausar' : 'Iniciar'}>
                    {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
                <button onClick={resetTimer} className="hover:text-white transition-colors" title="Resetar">
                    <RotateCcw className="w-3 h-3" />
                </button>
            </div>
            
            {/* Progress Bar Bottom */}
            <div className="absolute bottom-0 left-0 h-0.5 bg-purple-500/30 w-full overflow-hidden rounded-b-lg">
                <div 
                    className={`h-full transition-all duration-1000 ${mode === 'FOCUS' ? 'bg-purple-500' : 'bg-amber-500'}`}
                    style={{ width: `${progress}%` }} 
                />
            </div>
        </div>

        {/* 🆕 TOOLTIP PROFISSIONAL COM ESTATÍSTICAS */}
        <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-black/95 border border-purple-500/30 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <p className="text-[10px] text-slate-500 uppercase font-bold">Pomodoro Trader</p>
            </div>
            
            <p className="text-xs text-slate-300 mb-3">
                {mode === 'FOCUS' 
                  ? '🧠 Modo Foco Ativo. Evite distrações e mantenha disciplina.' 
                  : '☕ Modo Recuperação. Respire, hidrate-se e prepare-se.'}
            </p>

            {/* 🆕 ESTATÍSTICAS DA SESSÃO */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Sessões Completas</span>
                    <span className="text-xs font-bold text-purple-400">{sessionCount}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Tempo Focado Hoje</span>
                    <span className="text-xs font-bold text-emerald-400">{Math.floor(totalFocusTime)} min</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Performance Mental</span>
                    <span className="text-xs font-bold text-amber-400">
                        {sessionCount >= 4 ? 'EXCELENTE' : sessionCount >= 2 ? 'BOA' : 'INICIANDO'}
                    </span>
                </div>
            </div>

            {/* 🆕 DICA PROFISSIONAL */}
            <div className="mt-3 pt-2 border-t border-white/5">
                <div className="flex items-start gap-2">
                    <Zap className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        {sessionCount === 0 && "25 min de foco intenso evitam overtrading e decisões impulsivas."}
                        {sessionCount === 1 && "Traders de sucesso fazem pausas estratégicas para manter clareza mental."}
                        {sessionCount === 2 && "A cada 4 sessões, faça um descanso mais longo (15-30 min)."}
                        {sessionCount >= 3 && "Excelente! Disciplina mental = Lucros consistentes."}
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}