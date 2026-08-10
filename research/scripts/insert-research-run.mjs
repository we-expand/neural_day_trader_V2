#!/usr/bin/env node
/**
 * Insere uma rodada de pesquisa de concorrentes + sugestões no Supabase.
 * Uso: node research/scripts/insert-research-run.mjs < payload.json
 *
 * payload.json:
 * {
 *   "userId": "uuid-do-admin",
 *   "competitorsResearched": ["QuantConnect", "MetaTrader 5"],
 *   "summary": "texto curto",
 *   "suggestions": [
 *     {
 *       "title": "...", "description": "...", "category": "TECH",
 *       "impact": "HIGH", "effort": "MEDIUM",
 *       "competitorName": "QuantConnect", "competitorUrl": "https://...",
 *       "evidence": "citação verbatim da fonte"
 *     }
 *   ]
 * }
 *
 * Regra do projeto: nunca fabricar evidência. Se "evidence" ou
 * "competitorUrl" estiverem ausentes numa sugestão AI_RESEARCH, o script
 * recusa a inserção dessa sugestão (mas não derruba a rodada inteira).
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no ambiente (.env.local).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    console.error('Erro: payload não é JSON válido:', e.message);
    process.exit(1);
  }

  const { userId, competitorsResearched, summary, suggestions } = payload;
  if (!userId || !Array.isArray(competitorsResearched) || !Array.isArray(suggestions)) {
    console.error('Erro: payload precisa de userId, competitorsResearched[] e suggestions[].');
    process.exit(1);
  }

  const validSuggestions = [];
  const rejected = [];
  for (const s of suggestions) {
    if (!s.title || !s.description || !s.category || !s.impact || !s.effort) {
      rejected.push({ title: s.title || '(sem título)', reason: 'campo obrigatório ausente' });
      continue;
    }
    if (!s.evidence || !s.competitorUrl) {
      rejected.push({ title: s.title, reason: 'sem evidência/URL real — recusado (nunca fabricar)' });
      continue;
    }
    validSuggestions.push(s);
  }

  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase
    .from('dev_lab_research_runs')
    .insert([{
      user_id: userId,
      started_at: startedAt,
      status: 'RUNNING',
      competitors_researched: competitorsResearched,
      suggestions_created: 0,
    }])
    .select()
    .single();

  if (runError) {
    console.error('Erro ao criar research_run:', runError.message);
    process.exit(1);
  }

  if (validSuggestions.length === 0) {
    await supabase.from('dev_lab_research_runs').update({
      status: 'FAILED',
      completed_at: new Date().toISOString(),
      error: `Nenhuma sugestão com evidência real. Rejeitadas: ${JSON.stringify(rejected)}`,
    }).eq('id', run.id);
    console.error('Nenhuma sugestão válida (todas sem evidência real). Rodada marcada como FAILED.');
    console.error(JSON.stringify(rejected, null, 2));
    process.exit(1);
  }

  const rows = validSuggestions.map((s) => ({
    user_id: userId,
    title: s.title,
    description: s.description,
    full_analysis: s.fullAnalysis || null,
    category: s.category,
    impact: s.impact,
    effort: s.effort,
    status: 'active',
    tags: s.tags || [],
    source_type: 'AI_RESEARCH',
    competitor_name: s.competitorName || null,
    competitor_url: s.competitorUrl,
    evidence: s.evidence,
    research_run_id: run.id,
  }));

  const { error: insertError } = await supabase.from('dev_lab_suggestions').insert(rows);
  if (insertError) {
    await supabase.from('dev_lab_research_runs').update({
      status: 'FAILED',
      completed_at: new Date().toISOString(),
      error: insertError.message,
    }).eq('id', run.id);
    console.error('Erro ao inserir sugestões:', insertError.message);
    process.exit(1);
  }

  await supabase.from('dev_lab_research_runs').update({
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    suggestions_created: rows.length,
    summary: summary || null,
  }).eq('id', run.id);

  console.log(`OK: research_run ${run.id} — ${rows.length} sugestões inseridas.`);
  if (rejected.length > 0) {
    console.log(`Rejeitadas (sem evidência real): ${rejected.length}`);
    console.log(JSON.stringify(rejected, null, 2));
  }
}

main();
