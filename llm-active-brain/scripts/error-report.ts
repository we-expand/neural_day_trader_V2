import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "../src/config.js";
import { computeExpectancy, type TradeOutcome } from "../../src/app/services/risk/ExpectancyEngine.ts";

/**
 * Relatório de ERROS do LLM Brain (2026-10-07, pedido do Cleber: "ela precisa saber onde está
 * errando para não repetir"). SOMENTE LEITURA: nunca grava no banco e nunca muda o motor.
 *
 * Diferença para print-expectancy.ts: aqui cada ENTRADA conta uma vez. A realização parcial de lucro
 * grava uma linha CLOSED extra com o mesmo session_id+symbol+side+entry_time; contar linhas infla o
 * acerto (22/09 aparecia como 7 trades/71% e eram 5 entradas/60%). Consolida por entrada e soma o P&L
 * líquido; o risco vem de original_stop_distance (gravado uma vez na abertura), nunca de stop_loss,
 * que muda com breakeven/trailing.
 *
 * Cada fatia (ativo+lado, setup, hora, sessão, saída, alinhamento com a 1H, consenso) traz n, acerto
 * (Wilson), E[R] líquido com IC95%, custo em R e uma etiqueta honesta:
 *   POUCA AMOSTRA (n < 20)         -> não concluir nada
 *   PERDE (n >= 20 e IC95 superior de E[R] < 0)  -> candidato a veto, SÓ para decidir no fim da janela
 *   GANHA (n >= 20 e IC95 inferior de E[R] > 0)
 *   INCONCLUSIVO                   -> entre os dois
 * São ~9 dimensões × vários baldes por relatório: com tantos cortes alguns "PERDE" aparecem por acaso.
 * Etiqueta não é veredito: um candidato só vira regra se se repetir em dado que não o gerou.
 *
 * Uso:
 *   npx tsx scripts/error-report.ts                       # tudo desde 2026-09-22
 *   npx tsx scripts/error-report.ts --package             # só entradas do pacote de 07/10 (reversalRule v2)
 *   npx tsx scripts/error-report.ts --since=2026-10-08 --out=reports/semana.md
 */

interface Leg {
  session_id: string;
  symbol: string;
  side: string;
  entry_time: string;
  entry_price: number | null;
  quantity: number | null;
  original_stop_distance: number | null;
  net_pnl: number | null;
  pnl: number | null;
  commission: number | null;
  exit_reason: string | null;
  mfe_usd: number | null;
  indicators_snapshot: Record<string, unknown> | null;
  session_at_entry: string | null;
}

interface Entry {
  symbol: string;
  side: string;
  entryTime: string;
  riskUsd: number;
  netUsd: number;
  costUsd: number;
  r: number;
  exitReasons: string[];
  mfeR: number | null;
  snap: Record<string, unknown>;
  session: string | null;
}

const DEFAULT_SINCE = "2026-09-22T03:00:00Z";
const MIN_N = 20;

function parseArgs(argv: string[]) {
  const out: { since: string; pkg: boolean; out?: string } = { since: DEFAULT_SINCE, pkg: false };
  for (const a of argv) {
    if (a === "--package") out.pkg = true;
    else if (a.startsWith("--since=")) out.since = a.slice(8);
    else if (a.startsWith("--out=")) out.out = a.slice(6);
  }
  return out;
}

function consolidate(legs: Leg[]): { entries: Entry[]; excluded: number } {
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
    if (dist == null || !(dist > 0) || head.entry_price == null || !(head.entry_price > 0) || !(qty > 0)) { excluded++; continue; }
    const riskUsd = (dist * qty) / head.entry_price;
    const netUsd = g.reduce((s, l) => s + (l.net_pnl ?? l.pnl ?? 0), 0);
    const costUsd = g.reduce((s, l) => s + (l.commission ?? 0), 0);
    const mfe = Math.max(...g.map((l) => l.mfe_usd ?? 0));
    const snapLeg = g.find((l) => l.indicators_snapshot && Object.keys(l.indicators_snapshot).length > 0);
    entries.push({
      symbol: head.symbol,
      side: head.side,
      entryTime: head.entry_time,
      riskUsd,
      netUsd,
      costUsd,
      r: netUsd / riskUsd,
      exitReasons: [...new Set(g.map((l) => l.exit_reason).filter((x): x is string => !!x))],
      mfeR: mfe > 0 ? mfe / riskUsd : null,
      snap: (snapLeg?.indicators_snapshot as Record<string, unknown>) ?? {},
      session: head.session_at_entry,
    });
  }
  return { entries: entries.sort((a, b) => a.entryTime.localeCompare(b.entryTime)), excluded };
}

interface BucketStats { n: number; wins: number; winRate: number; ciLo: number; ciHi: number; meanR: number; r95Lo: number; r95Hi: number; costR: number; netUsd: number; tag: string }

function stats(list: Entry[]): BucketStats {
  const n = list.length;
  const outcomes: TradeOutcome[] = list.map((e) => ({ pnlPercent: e.netUsd, riskedPercent: e.riskUsd }));
  const ex = computeExpectancy(outcomes);
  const rs = list.map((e) => e.r);
  const mean = rs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(rs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const se = n > 1 ? sd / Math.sqrt(n) : Infinity;
  const lo = mean - 1.96 * se, hi = mean + 1.96 * se;
  const tag = n < MIN_N ? "POUCA AMOSTRA" : hi < 0 ? "PERDE" : lo > 0 ? "GANHA" : "INCONCLUSIVO";
  return {
    n, wins: list.filter((e) => e.netUsd > 0).length, winRate: ex.winRate, ciLo: ex.winRateCI95.lower, ciHi: ex.winRateCI95.upper,
    meanR: mean, r95Lo: lo, r95Hi: hi, costR: list.reduce((s, e) => s + e.costUsd / e.riskUsd, 0) / n,
    netUsd: list.reduce((s, e) => s + e.netUsd, 0), tag,
  };
}

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "n/d");
const sgn = (x: number, d = 2) => (x >= 0 ? "+" : "") + fmt(x, d);

function bucketTable(title: string, entries: Entry[], keyFn: (e: Entry) => string | null): string {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = keyFn(e);
    if (k == null) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(e);
  }
  const rows = [...groups.entries()].map(([k, v]) => ({ k, s: stats(v) })).sort((a, b) => a.s.meanR * a.s.n - b.s.meanR * b.s.n);
  const lines = [`\n### ${title}`, "", "| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |", "|---|---:|---|---|---:|---:|---|"];
  for (const { k, s } of rows) {
    lines.push(`| ${k} | ${s.n} | ${fmt(s.winRate, 0)}% (${fmt(s.ciLo, 0)}-${fmt(s.ciHi, 0)}) | ${sgn(s.meanR)} (${sgn(s.r95Lo)} a ${sgn(s.r95Hi)}) | ${fmt(s.costR)} | ${sgn(s.netUsd)} | ${s.tag} |`);
  }
  return lines.join("\n");
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const hourBrt = (iso: string) => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date(iso)));
  return h;
};
const alignWith = (side: string, label: string | null) =>
  label == null ? null : label === "LATERAL" ? "lateral" : (side === "LONG") === (label === "ALTA") ? "a favor" : "contra";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseServiceRoleKey) throw new Error("NEURAL_SUPABASE_URL/NEURAL_SUPABASE_SERVICE_ROLE_KEY ausentes no .env.");
  const sb = createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);

  const legs: Leg[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("ai_trades")
      .select("session_id, symbol, side, entry_time, entry_price, quantity, original_stop_distance, net_pnl, pnl, commission, exit_reason, mfe_usd, indicators_snapshot, session_at_entry")
      .eq("status", "CLOSED")
      .eq("is_test_data", true)
      .gte("entry_time", args.since)
      .order("entry_time", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Falha ao consultar ai_trades: ${error.message}`);
    legs.push(...((data ?? []) as unknown as Leg[]));
    if (!data || data.length < 1000) break;
  }

  let { entries, excluded } = consolidate(legs);
  let scope = `entradas da IA desde ${args.since.slice(0, 10)}`;
  if (args.pkg) {
    entries = entries.filter((e) => e.snap.reversalRule === "padrao-candle-confirmado-v2");
    scope = "entradas do pacote de 07/10 (reversalRule = padrao-candle-confirmado-v2)";
  }

  const out: string[] = [];
  out.push(`# Relatório de erros do LLM Brain`, "", `Gerado em ${new Date().toISOString()} | escopo: ${scope}`, "", "Somente leitura. Etiquetas são triagem, não veredito; ver cabeçalho de scripts/error-report.ts.");
  if (entries.length === 0) {
    out.push("", "Nenhuma entrada fechada neste escopo ainda.");
  } else {
    const all = stats(entries);
    const pkgCount = entries.filter((e) => e.snap.reversalRule === "padrao-candle-confirmado-v2").length;
    out.push(
      "",
      "## Total",
      "",
      `- entradas: ${all.n} (excluídas por falta de stop/quantidade para medir risco: ${excluded})`,
      `- acerto: ${fmt(all.winRate, 1)}% (IC95 ${fmt(all.ciLo, 0)}-${fmt(all.ciHi, 0)})`,
      `- E[R] líquido: ${sgn(all.meanR)} por entrada (IC95 ${sgn(all.r95Lo)} a ${sgn(all.r95Hi)}) | custo médio ${fmt(all.costR)}R | P&L líquido $${fmt(all.netUsd)}`,
      `- progresso da janela congelada de 100 entradas (só as do pacote de 07/10, reversalRule = padrao-candle-confirmado-v2): ${pkgCount}/100${pkgCount >= 50 ? " (≥50: já dá para olhar se está claramente pior)" : ""}`,
    );
    const tail = entries.slice(-10);
    if (tail.length) out.push(`- últimas ${tail.length} entradas: ${tail.map((e) => (e.netUsd > 0 ? "G" : "P")).join("")} (G=ganho, P=perda), ${sgn(tail.reduce((s, e) => s + e.netUsd, 0))} $`);

    out.push("\n## Onde perde (ordenado do pior para o melhor, por E[R] × n)");
    out.push(bucketTable("Ativo + lado", entries, (e) => `${e.symbol} ${e.side}`));
    out.push(bucketTable("Setup declarado pela IA", entries, (e) => str(e.snap.setupType) ?? "(sem setup)"));
    out.push(bucketTable("Hora de entrada (Brasília)", entries, (e) => { const h = hourBrt(e.entryTime); return `${String(h).padStart(2, "0")}h`; }));
    out.push(bucketTable("Sessão de mercado na entrada", entries, (e) => e.session ?? str(e.snap.session)));
    out.push("\n> A tabela abaixo descreve o RESULTADO (quem sai por stop perde, por definição): serve para ver o formato dos ganhos e perdas, não para achar causa. Nunca vira candidato a veto.");
    out.push(bucketTable("Como saiu", entries, (e) => (e.exitReasons.length ? e.exitReasons.join("+") : "(sem motivo)")));
    out.push(bucketTable("Lado vs tendência 1H do motor", entries, (e) => alignWith(e.side, str(e.snap.trendLongTermLabel))));
    out.push(bucketTable("Lado vs veredito 5m+1H", entries, (e) => {
      const c = str(e.snap.marketDirectionConsensus);
      if (!c) return null;
      return c === "DIVERGENTE" || c === "INDEFINIDO" ? c.toLowerCase() : alignWith(e.side, c);
    }));
    out.push(bucketTable("Lado vs estocástico 1H", entries, (e) => str(e.snap.stochasticLongTermLabel)));

    const gaveBack = entries.filter((e) => e.mfeR != null && e.mfeR >= 0.5 && e.netUsd <= 0);
    out.push(
      "\n## Ganho devolvido",
      "",
      `Entradas que andaram >= 0,5R a favor e terminaram no zero ou no prejuízo: ${gaveBack.length} de ${entries.length} (${fmt((100 * gaveBack.length) / entries.length, 0)}%), somando ${sgn(gaveBack.reduce((s, e) => s + e.netUsd, 0))} $.`,
    );
    const noMove = entries.filter((e) => (e.mfeR ?? 0) < 0.2 && e.netUsd <= 0);
    out.push(`Entradas que nunca andaram a favor (MFE < 0,2R) e perderam: ${noMove.length} de ${entries.length} (${fmt((100 * noMove.length) / entries.length, 0)}%).`);

    const candidates = [] as string[];
    const scan = (label: string, keyFn: (e: Entry) => string | null) => {
      const g = new Map<string, Entry[]>();
      for (const e of entries) { const k = keyFn(e); if (k) (g.get(k) ?? g.set(k, []).get(k)!).push(e); }
      for (const [k, v] of g) { const s = stats(v); if (s.tag === "PERDE") candidates.push(`- ${label}: **${k}** — n=${s.n}, E[R] ${sgn(s.meanR)} (IC95 ${sgn(s.r95Lo)} a ${sgn(s.r95Hi)}), P&L ${sgn(s.netUsd)} $`); }
    };
    scan("ativo+lado", (e) => `${e.symbol} ${e.side}`);
    scan("setup", (e) => str(e.snap.setupType));
    scan("hora", (e) => `${String(hourBrt(e.entryTime)).padStart(2, "0")}h`);
    out.push(
      "\n## Candidatos a veto (etiqueta PERDE)",
      "",
      candidates.length ? candidates.join("\n") : "Nenhum balde com n >= 20 e IC95 inteiro abaixo de zero.",
      "",
      "Regra do projeto: nada disso vira trava durante a janela congelada. Decidir no fim, e só o que se repetir em entradas que não geraram o candidato.",
    );
  }

  const text = out.join("\n") + "\n";
  console.log(text);
  if (args.out) {
    const dir = args.out.includes("/") ? args.out.slice(0, args.out.lastIndexOf("/")) : ".";
    mkdirSync(dir, { recursive: true });
    writeFileSync(args.out, text);
    console.error(`(gravado em ${args.out})`);
  }
}

main().catch((err) => {
  console.error("Erro:", err instanceof Error ? err.message : err);
  process.exit(1);
});
