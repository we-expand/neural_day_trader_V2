-- Limpa o histórico de trades/sessões DEMO de teste da conta clbrcouto@gmail.com
-- Motivo: >=10 trades perdedores de sessões antigas travavam o gate de win
-- rate (minWinRate) em Safe Mode permanente, mesmo depois do fix que passou
-- o gate a olhar só a sessão/dia atual (useApexLogic.ts) — sem isso, o
-- histórico velho ainda pesa até virar o dia UTC.
-- Rodar no SQL Editor do projeto "Neural DayTrader" (wyvdsxtcmizettljxtbg).

begin;

with alvo as (
  select id from auth.users where email = 'clbrcouto@gmail.com'
)
delete from public.ai_trades
where user_id in (select id from alvo);

with alvo as (
  select id from auth.users where email = 'clbrcouto@gmail.com'
)
delete from public.ai_portfolio_snapshots
where user_id in (select id from alvo);

with alvo as (
  select id from auth.users where email = 'clbrcouto@gmail.com'
)
delete from public.ai_decisions
where user_id in (select id from alvo);

with alvo as (
  select id from auth.users where email = 'clbrcouto@gmail.com'
)
delete from public.ai_sessions
where user_id in (select id from alvo);

commit;

-- Conferir que zerou:
-- select count(*) from public.ai_trades t join auth.users u on u.id = t.user_id where u.email = 'clbrcouto@gmail.com';
