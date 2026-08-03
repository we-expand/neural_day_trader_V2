-- 011_chart_favorite_setup.sql
-- Setup favorito do gráfico (indicadores ativos + parâmetros, grade, S/R),
-- salvo pelo usuário via menu de botão direito e reaplicado automaticamente
-- toda vez que ele volta ao gráfico. Um registro por usuário (global, não por
-- ativo -- diferente de chart_preferences). Mesmo padrão de RLS "dono só vê o
-- próprio" já usado em 006_strategies.sql e 008_chart_preferences.sql.

CREATE TABLE IF NOT EXISTS public.chart_favorite_setup (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chart_favorite_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_favorite_setup_select_own"
  ON public.chart_favorite_setup FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "chart_favorite_setup_insert_own"
  ON public.chart_favorite_setup FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chart_favorite_setup_update_own"
  ON public.chart_favorite_setup FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chart_favorite_setup_delete_own"
  ON public.chart_favorite_setup FOR DELETE
  USING (auth.uid() = user_id);
