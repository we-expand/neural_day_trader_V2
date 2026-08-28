/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  JOB PERIÓDICO — resultado hipotético do cérebro sombra             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Passo 1 da cadeia "memória de decisões passadas" pro cérebro de decisão
 * analítico (ver SESSAO_2026-08-28_GERENCIAMENTO_DE_SAIDA_E_CEREBRO_ANALITICO.md,
 * item "⏸️ EXATAMENTE ONDE PARAMOS"). Este job SÓ calcula e grava o
 * resultado — não lê nem monta contexto de prompt (isso é o passo 2/3,
 * ainda não implementado).
 *
 * O que faz, por invocação:
 *   1. Lê até BATCH_SIZE linhas de `ai_decision_brain_shadow` com
 *      `hypothetical_outcome_computed_at IS NULL` e `created_at` velho o
 *      bastante pra ter candle real disponível (>= MIN_AGE_MINUTES).
 *   2. Agrupa por símbolo, busca candle real de 1m desde `created_at` até
 *      agora (ou até MAX_HORIZON_HOURS) — UMA busca por símbolo, não uma
 *      por linha, mesma disciplina de `checkGapWindowBreaches`
 *      (positionManager.ts) sobre a conta MetaAPI compartilhada.
 *   3. Pra cada linha, reconstrói o stop/alvo hipotético a partir de
 *      `entry_price_snapshot`/`atr_snapshot` (gravados no momento da
 *      decisão) com a MESMA aritmética do motor real
 *      (STOP_ATR_MULTIPLIER × ATR, alvo = RISK_REWARD_MULTIPLE × stop —
 *      `runTradingCycle.ts`, fonte única) aplicada ao `mechanical_side`.
 *   4. Caminha os candles em ORDEM CRONOLÓGICA verificando se HIGH/LOW
 *      cruzou o stop ou o alvo primeiro — mesma convenção conservadora de
 *      `checkGapWindowBreaches`: se o candle cruza os dois, assume o pior
 *      caso (stop) primeiro, nunca fabrica o cenário mais favorável.
 *   5. Sem stop nem alvo atingido dentro de MAX_HORIZON_HOURS: marca
 *      TIMEOUT com R marcado a mercado no último candle disponível — toda
 *      linha eventualmente recebe um resultado, nenhuma fica pendente pra
 *      sempre.
 *   6. Candle real indisponível (símbolo sem fonte, erro de rede): marca
 *      NO_DATA — nunca fabrica resultado.
 *
 * Agendamento: cron PRÓPRIO, deliberadamente separado do `ai-runner`
 * (1×/min) — este job não precisa de cadência alta e rodar junto
 * aumentaria carga na conta MetaAPI compartilhada sem necessidade. Rodar a
 * cada 30-60min é suficiente (o resultado mais recente possível de calcular
 * é sempre MIN_AGE_MINUTES atrás).
 */
import { backtestDataService } from '../../../src/app/services/BacktestDataService.ts';
import { STOP_ATR_MULTIPLIER, RISK_REWARD_MULTIPLE } from '../../../src/app/services/strategy/runTradingCycle.ts';
import { getServiceClient } from './lib/serviceClient.ts';

const BATCH_SIZE = 50;
// Candle de 1m mais recente sai com alguns segundos de atraso da fonte real
// (Binance/MetaAPI) — 10min de folga evita reprocessar uma linha ainda "no
// presente" e sem candle suficiente pra decidir nada.
const MIN_AGE_MINUTES = 10;
// Horizonte máximo de espera por stop/alvo. Trades reais deste motor fecham
// em minutos a poucas horas (ver research/experiments/2026-08-28-partial-tp-1r
// e sessões anteriores de MFE) — 24h é folga generosa antes de marcar TIMEOUT.
const MAX_HORIZON_HOURS = 24;

interface ShadowRow {
  id: string;
  symbol: string;
  created_at: string;
  mechanical_side: 'LONG' | 'SHORT' | null;
  entry_price_snapshot: number | null;
  atr_snapshot: number | null;
}

function replayOutcome(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  stopDistance: number,
  candles: Array<{ time: number; high: number; low: number; close: number }>,
): { outcome: 'WIN' | 'LOSS' | 'TIMEOUT'; rMultiple: number } {
  const targetDistance = stopDistance * RISK_REWARD_MULTIPLE;
  const stopPrice = side === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance;
  const targetPrice = side === 'LONG' ? entryPrice + targetDistance : entryPrice - targetDistance;

  for (const c of candles) {
    const hitStop = side === 'LONG' ? c.low <= stopPrice : c.high >= stopPrice;
    const hitTarget = side === 'LONG' ? c.high >= targetPrice : c.low <= targetPrice;
    // Ambiguidade (candle cruza os dois): pior caso primeiro — mesma
    // convenção conservadora de `checkGapWindowBreaches`.
    if (hitStop) return { outcome: 'LOSS', rMultiple: -1 };
    if (hitTarget) return { outcome: 'WIN', rMultiple: RISK_REWARD_MULTIPLE };
  }

  // Nem stop nem alvo — marca a mercado no último candle da janela buscada.
  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : entryPrice;
  const move = side === 'LONG' ? lastClose - entryPrice : entryPrice - lastClose;
  return { outcome: 'TIMEOUT', rMultiple: move / stopDistance };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('DECISION_BRAIN_OUTCOME_SHARED_SECRET');
  if (secret && req.headers.get('x-runner-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60_000).toISOString();

  const { data: rows, error } = await sb
    .from('ai_decision_brain_shadow')
    .select('id, symbol, created_at, mechanical_side, entry_price_snapshot, atr_snapshot')
    .is('hypothetical_outcome_computed_at', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[decision-brain-outcome] Falha ao ler linhas pendentes:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ evaluated: 0 }), { status: 200 });
  }

  const typedRows = rows as ShadowRow[];
  const now = new Date();
  const candlesBySymbol = new Map<string, Array<{ time: number; high: number; low: number; close: number }>>();

  const uniqueSymbols = [...new Set(typedRows.map(r => r.symbol))];
  for (const symbol of uniqueSymbols) {
    const symbolRows = typedRows.filter(r => r.symbol === symbol);
    const earliestCreatedAt = symbolRows.reduce(
      (min, r) => Math.min(min, new Date(r.created_at).getTime()),
      Infinity,
    );
    const start = new Date(earliestCreatedAt);
    const horizonEnd = new Date(earliestCreatedAt + MAX_HORIZON_HOURS * 60 * 60_000);
    const end = horizonEnd < now ? horizonEnd : now;
    try {
      const history = await backtestDataService.fetchHistoricalData(symbol, start, end, '1m');
      candlesBySymbol.set(symbol, history.candles);
    } catch (fetchError) {
      console.warn(`[decision-brain-outcome] falha ao buscar candle real pra ${symbol}, linhas ficam NO_DATA neste ciclo:`, fetchError);
      candlesBySymbol.set(symbol, []);
    }
  }

  let evaluated = 0;
  let errors = 0;
  for (const row of typedRows) {
    const computedAt = new Date().toISOString();

    if (!row.mechanical_side || row.entry_price_snapshot == null || row.atr_snapshot == null || row.atr_snapshot <= 0) {
      // Contexto insuficiente pra reconstruir stop/alvo (linhas gravadas
      // antes de 2026-08-29, ou ATR indisponível no momento da decisão) —
      // nunca fabrica um valor, marca NO_DATA e segue.
      const { error: upErr } = await sb.from('ai_decision_brain_shadow').update({
        hypothetical_outcome: 'NO_DATA',
        hypothetical_r_multiple: null,
        hypothetical_outcome_computed_at: computedAt,
      }).eq('id', row.id);
      if (upErr) { console.error(`[decision-brain-outcome] falha ao gravar NO_DATA pra ${row.id}:`, upErr); errors++; }
      else evaluated++;
      continue;
    }

    const allCandles = candlesBySymbol.get(row.symbol) ?? [];
    const createdAtMs = new Date(row.created_at).getTime();
    const forwardCandles = allCandles.filter(c => c.time >= createdAtMs);

    if (forwardCandles.length === 0) {
      const { error: upErr } = await sb.from('ai_decision_brain_shadow').update({
        hypothetical_outcome: 'NO_DATA',
        hypothetical_r_multiple: null,
        hypothetical_outcome_computed_at: computedAt,
      }).eq('id', row.id);
      if (upErr) { console.error(`[decision-brain-outcome] falha ao gravar NO_DATA pra ${row.id}:`, upErr); errors++; }
      else evaluated++;
      continue;
    }

    const stopDistance = row.atr_snapshot * STOP_ATR_MULTIPLIER;
    const { outcome, rMultiple } = replayOutcome(row.mechanical_side, row.entry_price_snapshot, stopDistance, forwardCandles);

    // TIMEOUT só é definitivo quando a janela de busca já alcançou o
    // horizonte máximo (ou o presente) — senão a linha continua pendente
    // pro próximo ciclo, ainda pode bater stop/alvo depois.
    const windowExhausted = (now.getTime() - createdAtMs) >= MAX_HORIZON_HOURS * 60 * 60_000
      || (allCandles.length > 0 && allCandles[allCandles.length - 1].time >= now.getTime() - 5 * 60_000);
    if (outcome === 'TIMEOUT' && !windowExhausted) continue;

    const { error: upErr } = await sb.from('ai_decision_brain_shadow').update({
      hypothetical_outcome: outcome,
      hypothetical_r_multiple: rMultiple,
      hypothetical_outcome_computed_at: computedAt,
    }).eq('id', row.id);
    if (upErr) { console.error(`[decision-brain-outcome] falha ao gravar resultado pra ${row.id}:`, upErr); errors++; }
    else evaluated++;
  }

  return new Response(JSON.stringify({ evaluated, errors, pendingBatch: typedRows.length }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
