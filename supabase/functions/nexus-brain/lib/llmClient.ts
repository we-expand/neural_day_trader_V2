/**
 * Client de LLM do NEXUS — abstrai o provedor atrás de uma única função
 * (`runAgent`), pra trocar de fornecedor sem tocar em index.ts nem no resto
 * do app.
 *
 * Default trocado em 2026-08-25 de Groq pra NVIDIA NIM (Nemotron 3 Ultra,
 * 55B ativos/550B total MoE) — pedido do Cleber. Groq e Anthropic seguem
 * disponíveis, trocáveis via secret `LLM_PROVIDER` ('nvidia' | 'groq' |
 * 'anthropic') via `supabase secrets set` — nenhum deploy de código novo
 * necessário pra essa troca.
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

// NVIDIA NIM (build.nvidia.com) — API OpenAI-compatible, mesmo formato de
// tool calling do Groq. Pedido do Cleber em 2026-08-25: trocar o provedor
// default de Groq pra NVIDIA. Primeira tentativa foi Nemotron 3 Ultra (55B
// ativos / 550B total) — medido ao vivo em ~28s de ponta a ponta mesmo com
// enable_thinking desligado, inviável pra chat em tempo real (API padrão
// NIM não tem infra dedicada de baixa latência tipo a LPU da Groq).
// Trocado pra Nemotron 3 Nano (3B ativos / 30B total) no mesmo dia — é o
// membro da família desenhado especificamente pra chat/tool-calling
// interativo (~94 tok/s, TTFT ~0.45s), 18x menor que a Ultra. Super
// (12B ativos / 120B total) fica como meio-termo se a Nano decepcionar em
// qualidade — trocável via secret NVIDIA_MODEL sem novo deploy.
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL_DEFAULT = 'nvidia/nemotron-3-nano-30b-a3b';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

const MAX_TOOL_ROUNDS = 4; // trava de segurança — evita loop de tool-call sem fim por erro do modelo

// Formato OpenAI-compatible (chat completions + tool calling) — comum a
// Groq e NVIDIA NIM. Parametrizado por provedor pra reaproveitar entre os
// dois sem duplicar o loop de tool-use.
async function runOpenAICompatAgent(
  params: RunAgentParams,
  opts: { providerLabel: string; url: string; apiKey: string; model: string; extraBody?: Record<string, unknown> },
): Promise<string> {
  const openaiTools = params.tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  const messages: any[] = [
    { role: 'system', content: params.system },
    ...params.messages,
  ];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(opts.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: params.maxTokens ?? 500,
        messages,
        tools: openaiTools,
        ...opts.extraBody,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`[nexus-brain] ${opts.providerLabel} API ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error(`[nexus-brain] Resposta da ${opts.providerLabel} sem message.`);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      if (!message.content) throw new Error(`[nexus-brain] Resposta da ${opts.providerLabel} sem texto nem tool_calls.`);
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
  throw new Error(`[nexus-brain] Excedeu limite de chamadas de ferramenta (${opts.providerLabel}) sem resposta final.`);
}

async function runGroqAgent(params: RunAgentParams): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    throw new Error('[nexus-brain] GROQ_API_KEY ausente no ambiente (supabase secrets set).');
  }
  return runOpenAICompatAgent(params, {
    providerLabel: 'Groq',
    url: GROQ_API_URL,
    apiKey,
    model: Deno.env.get('GROQ_MODEL') || GROQ_MODEL_DEFAULT,
  });
}

async function runNvidiaAgent(params: RunAgentParams): Promise<string> {
  const apiKey = Deno.env.get('NVIDIA_API_KEY');
  if (!apiKey) {
    throw new Error('[nexus-brain] NVIDIA_API_KEY ausente no ambiente (supabase secrets set).');
  }
  // Toda a família Nemotron 3 é modelo unificado de raciocínio — por padrão
  // gera "thinking" interno antes de responder. Na Ultra isso mediu ~28s de
  // ponta a ponta em produção (2026-08-25), inviável pra chat em tempo
  // real; mantido desligado por padrão pra qualquer modelo da família.
  // Reativável via secret NVIDIA_ENABLE_THINKING=true se algum dia fizer
  // sentido trocar velocidade por raciocínio mais profundo.
  const enableThinking = Deno.env.get('NVIDIA_ENABLE_THINKING') === 'true';
  return runOpenAICompatAgent(params, {
    providerLabel: 'NVIDIA',
    url: NVIDIA_API_URL,
    apiKey,
    model: Deno.env.get('NVIDIA_MODEL') || NVIDIA_MODEL_DEFAULT,
    extraBody: { chat_template_kwargs: { enable_thinking: enableThinking } },
  });
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
  // Default trocado de 'groq' pra 'nvidia' em 2026-08-25 (pedido do
  // Cleber: testar/usar Nemotron 3 Ultra no lugar da Groq). Pra voltar pra
  // Groq sem novo deploy, basta `supabase secrets set LLM_PROVIDER=groq`.
  const provider = (Deno.env.get('LLM_PROVIDER') || 'nvidia').toLowerCase();
  if (provider === 'anthropic') return runAnthropicAgent(params);
  if (provider === 'groq') return runGroqAgent(params);
  if (provider === 'nvidia') return runNvidiaAgent(params);
  throw new Error(`[nexus-brain] LLM_PROVIDER desconhecido: "${provider}" (use "nvidia", "groq" ou "anthropic").`);
}
