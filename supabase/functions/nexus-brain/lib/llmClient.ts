/**
 * Client de LLM do NEXUS — abstrai o provedor atrás de uma única função
 * (`callLLM`), pra trocar de fornecedor sem tocar em index.ts nem no resto
 * do app.
 *
 * Começa em Groq (free tier, sem cartão) pra validar o produto de pé sem
 * custo. Troca pra Anthropic (paga, melhor qualidade) só mudando a secret
 * `LLM_PROVIDER` pra 'anthropic' via `supabase secrets set` — nenhum deploy
 * de código novo necessário pra essa troca.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallLLMParams {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

async function callGroq(params: CallLLMParams): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    throw new Error('[nexus-brain] GROQ_API_KEY ausente no ambiente (supabase secrets set).');
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: params.maxTokens ?? 500,
      messages: [{ role: 'system', content: params.system }, ...params.messages],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[nexus-brain] Groq API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('[nexus-brain] Resposta da Groq sem texto.');
  }
  return text as string;
}

async function callAnthropic(params: CallLLMParams): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('[nexus-brain] ANTHROPIC_API_KEY ausente no ambiente (supabase secrets set).');
  }

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
      messages: params.messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[nexus-brain] Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const textBlock = (data?.content ?? []).find((b: any) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('[nexus-brain] Resposta da Anthropic sem bloco de texto.');
  }
  return textBlock.text as string;
}

export async function callLLM(params: CallLLMParams): Promise<string> {
  // Default 'groq' de propósito: enquanto a secret LLM_PROVIDER não for
  // setada, o NEXUS já funciona no provedor gratuito sem nenhuma ação extra.
  const provider = (Deno.env.get('LLM_PROVIDER') || 'groq').toLowerCase();
  if (provider === 'anthropic') return callAnthropic(params);
  if (provider === 'groq') return callGroq(params);
  throw new Error(`[nexus-brain] LLM_PROVIDER desconhecido: "${provider}" (use "groq" ou "anthropic").`);
}
