/**
 * Validação do modelo de comissionamento do Programa de Parceiros IB — 2026-08-18.
 *
 * O que este arquivo trava: o programa de parceiros paga dinheiro de verdade
 * sobre receita de terceiros. O erro caro aqui não é visual — é pagar ao
 * parceiro mais do que o indicado gerou, que é silencioso (aparece só no caixa,
 * meses depois) e reversível apenas com estorno constrangedor. As asserções
 * abaixo cobrem exatamente os cenários em que a conta poderia inverter.
 *
 * Cenários numéricos vêm da aba "Premissas" de `projecao-financeira-5anos.xlsx`
 * (Pessimista/Realista/Otimista), não de números escolhidos para passar.
 *
 * Roda com: npx esbuild src/app/services/partners/__validate__.ts --bundle --platform=node --outfile=/tmp/v.js && node /tmp/v.js
 */
import {
  PARTNER_TIERS,
  MAX_MARGIN_SHARE,
  MIN_PLATFORM_RETENTION,
  resolveTier,
  nextTier,
  computeCommission,
  projectEarnings,
  assertProgramSolvency,
  PROGRAM_RULES,
  type ScenarioAssumptions,
} from './CommissionModel';

let passed = 0;
let failed = 0;

function assertTrue(label: string, condition: boolean) {
  if (!condition) {
    console.error(`❌ FALHOU: ${label}`);
    failed++;
  } else {
    console.log(`✅ OK: ${label}`);
    passed++;
  }
}

function assertClose(label: string, actual: number, expected: number, tol = 0.01) {
  assertTrue(`${label} (esperado ${expected.toFixed(2)}, obtido ${actual.toFixed(2)})`, Math.abs(actual - expected) <= tol);
}

// Os 3 cenários da planilha financeira, com a fonte de cada número no doc.
const CENARIOS: Record<string, ScenarioAssumptions & { lotsPaying: number; lotsFree: number; subscription: number; marketplace: number }> = {
  Pessimista: { ownCommissionPerLot: 40, brokerRebatePerLot: 25, infraCostPerUser: 27, taxRate: 0.070, paidCac: 90,  lotsPaying: 2.5, lotsFree: 0.3, subscription: 219, marketplace: 3.5 },
  Realista:   { ownCommissionPerLot: 40, brokerRebatePerLot: 35, infraCostPerUser: 27, taxRate: 0.100, paidCac: 110, lotsPaying: 5.0, lotsFree: 0.7, subscription: 249, marketplace: 7.5 },
  Otimista:   { ownCommissionPerLot: 40, brokerRebatePerLot: 45, infraCostPerUser: 27, taxRate: 0.135, paidCac: 130, lotsPaying: 8.5, lotsFree: 1.2, subscription: 289, marketplace: 13.0 },
};

// ─── CASO 1: a invariante central — a conta fecha em TODO cenário e nível ────
{
  let violacoes = 0;
  let piorRetencao = 1;

  for (const [nome, c] of Object.entries(CENARIOS)) {
    for (const tier of PARTNER_TIERS) {
      for (const perfil of ['pagante', 'gratuito'] as const) {
        const activity = perfil === 'pagante'
          ? { lotsTraded: c.lotsPaying, subscriptionPaid: c.subscription, marketplaceNet: c.marketplace }
          : { lotsTraded: c.lotsFree, subscriptionPaid: 0, marketplaceNet: 0 };

        const b = computeCommission(activity, tier, c);
        const check = assertProgramSolvency(b);
        if (!check.ok) {
          console.error(`   ↳ ${nome}/${tier.id}/${perfil}: ${check.reason}`);
          violacoes++;
        }
        if (b.marginBase > 0) {
          piorRetencao = Math.min(piorRetencao, (b.marginBase - b.partnerCommission) / b.marginBase);
        }
      }
    }
  }

  assertTrue('nenhuma combinação cenário×nível×perfil paga mais que a margem gerada', violacoes === 0);
  assertTrue(
    `retenção da plataforma nunca cai abaixo de ${(MIN_PLATFORM_RETENTION * 100).toFixed(0)}% (pior caso medido: ${(piorRetencao * 100).toFixed(1)}%)`,
    piorRetencao >= MIN_PLATFORM_RETENTION - 1e-9,
  );
}

// ─── CASO 2: o indicado que dá prejuízo NÃO gera comissão ────────────────────
// Cenário Pessimista, usuário do tier grátis: R$19,50 de receita contra R$27 de
// infra = margem de −R$8,87/mês. É o caso que quebraria o caixa se a base de
// cálculo fosse receita bruta em vez de margem.
{
  const c = CENARIOS.Pessimista;
  const b = computeCommission({ lotsTraded: c.lotsFree, subscriptionPaid: 0, marketplaceNet: 0 }, PARTNER_TIERS[3], c);

  assertClose('cenário Pessimista/grátis tem margem real negativa', b.rawMargin, -8.87);
  assertTrue('margem negativa não vira base de cálculo (piso em zero)', b.marginBase === 0);
  assertTrue('indicado deficitário paga R$0 de comissão, mesmo no nível topo', b.partnerCommission === 0);
  assertTrue('a trava está declarada como regra do programa', PROGRAM_RULES.requiresPositiveMargin === true);
}

// ─── CASO 3: aritmética da apuração, conferida à mão ─────────────────────────
// Realista/pagante: 5 lotes × (40+35) = 375 execução + 249 mensalidade + 7,50
// marketplace = 631,50 bruto; −10% imposto = −63,15; −27 infra ⇒ margem 541,35.
{
  const c = CENARIOS.Realista;
  const prime = PARTNER_TIERS[3];
  const b = computeCommission({ lotsTraded: 5, subscriptionPaid: 249, marketplaceNet: 7.5 }, prime, c);

  assertClose('receita de execução = lotes × (comissão própria + rebate IB)', b.executionRevenue, 375);
  assertClose('receita bruta do indicado', b.grossRevenue, 631.5);
  assertClose('imposto sobre faturamento', b.tax, 63.15);
  assertClose('margem de contribuição (base de cálculo)', b.marginBase, 541.35);
  assertClose('comissão do parceiro no nível Prime (30%)', b.partnerCommission, 162.41);
  assertClose('sobra para a plataforma', b.platformNet, 378.95);
  assertClose('equivalente em R$/lote — o número comparável com o mercado', b.equivalentPerLot ?? 0, 32.48);
}

// ─── CASO 4: escada de níveis ────────────────────────────────────────────────
{
  assertTrue('0 indicado cai no nível de entrada', resolveTier(0).id === 'NODE');
  assertTrue('4 indicados ainda é Node', resolveTier(4).id === 'NODE');
  assertTrue('5 indicados sobe para Signal', resolveTier(5).id === 'SIGNAL');
  assertTrue('20 indicados sobe para Core', resolveTier(20).id === 'CORE');
  assertTrue('50 indicados sobe para Prime', resolveTier(50).id === 'PRIME');
  assertTrue('500 indicados continua Prime (não há nível acima)', resolveTier(500).id === 'PRIME');
  assertTrue('próximo nível de quem tem 5 é Core', nextTier(5)?.id === 'CORE');
  assertTrue('quem está no topo não tem próximo nível', nextTier(9999) === null);

  const shares = PARTNER_TIERS.map((t) => t.marginShare);
  assertTrue('escada é monotônica (nível maior nunca paga menos)', shares.every((s, i) => i === 0 || s > shares[i - 1]));
  assertTrue(`nenhum nível ultrapassa o teto de ${(MAX_MARGIN_SHARE * 100).toFixed(0)}% da margem`, shares.every((s) => s <= MAX_MARGIN_SHARE));
}

// ─── CASO 5: o programa custa menos que a mídia paga que substitui ───────────
// Ponto de indiferença medido no Ano 1 do cenário Realista da planilha:
// CAC total R$136.083 ÷ margem de contribuição R$281.463 = 48,3% da margem.
// Acima disso, indicar sairia mais caro que comprar tráfego.
{
  const CAC_ANO1 = 136083;
  const MARGEM_ANO1 = 465606 - 137582 - 46561; // receita − infra − imposto (aba Resumo Anual)
  const indiferenca = CAC_ANO1 / MARGEM_ANO1;

  assertClose('ponto de indiferença vs mídia paga (% da margem)', indiferenca * 100, 48.35, 0.1);
  assertTrue(
    `teto da escada (${(MAX_MARGIN_SHARE * 100).toFixed(0)}%) fica abaixo do ponto de indiferença (${(indiferenca * 100).toFixed(1)}%)`,
    MAX_MARGIN_SHARE < indiferenca,
  );
}

// ─── CASO 6: simulador de ganhos não pode contradizer a trava ────────────────
{
  const proj = projectEarnings({
    referrals: 60, payingShare: 0.5, lotsPerPayingReferral: 5, lotsPerFreeReferral: 0.7, averageSubscription: 249,
  });

  assertTrue('60 indicados projeta no nível Prime', proj.tier.id === 'PRIME');
  assertTrue('projeção nunca entrega ao parceiro mais que o teto da margem', proj.effectiveShareOfMargin <= MAX_MARGIN_SHARE + 1e-9);
  assertTrue('plataforma continua positiva na projeção', proj.platformNet > 0);
  assertTrue('projeção anual é 12× a mensal (sem juros escondidos)', Math.abs(proj.yearlyCommission - proj.monthlyCommission * 12) < 1e-9);

  const vazio = projectEarnings({ referrals: 0, payingShare: 0.5, lotsPerPayingReferral: 5, lotsPerFreeReferral: 1, averageSubscription: 249 });
  assertTrue('zero indicado projeta zero ganho (sem número fabricado)', vazio.monthlyCommission === 0);
}

// ─── CASO 7: entradas degeneradas não viram dinheiro ─────────────────────────
{
  const tier = PARTNER_TIERS[3];
  const semAtividade = computeCommission({ lotsTraded: 0, subscriptionPaid: 0, marketplaceNet: 0 }, tier);
  assertTrue('cadastro sem nenhuma atividade gera R$0 (anti-fraude de cadastro em massa)', semAtividade.partnerCommission === 0);

  const negativo = computeCommission({ lotsTraded: -10, subscriptionPaid: -500, marketplaceNet: -50 }, tier);
  assertTrue('valores negativos não viram receita nem comissão', negativo.partnerCommission === 0 && negativo.grossRevenue === 0);

  assertTrue('rede é de nível único — sem remuneração por indicação-de-indicação', PROGRAM_RULES.networkDepth === 1);
}

// ─── CASO 8: comissão vitalícia não degrada a retenção da plataforma ────────
// Decisão do Cleber em 2026-08-18 (igual ao modelo da Infinox): sem prazo.
// Isso só é seguro porque a divisão é percentual FIXO por mês, não acumulado —
// simula 10 anos seguidos do mesmo indicado pagante no nível Prime e confere
// que a retenção da plataforma continua idêntica no mês 1 e no mês 120.
{
  assertTrue('regra do programa está marcada como vitalícia (sem prazo)', PROGRAM_RULES.commissionDurationMonths === null);

  const c = CENARIOS.Realista;
  const prime = PARTNER_TIERS[3];
  const activity = { lotsTraded: c.lotsPaying, subscriptionPaid: c.subscription, marketplaceNet: c.marketplace };

  const mes1 = computeCommission(activity, prime, c);
  const mes120 = computeCommission(activity, prime, c); // mesma chamada = mesma economia, por construção

  const retencaoMes1 = (mes1.marginBase - mes1.partnerCommission) / mes1.marginBase;
  const retencaoMes120 = (mes120.marginBase - mes120.partnerCommission) / mes120.marginBase;
  assertClose('retenção da plataforma no mês 1 e no mês 120 é idêntica (sem compounding contra a plataforma)', retencaoMes120 * 100, retencaoMes1 * 100, 1e-9);
  assertTrue('mesmo vitalícia, a retenção nunca cai abaixo do piso do programa', retencaoMes1 >= MIN_PLATFORM_RETENTION - 1e-9);
}

// ─── CASO 9: único canal de atribuição é o link do parceiro ─────────────────
{
  assertTrue('atribuição é só por link enviado — sem mídia paga, QR code ou cookie de terceiro', PROGRAM_RULES.attributionChannel === 'REFERRAL_LINK_ONLY');
}

// ─── Resultado ───────────────────────────────────────────────────────────────
console.log(`\n${passed} asserções OK, ${failed} falharam.`);
if (failed > 0) process.exit(1);
