// Relatório do MODO EXPANSÃO em sombra: para cada plano registrado (ledger/expansion_shadow.jsonl), usa velas de 1m
// para ver o que teria dado (a) o plano de expansão (alvo no degrau, invalidação no 0) e (b) o scalp que foi proposto
// (stop e alvo curtos). Resultado em % do preço, sem custos, uma posição só (as reentradas só são contadas, não somadas).
// Barra que toca alvo e stop ao mesmo tempo conta como STOP. Uso: npx tsx scripts/expansion-shadow-report.ts [horas=24]
import { readFileSync, existsSync } from "node:fs";
import { getDeepCandles } from "../src/atr.js";
const hours = Number(process.argv[2] ?? 24), since = Date.now() - hours * 3600_000;
const file = new URL("../ledger/expansion_shadow.jsonl", import.meta.url).pathname;
if (!existsSync(file)) { console.log("sem registros ainda"); process.exit(0); }
const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((r) => r && Date.parse(r.at) >= since);
console.log(`${rows.length} planos de expansão registrados nas últimas ${hours}h`);
type Out = "ALVO" | "STOP" | "ABERTO";
const tot = { n: 0, expA: 0, expS: 0, expPct: 0, scA: 0, scS: 0, scPct: 0, reent: 0 };
for (const r of rows) {
  if (Date.now() - Date.parse(r.at) < 30 * 60_000) continue; // precisa de tempo para desenrolar
  const candles = await getDeepCandles(r.symbol, "1m", 1000);
  if (!candles) continue;
  const fut = candles.filter((k) => k.timestamp >= Date.parse(r.at));
  if (fut.length < 10) continue;
  const short = r.side === "SHORT", e = r.entryPrice, pl = r.plano;
  const roda = (alvo: number, stop: number): { out: Out; pct: number } => {
    for (const k of fut) {
      const hs = short ? k.high >= stop : k.low <= stop, ht = short ? k.low <= alvo : k.high >= alvo;
      if (hs) return { out: "STOP", pct: (-Math.abs(stop - e) / e) * 100 };
      if (ht) return { out: "ALVO", pct: (Math.abs(alvo - e) / e) * 100 };
    }
    const u = fut[fut.length - 1].close;
    return { out: "ABERTO", pct: ((short ? e - u : u - e) / e) * 100 };
  };
  const ex = roda(pl.alvo.price, pl.invalidacao.price);
  const sc = roda(short ? e * (1 - r.scalpTargetPct) : e * (1 + r.scalpTargetPct), short ? e * (1 + r.stopPct) : e * (1 - r.stopPct));
  const reent = (pl.reentradas as number[]).filter((lvl) => fut.some((k) => (short ? k.low <= lvl : k.high >= lvl))).length;
  tot.n++; tot.reent += reent;
  if (ex.out === "ALVO") tot.expA++; if (ex.out === "STOP") tot.expS++; tot.expPct += ex.pct;
  if (sc.out === "ALVO") tot.scA++; if (sc.out === "STOP") tot.scS++; tot.scPct += sc.pct;
  console.log(`${r.at.slice(11, 16)}Z ${r.symbol} ${r.side} | expansão: ${ex.out} ${ex.pct.toFixed(2)}% (R:R ${pl.rr.toFixed(2)}, ${reent}/${pl.reentradas.length} reentradas atingidas) | scalp: ${sc.out} ${sc.pct.toFixed(2)}%`);
}
console.log(`\nmedidos: ${tot.n} | EXPANSÃO alvo ${tot.expA} / stop ${tot.expS}, soma ${tot.expPct.toFixed(2)}% | SCALP alvo ${tot.scA} / stop ${tot.scS}, soma ${tot.scPct.toFixed(2)}% | reentradas atingidas: ${tot.reent}`);
console.log("Amostra pequena não decide nada: o backtest de 14/10 não achou vantagem sobre o acaso. Só vale olhar com dezenas de planos.");
