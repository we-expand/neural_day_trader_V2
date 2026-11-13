// Testes da calculadora de alvo (src/targetCalculator.ts). Sem rede. Uso: npx tsx scripts/test-target-calculator.ts
import assert from "node:assert/strict";
import { computeTargetPlan } from "../src/targetCalculator.js";
let n = 0; const check = (name: string, fn: () => void) => { fn(); n++; console.log(`ok  ${name}`); };
const base = { side: "SHORT" as const, stopPct: 0.004, proposedTargetPct: 0.0025, amountUsd: 1000, roundTripCostUsd: 1.0, minNetRewardUsd: 3 };

check("piso líquido: alvo mínimo = (piso+custo)/valor", () => {
  const p = computeTargetPlan({ ...base, barriers: [] });
  assert.ok(Math.abs(p.floorTargetPct - 0.004) < 1e-12);
});
check("sem nenhum dado de nível = SEM_DADO", () => {
  const p = computeTargetPlan({ ...base, barriers: [] });
  assert.equal(p.verdict, "SEM_DADO"); assert.equal(p.maxFitTargetPct, null);
});
check("nível longe: o alvo do piso cabe = VALE", () => {
  const p = computeTargetPlan({ ...base, barriers: [{ nome: "suporte 1H", distanciaPct: 0.8, rompido: false }] });
  assert.equal(p.verdict, "VALE"); assert.ok(p.maxFitTargetPct! > 0.0071);
});
check("nível perto: o alvo que paga o piso não cabe = NAO_VALE", () => {
  const p = computeTargetPlan({ ...base, barriers: [{ nome: "suporte 5m", distanciaPct: 0.3, rompido: false }] });
  assert.equal(p.verdict, "NAO_VALE"); assert.equal(p.floorTargetFits, false);
  assert.ok(p.maxFitTargetPct! < 0.003);
});
check("nível rompido não barra", () => {
  const p = computeTargetPlan({ ...base, barriers: [{ nome: "suporte 5m", distanciaPct: -0.1, rompido: true }, { nome: "mínima 24h", distanciaPct: 1.2, rompido: false }] });
  assert.equal(p.nearestBarrier!.nome, "mínima 24h"); assert.equal(p.verdict, "VALE");
});
check("chance base = stop/(stop+alvo) e valor esperado ≈ -custo", () => {
  const p = computeTargetPlan({ ...base, barriers: [{ nome: "x", distanciaPct: 2, rompido: false }] });
  for (const c of p.candidates) {
    assert.ok(Math.abs(c.pHit - base.stopPct / (base.stopPct + c.targetPct)) < 1e-12);
    assert.ok(Math.abs(c.expectedNetUsd + base.roundTripCostUsd) < 1e-9, `EV ${c.expectedNetUsd}`);
  }
});
check("só níveis rompidos (sem nada à frente) = VALE, não SEM_DADO", () => {
  const p = computeTargetPlan({ ...base, barriers: [{ nome: "mínima 24h", distanciaPct: -0.2, rompido: true }] });
  assert.equal(p.verdict, "VALE");
});
check("entrada inválida não quebra", () => {
  const p = computeTargetPlan({ ...base, amountUsd: 0, barriers: [] });
  assert.equal(p.verdict, "SEM_DADO");
});
console.log(`\n${n} testes passaram.`);
