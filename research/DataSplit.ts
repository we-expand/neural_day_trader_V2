/**
 * Split treino/holdout com embargo real — substitui o padrão `threeWindows`
 * duplicado em vários scripts de `research/experiments/*` (ex:
 * `2026-07-25-pooled-crosssectional/pooled-validate.ts:79-88`).
 *
 * 2026-07-30: FIX DE BUG — a versão anterior fazia
 * `holdout: slice.slice(Math.max(0, splitAt - 60))`, ou seja, incluía as
 * ÚLTIMAS 60 barras do período de TREINO dentro do holdout (justificado como
 * "warmup" pros indicadores). Duas violações da seção 8 do
 * `AI_BRAIN_SPEC.md` (que exige purging/embargo entre treino e teste):
 *
 * 1. Sobreposição real: as mesmas 60 barras aparecem nos dois conjuntos.
 *    Um trade que atravessa essa fronteira (comum em holding period longo,
 *    ex: Donchian TRAILING_ONLY que pode segurar dezenas de barras) usa
 *    informação que também "pertence" ao treino.
 * 2. Warmup insuficiente pra a maioria dos indicadores: EMA50 (preset 2)
 *    precisa de ~150-200 barras pra convergir de verdade, não 60 — mesmo os
 *    primeiros valores "não-null" de uma EMA carregam viés do seed inicial
 *    (SMA das primeiras `period` barras) por um tempo depois disso.
 *
 * Este módulo corrige as duas coisas: warmup vem de FORA da janela de
 * holdout (candles anteriores ao início do holdout, nunca contados como
 * observação), e o tamanho do warmup é parametrizável por indicador mais
 * lento usado (default 200, cobre EMA50 com folga real).
 *
 * Nenhum experimento antigo foi retrofitado com este helper — os resultados
 * de 11.5-11.15 do AI_BRAIN_SPEC.md já estão marcados como não confiáveis
 * (research/MASTER_PLAN.md §2.2/§3.6) e serão remedidos do zero na Fase 2,
 * usando este módulo desde o início.
 */

export interface SplitWindow<T> {
  /** Candles de treino — nunca inclui nenhuma barra que também apareça no holdout ou no warmup do holdout. */
  train: T[];
  /**
   * Candles de holdout, JÁ incluindo o warmup necessário no início (pra
   * indicadores terem histórico suficiente desde a primeira barra realmente
   * contada como observação). Quem consome este array deve descartar as
   * primeiras `warmupBars` posições do RESULTADO do backtest/avaliação —
   * elas existem só pra aquecer o indicador, nunca devem virar trade/retorno
   * contado na amostra.
   */
  holdout: T[];
  /** Quantas barras no início de `holdout` são warmup puro (não devem gerar trade contado). */
  warmupBars: number;
}

/**
 * Divide uma série em N janelas cronológicas não sobrepostas, cada uma com
 * split treino(train_pct)/holdout interno — MESMA disciplina de "nunca
 * embaralhar" das seções 11.5/11.8 do AI_BRAIN_SPEC.md, mas com embargo real.
 *
 * O warmup do holdout vem de barras que JÁ fizeram parte do treino daquela
 * mesma janela (não é possível evitar 100% — precisa de ALGUM histórico
 * antes da primeira barra do holdout) mas a diferença crítica: essas barras
 * de warmup nunca geram um trade/retorno contado na amostra de holdout —
 * são usadas apenas para o indicador convergir. Isso é diferente do bug
 * antigo, onde as barras sobrepostas TAMBÉM podiam gerar trade contado nos
 * dois lados.
 */
/**
 * Uso correto por quem consumir este split (Fase 2 em diante): rodar
 * `runBacktest` sobre `holdout` inteiro (precisa das barras de warmup pro
 * indicador convergir), depois filtrar
 * `trades.filter(t => t.entryIndex >= warmupBars)` ANTES de calcular
 * Sharpe/DSR/retorno — só trades cuja entrada aconteceu depois do warmup
 * contam como observação real. `Trade.entryIndex` existe em
 * `BacktestEngine.ts` desde 2026-07-30 exatamente pra viabilizar esse
 * filtro (antes só existia `candleIndex`, que é o índice de SAÍDA).
 */
export function splitWithEmbargo<T>(
  series: T[],
  numWindows = 3,
  trainPct = 0.7,
  warmupBars = 200
): Array<SplitWindow<T>> {
  const chunk = Math.floor(series.length / numWindows);
  const windows: Array<SplitWindow<T>> = [];

  for (let w = 0; w < numWindows; w++) {
    const sliceStart = w * chunk;
    const sliceEnd = w === numWindows - 1 ? series.length : (w + 1) * chunk;
    const slice = series.slice(sliceStart, sliceEnd);
    const splitAt = Math.floor(slice.length * trainPct);

    const train = slice.slice(0, splitAt);
    const warmupStart = Math.max(0, splitAt - warmupBars);
    const actualWarmupBars = splitAt - warmupStart;
    const holdout = slice.slice(warmupStart);

    windows.push({ train, holdout, warmupBars: actualWarmupBars });
  }

  return windows;
}
