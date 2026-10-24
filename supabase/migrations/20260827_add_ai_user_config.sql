-- Persistência da configuração da IA por usuário (stopLossMode, riskPerTrade,
-- etc.) — até aqui só existia em localStorage do navegador, então mudava de
-- config em outro dispositivo/aba anônima voltava sempre pro default
-- hardcoded do código, sem nenhum registro central de qual foi a última
-- escolha real do usuário. Ver SESSAO_2026-08-27 pro achado que motivou isto.
create table if not exists ai_user_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table ai_user_config enable row level security;

create policy "ai_user_config_select_own"
  on ai_user_config for select
  using (auth.uid() = user_id);

create policy "ai_user_config_insert_own"
  on ai_user_config for insert
  with check (auth.uid() = user_id);

create policy "ai_user_config_update_own"
  on ai_user_config for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
