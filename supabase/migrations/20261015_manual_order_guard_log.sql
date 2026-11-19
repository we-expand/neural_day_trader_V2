-- 2026-10-15: registro do guarda-costas da ordem manual (src/app/services/risk/manualOrderGuard.ts).
-- Cada clique em Comprar/Vender na boleta grava o que o guarda achou (alertas/bloqueio) e o que o
-- usuário decidiu (enviou, cancelou ou foi bloqueado). Serve para medir se as entradas manuais têm
-- vantagem e se furar o próprio método custa dinheiro (ideias 1 e 5 da sessão de 15/10).
create table if not exists manual_order_guard_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  symbol text not null,
  side text not null check (side in ('LONG', 'SHORT')),
  order_type text not null,
  execution_mode text not null,
  entry_price numeric not null,
  stop_loss numeric,
  take_profit numeric,
  volume numeric not null,
  findings jsonb not null default '[]'::jsonb,
  decision text not null check (decision in ('BLOQUEADA', 'CANCELADA', 'ENVIADA_COM_ALERTA', 'ENVIADA_LIMPA'))
);

create index if not exists manual_order_guard_log_user_created_idx on manual_order_guard_log (user_id, created_at desc);

alter table manual_order_guard_log enable row level security;

create policy "usuario grava o proprio registro do guarda"
  on manual_order_guard_log for insert to authenticated
  with check (auth.uid() = user_id);

create policy "usuario le o proprio registro do guarda"
  on manual_order_guard_log for select to authenticated
  using (auth.uid() = user_id);
