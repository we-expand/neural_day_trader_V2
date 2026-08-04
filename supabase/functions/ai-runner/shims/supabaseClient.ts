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
 * SUPERFÍCIE MÍNIMA DE PROPÓSITO. Só `auth.getSession()` é implementado. Se o
 * motor um dia passar a usar outra parte do client, o acesso estoura na hora
 * com mensagem explícita em vez de devolver `undefined` e falhar longe da
 * causa — falha barulhenta é preferível a dado silenciosamente errado, que é a
 * convenção nº1 deste projeto.
 */

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

/**
 * Proxy que só deixa passar o que foi realmente implementado. Qualquer outro
 * acesso (`.from`, `.rpc`, `.channel`, ...) lança apontando o caminho a seguir,
 * em vez de virar `undefined is not a function` três camadas adiante.
 */
export const supabase = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string | symbol) {
    if (prop === 'auth') return authShim;
    throw new Error(
      `[ai-runner/shim] O motor tentou usar supabase.${String(prop)} no servidor, ` +
      `mas este shim só implementa 'auth.getSession()'. Se o caminho crítico passou ` +
      `a depender disso, implemente aqui de propósito (com service-role) — não ` +
      `troque o import map por um client de browser.`
    );
  },
});
