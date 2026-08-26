/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - AI PERSISTENCE HOOK                         ║
 * ║  Wrapper que adiciona persistência ao useApexLogic                ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useRef, useCallback } from 'react';
import { aiPersistence, AISession, AITrade, PortfolioSnapshot, DecisionVetoStage } from '@/app/services/AITradingPersistenceService';
import { useAuth } from '@/app/contexts/AuthContext';
import { funnelTelemetry, FunnelStage } from '@/app/services/telemetry/FunnelTelemetry';

/**
 * Tradução veto de negócio (`ai_decisions.veto_stage`) → estágio de funil
 * (`ai_funnel_snapshots.stage_counts`). Vive aqui, no ponto ÚNICO por onde todo
 * veto passa, em vez de espalhada por 15 chamadas no motor: qualquer gate novo
 * que grave decisão entra no funil automaticamente, sem depender de alguém
 * lembrar de instrumentar. Foi exatamente esse "lembrar de instrumentar" que
 * falhou e deixou 12 dos 27 pontos de saída invisíveis até 2026-08-04.
 *
 * Duas tabelas porque medem coisas diferentes: `ai_decisions` guarda a decisão
 * individual auditável (com razão em texto, score, indicadores); o funil guarda
 * só a CONTAGEM agregada, que é o que responde "onde os setups morrem".
 */
const VETO_TO_FUNNEL_STAGE: Record<DecisionVetoStage, FunnelStage> = {
  CONTEXT_SCORE_OPPOSITE: 'SCORE_OPPOSITE',
  CONTEXT_SCORE_LATERAL: 'SCORE_LATERAL',
  CONTEXT_CONFIDENCE: 'COMBINED_CONFIDENCE_LOW',
  CONTEXT_GATE: 'CONTEXT_GATE',
  CONFIG_DIRECTION: 'CONFIG_DIRECTION',
  COST_GATE: 'COST_GATE',
  COST_GATE_NO_DATA: 'COST_GATE_NO_DATA',
  RISK_GATE: 'RISK_GATE',
  KILL_SWITCH: 'KILL_SWITCH',
  COOLDOWN: 'COOLDOWN_GATE',
  MAX_TRADES_PER_DAY: 'MAX_TRADES_PER_DAY',
  REVENGE_PATTERN: 'REVENGE_PATTERN',
  CORRELATION_GUARD: 'CORRELATION_GUARD',
  MARKET_MODE_REGIME_MISMATCH: 'MARKET_MODE_MISMATCH',
  MARKET_MODE_COUNTER_NO_EXTREME: 'MARKET_MODE_MISMATCH',
  MIN_TRADE_SIZE: 'MIN_TRADE_SIZE',
  MACD_MOMENTUM_FADING: 'MACD_MOMENTUM_FADING',
};

interface UseAIPersistenceOptions {
  enabled: boolean; // Se persistência está ativada
  autoSnapshot: boolean; // Se deve fazer snapshot automático
  snapshotInterval?: number; // Intervalo de snapshot em ms (padrão: 60000 = 1 min)
  // Chamado quando uma escrita de persistência falha silenciosamente (rede caiu,
  // RLS rejeitou o insert etc.) — sem isso, o erro só aparecia no console.
  onPersistenceError?: (context: 'session' | 'trade_open' | 'trade_close' | 'snapshot' | 'stop_loss_update', error: unknown) => void;
}

interface TradeData {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  price: number;
  tp: number;
  sl: number;
  leverage: number;
  ai_confidence: number;
  timestamp: number;
  reasoning: string;
  indicators?: any;
  // Grupo de Pyramiding — pyramidGroupId deve ser o id de BANCO (resolvido
  // via resolveDbTradeId) do trade raiz, nunca o id local do React.
  pyramidGroupId?: string | null;
  pyramidLayer?: number | null;
}

interface PortfolioData {
  balance: number;
  equity: number;
  openPositionsValue: number;
  currentDrawdown: number;
}

export function useAIPersistence(options: UseAIPersistenceOptions) {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tradeDbIdsRef = useRef<Map<string, string>>(new Map()); // Mapeia trade.id local → trade.id DB
  const isStartingSessionRef = useRef(false); // Trava clique duplo/chamada concorrente de startSession

  const LOG_PREFIX = '[AI Persistence Hook]';

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Iniciar nova sessão
   */
  const startSession = useCallback(async (config: {
    strategyName: string;
    symbols: string[];
    timeframe: string;
    initialBalance: number;
    initialEquity: number;
    config: any;
  }) => {
    if (!user?.id || !options.enabled) {
      console.log(`${LOG_PREFIX} ⚠️ Persistência desabilitada ou usuário não autenticado`);
      return null;
    }

    // Evita criar duas sessões se startSession for chamado duas vezes antes da
    // primeira resolver (ex: clique duplo no botão de start).
    if (sessionIdRef.current || isStartingSessionRef.current) {
      return sessionIdRef.current;
    }
    isStartingSessionRef.current = true;

    try {
      console.log(`${LOG_PREFIX} 🚀 Iniciando sessão...`);

      const session = await aiPersistence.createSession({
        user_id: user.id,
        strategy_name: config.strategyName,
        mode: 'DEMO',
        symbols: config.symbols,
        timeframe: config.timeframe,
        initial_balance: config.initialBalance,
        initial_equity: config.initialEquity,
        config: config.config,
      });

      if (session?.id) {
        sessionIdRef.current = session.id;
        console.log(`${LOG_PREFIX} ✅ Sessão criada:`, session.id);

        // Iniciar snapshot automático se habilitado
        if (options.autoSnapshot) {
          startSnapshotInterval();
        }

        return session.id;
      }

      options.onPersistenceError?.('session', new Error('createSession retornou vazio'));
      return null;
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao iniciar sessão:`, error);
      options.onPersistenceError?.('session', error);
      return null;
    } finally {
      isStartingSessionRef.current = false;
    }
  }, [user, options.enabled, options.autoSnapshot, options.onPersistenceError]);

  /**
   * Finalizar sessão atual
   */
  const endSession = useCallback(async (finalBalance: number, finalEquity: number, finalPositions?: any) => {
    if (!sessionIdRef.current || !options.enabled) return;

    try {
      console.log(`${LOG_PREFIX} 🏁 Finalizando sessão...`);

      await aiPersistence.endSession(
        sessionIdRef.current,
        finalBalance,
        finalEquity,
        finalPositions
      );

      // Parar snapshot automático
      stopSnapshotInterval();

      // Limpar referências
      sessionIdRef.current = null;
      tradeDbIdsRef.current.clear();

      console.log(`${LOG_PREFIX} ✅ Sessão finalizada`);
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao finalizar sessão:`, error);
    }
  }, [options.enabled]);

  /**
   * Restaurar sessão ativa (se existir)
   */
  const restoreActiveSession = useCallback(async () => {
    if (!user?.id || !options.enabled) return null;

    try {
      const activeSession = await aiPersistence.getActiveSession(user.id);
      
      if (activeSession) {
        sessionIdRef.current = activeSession.id || null;
        console.log(`${LOG_PREFIX} 🔄 Sessão ativa restaurada:`, activeSession.id);

        // Restaurar trades abertos + último snapshot (para saldo/equity)
        if (activeSession.id) {
          const [openTrades, snapshots] = await Promise.all([
            aiPersistence.getOpenTrades(activeSession.id),
            aiPersistence.getSessionSnapshots(activeSession.id),
          ]);
          console.log(`${LOG_PREFIX} 📊 Trades abertos restaurados:`, openTrades.length);
          const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
          return { session: activeSession, openTrades, lastSnapshot };
        }
      }

      return null;
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao restaurar sessão:`, error);
      return null;
    }
  }, [user, options.enabled]);

  /**
   * Buscar o saldo final da última sessão DEMO encerrada, pra dar
   * continuidade de capital quando não há sessão RUNNING pra restaurar.
   */
  const getLastCompletedSession = useCallback(async (mode: 'DEMO' | 'LIVE' = 'DEMO') => {
    if (!user?.id || !options.enabled) return null;
    try {
      return await aiPersistence.getLastCompletedSession(user.id, mode);
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao buscar última sessão encerrada:`, error);
      return null;
    }
  }, [user, options.enabled]);

  // ==========================================================================
  // TRADE TRACKING
  // ==========================================================================

  /**
   * Salvar trade quando abrir posição
   */
  const onTradeOpen = useCallback(async (trade: TradeData, marketConditions?: any) => {
    if (!sessionIdRef.current || !user?.id || !options.enabled) return;

    try {
      const tradeData: AITrade = {
        session_id: sessionIdRef.current,
        user_id: user.id,
        symbol: trade.symbol,
        type: trade.side === 'LONG' ? 'BUY' : 'SELL',
        side: trade.side,
        entry_price: trade.price,
        quantity: trade.amount,
        stop_loss: trade.sl,
        take_profit: trade.tp,
        ai_confidence: trade.ai_confidence,
        ai_reasoning: trade.reasoning,
        indicators_snapshot: trade.indicators,
        market_conditions: marketConditions,
        entry_time: new Date(trade.timestamp).toISOString(),
        status: 'OPEN',
        commission: 0, // Será calculado ao fechar
        pyramid_group_id: trade.pyramidGroupId ?? null,
        pyramid_layer: trade.pyramidLayer ?? null,
      };

      const tradeId = await aiPersistence.saveTrade(tradeData);

      if (tradeId) {
        // Mapear ID local → ID do banco
        tradeDbIdsRef.current.set(trade.id, tradeId);
        console.log(`${LOG_PREFIX} ✅ Trade salvo:`, tradeId);
      } else {
        options.onPersistenceError?.('trade_open', new Error(`saveTrade retornou vazio para ${trade.id}`));
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao salvar trade:`, error);
      options.onPersistenceError?.('trade_open', error);
    }
  }, [user, options.enabled, options.onPersistenceError]);

  /**
   * Atualizar trade quando fechar posição
   */
  const onTradeClose = useCallback(async (
    tradeId: string,
    exitPrice: number,
    pnl: number,
    commission: number,
    exitReason: 'TP' | 'SL' | 'MANUAL' | 'AI_SIGNAL'
  ) => {
    if (!options.enabled) return;

    // Se não há mapeamento local (ex: posição restaurada do Supabase após reload,
    // onde o id local já É o id do banco), usa o próprio tradeId como fallback.
    const dbTradeId = tradeDbIdsRef.current.get(tradeId) || tradeId;

    try {
      const exitTime = new Date().toISOString();
      const entryTime = new Date(); // Precisaríamos buscar do banco, mas vamos simplificar

      const ok = await aiPersistence.updateTrade(dbTradeId, {
        exit_price: exitPrice,
        exit_time: exitTime,
        pnl: pnl,
        pnl_percentage: (pnl / (exitPrice * 100)) * 100, // Cálculo aproximado
        commission: commission,
        net_pnl: pnl - commission,
        status: 'CLOSED',
        exit_reason: exitReason,
      });

      // Remover do mapeamento
      tradeDbIdsRef.current.delete(tradeId);

      if (ok) {
        console.log(`${LOG_PREFIX} ✅ Trade fechado:`, dbTradeId);
      } else {
        options.onPersistenceError?.('trade_close', new Error(`updateTrade retornou falso para ${dbTradeId}`));
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao fechar trade:`, error);
      options.onPersistenceError?.('trade_close', error);
    }
  }, [options.enabled, options.onPersistenceError]);

  /**
   * Resolve id local (React) -> id de banco. Mesmo fallback usado por
   * onTradeClose/updateTradeStopLoss (posição restaurada do Supabase após
   * reload já tem o id local = id de banco). Necessário pra gravar
   * `pyramid_group_id` corretamente — a FK precisa do id real da linha.
   */
  const resolveDbTradeId = useCallback((tradeId: string): string => {
    return tradeDbIdsRef.current.get(tradeId) || tradeId;
  }, []);

  /**
   * Marca a raiz de um grupo de Pyramiding (`pyramid_layer = 1`) — chamado
   * na hora em que o PRIMEIRO layer é adicionado (até ali, o trade raiz não
   * tinha nenhuma marca de grupo, porque foi aberto antes de virar raiz).
   */
  const markPyramidRoot = useCallback(async (tradeId: string): Promise<boolean> => {
    if (!options.enabled) return false;
    const dbTradeId = tradeDbIdsRef.current.get(tradeId) || tradeId;
    try {
      return await aiPersistence.updateTrade(dbTradeId, { pyramid_layer: 1 });
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao marcar raiz do grupo de Pyramiding:`, error);
      options.onPersistenceError?.('stop_loss_update', error);
      return false;
    }
  }, [options.enabled, options.onPersistenceError]);

  /**
   * Persiste um novo stop_loss pra um trade já aberto — usado pelo Pyramiding
   * System (break-even e emergency-stop, useApexLogic.ts) pra gravar o SL
   * ajustado no banco. Sem isto, o ajuste só existia em memória
   * (`setActiveOrders`) e nunca era visto pelo `ai-runner`, que desde
   * 2026-08-18 é quem tem autoridade de fechar trade em DEMO — achado
   * 2026-08-19: break-even/emergency-stop do Pyramiding logavam sucesso mas
   * não protegiam nada de verdade, porque o SL novo nunca chegava ao banco.
   */
  const updateTradeStopLoss = useCallback(async (tradeId: string, newSl: number): Promise<boolean> => {
    if (!options.enabled) return false;
    const dbTradeId = tradeDbIdsRef.current.get(tradeId) || tradeId;
    try {
      const ok = await aiPersistence.updateTrade(dbTradeId, { stop_loss: newSl });
      if (!ok) options.onPersistenceError?.('stop_loss_update', new Error(`updateTrade (stop_loss) retornou falso para ${dbTradeId}`));
      return ok;
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao atualizar stop_loss:`, error);
      options.onPersistenceError?.('stop_loss_update', error);
      return false;
    }
  }, [options.enabled, options.onPersistenceError]);

  // ==========================================================================
  // PORTFOLIO SNAPSHOTS
  // ==========================================================================

  /**
   * Salvar snapshot manual do portfolio
   */
  const savePortfolioSnapshot = useCallback(async (portfolio: PortfolioData) => {
    if (!sessionIdRef.current || !user?.id || !options.enabled) return;

    try {
      const snapshot: PortfolioSnapshot = {
        session_id: sessionIdRef.current,
        user_id: user.id,
        balance: portfolio.balance,
        equity: portfolio.equity,
        margin: 0,
        open_positions: 0, // Você pode passar isso como parâmetro
        total_pnl: portfolio.equity - portfolio.balance,
        drawdown: portfolio.currentDrawdown,
        timestamp: new Date().toISOString(),
      };

      const ok = await aiPersistence.saveSnapshot(snapshot);
      if (!ok) {
        options.onPersistenceError?.('snapshot', new Error('saveSnapshot retornou falso'));
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao salvar snapshot:`, error);
      options.onPersistenceError?.('snapshot', error);
    }
  }, [user, options.enabled, options.onPersistenceError]);

  /**
   * Iniciar intervalo de snapshot automático
   */
  const startSnapshotInterval = useCallback(() => {
    if (snapshotIntervalRef.current) return; // Já está rodando

    const interval = options.snapshotInterval || 60000; // 1 minuto padrão

    snapshotIntervalRef.current = setInterval(() => {
      console.log(`${LOG_PREFIX} 📸 Snapshot automático...`);
      // O componente que usa este hook deve chamar savePortfolioSnapshot
      // Ou podemos emitir um evento
    }, interval);

    console.log(`${LOG_PREFIX} ⏰ Snapshot automático iniciado (${interval}ms)`);
  }, [options.snapshotInterval]);

  /**
   * Parar intervalo de snapshot
   */
  const stopSnapshotInterval = useCallback(() => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
      console.log(`${LOG_PREFIX} ⏰ Snapshot automático parado`);
    }
  }, []);

  // ==========================================================================
  // AI DECISIONS
  // ==========================================================================

  /**
   * Salvar decisão da AI
   */
  const saveDecision = useCallback(async (decision: {
    symbol: string;
    decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
    confidence: number;
    reasoning: string;
    marketScore?: number;
    technicalSignals?: any;
    riskAssessment?: any;
    actionTaken: boolean;
    vetoStage?: DecisionVetoStage;
    tradeId?: string;
  }) => {
    // 📊 Funil ANTES do guard de sessão: um veto continua sendo um veto mesmo
    // quando a persistência está desligada ou a sessão ainda não subiu. Se a
    // contagem dependesse do mesmo `return` do INSERT, o funil não fecharia
    // justamente nos casos em que o banco está indisponível — que é quando
    // saber onde os setups morrem importa mais.
    if (decision.vetoStage) {
      // 🔒 2026-08-17: `VETO_TO_FUNNEL_STAGE[...]` pode devolver `undefined`
      // se um `vetoStage` novo for adicionado em runTradingCycle.ts sem
      // atualizar esta tabela (aconteceu com MIN_TRADE_SIZE — sem esta
      // guarda, `recordStage(undefined, ...)` grava literalmente a chave
      // string "undefined" em `stage_counts`, indistinguível de um veto real
      // na leitura do funil). O driver do runner (persistence.ts) já tinha
      // essa guarda; faltava aqui.
      const stage = VETO_TO_FUNNEL_STAGE[decision.vetoStage];
      if (stage) {
        funnelTelemetry.recordStage(stage, decision.symbol, decision.reasoning);
      } else {
        console.warn(`[FunnelTelemetry] vetoStage "${decision.vetoStage}" sem entrada em VETO_TO_FUNNEL_STAGE — atualize a tabela.`);
      }
    }

    if (!sessionIdRef.current || !user?.id || !options.enabled) return;

    try {
      await aiPersistence.saveDecision({
        session_id: sessionIdRef.current,
        user_id: user.id,
        symbol: decision.symbol,
        timestamp: new Date().toISOString(),
        decision: decision.decision,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        market_score: decision.marketScore,
        technical_signals: decision.technicalSignals,
        risk_assessment: decision.riskAssessment,
        action_taken: decision.actionTaken,
        veto_stage: decision.vetoStage,
        trade_id: decision.tradeId ? tradeDbIdsRef.current.get(decision.tradeId) : undefined,
      });
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao salvar decisão:`, error);
    }
  }, [user, options.enabled]);

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Buscar histórico de sessões
   */
  const getSessionHistory = useCallback(async (limit = 20) => {
    if (!user?.id) return [];
    return await aiPersistence.getUserSessions(user.id, limit);
  }, [user]);

  /**
   * Buscar trades de uma sessão
   */
  const getSessionTrades = useCallback(async (sessionId: string) => {
    return await aiPersistence.getSessionTrades(sessionId);
  }, []);

  /**
   * Buscar TODOS os trades FECHADOS do usuário, através de todas as sessões
   * (não só a sessão ativa) — fonte real do "Histórico de Trades" da tela de
   * Performance. Antes desta função, `orderHistory` só acumulava trades
   * fechados durante a aba/sessão de navegador atual (cache local), então o
   * histórico "sumia" a cada reload/troca de dispositivo mesmo com o trade
   * salvo no banco.
   */
  const getUserTradeHistory = useCallback(async (limit = 200) => {
    if (!user?.id) return [];
    const [trades, lastResetAt] = await Promise.all([
      aiPersistence.getUserTrades(user.id, { limit }),
      aiPersistence.getLastHistoryResetAt(user.id),
    ]);
    if (!lastResetAt) return trades;
    // Performance exibida respeita o último Reset — trades reais continuam
    // intactos em `ai_trades` (auditoria), só somem da tela.
    return trades.filter(t => !t.exit_time || t.exit_time > lastResetAt);
  }, [user]);

  /**
   * Marca "a partir de agora" pro histórico exibido em Performance — chamado
   * pelo Reset do motor (`resetLogic` em useApexLogic.ts). Não apaga trade
   * nenhum, só some da tela via filtro em `getUserTradeHistory`.
   */
  const recordHistoryReset = useCallback(async () => {
    if (!user?.id) return;
    await aiPersistence.recordHistoryReset(user.id);
  }, [user]);

  /**
   * Buscar equity curve de uma sessão
   */
  const getEquityCurve = useCallback(async (sessionId: string) => {
    return await aiPersistence.getSessionSnapshots(sessionId);
  }, []);

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  useEffect(() => {
    return () => {
      // Limpar intervalo ao desmontar
      stopSnapshotInterval();
    };
  }, [stopSnapshotInterval]);

  // ==========================================================================
  // RETURN API
  // ==========================================================================

  return {
    // Session
    startSession,
    endSession,
    restoreActiveSession,
    getLastCompletedSession,
    currentSessionId: sessionIdRef.current,
    /**
     * Leitura AO VIVO do id da sessão (lê o ref, não o snapshot de render).
     * `currentSessionId` acima congela no valor do último render — dentro do
     * setInterval do motor (useApexLogic) isso devolve o valor de quando o
     * loop foi montado, tipicamente `null`, porque a sessão só é criada
     * depois. Quem roda dentro do loop precisa desta função, não do campo.
     */
    getSessionId: () => sessionIdRef.current,
    
    // Trades
    onTradeOpen,
    onTradeClose,
    updateTradeStopLoss,
    resolveDbTradeId,
    markPyramidRoot,

    // Portfolio
    savePortfolioSnapshot,
    
    // Decisions
    saveDecision,
    
    // Queries
    getSessionHistory,
    getSessionTrades,
    getUserTradeHistory,
    recordHistoryReset,
    getEquityCurve,
    
    // Utils
    isEnabled: options.enabled,
  };
}
