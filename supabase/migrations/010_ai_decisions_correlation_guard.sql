-- Adiciona 'CORRELATION_GUARD' à lista fechada de veto_stage em ai_decisions
-- (009_ai_decisions.sql). Necessário pro TAREFA 1 (guard de correlação ao
-- vivo, LiveCorrelationGuard.ts) — sem isto, INSERTs com
-- veto_stage='CORRELATION_GUARD' falham no CHECK constraint em produção.
--
-- Rodar manualmente no SQL Editor do Supabase (convenção do projeto —
-- Claude nunca aplica migration sozinho, ver CLAUDE.md).

ALTER TABLE public.ai_decisions DROP CONSTRAINT IF EXISTS ai_decisions_veto_stage_check;

ALTER TABLE public.ai_decisions ADD CONSTRAINT ai_decisions_veto_stage_check CHECK (veto_stage IN (
  'CONTEXT_SCORE_OPPOSITE',
  'CONTEXT_SCORE_LATERAL',
  'CONTEXT_CONFIDENCE',
  'CONTEXT_GATE',
  'CONFIG_DIRECTION',
  'COST_GATE',
  'COST_GATE_NO_DATA',
  'RISK_GATE',
  'KILL_SWITCH',
  'COOLDOWN',
  'MAX_TRADES_PER_DAY',
  'REVENGE_PATTERN',
  'CORRELATION_GUARD'
));
