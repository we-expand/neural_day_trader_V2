// Fecha o loop entre o Jarvis (supabase/functions/jarvis/index.ts) e o motor
// de trading real: até 2026-08-24, jarvis_decisions era gravada com
// status='ACTIVE' mas nenhum ponto do motor (cliente ou ai-runner) lia essa
// tabela — "autoaplicar" só persistia a decisão, sem efeito em trade nenhum.
// Ver SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md seção 9.
//
// Alvos somados aqui (produto dos multiplicadores, não soma dos percentuais):
// Regra 1 (win rate) e Regra 4 (sazonalidade, rollover/almoço-Ásia) do Jarvis
// gravam em targets distintos para não competir pelo mesmo cooldown de
// guardrail — ver jarvis_guardrails e BLUEPRINT.md.
const JARVIS_POSITION_SIZE_TARGETS = [
  'position_size',
  'position_size_rollover',
  'position_size_crypto_lunch',
] as const;

// Guardrails do Jarvis hoje só reduzem tamanho (nunca aumentam — ver
// magnitude_pct sempre negativo nas 4 regras implementadas). Teto de 100%
// (neutro) e piso de 10% são defesa em profundidade: mesmo se uma decisão
// futura chegasse com magnitude positiva ou várias decisões compostas
// zerassem o multiplicador, o motor nunca aumenta risco por causa do Jarvis
// nem some com nocional zero por causa de um bug de dado.
const MIN_MULTIPLIER = 0.1;
const MAX_MULTIPLIER = 1;

/**
 * Lê decisões ACTIVE do Jarvis que afetam tamanho de posição e devolve um
 * multiplicador único (produto composto). Falha aberta: qualquer erro de
 * rede/schema devolve 1 (neutro) — o Jarvis fora do ar nunca pode impedir o
 * motor de operar.
 *
 * `supabase` é tipado como `any` de propósito — o tipo real do client
 * (`SupabaseClient<...>`) tem um builder fluente cuja inferência de tipos
 * explode em "Type instantiation is excessively deep" quando encadeado com
 * `.select().eq().in().not()` fora do próprio pacote (mesmo padrão usado em
 * `supabase/functions/jarvis/index.ts` e `positionManager.ts`).
 */
// deno-lint-ignore no-explicit-any
export async function fetchJarvisSizeMultiplier(supabase: any): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('jarvis_decisions')
      .select('target, magnitude_pct')
      .eq('status', 'ACTIVE')
      .in('target', JARVIS_POSITION_SIZE_TARGETS)
      .not('magnitude_pct', 'is', null);

    if (error || !data || data.length === 0) return 1;

    let multiplier = 1;
    for (const row of data) {
      const pct = Number(row.magnitude_pct);
      if (!Number.isFinite(pct)) continue;
      multiplier *= 1 + pct / 100;
    }

    return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, multiplier));
  } catch {
    return 1;
  }
}
