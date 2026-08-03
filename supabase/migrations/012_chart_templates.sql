-- 012_chart_templates.sql
-- Templates NOMEADOS do gráfico (indicadores + parâmetros, grade, S/R,
-- timeframe, zoom/scroll) — CRUD completo via menu "Templates" do botão
-- direito. Vários registros por usuário (um por template salvo), diferente
-- de chart_favorite_setup (011, um único setup global auto-aplicado).
-- Mesmo padrão de RLS "dono só vê o próprio" já usado nas migrations
-- anteriores de preferência de gráfico.

CREATE TABLE IF NOT EXISTS public.chart_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.chart_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_templates_select_own"
  ON public.chart_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "chart_templates_insert_own"
  ON public.chart_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chart_templates_update_own"
  ON public.chart_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chart_templates_delete_own"
  ON public.chart_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chart_templates_user_id
  ON public.chart_templates (user_id);
