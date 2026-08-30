import OpenAI from "openai";
import { config } from "./config.js";

// 🔴 2026-08-30 (pedido do Cleber, mesma sessao do redesenho de risco): a
// trava de palavra-chave em tools.ts (NEGATION_CUES/REVERSAL_CUES) e
// whack-a-mole -- 3 variacoes diferentes de contradicao ("como teste",
// "ainda nao ocorreu", "nao ha razao para entrar") apareceram na MESMA
// sessao real e precisaram ser adicionadas uma a uma. Uma lista fixa nunca
// cobre todas as formas possiveis do modelo se contradizer em linguagem
// natural. Esta camada roda DEPOIS da trava de palavra-chave (so quando ela
// nao bloqueou) e usa uma segunda chamada de LLM barata/rapida so pra
// perguntar se o reasoning contradiz a acao -- validacao semantica, nao mais
// uma lista de frases.

export interface ConsistencyCheck {
  consistent: boolean; // true = ok, pode prosseguir. false = contradicao detectada, bloquear.
  note?: string; // motivo curto, so quando consistent=false, pra devolver no erro pro modelo principal.
}

// 🔴 2026-08-30: cliente separado do `client` de agent.ts (mesmo padrao
// OpenAI-compatible, mesma API key/baseURL do provedor principal -- nao
// existe hoje, em nenhum lugar do projeto, um provedor configurado
// obviamente mais barato/rapido que o principal para reusar aqui). Modelo
// efetivamente usado e configuravel via MT5_REASONING_VALIDATOR_MODEL
// (config.mt5ReasoningValidatorModel) -- default cai pro mesmo modelo do
// cerebro principal (config.llmModel) como fail-safe. Limitacao conhecida:
// isso NAO garante ser mais barato/rapido que a decisao principal, so mais
// barato quando um modelo diferente for configurado explicitamente.
const validatorClient = new OpenAI({
  apiKey: config.llmApiKey,
  baseURL: config.llmBaseUrl,
});

function buildPrompt(params: {
  actionKind: "open_position" | "close_position";
  symbol: string;
  side?: "LONG" | "SHORT";
  reasoning: string;
}): string {
  const acao =
    params.actionKind === "open_position"
      ? `abrir posicao ${params.side} em ${params.symbol}`
      : `fechar posicao em ${params.symbol}`;

  return `Voce e um verificador de consistencia para um sistema de trading automatizado. Sua UNICA tarefa e dizer se o RACIOCINIO abaixo CONTRADIZ a ACAO que esta prestes a ser executada.

Contradicao = o raciocinio afirma que falta confirmacao, que nao ha razao pra agir, que o sinal e fraco/insuficiente, que seria melhor esperar, ou qualquer coisa equivalente a "eu nao deveria fazer isso agora" -- e mesmo assim a acao abaixo esta prestes a acontecer.

NAO e contradicao: o raciocinio mencionar riscos, ressalvas ou fatores desfavoraveis MENORES como parte de uma analise equilibrada que ainda conclui a favor da acao. So marque contradicao quando a conclusao implicita do proprio texto for CONTRA a acao, nao a favor dela.

ACAO: ${acao}

RACIOCINIO: "${params.reasoning}"

Responda APENAS com um JSON valido, sem nenhum texto antes ou depois: {"contradiction": true ou false, "why": "motivo em 1 frase curta, so se contradiction=true, senao string vazia"}`;
}

export async function checkReasoningConsistency(params: {
  actionKind: "open_position" | "close_position";
  symbol: string;
  side?: "LONG" | "SHORT";
  reasoning: string;
}): Promise<ConsistencyCheck> {
  if (!config.mt5ReasoningValidatorEnabled) {
    return { consistent: true };
  }

  try {
    const response = await validatorClient.chat.completions.create(
      {
        model: config.mt5ReasoningValidatorModel,
        temperature: 0,
        max_tokens: 150,
        messages: [{ role: "user", content: buildPrompt(params) }],
      },
      // 🔴 2026-08-30: timeout curto -- esta validacao secundaria NUNCA pode
      // travar o ciclo principal de trading por estar instavel (fail-open
      // sempre, ver catch abaixo).
      { signal: AbortSignal.timeout(8000) }
    );

    const raw = response.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      console.warn("[reasoningValidator] resposta vazia do modelo validador -- deixando passar (fail-open).");
      return { consistent: true };
    }

    // Alguns provedores/modelos envolvem o JSON em ```json ... ``` mesmo
    // quando instruidos a nao fazer isso -- extrai o objeto JSON bruto antes
    // de parsear, sem exigir que a resposta seja EXATAMENTE so o JSON.
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[reasoningValidator] resposta sem JSON reconhecivel -- deixando passar (fail-open). Resposta: ${raw.slice(0, 200)}`);
      return { consistent: true };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { contradiction?: unknown; why?: unknown };
    if (parsed.contradiction === true) {
      const why = typeof parsed.why === "string" && parsed.why.trim().length > 0
        ? parsed.why.trim()
        : "raciocinio parece argumentar contra a propria acao (validador semantico, sem motivo especifico retornado)";
      return { consistent: false, note: why };
    }

    return { consistent: true };
  } catch (err) {
    // 🔴 2026-08-30: FAIL-OPEN sempre -- timeout, API fora do ar, JSON
    // malformado, rate limit, campo ausente, qualquer erro. Mesma politica
    // deliberada ja documentada em tools.ts pra trava de palavra-chave:
    // prefere falso negativo (deixa passar reasoning ambiguo) a falso
    // positivo (bloquear entrada/saida valida por instabilidade de uma
    // segunda chamada de LLM).
    console.warn(`[reasoningValidator] erro na validacao semantica -- deixando passar (fail-open): ${err instanceof Error ? err.message : err}`);
    return { consistent: true };
  }
}
