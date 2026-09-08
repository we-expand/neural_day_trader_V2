/**
 * Manchetes reais do dia (RSS de Investing.com/Cointelegraph/CNBC/Money
 * Times, já agregadas pelo endpoint `/news/aggregate` que o Dashboard usa --
 * ver `NEWS_FEEDS_PT`/`NEWS_FEEDS_EN` em `supabase/functions/server/index.ts`)
 * pro LLM Brain ler o contexto do dia, não só o preço.
 *
 * 🔴 2026-09-08 (pedido direto do Cleber, mesma sessão do fix de
 * trendLongTerm): "a IA tem que fazer leitura das notícias do dia... de 3
 * em 3 horas, registrar e entender." Reaproveita o MESMO endpoint real que
 * o Dashboard já usa (gratuito, RSS puro, nunca fabrica manchete -- ver
 * comentário no topo de `/news/aggregate`) em vez de contratar um provedor
 * pago novo. Cache de 3h (pedido explícito), pra não bater no endpoint a
 * cada ciclo -- `getMarketNewsBriefing` devolve `fetchedAt` pra quem chamar
 * saber se veio de um fetch novo (pra decidir se registra no log de
 * atividade ou só reusa o contexto já injetado no ciclo anterior).
 *
 * Nunca decide sozinho, só CONTEXTO -- mesma disciplina de regime/agenda
 * econômica/candlePatterns (ver princípios em agent.ts). Pesquisa anterior
 * do projeto (ver CLAUDE.md, "calendário/macro sem efeito direcional
 * utilizável") já mostrou que notícia/calendário não tem edge direcional
 * comprovado -- o valor real aqui é o LLM não operar cego ao que está
 * acontecendo no mundo, não uma promessa de sinal.
 */

import { config } from "./config.js";

export interface NewsHeadline {
  title: string;
  source: string;
  category: "crypto" | "macro" | "forex";
  timestamp: number;
}

export interface MarketNewsBriefing {
  fetchedAt: number;
  headlines: NewsHeadline[];
}

const NEWS_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3h, pedido explicito do Cleber
let newsCache: { fetchedAt: number; briefing: MarketNewsBriefing | null } | null = null;

/**
 * Busca manchetes reais (dedupadas, balanceadas entre crypto/macro/forex).
 * `null` quando a fonte real não respondeu -- nunca fabrica manchete, mesma
 * disciplina do resto do projeto.
 */
export async function getMarketNewsBriefing(): Promise<MarketNewsBriefing | null> {
  if (newsCache && Date.now() - newsCache.fetchedAt < NEWS_CACHE_TTL_MS) {
    return newsCache.briefing;
  }
  try {
    const url = `${config.neuralSupabaseUrl}/functions/v1/server/news/aggregate?lang=pt`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.neuralSupabaseAnonKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      newsCache = { fetchedAt: Date.now(), briefing: null };
      return null;
    }
    const result = (await res.json()) as { items?: Array<Record<string, unknown>> };
    if (!Array.isArray(result.items)) {
      newsCache = { fetchedAt: Date.now(), briefing: null };
      return null;
    }
    const headlines: NewsHeadline[] = result.items
      .map((item): NewsHeadline | null => {
        const title = String(item.title ?? "").trim();
        const category = item.category;
        if (!title || (category !== "crypto" && category !== "macro" && category !== "forex")) return null;
        const timestamp = Number(item.timestamp);
        return {
          title,
          source: String(item.source ?? "?"),
          category,
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
        };
      })
      .filter((h): h is NewsHeadline => h !== null);

    const briefing: MarketNewsBriefing = { fetchedAt: Date.now(), headlines };
    newsCache = { fetchedAt: Date.now(), briefing };
    return briefing;
  } catch {
    newsCache = { fetchedAt: Date.now(), briefing: null };
    return null;
  }
}

/** Formata as manchetes num bloco de texto curto pro prompt do ciclo. */
export function formatNewsBlock(briefing: MarketNewsBriefing): string {
  if (briefing.headlines.length === 0) return "";
  const byCategory: Record<string, NewsHeadline[]> = { macro: [], crypto: [], forex: [] };
  for (const h of briefing.headlines) byCategory[h.category]?.push(h);
  const lines: string[] = [];
  for (const cat of ["macro", "crypto", "forex"] as const) {
    const items = byCategory[cat].slice(0, 4);
    if (items.length === 0) continue;
    const label = cat === "macro" ? "Macro/EUA" : cat === "crypto" ? "Cripto" : "Forex";
    lines.push(`${label}: ${items.map((h) => `"${h.title}" (${h.source})`).join(" | ")}`);
  }
  if (lines.length === 0) return "";
  return `\n\nNotícias reais do dia (atualizado a cada 3h, contexto -- não é sinal mecânico):\n${lines.join("\n")}`;
}
