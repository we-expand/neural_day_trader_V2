/**
 * TAIL RISK GUARD — Bloco E do cérebro cognitivo (research/AI_COGNITIVE_SPEC.md).
 * ============================================================================
 * "Gestão de cenários extremos (cisnes negros)" — pedido do Cleber, item que
 * o próprio pedido já descreve certo: "não em achismos". Este módulo é REAÇÃO
 * A ESTADO OBSERVADO, nunca previsão — a mesma disciplina de todo o resto do
 * Bloco B/C/D. Não tenta prever um crash; mede se o mercado JÁ está se
 * comportando como um, e responde mecanicamente.
 *
 * Relação com o Bloco B (`ContextGate.ts`): aquele já classifica
 * `HIGH_VOLATILITY` (expansão de ATR >= 2x a mediana recente) e VETA
 * entradas NOVAS nesse regime. Este módulo cobre o que o Bloco B não cobre:
 * (1) um limiar mais extremo, onde a ação correta não é só recusar entrada
 * nova, é **reagir à posição já aberta**; (2) uma recomendação de
 * REDUÇÃO DE TAMANHO (não binário aprova/recusa) pra regimes intermediários;
 * (3) VIX como segunda leitura de pânico de mercado, independente do ATR do
 * ativo operado (índice de volatilidade IMPLÍCITA do S&P500, não medida do
 * próprio candle) — pega choque sistêmico que ainda não apareceu no ATR do
 * ativo específico.
 *
 * Ação no extremo reaproveita `LiveEmergencyClose.ts`
 * (`forceCloseAllLivePositions()`, já existe, já testado em produção pelo
 * kill-switch — retry exponencial 5x + confirmação real via `getPositions()`,
 * nunca assume sucesso só pela resposta da API) — mesmo padrão de segurança,
 * gatilho diferente (choque de volatilidade, não perda de conta).
 *
 * ✅ Correção de 2026-07-31 (mesmo dia): a versão original deste módulo
 * dizia que VIX não podia ser ligado por falta de cache/throttle — ERRADO,
 * não verificado com cuidado antes de escrever. `useApexLogic.ts` já tem
 * `fetchVIXCached()` (cache de 60s, `VIX_CACHE_DURATION`) desde antes desta
 * sessão. Corrigido: `evaluateTailRisk` agora aceita `vix` opcional,
 * alimentado pelo cache já existente — zero chamada de rede nova, zero risco
 * adicional de rate-limit na conta MetaAPI compartilhada.
 *
 * Limiares de VIX seguem a classificação de mercado amplamente usada (CBOE:
 * <20 normal, 20-30 elevado, 30-40 alto, >40 pânico/crise) — convenção de
 * mercado, não edge medido neste projeto; mesma disciplina de honestidade do
 * limiar de ATR acima (heurística declarada, não sinal validado por holdout).
 */

export type TailRiskAction = 'NONE' | 'REDUCE_SIZE' | 'BLOCK_NEW_ENTRIES' | 'EMERGENCY_CLOSE';

export interface TailRiskParams {
  /** ATR atual / mediana do ATR recente — mesma métrica do Bloco B
   *  (`RegimeContext.atrExpansionRatio`), reaproveitada aqui pra manter as
   *  duas camadas medindo exatamente a mesma coisa, sem segunda fonte de
   *  verdade divergente. `null` quando não há dado suficiente. */
  atrExpansionRatio: number | null;
  /** VIX corrente (índice CBOE de volatilidade implícita do S&P500) — vem do
   *  cache já existente em `useApexLogic.ts` (`fetchVIXCached`, 60s), nunca
   *  buscado por este módulo diretamente. `null`/`undefined` quando
   *  indisponível — degrada pra avaliação só por ATR, nunca fabrica valor. */
  vix?: number | null;
  /** % do capital já alocado em posições abertas no momento — quanto maior,
   *  mais a reação a um choque precisa ser imediata (mais exposição em
   *  risco simultâneo). */
  openExposurePercent: number;
}

export interface TailRiskResult {
  action: TailRiskAction;
  /** Multiplicador sugerido pro tamanho de posições NOVAS (1 = sem ajuste,
   *  0 = bloqueado). Não se aplica a posições já abertas — essas só são
   *  afetadas pela ação `EMERGENCY_CLOSE`. */
  newPositionSizeMultiplier: number;
  reasoning: string;
  /** Qual leitura determinou o veredito final — auditável, nunca escondido
   *  qual das duas fontes (ATR do ativo vs. VIX de mercado) pesou mais. */
  triggeredBy: 'ATR' | 'VIX' | 'BOTH' | 'NONE';
}

// Limiares em ATR-expansion-ratio (mesma métrica do ContextGate):
const REDUCE_SIZE_THRESHOLD = 1.5; // abaixo do limiar HIGH_VOLATILITY do Bloco B (2.0) — reação mais cedo, mais suave
const BLOCK_ENTRIES_THRESHOLD = 2.5; // acima do que o Bloco B já classifica HIGH_VOLATILITY — reforço, não redundância pura
const EMERGENCY_THRESHOLD = 4.0; // choque extremo — nível "cisne negro" declarado

// Limiares de VIX — classificação de mercado (CBOE), não medida deste projeto:
const VIX_REDUCE_SIZE_THRESHOLD = 20; // "elevado" na convenção de mercado
const VIX_BLOCK_ENTRIES_THRESHOLD = 30; // "alto"
const VIX_EMERGENCY_THRESHOLD = 40; // "pânico/crise" (ex: picos de 2008, 2020, 2022)

const SEVERITY: Record<TailRiskAction, number> = { NONE: 0, REDUCE_SIZE: 1, BLOCK_NEW_ENTRIES: 2, EMERGENCY_CLOSE: 3 };

function classifyByAtr(atrExpansionRatio: number): { action: TailRiskAction; multiplier: number; reasoning: string } {
  if (atrExpansionRatio >= EMERGENCY_THRESHOLD) {
    return { action: 'EMERGENCY_CLOSE', multiplier: 0, reasoning: `ATR ${atrExpansionRatio.toFixed(2)}x a mediana recente >= limiar de emergência (${EMERGENCY_THRESHOLD}x)` };
  }
  if (atrExpansionRatio >= BLOCK_ENTRIES_THRESHOLD) {
    return { action: 'BLOCK_NEW_ENTRIES', multiplier: 0, reasoning: `ATR ${atrExpansionRatio.toFixed(2)}x a mediana recente >= limiar de bloqueio (${BLOCK_ENTRIES_THRESHOLD}x)` };
  }
  if (atrExpansionRatio >= REDUCE_SIZE_THRESHOLD) {
    const range = BLOCK_ENTRIES_THRESHOLD - REDUCE_SIZE_THRESHOLD;
    const progress = (atrExpansionRatio - REDUCE_SIZE_THRESHOLD) / range;
    const multiplier = Math.max(0.25, Number((1 - progress * 0.75).toFixed(3)));
    return { action: 'REDUCE_SIZE', multiplier, reasoning: `ATR ${atrExpansionRatio.toFixed(2)}x a mediana recente — acima do limiar de cautela (${REDUCE_SIZE_THRESHOLD}x)` };
  }
  return { action: 'NONE', multiplier: 1, reasoning: `ATR ${atrExpansionRatio.toFixed(2)}x a mediana recente — dentro do padrão` };
}

function classifyByVix(vix: number): { action: TailRiskAction; multiplier: number; reasoning: string } {
  if (vix >= VIX_EMERGENCY_THRESHOLD) {
    return { action: 'EMERGENCY_CLOSE', multiplier: 0, reasoning: `VIX ${vix.toFixed(1)} >= ${VIX_EMERGENCY_THRESHOLD} (pânico/crise, convenção CBOE)` };
  }
  if (vix >= VIX_BLOCK_ENTRIES_THRESHOLD) {
    return { action: 'BLOCK_NEW_ENTRIES', multiplier: 0, reasoning: `VIX ${vix.toFixed(1)} >= ${VIX_BLOCK_ENTRIES_THRESHOLD} (volatilidade alta, convenção CBOE)` };
  }
  if (vix >= VIX_REDUCE_SIZE_THRESHOLD) {
    const range = VIX_BLOCK_ENTRIES_THRESHOLD - VIX_REDUCE_SIZE_THRESHOLD;
    const progress = (vix - VIX_REDUCE_SIZE_THRESHOLD) / range;
    const multiplier = Math.max(0.25, Number((1 - progress * 0.75).toFixed(3)));
    return { action: 'REDUCE_SIZE', multiplier, reasoning: `VIX ${vix.toFixed(1)} — acima do limiar de cautela (${VIX_REDUCE_SIZE_THRESHOLD})` };
  }
  return { action: 'NONE', multiplier: 1, reasoning: `VIX ${vix.toFixed(1)} — dentro do padrão` };
}

/**
 * Avalia risco de cauda a partir de estado OBSERVADO (nunca previsto),
 * combinando duas leituras independentes — ATR do próprio ativo (choque
 * local) e VIX de mercado (choque sistêmico, pode aparecer no VIX antes de
 * aparecer no ATR do ativo específico) — e usa sempre a MAIS SEVERA das
 * duas. Nunca "aprova mais" com mais volatilidade em qualquer das fontes
 * (monotônico, testado).
 */
export function evaluateTailRisk(params: TailRiskParams): TailRiskResult {
  const { atrExpansionRatio, vix, openExposurePercent } = params;

  const atrResult = atrExpansionRatio !== null ? classifyByAtr(atrExpansionRatio) : null;
  const vixResult = vix !== null && vix !== undefined ? classifyByVix(vix) : null;

  if (!atrResult && !vixResult) {
    return {
      action: 'NONE', newPositionSizeMultiplier: 1, triggeredBy: 'NONE',
      reasoning: 'Sem dado de ATR nem de VIX — TailRiskGuard não se pronuncia (nunca fabrica veredito sem medição real).',
    };
  }

  const atrSeverity = atrResult ? SEVERITY[atrResult.action] : -1;
  const vixSeverity = vixResult ? SEVERITY[vixResult.action] : -1;
  const maxSeverity = Math.max(atrSeverity, vixSeverity);

  const atrWins = atrSeverity === maxSeverity && atrResult;
  const vixWins = vixSeverity === maxSeverity && vixResult;
  const triggeredBy: TailRiskResult['triggeredBy'] = atrWins && vixWins ? 'BOTH' : atrWins ? 'ATR' : 'VIX';

  const winner = (atrSeverity >= vixSeverity ? atrResult : vixResult)!;
  const reasoningParts = [atrResult?.reasoning, vixResult?.reasoning].filter((r): r is string => !!r);
  const exposureNote = winner.action === 'EMERGENCY_CLOSE'
    ? (openExposurePercent > 0 ? ` Exposição aberta atual: ${openExposurePercent.toFixed(1)}% do capital.` : ' Sem posição aberta no momento.')
    : '';

  return {
    action: winner.action,
    newPositionSizeMultiplier: winner.multiplier,
    triggeredBy,
    reasoning: `${reasoningParts.join('; ')}.${exposureNote}`,
  };
}
