/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  JARVIS — segundo cérebro do motor (evolução contínua)              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Roda a cada 6h via pg_cron. Lê dado real de produção (ai_trades,
 * price_guard_events), calcula métricas de saúde da janela, avalia um
 * conjunto fixo de regras de decisão e grava tudo com auditoria completa.
 *
 * Desenho completo: SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md
 * seção 6-7 e supabase/functions/jarvis/BLUEPRINT.md (guardrails, fluxo,
 * lista de exclusão). Esta é a primeira implementação real — Passo 3 do
 * checklist. Ainda NÃO deployada nem agendada (Passos 4-6 seguem em aberto).
 *
 * MODO DE OPERAÇÃO: Jarvis AUTOAPLICA dentro de guardrails (jarvis_guardrails,
 * dado — não código). Diferente da regra "nunca commit/push sozinho" do
 * projeto, que vale só pra código-fonte (ver CLAUDE.md).
 *
 * Ordem de execução de cada ciclo:
 *   1. Reavalia toda decisão ACTIVE cujo ciclo de medição (6h) já fechou —
 *      rollback automático se o PnL piorou mais que o limiar configurado.
 *   2. Calcula métricas da janela de 6h (ai_trades fechados).
 *   3. Roda as regras de decisão, cada uma passando por evaluateGuardrails().
 *   4. Grava snapshot em jarvis_health_snapshots.
 */
import { getServiceClient } from './lib/serviceClient.ts';

// ────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────

interface PeriodMetrics {
  n: number;
  wins: number;
  winRate: number | null;
  avgPnl: number | null;
  maxDrawdown: number | null;
  confidenceAUC: number | null;
}

interface DecisionCandidate {
  decision_type: string;
  target: string;
  action: string;
  magnitudePct?: number;
  evidence: Record<string, unknown>;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

interface GuardrailRow {
  target: string;
  magnitude_cap_pct: number;
  cooldown_cycles: number;
  requires_approval: boolean;
  rollback_stddev_threshold: number;
}

const CYCLE_HOURS = 6;
const CYCLE_MS = CYCLE_HOURS * 60 * 60 * 1000;

// ────────────────────────────────────────────────────────────────────────
// Métricas
// ────────────────────────────────────────────────────────────────────────

interface ClosedTradeRow {
  net_pnl: number | null;
  ai_confidence: number | null;
  exit_time: string;
}

function computeMetrics(trades: ClosedTradeRow[]): PeriodMetrics {
  const n = trades.length;
  if (n === 0) {
    return { n: 0, wins: 0, winRate: null, avgPnl: null, maxDrawdown: null, confidenceAUC: null };
  }

  const wins = trades.filter((t) => (t.net_pnl ?? 0) > 0).length;
  const winRate = wins / n;
  const avgPnl = trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0) / n;

  // Drawdown máximo da sequência (ordenada por exit_time), sobre PnL acumulado.
  const sorted = [...trades].sort((a, b) => a.exit_time.localeCompare(b.exit_time));
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of sorted) {
    cumulative += t.net_pnl ?? 0;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
  }

  // AUC simplificado (Mann-Whitney U / (n_win * n_loss)) — mesma definição
  // usada na análise de 2026-08-23 (research/experiments/2026-08-23-custo-nao-cobrado-e-poder/).
  const withConfidence = trades.filter((t) => t.ai_confidence != null);
  let confidenceAUC: number | null = null;
  const winsConf = withConfidence.filter((t) => (t.net_pnl ?? 0) > 0).map((t) => t.ai_confidence as number);
  const lossConf = withConfidence.filter((t) => (t.net_pnl ?? 0) <= 0).map((t) => t.ai_confidence as number);
  if (winsConf.length > 0 && lossConf.length > 0) {
    let concordant = 0;
    let tied = 0;
    for (const w of winsConf) {
      for (const l of lossConf) {
        if (w > l) concordant += 1;
        else if (w === l) tied += 1;
      }
    }
    confidenceAUC = (concordant + 0.5 * tied) / (winsConf.length * lossConf.length);
  }

  return { n, wins, winRate, avgPnl, maxDrawdown, confidenceAUC };
}

// ────────────────────────────────────────────────────────────────────────
// Motor de guardrails — ver BLUEPRINT.md "Motor de Guardrails"
// ────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function insertDecision(sb: any, c: DecisionCandidate, extra: {
  status: 'PENDING' | 'ACTIVE';
  requiresApproval: boolean;
  approvedBy?: string;
  magnitudeCapPct?: number;
  baselinePnlStddev?: number;
}) {
  const now = new Date();
  const row = {
    decision_type: c.decision_type,
    target: c.target,
    action: c.action,
    evidence: c.evidence,
    magnitude_pct: c.magnitudePct ?? null,
    magnitude_cap_pct: extra.magnitudeCapPct ?? null,
    requires_approval: extra.requiresApproval,
    status: extra.status,
    approved_by: extra.status === 'ACTIVE' ? (extra.approvedBy ?? 'system_auto') : null,
    approved_at: extra.status === 'ACTIVE' ? now.toISOString() : null,
    baseline_pnl_stddev: extra.baselinePnlStddev ?? null,
  };
  const { error } = await sb.from('jarvis_decisions').insert(row);
  if (error) console.error(`[jarvis] Falha ao gravar decisão (${c.target}):`, error);
  return row;
}

// deno-lint-ignore no-explicit-any
async function evaluateGuardrails(sb: any, c: DecisionCandidate) {
  const { data: rail } = await sb
    .from('jarvis_guardrails')
    .select('*')
    .eq('target', c.target)
    .maybeSingle();

  const guardrail = rail as GuardrailRow | null;

  // Alvo sem config de guardrail = trata como REQUIRES_APPROVAL por padrão
  // seguro (nunca autoaplica um target desconhecido).
  if (!guardrail || guardrail.requires_approval) {
    return insertDecision(sb, c, { status: 'PENDING', requiresApproval: true });
  }

  // Cooldown: já mexeu neste alvo recentemente (última decisão ACTIVE)?
  const { data: lastActive } = await sb
    .from('jarvis_decisions')
    .select('created_at')
    .eq('target', c.target)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastActive) {
    const cooldownMs = guardrail.cooldown_cycles * CYCLE_MS;
    if (Date.now() - new Date(lastActive.created_at).getTime() < cooldownMs) {
      console.log(`[jarvis] ${c.target} em cooldown — pulando ciclo`);
      return null;
    }
  }

  // Clampa magnitude ao teto configurado
  let magnitude = c.magnitudePct;
  if (magnitude !== undefined && Math.abs(magnitude) > guardrail.magnitude_cap_pct) {
    const clampedFrom = magnitude;
    magnitude = Math.sign(magnitude) * guardrail.magnitude_cap_pct;
    c.evidence = { ...c.evidence, clamped_from: clampedFrom };
  }

  return insertDecision(
    sb,
    { ...c, magnitudePct: magnitude },
    {
      status: 'ACTIVE',
      requiresApproval: false,
      approvedBy: 'system_auto',
      magnitudeCapPct: guardrail.magnitude_cap_pct,
    },
  );
}

// ────────────────────────────────────────────────────────────────────────
// Reavaliação/rollback de decisões ACTIVE cujo ciclo já fechou
// ────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function reevaluateActiveDecisions(sb: any) {
  const { data: active, error } = await sb
    .from('jarvis_decisions')
    .select('*')
    .eq('status', 'ACTIVE');

  if (error) {
    console.error('[jarvis] Falha ao ler decisões ACTIVE:', error);
    return;
  }
  if (!active || active.length === 0) return;

  const { data: rails } = await sb.from('jarvis_guardrails').select('*');
  const railByTarget = new Map<string, GuardrailRow>((rails ?? []).map((r: GuardrailRow) => [r.target, r]));

  for (const decision of active) {
    const approvedAt = decision.approved_at ? new Date(decision.approved_at).getTime() : null;
    if (!approvedAt) continue;
    if (Date.now() - approvedAt < CYCLE_MS) continue; // ciclo de medição ainda não fechou

    const rail = railByTarget.get(decision.target);
    const threshold = rail?.rollback_stddev_threshold ?? 1.0;

    // Mede PnL do período pós-aprovação, todos os trades fechados.
    const { data: postTrades } = await sb
      .from('ai_trades')
      .select('net_pnl')
      .eq('status', 'CLOSED')
      .not('net_pnl', 'is', null)
      .gte('exit_time', decision.approved_at);

    const pnlValues: number[] = (postTrades ?? []).map((t: { net_pnl: number }) => t.net_pnl);
    const postPnlSum = pnlValues.reduce((s, v) => s + v, 0);

    // Baseline: PnL médio histórico anterior à decisão, mesma janela de tamanho.
    const { data: baselineTrades } = await sb
      .from('ai_trades')
      .select('net_pnl')
      .eq('status', 'CLOSED')
      .not('net_pnl', 'is', null)
      .lt('exit_time', decision.approved_at)
      .order('exit_time', { ascending: false })
      .limit(Math.max(pnlValues.length, 1));

    const baselineValues: number[] = (baselineTrades ?? []).map((t: { net_pnl: number }) => t.net_pnl);
    const baselineMean = baselineValues.length > 0
      ? baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length
      : 0;
    const baselineStddev = decision.baseline_pnl_stddev ??
      (baselineValues.length > 1
        ? Math.sqrt(
          baselineValues.reduce((s, v) => s + (v - baselineMean) ** 2, 0) / (baselineValues.length - 1),
        )
        : 0);

    const effectOnPnl = pnlValues.length > 0 ? postPnlSum - baselineMean * pnlValues.length : 0;
    const daysRunning = (Date.now() - approvedAt) / (24 * 60 * 60 * 1000);

    const shouldRollback = baselineStddev > 0 && effectOnPnl < -(threshold * baselineStddev);

    if (shouldRollback) {
      await sb.from('jarvis_decisions').update({
        status: 'ROLLED_BACK',
        reverted_at: new Date().toISOString(),
        revert_reason: 'auto_rollback_pnl_degradation',
        effect_on_pnl: effectOnPnl,
        baseline_pnl_stddev: baselineStddev,
        days_running: daysRunning,
      }).eq('id', decision.id);

      await sb.from('jarvis_alerts').insert({
        alert_type: 'AUTO_ROLLBACK',
        severity: 'WARNING',
        metric: 'effect_on_pnl',
        current_value: effectOnPnl,
        threshold: -(threshold * baselineStddev),
        auto_action: 'ROLLED_BACK',
        action_taken_at: new Date().toISOString(),
      });

      console.log(`[jarvis] Rollback automático: ${decision.target} (effect=${effectOnPnl.toFixed(2)})`);
    } else {
      await sb.from('jarvis_decisions').update({
        status: 'COMPLETED',
        effect_on_pnl: effectOnPnl,
        baseline_pnl_stddev: baselineStddev,
        days_running: daysRunning,
      }).eq('id', decision.id);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Regras de decisão (BLUEPRINT.md "Regras de Decisão")
// ────────────────────────────────────────────────────────────────────────

// Regra 1: Win rate abaixo do breakeven (payoff médio da cesta, ver
// AI_BRAIN_SPEC.md — breakeven varia por preset; 0.35 é o valor de
// referência do preset ativo em produção há mais tempo, R:R ~1.8:1).
// deno-lint-ignore no-explicit-any
async function checkWinRateGate(sb: any, m: PeriodMetrics) {
  if (m.n < 5 || m.winRate == null) return null; // amostra insuficiente pra decidir qualquer coisa

  const breakeven = 0.35;
  const thresholdPause = breakeven * 0.80;
  const thresholdAlert = breakeven * 0.90;

  if (m.winRate < thresholdPause) {
    return evaluateGuardrails(sb, {
      decision_type: 'GATE_TOGGLE',
      target: 'CONFIDENCE_GATE',
      action: 'disable',
      evidence: { win_rate_6h: m.winRate, n: m.n, threshold: thresholdPause },
      severity: 'CRITICAL',
    });
  }

  if (m.winRate < thresholdAlert) {
    return evaluateGuardrails(sb, {
      decision_type: 'SIZE_ADJUST',
      target: 'position_size',
      action: '-50%',
      magnitudePct: -50,
      evidence: { win_rate_6h: m.winRate, n: m.n, threshold: thresholdAlert },
      severity: 'WARNING',
    });
  }

  return null;
}

// Regra 2: confidence score não discrimina (AUC medido em 2026-08-23: 0.529,
// praticamente aleatório — ver seção 1 achados incidentais).
// deno-lint-ignore no-explicit-any
async function checkConfidenceCalibration(sb: any, m: PeriodMetrics) {
  if (m.confidenceAUC == null) return null;
  if (m.confidenceAUC < 0.55) {
    return evaluateGuardrails(sb, {
      decision_type: 'TEST_SIGNAL',
      target: 'confidence_score',
      action: 'launch_meta_label_experiment',
      evidence: {
        metric: 'auc',
        value: m.confidenceAUC,
        threshold: 0.6,
        recommendation:
          'Confidence discrimina pior/igual a acaso nesta janela. Propor experimento formal antes de qualquer recalibração.',
      },
      severity: 'WARNING',
    });
  }
  return null;
}

// Regra 3: anomalias de price guard (RealMarketDataService.ts, guarda de
// desvio máximo desenhada em 2026-08-21 — ver price_guard_events).
// deno-lint-ignore no-explicit-any
async function checkPriceGuardEvents(sb: any) {
  const sixHoursAgo = new Date(Date.now() - CYCLE_MS).toISOString();
  const { data, error } = await sb
    .from('price_guard_events')
    .select('symbol, event_type')
    .gte('created_at', sixHoursAgo);

  if (error) {
    console.error('[jarvis] Falha ao ler price_guard_events:', error);
    return null;
  }
  if (!data || data.length <= 2) return null;

  const symbols = [...new Set(data.map((d: { symbol: string }) => d.symbol))];
  await sb.from('jarvis_alerts').insert({
    alert_type: 'PRICE_GUARD_BREACH',
    severity: 'CRITICAL',
    metric: 'price_guard_breaches_6h',
    current_value: data.length,
    threshold: 2,
    auto_action: 'ALERT_CLEBER',
    action_taken_at: new Date().toISOString(),
  });
  console.log(`[jarvis] Anomalia de price guard: ${data.length} eventos em 6h (${symbols.join(', ')})`);
  return data.length;
}

// Regra 4 (histórico): janelas de horário de baixa liquidez/custo alto —
// resultado da pesquisa de sazonalidade concluída em 2026-08-23 (seção 3 da
// sessão): rollover 21-22 UTC (spread 5-10x) e almoço da Ásia 02-06 UTC pra
// cripto (vol baixa, liquidez Binance ~30% pior).
//
// CORRIGIDO 2026-08-24 (seção 10 da sessão): esta regra gravava uma decisão
// SIZE_ADJUST em jarvis_decisions só quando `hourNow` batia exatamente 21 ou
// caía em 2-6 — mas o cron do Jarvis roda só nas horas cheias de 6h
// (0/6/12/18 UTC), que nunca coincidem com essas janelas. A regra nunca
// disparou na prática desde que foi escrita. Além disso, mesmo se disparasse,
// o lado que lê a decisão (fetchJarvisSizeMultiplier) só checava
// status='ACTIVE', sem checar hora — o efeito "vazaria" pra fora da janela
// real até o próximo ciclo de 6h reavaliar.
//
// Como os horários já são achado de pesquisa fixo (não algo que o Jarvis
// precisa aprender/auditar por ciclo), o efeito real agora é calculado
// direto no motor de trading pela hora UTC no momento do trade — ver
// `seasonalityMultiplier` em src/app/services/strategy/jarvisSizeMultiplier.ts,
// aplicado em runTradingCycle.ts. Esta função aqui não grava mais decisão:
// só registra em jarvis_health_snapshots se o ciclo de 6h que fechou
// atravessou uma dessas janelas, pra telemetria/observação.
function checkSeasonalityWindow(now: Date): { rolloverInWindow: boolean; cryptoLunchInWindow: boolean } {
  // O ciclo cobre as últimas 6h (CYCLE_MS) — checa se alguma hora cheia
  // dentro dessa janela caiu dentro do intervalo de rollover ou almoço-Ásia.
  let rolloverInWindow = false;
  let cryptoLunchInWindow = false;
  for (let i = 0; i < 6; i++) {
    const h = (now.getUTCHours() - i + 24) % 24;
    if (h === 21) rolloverInWindow = true;
    if (h >= 2 && h < 6) cryptoLunchInWindow = true;
  }
  return { rolloverInWindow, cryptoLunchInWindow };
}

// ────────────────────────────────────────────────────────────────────────
// Ciclo principal
// ────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const secret = Deno.env.get('JARVIS_SHARED_SECRET');
  if (secret && req.headers.get('x-runner-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const sb = getServiceClient();
  const now = new Date();

  try {
    // 1. Reavalia decisões ACTIVE cujo ciclo de medição já fechou.
    await reevaluateActiveDecisions(sb);

    // 2. Métricas da janela de 6h.
    const sixHoursAgo = new Date(now.getTime() - CYCLE_MS).toISOString();
    const { data: trades, error: tradesError } = await sb
      .from('ai_trades')
      .select('net_pnl, ai_confidence, exit_time')
      .eq('status', 'CLOSED')
      .not('net_pnl', 'is', null)
      .gte('exit_time', sixHoursAgo);

    if (tradesError) {
      console.error('[jarvis] Falha ao ler ai_trades:', tradesError);
      return new Response(JSON.stringify({ error: String(tradesError) }), { status: 500 });
    }

    const metrics = computeMetrics((trades ?? []) as ClosedTradeRow[]);

    // 3. Regras de decisão.
    await checkWinRateGate(sb, metrics);
    await checkConfidenceCalibration(sb, metrics);
    const priceGuardBreaches = (await checkPriceGuardEvents(sb)) ?? 0;
    const seasonality = checkSeasonalityWindow(now);

    // Custo de decisões (COST_GATE), pra completar o snapshot.
    // Telemetria própria do gate não é gravada em tabela hoje — placeholder
    // null até que exista uma fonte real (ver ai_funnel_snapshots).
    const costGateRejections6h: number | null = null;

    // 4. Snapshot de saúde.
    const snapshot = {
      snapshot_time: now.toISOString(),
      trades_6h: metrics.n,
      win_rate_6h: metrics.winRate,
      avg_pnl_6h: metrics.avgPnl,
      max_drawdown_6h: metrics.maxDrawdown,
      confidence_auc: metrics.confidenceAUC,
      confidence_brier_score: null,
      price_guard_breaches_6h: priceGuardBreaches,
      cost_gate_rejections_6h: costGateRejections6h,
      hour_of_day: now.getUTCHours(),
      day_of_week: now.getUTCDay(),
      calendar_event: [
        seasonality.rolloverInWindow ? 'rollover_21_22_utc' : null,
        seasonality.cryptoLunchInWindow ? 'crypto_lunch_02_06_utc' : null,
      ].filter(Boolean).join(',') || null,
      jarvis_recommendation: metrics.winRate != null && metrics.winRate < 0.28 ? 'PAUSE' : 'NORMAL',
    };

    const { error: snapshotError } = await sb.from('jarvis_health_snapshots').insert(snapshot);
    if (snapshotError) console.error('[jarvis] Falha ao gravar snapshot:', snapshotError);

    return new Response(JSON.stringify({ ok: true, metrics, snapshot }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('[jarvis] Erro não tratado no ciclo:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
