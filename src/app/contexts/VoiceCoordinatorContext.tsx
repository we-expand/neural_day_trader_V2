/**
 * 🎙️ Coordenador de voz — garante que só UMA tela narre por voz ao mesmo tempo.
 *
 * ✅ 2026-07-28: até aqui, `LiquidityPrediction.tsx` (Feed Neural, IA Preditiva)
 * e `AITraderVoice.tsx` (AI Trader Voice) cada um instancia seu próprio
 * `useSpeechAlert()` isolado — nada impedia as duas telas narrarem ao mesmo
 * tempo, disputando a fila global `window.speechSynthesis` do navegador de
 * forma imprevisível. Este contexto não substitui `useSpeechAlert` (cada tela
 * continua com sua própria instância/lógica de fala) — só arbitra QUEM pode
 * estar com a voz ativa: quando uma tela liga a voz, ela "reivindica" o
 * locutor global; se a outra estiver ativa, é forçada a desligar a própria
 * voz imediatamente (mutex, não fila).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type VoiceOwner = 'ia-preditiva' | 'ai-trader-voice' | 'jarvis';

interface VoiceCoordinatorValue {
  activeOwner: VoiceOwner | null;
  /** Reivindica a voz para `owner`. Se outro dono estava ativo, seu handler de preempção é chamado. */
  claimVoice: (owner: VoiceOwner) => void;
  /** Libera a voz se `owner` for quem está ativo no momento (não-op caso contrário). */
  releaseVoice: (owner: VoiceOwner) => void;
  /** Registra o callback que desliga a voz local quando outra tela assume. Retorna função de limpeza. */
  onPreempted: (owner: VoiceOwner, handler: () => void) => () => void;
}

const VoiceCoordinatorContext = createContext<VoiceCoordinatorValue | null>(null);

export function VoiceCoordinatorProvider({ children }: { children: ReactNode }) {
  const [activeOwner, setActiveOwner] = useState<VoiceOwner | null>(null);
  const handlersRef = useRef<Partial<Record<VoiceOwner, () => void>>>({});

  const claimVoice = useCallback((owner: VoiceOwner) => {
    setActiveOwner((prev) => {
      if (prev && prev !== owner) {
        const preemptedHandler = handlersRef.current[prev];
        if (preemptedHandler) preemptedHandler();
      }
      return owner;
    });
  }, []);

  const releaseVoice = useCallback((owner: VoiceOwner) => {
    setActiveOwner((prev) => (prev === owner ? null : prev));
  }, []);

  const onPreempted = useCallback((owner: VoiceOwner, handler: () => void) => {
    handlersRef.current[owner] = handler;
    return () => {
      if (handlersRef.current[owner] === handler) {
        delete handlersRef.current[owner];
      }
    };
  }, []);

  return (
    <VoiceCoordinatorContext.Provider value={{ activeOwner, claimVoice, releaseVoice, onPreempted }}>
      {children}
    </VoiceCoordinatorContext.Provider>
  );
}

export function useVoiceCoordinator(): VoiceCoordinatorValue {
  const ctx = useContext(VoiceCoordinatorContext);
  if (!ctx) {
    throw new Error('useVoiceCoordinator precisa estar dentro de <VoiceCoordinatorProvider>');
  }
  return ctx;
}
