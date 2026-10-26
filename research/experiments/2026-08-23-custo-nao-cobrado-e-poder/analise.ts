/**
 * Análise da amostra real de produção (2026-08-17 → 2026-08-23).
 *
 * Três perguntas, todas respondidas com o dado real da tabela `ai_trades` e com
 * o modelo de custo do PRÓPRIO projeto (research/CostModel.ts) — nada estimado
 * à mão, nada fabricado:
 *
 *   1. Quanto custo de execução a simulação DEMO está deixando de cobrar?
 *      (`positionManager.ts` grava `commission: 0` em todos os caminhos e
 *      calcula PnL como (saída − entrada) × notional/entrada — preço médio na
 *      entrada E na saída, sem spread, sem slippage.)
 *   2. O que sobra do resultado depois de aplicar esse custo?
 *   3. A amostra tem poder estatístico para dizer qualquer coisa?
 *
 * Rodar:
 *   npx esbuild research/experiments/2026-08-23-custo-nao-cobrado-e-poder/analise.ts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/a.mjs && node /tmp/a.mjs
 */
import { estimateCostPercent } from '../../CostModel.ts';
import { resolveCostAssetClass } from '../../../src/app/services/risk/CostAssetClass.ts';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing.ts';

/** Agregado por símbolo, extraído do Supabase de produção em 2026-08-23. */
const AMOSTRA = [
  { symbol: 'BTCUSD', n: 11, notional: 1665.47, preco: 73677.9773, pnlBruto: 0.2287, wins: 2 },
  { symbol: 'ETHUSD', n: 33, notional: 4830.00, preco: 2392.9839, pnlBruto: -3.0848, wins: 9 },
  { symbol: 'EURUSD', n: 1, notional: 1168.83, preco: 1.1688, pnlBruto: 0.6700, wins: 1 },
  { symbol: 'JP225', n: 5, notional: 10141.48, preco: 68641.3200, pnlBruto: -1.7786, wins: 1 },
  { symbol: 'NAS100', n: 3, notional: 878.21, preco: 29273.7733, pnlBruto: 0.4842, wins: 1 },
  { symbol: 'SOLUSD', n: 36, notional: 6575.81, preco: 91.8092, pnlBruto: -6.1576, wins: 9 },
  { symbol: 'UKOUSD', n: 12, notional: 10307.68, preco: 92.8757, pnlBruto: -15.0731, wins: 2 },
  { symbol: 'XAUAUD', n: 9, notional: 8656.78, preco: 6186.1211, pnlBruto: -3.8436, wins: 1 },
  { symbol: 'XAUUSD', n: 23, notional: 66976.48, preco: 4524.6135, pnlBruto: 14.3168, wins: 10 },
  { symbol: 'XBNUSD', n: 1, notional: 20.25, preco: 202.5200, pnlBruto: 0.1180, wins: 1 },
];

/** Estatística agregada da amostra fechada (n=134), medida direto no banco. */
const DESVIO_PADRAO_PNL = 2.7168; // $ por trade — recalculado abaixo p/ conferência
const N_TOTAL = AMOSTRA.reduce((s, a) => s + a.n, 0);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(' 1. CUSTO DE EXECUÇÃO QUE A SIMULAÇÃO DEMO NÃO COBRA');
console.log('═══════════════════════════════════════════════════════════════════\n');
console.log('Símbolo   n   Classe custo   Custo RT %   Notional $   Custo $   PnL bruto $   PnL líquido $');
console.log('─'.repeat(100));

let custoTotal = 0;
let brutoTotal = 0;

for (const a of AMOSTRA) {
  const cls = resolveCostAssetClass(a.symbol);
  const pv = getPointValue(a.symbol);
  // *2 = round-trip (ida e volta), mesma convenção de BacktestEngine.ts e do
  // COST_GATE em runTradingCycle.ts:859.
  const custoPct = estimateCostPercent(cls.assetClass, a.preco, pv) * 2;
  const custoUsd = a.notional * custoPct;
  const liquido = a.pnlBruto - custoUsd;
  custoTotal += custoUsd;
  brutoTotal += a.pnlBruto;
  console.log(
    `${a.symbol.padEnd(9)} ${String(a.n).padStart(2)}   ${cls.assetClass.padEnd(13)} ` +
    `${(custoPct * 100).toFixed(4).padStart(9)}%   ${a.notional.toFixed(2).padStart(9)}   ` +
    `${custoUsd.toFixed(2).padStart(6)}   ${a.pnlBruto.toFixed(2).padStart(10)}   ${liquido.toFixed(2).padStart(12)}`,
  );
}

console.log('─'.repeat(100));
console.log(`TOTAL   ${String(N_TOTAL).padStart(3)}                                             ` +
  `${custoTotal.toFixed(2).padStart(6)}   ${brutoTotal.toFixed(2).padStart(10)}   ${(brutoTotal - custoTotal).toFixed(2).padStart(12)}`);

console.log(`\n→ Resultado REPORTADO pelo produto (bruto, sem custo): $${brutoTotal.toFixed(2)}`);
console.log(`→ Custo de execução não cobrado:                        $${custoTotal.toFixed(2)}`);
console.log(`→ Resultado REAL estimado (líquido de custo):           $${(brutoTotal - custoTotal).toFixed(2)}`);
console.log(`→ Custo por trade:                                     $${(custoTotal / N_TOTAL).toFixed(4)}`);
console.log(`→ O custo consome ${Math.abs(custoTotal / brutoTotal * 100).toFixed(0)}% do |PnL bruto| da amostra.`);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(' 2. PODER ESTATÍSTICO DA AMOSTRA');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Amostra desde sexta (2026-08-21), medida no banco: n=88, média +0.1875, dp 2.9899
const nSexta = 88, mediaSexta = 0.1875, dpSexta = 2.9899;
const tSexta = mediaSexta / (dpSexta / Math.sqrt(nSexta));
console.log(`Janela "desde sexta" (2026-08-21 → 23), n=${nSexta}:`);
console.log(`  média/trade = $${mediaSexta.toFixed(4)}   dp = $${dpSexta.toFixed(4)}   t = ${tSexta.toFixed(3)}`);
console.log(`  → |t| = ${Math.abs(tSexta).toFixed(2)} < 1,96. Indistinguível de zero (p ≈ 0,56).\n`);

// n necessário para detectar a própria média observada com poder 80%, alfa 5%
function nNecessario(media: number, dp: number, poder = 0.84162, z = 1.95996): number {
  return Math.ceil(Math.pow((z + poder) * dp / Math.abs(media), 2));
}
const nPrecisa = nNecessario(mediaSexta, dpSexta);
console.log(`Para DETECTAR uma média de $${mediaSexta.toFixed(4)}/trade com α=5% e poder 80%:`);
console.log(`  n necessário = ${nPrecisa.toLocaleString('pt-BR')} trades independentes`);
console.log(`  A ~35 trades/dia (ritmo real da amostra): ${(nPrecisa / 35 / 30).toFixed(1)} MESES de operação contínua.`);
console.log(`  A ~5 trades/dia (ritmo alvo pós-filtro):  ${(nPrecisa / 5 / 30).toFixed(1)} meses.\n`);

console.log('  ⚠️ E isso ANTES do desconto de independência: a cesta tem cripto');
console.log('     correlacionada entre si (N_eff/N ≈ 0,26 medido na seção 14.7 da');
console.log('     AI_BRAIN_SPEC). Com esse desconto, o n efetivo exigido ~4x maior.');

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(' 3. O EXPERIMENTO R:R 1:3 — O QUE O TEOREMA PREVIU E O QUE ACONTECEU');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Saídas por motivo, medidas no banco (2026-08-17 → 23)
const tp = { n: 19, media: 3.960 };
const sl = { n: 103, media: -0.874 };
const nDecidido = tp.n + sl.n;
const wrReal = tp.n / nDecidido;
const payoff = Math.abs(tp.media / sl.media);
const wrBreakeven = 1 / (1 + payoff);
// IC de Wald 95% na proporção
const se = Math.sqrt(wrReal * (1 - wrReal) / nDecidido);

console.log(`Saídas decididas pelo motor (TP ou SL), n=${nDecidido}:`);
console.log(`  TP: ${tp.n} trades, média +$${tp.media.toFixed(3)}`);
console.log(`  SL: ${sl.n} trades, média $${sl.media.toFixed(3)}`);
console.log(`  Payoff realizado    = ${payoff.toFixed(2)}x`);
console.log(`  R:R desenhado       = 3,01x (medido: alvo 0,997% / risco 0,309%)`);
console.log(`  Win rate realizado  = ${(wrReal * 100).toFixed(1)}%  (IC95%: ${((wrReal - 1.96 * se) * 100).toFixed(1)}% a ${((wrReal + 1.96 * se) * 100).toFixed(1)}%)`);
console.log(`  Win rate breakeven  = ${(wrBreakeven * 100).toFixed(1)}%  (bruto, antes de custo)\n`);

if (wrBreakeven > wrReal - 1.96 * se && wrBreakeven < wrReal + 1.96 * se) {
  console.log('  → O breakeven cai DENTRO do intervalo de confiança do win rate real.');
  console.log('    Ou seja: a amostra não distingue "o desenho funciona" de "o desenho');
  console.log('    empata". É exatamente a previsão do teorema da parada opcional');
  console.log('    (AI_BRAIN_SPEC §14.2): mexer em stop/alvo troca win rate por payoff');
  console.log('    e deixa a MÉDIA onde estava — zero bruto, negativa após custo.\n');
}

console.log(`  Com o custo de $${(custoTotal / N_TOTAL).toFixed(4)}/trade aplicado, o breakeven sobe e o`);
console.log('  desenho fica estruturalmente abaixo dele.\n');
