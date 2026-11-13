-- 2026-09-04: distância original do stop-loss (preço absoluto), gravada uma
-- única vez na abertura do trade. Necessária porque `stop_loss` é sobrescrito
-- pelo breakeven/trailing (enforceMt5StopsAndTargets, neuralBridge.ts) --
-- sem essa referência estável, não dá pra saber quantos "R" o preço já
-- percorreu depois do primeiro ciclo de breakeven. Usada pelo trailing em
-- estágio (mt5TrailWidenTriggerR) e pela realização parcial de lucro
-- (mt5PartialTpTriggerR), ambos em config.ts/neuralBridge.ts.
ALTER TABLE ai_trades
  ADD COLUMN IF NOT EXISTS original_stop_distance numeric;

COMMENT ON COLUMN ai_trades.original_stop_distance IS
  'Distância (preço absoluto) entre entry_price e o stop_loss original na abertura -- referência estável de "1R", já que stop_loss muda com breakeven/trailing. Null em trades antigos, de antes deste fix.';
