// Teste retrospectivo da regra do Cleber: "rompeu o 61,8% do Fibonacci de extensao, vai pelo menos ate o 100%".
// Sem look-ahead: em cada vela o corredor e calculado so com as velas ate ela. Compara com a taxa-base (mesma
// distancia percentual, partindo de velas aleatorias). Dados: Binance (publico), 1H.
// Uso: npx tsx scripts/fib-backtest.ts [SIMBOLO=BTCUSDT] [anos=2] [janela=72] [horizonte_velas=48]
import { computeFibCorridor, type FibCandle } from "../src/fibCorridor.js";

const symbol = process.argv[2] ?? "BTCUSDT";
const years = Number(process.argv[3] ?? 2);
const window = Number(process.argv[4] ?? 72);
const horizon = Number(process.argv[5] ?? 48);

async function klines(): Promise<FibCandle[]> {
  const out: FibCandle[] = [];
  let start = Date.now() - years * 365 * 86400_000;
  while (start < Date.now()) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&limit=1000`);
    if (!r.ok) throw new Error(`binance ${r.status}`);
    const rows = (await r.json()) as unknown[][];
    if (!rows.length) break;
    for (const k of rows) out.push({ timestamp: Number(k[0]), open: +k[1]!, high: +k[2]!, low: +k[3]!, close: +k[4]! });
    start = Number(rows[rows.length - 1]![0]) + 3600_000;
    if (rows.length < 1000) break;
  }
  return out;
}

const c = await klines();
console.log(`${symbol}: ${c.length} velas de 1H (${new Date(c[0].timestamp).toISOString().slice(0, 10)} → ${new Date(c[c.length - 1].timestamp).toISOString().slice(0, 10)}), janela ${window}, horizonte ${horizon}h`);

interface Res { n: number; hit100: number; hit161: number; baseHit100: number; baseN: number }
const res: Record<"BAIXA" | "ALTA", Res> = {
  BAIXA: { n: 0, hit100: 0, hit161: 0, baseHit100: 0, baseN: 0 },
  ALTA: { n: 0, hit100: 0, hit161: 0, baseHit100: 0, baseN: 0 },
};
const vistos = new Set<string>();
for (let t = window + 5; t < c.length - horizon; t++) {
  const w = c.slice(t - window - 1, t + 1);
  const cor = computeFibCorridor(w, { tf: "1H", window });
  if (!cor) continue;
  const d = cor.degraus[0]; // 61,8%
  const prev = c[t - 1].close;
  const cruzouAgora = cor.direcao === "BAIXA" ? c[t].close < d.price && prev >= d.price : c[t].close > d.price && prev <= d.price;
  if (!cruzouAgora) continue;
  const key = `${cor.direcao}:${cor.pontoA.toFixed(2)}:${cor.pontoB.toFixed(2)}`;
  if (vistos.has(key)) continue; // uma vez por perna
  vistos.add(key);
  const alvo100 = cor.degraus[1].price, alvo161 = cor.degraus[2].price;
  const fut = c.slice(t + 1, t + 1 + horizon);
  const bate = (lvl: number) => fut.some((k) => (cor.direcao === "BAIXA" ? k.low <= lvl : k.high >= lvl));
  const r = res[cor.direcao];
  r.n++;
  if (bate(alvo100)) r.hit100++;
  if (bate(alvo161)) r.hit161++;
  // taxa-base: de TODAS as velas, a mesma distancia percentual ate o 100% no mesmo sentido e horizonte
  const distPct = Math.abs(c[t].close - alvo100) / c[t].close;
  let bn = 0, bh = 0;
  for (let u = window; u < c.length - horizon; u += 7) {
    const lvl = cor.direcao === "BAIXA" ? c[u].close * (1 - distPct) : c[u].close * (1 + distPct);
    const f = c.slice(u + 1, u + 1 + horizon);
    bn++;
    if (f.some((k) => (cor.direcao === "BAIXA" ? k.low <= lvl : k.high >= lvl))) bh++;
  }
  r.baseN += bn; r.baseHit100 += bh;
}
for (const dir of ["BAIXA", "ALTA"] as const) {
  const r = res[dir];
  if (!r.n) { console.log(`${dir}: nenhum evento`); continue; }
  const p = r.hit100 / r.n, base = r.baseHit100 / r.baseN;
  const ep = Math.sqrt((p * (1 - p)) / r.n);
  console.log(
    `${dir}: ${r.n} rompimentos do 61,8% | chegou ao 100% em ${horizon}h: ${(p * 100).toFixed(1)}% (±${(1.96 * ep * 100).toFixed(1)} pp) | ao 161,8%: ${((r.hit161 / r.n) * 100).toFixed(1)}% | taxa-base (mesma distancia, velas aleatorias): ${(base * 100).toFixed(1)}%`,
  );
}
