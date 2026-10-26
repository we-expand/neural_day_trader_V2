/**
 * Ledger de execução real — construção da linha (2026-08-18).
 *
 * Extraído do handler `/broker/execute` para ser testável sem subir o Edge
 * Function inteiro: `buildExecutionLedgerRow` é pura, sem I/O. Quem grava é
 * `index.ts`, chamando `supabaseAdmin.from('broker_order_executions').insert(...)`.
 *
 * Contexto completo em `supabase/migrations/20260818_broker_order_executions.sql`
 * e `SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md`.
 */

/** As únicas ações de `/broker/execute` que abrem volume novo de mercado. */
export const LEDGER_TRACKED_ACTIONS = ['createMarketBuyOrder', 'createMarketSellOrder'] as const;
export type LedgerTrackedAction = (typeof LEDGER_TRACKED_ACTIONS)[number];

export function isLedgerTrackedAction(action: string): action is LedgerTrackedAction {
  return (LEDGER_TRACKED_ACTIONS as readonly string[]).includes(action);
}

export interface ExecutionLedgerInput {
  userId: string;
  brokerAccountId: string;
  action: LedgerTrackedAction;
  symbol: string;
  volume: number;
  orderId?: string | null;
  positionId?: string | null;
  comment?: string | null;
}

export interface ExecutionLedgerRow {
  user_id: string;
  broker_account_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  order_id: string | null;
  position_id: string | null;
  source_action: LedgerTrackedAction;
  comment: string | null;
}

/**
 * Constrói a linha do ledger a partir do resultado confirmado pela MetaAPI.
 * Retorna `null` quando a ordem não tem volume positivo — nunca grava linha
 * de volume zero ou negativo (o CHECK do banco também barra isso, esta função
 * evita a viagem de rede desnecessária).
 */
export function buildExecutionLedgerRow(input: ExecutionLedgerInput): ExecutionLedgerRow | null {
  if (!(input.volume > 0)) return null;
  if (!input.symbol) return null;

  const side: 'BUY' | 'SELL' = input.action === 'createMarketBuyOrder' ? 'BUY' : 'SELL';

  return {
    user_id: input.userId,
    broker_account_id: input.brokerAccountId,
    symbol: input.symbol,
    side,
    volume: input.volume,
    order_id: input.orderId ?? null,
    position_id: input.positionId ?? null,
    source_action: input.action,
    comment: input.comment ?? null,
  };
}
