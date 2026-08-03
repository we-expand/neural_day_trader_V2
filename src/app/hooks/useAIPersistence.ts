/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - AI PERSISTENCE HOOK                         ║
 * ║  Wrapper que adiciona persistência ao useApexLogic                ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useRef, useCallback } from 'react';
import { aiPersistence, AISession, AITrade, PortfolioSnapshot, DecisionVetoStage } from '@/app/services/AITradingPersistenceService';
import { useAuth } from '@/app/contexts/AuthContext';

interface UseAIPersistenceOptions {
  enabled: boolean; // Se persistência está ativada
  autoSnapshot: boolean; // Se deve fazer snapshot automático
  snapshotInterval?: number; // Intervalo de snapshot em ms (padrão: 60000 = 1 min)
  // Chamado quando uma escrita de persistência falha silenciosamente (rede caiu,
  // RLS rejeitou o insert etc.) — sem isso, o erro só aparecia no console.
  onPersistenceError?: (context: 'session' | 'trade_open' | 'trade_close' | 'snapshot', error: unknown) => void;
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
    return await aiPersistence.getUserTrades(user.id, { limit });
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
    currentSessionId: sessionIdRef.current,
    
    // Trades
    onTradeOpen,
    onTradeClose,
    
    // Portfolio
    savePortfolioSnapshot,
    
    // Decisions
    saveDecision,
    
    // Queries
    getSessionHistory,
    getSessionTrades,
    getUserTradeHistory,
    getEquityCurve,
    
    // Utils
    isEnabled: options.enabled,
  };
}
