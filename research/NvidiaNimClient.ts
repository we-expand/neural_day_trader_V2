/**
 * Cliente mínimo pra NVIDIA NIM API serverless (build.nvidia.com), endpoint
 * OpenAI-compatible. Reusado pelos experimentos que testam ferramentas NVIDIA
 * (Trilho 2 / cuOpt) — ver research/AI_BRAIN_SPEC.md seção 13.
 *
 * Papel estrito aqui: gerar/triar hipóteses de sinal ou resolver otimização
 * (cuOpt), nunca validar. Validação estatística de qualquer saída desta
 * chamada continua 100% local (DeflatedSharpe.ts, DataSplit.ts, CostModel.ts)
 * — ver research/CRITERIA.md, "nunca prometer edge sem validação estatística".
 *
 * Requer NVIDIA_API_KEY no ambiente (Cleber cria em build.nvidia.com,
 * tier serverless gratuito/pay-per-use). Sem a chave, lança erro explícito —
 * nunca fabrica resposta.
 */

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

function requireApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error(
      'NVIDIA_API_KEY ausente no ambiente. Crie uma chave em https://build.nvidia.com ' +
        'e exporte NVIDIA_API_KEY antes de rodar este experimento — sem chave real, ' +
        'este script não roda (sem dado real = SEM DADO REAL).',
    );
  }
  return key;
}

export interface NimChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NimChatOptions {
  model: string;
  messages: NimChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export async function nimChatCompletion(options: NimChatOptions): Promise<string> {
  const apiKey = requireApiKey();
  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NVIDIA NIM API retornou ${response.status}: ${body}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(`Resposta da NIM API em formato inesperado: ${JSON.stringify(json)}`);
  }
  return content;
}
