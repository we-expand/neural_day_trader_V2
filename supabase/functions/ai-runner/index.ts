/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  RUNNER — driver servidor do motor de decisão (passo 3)           ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Ver NEXT_SESSION.md (2026-08-07) pro plano completo. Resumo: opera de
 * verdade em DEMO, importando `runTradingCycle` (motor puro, sem cópia —
 * "um motor, dois drivers") em vez de reimplementar a lógica de decisão.
 *
 * DESENHO DE INVOCAÇÃO: função HTTP invocada periodicamente por cron externo
 * (pg_cron via `net.http_post`, ou scheduler equivalente — não existe
 * infraestrutura de cron no projeto ainda, ver SQL de exemplo no fim deste
 * arquivo). Cada invocação roda um LOOP LIMITADO por até `MAX_RUNTIME_MS`
 * (folga sob o timeout de função Edge), tickando o gerenciador de posição a
 * cada 1s e o ciclo de trading a cada 5s — replicando a cadência dos dois
 * `setInterval` que hoje só existem no browser (useApexLogic.ts:1257,1313).
 *
 * LIMITAÇÃO CONHECIDA (documentada, não escondida): estado como cooldown،
 * lastTradedSymbol, cache de notícias/VIX e buffer de candles vive só DENTRO
 * de uma invocação — reseta a cada novo disparo do cron. Como o cooldown
 * padrão é 5s e o cron é esperado rodar a cada ~1min com uma janela interna
 * de ~45s, o efeito prático é pequeno (a maior parte do tempo o loop já está
 * "quente" dentro da própria invocação), mas não é idêntico a um processo
 * longínquo de verdade. Cross-invocação, RISK_GATE/kill-switch/max-trades
 * continuam corretos porque são recalculados a partir de `ai_trades`
 * (histórico real no banco), não do estado efêmero.
 *
 * REQUISITO NÃO-NEGOCIÁVEL: jamais decide (abre OU fecha) posição sobre
 * `source: 'SIMULATED'`. `runTradingCycle` já guarda isso via
 * `marketData.isRealData` (linha 385); `positionManager.ts` reforça a mesma
 * checagem no próprio fetch de preço (path que não passa pelo motor).
 */
import { runTradingCycle, type TradingCycleState, type TradingCycleDeps, type TradingCycleEffect } from '../../../src/app/services/strategy/runTradingCycle.ts';
import type { AIConfig, PortfolioState, TradeVisual } from '../../../src/app/types/tradingState.ts';
import type { Candle } from '../../../src/app/services/indicators/TechnicalIndicators.ts';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies.ts';
import { getServiceClient } from './lib/serviceClient.ts';
import { createRunnerPersistence } from './lib/persistence.ts';
import { tickPositionManager, persistPositionClose, persistTrailingStopUpdate, type OpenPosition } from './lib/positionManager.ts';

const MAX_RUNTIME_MS = 45_000; // folga sob o timeout de função Edge (invocada a cada ~1min por cron)
const POSITION_TICK_MS = 1_000;
const TRADING_CYCLE_TICK_MS = 5_000;

interface RunnerSessionState {
  sessionId: string;
  userId: string;
  config: AIConfig;
  activeOrders: TradeVisual[];
  portfolio: PortfolioState;
  orderHistory: TradeVisual[]; // trades fechados hoje (pra gates de risco/revenge) — carregado uma vez por invocação
  candleBuffer: Map<string, { candles: Candle[]; fetchedAt: number }>;
  lastTradeTimestamp: number;
  lastTradedSymbol: string | null;
  cooldownUntil: number;
  lastStaleDataWarningAt: number;
  cachedNewsEvents: Array<{ time: number; impact: string; currency: string }>;
  cachedVIX: number;
  isActive: boolean;
  persistence: ReturnType<typeof createRunnerPersistence>;
}

async function loadSession(row: Record<string, any>): Promise<RunnerSessionState | null> {
  const sb = getServiceClient();
  const sessionId: string = row.id;
  const userId: string = row.user_id;
  const config: AIConfig = row.config;
  if (!config) {
    console.error(`[ai-runner] Sessão ${sessionId} sem 'config' salvo — pulando (não dá pra reconstruir AIConfig).`);
    return null;
  }

  const [{ data: openTrades, error: openErr }, { data: snapshots, error: snapErr }, { data: closedToday, error: closedErr }] = await Promise.all([
    sb.from('ai_trades').select('*').eq('session_id', sessionId).eq('status', 'OPEN'),
    sb.from('ai_portfolio_snapshots').select('*').eq('session_id', sessionId).order('timestamp', { ascending: false }).limit(1),
    sb.from('ai_trades').select('*').eq('session_id', sessionId).eq('status', 'CLOSED')
      .gte('exit_time', new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString()),
  ]);
  if (openErr || snapErr || closedErr) {
    console.error(`[ai-runner] Falha ao carregar estado da sessão ${sessionId}:`, openErr || snapErr || closedErr);
    return null;
  }

  const activeOrders: TradeVisual[] = (openTrades ?? []).map((t: any) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side,
    amount: t.quantity,
    price: t.entry_price,
    currentPrice: t.entry_price,
    tp: t.take_profit ?? 0,
    sl: t.stop_loss ?? 0,
    originalSl: t.stop_loss ?? 0,
    leverage: 1.5,
    ai_confidence: t.ai_confidence ?? 0,
    timestamp: new Date(t.entry_time).getTime(),
    reasoning: t.ai_reasoning ?? '',
    indicators: t.indicators_snapshot ?? {},
    currentProfit: 0,
  }));

  const orderHistory: TradeVisual[] = (closedToday ?? []).map((t: any) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side,
    amount: t.quantity,
    price: t.entry_price,
    currentPrice: t.exit_price ?? t.entry_price,
    tp: t.take_profit ?? 0,
    sl: t.stop_loss ?? 0,
    originalSl: t.stop_loss ?? 0,
    leverage: 1.5,
    ai_confidence: t.ai_confidence ?? 0,
    timestamp: new Date(t.entry_time).getTime(),
    closedAt: t.exit_time ? new Date(t.exit_time).getTime() : undefined,
    currentProfit: t.pnl ?? 0,
    reasoning: t.ai_reasoning ?? '',
    indicators: t.indicators_snapshot ?? {},
  }));

  const snap = snapshots?.[0];
  const portfolio: PortfolioState = {
    balance: snap?.balance ?? row.initial_balance ?? 100,
    equity: snap?.equity ?? row.initial_equity ?? row.initial_balance ?? 100,
    initialBalance: row.initial_balance ?? 100,
    currentDrawdown: snap?.drawdown ?? 0,
    peakEquity: snap?.max_equity ?? snap?.equity ?? row.initial_balance ?? 100,
    dayAnchorEquity: snap?.equity ?? row.initial_equity ?? row.initial_balance ?? 100,
    // dayAnchorBalance precisa vir do BALANCE do último snapshot, nunca de equity —
    // RiskManager compara isso contra account.balance (realizado); misturar com
    // equity (que inclui P&L não-realizado) gera "perda diária" falsa sempre que
    // há posição aberta lucrativa. Bug confirmado em produção 2026-08-17/18: sessão
    // com equity 107.77 > balance 82.96 (posição aberta lucrativa) foi lida como
    // -23% de perda diária e bloqueou toda nova entrada via RISK_GATE.
    dayAnchorBalance: snap?.balance ?? row.initial_balance ?? 100,
  } as PortfolioState;

  return {
    sessionId,
    userId,
    config,
    activeOrders,
    portfolio,
    orderHistory,
    candleBuffer: new Map(),
    lastTradeTimestamp: 0,
    lastTradedSymbol: null,
    cooldownUntil: 0,
    lastStaleDataWarningAt: 0,
    cachedNewsEvents: [],
    cachedVIX: 0,
    isActive: true,
    persistence: createRunnerPersistence(sessionId, userId),
  };
}

async function positionManagerTick(s: RunnerSessionState): Promise<void> {
  if (s.activeOrders.length === 0) return;
  const positions: OpenPosition[] = s.activeOrders.map(o => ({
    id: o.id, symbol: o.symbol, side: o.side, amount: o.amount,
    entryPrice: o.price, tp: o.tp, sl: o.sl, originalSl: o.originalSl,
  }));

  const { closed, slUpdates, prices } = await tickPositionManager({
    positions,
    timeframe: normalizeTf(s.config.timeframe),
    stopLossMode: s.config.stopLossMode,
    atrTrailingPeriod: s.config.atrTrailingPeriod || 14,
    atrTrailingMultiplier: s.config.atrTrailingMultiplier || 2.0,
  });

  for (const [id, newSl] of slUpdates) {
    const order = s.activeOrders.find(o => o.id === id);
    if (order) order.sl = newSl;
    await persistTrailingStopUpdate(id, newSl);
  }
  for (const [symbol, price] of prices) {
    for (const order of s.activeOrders) if (order.symbol === symbol) order.currentPrice = price;
  }

  if (closed.length > 0) {
    const closedIds = new Set(closed.map(c => c.id));
    s.activeOrders = s.activeOrders.filter(o => !closedIds.has(o.id));
    for (const c of closed) {
      console.log(`[ai-runner] ${c.reason} atingido: ${c.symbol} @ ${c.exitPrice} (pnl=${c.pnl.toFixed(2)})`);
      await persistPositionClose(s.sessionId, c);
    }
  }
}

function normalizeTf(tf: string | undefined): '1m' | '5m' | '15m' | '1h' | '4h' | '1d' {
  const valid = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const lower = (tf || '5m').toLowerCase();
  return (valid.includes(lower) ? lower : '5m') as any;
}

async function tradingCycleTick(s: RunnerSessionState): Promise<void> {
  if (!s.isActive) return;

  const state: TradingCycleState = {
    activeOrders: s.activeOrders,
    aiConfig: s.config,
    portfolio: s.portfolio,
    orderHistory: s.orderHistory,
    lastTradeTimestamp: s.lastTradeTimestamp,
    lastTradedSymbol: s.lastTradedSymbol,
    cooldownUntil: s.cooldownUntil,
    lastStaleDataWarningAt: s.lastStaleDataWarningAt,
    cachedNewsEvents: s.cachedNewsEvents,
    cachedVIX: s.cachedVIX,
  };

  const deps: TradingCycleDeps = {
    strategies: PRESET_STRATEGIES,
    executionMode: 'DEMO',
    telemetrySessionId: s.sessionId,
    userId: s.userId,
    candleBuffer: s.candleBuffer,
    persistence: s.persistence,
    // Runner é DEMO-only (ver NEXT_SESSION.md) — execução LIVE/forceCloseAllLivePositions
    // fica fora de escopo; applyEffect só existe pra não perder o log fire-and-forget.
    applyEffect: (effect) => console.log('[ai-runner] efeito pós-retorno:', JSON.stringify(effect)),
    fetchNewsCached: async () => s.cachedNewsEvents,
    fetchVIXCached: async () => s.cachedVIX,
    // getWsPrice deliberadamente omitido — sem WebSocket no servidor, cai pro REST (RealMarketDataService).
  };

  let result;
  try {
    result = await runTradingCycle(state, deps);
  } catch (error) {
    console.error(`[ai-runner] runTradingCycle lançou pra sessão ${s.sessionId}:`, error);
    return;
  }

  s.lastTradeTimestamp = result.nextLastTradeTimestamp;
  s.lastTradedSymbol = result.nextLastTradedSymbol;
  s.cooldownUntil = result.nextCooldownUntil;
  s.lastStaleDataWarningAt = result.nextLastStaleDataWarningAt;

  applyEffects(s, result.effects);
  await Promise.allSettled(s.persistence.pending);
  s.persistence.pending.length = 0;
}

/** Espelha `applyTradingCycleEffect` (useApexLogic.ts:1227-1255) — sem React/toast, log + estado local. */
function applyEffects(s: RunnerSessionState, effects: TradingCycleEffect[]): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'ADD_ORDER': {
        // O motor gerou um id sintético; a linha real em ai_trades já foi
        // criada por persistence.onTradeOpen (aguardado acima) — corrige o id
        // aqui pra o position manager desta mesma invocação achar a linha.
        const trade = { ...effect.trade };
        const dbId = s.persistence.idMap.get(trade.id);
        if (dbId) trade.id = dbId;
        else console.error(`[ai-runner] ADD_ORDER sem id de banco mapeado (onTradeOpen falhou?) — posição ${trade.symbol} não será monitorada por TP/SL`);
        s.activeOrders.push(trade);
        break;
      }
      case 'CLOSE_ALL_ORDERS':
        // Espelha o driver browser: só limpa o estado em memória (kill-switch
        // não persiste fechamento em DEMO hoje — comportamento herdado, não
        // introduzido por este driver, ver useApexLogic.ts:1232-1234).
        s.activeOrders = [];
        break;
      case 'SET_ACTIVE':
        s.isActive = effect.value;
        break;
      case 'SET_SAFE_MODE':
        console.error(`[ai-runner] SAFE MODE (sessão ${s.sessionId}): ${effect.reason ?? '(sem motivo)'}`);
        break;
      case 'LOG':
        console.log(`[ai-runner] ${effect.message}`);
        break;
      case 'TOAST_SUCCESS':
      case 'TOAST_WARNING':
      case 'TOAST_ERROR':
        console.log(`[ai-runner] [${effect.type}] ${effect.title}${effect.description ? ' — ' + effect.description : ''}`);
        break;
    }
  }
}

async function runSession(s: RunnerSessionState, deadline: number): Promise<void> {
  let lastPositionTick = 0;
  let lastTradingTick = 0;
  while (Date.now() < deadline) {
    const now = Date.now();
    if (now - lastPositionTick >= POSITION_TICK_MS) {
      lastPositionTick = now;
      await positionManagerTick(s);
    }
    if (s.isActive && now - lastTradingTick >= TRADING_CYCLE_TICK_MS) {
      lastTradingTick = now;
      await tradingCycleTick(s);
    }
    if (!s.isActive) {
      // Kill-switch/parada manual dentro desta invocação: encerra o loop
      // desta sessão cedo (sem sentido continuar tickando posição fechada).
      if (s.activeOrders.length === 0) break;
    }
    await new Promise(r => setTimeout(r, 250));
  }

  // Persiste estado final da sessão (status + snapshot de portfolio) antes de sair.
  const sb = getServiceClient();
  if (!s.isActive) {
    await sb.from('ai_sessions').update({ status: 'PAUSED' }).eq('id', s.sessionId);
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('AI_RUNNER_SHARED_SECRET');
  if (secret && req.headers.get('x-runner-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const sb = getServiceClient();
  const { data: sessions, error } = await sb
    .from('ai_sessions')
    .select('*')
    .eq('status', 'RUNNING')
    .eq('mode', 'DEMO');

  if (error) {
    console.error('[ai-runner] Falha ao listar sessões RUNNING:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return new Response(JSON.stringify({ sessions: 0 }), { status: 200 });
  }

  const deadline = Date.now() + MAX_RUNTIME_MS;
  const loaded = (await Promise.all(sessions.map(loadSession))).filter((s): s is RunnerSessionState => s !== null);

  // Sessões rodam em SÉRIE, nunca em paralelo — a conta MetaAPI da plataforma é
  // compartilhada entre todos os usuários (ver CLAUDE.md, "Risco crônico
  // conhecido"), e chamadas concorrentes contra ela batem em guarda de
  // concorrência da própria MetaAPI ("Conflicting API keys"). Achado em
  // 2026-08-07 testando o runner contra o Supabase real pela primeira vez: com
  // Promise.all aqui, 3 sessões RUNNING disparavam candle fetch simultâneo e
  // toda tentativa de 15m falhava. O driver do browser nunca teve esse
  // problema porque só roda uma sessão por vez (a do usuário logado na aba).
  for (const s of loaded) {
    if (Date.now() >= deadline) break;
    await runSession(s, deadline);
  }

  return new Response(JSON.stringify({
    sessions: loaded.length,
    summary: loaded.map(s => ({ sessionId: s.sessionId, activeOrders: s.activeOrders.length, isActive: s.isActive })),
  }), { status: 200, headers: { 'content-type': 'application/json' } });
});

/**
 * SQL de exemplo pra agendar (NÃO aplicado — Cleber decide se/quando rodar).
 * Requer extensão `pg_cron` + `pg_net` habilitadas no projeto Supabase.
 *
 *   select cron.schedule(
 *     'ai-runner-tick',
 *     '* * * * *', -- a cada 1 minuto (granularidade mínima do pg_cron)
 *     $$
 *     select net.http_post(
 *       url := 'https://<project-ref>.supabase.co/functions/v1/ai-runner',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'x-runner-secret', '<AI_RUNNER_SHARED_SECRET>'
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 */
