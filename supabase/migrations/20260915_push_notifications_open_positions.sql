-- Push notification (celular) quando uma posição REAL é aberta pela IA.
-- Pedido do Cleber 2026-09-15: avisar no iPhone dele + tela de posições
-- abertas instalável como app (PWA). Ver CLAUDE.md/handoff da sessão.

-- 1) Onde ficam as inscrições push (1 endpoint por dispositivo/navegador)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "usuario gerencia as proprias inscricoes push" on push_subscriptions;
create policy "usuario gerencia as proprias inscricoes push"
  on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Trigger: toda vez que uma posição REAL (is_live_execution=true) é
-- aberta (status OPEN), chama a Edge Function push-notify via pg_net —
-- fire-and-forget, nunca bloqueia o INSERT do trade em si.
create extension if not exists pg_net;

-- ✅ 2026-09-15: valores fixos na função em vez de `current_setting`/
-- `ALTER DATABASE ... SET` — o SQL Editor do Supabase gerenciado roda com
-- uma role sem permissão pra `ALTER DATABASE` (ERRO 42501, confirmado ao
-- vivo pelo Cleber). A function já é SECURITY DEFINER (mesmo nível de
-- confiança de quem teria acesso ao GUC), então embutir aqui é equivalente
-- em segurança e evita depender de um privilégio que este projeto não tem.
create or replace function notify_position_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_function_url text := 'https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/push-notify';
  service_role_key text := 'SERVICE_ROLE_KEY_AQUI'; -- troque pela key real antes de rodar
begin
  if new.status = 'OPEN' and new.is_live_execution = true then
    perform net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('type', 'INSERT', 'table', 'ai_trades', 'record', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_position_opened on ai_trades;
create trigger trg_notify_position_opened
  after insert on ai_trades
  for each row
  execute function notify_position_opened();

-- 3) Antes de rodar este arquivo no SQL Editor, troque 'SERVICE_ROLE_KEY_AQUI'
-- (dentro de notify_position_opened, acima) pela SERVICE_ROLE_KEY real do
-- projeto (Project Settings → API). Sem isso, o `Authorization` do POST
-- vai com bearer inválido e a Edge Function recusa a chamada.
