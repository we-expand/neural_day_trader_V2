-- Pausa as 3 sessões RUNNING/DEMO encontradas em 2026-08-07 durante o teste
-- inicial do ai-runner. Nenhuma tinha atividade de usuário real nas últimas
-- ~48h (ver SESSAO/handoff do dia) — limpeza de estado acumulado ANTES do
-- runner existir, não uma ação do runner em si. Depois disso, toda sessão
-- RUNNING passa a ser presumidamente intencional (o cron 24/7 estará
-- mantendo ela viva de verdade, não just orfã no banco).
--
--   9596ab06-50f1-4747-9077-3a2b87e27118 — criada 2026-07-06, sem
--   activeStrategyId configurado, 6 trades em 2min no dia da criação e nada
--   desde então. Órfã clara.
--
--   fd3ad992-62c4-4cfa-a10c-39f1d0fdcd88 — criada 2026-08-04, ZERO trades
--   desde então. Bate com o "4h40 de IA ligada, zero entradas" que abriu o
--   redesenho do cérebro (CLAUDE.md, seção "COMECE AQUI").
--
--   f6785c05-eac4-49d6-990a-1a5de9ec8d30 — criada 2026-08-04, 1 trade em
--   2026-08-05, nada desde então até os testes de hoje.

update ai_sessions
set status = 'PAUSED'
where id in (
  '9596ab06-50f1-4747-9077-3a2b87e27118',
  'fd3ad992-62c4-4cfa-a10c-39f1d0fdcd88',
  'f6785c05-eac4-49d6-990a-1a5de9ec8d30'
)
and status = 'RUNNING';

-- Confirma (deve voltar 0 linhas RUNNING/DEMO depois do update acima):
-- select id, status, mode from ai_sessions where mode = 'DEMO' and status = 'RUNNING';
