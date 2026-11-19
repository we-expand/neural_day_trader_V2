-- NEXUS — assistente de day trade conversacional (LLM real) do usuário.
-- Diferente do Jarvis (jarvis_*, motor interno de auto-tuning invisível ao
-- usuário) — NEXUS é a peça voltada ao usuário: chat/voz + alertas
-- proativos de risco/calendário/notícia sobre o ativo que ele está olhando.
--
-- Duas tabelas:
--  - nexus_interactions: log de toda pergunta/resposta (auditoria, nunca
--    editada, só inserida pela edge function nexus-brain).
--  - nexus_alerts: alertas proativos gerados pelo tick do ai-runner
--    (Fase 2), persistidos para o cliente mostrar/falar mesmo se a tela
--    não estava aberta no momento em que o alerta foi gerado.

create table if not exists public.nexus_interactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text,
  response text not null,
  source text not null check (source in ('user_chat', 'server_proactive'))
);

comment on table public.nexus_interactions is
  'Log de auditoria de toda interação com o NEXUS (LLM real via nexus-brain) — nunca editado, só inserido pela edge function.';

alter table public.nexus_interactions enable row level security;

create policy "users_read_own_nexus_interactions"
  on public.nexus_interactions
  for select
  using (auth.uid() = user_id);

create policy "service_role_all_nexus_interactions"
  on public.nexus_interactions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_nexus_interactions_user_created
  on public.nexus_interactions (user_id, created_at desc);


create table if not exists public.nexus_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.ai_sessions(id) on delete set null,
  symbol text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  kind text not null check (kind in ('news', 'calendar', 'price_guard', 'risk')),
  message text not null,
  context_json jsonb,
  read_at timestamptz
);

comment on table public.nexus_alerts is
  'Alertas proativos do NEXUS gerados pelo tick do ai-runner (Fase 2) — persistidos para o cliente exibir/falar mesmo se a tela estava fechada quando o alerta foi gerado. Entrega hoje é só in-app (sem push real fora do app).';

alter table public.nexus_alerts enable row level security;

create policy "users_read_own_nexus_alerts"
  on public.nexus_alerts
  for select
  using (auth.uid() = user_id);

create policy "users_update_own_nexus_alerts_read_at"
  on public.nexus_alerts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "service_role_all_nexus_alerts"
  on public.nexus_alerts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_nexus_alerts_user_created
  on public.nexus_alerts (user_id, created_at desc);
