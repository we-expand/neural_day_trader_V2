// Relatório de desempenho da MESA (aprendizado contínuo, camadas 1 e 2). SOMENTE LEITURA, exceto
// por medir o desfecho das decisões pendentes (grava só os campos outcome_* de desk_decisions).
//
// Responde, com os números e com a INCERTEZA (intervalo de 95%):
//   - as entradas que a mesa REJEITOU: quantas teriam batido o stop (rejeição certa) e quantas o alvo (ganho perdido)?
//   - as que APROVOU: quantas bateram o alvo e quantas o stop?
//   - cada agente acerta? (apoiou e deu alvo, ou foi contra e deu stop)
//   - a convicção do Master é calibrada? (convicção alta acerta mais que baixa?)
//   - no teste só-LLM: o que cada trava desligada teria feito?
//
// Regra do projeto: amostra pequena não é conclusão. Abaixo de MIN_N o relatório diz "amostra pequena".
//
// Uso:  npx tsx scripts/desk-report.ts            (últimas 24 h)
//       npx tsx scripts/desk-report.ts 72         (últimas 72 h)
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabaseClient } from "../src/neuralBridge.js";
import { resolvePendingDeskOutcomes } from "../src/deskStore.js";
import { extractStances, scoreAgents, wilsonInterval, type TranscriptEntry } from "../src/deskScoring.js";

const MIN_N = 30;
const hours = Number(process.argv[2] ?? 24);
const since = new Date(Date.now() - hours * 3_600_000).toISOString();

interface Row {
  created_at: string;
  symbol: string;
  side: string;
  setup_type: string | null;
  decision: "APPROVE" | "REJECT";
  conviction: number | null;
  llm_only: boolean;
  bypassed_gates: string[];
  stances: Record<string, boolean>;
  transcript: TranscriptEntry[] | null;
  outcome_status: string;
  outcome_minutes: number | null;
  trade_id: string | null;
  reason: string | null;
  error: string | null;
}

const sb = getSupabaseClient();
try {
  const r = await resolvePendingDeskOutcomes();
  if (r.checked > 0) console.log(`(desfecho medido agora: ${r.resolved} de ${r.checked} decisões pendentes)\n`);
} catch (err) {
  console.warn(`(não consegui medir desfechos pendentes agora: ${err instanceof Error ? err.message : err})\n`);
}

const { data, error } = await sb
  .from("desk_decisions")
  .select("created_at, symbol, side, setup_type, decision, conviction, llm_only, bypassed_gates, stances, transcript, outcome_status, outcome_minutes, trade_id, reason, error")
  .gte("created_at", since)
  .order("created_at", { ascending: true })
  .limit(1500);
if (error) {
  console.error(`Erro ao ler desk_decisions: ${error.message}\nA migration supabase/migrations/20260930_desk_decisions.sql já foi rodada no SQL Editor?`);
  process.exit(1);
}
const rows = (data ?? []) as Row[];
// As posturas são recalculadas do debate gravado (e não lidas da coluna `stances`): assim a regra
// "neutro não é posição" vale também para as linhas gravadas antes dessa correção.
for (const r of rows) {
  if (Array.isArray(r.transcript) && r.transcript.length > 0) {
    r.stances = extractStances(r.transcript, r.side as "LONG" | "SHORT", r.decision);
  }
}

const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(0)}%` : "n/d");
const ci = (hits: number, n: number) => {
  const w = wilsonInterval(hits, n);
  return w ? `IC95 ${w.low}-${w.high}%` : "";
};
const small = (n: number) => (n < MIN_N ? "  ⚠ amostra pequena" : "");
const out: string[] = [];
const say = (line = "") => {
  out.push(line);
  console.log(line);
};

say(`# Mesa de operações: desempenho (últimas ${hours} h, desde ${since.slice(0, 16).replace("T", " ")} UTC)`);
say();
if (rows.length === 0) {
  say("Nenhuma deliberação no período. A mesa só é convocada quando uma entrada passa por todas as checagens.");
  process.exit(0);
}

const byOutcome = (list: Row[]) => {
  const count = (s: string) => list.filter((r) => r.outcome_status === s).length;
  return { target: count("TARGET"), stop: count("STOP"), expired: count("EXPIRED"), nodata: count("NO_DATA"), pending: count("PENDING") };
};
const decided = (o: ReturnType<typeof byOutcome>) => o.target + o.stop;

const approved = rows.filter((r) => r.decision === "APPROVE");
const rejected = rows.filter((r) => r.decision === "REJECT");
const falhas = rows.filter((r) => r.error);
say(`## Visão geral`);
say(`- Deliberações: ${rows.length} (aprovadas ${approved.length}, rejeitadas ${rejected.length}); com falha da mesa: ${falhas.length}; teste só-LLM: ${rows.filter((r) => r.llm_only).length}`);
say(`- Viraram trade: ${approved.filter((r) => r.trade_id).length}`);
say();

say(`## Se a mesa tivesse aprovado TUDO (todas as propostas, pelo preço, com o stop e o alvo propostos)`);
{
  const o = byOutcome(rows);
  const n = decided(o);
  say(`- Alvo primeiro: ${o.target} | Stop primeiro: ${o.stop} | Nenhum em 60 min: ${o.expired} | Sem dado: ${o.nodata} | Em andamento: ${o.pending}`);
  say(`- Das que decidiram (${n}): ${pct(o.target, n)} chegaram no alvo ${ci(o.target, n)}${small(n)}`);
  say(`- Isso é o "ponto de partida": a mesa só agrega valor se rejeitar mais as que dão stop do que as que dão alvo.`);
}
say();

say(`## O que a mesa REJEITOU (contrafactual)`);
{
  const o = byOutcome(rejected);
  const n = decided(o);
  say(`- Teriam dado STOP (rejeição certa): ${o.stop}`);
  say(`- Teriam dado ALVO (ganho que ficou de fora): ${o.target}`);
  say(`- Sem desfecho em 60 min: ${o.expired} | sem dado: ${o.nodata} | em andamento: ${o.pending}`);
  say(`- Rejeição certa em ${pct(o.stop, n)} das decididas (${n}) ${ci(o.stop, n)}${small(n)}`);
}
say();

say(`## O que a mesa APROVOU`);
{
  const o = byOutcome(approved);
  const n = decided(o);
  say(`- Alvo primeiro: ${o.target} | Stop primeiro: ${o.stop} | Nenhum em 60 min: ${o.expired} | sem dado: ${o.nodata} | em andamento: ${o.pending}`);
  say(`- Chegaram no alvo: ${pct(o.target, n)} das decididas (${n}) ${ci(o.target, n)}${small(n)}`);
}
say();

say(`## Acerto por agente (apoiou e deu alvo, ou foi contra e deu stop)`);
{
  const scores = scoreAgents(rows.map((r) => ({ stances: r.stances ?? {}, outcome: r.outcome_status as never })));
  if (scores.length === 0) say("- Ainda sem decisões com desfecho (alvo ou stop) para avaliar.");
  else {
    say(`| Agente | Decisões | Acertos | Acerto | ${"IC95".padEnd(10)} | Apoiou e perdeu | Vetou e perdeu ganho |`);
    say(`|---|---:|---:|---:|---|---:|---:|`);
    for (const s of scores) say(`| ${s.agent} | ${s.n} | ${s.hits} | ${s.hitPct}% | ${(wilsonInterval(s.hits, s.n) ? `${wilsonInterval(s.hits, s.n)!.low}-${wilsonInterval(s.hits, s.n)!.high}%` : "")} | ${s.backedAndLost} | ${s.vetoedAndWouldHaveWon} |${s.n < MIN_N ? " ⚠" : ""}`);
    say();
    say(`Leitura: um agente que apoia tudo acerta a taxa-base de alvos; um que veta tudo acerta a de stops. Só vale quando passa bem acima das duas.`);
  }
}
say();

say(`## A convicção do Master é calibrada?`);
{
  const buckets: [string, (c: number) => boolean][] = [["convicção < 60", (c) => c < 60], ["60 a 79", (c) => c >= 60 && c < 80], ["80 ou mais", (c) => c >= 80]];
  for (const [label, test] of buckets) {
    const list = rows.filter((r) => r.conviction != null && test(Number(r.conviction)) && (r.outcome_status === "TARGET" || r.outcome_status === "STOP"));
    // a convicção do Master vale para a decisão que ele tomou: acerto = (aprovou e deu alvo) ou (rejeitou e deu stop)
    const hits = list.filter((r) => (r.decision === "APPROVE" && r.outcome_status === "TARGET") || (r.decision === "REJECT" && r.outcome_status === "STOP")).length;
    say(`- ${label}: ${list.length} decisões, acertou ${pct(hits, list.length)} ${ci(hits, list.length)}${small(list.length)}`);
  }
}
say();

const gated = rows.filter((r) => r.llm_only && (r.bypassed_gates ?? []).length > 0);
if (gated.length > 0) {
  say(`## Teste só-LLM: as travas antigas que teriam barrado a entrada`);
  const gateStats = new Map<string, { n: number; stop: number; target: number }>();
  for (const r of gated) {
    for (const g of r.bypassed_gates) {
      const s = gateStats.get(g) ?? { n: 0, stop: 0, target: 0 };
      s.n++;
      if (r.outcome_status === "STOP") s.stop++;
      if (r.outcome_status === "TARGET") s.target++;
      gateStats.set(g, s);
    }
  }
  say(`| Trava | Vezes que teria barrado | Entrada teria dado STOP | Teria dado ALVO |`);
  say(`|---|---:|---:|---:|`);
  for (const [g, s] of [...gateStats.entries()].sort((a, b) => b[1].n - a[1].n)) say(`| ${g} | ${s.n} | ${s.stop} | ${s.target} |`);
  say();
  say(`Trava que barraria muitas entradas que dariam STOP e poucas que dariam ALVO fazia falta: é a candidata a voltar.`);
  say();
}

say(`---`);
say(`Limite deste relatório: o desfecho é medido com velas de 1m, sem spread, e a vela que contém alvo e stop conta como STOP. É uma régua para comparar agentes e travas, não o P&L do trade. Nenhuma lição entra no prompt sem a aprovação do Cleber.`);

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "reports");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const file = join(dir, `desk-${new Date().toISOString().slice(0, 10)}.md`);
writeFileSync(file, out.join("\n") + "\n");
console.log(`\n(salvo em ${file})`);
process.exit(0);
