-- Dev Lab: nova seção "Sugestões da IA para Desenvolvimento" — a IA gera
-- ideias de melhoria da própria plataforma (opinião do modelo, não pesquisa
-- de concorrente evidenciada — por isso é um source_type novo, distinto de
-- AI_RESEARCH, pra não misturar "opinião da IA" com "fato de concorrente
-- comprovado por fonte").
alter table dev_lab_suggestions drop constraint if exists dev_lab_suggestions_source_type_check;
alter table dev_lab_suggestions add constraint dev_lab_suggestions_source_type_check
  check (source_type = any (array['MANUAL'::text, 'AI_RESEARCH'::text, 'AI_SUGGESTION'::text]));
