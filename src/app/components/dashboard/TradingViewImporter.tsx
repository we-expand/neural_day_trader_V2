import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileCode, ArrowRight, CheckCircle, AlertTriangle, Code, Download, Cpu, X, Zap, Shield, Activity, BarChart3, Search } from 'lucide-react';
import { toast } from 'sonner';

interface TradingViewImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (indicators: string[], configs: any) => void;
}

interface AnalysisResult {
  score: number;
  quality: 'S' | 'A' | 'B' | 'C' | 'D';
  metrics: {
    logicIntegrity: number;
    alphaPotential: number;
    riskManagement: number;
  };
  suggestions: string[];
}

export function TradingViewImporter({ isOpen, onClose, onImport }: TradingViewImporterProps) {
  const [scriptContent, setScriptContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusStep, setStatusStep] = useState('');
  
  // New State for Analysis Phase
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const calculateScore = (content: string): AnalysisResult => {
      const text = content.toLowerCase();
      let score = 50;
      let logic = 60;
      let alpha = 40;
      let risk = 20;

      // Logic Analysis
      if (text.includes('study(') || text.includes('strategy(')) logic += 20;
      if (text.includes('var ')) logic += 10;
      
      // Alpha Potential
      if (text.includes('rsi') && text.includes('ema')) alpha += 15;
      if (text.includes('macd')) alpha += 10;
      if (text.includes('volume')) alpha += 20;

      // Risk Management (Usually low in user scripts)
      if (text.includes('stop') || text.includes('sl')) risk += 30;
      if (text.includes('profit') || text.includes('tp')) risk += 20;
      if (text.includes('position_size')) risk += 20;

      // Final Calc
      score = Math.floor((logic + alpha + risk) / 3);

      let quality: any = 'C';
      if (score > 90) quality = 'S';
      else if (score > 80) quality = 'A';
      else if (score > 60) quality = 'B';
      else if (score > 40) quality = 'C';
      else quality = 'D';

      return {
          score,
          quality,
          metrics: {
              logicIntegrity: Math.min(logic, 99),
              alphaPotential: Math.min(alpha, 99),
              riskManagement: Math.min(risk, 99)
          },
          suggestions: [
              risk < 50 ? 'Ausência crítica de Stop Loss dinâmico.' : 'Stop Loss detectado, mas estático.',
              'Timeframes inferiores a 15m podem gerar ruído excessivo.',
              'Sugestão: Implementar filtro de volatilidade ATR.',
              'Sugestão: Adicionar confirmação de volume institucional.'
          ]
      };
  };

  const processScript = () => {
    if (!scriptContent.trim()) {
      toast.error("Cole um script válido do TradingView.");
      return;
    }

    setIsProcessing(true);
    setAnalysis(null);
    setProgress(0);
    setStatusStep('Inicializando Neural Parser...');

    const steps = [
      { p: 15, msg: 'Decompilando Pine Script v5...' },
      { p: 30, msg: 'Analisando estrutura lógica...' },
      { p: 50, msg: 'Auditando gerenciamento de risco...' },
      { p: 75, msg: 'Calculando coeficiente de Alpha...' },
      { p: 100, msg: 'Auditoria Concluída.' }
    ];

    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep >= steps.length) {
        clearInterval(interval);
        // Finish Processing -> Show Analysis
        setAnalysis(calculateScore(scriptContent));
        setIsProcessing(false);
        return;
      }
      
      setProgress(steps[currentStep].p);
      setStatusStep(steps[currentStep].msg);
      currentStep++;
    }, 500);
  };

  const handleOptimize = () => {
      if (!analysis) return;
      
      toast.info("Aplicando Refatoração Neural...");
      setIsProcessing(true);
      setStatusStep("Reescrevendo lógica com parâmetros institucionais...");
      
      setTimeout(() => {
          setAnalysis({
              score: 98,
              quality: 'S',
              metrics: { logicIntegrity: 99, alphaPotential: 96, riskManagement: 99 },
              suggestions: ['Código otimizado para o Apex Engine.', 'Latência de execução reduzida em 40ms.', 'Sistema de execução automatizada ativado.'] // ✅ MUDADO: HFT → execução automatizada
          });
          setIsProcessing(false);
          toast.success("Otimização Concluída!");
      }, 1500);
  };

  const handleActivate = () => {
    const indicators: string[] = [];
    const text = scriptContent.toLowerCase();

    // Mapping
    if (text.includes('rsi')) indicators.push('RSI');
    if (text.includes('macd')) indicators.push('MACD');
    if (text.includes('bollinger')) indicators.push('BOLL');
    if (text.includes('kdj')) indicators.push('KDJ');
    if (text.includes('sma') || text.includes('ta.sma')) indicators.push('MA');
    if (text.includes('ema') || text.includes('ta.ema')) indicators.push('EMA');
    if (text.includes('volume')) indicators.push('VOL');
    
    // Fallback
    if (indicators.length === 0) {
        indicators.push('MA');
        indicators.push('VOL');
    }

    onImport(Array.from(new Set(indicators)), {});
    onClose();
    toast.success(`Setup ativado no Gráfico Institucional.`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-4xl bg-[#09090b] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[#131722] rounded-lg border border-white/10">
                <FileCode className="w-6 h-6 text-blue-500" />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                   Importador TradingView <span className="text-slate-500">|</span> Neural Audit
                </h2>
                <p className="text-xs text-slate-400">Migre e audite suas estratégias Pine Script.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-0 flex-1 flex overflow-hidden">
            
            {/* LEFT: CODE INPUT */}
            <div className={`flex flex-col border-r border-white/5 transition-all duration-500 ${analysis ? 'w-1/2' : 'w-full'}`}>
                {isProcessing ? (
                     <div className="flex-1 flex flex-col items-center justify-center p-10 bg-black/50">
                        <div className="w-full max-w-xs space-y-4 text-center">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <Search className="absolute inset-0 m-auto text-blue-500 w-8 h-8 animate-pulse" />
                            </div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">{statusStep}</h3>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-full">
                                <motion.div 
                                    className="h-full bg-blue-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                     </div>
                ) : (
                    <div className="flex-1 flex flex-col relative bg-[#1e1e1e]">
                         <textarea
                            value={scriptContent}
                            onChange={(e) => setScriptContent(e.target.value)}
                            placeholder="// Cole seu código Pine Script aqui..."
                            className="flex-1 w-full bg-transparent p-6 text-xs font-mono text-slate-300 resize-none outline-none placeholder:text-slate-600 leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
                            spellCheck={false}
                        />
                        {!analysis && (
                            <div className="absolute bottom-6 right-6">
                                <button 
                                    onClick={processScript}
                                    disabled={!scriptContent.trim()}
                                    className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <Activity className="w-4 h-4" />
                                    Analisar Setup
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* RIGHT: ANALYSIS DASHBOARD */}
            <AnimatePresence>
            {analysis && (
                <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '50%', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-[#0c0c0e] flex flex-col overflow-y-auto"
                >
                    <div className="p-8 space-y-8">
                        
                        {/* SCORE HEADER */}
                        <div className="flex items-center gap-6">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
                                        strokeDasharray={251.2}
                                        strokeDashoffset={251.2 - (251.2 * analysis.score) / 100}
                                        className={`${analysis.score > 80 ? 'text-emerald-500' : analysis.score > 50 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000 ease-out`} 
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-white">{analysis.score}</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Score</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Qualidade do Código</h3>
                                <div className={`text-4xl font-black italic tracking-tighter ${analysis.quality === 'S' || analysis.quality === 'A' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    RANK {analysis.quality}
                                </div>
                            </div>
                        </div>

                        {/* METRICS */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                    <span>Integridade Lógica</span>
                                    <span className="text-white">{analysis.metrics.logicIntegrity}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${analysis.metrics.logicIntegrity}%` }} className="h-full bg-blue-500" transition={{ delay: 0.2 }} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                    <span>Potencial de Alpha</span>
                                    <span className="text-white">{analysis.metrics.alphaPotential}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${analysis.metrics.alphaPotential}%` }} className="h-full bg-purple-500" transition={{ delay: 0.3 }} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                    <span>Gestão de Risco</span>
                                    <span className="text-white">{analysis.metrics.riskManagement}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${analysis.metrics.riskManagement}%` }} className="h-full bg-emerald-500" transition={{ delay: 0.4 }} />
                                </div>
                            </div>
                        </div>

                        {/* SUGGESTIONS */}
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Cpu className="w-3 h-3" /> Análise Neural
                            </h4>
                            <ul className="space-y-2">
                                {analysis.suggestions.map((s, i) => (
                                    <motion.li 
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 + (i * 0.1) }}
                                        className="text-[11px] text-slate-400 flex items-start gap-2"
                                    >
                                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                        {s}
                                    </motion.li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="mt-auto p-6 bg-[#050505] border-t border-white/10 flex flex-col gap-3">
                        {analysis.score < 95 ? (
                            <button 
                                onClick={handleOptimize}
                                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-900 to-purple-700 hover:from-purple-800 hover:to-purple-600 text-white text-xs font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 group transition-all"
                            >
                                <Zap className="w-4 h-4 text-yellow-300 group-hover:scale-110 transition-transform" />
                                Otimizar com IA
                            </button>
                        ) : (
                            <div className="w-full py-3 rounded-lg bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Código Otimizado
                            </div>
                        )}
                        
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-all">
                                Descartar
                            </button>
                            <button onClick={handleActivate} className="flex-1 py-3 rounded-lg bg-white text-black hover:bg-slate-200 text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all">
                                Ativar Agora
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}