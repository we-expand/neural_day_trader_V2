// O preco de entrada gravado (corretora) bate com a Binance no mesmo minuto? Mede defasagem/desvio por simbolo.
import fs from "node:fs";
const MAP = { BTCUSD: "BTCUSDT", XETUSD: "ETHUSDT" };
const rows = fs.readFileSync("entries.csv", "utf8").trim().split("\n").map((l) => { const a = l.split(","); return { ts: +a[0], symbol: a[1], side: a[2], ep: +a[3], sd: +a[4] }; }).filter((r) => MAP[r.symbol]);
const res = {};
for (const r of rows) {
  const t = r.ts * 1000;
  const u = `https://api.binance.com/api/v3/klines?symbol=${MAP[r.symbol]}&interval=1m&startTime=${t - 15 * 60000}&endTime=${t + 60000}&limit=20`;
  const k = await (await fetch(u)).json();
  const idx = k.findIndex((c) => c[0] <= t && t <= c[6]);
  if (idx < 0) continue;
  const c = k[idx]; const lo = +c[3], hi = +c[2], mid = (+c[1] + +c[4]) / 2;
  const sgn = r.side === "LONG" ? 1 : -1;
  const worseBps = sgn * (r.ep - mid) / mid * 1e4;                 // >0 = entrou pior que o meio da Binance
  const outside = r.ep > hi ? (r.ep - hi) / hi * 1e4 : r.ep < lo ? (r.ep - lo) / lo * 1e4 : 0; // fora do range do minuto
  // melhor defasagem: em qual dos 10 min anteriores o preco gravado cabe no range?
  let lag = null; for (let j = 0; j <= 10 && idx - j >= 0; j++) { const d = k[idx - j]; if (r.ep >= +d[3] && r.ep <= +d[2]) { lag = j; break; } }
  (res[r.symbol] ??= []).push({ worseBps, outside, lag, stopBps: r.sd / r.ep * 1e4 });
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
for (const [s, v] of Object.entries(res)) {
  console.log(`${s}: n=${v.length} | entrada pior que o meio da Binance: mediana ${med(v.map((x) => x.worseBps)).toFixed(1)} bps, media ${(v.reduce((a, x) => a + x.worseBps, 0) / v.length).toFixed(1)} bps | stop mediano ${med(v.map((x) => x.stopBps)).toFixed(0)} bps`);
  console.log(`   preco gravado FORA do range do minuto na Binance: ${v.filter((x) => x.outside !== 0).length}/${v.length} (desvio mediano ${med(v.filter((x) => x.outside !== 0).map((x) => Math.abs(x.outside))).toFixed(1)} bps)`);
  console.log(`   defasagem (min ate o preco caber no range): ${JSON.stringify(v.reduce((m, x) => { const k = x.lag == null ? ">10/nunca" : String(x.lag); m[k] = (m[k] || 0) + 1; return m; }, {}))}`);
}
