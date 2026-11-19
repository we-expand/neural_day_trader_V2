-- Modo sombra do redesenho do cérebro de decisão (2026-08-28).
--
-- Contexto: research/AI_BRAIN_SPEC.md e
-- research/experiments/2026-08-23-custo-nao-cobrado-e-poder/tradingagents-e-ml.md
-- já registraram que uma camada de decisão baseada em LLM não pode ser
-- validada contra dado HISTÓRICO (risco de vazamento temporal — o modelo
-- pode ter memorizado o que aconteceu no período usado pro teste). A única
-- forma honesta de validar é PRA FRENTE: logar a decisão do cérebro
-- analítico em tempo real, sem nenhum efeito em capital, e comparar contra
-- a decisão real do motor mecânico no mesmo ciclo — depois de semanas de
-- acúmulo, não antes. Esta tabela é a fonte de dado dessa comparação.
--
-- Nunca inclui execução nem preço de fechamento hipotético calculado aqui —
-- só a decisão e o contexto no momento em que foi tomada. O resultado
-- hipotético (teria ganho/perdido quanto) é calculado DEPOIS, na avaliação
-- da Fase 2, contra preço real que já aconteceu — nunca fabricado nesta
-- tabela no momento do log.

CREATE TABLE IF NOT EXISTS ai_decision_brain_shadow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Contexto real enviado ao LLM nesta decisão — auditável, nunca fabricado
  -- depois do fato. Inclui RSI/MACD/ADX/regime/Market Score/notícia
  -- próxima/sessão/config do usuário, o mesmo dado que os gates mecânicos
  -- 3-9 já calculam (ver runTradingCycle.ts).
  context_snapshot jsonb NOT NULL,

  -- Decisão do cérebro analítico (LLM) — nunca executada, só logada.
  brain_action text NOT NULL CHECK (brain_action IN ('PROCEED', 'SKIP', 'FLIP')),
  brain_side text CHECK (brain_side IN ('LONG', 'SHORT')), -- lado final proposto pelo cérebro (após FLIP, se houver)
  brain_confidence numeric,
  brain_reasoning text NOT NULL,
  brain_provider text NOT NULL, -- 'nvidia' | 'groq' | 'anthropic' — qual LLM gerou esta decisão
  brain_latency_ms integer,
  brain_error text, -- preenchido quando a chamada ao LLM falhou/expirou — a linha ainda é logada, nunca descartada silenciosamente

  -- Decisão REAL do motor mecânico pro MESMO candidato, no MESMO ciclo —
  -- gravada aqui pra comparação par-a-par sem precisar de join complexo
  -- depois. mechanical_stage é o vetoStage do funil (ex: RSI_NEUTRAL_LOW_CONFIDENCE)
  -- quando rejeitado nas etapas 3-9, ou NULL quando passou dessas etapas
  -- (pode ainda ser rejeitado depois por custo/risco — isso também é
  -- mecânico e idêntico nos dois braços, não é o que está sendo comparado).
  mechanical_action text NOT NULL CHECK (mechanical_action IN ('PROCEED', 'REJECT')),
  mechanical_stage text,
  mechanical_side text CHECK (mechanical_side IN ('LONG', 'SHORT'))
);

CREATE INDEX IF NOT EXISTS idx_decision_brain_shadow_symbol_time ON ai_decision_brain_shadow (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_brain_shadow_user ON ai_decision_brain_shadow (user_id, created_at DESC);

ALTER TABLE ai_decision_brain_shadow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê só o próprio shadow log" ON ai_decision_brain_shadow
  FOR SELECT USING (auth.uid() = user_id);

-- Só o service_role (Edge Function) grava — nunca o client.
CREATE POLICY "Service role grava shadow log" ON ai_decision_brain_shadow
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
