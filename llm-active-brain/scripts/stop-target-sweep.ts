import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../src/config.js";

/**
 * Varredura de STOP x ALVO sobre as entradas REAIS da IA (2026-10-15, pedido do Cleber: "a linha tenue mora na
 * regulagem fina de stop versus alvo"). SOMENTE LEITURA: nao grava no banco e nao muda o motor.
 *
 * Como funciona: cada entrada real (ativo, lado, hora e preco de preenchimento) e reexecutada sobre as velas de 5m
 * REAIS (tabela ohlcv_data, o endpoint de 1m da MetaAPI nao respondeu) que vieram DEPOIS dela, com outros pares stop/alvo. A direcao e a hora de entrada sao as da IA; so a saida
 * muda. Unidade de risco U = original_stop_distance (o stop que o motor realmente usou, ~2x ATR do ativo), entao
 * "stop 1.0x" e o stop atual e o par fica comparavel entre ativos. Alvo = r x stop.
 *
 * Sem olhar o futuro: so velas de 5m que ABREM depois da vela da entrada. Na mesma vela stop e alvo: limite
 * PESSIMISTA conta o STOP, limite OTIMISTA conta o ALVO (a vela de 5m nao diz qual veio primeiro; a verdade esta no meio). Stop furado no gap sai na abertura. Horizonte de 180 min, depois fecha no fechamento da vela.
 * Custo: o custo REAL da entrada (commission / notional) em % do preco, descontado em toda combinacao.
 *
 * LIMITES (honestos): stop e alvo sao FIXOS aqui. O motor real tem breakeven em 1R, trailing, realizacao parcial e
 * reforco, que esta varredura nao reproduz -- ela compara pares stop/alvo, nao o motor inteiro. Treino = 70% mais
 * antigos, teste = 30% mais novos; o par escolhido no treino e conferido no teste.
 *
 * Uso: npx tsx scripts/stop-target-sweep.ts [--since=2026-09-22T03:00:00Z] [--out=reports/stop-target-sweep.md]
 */

const HORIZON_MIN = 180;
const STOPS = [0.5, 0.75, 1.0, 1.5, 2.0];
const RRS = [0.3, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0];
const TRAIN_FRAC = 0.7;
const MIN_CANDLES = 20;
const TF_MS = 5 * 60_000;

interface Leg {
  session_id: string; symbol: string; side: string; entry_time: string; entry_price: number | null;
  quantity: number | null; original_stop_distance: number | null; net_pnl: number | null; pnl: number | null; commission: number | null;
}
interface Entry { symbol: string; side: "LONG" | "SHORT"; t: number; price: number; unit: number; costPct: number; realNet: number; realRisk: number }
interface Candle { t: number; o: number; h: number; l: number; c: number }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "sweep");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv: string[]) {
  const out = { since: "2026-09-22T03:00:00Z", out: "reports/stop-target-sweep.md" };
  for (const a of argv) {
    if (a.startsWith("--since=")) out.since = a.slice(8);
    else if (a.startsWith("--out=")) out.out = a.slice(6);
  }
  return out;
}

async function loadEntries(since: string): Promise<{ entries: Entry[]; excluded: number }> {
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseServiceRoleKey) throw new Error("NEURAL_SUPABASE_URL/SERVICE_ROLE_KEY ausentes no .env.");
  const sb = createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);
  const legs: Leg[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("ai_trades")
      .select("session_id, symbol, side, entry_time, entry_price, quantity, original_stop_distance, net_pnl, pnl, commission")
      .eq("status", "CLOSED").eq("is_test_data", true).gte("entry_time", since)
      .order("entry_time", { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`Falha ao consultar ai_trades: ${error.message}`);
    legs.push(...((data ?? []) as Leg[]));
    if (!data || data.length < 1000) break;
  }
  const groups = new Map<string, Leg[]>();
  for (const l of legs) {
    const k = `${l.session_id}|${l.symbol}|${l.side}|${l.entry_time}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  const entries: Entry[] = [];
  let excluded = 0;
  for (const g of groups.values()) {
    const head = g.find((l) => l.original_stop_distance != null && l.entry_price != null) ?? g[0];
    const qty = g.reduce((s, l) => s + (l.quantity ?? 0), 0);
    const dist = head.original_stop_distance;
    if (dist == null || !(dist > 0) || head.entry_price == null || !(head.entry_price > 0) || !(qty > 0) || (head.side !== "LONG" && head.side !== "SHORT")) { excluded++; continue; }
    const cost = g.reduce((s, l) => s + (l.commission ?? 0), 0);
    entries.push({
      symbol: head.symbol, side: head.side as "LONG" | "SHORT", t: new Date(head.entry_time).getTime(), price: head.entry_price, unit: dist,
      costPct: cost / qty, realNet: g.reduce((s, l) => s + (l.net_pnl ?? l.pnl ?? 0), 0), realRisk: (dist * qty) / head.entry_price,
    });
  }
  return { entries: entries.sort((a, b) => a.t - b.t), excluded };
}

let sbCandles: ReturnType<typeof createClient> | null = null;
async function fetchWindow(symbol: string, startMs: number, endMs: number): Promise<Candle[] | null> {
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, `5m_${symbol}_${startMs}.json`);
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")) as Candle[];
  sbCandles ??= createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);
  const { data, error } = await sbCandles.from("ohlcv_data")
    .select("timestamp, open, high, low, close")
    .eq("asset_symbol", symbol).eq("timeframe", "5m")
    .gte("timestamp", new Date(startMs).toISOString()).lte("timestamp", new Date(endMs).toISOString())
    .order("timestamp", { ascending: true }).limit(1000);
  if (error) { console.log(`[sweep] ${symbol}: ${error.message}`); return null; }
  const candles: Candle[] = ((data ?? []) as Array<Record<string, unknown>>)
    .map((c) => ({ t: new Date(String(c.timestamp)).getTime(), o: Number(c.open), h: Number(c.high), l: Number(c.low), c: Number(c.close) }))
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.h) && Number.isFinite(c.l));
  writeFileSync(f, JSON.stringify(candles));
  return candles;
}

/** Retorna o resultado em R (unidade = stop da combinacao) ja liquido de custo, ou null se faltar vela. */
function replay(e: Entry, candles: Candle[], stopMult: number, rr: number, tieTarget = false): number | null {
  const stopDist = e.unit * stopMult;
  const targetDist = stopDist * rr;
  const dir = e.side === "LONG" ? 1 : -1;
  const stop = e.price - dir * stopDist;
  const target = e.price + dir * targetDist;
  const firstOpen = (Math.floor(e.t / TF_MS) + 1) * TF_MS;
  const after = candles.filter((c) => c.t >= firstOpen && c.t < e.t + HORIZON_MIN * 60_000);
  if (after.length < MIN_CANDLES) return null;
  let exit = after[after.length - 1].c;
  for (const c of after) {
    const stopHit = dir === 1 ? c.l <= stop : c.h >= stop;
    const targetHit = dir === 1 ? c.h >= target : c.l <= target;
    if (stopHit && targetHit && tieTarget) { exit = target; break; }
    if (stopHit) { const gap = dir === 1 ? c.o < stop : c.o > stop; exit = gap ? c.o : stop; break; }
    if (targetHit) { exit = target; break; }
  }
  const grossR = (dir * (exit - e.price)) / stopDist;
  const costR = (e.costPct * e.price) / stopDist;
  return grossR - costR;
}

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "n/d");
const sgn = (x: number, d = 2) => (x >= 0 ? "+" : "") + fmt(x, d);

function meanCI(rs: number[]) {
  const n = rs.length;
  const m = rs.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = n > 1 ? Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0;
  const se = n > 1 ? sd / Math.sqrt(n) : Infinity;
  return { n, m, lo: m - 1.96 * se, hi: m + 1.96 * se, win: rs.filter((x) => x > 0).length / (n || 1) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { entries, excluded } = await loadEntries(args.since);
  console.log(`[sweep] ${entries.length} entradas consolidadas (${excluded} sem stop/preco gravado, excluidas).`);

  const candlesOf = new Map<Entry, Candle[]>();
  let semVela = 0;
  let i = 0;
  for (const e of entries) {
    i++;
    const startMs = Math.floor(e.t / TF_MS) * TF_MS;
    const c = await fetchWindow(e.symbol, startMs, e.t + (HORIZON_MIN + 5) * 60_000);
    if (!c || c.length < MIN_CANDLES) { semVela++; console.log(`[sweep] ${i}/${entries.length} ${e.symbol} sem velas de 5m`); continue; }
    candlesOf.set(e, c);
    if (i % 10 === 0) console.log(`[sweep] ${i}/${entries.length}`);
  }
  const usable = entries.filter((e) => candlesOf.has(e));
  const cut = Math.floor(usable.length * TRAIN_FRAC);
  const train = usable.slice(0, cut);
  const test = usable.slice(cut);
  console.log(`[sweep] usaveis ${usable.length} (treino ${train.length}, teste ${test.length}); sem vela ${semVela}.`);

  const run = (list: Entry[], s: number, rr: number, tie = false) => {
    const rs: number[] = [];
    for (const e of list) { const r = replay(e, candlesOf.get(e)!, s, rr, tie); if (r != null) rs.push(r); }
    return rs;
  };
  // R do par (s, rr) e em unidades do PROPRIO stop; para comparar pares entre si usa-se R em unidades do stop ATUAL (U):
  const run$U = (list: Entry[], s: number, rr: number, tie = false) => run(list, s, rr, tie).map((r) => r * s);

  let md = `# Varredura de stop x alvo sobre as entradas reais da IA\n\n`;
  md += `Gerado em ${new Date().toISOString()}. Entradas desde ${args.since}: ${entries.length} consolidadas, ${usable.length} com velas de 5m (${semVela} sem velas, ${excluded} sem stop gravado). Treino ${train.length} (mais antigas), teste ${test.length} (mais novas).\n\n`;
  md += `Unidade de comparacao: **R em unidades do stop ATUAL** (U = stop que o motor usou, ~2x ATR). Stop 1.0x = o stop de hoje. Alvo = rr x stop da combinacao. Ja liquido do custo real de cada entrada. Stop/alvo FIXOS (sem breakeven, trailing, parcial nem reforco do motor).\n\n`;

  const grid = (list: Entry[], title: string) => {
    let t = `## ${title} (n=${list.length})\n\nE[R] liquido por entrada, em U. Linhas = stop (x do atual), colunas = alvo (rr x stop).\n\n| stop \\ rr | ${RRS.join(" | ")} |\n|---|${RRS.map(() => "---:").join("|")}|\n`;
    for (const s of STOPS) t += `| ${s}x | ${RRS.map((rr) => sgn(meanCI(run$U(list, s, rr)).m)).join(" | ")} |\n`;
    return t + "\n";
  };
  md += `**Limite PESSIMISTA** (stop e alvo na mesma vela de 5m = stop) e **OTIMISTA** (= alvo). O resultado real fica entre os dois; o gap entre eles mede o quanto a resolucao de 5m atrapalha.\n\n`;
  md += grid(train, "TREINO (pessimista)") + grid(test, "TESTE (pessimista)") + grid(usable, "TUDO (pessimista)");
  { let t = `## TUDO (otimista, empate = alvo) (n=${usable.length})\n\n| stop \\ rr | ${RRS.join(" | ")} |\n|---|${RRS.map(() => "---:").join("|")}|\n`;
    for (const s of STOPS) t += `| ${s}x | ${RRS.map((rr) => sgn(meanCI(run$U(usable, s, rr, true)).m)).join(" | ")} |\n`;
    md += t + "\n"; }

  // melhor par no treino, conferido no teste
  const combos = STOPS.flatMap((s) => RRS.map((rr) => ({ s, rr })));
  const ranked = combos.map((c) => ({ ...c, tr: meanCI(run$U(train, c.s, c.rr)), te: meanCI(run$U(test, c.s, c.rr)) })).sort((a, b) => b.tr.m - a.tr.m);
  md += `## Melhores pares no TREINO, conferidos no TESTE\n\n| stop | rr | treino E[R] | treino acerto | teste E[R] | teste IC95 | teste acerto |\n|---:|---:|---:|---:|---:|---|---:|\n`;
  for (const c of ranked.slice(0, 8)) md += `| ${c.s}x | ${c.rr} | ${sgn(c.tr.m)} | ${fmt(c.tr.win * 100, 0)}% | ${sgn(c.te.m)} | ${sgn(c.te.lo)} a ${sgn(c.te.hi)} | ${fmt(c.te.win * 100, 0)}% |\n`;
  const base = { tr: meanCI(run$U(train, 1.0, 0.6)), te: meanCI(run$U(test, 1.0, 0.6)) };
  md += `\nReferencia: opcao A atual (stop 1.0x, alvo 0.6x o stop): treino ${sgn(base.tr.m)}, teste ${sgn(base.te.m)}.\n`;
  const real = meanCI(usable.map((e) => e.realNet / e.realRisk));
  md += `Referencia: motor real (com breakeven/trailing/parcial/reforco), E[R] liquido ${sgn(real.m)} (IC95 ${sgn(real.lo)} a ${sgn(real.hi)}), acerto ${fmt(real.win * 100, 0)}%, n=${real.n}.\n\n`;

  // por ativo: melhor par fixo (stop 1.0x) por rr e o par da opcao A
  md += `## Por ativo (todas as entradas usaveis; n pequeno, so orientacao)\n\n| ativo | n | opcao A (1.0x, rr 0.6) | rr 0.5 | rr 1.0 | rr 2.0 | stop 0.75x rr 1.0 | stop 1.5x rr 1.0 |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
  const symbols = [...new Set(usable.map((e) => e.symbol))].sort();
  for (const sym of symbols) {
    const l = usable.filter((e) => e.symbol === sym);
    const f = (s: number, rr: number) => sgn(meanCI(run$U(l, s, rr)).m);
    md += `| ${sym} | ${l.length} | ${f(1, 0.6)} | ${f(1, 0.5)} | ${f(1, 1)} | ${f(1, 2)} | ${f(0.75, 1)} | ${f(1.5, 1)} |\n`;
  }
  md += `\nLeitura: com direcao sem vantagem todo par converge para -custo; um par so e melhor se o E[R] do TESTE tambem for positivo com IC95 inferior > 0. Com ~${usable.length} entradas o IC e largo -- trate como pista, nao como regra.\n`;

  mkdirSync(dirname(join(ROOT, args.out)), { recursive: true });
  writeFileSync(join(ROOT, args.out), md);
  console.log(md);
}

main().catch((e) => { console.error(e); process.exit(1); });
