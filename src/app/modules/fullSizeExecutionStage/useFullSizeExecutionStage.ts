/**
 * Estágio 4 da ponte decisão→execução real (Fase 6) — "Remoção da trava de
 * tamanho mínimo", ver `research/AI_BRAIN_SPEC.md` seção 9.1 e o comentário
 * em `useAutoExecutionStage.ts` (Estágio 3) que declarava isto fora de
 * escopo daquele módulo.
 *
 * ⚠️ Diferença central do Estágio 3: aqui a IA abre ordens reais SOZINHA
 * (igual ao Estágio 3) mas com o TAMANHO REAL calculado pelo motor de
 * decisão (`decision.amount`, convertido pra lote via `amountToLotSize` —
 * mesma conversão do Estágio 2), nunca o lote mínimo travado. Dinheiro real
 * em tamanho real, sem aprovação humana por trade, e o motor não tem edge
 * estatístico comprovado (seções 11-11.15, 14 da spec) — este é o estágio
 * mais consequente de todos.
 *
 * - **Pré-requisito rígido**: só pode estar ativo se o Estágio 3 também
 *   estiver ativo — não faz sentido ligar tamanho real sem já ter ligado
 *   execução automática. Reforçado em dois lugares: aqui (`stage3Enabled`
 *   precisa ser `true` além de `enabled`) e em `TradingContext.tsx` (UI não
 *   deve nem oferecer o toggle se o Estágio 3 estiver desligado).
 * - **Desligado por padrão, disclaimer permanente** — mesma regra dos
 *   estágios 1-3.
 * - **Módulo isolado**: só lê a decisão via callback do useApexLogic
 *   (`onLiveDecision`), mesmo padrão dos estágios anteriores — não
 *   reaproveita nem duplica lógica de sinal.
 * - **Não reimplementa hard-stop**: mesma dependência do Estágio 3 no
 *   Health Check Guardian / `forceCloseAllLivePositions` de `useApexLogic.ts`.
 */
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TradeVisual } from '../../hooks/useApexLogic';
import { createMarketBuyOrder, createMarketSellOrder, type TradeResult } from '../../services/BrokerClient';
import { amountToLotSize } from '../tradeConfirmationStage/lotSizeConversion';
import { LIVE_ALERT_DISCLAIMER } from '../liveAlertStage/useLiveAlertStage';

export const FULL_SIZE_EXECUTION_MAX_HISTORY = 50;

export type FullSizeExecutionStatus = 'executed' | 'failed' | 'riskBlocked' | 'skipped';

export interface FullSizeExecutedTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  tp: number;
  sl: number;
  amount: number;
  volume: number;
  volumeCapped: boolean;
  ai_confidence: number;
  reasoning: string;
  timestamp: number;
  status: FullSizeExecutionStatus;
  detail: string;
  result?: TradeResult;
  disclaimer: string;
}

interface UseFullSizeExecutionStageParams {
  executionMode: 'DEMO' | 'LIVE';
  /** Estágio 4 é opt-in — não liga sozinho com LIVE nem com o Estágio 3. */
  enabled: boolean;
  /** Pré-requisito rígido: Estágio 4 nunca opera se o Estágio 3 estiver desligado, mesmo que `enabled` seja true. */
  stage3Enabled: boolean;
  isSafeMode: boolean;
  maxHistory?: number;
}

export function useFullSizeExecutionStage({
  executionMode,
  enabled,
  stage3Enabled,
  isSafeMode,
  maxHistory = FULL_SIZE_EXECUTION_MAX_HISTORY,
}: UseFullSizeExecutionStageParams) {
  const [history, setHistory] = useState<FullSizeExecutedTrade[]>([]);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const stage3EnabledRef = useRef(stage3Enabled);
  stage3EnabledRef.current = stage3Enabled;
  const executionModeRef = useRef(executionMode);
  executionModeRef.current = executionMode;
  const isSafeModeRef = useRef(isSafeMode);
  isSafeModeRef.current = isSafeMode;

  const pushHistory = useCallback(
    (entry: FullSizeExecutedTrade) => {
      setHistory(prev => [entry, ...prev].slice(0, maxHistory));
    },
    [maxHistory]
  );

  const onLiveDecision = useCallback(
    async (decision: TradeVisual) => {
      // Pré-requisito rígido: sem Estágio 3 ligado, Estágio 4 nunca executa nada,
      // mesmo que seu próprio toggle esteja true (estado inconsistente não deveria
      // acontecer via UI normal, mas o motor não pode assumir isso).
      if (executionModeRef.current !== 'LIVE' || !enabledRef.current || !stage3EnabledRef.current) return;

      const base = {
        id: decision.id,
        symbol: decision.symbol,
        side: decision.side,
        price: decision.price,
        tp: decision.tp,
        sl: decision.sl,
        amount: decision.amount,
        ai_confidence: decision.ai_confidence,
        reasoning: decision.reasoning,
        timestamp: decision.timestamp,
        disclaimer: LIVE_ALERT_DISCLAIMER,
      };

      if (isSafeModeRef.current) {
        toast.error('🚫 Safe Mode ativo — execução automática (tamanho real) bloqueada', { duration: 6000 });
        pushHistory({ ...base, volume: 0, volumeCapped: false, status: 'skipped', detail: 'Safe Mode ativo' });
        return;
      }

      const conversion = amountToLotSize(decision.symbol, decision.amount, decision.price);
      if (conversion.error) {
        toast.error(`⚠️ Execução automática (tamanho real) bloqueada: ${conversion.error}`, { duration: 8000 });
        pushHistory({ ...base, volume: 0, volumeCapped: false, status: 'skipped', detail: conversion.error });
        return;
      }

      const orderParams = {
        symbol: decision.symbol,
        volume: conversion.volume,
        stopLoss: decision.sl,
        takeProfit: decision.tp,
        comment: 'NeuralDayTrader-Stage4-FullSize',
      };

      toast(`🤖 Execução automática (tamanho real): ${decision.side === 'LONG' ? '🟢' : '🔴'} ${decision.symbol}`, {
        description: `@ ${decision.price} | ${conversion.volume} lotes${conversion.capped ? ' (capado no máximo)' : ''} | Confiança: ${decision.ai_confidence}%\n${LIVE_ALERT_DISCLAIMER}`,
        duration: 6000,
      });

      const result =
        decision.side === 'LONG' ? await createMarketBuyOrder(orderParams) : await createMarketSellOrder(orderParams);

      if (result.success) {
        toast.success(`✅ Trade automático (tamanho real) executado: ${decision.symbol}`, { description: result.message, duration: 5000 });
        pushHistory({ ...base, volume: conversion.volume, volumeCapped: conversion.capped, status: 'executed', detail: result.message || '', result });
      } else if (result.riskBlocked) {
        toast.error(`🚫 Bloqueado por risco: ${result.error}`, { duration: 8000 });
        pushHistory({ ...base, volume: conversion.volume, volumeCapped: conversion.capped, status: 'riskBlocked', detail: result.error || '', result });
      } else {
        toast.error(`❌ Falha na execução automática (tamanho real): ${result.error}`, { duration: 8000 });
        pushHistory({ ...base, volume: conversion.volume, volumeCapped: conversion.capped, status: 'failed', detail: result.error || '', result });
      }
    },
    [pushHistory]
  );

  return { history, onLiveDecision };
}
