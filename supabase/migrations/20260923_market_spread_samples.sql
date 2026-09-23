-- Spread REAL do mercado, medido continuamente (fonte única de custo do projeto).
-- Coletor: llm-active-brain/src/spreadCollector.ts (a cada 5 min, bid/ask reais).
-- Consumo: research/MeasuredSpreads.ts -> ExecutionCost.ts (cliente) e commissionModel.ts (servidor).
create table if not exists public.market_spread_samples (
  id bigserial primary key,
  symbol text not null,
  ts timestamptz not null default now(),
  bid numeric,
  ask numeric,
  spread_pct numeric not null check (spread_pct >= 0),
  -- 'broker_tick' = bid/ask do próprio símbolo; 'proxy:BTCEUR' = medido em outro
  -- símbolo da mesma corretora (BTCUSD é roteado pra Binance e esconde o spread real).
  source text not null default 'broker_tick'
);
create index if not exists market_spread_samples_symbol_ts on public.market_spread_samples (symbol, ts desc);

alter table public.market_spread_samples enable row level security;
drop policy if exists "market_spread_samples_read" on public.market_spread_samples;
create policy "market_spread_samples_read" on public.market_spread_samples
  for select to anon, authenticated using (true);
-- escrita só via service_role (coletor); sem policy de insert de propósito.

-- Janela de 7 dias: o que o custo do projeto usa (mediana, robusta a picos de abertura/fechamento).
create or replace view public.market_spread_current with (security_invoker = true) as
select symbol,
       count(*)::int as n,
       percentile_cont(0.5) within group (order by spread_pct) as median_pct,
       percentile_cont(0.9) within group (order by spread_pct) as p90_pct,
       min(spread_pct) as min_pct,
       max(spread_pct) as max_pct,
       max(ts) as last_ts,
       max(source) as source
from public.market_spread_samples
where ts > now() - interval '7 days'
group by symbol;

-- Série diária por símbolo: "quanto o mercado pratica todo dia".
create or replace view public.market_spread_daily with (security_invoker = true) as
select symbol,
       date_trunc('day', ts) as day,
       count(*)::int as n,
       percentile_cont(0.5) within group (order by spread_pct) as median_pct,
       percentile_cont(0.9) within group (order by spread_pct) as p90_pct,
       max(spread_pct) as max_pct
from public.market_spread_samples
group by symbol, date_trunc('day', ts);
