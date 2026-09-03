/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - AI TRADING PERSISTENCE SERVICE              ║
 * ║  Salva e carrega dados de trading da AI no Supabase              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '@/lib/supabaseClient';

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
  // Grupo de Pyramiding (migration 20260819_add_pyramid_group_columns.sql) —
  // pyramid_group_id aponta pro id (DB) do trade RAIZ do grupo; ausente na
  // própria raiz. Sem isto o ai-runner não tinha como saber quais trades
  // formam um grupo de pyramiding, bloqueando qualquer fechamento (mesmo
  // parcial) desse grupo no servidor.
  pyramid_group_id?: string | null;
  pyramid_layer?: number | null;
}

/**
 * Ordem pendente DEMO (limit/stop) persistida — ver
 * `supabase/migrations/20260826_add_ai_pending_orders.sql`. `session_id` é
 * opcional de propósito: a ordem pendente é uma intenção do usuário, não
 * uma métrica de sessão, e precisa sobreviver a Iniciar/Parar IA.
 */
export interface AIPendingOrder {
  id?: string;
  user_id: string;
  session_id?: string | null;
  symbol: string;
  side: 'LONG' | 'SHORT';
  order_type: 'LIMIT' | 'STOP';
  volume: number;
  trigger_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
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

/**
 * Etapa do funil de decisão que gerou o registro (`migrations/009_ai_decisions.sql`).
 * `undefined`/`null` = decisão de entrada aprovada (action_taken=true).
 * Lista fechada — estender junto com o CHECK constraint da migration, nunca
 * usar valor livre fora desta união (perde consultabilidade).
 */
export type DecisionVetoStage =
  | 'CONTEXT_SCORE_OPPOSITE'
  | 'CONTEXT_SCORE_LATERAL'
  | 'CONTEXT_CONFIDENCE'
  | 'CONTEXT_GATE'
  | 'CONFIG_DIRECTION'
  | 'COST_GATE'
  | 'COST_GATE_NO_DATA'
  | 'RISK_GATE'
  | 'KILL_SWITCH'
  | 'COOLDOWN'
  | 'MAX_TRADES_PER_DAY'
  | 'REVENGE_PATTERN'
  | 'CORRELATION_GUARD'
  | 'MARKET_MODE_REGIME_MISMATCH'
  | 'MARKET_MODE_COUNTER_NO_EXTREME'
  | 'MIN_TRADE_SIZE'
  | 'MACD_MOMENTUM_FADING';

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
  veto_stage?: DecisionVetoStage;
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

      // 🔴 FIX 2026-08-25 (achado do Cleber: Curva de Equity não representava
      // fielmente o reinício em $100): sem snapshot no instante de criação da
      // sessão, o primeiro ponto real da curva (`ai_portfolio_snapshots`) só
      // aparecia no primeiro fechamento de trade — minutos/horas depois, já
      // com equity movida. A curva nunca visualmente "começava" no valor real
      // de início. Ancora explicitamente aqui.
      await this.saveSnapshot({
        session_id: session.id,
        user_id: session.user_id,
        balance: session.initial_balance,
        equity: session.initial_equity,
        margin: 0,
        open_positions: 0,
        total_pnl: 0,
        drawdown: 0,
        timestamp: session.created_at || new Date().toISOString(),
      });

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
   * "Desligar IA" -- 🔴 2026-08-31 (pedido do Cleber, achado ao vivo):
   * NUNCA usar endSession() aqui. endSession marca status='COMPLETED',
   * que tira a sessão do alcance de getOrCreateMt5Session/
   * listEligibleMt5Sessions (llm-active-brain) -- o motor para de ver
   * QUALQUER posição dela (nem pra fechar), e no próximo ciclo cria uma
   * sessão nova zerada em $100, orfanizando pra sempre tudo que estava
   * aberto (bug real, confirmado: 5 posições BTCUSD presas assim, ver
   * handoff 2026-08-31). Comportamento esperado (igual ao motor mecânico
   * antigo): desligar só bloqueia ENTRADA nova -- posições já abertas
   * continuam sendo monitoradas de verdade (breakeven/trailing/SL/TP) até
   * fecharem sozinhas. status='STOPPED' é reconhecido nos dois lados
   * (Dashboard via getActiveSession acima, motor via
   * listEligibleMt5Sessions) sem encerrar nada.
   */
  async stopSession(sessionId: string): Promise<boolean> {
    return this.updateSession(sessionId, { status: 'STOPPED' } as Partial<AISession>);
  }

  /**
   * "Ligar IA" de novo sobre uma sessão que só estava STOPPED (não
   * COMPLETED) -- resume a MESMA sessão (saldo/posições/histórico
   * contínuos), em vez de criar uma nova do zero.
   */
  async resumeSession(sessionId: string): Promise<boolean> {
    return this.updateSession(sessionId, { status: 'RUNNING' } as Partial<AISession>);
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
   * 🔴 2026-08-31 (pedido do Cleber): "Reinicialização Total" do AI Trader
   * precisa resetar TAMBÉM a sessão do LLM Active Brain (strategy_name
   * `LLM_ACTIVE_BRAIN_MT5`, ver `llm-active-brain/src/neuralBridge.ts`
   * `getOrCreateMt5Session`) -- até aqui esse botão só resetava o estado do
   * motor mecânico antigo no navegador, sem nenhum efeito na sessão real
   * que o LLM Brain opera no servidor. Sem isto, uma sessão que zerou o
   * saldo (crédito negativo) ficava travada pra sempre -- risco por trade
   * calculado sobre saldo negativo nunca cabe no lote mínimo, então NENHUMA
   * posição nova consegue abrir até uma sessão nova existir.
   *
   * 🔴 2026-08-31 (decisão definitiva do Cleber): motor mecânico
   * DESATIVADO (cron `ai-runner-tick` desligado). A sessão nova agora nasce
   * com `status: 'RUNNING'` DE PROPÓSITO -- é o que faz `getActiveSession()`
   * (usado por Dashboard/AI Trader/Gráfico/Header via useApexLogic.ts)
   * enxergar esta sessão como "a sessão ativa do usuário" e passar a exibir
   * posição/patrimônio/histórico REAIS do LLM Brain nos mesmos painéis que
   * antes mostravam o motor mecânico -- sem precisar duplicar nenhuma UI.
   * Ver mesma mudança espelhada em `llm-active-brain/src/neuralBridge.ts`
   * (`getOrCreateMt5Session`/`listEligibleMt5Sessions`).
   */
  async resetLlmActiveBrainSession(userId: string, resetBalanceUsd: number): Promise<boolean> {
    const STRATEGY_NAME = 'LLM_ACTIVE_BRAIN_MT5';
    // Mesma cesta de `llm-active-brain/src/assetBasket.ts` (MT5_ASSET_BASKET)
    // -- duplicado aqui de propósito: este arquivo roda no browser, aquele
    // roda no processo Node do LLM Brain, sem import compartilhado entre os
    // dois hoje.
    const MT5_ASSET_BASKET = [
      'BTCUSD', 'XETUSD', 'DOGUSD', 'DOTUSD', 'XRPUSD', 'BTCXBN',
      'ADAUSD', 'LNKUSD', 'UNIUSD',
    ];
    try {
      const { data: existing, error: findError } = await supabase
        .from('ai_sessions')
        .select('id, initial_balance')
        .eq('user_id', userId)
        .eq('strategy_name', STRATEGY_NAME)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;

      if (existing?.id) {
        // Fecha a sessão antiga com o saldo real (initial_balance + soma de
        // net_pnl dos trades fechados) -- nunca sobrescreve, só encerra.
        const { data: trades, error: tradesError } = await supabase
          .from('ai_trades')
          .select('net_pnl')
          .eq('session_id', existing.id)
          .eq('status', 'CLOSED');
        if (tradesError) throw tradesError;
        const netPnl = (trades || []).reduce((sum, t: any) => sum + (Number(t.net_pnl) || 0), 0);
        const finalBalance = Number(existing.initial_balance ?? 50) + netPnl;
        await this.endSession(existing.id, finalBalance, finalBalance);
      }

      const { error: createError } = await supabase
        .from('ai_sessions')
        .insert([{
          user_id: userId,
          strategy_name: STRATEGY_NAME,
          mode: 'DEMO',
          symbols: MT5_ASSET_BASKET,
          initial_balance: resetBalanceUsd,
          initial_equity: resetBalanceUsd,
          status: 'RUNNING',
          config: {
            source: 'Reset via botão "Reinicialização Total" (AI Trader)',
          },
        }]);
      if (createError) throw createError;

      console.log(`${this.LOG_PREFIX} ✅ Sessão do LLM Active Brain resetada para $${resetBalanceUsd}`);
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao resetar sessão do LLM Active Brain:`, error);
      return false;
    }
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
   * Buscar sessão ativa (última sessão RUNNING ou STOPPED).
   *
   * 🔴 2026-08-31 (pedido do Cleber, achado ao vivo): inclui STOPPED de
   * propósito -- "Desligar IA" (stopSession, abaixo) não encerra mais a
   * sessão, só bloqueia entrada nova (ver mesma mudança em
   * llm-active-brain/src/neuralBridge.ts listEligibleMt5Sessions). Sem
   * incluir aqui, o Dashboard parava de mostrar a sessão (e as posições
   * ainda abertas nela) assim que a IA era desligada, mesmo com o motor
   * ainda monitorando de verdade no servidor até elas fecharem sozinhas.
   */
  async getActiveSession(userId: string): Promise<AISession | null> {
    try {
      // 🔴 2026-08-31 (achado ao vivo): motor mecânico foi desligado
      // definitivamente, mas o botão "Ligar IA" (startLogic, useApexLogic.ts)
      // ainda cria sessões órfãs strategy_name='Apex AI' — sem preferência
      // aqui, uma dessas sessões órfãs (mais recente por started_at) passava
      // a mascarar a sessão real do LLM Brain (LLM_ACTIVE_BRAIN_MT5) em todo
      // o Dashboard/AITrader/Gráfico/Header. Sempre prioriza o motor único
      // atual quando ele tiver sessão RUNNING/STOPPED, mesmo que mais antiga.
      const { data: llmSession, error: llmError } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('strategy_name', 'LLM_ACTIVE_BRAIN_MT5')
        .in('status', ['RUNNING', 'STOPPED'])
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (llmSession) return llmSession as AISession;
      if (llmError && llmError.code !== 'PGRST116') throw llmError;

      const { data, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['RUNNING', 'STOPPED'])
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
   * 🔴 2026-08-25: Salva a configuração atual da IA na sessão.
   * Chamado automaticamente sempre que o usuário muda ANY parâmetro de config.
   * Permite que a próxima sessão carregue com os mesmos settings.
   *
   * IMPORTANTE: este método usa `updateSession` sob o capô, que já trata
   * `updated_at` — evita chamar sem limite em loops, use throttling se necessário.
   */
  async saveSessionConfig(sessionId: string, config: any): Promise<boolean> {
    if (!config) return false;
    return this.updateSession(sessionId, { config });
  }

  /**
   * Buscar a última sessão encerrada (COMPLETED) de um modo específico.
   * Usado pra dar continuidade de capital: sem isso, toda sessão nova (depois
   * de "Desligar AI" ou fechar a aba) recomeçava do saldo inicial padrão,
   * descartando o resultado real acumulado — pedido explícito do Cleber em
   * 2026-08-20 pra poder validar a evolução real da IA ao longo do tempo.
   */
  async getLastCompletedSession(userId: string, mode: 'DEMO' | 'LIVE' = 'DEMO'): Promise<AISession | null> {
    try {
      const { data, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('mode', mode)
        .eq('status', 'COMPLETED')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as AISession | null;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar última sessão encerrada:`, error);
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
   * Buscar TODOS os trades do usuário, através de todas as sessões
   * (DEMO/BACKTEST/LIVE) — usado pelo log de auditoria de operações
   * (`OperationLogs.tsx`). Filtro de data opcional por `entry_time`.
   */
  async getUserTrades(
    userId: string,
    options?: { startDate?: string; endDate?: string; limit?: number }
  ): Promise<AITrade[]> {
    try {
      let query = supabase
        .from('ai_trades')
        .select('*')
        .eq('user_id', userId)
        .order('entry_time', { ascending: false });

      if (options?.startDate) query = query.gte('entry_time', options.startDate);
      if (options?.endDate) query = query.lte('entry_time', options.endDate);
      query = query.limit(options?.limit ?? 2000);

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AITrade[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar trades do usuário:`, error);
      return [];
    }
  }

  /**
   * Grava um marcador de "reset de histórico" (achado 2026-08-21: o botão
   * Resetar zerava saldo/orderHistory local mas nunca este marcador, então o
   * card de Performance (que hidrata TODO o histórico do usuário via
   * `getUserTrades`, sem filtro de sessão) continuava mostrando trades de
   * semanas atrás mesmo depois de "começar do zero" — inclusive dois trades
   * comprovadamente contaminados por bugs antigos já corrigidos no motor,
   * nunca corrigidos no banco). Não apaga nada em `ai_trades` (auditoria
   * append-only se mantém intacta) — só marca "a partir daqui é o que conta
   * pra performance exibida".
   */
  async recordHistoryReset(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_history_resets')
        .insert({ user_id: userId });
      if (error) throw error;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao gravar marcador de reset de histórico:`, error);
    }
  }

  /**
   * Timestamp do reset de histórico mais recente do usuário, ou null se
   * nunca resetou. Usado só por quem hidrata "performance desde o começo
   * atual" (`getUserTradeHistory` em useAIPersistence.ts) — o log de
   * auditoria (`OperationLogs.tsx`, via `getUserTrades` direto) continua
   * mostrando o histórico vitalício de propósito, resets não o afetam.
   */
  async getLastHistoryResetAt(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_history_resets')
        .select('reset_at')
        .eq('user_id', userId)
        .order('reset_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.reset_at ?? null;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar marcador de reset de histórico:`, error);
      return null;
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
  // PENDING ORDERS (limit/stop DEMO postados no gráfico)
  // ==========================================================================

  /**
   * Salvar ordem pendente ao ser criada.
   */
  async savePendingOrder(order: AIPendingOrder): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_pending_orders')
        .insert([order])
        .select('id')
        .single();

      if (error) throw error;

      console.log(`${this.LOG_PREFIX} ✅ Ordem pendente salva:`, data.id);
      return data.id;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao salvar ordem pendente:`, error);
      return null;
    }
  }

  /**
   * Buscar ordens pendentes ainda abertas (status PENDING) do usuário —
   * fonte de verdade pra hidratar o gráfico depois de reload/troca de aba.
   */
  async getOpenPendingOrders(userId: string): Promise<AIPendingOrder[]> {
    try {
      const { data, error } = await supabase
        .from('ai_pending_orders')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AIPendingOrder[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar ordens pendentes:`, error);
      return [];
    }
  }

  /**
   * Reposicionar gatilho (arrastar a linha no gráfico).
   */
  async updatePendingOrderPrice(orderId: string, triggerPrice: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_pending_orders')
        .update({ trigger_price: triggerPrice, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao reposicionar ordem pendente:`, error);
      return false;
    }
  }

  /**
   * Marcar ordem pendente como cancelada (clique direito) ou disparada
   * (preço cruzou o gatilho, virou posição em `ai_trades`).
   */
  async updatePendingOrderStatus(orderId: string, status: 'FILLED' | 'CANCELLED'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_pending_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao atualizar status da ordem pendente:`, error);
      return false;
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

  /**
   * 🔴 FIX 2026-09-03 (achado: Dashboard mostrando saldo "resetado" em $100
   * de manhã, sem nenhuma operação visível): `ai_portfolio_snapshots` só é
   * gravado pelo navegador aberto (`useApexLogic.ts`), nunca pelo motor
   * headless (`neuralBridge.ts`, `llm-active-brain/`) que segue operando a
   * sessão a noite inteira sozinho. Sem nenhuma aba aberta, o último
   * snapshot existente fica preso no valor gravado na CRIAÇÃO da sessão
   * (ver `createSession` acima) -- não é ausência de snapshot, é snapshot
   * stale, que ignora todo PnL realizado desde então. Fonte de verdade real
   * pra saldo é sempre `ai_trades` (soma de `net_pnl` dos trades fechados),
   * nunca o snapshot cacheado -- mesmo cálculo já usado em
   * `resetLlmActiveBrainSession` acima.
   */
  async getSessionRealizedPnl(sessionId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('ai_trades')
        .select('net_pnl')
        .eq('session_id', sessionId)
        .eq('status', 'CLOSED');

      if (error) throw error;
      return (data || []).reduce((sum, t: any) => sum + (Number(t.net_pnl) || 0), 0);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao calcular PnL realizado da sessão:`, error);
      return 0;
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

  /**
   * Buscar TODAS as decisões do usuário, através de todas as sessões —
   * inclui decisões vetadas (`action_taken=false`), essencial pro log de
   * auditoria (`OperationLogs.tsx`) mostrar não só o que a IA executou, mas
   * o que ela recusou operar e por quê. Filtro de data opcional por
   * `timestamp`.
   */
  async getUserDecisions(
    userId: string,
    options?: { startDate?: string; endDate?: string; limit?: number }
  ): Promise<AIDecision[]> {
    try {
      let query = supabase
        .from('ai_decisions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (options?.startDate) query = query.gte('timestamp', options.startDate);
      if (options?.endDate) query = query.lte('timestamp', options.endDate);
      query = query.limit(options?.limit ?? 2000);

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AIDecision[];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar decisões do usuário:`, error);
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
  // USER AI CONFIG (persistência da configuração da IA por usuário —
  // sobrevive a fechar aba/trocar de navegador, ver `ai_user_config`)
  // ==========================================================================

  /**
   * Buscar a última configuração da IA salva pelo usuário. Retorna null se
   * o usuário nunca salvou nenhuma (primeiro uso — cai no default do código).
   */
  async getUserAIConfig(userId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('ai_user_config')
        .select('config')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data?.config ?? null;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao buscar configuração da IA do usuário:`, error);
      return null;
    }
  }

  /**
   * Salvar (upsert) a configuração da IA do usuário — chamado a cada mudança
   * na UI, não só ao criar sessão, pra que a última escolha real do usuário
   * fique registrada mesmo que ele nunca chegue a religar a IA de novo.
   */
  async saveUserAIConfig(userId: string, config: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_user_config')
        .upsert(
          { user_id: userId, config, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ Erro ao salvar configuração da IA do usuário:`, error);
      return false;
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
