/**
 * Implementação server-side de `TradingCyclePersistence` (contrato definido
 * em `runTradingCycle.ts`). Espelha `useAIPersistence.ts` (driver browser) —
 * mesmas tabelas, mesmas colunas, mesma ordem de operações — mas grava via
 * service-role em vez de RLS de usuário logado.
 *
 * `saveDecision`/`onTradeOpen` do motor são chamadas fire-and-forget
 * (`.then()` sem await, ver runTradingCycle.ts:956-962). Pra não perder essas
 * escritas quando a função Deno retornar antes delas resolverem, todo
 * `Promise` disparado aqui é empilhado em `pending` — o chamador (index.ts)
 * dá `await Promise.allSettled(persistence.pending)` antes de responder.
 */
import type { TradingCyclePersistence } from '../../../../src/app/services/strategy/runTradingCycle.ts';
import { funnelTelemetry, type FunnelStage } from '../../../../src/app/services/telemetry/FunnelTelemetry.ts';
import { getServiceClient } from './serviceClient.ts';

/**
 * Cópia deliberada de `DecisionVetoStage` (AITradingPersistenceService.ts) —
 * NÃO importado de lá: aquele arquivo usa `.select()/.delete()/.rpc()` do
 * client de browser em vários pontos fora do que o shim implementa, então
 * até um `import type` puxaria o módulo inteiro pro grafo do `deno check`
 * sem necessidade (o runner só precisa do formato desta união). Lista
 * fechada — mantê-la em sincronia com o CHECK constraint de
 * `ai_decisions.veto_stage` é responsabilidade de quem mexer nesse campo,
 * mesma obrigação que já existe pro driver browser (useAIPersistence.ts).
 */
type DecisionVetoStage =
  | 'CONTEXT_SCORE_OPPOSITE' | 'CONTEXT_SCORE_LATERAL' | 'CONTEXT_CONFIDENCE' | 'CONTEXT_GATE'
  | 'CONFIG_DIRECTION' | 'COST_GATE' | 'COST_GATE_NO_DATA' | 'RISK_GATE' | 'KILL_SWITCH'
  | 'COOLDOWN' | 'MAX_TRADES_PER_DAY' | 'REVENGE_PATTERN' | 'CORRELATION_GUARD'
  | 'MARKET_MODE_REGIME_MISMATCH' | 'MARKET_MODE_COUNTER_NO_EXTREME' | 'MIN_TRADE_SIZE';

/**
 * Cópia deliberada de `useAIPersistence.ts:25-40` (VETO_TO_FUNNEL_STAGE).
 * Não é o motor compartilhado — é o driver, e cada driver que implementa
 * `TradingCyclePersistence` precisa dessa tradução por conta própria (o
 * driver browser tem a dele). Manter os dois em sincronia é responsabilidade
 * de quem mexer no CHECK constraint de `ai_decisions.veto_stage` ou na união
 * `FunnelStage`.
 */
const VETO_TO_FUNNEL_STAGE: Record<DecisionVetoStage, FunnelStage> = {
  CONTEXT_SCORE_OPPOSITE: 'SCORE_OPPOSITE',
  CONTEXT_SCORE_LATERAL: 'SCORE_LATERAL',
  CONTEXT_CONFIDENCE: 'COMBINED_CONFIDENCE_LOW',
  CONTEXT_GATE: 'CONTEXT_GATE',
  CONFIG_DIRECTION: 'CONFIG_DIRECTION',
  COST_GATE: 'COST_GATE',
  COST_GATE_NO_DATA: 'COST_GATE_NO_DATA',
  RISK_GATE: 'RISK_GATE',
  KILL_SWITCH: 'KILL_SWITCH',
  COOLDOWN: 'COOLDOWN_GATE',
  MAX_TRADES_PER_DAY: 'MAX_TRADES_PER_DAY',
  REVENGE_PATTERN: 'REVENGE_PATTERN',
  CORRELATION_GUARD: 'CORRELATION_GUARD',
  MARKET_MODE_REGIME_MISMATCH: 'MARKET_MODE_MISMATCH',
  MARKET_MODE_COUNTER_NO_EXTREME: 'MARKET_MODE_MISMATCH',
  MIN_TRADE_SIZE: 'MIN_TRADE_SIZE',
};

export interface RunnerPersistence extends TradingCyclePersistence {
  /** Promises fire-and-forget disparadas por saveDecision/onTradeOpen — aguardar antes de responder. */
  pending: Promise<unknown>[];
  /**
   * `newTrade.id` (sintético, gerado dentro de `runTradingCycle`) → `ai_trades.id`
   * (real, gerado pelo Postgres). O motor não devolve esse id pelo tipo de retorno
   * de `onTradeOpen` (Promise<void>), então o driver precisa capturar aqui pra
   * corrigir o `id` do efeito ADD_ORDER antes de somar à lista em memória —
   * senão o position manager desta mesma invocação não acha a linha pra fechar.
   */
  idMap: Map<string, string>;
}

export function createRunnerPersistence(sessionId: string, userId: string): RunnerPersistence {
  const sb = getServiceClient();
  const pending: Promise<unknown>[] = [];
  const idMap = new Map<string, string>();

  return {
    pending,
    idMap,

    saveDecision(decision) {
      // Ordem deliberada, espelhando useAIPersistence.ts:382-389: o funil
      // conta o veto mesmo que a escrita em ai_decisions falhe adiante.
      if (decision.vetoStage) {
        const stage = VETO_TO_FUNNEL_STAGE[decision.vetoStage as DecisionVetoStage];
        if (stage) funnelTelemetry.recordStage(stage, decision.symbol, decision.reasoning);
      }

      const p: Promise<void> = Promise.resolve(
        sb.from('ai_decisions').insert({
          session_id: sessionId,
          user_id: userId,
          symbol: decision.symbol,
          timestamp: new Date().toISOString(),
          decision: decision.decision,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          market_score: decision.marketScore ?? null,
          technical_signals: decision.technicalSignals ?? null,
          risk_assessment: decision.riskAssessment ?? null,
          action_taken: decision.actionTaken,
          veto_stage: decision.vetoStage ?? null,
          // `decision.tradeId` chega com o id SINTÉTICO do motor (newTrade.id) —
          // ai_decisions.trade_id é FK pra ai_trades.id (real), traduzir via idMap.
          trade_id: decision.tradeId ? (idMap.get(decision.tradeId) ?? null) : null,
        }),
      ).then(({ error }: { error: unknown }) => {
        if (error) console.error('[ai-runner/persistence] saveDecision falhou:', error);
      });
      pending.push(p);
      return p;
    },

    async onTradeOpen(trade) {
      const p: Promise<string | null> = Promise.resolve(
        sb.from('ai_trades').insert({
          session_id: sessionId,
          user_id: userId,
          symbol: trade.symbol,
          type: trade.side === 'LONG' ? 'BUY' : 'SELL',
          side: trade.side,
          entry_price: trade.price,
          quantity: trade.amount,
          stop_loss: trade.sl,
          take_profit: trade.tp,
          ai_confidence: trade.ai_confidence,
          ai_reasoning: trade.reasoning,
          indicators_snapshot: trade.indicators ?? null,
          market_conditions: null,
          entry_time: new Date(trade.timestamp).toISOString(),
          status: 'OPEN',
          commission: 0,
        }).select('id').single(),
      ).then(({ data, error }: { data: { id: string } | null; error: unknown }) => {
        if (error) {
          console.error('[ai-runner/persistence] onTradeOpen falhou:', error, trade.id);
          return null;
        }
        if (data?.id) idMap.set(trade.id, data.id);
        return data?.id ?? null;
      });
      pending.push(p);
      await p;
    },
  };
}
