-- Migration: ai_trading_persistence
-- Fase 2 (parte 1) — Motor de Demo persistido.
-- Cria as tabelas que AITradingPersistenceService.ts (src/app/services/) já esperava
-- (código pronto, nunca ligado por falta destas tabelas): sessões de trading, trades
-- individuais e snapshots de portfólio. Permite que saldo/posições virtuais do modo
-- DEMO sobrevivam a reload e troca de dispositivo, em vez de só localStorage.

CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_name text,
  mode text NOT NULL CHECK (mode IN ('DEMO', 'BACKTEST', 'LIVE')) DEFAULT 'DEMO',
  symbols text[],
  timeframe text,
  initial_balance numeric,
  initial_equity numeric,
  final_balance numeric,
  final_equity numeric,
  final_positions jsonb,
  total_trades int,
  winning_trades int,
  losing_trades int,
  win_rate numeric,
  total_pnl numeric,
  total_commission numeric,
  net_pnl numeric,
  max_drawdown numeric,
  max_drawdown_value numeric,
  sharpe_ratio numeric,
  profit_factor numeric,
  avg_win numeric,
  avg_loss numeric,
  largest_win numeric,
  largest_loss numeric,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL CHECK (status IN ('RUNNING', 'PAUSED', 'STOPPED', 'COMPLETED', 'ERROR')) DEFAULT 'RUNNING',
  config jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  type text NOT NULL CHECK (type IN ('BUY', 'SELL')),
  side text NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  entry_price numeric NOT NULL,
  exit_price numeric,
  quantity numeric NOT NULL,
  stop_loss numeric,
  take_profit numeric,
  pnl numeric,
  pnl_percentage numeric,
  commission numeric DEFAULT 0,
  net_pnl numeric,
  ai_confidence numeric,
  ai_reasoning text,
  indicators_snapshot jsonb,
  market_conditions jsonb,
  entry_time timestamptz NOT NULL,
  exit_time timestamptz,
  duration_seconds int,
  status text NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')) DEFAULT 'OPEN',
  exit_reason text CHECK (exit_reason IN ('TP', 'SL', 'MANUAL', 'TIMEOUT', 'AI_SIGNAL')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL,
  equity numeric NOT NULL,
  margin numeric,
  free_margin numeric,
  margin_level numeric,
  open_positions int,
  total_pnl numeric,
  drawdown numeric,
  max_equity numeric,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_trades_session_entry ON public.ai_trades (session_id, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_ai_trades_user_status ON public.ai_trades (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_portfolio_snapshots_session_ts ON public.ai_portfolio_snapshots (session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_status ON public.ai_sessions (user_id, status);

-- RLS: mesmo padrão "dono vê só o próprio dado" já usado em alert_history/backtest_results/
-- performance_metrics/user_activity (migration 002_fix_rls_security_gaps.sql).
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai_sessions" ON public.ai_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own ai_trades" ON public.ai_trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own ai_portfolio_snapshots" ON public.ai_portfolio_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

CREATE TRIGGER update_ai_sessions_updated_at BEFORE UPDATE ON public.ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_trades_updated_at BEFORE UPDATE ON public.ai_trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
