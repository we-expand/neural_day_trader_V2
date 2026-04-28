import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Settings, Brain, TrendingUp, Activity } from 'lucide-react';
import { QuantumChart } from './QuantumChart';
import { ButterflyMatrix } from './ButterflyMatrix';
import { OperationModeSelector, OperationMode } from './OperationModeSelector';
import { DisciplineScore } from './DisciplineScore';
import { VoiceConfigPanel } from './VoiceConfigPanel';
import { useVoiceSystem } from '@/app/hooks/useVoiceSystem';
import { NexusAlertSystem } from '@/app/services/NexusAlertSystem';
import { toast } from 'sonner';

interface QuantumAnalysisProps {
  symbol?: string;
  timeframe?: string;
}

export const QuantumAnalysis: React.FC<QuantumAnalysisProps> = ({
  symbol = 'EUR/USD',
  timeframe = '1D'
}) => {
  const [operationMode, setOperationMode] = useState<OperationMode>('HYBRID');
  const [isVoiceConfigOpen, setIsVoiceConfigOpen] = useState(false);
  const [mockTrades, setMockTrades] = useState<any[]>([]);
  
  const {
    isListening,
    isSpeaking,
    voiceAnalysis,
    microphonePermission,
    requestPermission,
    startListening,
    stopListening,
    speak
  } = useVoiceSystem();

  // Register voice system with alert system
  useEffect(() => {
    NexusAlertSystem.registerVoiceSystem(speak);
  }, [speak]);

  // Monitor emotional state and trigger tilt alerts
  useEffect(() => {
    if (voiceAnalysis && voiceAnalysis.isTilted) {
      console.log('[Quantum Analysis] TILT DETECTED:', voiceAnalysis);
      
      NexusAlertSystem.alertTilt(voiceAnalysis.stressLevel, 'pause');
      
      // Auto-pause for 10 minutes if in AUTONOMOUS mode
      if (operationMode === 'AUTONOMOUS') {
        toast.warning('Modo Autônomo pausado por segurança. Detectado alto nível de estresse.');
      }
    }
  }, [voiceAnalysis, operationMode]);

  // Handle spoofing detection from chart
  const handleSpoofingDetected = useCallback((alert: any) => {
    console.log('[Quantum Analysis] Spoofing detected:', alert);
    NexusAlertSystem.alertSpoofing(
      alert.price,
      alert.type,
      alert.message
    );
  }, []);

  // Handle correlation detection from chart
  const handleCorrelationDetected = useCallback((alert: any) => {
    console.log('[Quantum Analysis] Correlation detected:', alert);
    NexusAlertSystem.alertCorrelation(
      alert.asset,
      symbol,
      alert.impact,
      15
    );
  }, [symbol]);

  // Handle lead asset detection from butterfly matrix
  const handleLeadAssetDetected = useCallback((asset: any) => {
    console.log('[Quantum Analysis] Lead asset detected:', asset);
    NexusAlertSystem.alertCorrelation(
      asset.name,
      symbol,
      asset.changePercent > 0 ? 'bullish' : 'bearish',
      asset.leadTime
    );
  }, [symbol]);

  // Handle mode change
  const handleModeChange = (mode: OperationMode) => {
    setOperationMode(mode);
    
    const modeMessages = {
      SOLO: 'Modo Solo ativado. Você está no controle. Eu monitoro e aviso sobre riscos.',
      HYBRID: 'Modo Híbrido ativado. Vou sugerir as melhores oportunidades. Você confirma as entradas.',
      AUTONOMOUS: 'Modo Autônomo ativado. Assumindo controle total das operações. Reportarei status continuamente.'
    };
    
    speak(modeMessages[mode], 'high');
    toast.success(`Modo ${mode} ativado`);
  };

  // Initialize voice system on first render
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  
  useEffect(() => {
    if (!hasRequestedPermission && microphonePermission === 'prompt') {
      // Show voice config panel automatically on first load
      setTimeout(() => {
        setIsVoiceConfigOpen(true);
        setHasRequestedPermission(true);
      }, 2000);
    }
  }, [microphonePermission, hasRequestedPermission]);

  // Handle voice toggle
  const handleVoiceToggle = async () => {
    if (microphonePermission !== 'granted') {
      setIsVoiceConfigOpen(true);
      return;
    }

    if (isListening) {
      stopListening();
      speak('Escuta desativada.', 'low');
    } else {
      await startListening();
      speak('Escuta ativada. Estou pronto para receber comandos.', 'normal');
    }
  };

  return (
    <div className="w-full h-full bg-[#0a0a0a] text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Brain className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wide">
              Análise Quântica
            </h2>
            <p className="text-xs text-slate-400">
              Inteligência de mercado em tempo real
            </p>
          </div>
        </div>

        {/* Voice & Mode Controls */}
        <div className="flex items-center gap-3">
          {/* Voice Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/10 rounded-lg">
            {isSpeaking && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-cyan-500"
              />
            )}
            {isListening && !isSpeaking && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500"
              />
            )}
            {!isListening && !isSpeaking && (
              <div className="w-2 h-2 rounded-full bg-slate-600" />
            )}
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {isSpeaking ? 'Falando...' : isListening ? 'Escutando...' : 'Offline'}
            </span>
          </div>

          {/* Voice Toggle */}
          <button
            onClick={handleVoiceToggle}
            className={`p-2.5 rounded-lg border transition-all ${
              isListening
                ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30'
            }`}
            title={isListening ? 'Desativar microfone' : 'Ativar microfone'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Voice Config */}
          <button
            onClick={() => setIsVoiceConfigOpen(true)}
            className="p-2.5 rounded-lg bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30 transition-all"
            title="Configurações de voz"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="bg-gradient-to-br from-black to-[#0a0a0a] border border-white/10 rounded-xl p-4">
        <OperationModeSelector
          currentMode={operationMode}
          onModeChange={handleModeChange}
        />
      </div>

      {/* Main Grid: Chart + Butterfly Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart (2/3 width) */}
        <div className="lg:col-span-2 h-[600px]">
          <QuantumChart
            symbol={symbol}
            timeframe={timeframe}
            onSpoofingDetected={handleSpoofingDetected}
            onCorrelationDetected={handleCorrelationDetected}
          />
        </div>

        {/* Butterfly Matrix + Stats (1/3 width) */}
        <div className="space-y-4">
          <ButterflyMatrix
            targetSymbol={symbol}
            onLeadAssetDetected={handleLeadAssetDetected}
          />

          {/* Voice Analysis Card */}
          {voiceAnalysis && isListening && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-purple-950/20 to-black border border-purple-500/30 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white uppercase">Análise de Voz</h4>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase mb-1">Transcrição</div>
                  <p className="text-xs text-white font-medium leading-relaxed">
                    "{voiceAnalysis.transcript}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Estado</div>
                    <div className={`text-xs font-bold capitalize ${
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
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Stress</div>
                    <div className={`text-xs font-bold ${
                      voiceAnalysis.stressLevel > 70 ? 'text-red-400' :
                      voiceAnalysis.stressLevel > 40 ? 'text-yellow-400' :
                      'text-emerald-400'
                    }`}>
                      {voiceAnalysis.stressLevel}%
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase mb-2">Nível de Stress</div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${
                        voiceAnalysis.stressLevel > 70 ? 'bg-red-500' :
                        voiceAnalysis.stressLevel > 40 ? 'bg-yellow-500' :
                        'bg-emerald-500'
                      }`}
                      animate={{ width: `${voiceAnalysis.stressLevel}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {voiceAnalysis.isTilted && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                    <p className="text-[10px] text-red-400 font-bold">
                      ⚠️ ALERTA DE TILT DETECTADO
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Discipline Score */}
      <div>
        <DisciplineScore
          trades={mockTrades}
          currentStressLevel={voiceAnalysis?.stressLevel || 0}
          currentEmotionalState={voiceAnalysis?.emotionalState || 'calm'}
        />
      </div>

      {/* Voice Config Modal */}
      <VoiceConfigPanel
        isOpen={isVoiceConfigOpen}
        onClose={() => setIsVoiceConfigOpen(false)}
      />

      {/* Welcome Message */}
      {microphonePermission === 'granted' && !hasRequestedPermission && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 bg-gradient-to-r from-purple-600 to-cyan-600 border-2 border-purple-400 rounded-lg p-4 shadow-2xl max-w-sm z-50"
        >
          <div className="flex items-start gap-3">
            <Brain className="w-6 h-6 text-white flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-white mb-1">
                Nexus Quantum Advisor Online
              </div>
              <p className="text-xs text-white/90 leading-relaxed">
                Sistema de voz ativado. Clique no ícone do microfone para começar a interagir comigo.
              </p>
            </div>
            <button
              onClick={() => setHasRequestedPermission(true)}
              className="text-white/60 hover:text-white text-lg"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};