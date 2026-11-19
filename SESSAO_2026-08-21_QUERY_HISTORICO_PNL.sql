-- Histórico retroativo de ganhos/perdas ($) de cada operação fechada.
-- Rodar no SQL Editor do Supabase (projeto "Neural DayTrader").
-- net_pnl = PnL líquido de comissão (o que o produto mostra no app); cai
-- pra pnl bruto se net_pnl ainda não foi preenchido em trades mais antigos.

-- 1) Lista todo trade fechado, mais recente primeiro, com o resultado em $.
select
  exit_time,
  symbol,
  side,
  entry_price,
  exit_price,
  exit_reason,
  coalesce(net_pnl, pnl, 0) as resultado_usd,
  case when coalesce(net_pnl, pnl, 0) >= 0 then 'GANHO' else 'PERDA' end as tipo
from ai_trades
where status = 'CLOSED'
order by exit_time desc
limit 200;

-- 2) Resumo por dia: total ganho, total perdido, líquido do dia, nº de trades.
select
  date_trunc('day', exit_time) as dia,
  count(*) as trades,
  sum(case when coalesce(net_pnl, pnl, 0) >= 0 then coalesce(net_pnl, pnl, 0) else 0 end) as total_ganho_usd,
  sum(case when coalesce(net_pnl, pnl, 0) < 0 then coalesce(net_pnl, pnl, 0) else 0 end) as total_perda_usd,
  sum(coalesce(net_pnl, pnl, 0)) as liquido_usd
from ai_trades
where status = 'CLOSED'
group by 1
order by 1 desc;

-- 3) Resumo por sessão de IA (útil pra comparar sessões distintas).
select
  session_id,
  min(exit_time) as primeiro_fechamento,
  max(exit_time) as ultimo_fechamento,
  count(*) as trades,
  sum(coalesce(net_pnl, pnl, 0)) as liquido_usd
from ai_trades
where status = 'CLOSED'
group by session_id
order by ultimo_fechamento desc;

-- 4) Só de um usuário específico (troque o UUID abaixo pelo user_id real).
-- select * from ai_trades
-- where status = 'CLOSED' and user_id = '00000000-0000-0000-0000-000000000000'
-- order by exit_time desc;
