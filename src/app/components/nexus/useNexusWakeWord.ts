/**
 * Escuta contínua por palavra de ativação ("Nexus") — pedido explícito do
 * Cleber: não quer botão de aperta-pra-falar, quer chamar "Nexus" como um
 * assistente de voz de verdade (Alexa/Siri).
 *
 * Usa a Web Speech API (SpeechRecognition) em modo `continuous`. Como o
 * navegador encerra o reconhecimento sozinho depois de um tempo de
 * silêncio (mesmo em modo contínuo), reinicia automaticamente enquanto
 * `enabled` for true — perda de sinal de rede ou pausa longa não derruba a
 * escuta permanentemente.
 *
 * Fluxo:
 *  1. Ouve tudo. Quando uma frase final contém "nexus", tudo que vem DEPOIS
 *     da palavra vira a pergunta (ex: "nexus qual o preço" -> "qual o preço").
 *  2. Se disser só "nexus" sozinho, entra em modo "aguardando pergunta" por
 *     alguns segundos — a próxima frase falada, mesmo sem repetir "nexus",
 *     já é tratada como a pergunta.
 *  3. Pausa a escuta enquanto o NEXUS está falando (evita ele se ouvir e
 *     reagir à própria voz).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const WAKE_WORD = /\bnexus\b/i;
const FOLLOWUP_WINDOW_MS = 8000;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // remove acentos pra casar "néxus"/"nexús" também
}

export function useNexusWakeWord(params: { enabled: boolean; isSpeaking: boolean; onQuestion: (question: string | null) => void }) {
  const { enabled, isSpeaking, onQuestion } = params;
  const [micState, setMicState] = useState<'off' | 'listening' | 'awaiting-question' | 'unsupported'>('off');
  const recognitionRef = useRef<any>(null);
  const awaitingUntilRef = useRef<number>(0);
  const shouldRunRef = useRef(false);

  const stopRecognition = useCallback(() => {
    shouldRunRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMicState('off');
  }, []);

  const startRecognition = useCallback(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;
    if (!Recognition) {
      setMicState('unsupported');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => {
      setMicState(Date.now() < awaitingUntilRef.current ? 'awaiting-question' : 'listening');
    };

    recognition.onresult = (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult?.isFinal) return;
      const transcript: string = lastResult[0].transcript.trim();
      if (!transcript) return;

      const normalized = normalize(transcript);
      const isAwaitingFollowup = Date.now() < awaitingUntilRef.current;

      if (WAKE_WORD.test(normalized)) {
        const afterWake = transcript.replace(/.*?\bnexus\b/i, '').trim();
        if (afterWake.length > 2) {
          awaitingUntilRef.current = 0;
          onQuestion(afterWake);
        } else {
          // Só a palavra de ativação (ou só uma saudação, ex: "bom dia
          // Nexus") — responde na hora com um aceno falado (question=null,
          // vira narração curta), em vez de ficar mudo esperando. Mantém a
          // janela de acompanhamento aberta pra já poder perguntar em
          // seguida sem repetir "Nexus".
          awaitingUntilRef.current = Date.now() + FOLLOWUP_WINDOW_MS;
          setMicState('awaiting-question');
          onQuestion(null);
        }
      } else if (isAwaitingFollowup) {
        awaitingUntilRef.current = 0;
        onQuestion(transcript);
      }
      // Fala sem "nexus" e fora da janela de acompanhamento: ignora — é
      // conversa de fundo, não dirigida ao assistente.
    };

    recognition.onerror = (e: any) => {
      // 'no-speech' e 'aborted' são normais em escuta contínua — não são erro real.
      if (e?.error !== 'no-speech' && e?.error !== 'aborted') {
        console.warn('[NEXUS wake-word] erro de reconhecimento:', e?.error);
      }
    };

    recognition.onend = () => {
      // Reinicia sozinho enquanto o modo de escuta contínua estiver ativo —
      // o navegador encerra a sessão de tempos em tempos mesmo em `continuous`.
      if (shouldRunRef.current) {
        try {
          recognition.start();
        } catch {
          // Já rodando ou trocando de estado rápido demais — próximo ciclo de efeito corrige.
        }
      } else {
        setMicState('off');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Chamada duplicada de start() em navegador que já está processando — ignora.
    }
  }, [onQuestion]);

  useEffect(() => {
    if (enabled && !isSpeaking) {
      // Espera um pouco antes de reabrir o microfone depois que o NEXUS
      // termina de falar — sem essa folga, o reconhecimento pega a cauda/eco
      // da própria voz (reverb do alto-falante) junto com o começo do que o
      // usuário disser a seguir, prejudicando a precisão do reconhecimento.
      const delay = setTimeout(() => {
        shouldRunRef.current = true;
        startRecognition();
      }, 350);
      return () => clearTimeout(delay);
    }
    shouldRunRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (!enabled) setMicState('off');
    return () => {
      shouldRunRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isSpeaking]);

  return { micState, stopRecognition };
}
