/**
 * Voz do NEXUS — tenta ElevenLabs (voz neural, via `nexus-voice`) e cai pro
 * TTS nativo do navegador se a chave não estiver configurada, a cota do
 * plano free estourar, ou a rede falhar. Nunca trava a conversa por causa
 * da camada de voz.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { projectId } from '../../../../utils/supabase/info';

const NEXUS_VOICE_URL = `https://${projectId}.supabase.co/functions/v1/nexus-voice`;

function cleanForSpeech(text: string): string {
  return text
    .replace(/[🚨🐋💎⚠️📊🏦📉⚡🤖💰⛓️🛡️🚀🎭📈🔥🟢🔴⚪⏰🌏🎯💡✅❌⭐🔵]/g, '')
    .replace(/\$([\d,.]+)/g, '$1 dólares')
    .trim();
}

// AudioContext/AnalyserNode compartilhados — permitem ao NexusScene (3D)
// reagir em tempo real à amplitude do áudio neural, criando o efeito de
// "boca falando" no orbe sem precisar de lip-sync de verdade.
let sharedAudioCtx: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;
const levelData = new Uint8Array(64);

export function getNexusVoiceLevel(): number {
  if (!sharedAnalyser) return 0;
  sharedAnalyser.getByteFrequencyData(levelData);
  let sum = 0;
  for (let i = 0; i < levelData.length; i++) sum += levelData[i];
  return sum / levelData.length / 255; // 0..1
}

export function useNexusVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'neural' | 'browser' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Dispara o carregamento das vozes do navegador assim que o componente
  // monta, não só quando alguém fala — reduz o atraso da primeira fala
  // (getVoices() costuma vir vazio até o browser terminar de carregar).
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // getVoices() costuma devolver [] na primeira chamada — a lista só é
  // populada de fato depois do evento 'voiceschanged'. Sem esperar isso,
  // nenhuma voz pt-BR era encontrada e o fallback abaixo forçava
  // voices[0] (quase sempre inglês) — essa era a causa do sotaque
  // americanizado reportado em produção (2026-08-25).
  const loadVoices = useCallback((): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      const existing = window.speechSynthesis?.getVoices() ?? [];
      if (existing.length > 0) return resolve(existing);
      const handler = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis?.addEventListener('voiceschanged', handler);
      // Timeout de segurança — alguns navegadores nunca disparam o evento.
      setTimeout(() => resolve(window.speechSynthesis?.getVoices() ?? []), 500);
    });
  }, []);

  const speakBrowser = useCallback(
    async (text: string): Promise<void> => {
      if (!window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      utterance.pitch = 1.02;
      const voices = await loadVoices();
      const ptVoice =
        voices.find((v) => v.lang.startsWith('pt') && /google|natural|female|luciana/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('pt'));
      // Só atribui voz explícita se for pt de verdade — nunca força uma voz
      // de outro idioma. Sem voz pt encontrada, deixa utterance.voice vazio
      // e o navegador escolhe pelo campo `lang` sozinho (melhor esforço).
      if (ptVoice) utterance.voice = ptVoice;
      setVoiceMode('browser');
      await new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    },
    [loadVoices]
  );

  const speak = useCallback(
    async (text: string): Promise<void> => {
      const clean = cleanForSpeech(text);
      if (!clean) return;
      stop();
      setIsSpeaking(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('sem sessão');

        const res = await fetch(NEXUS_VOICE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: clean }),
        });

        if (!res.ok) throw new Error(`nexus-voice ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setVoiceMode('neural');

        try {
          if (!sharedAudioCtx) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            sharedAudioCtx = new AudioCtx();
          }
          if (sharedAudioCtx.state === 'suspended') await sharedAudioCtx.resume();
          const source = sharedAudioCtx.createMediaElementSource(audio);
          const analyser = sharedAudioCtx.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);
          analyser.connect(sharedAudioCtx.destination);
          sharedAnalyser = analyser;
        } catch {
          // Analyser é só cosmético (reatividade do orbe 3D) — nunca deve impedir a fala.
        }

        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
      } catch {
        // Voz neural indisponível (sem chave, cota estourada, rede) — cai pro TTS nativo, silenciosamente.
        await speakBrowser(clean);
      } finally {
        setIsSpeaking(false);
        sharedAnalyser = null;
      }
    },
    [stop, speakBrowser]
  );

  return { speak, stop, isSpeaking, voiceMode };
}
