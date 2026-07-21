-- 008_chart_preferences.sql
-- Preferência por usuário+ativo de mostrar/ocultar as linhas de
-- Suporte/Resistência desenhadas no gráfico (toggle do menu de botão direito).
-- Mesmo padrão de RLS "dono só vê o próprio" já usado em 006_strategies.sql.

CREATE TABLE IF NOT EXISTS public.chart_preferences (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  show_sr_overlay boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

ALTER TABLE public.chart_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_preferences_select_own"
  ON public.chart_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "chart_preferences_insert_own"
  ON public.chart_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chart_preferences_update_own"
  ON public.chart_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chart_preferences_delete_own"
  ON public.chart_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chart_preferences_user_id
  ON public.chart_preferences (user_id);
