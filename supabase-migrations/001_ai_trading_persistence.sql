-- ============================================================================
-- NEURAL DAY TRADER - AI TRADING PERSISTENCE
-- Migration: 001_ai_trading_persistence
-- Description: Sistema completo de persistência para AI Trader
-- ============================================================================

-- ============================================================================
-- TABELA: ai_sessions
-- Sessões de trading da AI (cada vez que o usuário ativa AI)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuração da sessão
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
  win_rate DECIMAL(5, 2) DEFAULT 0,
  
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
-- Histórico completo de todos os trades da AI
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_trades (
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
CREATE TABLE IF NOT EXISTS ai_portfolio_snapshots (
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
CREATE TABLE IF NOT EXISTS ai_decisions (
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
CREATE TABLE IF NOT EXISTS ai_backtests (
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
-- ROW LEVEL SECURITY (RLS)
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
      FROM ai_trades WHERE session_id = p_session_id AND status = 'CLOSED'
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

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_sessions_updated_at
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_trades_updated_at
  BEFORE UPDATE ON ai_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS ÚTEIS
-- ============================================================================

-- View: Performance summary por sessão
CREATE OR REPLACE VIEW ai_sessions_summary AS
SELECT 
  s.*,
  (s.final_equity - s.initial_equity) as equity_change,
  ((s.final_equity - s.initial_equity) / s.initial_equity * 100) as roi_percentage,
  EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600 as duration_hours,
  (SELECT COUNT(*) FROM ai_portfolio_snapshots WHERE session_id = s.id) as total_snapshots
FROM ai_sessions s;

-- View: Top trades
CREATE OR REPLACE VIEW top_ai_trades AS
SELECT 
  t.*,
  s.strategy_name,
  s.mode
FROM ai_trades t
JOIN ai_sessions s ON t.session_id = s.id
WHERE t.status = 'CLOSED'
ORDER BY t.net_pnl DESC;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE ai_sessions IS 'Sessões de trading da AI - cada ativação do AI Trader';
COMMENT ON TABLE ai_trades IS 'Histórico completo de todos os trades executados pela AI';
COMMENT ON TABLE ai_portfolio_snapshots IS 'Snapshots do portfolio a cada minuto para equity curve';
COMMENT ON TABLE ai_decisions IS 'Log de todas as decisões tomadas pela AI';
COMMENT ON TABLE ai_backtests IS 'Resultados de backtests para comparação de estratégias';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

-- Grant permissions (se necessário)
-- GRANT ALL ON ai_sessions TO authenticated;
-- GRANT ALL ON ai_trades TO authenticated;
-- GRANT ALL ON ai_portfolio_snapshots TO authenticated;
-- GRANT ALL ON ai_decisions TO authenticated;
-- GRANT ALL ON ai_backtests TO authenticated;
