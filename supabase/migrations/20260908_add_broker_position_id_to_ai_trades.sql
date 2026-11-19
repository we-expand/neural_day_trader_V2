-- 2026-09-08: trilho de execução REAL do LLM Brain (llm-active-brain) na
-- Infinox via MetaAPI. Precisa guardar o id da posição REAL na corretora
-- (retornado por /broker/execute) pra conseguir fechar/reconciliar depois --
-- até aqui todo trade era simulado, sem nenhum id de corretora pra guardar.
-- Nullable e sem default: trade simulado (DEMO) continua null pra sempre,
-- só populado quando MT5_LIVE_EXECUTION_ENABLED=true de fato enviar ordem
-- real. Nunca fabricado -- vem direto da resposta da MetaAPI.
alter table public.ai_trades
  add column if not exists broker_position_id text;

comment on column public.ai_trades.broker_position_id is
  'ID real da posição na MetaAPI (corretora), só preenchido quando o trade foi executado de verdade (LIVE), nunca em trade simulado (DEMO).';
