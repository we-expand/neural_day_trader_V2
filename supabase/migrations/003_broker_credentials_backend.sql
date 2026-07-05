-- Migration: broker_credentials_backend
-- Fecha o item mais crítico da Fase 1 de segurança: o token MetaAPI (poder de mover
-- dinheiro real na conta MT5 do usuário) deixa de viver no client (localStorage) e
-- passa a ser guardado aqui, criptografado, acessível SÓ pela Edge Function
-- (service_role), nunca pelo client (anon/authenticated).

CREATE TABLE IF NOT EXISTS public.broker_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  token_ciphertext text NOT NULL,
  token_iv text NOT NULL,
  mt5_login text,
  mt5_server text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;
-- Sem NENHUMA política: nem o próprio dono lê/escreve direto via client.
-- Todo acesso passa pela Edge Function (rotas /broker/credentials e /broker/execute),
-- que usa a service_role key e faz a criptografia/decriptação do token em memória.

CREATE OR REPLACE FUNCTION public.set_broker_credentials_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER broker_credentials_set_updated_at
  BEFORE UPDATE ON public.broker_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_broker_credentials_updated_at();
