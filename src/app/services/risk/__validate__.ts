/**
 * Validação determinística do gate de viabilidade por custo (Componente 1 do
 * cérebro de execução, `research/AI_BRAIN_SPEC.md` seção 14.3/14.5). Reproduz
 * a coluna "Viável?" da tabela 14.3 a partir dos números medidos/extrapolados
 * naquela sessão, para travar o comportamento do gate contra regressão.
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__.ts --bundle --platform=node --outfile=/tmp/validate-risk.js && node /tmp/validate-risk.js
 */
import {
  evaluateCostViability,
  evaluateCostViabilityForBTCUSDT,
  LEGACY_CRYPTO_ROUND_TRIP_COST_PERCENT,
} from './CostViabilityGate';
import { CRYPTO_CFD_ROUND_TRIP_COST_PERCENT, estimateCostPercent } from '../../../../research/CostModel';

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

// ─── Calibração dos limiares: reproduz a tabela 14.3 com o custo LEGADO ─────
// Os 0,26% foram medidos depois como ~18x altos (correção 2026-08-02), mas estas
// asserções continuam valendo pelo que de fato travam: que os limiares 7%/12%
// classificam as razões custo/movimento da tabela 14.3 exatamente como aquela
// coluna "Viável?". É teste do MAPEAMENTO, não do custo.
{
  const legacy = LEGACY_CRYPTO_ROUND_TRIP_COST_PERCENT;

  const r15m = evaluateCostViabilityForBTCUSDT('15m', legacy);
  assertTrue('[legado 0,26%] 15m: custo 25% do movimento (1,05%) -> INVIAVEL, reprovado', r15m.classification === 'INVIAVEL' && r15m.approved === false);
  assertTrue('15m: fonte do movimento é MEDIDO', r15m.movementSource === 'MEDIDO');

  const r1h = evaluateCostViabilityForBTCUSDT('1h', legacy);
  assertTrue('[legado 0,26%] 1h: custo 10% do movimento (2,52%) -> FRONTEIRA, reprovado por padrão', r1h.classification === 'FRONTEIRA' && r1h.approved === false);
  assertTrue('1h: fonte do movimento é MEDIDO', r1h.movementSource === 'MEDIDO');

  const r4h = evaluateCostViabilityForBTCUSDT('4h', legacy);
  assertTrue('[legado 0,26%] 4h: custo ~5% do movimento (~5%) -> VIAVEL, aprovado', r4h.classification === 'VIAVEL' && r4h.approved === true);
  assertTrue('4h: fonte do movimento é EXTRAPOLADO (não medida)', r4h.movementSource === 'EXTRAPOLADO');

  const r1d = evaluateCostViabilityForBTCUSDT('1d', legacy);
  assertTrue('[legado 0,26%] 1d: custo ~2% do movimento (~12%) -> VIAVEL, aprovado', r1d.classification === 'VIAVEL' && r1d.approved === true);
  assertTrue('1d: fonte do movimento é EXTRAPOLADO (não medida)', r1d.movementSource === 'EXTRAPOLADO');
}

// ─── Custo de cripto CFD corrigido (2026-08-02) ─────────────────────────────
// Trava o número em si (contra regressão silenciosa pro valor de exchange spot)
// e registra, em teste, a MUDANÇA DE COMPORTAMENTO que a correção provoca.
{
  const c = CRYPTO_CFD_ROUND_TRIP_COST_PERCENT;

  assertTrue(
    `custo round-trip de cripto CFD é 0,0291% (medido: spread Pepperstone + provisão de slippage) — veio ${c.toFixed(4)}%`,
    Math.abs(c - 0.0291) < 0.0001,
  );
  assertTrue(
    'custo corrigido é ~8,9x menor que o legado de 0,26% (fator medido no HANDOFF: ~18x sobre o spread puro)',
    Math.abs(LEGACY_CRYPTO_ROUND_TRIP_COST_PERCENT / c - 8.94) < 0.05,
  );
  assertTrue(
    'CostModel.estimateCostPercent(CRYPTO) ignora priceLevel/pointValue (custo é % direto do notional) — trava o bug da seção 11.13',
    estimateCostPercent('CRYPTO', 0.073, 1) === estimateCostPercent('CRYPTO', 108_829.77, 1),
  );
  assertTrue(
    'CostModel.estimateCostPercent(CRYPTO)*2 bate com a constante round-trip exportada',
    Math.abs(estimateCostPercent('CRYPTO', 1, 1) * 2 * 100 - c) < 1e-9,
  );

  // Consequência real, registrada de propósito: com o custo certo, nenhum dos 4
  // timeframes de BTCUSDT é mais reprovado por custo. O gate deixa de morder em
  // cripto intradiário — passa a morder só em regime muito parado.
  for (const tf of ['15m', '1h', '4h', '1d'] as const) {
    const r = evaluateCostViabilityForBTCUSDT(tf);
    assertTrue(
      `[corrigido] ${tf}: custo consome ${(r.costAsPercentOfMovement * 100).toFixed(1)}% do movimento -> VIAVEL, aprovado`,
      r.classification === 'VIAVEL' && r.approved === true,
    );
  }

  // O gate NÃO fica vacuoso: forex major não teve custo alterado e segue reprovando
  // 15m (ATR ~4 pips em EURUSD ≈ 0,037% do preço vs. 0,0129% de custo round-trip).
  const eurusdRoundTrip = estimateCostPercent('FOREX_MAJOR', 1.085, 0.0001) * 2 * 100;
  const eurusd15mAtrPercent = (0.0004 / 1.085) * 100;
  assertTrue(
    `forex major inalterado: round-trip ${eurusdRoundTrip.toFixed(4)}% ≈ 1,4 pip (bate com a medição Pepperstone do gates.mjs)`,
    Math.abs(eurusdRoundTrip - 0.0129) < 0.0005,
  );
  assertTrue(
    'gate continua reprovando EURUSD 15m — a correção é específica de cripto, não afrouxa o gate inteiro',
    evaluateCostViability(eurusdRoundTrip, eurusd15mAtrPercent).approved === false,
  );

  // Limite onde o gate volta a morder em cripto: razão 7% -> ATR de 0,416% do preço.
  const atrLimiar = CRYPTO_CFD_ROUND_TRIP_COST_PERCENT / 0.07;
  assertTrue(
    `cripto: gate reprova de novo abaixo de ATR ${atrLimiar.toFixed(3)}% do preço (regime parado)`,
    evaluateCostViability(c, atrLimiar * 0.99).approved === false && evaluateCostViability(c, atrLimiar * 1.01).approved === true,
  );
}

// ─── Casos de borda da função pura ──────────────────────────────────────────
{
  assertTrue('movimento zero -> INVIAVEL (custo infinitamente maior que o movimento)', evaluateCostViability(0.1, 0).classification === 'INVIAVEL');
  assertTrue('custo zero, movimento positivo -> VIAVEL (razão zero)', evaluateCostViability(0, 1).classification === 'VIAVEL');

  let threw = false;
  try { evaluateCostViability(-1, 1); } catch { threw = true; }
  assertTrue('custo negativo lança erro em vez de aprovar silenciosamente', threw);

  // Limiares exatos: 7% e 12% são os limites declarados no módulo.
  assertTrue('razão exatamente 7% -> VIAVEL (limite inclusive)', evaluateCostViability(7, 100).classification === 'VIAVEL');
  assertTrue('razão exatamente 12% -> FRONTEIRA (limite inclusive)', evaluateCostViability(12, 100).classification === 'FRONTEIRA');
  assertTrue('razão 12,01% -> INVIAVEL', evaluateCostViability(12.01, 100).classification === 'INVIAVEL');
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
