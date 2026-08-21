-- Migration: schedule_asset_performance_scorecard
-- Agenda o pg_cron do job de recálculo do scorecard de performance por
-- ativo (supabase/functions/asset-performance-scorecard/).
--
-- IMPORTANTE: isso NÃO liga o efeito no motor de decisão — o job só
-- recalcula e grava `asset_performance_scorecard`; o multiplicador continua
-- ignorado pelo motor enquanto `ASSET_SCORECARD_ACTIVE` (runTradingCycle.ts)
-- estiver `false`. Ver SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md.
--
-- Roda a cada 30 minutos — cadência de trade observada (~1-8/dia por ativo
-- nos dias mais ativos) não justifica rodar por minuto, e isso evita
-- consultar `ai_trades` inteira com frequência desnecessária.
--
-- IMPORTANTE: troque <ASSET_SCORECARD_SHARED_SECRET> abaixo pelo valor real
-- antes de rodar (o mesmo configurado via `supabase secrets set
-- ASSET_SCORECARD_SHARED_SECRET=...` pra Edge Function). Não fica em texto
-- neste repo — só você tem o valor.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'asset-performance-scorecard-recalc',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/asset-performance-scorecard',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-runner-secret', '<ASSET_SCORECARD_SHARED_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pra remover o agendamento no futuro, se precisar:
-- SELECT cron.unschedule('asset-performance-scorecard-recalc');
