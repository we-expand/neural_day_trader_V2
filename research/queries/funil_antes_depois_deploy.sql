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


-- ═══════════════════════════════════════════════════════════════════════
-- ADENDO 2026-08-26 — o gargalo real é ANTES dos gates de confiança
--
-- Achado: o ciclo morre no RANKING, não nos limiares que calibramos hoje.
-- O piso exigido (aiConfig.signalScoreFloor) é 60 e o melhor score da
-- cesta de 14 é quase sempre 50 (às vezes 55) — em TODAS as horas
-- medidas, inclusive antes do redeploy. Blocos 1-5 acima olham só o que
-- acontece DEPOIS do ranking; os de baixo olham o próprio ranking.
--
-- ⚠️ ATENÇÃO ao piso: 60 NÃO está no código. Está gravado no `config`
-- da sessão em ai_sessions (jsonb). Redeploy não o altera; commit de
-- calibração não o altera. Mudá-lo é UPDATE no banco, não deploy.
--
-- ⚠️ LIMITE DOS BLOCOS 6-7: `samples` guarda 1-2 exemplos por janela de
-- 1min, não toda avaliação. Então a distribuição abaixo é 1 observação
-- por janela, não por tick — serve pra ver a ORDEM DE GRANDEZA do score
-- típico, não pra estatística fina. O peso real de cada estágio vem de
-- `stage_counts` (bloco 7), esse sim contado tick a tick.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 6. Distribuição do "melhor score da cesta", por hora ───────────────
-- A pergunta: o score chega perto de 60 alguma hora do dia? Se o típico
-- é 50 e o máximo observado é 55, o piso de 60 é inatingível na prática
-- e o problema não é o valor do piso — é a escala de pontuação, que não
-- produz valores nessa faixa. Se o score encosta em 58-59 nos horários
-- líquidos, aí sim o piso é que está mal calibrado.
select
  date_trunc('hour', created_at) as hora,
  (regexp_match(samples->'NO_SIGNAL'->>0, 'melhor score (\d+)'))[1]::int as melhor_score,
  count(*) as janelas
from ai_funnel_snapshots
where created_at > now() - interval '24 hours'
  and samples ? 'NO_SIGNAL'
group by 1, 2
order by 1 desc, 2 desc;


-- ── 6b. Resumo: score típico, máximo e distância até o piso ───────────
select
  min(s) as score_min,
  round(avg(s)::numeric, 1) as score_medio,
  max(s) as score_max,
  60 - max(s) as pontos_faltando_no_melhor_caso,
  count(*) as janelas
from (
  select (regexp_match(samples->'NO_SIGNAL'->>0, 'melhor score (\d+)'))[1]::int as s
  from ai_funnel_snapshots
  where created_at > now() - interval '24 hours' and samples ? 'NO_SIGNAL'
) t;


-- ── 7. Onde o funil realmente morre — peso por tick, não por janela ────
-- stage_counts é contado tick a tick, então este é o número honesto.
-- Se NO_SIGNAL domina, todo ajuste de MIN_CONFIDENCE / penalidade
-- LATERAL é discussão sobre um portão que a maioria dos ticks nunca
-- alcança, e mexer neles não muda a taxa de entrada.
with expandido as (
  select
    date_trunc('hour', created_at) as hora,
    key as stage,
    (value::text)::int as ticks
  from ai_funnel_snapshots, jsonb_each(stage_counts)
  where created_at > now() - interval '24 hours'
)
select
  stage,
  sum(ticks) as ticks,
  round(100.0 * sum(ticks) / sum(sum(ticks)) over (), 1) as pct
from expandido
group by stage
order by ticks desc;


-- ── 8. O piso está no banco: ver e (se decidido) alterar ───────────────
-- Leitura — confere o piso da sessão ativa:
select id, status,
       config->>'signalScoreFloor' as piso,
       config->>'riskProfile' as perfil,
       config->>'timeframe' as tf
from ai_sessions
where status = 'RUNNING';

-- Alteração — NÃO RODAR sem decisão do Cleber apoiada nos blocos 6/7.
-- Baixar o piso por inferência é exatamente o erro que custou a manhã
-- de 2026-08-26. Só rode com o dado dos blocos acima na mão.
--
-- update ai_sessions
--    set config = jsonb_set(config, '{signalScoreFloor}', '55'::jsonb)
--  where status = 'RUNNING';
