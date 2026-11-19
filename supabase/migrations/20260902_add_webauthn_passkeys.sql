-- Login por biometria real (WebAuthn/Passkeys, FIDO2 — Face ID/Touch ID/
-- Windows Hello do próprio dispositivo do usuário; o servidor nunca recebe
-- nem armazena a digital em si, só a chave pública do par gerado no
-- dispositivo). Duas tabelas:
--
-- webauthn_credentials: uma linha por passkey registrada (usuário pode ter
-- várias, ex: notebook + celular).
--
-- webauthn_challenges: challenge de uso único, TTL curto, usado tanto no
-- registro quanto na autenticação — nunca reaproveitado (bloqueia replay).

create table if not exists webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_type text,
  backed_up boolean not null default false,
  transports text[],
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_webauthn_credentials_user_id on webauthn_credentials(user_id);

alter table webauthn_credentials enable row level security;

create policy "webauthn_credentials_select_own"
  on webauthn_credentials for select
  using (auth.uid() = user_id);

create policy "webauthn_credentials_delete_own"
  on webauthn_credentials for delete
  using (auth.uid() = user_id);

-- Nunca INSERT/UPDATE direto do client — só a Edge Function (service role)
-- grava, depois de verificar a assinatura criptográfica de verdade.

create table if not exists webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  challenge text not null,
  purpose text not null check (purpose in ('register', 'authenticate')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  used_at timestamptz
);

create index if not exists idx_webauthn_challenges_lookup on webauthn_challenges(email, purpose, expires_at);

alter table webauthn_challenges enable row level security;
-- Sem policy nenhuma pra client (nem select) — só a Edge Function
-- (service role) toca essa tabela.

-- Limpeza best-effort de challenges expirados; roda de carona a cada
-- registro/autenticação nova via chamada da própria function, não precisa
-- de cron dedicado dado o volume baixo esperado.
