// Pesquisa 21/10/2026 (pedido do Cleber): o mesmo teste do BTC (entrada com estocastico 1h esticado: ANTES da curva vs NA curva) em ouro e indices,
// onde o custo e bem menor. Regras fixadas antes de rodar: estocastico lento 1h (5,3,3); ANTES = K>80 e K>D (venda) / K<20 e K<D (compra);
// CURVA = esteve esticado nas ultimas 4 velas e CRUZOU para tras agora. Entra no fechamento da vela do sinal. Stop = 2x ATR(14) de 1h.
// Saida: estocastico oposto (<20 venda / >80 compra) ou 48 velas. Stop primeiro se ambos na mesma vela. Custo de ida e volta em % do preco =
// spread real medido (market_spread_samples) + comissao publicada da Infinox (indices $2/lote, ouro $7/lote de 100 oz), com folga.
// Resultado em R (1R = distancia do stop). Uso: npx tsx scripts/rabo-multiativo.mts [--cesta]
import { loadHourly, atrSeries, type Candle } from "./lib/harness.js";

const ASSETS: { symbol: string; nome: string; costPct: number }[] = process.argv.includes("--cesta")
  ? [
      // custo = spread mediano real (14d) + comissao ($1/lote indices, $7/lote forex, $0,7/lote petroleo)
      { symbol: "^RUT", nome: "US2000 / Russell (^RUT)", costPct: 0.05 },
      { symbol: "^FTSE", nome: "UK100 (^FTSE)", costPct: 0.03 },
      { symbol: "^FCHI", nome: "FRA40 (^FCHI)", costPct: 0.13 },
      { symbol: "EURUSD=X", nome: "EURUSD", costPct: 0.016 },
      { symbol: "BZ=F", nome: "UKOUSD / Brent (BZ=F)", costPct: 0.106 },
      { symbol: "ETHUSDT", nome: "ETH (XETUSD)", costPct: 0.106 },
    ]
  : [
      { symbol: "GC=F", nome: "OURO (GC=F)", costPct: 0.008 },
      { symbol: "^NDX", nome: "NAS100 (^NDX)", costPct: 0.011 },
      { symbol: "^GSPC", nome: "SPX500 (^GSPC)", costPct: 0.032 },
      { symbol: "^GDAXI", nome: "GER40 (^GDAXI)", costPct: 0.013 },
      { symbol: "BTCUSDT", nome: "BTC (referencia)", costPct: 0.077 },
    ];
const sma = (v: (number | null)[], n: number) => v.map((_, i) => (i < n - 1 || v.slice(i - n + 1, i + 1).some((x) => x == null) ? null : (v.slice(i - n + 1, i + 1) as number[]).reduce((a, b) => a + b, 0) / n));
function stoch(c: Candle[]) {
  const raw: (number | null)[] = c.map((_, i) => {
    if (i < 4) return null;
    let hh = -Infinity, ll = Infinity;
    for (let k = i - 4; k <= i; k++) { hh = Math.max(hh, c[k]!.high); ll = Math.min(ll, c[k]!.low); }
    return hh === ll ? 50 : (100 * (c[i]!.close - ll)) / (hh - ll);
  });
  const K = sma(raw, 3);
  return { K, D: sma(K, 3) };
}
const MAXB = 48;
function simula(c: Candle[], atr: number[], K: (number | null)[], D: (number | null)[], i: number, side: "S" | "L", costPct: number): number | null {
  const entry = c[i]!.close, riskPts = 2 * atr[i]!;
  if (!(riskPts > 0)) return null;
  const stop = side === "S" ? entry + riskPts : entry - riskPts;
  for (let j = i + 1; j <= i + MAXB && j < c.length; j++) {
    const x = c[j]!;
    if (side === "S" ? x.high >= stop : x.low <= stop) return (-riskPts - (entry * costPct) / 100) / riskPts;
    const kj = K[j];
    if (kj != null && (side === "S" ? kj < 20 : kj > 80)) return ((side === "S" ? entry - x.close : x.close - entry) - (entry * costPct) / 100) / riskPts;
    if (j === i + MAXB) return ((side === "S" ? entry - x.close : x.close - entry) - (entry * costPct) / 100) / riskPts;
  }
  return null;
}
function colhe(c: Candle[], modo: "ANTES" | "CURVA", costPct: number) {
  const { K, D } = stoch(c);
  const atr = atrSeries(c, 14);
  const rs: number[] = [], rsBruto: number[] = [];
  let i = 20;
  while (i < c.length - MAXB - 1) {
    const k = K[i], d = D[i], k1 = K[i - 1], d1 = D[i - 1];
    let side: "S" | "L" | null = null;
    if (k != null && d != null && k1 != null && d1 != null) {
      const sob = [0, 1, 2, 3].some((o) => (K[i - o] ?? 0) > 80), sov = [0, 1, 2, 3].some((o) => (K[i - o] ?? 100) < 20);
      if (modo === "ANTES") { if (k > 80 && k > d) side = "S"; else if (k < 20 && k < d) side = "L"; }
      else { if (sob && k1 >= d1 && k < d) side = "S"; else if (sov && k1 <= d1 && k > d) side = "L"; }
    }
    if (side) {
      const r = simula(c, atr, K, D, i, side, costPct), r0 = simula(c, atr, K, D, i, side, 0);
      if (r != null && r0 != null) { rs.push(r); rsBruto.push(r0); }
      i += 12;
    } else i++;
  }
  return { rs, rsBruto };
}
const med = (v: number[]) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
for (const a of ASSETS) {
  try {
    const s = await loadHourly(a.symbol);
    console.log(`\n${a.nome} | ${s.candles.length} velas 1h (~${Math.round(s.candles.length / 24)} dias de calendario) | custo ${a.costPct.toFixed(3)}% ida e volta`);
    for (const modo of ["ANTES", "CURVA"] as const) {
      const { rs, rsBruto } = colhe(s.candles, modo, a.costPct);
      if (!rs.length) { console.log(`  ${modo}: n=0`); continue; }
      const w = rs.filter((x) => x > 0), l = rs.filter((x) => x <= 0);
      const sd = Math.sqrt(rs.reduce((q, x) => q + (x - med(rs)) ** 2, 0) / Math.max(1, rs.length - 1)), t = sd > 0 ? med(rs) / (sd / Math.sqrt(rs.length)) : 0;
      console.log(`  ${modo.padEnd(5)}: n=${String(rs.length).padStart(3)} | acerto ${(100 * w.length / rs.length).toFixed(0)}% | ganho ${med(w).toFixed(2)}R perda ${med(l).toFixed(2)}R | LIQUIDO ${med(rs) >= 0 ? "+" : ""}${med(rs).toFixed(3)}R/op (t=${t.toFixed(2)}) | antes do custo ${med(rsBruto) >= 0 ? "+" : ""}${med(rsBruto).toFixed(3)}R`);
    }
  } catch (e) { console.log(`\n${a.nome}: ${(e as Error).message}`); }
}
