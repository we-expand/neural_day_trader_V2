-- Habilita Supabase Realtime (postgres_changes) para ai_trades.
--
-- Contexto: o client reconciliava posições abertas com um polling de 15s
-- (src/app/hooks/useApexLogic.ts) e ficava sujeito a atraso adicional quando
-- `isActive` estava false na aba. Trocado por subscription em tempo real,
-- com o polling mantido como fallback. RLS existente ("Users manage own
-- ai_trades", auth.uid() = user_id) já garante que o Realtime só entrega
-- eventos das próprias linhas do usuário — nenhuma policy nova necessária.
ALTER PUBLICATION supabase_realtime ADD TABLE ai_trades;
