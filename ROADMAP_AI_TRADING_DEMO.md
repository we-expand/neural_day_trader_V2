# 🤖 **ROADMAP: AI TRADING EM MODO DEMO COM MERCADO REAL**

## 🎯 **OBJETIVO:**
Permitir que a AI trade em modo DEMO com dados de mercado REAIS, salvando histórico completo para análise e treinamento.

---

## 📊 **SITUAÇÃO ATUAL vs NECESSÁRIO**

| Sistema | Status Atual | O que falta |
|---------|--------------|-------------|
| **Dados de Mercado** | ✅ REAL (Binance) | Nada - OK! |
| **AI Logic** | ✅ Implementada | Nada - OK! |
| **Portfolio** | ❌ Resetando | Persistir no Supabase |
| **Trades** | ❌ Não salvos | Tabela `ai_trades` |
| **Performance** | ❌ Não persiste | Tabela `ai_sessions` |
| **Métricas** | ❌ Só sessão atual | Dashboard histórico |
| **Backtesting** | ⚠️ Funciona mas não salva | Salvar resultados |
| **Comparação** | ❌ Não existe | Comparar estratégias |

---

## 🏗️ **DESENVOLVIMENTO NECESSÁRIO**

### **FASE 1: PERSISTÊNCIA (Crítico)** 🔴

#### **1.1 - Database Schema**

**Criar tabelas no Supabase:**

```sql
-- ============================================================================
-- TABELA: ai_sessions
-- Sessões de trading da AI
-- ============================================================================
CREATE TABLE ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuração
  strategy_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('DEMO', 'BACKTEST', 'LIVE')),
  symbols TEXT[] NOT NULL,
  timeframe TEXT NOT NULL,
  
  -- Estado inicial
  initial_balance DECIMAL(15, 2) NOT NULL,
  initial_equity DECIMAL(15, 2) NOT NULL,
  
  -- Estado final
  final_balance DECIMAL(15, 2),
  final_equity DECIMAL(15, 2),
  final_positions JSONB,
  
  -- Métricas de performance
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2),
  
  total_pnl DECIMAL(15, 2) DEFAULT 0,
  total_commission DECIMAL(15, 2) DEFAULT 0,
  net_pnl DECIMAL(15, 2) DEFAULT 0,
  
  max_drawdown DECIMAL(5, 2),
  max_drawdown_value DECIMAL(15, 2),
  sharpe_ratio DECIMAL(8, 4),
  profit_factor DECIMAL(8, 4),
  
  avg_win DECIMAL(15, 2),
  avg_loss DECIMAL(15, 2),
  largest_win DECIMAL(15, 2),
  largest_loss DECIMAL(15, 2),
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'PAUSED', 'STOPPED', 'COMPLETED', 'ERROR')),
  
  -- Config completa (JSON)
  config JSONB,
  
  -- Índices
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX idx_ai_sessions_status ON ai_sessions(status);
CREATE INDEX idx_ai_sessions_started_at ON ai_sessions(started_at DESC);

-- ============================================================================
-- TABELA: ai_trades
-- Histórico de todos os trades da AI
-- ============================================================================
CREATE TABLE ai_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Dados do trade
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  
  -- Preços
  entry_price DECIMAL(15, 8) NOT NULL,
  exit_price DECIMAL(15, 8),
  
  -- Quantidade
  quantity DECIMAL(15, 8) NOT NULL,
  
  -- Risk Management
  stop_loss DECIMAL(15, 8),
  take_profit DECIMAL(15, 8),
  
  -- Resultado
  pnl DECIMAL(15, 2),
  pnl_percentage DECIMAL(8, 4),
  commission DECIMAL(15, 2) DEFAULT 0,
  net_pnl DECIMAL(15, 2),
  
  -- Análise da AI
  ai_confidence DECIMAL(5, 2),
  ai_reasoning TEXT,
  indicators_snapshot JSONB,
  market_conditions JSONB,
  
  -- Timestamps
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Status
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  exit_reason TEXT CHECK (exit_reason IN ('TP', 'SL', 'MANUAL', 'TIMEOUT', 'AI_SIGNAL')),
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_ai_trades_session_id ON ai_trades(session_id);
CREATE INDEX idx_ai_trades_user_id ON ai_trades(user_id);
CREATE INDEX idx_ai_trades_symbol ON ai_trades(symbol);
CREATE INDEX idx_ai_trades_status ON ai_trades(status);
CREATE INDEX idx_ai_trades_entry_time ON ai_trades(entry_time DESC);

-- ============================================================================
-- TABELA: ai_portfolio_snapshots
-- Snapshots do portfolio a cada minuto (para equity curve)
-- ============================================================================
CREATE TABLE ai_portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Estado do portfolio
  balance DECIMAL(15, 2) NOT NULL,
  equity DECIMAL(15, 2) NOT NULL,
  margin DECIMAL(15, 2) DEFAULT 0,
  free_margin DECIMAL(15, 2),
  margin_level DECIMAL(8, 2),
  
  -- Posições abertas
  open_positions INTEGER DEFAULT 0,
  total_pnl DECIMAL(15, 2) DEFAULT 0,
  
  -- Drawdown
  drawdown DECIMAL(5, 2),
  max_equity DECIMAL(15, 2),
  
  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_snapshots_session_id ON ai_portfolio_snapshots(session_id);
CREATE INDEX idx_snapshots_timestamp ON ai_portfolio_snapshots(timestamp DESC);

-- ============================================================================
-- TABELA: ai_decisions
-- Log de todas as decisões da AI (para análise)
-- ============================================================================
CREATE TABLE ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contexto
  symbol TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Decisão
  decision TEXT NOT NULL CHECK (decision IN ('BUY', 'SELL', 'HOLD', 'CLOSE')),
  confidence DECIMAL(5, 2) NOT NULL,
  reasoning TEXT NOT NULL,
  
  -- Análise
  market_score DECIMAL(5, 2),
  technical_signals JSONB,
  risk_assessment JSONB,
  
  -- Ação tomada
  action_taken BOOLEAN DEFAULT FALSE,
  trade_id UUID REFERENCES ai_trades(id),
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_decisions_session_id ON ai_decisions(session_id);
CREATE INDEX idx_decisions_timestamp ON ai_decisions(timestamp DESC);

-- ============================================================================
-- TABELA: ai_backtests
-- Resultados de backtests para comparação
-- ============================================================================
CREATE TABLE ai_backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuração
  name TEXT NOT NULL,
  description TEXT,
  strategy JSONB NOT NULL,
  
  -- Período
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  timeframe TEXT NOT NULL,
  
  -- Resultados
  initial_balance DECIMAL(15, 2) NOT NULL,
  final_balance DECIMAL(15, 2) NOT NULL,
  
  total_trades INTEGER,
  win_rate DECIMAL(5, 2),
  profit_factor DECIMAL(8, 4),
  sharpe_ratio DECIMAL(8, 4),
  max_drawdown DECIMAL(5, 2),
  
  total_pnl DECIMAL(15, 2),
  
  -- Dados completos
  equity_curve JSONB,
  trades JSONB,
  
  -- Status
  status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_backtests_user_id ON ai_backtests(user_id);
CREATE INDEX idx_backtests_created_at ON ai_backtests(created_at DESC);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_backtests ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários só veem seus próprios dados
CREATE POLICY "Users can view own sessions" ON ai_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON ai_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON ai_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own trades" ON ai_trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON ai_trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON ai_trades FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own snapshots" ON ai_portfolio_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON ai_portfolio_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own decisions" ON ai_decisions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decisions" ON ai_decisions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own backtests" ON ai_backtests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backtests" ON ai_backtests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNÇÕES ÚTEIS
-- ============================================================================

-- Função para calcular métricas da sessão
CREATE OR REPLACE FUNCTION calculate_session_metrics(p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ai_sessions
  SET
    total_trades = (SELECT COUNT(*) FROM ai_trades WHERE session_id = p_session_id),
    winning_trades = (SELECT COUNT(*) FROM ai_trades WHERE session_id = p_session_id AND net_pnl > 0),
    losing_trades = (SELECT COUNT(*) FROM ai_trades WHERE session_id = p_session_id AND net_pnl < 0),
    win_rate = (SELECT 
      CASE WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE net_pnl > 0)::DECIMAL / COUNT(*)) * 100 
      ELSE 0 END
      FROM ai_trades WHERE session_id = p_session_id
    ),
    total_pnl = (SELECT COALESCE(SUM(pnl), 0) FROM ai_trades WHERE session_id = p_session_id),
    total_commission = (SELECT COALESCE(SUM(commission), 0) FROM ai_trades WHERE session_id = p_session_id),
    net_pnl = (SELECT COALESCE(SUM(net_pnl), 0) FROM ai_trades WHERE session_id = p_session_id),
    avg_win = (SELECT AVG(net_pnl) FROM ai_trades WHERE session_id = p_session_id AND net_pnl > 0),
    avg_loss = (SELECT AVG(net_pnl) FROM ai_trades WHERE session_id = p_session_id AND net_pnl < 0),
    largest_win = (SELECT MAX(net_pnl) FROM ai_trades WHERE session_id = p_session_id),
    largest_loss = (SELECT MIN(net_pnl) FROM ai_trades WHERE session_id = p_session_id),
    updated_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar métricas automaticamente
CREATE OR REPLACE FUNCTION trigger_update_session_metrics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_session_metrics(NEW.session_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_metrics_on_trade
  AFTER INSERT OR UPDATE ON ai_trades
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_session_metrics();
```

---

#### **1.2 - Service Layer**

**Criar: `/src/app/services/AITradingPersistenceService.ts`**

```typescript
/**
 * 🤖 AI TRADING PERSISTENCE SERVICE
 * 
 * Salva e carrega dados de trading da AI no Supabase
 */

import { supabase } from '@/app/config/supabaseClient';

export interface AISession {
  id: string;
  user_id: string;
  strategy_name: string;
  mode: 'DEMO' | 'BACKTEST' | 'LIVE';
  symbols: string[];
  timeframe: string;
  initial_balance: number;
  initial_equity: number;
  final_balance?: number;
  final_equity?: number;
  total_trades: number;
  win_rate: number;
  total_pnl: number;
  max_drawdown: number;
  sharpe_ratio: number;
  started_at: string;
  ended_at?: string;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED' | 'ERROR';
  config: any;
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
  indicators_snapshot: any;
  market_conditions: any;
  entry_time: string;
  exit_time?: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  exit_reason?: 'TP' | 'SL' | 'MANUAL' | 'TIMEOUT' | 'AI_SIGNAL';
}

export interface PortfolioSnapshot {
  session_id: string;
  user_id: string;
  balance: number;
  equity: number;
  margin: number;
  open_positions: number;
  total_pnl: number;
  drawdown: number;
  timestamp: string;
}

export interface AIDecision {
  session_id: string;
  user_id: string;
  symbol: string;
  timestamp: string;
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string;
  market_score: number;
  technical_signals: any;
  risk_assessment: any;
  action_taken: boolean;
  trade_id?: string;
}

class AITradingPersistenceService {
  
  // ========================================================================
  // SESSIONS
  // ========================================================================
  
  /**
   * Criar nova sessão de trading
   */
  async createSession(data: Partial<AISession>): Promise<AISession | null> {
    try {
      const { data: session, error } = await supabase
        .from('ai_sessions')
        .insert([{
          user_id: data.user_id,
          strategy_name: data.strategy_name,
          mode: data.mode,
          symbols: data.symbols,
          timeframe: data.timeframe,
          initial_balance: data.initial_balance,
          initial_equity: data.initial_equity,
          config: data.config,
          status: 'RUNNING',
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('[AI Persistence] ✅ Sessão criada:', session.id);
      return session;
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao criar sessão:', error);
      return null;
    }
  }
  
  /**
   * Atualizar sessão
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
      return true;
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao atualizar sessão:', error);
      return false;
    }
  }
  
  /**
   * Finalizar sessão
   */
  async endSession(sessionId: string, finalBalance: number, finalEquity: number): Promise<boolean> {
    return this.updateSession(sessionId, {
      final_balance: finalBalance,
      final_equity: finalEquity,
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
      return data || [];
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao buscar sessões:', error);
      return [];
    }
  }
  
  /**
   * Buscar sessão ativa
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
      
      if (error) throw error;
      return data;
    } catch (error) {
      return null;
    }
  }
  
  // ========================================================================
  // TRADES
  // ========================================================================
  
  /**
   * Salvar trade
   */
  async saveTrade(trade: AITrade): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_trades')
        .insert([trade])
        .select('id')
        .single();
      
      if (error) throw error;
      
      console.log('[AI Persistence] ✅ Trade salvo:', data.id);
      return data.id;
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao salvar trade:', error);
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
      return true;
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao atualizar trade:', error);
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
      return data || [];
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao buscar trades:', error);
      return [];
    }
  }
  
  // ========================================================================
  // PORTFOLIO SNAPSHOTS
  // ========================================================================
  
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
      console.error('[AI Persistence] ❌ Erro ao salvar snapshot:', error);
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
      return data || [];
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao buscar snapshots:', error);
      return [];
    }
  }
  
  // ========================================================================
  // AI DECISIONS
  // ========================================================================
  
  /**
   * Salvar decisão da AI
   */
  async saveDecision(decision: AIDecision): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_decisions')
        .insert([decision]);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao salvar decisão:', error);
      return false;
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
      return data || [];
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao buscar decisões:', error);
      return [];
    }
  }
  
  // ========================================================================
  // BACKTESTS
  // ========================================================================
  
  /**
   * Salvar resultado de backtest
   */
  async saveBacktest(backtest: any): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_backtests')
        .insert([backtest])
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao salvar backtest:', error);
      return null;
    }
  }
  
  /**
   * Buscar backtests do usuário
   */
  async getUserBacktests(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ai_backtests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AI Persistence] ❌ Erro ao buscar backtests:', error);
      return [];
    }
  }
}

// Singleton
export const aiPersistence = new AITradingPersistenceService();
```

---

### **FASE 2: INTEGRAÇÃO COM AI TRADER** 🟡

#### **2.1 - Modificar useApexLogic.ts**

**Adicionar:**
- Criar sessão ao ativar AI
- Salvar cada trade executado
- Snapshot do portfolio a cada minuto
- Salvar decisões da AI

#### **2.2 - Auto-save**

```typescript
// useApexLogic.ts

// Ao iniciar trading
const startTrading = async () => {
  // Criar sessão
  const session = await aiPersistence.createSession({
    user_id: user.id,
    strategy_name: config.strategy,
    mode: 'DEMO',
    symbols: [selectedSymbol],
    timeframe: timeframe,
    initial_balance: portfolio.balance,
    initial_equity: portfolio.equity,
    config: config,
  });
  
  setCurrentSessionId(session.id);
  
  // Iniciar snapshot automático
  startSnapshotInterval(session.id);
};

// Ao executar trade
const executeTrade = async (trade) => {
  // ... lógica existente ...
  
  // Salvar no banco
  const tradeId = await aiPersistence.saveTrade({
    session_id: currentSessionId,
    user_id: user.id,
    symbol: trade.symbol,
    type: trade.type,
    side: trade.side,
    entry_price: trade.entryPrice,
    quantity: trade.quantity,
    stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit,
    ai_confidence: trade.confidence,
    ai_reasoning: trade.reasoning,
    indicators_snapshot: getIndicatorsSnapshot(),
    market_conditions: getMarketConditions(),
    entry_time: new Date().toISOString(),
    status: 'OPEN',
    commission: calculateCommission(trade),
  });
  
  trade.dbId = tradeId; // Guardar ID do banco
};

// Ao fechar trade
const closeTrade = async (trade) => {
  // ... lógica existente ...
  
  // Atualizar no banco
  await aiPersistence.updateTrade(trade.dbId, {
    exit_price: trade.exitPrice,
    exit_time: new Date().toISOString(),
    pnl: trade.pnl,
    pnl_percentage: trade.pnlPercentage,
    net_pnl: trade.netPnl,
    status: 'CLOSED',
    exit_reason: trade.exitReason,
  });
};

// Snapshot automático
const startSnapshotInterval = (sessionId) => {
  const interval = setInterval(async () => {
    await aiPersistence.saveSnapshot({
      session_id: sessionId,
      user_id: user.id,
      balance: portfolio.balance,
      equity: portfolio.equity,
      margin: portfolio.margin,
      open_positions: positions.length,
      total_pnl: calculateTotalPnL(),
      drawdown: calculateDrawdown(),
      timestamp: new Date().toISOString(),
    });
  }, 60000); // A cada 1 minuto
  
  return interval;
};
```

---

### **FASE 3: DASHBOARD DE ANÁLISE** 🟢

#### **3.1 - Criar: `/src/app/components/ai/AIAnalyticsDashboard.tsx`**

**Features:**
- Listar todas as sessões
- Equity curve histórica
- Métricas comparativas
- Análise de decisões
- Heatmap de performance
- Trade journal
- AI reasoning viewer

---

### **FASE 4: TREINAMENTO & OTIMIZAÇÃO** 🔵

#### **4.1 - Sistema de Replay**

Ver decisões passadas da AI e analisar se foram corretas.

#### **4.2 - A/B Testing**

Rodar múltiplas estratégias simultaneamente e comparar.

#### **4.3 - Parameter Optimization**

Grid search para encontrar melhores parâmetros.

---

## 🚀 **IMPLEMENTAÇÃO PRIORITÁRIA**

### **✅ MÍNIMO VIÁVEL (1-2 dias):**

1. ✅ Criar tabelas `ai_sessions` e `ai_trades`
2. ✅ Service layer básico
3. ✅ Integrar com useApexLogic (salvar trades)
4. ✅ Dashboard simples para ver histórico

**Com isso você já pode:**
- ✅ Deixar AI rodando por dias
- ✅ Ver histórico completo
- ✅ Analisar performance ao longo do tempo
- ✅ Comparar sessões diferentes

---

### **🎯 COMPLETO (1 semana):**

1. ✅ Todas as 5 tabelas
2. ✅ Snapshots automáticos
3. ✅ Log de decisões
4. ✅ Dashboard completo
5. ✅ Backtesting com persistência
6. ✅ Comparação de estratégias

---

## 📊 **EXEMPLO DE USO:**

```typescript
// 1. Usuário ativa AI Trader
// → Sistema cria sessão no Supabase

// 2. AI roda por 24 horas
// → Cada trade é salvo
// → Snapshot a cada minuto
// → Todas as decisões logadas

// 3. Usuário para AI
// → Sessão é finalizada
// → Métricas calculadas

// 4. Usuário acessa Analytics
// → Vê gráfico de equity
// → Analisa cada trade
// → Compara com outras sessões
// → Vê raciocínio da AI em cada decisão
```

---

## 🎁 **BÔNUS: Features Avançadas**

### **Machine Learning:**
- Treinar modelo com trades históricos
- Prever probabilidade de sucesso
- Auto-otimização de parâmetros

### **Export:**
- Exportar CSV de todos os trades
- Relatório PDF automatizado
- Excel com análises

### **Alerts:**
- Notificar quando AI toma decisão importante
- Telegram/Email quando atingir meta
- Alert de drawdown excessivo

---

## 📝 **PRÓXIMOS PASSOS:**

**Quer que eu implemente?**

1. ✅ Criar o SQL completo das tabelas?
2. ✅ Implementar o service layer completo?
3. ✅ Integrar com useApexLogic?
4. ✅ Criar dashboard de analytics?

**Ou prefere que eu comece pelo mínimo viável?**
