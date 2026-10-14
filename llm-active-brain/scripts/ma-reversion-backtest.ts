// Teste da frase do Cleber: "quando o ativo se afasta demais da média, quase certeza que volta a ela".
// 1H, Binance, 2 anos. Evento = 1ª vela em que |close - EMA9| >= k * ATR14 (afastou). Mede se o preço TOCA a EMA9 (que
// anda) em até H velas. Referência: probabilidade de, de velas aleatórias, tocar um nível FIXO à mesma distância no
// mesmo sentido em H velas (a EMA se move em direção ao preço, então a média tem uma vantagem estrutural -- por isso
// comparo também contra esta referência, sem prometer nada). Uso: npx tsx scripts/ma-reversion-backtest.ts [SIMBOLO] [k=2] [H=12]
const symbol = process.argv[2] ?? "BTCUSDT", K = Number(process.argv[3] ?? 2), H = Number(process.argv[4] ?? 12);
interface C { t: number; o: number; h: number; l: number; c: number }
const out: C[] = []; let start = Date.now() - 2 * 365 * 86400_000;
while (start < Date.now()) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&limit=1000`);
  const rows = (await r.json()) as unknown[][]; if (!rows.length) break;
  for (const k of rows) out.push({ t: Number(k[0]), o: +k[1]!, h: +k[2]!, l: +k[3]!, c: +k[4]! });
  start = Number(rows[rows.length - 1]![0]) + 3600_000; if (rows.length < 1000) break;
}
const ema: number[] = [], atr: number[] = []; const a9 = 2 / 10;
out.forEach((x, i) => {
  ema.push(i === 0 ? x.c : x.c * a9 + ema[i - 1] * (1 - a9));
  const tr = i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - out[i - 1].c), Math.abs(x.l - out[i - 1].c));
  atr.push(i === 0 ? tr : (atr[i - 1] * 13 + tr) / 14);
});
let n = 0, tocou = 0, refN = 0, refHit = 0, ant = false;
for (let i = 30; i < out.length - H; i++) {
  const dist = out[i].c - ema[i], ext = Math.abs(dist) >= K * atr[i];
  if (ext && !ant) {
    n++;
    const acima = dist > 0;
    if (out.slice(i + 1, i + 1 + H).some((x, j) => (acima ? x.l <= ema[i + 1 + j] : x.h >= ema[i + 1 + j]))) tocou++;
    const d = Math.abs(dist) / out[i].c;
    for (let u = 30; u < out.length - H; u += 11) {
      const lvl = acima ? out[u].c * (1 - d) : out[u].c * (1 + d); refN++;
      if (out.slice(u + 1, u + 1 + H).some((x) => (acima ? x.l <= lvl : x.h >= lvl))) refHit++;
    }
  }
  ant = ext;
}
const p = tocou / n, ep = Math.sqrt((p * (1 - p)) / n);
console.log(`${symbol}: ${n} afastamentos >= ${K} ATR da EMA9 | voltou a tocar a EMA9 em ${H}h: ${(p * 100).toFixed(1)}% (±${(196 * ep).toFixed(1)}pp) | nível fixo à mesma distância (referência): ${((refHit / refN) * 100).toFixed(1)}%`);

export {};
