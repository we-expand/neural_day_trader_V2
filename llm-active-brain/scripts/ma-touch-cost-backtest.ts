// Gatilho D com CUSTO e em INDICES (pendencia 3 da sessao 14/10).
// Mesmo evento do ma-touch-backtest.ts: 1o toque na EMA9 (1H) vindo do lado da tendencia, sem look-ahead.
// Agora vira TRADE: entra na EMA9 a favor da tendencia, stop A ATR do outro lado, alvo A ATR a favor (R:R 1:1),
// saida no fechamento da vela H se nada bater. Desconta custo de ida e volta (% do preco) convertido em R.
// Fontes: cripto = Binance (BTCUSDT...), indices = Yahoo Finance (^N225, ^GSPC, NQ=F, ^GDAXI), 2 anos.
// Uso: npx tsx scripts/ma-touch-cost-backtest.ts SIMBOLO CUSTO_PCT_IDA_E_VOLTA [A=1] [H=12]
import { computeFibCorridor, type FibCandle } from "../src/fibCorridor.js";
const symbol = process.argv[2] ?? "BTCUSDT", costPct = Number(process.argv[3] ?? 0.07) / 100;
const A = Number(process.argv[4] ?? 1), H = Number(process.argv[5] ?? 12);

async function load(): Promise<FibCandle[]> {
  const c: FibCandle[] = [];
  if (/USDT$/.test(symbol)) {
    let start = Date.now() - 2 * 365 * 86400_000;
    while (start < Date.now()) {
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&limit=1000`);
      const rows = (await r.json()) as unknown[][]; if (!rows.length) break;
      for (const k of rows) c.push({ timestamp: Number(k[0]), open: +k[1]!, high: +k[2]!, low: +k[3]!, close: +k[4]! });
      start = Number(rows[rows.length - 1]![0]) + 3600_000; if (rows.length < 1000) break;
    }
    return c;
  }
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=2y`, { headers: { "User-Agent": "Mozilla/5.0" } });
  const d = (await r.json()) as any; const res = d.chart.result[0]; const q = res.indicators.quote[0];
  res.timestamp.forEach((t: number, i: number) => {
    if ([q.open[i], q.high[i], q.low[i], q.close[i]].some((v) => v == null)) return; // vela vazia: descarta, nunca inventa
    c.push({ timestamp: t * 1000, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] });
  });
  return c;
}

const c = await load();
const ema: number[] = [], atr: number[] = [];
c.forEach((x, i) => {
  ema.push(i === 0 ? x.close : x.close * 0.2 + ema[i - 1] * 0.8);
  const tr = i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close));
  atr.push(i === 0 ? tr : (atr[i - 1] * 13 + tr) / 14);
});
type Acc = { n: number; win: number; loss: number; rBruto: number; rLiq: number; custoR: number };
const acc: Record<string, Acc> = {};
for (let i = 80; i < c.length - H; i++) {
  // SEM look-ahead: o nivel e a EMA9/ATR da vela ANTERIOR (conhecidos na abertura da vela i); ordem limite nesse nivel.
  const lvl = ema[i - 1];
  const baixa = c[i].high >= lvl && c[i - 1].high < ema[i - 2];
  const alta = c[i].low <= lvl && c[i - 1].low > ema[i - 2];
  if (!baixa && !alta) continue;
  const dir = baixa ? "BAIXA" : "ALTA";
  const cor = computeFibCorridor(c.slice(i - 74, i), { tf: "1H", window: 72 });
  const k = `${dir} ${cor && cor.direcao === dir ? "EM EXPANSAO" : "fora      "}`;
  const entry = lvl, risk = A * atr[i - 1]; if (!(risk > 0)) continue;
  const sgn = dir === "BAIXA" ? -1 : 1; // BAIXA = venda
  let r: number | null = null, out: "W" | "L" | "N" = "N";
  for (let j = i; j <= i + H; j++) {
    const stopHit = sgn < 0 ? c[j].high >= entry + risk : c[j].low <= entry - risk;
    const tgtHit = sgn < 0 ? c[j].low <= entry - risk : c[j].high >= entry + risk;
    if (stopHit) { r = -1; out = "L"; break; } // na vela do toque so conta o stop (ordem do preenchimento desconhecida); mesma vela: stop (conservador)
    if (tgtHit && j > i) { r = 1; out = "W"; break; }
  }
  if (r === null) r = (sgn * (c[i + H].close - entry)) / risk; // saida por tempo, marcada a mercado
  const custoR = (costPct * entry) / risk;
  const a = (acc[k] ??= { n: 0, win: 0, loss: 0, rBruto: 0, rLiq: 0, custoR: 0 });
  a.n++; if (out === "W") a.win++; if (out === "L") a.loss++;
  a.rBruto += r; a.rLiq += r - custoR; a.custoR += custoR;
}
const anos = (c[c.length - 1].timestamp - c[0].timestamp) / (365 * 86400_000);
console.log(`${symbol} | ${c.length} velas 1H (${anos.toFixed(1)} anos) | custo ida+volta ${(costPct * 100).toFixed(3)}% | stop=alvo=${A} ATR | saida max ${H}h`);
for (const [k, a] of Object.entries(acc).sort()) {
  const dec = a.win + a.loss, p = dec ? a.win / dec : 0, e = dec ? 196 * Math.sqrt((p * (1 - p)) / dec) : 0;
  console.log(`  ${k} trades=${String(a.n).padStart(4)} | alvo antes do stop ${(p * 100).toFixed(1)}% (±${e.toFixed(1)}pp) | E[R] bruto ${(a.rBruto / a.n).toFixed(3)} | custo ${(a.custoR / a.n).toFixed(3)}R | E[R] LIQUIDO ${(a.rLiq / a.n).toFixed(3)}`);
}
