/**
 * Client de LLM do NEXUS — abstrai o provedor atrás de uma única função
 * (`runAgent`), pra trocar de fornecedor sem tocar em index.ts nem no resto
 * do app.
 *
 * Começa em Groq (free tier, sem cartão) pra validar o produto de pé sem
 * custo. Troca pra Anthropic (paga, melhor qualidade) só mudando a secret
 * `LLM_PROVIDER` pra 'anthropic' via `supabase secrets set` — nenhum deploy
 * de código novo necessário pra essa troca.
 *
 * 2026-08-25: `callLLM` (texto puro) virou `runAgent` (tool-use) — pedido
 * explícito e repetido do Cleber de que o NEXUS precisa estar "conectado a
 * tudo que a plataforma tem", não travado num contextPackage de 1 símbolo
 * montado antes da pergunta chegar. Ambos os provedores suportam tool
 * calling nativamente (Groq é compatível com o formato OpenAI), então o
 * loop é implementado pros dois, não só pro Anthropic.
 */
import type { ToolDef } from './tools.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RunAgentParams {
  system: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  maxTokens?: number;
  executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Nem 'llama-3.3-70b-versatile' nem 'llama-3.1-8b-instant' existem no
// catálogo da conta Groq do Cleber (confirmado via GET /v1/models em
// produção 2026-08-25 — a conta só tem acesso a um conjunto restrito de
// modelos, sem a família Llama). 'openai/gpt-oss-120b' é o modelo de texto
// mais forte que apareceu na lista real, e suporta tool calling. Trocável
// via secret GROQ_MODEL sem novo deploy, já que a Groq muda catálogo com
// regularidade.
const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-120b';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

const MAX_TOOL_ROUNDS = 4; // trava de segurança — evita loop de tool-call sem fim por erro do modelo

async function runGroqAgent(params: RunAgentParams): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    throw new Error('[nexus-brain] GROQ_API_KEY ausente no ambiente (supabase secrets set).');
  }

  const openaiTools = params.tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  const messages: any[] = [
    { role: 'system', content: params.system },
    ...params.messages,
  ];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: Deno.env.get('GROQ_MODEL') || GROQ_MODEL_DEFAULT,
        max_tokens: params.maxTokens ?? 500,
        messages,
        tools: openaiTools,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`[nexus-brain] Groq API ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error('[nexus-brain] Resposta da Groq sem message.');

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      if (!message.content) throw new Error('[nexus-brain] Resposta da Groq sem texto nem tool_calls.');
      return message.content as string;
    }

    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      let toolResult: unknown;
      try {
        const input = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        toolResult = await params.executeTool(call.function.name, input);
      } catch (toolErr: any) {
        toolResult = { error: toolErr?.message ?? String(toolErr) };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) });
    }
  }
  throw new Error('[nexus-brain] Excedeu limite de chamadas de ferramenta (Groq) sem resposta final.');
}

async function runAnthropicAgent(params: RunAgentParams): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('[nexus-brain] ANTHROPIC_API_KEY ausente no ambiente (supabase secrets set).');
  }

  const anthropicTools = params.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const messages: any[] = params.messages.map((m) => ({ role: m.role, content: m.content }));

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: params.maxTokens ?? 500,
        system: params.system,
        messages,
        tools: anthropicTools,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`[nexus-brain] Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    const content = data?.content ?? [];
    const toolUseBlocks = content.filter((b: any) => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      const textBlock = content.find((b: any) => b.type === 'text');
      if (!textBlock?.text) throw new Error('[nexus-brain] Resposta da Anthropic sem bloco de texto.');
      return textBlock.text as string;
    }

    messages.push({ role: 'assistant', content });
    const toolResults = [];
    for (const block of toolUseBlocks) {
      let toolResult: unknown;
      try {
        toolResult = await params.executeTool(block.name, block.input ?? {});
      } catch (toolErr: any) {
        toolResult = { error: toolErr?.message ?? String(toolErr) };
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(toolResult) });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  throw new Error('[nexus-brain] Excedeu limite de chamadas de ferramenta (Anthropic) sem resposta final.');
}

export async function runAgent(params: RunAgentParams): Promise<string> {
  // Default 'groq' de propósito: enquanto a secret LLM_PROVIDER não for
  // setada, o NEXUS já funciona no provedor gratuito sem nenhuma ação extra.
  const provider = (Deno.env.get('LLM_PROVIDER') || 'groq').toLowerCase();
  if (provider === 'anthropic') return runAnthropicAgent(params);
  if (provider === 'groq') return runGroqAgent(params);
  throw new Error(`[nexus-brain] LLM_PROVIDER desconhecido: "${provider}" (use "groq" ou "anthropic").`);
}
