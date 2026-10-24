/**
 * Testes do modulo de corredor de Fibonacci (src/fibCorridor.ts). Roda sem rede:
 *   npx tsx scripts/test-fib-corridor.ts
 */
import { computeFibCorridor, describeFibCorridor, describeExpansionAverages, fibLevelsFromAnchors, type FibCandle } from "../src/fibCorridor.js";

let falhas = 0;
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) falhas++;
}
const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// 1) Matematica dos degraus com as ancoras do 1H do JPN225 (topo ~69.233, fundo rompido 67.113): o 61,8% cai em ~65.803.
const lv = fibLevelsFromAnchors("BAIXA", 69233, 67113);
ok(perto(lv[0].price, 65802.84, 0.5), `1H JPN225: 61,8% = ${lv[0].price.toFixed(2)} (esperado ~65.803, o degrau que o Cleber marcou)`);
ok(perto(lv[1].price, 64993, 0.5), `1H JPN225: 100% = ${lv[1].price.toFixed(2)}`);
ok(perto(lv[2].price, 63682.84, 0.5), `1H JPN225: 161,8% = ${lv[2].price.toFixed(2)}`);

// 2) Espelho para alta: topo rompido em 100, topo anterior (inicio da perna, fundo) em 90, perna 10.
const up = fibLevelsFromAnchors("ALTA", 90, 100);
ok(perto(up[0].price, 106.18) && perto(up[1].price, 110) && perto(up[2].price, 116.18), "alta: degraus para cima a partir do topo rompido");

// 3) Serie sintetica de baixa: topo 1000, queda ate 900 (fundo B), repique ate 930, e rompimento para 850.
function serie(): FibCandle[] {
  const pts = [
    ...[990, 995, 1000, 996, 990, 980, 970, 960, 950, 940, 930, 920, 910, 900, 905, 912, 920, 928, 930, 925, 915, 905, 895, 880, 865, 850],
  ];
  return pts.map((p, i) => ({ timestamp: i * 900000, open: p + 2, high: p + 4, low: p - 4, close: p }));
}
const s = serie();
const c = computeFibCorridor(s, { tf: "15m", window: 50 });
ok(c !== null, "acha um corredor na serie sintetica");
if (c) {
  console.log("   ", describeFibCorridor(c));
  ok(c.direcao === "BAIXA", "direcao BAIXA");
  ok(perto(c.pontoB, 896, 0.5), `fundo rompido (0) = ${c.pontoB} (menor minima do pivo, 900-4)`);
  ok(perto(c.pontoA, 1004, 0.5), `topo anterior = ${c.pontoA} (maxima do 1000+4)`);
  ok(c.emExpansao, "preco abaixo do 0 = em expansao");
  ok(c.degraus[0].rompido === false || c.degraus[0].rompido === true, "degraus marcados");
  const esperado = 896 - 0.618 * (1004 - 896);
  ok(perto(c.degraus[0].price, esperado, 0.5), `61,8% = ${c.degraus[0].price.toFixed(2)} (esperado ${esperado.toFixed(2)})`);
}

// 4) Sem rompimento: serie lateral nao devolve corredor.
const lateral: FibCandle[] = Array.from({ length: 40 }, (_, i) => {
  const p = 100 + (i % 2 === 0 ? 1 : -1);
  return { timestamp: i * 900000, open: p, high: p + 1, low: p - 1, close: p };
});
ok(computeFibCorridor(lateral, { tf: "15m" }) === null, "serie lateral nao tem corredor");

// 5) Pouca vela: devolve null sem quebrar.
ok(computeFibCorridor(s.slice(0, 3), { tf: "15m" }) === null, "poucas velas = null");


// 6) Médias na expansão (regra do Cleber): repique que rompe a 9 = alerta; 20 fora da base = saída da expansão.
const baixaC = { direcao: "BAIXA" as const, pontoB: 7778.16, tf: "15m" };
const t1 = describeExpansionAverages(baixaC, 7735, 7730, 7800); // preço 7735 > média de 9 (7730)
ok(t1.includes("ALERTA") && t1.includes("FORA da base"), "baixa: preço acima da 9 = ALERTA e 20 acima do 0 = fora da base");
const t2 = describeExpansionAverages(baixaC, 7720, 7730, 7800);
ok(!t2.includes("ALERTA") && t2.includes("ainda não rompeu a 9"), "baixa: preço abaixo da 9 = sem alerta");
const t3 = describeExpansionAverages({ direcao: "ALTA", pontoB: 100, tf: "1H" }, 98, 99, 90);
ok(t3.includes("ALERTA") && t3.includes("FORA da base"), "alta (espelho): preço abaixo da 9 = ALERTA; 20 abaixo do 0 = fora da base");
ok(describeExpansionAverages(baixaC, 7725, null, undefined) === "", "sem médias = texto vazio");

console.log(falhas === 0 ? "\nTudo passou." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
