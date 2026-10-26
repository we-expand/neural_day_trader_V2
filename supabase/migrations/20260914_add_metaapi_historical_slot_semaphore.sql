-- 2026-09-14: semáforo distribuído real pro teto de "5 requisições concorrentes
-- de dado histórico" da MetaAPI (regra fixa da própria MetaAPI, por conta,
-- não muda com plano pago -- confirmado em pesquisa anterior, ver CLAUDE.md).
--
-- O semáforo anterior (`activeHistoricalDataRequests`, variável em memória em
-- supabase/functions/server/index.ts) só limitava dentro de UMA instância/
-- isolate da Edge Function -- sob carga, o Supabase escala pra várias
-- instâncias em paralelo, cada uma com sua própria cópia da variável, sem
-- saber da concorrência real das outras. Resultado observado ao vivo: erro
-- da própria MetaAPI "concurrentRequestCount: 6" contra um máximo de 5,
-- mesmo com o código "achando" que limitava a 2 -- prova de que o limite não
-- era global de verdade.
--
-- Fix: tabela real no Postgres (compartilhado de verdade entre todas as
-- instâncias da Edge Function) + função com `pg_advisory_xact_lock` pra
-- serializar as tentativas de aquisição entre TODAS as instâncias
-- concorrentes -- agora sim um limite global.
create table if not exists metaapi_historical_fetch_slots (
  id uuid primary key default gen_random_uuid(),
  acquired_at timestamptz not null default now()
);

alter table metaapi_historical_fetch_slots enable row level security;
-- Sem policy nenhuma: só o service_role (usado pela Edge Function) acessa,
-- que ignora RLS por desenho do Supabase. Nunca deve ser lido/escrito pelo
-- cliente do navegador nem pelo llm-active-brain (que continua com seu
-- próprio semáforo local, separado, em atr.ts).

-- Tenta ocupar 1 de `p_max` vagas. Retorna o id da vaga ocupada (guardar pra
-- liberar depois) ou null se todas as vagas estão ocupadas agora. Limpa
-- sozinha vagas mais velhas que `p_ttl_seconds` antes de checar -- protege
-- contra uma instância que travou/crashou sem liberar (nunca fica preso
-- pra sempre).
create or replace function acquire_historical_fetch_slot(p_max int, p_ttl_seconds int)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_count int;
begin
  -- Serializa TODAS as tentativas concorrentes (de qualquer instância da
  -- Edge Function) nesta seção -- é o que faz o limite ser global de
  -- verdade. Lock de transação: libera sozinho no fim desta chamada RPC.
  perform pg_advisory_xact_lock(823471823471);

  delete from metaapi_historical_fetch_slots
  where acquired_at < now() - make_interval(secs => p_ttl_seconds);

  select count(*) into v_count from metaapi_historical_fetch_slots;
  if v_count >= p_max then
    return null;
  end if;

  v_id := gen_random_uuid();
  insert into metaapi_historical_fetch_slots (id) values (v_id);
  return v_id;
end;
$$;

-- Libera a vaga (chamar sempre no `finally` de quem chamou o acquire).
create or replace function release_historical_fetch_slot(p_id uuid)
returns void
language sql
as $$
  delete from metaapi_historical_fetch_slots where id = p_id;
$$;
