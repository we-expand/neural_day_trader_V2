-- Migration: add_asset_performance_scorecard
-- Ver SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md pro desenho
-- completo. Tabela lida pelo motor (runTradingCycle.ts, rankCandidates) e
-- escrita só pelo job periódico (supabase/functions/asset-performance-scorecard/).
--
-- IMPORTANTE: existência desta tabela NÃO liga o efeito no motor — o
-- multiplicador só é aplicado de verdade se `ASSET_SCORECARD_ACTIVE` em
-- runTradingCycle.ts estiver `true` (hoje `false`, ver comentário lá e em
-- AssetScorecard.ts: proxy-backtest de 21/08 não mostrou melhora medida
-- ainda, dado insuficiente). Até lá esta tabela só acumula histórico.

CREATE TABLE IF NOT EXISTS asset_performance_scorecard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  n_trades INTEGER NOT NULL,
  avg_pnl NUMERIC NOT NULL,
  std_dev NUMERIC NOT NULL,
  lower_bound NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL,
  window_size INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_asset_performance_scorecard_user
  ON asset_performance_scorecard (user_id);

ALTER TABLE asset_performance_scorecard ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário só vê o próprio scorecard (mesmo padrão de RLS do resto
-- do projeto — ai_sessions/ai_trades). Escrita: só service_role (o job usa
-- a service key, nunca o client).
CREATE POLICY "select_own_scorecard" ON asset_performance_scorecard
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_scorecard" ON asset_performance_scorecard
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
