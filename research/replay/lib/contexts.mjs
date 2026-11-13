// Como a situacao de mercado e apresentada a LLM no replay. Cada formato e uma hipotese a medir.
import { snapshot, lastClosedIdx } from "./indicators.mjs";

const r = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(d)));

function stochHint(label, cross) {
  // texto IGUAL ao directionalHint do motor (atr.ts)
  const base = label === "SOBREVENDIDO"
    ? "SOBREVENDIDO = exaustao da QUEDA, favorece COMPRA (LONG), NUNCA abrir venda (SHORT) por causa disto."
    : label === "SOBRECOMPRADO"
      ? "SOBRECOMPRADO = exaustao da ALTA, favorece VENDA (SHORT), NUNCA abrir compra (LONG) por causa disto."
      : "NEUTRO = sem exaustao, o Estocastico sozinho NAO favorece nenhum lado.";
  const c = cross === "CIMA" ? " %K cruzou %D PARA CIMA = gatilho de COMPRA (LONG)." : cross === "BAIXO" ? " %K cruzou %D PARA BAIXO = gatilho de VENDA (SHORT)." : "";
  return base + c;
}

/** Swings por fractal (n velas de cada lado), so com velas ja fechadas. */
function swings(c, from, to, n = 2) {
  const out = [];
  for (let i = Math.max(from + n, n); i <= to - n; i++) {
    let hi = true, lo = true;
    for (let k = 1; k <= n; k++) {
      if (!(c[i].h > c[i - k].h && c[i].h >= c[i + k].h)) hi = false;
      if (!(c[i].l < c[i - k].l && c[i].l <= c[i + k].l)) lo = false;
    }
    if (hi) out.push({ i, tipo: "TOPO", preco: c[i].h });
    if (lo) out.push({ i, tipo: "FUNDO", preco: c[i].l });
  }
  return out;
}
function structureLabel(sw) {
  const tops = sw.filter((s) => s.tipo === "TOPO").slice(-3), bots = sw.filter((s) => s.tipo === "FUNDO").slice(-3);
  const seq = (a) => a.slice(1).map((s, k) => (s.preco > a[k].preco ? "maior" : "menor"));
  return { topos: seq(tops), fundos: seq(bots) };
}
function candlesTable(c, from, to, ref) {
  // OHLC em % relativo ao preco atual (compacto, sem casas inuteis)
  const rows = [];
  for (let i = from; i <= to; i++) {
    const x = c[i];
    rows.push(`${new Date(x.t).toISOString().slice(11, 16)} ${r((x.o / ref - 1) * 100, 3)} ${r((x.h / ref - 1) * 100, 3)} ${r((x.l / ref - 1) * 100, 3)} ${r((x.c / ref - 1) * 100, 3)}`);
  }
  return rows.join("\n");
}

export function buildSituation(ctx, symbol, t, spreadPct) {
  const s = snapshot(ctx, t);
  if (!s) return null;
  const { m5, h1 } = ctx;
  const i = s.i, j = lastClosedIdx(h1, 3_600_000, t);
  if (i < 300 || j < 48) return null;
  const i24 = lastClosedIdx(m5, 300_000, t - 24 * 3600e3);
  const ch24 = i24 >= 0 ? (s.price / m5[i24].c - 1) * 100 : null;
  let hi24 = -Infinity, lo24 = Infinity;
  for (let q = Math.max(0, i - 287); q <= i; q++) { hi24 = Math.max(hi24, m5[q].h); lo24 = Math.min(lo24, m5[q].l); }
  return { s, i, j, ch24, hi24, lo24, symbol, t, spreadPct };
}

/** Formato A: rotulos no estilo de get_mt5_quote de hoje (com as dicas de direcao do motor). */
export function formatRotulos(sit) {
  const { s, ch24, symbol, spreadPct } = sit;
  return JSON.stringify({
    symbol, price: s.price, changePercent24h: r(ch24), spreadPct,
    marketDirection: { consensus: s.consensus, detalhe: `24h ${r(ch24)}%, 5m ${s.trend5}, 1H ${s.trend1h}` },
    trend: { changePct: r(s.ch5, 3), label: s.trend5, lookbackMinutes: 60 },
    trendLongTerm: { changePct: r(s.ch1h, 3), label: s.trend1h, lookbackMinutes: 1440 },
    stochastic: { k: r(s.stochK), d: r(s.stochD), label: s.stochLabel, crossing: s.stochCross ? `CRUZOU_PARA_${s.stochCross}` : null, directionalHint: stochHint(s.stochLabel, s.stochCross) },
    stochasticLongTerm: { k: r(s.stochHK) },
    macd: { histogram: r(s.macdHist, 6), turning: s.macdTurning === "SUBINDO" ? "VIRANDO_PARA_CIMA" : s.macdTurning === "CAINDO" ? "VIRANDO_PARA_BAIXO" : null },
    movingAverages: { ema9: r(s.ema9, 5), sma20: r(s.sma20, 5), sma200: r(s.sma200, 5) },
    atrPct: r(s.atrPct * 100, 3),
  }, null, 1);
}

/** Formato B: o GRAFICO -- velas, estrutura de topos/fundos, posicao no range. Sem dicas de direcao. */
export function formatGrafico(sit, ctx) {
  const { s, i, j, ch24, hi24, lo24, symbol, spreadPct } = sit;
  const { m5, h1 } = ctx;
  const sw5 = swings(m5, i - 60, i), sw1 = swings(h1, j - 72, j);
  const st5 = structureLabel(sw5), st1 = structureLabel(sw1);
  const fmtSw = (sw, c) => sw.slice(-6).map((x) => `${x.tipo} ${r((x.preco / s.price - 1) * 100, 3)}% (${new Date(c[x.i].t).toISOString().slice(11, 16)})`).join("; ");
  const posRange = hi24 > lo24 ? ((s.price - lo24) / (hi24 - lo24)) * 100 : null;
  return [
    `ATIVO ${symbol} | preco ${s.price} | hora UTC ${new Date(sit.t).toISOString().slice(0, 16)}`,
    `Custo (spread ida+volta): ${spreadPct}% | ATR 5m: ${r(s.atrPct * 100, 3)}% do preco | stop tipico do motor: ~${r(s.atrPct * 200, 2)}%`,
    `Ultimas 24h: variacao ${r(ch24)}%, maxima +${r((hi24 / s.price - 1) * 100, 2)}%, minima ${r((lo24 / s.price - 1) * 100, 2)}%, preco a ${r(posRange, 0)}% do range (0 = na minima, 100 = na maxima)`,
    `Estrutura 1H (ultimos topos/fundos, % do preco atual): ${fmtSw(sw1, h1) || "sem swings claros"}`,
    `  sequencia 1H: topos ${st1.topos.join(",") || "-"} | fundos ${st1.fundos.join(",") || "-"}`,
    `Estrutura 5m: ${fmtSw(sw5, m5) || "sem swings claros"}`,
    `  sequencia 5m: topos ${st5.topos.join(",") || "-"} | fundos ${st5.fundos.join(",") || "-"}`,
    `Medias 5m (% do preco): EMA9 ${r((s.ema9 / s.price - 1) * 100, 3)} | SMA20 ${r((s.sma20 / s.price - 1) * 100, 3)} | SMA200 ${r((s.sma200 / s.price - 1) * 100, 3)}`,
    `Estocastico 5m K=${r(s.stochK, 0)} D=${r(s.stochD, 0)} | Estocastico 1H K=${r(s.stochHK, 0)} | MACD hist 5m ${s.macdTurning ?? "-"}`,
    ``,
    `Velas 1H (hora UTC, abertura/maxima/minima/fechamento em % do preco atual), ultimas 24:`,
    candlesTable(h1, j - 23, j, s.price),
    ``,
    `Velas 5m, ultimas 36:`,
    candlesTable(m5, i - 35, i, s.price),
  ].join("\n");
}

export const SYSTEM_ROTULOS = `Voce e o motor de decisao de um robo de day trade (CFD, scalp em 5 minutos).
Recebe a cotacao e os indicadores de UM ativo agora e decide: abrir COMPRA (LONG), VENDA (SHORT) ou NAO operar (NONE).
Saida do robo e mecanica: stop ~2x ATR, alvo ~3x ATR, parcial em 1R, stop no zero a zero em +0,35R.
Responda SOMENTE com JSON: {"decisao":"LONG|SHORT|NONE","confianca":0-100,"motivo":"uma frase"}`;

export const SYSTEM_SENIOR = `Voce e um trader profissional senior de day trade (CFD). Vai ler o GRAFICO de um ativo e decidir a proxima operacao.
Decisao: COMPRA (LONG), VENDA (SHORT) ou NAO operar (NONE). A saida e mecanica: stop ~2x ATR 5m, alvo ~3x ATR, parcial em 1R, stop no zero a zero em +0,35R.

Como um senior le o mercado:
1. Estrutura primeiro. Tendencia de alta = topos e fundos MAIORES; de baixa = topos e fundos MENORES. Opere a favor da estrutura do 1H; use o 5m so para o momento de entrada.
2. Em tendencia, entre no pullback (correcao contra a tendencia que perde forca), nao no esticado. Preco colado na minima do dia em queda nao e "barato": sobrevendido em tendencia de baixa e sinal de FORCA vendedora, nao de fundo.
3. Reversao so com evidencia na estrutura: rompimento do ultimo topo/fundo relevante e falha em fazer novo extremo. Indicador sozinho nao e reversao.
4. Lateral/sem estrutura clara, ou meio do range sem vantagem: NONE.
5. Custo: se o spread for uma fracao grande do stop tipico, so opere movimentos muito claros; na duvida, NONE.
6. NONE e uma decisao profissional valida. Opere so quando a leitura for clara.

Responda SOMENTE com JSON: {"decisao":"LONG|SHORT|NONE","confianca":0-100,"motivo":"uma frase citando a estrutura"}`;
