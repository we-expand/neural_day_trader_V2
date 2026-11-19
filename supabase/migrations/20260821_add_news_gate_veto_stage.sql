-- Adiciona 'NEWS_GATE' ao CHECK constraint de ai_decisions.veto_stage.
--
-- Contexto (2026-08-21): o gate de notícias existia mas rodava como blackout
-- global no TOPO do ciclo (nunca chegava a gravar decisão por símbolo) e,
-- pior, no ai-runner (motor de servidor) a lista de eventos era um stub
-- sempre vazio — nunca disparava de verdade em produção. Corrigido nesta
-- mesma sessão: ai-runner agora busca agenda econômica real, e o gate virou
-- por-candidato (moeda do ativo vs. moeda do evento, `runTradingCycle.ts`),
-- gravando 'NEWS_GATE' em ai_decisions como qualquer outro veto — sem este
-- valor no CHECK constraint, o INSERT falharia com "violates check
-- constraint" assim que o primeiro evento de alto impacto real disparasse
-- o gate (mesma classe de bug já documentada em 20260817_add_missing_veto_stages.sql).

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
    'NEWS_GATE'::text
  ]));
