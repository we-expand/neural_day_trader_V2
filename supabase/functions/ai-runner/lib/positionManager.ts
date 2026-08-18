/**
 * Gestão de posições abertas — segundo driver do loop de 1s que existe hoje
 * só no browser (`useApexLogic.ts:1313-1561`). Não é parte do motor
 * (`runTradingCycle.ts` só abre posição, nunca fecha) — por isso este é um
 * módulo próprio do runner, igual `persistence.ts`, replicando a lógica de
 * TP/SL/trailing-stop em vez de importá-la (não existe pra importar: hoje
 * ela só existe inline no hook do browser).
 *
 * Fica FORA do escopo de "um motor, dois drivers": aqui o "motor" de
 * fechamento de posição é duplicado de propósito, com a mesma ressalva que
 * motivou a regra original (2026-08-05, pointValue) — qualquer mudança na
 * lógica de trailing/TP/SL do browser precisa ser replicada aqui manualmente
 * até que exista um módulo puro compartilhado (fora do escopo desta sessão).
 */
import { calculateATR, type Candle } from '../../../../src/app/services/indicators/TechnicalIndicators.ts';
import { backtestDataService, type Timeframe } from '../../../../src/app/services/BacktestDataService.ts';
import { getBatchedMT5Data, type RealMarketData } from '../../../../src/app/services/RealMarketDataService.ts';
import { getServiceClient } from './serviceClient.ts';

export interface OpenPosition {
  id: string; // ai_trades.id
  symbol: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  entryPrice: number;
  tp: number;
  sl: number;
  originalSl: number;
}

export interface PositionCloseResult {
  id: string;
  symbol: string;
  exitPrice: number;
  pnl: number;
  reason: 'TP' | 'SL';
}

/**
 * ATR "fresco" pro trailing — espelha `getFreshAtr` (useApexLogic.ts:470-483):
 * busca candles recentes do timeframe operacional e calcula ATR(period).
 * Sem cache entre ticks aqui (o runner já faz 1 fetch/tick por símbolo via
 * `getBatchedMT5Data`; candles têm cache próprio em `backtestDataService`).
 */
async function getFreshAtr(symbol: string, timeframe: Timeframe, period: number): Promise<number | null> {
  try {
    const end = new Date();
    const barMs: Record<Timeframe, number> = {
      '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
    };
    const start = new Date(end.getTime() - 100 * barMs[timeframe]);
    const history = await backtestDataService.fetchHistoricalData(symbol, start, end, timeframe);
    const candles: Candle[] = history.candles;
    if (candles.length < period + 1) return null;
    const atrSeries = calculateATR(candles, period);
    const last = atrSeries[atrSeries.length - 1];
    return last && last > 0 ? last : null;
  } catch {
    return null;
  }
}

/**
 * Um tick do position manager: busca preço real de todos os símbolos com
 * posição aberta, aplica trailing-stop (se configurado), detecta TP/SL e
 * fecha no banco. Espelha useApexLogic.ts:1313-1561, sem a parte de
 * portfolio/equity (isso é responsabilidade de quem chama, via snapshot).
 *
 * `source: 'SIMULATED'` é rejeitado aqui explicitamente (não só via
 * `isRealData`) — mesma trava não-negociável do runner descrita no handoff:
 * nunca decide (nem fecha) posição em cima de candle/preço sintético.
 */
export async function tickPositionManager(params: {
  positions: OpenPosition[];
  timeframe: Timeframe;
  stopLossMode: 'FIXO' | 'DINAMICO';
  atrTrailingPeriod: number;
  atrTrailingMultiplier: number;
}): Promise<{ closed: PositionCloseResult[]; slUpdates: Map<string, number>; prices: Map<string, number> }> {
  const { positions, timeframe, stopLossMode, atrTrailingPeriod, atrTrailingMultiplier } = params;
  const closed: PositionCloseResult[] = [];
  const slUpdates = new Map<string, number>();
  const prices = new Map<string, number>();
  if (positions.length === 0) return { closed, slUpdates, prices };

  const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
  let priceMap: Record<string, RealMarketData>;
  try {
    priceMap = await getBatchedMT5Data(uniqueSymbols);
  } catch (error) {
    console.error('[ai-runner/positionManager] getBatchedMT5Data falhou, pulando tick:', error);
    return { closed, slUpdates, prices };
  }

  for (const pos of positions) {
    const tick = priceMap[pos.symbol];
    // 🔒 Nunca fecha posição sobre dado sintético: sem preço real, mantém a
    // posição aberta e tenta de novo no próximo tick.
    // `source` é tipado como união fechada em RealMarketData, mas o valor real
    // em runtime pode chegar como 'SIMULATED' (RealMarketDataService.ts:440) —
    // daí o cast: defesa em profundidade além de `isRealData`, não confiar só
    // no tipo declarado.
    if (!tick || !tick.isRealData || (tick.source as string) === 'SIMULATED' || !(tick.price > 0)) continue;
    const nextPrice = tick.price;
    prices.set(pos.symbol, nextPrice);

    let effectiveSl = pos.sl;

    // Breakeven automático em +1R — espelha useApexLogic.ts:1439-1458. Roda
    // independente de stopLossMode (também em FIXO). Faltava aqui até
    // 2026-08-18: era a única peça da lógica de fechamento que só existia no
    // cliente, e foi a causa raiz confirmada de um balance divergente em
    // produção (posição fechada perto de zero no cliente via breakeven,
    // enquanto o servidor — sem essa lógica — manteve o SL original e só
    // fechou depois, com perda real maior). Ancorado em `originalSl`
    // (imutável), nunca em `pos.sl` (que já pode ter sido movido por esta
    // mesma função em um tick anterior).
    if (pos.originalSl > 0) {
      const originalRisk = Math.abs(pos.entryPrice - pos.originalSl);
      if (originalRisk > 0) {
        const favorableMove = pos.side === 'LONG' ? nextPrice - pos.entryPrice : pos.entryPrice - nextPrice;
        if (favorableMove >= originalRisk) {
          effectiveSl = pos.side === 'LONG' ? Math.max(effectiveSl, pos.entryPrice) : Math.min(effectiveSl, pos.entryPrice);
        }
      }
    }

    if (stopLossMode === 'DINAMICO' && pos.originalSl > 0) {
      const freshAtr = await getFreshAtr(pos.symbol, timeframe, atrTrailingPeriod);
      const originalSlDistance = Math.abs(pos.entryPrice - pos.originalSl);
      const trailDistance = freshAtr && freshAtr > 0 ? freshAtr * atrTrailingMultiplier : originalSlDistance;
      if (trailDistance > 0) {
        const trailedSl = pos.side === 'LONG' ? nextPrice - trailDistance : nextPrice + trailDistance;
        // Ratcheta a favor a partir do effectiveSl (já com breakeven aplicado
        // acima, se for o caso) — nunca solta o stop de volta.
        effectiveSl = pos.side === 'LONG' ? Math.max(effectiveSl, trailedSl) : Math.min(effectiveSl, trailedSl);
      }
    }

    if (effectiveSl !== pos.sl) slUpdates.set(pos.id, effectiveSl);

    const hitTP = pos.tp > 0 && (pos.side === 'LONG' ? nextPrice >= pos.tp : nextPrice <= pos.tp);
    const hitSL = effectiveSl > 0 && (pos.side === 'LONG' ? nextPrice <= effectiveSl : nextPrice >= effectiveSl);
    if (!hitTP && !hitSL) continue;

    const pnl = pos.side === 'LONG'
      ? (nextPrice - pos.entryPrice) * (pos.amount / pos.entryPrice)
      : (pos.entryPrice - nextPrice) * (pos.amount / pos.entryPrice);

    closed.push({ id: pos.id, symbol: pos.symbol, exitPrice: nextPrice, pnl, reason: hitTP ? 'TP' : 'SL' });
  }

  return { closed, slUpdates, prices };
}

/** Espelha `onTradeClose` (useAIPersistence.ts:256-296) — grava direto via service-role. */
export async function persistPositionClose(sessionId: string, close: PositionCloseResult): Promise<void> {
  const sb = getServiceClient();
  const pnlPercentage = close.exitPrice > 0 ? (close.pnl / (close.exitPrice * 100)) * 100 : 0;
  const { error } = await sb.from('ai_trades').update({
    exit_price: close.exitPrice,
    exit_time: new Date().toISOString(),
    pnl: close.pnl,
    pnl_percentage: pnlPercentage,
    commission: 0,
    net_pnl: close.pnl,
    status: 'CLOSED',
    exit_reason: close.reason,
  }).eq('id', close.id).eq('session_id', sessionId);
  if (error) console.error('[ai-runner/positionManager] persistPositionClose falhou:', error, close.id);
}

/** Espelha o ratchet de `originalSl`/`sl` (sl atualizado sem mexer no originalSl). */
export async function persistTrailingStopUpdate(tradeId: string, newSl: number): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from('ai_trades').update({ stop_loss: newSl }).eq('id', tradeId);
  if (error) console.error('[ai-runner/positionManager] persistTrailingStopUpdate falhou:', error, tradeId);
}

/**
 * Grava snapshot de portfolio no banco após o servidor fechar posição —
 * sem isto, `ai_portfolio_snapshots.balance` só é atualizado pelo cliente
 * (`useAIPersistence.ts:savePortfolioSnapshot`), e fica travado no valor
 * antigo indefinidamente sempre que o `ai-runner` fecha um trade sem o
 * cliente saber. Confirmado em produção 2026-08-18: trade XAUAUD fechado no
 * servidor com +$2,95, balance ficou em $100,00 antes e depois do
 * fechamento nos 24 snapshots seguintes gravados pelo cliente. Espelha o
 * shape gravado por `savePortfolioSnapshot` (useAIPersistence.ts:306-320) —
 * `margin`/`open_positions` não são rastreados por nenhum dos dois drivers
 * hoje, mantido em 0 pra não fabricar dado que não existe.
 */
export async function persistPortfolioSnapshot(params: {
  sessionId: string;
  userId: string;
  balance: number;
  equity: number;
  currentDrawdown: number;
}): Promise<void> {
  const sb = getServiceClient();
  const { sessionId, userId, balance, equity, currentDrawdown } = params;
  const { error } = await sb.from('ai_portfolio_snapshots').insert([{
    session_id: sessionId,
    user_id: userId,
    balance,
    equity,
    margin: 0,
    open_positions: 0,
    total_pnl: equity - balance,
    drawdown: currentDrawdown,
    timestamp: new Date().toISOString(),
  }]);
  if (error) console.error('[ai-runner/positionManager] persistPortfolioSnapshot falhou:', error, sessionId);
}
