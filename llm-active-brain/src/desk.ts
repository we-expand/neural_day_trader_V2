// 🔴 2026-10-13 (pedido do Cleber): MESA DE OPERAÇÕES.
//
// Um time de agentes de IA delibera cada entrada antes de a ordem sair, no
// formato de uma mesa de trading: analistas → debate comprador x vendedor →
// trader sênior → equipe de risco → gestor de risco → Agente Master.
//
//   Analistas (em paralelo)
//     1. Analista 5m   (estocástico, MACD, médias e candles SÓ do 5m)
//     2. Analista 15m  (idem, SÓ do 15m)
//     3. Analista 1H   (idem, SÓ do 1H; o tempo maior manda no lado)
//     4. Analista Fundamentalista       (calendário, VIX, regime)
//     5. Analista de Notícias           (manchetes reais)
//     6. Analista de Sentimento         (VIX, amplitude da cesta, tom das manchetes)
//   Debate
//     7. Pesquisador Comprador   8. Pesquisador Vendedor   (+ réplicas)
//   Decisão
//     9. Trader Sênior
//    10. Risco Agressivo   11. Risco Conservador   12. Gestor de Portfólio
//    13. Gestor de Risco   (o único dono da gestão de risco)
//    14. Agente Master     (palavra final; engloba todos os outros)
//
// O que este módulo NÃO faz: não abre nem fecha posição, não calcula stop nem
// alvo, não cria entrada. Ele recebe uma proposta que o operador (o agente
// principal, agent.ts) já fez e devolve APROVAR ou REJEITAR (e, no máximo,
// "metade do tamanho"). Quem executa é open_position (tools.ts).
//
// Os analistas técnicos NÃO interpretam número: recebem a leitura pronta de
// deskReadings.ts (calculada por código), porque o erro medido na madrugada de
// 12→13/10 era justamente a IA ler o indicador errado.
//
// Falha = REJEITA. Se a mesa não conseguir deliberar (provedor fora, tempo
// esgotado, Master sem resposta), a entrada não sai: "na dúvida, fica fora".

import OpenAI, { APIConnectionError, APIError } from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import {
  SUPPORTED_TIMEFRAMES,
  getActiveHighImpactNewsWindow,
  getCandlePatterns,
  getDailyHighLow,
  getHmmMarketRegime,
  getMacd,
  getMarketRegime,
  getMovingAverageDistance,
  getSlowStochastic,
  getSupportResistance,
  getTrendInfo,
  getUsEconomicCalendar,
  getVixContext,
  getVolumeConfirmation,
  type SupportedTimeframe,
} from "./atr.js";
import { getMarketNewsBriefing } from "./news.js";
import { logBrainActivity } from "./neuralBridge.js";
import { randomUUID } from "node:crypto";
import { saveDeskDecision } from "./deskStore.js";
import {
  alignmentSummary,
  extractJsonObject,
  normalizeMasterVerdict,
  readAverages,
  readDayRange,
  readMacd,
  readStochastic,
  readTargetRoom,
  computeHardVetoes,
  type TargetBarrier,
  type TimeframeReadings,
} from "./deskReadings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = join(__dirname, "..", "ledger");
const DECISIONS_FILE = join(LEDGER_DIR, "desk_decisions.jsonl");
const DRY_RUN_FILE = join(LEDGER_DIR, "desk_dry_runs.jsonl");
const METHOD_FILE = join(__dirname, "..", "METODO_DA_CASA.md");

export interface DeskRiskFacts {
  entriesLast24h: number | null;
  todayPnlUsd: number | null;
  todayLossPctOfBalance: number | null;
  dailyLossLimitPct: number | null;
  openPositions: { symbol: string; side: string; amountUsd: number; entryPrice: number }[];
  correlatedGroup: string[];
  correlatedSameSideExposureUsd: number;
  recentTradesThisSymbol: { side: string; resultUsd: number | null; exitReason: string | null; minutesAgo: number | null }[];
  maxRiskPctPerTrade: number;
  rewardCappedByRisk: boolean;
  /** Fatos sobre como o alvo foi calculado (ex.: "alvo limitado pelo teto de scalp de 0,29%"). */
  targetNotes: string[];
}

export interface DeskProposal {
  sessionId: string;
  userId: string;
  cycle: number;
  symbol: string;
  side: "LONG" | "SHORT";
  setupType: string | null;
  operatorReasoning: string;
  operatorConfidence: number | null;
  entryPrice: number;
  /** Frações do preço (0.0037 = 0,37%). */
  stopPct: number;
  takeProfitPct: number;
  amountUsd: number;
  riskUsd: number;
  balance: number;
  lots: number;
  spreadPct: number | null;
  dayChangePct: number | null;
  /** true = teste só-LLM: não há trava mecânica de julgamento depois do Master. */
  llmOnly: boolean;
  riskFacts: DeskRiskFacts;
  /** Variação do dia dos outros ativos da cesta já cotados neste ciclo (amplitude). */
  basketBreadth: { symbol: string; dayChangePct: number }[];
  /** Travas mecânicas antigas que teriam barrado esta entrada (só preenchido no teste só-LLM). Vai pro Supabase. */
  bypassedGates?: string[];
  /** Ensaio (scripts/desk-dry-run.ts): não escreve no painel "Atividade da IA" e grava num arquivo separado. */
  dryRun?: boolean;
}

export interface AgentReport {
  key: string;
  agent: string;
  ok: boolean;
  json: Record<string, unknown> | null;
  error?: string;
  ms: number;
}

export interface DeskResult {
  /** Identificador desta deliberação (linha em desk_decisions); liga a decisão ao trade que ela abrir. */
  id: string;
  decision: "APPROVE" | "REJECT";
  sizeFactor: 1 | 0.5;
  conviction: number | null;
  reason: string;
  transcript: AgentReport[];
  failedAgents: string[];
  durationMs: number;
  llmCalls: number;
  /** Preenchido quando a mesa não conseguiu deliberar (a decisão então é REJECT por segurança). */
  error?: string;
}

// ---------------------------------------------------------------------------
// Cliente e chamada de um agente
// ---------------------------------------------------------------------------

const deskClient = new OpenAI({
  apiKey: config.llmApiKey,
  baseURL: config.llmBaseUrl,
  maxRetries: 0, // retry próprio abaixo, com teto de tempo da mesa
});

function deskModel(): string {
  return config.mt5DeskModel || config.llmModel;
}

function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
const limit = createLimiter(Math.max(1, config.mt5DeskConcurrency));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AgentSpec {
  key: string;
  agent: string;
  system: string;
  user: string;
  temperature?: number;
}

class DeskTimeoutError extends Error {}

let llmCallsThisRun = 0;

async function callAgent(spec: AgentSpec, deadline: number): Promise<AgentReport> {
  const startedAt = Date.now();
  const disableThinking =
    config.llmProvider === "nvidia" && deskModel().toLowerCase().includes("nemotron") && !config.mt5DeskEnableThinking;
  const maxTokens = config.mt5DeskEnableThinking ? Math.max(config.mt5DeskMaxTokens, 6000) : config.mt5DeskMaxTokens;
  let lastError = "sem resposta";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) {
      lastError = "tempo da mesa esgotado";
      break;
    }
    try {
      const resp = await limit(() => {
        llmCallsThisRun++;
        return deskClient.chat.completions.create(
          {
            model: deskModel(),
            temperature: spec.temperature ?? 0.2,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: spec.system },
              { role: "user", content: spec.user },
            ],
            ...(disableThinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          } as ChatCompletionCreateParamsNonStreaming,
          { signal: AbortSignal.timeout(Math.min(config.mt5DeskCallTimeoutMs, Math.max(3000, deadline - Date.now()))) },
        );
      });
      const choice = resp.choices?.[0];
      const raw = choice?.message?.content?.trim() ?? "";
      const json = extractJsonObject(raw);
      if (json) return { key: spec.key, agent: spec.agent, ok: true, json, ms: Date.now() - startedAt };
      lastError = choice?.finish_reason === "length" ? "resposta cortada pelo limite de tokens" : `resposta sem JSON (${raw.slice(0, 80)})`;
    } catch (err) {
      if (err instanceof APIError && err.status === 429) {
        const headers = err.headers as Record<string, string> | undefined;
        const retryAfter = Number(headers?.["retry-after"]);
        lastError = "limite de taxa do provedor (429)";
        await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5, 15) * 1000);
        continue;
      }
      lastError = err instanceof Error ? err.message : String(err);
      if (err instanceof APIConnectionError || /timeout|aborted/i.test(lastError)) {
        await sleep(1500);
        continue;
      }
      break; // erro que não melhora com nova tentativa (400, 401...)
    }
  }
  return { key: spec.key, agent: spec.agent, ok: false, json: null, error: lastError, ms: Date.now() - startedAt };
}

// ---------------------------------------------------------------------------
// Dados reais de mercado (nunca fabricados: o que não veio vira "sem dado")
// ---------------------------------------------------------------------------

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function deskTimeframes(): SupportedTimeframe[] {
  const valid = config.mt5DeskTimeframes.filter((tf): tf is SupportedTimeframe => (SUPPORTED_TIMEFRAMES as readonly string[]).includes(tf));
  return valid.length > 0 ? valid : ["5m", "1H"];
}

async function gatherTimeframe(symbol: string, tf: SupportedTimeframe) {
  const [stoch, macd, avg, trend, candles, sr, volume] = await Promise.all([
    safe(getSlowStochastic(symbol, tf)),
    safe(getMacd(symbol, tf)),
    safe(getMovingAverageDistance(symbol, tf)),
    safe(getTrendInfo(symbol, tf)),
    safe(getCandlePatterns(symbol, tf)),
    safe(getSupportResistance(symbol, tf)),
    safe(getVolumeConfirmation(symbol, tf)),
  ]);
  return { tf, stoch, macd, avg, trend, candles, sr, volume };
}

async function gatherMarketData(symbol: string) {
  const tfs = deskTimeframes();
  const [perTf, daily, regime, hmm, vix, calendar, newsWindow, news] = await Promise.all([
    Promise.all(tfs.map((tf) => gatherTimeframe(symbol, tf))),
    safe(getDailyHighLow(symbol)),
    safe(getMarketRegime(symbol, "5m")),
    safe(getHmmMarketRegime(symbol, "5m")),
    safe(getVixContext()),
    safe(getUsEconomicCalendar()),
    safe(getActiveHighImpactNewsWindow(config.highImpactNewsGateMinutesBefore, config.highImpactNewsGateMinutesAfter)),
    safe(getMarketNewsBriefing()),
  ]);
  return { perTf, daily, regime, hmm, vix, calendar, newsWindow, news };
}
type MarketData = Awaited<ReturnType<typeof gatherMarketData>>;

// ---------------------------------------------------------------------------
// Texto dos prompts
// ---------------------------------------------------------------------------

const pctOf = (frac: number) => `${(frac * 100).toFixed(3)}%`;
const signed = (v: number, digits = 2) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;
const usd = (v: number) => `$${v.toFixed(2)}`;

function nowBrt(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function jsonOnly(schema: string): string {
  return `Responda SOMENTE um objeto JSON válido, sem nenhum texto antes ou depois, exatamente neste formato:\n${schema}\nEscreva em português, com frases curtas. Use só fatos que estão no material recebido: se um dado não veio, diga que não veio. Nunca invente número, notícia ou padrão.`;
}

function header(p: DeskProposal, data: MarketData): string {
  const rr = p.stopPct > 0 ? p.takeProfitPct / p.stopPct : 0;
  return [
    `ATIVO: ${p.symbol}`,
    `PROPOSTA EM JULGAMENTO: ${p.side === "LONG" ? "COMPRA (LONG)" : "VENDA (SHORT)"} a ${p.entryPrice}`,
    `Stop a ${pctOf(p.stopPct)} do preço | Alvo a ${pctOf(p.takeProfitPct)} | Retorno/risco ${rr.toFixed(2)}:1 | Scalp (duração esperada: minutos a ~1 hora)`,
    `Setup declarado pelo operador: ${p.setupType ?? "nenhum"}`,
    `Agora: ${nowBrt()} (Brasília)${data.regime ? ` | Sessão: ${data.regime.session}` : ""}${p.dayChangePct != null ? ` | Variação do dia: ${signed(p.dayChangePct)}%` : ""}`,
  ].join("\n");
}

function readingsByTimeframe(data: MarketData): TimeframeReadings[] {
  return data.perTf.map((t) => ({ tf: t.tf, estocastico: readStochastic(t.stoch), macd: readMacd(t.macd), medias: readAverages(t.avg) }));
}

function dayAndTargetReadings(p: DeskProposal, data: MarketData) {
  const d = data.daily;
  const dayRange = d ? readDayRange(p.entryPrice, d.dailyHigh, d.dailyLow, p.side, config.mt5DayExtremeVetoRangeFrac) : null;
  const barreiras: TargetBarrier[] = [];
  for (const t of data.perTf) {
    if (!t.sr) continue;
    barreiras.push(
      p.side === "LONG"
        ? { nome: `resistência do ${t.tf} (${t.sr.resistance})`, distanciaPct: t.sr.distanceToResistancePct, rompido: t.sr.brokeAboveResistance }
        : { nome: `suporte do ${t.tf} (${t.sr.support})`, distanciaPct: t.sr.distanceToSupportPct, rompido: t.sr.brokeBelowSupport },
    );
  }
  if (d) {
    barreiras.push(
      p.side === "LONG"
        ? { nome: `máxima das últimas 24h (${d.dailyHigh})`, distanciaPct: d.distanceToDailyHighPct, rompido: d.brokeAboveDailyHigh }
        : { nome: `mínima das últimas 24h (${d.dailyLow})`, distanciaPct: d.distanceToDailyLowPct, rompido: d.brokeBelowDailyLow },
    );
  }
  const targetRoom = readTargetRoom(p.side, p.takeProfitPct * 100, barreiras);
  return { dayRange, targetRoom };
}

function levelsBlock(p: DeskProposal, data: MarketData): string {
  // Tudo aqui sai JÁ INTERPRETADO por código (deskReadings.ts): a IA não recebe
  // número cru de posição no range nem escolhe qual nível barra o alvo.
  const { dayRange, targetRoom } = dayAndTargetReadings(p, data);
  const d = data.daily;
  const posicao = d
    ? `POSIÇÃO NO DIA: ${dayRange ? dayRange.texto : "sem dado"} (máxima de 24h ${d.dailyHigh}, mínima de 24h ${d.dailyLow})`
    : "POSIÇÃO NO DIA: sem dado de máxima/mínima das últimas 24h.";
  return `${posicao}\nESPAÇO PARA O ALVO (${p.side === "LONG" ? "compra: o que barra está ACIMA" : "venda: o que barra está ABAIXO"}): ${targetRoom.texto}`;
}

function priceActionLine(t: MarketData["perTf"][number]): string {
  const partes: string[] = [`médias: ${readAverages(t.avg).texto}`];
  partes.push(t.trend ? `tendência ${t.trend.label} (${signed(t.trend.changePct, 3)}% em ${t.trend.lookbackMinutes}min)` : "tendência: sem dado");
  partes.push(
    t.candles
      ? t.candles.detected.length
        ? `padrão de candle: ${t.candles.detected.join(", ")} (viés ${t.candles.bias ?? "nenhum"})`
        : "nenhum padrão de candle na última vela fechada"
      : "candles: sem dado",
  );
  if (t.sr) {
    partes.push(
      `resistência ${t.sr.resistance} (a ${t.sr.distanceToResistancePct.toFixed(3)}%)${t.sr.brokeAboveResistance ? " ROMPIDA" : ""}, ` +
        `suporte ${t.sr.support} (a ${t.sr.distanceToSupportPct.toFixed(3)}%)${t.sr.brokeBelowSupport ? " ROMPIDO" : ""}` +
        (t.sr.nearLevel ? ` -- preço COLADO na ${t.sr.nearLevel}` : ""),
    );
  }
  if (t.volume) partes.push(`volume ${t.volume.ratio}x a média${t.volume.elevated ? " (ELEVADO)" : ""}`);
  return `${t.tf}: ${partes.join(" | ")}`;
}

/** Os tempos gráficos que têm um analista próprio: 5m, 15m e 1H (definição do Cleber). O 4H segue no placar e nos vetos como contexto. */
const TECHNICAL_AGENT_TIMEFRAMES = ["5m", "15m", "1H"];
function technicalTimeframes(data: MarketData): MarketData["perTf"] {
  return data.perTf.filter((t) => TECHNICAL_AGENT_TIMEFRAMES.includes(t.tf));
}

function analystSpecs(p: DeskProposal, data: MarketData, readings: TimeframeReadings[]): AgentSpec[] {
  const head = header(p, data);
  const schema = `{"vies":"ALTA"|"BAIXA"|"NEUTRO","confianca":0-100,"resumo":"até 3 frases","apoia_a_proposta":true|false,"alerta":"o principal risco que você vê, ou null"}`;
  const regraTempos = "O tempo gráfico maior manda no lado; o menor só dá a hora de entrar.";

  const calendar = data.calendar;
  const eventos = calendar?.highImpactToday?.length
    ? calendar.highImpactToday.map((e) => `${e.time} ${e.event} (real ${e.actual || "?"}, previsto ${e.forecast || "?"}, anterior ${e.previous || "?"})`).join("; ")
    : "nenhum evento de alto impacto listado para hoje";
  const manchetes = data.news?.headlines?.length
    ? data.news.headlines.slice(0, 14).map((h) => `[${h.category}, há ${Math.max(0, Math.round((Date.now() - h.timestamp) / 3_600_000))}h] ${h.title} (${h.source})`).join("\n")
    : "nenhuma manchete real disponível agora";
  const subindo = p.basketBreadth.filter((b) => b.dayChangePct > 0).length;
  const caindo = p.basketBreadth.filter((b) => b.dayChangePct < 0).length;
  const amplitude = p.basketBreadth.length
    ? `${subindo} ativo(s) em alta e ${caindo} em queda no dia: ${p.basketBreadth.map((b) => `${b.symbol} ${signed(b.dayChangePct)}%`).join(", ")}`
    : "sem dado dos outros ativos da cesta neste ciclo";

  return [
    ...technicalTimeframes(data).map((t): AgentSpec => {
      const r = readings.find((x) => x.tf === t.tf)!;
      const maior = t.tf === "1H" ? "Este é o tempo MAIOR dos três: ele manda no lado." : t.tf === "15m" ? "Este é o tempo INTERMEDIÁRIO: confirma ou desmente o 1H e o 5m." : "Este é o tempo MENOR: ele só dá a hora de entrar.";
      return {
        key: `analista_${t.tf}`,
        agent: `Analista ${t.tf}`,
        system:
          `Você é o Analista do gráfico de ${t.tf} de uma mesa de day trade. Você olha SÓ o ${t.tf}: estocástico lento (5,3,3; níveis 20 e 80), MACD (12,26,9), médias de 9 e 20, tendência, candles e níveis. ` +
          `${maior} As leituras abaixo JÁ FORAM FEITAS pelo sistema e estão corretas: não recalcule, não contradiga e NUNCA troque sobrecompra por zona neutra nem o contrário (se a leitura diz SOBRECOMPRADO, o estocástico está sobrecomprado). ` +
          `Extremo sem cruzamento não é sinal por si só, e é VETO contra o lado oposto (nunca se vende em sobrevenda nem se compra em sobrecompra). O melhor gatilho é o cruzamento do %K sobre o %D dentro do extremo; ` +
          `o cruzamento na zona neutra a favor do lado conta, mais fraco. MACD: histograma encolhendo é força morrendo. ` +
          `Diga o que ESTE tempo gráfico aponta e se apoia a proposta. Se nada aponta, vies NEUTRO. ` +
          jsonOnly(schema),
        user:
          `${head}\n\nLEITURA DO ${t.tf} (já calculada pelo sistema):\n` +
          `- Estocástico: ${r.estocastico.texto}\n- MACD: ${r.macd.texto}\n- Médias: ${r.medias.texto}\n` +
          `- Contexto: ${priceActionLine(t).replace(/^[^:]+: /, "")}`,
      };
    }),

    {
      key: "analista_fundamentalista",
      agent: "Analista Fundamentalista",
      system:
        `Você é o Analista Fundamentalista/Macro de uma mesa de day trade. Avalie se o pano de fundo macro de HOJE ajuda, atrapalha ou é indiferente para a proposta, e se há evento próximo capaz de bagunçar um scalp. ` +
        `Se não houver fator macro relevante, diga exatamente isso e marque vies NEUTRO. ` +
        jsonOnly(schema),
      user:
        `${head}\n\nCALENDÁRIO ECONÔMICO (EUA) DE HOJE: ${calendar ? eventos : "sem dado do calendário"}\n` +
        `Próximo evento: ${calendar?.nextUpcoming ? `${calendar.nextUpcoming.time} ${calendar.nextUpcoming.event} (impacto ${calendar.nextUpcoming.impact})` : "nenhum listado"}\n` +
        `Janela de evento de alto impacto ATIVA agora: ${data.newsWindow ? `SIM -- ${data.newsWindow.event.event} às ${data.newsWindow.event.time}` : "não"}\n` +
        `VIX: ${data.vix ? `${data.vix.value} (${signed(data.vix.changePercent)}% no dia) -- nível ${data.vix.label}` : "sem dado"}\n` +
        `Regime do ativo: ${data.regime ? `sessão ${data.regime.session}, volume ${data.regime.volumeLabel}, volatilidade ${data.regime.volatilityLabel}` : "sem dado"}\n` +
        `Classificador de regime (HMM): ${data.hmm ? `${data.hmm.regime} (${(data.hmm.confidence * 100).toFixed(0)}% de confiança${data.hmm.direction ? `, direção ${data.hmm.direction}` : ""})` : "sem dado"}`,
    },
    {
      key: "analista_noticias",
      agent: "Analista de Notícias",
      system:
        `Você é o Analista de Notícias de uma mesa de day trade. Leia as manchetes reais abaixo e diga se alguma delas é relevante para ESTE ativo AGORA, e para que lado empurra. ` +
        `Manchete velha ou genérica não move scalp: se nada se aplica, diga isso e marque vies NEUTRO. Não invente notícia que não está na lista. ` +
        jsonOnly(schema),
      user: `${head}\n\nMANCHETES REAIS (atualizadas a cada 3h):\n${manchetes}`,
    },
    {
      key: "analista_sentimento",
      agent: "Analista de Sentimento",
      system:
        `Você é o Analista de Sentimento de uma mesa de day trade. Diga se o mercado está em modo de apetite a risco ou de aversão a risco agora, e se isso favorece a proposta. ` +
        `Você NÃO tem dado de redes sociais nem de posicionamento de investidores: não finja ter. Use só o VIX, a amplitude da cesta (quantos ativos sobem e caem no dia) e o tom das manchetes. ` +
        jsonOnly(schema),
      user:
        `${head}\n\nVIX: ${data.vix ? `${data.vix.value} (${signed(data.vix.changePercent)}% no dia) -- nível ${data.vix.label}` : "sem dado"}\n` +
        `AMPLITUDE DA CESTA: ${amplitude}\n\nMANCHETES (só para sentir o tom):\n${manchetes}`,
    },
  ];
}

function fmtReport(r: AgentReport): string {
  if (!r.ok || !r.json) return `- ${r.agent}: INDISPONÍVEL (${r.error ?? "sem resposta"})`;
  return `- ${r.agent}: ${JSON.stringify(r.json).slice(0, 900)}`;
}

function researcherSpecs(p: DeskProposal, data: MarketData, alinhamento: string, analysts: AgentReport[]): AgentSpec[] {
  const material = `${header(p, data)}\n\nPLACAR DOS INDICADORES (calculado pelo sistema, é fato):\n${alinhamento}\n\nRELATÓRIOS DOS ANALISTAS:\n${analysts.map(fmtReport).join("\n")}`;
  const schema = `{"tese":"até 3 frases","argumentos":["fato 1","fato 2","fato 3"],"ponto_fraco_do_outro_lado":"1 frase","forca_da_tese":0-100}`;
  const base = (lado: "SUBIR" | "CAIR", nome: string) =>
    `Você é o ${nome} de uma mesa de day trade. Monte o caso mais forte e HONESTO de que ${p.symbol} vai ${lado} no horizonte de um scalp (minutos a ~1 hora). ` +
    `Use só fatos do material. Se os fatos não sustentam a sua tese, admita e dê forca_da_tese baixa: um pesquisador que defende tese fraca com entusiasmo faz a mesa perder dinheiro. ` +
    jsonOnly(schema);
  return [
    { key: "pesquisador_comprador", agent: "Pesquisador Comprador", system: base("SUBIR", "Pesquisador COMPRADOR"), user: material, temperature: 0.4 },
    { key: "pesquisador_vendedor", agent: "Pesquisador Vendedor", system: base("CAIR", "Pesquisador VENDEDOR"), user: material, temperature: 0.4 },
  ];
}

function rebuttalSpecs(p: DeskProposal, data: MarketData, alinhamento: string, bull: AgentReport, bear: AgentReport, round: number): AgentSpec[] {
  const schema = `{"replica":"até 3 frases respondendo ao argumento mais forte do outro lado","concedo":"o que o outro lado tem de razão, ou null","forca_da_tese":0-100}`;
  const mk = (nome: string, lado: string, meu: AgentReport, dele: AgentReport, key: string): AgentSpec => ({
    key: `${key}_replica_${round}`,
    agent: `${nome} (réplica${round > 1 ? ` ${round}` : ""})`,
    system:
      `Você é o ${nome} no debate da mesa. Sua tese: ${p.symbol} vai ${lado}. Responda ao argumento mais forte do outro lado com FATOS do placar. ` +
      `Se o outro lado tem razão em algo, conceda: debate honesto vale mais que vencer. Atualize forca_da_tese depois de ouvir o outro lado. ` +
      jsonOnly(schema),
    user: `${header(p, data)}\n\nPLACAR DOS INDICADORES (fato):\n${alinhamento}\n\nSUA TESE: ${fmtReport(meu)}\n\nTESE DO OUTRO LADO: ${fmtReport(dele)}`,
    temperature: 0.4,
  });
  return [
    mk("Pesquisador Comprador", "SUBIR", bull, bear, "pesquisador_comprador"),
    mk("Pesquisador Vendedor", "CAIR", bear, bull, "pesquisador_vendedor"),
  ];
}

function loadMethod(): string {
  try {
    if (existsSync(METHOD_FILE)) {
      const text = readFileSync(METHOD_FILE, "utf8").trim();
      if (text.length > 0) return text.slice(0, 4000);
    }
  } catch {
    // cai no texto mínimo abaixo
  }
  return "Método da casa: estocástico pesa mais que o MACD; o tempo maior manda no lado e o menor dá a hora; extremo sem cruzamento não é sinal; nunca vender em sobrevenda nem comprar em sobrecompra; na dúvida, fica fora.";
}

function riskFactsBlock(p: DeskProposal, data: MarketData): string {
  const f = p.riskFacts;
  const rr = p.stopPct > 0 ? p.takeProfitPct / p.stopPct : 0;
  const breakeven = p.stopPct + p.takeProfitPct > 0 ? (p.stopPct / (p.stopPct + p.takeProfitPct)) * 100 : 0;
  const spreadFrac = p.spreadPct != null && Number.isFinite(p.spreadPct) ? p.spreadPct / 100 : null;
  return [
    `POLÍTICA DA CASA (decisão do dono da conta, NÃO é motivo de veto): operar scalp com alvo curto (por isso o retorno/risco pode ficar perto ou abaixo de 1:1) e arriscar até ${(f.maxRiskPctPerTrade * 100).toFixed(1)}% do saldo por operação.`,
    `Saldo considerado: ${usd(p.balance)}. Risco desta operação se o stop for atingido: ${usd(p.riskUsd)} (${p.balance > 0 ? ((p.riskUsd / p.balance) * 100).toFixed(2) : "?"}% do saldo). Limite físico da conta por operação: ${(f.maxRiskPctPerTrade * 100).toFixed(1)}%.${f.rewardCappedByRisk ? " O tamanho JÁ foi reduzido para caber nesse limite." : ""}`,
    `Tamanho: ${p.lots} lote(s), exposição de ${usd(p.amountUsd)}.`,
    `Retorno/risco: ${rr.toFixed(2)}:1. Para empatar, precisa acertar ${breakeven.toFixed(0)}% das vezes, sem contar o custo.`,
    `Custo (spread): ${spreadFrac != null ? `${(spreadFrac * 100).toFixed(4)}% do preço, que é ${p.stopPct > 0 ? ((spreadFrac / p.stopPct) * 100).toFixed(0) : "?"}% da distância do stop` : "sem dado"}.`,
    f.targetNotes.length ? `Sobre o alvo: ${f.targetNotes.join("; ")}.` : null,
    `Resultado realizado HOJE: ${f.todayPnlUsd != null ? `${usd(f.todayPnlUsd)}${f.todayLossPctOfBalance != null && f.todayLossPctOfBalance > 0 ? ` (perda de ${f.todayLossPctOfBalance.toFixed(2)}% do saldo)` : ""}` : "sem dado"}.` +
      (f.dailyLossLimitPct != null ? ` Limite de perda diária escolhido pelo usuário: ${f.dailyLossLimitPct}%.` : ""),
    `Entradas novas nas últimas 24h: ${f.entriesLast24h ?? "sem dado"}.`,
    `Posições abertas agora (${f.openPositions.length}): ${f.openPositions.length ? f.openPositions.map((o) => `${o.symbol} ${o.side} ${usd(o.amountUsd)}`).join(", ") : "nenhuma"}.`,
    f.correlatedGroup.length > 1
      ? `Este ativo anda junto com: ${f.correlatedGroup.join(", ")}. Exposição já aberta no MESMO lado nesse grupo: ${usd(f.correlatedSameSideExposureUsd)}.`
      : null,
    `Últimas operações fechadas neste ativo: ${
      f.recentTradesThisSymbol.length
        ? f.recentTradesThisSymbol.map((t) => `${t.side} ${t.resultUsd != null ? usd(t.resultUsd) : "?"} (${t.exitReason ?? "?"}${t.minutesAgo != null ? `, há ${t.minutesAgo}min` : ""})`).join("; ")
        : "nenhuma recente"
    }.`,
    `VIX: ${data.vix ? `${data.vix.value}, nível ${data.vix.label}` : "sem dado"}. Janela de evento de alto impacto ativa: ${data.newsWindow ? `SIM (${data.newsWindow.event.event})` : "não"}.`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Rejeições recentes (evita reconvocar 14 agentes para a mesma ideia)
// ---------------------------------------------------------------------------

const recentRejections = new Map<string, { at: number; reason: string }>();
const rejectionKey = (sessionId: string, symbol: string, side: string) => `${sessionId}|${symbol}|${side}`;

export function getRecentDeskRejection(sessionId: string, symbol: string, side: string): { minutesAgo: number; minutesLeft: number; reason: string } | null {
  const hit = recentRejections.get(rejectionKey(sessionId, symbol, side));
  if (!hit) return null;
  const elapsedMin = (Date.now() - hit.at) / 60_000;
  if (elapsedMin >= config.mt5DeskRejectCooldownMin) {
    recentRejections.delete(rejectionKey(sessionId, symbol, side));
    return null;
  }
  return { minutesAgo: Math.floor(elapsedMin), minutesLeft: Math.ceil(config.mt5DeskRejectCooldownMin - elapsedMin), reason: hit.reason };
}

export function rememberDeskRejection(sessionId: string, symbol: string, side: string, reason: string): void {
  recentRejections.set(rejectionKey(sessionId, symbol, side), { at: Date.now(), reason });
}

// ---------------------------------------------------------------------------
// Registro (terminal, painel "Atividade da IA" e arquivo)
// ---------------------------------------------------------------------------

const HUMAN_FIELDS = ["decisao", "parecer", "posicao", "vies", "tamanho", "conviccao", "confianca", "forca_da_tese", "apoia_a_proposta", "resumo", "tese", "replica", "concedo", "motivo", "argumento", "alerta"];

function humanize(json: Record<string, unknown> | null): string {
  if (!json) return "sem resposta";
  const parts: string[] = [];
  for (const field of HUMAN_FIELDS) {
    const value = json[field];
    if (value == null || value === "") continue;
    parts.push(`${field.replace(/_/g, " ")}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
  return (parts.length ? parts.join(" · ") : JSON.stringify(json)).slice(0, 600);
}

function announce(p: DeskProposal, report: AgentReport): void {
  const text = report.ok ? humanize(report.json) : `INDISPONÍVEL (${report.error})`;
  console.log(`[MESA] ${p.symbol} ${p.side} | ${report.agent} (${report.ms}ms): ${text.slice(0, p.dryRun ? 600 : 280)}`);
  if (p.dryRun) return;
  logBrainActivity({
    sessionId: p.sessionId,
    userId: p.userId,
    cycle: p.cycle,
    type: "thought",
    symbol: p.symbol,
    message: `Mesa | ${report.agent}: ${text}`,
  });
}

function persist(p: DeskProposal, result: DeskResult, mode: string): void {
  try {
    if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
    const stopPrice = p.side === "LONG" ? p.entryPrice * (1 - p.stopPct) : p.entryPrice * (1 + p.stopPct);
    const targetPrice = p.side === "LONG" ? p.entryPrice * (1 + p.takeProfitPct) : p.entryPrice * (1 - p.takeProfitPct);
    appendFileSync(
      p.dryRun ? DRY_RUN_FILE : DECISIONS_FILE,
      JSON.stringify({
        at: new Date().toISOString(),
        mode,
        llmOnly: p.llmOnly,
        sessionId: p.sessionId,
        symbol: p.symbol,
        side: p.side,
        setupType: p.setupType,
        // preço, stop e alvo no instante da decisão: é o que permite medir depois
        // o que teria acontecido com as entradas que a mesa REJEITOU.
        entryPrice: p.entryPrice,
        stopPrice,
        targetPrice,
        stopPct: p.stopPct,
        takeProfitPct: p.takeProfitPct,
        decision: result.decision,
        sizeFactor: result.sizeFactor,
        conviction: result.conviction,
        reason: result.reason,
        error: result.error ?? null,
        durationMs: result.durationMs,
        llmCalls: result.llmCalls,
        failedAgents: result.failedAgents,
        transcript: result.transcript.map((r) => ({ agent: r.agent, ok: r.ok, ms: r.ms, error: r.error ?? null, json: r.json })),
      }) + "\n",
    );
  } catch (err) {
    console.warn(`[MESA] falha ao gravar ${DECISIONS_FILE}: ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// A deliberação
// ---------------------------------------------------------------------------

async function deliberate(p: DeskProposal, deadline: number, transcript: AgentReport[]): Promise<{ decision: "APPROVE" | "REJECT"; sizeFactor: 1 | 0.5; conviction: number | null; reason: string; error?: string }> {
  const checkTime = () => {
    if (Date.now() > deadline) throw new DeskTimeoutError("tempo da mesa esgotado");
  };
  const stage = async (specs: AgentSpec[]): Promise<AgentReport[]> => {
    checkTime();
    const reports = await Promise.all(specs.map((spec) => callAgent(spec, deadline)));
    for (const report of reports) {
      transcript.push(report);
      announce(p, report);
    }
    return reports;
  };

  const data = await gatherMarketData(p.symbol);
  const readings = readingsByTimeframe(data);
  const alinhamento = alignmentSummary(readings);
  const head = header(p, data);
  const metodo = loadMethod();
  const { dayRange, targetRoom } = dayAndTargetReadings(p, data);
  const vetoes = computeHardVetoes({ side: p.side, readings, dayRange, targetRoom });
  const vetoesBlock = vetoes.length
    ? `VETOS DUROS ACIONADOS (calculados pelo sistema; são os ÚNICOS vetos duros que existem):\n${vetoes.map((v) => `- ${v.id}: ${v.texto}`).join("\n")}`
    : `VETOS DUROS ACIONADOS (calculados pelo sistema; são os ÚNICOS vetos duros que existem): NENHUM. Portanto não há veto duro: decida pelo conjunto e pelos gatilhos.`;
  console.log(`[MESA] ${p.symbol} ${p.side} | vetos duros calculados: ${vetoes.length ? vetoes.map((v) => v.id).join(", ") : "nenhum"}`);

  // 1. Analistas
  const analysts = await stage(analystSpecs(p, data, readings));
  if (analysts.filter((r) => r.ok).length < 3) {
    return { decision: "REJECT", sizeFactor: 1, conviction: null, reason: "menos da metade dos analistas respondeu: a mesa não tem material para decidir", error: "analistas indisponíveis" };
  }

  // 2. Debate comprador x vendedor
  let [bull, bear] = await stage(researcherSpecs(p, data, alinhamento, analysts));
  const debate: AgentReport[] = [bull, bear];
  for (let round = 1; round <= Math.max(0, config.mt5DeskDebateRounds); round++) {
    if (!bull.ok || !bear.ok) break;
    const [bullReply, bearReply] = await stage(rebuttalSpecs(p, data, alinhamento, bull, bear, round));
    debate.push(bullReply, bearReply);
    if (bullReply.ok) bull = bullReply;
    if (bearReply.ok) bear = bearReply;
  }
  const debateText = debate.map(fmtReport).join("\n");
  const analystsText = analysts.map(fmtReport).join("\n");
  const ladoProposto = p.side === "LONG" ? "COMPRA (LONG) -- a tese do Pesquisador Comprador" : "VENDA (SHORT) -- a tese do Pesquisador Vendedor";

  // 3. Trader Sênior
  const [trader] = await stage([
    {
      key: "trader_senior",
      agent: "Trader Sênior",
      system:
        `Você é o Trader Sênior da mesa: décadas de day trade, opera pouco e para acertar. Você julga se a proposta deve ser executada AGORA. ` +
        `O placar dos indicadores foi calculado pelo sistema e é fato: não o contradiga. Siga o método da casa abaixo.\n` +
        `VETOS DUROS: o sistema calcula 4 (estocástico em extremo contra o lado; 1H e 4H os dois contra; colado no extremo do dia contra o lado; alvo que não cabe) e os LISTA em "VETOS DUROS ACIONADOS". Se algum estiver listado, a resposta é NAO_EXECUTAR. ` +
        `Se estiver NENHUM, não existe veto duro: VOCÊ NÃO CRIA VETOS NOVOS. Um ponto contra que você enxergar é peso, não veto: vira EXECUTAR_METADE ou menos convicção, nunca um veto inventado. ` +
        `Sem veto listado, JULGUE PELO CONJUNTO: um gatilho claro vale a entrada (veja os GATILHOS VÁLIDOS no método). Um tempo gráfico discordando NÃO é veto: ` +
        `se os outros apontam o lado, use EXECUTAR_METADE. O mercado raramente alinha tudo: exigir alinhamento perfeito é ficar fora o dia inteiro. ` +
        `Estocástico neutro sem cruzamento em extremo NÃO impede a entrada se MACD, médias e candle dão o gatilho. ` +
        `É scalp de alvo curto: o retorno/risco é apertado, então a leitura precisa ser BOA, mas não perfeita. ` +
        `EXECUTAR = leitura boa; EXECUTAR_METADE = leitura razoável com um ponto contra; NAO_EXECUTAR = veto duro ou leitura de fato ruim.\n\n${metodo}\n\n` +
        jsonOnly(`{"decisao":"EXECUTAR"|"EXECUTAR_METADE"|"NAO_EXECUTAR","conviccao":0-100,"gatilho":"qual dos gatilhos válidos está presente, ou nenhum","motivo":"2 a 3 frases","o_que_invalida":"o que teria de acontecer no gráfico para você desistir"}`),
      user:
        `${head}\nA proposta defende: ${ladoProposto}.\n\n${vetoesBlock}\n\nNÍVEIS (calculados pelo sistema):\n${levelsBlock(p, data)}\n\nO QUE O OPERADOR ESCREVEU AO PROPOR: ${p.operatorReasoning.slice(0, 700) || "(sem texto)"}\n\n` +
        `PLACAR DOS INDICADORES (fato):\n${alinhamento}\n\nRELATÓRIOS DOS ANALISTAS:\n${analystsText}\n\nDEBATE:\n${debateText}`,
    },
  ]);

  // 4. Equipe de risco e portfólio
  const fatosDeRisco = riskFactsBlock(p, data);
  const traderText = fmtReport(trader);
  // A equipe de risco NÃO recebe o parecer do Trader: nos ensaios de 13/10, ao
  // recebê-lo, os agentes de risco repetiam a leitura de gráfico dele em vez de
  // olhar a conta. Quem junta gráfico e conta é o Agente Master.
  const riskTeam = await stage([
    {
      key: "risco_agressivo",
      agent: "Risco Agressivo",
      system:
        `Você é o analista de Risco AGRESSIVO da mesa: seu viés é não deixar oportunidade boa passar. Defenda a entrada SE os números da CONTA permitirem; se nem você consegue defender, diga CONTRA. ` +
        `Fale de conta e exposição, não de gráfico. A política da casa (alvo curto, risco por operação) é dada: não é argumento contra. ` +
        jsonOnly(`{"posicao":"APOIA"|"APOIA_COM_METADE"|"CONTRA","argumento":"até 2 frases com números"}`),
      user: `${head}\n\nFATOS DE RISCO:\n${fatosDeRisco}`,
      temperature: 0.4,
    },
    {
      key: "risco_conservador",
      agent: "Risco Conservador",
      system:
        `Você é o analista de Risco CONSERVADOR da mesa: seu viés é proteger o capital. Aponte o que pode dar errado na CONTA, com NÚMEROS: perda do dia, exposição repetida, sequência de perdas, custo. Se o risco é aceitável, admita e diga APOIA. ` +
        `Fale de conta e exposição, não de gráfico. A política da casa (alvo curto, risco por operação) é dada: não é argumento contra. ` +
        jsonOnly(`{"posicao":"APOIA"|"APOIA_COM_METADE"|"CONTRA","argumento":"até 2 frases com números"}`),
      user: `${head}\n\nFATOS DE RISCO:\n${fatosDeRisco}`,
      temperature: 0.4,
    },
    {
      key: "gestor_portfolio",
      agent: "Gestor de Portfólio",
      system:
        `Você é o Gestor de Portfólio da mesa. Olhe a CARTEIRA, não o gráfico: esta posição concentra demais num mesmo movimento? Repete uma aposta que já está aberta em ativos que andam juntos? Faz sentido com o que já se ganhou ou perdeu hoje? ` +
        jsonOnly(`{"parecer":"CABE_NA_CARTEIRA"|"CABE_COM_METADE"|"NAO_CABE","motivo":"até 2 frases"}`),
      user: `${head}\n\nFATOS DE RISCO E CARTEIRA:\n${fatosDeRisco}`,
    },
  ]);

  // 5. Gestor de Risco (dono único da gestão de risco)
  const [riskManager] = await stage([
    {
      key: "gestor_risco",
      agent: "Gestor de Risco",
      system:
        `Você é o GESTOR DE RISCO da mesa e o único responsável pela gestão de risco. ` +
        (p.llmOnly
          ? `Neste teste as travas mecânicas de risco do motor estão DESLIGADAS (limite de perda diária, exposição em ativos correlacionados, pausa após perdas seguidas, teto de frequência): quem cuida disso agora é você. `
          : ``) +
        `Decida com os números: quanto se perde se o stop pegar, quanto já se perdeu hoje, quanto já está exposto no mesmo lado, e se o custo cabe no alvo. ` +
        `VETA quando: a perda do dia já passou do limite escolhido pelo usuário; a operação repete uma aposta já aberta em ativo correlacionado; o ativo acabou de dar prejuízo seguido no mesmo lado; ou o custo (spread) come uma parte grande do alvo. ` +
        `REDUZIR_TAMANHO quando o risco é aceitável mas a conta já está pressionada (dia negativo, várias posições abertas, exposição parecida). ` +
        `NÃO vete por causa da política da casa (alvo curto de scalp e risco por operação dentro do limite): isso foi decidido pelo dono da conta. ` +
        `Você não opina sobre gráfico nem repete a leitura do Trader: isso é com ele. Se a conta está limpa, APROVA. ` +
        jsonOnly(`{"parecer":"APROVA"|"REDUZIR_TAMANHO"|"VETA","motivo":"2 a 3 frases com números","principais_riscos":["risco 1","risco 2"]}`),
      user: `${head}\n\nFATOS DE RISCO:\n${fatosDeRisco}\n\nEQUIPE DE RISCO E PORTFÓLIO:\n${riskTeam.map(fmtReport).join("\n")}`,
    },
  ]);

  // 6. Agente Master
  const indisponiveis = transcript.filter((r) => !r.ok).map((r) => r.agent);
  const [master] = await stage([
    {
      key: "agente_master",
      agent: "Agente Master",
      system:
        `Você é o AGENTE MASTER da mesa de operações. Todos os outros agentes trabalham para você e a palavra final é sua. ` +
        (p.llmOnly
          ? `ATENÇÃO: neste teste NÃO existe nenhuma trava mecânica de leitura ou de risco depois de você. Se você aprovar, a ordem sai agora. Só o stop já definido protege a posição. `
          : `As travas mecânicas do motor já deixaram esta proposta passar; você é a camada de julgamento por cima delas. `) +
        `Como decidir: (1) o placar dos indicadores é fato calculado pelo sistema. ` +
        `(2) VETOS DUROS obrigam REJEITAR, e são SOMENTE os que o sistema lista em "VETOS DUROS ACIONADOS" mais o veto do Gestor de Risco (a menos que o motivo dele se apoie num fato errado, e diga qual). ` +
        `Nenhum agente, nem o Trader, cria veto duro por conta própria: se a lista diz NENHUM e o Trader falou em "veto duro", ele errou, e você decide pelo conjunto. ` +
        `(3) SEM veto duro, decida pelo CONJUNTO: se há um gatilho válido e o placar e o debate favorecem o lado, APROVE. ` +
        `O Trader Sênior pesa muito, mas NAO_EXECUTAR dele com convicção até 70 pode ser vencido se o placar, o debate e a equipe de risco apontam o lado e não há veto duro (aprove com METADE). ` +
        `Se ele disse EXECUTAR_METADE, aprove com METADE. ` +
        `(4) Um tempo gráfico ou um indicador discordando não é motivo para rejeitar: nenhuma entrada real tem todos os indicadores alinhados. ` +
        `(5) Você pode reduzir o tamanho para METADE, nunca aumentar. ` +
        `(6) Ficar fora é uma decisão válida só quando há veto duro ou a leitura é de fato ruim. O pregão está aberto e a mesa existe para operar bem, não para não operar: ` +
        `rejeitar boas leituras por excesso de cautela também custa dinheiro. Dúvida pequena = METADE; dúvida grande ou veto duro = REJEITAR.\n\n${metodo}\n\n` +
        jsonOnly(`{"decisao":"APROVAR"|"REJEITAR","tamanho":"INTEIRO"|"METADE","conviccao":0-100,"motivo":"2 a 4 frases","votos_a_favor":["agente"],"votos_contra":["agente"]}`),
      user:
        `${head}\nA proposta defende: ${ladoProposto}.\n\n${vetoesBlock}\n\nNÍVEIS (calculados pelo sistema):\n${levelsBlock(p, data)}\n\nPLACAR DOS INDICADORES (fato):\n${alinhamento}\n\nANALISTAS:\n${analystsText}\n\nDEBATE:\n${debateText}\n\n` +
        `TRADER SÊNIOR: ${traderText}\n\nEQUIPE DE RISCO E PORTFÓLIO:\n${riskTeam.map(fmtReport).join("\n")}\n\nGESTOR DE RISCO: ${fmtReport(riskManager)}\n\nFATOS DE RISCO:\n${fatosDeRisco}` +
        (indisponiveis.length ? `\n\nAGENTES QUE NÃO RESPONDERAM: ${indisponiveis.join(", ")}. Decida sabendo que falta essa parte.` : ""),
    },
  ]);

  if (!master.ok) {
    return { decision: "REJECT", sizeFactor: 1, conviction: null, reason: "o Agente Master não respondeu: sem decisão final, a entrada não sai", error: `Master indisponível (${master.error})` };
  }
  return normalizeMasterVerdict(master.json);
}

/**
 * Convoca a mesa para julgar uma proposta de entrada. Nunca lança exceção:
 * qualquer falha vira REJECT com `error` preenchido.
 */
export async function runTradingDesk(p: DeskProposal): Promise<DeskResult> {
  const startedAt = Date.now();
  const deadline = startedAt + config.mt5DeskTotalTimeoutMs;
  const transcript: AgentReport[] = [];
  llmCallsThisRun = 0;
  console.log(`[MESA] ${p.symbol} ${p.side} @ ${p.entryPrice}: mesa convocada (modo ${config.mt5DeskMode}${p.llmOnly ? ", teste só-LLM" : ""}, modelo ${deskModel()}).`);

  let verdict: Awaited<ReturnType<typeof deliberate>>;
  try {
    verdict = await deliberate(p, deadline, transcript);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    verdict = { decision: "REJECT", sizeFactor: 1, conviction: null, reason: `a mesa não conseguiu deliberar (${message}): sem decisão, a entrada não sai`, error: message };
  }

  const result: DeskResult = {
    id: randomUUID(),
    decision: verdict.decision,
    sizeFactor: verdict.sizeFactor,
    conviction: verdict.conviction,
    reason: verdict.reason,
    transcript,
    failedAgents: transcript.filter((r) => !r.ok).map((r) => r.agent),
    durationMs: Date.now() - startedAt,
    llmCalls: llmCallsThisRun,
    ...(verdict.error ? { error: verdict.error } : {}),
  };

  const veredito = result.decision === "APPROVE" ? `APROVADO${result.sizeFactor < 1 ? " (METADE do tamanho)" : ""}` : "REJEITADO";
  const resumo = `${veredito}${result.conviction != null ? `, convicção ${result.conviction}` : ""} -- ${result.reason}`;
  console.log(`[MESA] ${p.symbol} ${p.side}: ${resumo} (${(result.durationMs / 1000).toFixed(0)}s, ${result.llmCalls} chamadas${result.failedAgents.length ? `, sem resposta: ${result.failedAgents.join(", ")}` : ""})`);
  if (!p.dryRun) logBrainActivity({
    sessionId: p.sessionId,
    userId: p.userId,
    cycle: p.cycle,
    type: "decision",
    symbol: p.symbol,
    message: `Mesa | DECISÃO FINAL do Agente Master para ${p.symbol} ${p.side}: ${resumo}`,
  });
  persist(p, result, config.mt5DeskMode);
  if (!p.dryRun) {
    // Supabase: 1 linha por deliberacao (base do aprendizado continuo). Sem await: a decisao nao espera o banco.
    const stopPrice = p.side === "LONG" ? p.entryPrice * (1 - p.stopPct) : p.entryPrice * (1 + p.stopPct);
    const targetPrice = p.side === "LONG" ? p.entryPrice * (1 + p.takeProfitPct) : p.entryPrice * (1 - p.takeProfitPct);
    void saveDeskDecision({
      id: result.id,
      sessionId: p.sessionId,
      userId: p.userId,
      symbol: p.symbol,
      side: p.side,
      setupType: p.setupType,
      mode: config.mt5DeskMode,
      llmOnly: p.llmOnly,
      bypassedGates: p.bypassedGates ?? [],
      decision: result.decision,
      sizeFactor: result.sizeFactor,
      conviction: result.conviction,
      reason: result.reason,
      error: result.error ?? null,
      failedAgents: result.failedAgents,
      durationMs: result.durationMs,
      llmCalls: result.llmCalls,
      model: deskModel(),
      entryPrice: p.entryPrice,
      stopPrice,
      targetPrice,
      stopPct: p.stopPct,
      takeProfitPct: p.takeProfitPct,
      amountUsd: p.amountUsd,
      riskUsd: p.riskUsd,
      transcript: result.transcript.map((r) => ({ agent: r.agent, ok: r.ok, ms: r.ms, error: r.error ?? null, json: r.json })),
    });
  }
  return result;
}
