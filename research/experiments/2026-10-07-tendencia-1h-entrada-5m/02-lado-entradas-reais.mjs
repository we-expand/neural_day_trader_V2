// Teste objetivo de LADO: independente do stop/alvo/gestao que o motor usou,
// o preco andou a favor ou contra o lado escolhido depois da entrada?
// Fonte: klines publicos da Binance (1m pro caminho, 1H pra tendencia).
// So simbolos com par liquido na Binance. Sem look-ahead: tendencia 1H usa
// apenas velas de 1H JA FECHADAS antes da entrada.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MAP = { BTCUSD: "BTCUSDT", XETUSD: "ETHUSDT", BNBUSD: "BNBUSDT", LNKUSD: "LINKUSDT", SOLUSD: "SOLUSDT" };
const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];

async function klines(symbol, interval, startMs, endMs) {
  for (const host of HOSTS) {
    try {
      const url = `${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=1000`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const rows = await res.json();
      return rows.map((r) => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], closeT: r[6] }));
    } catch { /* tenta o proximo host */ }
  }
  return null;
}

const ema = (values, period) => {
  const k = 2 / (period + 1);
  let e = values[0];
  const out = [e];
  for (let i = 1; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
  return out;
};

const rows = fs.readFileSync(path.join(DIR, "entries.csv"), "utf8").trim().split("\n").map((l) => {
  const [ts, symbol, side, ep, sd, tpd, liq, t5, t1h, setup, st5, st1h, macd, saida, mfe, notional] = l.split(",");
  return { ts: +ts, symbol, side, ep: +ep, sd: +sd, tpd: +tpd, liq: +liq, t5, t1h, setup, st5, st1h, macd, saida, mfe: +mfe, notional: +notional };
});

const out = [];
for (const r of rows) {
  const pair = MAP[r.symbol];
  if (!pair) continue;
  const entryMs = r.ts * 1000;
  const m1 = await klines(pair, "1m", entryMs - 60_000, entryMs + 4 * 3600_000);
  const h1 = await klines(pair, "1h", entryMs - 80 * 3600_000, entryMs);
  if (!m1 || m1.length < 200 || !h1) { console.error("sem dado", r.symbol, r.ts); continue; }
  const sgn = r.side === "LONG" ? 1 : -1;
  const p0 = m1[0].c; // fechamento do minuto da entrada, na Binance (referencia propria, evita diferenca de venue)
  const stopPct = r.sd / r.ep; // distancia de stop do proprio trade, em % do preco
  const at = (min) => { const c = m1[Math.min(min, m1.length - 1)]; return sgn * (c.c - p0) / p0; };
  // Caminho simetrico: alvo = stop = 1x a distancia de stop do proprio trade, 4h. Empate na mesma vela = stop (conservador).
  let sym = "nenhum";
  let mfe = 0, mae = 0;
  for (let i = 1; i < m1.length; i++) {
    const fav = sgn === 1 ? (m1[i].h - p0) / p0 : (p0 - m1[i].l) / p0;
    const adv = sgn === 1 ? (p0 - m1[i].l) / p0 : (m1[i].h - p0) / p0;
    if (sym === "nenhum") {
      if (adv >= stopPct) sym = "stop";
      else if (fav >= stopPct) sym = "alvo";
    }
    if (i <= 120) { mfe = Math.max(mfe, fav); mae = Math.max(mae, adv); }
  }
  // Tendencia 1H: so velas fechadas antes da entrada.
  const closed = h1.filter((k) => k.closeT < entryMs);
  const closes = closed.map((k) => k.c);
  const e9 = ema(closes, 9).at(-1), e20 = ema(closes, 20).at(-1);
  const e20prev = ema(closes, 20).at(-4);
  const last = closes.at(-1);
  // (a) regra do motor hoje: variacao ponto-a-ponto de 24 velas de 1H, faixa neutra 0,15%
  const chg24 = (last - closes.at(-25)) / closes.at(-25) * 100;
  const engine = Math.abs(chg24) < 0.15 ? "LATERAL" : chg24 > 0 ? "ALTA" : "BAIXA";
  // (b) leitura de grafico: preco x EMA20 de 1H, EMA9 x EMA20 e inclinacao da EMA20
  const up = last > e20 && e9 > e20 && e20 > e20prev;
  const down = last < e20 && e9 < e20 && e20 < e20prev;
  const struct = up ? "ALTA" : down ? "BAIXA" : "LATERAL";
  // (c) ultimas 6h (o que o olho ve no fim do grafico de 1H)
  const chg6 = (last - closes.at(-7)) / closes.at(-7) * 100;
  const recent = Math.abs(chg6) < 0.3 ? "LATERAL" : chg6 > 0 ? "ALTA" : "BAIXA";
  // distancia do preco pra EMA20 de 1H em multiplos do stop (esticado?)
  const stretch = sgn * (p0 - e20) / p0 / stopPct;
  out.push({ ...r, pair, stopPct: stopPct * 100, f15: at(15), f30: at(30), f60: at(60), f120: at(120), sym, mfeR: mfe / stopPct, maeR: mae / stopPct, engine, struct, recent, chg24, chg6, stretch });
}
fs.writeFileSync(path.join(DIR, "lado_out.json"), JSON.stringify(out, null, 1));

const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + "%" : "-");
const align = (side, label) => label === "LATERAL" ? "lateral" : ((side === "LONG") === (label === "ALTA") ? "a favor" : "contra");
function table(title, keyFn, list = out) {
  const g = new Map();
  for (const r of list) { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  console.log(`\n== ${title} ==`);
  console.log("grupo".padEnd(34), "n".padStart(3), "lado certo 30m".padStart(15), "60m".padStart(6), "alvo antes do stop (1:1)".padStart(26), "acerto real".padStart(12), "liq $".padStart(8), "MFE>=1R".padStart(8));
  for (const [k, v] of [...g.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const dec = v.filter((r) => r.sym !== "nenhum");
    console.log(String(k).padEnd(34), String(v.length).padStart(3),
      pct(v.filter((r) => r.f30 > 0).length, v.length).padStart(15),
      pct(v.filter((r) => r.f60 > 0).length, v.length).padStart(6),
      (pct(dec.filter((r) => r.sym === "alvo").length, dec.length) + ` (${dec.filter((r) => r.sym === "alvo").length}/${dec.length})`).padStart(26),
      pct(v.filter((r) => r.liq > 0).length, v.length).padStart(12),
      v.reduce((s, r) => s + r.liq, 0).toFixed(2).padStart(8),
      pct(v.filter((r) => r.mfeR >= 1).length, v.length).padStart(8));
  }
}
console.log(`Entradas com par na Binance: ${out.length} de ${rows.length}`);
table("GERAL", () => "todas");
table("por simbolo", (r) => r.symbol);
table("por lado", (r) => r.side);
table("alinhamento com a 1H DO MOTOR (rotulo gravado no trade)", (r) => align(r.side, r.t1h || "LATERAL"));
table("alinhamento com a 1H por EMA9/EMA20 (leitura de grafico)", (r) => align(r.side, r.struct));
table("alinhamento com as ultimas 6h de 1H", (r) => align(r.side, r.recent));
table("setup", (r) => r.setup || "(nulo)");
table("esticado vs EMA20 1H (em multiplos do stop, no sentido do lado)", (r) => r.stretch > 2 ? "esticado a favor (>2 stops)" : r.stretch < -2 ? "contra a media (<-2 stops)" : "perto da media");
table("periodo", (r) => r.ts < 1790132400 ? "1) 22/09" : r.ts < 1790524800 ? "2) 23-27/09 Ollama" : r.ts < 1790910000 ? "3) 27/09-01/10 Nemotron" : "4) 06-07/10 atual");
const disagree = out.filter((r) => (r.t1h || "LATERAL") !== r.struct);
console.log(`\nRotulo 1H do motor != leitura EMA9/20 em ${disagree.length}/${out.length} entradas (${pct(disagree.length, out.length)})`);
const sp = out.map((r) => r.stopPct).sort((a, b) => a - b);
console.log(`Stop em % do preco: mediana ${sp[Math.floor(sp.length / 2)].toFixed(2)}%, min ${sp[0].toFixed(2)}%, max ${sp.at(-1).toFixed(2)}%`);
for (const s of Object.keys(MAP)) { const v = out.filter((r) => r.symbol === s).map((r) => r.stopPct).sort((a, b) => a - b); if (v.length) console.log(`  ${s}: stop mediano ${v[Math.floor(v.length / 2)].toFixed(2)}% (n=${v.length})`); }
