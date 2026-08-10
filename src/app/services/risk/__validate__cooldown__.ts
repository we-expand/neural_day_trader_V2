/**
 * Validação determinística do cooldown pós-perdas-consecutivas e do limite
 * rígido de trades/dia (TAREFA 3, `research/RISK_MODULE_SPEC.md` seção
 * 3.3/3.4) — funções puras em `src/lib/modules/RiskManager.ts`.
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__cooldown__.ts --bundle --platform=node --outfile=/tmp/validate-cooldown.js && node /tmp/validate-cooldown.js
 */
import { evaluateCooldownGate, evaluateMaxTradesPerDayGate } from '../../../lib/modules/RiskManager';

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

// ─── evaluateCooldownGate ───────────────────────────────────────────────────
{
  const config = { cooldownEnabled: true, consecutiveLossesTrigger: 3, cooldownMinutes: 60 };

  const disabled = evaluateCooldownGate(5, 1000, 0, { ...config, cooldownEnabled: false });
  assertTrue('cooldownEnabled=false -> nunca bloqueia, mesmo com muitas perdas', disabled.blocked === false);

  const belowTrigger = evaluateCooldownGate(2, 1000, 0, config);
  assertTrue('2 perdas seguidas, gatilho=3 -> não bloqueia', belowTrigger.blocked === false);

  const atTrigger = evaluateCooldownGate(3, 1000, 0, config);
  assertTrue('3 perdas seguidas, gatilho=3 -> bloqueia e ATIVA cooldown novo', atTrigger.blocked === true && atTrigger.newCooldownUntil === 1000 + 60 * 60_000);

  const alreadyActive = evaluateCooldownGate(0, 1000, 5000, config);
  assertTrue('cooldown já ativo (now < cooldownUntil) -> bloqueia sem precisar de novas perdas', alreadyActive.blocked === true);
  assertTrue('cooldown já ativo -> não retorna newCooldownUntil (não reativa por cima)', alreadyActive.newCooldownUntil === undefined);

  const expired = evaluateCooldownGate(0, 6000, 5000, config);
  assertTrue('cooldown expirado (now >= cooldownUntil) e sem novas perdas -> não bloqueia', expired.blocked === false);

  const exactBoundary = evaluateCooldownGate(0, 5000, 5000, config);
  assertTrue('now === cooldownUntil (limite exato) -> já expirado, não bloqueia por si só', exactBoundary.blocked === false);
}

// ─── evaluateMaxTradesPerDayGate ────────────────────────────────────────────
{
  const zeroLimit = evaluateMaxTradesPerDayGate(999, 0);
  assertTrue('maxTradesPerDay=0 -> sem limite, nunca bloqueia', zeroLimit.blocked === false);

  const belowLimit = evaluateMaxTradesPerDayGate(4, 5);
  assertTrue('4 trades hoje, limite 5 -> não bloqueia', belowLimit.blocked === false);

  const atLimit = evaluateMaxTradesPerDayGate(5, 5);
  assertTrue('5 trades hoje, limite 5 -> bloqueia (limite inclusive)', atLimit.blocked === true);

  const aboveLimit = evaluateMaxTradesPerDayGate(6, 5);
  assertTrue('6 trades hoje, limite 5 -> bloqueia', aboveLimit.blocked === true);

  const negativeLimit = evaluateMaxTradesPerDayGate(0, -1);
  assertTrue('limite negativo -> tratado como sem limite, não bloqueia', negativeLimit.blocked === false);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
