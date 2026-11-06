-- Persistência de ordens pendentes DEMO (limit/stop) postadas manualmente no
-- gráfico.
--
-- Achado do Cleber (2026-08-26): postou uma ordem limite no gráfico, fechou a
-- aba, voltou e a ordem tinha sumido. Causa: `PendingOrderVisual`
-- (useApexLogic.ts) sempre viveu só em `useState` no componente — ao
-- contrário de `activeOrders`/`ai_trades`, nunca foi persistida no Supabase,
-- então qualquer reload/troca de aba perdia a ordem sem nenhum aviso. Esta
-- tabela dá a ela o mesmo tratamento de fonte-de-verdade que `ai_trades` já
-- tem: criada no insert, atualizada quando o usuário arrasta a linha (novo
-- `trigger_price`) ou cancela (clique direito), e marcada FILLED quando o
-- preço cruza o gatilho (`checkPendingOrderTriggers`, que aí abre a posição
-- de verdade em `ai_trades`).
--
-- Por usuário, não por sessão: diferente de `ai_trades` (que precisa de
-- session_id porque alimenta métricas agregadas de sessão), uma ordem
-- pendente é uma intenção do usuário que deve sobreviver a Iniciar/Parar IA
-- — por isso session_id é opcional, só para referência.

create table if not exists public.ai_pending_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.ai_sessions(id) on delete set null,
  symbol text not null,
  side text not null check (side in ('LONG', 'SHORT')),
  order_type text not null check (order_type in ('LIMIT', 'STOP')),
  volume numeric not null check (volume > 0),
  trigger_price numeric not null check (trigger_price > 0),
  stop_loss numeric,
  take_profit numeric,
  status text not null default 'PENDING' check (status in ('PENDING', 'FILLED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_pending_orders_user_open
  on public.ai_pending_orders(user_id, status)
  where status = 'PENDING';

alter table public.ai_pending_orders enable row level security;

create policy "users can read own pending orders"
  on public.ai_pending_orders for select
  using (auth.uid() = user_id);

create policy "users can insert own pending orders"
  on public.ai_pending_orders for insert
  with check (auth.uid() = user_id);

create policy "users can update own pending orders"
  on public.ai_pending_orders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
