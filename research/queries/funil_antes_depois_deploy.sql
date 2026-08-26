-- ═══════════════════════════════════════════════════════════════════════
-- Funil de decisão — antes vs. depois do redeploy do ai-runner
-- Criado 2026-08-26. Contexto: os commits 9bd02bfd5 (tiering) e 57c81f478
-- (Kelly) estavam no git mas não no servidor; produção rodava ainda o
-- 63f4a949f (MIN_CONFIDENCE=60, gate LATERAL exigindo 85%). 9h de mercado
-- asiático sem nenhuma entrada, 1.452 vetos em CONTEXT_SCORE_LATERAL.
--
-- AJUSTE AQUI o horário real do deploy (UTC) antes de rodar:
--   deploy_ts abaixo. Default = 2026-08-26 09:45 UTC.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. SANITY: o código novo está mesmo no ar? ─────────────────────────
-- O código antigo escrevia "< 60%" e "exige 85%". O novo escreve "< 55%"
-- e "80%", e passa a emitir tierLabel 'Tier2'. Se depois do deploy ainda
-- aparecer só 60/85, o deploy não pegou.
-- Também mostra se há decisão recente: linha vazia = cron parado, não
-- mercado parado.
select
  date_trunc('minute', created_at) as minuto,
  veto_stage,
  reasoning
from ai_decisions
where created_at > timestamptz '2026-08-26 09:45+00'
order by created_at desc
limit 20;


-- ── 2. FUNIL COMPARADO, normalizado por hora ───────────────────────────
-- As duas janelas têm durações diferentes, então comparar contagem crua
-- engana. Aqui é vetos/hora em cada período.
with p as (
  select timestamptz '2026-08-26 09:45+00' as deploy_ts
),
janelas as (
  select
    case when d.created_at < p.deploy_ts then 'antes' else 'depois' end as periodo,
    d.veto_stage,
    d.created_at
  from ai_decisions d, p
  where d.created_at > p.deploy_ts - interval '9 hours'
),
duracao as (
  select periodo,
         extract(epoch from (max(created_at) - min(created_at))) / 3600.0 as horas
  from janelas group by 1
)
select
  j.periodo,
  j.veto_stage,
  count(*) as n,
  round((count(*) / nullif(d.horas, 0))::numeric, 1) as por_hora
from janelas j
join duracao d using (periodo)
group by j.periodo, j.veto_stage, d.horas
order by j.veto_stage, j.periodo desc;


-- ── 3. ENTRADAS EXECUTADAS depois do deploy ────────────────────────────
-- É a única métrica que responde a pergunta original. veto_stage nulo +
-- action_taken = decisão que virou trade.
select
  created_at, symbol, decision, confidence, market_score, reasoning
from ai_decisions
where created_at > timestamptz '2026-08-26 09:45+00'
  and action_taken is true
order by created_at desc;


-- ── 4. "80% ainda é alto demais?" ──────────────────────────────────────
-- Distribuição da confiança dos setups mortos no gate LATERAL depois do
-- deploy. Se a massa está em 70-79, o limiar ainda é o gargalo e dá pra
-- argumentar por baixar a penalidade de 25 → 20. Se a massa está em
-- 50-65, o problema não é o limiar: é a qualidade do sinal, e afrouxar
-- só compraria trade ruim.
select
  (regexp_match(reasoning, 'confiança (\d+)%'))[1]::int as confianca,
  count(*) as n
from ai_decisions
where created_at > timestamptz '2026-08-26 09:45+00'
  and veto_stage = 'CONTEXT_SCORE_LATERAL'
  and reasoning ~ 'confiança \d+%'
group by 1
order by 1 desc;


-- ── 5. Quanto o gate LATERAL custaria afrouxar ─────────────────────────
-- Quantos setups passariam se a penalidade caísse de 25 para 20 ou 15
-- (limiar 80 → 75 → 70), considerando MIN_CONFIDENCE = 55.
select
  count(*) filter (where c >= 80) as passariam_hoje_80,
  count(*) filter (where c >= 75) as passariam_com_75,
  count(*) filter (where c >= 70) as passariam_com_70,
  count(*) as total_vetados
from (
  select (regexp_match(reasoning, 'confiança (\d+)%'))[1]::int as c
  from ai_decisions
  where created_at > timestamptz '2026-08-26 09:45+00'
    and veto_stage = 'CONTEXT_SCORE_LATERAL'
    and reasoning ~ 'confiança \d+%'
) t;
