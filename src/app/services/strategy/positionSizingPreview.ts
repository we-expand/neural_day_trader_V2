// Prévia client-side de tamanho de posição — criada em 2026-08-17, reescrita
// no mesmo dia depois de achar que a premissa original estava errada.
//
// Motivação original: capital $100, risco 1,5%, modo ATR com multiplicador
// 4,0x — nocional calculado $0,56, sempre abaixo do mínimo de $10, pra
// QUALQUER ativo, silenciosamente, por 10 dias. A primeira versão desta
// prévia modelava a fórmula do motor ao vivo daquele momento — que reescalava
// o risco em dólar por uma razão adimensional (`STOP_ATR_MULTIPLIER /
// atrMultiplier`) sem nunca dividir pelo preço do ativo. Essa "independência
// do preço" foi documentada aqui como propriedade útil ("dá pra prever sem
// candle"), mas na verdade era o próprio bug: um tamanho de posição que não
// depende do preço do ativo não é um nocional válido. Corrigido no motor
// (`runTradingCycle.ts`, mesma data) pra fixed-fractional de verdade (Van
// Tharp: risco em $ / distância do stop em % do preço) — igual ao modo FIXED
// já fazia. Consequência: os DOIS modos agora dependem do ATR/preço real do
// ativo, então nenhum dos dois pode mais dar um número exato sem dado de
// mercado — a prévia vira qualitativa nos dois, unificada abaixo.

import {
  RISK_PROFILE_ADJUSTMENTS,
  DEFAULT_RISK_ADJUSTMENT,
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
  /** true quando o risco em $ já é baixo o bastante pra que ativos de baixa volatilidade provavelmente esbarrem no piso. Estimativa, não exata — nenhum modo dá número exato sem preço/ATR real do ativo. */
  belowMinimum: boolean;
  /** Mensagem pronta pra exibir, já explicando o número e o porquê. */
  message: string;
  severity: 'ok' | 'warning';
}

export function previewPositionSizing(input: PositionSizingPreviewInput): PositionSizingPreviewResult {
  const adjustment = RISK_PROFILE_ADJUSTMENTS[input.riskProfile] ?? DEFAULT_RISK_ADJUSTMENT;
  const fixedRiskCapitalUsd = input.allocatedCapital * (input.riskPerTrade / 100) * adjustment.sizeMultiplier;

  // Sem preço/ATR real do ativo, só dá pra sinalizar risco (não certeza): um
  // risco em $ muito baixo aumenta a chance de esbarrar no piso de $10 em
  // ativos de baixa volatilidade (denominador — distância do stop em % —
  // pequeno), nos dois modos.
  const LOW_RISK_WARNING_THRESHOLD_USD = 2;
  const belowMinimum = fixedRiskCapitalUsd < LOW_RISK_WARNING_THRESHOLD_USD;
  const modeNote = input.positionSizingMode === 'ATR'
    ? ` (modo "Ajustado por ATR", multiplicador ${input.atrMultiplier}x)`
    : '';

  return {
    fixedRiskCapitalUsd,
    belowMinimum,
    severity: belowMinimum ? 'warning' : 'ok',
    message: belowMinimum
      ? `Risco em dinheiro por trade: ~$${fixedRiskCapitalUsd.toFixed(2)}${modeNote}. O tamanho final depende da ` +
        `volatilidade real do ativo no momento, mas com esse valor há risco real de ficar abaixo do mínimo ` +
        `executável ($${MIN_EXECUTABLE_NOTIONAL_USD}) em ativos de baixa volatilidade. Considere aumentar o ` +
        `capital ou o risco por trade.`
      : `Risco em dinheiro por trade: ~$${fixedRiskCapitalUsd.toFixed(2)}${modeNote} (o tamanho final varia com ` +
        `a volatilidade real do ativo).`,
  };
}
