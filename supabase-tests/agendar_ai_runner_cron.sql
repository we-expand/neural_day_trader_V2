-- Agenda o ai-runner pra rodar a cada 1 minuto via pg_cron + pg_net.
-- pg_cron (1.6.4) e pg_net (0.19.5) já estão habilitados no projeto — nada a
-- ativar, só agendar.
--
-- ANTES DE RODAR: troque <AI_RUNNER_SHARED_SECRET> abaixo pelo valor que
-- você gerou e guardou (o mesmo usado no header x-runner-secret dos testes
-- manuais com curl). Não é o token MetaAPI nem chave do Supabase — é o
-- secret específico do runner.
--
-- Deploy feito com --no-verify-jwt (ver sessão 2026-08-07), então NÃO precisa
-- de header Authorization aqui — só o x-runner-secret já autentica.

select cron.schedule(
  'ai-runner-tick',
  '* * * * *', -- granularidade mínima do pg_cron: 1 minuto
  $$
  select net.http_post(
    url := 'https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/ai-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-runner-secret', '<AI_RUNNER_SHARED_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Confirma que o job foi criado (deve aparecer 1 linha, active = true):
-- select * from cron.job where jobname = 'ai-runner-tick';

-- Acompanha as últimas execuções (status, tempo de resposta, erro se houver):
-- select jobid, status, return_message, start_time, end_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'ai-runner-tick')
-- order by start_time desc
-- limit 20;

-- Pra PAUSAR (sem apagar o agendamento):
-- select cron.alter_job((select jobid from cron.job where jobname = 'ai-runner-tick'), active := false);

-- Pra REMOVER de vez:
-- select cron.unschedule('ai-runner-tick');
