-- 2026-11-06: painel de regulagem da LLM (Admin). 2 perfis salvos: WEEKDAY (dia util) e WEEKEND (fim de semana).
-- BASELINE e gravada so pelo motor (service_role): retrato dos parametros vindos do .env, usado pelo painel pra montar a tela.
CREATE TABLE IF NOT EXISTS public.llm_tuning_profiles (
  profile    text PRIMARY KEY CHECK (profile IN ('BASELINE', 'WEEKDAY', 'WEEKEND')),
  values     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- BASELINE: todos os parametros; perfis: SO os ajustes (chave ausente = valor do .env)
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO public.llm_tuning_profiles (profile) VALUES ('WEEKDAY'), ('WEEKEND') ON CONFLICT (profile) DO NOTHING;

ALTER TABLE public.llm_tuning_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS llm_tuning_admin_select ON public.llm_tuning_profiles;
CREATE POLICY llm_tuning_admin_select ON public.llm_tuning_profiles
  FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'clbrcouto@gmail.com');

-- Admin edita so os 2 perfis (nunca o BASELINE do motor).
DROP POLICY IF EXISTS llm_tuning_admin_insert ON public.llm_tuning_profiles;
CREATE POLICY llm_tuning_admin_insert ON public.llm_tuning_profiles
  FOR INSERT TO authenticated
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'clbrcouto@gmail.com' AND profile IN ('WEEKDAY', 'WEEKEND'));

DROP POLICY IF EXISTS llm_tuning_admin_update ON public.llm_tuning_profiles;
CREATE POLICY llm_tuning_admin_update ON public.llm_tuning_profiles
  FOR UPDATE TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'clbrcouto@gmail.com' AND profile IN ('WEEKDAY', 'WEEKEND'))
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'clbrcouto@gmail.com' AND profile IN ('WEEKDAY', 'WEEKEND'));

-- Motor usa service_role (ignora RLS). Realtime nao e necessario: o motor le a cada 15s.
