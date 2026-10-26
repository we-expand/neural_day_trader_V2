-- Colunas de agrupamento de Pyramiding em ai_trades.
--
-- Motivação (2026-08-19): o Pyramiding System (useApexLogic.ts) rastreia
-- pyramidGroupId/pyramidLayer só em memória no navegador (TradeVisual) —
-- nunca persistiu no banco. Isso torna impossível o ai-runner (servidor,
-- autoridade única de fechamento em DEMO desde 2026-08-18) saber quais
-- trades pertencem ao mesmo grupo de pyramiding, o que bloqueia qualquer
-- feature que precise fechar (mesmo parcialmente) um grupo inteiro no
-- servidor — Take Profit Parcial e "fechar tudo em reversão" dependem
-- disto. Sem essas colunas, a única forma de implementar essas features
-- seria o CLIENTE decidir o fechamento sozinho — exatamente o padrão que
-- corrompeu saldo em produção antes do fix de 2026-08-18 (client_authority).
--
-- pyramid_group_id = id (em ai_trades) do trade RAIZ do grupo (layer 1).
-- Para o próprio layer 1, pyramid_group_id é NULL (é a raiz, não aponta pra
-- si mesmo) — mesma convenção já usada em memória no client
-- (order.pyramidGroupId ausente = raiz).
-- pyramid_layer = número do layer dentro do grupo (1 = raiz, 2, 3, ...).

ALTER TABLE ai_trades
  ADD COLUMN IF NOT EXISTS pyramid_group_id uuid REFERENCES ai_trades(id),
  ADD COLUMN IF NOT EXISTS pyramid_layer integer;

CREATE INDEX IF NOT EXISTS idx_ai_trades_pyramid_group_id
  ON ai_trades (pyramid_group_id)
  WHERE pyramid_group_id IS NOT NULL;
