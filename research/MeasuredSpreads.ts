/**
 * MeasuredSpreads — spread REAL do mercado (mediana de 7 dias), fonte única de
 * custo do projeto. Módulo puro (sem React/Supabase) pra ser importado tanto
 * pelo app (`ExecutionCost.ts`) quanto pelo `llm-active-brain` (`commissionModel.ts`).
 *
 * Por quê: o custo era uma tabela estática por classe (cripto = 0,029% round-trip,
 * do Pepperstone/abril). Medição ao vivo em 2026-09-23 no feed da Infinox mostrou
 * BTC ~0,068%, ETH ~0,097%, SOL ~0,46%, DOT ~7,9% — a tabela subestimava cripto
 * de 2x a centenas de vezes, e o usuário via na boleta um lucro que o log não
 * reproduzia. Agora o spread vem de `market_spread_samples` (coletor a cada 5 min).
 *
 * Regra: sem amostra suficiente -> `null` -> o chamador cai na tabela estática
 * (`research/CostModel.ts`) e o `source` fica 'STATIC_MODEL'. Nunca fabrica número.
 */
export interface MeasuredSpread {
  /** Spread mediano em % do preço (ask-bid)/bid*100 — pago UMA vez por round-trip. */
  medianPct: number;
  p90Pct: number;
  samples: number;
  lastTs: string;
}

/** Mínimo de amostras (5 min cada) pra confiar na mediana: ~30 min de dado. */
export const MIN_SPREAD_SAMPLES = 6;

// Nomes do catálogo do app -> nome do símbolo na corretora (onde o coletor grava).
const ALIAS: Record<string, string> = {
  DOGEUSD: 'DOGUSD', LINKUSD: 'LNKUSD', ATOMUSD: 'ATMUSD', AVAXUSD: 'AVAUSD',
  ETHUSD: 'XETUSD', BTCUSDT: 'BTCUSD',
};

let table = new Map<string, MeasuredSpread>();
let loadedAt = 0;

export function setMeasuredSpreads(rows: Array<{ symbol: string } & MeasuredSpread>): void {
  const next = new Map<string, MeasuredSpread>();
  for (const r of rows) {
    if (r.symbol && Number.isFinite(r.medianPct) && r.medianPct >= 0) next.set(r.symbol.toUpperCase(), r);
  }
  table = next;
  loadedAt = Date.now();
}

export function getMeasuredSpread(symbol: string): MeasuredSpread | null {
  const s = symbol.toUpperCase();
  const row = table.get(ALIAS[s] ?? s);
  return row && row.samples >= MIN_SPREAD_SAMPLES ? row : null;
}

export function measuredSpreadsLoadedAt(): number {
  return loadedAt;
}

/** Normaliza linha crua da view `market_spread_current` (numeric vem como string). */
export function parseSpreadRow(r: any): ({ symbol: string } & MeasuredSpread) | null {
  const medianPct = Number(r?.median_pct);
  if (!r?.symbol || !Number.isFinite(medianPct)) return null;
  return { symbol: String(r.symbol), medianPct, p90Pct: Number(r.p90_pct) || medianPct, samples: Number(r.n) || 0, lastTs: String(r.last_ts ?? '') };
}
