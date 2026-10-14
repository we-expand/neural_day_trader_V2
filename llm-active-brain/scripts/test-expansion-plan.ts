import assert from "node:assert/strict";
import { planExpansion } from "../src/expansionPlan.js";
import { computeFibCorridor, type FibCorridor } from "../src/fibCorridor.js";
let n = 0;
const check = (nome: string, fn: () => void) => { fn(); n++; console.log(`ok  ${nome}`); };

// Corredor de BAIXA: topo 1000, 0 em 900 (fundo rompido); degraus 61,8%=838,2 / 100%=800 / 161,8%=738,2; preço 850 (abaixo do 0)
const base: FibCorridor = {
  tf: "1H", direcao: "BAIXA", pontoA: 1000, pontoB: 900, perna: 100, emExpansao: true, redesenhar: false,
  degraus: [{ ratio: 0.618, price: 838.2, rompido: false }, { ratio: 1, price: 800, rompido: false }, { ratio: 1.618, price: 738.2, rompido: false }],
  proximoDegrau: { ratio: 0.618, price: 838.2, rompido: false }, distanciaProximoPct: 1.4,
};
check("SHORT a favor da expansão de baixa: alvo no próximo degrau, invalidação no 0", () => {
  const p = planExpansion({ side: "SHORT", entryPrice: 850, corridor: base });
  assert.equal(p.ativo, true);
  assert.equal(p.alvo!.price, 838.2);
  assert.equal(p.invalidacao!.price, 900);
  assert.ok(Math.abs(p.rr! - 11.8 / 50) < 1e-9);
});
check("reentradas a cada 0,15% a favor e protecao no preco de entrada; nenhuma dentro da zona de reducao", () => {
  const p = planExpansion({ side: "SHORT", entryPrice: 850, corridor: base });
  assert.ok(p.reentradas!.every((r) => r < 850 && r > p.reducao!.price));
  assert.equal(p.protecao?.stopPrice, 850);
  assert.ok(Math.abs(p.reducao!.price - (850 - 0.9 * 11.8)) < 1e-6);
});
check("LONG contra a expansão de baixa não ativa", () => {
  assert.equal(planExpansion({ side: "LONG", entryPrice: 850, corridor: base }).ativo, false);
});
check("degraus esgotados ou sem corredor não ativa", () => {
  assert.equal(planExpansion({ side: "SHORT", entryPrice: 850, corridor: { ...base, redesenhar: true, proximoDegrau: null } }).ativo, false);
  assert.equal(planExpansion({ side: "SHORT", entryPrice: 850, corridor: null }).ativo, false);
});
check("degrau já ultrapassado pela entrada não ativa", () => {
  assert.equal(planExpansion({ side: "SHORT", entryPrice: 830, corridor: base }).ativo, false);
});
check("espelho: LONG a favor da expansão de alta", () => {
  const alta: FibCorridor = { ...base, direcao: "ALTA", pontoA: 1000, pontoB: 1100, degraus: [{ ratio: 0.618, price: 1161.8, rompido: false }, { ratio: 1, price: 1200, rompido: false }, { ratio: 1.618, price: 1261.8, rompido: false }], proximoDegrau: { ratio: 0.618, price: 1161.8, rompido: false } };
  const p = planExpansion({ side: "LONG", entryPrice: 1150, corridor: alta });
  assert.equal(p.ativo, true);
  assert.equal(p.alvo!.price, 1161.8);
  assert.equal(p.invalidacao!.price, 1100);
});
check("integração: corredor calculado de velas alimenta o plano", () => {
  const pts = [990, 995, 1000, 996, 990, 980, 970, 960, 950, 940, 930, 920, 910, 900, 905, 912, 920, 928, 930, 925, 915, 905, 895, 880, 865, 850];
  const velas = pts.map((p, i) => ({ timestamp: i * 3600000, open: p + 2, high: p + 4, low: p - 4, close: p }));
  const c = computeFibCorridor(velas, { tf: "1H", window: 50 })!;
  const p = planExpansion({ side: "SHORT", entryPrice: 850, corridor: c });
  assert.equal(p.ativo, true);
});
console.log(`\n${n} testes passaram.`);
