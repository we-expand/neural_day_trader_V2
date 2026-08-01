/**
 * Estágio 3 da ponte decisão→execução real (Fase 6).
 * Ver research/AI_BRAIN_SPEC.md seção 9.1 — desenho completo e decisões
 * travadas — e `SESSAO_2026-07-31_DEVLAB_AUDITORIA.md` ("Autonomia de
 * entrada/saída automática").
 *
 * ⚠️ Diferença central do Estágio 2: aqui NÃO existe aprovação humana por
 * trade. A decisão do motor vira ordem real na corretora sozinha. Por isso
 * este módulo é mais travado que o Estágio 2, não menos:
 *
 * - **Tamanho de posição mínimo travado**: ignora `decision.amount` e sempre
 *   usa o lote mínimo do ativo (`asset.minLot`), nunca o tamanho que o motor
 *   calculou. Remover essa trava é o Estágio 4 (`AI_BRAIN_SPEC.md` 9.1,
 *   "Remoção da trava de tamanho mínimo — só depois de estágio 3 provado"),
 *   fora de escopo deste módulo.
 * - **Circuito de segurança já existente é pré-requisito, não redundância**:
 *   este módulo NÃO reimplementa hard-stop — o Health Check Guardian
 *   (`useApexLogic.ts`) já fecha posição LIVE via `forceCloseAllLivePositions`
 *   quando o safe mode dispara (fix 2026-07-31). Este módulo só garante que
 *   NENHUMA ordem nova sai enquanto safe mode está ativo.
 * - **Disclaimer obrigatório e permanente** em todo evento (decisão travada
 *   nas seções 9.1, mesma regra do Estágio 1/2) — o motor não tem edge
 *   estatístico comprovado (seções 11-11.15, 14).
 * - **Módulo isolado**: só lê a decisão via callback do useApexLogic
 *   (`onLiveDecision`), mesmo padrão do Estágio 2 — não reaproveita nem
 *   duplica lógica de sinal.
 * - **Opt-in, desligado por padrão**: exige `enabled === true` explícito,
 *   além de `executionMode === 'LIVE'`. Ligar isto é uma decisão consciente
 *   do usuário, nunca comportamento implícito de ativar modo LIVE.
 */
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TradeVisual } from '../../hooks/useApexLogic';
import { getAssetBySymbol } from '../../config/assetDatabase';
import { createMarketBuyOrder, createMarketSellOrder, type TradeResult } from '../../services/BrokerClient';
import { LIVE_ALERT_DISCLAIMER } from '../liveAlertStage/useLiveAlertStage';

export const AUTO_EXECUTION_MAX_HISTORY = 50;

export type AutoExecutionStatus = 'executed' | 'failed' | 'riskBlocked' | 'skipped';

export interface AutoExecutedTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  tp: number;
  sl: number;
  volume: number;
  ai_confidence: number;
  reasoning: string;
  timestamp: number;
  status: AutoExecutionStatus;
  detail: string;
  result?: TradeResult;
  disclaimer: string;
}

interface UseAutoExecutionStageParams {
  executionMode: 'DEMO' | 'LIVE';
  /** Estágio 3 é opt-in — não liga sozinho junto com LIVE nem com o Estágio 2. */
  enabled: boolean;
  isSafeMode: boolean;
  maxHistory?: number;
}

/**
 * Lote mínimo travado do ativo — nunca o tamanho calculado pelo motor.
 * Exportado separado da lógica do hook para poder ser testado sem React.
 */
export function minLockedLotSize(symbol: string): { volume: number; error?: string } {
  const asset = getAssetBySymbol(symbol);
  if (!asset) {
    return { volume: 0, error: `Ativo desconhecido: ${symbol}` };
  }
  if (!(asset.minLot > 0)) {
    return { volume: 0, error: `Lote mínimo inválido para ${symbol}` };
  }
  return { volume: asset.minLot };
}

export function useAutoExecutionStage({ executionMode, enabled, isSafeMode, maxHistory = AUTO_EXECUTION_MAX_HISTORY }: UseAutoExecutionStageParams) {
  const [history, setHistory] = useState<AutoExecutedTrade[]>([]);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const executionModeRef = useRef(executionMode);
  executionModeRef.current = executionMode;
  const isSafeModeRef = useRef(isSafeMode);
  isSafeModeRef.current = isSafeMode;

  const pushHistory = useCallback(
    (entry: AutoExecutedTrade) => {
      setHistory(prev => [entry, ...prev].slice(0, maxHistory));
    },
    [maxHistory]
  );

  const onLiveDecision = useCallback(
    async (decision: TradeVisual) => {
      if (executionModeRef.current !== 'LIVE' || !enabledRef.current) return;

      const base = {
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

      if (isSafeModeRef.current) {
        toast.error('🚫 Safe Mode ativo — execução automática bloqueada', { duration: 6000 });
        pushHistory({ ...base, volume: 0, status: 'skipped', detail: 'Safe Mode ativo' });
        return;
      }

      const lot = minLockedLotSize(decision.symbol);
      if (lot.error) {
        toast.error(`⚠️ Execução automática bloqueada: ${lot.error}`, { duration: 8000 });
        pushHistory({ ...base, volume: 0, status: 'skipped', detail: lot.error });
        return;
      }

      const orderParams = {
        symbol: decision.symbol,
        volume: lot.volume,
        stopLoss: decision.sl,
        takeProfit: decision.tp,
        comment: 'NeuralDayTrader-Stage3-AutoExec',
      };

      toast(`🤖 Execução automática: ${decision.side === 'LONG' ? '🟢' : '🔴'} ${decision.symbol}`, {
        description: `@ ${decision.price} | ${lot.volume} lotes (mínimo travado) | Confiança: ${decision.ai_confidence}%\n${LIVE_ALERT_DISCLAIMER}`,
        duration: 6000,
      });

      const result =
        decision.side === 'LONG' ? await createMarketBuyOrder(orderParams) : await createMarketSellOrder(orderParams);

      if (result.success) {
        toast.success(`✅ Trade automático executado: ${decision.symbol}`, { description: result.message, duration: 5000 });
        pushHistory({ ...base, volume: lot.volume, status: 'executed', detail: result.message || '', result });
      } else if (result.riskBlocked) {
        toast.error(`🚫 Bloqueado por risco: ${result.error}`, { duration: 8000 });
        pushHistory({ ...base, volume: lot.volume, status: 'riskBlocked', detail: result.error || '', result });
      } else {
        toast.error(`❌ Falha na execução automática: ${result.error}`, { duration: 8000 });
        pushHistory({ ...base, volume: lot.volume, status: 'failed', detail: result.error || '', result });
      }
    },
    [pushHistory]
  );

  return { history, onLiveDecision };
}
