-- 🔴 2026-09-11 (pedido direto do Cleber, sessão de monitoramento LIVE real):
-- "no banco tem que diferenciar o que é ordem demo de ordem de verdade" --
-- até aqui essa distinção só existia de forma IMPLÍCITA (broker_position_id
-- IS NOT NULL = real, IS NULL = simulado), nunca como um campo explícito.
-- Column nova, boolean, default false (nunca assume real sem confirmação).
-- Backfill: qualquer linha já existente com broker_position_id preenchido
-- é, por definição, uma ordem que foi de fato enviada pra corretora -- true
-- pra essas, false pro resto (inclusive toda a história DEMO/simulada).
alter table ai_trades
  add column if not exists is_live_execution boolean not null default false;

update ai_trades
  set is_live_execution = true
  where broker_position_id is not null
    and is_live_execution is distinct from true;

comment on column ai_trades.is_live_execution is
  'true = ordem enviada de verdade pra corretora (Infinox/MetaAPI), false = simulado/DEMO. Setado explicitamente em neuralBridge.ts/openMt5Position, nunca inferido.';
