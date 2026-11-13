import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceCoordinator } from '@/app/contexts/VoiceCoordinatorContext';

// Web Speech API não tem tipo oficial no lib.dom — declaração mínima local.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: { [index: number]: { [index: number]: SpeechRecognitionResultLike; isFinal: boolean }; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

export type JarvisVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface UseJarvisVoiceOptions {
  onCommand: (transcript: string) => void;
}

/**
 * Voz do Jarvis: STT (comando por fala) + TTS (resposta falada).
 * Suporte depende do navegador (Web Speech API — Chrome/Edge têm STT,
 * Safari só TTS). Sem fallback fabricado: se a API não existir, o hook
 * expõe isSupported=false e a UI cai pra texto puro.
 */
export function useJarvisVoice({ onCommand }: UseJarvisVoiceOptions) {
  const { claimVoice, releaseVoice, onPreempted } = useVoiceCoordinator();
  const [state, setState] = useState<JarvisVoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const RecognitionCtor = getSpeechRecognitionCtor();
  const isSttSupported = !!RecognitionCtor;
  const isTtsSupported = typeof window !== 'undefined' && !!window.speechSynthesis;

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!isTtsSupported) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    claimVoice('jarvis');
    setState('speaking');
    utterance.onend = () => {
      setState('idle');
      releaseVoice('jarvis');
      onEnd?.();
    };
    utterance.onerror = () => {
      setState('idle');
      releaseVoice('jarvis');
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  }, [isTtsSupported, claimVoice, releaseVoice]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    if (!RecognitionCtor) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const recognition = new RecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (text) {
        setTranscript(text);
        setState('thinking');
        onCommand(text);
      }
    };
    recognition.onend = () => {
      setState((prev) => (prev === 'listening' ? 'idle' : prev));
    };
    recognition.onerror = () => {
      setState('idle');
    };

    recognitionRef.current = recognition;
    setState('listening');
    recognition.start();
  }, [RecognitionCtor, onCommand]);

  useEffect(() => {
    const cleanup = onPreempted('jarvis', () => {
      window.speechSynthesis?.cancel();
      setState('idle');
    });
    return cleanup;
  }, [onPreempted]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  return {
    state,
    transcript,
    isSttSupported,
    isTtsSupported,
    speak,
    startListening,
    stopListening,
  };
}
