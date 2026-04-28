import { useState, useEffect, useRef, useCallback } from 'react';

export type EmotionalState = 'calm' | 'confident' | 'anxious' | 'stressed' | 'tilted';

export interface VoiceAnalysis {
  transcript: string;
  confidence: number;
  emotionalState: EmotionalState;
  stressLevel: number; // 0-100
  isTilted: boolean;
  timestamp: number;
}

export interface VoiceSystemConfig {
  enabled: boolean;
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  ttsVoice?: SpeechSynthesisVoice;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
}

const DEFAULT_CONFIG: VoiceSystemConfig = {
  enabled: false,
  language: 'pt-BR',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  ttsRate: 1.0,
  ttsPitch: 1.0,
  ttsVolume: 1.0
};

// Analyze emotional state from speech patterns
const analyzeEmotionalState = (
  transcript: string,
  confidence: number,
  previousStressLevel: number
): { emotionalState: EmotionalState; stressLevel: number } => {
  const lowerTranscript = transcript.toLowerCase();
  
  // Keywords indicating stress/tilt
  const stressKeywords = [
    'droga', 'merda', 'porra', 'caralho', 'pqp',
    'não acredito', 'de novo', 'sempre', 'nunca',
    'perdi', 'perdendo', 'stop', 'stoppado', 'liquidado',
    'dobrar', 'recuperar', 'vingança', 'tudo', 'all in'
  ];
  
  // Keywords indicating confidence/overconfidence
  const confidenceKeywords = [
    'fácil', 'certeza', 'garantido', 'óbvio', 'claro',
    'sempre ganho', 'disparado', 'subindo', 'lua', 'moon',
    'alavancar', 'máximo', 'tudo dentro'
  ];
  
  // Keywords indicating calm/discipline
  const calmKeywords = [
    'plano', 'estratégia', 'disciplina', 'calma', 'paciência',
    'aguardar', 'analisar', 'esperar', 'observar', 'monitorar'
  ];
  
  let stressScore = 0;
  let confidenceScore = 0;
  let calmScore = 0;
  
  // Count keyword matches
  stressKeywords.forEach(keyword => {
    if (lowerTranscript.includes(keyword)) stressScore += 15;
  });
  
  confidenceKeywords.forEach(keyword => {
    if (lowerTranscript.includes(keyword)) confidenceScore += 10;
  });
  
  calmKeywords.forEach(keyword => {
    if (lowerTranscript.includes(keyword)) calmScore += 8;
  });
  
  // Speech recognition confidence affects stress (lower confidence = more stress)
  if (confidence < 0.5) stressScore += 10;
  
  // Rapid repeated phrases indicate stress
  const words = lowerTranscript.split(' ');
  const uniqueWords = new Set(words);
  if (words.length > 5 && uniqueWords.size / words.length < 0.6) {
    stressScore += 15;
  }
  
  // Calculate final stress level (smooth transition from previous)
  const rawStressLevel = Math.min(stressScore, 100);
  const stressLevel = Math.round(previousStressLevel * 0.7 + rawStressLevel * 0.3);
  
  // Determine emotional state
  let emotionalState: EmotionalState = 'calm';
  
  if (stressLevel > 70) {
    emotionalState = 'tilted';
  } else if (stressLevel > 50) {
    emotionalState = 'stressed';
  } else if (stressLevel > 30) {
    emotionalState = 'anxious';
  } else if (confidenceScore > calmScore && confidenceScore > 20) {
    emotionalState = 'confident';
  } else {
    emotionalState = 'calm';
  }
  
  return { emotionalState, stressLevel };
};

export const useVoiceSystem = () => {
  const [config, setConfig] = useState<VoiceSystemConfig>(DEFAULT_CONFIG);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysis | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const stressLevelRef = useRef(0);
  const emotionalLogRef = useRef<VoiceAnalysis[]>([]);

  // Check browser support
  const isSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) &&
    'speechSynthesis' in window;

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isSupported) {
      setError('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = config.language;
    recognition.continuous = config.continuous;
    recognition.interimResults = config.interimResults;
    recognition.maxAlternatives = config.maxAlternatives;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      console.log('[Voice System] 🎤 Listening started');
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('[Voice System] 🎤 Listening stopped');
      
      // Auto-restart if enabled
      if (config.enabled && config.continuous) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.log('[Voice System] Recognition restart skipped (already running)');
          }
        }, 100);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice System] ❌ Error:', event.error);
      
      if (event.error === 'not-allowed') {
        setMicrophonePermission('denied');
        setError('Permissão de microfone negada. Ative nas configurações do navegador.');
      } else if (event.error === 'no-speech') {
        // Silently ignore no-speech errors
        console.log('[Voice System] No speech detected, continuing...');
      } else {
        setError(`Erro de reconhecimento: ${event.error}`);
      }
    };

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const transcriptText = result[0].transcript;
      const confidence = result[0].confidence;

      setTranscript(transcriptText);

      // Analyze emotional state
      const { emotionalState, stressLevel } = analyzeEmotionalState(
        transcriptText,
        confidence,
        stressLevelRef.current
      );

      stressLevelRef.current = stressLevel;

      const analysis: VoiceAnalysis = {
        transcript: transcriptText,
        confidence,
        emotionalState,
        stressLevel,
        isTilted: emotionalState === 'tilted' || stressLevel > 70,
        timestamp: Date.now()
      };

      setVoiceAnalysis(analysis);
      
      // Store in emotional log
      emotionalLogRef.current.push(analysis);
      if (emotionalLogRef.current.length > 50) {
        emotionalLogRef.current = emotionalLogRef.current.slice(-50);
      }

      console.log('[Voice System] 📊', {
        transcript: transcriptText,
        emotionalState,
        stressLevel,
        isTilted: analysis.isTilted
      });
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [config, isSupported]);

  // Initialize Speech Synthesis
  useEffect(() => {
    if (!isSupported) return;

    synthesisRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const voices = synthesisRef.current!.getVoices();
      setAvailableVoices(voices);
      
      // Auto-select best Portuguese voice
      const ptVoice = voices.find(v => v.lang.startsWith('pt-BR') || v.lang.startsWith('pt'));
      if (ptVoice && !config.ttsVoice) {
        setConfig(prev => ({ ...prev, ttsVoice: ptVoice }));
      }
    };

    loadVoices();
    synthesisRef.current!.onvoiceschanged = loadVoices;
  }, [isSupported]);

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setError('Reconhecimento de voz não suportado neste navegador.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicrophonePermission('granted');
      setError(null);
      return true;
    } catch (err) {
      console.error('[Voice System] Permission denied:', err);
      setMicrophonePermission('denied');
      setError('Permissão de microfone negada. Ative nas configurações do navegador.');
      return false;
    }
  }, [isSupported]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) return;

    if (microphonePermission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      recognitionRef.current.start();
      setConfig(prev => ({ ...prev, enabled: true }));
    } catch (e) {
      console.log('[Voice System] Already listening');
    }
  }, [isSupported, microphonePermission, requestPermission]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setConfig(prev => ({ ...prev, enabled: false }));
    }
  }, []);

  // Speak text
  const speak = useCallback((text: string, priority: 'low' | 'normal' | 'high' = 'normal') => {
    if (!isSupported || !synthesisRef.current) {
      console.warn('[Voice System] Speech synthesis not available');
      return;
    }

    // Cancel low priority speech if already speaking
    if (isSpeaking && priority === 'low') {
      console.log('[Voice System] Skipping low priority speech (already speaking)');
      return;
    }

    // Cancel current speech for high priority
    if (priority === 'high' && isSpeaking) {
      synthesisRef.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.voice = config.ttsVoice || null;
    utterance.rate = config.ttsRate;
    utterance.pitch = config.ttsPitch;
    utterance.volume = config.ttsVolume;
    utterance.lang = config.language;

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log('[Voice System] 🔊 Speaking:', text);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log('[Voice System] 🔊 Speech ended');
    };

    utterance.onerror = (event) => {
      console.error('[Voice System] Speech error:', event);
      setIsSpeaking(false);
    };

    synthesisRef.current.speak(utterance);
  }, [isSupported, isSpeaking, config]);

  // Get emotional log summary
  const getEmotionalSummary = useCallback(() => {
    const log = emotionalLogRef.current;
    if (log.length === 0) return null;

    const avgStress = log.reduce((sum, a) => sum + a.stressLevel, 0) / log.length;
    const tiltedCount = log.filter(a => a.isTilted).length;
    const calmCount = log.filter(a => a.emotionalState === 'calm').length;
    
    const stateDistribution = {
      calm: log.filter(a => a.emotionalState === 'calm').length,
      confident: log.filter(a => a.emotionalState === 'confident').length,
      anxious: log.filter(a => a.emotionalState === 'anxious').length,
      stressed: log.filter(a => a.emotionalState === 'stressed').length,
      tilted: log.filter(a => a.emotionalState === 'tilted').length
    };

    return {
      avgStressLevel: Math.round(avgStress),
      tiltedPercentage: Math.round((tiltedCount / log.length) * 100),
      calmPercentage: Math.round((calmCount / log.length) * 100),
      stateDistribution,
      totalSamples: log.length
    };
  }, []);

  // Clear emotional log
  const clearEmotionalLog = useCallback(() => {
    emotionalLogRef.current = [];
    stressLevelRef.current = 0;
  }, []);

  return {
    // State
    config,
    isListening,
    isSpeaking,
    transcript,
    voiceAnalysis,
    availableVoices,
    microphonePermission,
    isSupported,
    error,
    
    // Actions
    setConfig,
    requestPermission,
    startListening,
    stopListening,
    speak,
    getEmotionalSummary,
    clearEmotionalLog
  };
};
