-- Separa os alvos de guardrail da Regra 4 (sazonalidade) da Regra 1 (win
-- rate) no Jarvis. Antes, ambas gravavam decisão em target='position_size' e
-- competiam pelo mesmo cooldown de 4 ciclos (24h) — achado em produção
-- 2026-08-24: uma decisão ACTIVE de win rate às 11:13 UTC bloquearia
-- qualquer ajuste de rollover/almoço-Ásia até o dia seguinte, mesmo que a
-- janela de sazonalidade tivesse motivo próprio pra disparar.
--
-- Ver supabase/functions/jarvis/index.ts (checkSeasonalityWindow) e
-- src/app/services/strategy/jarvisSizeMultiplier.ts (motor real agora
-- compõe o produto de todos os multiplicadores ACTIVE, não só 'position_size').
insert into jarvis_guardrails
  (target, magnitude_cap_pct, cooldown_cycles, requires_approval, rollback_stddev_threshold)
values
  ('position_size_rollover', 70, 0, false, 1.0),
  ('position_size_crypto_lunch', 30, 0, false, 1.0)
on conflict (target) do nothing;
