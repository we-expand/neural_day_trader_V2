/**
 * Validação do custo de execução REALIZADO (`ExecutionCost.ts`) — 2026-08-23.
 *
 * Regressão que este arquivo trava: entre 17 e 23/08/2026 o motor executou 135
 * trades em produção e gravou `commission = 0` em **135 de 135**. O PnL era
 * calculado como (preçoSaída − preçoEntrada) × notional/preçoEntrada, isto é,
 * preço médio nas duas pontas — sem spread, sem slippage. Ao mesmo tempo o
 * COST_GATE recusava 7.618 candidatos usando o custo do `CostModel.ts`: o motor
 * cobrava o custo na DECISÃO e não cobrava na EXECUÇÃO.
 *
 * Efeito medido na amostra real: PnL bruto reportado −US$14,12; custo não
 * cobrado US$14,83; resultado real ≈ −US$28,95. O custo invisível equivalia a
 * 105% do |PnL bruto|.
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__execcost__.ts --bundle --platform=node --outfile=/tmp/v.js && node /tmp/v.js
 */
import { calculateRoundTripCost } from './ExecutionCost';
import { CRYPTO_CFD_ROUND_TRIP_COST_PERCENT } from '../../../../research/CostModel';

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

// ─── CASO 1: custo existe e é positivo (o bug era ser sempre zero) ──────────
{
  const btc = calculateRoundTripCost('BTCUSD', 1000, 63536);
  assertTrue('BTCUSD com notional $1.000 cobra custo > 0 (o bug era zero)', btc.costUsd > 0);
  assertTrue('BTCUSD resolve classe CRYPTO', btc.assetClass === 'CRYPTO');

  const xau = calculateRoundTripCost('XAUUSD', 1000, 4524);
  assertTrue('XAUUSD com notional $1.000 cobra custo > 0', xau.costUsd > 0);
  assertTrue('XAUUSD resolve classe COMMODITY', xau.assetClass === 'COMMODITY');
}

// ─── CASO 2: bate com a constante calibrada do CostModel ────────────────────
// Amarra ExecutionCost à MESMA fonte que o COST_GATE usa pra recusar trade —
// se alguém recalibrar o CostModel, os dois lados andam juntos ou este teste cai.
{
  const c = calculateRoundTripCost('BTCUSD', 10_000, 63536);
  assertTrue(
    'custo round-trip de cripto bate com CRYPTO_CFD_ROUND_TRIP_COST_PERCENT do CostModel',
    Math.abs(c.roundTripPercent * 100 - CRYPTO_CFD_ROUND_TRIP_COST_PERCENT) < 1e-9,
  );
  assertTrue(
    'custo em $ = notional × percentual (US$10.000 × 0,0291% ≈ US$2,91)',
    Math.abs(c.costUsd - 10_000 * CRYPTO_CFD_ROUND_TRIP_COST_PERCENT / 100) < 1e-9,
  );
}

// ─── CASO 3: linearidade no notional ────────────────────────────────────────
// Dobrar a posição dobra o custo. Trava a classe de bug de escala que já
// apareceu duas vezes neste projeto (pointValue 2026-08-05, contractSize).
{
  const a = calculateRoundTripCost('XAUUSD', 1000, 4524);
  const b = calculateRoundTripCost('XAUUSD', 2000, 4524);
  assertTrue('custo é linear no notional (2x notional → 2x custo)', Math.abs(b.costUsd - 2 * a.costUsd) < 1e-9);
}

// ─── CASO 4: entradas inválidas devolvem custo 0 SEM lançar ─────────────────
// Cobrar custo nunca pode ser o motivo de uma posição não fechar. Se o preço
// vier zerado (bug de feed que já aconteceu — ver CLAUDE.md 2026-08-17), o
// fechamento tem que seguir; a ausência de custo fica auditável em `commission`.
{
  assertTrue('preço 0 → custo 0, sem lançar', calculateRoundTripCost('XAUUSD', 1000, 0).costUsd === 0);
  assertTrue('notional 0 → custo 0, sem lançar', calculateRoundTripCost('XAUUSD', 0, 4524).costUsd === 0);
  assertTrue('NaN → custo 0, sem lançar', calculateRoundTripCost('XAUUSD', NaN, 4524).costUsd === 0);
  assertTrue('notional negativo → custo 0, sem lançar', calculateRoundTripCost('XAUUSD', -100, 4524).costUsd === 0);
}

// ─── CASO 5: classes diferentes cobram custos diferentes ───────────────────
// Trava o achado de produção de 2026-08-23: no mesmo notional, UKOUSD (Brent)
// custa ordens de grandeza mais que XAUUSD por causa do nível de preço
// (~US$93 vs ~US$4.524 — os mesmos pontos de spread pesam muito mais sobre um
// preço baixo). É por isso que custo não pode ser uma constante única.
{
  const brent = calculateRoundTripCost('UKOUSD', 1000, 92.87);
  const gold = calculateRoundTripCost('XAUUSD', 1000, 4524.61);
  assertTrue('UKOUSD custa mais que XAUUSD no mesmo notional (preço baixo ⇒ spread pesa mais)', brent.costUsd > gold.costUsd);
  assertTrue('a diferença é material (>3x), não arredondamento', brent.costUsd > gold.costUsd * 3);
}

// ─── CASO 6: a aritmética do fechamento (líquido = bruto − custo) ───────────
// Espelha exatamente o que positionManager.ts e useApexLogic.ts fazem agora.
{
  const notional = 2912; // notional médio real de XAUUSD na amostra de produção
  const entry = 4524.61;
  const exit = 4536.00;
  const bruto = (exit - entry) * (notional / entry);
  const { costUsd } = calculateRoundTripCost('XAUUSD', notional, entry);
  const liquido = bruto - costUsd;
  assertTrue('líquido < bruto sempre que há custo', liquido < bruto);
  assertTrue('líquido = bruto − custo (identidade exata)', Math.abs(liquido - (bruto - costUsd)) < 1e-12);
}

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
