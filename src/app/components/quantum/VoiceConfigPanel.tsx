import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, VolumeX, Settings, Check, AlertCircle, Play, Pause } from 'lucide-react';
import { useVoiceSystem } from '@/app/hooks/useVoiceSystem';

interface VoiceConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceConfigPanel: React.FC<VoiceConfigPanelProps> = ({ isOpen, onClose }) => {
  const {
    config,
    setConfig,
    isListening,
    isSpeaking,
    transcript,
    voiceAnalysis,
    availableVoices,
    microphonePermission,
    isSupported,
    error,
    requestPermission,
    startListening,
    stopListening,
    speak
  } = useVoiceSystem();

  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [testingVoice, setTestingVoice] = useState(false);

  // Auto-select best Portuguese voice when voices are loaded
  useEffect(() => {
    if (availableVoices.length > 0) {
      const ptVoiceIndex = availableVoices.findIndex(v => v.lang.startsWith('pt-BR') || v.lang.startsWith('pt'));
      if (ptVoiceIndex !== -1) {
        setSelectedVoiceIndex(ptVoiceIndex);
        setConfig(prev => ({ ...prev, ttsVoice: availableVoices[ptVoiceIndex] }));
      }
    }
  }, [availableVoices]);

  const handlePermissionRequest = async () => {
    await requestPermission();
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleTestVoice = () => {
    setTestingVoice(true);
    speak(
      'Olá, eu sou o Nexus Quantum Advisor. Estou aqui para ajudá-lo a operar com disciplina e precisão.',
      'normal'
    );
    setTimeout(() => setTestingVoice(false), 5000);
  };

  const handleVoiceChange = (index: number) => {
    setSelectedVoiceIndex(index);
    setConfig(prev => ({ ...prev, ttsVoice: availableVoices[index] }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-[#1a1a1a] to-black border border-purple-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-b from-black to-transparent p-6 pb-4 border-b border-white/10 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">
                    Configurações de Voz
                  </h2>
                  <p className="text-xs text-slate-400">
                    Sistema de Análise Vocal e Assistente Nexus
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
              >
                <span className="text-white text-lg">×</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Browser Support Check */}
            {!isSupported && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-red-400 mb-1">
                      Navegador Não Suportado
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Seu navegador não suporta reconhecimento de voz. Por favor, use Google Chrome, Microsoft Edge ou Safari para utilizar este recurso.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-yellow-400 mb-1">Atenção</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Microphone Permission */}
            <div className="bg-gradient-to-br from-blue-950/20 to-black border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Permissão de Microfone
                  </h3>
                  <p className="text-xs text-slate-400">
                    Necessário para análise vocal e comandos de voz
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  microphonePermission === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : microphonePermission === 'denied'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}>
                  {microphonePermission === 'granted' ? 'Concedida' : 
                   microphonePermission === 'denied' ? 'Negada' : 'Pendente'}
                </div>
              </div>

              {microphonePermission !== 'granted' && (
                <button
                  onClick={handlePermissionRequest}
                  disabled={!isSupported}
                  className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border border-blue-500/30 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Solicitar Permissão de Microfone
                </button>
              )}

              {microphonePermission === 'granted' && (
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">
                    Microfone autorizado e pronto para uso
                  </span>
                </div>
              )}
            </div>

            {/* Voice Recognition Controls */}
            <div className="bg-gradient-to-br from-purple-950/20 to-black border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Reconhecimento de Voz
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comandos vocais e análise emocional em tempo real
                  </p>
                </div>
                <button
                  onClick={handleToggleListening}
                  disabled={!isSupported || microphonePermission !== 'granted'}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                    isListening
                      ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border border-red-500/30 text-white'
                      : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 border border-emerald-500/30 text-white'
                  }`}
                >
                  {isListening ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Iniciar
                    </>
                  )}
                </button>
              </div>

              {/* Live Transcript */}
              {isListening && (
                <div className="bg-black/40 border border-white/10 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-400 uppercase">
                      Escutando...
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium min-h-[40px]">
                    {transcript || 'Aguardando sua voz...'}
                  </p>
                  
                  {voiceAnalysis && (
                    <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Estado Emocional</span>
                        <div className={`text-xs font-bold mt-1 capitalize ${
                          voiceAnalysis.emotionalState === 'calm' ? 'text-emerald-400' :
                          voiceAnalysis.emotionalState === 'confident' ? 'text-blue-400' :
                          voiceAnalysis.emotionalState === 'anxious' ? 'text-yellow-400' :
                          voiceAnalysis.emotionalState === 'stressed' ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {voiceAnalysis.emotionalState}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Nível de Stress</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-neutral-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                voiceAnalysis.stressLevel > 70 ? 'bg-red-500' :
                                voiceAnalysis.stressLevel > 40 ? 'bg-yellow-500' :
                                'bg-emerald-500'
                              }`}
                              style={{ width: `${voiceAnalysis.stressLevel}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-white">
                            {voiceAnalysis.stressLevel}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Voice Synthesis Controls */}
            <div className="bg-gradient-to-br from-cyan-950/20 to-black border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Síntese de Voz (Nexus)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configurações da voz do assistente
                  </p>
                </div>
                <button
                  onClick={handleTestVoice}
                  disabled={testingVoice || availableVoices.length === 0}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 border border-cyan-500/30 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingVoice ? (
                    <>
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      Testando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Testar Voz
                    </>
                  )}
                </button>
              </div>

              {/* Voice Selection */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                    Voz do Nexus
                  </label>
                  <select
                    value={selectedVoiceIndex}
                    onChange={(e) => handleVoiceChange(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {availableVoices.map((voice, idx) => (
                      <option key={idx} value={idx}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rate Control */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">
                      Velocidade
                    </label>
                    <span className="text-xs text-white font-mono">
                      {config.ttsRate.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={config.ttsRate}
                    onChange={(e) => setConfig(prev => ({ ...prev, ttsRate: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {/* Pitch Control */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">
                      Tom
                    </label>
                    <span className="text-xs text-white font-mono">
                      {config.ttsPitch.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={config.ttsPitch}
                    onChange={(e) => setConfig(prev => ({ ...prev, ttsPitch: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {/* Volume Control */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">
                      Volume
                    </label>
                    <span className="text-xs text-white font-mono">
                      {Math.round(config.ttsVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.ttsVolume}
                    onChange={(e) => setConfig(prev => ({ ...prev, ttsVolume: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-1">
                    Privacidade e Segurança
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Todos os dados de voz são processados localmente no seu navegador. Nenhum áudio é enviado para servidores externos. 
                    A análise emocional é baseada em padrões de fala e não armazena conteúdo de áudio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
