/**
 * Carrega o spread REAL medido (view `market_spread_current`) no módulo puro
 * `research/MeasuredSpreads.ts`, de onde `ExecutionCost.ts` tira o custo.
 * Recarrega a cada 15 min. Falha = silêncio: o custo cai na tabela estática.
 * Ver research/COST_SOURCE_OF_TRUTH.md.
 */
import { supabase, isSupabaseActive } from '@/lib/supabaseClient';
import { setMeasuredSpreads, parseSpreadRow } from '../../../../research/MeasuredSpreads.ts';

const REFRESH_MS = 15 * 60_000;
let started = false;

async function load(): Promise<void> {
  try {
    const { data, error } = await supabase.from('market_spread_current').select('*');
    if (error) throw error;
    setMeasuredSpreads((data ?? []).map(parseSpreadRow).filter((r): r is NonNullable<typeof r> => !!r));
  } catch (err) {
    console.warn('[MeasuredSpreads] não carregou, custo usa tabela estática:', err instanceof Error ? err.message : err);
  }
}

export function startMeasuredSpreadsLoader(): void {
  if (started || !isSupabaseActive) return;
  started = true;
  void load();
  setInterval(() => void load(), REFRESH_MS);
}
