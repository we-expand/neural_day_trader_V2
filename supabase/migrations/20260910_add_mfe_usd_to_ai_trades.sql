-- 2026-09-10: rastreamento de MFE (Maximum Favorable Excursion) por trade.
-- Pedido do Cleber: medir se a LLM esta lendo a direcao certa na ENTRADA,
-- independente do resultado final -- antes so dava pra saber isso vasculhando
-- log de texto manualmente (impreciso, nao escalavel). Atualizado a cada 3s
-- pelo stop-watchdog (enforceMt5StopsAndTargets, llm-active-brain/src/neuralBridge.ts).
-- null/0 = trade nunca teve PnL flutuante positivo registrado.
alter table ai_trades add column if not exists mfe_usd numeric;

comment on column ai_trades.mfe_usd is
  'Maior lucro flutuante (USD) ja atingido pelo trade, atualizado a cada 3s pelo stop-watchdog. null = nunca ficou positivo.';
