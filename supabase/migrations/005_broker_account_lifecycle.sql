-- Migration: broker_account_lifecycle
-- Fase 3: deploy/undeploy automático de conta MetaAPI por inatividade.
-- Sem isso, cada conta hospedada custa ~US$8,64/mês mesmo parada (preço confirmado
-- em metaapi.cloud/#pricing, oferta g2). A Edge Function (index.ts) já faz deploy
-- sob demanda em /broker/execute e marca last_active_at a cada chamada; este job
-- derruba (undeploy) contas sem atividade recente.

ALTER TABLE public.broker_credentials
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deployed boolean NOT NULL DEFAULT false;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- CRON_SECRET já configurado no painel de Secrets da Edge Function (2026-07-07)
-- e replicado abaixo, no header x-cron-secret, pro pg_cron/pg_net conseguir chamar
-- a rota /broker/undeploy-inactive (protegida, só aceita esse valor exato).
SELECT cron.schedule(
  'undeploy-inactive-broker-accounts',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/server/broker/undeploy-inactive',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '0c84c7a913f7ce87a29c88747d85ee9243b607ccf6e7711b1721c49bb1ea9e9c'),
    body := '{}'::jsonb
  );
  $$
);

-- Pra remover o agendamento no futuro, se precisar:
-- SELECT cron.unschedule('undeploy-inactive-broker-accounts');
