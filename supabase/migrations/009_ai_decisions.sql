-- Migration: ai_decisions
-- Bloco A do cérebro cognitivo (research/AI_COGNITIVE_SPEC.md) — diário de
-- decisão persistente. Cria a tabela que `AITradingPersistenceService.ts`
-- (saveDecision/getSessionDecisions, `src/app/services/`) e o hook
-- `useAIPersistence.ts` já esperavam desde a Fase 2 — código pronto e
-- exportado, mas nunca chamado por `useApexLogic.ts` e sem tabela no banco
-- (todo INSERT falharia silenciosamente, capturado pelo try/catch do
-- serviço). Achado em 2026-07-31 ao mapear o pedido do Cleber de "memória
-- persistente" para o cérebro.
--
-- Por que isto importa mais que "mais uma tabela de log": hoje o motor
-- registra RESULTADO (ai_trades, migration 004) mas nunca DECISÃO — inclusive
-- e principalmente as decisões de NÃO operar (Score contradiz, gate de custo
-- recusa, gate de risco recusa, cooldown ativo, limite diário atingido). Sem
-- isso, "comportamento auditável" (função objetivo do cérebro sob a decisão
-- (B), AI_BRAIN_SPEC.md seção 14.5) é alegação, não fato verificável — e é
-- impossível medir se os próprios vetos ajudaram (a única métrica que valida
-- um cérebro de execução/disciplina em vez de alfa).
--
-- Design: reaproveita a interface `AIDecision` já existente no serviço sem
-- alterá-la — só adiciona `veto_stage` (nullable, novo) pra tornar a etapa do
-- funil que recusou o trade filtrável sem parsear `reasoning` em texto livre.

CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  decision text NOT NULL CHECK (decision IN ('BUY', 'SELL', 'HOLD', 'CLOSE')),
  confidence numeric,
  reasoning text NOT NULL,
  market_score numeric,
  technical_signals jsonb,
  risk_assessment jsonb,
  action_taken boolean NOT NULL DEFAULT false,
  -- Etapa do funil de decisão que gerou este registro. NULL = decisão de
  -- entrada aprovada (action_taken=true). Lista fechada pra manter a coluna
  -- consultável — estender aqui, nunca inventar valor livre no código.
  veto_stage text CHECK (veto_stage IN (
    'CONTEXT_SCORE_OPPOSITE',   -- Market Score classifica na direção contrária
    'CONTEXT_SCORE_LATERAL',    -- regime LATERAL + confiança da estratégia insuficiente
    'CONTEXT_CONFIDENCE',       -- confiança combinada (estratégia+Score) abaixo do mínimo
    'CONTEXT_GATE',             -- Context Gate (Bloco B, ADX/ATR/BOS-CHoCH) recusou — nunca Market Score
    'CONFIG_DIRECTION',         -- direção travada pelo usuário (aiConfig.direction)
    'COST_GATE',                -- CostViabilityGate recusou (custo devora o movimento típico)
    'COST_GATE_NO_DATA',        -- ATR indisponível, sem dado real pra avaliar custo
    'RISK_GATE',                -- RiskManager.validateTrade recusou (daily loss/drawdown/etc)
    'KILL_SWITCH',              -- perda catastrófica, IA parada
    'COOLDOWN',                 -- pausa pós-perdas-consecutivas ativa
    'MAX_TRADES_PER_DAY',       -- limite diário de trades atingido
    'REVENGE_PATTERN'           -- detector de revenge trading (Bloco D) sinalizou o padrão
  )),
  trade_id uuid REFERENCES public.ai_trades(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_session_ts ON public.ai_decisions (session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_user_symbol ON public.ai_decisions (user_id, symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_veto_stage ON public.ai_decisions (veto_stage) WHERE veto_stage IS NOT NULL;

ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai_decisions" ON public.ai_decisions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
