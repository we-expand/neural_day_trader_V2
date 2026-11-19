-- Adiciona MACD_MOMENTUM_FADING ao CHECK constraint de ai_decisions.veto_stage.
--
-- Contexto (2026-08-26): MACD era calculado só pra um rótulo cosmético na
-- criação do trade (indicators.macd), nunca influenciava a decisão de
-- entrada. Achado real que motivou o gate novo: SOLUSD LONG entrou
-- 2026-08-26 10:39 UTC com confiança 76% e rótulo "MACD: BULLISH" na
-- entrada, e perdeu por stop loss 59min depois — o cruzamento era real, mas
-- o histograma já estava encolhendo (momentum morrendo), padrão "infantil"
-- que o rótulo binário BULLISH/BEARISH não captura. Gate novo em
-- runTradingCycle.ts exige confiança extra quando o histograma do MACD está
-- encolhendo ou já invertido contra o lado da entrada.

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
    'MIN_TRADE_SIZE'::text,
    'MACD_MOMENTUM_FADING'::text
  ]));
