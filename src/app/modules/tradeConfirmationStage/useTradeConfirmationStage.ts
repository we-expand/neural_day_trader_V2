/**
 * Estágio 2 da ponte decisão→execução real (Fase 6).
 * Ver research/AI_BRAIN_SPEC.md seção 9.1 — desenho completo e decisões travadas.
 *
 * Contrato deste módulo (não violar sem nova discussão explícita com Cleber):
 * - LIVE + confirmação manual por trade. Só chama /broker/execute (via
 *   BrokerClient) DEPOIS de aprovação explícita do usuário — nunca automático.
 * - Módulo isolado: só lê a decisão via callback do useApexLogic
 *   (`onLiveDecision`) — não reaproveita nem duplica a lógica de sinal.
 * - Disclaimer permanente obrigatório em todo item pendente.
 * - Só ativa quando executionMode === 'LIVE' e o gate estiver enabled.
 * - Bloqueia entrada de novos itens quando isSafeMode; cancela pendências
 *   existentes se safe mode disparar ou se executionMode sair de LIVE.
 * - Item não aprovado/rejeitado em TRADE_CONFIRMATION_TIMEOUT_MS expira
 *   automaticamente — expiração nunca executa, é rejeição implícita.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TradeVisual } from '../../hooks/useApexLogic';
import { createMarketBuyOrder, createMarketSellOrder, type TradeResult } from '../../services/BrokerClient';
import { amountToLotSize } from './lotSizeConversion';
import { LIVE_ALERT_DISCLAIMER } from '../liveAlertStage/useLiveAlertStage';

export const TRADE_CONFIRMATION_TIMEOUT_MS = 45_000;
export const TRADE_CONFIRMATION_MAX_HISTORY = 50;

export interface PendingTradeConfirmation {
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
  expiresAt: number;
  disclaimer: string;
}

export type TradeConfirmationStatus = 'executed' | 'failed' | 'riskBlocked' | 'rejected' | 'expired' | 'cancelled';

export interface ResolvedTradeConfirmation extends PendingTradeConfirmation {
  status: TradeConfirmationStatus;
  result?: TradeResult;
  resolvedAt: number;
}

interface UseTradeConfirmationStageParams {
  executionMode: 'DEMO' | 'LIVE';
  /** Estágio 2 é opt-in — não liga sozinho junto com LIVE. */
  enabled: boolean;
  isSafeMode: boolean;
  maxHistory?: number;
}

export function useTradeConfirmationStage({
  executionMode,
  enabled,
  isSafeMode,
  maxHistory = TRADE_CONFIRMATION_MAX_HISTORY,
}: UseTradeConfirmationStageParams) {
  const [pending, setPending] = useState<PendingTradeConfirmation[]>([]);
  const [history, setHistory] = useState<ResolvedTradeConfirmation[]>([]);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const executionModeRef = useRef(executionMode);
  executionModeRef.current = executionMode;
  const isSafeModeRef = useRef(isSafeMode);
  isSafeModeRef.current = isSafeMode;

  // setTimeout de expiração por item pendente — limpo em resolve/cancel/unmount.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const resolvePending = useCallback(
    (id: string, status: TradeConfirmationStatus, result?: TradeResult) => {
      clearTimer(id);
      setPending(prev => {
        const item = prev.find(p => p.id === id);
        if (!item) return prev;
        setHistory(h => [{ ...item, status, result, resolvedAt: Date.now() }, ...h].slice(0, maxHistory));
        return prev.filter(p => p.id !== id);
      });
    },
    [clearTimer, maxHistory]
  );

  const onLiveDecision = useCallback(
    (decision: TradeVisual) => {
      if (executionModeRef.current !== 'LIVE' || !enabledRef.current) return;

      if (isSafeModeRef.current) {
        toast.error('🚫 Safe Mode ativo — confirmação de trade bloqueada', { duration: 6000 });
        return;
      }

      const conversion = amountToLotSize(decision.symbol, decision.amount, decision.price);
      if (conversion.error) {
        toast.error(`⚠️ Confirmação bloqueada: ${conversion.error}`, { duration: 8000 });
        return;
      }

      const item: PendingTradeConfirmation = {
        id: decision.id,
        symbol: decision.symbol,
        side: decision.side,
        price: decision.price,
        tp: decision.tp,
        sl: decision.sl,
        amount: decision.amount,
        volume: conversion.volume,
        volumeCapped: conversion.capped,
        ai_confidence: decision.ai_confidence,
        reasoning: decision.reasoning,
        timestamp: decision.timestamp,
        expiresAt: Date.now() + TRADE_CONFIRMATION_TIMEOUT_MS,
        disclaimer: LIVE_ALERT_DISCLAIMER,
      };

      setPending(prev => [item, ...prev].slice(0, 20));

      const timer = setTimeout(() => resolvePending(item.id, 'expired'), TRADE_CONFIRMATION_TIMEOUT_MS);
      timersRef.current.set(item.id, timer);

      toast(`⏳ Aguardando aprovação: ${item.side === 'LONG' ? '🟢' : '🔴'} ${item.symbol}`, {
        description: `@ ${item.price} | ${item.volume} lotes | Confiança: ${item.ai_confidence}%\n${LIVE_ALERT_DISCLAIMER}`,
        duration: 6000,
      });
    },
    [resolvePending]
  );

  const approve = useCallback(
    async (id: string) => {
      const item = pending.find(p => p.id === id);
      if (!item) return;

      const orderParams = {
        symbol: item.symbol,
        volume: item.volume,
        stopLoss: item.sl,
        takeProfit: item.tp,
        comment: 'NeuralDayTrader-Stage2',
      };

      const result =
        item.side === 'LONG' ? await createMarketBuyOrder(orderParams) : await createMarketSellOrder(orderParams);

      if (result.success) {
        toast.success(`✅ Trade executado: ${item.symbol}`, { description: result.message, duration: 5000 });
        resolvePending(id, 'executed', result);
      } else if (result.riskBlocked) {
        toast.error(`🚫 Bloqueado por risco: ${result.error}`, { duration: 8000 });
        resolvePending(id, 'riskBlocked', result);
      } else {
        toast.error(`❌ Falha ao executar: ${result.error}`, { duration: 8000 });
        resolvePending(id, 'failed', result);
      }
    },
    [pending, resolvePending]
  );

  const reject = useCallback(
    (id: string) => {
      resolvePending(id, 'rejected');
    },
    [resolvePending]
  );

  // Cancela toda pendência quando sai de LIVE ou quando safe mode dispara —
  // não espera o timeout natural (ponto D do plano do Estágio 2).
  useEffect(() => {
    if (executionMode === 'LIVE' && !isSafeMode) return;
    setPending(prev => {
      if (prev.length === 0) return prev;
      setHistory(h => [...prev.map(item => ({ ...item, status: 'cancelled' as const, resolvedAt: Date.now() })), ...h].slice(0, maxHistory));
      prev.forEach(item => clearTimer(item.id));
      return [];
    });
  }, [executionMode, isSafeMode, clearTimer, maxHistory]);

  // Cleanup geral no unmount.
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return { pending, history, onLiveDecision, approve, reject };
}
