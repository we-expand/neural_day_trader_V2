-- Decisões da MESA DE OPERAÇÕES do LLM Brain (llm-active-brain/src/desk.ts) + desfecho medido.
--
-- Uma linha por deliberação (aprovada OU rejeitada), com o debate inteiro dos 14 agentes.
-- É a base do aprendizado contínuo: sem "o que a mesa decidiu" + "o que o preço fez depois"
-- não existe como saber se ela está acertando.
--
-- Gravação: o motor (service_role). Desfecho: job do motor (deskOutcomes.ts), a cada 5 min,
-- mede com velas de 1m se o ALVO ou o STOP da proposta teria sido atingido primeiro.
-- Vale para as aprovadas E para as rejeitadas (contrafactual): é o que mostra se uma
-- rejeição evitou uma perda ou deixou passar um ganho.
--
-- Rodar no SQL Editor (nunca aplicado automaticamente). Reexecutável (if not exists).

create table if not exists public.desk_decisions (
  id uuid primary key,                                   -- gerado pelo motor; liga a linha ao trade
  created_at timestamptz not null default now(),
  session_id uuid,
  user_id uuid,
  symbol text not null,
  side text not null check (side in ('LONG', 'SHORT')),
  setup_type text,
  mode text not null check (mode in ('shadow', 'enforce')),
  llm_only boolean not null default false,               -- true = teste só-LLM (travas mecânicas de julgamento desligadas)
  bypassed_gates text[] not null default '{}',           -- travas antigas que teriam barrado esta entrada

  -- decisão final do Agente Master
  decision text not null check (decision in ('APPROVE', 'REJECT')),
  size_factor numeric not null default 1,
  conviction numeric,
  reason text,
  error text,                                            -- preenchido quando a mesa não conseguiu deliberar
  failed_agents text[] not null default '{}',
  duration_ms integer,
  llm_calls integer,
  model text,

  -- a proposta julgada (preço, stop e alvo no instante da decisão)
  entry_price numeric not null,
  stop_price numeric not null,
  target_price numeric not null,
  stop_pct numeric not null,
  take_profit_pct numeric not null,
  amount_usd numeric,
  risk_usd numeric,

  -- debate completo, agente por agente: [{agent, ok, ms, error, json}]
  transcript jsonb not null default '[]'::jsonb,
  -- postura de cada agente já extraída: {"Trader Sênior": true, "Gestor de Risco": false, ...}
  -- true = apoiou a proposta, false = foi contra, ausente = sem posição
  stances jsonb not null default '{}'::jsonb,

  -- trade que realmente foi aberto a partir desta decisão (só aprovadas)
  trade_id uuid,

  -- desfecho medido depois (contrafactual com velas de 1m, ver deskOutcomes.ts)
  outcome_status text not null default 'PENDING'
    check (outcome_status in ('PENDING', 'TARGET', 'STOP', 'EXPIRED', 'NO_DATA')),
  outcome_resolved_at timestamptz,
  outcome_minutes numeric,                               -- minutos até o alvo/stop
  outcome_max_favorable_pct numeric,                     -- maior movimento A FAVOR do lado proposto (% do preço)
  outcome_max_adverse_pct numeric,                       -- maior movimento CONTRA (% do preço)
  outcome_note text
);

create index if not exists desk_decisions_created_at on public.desk_decisions (created_at desc);
create index if not exists desk_decisions_pending on public.desk_decisions (created_at) where outcome_status = 'PENDING';
create index if not exists desk_decisions_symbol_side on public.desk_decisions (symbol, side, created_at desc);

-- RLS ligado e SEM policy de propósito: só o motor (service_role) lê e escreve.
-- O debate completo não precisa ir pro navegador.
alter table public.desk_decisions enable row level security;

-- ---------------------------------------------------------------------------
-- Visão de desempenho por agente (o relatório diário usa a mesma conta).
-- Um agente "acerta" quando: apoiou a proposta e o alvo veio primeiro, OU foi contra e o stop veio primeiro.
-- EXPIRED/NO_DATA/PENDING não entram (nada foi decidido pelo preço).
-- ---------------------------------------------------------------------------
create or replace view public.desk_agent_scorecard with (security_invoker = true) as
select
  s.agent,
  count(*)::int as n,
  count(*) filter (where (s.supports and d.outcome_status = 'TARGET') or (not s.supports and d.outcome_status = 'STOP'))::int as acertos,
  round(100.0 * count(*) filter (where (s.supports and d.outcome_status = 'TARGET') or (not s.supports and d.outcome_status = 'STOP')) / nullif(count(*), 0), 1) as acerto_pct,
  count(*) filter (where s.supports)::int as vezes_apoiou,
  count(*) filter (where s.supports and d.outcome_status = 'STOP')::int as apoiou_e_perdeu,
  count(*) filter (where not s.supports and d.outcome_status = 'TARGET')::int as vetou_e_perdeu_ganho
from public.desk_decisions d
cross join lateral (
  select key as agent, (value)::boolean as supports
  from jsonb_each_text(d.stances)
  where value in ('true', 'false')
) s
where d.outcome_status in ('TARGET', 'STOP')
group by s.agent;

-- ---------------------------------------------------------------------------
-- RETENÇÃO (opcional, NÃO roda sozinha). Rodar à mão quando quiser limpar:
--   delete from public.desk_decisions where created_at < now() - interval '90 days';
-- O transcript é o que pesa (~10-20 KB por linha); o resto da linha é pequeno.
-- Para guardar as decisões mas soltar o texto dos debates antigos:
--   update public.desk_decisions set transcript = '[]'::jsonb
--     where created_at < now() - interval '30 days' and transcript <> '[]'::jsonb;
-- ---------------------------------------------------------------------------
