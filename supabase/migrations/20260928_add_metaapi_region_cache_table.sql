-- 2026-09-28: cache de região MetaAPI compartilhado de verdade entre instâncias
-- da Edge Function -- mesmo problema estrutural já corrigido pro semáforo de
-- dado histórico em 20260914_add_metaapi_historical_slot_semaphore.sql.
--
-- `metaApiRegionCache` (supabase/functions/server/index.ts) era uma `Map` em
-- memória, TTL 60s -- só válida DENTRO de uma instância/isolate da Edge
-- Function. Sob carga real (múltiplas instâncias escalando em paralelo, cada
-- uma com seu próprio cache vazio), cada isolate novo refazia a consulta à
-- API de provisionamento da MetaAPI -- confirmado ao vivo em produção,
-- 2026-09-28: 40+ chamadas idênticas em <2s (`[METAAPI] 🌍 Regiões da
-- conta...`), sobrecarregando ainda mais a conta MetaAPI compartilhada e
-- contribuindo pros 502/504 em /mt5-candles-history.
--
-- Fix: tabela real no Postgres, 1 linha por conta, upsert com TTL -- agora
-- compartilhada de verdade entre todas as instâncias da Edge Function.
create table if not exists metaapi_region_cache (
  account_id text primary key,
  candidates jsonb not null,
  expires_at timestamptz not null
);

alter table metaapi_region_cache enable row level security;
-- Sem policy nenhuma: só o service_role (usado pela Edge Function) acessa,
-- que ignora RLS por desenho do Supabase.
