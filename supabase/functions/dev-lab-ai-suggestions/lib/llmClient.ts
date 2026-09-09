/**
 * Client de LLM enxuto (texto puro, sem tool-use) pro Dev Lab — Sugestões
 * da IA. Mesmos 3 provedores/secrets do nexus-brain (`LLM_PROVIDER`,
 * `NVIDIA_API_KEY`/`GROQ_API_KEY`/`ANTHROPIC_API_KEY`), sem duplicar o loop
 * de tool-calling porque esta function não usa ferramenta nenhuma — só pede
 * um JSON de sugestões em uma única chamada.
 */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-120b';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL_DEFAULT = 'nvidia/nemotron-3-nano-30b-a3b';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

interface CompleteParams {
  system: string;
  userMessage: string;
  maxTokens?: number;
}

async function completeOpenAICompat(
  params: CompleteParams,
  opts: { providerLabel: string; url: string; apiKey: string; model: string; extraBody?: Record<string, unknown> },
): Promise<string> {
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: params.maxTokens ?? 2000,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.userMessage },
      ],
      ...opts.extraBody,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[dev-lab-ai-suggestions] ${opts.providerLabel} API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`[dev-lab-ai-suggestions] Resposta da ${opts.providerLabel} sem texto.`);
  return content as string;
}

async function completeAnthropic(params: CompleteParams): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('[dev-lab-ai-suggestions] ANTHROPIC_API_KEY ausente no ambiente.');
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: params.maxTokens ?? 2000,
      system: params.system,
      messages: [{ role: 'user', content: params.userMessage }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[dev-lab-ai-suggestions] Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const textBlock = (data?.content ?? []).find((b: any) => b.type === 'text');
  if (!textBlock?.text) throw new Error('[dev-lab-ai-suggestions] Resposta da Anthropic sem bloco de texto.');
  return textBlock.text as string;
}

export async function completeText(params: CompleteParams): Promise<string> {
  const provider = (Deno.env.get('LLM_PROVIDER') || 'nvidia').toLowerCase();
  if (provider === 'anthropic') return completeAnthropic(params);
  if (provider === 'groq') {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('[dev-lab-ai-suggestions] GROQ_API_KEY ausente no ambiente.');
    return completeOpenAICompat(params, {
      providerLabel: 'Groq', url: GROQ_API_URL, apiKey, model: Deno.env.get('GROQ_MODEL') || GROQ_MODEL_DEFAULT,
    });
  }
  if (provider === 'nvidia') {
    const apiKey = Deno.env.get('NVIDIA_API_KEY');
    if (!apiKey) throw new Error('[dev-lab-ai-suggestions] NVIDIA_API_KEY ausente no ambiente.');
    const enableThinking = Deno.env.get('NVIDIA_ENABLE_THINKING') === 'true';
    return completeOpenAICompat(params, {
      providerLabel: 'NVIDIA', url: NVIDIA_API_URL, apiKey, model: Deno.env.get('NVIDIA_MODEL') || NVIDIA_MODEL_DEFAULT,
      extraBody: { chat_template_kwargs: { enable_thinking: enableThinking } },
    });
  }
  throw new Error(`[dev-lab-ai-suggestions] LLM_PROVIDER desconhecido: "${provider}".`);
}
