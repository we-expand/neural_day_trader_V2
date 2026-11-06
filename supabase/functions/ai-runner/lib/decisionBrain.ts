/**
 * Orquestrador do modo sombra do cérebro de decisão (2026-08-28).
 *
 * NUNCA influencia a decisão real do motor mecânico — chamado fire-and-
 * forget (sem await no caminho crítico, ver `runTradingCycle.ts`
 * `onDecisionPoint`) e qualquer falha aqui só vira uma linha de log com
 * `brain_error` preenchido, nunca propaga exceção pro motor real.
 *
 * Validação (ver plano): esta camada só pode ser avaliada PRA FRENTE — os
 * dados logados aqui viram estatística só depois de semanas de acúmulo
 * (Fase 1/2 do plano), nunca contra histórico (risco de vazamento
 * temporal do LLM, ver research/experiments/2026-08-23-custo-nao-cobrado-
 * e-poder/tradingagents-e-ml.md).
 */
import { runDecisionBrainCompletion } from './llmClient.ts';
import { buildDecisionBrainSystemPrompt, buildDecisionBrainUserPrompt, type DecisionBrainContext } from './decisionBrainPrompt.ts';
import { getServiceClient } from './serviceClient.ts';
import { fetchDecisionBrainHistorySummary } from './decisionBrainHistory.ts';

export interface DecisionBrainResult {
  action: 'PROCEED' | 'SKIP' | 'FLIP';
  side: 'LONG' | 'SHORT';
  confidence: number;
  reasoning: string;
}

interface ShadowLogParams {
  sessionId: string | null;
  userId: string;
  context: DecisionBrainContext;
  mechanicalAction: 'PROCEED' | 'REJECT';
  mechanicalStage: string | null;
  /** Ver comentário em `onDecisionPoint` (runTradingCycle.ts) — base do resultado hipotético (2026-08-29). */
  entryPriceSnapshot: number;
  atrSnapshot: number | null;
}

function parseBrainOutput(raw: string, strategySide: 'LONG' | 'SHORT'): DecisionBrainResult {
  // Modelos às vezes envolvem o JSON em crase de markdown mesmo quando
  // instruídos a não fazer isso — extrai o primeiro bloco {...} em vez de
  // exigir string exata, sem inventar campo que não veio.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Resposta sem JSON reconhecível: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]);
  if (!['PROCEED', 'SKIP', 'FLIP'].includes(parsed.action)) {
    throw new Error(`action inválida: ${JSON.stringify(parsed.action)}`);
  }
  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 100) {
    throw new Error(`confidence inválida: ${JSON.stringify(parsed.confidence)}`);
  }
  if (typeof parsed.reasoning !== 'string' || parsed.reasoning.trim().length === 0) {
    throw new Error('reasoning ausente ou vazio');
  }
  const side = parsed.action === 'FLIP' ? (strategySide === 'LONG' ? 'SHORT' : 'LONG') : strategySide;
  return { action: parsed.action, side, confidence: parsed.confidence, reasoning: parsed.reasoning.trim() };
}

/**
 * Roda o cérebro sombra pra um candidato e grava o resultado (sucesso ou
 * falha) na tabela de auditoria. Nunca lança — o chamador (fire-and-forget)
 * não precisa (nem deve) tratar erro daqui.
 */
export async function runShadowDecisionAndLog(params: ShadowLogParams): Promise<void> {
  const { sessionId, userId, context, mechanicalAction, mechanicalStage, entryPriceSnapshot, atrSnapshot } = params;
  const sb = getServiceClient();

  const baseRow = {
    session_id: sessionId,
    user_id: userId,
    symbol: context.symbol,
    context_snapshot: context,
    mechanical_action: mechanicalAction,
    mechanical_stage: mechanicalStage,
    mechanical_side: context.strategySide,
    entry_price_snapshot: entryPriceSnapshot,
    atr_snapshot: atrSnapshot,
  };

  try {
    const history = await fetchDecisionBrainHistorySummary(sb, {
      userId,
      symbol: context.symbol,
      regime: context.marketScoreRegime,
    });
    const system = buildDecisionBrainSystemPrompt();
    const userPrompt = buildDecisionBrainUserPrompt(context, history);
    const completion = await runDecisionBrainCompletion(system, userPrompt);
    const result = parseBrainOutput(completion.text, context.strategySide);

    const { error } = await sb.from('ai_decision_brain_shadow').insert([{
      ...baseRow,
      brain_action: result.action,
      brain_side: result.side,
      brain_confidence: result.confidence,
      brain_reasoning: result.reasoning,
      brain_provider: completion.provider,
      brain_latency_ms: completion.latencyMs,
      brain_error: null,
    }]);
    if (error) console.error('[ai-runner/decisionBrain] falha ao gravar shadow log (sucesso da chamada):', error);
  } catch (err: any) {
    // Ainda grava a linha (com erro) — silêncio total esconderia com que
    // frequência o cérebro sombra falha, que é parte do que a Fase 2
    // precisa saber antes de confiar nele pra valer.
    const { error } = await sb.from('ai_decision_brain_shadow').insert([{
      ...baseRow,
      brain_action: 'SKIP',
      brain_side: null,
      brain_confidence: null,
      brain_reasoning: '(chamada ao LLM falhou)',
      brain_provider: (Deno.env.get('LLM_PROVIDER') || 'nvidia').toLowerCase(),
      brain_latency_ms: null,
      brain_error: (err?.message ?? String(err)).slice(0, 500),
    }]);
    if (error) console.error('[ai-runner/decisionBrain] falha ao gravar shadow log (chamada ao LLM já tinha falhado):', error);
  }
}
