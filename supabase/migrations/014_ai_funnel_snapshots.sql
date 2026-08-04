-- Migration: ai_funnel_snapshots
-- Telemetria de funil do motor de decisão (Fase 0 do redesenho do cérebro,
-- 2026-08-04). Responde a pergunta que hoje é IMPOSSÍVEL de responder com o
-- banco atual: "de todas as avaliações que a IA fez, onde exatamente elas
-- morreram?".
--
-- Motivação medida, não hipotética: em 2026-08-04 a sessão 2cff1634 rodou
-- 4h40 em RUNNING e gravou ZERO linhas em ai_decisions. O ciclo de
-- useApexLogic.ts tem 27 pontos de saída, mas só 15 gravam veto — as 12
-- primeiras (dado indisponível, sem candles, estratégia sem sinal, etc.)
-- saem em silêncio absoluto. O sistema é cego exatamente onde falha, e não
-- havia como distinguir "loop parado" de "loop rodando e sendo vetado".
--
-- Por que tabela nova em vez de mais linhas em ai_decisions: o funil é
-- problema de CONTAGEM, não de evento. A 3 ativos por tick de 5s, gravar uma
-- linha por avaliação seria ~51 mil linhas/dia POR USUÁRIO. Aqui cada linha é
-- uma janela agregada (padrão: 60s), com os contadores por estágio em jsonb.
-- ai_decisions continua sendo o diário das decisões que chegaram aos gates de
-- pontuação — não é poluído com ruído de infraestrutura.
--
-- A coluna `ticks` é o instrumento decisivo: o loop é um setInterval de 5s no
-- NAVEGADOR, e o Chrome estrangula timers de aba em segundo plano pra 1/min
-- depois de 5min. Numa janela de 60s o esperado são 12 ticks. Se vier 1, a
-- aba estava em background e a IA estava praticamente desligada — causa que
-- até hoje não podia ser nem confirmada nem descartada.
--
-- Rodar manualmente no SQL Editor do Supabase (convenção do projeto —
-- Claude nunca aplica migration sozinho, ver CLAUDE.md).

CREATE TABLE IF NOT EXISTS public.ai_funnel_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,

  -- Quantos ticks do setInterval realmente dispararam nesta janela.
  -- Esperado = duração_da_janela / 5s (12 numa janela de 60s). Valor muito
  -- abaixo disso = aba estrangulada pelo navegador, NÃO gate conservador.
  ticks integer NOT NULL DEFAULT 0,

  -- Quantas análises de ativo foram INICIADAS (entraram no bloco async por
  -- ativo). É o denominador do funil.
  evaluations integer NOT NULL DEFAULT 0,

  -- Contagem por estágio terminal: { "DATA_NOT_REAL": 412, "NO_SIGNAL": 88, ... }
  -- Invariante de auditoria: soma(stage_counts) = evaluations. Se não fechar,
  -- existe caminho de saída não instrumentado — que é exatamente o bug que
  -- esta migration existe pra tornar impossível de acontecer em silêncio.
  stage_counts jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Mesma contagem quebrada por ativo: { "GBPUSD": { "DATA_NOT_REAL": 120 } }.
  -- É o que separa "a MetaAPI está saturada pra forex/índices" de "o mercado
  -- não tem setup" — em 2026-08-04 só ETHUSD produzia decisão porque cripto
  -- tem WebSocket próprio da Binance e o resto depende da conta MetaAPI
  -- compartilhada entre todos os usuários.
  symbol_stage_counts jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Amostras textuais (poucas, rotativas) por estágio, pra depurar sem ter
  -- que reproduzir ao vivo. Nunca é a fonte de contagem, só ilustração.
  samples jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_funnel_session_window
  ON public.ai_funnel_snapshots (session_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_ai_funnel_user_window
  ON public.ai_funnel_snapshots (user_id, window_start DESC);

ALTER TABLE public.ai_funnel_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai_funnel_snapshots" ON public.ai_funnel_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
