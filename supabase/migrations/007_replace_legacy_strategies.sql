-- Migration: replace_legacy_strategies
-- A migration 006_strategies.sql nunca rodou de fato em produção: já existia
-- uma tabela public.strategies desde o schema original do Figma Make
-- (001_initial_schema.sql) com colunas completamente diferentes
-- (id uuid, asset_class, config, is_public, ...) e 0 linhas — nenhum código
-- do app (grep em src/) usa essa tabela nem a backtest_results que a
-- referencia por FK. O CREATE TABLE IF NOT EXISTS da 006 foi ignorado
-- silenciosamente (tabela já existia) e o INSERT dos presets teria falhado
-- (coluna is_preset não existe nessa tabela antiga).
--
-- Esta migration renomeia a tabela antiga (preserva os dados, embora 0
-- linhas, e mantém a FK de backtest_results funcionando — Postgres segue
-- o rename automaticamente) e então roda o conteúdo real da 006 para criar
-- a tabela nova, no schema que src/app/hooks/useStrategies.ts espera
-- (id text, user_id, is_preset, name, description, definition jsonb).

ALTER TABLE public.strategies RENAME TO strategies_legacy_unused;

-- ---- conteúdo da migration 006_strategies.sql ----

CREATE TABLE IF NOT EXISTS public.strategies (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_preset boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  description text,
  definition jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT preset_has_no_owner CHECK (NOT is_preset OR user_id IS NULL)
);

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategies_select_presets" ON public.strategies
  FOR SELECT
  TO authenticated
  USING (is_preset = true);

CREATE POLICY "strategies_select_own" ON public.strategies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "strategies_insert_own" ON public.strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_preset = false);

CREATE POLICY "strategies_update_own" ON public.strategies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_preset = false)
  WITH CHECK (auth.uid() = user_id AND is_preset = false);

CREATE POLICY "strategies_delete_own" ON public.strategies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_preset = false);

CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON public.strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_strategies_is_preset ON public.strategies(is_preset);

INSERT INTO public.strategies (id, user_id, is_preset, name, description, definition)
VALUES
  ('1', NULL, true, 'Rompimento', 'Estratégia de rompimento de suporte/resistência (Bollinger Bands + volume)', '{}'::jsonb),
  ('2', NULL, true, 'TDSM_98', 'Tendência + RSI divergência (EMA 50/200 + RSI)', '{}'::jsonb),
  ('3', NULL, true, 'Indicador de Retrocessos', 'Retração/pullback com EMA + estocástico', '{}'::jsonb),
  ('4', NULL, true, 'False Breaktroughs', 'Detecção de falso rompimento (reversão em extremos de Bollinger + RSI)', '{}'::jsonb),
  ('5', NULL, true, 'AA PURE BREAK', 'Breakout puro por ATR + preço em máxima/mínima recente', '{}'::jsonb),
  ('6', NULL, true, 'WIKIOSKIT EXECUTION', 'Execução baseada em volume (VWAP + OBV)', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
