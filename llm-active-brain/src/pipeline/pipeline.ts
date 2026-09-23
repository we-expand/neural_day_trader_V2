// Orquestrador do TradePipeline (Chain of Responsibility). Executa os 4
// estágios em sequência, fail-fast -- primeiro estágio que rejeitar aborta
// o ciclo com log granular, sem gastar custo computacional nos estágios
// seguintes (em particular, nunca chama a Fase 4/LLM se Fases 1-3 já
// rejeitaram).

import { PipelineStage, TradeContext, ValidationRejectException } from "./types";

export interface PipelineResult {
  approved: boolean;
  context: TradeContext;
  rejectedAt?: { phase: string; rule: string; message: string };
}

export function createTradePipeline(stages: PipelineStage[]) {
  return {
    async run(initialContext: TradeContext, log: (line: string) => void = console.log): Promise<PipelineResult> {
      let context = initialContext;

      for (const stage of stages) {
        try {
          context = await stage.execute(context);
        } catch (err) {
          if (err instanceof ValidationRejectException) {
            log(`[REJECTED] ${err.phase} - ${err.rule} - ${err.message}`);
            return {
              approved: false,
              context,
              rejectedAt: { phase: err.phase, rule: err.rule, message: err.message },
            };
          }
          throw err;
        }

        // Fase 3 (soft block por score) marca rejected=true em vez de
        // lançar exceção -- checa aqui pra manter o fail-fast consistente
        // com as fases de hard block.
        if (context.rejected) {
          log(`[REJECTED] ${context.rejectionPhase} - score_cutoff - ${context.rejectionReason}`);
          return {
            approved: false,
            context,
            rejectedAt: {
              phase: context.rejectionPhase ?? "unknown",
              rule: "score_cutoff",
              message: context.rejectionReason ?? "",
            },
          };
        }

        log(`[OK] ${stage.name}`);
      }

      log(`[APPROVED] ${context.symbol} ${context.direction} -- technicalScore=${context.technicalScore}, llmConfidence=${context.llmConfidence}`);
      return { approved: true, context };
    },
  };
}
