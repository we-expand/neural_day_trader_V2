// Fase 1 -- StateValidators (Hard Block, custo O(1)).
// Regras portadas de tools.ts/open_position (motor congelado em
// freeze-llm-brain-2026-09-22): calendário, tick obsoleto, spread, notícia
// de alto impacto. Aborta o ciclo no primeiro bloqueio (fail-fast).

import { PipelineStage, TradeContext, ValidationRejectException } from "./types";
import { isSymbolTradable } from "../assetBasket";
import { getActiveHighImpactNewsWindow } from "../atr";
import { config } from "../config";

const PHASE = "Phase1-StateValidator";

// Mesmo teto usado hoje em open_position (ver tools.ts, checagem de spread
// "SPREAD_CAP" citada no planejamento) -- 5% é o valor fixo do plano, o
// código atual usa checagens específicas por rota; manter aqui como
// constante única e explícita.
const MAX_SPREAD_PERCENT = 0.05;
const MAX_TICK_AGE_SECONDS = 120;

export const stateValidatorStage: PipelineStage = {
  name: PHASE,

  async execute(context: TradeContext): Promise<TradeContext> {
    if (!isSymbolTradable(context.symbol)) {
      throw new ValidationRejectException(PHASE, "calendar_closed", `Mercado fechado para ${context.symbol}.`);
    }

    if (context.tickData.ageSeconds > MAX_TICK_AGE_SECONDS) {
      throw new ValidationRejectException(
        PHASE,
        "stale_tick",
        `Tick obsoleto (${context.tickData.ageSeconds}s > ${MAX_TICK_AGE_SECONDS}s) para ${context.symbol}.`,
      );
    }

    if (context.tickData.spreadPercent > MAX_SPREAD_PERCENT) {
      throw new ValidationRejectException(
        PHASE,
        "spread_cap",
        `Spread anormal (${(context.tickData.spreadPercent * 100).toFixed(2)}% > ${(MAX_SPREAD_PERCENT * 100).toFixed(0)}%) para ${context.symbol}.`,
      );
    }

    if (config.highImpactNewsGateActive) {
      const activeWindow = await getActiveHighImpactNewsWindow(
        config.highImpactNewsGateMinutesBefore,
        config.highImpactNewsGateMinutesAfter,
      );
      if (activeWindow) {
        throw new ValidationRejectException(
          PHASE,
          "news_blackout",
          `Janela de evento de alto impacto ativa: "${activeWindow.event.event}" às ${activeWindow.event.time}.`,
        );
      }
    }

    return context;
  },
};
