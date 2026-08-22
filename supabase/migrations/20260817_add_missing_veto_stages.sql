-- Corrige ai_decisions_veto_stage_check: faltavam 3 valores que o código usa
-- há tempo (MARKET_MODE_REGIME_MISMATCH, MARKET_MODE_COUNTER_NO_EXTREME,
-- MIN_TRADE_SIZE), mas o motor antigo (AND binário) raramente gerava sinal
-- suficiente pra alcançar esses gates. Com o score contínuo (2026-08-17), o
-- funil passa por eles com frequência real e o insert em ai_decisions falha
-- com "violates check constraint" — vetos MARKET_MODE_REGIME_MISMATCH
-- confirmados em produção nos logs de 2026-08-17 14:27-14:32 UTC.
--
-- CONFIG_DIRECTION segue na lista por retrocompatibilidade com decisões já
-- gravadas (não é mais escrito por runTradingCycle.ts desde a mudança de
-- ranking hoje, mas remover quebraria linhas históricas).

ALTER TABLE ai_decisions DROP CONSTRAINT ai_decisions_veto_stage_check;

ALTER TABLE ai_decisions ADD CONSTRAINT ai_decisions_veto_stage_check
  CHECK (veto_stage = ANY (ARRAY[
    'CONTEXT_SCORE_OPPOSITE'::text,
    'CONTEXT_SCORE_LATERAL'::text,
    'CONTEXT_CONFIDENCE'::text,
    'CONTEXT_GATE'::text,
    'CONFIG_DIRECTION'::text,
    'COST_GATE'::text,
    'COST_GATE_NO_DATA'::text,
    'RISK_GATE'::text,
    'KILL_SWITCH'::text,
    'COOLDOWN'::text,
    'MAX_TRADES_PER_DAY'::text,
    'REVENGE_PATTERN'::text,
    'CORRELATION_GUARD'::text,
    'MARKET_MODE_REGIME_MISMATCH'::text,
    'MARKET_MODE_COUNTER_NO_EXTREME'::text,
    'MIN_TRADE_SIZE'::text
  ]));
