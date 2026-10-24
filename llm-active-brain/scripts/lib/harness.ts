/**
 * Motor de backtest SEM olhar o futuro + COFRE de dados (ideia 4, sessao 15/10/2026).
 *
 * Por que existe: o projeto ja achou 3 vazamentos de futuro em backtest (Order Block Fade, detectStructureEvents e o
 * toque na media de 9 de 14/10, que dava 69-73% e sem o vazamento caiu para ~50%). Cada script escrevia o proprio laco
 * e o mesmo erro se repetia. Aqui o laco e um so, e a estrategia so decide com o passado.
 *
 * Contrato da estrategia: `strategy(candles)` devolve `decide(i, abertura)`. `decide` monta a ordem que vale para a
 * vela i usando SO as velas 0..i-1 (fechadas) e o horario de abertura da vela i (que e agenda, nao futuro).
 * A CANARIA confere o contrato: decide(i) com o historico inteiro tem de dar a mesma ordem que decide(i) com o
 * historico cortado em i. Se a estrategia ler a vela i (ou depois), a canaria falha e o teste NAO roda.
 *
 * Execucao (conservadora): ordem a mercado entra na abertura da vela i; ordem limite entra no preco limite se a vela i
 * tocar nele (senao e cancelada). Stop furado no gap sai na abertura (pior preco). Se stop e alvo cabem na mesma vela,
 * conta o STOP. Na vela de entrada de uma ordem limite so o stop conta (a ordem dos fatos dentro da vela e desconhecida).
 * Uma posicao por vez. Custo de ida e volta descontado em % do preco de entrada.
 *
 * Cofre: os ultimos N meses (padrao 6) ficam fora da pesquisa. So abrem com ABRIR_COFRE=1, e cada abertura fica
 * registrada em ledger/cofre_aberturas.jsonl -- olhar o cofre varias vezes para a mesma ideia o transforma em pesquisa.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Candle = { timestamp: number; open: number; high: number; low: number; close: number };
export type Order = {
  side: "LONG" | "SHORT";
  entry: { type: "market" } | { type: "limit"; price: number };
  stop?: number;
  target?: number;
  /** quantas velas a posicao pode durar, contando a de entrada (1 = sai no fechamento da propria vela) */
  maxBars: number;
  /** rotulo para separar grupos no relatorio (ex.: "BAIXA em expansao") */
  tag?: string;
};
export type Decide = (i: number, openTime: number) => Order | null;
export type Strategy = (candles: readonly Candle[]) => Decide;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_DIR = join(ROOT, ".cache", "candles");
const VAULT_LOG = join(ROOT, "ledger", "cofre_aberturas.jsonl");

// ---------------------------------------------------------------------------
// Dados reais (nunca inventados). Cache em disco por 12 h para nao martelar as APIs.
// ---------------------------------------------------------------------------
export type Series = { symbol: string; source: "binance" | "yahoo"; timezone: string; candles: Candle[] };

function readCache(key: string): Series | null {
  const p = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(p)) return null;
  const j = JSON.parse(readFileSync(p, "utf8")) as { fetchedAt: number; series: Series };
  return Date.now() - j.fetchedAt < 12 * 3600_000 ? j.series : null;
}
function writeCache(key: string, series: Series): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify({ fetchedAt: Date.now(), series }));
}

/** Cripto (Binance, ex. BTCUSDT) ou indice/ativo do Yahoo Finance (ex. ^GSPC, ^NDX, ^GDAXI, ^N225), 1H, ~2 anos. */
export async function loadHourly(symbol: string): Promise<Series> {
  const key = `1h_${symbol.replace(/[^A-Za-z0-9]/g, "_")}`;
  const cached = readCache(key);
  if (cached) return cached;
  let series: Series;
  if (/USDT$/.test(symbol)) {
    const candles: Candle[] = [];
    let start = Date.now() - 2 * 365 * 86400_000;
    while (start < Date.now()) {
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&limit=1000`);
      if (!r.ok) throw new Error(`Binance ${symbol}: HTTP ${r.status}`);
      const rows = (await r.json()) as unknown[][];
      if (!rows.length) break;
      for (const k of rows) candles.push({ timestamp: Number(k[0]), open: +k[1]!, high: +k[2]!, low: +k[3]!, close: +k[4]! });
      start = Number(rows[rows.length - 1]![0]) + 3600_000;
      if (rows.length < 1000) break;
    }
    series = { symbol, source: "binance", timezone: "UTC", candles };
  } else {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=2y`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) throw new Error(`Yahoo ${symbol}: HTTP ${r.status}`);
    const res = ((await r.json()) as any).chart.result?.[0];
    if (!res) throw new Error(`Yahoo ${symbol}: sem dado`);
    const q = res.indicators.quote[0];
    const candles: Candle[] = [];
    (res.timestamp as number[]).forEach((t, i) => {
      const v = [q.open[i], q.high[i], q.low[i], q.close[i]];
      if (v.some((x: unknown) => x == null || !Number.isFinite(x as number))) return; // vela vazia: descarta, nunca inventa
      candles.push({ timestamp: t * 1000, open: v[0], high: v[1], low: v[2], close: v[3] });
    });
    series = { symbol, source: "yahoo", timezone: res.meta.exchangeTimezoneName ?? "UTC", candles };
  }
  if (series.candles.length < 500) throw new Error(`${symbol}: so ${series.candles.length} velas -- dado insuficiente`);
  writeCache(key, series);
  return series;
}

/** Data e hora locais da bolsa ("2026-10-14", "15:30") a partir do horario de abertura da vela. */
export function localTime(ts: number, timezone: string): { date: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hhmm: `${g("hour")}:${g("minute")}` };
}

// ---------------------------------------------------------------------------
// Canaria: prova que a estrategia nao le o futuro.
// ---------------------------------------------------------------------------
export function checkNoLookahead(strategy: Strategy, candles: readonly Candle[], warmup: number, samples = 150): void {
  const full = strategy(candles);
  const n = candles.length;
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  // sempre testa tambem pontos onde a estrategia DECIDE algo (e ai que o vazamento aparece)
  const withOrder: number[] = [];
  for (let i = warmup; i < n && withOrder.length < samples; i += Math.max(1, Math.floor((n - warmup) / (samples * 20)))) {
    if (full(i, candles[i]!.timestamp)) withOrder.push(i);
  }
  const points = [...withOrder.slice(0, samples), ...Array.from({ length: samples }, () => warmup + Math.floor(rand() * (n - warmup)))];
  for (const i of points) {
    const a = JSON.stringify(full(i, candles[i]!.timestamp));
    let b: string;
    try {
      b = JSON.stringify(strategy(candles.slice(0, i))(i, candles[i]!.timestamp));
    } catch (err) {
      throw new Error(`CANARIA: a estrategia quebrou sem a vela ${i} (ela le o futuro?): ${err instanceof Error ? err.message : err}`);
    }
    if (a !== b) throw new Error(`CANARIA: decisao na vela ${i} muda quando o futuro some -- a estrategia OLHA O FUTURO.\n  com futuro: ${a}\n  sem futuro: ${b}`);
  }
}

// ---------------------------------------------------------------------------
// Execucao
// ---------------------------------------------------------------------------
export type Trade = {
  tag: string; side: "LONG" | "SHORT"; entryTime: number; entry: number; exit: number;
  grossPct: number; netPct: number; r: number | null; netR: number | null; outcome: "ALVO" | "STOP" | "TEMPO";
};

export type RunOptions = {
  name: string;
  costPct: number; // ida e volta, em % (0.03 = 0,03%)
  warmup: number;
  vaultMonths?: number; // padrao 6
  period: "pesquisa" | "cofre";
};

export function vaultCut(candles: readonly Candle[], vaultMonths = 6): number {
  return candles[candles.length - 1]!.timestamp - vaultMonths * 30.44 * 86400_000;
}

export function runBacktest(series: Series, strategy: Strategy, opt: RunOptions): Trade[] {
  const c = series.candles;
  checkNoLookahead(strategy, c, opt.warmup);
  const cut = vaultCut(c, opt.vaultMonths ?? 6);
  if (opt.period === "cofre") {
    if (process.env.ABRIR_COFRE !== "1") throw new Error("O cofre esta fechado. So abra com ABRIR_COFRE=1, uma vez, quando a ideia ja estiver decidida na pesquisa.");
    const prior = existsSync(VAULT_LOG)
      ? readFileSync(VAULT_LOG, "utf8").split("\n").filter((l) => l.includes(`"${opt.name}"`) && l.includes(`"${series.symbol}"`)).length
      : 0;
    mkdirSync(dirname(VAULT_LOG), { recursive: true });
    appendFileSync(VAULT_LOG, JSON.stringify({ at: new Date().toISOString(), name: opt.name, symbol: series.symbol }) + "\n");
    if (prior > 0) console.warn(`ATENCAO: o cofre de ${series.symbol} ja foi aberto ${prior}x para "${opt.name}". O resultado de agora vale menos.`);
  }
  const decide = strategy(c);
  const cost = opt.costPct / 100;
  const trades: Trade[] = [];
  let busyUntil = -1;
  for (let i = opt.warmup; i < c.length; i++) {
    if (i <= busyUntil) continue;
    const inPeriod = opt.period === "cofre" ? c[i]!.timestamp >= cut : c[i]!.timestamp < cut;
    if (!inPeriod) continue;
    const o = decide(i, c[i]!.timestamp);
    if (!o) continue;
    const bar = c[i]!;
    const sgn = o.side === "LONG" ? 1 : -1;
    let entry: number;
    if (o.entry.type === "market") entry = bar.open;
    else {
      const p = o.entry.price;
      const touched = o.side === "LONG" ? bar.low <= p : bar.high >= p;
      if (!touched) continue;
      entry = p;
    }
    let exit: number | null = null;
    let outcome: Trade["outcome"] = "TEMPO";
    let last = Math.min(c.length - 1, i + o.maxBars - 1);
    for (let j = i; j <= last; j++) {
      const b = c[j]!;
      const firstBar = j === i;
      if (o.stop !== undefined) {
        const gapStop = !firstBar && (sgn > 0 ? b.open <= o.stop : b.open >= o.stop);
        const hitStop = sgn > 0 ? b.low <= o.stop : b.high >= o.stop;
        if (gapStop) { exit = b.open; outcome = "STOP"; last = j; break; }
        if (hitStop) { exit = o.stop; outcome = "STOP"; last = j; break; }
      }
      if (o.target !== undefined && !(firstBar && o.entry.type === "limit")) {
        const hitTgt = sgn > 0 ? b.high >= o.target : b.low <= o.target;
        if (hitTgt) { exit = o.target; outcome = "ALVO"; last = j; break; }
      }
    }
    if (exit === null) exit = c[last]!.close;
    busyUntil = last;
    const grossPct = (sgn * (exit - entry)) / entry;
    const netPct = grossPct - cost;
    const risk = o.stop !== undefined ? Math.abs(entry - o.stop) : null;
    const r = risk ? (sgn * (exit - entry)) / risk : null;
    const netR = risk ? r! - (cost * entry) / risk : null;
    trades.push({ tag: o.tag ?? "todas", side: o.side, entryTime: bar.timestamp, entry, exit, grossPct, netPct, r, netR, outcome });
  }
  return trades;
}

// ---------------------------------------------------------------------------
// Relatorio: media, intervalo de 95%, estatistica t e estabilidade por ano.
// ---------------------------------------------------------------------------
function stats(xs: number[]): { n: number; mean: number; ci: number; t: number } {
  const n = xs.length;
  if (n < 2) return { n, mean: n ? xs[0]! : 0, ci: NaN, t: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const se = sd / Math.sqrt(n);
  return { n, mean, ci: 1.96 * se, t: se > 0 ? mean / se : NaN };
}

export function report(title: string, trades: Trade[]): void {
  console.log(`\n${title}`);
  const tags = [...new Set(trades.map((t) => t.tag))].sort();
  for (const tag of tags) {
    const ts = trades.filter((t) => t.tag === tag);
    const net = stats(ts.map((t) => t.netPct * 100));
    const gross = stats(ts.map((t) => t.grossPct * 100));
    const wins = ts.filter((t) => t.netPct > 0).length;
    const hasR = ts.every((t) => t.netR !== null);
    const rTxt = hasR ? ` | E[R] liq ${stats(ts.map((t) => t.netR!)).mean.toFixed(3)}` : "";
    const years = [...new Set(ts.map((t) => new Date(t.entryTime).getUTCFullYear()))].sort();
    const byYear = years
      .map((y) => {
        const s = stats(ts.filter((t) => new Date(t.entryTime).getUTCFullYear() === y).map((t) => t.netPct * 100));
        return `${y}: ${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(3)}% (n=${s.n})`;
      })
      .join(" | ");
    console.log(
      `  ${tag.padEnd(24)} n=${String(net.n).padStart(4)} | positivas ${((wins / Math.max(1, ts.length)) * 100).toFixed(1)}% | ` +
        `media bruta ${gross.mean.toFixed(3)}% | media LIQUIDA ${net.mean.toFixed(3)}% (±${net.ci.toFixed(3)}) | t=${net.t.toFixed(2)}${rTxt}`,
    );
    console.log(`  ${"".padEnd(24)} por ano: ${byYear}`);
  }
}

// ---------------------------------------------------------------------------
// Indicadores calculados SO com o passado (usar dentro de decide com indice i-1).
// ---------------------------------------------------------------------------
export function emaSeries(candles: readonly Candle[], period: number): number[] {
  const a = 2 / (period + 1);
  const out: number[] = [];
  candles.forEach((x, i) => out.push(i === 0 ? x.close : x.close * a + out[i - 1]! * (1 - a)));
  return out;
}
export function atrSeries(candles: readonly Candle[], period = 14): number[] {
  const out: number[] = [];
  candles.forEach((x, i) => {
    const tr = i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - candles[i - 1]!.close), Math.abs(x.low - candles[i - 1]!.close));
    out.push(i === 0 ? tr : (out[i - 1]! * (period - 1) + tr) / period);
  });
  return out;
}
