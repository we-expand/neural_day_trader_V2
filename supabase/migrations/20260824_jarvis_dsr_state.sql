-- Jarvis: contador global de testes de hipótese (correção de múltiplos
-- testes, Šidák) — "auto-evolução segura".
--
-- Achado 2026-08-23 (SESSAO_2026-08-23..., seção 5.2): reanálise periódica
-- (Jarvis roda a cada 6h, checando win rate vs breakeven) sem correção
-- acumulada "multiplica testes ao longo do tempo" — o Jarvis vai achar
-- ajuste por acaso com frequência crescente se K (número de testes já
-- feitos) resetar por ciclo em vez de acumular desde a criação do sistema.
--
-- Esta tabela guarda K de forma persistente e monotônica (nunca reseta).
-- Singleton: uma linha só, id fixo. Ver
-- supabase/functions/jarvis/lib/statisticalGuard.ts pro uso real (Šidák:
-- alpha_corrigido = 1 - (1-alpha_base)^(1/K), aplicado à Regra 1 de win rate
-- antes de qualquer autoaplicação em jarvis_decisions).

create table if not exists public.jarvis_dsr_state (
  id boolean primary key default true,
  constraint jarvis_dsr_state_singleton check (id),

  tests_since_inception int not null default 0,
  first_test_at timestamptz,
  last_test_at timestamptz,
  alpha_base numeric not null default 0.05,

  updated_at timestamptz default now()
);

insert into public.jarvis_dsr_state (id) values (true)
on conflict (id) do nothing;

alter table public.jarvis_dsr_state enable row level security;

create policy "read_jarvis_dsr_state" on public.jarvis_dsr_state
  for select using (true);

create policy "write_jarvis_dsr_state" on public.jarvis_dsr_state
  for all using (auth.role() = 'service_role');
