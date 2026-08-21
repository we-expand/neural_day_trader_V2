/**
 * VIX real e agenda econômica real, pro driver servidor (`ai-runner`).
 *
 * Achado 2026-08-21: `TradingCycleDeps.fetchNewsCached`/`fetchVIXCached`
 * existem desde a extração do motor puro (`runTradingCycle.ts`) e o gate de
 * notícias (`aiConfig.newsFilter`, ligado por padrão) e o VIX do Bloco E
 * (`TailRiskGuard.ts`) dependem deles — mas no `ai-runner`, o motor que
 * opera de verdade em produção 24/7 (ver CLAUDE.md), os dois eram stubs
 * mortos: `cachedNewsEvents: []` e `cachedVIX: 0` fixos, nunca preenchidos.
 * O gate rodava, mas com lista sempre vazia — nunca bloqueava nada. Mesmo
 * bug de padrão do VIX do Bloco E (nunca disparava por choque sistêmico no
 * servidor). Funcionava só no driver browser (`useApexLogic.ts`), que fecha
 * a aba com frequência — exatamente a lacuna que motivou o `ai-runner`
 * existir. Este módulo fecha essa lacuna, reaproveitando os mesmos
 * endpoints reais que o browser já usa (`server/economic-calendar`,
 * `server/vix`), chamados aqui via HTTP direto (Deno tem `fetch` nativo,
 * sem os problemas de CORS que motivaram proxy server-side pro browser).
 *
 * Falha de rede aqui NUNCA fabrica dado — devolve lista vazia / `null`,
 * mesma disciplina do resto do projeto. Uma falha de rede breve não deve
 * travar a sessão inteira (por isso timeout curto e catch silencioso com
 * log), mas também nunca deve fingir que os eventos foram checados quando
 * não foram.
 */

const FUNCTIONS_BASE = (() => {
  const url = Deno.env.get('SUPABASE_URL');
  return url ? `${url}/functions/v1/server` : null;
})();

function authHeaders(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { Authorization: `Bearer ${key}`, apikey: key };
}

export interface NewsEvent {
  time: number;
  impact: string;
  currency: string;
}

/**
 * Busca a agenda econômica real (todos os países/moedas — o gate de
 * notícias precisa de todos, não só EUA, mesmo contrato que o browser já
 * respeita ao chamar sem `?country=US`). Nunca fabrica: fonte indisponível
 * = lista vazia (gate não bloqueia, mesmo efeito seguro de "sem dado" já
 * usado em todo o resto do projeto — ex: `ContextGate` → `ILLIQUID_NO_DATA`).
 */
export async function fetchRealNewsEvents(): Promise<NewsEvent[]> {
  if (!FUNCTIONS_BASE) {
    console.error('[ai-runner/marketContext] SUPABASE_URL ausente — sem como buscar agenda econômica real.');
    return [];
  }
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/economic-calendar?lang=en`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[ai-runner/marketContext] economic-calendar respondeu HTTP ${res.status} — tratando como sem evento (não bloqueia, não fabrica).`);
      return [];
    }
    const data = await res.json();
    const raw: any[] = Array.isArray(data.events) ? data.events : [];
    return raw
      .map((ev): NewsEvent | null => {
        const t = new Date(ev.time).getTime();
        if (!Number.isFinite(t)) return null;
        return { time: t, impact: String(ev.impact || 'low'), currency: String(ev.currency || '').toUpperCase() };
      })
      .filter((e): e is NewsEvent => e !== null);
  } catch (error) {
    console.warn('[ai-runner/marketContext] Falha ao buscar economic-calendar real:', error);
    return [];
  }
}

/**
 * Busca o VIX real via o mesmo endpoint `/vix` do browser (cascata S&P
 * Global → CBOE → Yahoo). Rejeita explicitamente o fallback fabricado que
 * esse endpoint devolve quando as 3 fontes reais falham (`source: 'Fallback
 * (Estimativa)'`, valor fixo 18.71) — alimentar isso no `TailRiskGuard`
 * seria o motor reagir (ou deixar de reagir) a um número inventado como se
 * fosse leitura real de mercado. Devolve `null` nesse caso, que já é o
 * contrato que `evaluateTailRisk` espera para "sem VIX disponível".
 */
export async function fetchRealVIX(): Promise<number | null> {
  if (!FUNCTIONS_BASE) {
    console.error('[ai-runner/marketContext] SUPABASE_URL ausente — sem como buscar VIX real.');
    return null;
  }
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/vix`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[ai-runner/marketContext] /vix respondeu HTTP ${res.status} — sem VIX real disponível.`);
      return null;
    }
    const data = await res.json();
    if (typeof data.source === 'string' && data.source.startsWith('Fallback')) {
      console.warn('[ai-runner/marketContext] /vix devolveu o fallback fabricado (todas as fontes reais falharam) — descartado, não alimenta o motor.');
      return null;
    }
    const value = Number(data.value);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (error) {
    console.warn('[ai-runner/marketContext] Falha ao buscar VIX real:', error);
    return null;
  }
}
