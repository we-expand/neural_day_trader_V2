// Fase 4 -- "Juiz Final". Novo papel da LLM (Ollama) na arquitetura
// Fail-Fast: quando o payload chega aqui, o trade já passou por Fases 1-3
// (estado, risco, technicalScore >= corte) -- a LLM não precisa mais gastar
// tokens checando spread/cooldown/MACD/momentum, só valida:
//   1. Contradição textual (reasoning vs direção do trade)
//   2. Leitura de candle (padrão citado condiz com a direção)
//   3. Volatilidade/risco (VIX/ATR pedem confirmação extra?)
//   4. Confiança final (Go/No-Go), sabendo que o pipeline já exige piso
//      mínimo em stage4_llmValidator.ts (70% útil / 60% fds + VIX)
//
// Reusa o MESMO client/config do validador semântico já em produção
// (reasoningValidator.ts) -- não cria um provedor/chave novo.

import OpenAI from "openai";
import { config } from "../config";

const judgeClient = new OpenAI({
  apiKey: config.llmApiKey,
  baseURL: config.llmBaseUrl,
});

const SYSTEM_PROMPT = `Você é o NexusT (Neural Day Trader), um agente quantitativo de decisão final.
O trade submetido a você JÁ FOI APROVADO pelos motores de Risco e Matemática Técnica.
O Technical Score atual é {technical_score}/100.

Sua função é realizar a validação semântica e contextual final antes da execução.

REGRAS DE AVALIAÇÃO:
1. Contradição Textual: Se o 'reasoning' descreve um mercado de ALTA, mas a direção do trade é SHORT (ou vice-versa), REJEITE.
2. Leitura de Candle: Verifique se o padrão de candle citado no reasoning condiz com o contexto e a direção do trade.
3. Volatilidade e Risco (ATR/VIX): Avalie o ambiente. Se o VIX estiver elevado/alto, exija uma confirmação mais estrita antes de aprovar.
4. Confiança: Atribua um score de 0 a 100 refletindo sua convicção real na coerência do setup -- não infle o número só para passar do piso mínimo.

Responda ÚNICA E EXCLUSIVAMENTE com um objeto JSON válido, sem markdown ou texto adicional, seguindo estritamente o schema abaixo.`;

export interface LlmJudgePayload {
  symbol: string;
  direction: "LONG" | "SHORT";
  setupType: string;
  technicalScore: number;
  marketContext: {
    vixRegime: string | null;
    currentAtr: number;
    trendConsensus: string;
  };
  proposedReasoning: string;
}

export interface LlmJudgeVerdict {
  approved: boolean;
  confidence: number;
  rejectionReason: string | null;
  executionRecommendation: {
    aggressiveness: "conservative" | "aggressive";
    trailingStopProfile: "tight" | "normal" | "wide";
  } | null;
  remarks: string;
}

function buildUserPrompt(payload: LlmJudgePayload): string {
  return JSON.stringify(
    {
      symbol: payload.symbol,
      direction: payload.direction,
      setup_type: payload.setupType,
      technical_score: payload.technicalScore,
      market_context: {
        vix_regime: payload.marketContext.vixRegime,
        current_atr: payload.marketContext.currentAtr,
        trend_consensus: payload.marketContext.trendConsensus,
      },
      proposed_reasoning: payload.proposedReasoning,
    },
    null,
    2,
  );
}

// Fallback seguro (nunca adivinha intenção nem trava o sistema) quando o
// Ollama devolve JSON malformado -- comum em modelos locais menores.
const PARSE_ERROR_VERDICT: LlmJudgeVerdict = {
  approved: false,
  confidence: 0,
  rejectionReason: "LLM Parse Error",
  executionRecommendation: null,
  remarks: "Resposta do Ollama não pôde ser interpretada como JSON válido -- rejeitado por segurança.",
};

export async function judgeTradeWithLlm(payload: LlmJudgePayload): Promise<LlmJudgeVerdict> {
  const systemPrompt = SYSTEM_PROMPT.replace("{technical_score}", String(payload.technicalScore));

  let raw: string | null = null;
  try {
    const response = await judgeClient.chat.completions.create({
      model: config.llmModel,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserPrompt(payload) },
      ],
    });
    raw = response.choices[0]?.message?.content ?? null;
  } catch {
    return PARSE_ERROR_VERDICT;
  }

  if (!raw) return PARSE_ERROR_VERDICT;

  try {
    // Modelos locais às vezes envolvem o JSON em ```json ... ``` mesmo
    // quando instruídos a não fazer isso -- limpeza mínima antes do parse.
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.approved !== "boolean" || typeof parsed.confidence !== "number") {
      return PARSE_ERROR_VERDICT;
    }

    return {
      approved: parsed.approved,
      confidence: Math.max(0, Math.min(100, parsed.confidence)),
      rejectionReason: parsed.rejection_reason ?? null,
      executionRecommendation: parsed.execution_recommendation ?? null,
      remarks: parsed.remarks ?? "",
    };
  } catch {
    return PARSE_ERROR_VERDICT;
  }
}
