-- Rastreio de TP parcial já disparado em ai_trades.
--
-- Motivação (2026-08-28): TP parcial genérico (50% em +1R, fora do escopo
-- de pyramiding) implementado no `ai-runner` para reduzir o efeito
-- "devolveu quase todo o lucro flutuante antes de fechar" (achado real do
-- Cleber, ver research/experiments/2026-08-28-partial-tp-1r/verdict.md).
--
-- O estado do runner (RunnerSessionState) vive só em memória e reseta a
-- cada nova invocação do cron (~1x/min) — sem uma marca persistida, o
-- mesmo trade poderia ter o parcial disparado de novo em cada invocação
-- enquanto o preço seguir acima do gatilho de 1R, fechando frações da
-- posição repetidamente. `partial_tp_taken` é a fonte de verdade
-- persistida, recarregada em `loadSession` — mesma disciplina de nunca
-- confiar em estado efêmero pra decisão financeira que já rege
-- cooldown/kill-switch/max-trades neste projeto.

ALTER TABLE ai_trades
  ADD COLUMN IF NOT EXISTS partial_tp_taken boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ai_trades.partial_tp_taken IS
  'true = esta posição já teve uma fração fechada pelo mecanismo de TP parcial em +1R (positionManager.ts). Idempotência entre invocações do ai-runner.';
