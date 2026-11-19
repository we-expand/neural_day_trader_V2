// Relatório da calculadora de alvo em modo sombra: para cada entrada registrada (ledger/target_shadow.jsonl), usa as velas de 1m
// para ver, com o STOP proposto, quais alvos candidatos teriam vindo primeiro. Compara a chance base com a taxa real.
// Uso: npx tsx scripts/target-shadow-report.ts [horas=24]   (precisa de rede: busca velas de 1m)
import { readFileSync, existsSync } from "node:fs";
import { getOneMinuteCandlesSince } from "../src/atr.js";
const hours = Number(process.argv[2] ?? 24); const since = Date.now() - hours * 3600_000;
const file = new URL("../ledger/target_shadow.jsonl", import.meta.url).pathname;
if (!existsSync(file)) { console.log("sem registros ainda"); process.exit(0); }
const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((r) => r && Date.parse(r.at) >= since);
console.log(`${rows.length} entradas registradas nas últimas ${hours}h`);
const veredito: Record<string, number> = {}; rows.forEach((r) => { veredito[r.plan.verdict] = (veredito[r.plan.verdict] ?? 0) + 1; });
console.log("veredito da calculadora:", veredito);
const agg = new Map<string, { n: number; hit: number; p: number }>(); let measured = 0;
for (const r of rows) {
  const candles = await getOneMinuteCandlesSince(r.symbol, Date.parse(r.at)); if (candles.length < 20 || Date.now() - Date.parse(r.at) < 90 * 60_000) continue; measured++;
  const long = r.side === "LONG"; const stop = long ? r.entryPrice * (1 - r.stopPct) : r.entryPrice * (1 + r.stopPct);
  for (const c of r.plan.candidates as Array<{ targetPct: number; pHit: number }>) {
    const tgt = long ? r.entryPrice * (1 + c.targetPct) : r.entryPrice * (1 - c.targetPct); let res: number | null = null;
    for (const k of candles) { const hs = long ? k.low <= stop : k.high >= stop, ht = long ? k.high >= tgt : k.low <= tgt; if (hs) { res = 0; break; } if (ht) { res = 1; break; } }
    if (res == null) continue; const key = (Math.round(c.targetPct * 10000) / 100).toFixed(2) + "%"; const a = agg.get(key) ?? { n: 0, hit: 0, p: 0 }; a.n++; a.hit += res; a.p += c.pHit; agg.set(key, a);
  }
}
console.log(`entradas medidas (≥90 min de velas): ${measured}`);
for (const [k, a] of [...agg.entries()].sort((x, y) => parseFloat(x[0]) - parseFloat(y[0]))) console.log(`alvo ${k}: n=${a.n} chance base média ${(100 * a.p / a.n).toFixed(0)}% | taxa real ${(100 * a.hit / a.n).toFixed(0)}%`);
