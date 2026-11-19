// Pesquisa 20/10 (pedido do Cleber: "vai atras do que ja funciona la fora"): Zarattini, Aziz e Barbon (2024),
// "Beat the Market: An Effective Intraday Momentum Strategy for S&P500 ETF (SPY)" -- SSRN 4824172. Relatado pelos
// autores: SPY 2007-2024, Sharpe 1,33 liquido. Replicacao informal no TradingView: "bom, mas bem pior que o paper".
//
// Regra (adaptada para velas de 1H do Yahoo -- o paper decide a cada 30 min com dado de 1 min):
//   faixa de ruido da hora t = media, nos 14 pregoes anteriores, de |fechamento da vela t / abertura do dia - 1|
//   teto = max(abertura de hoje, fechamento de ontem) x (1 + sigma_t); piso = min(...) x (1 - sigma_t)
//   vela t fechou ACIMA do teto -> compra na abertura da proxima; ABAIXO do piso -> vende.
// Variantes registradas ANTES de rodar (2, nao mais):
//   V1 "stop na faixa": stop no limite da faixa do momento da entrada, sai no fechamento do pregao
//   V2 "sem stop":      sai no fechamento do pregao
// Motor: scripts/lib/harness.ts (canaria contra vazamento de futuro + cofre de 6 meses).
// Uso: npx tsx scripts/noise-area-momentum.ts [CUSTO_EXTRA_PCT=0] [--cofre]
import { loadHourly, localTime, report, runBacktest, type Strategy } from "./lib/harness.js";

// spread mediano REAL medido na Infinox (market_spread_samples) + 0,005% de comissao/derrapagem -- mesmo criterio de
// scripts/intraday-momentum.ts
const MARKETS = [
  { symbol: "^GSPC", broker: "SPX500", spreadPct: 0.0056 },
  { symbol: "^NDX", broker: "NAS100", spreadPct: 0.0029 },
  { symbol: "^GDAXI", broker: "GER40", spreadPct: 0.004 },
];
const LOOKBACK_DAYS = 14;
const extra = Number(process.argv[2] ?? 0);
const period = process.argv.includes("--cofre") ? "cofre" : "pesquisa";

function strategyFor(tz: string, variant: "V1" | "V2"): Strategy {
  return (c) => {
    const lt = c.map((x) => localTime(x.timestamp, tz));
    return (i, openTime) => {
      const now = localTime(openTime, tz);
      const j = i - 1; // ultima vela fechada (a que da o sinal)
      if (j < 0 || lt[j]!.date !== now.date) return null; // a vela de sinal tem de ser de hoje (nao opera na 1a vela)
      // inicio de hoje e pregao anterior -- so velas < i
      let f = j;
      while (f - 1 >= 0 && lt[f - 1]!.date === now.date) f--;
      if (f - 1 < 0) return null;
      const dayOpen = c[f]!.open;
      const prevClose = c[f - 1]!.close;
      const hhmm = lt[j]!.hhmm;
      // sigma da hora hhmm nos 14 pregoes anteriores (todos fechados, antes de f)
      const moves: number[] = [];
      let k = f - 1;
      while (k >= 0 && moves.length < LOOKBACK_DAYS) {
        const d = lt[k]!.date;
        let s = k;
        while (s - 1 >= 0 && lt[s - 1]!.date === d) s--;
        for (let q = s; q <= k; q++) if (lt[q]!.hhmm === hhmm) { moves.push(Math.abs(c[q]!.close / c[s]!.open - 1)); break; }
        k = s - 1;
      }
      if (moves.length < LOOKBACK_DAYS) return null;
      const sigma = moves.reduce((a, b) => a + b, 0) / moves.length;
      const upper = Math.max(dayOpen, prevClose) * (1 + sigma);
      const lower = Math.min(dayOpen, prevClose) * (1 - sigma);
      const px = c[j]!.close;
      const side = px > upper ? "LONG" : px < lower ? "SHORT" : null;
      if (!side) return null;
      // velas que faltam hoje, pelo formato do pregao anterior (passado): da vela i ate o fim
      let pe = f - 1, ps = pe;
      while (ps - 1 >= 0 && lt[ps - 1]!.date === lt[pe]!.date) ps--;
      const sessionLen = pe - ps + 1;
      const idxToday = i - f; // posicao da vela i no pregao de hoje
      const maxBars = sessionLen - idxToday;
      if (maxBars < 1) return null;
      return {
        side,
        entry: { type: "market" },
        stop: variant === "V1" ? (side === "LONG" ? upper : lower) : undefined,
        maxBars,
        tag: `${variant} ${side}`,
      };
    };
  };
}

for (const m of MARKETS) {
  const series = await loadHourly(m.symbol);
  const cost = m.spreadPct + 0.005 + extra;
  const all = (["V1", "V2"] as const).flatMap((v) =>
    runBacktest(series, strategyFor(series.timezone, v), { name: `noise-area-${v}`, costPct: cost, warmup: 200, period }),
  );
  report(`${m.symbol} (${m.broker}) | faixa de ruido | custo ${cost.toFixed(4)}% | periodo: ${period.toUpperCase()}`, all);
}
