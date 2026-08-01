#!/usr/bin/env node
/**
 * Lista evidências/URLs já usadas em sugestões AI_RESEARCH, pra evitar
 * duplicar achado em nova rodada de pesquisa. Somente leitura.
 * Uso: node research/scripts/list-existing-evidence.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no ambiente (.env.local).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('dev_lab_suggestions')
    .select('title, evidence, competitor_url, competitor_name, created_at')
    .eq('source_type', 'AI_RESEARCH')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Erro ao consultar sugestões existentes:', error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main();
