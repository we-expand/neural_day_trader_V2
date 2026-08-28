-- Resultado hipotético por decisão logada do cérebro sombra (2026-08-29).
--
-- Contexto: SESSAO_2026-08-28_GERENCIAMENTO_DE_SAIDA_E_CEREBRO_ANALITICO.md,
-- item "⏸️ EXATAMENTE ONDE PARAMOS". Pedido do Cleber: o cérebro precisa
-- "entender o que fez de errado pra não repetir" — a forma aprovada é ele
-- ver o próprio histórico (decisão + resultado real) como contexto antes de
-- decidir de novo, NUNCA mudar peso/parâmetro (fine-tuning) — ver
-- justificativa completa no handoff.
--
-- Este é o passo 1 dessa cadeia: calcular, pra cada linha já logada, o que
-- teria acontecido de verdade se o lado sugerido pelo RANKING MECÂNICO
-- (mechanical_side, sempre presente) tivesse sido operado com a mesma
-- aritmética de risco do motor real (stop = 2×ATR, alvo = 3×stop — ver
-- STOP_ATR_MULTIPLIER/RISK_REWARD_MULTIPLE em runTradingCycle.ts). Contra
-- CANDLE REAL subsequente, sem look-ahead (mesma disciplina de todo
-- experimento deste projeto).
--
-- Por que só o lado mecânico, não recalcular pro brain_side também: com
-- stop e alvo simétricos em distância (só a direção inverte), a trajetória
-- do lado oposto é o espelho da trajetória computada — quem consome este
-- dado (passo 2/3 da cadeia) deriva o resultado do FLIP a partir do mesmo
-- número, sem precisar de uma segunda passada de replay nem de uma segunda
-- chamada de dado real.
--
-- entry_price_snapshot/atr_snapshot são gravados no MOMENTO da decisão
-- (nunca fabricados depois) — sem eles o resultado hipotético não seria
-- auditável contra o que o cérebro via de verdade quando decidiu.

ALTER TABLE ai_decision_brain_shadow
  ADD COLUMN IF NOT EXISTS entry_price_snapshot numeric,
  ADD COLUMN IF NOT EXISTS atr_snapshot numeric,
  ADD COLUMN IF NOT EXISTS hypothetical_outcome text
    CHECK (hypothetical_outcome IN ('WIN', 'LOSS', 'TIMEOUT', 'NO_DATA')),
  ADD COLUMN IF NOT EXISTS hypothetical_r_multiple numeric,
  ADD COLUMN IF NOT EXISTS hypothetical_outcome_computed_at timestamptz;

COMMENT ON COLUMN ai_decision_brain_shadow.hypothetical_outcome IS
  'Resultado do replay pra mechanical_side com candle real subsequente: WIN/LOSS (stop ou alvo de 2x/6x ATR atingido), TIMEOUT (nem um nem outro em 24h, R marcado a mercado no fim da janela), NO_DATA (candle real indisponível pra avaliar). NULL = ainda não avaliado.';
COMMENT ON COLUMN ai_decision_brain_shadow.hypothetical_r_multiple IS
  'Múltiplo de R (distância do stop) resultante do replay — negativo em LOSS, positivo em WIN/TIMEOUT favorável. Lado oposto (pra grading de FLIP) é o espelho: -hypothetical_r_multiple.';

CREATE INDEX IF NOT EXISTS idx_decision_brain_shadow_pending_outcome
  ON ai_decision_brain_shadow (created_at)
  WHERE hypothetical_outcome_computed_at IS NULL;
