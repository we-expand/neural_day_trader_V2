-- Jarvis Passo 5 (dashboard): jarvis_decisions tinha só policy de SELECT e
-- INSERT (service_role) — sem policy de UPDATE, o dashboard não consegue
-- aprovar/rejeitar uma decisão PENDING (RLS nega por padrão sem policy).
--
-- Só permite mudar uma linha que ESTÁ 'PENDING' e só pra 'ACTIVE'/'REJECTED'
-- — não abre UPDATE geral na tabela (evidence, magnitude_pct etc continuam
-- imutáveis por usuário autenticado).

create policy "authenticated_review_jarvis_decisions"
  on jarvis_decisions
  for update
  to authenticated
  using (status = 'PENDING')
  with check (status in ('ACTIVE', 'REJECTED'));
