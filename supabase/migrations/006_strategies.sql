-- Migration: strategies
-- Backtest real + estratégias customizáveis.
-- Antes, o StrategyBuilderPro.tsx tinha um onSave que só fazia console.log
-- (// TODO: Salvar estratégia no Supabase) e as 6 "estratégias prontas" existiam
-- só como {id,name,description} hardcoded em BacktestConfigModal.tsx, sem regras
-- reais nem persistência. Esta tabela guarda o schema unificado (src/app/types/strategy.ts)
-- tanto das estratégias prontas (seedadas abaixo, is_preset=true, user_id null,
-- visíveis a todos, somente leitura) quanto das customizadas por cada usuário.

-- id é text (não uuid) de propósito: as 6 estratégias prontas usam os mesmos
-- ids curtos '1'..'6' já usados no front (src/app/data/presetStrategies.ts),
-- pra permitir merge direto entre o array local e as linhas do banco sem
-- tabela de tradução de id.
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

-- Presets (user_id null) são visíveis a todo mundo autenticado, somente leitura.
CREATE POLICY "strategies_select_presets" ON public.strategies
  FOR SELECT
  TO authenticated
  USING (is_preset = true);

-- Estratégias customizadas: dono vê/edita/apaga só as próprias.
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

-- Seed das 6 estratégias prontas (mesmo conteúdo de src/app/data/presetStrategies.ts,
-- mantido em sincronia manualmente — o front usa o array TS como fonte de verdade
-- para exibir/rodar; esta linha no banco existe só para permitir referenciar
-- strategy_id em ai_sessions/backtests sem duplicar a definição via FK textual).
INSERT INTO public.strategies (id, user_id, is_preset, name, description, definition)
VALUES
  ('1', NULL, true, 'Rompimento', 'Estratégia de rompimento de suporte/resistência (Bollinger Bands + volume)', '{}'::jsonb),
  ('2', NULL, true, 'TDSM_98', 'Tendência + RSI divergência (EMA 50/200 + RSI)', '{}'::jsonb),
  ('3', NULL, true, 'Indicador de Retrocessos', 'Retração/pullback com EMA + estocástico', '{}'::jsonb),
  ('4', NULL, true, 'False Breaktroughs', 'Detecção de falso rompimento (reversão em extremos de Bollinger + RSI)', '{}'::jsonb),
  ('5', NULL, true, 'AA PURE BREAK', 'Breakout puro por ATR + preço em máxima/mínima recente', '{}'::jsonb),
  ('6', NULL, true, 'WIKIOSKIT EXECUTION', 'Execução baseada em volume (VWAP + OBV)', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
