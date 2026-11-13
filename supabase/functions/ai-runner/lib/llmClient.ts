/**
 * Client de LLM do cérebro de decisão (modo sombra, 2026-08-28) — versão
 * enxuta do client do NEXUS (`nexus-brain/lib/llmClient.ts`), sem
 * tool-calling (aqui o contexto inteiro já vem pronto por quem chama, não
 * precisa de ida-e-volta com ferramenta). Duplicado em vez de importado
 * entre as duas Edge Functions de propósito — mesma convenção já usada
 * neste projeto pra `RANKING_BASKET` em `nexus-brain/lib/tools.ts`: cada
 * função Deno é empacotada isolada no deploy, e este projeto já convive
 * com esse tipo de duplicação em vez de import cruzado entre functions.
 *
 * Mesmos 3 provedores, mesma variável de ambiente `LLM_PROVIDER` do NEXUS
 * — reaproveita a MESMA secret já configurada em produção, sem exigir
 * configuração nova pra rodar o modo sombra.
 */

export interface DecisionBrainCompletion {
  text: string;
  provider: string;
  latencyMs: number;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-120b';

// Mesmo default do NEXUS — Nemotron 3 Nano é o membro da família validado
// em produção como rápido o suficiente (~94 tok/s, TTFT ~0.45s). A versão
// Ultra mediu ~28s de ponta a ponta, inviável dentro do orçamento de
// latência de um ciclo do ai-runner (TRADING_CYCLE_TICK_MS = 5s).
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL_DEFAULT = 'nvidia/nemotron-3-nano-30b-a3b';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

async function runOpenAICompat(
  system: string,
  userPrompt: string,
  maxTokens: number,
  opts: { providerLabel: string; url: string; apiKey: string; model: string; extraBody?: Record<string, unknown> },
): Promise<string> {
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      ...opts.extraBody,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[decisionBrain] ${opts.providerLabel} API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`[decisionBrain] Resposta da ${opts.providerLabel} sem texto.`);
  return content as string;
}

async function runGroq(system: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('[decisionBrain] GROQ_API_KEY ausente no ambiente.');
  return runOpenAICompat(system, userPrompt, maxTokens, {
    providerLabel: 'Groq', url: GROQ_API_URL, apiKey, model: Deno.env.get('GROQ_MODEL') || GROQ_MODEL_DEFAULT,
  });
}

async function runNvidia(system: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('NVIDIA_API_KEY');
  if (!apiKey) throw new Error('[decisionBrain] NVIDIA_API_KEY ausente no ambiente.');
  const enableThinking = Deno.env.get('NVIDIA_ENABLE_THINKING') === 'true';
  return runOpenAICompat(system, userPrompt, maxTokens, {
    providerLabel: 'NVIDIA', url: NVIDIA_API_URL, apiKey, model: Deno.env.get('NVIDIA_MODEL') || NVIDIA_MODEL_DEFAULT,
    extraBody: { chat_template_kwargs: { enable_thinking: enableThinking } },
  });
}

async function runAnthropic(system: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('[decisionBrain] ANTHROPIC_API_KEY ausente no ambiente.');
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[decisionBrain] Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const textBlock = (data?.content ?? []).find((b: any) => b.type === 'text');
  if (!textBlock?.text) throw new Error('[decisionBrain] Resposta da Anthropic sem bloco de texto.');
  return textBlock.text as string;
}

/** Completion de tiro único, sem tool-calling. Lança em qualquer falha — quem chama decide o fallback (nunca decide silenciosamente no lugar do motor mecânico). */
export async function runDecisionBrainCompletion(system: string, userPrompt: string, maxTokens = 600): Promise<DecisionBrainCompletion> {
  const provider = (Deno.env.get('LLM_PROVIDER') || 'nvidia').toLowerCase();
  const start = Date.now();
  let text: string;
  if (provider === 'anthropic') text = await runAnthropic(system, userPrompt, maxTokens);
  else if (provider === 'groq') text = await runGroq(system, userPrompt, maxTokens);
  else if (provider === 'nvidia') text = await runNvidia(system, userPrompt, maxTokens);
  else throw new Error(`[decisionBrain] LLM_PROVIDER desconhecido: "${provider}".`);
  return { text, provider, latencyMs: Date.now() - start };
}
