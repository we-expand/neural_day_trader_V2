// Fase 2 -- RiskValidators (Hard Block, regras de negócio). Aborta o ciclo
// se algum teto de proteção de capital foi atingido. Regras portadas do
// motor congelado (freeze-llm-brain-2026-09-22): teto de entradas/24h,
// exposição de grupo correlacionado, teto de posições, direção travada,
// limite de perda diária, cooldown de perda em sequência. As 2 últimas
// (2026-09-23) usam as mesmas funções já exportadas e backed em DB de
// neuralBridge.ts que tools.ts usa hoje -- não há estado privado em Maps
// aqui, correção do que este arquivo dizia antes.

import { PipelineStage, TradeContext, ValidationRejectException } from "./types";
import { getCorrelatedGroup, isWeekendMode } from "../assetBasket";
import {
  listMt5OpenPositions,
  getEntriesCountLast24h,
  getTodayRealizedPnl,
  getMt5AccountBalance,
  getRecentClosedTrades,
  Mt5RecentClosedTrade,
} from "../neuralBridge";
import { config } from "../config";

const PHASE = "Phase2-RiskValidator";

// Valor real hoje em tools.ts (MAX_POSITIONS_PER_SYMBOL, hardcoded, não
// exposto via config.ts) -- duplicado aqui até decidirmos extrair pra uma
// fonte única compartilhada entre o motor antigo e o pipeline novo.
const MAX_POSITIONS_PER_SYMBOL = 5;

export interface RiskValidatorDeps {
  userDirection: "AUTO" | "LONG" | "SHORT";
  basket: string[];
  dailyLossLimitPct?: number | null;
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

      // Limite de perda diária (%) do Setup -- mesma lógica de tools.ts:
      // bloqueia NOVA entrada se o prejuízo realizado do dia (00:00
      // America/Sao_Paulo) já bateu o teto configurado. Nunca fecha
      // posição existente.
      if (deps.dailyLossLimitPct != null) {
        const todayNetPnl = await getTodayRealizedPnl(context.sessionId);
        const balanceForLimit = await getMt5AccountBalance(context.sessionId);
        const lossPct = todayNetPnl < 0 ? (-todayNetPnl / balanceForLimit) * 100 : 0;
        if (lossPct >= deps.dailyLossLimitPct) {
          throw new ValidationRejectException(
            PHASE,
            "daily_loss_limit",
            `Limite de perda diária (${deps.dailyLossLimitPct.toFixed(1)}%) já atingido hoje (prejuízo real: ${lossPct.toFixed(2)}%).`,
          );
        }
      }

      // Cooldown de perda em sequência -- mesma lógica de tools.ts
      // (mt5LossStreakThreshold fechamentos negativos seguidos, mesmo
      // símbolo+lado, dentro da janela de mt5LossStreakCooldownMinutes;
      // conta SL mecânico OU fechamento manual negativo, não só SL).
      try {
        const recentClosed = await getRecentClosedTrades(context.sessionId, context.symbol, config.mt5LossStreakThreshold);
        const cooldownMs = config.mt5LossStreakCooldownMinutes * 60 * 1000;
        const isLoss = (t: Mt5RecentClosedTrade) => {
          const result = t.net_pnl ?? t.pnl;
          return t.exit_reason === "SL" || (result != null && result < 0);
        };
        const sameSideStreak =
          recentClosed.length >= config.mt5LossStreakThreshold &&
          recentClosed.every(
            (t) => t.side === context.direction && isLoss(t) && Date.now() - new Date(t.exit_time).getTime() < cooldownMs,
          );
        if (sameSideStreak) {
          throw new ValidationRejectException(
            PHASE,
            "loss_streak_cooldown",
            `${context.symbol} perdeu ${config.mt5LossStreakThreshold}x seguidas no lado ${context.direction} nos últimos ${config.mt5LossStreakCooldownMinutes} minutos.`,
          );
        }
      } catch (err) {
        if (err instanceof ValidationRejectException) throw err;
        throw new ValidationRejectException(
          PHASE,
          "loss_streak_check_failed",
          `Não foi possível confirmar o histórico recente de ${context.symbol} (falha de rede/Supabase): ${err instanceof Error ? err.message : err}.`,
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
