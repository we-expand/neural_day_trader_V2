-- Migration: schedule_partner_commission_accrual
-- Agenda o pg_cron do job de apuração mensal do Programa de Parceiros IB
-- (supabase/functions/partner-commission-accrual/), deployado desde
-- 2026-08-18 mas mantido deliberadamente sem cron até esta decisão.
--
-- DECISÃO (Cleber, 2026-08-18): "comissão só sobre execução" aceito como v1.
-- `subscription_revenue`/`marketplace_revenue` continuam gravados como 0
-- (não existe fonte real de pagamento/assinatura persistida no projeto) —
-- um indicado que assina mas nunca executa ordem gera R$0 de comissão pro
-- parceiro. Quando uma fonte real de receita de assinatura existir, plugar
-- em `partner-commission-accrual/index.ts` (CommissionModel.ts já aceita
-- os campos) — não é preciso alterar este agendamento.
--
-- Roda 1x por mês, dia 1 às 04:00 UTC — margem de sobra pra todo dado do
-- mês anterior já ter sido gravado em `broker_order_executions`.
--
-- IMPORTANTE: troque <PARTNER_ACCRUAL_SHARED_SECRET> abaixo pelo valor real
-- antes de rodar (o mesmo configurado via `supabase secrets set
-- PARTNER_ACCRUAL_SHARED_SECRET=...` pra Edge Function). Não fica em texto
-- neste repo — só você tem o valor.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'partner-commission-accrual-monthly',
  '0 4 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/partner-commission-accrual',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-runner-secret', '<PARTNER_ACCRUAL_SHARED_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pra remover o agendamento no futuro, se precisar:
-- SELECT cron.unschedule('partner-commission-accrual-monthly');
