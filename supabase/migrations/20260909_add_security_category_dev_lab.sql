-- Dev Lab: nova categoria "Segurança" (pedido do Cleber na sessão de
-- 2026-09-09, mensagem original cortada em "Securit...").
alter table dev_lab_suggestions drop constraint if exists dev_lab_suggestions_category_check;
alter table dev_lab_suggestions add constraint dev_lab_suggestions_category_check
  check (category = any (array[
    'TECH'::text, 'DESIGN_UX'::text, 'FEATURE'::text, 'COMPETITION'::text, 'INNOVATION'::text,
    'BUG'::text, 'OPTIMIZATION'::text, 'GROWTH_MARKETING'::text, 'MONETIZATION'::text,
    'AI_BRAIN'::text, 'SECURITY'::text
  ]));
