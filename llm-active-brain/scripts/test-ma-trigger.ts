import assert from "node:assert/strict";
import { readMaTrigger, ema, sma } from "../src/maTrigger.js";
import type { FibCandle } from "../src/fibCorridor.js";
let n = 0; const check = (nome: string, fn: () => void) => { fn(); n++; console.log(`ok  ${nome}`); };
const mk = (closes: number[], wick = 0.5): FibCandle[] => closes.map((c, i) => ({ timestamp: i * 900000, open: c, high: c + wick, low: c - wick, close: c }));
// tendência de baixa estável: 60 velas caindo 1 por vela
const queda = Array.from({ length: 60 }, (_, i) => 200 - i);
check("EMA/SMA básicas", () => { assert.equal(sma([1, 2, 3, 4], 2)[3], 3.5); assert.equal(ema([5, 5, 5], 3)[2], 5); });
check("sem tendência: série lateral", () => { const r = readMaTrigger(mk(Array.from({ length: 60 }, (_, i) => 100 + (i % 2))), "15m"); assert.equal(r?.estado, "SEM_TENDENCIA"); });
check("queda sem toque: SEM_TOQUE e espera a volta à média", () => { const r = readMaTrigger(mk(queda, 0.2), "15m"); assert.equal(r?.tendencia, "BAIXA"); assert.equal(r?.estado, "SEM_TOQUE"); assert.equal(r?.ladoFavorecido, null); });
check("queda, preço sobe até a 9 e fecha abaixo: REJEIÇÃO, favorece SHORT", () => {
  const c = mk(queda, 0.2); const E9 = ema(c.map((x) => x.close), 9);
  const n0 = c.length - 1; c[n0] = { ...c[n0], high: E9[n0] + 0.3, close: c[n0].close }; // pavio tocou a 9, fechou abaixo
  const r = readMaTrigger(c, "15m"); assert.equal(r?.estado, "REJEICAO_NA_9"); assert.equal(r?.ladoFavorecido, "SHORT");
});
check("queda e fecha ACIMA da 9: ROMPEU_9, alerta, nenhum lado", () => {
  const c = mk(queda, 0.2); const E9 = ema(c.map((x) => x.close), 9); const n0 = c.length - 1;
  const alto = E9[n0] + 3; c[n0] = { ...c[n0], high: alto + 0.2, close: alto };
  const r = readMaTrigger(c, "15m"); assert.equal(r?.estado, "ROMPEU_9"); assert.equal(r?.ladoFavorecido, null); assert.ok(r?.texto.includes("ALERTA"));
});
check("espelho: alta com toque por baixo na 9 favorece LONG", () => {
  const alta = Array.from({ length: 60 }, (_, i) => 100 + i); const c = mk(alta, 0.2); const E9 = ema(c.map((x) => x.close), 9); const n0 = c.length - 1;
  c[n0] = { ...c[n0], low: E9[n0] - 0.3 };
  assert.equal(readMaTrigger(c, "1H")?.ladoFavorecido, "LONG");
});
check("poucas velas = null", () => assert.equal(readMaTrigger(mk([1, 2, 3]), "15m"), null));
console.log(`\n${n} testes passaram.`);
