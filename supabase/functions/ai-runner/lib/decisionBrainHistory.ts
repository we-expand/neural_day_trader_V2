/**
 * Passo 2 da cadeia de memória do cérebro sombra (2026-08-29/30). Ver
 * handoff completo: SESSAO_2026-08-28_GERENCIAMENTO_DE_SAIDA_E_CEREBRO_ANALITICO.md
 * item "⏸️ EXATAMENTE ONDE PARAMOS".
 *
 * Pedido do Cleber: o cérebro precisa "entender o que fez de errado pra
 * não repetir" — SEM mudar peso/parâmetro (fine-tuning foi descartado por
 * risco de "achar" edge falso, ver tradingagents-e-ml.md). A forma
 * aprovada é ele reler o próprio diário de decisões passadas COM resultado
 * hipotético real já calculado (passo 1, `hypothetical_outcome`) antes de
 * decidir de novo — puro contexto de prompt, nada de retraining.
 *
 * "Correto/errado" aqui é derivado, não gravado: `hypothetical_outcome`/
 * `hypothetical_r_multiple` do passo 1 descrevem sempre o resultado do
 * MECHANICAL_SIDE (ver comentário na migration 20260829). Este módulo
 * traduz isso pro que o CÉREBRO propôs em cada linha (PROCEED = mesmo lado,
 * FLIP = lado espelhado, SKIP = não operou) pra poder dizer se a decisão
 * do cérebro, especificamente, teria dado certo.
 */
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type BrainAction = 'PROCEED' | 'SKIP' | 'FLIP';
type HypotheticalOutcome = 'WIN' | 'LOSS' | 'TIMEOUT' | 'NO_DATA';

interface RawHistoryRow {
  created_at: string;
  symbol: string;
  brain_action: BrainAction;
  context_snapshot: { marketScoreRegime?: string | null } | null;
  hypothetical_outcome: HypotheticalOutcome | null;
  hypothetical_r_multiple: number | null;
}

export interface DecisionBrainHistoryEntry {
  createdAt: string;
  symbol: string;
  regime: string | null;
  brainAction: BrainAction;
  /** null = ainda sem dado suficiente (candle indisponível) pra julgar esta linha. */
  correct: boolean | null;
  /** R-multiple do que o cérebro efetivamente propôs (PROCEED/FLIP) ou R evitado/perdido (SKIP). null se NO_DATA. */
  rMultiple: number | null;
}

interface BucketStats {
  count: number;
  evaluatedCount: number; // exclui NO_DATA
  correctCount: number;
  winRate: number | null; // correctCount / evaluatedCount
  avgRMultiple: number | null;
  entries: DecisionBrainHistoryEntry[];
}

export interface DecisionBrainHistorySummary {
  /** Amostra total (todas as linhas com outcome já calculado pro usuário) — usada só pro gate de amostra mínima. */
  totalEvaluatedOverall: number;
  /** false = amostra ainda insuficiente pra qualquer estatística ter valor — prompt deve dizer isso, nunca inventar confiança em cima de pouca linha. */
  hasEnoughSample: boolean;
  sameSymbol: BucketStats;
  sameRegime: BucketStats | null; // null se contexto atual não tem regime detectado
  byAction: Record<BrainAction, { count: number; winRate: number | null }>;
}

/** Abaixo disso, a seção de histórico no prompt explicita "amostra insuficiente" em vez de sugerir um padrão que não é estatisticamente sólido ainda. */
export const MIN_SAMPLE_FOR_HISTORY = 20;

const RECENT_LIMIT_PER_BUCKET = 20;
const ENTRIES_SHOWN_PER_BUCKET = 8;
// Amostra bruta usada só pra montar os episódios (ver `collapseIntoEpisodes`) —
// maior que RECENT_LIMIT_PER_BUCKET porque cada linha bruta some várias por
// episódio (achado 2026-08-30, ver comentário em `collapseIntoEpisodes`).
const RAW_FETCH_LIMIT = 500;

/**
 * 2026-08-30 — achado de bug real em produção: `ai-runner-tick` roda 1×/min
 * e grava uma linha de cérebro sombra a cada tick em que existe candidato
 * mecânico, SEM dedup. Como RSI/MACD/ADX não trocam de sinal a cada minuto,
 * o MESMO setup (mesmo símbolo, mesmo lado) fica sendo "candidato #1" por
 * dezenas de minutos seguidos — um único movimento real de mercado (ex:
 * EURUSD subindo 90min contra um SHORT mecânico persistente) virava ~40
 * linhas "LOSS" correlacionadas, não 40 trades independentes. Contagem bruta
 * de linhas (achado em produção: EURUSD SHORT com 86 LOSS/2 WIN, taxa de
 * acerto de ~2% — estatisticamente implausível mesmo pro pior cenário já
 * medido neste projeto) enganava tanto o gate `MIN_SAMPLE_FOR_HISTORY`
 * quanto o win rate por bucket.
 *
 * Fix: colapsa em "episódios" — sequência de linhas consecutivas (ordenadas
 * por tempo) do MESMO símbolo + MESMA ação do cérebro, sem gap maior que
 * EPISODE_GAP_MINUTES entre uma e a próxima. Cada episódio vira UMA entrada
 * nas estatísticas (a mais recente do grupo, mais perto da resolução real).
 * Não muda a tabela nem o log bruto (auditoria continua linha a linha) — só
 * a camada de estatística que alimenta o prompt do cérebro.
 */
const EPISODE_GAP_MINUTES = 5;

function collapseIntoEpisodes(rows: RawHistoryRow[]): RawHistoryRow[] {
  // Ordena cronologicamente (ascendente) pra detectar sequências consecutivas.
  const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const episodes: RawHistoryRow[] = [];
  let currentEpisode: RawHistoryRow[] = [];

  const flush = () => {
    if (currentEpisode.length === 0) return;
    // Representante do episódio = linha mais recente do grupo (mais perto de
    // quando o resultado hipotético terminou de se resolver).
    episodes.push(currentEpisode[currentEpisode.length - 1]);
    currentEpisode = [];
  };

  for (const row of sorted) {
    const prev = currentEpisode[currentEpisode.length - 1];
    const sameSetup = prev && prev.symbol === row.symbol && prev.brain_action === row.brain_action;
    const gapMinutes = prev
      ? (new Date(row.created_at).getTime() - new Date(prev.created_at).getTime()) / 60_000
      : Infinity;
    if (!sameSetup || gapMinutes > EPISODE_GAP_MINUTES) flush();
    currentEpisode.push(row);
  }
  flush();

  // Ordem mais recente primeiro, igual ao que as queries já entregavam.
  return episodes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function deriveCorrectAndR(
  brainAction: BrainAction,
  outcome: HypotheticalOutcome | null,
  mechanicalR: number | null,
): { correct: boolean | null; rMultiple: number | null } {
  if (!outcome || outcome === 'NO_DATA' || mechanicalR === null) return { correct: null, rMultiple: null };

  if (brainAction === 'PROCEED') {
    // Cérebro tomou o mesmo lado do ranking mecânico — resultado é o mesmo.
    if (outcome === 'WIN') return { correct: true, rMultiple: mechanicalR };
    if (outcome === 'LOSS') return { correct: false, rMultiple: mechanicalR };
    return { correct: mechanicalR > 0, rMultiple: mechanicalR }; // TIMEOUT: julga pelo R a mercado
  }

  if (brainAction === 'FLIP') {
    // Cérebro tomou o lado OPOSTO — resultado é o espelho matemático.
    const flippedR = -mechanicalR;
    if (outcome === 'WIN') return { correct: false, rMultiple: flippedR }; // mecânico ganhou, logo o flip perdeu
    if (outcome === 'LOSS') return { correct: true, rMultiple: flippedR }; // mecânico perdeu, logo o flip teria ganho
    return { correct: flippedR > 0, rMultiple: flippedR };
  }

  // SKIP: não operou. "Certo" = evitou um perdedor (mecânico LOSS); "errado" = deixou passar um ganhador (mecânico WIN).
  if (outcome === 'WIN') return { correct: false, rMultiple: mechanicalR }; // R positivo = quanto deixou de ganhar
  if (outcome === 'LOSS') return { correct: true, rMultiple: mechanicalR }; // R negativo = quanto evitou perder
  return { correct: mechanicalR <= 0, rMultiple: mechanicalR };
}

function buildBucketStats(rows: RawHistoryRow[]): BucketStats {
  const entries: DecisionBrainHistoryEntry[] = rows.map(r => {
    const { correct, rMultiple } = deriveCorrectAndR(r.brain_action, r.hypothetical_outcome, r.hypothetical_r_multiple);
    return {
      createdAt: r.created_at,
      symbol: r.symbol,
      regime: r.context_snapshot?.marketScoreRegime ?? null,
      brainAction: r.brain_action,
      correct,
      rMultiple,
    };
  });

  const evaluated = entries.filter(e => e.correct !== null);
  const correctCount = evaluated.filter(e => e.correct === true).length;
  const rValues = evaluated.map(e => e.rMultiple).filter((r): r is number => r !== null);

  return {
    count: entries.length,
    evaluatedCount: evaluated.length,
    correctCount,
    winRate: evaluated.length > 0 ? correctCount / evaluated.length : null,
    avgRMultiple: rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : null,
    entries: entries.slice(0, ENTRIES_SHOWN_PER_BUCKET),
  };
}

/**
 * Busca as decisões passadas do cérebro sombra já avaliadas (passo 1) e
 * monta um resumo estatístico simples — mesmo símbolo e mesmo regime
 * detectado agora, mais quebra por tipo de ação. Fire-and-forget como o
 * resto do cérebro sombra: qualquer erro aqui vira "sem histórico
 * disponível", nunca propaga.
 */
export async function fetchDecisionBrainHistorySummary(
  sb: SupabaseClient,
  params: { userId: string; symbol: string; regime: string | null },
): Promise<DecisionBrainHistorySummary | null> {
  try {
    const baseSelect = 'created_at, symbol, brain_action, context_snapshot, hypothetical_outcome, hypothetical_r_multiple';

    // Uma única busca (linhas brutas, ainda com duplicação de episódio) —
    // todos os buckets abaixo são derivados dela em memória, já colapsada
    // (ver `collapseIntoEpisodes`). Antes eram 3 queries separadas (símbolo/
    // regime/geral) + 1 count exato; unificado porque o count exato não dava
    // pra colapsar em episódio sem trazer as linhas de qualquer forma.
    const { data: rawRows, error: fetchErr } = await sb
      .from('ai_decision_brain_shadow')
      .select(baseSelect)
      .eq('user_id', params.userId)
      .not('hypothetical_outcome_computed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(RAW_FETCH_LIMIT);
    if (fetchErr) throw fetchErr;

    const episodes = collapseIntoEpisodes((rawRows ?? []) as RawHistoryRow[]);
    const total = episodes.length;
    const hasEnoughSample = total >= MIN_SAMPLE_FOR_HISTORY;

    const symbolEpisodes = episodes.filter(r => r.symbol === params.symbol).slice(0, RECENT_LIMIT_PER_BUCKET);

    let regimeStats: BucketStats | null = null;
    if (params.regime) {
      const regimeEpisodes = episodes
        .filter(r => r.context_snapshot?.marketScoreRegime === params.regime)
        .slice(0, RECENT_LIMIT_PER_BUCKET);
      regimeStats = buildBucketStats(regimeEpisodes);
    }

    const byAction: Record<BrainAction, { count: number; winRate: number | null }> = {
      PROCEED: { count: 0, winRate: null },
      SKIP: { count: 0, winRate: null },
      FLIP: { count: 0, winRate: null },
    };
    for (const action of ['PROCEED', 'SKIP', 'FLIP'] as const) {
      const stats = buildBucketStats(episodes.filter(r => r.brain_action === action));
      byAction[action] = { count: stats.count, winRate: stats.winRate };
    }

    return {
      totalEvaluatedOverall: total,
      hasEnoughSample,
      sameSymbol: buildBucketStats(symbolEpisodes),
      sameRegime: regimeStats,
      byAction,
    };
  } catch (err) {
    console.error('[ai-runner/decisionBrainHistory] falha ao buscar histórico (seguindo sem ele):', err);
    return null;
  }
}
