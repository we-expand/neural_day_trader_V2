// Fase 2 -- RiskValidators (Hard Block, regras de negócio). Aborta o ciclo
// se algum teto de proteção de capital foi atingido. Regras portadas do
// motor congelado (freeze-llm-brain-2026-09-22): teto de entradas/24h,
// exposição de grupo correlacionado, teto de posições, direção travada.
//
// PENDENTE (não portado ainda, precisa de acesso ao estado de sessão que
// hoje vive em Maps privados dentro de tools.ts, não exportados): limite de
// perda diária (dailyLossLimit) e cooldown de perdas em sequência
// (mt5LossStreakThreshold/mt5LossStreakCooldownMinutes). Não bloquear em
// produção sem portar essas duas antes -- ver TODO no pipeline.ts.

import { PipelineStage, TradeContext, ValidationRejectException } from "./types";
import { getCorrelatedGroup, isWeekendMode } from "../assetBasket";
import { listMt5OpenPositions, getEntriesCountLast24h } from "../neuralBridge";
import { config } from "../config";

const PHASE = "Phase2-RiskValidator";

// Valor real hoje em tools.ts (MAX_POSITIONS_PER_SYMBOL, hardcoded, não
// exposto via config.ts) -- duplicado aqui até decidirmos extrair pra uma
// fonte única compartilhada entre o motor antigo e o pipeline novo.
const MAX_POSITIONS_PER_SYMBOL = 5;

export interface RiskValidatorDeps {
  userDirection: "AUTO" | "LONG" | "SHORT";
  basket: string[];
}

export function createRiskValidatorStage(deps: RiskValidatorDeps): PipelineStage {
  return {
    name: PHASE,

    async execute(context: TradeContext): Promise<TradeContext> {
      if (!deps.basket.includes(context.symbol)) {
        throw new ValidationRejectException(PHASE, "basket", `Símbolo fora da cesta permitida.`);
      }

      if (deps.userDirection !== "AUTO" && deps.userDirection !== context.direction) {
        throw new ValidationRejectException(
          PHASE,
          "direction_locked",
          `Direção travada em ${deps.userDirection}, tentativa de ${context.direction} bloqueada.`,
        );
      }

      const entries24h = await getEntriesCountLast24h(context.sessionId);
      const maxEntries = isWeekendMode() ? config.mt5MaxEntriesPer24hWeekend : config.mt5MaxEntriesPer24h;
      if (entries24h >= maxEntries) {
        throw new ValidationRejectException(
          PHASE,
          "entries_24h_cap",
          `Teto de entradas em 24h atingido (${entries24h}/${maxEntries}).`,
        );
      }

      const openPositions = await listMt5OpenPositions(context.sessionId);
      const samePositions = openPositions.filter((p) => p.symbol === context.symbol);
      if (samePositions.length >= MAX_POSITIONS_PER_SYMBOL) {
        throw new ValidationRejectException(
          PHASE,
          "max_positions_symbol",
          `Teto de posições por símbolo atingido em ${context.symbol} (${samePositions.length}/${MAX_POSITIONS_PER_SYMBOL}).`,
        );
      }

      const correlatedGroup = getCorrelatedGroup(context.symbol);
      if (correlatedGroup.length > 1) {
        const groupExposureUsd = openPositions
          .filter((p) => correlatedGroup.includes(p.symbol) && p.side === context.direction)
          .reduce((sum, p) => sum + p.entry_price * p.quantity, 0);
        if (groupExposureUsd >= config.mt5MaxCorrelatedNotionalUsd) {
          throw new ValidationRejectException(
            PHASE,
            "correlated_exposure",
            `Exposição do grupo correlacionado (${context.symbol}, ${context.direction}) já em $${groupExposureUsd.toFixed(2)}, teto $${config.mt5MaxCorrelatedNotionalUsd}.`,
          );
        }
      }

      return context;
    },
  };
}
