/**
 * Modelo de comissionamento do Programa de Parceiros IB — 2026-08-18.
 *
 * REGRA ÚNICA DO PROGRAMA (a que faz a conta fechar):
 *
 *     comissão do parceiro = tier% × MARGEM DE CONTRIBUIÇÃO do indicado no mês
 *
 * onde  margem = receita bruta gerada pelo indicado
 *               − imposto sobre faturamento
 *               − custo de servir (infraestrutura por usuário ativo)
 *
 * Por que a base é MARGEM e não receita bruta: com `tier% ≤ 30%` aplicado sobre
 * a margem, a plataforma retém ≥70% do que sobra POR CONSTRUÇÃO — em qualquer
 * cenário de volume, preço ou rebate. É matematicamente impossível pagar ao
 * parceiro mais do que se recebe, que é exatamente o requisito. Se a base fosse
 * receita bruta, um indicado de baixo volume no tier grátis (que custa R$27/mês
 * de infra e gera R$19,50 de receita no cenário Pessimista da planilha) geraria
 * comissão sobre uma margem NEGATIVA — pagar para ter prejuízo.
 *
 * Premissas econômicas: todas vêm da aba "Premissas" de
 * `projecao-financeira-5anos.xlsx` (ver `SESSAO_2026-08-10_MODELO_FINANCEIRO.md`).
 * Nenhum número aqui foi inventado; os que são premissa e não medição estão
 * marcados como tal em `SCENARIO_ASSUMPTIONS`.
 *
 * IMPORTANTE — este módulo é PURO e não conhece Supabase nem React de propósito:
 * ele é o que o gate `npm run validate` executa para travar a invariante de que
 * o programa nunca custa mais do que gera. Ver `__validate__.ts` ao lado.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Escada de níveis
// ─────────────────────────────────────────────────────────────────────────────

export type PartnerTierId = 'NODE' | 'SIGNAL' | 'CORE' | 'PRIME';

export interface PartnerTier {
  id: PartnerTierId;
  /** Rótulo exibido ao parceiro. */
  label: string;
  /** Mínimo de indicados ATIVOS (geraram margem no mês) para estar neste nível. */
  minActiveReferrals: number;
  /** Fatia da margem de contribuição do indicado que vai para o parceiro. */
  marginShare: number;
  /** Uma linha explicando o que muda neste nível — usada na UI. */
  perk: string;
}

/**
 * Escada calibrada em 2026-08-18 contra os 3 cenários da planilha (ver
 * `SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md`, seção "Calibração"):
 * o topo (30%) mantém a comissão acumulada em ~32% da margem no ano 1 e ~26%
 * em 36 meses — bem abaixo do ponto de indiferença de 48,3% em que o programa
 * passaria a custar mais do que a mídia paga que ele substitui.
 */
export const PARTNER_TIERS: readonly PartnerTier[] = [
  { id: 'NODE',   label: 'Node',   minActiveReferrals: 1,  marginShare: 0.15, perk: 'Entrada no programa. Link e painel liberados.' },
  { id: 'SIGNAL', label: 'Signal', minActiveReferrals: 5,  marginShare: 0.20, perk: 'Material de divulgação e sub-links por campanha.' },
  { id: 'CORE',   label: 'Core',   minActiveReferrals: 20, marginShare: 0.25, perk: 'Saque quinzenal e relatório de coorte por indicado.' },
  { id: 'PRIME',  label: 'Prime',  minActiveReferrals: 50, marginShare: 0.30, perk: 'Saque semanal, gerente dedicado e condição negociada.' },
] as const;

/** Teto duro do programa. Nenhuma configuração pode pagar acima disto. */
export const MAX_MARGIN_SHARE = 0.30;

/** Piso de retenção da plataforma, derivado do teto acima. */
export const MIN_PLATFORM_RETENTION = 1 - MAX_MARGIN_SHARE;

export function resolveTier(activeReferrals: number): PartnerTier {
  let current = PARTNER_TIERS[0];
  for (const tier of PARTNER_TIERS) {
    if (activeReferrals >= tier.minActiveReferrals) current = tier;
  }
  return current;
}

export function nextTier(activeReferrals: number): PartnerTier | null {
  return PARTNER_TIERS.find((t) => activeReferrals < t.minActiveReferrals) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Premissas econômicas (fonte: aba "Premissas" da planilha de 5 anos)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScenarioAssumptions {
  /** Comissão própria da plataforma, por lote operado (R$). Política de preço. */
  ownCommissionPerLot: number;
  /** Rebate IB que a CORRETORA paga à plataforma, por lote (R$). Premissa. */
  brokerRebatePerLot: number;
  /** Custo de servir um usuário ativo por mês (R$). Infra. */
  infraCostPerUser: number;
  /** Alíquota efetiva sobre faturamento (Simples Nacional). */
  taxRate: number;
  /** CAC de mídia paga — a alternativa que a indicação substitui (R$). */
  paidCac: number;
}

/**
 * Cenário usado pela UI e pelo cálculo de projeção. Espelha a coluna
 * "Realista" da planilha. Trocar aqui muda simulação e exibição — NUNCA muda
 * comissão já apurada: cada lançamento em `partner_commission_entries` grava
 * a alíquota e a base usadas no momento da apuração (ver migration).
 */
export const REALISTIC_SCENARIO: ScenarioAssumptions = {
  ownCommissionPerLot: 40,
  brokerRebatePerLot: 35,
  infraCostPerUser: 27,
  taxRate: 0.10,
  paidCac: 110,
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Apuração de um indicado em um mês
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferralMonthlyActivity {
  /** Lotes operados pelo indicado no período (conta real, não demo). */
  lotsTraded: number;
  /** Mensalidade efetivamente paga pelo indicado no período (R$). */
  subscriptionPaid: number;
  /** Receita líquida de marketplace atribuída ao indicado no período (R$). */
  marketplaceNet: number;
}

export interface CommissionBreakdown {
  /** Receita de execução: comissão própria + rebate IB sobre os lotes. */
  executionRevenue: number;
  subscriptionRevenue: number;
  marketplaceRevenue: number;
  grossRevenue: number;
  tax: number;
  infraCost: number;
  /** Base de cálculo: margem de contribuição. Nunca negativa. */
  marginBase: number;
  /** Margem bruta antes do piso em zero — negativa quando o indicado dá prejuízo. */
  rawMargin: number;
  tierId: PartnerTierId;
  marginShare: number;
  /** O que o parceiro recebe (R$). */
  partnerCommission: number;
  /** O que sobra para a plataforma (R$). */
  platformNet: number;
  /** Equivalente em R$/lote — é o número que o parceiro compara com o mercado. */
  equivalentPerLot: number | null;
}

/**
 * Apura a comissão de UM indicado em UM período. É a única função que decide
 * quanto sai de dinheiro; tudo o mais na tela é apresentação disso.
 */
export function computeCommission(
  activity: ReferralMonthlyActivity,
  tier: PartnerTier,
  assumptions: ScenarioAssumptions = REALISTIC_SCENARIO,
): CommissionBreakdown {
  const lots = Math.max(0, activity.lotsTraded);
  const executionRevenue = lots * (assumptions.ownCommissionPerLot + assumptions.brokerRebatePerLot);
  const subscriptionRevenue = Math.max(0, activity.subscriptionPaid);
  const marketplaceRevenue = Math.max(0, activity.marketplaceNet);
  const grossRevenue = executionRevenue + subscriptionRevenue + marketplaceRevenue;

  const tax = grossRevenue * assumptions.taxRate;
  const infraCost = assumptions.infraCostPerUser;
  const rawMargin = grossRevenue - tax - infraCost;

  // TRAVA: indicado que não cobre o próprio custo de operação não gera
  // comissão. Sem isto, um cadastro grátis inativo custaria infra + comissão.
  const marginBase = Math.max(0, rawMargin);

  const partnerCommission = marginBase * tier.marginShare;
  const platformNet = rawMargin - partnerCommission;

  return {
    executionRevenue,
    subscriptionRevenue,
    marketplaceRevenue,
    grossRevenue,
    tax,
    infraCost,
    marginBase,
    rawMargin,
    tierId: tier.id,
    marginShare: tier.marginShare,
    partnerCommission,
    platformNet,
    equivalentPerLot: lots > 0 ? partnerCommission / lots : null,
  };
}

/** Soma de várias apurações — o total do painel do parceiro. */
export function sumBreakdowns(items: readonly CommissionBreakdown[]): Omit<CommissionBreakdown, 'tierId' | 'marginShare'> {
  const zero = {
    executionRevenue: 0, subscriptionRevenue: 0, marketplaceRevenue: 0, grossRevenue: 0,
    tax: 0, infraCost: 0, marginBase: 0, rawMargin: 0, partnerCommission: 0, platformNet: 0,
  };
  const totals = items.reduce((acc, item) => ({
    executionRevenue: acc.executionRevenue + item.executionRevenue,
    subscriptionRevenue: acc.subscriptionRevenue + item.subscriptionRevenue,
    marketplaceRevenue: acc.marketplaceRevenue + item.marketplaceRevenue,
    grossRevenue: acc.grossRevenue + item.grossRevenue,
    tax: acc.tax + item.tax,
    infraCost: acc.infraCost + item.infraCost,
    marginBase: acc.marginBase + item.marginBase,
    rawMargin: acc.rawMargin + item.rawMargin,
    partnerCommission: acc.partnerCommission + item.partnerCommission,
    platformNet: acc.platformNet + item.platformNet,
  }), zero);

  const totalLots = items.reduce(
    (acc, i) => acc + (i.equivalentPerLot !== null && i.equivalentPerLot !== 0 ? i.partnerCommission / i.equivalentPerLot : 0),
    0,
  );

  return { ...totals, equivalentPerLot: totalLots > 0 ? totals.partnerCommission / totalLots : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Simulador de ganhos (projeção declarada — NÃO é dado realizado)
// ─────────────────────────────────────────────────────────────────────────────

export interface EarningsProjectionInput {
  /** Quantos indicados ativos o parceiro imagina ter. */
  referrals: number;
  /** Quantos deles são assinantes pagantes (o resto opera no tier grátis). */
  payingShare: number;
  /** Lotes/mês por indicado pagante. */
  lotsPerPayingReferral: number;
  /** Lotes/mês por indicado no tier grátis. */
  lotsPerFreeReferral: number;
  /** Mensalidade média dos pagantes (R$). */
  averageSubscription: number;
}

export interface EarningsProjection {
  tier: PartnerTier;
  monthlyCommission: number;
  yearlyCommission: number;
  platformNet: number;
  /** Fatia da margem total que foi para o parceiro — a trava, visível. */
  effectiveShareOfMargin: number;
  perPaying: CommissionBreakdown;
  perFree: CommissionBreakdown;
}

export function projectEarnings(
  input: EarningsProjectionInput,
  assumptions: ScenarioAssumptions = REALISTIC_SCENARIO,
): EarningsProjection {
  const referrals = Math.max(0, Math.floor(input.referrals));
  const paying = Math.round(referrals * Math.min(1, Math.max(0, input.payingShare)));
  const free = referrals - paying;
  const tier = resolveTier(referrals);

  const perPaying = computeCommission(
    { lotsTraded: input.lotsPerPayingReferral, subscriptionPaid: input.averageSubscription, marketplaceNet: 7.5 },
    tier,
    assumptions,
  );
  const perFree = computeCommission(
    { lotsTraded: input.lotsPerFreeReferral, subscriptionPaid: 0, marketplaceNet: 0 },
    tier,
    assumptions,
  );

  const monthlyCommission = perPaying.partnerCommission * paying + perFree.partnerCommission * free;
  const platformNet = perPaying.platformNet * paying + perFree.platformNet * free;
  const totalMargin = perPaying.rawMargin * paying + perFree.rawMargin * free;

  return {
    tier,
    monthlyCommission,
    yearlyCommission: monthlyCommission * 12,
    platformNet,
    effectiveShareOfMargin: totalMargin > 0 ? monthlyCommission / totalMargin : 0,
    perPaying,
    perFree,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Regras operacionais do programa (as que protegem o caixa)
// ─────────────────────────────────────────────────────────────────────────────

export const PROGRAM_RULES = {
  /**
   * Dias entre a apuração e a liberação para saque. Existe porque o rebate IB
   * é pago pela corretora com defasagem e pode ser glosado (chargeback,
   * estorno de trade): sem a janela, a plataforma pagaria antes de receber.
   */
  maturityDays: 30,
  /** Saque mínimo (R$) — abaixo disso o custo de transferência come o valor. */
  minPayoutBRL: 100,
  /**
   * Um indicado só conta como ATIVO (e só gera comissão) no mês em que produz
   * margem positiva. Cadastro sem atividade não gera nada — é o que impede
   * fraude de cadastro em massa.
   */
  requiresPositiveMargin: true,
  /**
   * Níveis de profundidade da rede. 1 = apenas indicação direta.
   * MANTER EM 1: remuneração sobre indicação-de-indicação é o elemento que
   * caracteriza marketing multinível, com risco regulatório real no Brasil
   * (Lei 1.521/51 art. 2º IX e enquadramento de pirâmide quando a remuneração
   * vem do recrutamento e não do consumo). Ver doc da sessão.
   */
  networkDepth: 1,
  /** Autoindicação é bloqueada por CPF/documento, não por e-mail. */
  selfReferralBlocked: true,
} as const;

/**
 * Invariante do programa, exposta como função para o gate de validação e para
 * qualquer código que apure pagamento: a comissão NUNCA pode exceder a margem
 * gerada, e a plataforma NUNCA pode reter menos que `MIN_PLATFORM_RETENTION`.
 */
export function assertProgramSolvency(breakdown: CommissionBreakdown): { ok: boolean; reason?: string } {
  if (breakdown.partnerCommission < 0) return { ok: false, reason: 'comissão negativa' };
  if (breakdown.partnerCommission > breakdown.marginBase + 1e-9) {
    return { ok: false, reason: 'comissão maior que a margem gerada pelo indicado' };
  }
  if (breakdown.marginBase > 0) {
    const retention = (breakdown.marginBase - breakdown.partnerCommission) / breakdown.marginBase;
    if (retention < MIN_PLATFORM_RETENTION - 1e-9) {
      return { ok: false, reason: `retenção da plataforma abaixo do piso (${(retention * 100).toFixed(1)}%)` };
    }
  }
  return { ok: true };
}
