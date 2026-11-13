-- Agente de risco interno do LLM Brain (pedido do Cleber, 2026-09-02 noite):
-- nova capacidade de aumentar posição vencedora (pyramiding) com stop
-- trilhado para breakeven+ a cada add, pra "ganhar muito quando ganha,
-- perder pouco quando perde". Precisa de um contador persistente por trade
-- pra limitar quantos adds uma mesma posição pode receber (ver
-- MAX_PYRAMID_ADDS em tools.ts) -- sem isso não dá pra saber, só olhando a
-- linha, se ela já foi ampliada antes.
alter table public.ai_trades
  add column if not exists pyramid_adds_count integer not null default 0;

comment on column public.ai_trades.pyramid_adds_count is
  'Quantas vezes esta posição foi ampliada via increase_position (pyramiding) pelo LLM Active Brain. Limitado por MAX_PYRAMID_ADDS em llm-active-brain/src/tools.ts.';
