-- Telemetria da guarda de desvio máximo de preço / TTL do cache de último
-- preço real, adicionada em RealMarketDataService.ts (ver
-- SESSAO_2026-08-21_GUARDA_DESVIO_PRECO.md). Os limiares (8%/20% de desvio,
-- 10min de referência, 5min de TTL) são estimativa de prática de mercado,
-- não calibrados contra dado histórico do produto (só havia 1 caso pra
-- calibrar). Esta tabela acumula amostra real de produção pra permitir essa
-- calibração mais tarde — sem ela, ajustar os limiares seria chute sobre
-- chute.

create table if not exists public.price_guard_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('suspicious_deviation', 'stale_fallback')),
  symbol text not null,
  category text,
  candidate_price numeric,
  reference_price numeric,
  deviation_pct numeric,
  threshold_pct numeric,
  source text,
  stale_ms bigint
);

comment on table public.price_guard_events is
  'Amostra de rejeições/degradações da guarda de preço em RealMarketDataService.ts, pra calibrar os limiares (hoje estimativa de mercado, não medição) contra dado real de produção.';

alter table public.price_guard_events enable row level security;

-- Só a service role grava/lê (nenhum client autenticado do usuário final
-- precisa acessar esta tabela — é telemetria interna de engenharia).
create policy "service_role_all_price_guard_events"
  on public.price_guard_events
  for all
  to service_role
  using (true)
  with check (true);
