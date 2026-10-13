// Aprendizado contínuo da mesa, camada de MEDIÇÃO (funções puras, sem rede, sem config).
//
//  1. extractStances: de cada agente, a postura frente à proposta (apoiou / foi contra / sem posição).
//  2. resolveCounterfactual: com velas de 1m, o que o preço fez DEPOIS da decisão: o ALVO ou o STOP
//     da proposta veio primeiro? Vale para entradas aprovadas e rejeitadas.
//  3. scoreAgents: quem acertou mais (apoiou e deu alvo, ou foi contra e deu stop).
//
// Testadas em scripts/test-desk.ts.

export interface TranscriptEntry {
  agent: string;
  ok: boolean;
  json: Record<string, unknown> | null;
}

/** Nome estável do agente: tira o sufixo "(réplica N)" para a réplica não virar outro agente. */
export function baseAgentName(agent: string): string {
  return agent.replace(/\s*\(réplica(?:\s*\d+)?\)\s*$/i, "").trim();
}

const norm = (v: unknown) => String(v ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Postura de cada agente frente à proposta. true = apoiou, false = foi contra, ausente = sem posição
 * (agente que não respondeu, ou resposta que não diz nem sim nem não).
 */
export function extractStances(
  transcript: TranscriptEntry[],
  side: "LONG" | "SHORT",
  masterDecision: "APPROVE" | "REJECT",
): Record<string, boolean> {
  const stances: Record<string, boolean> = {};
  const lastByAgent = new Map<string, TranscriptEntry>();
  for (const entry of transcript) {
    if (!entry.ok || !entry.json) continue;
    lastByAgent.set(baseAgentName(entry.agent), entry); // a réplica (mais nova) sobrescreve a tese de abertura
  }

  for (const [agent, entry] of lastByAgent) {
    const j = entry.json as Record<string, unknown>;
    if (agent.startsWith("Analista")) {
      if (typeof j.apoia_a_proposta === "boolean") stances[agent] = j.apoia_a_proposta;
    } else if (agent === "Trader Sênior") {
      const d = norm(j.decisao);
      if (d === "EXECUTAR") stances[agent] = true;
      else if (d === "NAO_EXECUTAR") stances[agent] = false;
    } else if (agent === "Risco Agressivo" || agent === "Risco Conservador") {
      const p = norm(j.posicao);
      if (p === "APOIA" || p === "APOIA_COM_METADE") stances[agent] = true;
      else if (p === "CONTRA") stances[agent] = false;
    } else if (agent === "Gestor de Portfólio") {
      const p = norm(j.parecer);
      if (p === "CABE_NA_CARTEIRA" || p === "CABE_COM_METADE") stances[agent] = true;
      else if (p === "NAO_CABE") stances[agent] = false;
    } else if (agent === "Gestor de Risco") {
      const p = norm(j.parecer);
      if (p === "APROVA" || p === "REDUZIR_TAMANHO") stances[agent] = true;
      else if (p === "VETA") stances[agent] = false;
    }
  }

  // Debate: quem terminou mais forte. Só conta se os dois pesquisadores responderam e a força difere.
  const bull = Number(lastByAgent.get("Pesquisador Comprador")?.json?.forca_da_tese);
  const bear = Number(lastByAgent.get("Pesquisador Vendedor")?.json?.forca_da_tese);
  if (Number.isFinite(bull) && Number.isFinite(bear) && bull !== bear) {
    stances["Debate (comprador x vendedor)"] = side === "LONG" ? bull > bear : bear > bull;
  }

  stances["Agente Master"] = masterDecision === "APPROVE";
  return stances;
}

export interface Candle1m {
  timestamp: number; // abertura da vela, ms
  high: number;
  low: number;
  close?: number;
}

export type OutcomeStatus = "PENDING" | "TARGET" | "STOP" | "EXPIRED" | "NO_DATA";

export interface CounterfactualOutcome {
  status: OutcomeStatus;
  minutes: number | null;
  maxFavorablePct: number | null;
  maxAdversePct: number | null;
  note: string;
}

const MINUTE_MS = 60_000;

/**
 * O que o preço fez depois da decisão. Regras (todas conservadoras):
 *  - só entram velas que ABREM depois da decisão (a vela em curso tem preço de antes dela);
 *  - alvo e stop na MESMA vela: vale o STOP (não dá para saber a ordem dentro da vela);
 *  - sem spread (as velas são do preço de mercado): é uma aproximação, não o trade real;
 *  - horizonte: passado `horizonMin` sem tocar nenhum dos dois, EXPIRED;
 *  - se as velas buscadas não cobrem o começo da janela, NO_DATA (nunca se inventa desfecho).
 * Devolve PENDING enquanto ainda dá tempo de algo acontecer e a janela está coberta.
 */
export function resolveCounterfactual(params: {
  side: "LONG" | "SHORT";
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  decidedAtMs: number;
  nowMs: number;
  candles: Candle1m[];
  horizonMin?: number;
}): CounterfactualOutcome {
  const { side, entryPrice, stopPrice, targetPrice, decidedAtMs, nowMs } = params;
  const horizonMin = params.horizonMin ?? 60;
  const sane = [entryPrice, stopPrice, targetPrice].every((v) => Number.isFinite(v) && v > 0);
  const geometryOk = side === "LONG" ? stopPrice < entryPrice && targetPrice > entryPrice : stopPrice > entryPrice && targetPrice < entryPrice;
  if (!sane || !geometryOk) {
    return { status: "NO_DATA", minutes: null, maxFavorablePct: null, maxAdversePct: null, note: "preço, stop e alvo da proposta incoerentes" };
  }

  const horizonEnd = decidedAtMs + horizonMin * MINUTE_MS;
  const candles = params.candles
    .filter((c) => Number.isFinite(c.timestamp) && Number.isFinite(c.high) && Number.isFinite(c.low) && c.high >= c.low)
    .sort((a, b) => a.timestamp - b.timestamp);
  const after = candles.filter((c) => c.timestamp >= decidedAtMs && c.timestamp < horizonEnd);
  const age = nowMs - decidedAtMs;
  const expired = age >= horizonMin * MINUTE_MS;

  // Cobertura: a primeira vela depois da decisão tem que abrir logo depois dela (tolera 2 min de folga).
  const firstAfter = after[0];
  const covered = firstAfter != null && firstAfter.timestamp - decidedAtMs <= 2 * MINUTE_MS;
  if (!covered) {
    if (age < 3 * MINUTE_MS) return { status: "PENDING", minutes: null, maxFavorablePct: null, maxAdversePct: null, note: "aguardando as primeiras velas" };
    if (candles.length === 0 || candles[0].timestamp > decidedAtMs + 2 * MINUTE_MS) {
      // As velas buscadas só começam depois da decisão: o começo da janela se perdeu (ou o mercado estava fechado).
      return expired || age > 55 * MINUTE_MS
        ? { status: "NO_DATA", minutes: null, maxFavorablePct: null, maxAdversePct: null, note: "as velas disponíveis não cobrem o começo da janela (mercado fechado ou feed sem velas)" }
        : { status: "PENDING", minutes: null, maxFavorablePct: null, maxAdversePct: null, note: "aguardando velas" };
    }
    return { status: "PENDING", minutes: null, maxFavorablePct: null, maxAdversePct: null, note: "aguardando velas" };
  }

  let maxFav = 0;
  let maxAdv = 0;
  for (const c of after) {
    const fav = side === "LONG" ? (c.high - entryPrice) / entryPrice : (entryPrice - c.low) / entryPrice;
    const adv = side === "LONG" ? (entryPrice - c.low) / entryPrice : (c.high - entryPrice) / entryPrice;
    const stopHit = side === "LONG" ? c.low <= stopPrice : c.high >= stopPrice;
    const targetHit = side === "LONG" ? c.high >= targetPrice : c.low <= targetPrice;
    maxFav = Math.max(maxFav, fav);
    maxAdv = Math.max(maxAdv, adv);
    if (stopHit || targetHit) {
      const minutes = Math.max(0, (c.timestamp + MINUTE_MS - decidedAtMs) / MINUTE_MS);
      return {
        status: stopHit ? "STOP" : "TARGET",
        minutes: Number(minutes.toFixed(1)),
        maxFavorablePct: Number((maxFav * 100).toFixed(4)),
        maxAdversePct: Number((maxAdv * 100).toFixed(4)),
        note: stopHit && targetHit ? "alvo e stop na mesma vela: contado como STOP (conservador)" : "",
      };
    }
  }

  const base = { minutes: null, maxFavorablePct: Number((maxFav * 100).toFixed(4)), maxAdversePct: Number((maxAdv * 100).toFixed(4)) };
  if (expired) return { status: "EXPIRED", ...base, note: `nem alvo nem stop em ${horizonMin} min` };
  return { status: "PENDING", ...base, note: "em andamento" };
}

export interface ScoredDecision {
  stances: Record<string, boolean>;
  outcome: OutcomeStatus;
}

export interface AgentScore {
  agent: string;
  n: number;
  hits: number;
  hitPct: number;
  /** Vezes que apoiou e o stop veio primeiro (aprovou o que perdeu). */
  backedAndLost: number;
  /** Vezes que foi contra e o alvo veio primeiro (vetou o que ganharia). */
  vetoedAndWouldHaveWon: number;
}

/** Acerto por agente. Só decisões com desfecho TARGET/STOP entram: EXPIRED/NO_DATA/PENDING não dizem nada. */
export function scoreAgents(decisions: ScoredDecision[]): AgentScore[] {
  const acc = new Map<string, AgentScore>();
  for (const d of decisions) {
    if (d.outcome !== "TARGET" && d.outcome !== "STOP") continue;
    for (const [agent, supports] of Object.entries(d.stances)) {
      const s = acc.get(agent) ?? { agent, n: 0, hits: 0, hitPct: 0, backedAndLost: 0, vetoedAndWouldHaveWon: 0 };
      s.n++;
      if ((supports && d.outcome === "TARGET") || (!supports && d.outcome === "STOP")) s.hits++;
      if (supports && d.outcome === "STOP") s.backedAndLost++;
      if (!supports && d.outcome === "TARGET") s.vetoedAndWouldHaveWon++;
      acc.set(agent, s);
    }
  }
  return [...acc.values()]
    .map((s) => ({ ...s, hitPct: s.n > 0 ? Number(((100 * s.hits) / s.n).toFixed(1)) : 0 }))
    .sort((a, b) => b.hitPct - a.hitPct || b.n - a.n);
}

/**
 * Intervalo de confiança de 95% (Wilson) para uma taxa de acerto. Com amostra pequena o
 * intervalo é largo de propósito: é o que impede o relatório de vender ruído como habilidade.
 */
export function wilsonInterval(hits: number, n: number): { low: number; high: number } | null {
  if (n <= 0) return null;
  const z = 1.96;
  const p = hits / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Number((100 * Math.max(0, center - margin)).toFixed(0)), high: Number((100 * Math.min(1, center + margin)).toFixed(0)) };
}
