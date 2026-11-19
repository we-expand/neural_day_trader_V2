// Fecha o loop entre o Jarvis (supabase/functions/jarvis/index.ts) e o motor
// de trading real: até 2026-08-24, jarvis_decisions era gravada com
// status='ACTIVE' mas nenhum ponto do motor (cliente ou ai-runner) lia essa
// tabela — "autoaplicar" só persistia a decisão, sem efeito em trade nenhum.
// Ver SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md seção 9.
//
// Alvo somado aqui via decisão persistida: Regra 1 (win rate) do Jarvis.
//
// Sazonalidade (rollover 21-22 UTC, almoço-Ásia 02-06 UTC pra cripto) NÃO
// passa mais por jarvis_decisions — corrigido em 2026-08-24 (seção 10 da
// sessão): o cron do Jarvis roda só nas horas cheias de 6h (0/6/12/18 UTC),
// nunca coincidindo com hourNow===21 nem com a janela 2-6h, então a decisão
// nunca disparava. Além disso, mesmo se disparasse, o lado que lê aqui só
// checava status='ACTIVE' sem checar hora — o efeito "vazaria" pra fora da
// janela real até o próximo ciclo de 6h reavaliar. Como esses horários são
// achado de pesquisa fixo (não algo que o Jarvis precisa aprender/auditar
// por ciclo), o fator agora é calculado direto aqui pela hora UTC atual —
// ver applySeasonalityMultiplier abaixo. O Jarvis continua observando essas
// janelas (supabase/functions/jarvis/index.ts, checkSeasonalityWindow) só
// pra telemetria em jarvis_health_snapshots, sem gravar decisão nem
// depender de guardrail/cooldown.
const JARVIS_POSITION_SIZE_TARGETS = ['position_size'] as const;

// Números da pesquisa de sazonalidade (2026-08-23, seção 3 da sessão):
// rollover 21-22 UTC (spread relatado 5-10x o normal em CFD) e almoço-Ásia
// 02-06 UTC pra cripto (vol relativa ~0.80 vs pico 1.35, liquidez Binance
// ~30% pior). Mesmos percentuais que a Regra 4 do Jarvis usava.
const ROLLOVER_START_HOUR_UTC = 21;
const ROLLOVER_END_HOUR_UTC = 22; // exclusivo
const ROLLOVER_MULTIPLIER = 0.3; // -70%

const CRYPTO_LUNCH_START_HOUR_UTC = 2;
const CRYPTO_LUNCH_END_HOUR_UTC = 6; // exclusivo
const CRYPTO_LUNCH_MULTIPLIER = 0.7; // -30%

/**
 * Fator de sazonalidade pela hora UTC atual (`hourUtc`, injetável em teste;
 * default = hora real). `isCrypto` decide se a janela de almoço-Ásia se
 * aplica (rollover de CFD aplica a qualquer ativo). Ambos os fatores são
 * multiplicativos com o resto do pipeline (compõe, não substitui).
 */
export function seasonalityMultiplier(isCrypto: boolean, hourUtc: number = new Date().getUTCHours()): number {
  let multiplier = 1;
  if (hourUtc >= ROLLOVER_START_HOUR_UTC && hourUtc < ROLLOVER_END_HOUR_UTC) {
    multiplier *= ROLLOVER_MULTIPLIER;
  }
  if (isCrypto && hourUtc >= CRYPTO_LUNCH_START_HOUR_UTC && hourUtc < CRYPTO_LUNCH_END_HOUR_UTC) {
    multiplier *= CRYPTO_LUNCH_MULTIPLIER;
  }
  return multiplier;
}

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
