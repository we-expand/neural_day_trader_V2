// Persistência e medição das decisões da mesa (aprendizado contínuo, camada 1+2).
//
//  - saveDeskDecision: grava cada deliberação (aprovada ou rejeitada) em public.desk_decisions.
//  - linkDeskDecisionToTrade: liga a decisão aprovada ao trade que ela abriu.
//  - startDeskOutcomeJob: a cada 5 min mede, com velas de 1m, se o ALVO ou o STOP da proposta
//    teria vindo primeiro. Vale pras aprovadas e pras REJEITADAS (contrafactual).
//
// Tudo é "melhor esforço": se a tabela ainda não existir (migration 20260930 não rodada) ou o
// Supabase falhar, avisa UMA vez no log e segue. A mesa nunca deixa de decidir por causa disso:
// o arquivo local ledger/desk_decisions.jsonl continua sendo gravado de qualquer jeito.

import { config } from "./config.js";
import { getRecentOneMinuteCandles } from "./atr.js";
import { getSupabaseClient } from "./neuralBridge.js";
import { extractStances, resolveCounterfactual, type TranscriptEntry } from "./deskScoring.js";

const TABLE = "desk_decisions";
const OUTCOME_JOB_INTERVAL_MS = 5 * 60_000;
const OUTCOME_BATCH = 40;
const OUTCOME_HORIZON_MIN = 60;

const warnedAt = new Map<string, number>();
function warnOnce(key: string, message: string): void {
  const last = warnedAt.get(key) ?? 0;
  if (Date.now() - last < 30 * 60_000) return;
  warnedAt.set(key, Date.now());
  console.warn(`[MESA/db] ${message}`);
}

const tableMissingHint = (code?: string, message?: string) =>
  code === "42P01" || code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(message ?? "")
    ? " (a tabela desk_decisions ainda não existe: rode supabase/migrations/20260930_desk_decisions.sql no SQL Editor)"
    : "";

export interface DeskDecisionRow {
  id: string;
  sessionId: string;
  userId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  setupType: string | null;
  mode: string;
  llmOnly: boolean;
  bypassedGates: string[];
  decision: "APPROVE" | "REJECT";
  sizeFactor: number;
  conviction: number | null;
  reason: string;
  error: string | null;
  failedAgents: string[];
  durationMs: number;
  llmCalls: number;
  model: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  stopPct: number;
  takeProfitPct: number;
  amountUsd: number;
  riskUsd: number;
  transcript: { agent: string; ok: boolean; ms: number; error: string | null; json: Record<string, unknown> | null }[];
}

export async function saveDeskDecision(row: DeskDecisionRow): Promise<void> {
  try {
    const stances = extractStances(row.transcript as TranscriptEntry[], row.side, row.decision);
    const { error } = await getSupabaseClient().from(TABLE).insert({
      id: row.id,
      session_id: row.sessionId,
      user_id: row.userId,
      symbol: row.symbol,
      side: row.side,
      setup_type: row.setupType,
      mode: row.mode === "enforce" ? "enforce" : "shadow",
      llm_only: row.llmOnly,
      bypassed_gates: row.bypassedGates,
      decision: row.decision,
      size_factor: row.sizeFactor,
      conviction: row.conviction,
      reason: row.reason,
      error: row.error,
      failed_agents: row.failedAgents,
      duration_ms: row.durationMs,
      llm_calls: row.llmCalls,
      model: row.model,
      entry_price: row.entryPrice,
      stop_price: row.stopPrice,
      target_price: row.targetPrice,
      stop_pct: row.stopPct,
      take_profit_pct: row.takeProfitPct,
      amount_usd: row.amountUsd,
      risk_usd: row.riskUsd,
      transcript: row.transcript,
      stances,
    });
    if (error) warnOnce("insert", `falha ao gravar decisão no Supabase: ${error.message}${tableMissingHint(error.code, error.message)}`);
  } catch (err) {
    warnOnce("insert-exc", `falha ao gravar decisão no Supabase: ${err instanceof Error ? err.message : err}`);
  }
}

export async function linkDeskDecisionToTrade(decisionId: string, tradeId: string): Promise<void> {
  try {
    const { error } = await getSupabaseClient().from(TABLE).update({ trade_id: tradeId }).eq("id", decisionId);
    if (error) warnOnce("link", `falha ao ligar decisão ${decisionId} ao trade ${tradeId}: ${error.message}`);
  } catch (err) {
    warnOnce("link-exc", `falha ao ligar decisão ao trade: ${err instanceof Error ? err.message : err}`);
  }
}

interface PendingRow {
  id: string;
  created_at: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry_price: number | string;
  stop_price: number | string;
  target_price: number | string;
}

/** Mede o desfecho das decisões pendentes. Exportada para o script de relatório poder rodar sob demanda. */
export async function resolvePendingDeskOutcomes(): Promise<{ checked: number; resolved: number }> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("id, created_at, symbol, side, entry_price, stop_price, target_price")
    .eq("outcome_status", "PENDING")
    .lt("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .order("created_at", { ascending: true })
    .limit(OUTCOME_BATCH);
  if (error) {
    warnOnce("outcome-select", `não consegui ler as decisões pendentes: ${error.message}${tableMissingHint(error.code, error.message)}`);
    return { checked: 0, resolved: 0 };
  }
  const rows = (data ?? []) as PendingRow[];
  if (rows.length === 0) return { checked: 0, resolved: 0 };

  const candlesBySymbol = new Map<string, Awaited<ReturnType<typeof getRecentOneMinuteCandles>>>();
  let resolved = 0;
  for (const row of rows) {
    if (!candlesBySymbol.has(row.symbol)) candlesBySymbol.set(row.symbol, await getRecentOneMinuteCandles(row.symbol));
    const candles = candlesBySymbol.get(row.symbol) ?? [];
    const outcome = resolveCounterfactual({
      side: row.side,
      entryPrice: Number(row.entry_price),
      stopPrice: Number(row.stop_price),
      targetPrice: Number(row.target_price),
      decidedAtMs: new Date(row.created_at).getTime(),
      nowMs: Date.now(),
      candles: candles ?? [],
      horizonMin: OUTCOME_HORIZON_MIN,
    });
    if (outcome.status === "PENDING") continue;
    const { error: updateError } = await sb
      .from(TABLE)
      .update({
        outcome_status: outcome.status,
        outcome_resolved_at: new Date().toISOString(),
        outcome_minutes: outcome.minutes,
        outcome_max_favorable_pct: outcome.maxFavorablePct,
        outcome_max_adverse_pct: outcome.maxAdversePct,
        outcome_note: outcome.note || null,
      })
      .eq("id", row.id)
      .eq("outcome_status", "PENDING");
    if (updateError) {
      warnOnce("outcome-update", `falha ao gravar desfecho da decisão ${row.id}: ${updateError.message}`);
      continue;
    }
    resolved++;
    console.log(`[MESA/desfecho] ${row.symbol} ${row.side} decidido ${row.created_at}: ${outcome.status}${outcome.minutes != null ? ` em ${outcome.minutes} min` : ""}`);
  }
  return { checked: rows.length, resolved };
}

let outcomeTimer: ReturnType<typeof setInterval> | undefined;

/** Liga o job de desfecho. Só roda quando a mesa está ligada. Nunca derruba o processo. */
export function startDeskOutcomeJob(): void {
  if (outcomeTimer || config.mt5DeskMode === "off") return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await resolvePendingDeskOutcomes();
    } catch (err) {
      warnOnce("outcome-job", `job de desfecho falhou: ${err instanceof Error ? err.message : err}`);
    } finally {
      busy = false;
    }
  };
  outcomeTimer = setInterval(() => void tick(), OUTCOME_JOB_INTERVAL_MS);
  setTimeout(() => void tick(), 30_000);
  console.log(`[MESA/db] job de desfecho ligado (a cada ${OUTCOME_JOB_INTERVAL_MS / 60_000} min, horizonte ${OUTCOME_HORIZON_MIN} min).`);
}
