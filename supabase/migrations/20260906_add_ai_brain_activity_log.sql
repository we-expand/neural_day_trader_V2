-- 2026-09-06: "Logs do Sistema" (AITrader.tsx) mostrava sempre "Nenhuma
-- atividade ainda..." em modo DEMO -- causa raiz catalogada desde 2026-08-17
-- (comentário em useApexLogic.ts): aquele painel só recebe linha via
-- addLog(), chamado de dentro do ciclo de trading que rodava NO NAVEGADOR.
-- Desde que o motor mecânico foi desligado (2026-08-31) e o LLM Brain
-- (llm-active-brain/) passou a ser o motor único, rodando como processo
-- Node LOCAL/servidor, nenhum ciclo real roda mais no navegador -- o painel
-- ficou preso vazio para sempre, mesmo com a IA operando de verdade.
--
-- Esta tabela é o canal real: o llm-active-brain grava aqui, ciclo a ciclo,
-- cada consulta de cotação, chamada de ferramenta, pensamento (log_thought)
-- e decisão (open/close/increase_position) que a IA realmente faz -- nunca
-- fabricado, sempre o que o modelo de fato pediu e o resultado real que
-- veio de volta. O frontend assina via Realtime (useApexLogic.ts) e injeta
-- no mesmo painel "Logs do Sistema" que já existia.
CREATE TABLE IF NOT EXISTS public.ai_brain_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle integer NOT NULL,
  -- 'cycle_start' | 'tool_call' | 'thought' | 'decision' | 'error'
  type text NOT NULL,
  symbol text,
  message text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_brain_activity_log_session_created
  ON public.ai_brain_activity_log (session_id, created_at DESC);

ALTER TABLE public.ai_brain_activity_log ENABLE ROW LEVEL SECURITY;

-- Só leitura pro dono da sessão -- quem grava é sempre o llm-active-brain
-- via service_role (bypassa RLS), nunca o navegador.
CREATE POLICY "Users read own ai_brain_activity_log" ON public.ai_brain_activity_log
  FOR SELECT USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_brain_activity_log;

-- 🔴 Pendência conhecida, fora do escopo desta migration: esta tabela cresce
-- rápido (10-30 linhas por ciclo, cadência AGRESSIVA roda a cada poucos
-- minutos) e não tem limpeza automática ainda. Considerar um job periódico
-- (pg_cron, mesmo padrão de outros jobs do projeto) apagando linhas com mais
-- de X dias antes de crescer demais em produção real.
