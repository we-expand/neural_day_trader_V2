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
 *  2. Toda vez que uma pergunta é reconhecida (com ou sem "nexus"), abre/
 *     estende uma janela de conversa — enquanto ela não expira, qualquer
 *     fala seguinte já é tratada como pergunta ao NEXUS, sem precisar
 *     repetir "nexus" de novo. Cada turno estende a janela; só depois de
 *     ~1min de silêncio real a conversa "fecha" e a palavra de ativação
 *     volta a ser exigida. Pedido do Cleber (2026-08-25): manter diálogo
 *     fluente, não forçar "nexus" a cada frase.
 *  3. Pausa a escuta enquanto o NEXUS está falando (evita ele se ouvir e
 *     reagir à própria voz) — a janela de conversa continua contando mesmo
 *     assim, então a escuta reabre já em modo "aguardando pergunta".
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// "nexus" não é palavra comum em pt-BR — o motor de reconhecimento de voz
// erra a transcrição com frequência (ouve "nexos", "nexo", "nécsus", "next
// us" etc.), o que antes exigia repetir a palavra várias vezes até acertar
// por acaso. Fix (2026-08-25): aceita as variações fonéticas mais comuns,
// igual já foi feito pra tickers no reconhecimento de ativo (c930bd9f6).
const WAKE_WORD = /\bn[eé]x[uoi]?s?\b|\bnext\s*us\b/i;
// Janela de conversa contínua — cada pergunta reconhecida (com ou sem
// "nexus") estende essa janela por mais esse tanto. Enquanto ela não
// expirar, o usuário pode encadear perguntas sem repetir a palavra de
// ativação. 60s de silêncio real (nenhuma fala captada) fecha a conversa.
const FOLLOWUP_WINDOW_MS = 60_000;

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
        const afterWake = transcript.replace(/.*?(\bn[eé]x[uoi]?s?\b|\bnext\s*us\b)/i, '').trim();
        // Toda interação (com pergunta junto ou só a ativação) estende a
        // janela de conversa — depois da 1ª vez que "nexus" é dito, o
        // usuário encadeia perguntas sem repetir a palavra enquanto a
        // conversa continuar fluindo.
        awaitingUntilRef.current = Date.now() + FOLLOWUP_WINDOW_MS;
        setMicState('awaiting-question');
        onQuestion(afterWake.length > 2 ? afterWake : null);
      } else if (isAwaitingFollowup) {
        // Dentro da janela de conversa: estende de novo (turno seguinte
        // continua sem precisar de "nexus") e trata a fala como pergunta.
        awaitingUntilRef.current = Date.now() + FOLLOWUP_WINDOW_MS;
        onQuestion(transcript);
      }
      // Fala sem "nexus" e fora da janela de conversa: ignora — é conversa
      // de fundo, não dirigida ao assistente.
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
      //
      // BUG corrigido aqui (2026-08-25): `shouldRunRef` é um ref ÚNICO
      // compartilhado por TODAS as instâncias de recognition já criadas
      // (cada pausa/retomada por causa de `isSpeaking` cria um objeto novo
      // via `startRecognition`). O `onend` de uma instância ANTIGA já
      // descartada é assíncrono e pode disparar DEPOIS que uma instância
      // NOVA já foi criada e está rodando (ex: usuário pergunta de novo
      // rápido, NEXUS responde, `isSpeaking` liga/desliga, um novo
      // `recognition` é criado enquanto o `onend` do antigo ainda não tinha
      // dado o sinal). Como o handler só checava `shouldRunRef.current`
      // (true nesse momento, porque já estamos ouvindo de novo), ele dava
      // `.start()` na instância FANTASMA antiga — dois `SpeechRecognition`
      // concorrentes tentando usar o mesmo microfone, o que faz o navegador
      // abortar ou embaralhar um dos dois de forma imprevisível. Resultado
      // na prática: a escuta "engasgava" logo depois da 1ª resposta e a
      // janela de conversa contínua parecia nunca funcionar, exigindo
      // "nexus" de novo. Fix: só reinicia se ESTA instância ainda for a
      // instância corrente (`recognitionRef.current === recognition`) — uma
      // instância superada nunca reinicia a si mesma.
      if (shouldRunRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // Já rodando ou trocando de estado rápido demais — próximo ciclo de efeito corrige.
        }
      } else if (recognitionRef.current === recognition) {
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
