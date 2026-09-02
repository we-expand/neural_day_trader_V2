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

export interface QuoteSnapshot {
  trendLabel: string | null;
  volumeElevated: boolean | null;
  macdLabel: string | null;
  stochasticLabel: string | null;
}

function buildPrompt(params: {
  actionKind: "open_position" | "close_position";
  symbol: string;
  side?: "LONG" | "SHORT";
  reasoning: string;
  realSnapshot?: QuoteSnapshot;
}): string {
  const acao =
    params.actionKind === "open_position"
      ? `abrir posicao ${params.side} em ${params.symbol}`
      : `fechar posicao em ${params.symbol}`;

  // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75 -- BTCUSD SHORT perdeu
  // $5,58 porque o reasoning da entrada afirmou "trend currently LOW, volume
  // elevated" quando o get_mt5_quote chamado no MESMO ciclo, pro MESMO
  // simbolo, tinha acabado de devolver trend LATERAL e volume.elevated=false):
  // sem o dado real aqui, o validador so consegue checar se o texto se
  // contradiz sozinho, nunca se ele inventa fatos. Quando disponivel, o
  // snapshot real da ultima cotacao entra no prompt e a definicao de
  // contradicao passa a incluir fatos inventados/invertidos.
  const snapshotBlock = params.realSnapshot
    ? `\n\nDADO REAL da ultima cotacao consultada para ${params.symbol} (fonte: get_mt5_quote, mesmo ciclo): ` +
      `tendencia=${params.realSnapshot.trendLabel ?? "indisponivel"}, ` +
      `volume_elevado=${params.realSnapshot.volumeElevated === null ? "indisponivel" : params.realSnapshot.volumeElevated ? "SIM" : "NAO"}, ` +
      `MACD=${params.realSnapshot.macdLabel ?? "indisponivel"}, ` +
      `estocastico=${params.realSnapshot.stochasticLabel ?? "indisponivel"}.`
    : "";

  return `Voce e um verificador de consistencia para um sistema de trading automatizado. Sua tarefa e dizer se o RACIOCINIO abaixo CONTRADIZ a ACAO que esta prestes a ser executada, EM QUALQUER UMA das duas formas abaixo.

FORMA 1 (autocontradicao): o raciocinio afirma que falta confirmacao, que nao ha razao pra agir, que o sinal e fraco/insuficiente, que seria melhor esperar, ou qualquer coisa equivalente a "eu nao deveria fazer isso agora" -- e mesmo assim a acao abaixo esta prestes a acontecer.

FORMA 2 (fato inventado ou invertido): quando o DADO REAL abaixo estiver presente, o raciocinio afirma uma tendencia, volume, MACD ou estocastico que CONTRADIZ DIRETAMENTE esse dado real (ex: raciocinio diz "tendencia de baixa"/"trend LOW" mas o dado real diz tendencia=ALTA; raciocinio diz "volume elevado" mas o dado real diz volume_elevado=NAO). So conte como contradicao de forma 2 quando a divergencia for clara e objetiva sobre um destes 4 campos -- nao invente contradicao por causa de nuance, sinonimo ou interpretacao razoavel do mesmo dado.

NAO e contradicao: o raciocinio mencionar riscos, ressalvas ou fatores desfavoraveis MENORES como parte de uma analise equilibrada que ainda conclui a favor da acao. So marque contradicao quando a conclusao implicita do proprio texto for CONTRA a acao (forma 1), ou quando ele afirmar um fato objetivamente errado sobre os 4 campos do dado real (forma 2).

ACAO: ${acao}

RACIOCINIO: "${params.reasoning}"${snapshotBlock}

Responda APENAS com um JSON valido, sem nenhum texto antes ou depois: {"contradiction": true ou false, "why": "motivo em 1 frase curta, so se contradiction=true, senao string vazia"}`;
}

export async function checkReasoningConsistency(params: {
  actionKind: "open_position" | "close_position";
  symbol: string;
  side?: "LONG" | "SHORT";
  reasoning: string;
  realSnapshot?: QuoteSnapshot;
}): Promise<ConsistencyCheck> {
  if (!config.mt5ReasoningValidatorEnabled) {
    return { consistent: true };
  }

  try {
    const response = await validatorClient.chat.completions.create(
      {
        model: config.mt5ReasoningValidatorModel,
        temperature: 0,
        // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, monitoramento pos-
        // deploy, 2a rodada): o default deste validador e o MESMO modelo
        // Nemotron (reasoning model) do cerebro principal -- ele gasta os
        // tokens pensando em texto livre ("We need to determine if...")
        // ANTES de emitir o JSON final. Com max_tokens:150 a resposta era
        // cortada no meio do raciocinio, nunca chegava no JSON, e 100% das
        // chamadas caiam no fail-open abaixo -- confirmado no log ao vivo
        // (toda linha "[reasoningValidator] resposta sem JSON reconhecivel"
        // da sessao, sem excecao, incluindo o caso real que deixou passar
        // "Confluencia insuficiente para abrir SHORT aqui" seguido do
        // open_position SHORT de verdade). A trava estava, na pratica,
        // sempre desligada. Elevado pra dar espaco pro raciocinio + JSON.
        max_tokens: 1500,
        // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, monitoramento pos-
        // deploy): confirmado repetidas vezes (5+) que so PEDIR JSON no
        // prompt nao basta -- o modelo frequentemente responde com texto
        // corrido ("We need to determine if there is a contradiction...")
        // em vez do JSON puro, caindo no fail-open por falta de match no
        // regex. response_format forca o provedor (quando suportado) a
        // devolver JSON valido de verdade, em vez de confiar so na obediencia
        // textual. Se o provedor/modelo nao suportar o parametro, a chamada
        // simplesmente falha e cai no MESMO catch fail-open de sempre --
        // seguro de tentar, sem downside novo.
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: buildPrompt(params) }],
      },
      // 🔴 2026-09-02: subido de 8s pra 20s. Medido ao vivo que o Ollama
      // local (mesmo modelo do ciclo principal, `-np 1` sem paralelismo)
      // pode levar 70s+ pra responder um prompt bem menor que este -- por
      // isso esta validacao agora vem DESLIGADA por default nessa config
      // (ver mt5ReasoningValidatorEnabled em config.ts), e so roda de
      // verdade quando um provedor/modelo mais rapido e configurado
      // explicitamente pra ela. 20s e uma folga razoavel pra esse caso, nao
      // uma promessa de que o Ollama local vai responder a tempo.
      { signal: AbortSignal.timeout(20000) }
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
