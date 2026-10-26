/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEXUS-BRAIN — motor de linguagem do assistente de day trade       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Não existia nenhuma chamada de LLM real no projeto antes desta function.
 * Recebe um `contextPackage` JÁ MONTADO com dado real (preço, indicadores,
 * portfólio, calendário, notícia) — nunca busca dado por conta própria e
 * nunca aceita texto livre como "verdade": tudo que o NEXUS pode afirmar
 * precisa estar no `contextPackage`, disciplina imposta no system prompt
 * (ver lib/systemPrompt.ts).
 *
 * Dois modos de chamada:
 *  - Usuário autenticado (browser): header `Authorization: Bearer <jwt>` do
 *    próprio usuário. Usado pela tela NEXUS para pergunta livre + narração.
 *  - Servidor (ai-runner, tick proativo): header `x-nexus-secret` com
 *    `NEXUS_SHARED_SECRET`, e `userId` explícito no corpo. Usado pelo tick
 *    de alerta proativo (Fase 2) — nunca chamado a partir do browser.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getServiceClient } from './lib/serviceClient.ts';
import { runAgent } from './lib/llmClient.ts';
import { buildSystemPrompt } from './lib/systemPrompt.ts';
import { getToolDefinitions, executeTool } from './lib/tools.ts';

interface RequestBody {
  userId?: string;
  question?: string;
  contextPackage: Record<string, unknown>;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

// Chamado direto do navegador (JWT do usuário) — sem CORS aqui, todo fetch
// do NexusVoiceAssistant falha antes mesmo de chegar no auth. Confirmado em
// produção: log mostrava `OPTIONS | 405` pra cada tentativa (2026-08-25).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-nexus-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function resolveUserId(req: Request): Promise<string | null> {
  const sharedSecret = Deno.env.get('NEXUS_SHARED_SECRET');
  const providedSecret = req.headers.get('x-nexus-secret');
  if (sharedSecret && providedSecret && providedSecret === sharedSecret) {
    // Chamada servidor-a-servidor (ai-runner) — userId vem explícito no corpo.
    return null; // sinaliza "modo servidor", resolvido pelo chamador via body.userId
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return undefined as unknown as string; // força erro abaixo

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return undefined as unknown as string;
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.contextPackage) {
      return new Response(JSON.stringify({ error: 'contextPackage é obrigatório' }), { status: 400, headers: CORS_HEADERS });
    }

    const sharedSecret = Deno.env.get('NEXUS_SHARED_SECRET');
    const providedSecret = req.headers.get('x-nexus-secret');
    const isServerCall = !!sharedSecret && providedSecret === sharedSecret;

    let userId: string | null;
    if (isServerCall) {
      if (!body.userId) {
        return new Response(JSON.stringify({ error: 'userId obrigatório em chamada servidor-a-servidor' }), { status: 400, headers: CORS_HEADERS });
      }
      userId = body.userId;
    } else {
      userId = await resolveUserId(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: CORS_HEADERS });
      }
    }

    const question = body.question?.trim();
    const contextBlock = `CONTEXTO_REAL (JSON, única fonte de dado permitida):\n${JSON.stringify(body.contextPackage, null, 2)}`;

    const userTurn = question
      ? `${contextBlock}\n\nPERGUNTA DO USUÁRIO: ${question}`
      : `${contextBlock}\n\nNão há pergunta do usuário agora — gere uma narração proativa curta (2-4 frases) destacando o que há de mais relevante no CONTEXTO_REAL acima (risco de calendário, notícia recente, ou estado da posição aberta). Se nada relevante estiver presente, diga isso objetivamente em uma frase.`;

    const messages = [
      ...(body.history ?? []),
      { role: 'user' as const, content: userTurn },
    ];

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const text = await runAgent({
      system: buildSystemPrompt(),
      messages,
      maxTokens: 500,
      tools: getToolDefinitions(),
      executeTool: (name, input) => executeTool(name, input, { userId, supabaseUrl, anonKey }),
    });

    // Registro leve para auditoria — reaproveita o mesmo service client que
    // o tick proativo (Fase 2) usa para gravar nexus_alerts.
    try {
      const svc = getServiceClient();
      await svc.from('nexus_interactions').insert({
        user_id: userId,
        question: question ?? null,
        response: text,
        source: isServerCall ? 'server_proactive' : 'user_chat',
      });
    } catch (auditErr) {
      // Auditoria nunca deve derrubar a resposta ao usuário.
      console.error('[nexus-brain] Falha ao gravar nexus_interactions (não bloqueante):', auditErr);
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[nexus-brain] Erro:', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro interno' }), { status: 500, headers: CORS_HEADERS });
  }
});
