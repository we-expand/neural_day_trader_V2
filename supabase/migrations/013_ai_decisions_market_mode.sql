-- Adiciona 'MARKET_MODE_REGIME_MISMATCH' e 'MARKET_MODE_COUNTER_NO_EXTREME' à
-- lista fechada de veto_stage em ai_decisions (009_ai_decisions.sql,
-- estendida em 010). Necessário pro fix que tornou aiConfig.marketMode
-- (TREND/RANGE/COUNTER) um filtro real no motor (useApexLogic.ts) — antes só
-- SCALP tinha efeito; TREND/RANGE/COUNTER eram selecionáveis na UI mas
-- idênticos no motor (achado da auditoria de 2026-08-04). Sem esta migration,
-- INSERTs com esses veto_stage falham no CHECK constraint em produção.
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
  'CORRELATION_GUARD',
  'MARKET_MODE_REGIME_MISMATCH',
  'MARKET_MODE_COUNTER_NO_EXTREME'
));
