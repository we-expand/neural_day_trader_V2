// Fase 4 -- LLMValidator (custo computacional alto, Ollama). Só chamada
// para os trades que sobreviveram às Fases 1-3. Usa o Ollama como "Juiz
// Final" (llmJudge.ts) -- validação semântica, leitura de candle e
// confiança, sabendo que spread/cooldown/MACD/momentum já foram
// resolvidos antes de chegar aqui (não é mais papel da LLM checar isso).

import { PipelineStage, TradeContext, ValidationRejectException } from "./types";
import { judgeTradeWithLlm, LlmJudgeVerdict } from "./llmJudge";
import { isWeekendMode } from "../assetBasket";
import { config } from "../config";

const PHASE = "Phase4-LLMValidator";

const MIN_CONFIDENCE_WEEKDAY = 70;

export interface LlmValidatorDeps {
  getVixConfidenceBonus: () => Promise<number>;
  getVixRegimeLabel: () => Promise<string | null>;
  getTrendConsensusLabel: (context: TradeContext) => string;
}

export function createLlmValidatorStage(deps: LlmValidatorDeps): PipelineStage {
  return {
    name: PHASE,

    async execute(context: TradeContext): Promise<TradeContext> {
      if (!context.llmReasoning) {
        throw new ValidationRejectException(PHASE, "empty_reasoning", "Reasoning vazio -- não é possível validar contradição.");
      }

      const vixBonus = await deps.getVixConfidenceBonus();
      const minConfidenceRequired =
        (isWeekendMode() ? config.mt5MinConfidenceForOpenPositionWeekend : MIN_CONFIDENCE_WEEKDAY) + vixBonus;

      const verdict: LlmJudgeVerdict = await judgeTradeWithLlm({
        symbol: context.symbol,
        direction: context.direction,
        setupType: context.setupType,
        technicalScore: context.technicalScore,
        marketContext: {
          vixRegime: await deps.getVixRegimeLabel(),
          currentAtr: context.riskProfile.atr,
          trendConsensus: deps.getTrendConsensusLabel(context),
        },
        proposedReasoning: context.llmReasoning,
      });

      context.llmConfidence = verdict.confidence;

      if (!verdict.approved) {
        throw new ValidationRejectException(PHASE, "llm_judge_rejected", verdict.rejectionReason ?? "Rejeitado pelo Juiz Final (Ollama).");
      }

      if (verdict.confidence < minConfidenceRequired) {
        throw new ValidationRejectException(
          PHASE,
          "min_confidence",
          `Confiança do Juiz Final (${verdict.confidence}) abaixo do mínimo exigido (${minConfidenceRequired}%).`,
        );
      }

      return context;
    },
  };
}
