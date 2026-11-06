// Teste da frase do Cleber: "em dia de queda forte o ativo bate varias vezes na media e continua caindo".
// 1H, Binance, 2 anos, sem look-ahead. Evento = 1o toque na EMA9 por baixo (high >= EMA9 depois de uma vela com high < EMA9).
// Resultado em ate H velas, simetrico em ATR: CONTINUA = o preco cai `A` ATR abaixo da EMA9 ANTES de fechar `A` ATR acima dela.
// Compara: em EXPANSAO de BAIXA (corredor de Fibonacci rompido para baixo) x fora da expansao (mesmo evento). Espelho p/ alta.
// Uso: npx tsx scripts/ma-touch-backtest.ts [SIMBOLO=BTCUSDT] [A=1] [H=12]
import { computeFibCorridor, type FibCandle } from "../src/fibCorridor.js";
const symbol = process.argv[2] ?? "BTCUSDT", A = Number(process.argv[3] ?? 1), H = Number(process.argv[4] ?? 12);
const c: FibCandle[] = []; let start = Date.now() - 2 * 365 * 86400_000;
while (start < Date.now()) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&limit=1000`);
  const rows = (await r.json()) as unknown[][]; if (!rows.length) break;
  for (const k of rows) c.push({ timestamp: Number(k[0]), open: +k[1]!, high: +k[2]!, low: +k[3]!, close: +k[4]! });
  start = Number(rows[rows.length - 1]![0]) + 3600_000; if (rows.length < 1000) break;
}
const ema: number[] = [], atr: number[] = []; const a9 = 0.2;
c.forEach((x, i) => {
  ema.push(i === 0 ? x.close : x.close * a9 + ema[i - 1] * (1 - a9));
  const tr = i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close));
  atr.push(i === 0 ? tr : (atr[i - 1] * 13 + tr) / 14);
});
type Acc = { n: number; cont: number; quebra: number };
const acc: Record<string, Acc> = {};
const add = (k: string, o: "C" | "Q" | "N") => { const a = (acc[k] ??= { n: 0, cont: 0, quebra: 0 }); a.n++; if (o === "C") a.cont++; if (o === "Q") a.quebra++; };
for (let i = 80; i < c.length - H; i++) {
  const baixaTouch = c[i].high >= ema[i] && c[i - 1].high < ema[i - 1] && c[i].close < ema[i] + A * atr[i] * 5; // toque por baixo
  const altaTouch = c[i].low <= ema[i] && c[i - 1].low > ema[i - 1];
  if (!baixaTouch && !altaTouch) continue;
  const cor = computeFibCorridor(c.slice(i - 73, i + 1), { tf: "1H", window: 72 });
  const dirTouch = baixaTouch ? "BAIXA" : "ALTA";
  const emExp = cor && cor.direcao === dirTouch;
  let out: "C" | "Q" | "N" = "N";
  for (let j = i + 1; j <= i + H; j++) {
    const lim = A * atr[i];
    // simetrico: os DOIS lados por pavio; se os dois ocorrem na mesma vela, conta como QUEBRA (conservador)
    const cont = dirTouch === "BAIXA" ? c[j].low <= ema[i] - lim : c[j].high >= ema[i] + lim;
    const quebra = dirTouch === "BAIXA" ? c[j].high >= ema[i] + lim : c[j].low <= ema[i] - lim;
    if (quebra) { out = "Q"; break; }
    if (cont) { out = "C"; break; }
  }
  add(`${dirTouch} ${emExp ? "EM EXPANSAO a favor" : "fora da expansao"}`, out);
}
console.log(`${symbol} (A=${A} ATR, H=${H}h): continua = move ${A} ATR no sentido da tendencia antes de tocar ${A} ATR contra (simétrico; referência do acaso = 50%).`);
for (const [k, a] of Object.entries(acc).sort()) {
  const dec = a.cont + a.quebra, p = dec ? a.cont / dec : 0, e = dec ? 196 * Math.sqrt((p * (1 - p)) / dec) : 0;
  console.log(`${k.padEnd(26)} toques=${String(a.n).padStart(4)} decididos=${String(dec).padStart(4)} | continua ${(p * 100).toFixed(1)}% (±${e.toFixed(1)}pp) | sem desfecho em ${H}h: ${a.n - dec}`);
}
