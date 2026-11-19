import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../src/config.js";

/**
 * Relatório do MODO ASSIMETRIA (2026-11-01, pedido do Cleber). SOMENTE LEITURA.
 *
 * Mede, por ENTRADA (parcial de lucro não conta como trade extra), se "perde pouco, ganha muito" está
 * acontecendo e se há vantagem de verdade: acerto, ganho médio / perda média em R, payoff, E[R] líquido
 * com IC95%, fator de lucro, concentração dos ganhos nas 3 maiores e E[R] sem elas, custo em R e
 * disciplina do risco (US$ por entrada deveria ficar perto de MT5_ASYM_RISK_USD).
 *
 * Critério definido ANTES do dado (não mudar depois de ver o resultado):
 *   n < 40            -> POUCA AMOSTRA, não concluir
 *   n >= 40 e IC95 inferior de E[R] > 0 e E[R] sem as 3 maiores > 0  -> GANHA
 *   n >= 40 e IC95 superior de E[R] < 0                              -> PERDE (reverter)
 *   resto                                                            -> INCONCLUSIVO (seguir medindo até 100)
 *
 * Uso: npx tsx scripts/asymmetry-report.ts --since=2026-11-02T00:00:00Z [--out=reports/assimetria.md]
 * `--since` é obrigatório: use o instante do restart com MT5_ASYMMETRY_MODE=true.
 */

interface Leg {
  session_id: string;
  symbol: string;
  side: string;
  entry_time: string;
  exit_time: string | null;
  entry_price: number | null;
  quantity: number | null;
  original_stop_distance: number | null;
  net_pnl: number | null;
  pnl: number | null;
  commission: number | null;
  exit_reason: string | null;
}

interface Entry {
  symbol: string;
  side: string;
  entryTime: string;
  holdMin: number;
  riskUsd: number;
  netUsd: number;
  costUsd: number;
  r: number;
}

function parseArgs(argv: string[]): { since: string; out: string | null } {
  let since = "";
  let out: string | null = null;
  for (const a of argv) {
    if (a.startsWith("--since=")) since = a.slice(8);
    else if (a.startsWith("--out=")) out = a.slice(6);
  }
  if (!since || Number.isNaN(Date.parse(since))) throw new Error("Informe --since=<ISO> (instante do restart com o modo assimetria ligado).");
  return { since, out };
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
    const lastExit = Math.max(...g.map((l) => (l.exit_time ? Date.parse(l.exit_time) : 0)));
    entries.push({
      symbol: head.symbol,
      side: head.side,
      entryTime: head.entry_time,
      holdMin: lastExit > 0 ? (lastExit - Date.parse(head.entry_time)) / 60_000 : 0,
      riskUsd,
      netUsd,
      costUsd,
      r: netUsd / riskUsd,
    });
  }
  return { entries: entries.sort((a, b) => a.entryTime.localeCompare(b.entryTime)), excluded };
}

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "n/d");
const sgn = (x: number, d = 2) => (x >= 0 ? "+" : "") + fmt(x, d);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function ci95(rs: number[]): { lo: number; hi: number } {
  const n = rs.length;
  if (n < 2) return { lo: -Infinity, hi: Infinity };
  const m = mean(rs);
  const sd = Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  const se = sd / Math.sqrt(n);
  return { lo: m - 1.96 * se, hi: m + 1.96 * se };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseServiceRoleKey) throw new Error("NEURAL_SUPABASE_URL/NEURAL_SUPABASE_SERVICE_ROLE_KEY ausentes no .env.");
  const sb = createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);

  const legs: Leg[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("ai_trades")
      .select("session_id, symbol, side, entry_time, exit_time, entry_price, quantity, original_stop_distance, net_pnl, pnl, commission, exit_reason")
      .eq("status", "CLOSED")
      .eq("is_test_data", true)
      .gte("entry_time", args.since)
      .order("entry_time", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Falha ao consultar ai_trades: ${error.message}`);
    legs.push(...((data ?? []) as unknown as Leg[]));
    if (!data || data.length < 1000) break;
  }

  const { entries, excluded } = consolidate(legs);
  const n = entries.length;
  const out: string[] = [`# Relatório do modo assimetria`, "", `Gerado em ${new Date().toISOString()} | entradas da IA fechadas desde ${args.since} | somente leitura`, ""];

  if (n === 0) {
    out.push(`Nenhuma entrada fechada ainda (${excluded} excluída(s) por falta de stop original gravado).`);
  } else {
    const rs = entries.map((e) => e.r);
    const wins = entries.filter((e) => e.netUsd > 0);
    const losses = entries.filter((e) => e.netUsd <= 0);
    const avgWinR = mean(wins.map((e) => e.r));
    const avgLossR = mean(losses.map((e) => e.r));
    const grossWin = wins.reduce((s, e) => s + e.netUsd, 0);
    const grossLoss = -losses.reduce((s, e) => s + e.netUsd, 0);
    const { lo, hi } = ci95(rs);
    const topIdx = [...entries].sort((a, b) => b.netUsd - a.netUsd).slice(0, 3);
    const topSet = new Set(topIdx);
    const rsNoTop = entries.filter((e) => !topSet.has(e)).map((e) => e.r);
    const meanNoTop = mean(rsNoTop);
    const top3Share = grossWin > 0 ? topIdx.filter((e) => e.netUsd > 0).reduce((s, e) => s + e.netUsd, 0) / grossWin : NaN;
    const risks = entries.map((e) => e.riskUsd);
    const costR = mean(entries.map((e) => e.costUsd / e.riskUsd));

    let verdict = "INCONCLUSIVO (seguir medindo até 100 entradas)";
    if (n < 40) verdict = "POUCA AMOSTRA (n < 40): não concluir nada";
    else if (lo > 0 && meanNoTop > 0) verdict = "GANHA: IC95 inferior de E[R] > 0 e E[R] sem as 3 maiores > 0";
    else if (hi < 0) verdict = "PERDE: IC95 superior de E[R] < 0 (reverter: MT5_ASYMMETRY_MODE=false)";

    out.push(
      "## Veredito (critério fixado antes do dado)",
      "",
      `**${verdict}**`,
      "",
      "## Números",
      "",
      "| Item | Valor |",
      "|---|---|",
      `| Entradas fechadas (excluídas sem stop gravado) | ${n} (${excluded}) |`,
      `| Acerto | ${wins.length}/${n} (${fmt((wins.length / n) * 100, 0)}%) |`,
      `| Ganho médio / perda média (em R) | ${sgn(avgWinR)}R / ${sgn(avgLossR)}R |`,
      `| Payoff (ganho médio ÷ perda média) | ${fmt(Math.abs(avgWinR / avgLossR))} |`,
      `| E[R] líquido por entrada (IC95) | ${sgn(mean(rs))}R  [${fmt(lo)} ; ${fmt(hi)}] |`,
      `| Resultado líquido | ${sgn(entries.reduce((s, e) => s + e.netUsd, 0))} US$ |`,
      `| Fator de lucro | ${grossLoss > 0 ? fmt(grossWin / grossLoss) : "n/d"} |`,
      `| Parcela das 3 maiores nos ganhos brutos | ${fmt(top3Share * 100, 0)}% |`,
      `| E[R] sem as 3 maiores | ${sgn(meanNoTop)}R |`,
      `| Custo médio em R | ${fmt(costR)}R |`,
      `| Duração média ganhos / perdas | ${fmt(mean(wins.map((e) => e.holdMin)), 0)} min / ${fmt(mean(losses.map((e) => e.holdMin)), 0)} min |`,
      `| Risco por entrada (US$): mín / média / máx | ${fmt(Math.min(...risks))} / ${fmt(mean(risks))} / ${fmt(Math.max(...risks))} (alvo ${config.mt5AsymRiskUsd}) |`,
      "",
      "A assimetria de verdade é: perda média perto de −1R, ganho médio bem acima de +1R e payoff alto. Se o payoff vier alto mas as 3 maiores explicarem quase tudo, ainda é sorte de poucos trades.",
      "",
      "## Entradas",
      "",
      "| Entrada (UTC) | Ativo | Lado | Risco US$ | Líquido US$ | R | Duração |",
      "|---|---|---|---|---|---|---|",
      ...entries.map((e) => `| ${e.entryTime.slice(0, 16).replace("T", " ")} | ${e.symbol} | ${e.side} | ${fmt(e.riskUsd)} | ${sgn(e.netUsd)} | ${sgn(e.r)} | ${fmt(e.holdMin, 0)} min |`)
    );
  }

  const text = out.join("\n") + "\n";
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, text);
    console.log(`Relatório gravado em ${args.out}`);
  } else {
    console.log(text);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
