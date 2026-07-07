import { RiskProfileType } from '../../types/strategy';

/**
 * Extraído de useApexLogic.ts (mesmos valores/regras usados ao vivo) para ser
 * reutilizado tanto pela IA ao vivo quanto pelo motor de Backtest — garante que
 * os dois calculam TP/SL/tamanho de posição exatamente da mesma forma.
 */
export const RISK_PROFILE_ADJUSTMENTS: Record<string, { confidenceAdjust: number; sizeMultiplier: number }> = {
  CONSERVATIVE: { confidenceAdjust: 15, sizeMultiplier: 0.7 },
  MODERATE: { confidenceAdjust: 0, sizeMultiplier: 1.0 },
  EQUILIBRADO: { confidenceAdjust: 0, sizeMultiplier: 1.0 },
  AGGRESSIVE: { confidenceAdjust: -10, sizeMultiplier: 1.3 },
  DEGEN: { confidenceAdjust: -10, sizeMultiplier: 1.3 },
  INSTITUTIONAL: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
  INSTITUTIONAL_SMC: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
};
export const DEFAULT_RISK_ADJUSTMENT = { confidenceAdjust: 0, sizeMultiplier: 1.0 };

export function getRiskAdjustment(riskProfile: RiskProfileType | string): { confidenceAdjust: number; sizeMultiplier: number } {
  return RISK_PROFILE_ADJUSTMENTS[riskProfile] || DEFAULT_RISK_ADJUSTMENT;
}

export type TargetPointsPreset = 'MÉDIO' | 'CURTO' | 'LONGO' | 'POUCOS' | 'MUITOS';

const TARGET_POINTS_TABLE: Record<TargetPointsPreset, { target: number; stop: number }> = {
  POUCOS: { target: 150, stop: 50 },
  MÉDIO: { target: 400, stop: 120 },
  MUITOS: { target: 1500, stop: 300 },
  CURTO: { target: 80, stop: 35 },
  LONGO: { target: 800, stop: 200 },
};

export interface TpSlResult {
  targetPointsValue: number;
  stopLossPointsValue: number;
  pointValue: number;
  tp: number;
  sl: number;
  tpDistance: number;
  slDistance: number;
  riskRewardRatio: number;
}

/** Mesma tabela de pip/ponto por classe de ativo usada em useApexLogic.ts. */
export function getPointValue(symbol: string): number {
  let pointValue = 1.0;
  if (
    symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('USD') ||
    symbol.includes('JPY') || symbol.includes('AUD') || symbol.includes('CAD') ||
    symbol.includes('CHF') || symbol.includes('NZD')
  ) {
    pointValue = 0.0001;
  }
  if (symbol.includes('XAU') || symbol.includes('GOLD')) {
    pointValue = 0.1;
  }
  return pointValue;
}

export function calculateTpSl(
  symbol: string,
  side: 'LONG' | 'SHORT',
  currentPrice: number,
  targetPoints: TargetPointsPreset,
  marketMode: 'TREND' | 'RANGE' | 'SCALP' | 'COUNTER'
): TpSlResult {
  const preset = TARGET_POINTS_TABLE[targetPoints] || TARGET_POINTS_TABLE['MÉDIO'];
  let targetPointsValue = preset.target;
  let stopLossPointsValue = preset.stop;

  if (marketMode === 'SCALP') {
    targetPointsValue = Math.min(targetPointsValue, 80);
    stopLossPointsValue = Math.min(stopLossPointsValue, 35);
  }

  const pointValue = getPointValue(symbol);
  const tpDistance = targetPointsValue * pointValue;
  const slDistance = stopLossPointsValue * pointValue;

  const tp = side === 'LONG' ? currentPrice + tpDistance : currentPrice - tpDistance;
  const sl = side === 'LONG' ? currentPrice - slDistance : currentPrice + slDistance;

  return {
    targetPointsValue,
    stopLossPointsValue,
    pointValue,
    tp,
    sl,
    tpDistance,
    slDistance,
    riskRewardRatio: targetPointsValue / stopLossPointsValue,
  };
}

export interface PositionSizeInput {
  currentBalance: number;
  allocatedCapital: number;
  riskPerTradePercent: number;
  riskProfile: RiskProfileType | string;
}

/** Mesmo cálculo de tradeCapital/finalTradeCapital de useApexLogic.ts. */
export function calculatePositionSize({
  currentBalance,
  allocatedCapital,
  riskPerTradePercent,
  riskProfile,
}: PositionSizeInput): number {
  const capital = Math.min(allocatedCapital, currentBalance);
  const riskPercentage = riskPerTradePercent / 100;
  const { sizeMultiplier } = getRiskAdjustment(riskProfile);
  const tradeCapital = capital * riskPercentage * sizeMultiplier;
  const minTradeCapital = 10;
  return Math.max(tradeCapital, minTradeCapital);
}

/** Trailing stop dinâmico: mesma regra de useApexLogic.ts (só melhora o SL a favor do trade). */
export function trailStopLoss(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  originalSl: number,
  currentSl: number,
  nextPrice: number
): number {
  const originalSlDistance = Math.abs(entryPrice - originalSl);
  const trailedSl = side === 'LONG' ? nextPrice - originalSlDistance : nextPrice + originalSlDistance;
  return side === 'LONG' ? Math.max(currentSl, trailedSl) : Math.min(currentSl, trailedSl);
}
