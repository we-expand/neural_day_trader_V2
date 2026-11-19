// Prova do motor (scripts/lib/harness.ts): refaz o toque na media de 9 de 14/10.
// Sem argumento: versao correta (nivel da vela anterior) -> deve bater com o ma-touch-cost-backtest.ts corrigido (~50%).
// Com --com-vazamento: usa a media da PROPRIA vela (o erro de 14/10) -> a canaria TEM de recusar e o teste nao roda.
// Uso: npx tsx scripts/harness-ma-touch.ts SIMBOLO CUSTO_PCT [--com-vazamento]
import { computeFibCorridor } from "../src/fibCorridor.js";
import { atrSeries, emaSeries, loadHourly, report, runBacktest, type Strategy } from "./lib/harness.js";

const symbol = process.argv[2] ?? "BTCUSDT";
const costPct = Number(process.argv[3] ?? 0.07);
const leak = process.argv.includes("--com-vazamento");

const strategy: Strategy = (c) => {
  const ema = emaSeries(c, 9);
  const atr = atrSeries(c, 14);
  return (i) => {
    if (i < 80) return null;
    const below = c[i - 1]!.high < ema[i - 2]!;
    const above = c[i - 1]!.low > ema[i - 2]!;
    if (!below && !above) return null;
    const lvl = leak ? ema[i]! : ema[i - 1]!; // o vazamento: ema[i] usa o fechamento da vela i
    const a = atr[i - 1]!;
    const dir = below ? "BAIXA" : "ALTA";
    const cor = computeFibCorridor(c.slice(i - 74, i), { tf: "1H", window: 72 });
    const sgn = below ? -1 : 1;
    return {
      side: below ? "SHORT" : "LONG",
      entry: { type: "limit", price: lvl },
      stop: lvl - sgn * a,
      target: lvl + sgn * a,
      maxBars: 13,
      tag: `${dir} ${cor && cor.direcao === dir ? "em expansao" : "fora"}`,
    };
  };
};

const series = await loadHourly(symbol);
try {
  const trades = runBacktest(series, strategy, { name: "toque-media-9", costPct, warmup: 80, period: "pesquisa" });
  report(`${symbol} | toque na EMA9 (1H) | custo ${costPct}% | periodo de PESQUISA (cofre de 6 meses fechado)`, trades);
} catch (err) {
  console.log(`${symbol}: ${err instanceof Error ? err.message : err}`);
}
