// Backtest 1H: cruzamento SMA20 x SMA200, so a favor do MACD e do Estocastico.
// Sinal: cruzamento na vela i-1 FECHADA; entra na ABERTURA da vela i. Saida: cruzamento oposto (fechado) -> sai na abertura
// seguinte; opcionalmente stop de N x ATR. Custo de ida e volta descontado. Cofre de 6 meses fica FECHADO (so pesquisa).
// Uso: npx tsx scripts/sma-cross-macd-stoch.ts SIMBOLO CUSTO_PCT
import { atrSeries, emaSeries, loadHourly, report, vaultCut, type Candle, type Trade } from "./lib/harness.js";

const symbol = process.argv[2] ?? "BTCUSDT";
const costPct = Number(process.argv[3] ?? 0.07);

function sma(c: readonly Candle[], p: number): number[] {
  const out: number[] = new Array(c.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < c.length; i++) {
    s += c[i]!.close;
    if (i >= p) s -= c[i - p]!.close;
    if (i >= p - 1) out[i] = s / p;
  }
  return out;
}
function macdHist(c: readonly Candle[]): number[] {
  const f = emaSeries(c, 12), s = emaSeries(c, 26);
  const line = f.map((v, i) => v - s[i]!);
  const a = 2 / 10;
  const sig: number[] = [];
  line.forEach((v, i) => sig.push(i === 0 ? v : v * a + sig[i - 1]! * (1 - a)));
  return line.map((v, i) => v - sig[i]!);
}
/** Estocastico lento (n, suavizacao k, d): devolve [%K, %D]. */
function stoch(c: readonly Candle[], n: number, k: number, d: number): [number[], number[]] {
  const raw: number[] = c.map((_, i) => {
    if (i < n - 1) return NaN;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, c[j]!.high); lo = Math.min(lo, c[j]!.low); }
    return hi === lo ? 50 : ((c[i]!.close - lo) / (hi - lo)) * 100;
  });
  const ma = (x: number[], p: number) => x.map((_, i) => (i < p - 1 + (n - 1) ? NaN : x.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p));
  const K = ma(raw, k);
  const D = K.map((_, i) => (i < n - 1 + k - 1 + d - 1 ? NaN : K.slice(i - d + 1, i + 1).reduce((a, b) => a + b, 0) / d));
  return [K, D];
}

type Cfg = { label: string; macd: boolean; stoch: boolean; sn: number; stopAtr: number };

function run(c: Candle[], cfg: Cfg, cost: number, endIdx: number): Trade[] {
  const s20 = sma(c, 20), s200 = sma(c, 200), h = macdHist(c), atr = atrSeries(c, 14);
  const [K, D] = stoch(c, cfg.sn, 3, 3);
  const trades: Trade[] = [];
  let pos: { side: 1 | -1; entry: number; i: number; stop?: number } | null = null;
  const close = (exit: number, j: number, why: Trade["outcome"]) => {
    const p = pos!;
    const gross = (p.side * (exit - p.entry)) / p.entry;
    const risk = p.stop !== undefined ? Math.abs(p.entry - p.stop) : null;
    trades.push({
      tag: cfg.label, side: p.side > 0 ? "LONG" : "SHORT", entryTime: c[p.i]!.timestamp, entry: p.entry, exit,
      grossPct: gross, netPct: gross - cost, r: risk ? (p.side * (exit - p.entry)) / risk : null,
      netR: risk ? (p.side * (exit - p.entry)) / risk - (cost * p.entry) / risk : null, outcome: why,
    });
    pos = null; void j;
  };
  for (let i = 201; i < endIdx; i++) {
    // dentro da vela i so se sabe: velas <= i-1 fechadas e a abertura de i
    const bar = c[i]!;
    if (pos?.stop !== undefined) {
      const hit = pos.side > 0 ? bar.low <= pos.stop : bar.high >= pos.stop;
      if (hit) { close(pos.side > 0 ? Math.min(bar.open, pos.stop) : Math.max(bar.open, pos.stop), i, "STOP"); }
    }
    const p = i - 1, q = i - 2;
    const crossUp = s20[q]! <= s200[q]! && s20[p]! > s200[p]!;
    const crossDn = s20[q]! >= s200[q]! && s20[p]! < s200[p]!;
    if (pos && ((pos.side > 0 && crossDn) || (pos.side < 0 && crossUp))) close(bar.open, i, "TEMPO");
    if (!pos && (crossUp || crossDn)) {
      const side: 1 | -1 = crossUp ? 1 : -1;
      const okMacd = !cfg.macd || (side > 0 ? h[p]! > 0 : h[p]! < 0);
      const okSto = !cfg.stoch || (side > 0 ? K[p]! > D[p]! : K[p]! < D[p]!);
      if (okMacd && okSto) pos = { side, entry: bar.open, i, stop: cfg.stopAtr > 0 ? bar.open - side * cfg.stopAtr * atr[p]! : undefined };
    }
  }
  return trades;
}

const series = await loadHourly(symbol);
const c = series.candles;
const cut = vaultCut(c, 6);
const endIdx = c.findIndex((x) => x.timestamp >= cut);
console.log(`\n${symbol}: ${c.length} velas 1H, pesquisa = ate ${new Date(cut).toISOString().slice(0, 10)} (${endIdx} velas); custo ${costPct}%`);
const cfgs: Cfg[] = [
  { label: "A) so cruzamento", macd: false, stoch: false, sn: 5, stopAtr: 0 },
  { label: "B) +MACD", macd: true, stoch: false, sn: 5, stopAtr: 0 },
  { label: "C) +Estoc 5,3,3", macd: false, stoch: true, sn: 5, stopAtr: 0 },
  { label: "D) +MACD+Estoc 5,3,3", macd: true, stoch: true, sn: 5, stopAtr: 0 },
  { label: "E) +MACD+Estoc 14,3,3", macd: true, stoch: true, sn: 14, stopAtr: 0 },
  { label: "F) D + stop 3xATR", macd: true, stoch: true, sn: 5, stopAtr: 3 },
];
const all: Trade[] = [];
for (const cfg of cfgs) all.push(...run(c, cfg, costPct / 100, endIdx));
report(`${symbol} | SMA20 x SMA200 1H | saida no cruzamento oposto`, all);
