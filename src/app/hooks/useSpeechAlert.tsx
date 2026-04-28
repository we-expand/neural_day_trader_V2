import { useCallback, useRef, useState, useEffect } from 'react';

interface SpeechAlertOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

type VoiceGender = 'male' | 'female';

export function useSpeechAlert(options: SpeechAlertOptions = {}) {
  const { rate = 0.95, pitch = 1.0, volume = 1.0 } = options;
  const isSpeakingRef = useRef(false);
  const lastSpokenRef = useRef<string>('');
  const lastSpeakTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [voiceGender, setVoiceGender] = useState<VoiceGender>(() => {
    return (localStorage.getItem('neural_voice_gender') as VoiceGender) || 'female';
  });

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    return localStorage.getItem('neural_voice_enabled') !== 'false';
  });

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load voices when available
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const changeVoiceGender = useCallback((gender: VoiceGender) => {
    setVoiceGender(gender);
    localStorage.setItem('neural_voice_gender', gender);
  }, []);

  const stopSpeaking = useCallback(() => {
    // Stop HTML audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
  }, []);

  const toggleVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabled(enabled);
    localStorage.setItem('neural_voice_enabled', String(enabled));
    if (!enabled) stopSpeaking();
  }, [stopSpeaking]);

  // Clean text for TTS
  const cleanText = useCallback((text: string): string => {
    let clean = text
      .replace(/[🚨🐋💎⚠️📊🏦📉⚡🤖💰⛓️🛡️🚀🎭📈🔥🟢🔴⚪⏰🌏🎯💡✅❌⭐🔵]/g, '')
      .replace(/\(0x[a-f0-9.]+\)/gi, '')
      .replace(/~\$[\d.]+M/g, '')
      .replace(/\$[\d,]+/g, (m) => `${m.replace(/\$/g, '')} dólares`)
      .replace(/\+(\d+\.?\d*)%/g, 'mais $1 por cento')
      .replace(/-(\d+\.?\d*)%/g, 'menos $1 por cento')
      .replace(/(\d+\.?\d*)%/g, '$1 por cento')
      .trim();

    if (clean.length > 200) {
      const parts = clean.split('.');
      clean = parts[0] + '.';
    }
    return clean;
  }, []);

  // 🎙️ Select best Portuguese voice from available voices
  const selectVoice = useCallback((gender: VoiceGender, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    const ptVoices = voices.filter(v =>
      v.lang.startsWith('pt') || v.lang.startsWith('pt-BR') || v.lang.startsWith('pt-PT')
    );
    const enVoices = voices.filter(v => v.lang.startsWith('en'));

    const pool = ptVoices.length > 0 ? ptVoices : enVoices;
    if (pool.length === 0) return null;

    if (gender === 'female') {
      const female = pool.find(v =>
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('fernanda') ||
        v.name.toLowerCase().includes('luciana') ||
        v.name.toLowerCase().includes('sabina') ||
        v.name.toLowerCase().includes('joanna') ||
        v.name.toLowerCase().includes('sonia') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('google')
      );
      return female || pool[0];
    } else {
      const male = pool.find(v =>
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('daniel') ||
        v.name.toLowerCase().includes('jorge') ||
        v.name.toLowerCase().includes('paulo') ||
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('mark')
      );
      return male || pool[0];
    }
  }, []);

  // 🔊 BROWSER TTS FALLBACK (reliable, always works)
  const speakBrowser = useCallback((text: string, priority: 'high' | 'normal'): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        console.warn('[TTS] SpeechSynthesis not supported in this browser');
        resolve();
        return;
      }

      if (priority === 'high') {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Try to select an appropriate voice
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = selectVoice(voiceGender, voices);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utteranceRef.current = utterance;
      isSpeakingRef.current = true;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        resolve();
      };

      utterance.onerror = (e) => {
        console.error('[TTS] Browser speech error:', e);
        isSpeakingRef.current = false;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, [rate, pitch, volume, voiceGender, selectVoice]);

  // 🎤 MAIN SPEAK FUNCTION — tries Google TTS first, falls back to browser
  const speak = useCallback(async (text: string, priority: 'high' | 'normal' = 'normal'): Promise<void> => {
    if (!voiceEnabled) return Promise.resolve();

    const now = Date.now();
    if (priority !== 'high' && now - lastSpeakTimeRef.current < 6000) return Promise.resolve();
    if (text === lastSpokenRef.current && priority !== 'high') return Promise.resolve();
    if (isSpeakingRef.current && priority !== 'high') return Promise.resolve();
    if (priority === 'high' && isSpeakingRef.current) stopSpeaking();

    const textToSpeak = cleanText(text);
    if (!textToSpeak || textToSpeak.length < 2) return Promise.resolve();

    isSpeakingRef.current = true;
    lastSpokenRef.current = text;
    lastSpeakTimeRef.current = now;

    console.log('[TTS] 🎙️ Speaking:', textToSpeak.substring(0, 60) + '...');

    // Use browser TTS directly (reliable)
    try {
      await speakBrowser(textToSpeak, priority);
    } catch (err) {
      console.error('[TTS] Error:', err);
      isSpeakingRef.current = false;
    }

    return Promise.resolve();
  }, [voiceEnabled, cleanText, stopSpeaking, speakBrowser]);

  return {
    speak,
    stopSpeaking,
    voiceGender,
    changeVoiceGender,
    voiceEnabled,
    toggleVoiceEnabled,
    availableVoices,
  };
}
