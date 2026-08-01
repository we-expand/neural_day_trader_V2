/**
 * Validação determinística do ranking mecânico de ativos elegíveis
 * (`AssetEligibilityRanking.ts`).
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__ranking__.ts --bundle --platform=node --outfile=/tmp/validate-ranking.js && node /tmp/validate-ranking.js
 */
import { rankEligibleAssets } from './AssetEligibilityRanking';

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

// ─── Rejeita INVIAVEL e FRONTEIRA, nunca entram no ranking ─────────────────
{
  const { eligible, rejected } = rankEligibleAssets([
    { symbol: 'BTCUSDT-15m', costPercent: 0.26, typicalMovementPercent: 1.05 }, // 25% -> INVIAVEL
    { symbol: 'BTCUSDT-1h', costPercent: 0.26, typicalMovementPercent: 2.52 }, // 10% -> FRONTEIRA
    { symbol: 'BTCUSDT-4h', costPercent: 0.26, typicalMovementPercent: 5 }, // ~5% -> VIAVEL
  ]);
  assertTrue('só o ativo VIAVEL entra em eligible', eligible.length === 1 && eligible[0].symbol === 'BTCUSDT-4h');
  assertTrue('INVIAVEL e FRONTEIRA vão pra rejected, com motivo', rejected.length === 2 && rejected.every(r => r.reason.length > 0));
}

// ─── Ordena por menor fração de custo sobre movimento, não por movimento bruto
{
  const { eligible } = rankEligibleAssets([
    { symbol: 'A', costPercent: 0.10, typicalMovementPercent: 5 }, // 2%
    { symbol: 'B', costPercent: 0.10, typicalMovementPercent: 2 }, // 5%
    { symbol: 'C', costPercent: 0.05, typicalMovementPercent: 10 }, // 0.5%
  ]);
  assertTrue('3 candidatos, todos VIAVEL', eligible.length === 3);
  assertTrue('ordem correta por custoAsPercentOfMovement ascendente: C, A, B', eligible.map(e => e.symbol).join(',') === 'C,A,B');
  assertTrue('rank atribuído 1..N na ordem final', eligible[0].rank === 1 && eligible[1].rank === 2 && eligible[2].rank === 3);
}

// ─── Lista vazia não quebra ─────────────────────────────────────────────────
{
  const { eligible, rejected } = rankEligibleAssets([]);
  assertTrue('lista vazia -> eligible vazio', eligible.length === 0);
  assertTrue('lista vazia -> rejected vazio', rejected.length === 0);
}

// ─── Todos inviáveis -> eligible vazio, nada fabricado como "menos pior" ───
{
  const { eligible, rejected } = rankEligibleAssets([
    { symbol: 'X', costPercent: 1, typicalMovementPercent: 1 }, // 100% -> INVIAVEL
    { symbol: 'Y', costPercent: 0.9, typicalMovementPercent: 1 }, // 90% -> INVIAVEL
  ]);
  assertTrue('todos inviáveis -> eligible vazio', eligible.length === 0);
  assertTrue('todos inviáveis -> ambos em rejected', rejected.length === 2);
}

console.log(`\n${passed} passaram, ${failed} falharam.\n`);
if (failed > 0) {
  process.exit(1);
}
