import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  Mic, 
  Globe, 
  Youtube, 
  X, 
  Volume2, 
  Activity, 
  Signal, 
  Cast, 
  Languages,
  Maximize2
} from 'lucide-react';

interface NeuralEventCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock de transcrição para simulação
const TRANSCRIPTS = {
  'PT-BR': [
    "A inflação permanece elevada, e o FOMC está fortemente comprometido em retornar à meta de 2%.",
    "Continuaremos a monitorar os dados econômicos recebidos.",
    "O mercado de trabalho mostra sinais de reequilíbrio, mas a demanda excede a oferta.",
    "Nossas decisões futuras dependerão da totalidade dos dados, não de um único ponto.",
    "Não esperamos que seja apropriado reduzir o intervalo da meta até que tenhamos maior confiança."
  ],
  'EN-US': [
    "Inflation remains elevated, and the FOMC is strongly committed to returning inflation to the 2% objective.",
    "We will continue to monitor incoming economic data closely.",
    "The labor market is showing signs of rebalancing, but demand still exceeds supply.",
    "Our future decisions will depend on the totality of the data, not a single data point.",
    "We do not expect it will be appropriate to reduce the target range until we have gained greater confidence."
  ],
  'CN': [
    "通胀仍然居高不下，联邦公开市场委员会坚决致力于将通胀率恢复至 2% 的目标。",
    "我们将继续密切关注即将发布的经济数据。",
    "劳动力市场显示出重新平衡的迹象，但需求仍然超过供给。",
    "我们未来的决定将取决于数据的整体情况，而不是单一的数据点。",
    "在我们获得更大的信心之前，我们不认为降低目标区间是合适的。"
  ]
};

export function NeuralEventCenter({ isOpen, onClose }: NeuralEventCenterProps) {
  const [source, setSource] = useState<'FED' | 'WHITE_HOUSE'>('FED');
  const [language, setLanguage] = useState<'PT-BR' | 'EN-US' | 'CN'>('PT-BR');
  const [isAiDubbing, setIsAiDubbing] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [liveText, setLiveText] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState<number[]>(new Array(20).fill(10));

  // Simulation of Live Transcription
  useEffect(() => {
    if (!isOpen) return;
    setLiveText([]);
    
    let index = 0;
    const interval = setInterval(() => {
       if (index < TRANSCRIPTS[language].length) {
         setLiveText(prev => [...prev, TRANSCRIPTS[language][index]].slice(-4)); // Keep last 4 lines
         index++;
       } else {
         index = 0; // Loop for demo
       }
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, language]);

  // Simulation of Audio Visualizer
  useEffect(() => {
    if (!isOpen || !isAiDubbing) return;
    const interval = setInterval(() => {
        setAudioLevel(prev => prev.map(() => Math.random() * 40 + 10));
    }, 100);
    return () => clearInterval(interval);
  }, [isOpen, isAiDubbing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] relative"
      >
        {/* HEADER */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#050505]">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full animate-pulse">
                 <div className="w-2 h-2 bg-red-500 rounded-full" />
                 <span className="text-xs font-bold text-red-500 tracking-wider">AO VIVO AGORA</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                 <Activity className="w-5 h-5 text-blue-500" />
                 MACRO EVENT CENTER
              </h2>
           </div>

           <div className="flex items-center gap-4">
              {/* SOURCE SELECTOR */}
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                 <button 
                   onClick={() => setSource('FED')}
                   className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${source === 'FED' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                   FEDERAL RESERVE
                 </button>
                 <button 
                   onClick={() => setSource('WHITE_HOUSE')}
                   className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${source === 'WHITE_HOUSE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                   WHITE HOUSE
                 </button>
              </div>

              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
           </div>
        </div>

        {/* MAIN STAGE */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* VIDEO FEED */}
            <div className="flex-1 bg-black relative flex flex-col">
               {/* Embed Mock (Using an Image or Generic Video for Safety, ideally Youtube Embed) */}
               <div className="relative w-full h-full">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&mute=1&controls=0&loop=1&modestbranding=1&rel=0" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    className="opacity-80 grayscale-[0.3]"
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin"
                   ></iframe>
                  
                  {/* OVERLAY UI */}
                  <div className="absolute top-6 left-6 flex gap-2">
                     <div className="px-3 py-1 bg-black/60 backdrop-blur border border-white/10 rounded text-[10px] font-mono text-white">
                        SATELLITE FEED: SECURE
                     </div>
                     <div className="px-3 py-1 bg-black/60 backdrop-blur border border-white/10 rounded text-[10px] font-mono text-emerald-400 flex items-center gap-2">
                        <Signal className="w-3 h-3" /> 12ms LATENCY
                     </div>
                  </div>

                  {/* SUBTITLES OVERLAY */}
                  <div className="absolute bottom-12 left-0 right-0 flex justify-center pb-8 px-10">
                      <div className="max-w-4xl w-full bg-black/70 backdrop-blur-md border border-white/10 rounded-xl p-6 min-h-[120px] flex flex-col items-center text-center">
                          <AnimatePresence mode='popLayout'>
                            {liveText.map((text, i) => (
                                <motion.p 
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`text-lg font-medium tracking-wide ${i === liveText.length - 1 ? 'text-white scale-105 font-bold' : 'text-slate-400 blur-[1px]'}`}
                                >
                                    {text}
                                </motion.p>
                            ))}
                          </AnimatePresence>
                      </div>
                  </div>
               </div>
            </div>

            {/* SIDEBAR CONTROL */}
            <div className="w-80 bg-[#0a0a0a] border-l border-white/10 flex flex-col z-20">
               
               {/* AI VOICE CONTROL */}
               <div className="p-5 border-b border-white/10 bg-[#0f0f11]">
                  <div className="flex items-center justify-between mb-4">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Mic className="w-3 h-3" /> Neural Dubbing
                     </span>
                     <div 
                       onClick={() => setIsAiDubbing(!isAiDubbing)}
                       className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isAiDubbing ? 'bg-emerald-500' : 'bg-slate-700'}`}
                     >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAiDubbing ? 'left-6' : 'left-1'}`} />
                     </div>
                  </div>

                  <div className="h-16 bg-black/50 rounded-lg border border-white/5 flex items-center justify-center gap-1 px-4 overflow-hidden">
                     {isAiDubbing ? (
                        audioLevel.map((h, i) => (
                            <motion.div 
                                key={i}
                                animate={{ height: h }}
                                className="w-1.5 bg-emerald-500 rounded-full opacity-80"
                            />
                        ))
                     ) : (
                        <span className="text-[10px] text-slate-600 font-mono">AUDIO BYPASS ACTIVE</span>
                     )}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500 text-center">
                     {isAiDubbing ? 'Voz Neural Humanizada: Ativada' : 'Áudio Original: Direto'}
                  </p>
               </div>

               {/* LANGUAGE SELECTOR */}
               <div className="p-5 border-b border-white/10">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <Globe className="w-3 h-3" /> Tradução em Tempo Real
                   </span>
                   <div className="grid grid-cols-1 gap-2">
                      {(['PT-BR', 'EN-US', 'CN'] as const).map(lang => (
                          <button
                            key={lang}
                            onClick={() => setLanguage(lang)}
                            className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${language === lang ? 'bg-white/10 border-blue-500/50 text-white' : 'bg-transparent border-white/5 text-slate-500 hover:bg-white/5'}`}
                          >
                             <div className="flex items-center gap-3">
                                <Languages className="w-4 h-4" />
                                <span className="text-xs font-bold">{lang}</span>
                             </div>
                             {language === lang && <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}
                          </button>
                      ))}
                   </div>
               </div>

               {/* BROADCAST CONTROL */}
               <div className="p-5 mt-auto bg-gradient-to-t from-blue-900/10 to-transparent">
                   <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4">
                       <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-red-400 flex items-center gap-2">
                             <Youtube className="w-4 h-4" /> CANAL NEURAL
                          </span>
                          {isBroadcasting && <span className="text-[10px] text-red-500 animate-pulse font-bold">● ON AIR</span>}
                       </div>
                       <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                          Replicar sinal traduzido diretamente para o YouTube Live da Neural Day Trader.
                       </p>
                       <button 
                         onClick={() => setIsBroadcasting(!isBroadcasting)}
                         className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${isBroadcasting ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40' : 'bg-transparent text-slate-400 border-white/10 hover:border-red-500/50 hover:text-white'}`}
                       >
                          {isBroadcasting ? 'Interromper Transmissão' : 'Iniciar Simulcast'}
                       </button>
                   </div>
               </div>

            </div>
        </div>
      </motion.div>
    </div>
  );
}