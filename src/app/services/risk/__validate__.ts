/**
 * Validação determinística do gate de viabilidade por custo (Componente 1 do
 * cérebro de execução, `research/AI_BRAIN_SPEC.md` seção 14.3/14.5). Reproduz
 * a coluna "Viável?" da tabela 14.3 a partir dos números medidos/extrapolados
 * naquela sessão, para travar o comportamento do gate contra regressão.
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__.ts --bundle --platform=node --outfile=/tmp/validate-risk.js && node /tmp/validate-risk.js
 */
import { evaluateCostViability, evaluateCostViabilityForBTCUSDT } from './CostViabilityGate';

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

// ─── Reproduz a tabela 14.3 (custo round-trip 0,26%, BTCUSDT) ──────────────
{
  const r15m = evaluateCostViabilityForBTCUSDT('15m');
  assertTrue('15m: custo 25% do movimento (1,05%) -> INVIAVEL, reprovado', r15m.classification === 'INVIAVEL' && r15m.approved === false);
  assertTrue('15m: fonte do movimento é MEDIDO', r15m.movementSource === 'MEDIDO');

  const r1h = evaluateCostViabilityForBTCUSDT('1h');
  assertTrue('1h: custo 10% do movimento (2,52%) -> FRONTEIRA, reprovado por padrão', r1h.classification === 'FRONTEIRA' && r1h.approved === false);
  assertTrue('1h: fonte do movimento é MEDIDO', r1h.movementSource === 'MEDIDO');

  const r4h = evaluateCostViabilityForBTCUSDT('4h');
  assertTrue('4h: custo ~5% do movimento (~5%) -> VIAVEL, aprovado', r4h.classification === 'VIAVEL' && r4h.approved === true);
  assertTrue('4h: fonte do movimento é EXTRAPOLADO (não medida)', r4h.movementSource === 'EXTRAPOLADO');

  const r1d = evaluateCostViabilityForBTCUSDT('1d');
  assertTrue('1d: custo ~2% do movimento (~12%) -> VIAVEL, aprovado', r1d.classification === 'VIAVEL' && r1d.approved === true);
  assertTrue('1d: fonte do movimento é EXTRAPOLADO (não medida)', r1d.movementSource === 'EXTRAPOLADO');
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
