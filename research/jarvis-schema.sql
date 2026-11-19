-- Jarvis: Sistema de Evolução Contínua
-- Migrations pra Supabase

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 1: Decisões & Recomendações
--
-- MODO DE OPERAÇÃO (decidido 2026-08-23): Jarvis AUTOAPLICA dentro de
-- limites. Diferente da regra de "nunca commit/push sozinho" (que vale pra
-- código-fonte), aqui o motor readapta parâmetro operacional sozinho —
-- mas só dentro dos 5 guardrails abaixo, nunca sem eles.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists jarvis_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  -- O QUÊ E PORQUÊ
  decision_type text not null, -- 'GATE_TOGGLE', 'SIZE_ADJUST', 'RECALIBRATE', 'TEST_SIGNAL', 'ROLLBACK'
  target text not null,        -- 'NEWS_GATE', 'CONFIDENCE_GATE', 'confidence_score', etc
  action text not null,        -- 'enable', 'disable', '+10%', '-5%', 'run_test', 'revert'

  -- EVIDÊNCIA
  evidence jsonb not null,     -- { metric: 'win_rate', value: 0.318, threshold: 0.35, status: 'below' }
  confidence_level numeric,    -- 0-1, confiança da evidência (power statístico, n, DSR, etc)

  -- GUARDRAILS (checados ANTES de status virar ACTIVE — ver função
  -- evaluateGuardrails() no motor)
  requires_approval boolean not null default false, -- true = nasce PENDING sempre (lista de exclusão)
  magnitude_pct numeric,        -- % de mudança no parâmetro-alvo (ex: -25 = reduz 25%)
  magnitude_cap_pct numeric,    -- teto permitido pra este target (config, não decisão a decisão)
  cooldown_until timestamptz,   -- este target não pode ser reajustado antes desta hora

  -- ESTADO
  -- PENDING (aguardando aprovação — só p/ requires_approval=true)
  -- ACTIVE (autoaplicada, rodando)
  -- COMPLETED (avaliada, mantida)
  -- ROLLED_BACK (revertida — manual ou automática)
  -- REJECTED (Cleber rejeitou uma PENDING)
  status text not null default 'PENDING',
  approved_by text,            -- 'system_auto', 'cleber', etc — 'system_auto' = autoaplicada sem humano
  approved_at timestamptz,

  -- RESULTADO
  effect_on_pnl numeric,       -- Δ PnL após ativação, medido no ciclo seguinte
  baseline_pnl_stddev numeric, -- desvio-padrão histórico do PnL, usado como limiar de rollback automático
  days_running int,            -- Quantos dias a decisão rodou
  reverted_at timestamptz,     -- Se foi rollback, quando
  revert_reason text,          -- 'auto_rollback_pnl_degradation', 'manual_cleber', etc

  index (decision_type),
  index (target),
  index (status),
  index (requires_approval),
  index (created_at)
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 2: Experimentos A/B Within-Subject
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists jarvis_experiments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  
  -- DESIGN DO TESTE
  name text not null,          -- 'confidence_meta_label_v1', 'volatility_targeting_garch'
  hypothesis text not null,    -- O QUE ESTAMOS TESTANDO
  duration_days int not null,  -- Quantos dias vai rodar
  
  -- SETUP TÉCNICO
  control_config jsonb not null,  -- Configuração atual (baseline)
  treatment_config jsonb not null, -- Configuração novo (hipótese)
  
  -- VALIDAÇÃO ESTATÍSTICA
  min_sample_size int not null, -- n mínima pra poder declarar vencedor
  power_target numeric,         -- 0.80 = 80% poder
  alpha_level numeric,          -- 0.05 = 5% alpha
  test_type text,               -- 'ttest', 'mann_whitney', 'sequential'
  
  -- PROGRESSO
  status text not null default 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED, FAILED, INCONCLUSIVE
  control_n int,               -- Quantas observações no control
  treatment_n int,             -- Quantas no treatment
  control_mean numeric,        -- PnL médio do control
  treatment_mean numeric,      -- PnL médio do treatment
  pvalue numeric,              -- p-value do teste (se finalizado)
  effect_size numeric,         -- Cohen's d ou similar
  
  -- DECISÃO
  declared_winner text,        -- 'control', 'treatment', null (inconclusive)
  declared_at timestamptz,
  declared_by text,            -- 'system', 'cleber'
  
  -- RESULTADO NA PRODUÇÃO
  deployed_at timestamptz,     -- Quando a config vencedora entrou em produção
  production_pnl_30d numeric,  -- PnL 30 dias pós-deploy (validação holdout)
  
  index (status),
  index (created_at)
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 3: Conhecimento Confirmado em Produção
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists jarvis_knowledge (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  
  -- O QUÊ
  pattern text not null,       -- 'london_fix_volatility_spike', 'pre_fomc_drift', 'turn_of_month'
  asset_class text not null,   -- 'COMMODITY', 'FOREX_MAJOR', 'CRYPTO', 'INDEX', etc
  
  -- MAGNITUDE & HORÁRIO
  effect_size numeric not null, -- 2.5x vol, 15bps drift, etc
  effect_unit text not null,   -- 'vol_ratio', 'bps', '%', 'pct_trades_better'
  time_window text not null,   -- '15min', '1h', 'pre_24h', 'turn_of_month'
  
  -- VALIDAÇÃO
  sample_size int not null,
  power numeric,               -- % chance de detectar este efeito com n atual
  holdout_validated boolean,   -- Confirmado out-of-sample?
  
  -- APLICAÇÃO NO MOTOR
  applied_in text,             -- Gate/modulo que usa isto (ex: 'NEWS_GATE', 'volatility_targeting')
  status text not null,        -- 'ACTIVE', 'INACTIVE', 'BEING_TESTED'
  autonomy text not null default 'AUTO', -- 'AUTO' (Jarvis autoaplica) | 'REQUIRES_APPROVAL' (sempre PENDING)
  
  -- HISTÓRICO
  discovered_at timestamptz,
  discovered_by text,          -- 'research_agent', 'manual_audit'
  notes text,
  
  index (pattern),
  index (asset_class),
  index (status),
  index (applied_in)
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 4: Audição de Anomalias (real-time)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists jarvis_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  
  alert_type text not null,    -- 'CONFIDENCE_DEGRADATION', 'PRICE_GUARD_BREACH', 'WR_BELOW_BREAKEVEN'
  severity text not null,      -- 'INFO', 'WARNING', 'CRITICAL'
  
  -- CONTEXTO
  metric text,                 -- Nome da métrica (ex: 'confidence_auc', 'win_rate')
  current_value numeric,
  threshold numeric,
  
  -- RESPOSTA AUTOMÁTICA
  auto_action text,            -- 'NONE', 'REDUCED_SIZE', 'PAUSE_SIGNAL', 'ALERT_CLEBER'
  action_taken_at timestamptz,
  
  -- RESOLUÇÃO
  resolved_at timestamptz,
  resolved_by text,            -- 'system', 'cleber'
  resolution_action text,      -- O que foi feito
  
  index (alert_type),
  index (severity),
  index (created_at),
  index (resolved_at)
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 5: Snapshots de Saúde (agregação 6h)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists jarvis_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_time timestamptz not null,
  
  -- OPERACIONAL
  trades_6h int,
  win_rate_6h numeric,
  avg_pnl_6h numeric,
  max_drawdown_6h numeric,
  
  -- CALIBRAÇÃO
  confidence_auc numeric,
  confidence_brier_score numeric,
  
  -- RISCOS
  price_guard_breaches_6h int,
  cost_gate_rejections_6h int,
  
  -- PADRÕES DETECTADOS
  hour_of_day int,             -- Que hora é
  day_of_week int,             -- Que dia da semana
  calendar_event text,         -- 'pre_fomc', 'nfp', 'london_fix', null
  
  -- RECOMENDAÇÃO DO JARVIS
  jarvis_recommendation text,   -- 'NORMAL', 'REDUCE_SIZE', 'PAUSE', 'TEST_NEW_CONFIG'
  
  primary key (snapshot_time)
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABELA 6: Config de Guardrails (autoaplicação, decidido 2026-08-23)
--
-- Os limites vivem em DADO, não em código — trocar um teto é um UPDATE
-- auditável nesta tabela, não um deploy de Edge Function.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists jarvis_guardrails (
  target text primary key,       -- 'position_size', 'CONFIDENCE_GATE', 'signalScoreFloor', etc

  -- TETO DE MAGNITUDE POR CICLO
  magnitude_cap_pct numeric not null, -- ex: 25 = no máx ±25% por execução do Jarvis (6h)

  -- COOLDOWN
  cooldown_cycles int not null default 4, -- 4 ciclos de 6h = 24h antes de reajustar o mesmo alvo

  -- LISTA DE EXCLUSÃO — sempre nasce PENDING, nunca autoaplica
  requires_approval boolean not null default false,

  -- ROLLBACK AUTOMÁTICO
  rollback_stddev_threshold numeric not null default 1.0, -- reverte se efeito < -1 desvio-padrão histórico do PnL

  updated_at timestamptz default now(),
  notes text
);

alter table jarvis_guardrails enable row level security;
create policy "read_jarvis_guardrails" on jarvis_guardrails for select using (true);
create policy "write_jarvis_guardrails" on jarvis_guardrails for all using (auth.role() = 'service_role');

-- Seed inicial (2026-08-23) — ajustável depois sem redeploy.
-- Gates de risco inteiros e parâmetros de capital/alavancagem SEMPRE
-- requerem aprovação — nunca saem desta lista sem decisão explícita do Cleber.
insert into jarvis_guardrails (target, magnitude_cap_pct, cooldown_cycles, requires_approval, notes) values
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
-- RLS: Jarvis escreve como service_role (confiança do servidor)
-- ════════════════════════════════════════════════════════════════════════════

alter table jarvis_decisions enable row level security;
alter table jarvis_experiments enable row level security;
alter table jarvis_knowledge enable row level security;
alter table jarvis_alerts enable row level security;
alter table jarvis_health_snapshots enable row level security;

-- Policies: qualquer um lê (auditoria pública), só service_role escreve
create policy "read_jarvis_decisions" on jarvis_decisions for select using (true);
create policy "write_jarvis_decisions" on jarvis_decisions for insert with check (auth.role() = 'service_role');

create policy "read_jarvis_experiments" on jarvis_experiments for select using (true);
create policy "write_jarvis_experiments" on jarvis_experiments for insert with check (auth.role() = 'service_role');

create policy "read_jarvis_knowledge" on jarvis_knowledge for select using (true);
create policy "write_jarvis_knowledge" on jarvis_knowledge for insert with check (auth.role() = 'service_role');

create policy "read_jarvis_alerts" on jarvis_alerts for select using (true);
create policy "write_jarvis_alerts" on jarvis_alerts for insert with check (auth.role() = 'service_role');

create policy "read_jarvis_health_snapshots" on jarvis_health_snapshots for select using (true);
create policy "write_jarvis_health_snapshots" on jarvis_health_snapshots for insert with check (auth.role() = 'service_role');
