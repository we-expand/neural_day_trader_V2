import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, X, Activity, Zap, Radio, CheckCircle2, AlertCircle, Volume2 } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';
import { toast } from 'sonner';

// Browser Speech Recognition Types
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export function VoiceAssistant({ embedded = false }: { embedded?: boolean }) {
  const { setConfig, setRiskProfile, setAssetSelectionMode, setSelectedAsset, panicClose } = useTradingContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;

    if (Recognition) {
      const recognition = new Recognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
        setAiResponse('');
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (transcript) {
          processCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Error", event);
        setIsListening(false);
        setAiResponse("Erro ao capturar áudio. Tente novamente.");
      };

      recognitionRef.current = recognition;
    }
  }, [transcript]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Navegador não suporta reconhecimento de voz.");
      return;
    }

    // Only toggle the modal if NOT embedded. Embedded has its own UI inline.
    if (!embedded && !isOpen) setIsOpen(true);

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started or error
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current.start(), 200);
      }
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  // --- THE BRAIN: Natural Language Processing (Simulated) ---
  const processCommand = async (text: string) => {
    setIsProcessing(true);
    const lower = text.toLowerCase();
    
    // Artificial Delay for "Thinking" effect
    await new Promise(r => setTimeout(r, 1500));

    let response = "Entendido. ";
    let changesCount = 0;

    // 1. RISK ANALYSIS
    if (lower.includes('agressivo') || lower.includes('alavancado') || lower.includes('risco alto')) {
      setRiskProfile('AGGRESSIVE');
      setConfig(prev => ({ ...prev, maxContracts: 1.0, stopLossMode: 'DINAMICO' }));
      response += "Modo Agressivo ativado. Aumentando alavancagem. ";
      changesCount++;
    } else if (lower.includes('conservador') || lower.includes('seguro') || lower.includes('protegido')) {
      setRiskProfile('CONSERVATIVE');
      setConfig(prev => ({ ...prev, maxContracts: 0.05, stopLossMode: 'FIXO' }));
      response += "Perfil Conservador aplicado. Priorizando proteção de capital. ";
      changesCount++;
    } else if (lower.includes('institucional') || lower.includes('smart money') || lower.includes('smc')) {
      setRiskProfile('INSTITUTIONAL_SMC');
      response += "Algoritmo SMC Institucional calibrado. Buscando liquidez. ";
      changesCount++;
    }

    // 2. ASSET SELECTION
    if (lower.includes('bitcoin') || lower.includes('btc')) {
      setAssetSelectionMode('MANUAL');
      setSelectedAsset('BTCUSDT');
      response += "Focando exclusivamente em Bitcoin. ";
      changesCount++;
    } else if (lower.includes('ethereum') || lower.includes('eth')) {
      setAssetSelectionMode('MANUAL');
      setSelectedAsset('ETHUSDT');
      response += "Monitorando Ethereum. ";
      changesCount++;
    } else if (lower.includes('ouro') || lower.includes('gold') || lower.includes('xau')) {
      setAssetSelectionMode('MANUAL');
      setSelectedAsset('XAUUSD');
      response += "Análise de Ouro iniciada. ";
      changesCount++;
    } else if (lower.includes('automático') || lower.includes('qualquer') || lower.includes('melhor oportunidade')) {
      setAssetSelectionMode('AI');
      response += "Varredura automática de mercado ativada. Buscando melhores oportunidades. ";
      changesCount++;
    }

    // 3. STRATEGY
    if (lower.includes('scalp') || lower.includes('rápido') || lower.includes('curto')) {
      setConfig(prev => ({ ...prev, marketMode: 'SCALP', targetPoints: 'CURTO' }));
      response += "Estratégia de Scalping configurada para operações rápidas. ";
      changesCount++;
    } else if (lower.includes('tendência') || lower.includes('longo') || lower.includes('swing')) {
      setConfig(prev => ({ ...prev, marketMode: 'TREND', targetPoints: 'LONGO' }));
      response += "Estratégia de Tendência configurada. Buscando movimentos longos. ";
      changesCount++;
    }

    // 4. PANIC / EMERGENCY COMMANDS
    if (lower.includes('pânico') || lower.includes('fechar tudo') || lower.includes('parar tudo') || lower.includes('emergência') || lower.includes('stop all') || lower.includes('panic')) {
        panicClose();
        response = "ALERTA: PROTOCOLO DE PÂNICO ATIVADO. ENCERRANDO TODAS AS POSIÇÕES IMEDIATAMENTE.";
        setAiResponse(response);
        speak("Protocolo de pânico ativado. Fechando tudo.");
        setIsProcessing(false);
        return; // Exit early to prioritize panic
    }

    if (changesCount === 0) {
      response = "Desculpe, não entendi o comando de setup. Tente algo como 'Operar Bitcoin agressivo' ou 'Modo conservador em Ouro'.";
    }

    setAiResponse(response);
    speak(response);
    setIsProcessing(false);
  };

  // --- EMBEDDED MODE RENDER ---
  if (embedded) {
    return (
      <div className="bg-gradient-to-r from-purple-900/20 to-black border border-purple-500/30 rounded-xl p-6 relative overflow-hidden group">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              Configuração por Voz (Neural Speech)
            </h3>
            <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
              Fale com a IA para ajustar instantaneamente sua estratégia. <br />
              <span className="text-slate-500 text-xs italic">Ex: "Quero operar Bitcoin modo agressivo", "Buscar tendências em Ouro", "Modo conservador Forex".</span>
            </p>

            {/* Live Feedback Area */}
            <AnimatePresence mode="wait">
              {(isListening || isProcessing || aiResponse) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 bg-black/40 border border-purple-500/20 rounded-lg p-3"
                >
                   {isListening && !transcript && (
                      <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase animate-pulse">
                        <Activity className="w-4 h-4" /> Ouvindo comando...
                      </div>
                   )}
                   {transcript && (
                      <p className="text-white text-sm">"{transcript}"</p>
                   )}
                   {isProcessing && (
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase mt-2">
                        <Zap className="w-4 h-4 animate-spin" /> Processando...
                      </div>
                   )}
                   {aiResponse && !isListening && !isProcessing && (
                      <div className="flex items-start gap-2 text-emerald-300 text-sm mt-2">
                         <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                         {aiResponse}
                      </div>
                   )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={toggleListening}
            className={`relative flex items-center justify-center w-16 h-16 rounded-full border-2 transition-all duration-300 shadow-xl ${
              isListening 
                ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.4)] scale-110' 
                : 'bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30 hover:scale-105'
            }`}
          >
            {isListening ? (
              <div className="relative">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <Activity className="w-8 h-8 relative z-10" />
              </div>
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- DEFAULT FLOATING RENDER ---
  return (
    <>
      {/* Floating Trigger Button */}
      <motion.button
        onClick={toggleListening}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300 ${
          isListening 
            ? 'bg-red-500/20 border border-red-500 text-red-400 animate-pulse' 
            : 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20'
        }`}
      >
        {isListening ? <Activity className="w-6 h-6 animate-bounce" /> : <Mic className="w-6 h-6" />}
      </motion.button>

      {/* Interface Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-50 w-96 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-gradient-to-r from-emerald-900/20 to-transparent">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-50" />
                </div>
                <span className="text-sm font-bold text-white uppercase tracking-widest">Neural Voice AI</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col items-center justify-center min-h-[200px] relative">
              
              {/* Visualizer */}
              <div className="w-full h-32 flex items-center justify-center gap-1 mb-6 relative">
                 {isProcessing ? (
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                   </div>
                 ) : isListening ? (
                    // Audio Waveform Simulation
                    Array.from({ length: 12 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: [10, Math.random() * 60 + 20, 10],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.5,
                          delay: i * 0.05,
                        }}
                        className="w-2 bg-emerald-500/80 rounded-full"
                      />
                    ))
                 ) : (
                    <div className="text-center">
                       <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                          <Mic className="w-8 h-8 text-emerald-500/50" />
                       </div>
                       <p className="text-xs text-slate-500 font-mono">Toque no microfone para falar</p>
                    </div>
                 )}
              </div>

              {/* Status Text */}
              <div className="w-full text-center space-y-2">
                {transcript && (
                  <p className="text-lg font-medium text-white/90 leading-relaxed">
                    "{transcript}"
                  </p>
                )}
                
                {isProcessing && (
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest animate-pulse">
                    Processando Intenção...
                  </p>
                )}

                {aiResponse && !isListening && !isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-slate-300 text-left mt-4"
                  >
                    <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold text-xs uppercase">
                      <Zap className="w-3 h-3" />
                      <span>Configuração Aplicada</span>
                    </div>
                    {aiResponse}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-white/5 bg-black/50 flex flex-col gap-3">
               <div className="flex justify-center gap-4">
                 {!isListening ? (
                   <button 
                     onClick={toggleListening}
                     className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                   >
                     <Mic className="w-4 h-4" />
                     Falar Setup
                   </button>
                 ) : (
                   <button 
                     onClick={toggleListening}
                     className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-sm transition-colors shadow-lg shadow-red-500/20 animate-pulse"
                   >
                     <Radio className="w-4 h-4" />
                     Parar Ouvir
                   </button>
                 )}
               </div>
               
               <button 
                  onClick={() => {
                      if (window.confirm("TEM CERTEZA? ISSO FECHARÁ TODAS AS POSIÇÕES!")) {
                          panicClose();
                          setIsOpen(false);
                      }
                  }}
                  className="w-full py-2 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-500 rounded-lg text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02]"
               >
                  🚨 PANIC BUTTON (Fechar Tudo)
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}