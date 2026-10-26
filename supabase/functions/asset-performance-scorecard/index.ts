/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  JOB PERIÓDICO — Scorecard de performance por ativo                ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Ver SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md pro desenho e
 * `src/app/services/strategy/AssetScorecard.ts` pro motor puro (mesmo
 * princípio do `ai-runner`: "um motor, dois lugares que o chamam" — este
 * arquivo só busca dado e grava, a fórmula mora só lá).
 *
 * Recalcula, por usuário e símbolo, o scorecard sobre os últimos
 * `WINDOW_SIZE` trades FECHADOS (ai_trades, status=CLOSED, net_pnl not
 * null) e faz upsert em `asset_performance_scorecard`.
 *
 * STATUS (2026-08-21): job existe e grava dado real, mas o motor de decisão
 * ainda NÃO usa esse dado pra decidir nada — `ASSET_SCORECARD_ACTIVE` em
 * `runTradingCycle.ts` está `false` (proxy-backtest não mostrou melhora
 * medida ainda, dado insuficiente). Rodar este job é seguro e não muda
 * comportamento de trading nenhum hoje — só acumula histórico pra quando
 * a validação for repetida com mais dado.
 */
import {
  computeSymbolScorecard,
  DEFAULT_SCORECARD_PARAMS,
  type ClosedTradeForScorecard,
} from '../../../src/app/services/strategy/AssetScorecard.ts';
import { getServiceClient } from './lib/serviceClient.ts';

const WINDOW_SIZE = 12; // mesma janela validada no proxy-backtest de 21/08

interface TradeRow {
  user_id: string;
  symbol: string;
  net_pnl: number;
  exit_time: string;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('ASSET_SCORECARD_SHARED_SECRET');
  if (secret && req.headers.get('x-runner-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const sb = getServiceClient();

  const { data: trades, error } = await sb
    .from('ai_trades')
    .select('user_id, symbol, net_pnl, exit_time')
    .eq('status', 'CLOSED')
    .not('net_pnl', 'is', null)
    .not('exit_time', 'is', null)
    .order('exit_time', { ascending: true });

  if (error) {
    console.error('[asset-performance-scorecard] Falha ao ler ai_trades:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
  if (!trades || trades.length === 0) {
    return new Response(JSON.stringify({ upserted: 0 }), { status: 200 });
  }

  // Agrupa por (user_id, symbol) — o scorecard é por usuário, não global,
  // já que cada usuário tem sua própria carteira/histórico de trades.
  const byUserSymbol = new Map<string, TradeRow[]>();
  for (const row of trades as TradeRow[]) {
    const key = `${row.user_id}::${row.symbol}`;
    if (!byUserSymbol.has(key)) byUserSymbol.set(key, []);
    byUserSymbol.get(key)!.push(row);
  }

  const rowsToUpsert: Array<{
    user_id: string;
    symbol: string;
    n_trades: number;
    avg_pnl: number;
    std_dev: number;
    lower_bound: number;
    multiplier: number;
    window_size: number;
    updated_at: string;
  }> = [];

  for (const [key, rows] of byUserSymbol) {
    const [userId, symbol] = key.split('::');
    const window = rows.slice(-WINDOW_SIZE).map((r): ClosedTradeForScorecard => ({
      symbol: r.symbol,
      pnl: Number(r.net_pnl),
      closedAt: r.exit_time,
    }));
    const result = computeSymbolScorecard(symbol, window, DEFAULT_SCORECARD_PARAMS);

    rowsToUpsert.push({
      user_id: userId,
      symbol,
      n_trades: result.n,
      avg_pnl: result.avgPnl,
      std_dev: result.stdDev,
      lower_bound: result.lowerBound,
      multiplier: result.multiplier,
      window_size: WINDOW_SIZE,
      updated_at: new Date().toISOString(),
    });
  }

  const { error: upsertErr } = await sb
    .from('asset_performance_scorecard')
    .upsert(rowsToUpsert, { onConflict: 'user_id,symbol' });

  if (upsertErr) {
    console.error('[asset-performance-scorecard] Falha ao gravar scorecard:', upsertErr);
    return new Response(JSON.stringify({ error: String(upsertErr) }), { status: 500 });
  }

  return new Response(JSON.stringify({ upserted: rowsToUpsert.length }), { status: 200 });
});
