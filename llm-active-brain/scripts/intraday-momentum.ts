// Ideia 2 (15/10): momento intradiario de indice -- Gao, Han, Li e Zhou (2018), "Market Intraday Momentum",
// Journal of Financial Economics. O retorno do inicio do pregao (noite + primeira meia hora) ajuda a prever o da
// ultima meia hora. Aqui com velas de 1H do Yahoo: a 1a vela do pregao tem 1 hora e a ULTIMA tem 30 min
// (EUA 15:30-16:00, DAX 17:00-17:30, Nikkei 15:00-15:30), que e exatamente a janela operada.
//
// Variantes registradas ANTES de rodar (3, nao mais):
//   A "noite + 1a hora": sinal = fechamento da 1a vela / fechamento do pregao anterior - 1
//   B "so 1a hora":      sinal = fechamento da 1a vela / abertura da 1a vela - 1
//   C "controle":        sempre compra a ultima meia hora (mede o vies de alta do horario, sem sinal)
// Entra a mercado na abertura da ultima vela, sai no fechamento dela (1 vela, sem stop). Motor: scripts/lib/harness.ts.
// Uso: npx tsx scripts/intraday-momentum.ts [CUSTO_EXTRA_PCT=0] [--cofre]
import { loadHourly, localTime, report, runBacktest, type Strategy } from "./lib/harness.js";

// custo de ida e volta = spread mediano REAL medido na Infinox (market_spread_samples, 05-15/10, hora do fechamento
// de cada bolsa) + margem de 0,005% para comissao/derrapagem. CUSTO_EXTRA soma por cima (teste de folga).
const MARKETS: { symbol: string; broker: string; first: string; last: string; spreadPct: number }[] = [
  { symbol: "^GSPC", broker: "SPX500", first: "09:30", last: "15:30", spreadPct: 0.0056 },
  { symbol: "^NDX", broker: "NAS100", first: "09:30", last: "15:30", spreadPct: 0.0029 },
  { symbol: "^GDAXI", broker: "GER40", first: "09:00", last: "17:00", spreadPct: 0.004 },
  { symbol: "^N225", broker: "JPN225", first: "09:00", last: "15:00", spreadPct: 0.0103 },
];
const extra = Number(process.argv[2] ?? 0);
const period = process.argv.includes("--cofre") ? "cofre" : "pesquisa";

function strategyFor(m: (typeof MARKETS)[number], tz: string, variant: "A" | "B" | "C" | "D"): Strategy {
  return (c) => {
    const lt = c.map((x) => localTime(x.timestamp, tz)); // so lt[k] com k < i e lido abaixo
    return (i, openTime) => {
      const now = localTime(openTime, tz);
      if (now.hhmm !== m.last) return null;
      let k = i - 1;
      while (k >= 0 && lt[k]!.date === now.date) k--;
      const first = k + 1; // 1a vela de hoje
      if (first > i - 1 || k < 0 || lt[first]!.hhmm !== m.first) return null; // pregao incompleto: nao opera
      const prevClose = c[k]!.close;
      const sig = variant === "A" ? c[first]!.close / prevClose - 1 : variant === "D" ? -(c[first]!.close / prevClose - 1) : variant === "B" ? c[first]!.close / c[first]!.open - 1 : 1;
      if (sig === 0) return null;
      const tag = variant === "D" ? "D contra noite+1a hora" : variant === "A" ? "A noite+1a hora" : variant === "B" ? "B so 1a hora" : "C controle (compra)";
      return { side: sig > 0 ? "LONG" : "SHORT", entry: { type: "market" }, maxBars: 1, tag };
    };
  };
}

// Hipotese D (registrada em SESSAO_2026-10-14..., Parte 5, ANTES de abrir o cofre): so Nikkei, contra o sinal A.
const onlyD = process.argv.includes("--hipotese-d");
for (const m of onlyD ? MARKETS.filter((x) => x.broker === "JPN225") : MARKETS) {
  const series = await loadHourly(m.symbol);
  const cost = m.spreadPct + 0.005 + extra;
  const all = (onlyD ? (["D"] as const) : (["A", "B", "C"] as const)).flatMap((v) =>
    runBacktest(series, strategyFor(m, series.timezone, v), { name: `momento-intradiario-${v}`, costPct: cost, warmup: 30, period }),
  );
  report(`${m.symbol} (${m.broker}) | ultima meia hora | custo ${cost.toFixed(4)}% | periodo: ${period.toUpperCase()}`, all);
}
