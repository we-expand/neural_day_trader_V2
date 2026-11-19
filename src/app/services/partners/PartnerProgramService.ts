/**
 * Leitura dos dados reais do Programa de Parceiros IB — 2026-08-18.
 *
 * Convenção do projeto respeitada aqui à risca: NUNCA fabricar dado. A tela
 * anterior (`Partners.tsx`) exibia 12 indicados inventados, US$1.250 de
 * comissão fabricada e um gráfico com 4 pontos fixos no código — números que
 * um usuário leria como saldo real. Este serviço só devolve o que está no
 * banco, e quando não há nada (ou a migration ainda não foi aplicada) devolve
 * um estado explícito para a UI dizer isso em vez de inventar.
 */
import { supabase } from '@/lib/supabaseClient';
import {
  resolveTier,
  computeCommission,
  REALISTIC_SCENARIO,
  type CommissionBreakdown,
  type PartnerTierId,
} from './CommissionModel';

/** Estados possíveis da seção — cada um tem uma tela própria, nenhum é mock. */
export type PartnerDataState =
  | { kind: 'LOADING' }
  | { kind: 'NOT_PROVISIONED'; detail: string }   // migration ainda não aplicada
  | { kind: 'NOT_ENROLLED' }                       // usuário ainda não é parceiro
  | { kind: 'READY'; data: PartnerDashboard }
  | { kind: 'ERROR'; detail: string };

export interface ReferralRow {
  id: string;
  /** Identificador curto e público do indicado — nunca o e-mail completo. */
  publicId: string;
  maskedEmail: string | null;
  signedUpAt: string;
  brokerLinkedAt: string | null;
  firstTradeAt: string | null;
  subscribedAt: string | null;
  churnedAt: string | null;
  sourceChannel: string | null;
  /** Estágio derivado dos marcos acima — é o que a tabela ordena e filtra. */
  stage: 'SIGNED_UP' | 'LINKED' | 'TRADING' | 'PAYING' | 'CHURNED';
  /** Agregados do período selecionado. */
  periodLots: number;
  periodGrossRevenue: number;
  periodMarginBase: number;
  periodCommission: number;
  lifetimeCommission: number;
  lastActivityAt: string | null;
}

export interface CommissionEntryRow {
  id: string;
  referralId: string;
  periodStart: string;
  lots: number;
  grossRevenue: number;
  tax: number;
  infraCost: number;
  marginBase: number;
  tierAtAccrual: PartnerTierId;
  marginShare: number;
  amount: number;
  status: 'PENDING' | 'AVAILABLE' | 'PAID' | 'REVERSED';
  maturesAt: string;
  reversalOf: string | null;
}

export interface PartnerDashboard {
  partnerId: string;
  referralCode: string;
  tier: PartnerTierId;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  totalReferrals: number;
  linkedReferrals: number;
  tradingReferrals: number;
  payingReferrals: number;
  /** Indicados que geraram margem no período — é o que define o nível. */
  activeReferrals: number;
  lifetimeLots: number;
  lifetimeEarned: number;
  availableBalance: number;
  pendingBalance: number;
  paidTotal: number;
  referrals: ReferralRow[];
  entries: CommissionEntryRow[];
  /** Série mensal real de comissão — vazia enquanto não houver apuração. */
  monthlySeries: { period: string; amount: number; lots: number }[];
}

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205', 'PGRST202']);

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.has(error.code)) return true;
  return /does not exist|could not find the table|schema cache/i.test(error.message ?? '');
}

/** Mascara o e-mail do indicado. LGPD: o parceiro não precisa do endereço completo. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return null;
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${'•'.repeat(Math.max(3, user.length - 2))}@${domain}`;
}

function deriveStage(r: {
  churned_at: string | null;
  subscribed_at: string | null;
  first_trade_at: string | null;
  broker_linked_at: string | null;
}): ReferralRow['stage'] {
  if (r.churned_at) return 'CHURNED';
  if (r.subscribed_at) return 'PAYING';
  if (r.first_trade_at) return 'TRADING';
  if (r.broker_linked_at) return 'LINKED';
  return 'SIGNED_UP';
}

export interface LoadOptions {
  /** Início do período do painel (inclusive). */
  from: Date;
  /** Fim do período (inclusive). */
  to: Date;
}

export async function loadPartnerDashboard(userId: string, options: LoadOptions): Promise<PartnerDataState> {
  if (!supabase) {
    return { kind: 'ERROR', detail: 'Supabase não está configurado neste ambiente.' };
  }

  const fromIso = options.from.toISOString().slice(0, 10);
  const toIso = options.to.toISOString().slice(0, 10);

  // 1) Conta de parceiro.
  const { data: account, error: accountError } = await supabase
    .from('partner_accounts')
    .select('id, referral_code, tier, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (accountError) {
    if (isMissingTable(accountError)) {
      return {
        kind: 'NOT_PROVISIONED',
        detail: 'As tabelas do Programa de Parceiros ainda não existem no banco. Aplique supabase/migrations/20260818_partner_ib_program.sql.',
      };
    }
    return { kind: 'ERROR', detail: accountError.message };
  }

  if (!account) return { kind: 'NOT_ENROLLED' };

  // 2) Indicados e lançamentos do período, em paralelo.
  const [referralsRes, entriesRes] = await Promise.all([
    supabase
      .from('partner_referrals')
      .select('id, referred_user_id, signed_up_at, broker_linked_at, first_trade_at, subscribed_at, churned_at, source_channel')
      .eq('partner_id', account.id)
      .order('signed_up_at', { ascending: false }),
    supabase
      .from('partner_commission_entries')
      .select('id, referral_id, period_start, lots_traded, gross_revenue, tax_amount, infra_cost, margin_base, tier_at_accrual, margin_share, amount, status, matures_at, reversal_of')
      .eq('partner_id', account.id)
      .gte('period_start', fromIso)
      .lte('period_start', toIso)
      .order('period_start', { ascending: false }),
  ]);

  if (referralsRes.error) return { kind: 'ERROR', detail: referralsRes.error.message };
  if (entriesRes.error) return { kind: 'ERROR', detail: entriesRes.error.message };

  const entries: CommissionEntryRow[] = (entriesRes.data ?? []).map((e) => ({
    id: e.id,
    referralId: e.referral_id,
    periodStart: e.period_start,
    lots: Number(e.lots_traded) || 0,
    grossRevenue: Number(e.gross_revenue) || 0,
    tax: Number(e.tax_amount) || 0,
    infraCost: Number(e.infra_cost) || 0,
    marginBase: Number(e.margin_base) || 0,
    tierAtAccrual: e.tier_at_accrual as PartnerTierId,
    marginShare: Number(e.margin_share) || 0,
    amount: Number(e.amount) || 0,
    status: e.status as CommissionEntryRow['status'],
    maturesAt: e.matures_at,
    reversalOf: e.reversal_of,
  }));

  const byReferral = new Map<string, CommissionEntryRow[]>();
  for (const entry of entries) {
    const list = byReferral.get(entry.referralId) ?? [];
    list.push(entry);
    byReferral.set(entry.referralId, list);
  }

  const referrals: ReferralRow[] = (referralsRes.data ?? []).map((r) => {
    const own = byReferral.get(r.id) ?? [];
    const sum = (pick: (e: CommissionEntryRow) => number) => own.reduce((acc, e) => acc + pick(e), 0);
    return {
      id: r.id,
      // Identificador público e estável, derivado do uuid — o parceiro precisa
      // distinguir um indicado do outro, não precisa saber quem é.
      publicId: `#${r.referred_user_id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
      maskedEmail: null,
      signedUpAt: r.signed_up_at,
      brokerLinkedAt: r.broker_linked_at,
      firstTradeAt: r.first_trade_at,
      subscribedAt: r.subscribed_at,
      churnedAt: r.churned_at,
      sourceChannel: r.source_channel,
      stage: deriveStage(r),
      periodLots: sum((e) => e.lots),
      periodGrossRevenue: sum((e) => e.grossRevenue),
      periodMarginBase: sum((e) => e.marginBase),
      periodCommission: sum((e) => e.amount),
      lifetimeCommission: sum((e) => e.amount),
      lastActivityAt: own.length ? own[0].periodStart : null,
    };
  });

  // 3) Resumo agregado.
  const { data: summary, error: summaryError } = await supabase
    .from('partner_dashboard_summary')
    .select('*')
    .eq('partner_id', account.id)
    .maybeSingle();

  if (summaryError && !isMissingTable(summaryError)) {
    return { kind: 'ERROR', detail: summaryError.message };
  }

  const monthly = new Map<string, { amount: number; lots: number }>();
  for (const e of entries) {
    const acc = monthly.get(e.periodStart) ?? { amount: 0, lots: 0 };
    acc.amount += e.amount;
    acc.lots += e.lots;
    monthly.set(e.periodStart, acc);
  }

  return {
    kind: 'READY',
    data: {
      partnerId: account.id,
      referralCode: account.referral_code,
      tier: account.tier as PartnerTierId,
      status: account.status as PartnerDashboard['status'],
      totalReferrals: Number(summary?.total_referrals ?? referrals.length),
      linkedReferrals: Number(summary?.linked_referrals ?? referrals.filter((r) => r.brokerLinkedAt).length),
      tradingReferrals: Number(summary?.trading_referrals ?? referrals.filter((r) => r.firstTradeAt).length),
      payingReferrals: Number(summary?.paying_referrals ?? referrals.filter((r) => r.stage === 'PAYING').length),
      activeReferrals: referrals.filter((r) => r.periodCommission > 0).length,
      lifetimeLots: Number(summary?.lifetime_lots ?? 0),
      lifetimeEarned: Number(summary?.lifetime_earned ?? 0),
      availableBalance: Number(summary?.available_balance ?? 0),
      pendingBalance: Number(summary?.pending_balance ?? 0),
      paidTotal: Number(summary?.paid_total ?? 0),
      referrals,
      entries,
      monthlySeries: [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({ period, ...v })),
    },
  };
}

/**
 * Cria a conta de parceiro do usuário (aceite dos termos).
 *
 * O `referral_code` NÃO é enviado daqui de propósito: quem o gera é o trigger
 * `partner_accounts_assign_code` no banco. Se o cliente escolhesse o código,
 * daria para reivindicar um código de marca ("NEURAL", "OFICIAL") e dois
 * cadastros simultâneos poderiam colidir.
 */
export async function enrollPartner(userId: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não está configurado neste ambiente.' };

  const { data, error } = await supabase
    .from('partner_accounts')
    .insert({ user_id: userId, tier: 'NODE', status: 'ACTIVE', terms_accepted_at: new Date().toISOString() })
    .select('referral_code')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, code: data.referral_code };
}

/** Pedido de saque. O servidor confere o saldo de novo antes de aprovar. */
export async function requestPayout(
  partnerId: string,
  amount: number,
  method: 'PIX' | 'BANK_TRANSFER' | 'USDT',
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não está configurado neste ambiente.' };
  const { error } = await supabase.from('partner_payouts').insert({ partner_id: partnerId, amount, method, status: 'REQUESTED' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Recalcula localmente a demonstração de um lançamento, para a UI abrir a conta
 * linha a linha. Usa a alíquota CONGELADA no lançamento, não a vigente — um
 * lançamento antigo tem que continuar batendo com o que foi pago na época.
 */
export function explainEntry(entry: CommissionEntryRow): CommissionBreakdown {
  const tier = { ...resolveTier(0), id: entry.tierAtAccrual, marginShare: entry.marginShare };
  return computeCommission(
    {
      lotsTraded: entry.lots,
      subscriptionPaid: 0,
      marketplaceNet: 0,
    },
    tier,
    REALISTIC_SCENARIO,
  );
}
