-- 2026-09-07: elimina de vez a classe de bug de "sessão órfã" (Apex AI
-- duplicada mascarando a sessão real do LLM Brain no Dashboard/Logs/Gráfico,
-- catalogada desde 2026-08-31 e recorrente).
--
-- Causa raiz do lado do banco: nada em `ai_sessions` jamais impediu 2 linhas
-- RUNNING do mesmo usuário ao mesmo tempo. Toda mitigação até hoje foi só
-- client-side (getActiveSession() priorizando LLM_ACTIVE_BRAIN_MT5,
-- reconcile() resincronizando a cada 5s) -- band-aids que escondem o
-- sintoma sem impedir a causa. Qualquer corrida futura (aba nova, clique
-- duplo, F5 no timing errado, bug novo em startLogic()) pode voltar a criar
-- uma segunda sessão RUNNING.
--
-- Fix real: trava de banco. Um índice único parcial por (user_id, mode)
-- filtrado a status='RUNNING' torna FISICAMENTE IMPOSSÍVEL inserir/atualizar
-- uma 2ª linha RUNNING pro mesmo usuário no mesmo modo (DEMO/LIVE
-- permanecem independentes de propósito -- não é o mesmo "motor único", são
-- contextos de execução diferentes). Qualquer INSERT/UPDATE que violar isso
-- falha com "duplicate key value violates unique constraint" -- o código
-- cliente precisa tratar esse erro (23505) revertendo pra
-- getActiveSession()/resumeSession() em vez de tentar criar de novo, ver
-- fix em AITradingPersistenceService.ts (createSession) e
-- useApexLogic.ts (startLogic) no mesmo commit desta migration.
--
-- Antes de aplicar: preciso encerrar as sessões RUNNING duplicadas
-- existentes (a mais recente por usuário/modo vence, as demais viram
-- COMPLETED com nota explícita -- nunca um UPDATE silencioso em dado
-- financeiro, ver convenção do projeto em CLAUDE.md) para não quebrar a
-- migration na criação do índice.

with duplicated as (
  select
    id,
    user_id,
    mode,
    row_number() over (
      partition by user_id, mode
      order by started_at desc nulls last, created_at desc
    ) as rn
  from ai_sessions
  where status = 'RUNNING'
)
update ai_sessions s
set
  status = 'COMPLETED',
  ended_at = now(),
  config = coalesce(s.config, '{}'::jsonb) || jsonb_build_object(
    'closed_by_migration', '20260907_enforce_single_running_session_per_user',
    'closed_reason', 'sessao_running_duplicada_do_mesmo_usuario_mode -- mantida so a mais recente por started_at'
  )
from duplicated d
where s.id = d.id
  and d.rn > 1;

create unique index if not exists ai_sessions_one_running_per_user_mode
  on ai_sessions (user_id, mode)
  where status = 'RUNNING';
