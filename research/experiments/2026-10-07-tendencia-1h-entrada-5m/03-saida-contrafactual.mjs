// Diagnostico de SAIDA: nas MESMAS entradas reais, o que teria acontecido com regras de saida simples?
// Caminho em velas de 1m da Binance, 4h de janela, empate na mesma vela = stop (conservador).
// Custo round-trip (spread real medido em 23/09): BTC 0,08%, ETH 0,11%, demais 0,15% (suposicao conservadora).
// NAO e backtest de estrategia nem prova de edge: e contrafactual sobre 65 entradas ja escolhidas.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const MAP = { BTCUSD: "BTCUSDT", XETUSD: "ETHUSDT", BNBUSD: "BNBUSDT", LNKUSD: "LINKUSDT", SOLUSD: "SOLUSDT" };
const COST = { BTCUSD: 0.0008, XETUSD: 0.0011 };
const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
async function klines(symbol, startMs, endMs) {
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startMs}&endTime=${endMs}&limit=1000`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      return (await res.json()).map((r) => ({ h: +r[2], l: +r[3], c: +r[4] }));
    } catch {}
  }
  return null;
}
function sim(m1, sgn, stopPct, { tgtR, beR = null, trailR = null }) {
  const p0 = m1[0].c;
  let stopLvl = -1; // em R
  let peak = 0;
  for (let i = 1; i < m1.length; i++) {
    const fav = (sgn === 1 ? (m1[i].h - p0) : (p0 - m1[i].l)) / p0 / stopPct;
    const adv = (sgn === 1 ? (p0 - m1[i].l) : (m1[i].h - p0)) / p0 / stopPct;
    if (-adv <= stopLvl) return stopLvl;            // stop (inicial, breakeven ou trailing) primeiro = conservador
    if (tgtR != null && fav >= tgtR) return tgtR;
    peak = Math.max(peak, fav);
    if (beR != null && peak >= beR) stopLvl = Math.max(stopLvl, 0);
    if (trailR != null && peak >= 1) stopLvl = Math.max(stopLvl, peak - trailR);
  }
  return sgn * (m1.at(-1).c - p0) / p0 / stopPct;  // fim da janela: marca a mercado
}
const rows = fs.readFileSync(path.join(DIR, "entries.csv"), "utf8").trim().split("\n").map((l) => {
  const [ts, symbol, side, ep, sd, tpd, liq, t5, t1h, setup, st5, st1h, macd, saida, mfe, notional] = l.split(",");
  return { ts: +ts, symbol, side, ep: +ep, sd: +sd, tpd: +tpd, liq: +liq, t5, t1h, setup, saida, mfe: +mfe, notional: +notional };
});
const RULES = {
  "A) stop 1R / alvo 1,5R, sem breakeven": { tgtR: 1.5 },
  "B) igual A + breakeven em 0,35R (regra atual)": { tgtR: 1.5, beR: 0.35 },
  "B2) igual A + breakeven em 0,5R (valor de 22/09)": { tgtR: 1.5, beR: 0.5 },
  "B3) igual A + breakeven em 1,0R": { tgtR: 1.5, beR: 1.0 },
  "C) stop 1R / alvo 1R": { tgtR: 1 },
  "D) stop 1R / alvo 2R": { tgtR: 2 },
  "E) stop 1R / alvo 3R + breakeven so em 1R": { tgtR: 3, beR: 1 },
  "F) stop 1R, sem alvo, trailing 1R depois de +1R": { tgtR: null, trailR: 1 },
};
const out = [];
for (const r of rows) {
  const pair = MAP[r.symbol]; if (!pair) continue;
  const m1 = await klines(pair, r.ts * 1000 - 60_000, r.ts * 1000 + 4 * 3600_000);
  if (!m1 || m1.length < 200) continue;
  const sgn = r.side === "LONG" ? 1 : -1;
  const stopPct = r.sd / r.ep;
  const costR = (COST[r.symbol] ?? 0.0015) / stopPct;
  const riskUsd = stopPct * r.notional;
  const o = { ...r, stopPct, costR, riskUsd, realR: r.liq / riskUsd, sims: {} };
  for (const [name, cfg] of Object.entries(RULES)) o.sims[name] = sim(m1, sgn, stopPct, cfg) - costR;
  out.push(o);
}
fs.writeFileSync(path.join(DIR, "saida_out.json"), JSON.stringify(out, null, 1));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
function report(title, list) {
  console.log(`\n=== ${title} (n=${list.length}) ===`);
  console.log(`custo medio por trade: ${mean(list.map((r) => r.costR)).toFixed(2)}R | risco medio: $${mean(list.map((r) => r.riskUsd)).toFixed(2)}`);
  const real = list.map((r) => r.realR);
  console.log("REAL (o que o motor fez)".padEnd(50), `acerto ${(100 * real.filter((x) => x > 0).length / real.length).toFixed(0)}%`.padEnd(12), `E[R] ${mean(real).toFixed(2)}`.padEnd(12), `soma ${real.reduce((s, x) => s + x, 0).toFixed(1)}R`.padEnd(14), `t=${(mean(real) / (sd(real) / Math.sqrt(real.length))).toFixed(2)}`);
  for (const name of Object.keys(RULES)) {
    const v = list.map((r) => r.sims[name]);
    console.log(name.padEnd(50), `acerto ${(100 * v.filter((x) => x > 0).length / v.length).toFixed(0)}%`.padEnd(12), `E[R] ${mean(v).toFixed(2)}`.padEnd(12), `soma ${v.reduce((s, x) => s + x, 0).toFixed(1)}R`.padEnd(14), `t=${(mean(v) / (sd(v) / Math.sqrt(v.length))).toFixed(2)}`);
  }
}
report("TODAS as entradas cripto", out);
report("BTCUSD", out.filter((r) => r.symbol === "BTCUSD"));
report("XETUSD (ETH)", out.filter((r) => r.symbol === "XETUSD"));
report("Nemotron (27/09 em diante)", out.filter((r) => r.ts >= 1790524800));
report("Ollama (22-27/09)", out.filter((r) => r.ts < 1790524800));
// Trades em que o lado estava certo (chegou a +0,35R) mas fecharam no zero/negativo
const be = out.filter((r) => r.saida === "SL" && r.liq <= 0 && r.mfe / r.riskUsd >= 0.35);
console.log(`\nSaidas por stop com prejuizo/zero DEPOIS de ja ter andado >= 0,35R a favor: ${be.length} de ${out.length} (soma real ${be.reduce((s, r) => s + r.liq, 0).toFixed(2)} USD)`);
const full = out.filter((r) => r.realR <= -0.8);
console.log(`Perdas cheias (<= -0,8R): ${full.length} de ${out.length} (soma ${full.reduce((s, r) => s + r.liq, 0).toFixed(2)} USD); dessas, MFE medio ${mean(full.map((r) => r.mfe / r.riskUsd)).toFixed(2)}R`);
const realWins = out.filter((r) => r.liq > 0);
console.log(`Ganhos reais: ${realWins.length}, R medio ${mean(realWins.map((r) => r.realR)).toFixed(2)} (planejado 1,45R)`);
