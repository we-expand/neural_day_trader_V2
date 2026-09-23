// Fase 3 -- TechnicalScoringEngine (Soft Block). Substitui os hard-blocks
// booleanos de MACD/momentum/estocástico do motor congelado por um score
// contínuo 0-100. Só avança para a Fase 4 (LLM) se technicalScore >= corte.
// Indicadores usados são os mesmos já reais/produção em atr.ts e
// hmmRegime.ts -- nenhum dado fabricado aqui, só a forma de combiná-los é
// nova (soma de pesos em vez de AND de booleanos).

import { PipelineStage, TradeContext } from "./types";
import {
  getTrendInfo,
  getLongTermTrendInfo,
  getMacd,
  getSlowStochastic,
  getVolumeConfirmation,
  getCandlePatterns,
  getHmmMarketRegime,
} from "../atr";

const PHASE = "Phase3-TechnicalScoring";

// Pesos sugeridos no planejamento (ajustáveis, mas somam 100 no cenário
// ideal de confluência total).
const WEIGHTS = {
  consensusDirection: 30, // 5m + 15m/1H (getLongTermTrendInfo) + HMM alinhados
  macd: 20,
  momentum: 15, // volume/momentum das últimas velas (getVolumeConfirmation)
  stochastic: 15,
  breakoutConfirmed: 20, // candle de rompimento fechado (getCandlePatterns)
};

export const DEFAULT_SCORE_CUTOFF = 70;

export function createTechnicalScoringStage(scoreCutoff: number = DEFAULT_SCORE_CUTOFF): PipelineStage {
  return {
    name: PHASE,

    async execute(context: TradeContext): Promise<TradeContext> {
      const wantsUp = context.direction === "LONG";
      const breakdown: Record<string, number> = {};

      const [shortTrend, longTrend, hmm, macd, stochastic, volume, patterns] = await Promise.all([
        getTrendInfo(context.symbol),
        getLongTermTrendInfo(context.symbol),
        getHmmMarketRegime(context.symbol),
        getMacd(context.symbol),
        getSlowStochastic(context.symbol),
        getVolumeConfirmation(context.symbol),
        getCandlePatterns(context.symbol),
      ]);

      // Consenso de direção: 5m + longo prazo + HMM apontando pro mesmo lado.
      const shortAligned = shortTrend && (wantsUp ? shortTrend.label === "ALTA" : shortTrend.label === "BAIXA");
      const longAligned = longTrend && (wantsUp ? longTrend.label === "ALTA" : longTrend.label === "BAIXA");
      const hmmAligned =
        hmm && hmm.regime === "TENDENCIA_CLARA" && hmm.direction === (wantsUp ? "ALTA" : "BAIXA");
      if (shortAligned && longAligned && hmmAligned) {
        breakdown.consensusDirection = WEIGHTS.consensusDirection;
      } else if (shortAligned && longAligned) {
        // Consenso parcial (sem HMM confirmando) vale metade do peso.
        breakdown.consensusDirection = WEIGHTS.consensusDirection / 2;
      }

      if (macd && (wantsUp ? macd.label === "ALTA" : macd.label === "BAIXA")) {
        breakdown.macd = WEIGHTS.macd;
      }

      if (volume?.elevated) {
        breakdown.momentum = WEIGHTS.momentum;
      }

      if (stochastic) {
        const favoravel = wantsUp ? stochastic.label !== "SOBRECOMPRADO" : stochastic.label !== "SOBREVENDIDO";
        const crossingFavoravel = wantsUp
          ? stochastic.crossing === "CRUZOU_PARA_CIMA"
          : stochastic.crossing === "CRUZOU_PARA_BAIXO";
        if (crossingFavoravel) {
          breakdown.stochastic = WEIGHTS.stochastic;
        } else if (favoravel) {
          breakdown.stochastic = WEIGHTS.stochastic / 2;
        }
      }

      if (patterns?.bias && patterns.bias === (wantsUp ? "ALTA" : "BAIXA")) {
        breakdown.breakoutConfirmed = WEIGHTS.breakoutConfirmed;
      }

      const technicalScore = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

      context.scoreBreakdown = breakdown;
      context.technicalScore = technicalScore;

      if (technicalScore < scoreCutoff) {
        context.rejected = true;
        context.rejectionPhase = PHASE;
        context.rejectionReason = `technicalScore ${technicalScore} abaixo do corte ${scoreCutoff} (breakdown: ${JSON.stringify(breakdown)}).`;
      }

      return context;
    },
  };
}
