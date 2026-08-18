/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  APURAÇÃO MENSAL — Programa de Parceiros IB (pendência B4)         ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Ver SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md. Fecha o último buraco do
 * programa: sem este job, `partner_commission_entries` nunca recebe linha
 * nenhuma e o saldo de todo parceiro fica R$0 para sempre, mesmo com volume
 * real fluindo para `broker_order_executions`.
 *
 * DESENHO: importa `computeCommission`/`resolveTier`/`PROGRAM_RULES` de
 * `CommissionModel.ts` direto (motor puro, sem cópia — mesmo princípio do
 * `ai-runner`, "um motor, dois lugares que o chamam"). Este arquivo só busca
 * dado e decide QUANDO chamar o motor; a regra de quanto pagar mora só lá.
 *
 * FONTES DE RECEITA HOJE:
 *   • `execution_revenue` — real, vem de `broker_order_executions` (o ledger
 *     criado em 2026-08-18, gravado só pelo servidor a partir de ordem de
 *     mercado confirmada pela MetaAPI).
 *   • `subscription_revenue` e `marketplace_revenue` — NÃO existe fonte real
 *     ainda (não há tabela de pagamento/assinatura persistida no projeto).
 *     Gravados como 0 de propósito, nunca estimados — a convenção do projeto
 *     é erro/zero explícito em vez de dado inventado. Quando essas fontes
 *     existirem, plugar aqui; `CommissionModel.ts` já aceita os campos.
 *
 * DECISÃO v1 (Cleber, 2026-08-18): "comissão só sobre execução" aceito
 * explicitamente como escopo do lançamento — não é lacuna, é escolha. Um
 * indicado que assina o plano mas nunca executa ordem gera R$0 de comissão
 * pro parceiro enquanto essas fontes não existirem. Cron agendado em
 * `supabase/migrations/20260818_schedule_partner_commission_accrual.sql`.
 *
 * IDEMPOTÊNCIA: não usa upsert. Antes de inserir, lê quais `referral_id`
 * já têm apuração normal (`reversal_of IS NULL`) no período e pula essas —
 * mesmo efeito do índice único parcial do banco, sem depender de conflito de
 * upsert contra um índice parcial (que o `supabase-js` não expõe direito).
 * Rodar o job de novo no mesmo período é seguro: não duplica, não sobrescreve.
 *
 * TIER: cada parceiro tem um nível único por apuração, calculado a partir de
 * quantos indicados dele geraram margem POSITIVA neste período (2 passadas:
 * 1ª calcula a margem de cada indicado, 2ª aplica o tier do parceiro sobre
 * ela — porque o tier depende de quantos indicados de um MESMO parceiro
 * ficaram ativos no período, e isso só se sabe depois de calcular todos).
 */
import {
  computeCommission,
  resolveTier,
  PROGRAM_RULES,
  REALISTIC_SCENARIO,
  type ReferralMonthlyActivity,
} from '../../../src/app/services/partners/CommissionModel.ts';
import { getServiceClient } from './lib/serviceClient.ts';

function firstOfPreviousMonthUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

function addMonthsUTC(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface ReferralRow {
  id: string;
  partner_id: string;
  referred_user_id: string;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PARTNER_ACCRUAL_SHARED_SECRET');
  if (secret && req.headers.get('x-runner-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const periodParam = url.searchParams.get('period_start'); // 'YYYY-MM-01', pra reprocessar período passado
  const periodStart = periodParam ? new Date(`${periodParam}T00:00:00Z`) : firstOfPreviousMonthUTC(new Date());
  const periodEnd = addMonthsUTC(periodStart, 1);
  const periodStartStr = toDateOnly(periodStart);

  const sb = getServiceClient();

  const { data: referrals, error: referralsErr } = await sb
    .from('partner_referrals')
    .select('id, partner_id, referred_user_id')
    .lt('signed_up_at', periodEnd.toISOString());

  if (referralsErr) {
    console.error('[partner-commission-accrual] Falha ao listar partner_referrals:', referralsErr);
    return new Response(JSON.stringify({ error: String(referralsErr) }), { status: 500 });
  }
  if (!referrals || referrals.length === 0) {
    return new Response(JSON.stringify({ period_start: periodStartStr, referrals: 0 }), { status: 200 });
  }

  const referredUserIds = (referrals as ReferralRow[]).map((r) => r.referred_user_id);

  const { data: alreadyAccrued, error: accruedErr } = await sb
    .from('partner_commission_entries')
    .select('referral_id')
    .eq('period_start', periodStartStr)
    .is('reversal_of', null);

  if (accruedErr) {
    console.error('[partner-commission-accrual] Falha ao checar apurações existentes:', accruedErr);
    return new Response(JSON.stringify({ error: String(accruedErr) }), { status: 500 });
  }
  const alreadyAccruedIds = new Set((alreadyAccrued ?? []).map((r: { referral_id: string }) => r.referral_id));

  const { data: executions, error: execErr } = await sb
    .from('broker_order_executions')
    .select('user_id, volume')
    .in('user_id', referredUserIds)
    .gte('executed_at', periodStart.toISOString())
    .lt('executed_at', periodEnd.toISOString());

  if (execErr) {
    console.error('[partner-commission-accrual] Falha ao ler broker_order_executions:', execErr);
    return new Response(JSON.stringify({ error: String(execErr) }), { status: 500 });
  }

  const lotsByUser = new Map<string, number>();
  for (const row of (executions ?? []) as Array<{ user_id: string; volume: number }>) {
    lotsByUser.set(row.user_id, (lotsByUser.get(row.user_id) ?? 0) + Number(row.volume));
  }

  // 1ª passada: margem de cada indicado (independe do tier do parceiro).
  const pending = (referrals as ReferralRow[])
    .filter((r) => !alreadyAccruedIds.has(r.id))
    .map((r) => {
      const activity: ReferralMonthlyActivity = {
        lotsTraded: lotsByUser.get(r.referred_user_id) ?? 0,
        subscriptionPaid: 0,   // sem fonte real ainda — ver comentário no topo do arquivo
        marketplaceNet: 0,     // idem
      };
      const marginProbe = computeCommission(activity, resolveTier(0), REALISTIC_SCENARIO);
      return { referral: r, activity, marginBase: marginProbe.marginBase };
    });

  // Indicados ATIVOS por parceiro = os que geraram margem positiva no período.
  const activeCountByPartner = new Map<string, number>();
  for (const p of pending) {
    if (p.marginBase > 0) {
      activeCountByPartner.set(p.referral.partner_id, (activeCountByPartner.get(p.referral.partner_id) ?? 0) + 1);
    }
  }

  const now = new Date();
  const maturesAt = new Date(now.getTime() + PROGRAM_RULES.maturityDays * 24 * 60 * 60 * 1000).toISOString();

  const rowsToInsert = pending.map((p) => {
    const tier = resolveTier(activeCountByPartner.get(p.referral.partner_id) ?? 0);
    const breakdown = computeCommission(p.activity, tier, REALISTIC_SCENARIO);
    return {
      partner_id: p.referral.partner_id,
      referral_id: p.referral.id,
      period_start: periodStartStr,
      lots_traded: p.activity.lotsTraded,
      execution_revenue: breakdown.executionRevenue,
      subscription_revenue: breakdown.subscriptionRevenue,
      marketplace_revenue: breakdown.marketplaceRevenue,
      gross_revenue: breakdown.grossRevenue,
      tax_amount: breakdown.tax,
      infra_cost: breakdown.infraCost,
      margin_base: breakdown.marginBase,
      tier_at_accrual: tier.id,
      margin_share: tier.marginShare,
      assumptions: REALISTIC_SCENARIO,
      amount: breakdown.partnerCommission,
      status: 'PENDING',
      matures_at: maturesAt,
    };
  });

  let inserted = 0;
  if (rowsToInsert.length > 0) {
    const { error: insertErr, count } = await sb
      .from('partner_commission_entries')
      .insert(rowsToInsert, { count: 'exact' });
    if (insertErr) {
      console.error('[partner-commission-accrual] Falha ao inserir lançamentos:', insertErr);
      return new Response(JSON.stringify({ error: String(insertErr) }), { status: 500 });
    }
    inserted = count ?? rowsToInsert.length;
  }

  // Nível vigente do parceiro é o que a apuração mais recente calculou —
  // nunca o próprio parceiro. Best-effort: falha de update de tier não deve
  // derrubar a apuração (o dinheiro já está gravado, que é o que importa).
  let partnersUpdated = 0;
  for (const [partnerId, activeCount] of activeCountByPartner) {
    const tier = resolveTier(activeCount);
    const { error: tierErr } = await sb.from('partner_accounts').update({ tier: tier.id }).eq('id', partnerId);
    if (tierErr) {
      console.error(`[partner-commission-accrual] Falha ao atualizar tier do parceiro ${partnerId}:`, tierErr);
    } else {
      partnersUpdated += 1;
    }
  }

  return new Response(JSON.stringify({
    period_start: periodStartStr,
    referrals_considered: referrals.length,
    entries_skipped_existing: alreadyAccruedIds.size,
    entries_inserted: inserted,
    partners_updated: partnersUpdated,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
});

/**
 * O SQL do `cron.schedule` mensal mora em
 * `supabase/migrations/20260818_schedule_partner_commission_accrual.sql`
 * (não aplicado ainda — Cleber roda no SQL Editor com o secret real).
 */
