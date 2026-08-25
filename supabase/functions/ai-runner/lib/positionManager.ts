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
import { calculateRoundTripCost } from '../../../../src/app/services/risk/ExecutionCost.ts';
import { BREAKEVEN_TRIGGER_R } from '../../../../src/app/services/risk/TradeFrictionControls.ts';
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
  // Grupo de Pyramiding (migration 20260819_add_pyramid_group_columns.sql) —
  // pyramidGroupId ausente = esta é a raiz do grupo (ou não é pyramiding).
  pyramidGroupId?: string | null;
  pyramidLayer?: number | null;
}

export interface PositionCloseResult {
  id: string;
  symbol: string;
  exitPrice: number;
  /**
   * PnL LÍQUIDO (bruto − custo de execução). É este o número que move o
   * balance/equity da sessão e o que aparece no log — a partir de 2026-08-23 o
   * custo de execução deixou de ser ignorado (ver ExecutionCost.ts).
   */
  pnl: number;
  /** PnL bruto, antes do custo — gravado em `ai_trades.pnl` para auditoria. */
  grossPnl: number;
  /** Custo round-trip cobrado — gravado em `ai_trades.commission`. */
  costUsd: number;
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
}): Promise<{ closed: PositionCloseResult[]; slUpdates: Map<string, number>; prices: Map<string, number>; priceFetchFailed: boolean }> {
  const { positions, timeframe, stopLossMode, atrTrailingPeriod, atrTrailingMultiplier } = params;
  const closed: PositionCloseResult[] = [];
  const slUpdates = new Map<string, number>();
  const prices = new Map<string, number>();
  if (positions.length === 0) return { closed, slUpdates, prices, priceFetchFailed: false };

  const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
  let priceMap: Record<string, RealMarketData>;
  try {
    priceMap = await getBatchedMT5Data(uniqueSymbols);
  } catch (error) {
    console.error('[ai-runner/positionManager] getBatchedMT5Data falhou, pulando tick:', error);
    return { closed, slUpdates, prices, priceFetchFailed: true };
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

    // Breakeven automático — espelha useApexLogic.ts. Roda independente de
    // stopLossMode (também em FIXO). Faltava aqui até 2026-08-18: era a única
    // peça da lógica de fechamento que só existia no cliente, e foi a causa
    // raiz confirmada de um balance divergente em produção (posição fechada
    // perto de zero no cliente via breakeven, enquanto o servidor — sem essa
    // lógica — manteve o SL original e só fechou depois, com perda real
    // maior). Ancorado em `originalSl` (imutável), nunca em `pos.sl` (que já
    // pode ter sido movido por esta mesma função em um tick anterior).
    //
    // 2026-08-25: gatilho passou de +1R para +BREAKEVEN_TRIGGER_R (1,5R) —
    // fonte única compartilhada com o cliente, ver TradeFrictionControls.ts
    // para a medição que motivou (27% dos "SL" fechavam em ~zero e o motor
    // reabria em minutos, pagando round-trip de novo).
    if (pos.originalSl > 0) {
      const originalRisk = Math.abs(pos.entryPrice - pos.originalSl);
      if (originalRisk > 0) {
        const favorableMove = pos.side === 'LONG' ? nextPrice - pos.entryPrice : pos.entryPrice - nextPrice;
        if (favorableMove >= originalRisk * BREAKEVEN_TRIGGER_R) {
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

    const grossPnl = pos.side === 'LONG'
      ? (nextPrice - pos.entryPrice) * (pos.amount / pos.entryPrice)
      : (pos.entryPrice - nextPrice) * (pos.amount / pos.entryPrice);

    // Custo de execução (spread + slippage), do CostModel calibrado — o mesmo
    // que o COST_GATE já usa pra RECUSAR trade. Até 2026-08-23 o gate cobrava
    // o custo na decisão mas o fechamento gravava `commission: 0`, e o PnL
    // saía de preço médio na entrada E na saída. Ver ExecutionCost.ts.
    const { costUsd } = calculateRoundTripCost(pos.symbol, pos.amount, pos.entryPrice);
    const pnl = grossPnl - costUsd;

    closed.push({
      id: pos.id, symbol: pos.symbol, exitPrice: nextPrice,
      pnl, grossPnl, costUsd, reason: hitTP ? 'TP' : 'SL',
    });
  }

  return { closed, slUpdates, prices, priceFetchFailed: false };
}

/** Espelha `onTradeClose` (useAIPersistence.ts:256-296) — grava direto via service-role. */
export async function persistPositionClose(sessionId: string, close: PositionCloseResult): Promise<void> {
  const sb = getServiceClient();
  // Convenção do schema (`ai_sessions` tem total_pnl / total_commission /
  // net_pnl): `pnl` = BRUTO, `commission` = custo cobrado, `net_pnl` = líquido.
  // Consumidores que mostram resultado ao usuário devem ler `net_pnl`.
  const pnlPercentage = close.exitPrice > 0 ? (close.pnl / (close.exitPrice * 100)) * 100 : 0;
  const { error } = await sb.from('ai_trades').update({
    exit_price: close.exitPrice,
    exit_time: new Date().toISOString(),
    pnl: close.grossPnl,
    pnl_percentage: pnlPercentage,
    commission: close.costUsd,
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

// ════════════════════════════════════════════════════════════════════════
// PYRAMIDING — Take Profit Parcial e Fechar em Reversão (2026-08-19)
// ════════════════════════════════════════════════════════════════════════
// Por que aqui e não no client (useApexLogic.ts): ambas as features exigem
// FECHAR (mesmo que parte de) uma posição — e desde 2026-08-18 o client não
// tem mais autoridade de fechamento em DEMO (era exatamente essa autoridade
// dupla client/servidor que corrompia balance em produção, ver
// SESSAO_2026-08-18). Layer-adding/break-even/trailing continuam no client
// porque só MOVEM SL (o servidor fecha depois pelo caminho normal de
// TP/SL); Partial TP e reversão precisam fechar na hora, sem esperar SL/TP
// cruzar — só o servidor pode fazer isso hoje.
//
// Convenção de fechamento parcial: NUNCA um UPDATE que reduz quantity sem
// deixar rastro do que foi fechado — mesma regra de "nunca UPDATE silencioso
// em dado financeiro" do CLAUDE.md. Fechamento parcial = INSERT de uma nova
// linha CLOSED com a fração fechada (auditável, join por pyramid_group_id/
// entry_time) + UPDATE reduzindo `quantity` da linha original (que continua
// OPEN com o restante).

export interface PyramidGroupPosition extends OpenPosition {
  currentPrice?: number;
}

/**
 * Fecha uma FRAÇÃO de uma posição aberta: insere uma nova linha CLOSED com
 * a quantidade fechada (rastreável — nunca destrói a linha original) e
 * reduz `quantity` da linha original, que continua OPEN.
 */
export async function partialClosePosition(params: {
  sessionId: string;
  userId: string;
  position: OpenPosition;
  closePercent: number; // 0-100
  exitPrice: number;
  reason: 'PARTIAL_TP' | 'REVERSAL';
}): Promise<{ closedAmount: number; remainingAmount: number; pnl: number } | null> {
  const { sessionId, userId, position, closePercent, exitPrice, reason } = params;
  if (!(closePercent > 0) || !(exitPrice > 0)) return null;

  const closedAmount = position.amount * Math.min(closePercent, 100) / 100;
  const remainingAmount = position.amount - closedAmount;
  if (!(closedAmount > 0)) return null;

  const grossPnl = position.side === 'LONG'
    ? (exitPrice - position.entryPrice) * (closedAmount / position.entryPrice)
    : (position.entryPrice - exitPrice) * (closedAmount / position.entryPrice);

  // Custo round-trip sobre a FRAÇÃO fechada — um fechamento parcial paga
  // spread proporcional ao que saiu, não ao notional inteiro do grupo.
  const { costUsd } = calculateRoundTripCost(position.symbol, closedAmount, position.entryPrice);
  const pnl = grossPnl - costUsd;

  const sb = getServiceClient();
  const { data: original, error: readErr } = await sb.from('ai_trades').select('*').eq('id', position.id).single();
  if (readErr || !original) {
    console.error('[ai-runner/positionManager] partialClosePosition: falha ao ler trade original', readErr, position.id);
    return null;
  }

  const pnlPercentage = exitPrice > 0 ? (pnl / (exitPrice * 100)) * 100 : 0;
  const { error: insertErr } = await sb.from('ai_trades').insert([{
    session_id: sessionId,
    user_id: userId,
    symbol: original.symbol,
    type: original.type,
    side: original.side,
    entry_price: original.entry_price,
    exit_price: exitPrice,
    quantity: closedAmount,
    stop_loss: original.stop_loss,
    take_profit: original.take_profit,
    pnl: grossPnl,
    pnl_percentage: pnlPercentage,
    commission: costUsd,
    net_pnl: pnl,
    ai_confidence: original.ai_confidence,
    ai_reasoning: `${original.ai_reasoning ?? ''} [fechamento parcial ${closePercent}% — ${reason}]`.trim(),
    indicators_snapshot: original.indicators_snapshot,
    entry_time: original.entry_time,
    exit_time: new Date().toISOString(),
    status: 'CLOSED',
    exit_reason: 'AI_SIGNAL',
    pyramid_group_id: original.pyramid_group_id,
    pyramid_layer: original.pyramid_layer,
  }]);
  if (insertErr) {
    console.error('[ai-runner/positionManager] partialClosePosition: falha ao inserir fração fechada', insertErr, position.id);
    return null;
  }

  if (remainingAmount > 0) {
    const { error: updateErr } = await sb.from('ai_trades').update({ quantity: remainingAmount }).eq('id', position.id);
    if (updateErr) console.error('[ai-runner/positionManager] partialClosePosition: falha ao reduzir quantity restante (fração fechada já persistida)', updateErr, position.id);
  } else {
    // Fechou 100% — a linha original também precisa virar CLOSED (não pode
    // ficar OPEN com quantity=0). Espelha persistPositionClose.
    const { error: closeErr } = await sb.from('ai_trades').update({
      exit_price: exitPrice, exit_time: new Date().toISOString(), pnl: grossPnl, pnl_percentage: pnlPercentage,
      commission: costUsd, net_pnl: pnl, status: 'CLOSED', exit_reason: 'AI_SIGNAL',
    }).eq('id', position.id);
    if (closeErr) console.error('[ai-runner/positionManager] partialClosePosition: falha ao fechar linha original em 100%', closeErr, position.id);
  }

  return { closedAmount, remainingAmount, pnl };
}

export interface PyramidingConfigForServer {
  partialTakeProfitEnabled: boolean;
  partialTakeProfitPercent: number;
  partialTakeProfitLayers: number[];
  closeAllOnReversal: boolean;
}

/**
 * Avalia Take Profit Parcial e Fechar-em-Reversão pra todos os grupos de
 * pyramiding com posição OPEN. Chamado a cada tick do position manager,
 * depois do TP/SL normal (`tickPositionManager`) já ter rodado.
 *
 * `reversalSignal`: direção do sinal de entrada MAIS RECENTE do motor pro
 * símbolo do grupo, se disponível nesta invocação — vem do próprio ciclo de
 * trading (`runTradingCycle`), nunca fabricado aqui. Sem sinal disponível
 * (símbolo não avaliado neste tick), `closeAllOnReversal` não dispara —
 * melhor não fechar do que fechar com base em um "sinal" inventado.
 */
export interface PyramidGroupUpdate {
  orderId: string;
  closedAmount: number;
  remainingAmount: number;
  pnl: number;
  fullyClosed: boolean;
}

export async function evaluatePyramidGroups(params: {
  sessionId: string;
  userId: string;
  positions: PyramidGroupPosition[]; // já com currentPrice preenchido pelo tick de TP/SL
  cfg: PyramidingConfigForServer;
  reversalSignalBySymbol: Map<string, 'LONG' | 'SHORT'>;
  triggeredPartialLayersByGroup: Map<string, Set<number>>; // estado em memória da invocação — evita disparar 2x o mesmo layer
}): Promise<PyramidGroupUpdate[]> {
  const { sessionId, userId, positions, cfg, reversalSignalBySymbol, triggeredPartialLayersByGroup } = params;
  const updates: PyramidGroupUpdate[] = [];
  if (positions.length === 0) return updates;

  const groups = new Map<string, PyramidGroupPosition[]>();
  for (const pos of positions) {
    const key = pos.pyramidGroupId ?? pos.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(pos);
  }

  for (const [groupKey, group] of groups) {
    if (group.length < 2) continue; // sem layer adicionado, não é pyramid de fato

    // Fechar em reversão — checa PRIMEIRO: se o grupo inteiro vai fechar,
    // não faz sentido ainda avaliar TP parcial nele.
    if (cfg.closeAllOnReversal) {
      const symbol = group[0].symbol;
      const groupSide = group[0].side;
      const signal = reversalSignalBySymbol.get(symbol);
      if (signal && signal !== groupSide) {
        for (const pos of group) {
          const exitPrice = pos.currentPrice && pos.currentPrice > 0 ? pos.currentPrice : pos.entryPrice;
          const result = await partialClosePosition({ sessionId, userId, position: pos, closePercent: 100, exitPrice, reason: 'REVERSAL' });
          if (result) updates.push({ orderId: pos.id, closedAmount: result.closedAmount, remainingAmount: result.remainingAmount, pnl: result.pnl, fullyClosed: true });
        }
        continue; // grupo fechado (ou tentativa feita) — não avalia TP parcial
      }
    }

    if (cfg.partialTakeProfitEnabled && cfg.partialTakeProfitLayers.length > 0) {
      const maxLayerInGroup = Math.max(...group.map(p => p.pyramidLayer ?? 1));
      let triggered = triggeredPartialLayersByGroup.get(groupKey);
      if (!triggered) {
        triggered = new Set();
        triggeredPartialLayersByGroup.set(groupKey, triggered);
      }
      for (const targetLayer of cfg.partialTakeProfitLayers) {
        if (maxLayerInGroup < targetLayer || triggered.has(targetLayer)) continue;
        triggered.add(targetLayer);
        for (const pos of group) {
          const exitPrice = pos.currentPrice && pos.currentPrice > 0 ? pos.currentPrice : pos.entryPrice;
          const result = await partialClosePosition({ sessionId, userId, position: pos, closePercent: cfg.partialTakeProfitPercent, exitPrice, reason: 'PARTIAL_TP' });
          if (result) updates.push({ orderId: pos.id, closedAmount: result.closedAmount, remainingAmount: result.remainingAmount, pnl: result.pnl, fullyClosed: result.remainingAmount <= 0 });
        }
      }
    }
  }

  return updates;
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
