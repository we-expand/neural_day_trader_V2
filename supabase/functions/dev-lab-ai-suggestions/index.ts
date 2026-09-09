/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  DEV LAB — SUGESTÕES DA IA PARA DESENVOLVIMENTO                    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Seção nova do Dev Lab (menu Sistema): ambiente onde a IA sugere melhorias
 * pra própria plataforma. Diferente da aba "Pesquisas de concorrente"
 * (source_type AI_RESEARCH) — aquela exige evidência real de concorrente
 * (site/changelog/URL); esta aqui é OPINIÃO do modelo sobre o produto,
 * marcada como tal (source_type AI_SUGGESTION) e nunca apresentada como
 * fato comprovado — por isso não carrega `evidence`/`competitor_url`.
 *
 * Chamada só pelo usuário autenticado (browser), 1 clique = 1 rodada de N
 * sugestões novas, inseridas direto em dev_lab_suggestions.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getServiceClient } from './lib/serviceClient.ts';
import { completeText } from './lib/llmClient.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_CATEGORIES = [
  'TECH', 'DESIGN_UX', 'FEATURE', 'COMPETITION', 'INNOVATION',
  'BUG', 'OPTIMIZATION', 'GROWTH_MARKETING', 'MONETIZATION', 'AI_BRAIN',
] as const;
const ALLOWED_IMPACT = ['HIGH', 'MEDIUM', 'LOW'] as const;
const ALLOWED_EFFORT = ['HIGH', 'MEDIUM', 'LOW'] as const;

const SYSTEM_PROMPT = `Você é um consultor sênior de produto e engenharia para um SaaS de \
trading quantitativo intraday (React/TS/Vite + Supabase + MetaAPI/MT5, um "AI Trader" que \
opera automaticamente e um cérebro de decisão baseado em LLM). O produto já passou por \
pesquisa própria que NÃO encontrou edge estatístico comprovado em sinal técnico clássico — \
o cérebro de trading é hoje de execução/disciplina de risco, não de alfa. \
Sua tarefa: propor melhorias REAIS e ACIONÁVEIS para a plataforma (produto, UX, \
monetização, growth, arquitetura, ou o próprio cérebro de IA de trading) — nunca invente \
métricas, benchmarks ou dados de concorrente que você não tem certeza de que são reais; se \
não tiver certeza, formule a sugestão como hipótese a validar, não como fato. \
Responda APENAS com um array JSON válido, sem markdown, sem texto fora do array, no formato:
[{"title": "string curto", "description": "2-4 frases explicando o que fazer e por quê", \
"reasoning": "1-2 frases de racional/risco", "category": "uma de TECH|DESIGN_UX|FEATURE|\
COMPETITION|INNOVATION|BUG|OPTIMIZATION|GROWTH_MARKETING|MONETIZATION|AI_BRAIN", \
"impact": "HIGH|MEDIUM|LOW", "effort": "HIGH|MEDIUM|LOW"}]`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: CORS_HEADERS });
    }
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: CORS_HEADERS });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const focus = typeof body?.focus === 'string' ? body.focus.trim().slice(0, 500) : '';
    const rawCount = Number(body?.count);
    const count = Number.isFinite(rawCount) ? Math.min(20, Math.max(1, Math.round(rawCount))) : 20;
    const userMessage = focus
      ? `Gere ${count} sugestõe(s) nova(s), priorizando este foco pedido pelo usuário: "${focus}".`
      : `Gere ${count} sugestõe(s) nova(s) cobrindo áreas variadas da plataforma (não repita o mesmo tema).`;

    // ~180 tokens por sugestão em JSON (título+descrição+racional) — 20
    // sugestões precisam de bem mais que o teto antigo de 2000, que cortava
    // o array no meio e quebrava o parse.
    const maxTokens = Math.min(8000, 500 + count * 300);
    const raw = await completeText({ system: SYSTEM_PROMPT, userMessage, maxTokens });

    let parsed: unknown;
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta do modelo não veio em JSON válido', raw: raw.slice(0, 500) }), { status: 502, headers: CORS_HEADERS });
    }
    if (!Array.isArray(parsed)) {
      return new Response(JSON.stringify({ error: 'Resposta do modelo não é um array' }), { status: 502, headers: CORS_HEADERS });
    }

    const rows = parsed
      .filter((item: any) => item && typeof item.title === 'string' && typeof item.description === 'string')
      .slice(0, count)
      .map((item: any) => ({
        user_id: userId,
        title: String(item.title).slice(0, 200),
        description: String(item.description).slice(0, 2000),
        full_analysis: typeof item.reasoning === 'string' ? item.reasoning.slice(0, 2000) : null,
        category: ALLOWED_CATEGORIES.includes(item.category) ? item.category : 'INNOVATION',
        impact: ALLOWED_IMPACT.includes(item.impact) ? item.impact : 'MEDIUM',
        effort: ALLOWED_EFFORT.includes(item.effort) ? item.effort : 'MEDIUM',
        status: 'active',
        tags: ['ia'],
        source_type: 'AI_SUGGESTION',
        competitor_name: null,
        competitor_url: null,
        evidence: null,
        research_run_id: null,
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Modelo não retornou nenhuma sugestão válida' }), { status: 502, headers: CORS_HEADERS });
    }

    const svc = getServiceClient();
    const { data: inserted, error: insertErr } = await svc
      .from('dev_lab_suggestions')
      .insert(rows)
      .select();
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ suggestions: inserted }), { status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
  } catch (error: any) {
    console.error('[dev-lab-ai-suggestions] Erro:', error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), { status: 500, headers: CORS_HEADERS });
  }
});
