/**
 * Estágio 1 da ponte decisão→execução real (Fase 6).
 * Ver research/AI_BRAIN_SPEC.md seção 9.1 — desenho completo e decisões travadas.
 *
 * Contrato deste módulo (não violar sem nova discussão explícita com Cleber):
 * - LIVE + somente alerta. Nunca chama /broker/execute, nunca persiste, nunca
 *   toca MetaAPI.
 * - Módulo isolado: só lê a decisão via callback do useApexLogic
 *   (`onLiveDecision`) — não reaproveita nem duplica a lógica de sinal.
 * - Disclaimer permanente obrigatório em TODO alerta, não só uma vez.
 * - Só ativa quando executionMode === 'LIVE' (em DEMO o alerta seria ruído
 *   sem sentido — DEMO já persiste e simula normalmente).
 */
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TradeVisual } from '../../hooks/useApexLogic';

export const LIVE_ALERT_DISCLAIMER =
  '⚠️ Decisão baseada em regra técnica — sem validação estatística de edge comprovada.';

export interface LiveAlertEvent {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  tp: number;
  sl: number;
  ai_confidence: number;
  reasoning: string;
  timestamp: number;
  disclaimer: string;
}

interface UseLiveAlertStageParams {
  executionMode: 'DEMO' | 'LIVE';
  /** Estágio 1 é opt-in — não liga sozinho junto com LIVE. */
  enabled: boolean;
  /** Histórico local de alertas, mais recente primeiro. Limitado a 50. */
  maxHistory?: number;
}

export function useLiveAlertStage({ executionMode, enabled, maxHistory = 50 }: UseLiveAlertStageParams) {
  const [alerts, setAlerts] = useState<LiveAlertEvent[]>([]);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const executionModeRef = useRef(executionMode);
  executionModeRef.current = executionMode;

  const onLiveDecision = useCallback((decision: TradeVisual) => {
    // Estágio 1 só existe em LIVE — em DEMO a decisão já segue o caminho normal
    // (persistência simulada), alertar aqui seria ruído duplicado.
    if (executionModeRef.current !== 'LIVE' || !enabledRef.current) return;

    const event: LiveAlertEvent = {
      id: decision.id,
      symbol: decision.symbol,
      side: decision.side,
      price: decision.price,
      tp: decision.tp,
      sl: decision.sl,
      ai_confidence: decision.ai_confidence,
      reasoning: decision.reasoning,
      timestamp: decision.timestamp,
      disclaimer: LIVE_ALERT_DISCLAIMER,
    };

    setAlerts(prev => [event, ...prev].slice(0, maxHistory));

    toast(`${event.side === 'LONG' ? '🟢' : '🔴'} Sinal LIVE (somente alerta): ${event.symbol}`, {
      description: `@ ${event.price} | Confiança: ${event.ai_confidence}% | ${event.reasoning}\n${LIVE_ALERT_DISCLAIMER}`,
      duration: 8000,
    });
  }, [maxHistory]);

  return { alerts, onLiveDecision };
}
