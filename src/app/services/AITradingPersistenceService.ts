/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - AI TRADING PERSISTENCE SERVICE              ║
 * ║  Salva e carrega dados de trading da AI no Supabase              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '@/app/config/supabaseClient';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AISession {
  id?: string;
  user_id: string;
  strategy_name: string;
  mode: 'DEMO' | 'BACKTEST' | 'LIVE';
  symbols: string[];
  timeframe: string;
  initial_balance: number;
  initial_equity: number;
  final_balance?: number;
  final_equity?: number;
  final_positions?: any;
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate?: number;
  total_pnl?: number;
  total_commission?: number;
  net_pnl?: number;
  max_drawdown?: number;
  max_drawdown_value?: number;
  sharpe_ratio?: number;
  profit_factor?: number;
  avg_win?: number;
  avg_loss?: number;
  largest_win?: number;
  largest_loss?: number;
  started_at?: string;
  ended_at?: string;
  status?: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED' | 'ERROR';
  config?: any;
  created_at?: string;
  updated_at?: string;
}

export interface AITrade {
  id?: string;
  session_id: string;
  user_id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  stop_loss?: number;
  take_profit?: number;
  pnl?: number;
  pnl_percentage?: number;
  commission: number;
  net_pnl?: number;
  ai_confidence: number;
  ai_reasoning: string;
  indicators_snapshot?: any;
  market_conditions?: any;
  entry_time: string;
  exit_time?: string;
  duration_seconds?: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  exit_reason?: 'TP' | 'SL' | 'MANUAL' | 'TIMEOUT' | 'AI_SIGNAL';
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioSnapshot {
  id?: string;
  session_id: string;
  user_id: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin?: number;
  margin_level?: number;
  open_positions: number;
  total_pnl: number;
  drawdown?: number;
  max_equity?: number;
  timestamp: string;
  created_at?: string;
}

export interface AIDecision {
  id?: string;
  session_id: string;
  user_id: string;
  symbol: string;
  timestamp: string;
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string;
  market_score?: number;
  technical_signals?: any;
  risk_assessment?: any;
  action_taken: boolean;
  trade_id?: string;
  created_at?: string;
}

export interface AIBacktest {
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  strategy: any;
  start_date: string;
  end_date: string;
  timeframe: string;
  initial_balance: number;
  final_balance: number;
  total_trades?: number;
  win_rate?: number;
  profit_factor?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  total_pnl?: number;
  equity_curve?: any;
  trades?: any;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  created_at?: string;
  completed_at?: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class AITradingPersistenceService {
  private readonly LOG_PREFIX = '[AI Persistence]';

  // ==========================================================================
  // SESSIONS
  // ==========================================================================

  /**
   * Criar nova sessão de trading
   */
  async createSession(data: Partial<AISession>): Promise<AISession | null> {
    try {
      console.log(`${this.LOG_PREFIX} 🚀 Criando sessão...`);

      const { data: session, error } = await supabase
        .from('ai_sessions')
        .insert([{
          user_id: data.user_id,
          strategy_name: data.strategy_name || 'Default Strategy',
          mode: data.mode || 'DEMO',
          symbols: data.symbols || [],
          timeframe: data.timeframe || '1h',
          initial_balance: data.initial_balance || 10000,
          initial_equity: data.initial_equity || 10000,
          config: data.config || {},
          status: 'RUNNING',
        }])
        .select()
        .single();

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Sessão criada:`, session.id);
      return session as AISession;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao criar sessão:`, error);
      return null;
    }
  }

  /**
   * Atualizar sessão existente
   */
  async updateSession(sessionId: string, data: Partial<AISession>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_sessions')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Sessão atualizada:`, sessionId);
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao atualizar sessão:`, error);
      return false;
    }
  }

  /**
   * Finalizar sessão
   */
  async endSession(
    sessionId: string,
    finalBalance: number,
    finalEquity: number,
    finalPositions?: any
  ): Promise<boolean> {
    return this.updateSession(sessionId, {
      final_balance: finalBalance,
      final_equity: finalEquity,
      final_positions: finalPositions,
      ended_at: new Date().toISOString(),
      status: 'COMPLETED',
    });
  }

  /**
   * Buscar sessões do usuário
   */
  async getUserSessions(userId: string, limit = 20): Promise<AISession[]> {
    try {
      const { data, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as AISession[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar sessões:`, error);
      return [];
    }
  }

  /**
   * Buscar sessão ativa (última sessão RUNNING)
   */
  async getActiveSession(userId: string): Promise<AISession | null> {
    try {
      const { data, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'RUNNING')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as AISession | null;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar sessão ativa:`, error);
      return null;
    }
  }

  /**
   * Buscar sessão por ID
   */
  async getSession(sessionId: string): Promise<AISession | null> {
    try {
      const { data, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data as AISession;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar sessão:`, error);
      return null;
    }
  }

  // ==========================================================================
  // TRADES
  // ==========================================================================

  /**
   * Salvar trade (quando abrir)
   */
  async saveTrade(trade: AITrade): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_trades')
        .insert([trade])
        .select('id')
        .single();

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Trade salvo:`, data.id);
      return data.id;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao salvar trade:`, error);
      return null;
    }
  }

  /**
   * Atualizar trade (quando fechar)
   */
  async updateTrade(tradeId: string, updates: Partial<AITrade>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_trades')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Trade atualizado:`, tradeId);
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao atualizar trade:`, error);
      return false;
    }
  }

  /**
   * Buscar trades da sessão
   */
  async getSessionTrades(sessionId: string): Promise<AITrade[]> {
    try {
      const { data, error } = await supabase
        .from('ai_trades')
        .select('*')
        .eq('session_id', sessionId)
        .order('entry_time', { ascending: false });

      if (error) throw error;
      return (data || []) as AITrade[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar trades:`, error);
      return [];
    }
  }

  /**
   * Buscar trades abertos da sessão
   */
  async getOpenTrades(sessionId: string): Promise<AITrade[]> {
    try {
      const { data, error } = await supabase
        .from('ai_trades')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'OPEN')
        .order('entry_time', { ascending: false });

      if (error) throw error;
      return (data || []) as AITrade[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar trades abertos:`, error);
      return [];
    }
  }

  // ==========================================================================
  // PORTFOLIO SNAPSHOTS
  // ==========================================================================

  /**
   * Salvar snapshot do portfolio
   */
  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_portfolio_snapshots')
        .insert([snapshot]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao salvar snapshot:`, error);
      return false;
    }
  }

  /**
   * Buscar snapshots da sessão (para equity curve)
   */
  async getSessionSnapshots(sessionId: string): Promise<PortfolioSnapshot[]> {
    try {
      const { data, error } = await supabase
        .from('ai_portfolio_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return (data || []) as PortfolioSnapshot[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar snapshots:`, error);
      return [];
    }
  }

  // ==========================================================================
  // AI DECISIONS
  // ==========================================================================

  /**
   * Salvar decisão da AI
   */
  async saveDecision(decision: AIDecision): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_decisions')
        .insert([decision])
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao salvar decisão:`, error);
      return null;
    }
  }

  /**
   * Buscar decisões da sessão
   */
  async getSessionDecisions(sessionId: string, limit = 100): Promise<AIDecision[]> {
    try {
      const { data, error } = await supabase
        .from('ai_decisions')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as AIDecision[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar decisões:`, error);
      return [];
    }
  }

  // ==========================================================================
  // BACKTESTS
  // ==========================================================================

  /**
   * Salvar resultado de backtest
   */
  async saveBacktest(backtest: AIBacktest): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_backtests')
        .insert([backtest])
        .select('id')
        .single();

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Backtest salvo:`, data.id);
      return data.id;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao salvar backtest:`, error);
      return null;
    }
  }

  /**
   * Buscar backtests do usuário
   */
  async getUserBacktests(userId: string): Promise<AIBacktest[]> {
    try {
      const { data, error } = await supabase
        .from('ai_backtests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AIBacktest[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar backtests:`, error);
      return [];
    }
  }

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  /**
   * Recalcular métricas da sessão manualmente
   */
  async recalculateSessionMetrics(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('calculate_session_metrics', {
        p_session_id: sessionId,
      });

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Métricas recalculadas:`, sessionId);
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao recalcular métricas:`, error);
      return false;
    }
  }

  /**
   * Limpar dados antigos (housekeeping)
   */
  async cleanupOldData(userId: string, daysToKeep = 90): Promise<boolean> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await supabase
        .from('ai_sessions')
        .delete()
        .eq('user_id', userId)
        .lt('started_at', cutoffDate.toISOString());

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Dados antigos removidos`);
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao limpar dados:`, error);
      return false;
    }
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const aiPersistence = new AITradingPersistenceService();
