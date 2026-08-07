/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  SHIM DE SERVIDOR PARA @/lib/supabaseClient                       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * O fecho do motor de decisão (StrategyEvaluator → MarketScoreEngine →
 * BacktestDataService) é portável pro servidor: não toca window/document/
 * localStorage, e todo o I/O dele é HTTP que funciona igual nos dois lados.
 *
 * Sobra UM único ponto preso ao browser, em BacktestDataService.ts:
 *
 *     const { data: sessionData } = await supabase.auth.getSession();
 *
 * — usado só pra obter o JWT que autentica a chamada de candles ao edge
 * function `server`. No navegador esse token é a sessão do usuário logado; aqui
 * não existe usuário logado, então usamos a service-role key.
 *
 * Este shim é apontado pelo import map (deno.json) no lugar do client real.
 * Consequência deliberada: o motor NÃO precisa de nenhuma edição pra rodar no
 * servidor, e o client de browser nunca é carregado pelo Deno.
 *
 * SUPERFÍCIE MÍNIMA DE PROPÓSITO. Só o que o fecho do motor de fato usa é
 * implementado. Se o motor um dia passar a depender de outra parte do
 * client, o acesso estoura na hora com mensagem explícita em vez de
 * devolver `undefined` e falhar longe da causa — falha barulhenta é
 * preferível a dado silenciosamente errado, que é a convenção nº1 deste
 * projeto.
 *
 * ATUALIZAÇÃO (passo 3 do runner, 2026-08-07): além de `auth.getSession()`,
 * `FunnelTelemetry.ts` (importado transitivamente por `runTradingCycle.ts`)
 * usa `supabase.from('ai_funnel_snapshots').insert(...)` e
 * `supabase.from('ai_sessions').update({updated_at}).eq('id', sessionId)`.
 * Essas DUAS chamadas — e só elas — são implementadas abaixo, contra o
 * client real de service-role. Qualquer outro uso de `.from(...)` continua
 * estourando de propósito.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

function serviceRoleKey(): string | null {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null;
}

const authShim = {
  /**
   * Devolve a service-role key no formato que `BacktestDataService` espera de
   * uma sessão do Supabase. Se a env var faltar, devolve sessão nula — o
   * chamador cai no `publicAnonKey`, e a rota de candles responde o erro real
   * em vez de este shim inventar um token.
   */
  getSession(): Promise<{ data: { session: { access_token: string } | null } }> {
    const key = serviceRoleKey();
    return Promise.resolve({
      data: { session: key ? { access_token: key } : null },
    });
  },
};

let realClient: SupabaseClient | null = null;
function getRealClient(): SupabaseClient {
  if (realClient) return realClient;
  const url = Deno.env.get('SUPABASE_URL');
  const key = serviceRoleKey();
  if (!url || !key) {
    throw new Error(
      '[ai-runner/shim] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente — ' +
      'necessários pra FunnelTelemetry gravar ai_funnel_snapshots/heartbeat.',
    );
  }
  realClient = createClient(url, key);
  return realClient;
}

/** Superfície exata que `FunnelTelemetry.flush()` usa — nada além disso. */
const fromShim = {
  from(table: string) {
    if (table === 'ai_funnel_snapshots') {
      return {
        insert(row: Record<string, unknown>) {
          return getRealClient().from('ai_funnel_snapshots').insert(row);
        },
      };
    }
    if (table === 'ai_sessions') {
      return {
        update(patch: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              return getRealClient().from('ai_sessions').update(patch).eq(column, value);
            },
          };
        },
      };
    }
    throw new Error(
      `[ai-runner/shim] O motor tentou usar supabase.from('${table}') no servidor, ` +
      `mas este shim só implementa 'ai_funnel_snapshots' e 'ai_sessions' (uso conhecido ` +
      `de FunnelTelemetry.ts). Se o caminho crítico passou a depender de outra tabela, ` +
      `implemente aqui de propósito — não troque o import map por um client de browser.`,
    );
  },
};

/**
 * Proxy que só deixa passar o que foi realmente implementado EM RUNTIME.
 * Qualquer outro acesso (`.rpc`, `.channel`, `.functions`, `.select()`
 * encadeado, ...) lança apontando o caminho a seguir, em vez de virar
 * `undefined is not a function` três camadas adiante.
 *
 * TIPADO como `SupabaseClient` completo (não a interface mínima real do
 * Proxy) de propósito: parte da árvore de módulos que `runTradingCycle.ts`
 * importa (`LiveEmergencyClose.ts` → `BrokerClient.ts`, `RealMarketDataService.ts`)
 * usa outras partes do client de browser em CAMINHOS que o runner (DEMO-only)
 * nunca executa em runtime — mas que o `deno check` ainda precisa
 * type-checar, porque fazem parte do grafo de import mesmo sem serem
 * chamados. Tipar a superfície completa satisfaz o compilador sem afrouxar
 * a trava de runtime: qualquer uma dessas chamadas, se um dia executada de
 * verdade pelo runner, ainda estoura na hora via este mesmo Proxy.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    if (prop === 'auth') return authShim;
    if (prop === 'from') return fromShim.from;
    throw new Error(
      `[ai-runner/shim] O motor tentou usar supabase.${String(prop)} no servidor, ` +
      `mas este shim só implementa 'auth.getSession()' e 'from(...)' (ver comentário ` +
      `no topo do arquivo). Se o caminho crítico passou a depender disso, implemente ` +
      `aqui de propósito (com service-role) — não troque o import map por um client de browser.`,
    );
  },
}) as SupabaseClient;
