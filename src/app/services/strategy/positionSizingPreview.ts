// Prévia client-side de tamanho de posição — 2026-08-17 (item 2 do plano de
// "por que deixar o usuário se configurar num buraco", ver conversa da
// sessão que achou o bug real: capital $100, risco 1,5%, modo ATR com
// multiplicador 4,0x — nocional calculado $0,56, sempre abaixo do mínimo de
// $10, pra QUALQUER ativo, silenciosamente, por 10 dias).
//
// POR QUE ISSO É SEGURO DE CALCULAR SEM DADO DE MERCADO: no modo "Ajustado
// por ATR", a razão final não depende do ATR nem do preço do ativo — eles se
// cancelam. `slDistance` (calculado em `resolveAtrTargets`) é sempre
// `STOP_ATR_MULTIPLIER × ATR` (fora do caso raro de SCALP com teto de
// pontos), e `atrDistance` é `atrMultiplier × ATR`; a razão entre os dois é
// `STOP_ATR_MULTIPLIER / atrMultiplier`, puro número, o mesmo pra BTCUSD ou
// EURUSD. É por isso que dá pra avisar o usuário ANTES de ligar a IA, sem
// esperar candle nenhum.
//
// O modo "% Fixo" já não tem essa simplificação (o tamanho final depende do
// ATR real do ativo escolhido) — a prévia dele fica qualitativa, não exata.

import {
  RISK_PROFILE_ADJUSTMENTS,
  DEFAULT_RISK_ADJUSTMENT,
  STOP_ATR_MULTIPLIER,
  MIN_EXECUTABLE_NOTIONAL_USD,
} from './runTradingCycle';

export interface PositionSizingPreviewInput {
  allocatedCapital: number;
  riskPerTrade: number; // em %, ex: 1.5
  riskProfile: string;
  positionSizingMode: 'FIXED' | 'ATR';
  atrMultiplier: number;
}

export interface PositionSizingPreviewResult {
  /** Risco em dólares antes de qualquer ajuste de modo — allocatedCapital × risco% × multiplicador do perfil. */
  fixedRiskCapitalUsd: number;
  /**
   * Só preenchido em modo ATR — é EXATO (não depende do ativo/mercado), ao
   * contrário do modo % Fixo. `null` em modo FIXED.
   */
  atrModeEstimateUsd: number | null;
  /** true quando o número que o motor realmente usaria fica abaixo do mínimo executável. */
  belowMinimum: boolean;
  /** Mensagem pronta pra exibir, já explicando o número e o porquê. */
  message: string;
  /** 'error' quando belowMinimum é garantido (modo ATR); 'warning' quando é só risco possível (modo FIXED, capital muito baixo). */
  severity: 'ok' | 'warning' | 'error';
}

export function previewPositionSizing(input: PositionSizingPreviewInput): PositionSizingPreviewResult {
  const adjustment = RISK_PROFILE_ADJUSTMENTS[input.riskProfile] ?? DEFAULT_RISK_ADJUSTMENT;
  const fixedRiskCapitalUsd = input.allocatedCapital * (input.riskPerTrade / 100) * adjustment.sizeMultiplier;

  if (input.positionSizingMode === 'ATR') {
    const ratio = input.atrMultiplier > 0 ? STOP_ATR_MULTIPLIER / input.atrMultiplier : 0;
    const atrModeEstimateUsd = fixedRiskCapitalUsd * ratio;
    const belowMinimum = atrModeEstimateUsd < MIN_EXECUTABLE_NOTIONAL_USD;

    return {
      fixedRiskCapitalUsd,
      atrModeEstimateUsd,
      belowMinimum,
      severity: belowMinimum ? 'error' : 'ok',
      message: belowMinimum
        ? `Com esse Multiplicador ATR, o tamanho da posição fica em ~$${atrModeEstimateUsd.toFixed(2)} ` +
          `— abaixo do mínimo executável ($${MIN_EXECUTABLE_NOTIONAL_USD}). A IA vai pular TODO trade, sempre, ` +
          `independente do sinal. Reduza o multiplicador para perto de ${STOP_ATR_MULTIPLIER}x, aumente o capital ` +
          `ou aumente o risco por trade.`
        : `Tamanho de posição estimado: ~$${atrModeEstimateUsd.toFixed(2)} por trade.`,
    };
  }

  // Modo FIXED: sem ATR/preço real não dá pra saber o nocional final exato —
  // só sinalizamos quando o risco em $ já é tão baixo que praticamente
  // qualquer ativo (mesmo um de baixa volatilidade, onde o denominador do
  // sizing é pequeno) esbarraria no piso.
  const LOW_RISK_WARNING_THRESHOLD_USD = 2;
  const belowMinimum = fixedRiskCapitalUsd < LOW_RISK_WARNING_THRESHOLD_USD;

  return {
    fixedRiskCapitalUsd,
    atrModeEstimateUsd: null,
    belowMinimum,
    severity: belowMinimum ? 'warning' : 'ok',
    message: belowMinimum
      ? `Risco em dinheiro por trade: ~$${fixedRiskCapitalUsd.toFixed(2)}. O tamanho final depende da ` +
        `volatilidade do ativo, mas com esse valor há risco real de ficar abaixo do mínimo executável ` +
        `($${MIN_EXECUTABLE_NOTIONAL_USD}) em ativos de baixa volatilidade. Considere aumentar o capital ou o risco por trade.`
      : `Risco em dinheiro por trade: ~$${fixedRiskCapitalUsd.toFixed(2)} (o tamanho final varia com a volatilidade do ativo).`,
  };
}
