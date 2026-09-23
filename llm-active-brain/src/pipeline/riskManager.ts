// RiskManager -- matemática exata de Position Sizing via ATR e Trailing
// Stop dinâmico (Chandelier Exit adaptado), conforme o plano colado pelo
// Cleber em 2026-09-23. ATR em si é calculado por calculateAtr em atr.ts
// (Wilder RMA, 14 períodos) -- este módulo só consome o valor real via
// getAtrAbsolute, nunca recalcula ATR do zero.
//
// Substitui (quando ligado) o sizing por % de risco fixo hoje em
// tools.ts:baseRiskPct/maxRiskUsd -- ver README.md deste diretório pro
// status de integração.

export interface RiskParameters {
  accountBalance: number;
  riskPercentage: number; // ex: 0.01 = 1%
  atrMultiplierSL: number; // recomendado 1.5 a 2.0
  trailingMultiplier: number; // recomendado 2.0 a 3.0 (Chandelier clássico)
}

export interface AssetProperties {
  pointValue: number; // valor financeiro de 1 ponto/pip/tick do ativo
  minLotSize: number;
  lotStep: number;
}

export interface PositionSizeResult {
  positionSize: number;
  initialStopLoss: number;
  slDistance: number;
  riskInDollars: number;
}

export class RiskManager {
  /**
   * Passo 1: Risk$ = Capital x Risk%
   * Passo 2: SLdistance = ATR14 x ATRMultiplier
   * Passo 3: PositionSize = Risk$ / (SLdistance x PointValue), arredondado
   * pra baixo respeitando o lotStep e nunca abaixo do minLotSize.
   */
  static calculatePosition(
    entryPrice: number,
    currentAtr: number,
    setupType: "LONG" | "SHORT",
    riskParams: RiskParameters,
    assetProps: AssetProperties,
  ): PositionSizeResult {
    if (!Number.isFinite(currentAtr) || currentAtr <= 0) {
      throw new Error("RiskManager.calculatePosition: ATR inválido (<= 0 ou não finito).");
    }

    const riskInDollars = riskParams.accountBalance * riskParams.riskPercentage;
    const slDistance = currentAtr * riskParams.atrMultiplierSL;

    const initialStopLoss = setupType === "LONG" ? entryPrice - slDistance : entryPrice + slDistance;

    const rawSize = riskInDollars / (slDistance * assetProps.pointValue);
    const positionSize = Math.max(assetProps.minLotSize, Math.floor(rawSize / assetProps.lotStep) * assetProps.lotStep);

    return { positionSize, initialStopLoss, slDistance, riskInDollars };
  }

  /**
   * Chandelier Exit adaptado. O stop só pode andar a favor do trade --
   * LONG: NewStop = max(PreviousStop, HighestHigh_desde_entrada - ATR*mult)
   * SHORT: NewStop = min(PreviousStop, LowestLow_desde_entrada + ATR*mult)
   * Chamado a cada novo candle fechado (não a cada tick) para evitar
   * ruído intracandle.
   */
  static updateTrailingStop(
    currentStop: number,
    extremePriceSinceEntry: number, // HighestHigh para LONG, LowestLow para SHORT
    currentAtr: number,
    setupType: "LONG" | "SHORT",
    trailingMultiplier: number,
  ): number {
    const offset = currentAtr * trailingMultiplier;

    if (setupType === "LONG") {
      const newStop = extremePriceSinceEntry - offset;
      return Math.max(currentStop, newStop);
    }
    const newStop = extremePriceSinceEntry + offset;
    return Math.min(currentStop, newStop);
  }
}
