-- 2026-11-03 (Cleber, operando LIVE: "o delay entre o MetaTrader e a plataforma tem que ser muito baixo").
-- Estado ao vivo da conta MT5 (posições + saldo/equity) gravado pelo streaming-relay a cada mudança que a MetaAPI
-- empurra, e lido pelo app via Supabase Realtime (postgres_changes) em vez de polling REST (1-3s por chamada, de 5 em 5s).
--
-- Segurança: NÃO vai pelo canal público de preços (turbo-main-channel), que qualquer cliente com a chave anon escuta.
-- Aqui só enxerga a linha quem tem essa conta em `broker_credentials` (que não tem política de leitura -- por isso a
-- checagem é uma função SECURITY DEFINER). Escrita só pela service_role (o relay), que ignora RLS.

CREATE TABLE IF NOT EXISTS public.live_account_state (
  account_id   text PRIMARY KEY,
  positions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  account_info jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_account_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_broker_account(p_account_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.broker_credentials b
    WHERE b.account_id = p_account_id AND b.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_broker_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_broker_account(text) TO authenticated;

DROP POLICY IF EXISTS live_account_state_owner_select ON public.live_account_state;
CREATE POLICY live_account_state_owner_select
  ON public.live_account_state
  FOR SELECT
  TO authenticated
  USING (public.owns_broker_account(account_id));

-- Realtime entrega a linha nova inteira em cada UPSERT.
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_account_state;
