-- Marcador de "reset de histórico exibido" pro card de Performance.
--
-- Achado 2026-08-21: o botão Resetar (`resetLogic` em useApexLogic.ts) zera
-- saldo/orderHistory local, mas a tela de Performance hidrata TODO o
-- histórico do usuário via `getUserTrades` (sem filtro de sessão) — então
-- trades de semanas atrás voltavam a aparecer em Melhor Trade/Pior
-- Trade/Melhor Dia depois de qualquer reload, mesmo após reset. Confirmado
-- com dois trades reais contaminados por bugs antigos já corrigidos no
-- motor (SPX500 -$950,00 de 2026-08-03, resíduo do bug de alavancagem
-- corrigido no mesmo dia; SPX500 +$341,00 de 2026-08-04, posição de $7.754
-- de margem numa conta de ~$100 — gate de risco, não bug de cálculo).
--
-- Esta tabela não apaga nada em `ai_trades` (auditoria append-only intacta,
-- ver `ai_trades_audit_log`) — só marca "a partir daqui é o que conta pra
-- performance exibida". `getUserTradeHistory` (useAIPersistence.ts) passa a
-- filtrar por este marcador; `OperationLogs.tsx` (log de auditoria, via
-- `getUserTrades` direto) continua mostrando o histórico vitalício de
-- propósito — resets não o afetam.

create table if not exists public.ai_history_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reset_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_history_resets_user_id
  on public.ai_history_resets(user_id, reset_at desc);

alter table public.ai_history_resets enable row level security;

create policy "users can insert own history reset markers"
  on public.ai_history_resets for insert
  with check (auth.uid() = user_id);

create policy "users can read own history reset markers"
  on public.ai_history_resets for select
  using (auth.uid() = user_id);
