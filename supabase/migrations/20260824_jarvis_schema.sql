-- Jarvis: Sistema de Evolução Contínua (segundo cérebro do motor)
--
-- Migration formal gerada a partir de research/jarvis-schema.sql (desenhado
-- em 2026-08-23, ver SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md
-- seção 6-7). Conteúdo idêntico ao arquivo de pesquisa, só adaptado pro
-- dialeto real de migration do projeto (sem `index (...)` inline, que não é
-- sintaxe válida de Postgres — vira `create index` separado).
--
-- 6 tabelas: jarvis_decisions, jarvis_experiments, jarvis_knowledge,
-- jarvis_alerts, jarvis_health_snapshots, jarvis_guardrails.
--
-- MODO DE OPERAÇÃO: Jarvis AUTOAPLICA dentro de limites (decisão 2026-08-23,
-- diferente da regra "nunca commit/push sozinho" que vale só pra código).
-- Os limites vivem em jarvis_guardrails (dado, não código) — trocar um teto
-- é um UPDATE auditável, não um deploy de Edge Function.

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 1: Decisões & Recomendações
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.jarvis_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  decision_type text not null, -- 'GATE_TOGGLE', 'SIZE_ADJUST', 'RECALIBRATE', 'TEST_SIGNAL', 'ROLLBACK'
  target text not null,        -- 'NEWS_GATE', 'CONFIDENCE_GATE', 'position_size', etc
  action text not null,        -- 'enable', 'disable', '+10%', '-5%', 'run_test', 'revert'

  evidence jsonb not null,
  confidence_level numeric,

  requires_approval boolean not null default false,
  magnitude_pct numeric,
  magnitude_cap_pct numeric,
  cooldown_until timestamptz,

  -- PENDING | ACTIVE | COMPLETED | ROLLED_BACK | REJECTED
  status text not null default 'PENDING',
  approved_by text,
  approved_at timestamptz,

  effect_on_pnl numeric,
  baseline_pnl_stddev numeric,
  days_running int,
  reverted_at timestamptz,
  revert_reason text
);

create index if not exists idx_jarvis_decisions_decision_type on public.jarvis_decisions (decision_type);
create index if not exists idx_jarvis_decisions_target on public.jarvis_decisions (target);
create index if not exists idx_jarvis_decisions_status on public.jarvis_decisions (status);
create index if not exists idx_jarvis_decisions_requires_approval on public.jarvis_decisions (requires_approval);
create index if not exists idx_jarvis_decisions_created_at on public.jarvis_decisions (created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 2: Experimentos A/B Within-Subject
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.jarvis_experiments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  name text not null,
  hypothesis text not null,
  duration_days int not null,

  control_config jsonb not null,
  treatment_config jsonb not null,

  min_sample_size int not null,
  power_target numeric,
  alpha_level numeric,
  test_type text,

  status text not null default 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED, FAILED, INCONCLUSIVE
  control_n int,
  treatment_n int,
  control_mean numeric,
  treatment_mean numeric,
  pvalue numeric,
  effect_size numeric,

  declared_winner text,
  declared_at timestamptz,
  declared_by text,

  deployed_at timestamptz,
  production_pnl_30d numeric
);

create index if not exists idx_jarvis_experiments_status on public.jarvis_experiments (status);
create index if not exists idx_jarvis_experiments_created_at on public.jarvis_experiments (created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 3: Conhecimento Confirmado em Produção
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.jarvis_knowledge (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  pattern text not null,
  asset_class text not null,

  effect_size numeric not null,
  effect_unit text not null,
  time_window text not null,

  sample_size int not null,
  power numeric,
  holdout_validated boolean,

  applied_in text,
  status text not null,                    -- 'ACTIVE', 'INACTIVE', 'BEING_TESTED'
  autonomy text not null default 'AUTO',   -- 'AUTO' | 'REQUIRES_APPROVAL'

  discovered_at timestamptz,
  discovered_by text,
  notes text
);

create index if not exists idx_jarvis_knowledge_pattern on public.jarvis_knowledge (pattern);
create index if not exists idx_jarvis_knowledge_asset_class on public.jarvis_knowledge (asset_class);
create index if not exists idx_jarvis_knowledge_status on public.jarvis_knowledge (status);
create index if not exists idx_jarvis_knowledge_applied_in on public.jarvis_knowledge (applied_in);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 4: Alertas de Anomalias (tempo real)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.jarvis_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  alert_type text not null,   -- 'CONFIDENCE_DEGRADATION', 'PRICE_GUARD_BREACH', 'WR_BELOW_BREAKEVEN'
  severity text not null,     -- 'INFO', 'WARNING', 'CRITICAL'

  metric text,
  current_value numeric,
  threshold numeric,

  auto_action text,           -- 'NONE', 'REDUCED_SIZE', 'PAUSE_SIGNAL', 'ALERT_CLEBER'
  action_taken_at timestamptz,

  resolved_at timestamptz,
  resolved_by text,
  resolution_action text
);

create index if not exists idx_jarvis_alerts_alert_type on public.jarvis_alerts (alert_type);
create index if not exists idx_jarvis_alerts_severity on public.jarvis_alerts (severity);
create index if not exists idx_jarvis_alerts_created_at on public.jarvis_alerts (created_at);
create index if not exists idx_jarvis_alerts_resolved_at on public.jarvis_alerts (resolved_at);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 5: Snapshots de Saúde (agregação 6h)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.jarvis_health_snapshots (
  snapshot_time timestamptz primary key,

  trades_6h int,
  win_rate_6h numeric,
  avg_pnl_6h numeric,
  max_drawdown_6h numeric,

  confidence_auc numeric,
  confidence_brier_score numeric,

  price_guard_breaches_6h int,
  cost_gate_rejections_6h int,

  hour_of_day int,
  day_of_week int,
  calendar_event text,

  jarvis_recommendation text  -- 'NORMAL', 'REDUCE_SIZE', 'PAUSE', 'TEST_NEW_CONFIG'
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 6: Config de Guardrails (autoaplicação, decidido 2026-08-23)
--
-- Os limites vivem em DADO, não em código — trocar um teto é um UPDATE
-- auditável nesta tabela, não um deploy de Edge Function.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.jarvis_guardrails (
  target text primary key,

  magnitude_cap_pct numeric not null,
  cooldown_cycles int not null default 4,        -- 4 ciclos de 6h = 24h
  requires_approval boolean not null default false,
  rollback_stddev_threshold numeric not null default 1.0,

  updated_at timestamptz default now(),
  notes text
);

-- Seed inicial (2026-08-23) — ajustável depois sem redeploy.
-- Gates de risco inteiros e parâmetros de capital/alavancagem SEMPRE
-- requerem aprovação — nunca saem desta lista sem decisão explícita do Cleber.
insert into public.jarvis_guardrails (target, magnitude_cap_pct, cooldown_cycles, requires_approval, notes) values
  ('position_size',        25, 4, false, 'Ajuste de tamanho por horário/regime — autoaplica dentro do teto'),
  ('signalScoreFloor',     15, 4, false, 'Piso de score de sinal — autoaplica'),
  ('confidence_score',     0,  0, true,  'Recalibração do modelo de confiança — sempre requer teste A/B aprovado, nunca autoaplica direto'),
  ('CONFIDENCE_GATE',      0,  0, true,  'Ligar/desligar gate inteiro — sempre PENDING'),
  ('RISK_GATE',            0,  0, true,  'Gate de risco de conta — sempre PENDING'),
  ('TAIL_RISK_GUARD',      0,  0, true,  'Proteção de cauda/cisne negro — sempre PENDING'),
  ('KILL_SWITCH',          0,  0, true,  'Nunca autoaplicado sob nenhuma circunstância'),
  ('NEWS_GATE',            0,  0, true,  'Gate de notícias inteiro — sempre PENDING (mas janela de horário dentro dele pode ser AUTO, ver knowledge)'),
  ('capital_minimo',       0,  0, true,  'Parâmetro de produto/regulatório — nunca autoaplicado'),
  ('leverage',             0,  0, true,  'Parâmetro de risco de conta — nunca autoaplicado')
on conflict (target) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS: Jarvis escreve como service_role; leitura pública (auditoria)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.jarvis_decisions enable row level security;
alter table public.jarvis_experiments enable row level security;
alter table public.jarvis_knowledge enable row level security;
alter table public.jarvis_alerts enable row level security;
alter table public.jarvis_health_snapshots enable row level security;
alter table public.jarvis_guardrails enable row level security;

create policy "read_jarvis_decisions" on public.jarvis_decisions for select using (true);
create policy "write_jarvis_decisions" on public.jarvis_decisions for insert with check (auth.role() = 'service_role');
create policy "update_jarvis_decisions" on public.jarvis_decisions for update using (auth.role() = 'service_role');

create policy "read_jarvis_experiments" on public.jarvis_experiments for select using (true);
create policy "write_jarvis_experiments" on public.jarvis_experiments for insert with check (auth.role() = 'service_role');
create policy "update_jarvis_experiments" on public.jarvis_experiments for update using (auth.role() = 'service_role');

create policy "read_jarvis_knowledge" on public.jarvis_knowledge for select using (true);
create policy "write_jarvis_knowledge" on public.jarvis_knowledge for insert with check (auth.role() = 'service_role');
create policy "update_jarvis_knowledge" on public.jarvis_knowledge for update using (auth.role() = 'service_role');

create policy "read_jarvis_alerts" on public.jarvis_alerts for select using (true);
create policy "write_jarvis_alerts" on public.jarvis_alerts for insert with check (auth.role() = 'service_role');
create policy "update_jarvis_alerts" on public.jarvis_alerts for update using (auth.role() = 'service_role');

create policy "read_jarvis_health_snapshots" on public.jarvis_health_snapshots for select using (true);
create policy "write_jarvis_health_snapshots" on public.jarvis_health_snapshots for insert with check (auth.role() = 'service_role');

create policy "read_jarvis_guardrails" on public.jarvis_guardrails for select using (true);
create policy "write_jarvis_guardrails" on public.jarvis_guardrails for all using (auth.role() = 'service_role');
