// Resumo estatistico: acerto com IC 95% (Wilson), expectativa em R com IC 95% e t.
export function summarize(rs) {
  const n = rs.length;
  if (!n) return { n: 0 };
  const wins = rs.filter((r) => r > 0).length;
  const p = wins / n, z = 1.96;
  const den = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  const mean = rs.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(rs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const se = sd / Math.sqrt(n);
  return {
    n, wins, winPct: 100 * p, winLo: 100 * (mid - half), winHi: 100 * (mid + half),
    meanR: mean, meanLo: mean - z * se, meanHi: mean + z * se, t: se > 0 ? mean / se : 0, sumR: mean * n,
  };
}

export function fmt(s) {
  if (!s.n) return "n=0";
  return `n=${String(s.n).padStart(4)}  acerto ${s.winPct.toFixed(1).padStart(5)}% [${s.winLo.toFixed(0)}-${s.winHi.toFixed(0)}]  ` +
    `E[R] ${s.meanR >= 0 ? "+" : ""}${s.meanR.toFixed(3)} [${s.meanLo.toFixed(2)}, ${s.meanHi.toFixed(2)}] t=${s.t.toFixed(2)}  soma ${s.sumR.toFixed(1)}R`;
}
