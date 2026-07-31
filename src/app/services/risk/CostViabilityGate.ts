/**
 * Gate de viabilidade por custo — Componente 1 do cérebro de execução
 * (decisão (B), `research/AI_BRAIN_SPEC.md` seção 14.5, `CLAUDE.md` pendência
 * #5). Aritmética pura, zero previsão: recusa operar onde o custo estimado
 * de round-trip devora fração grande demais do movimento típico esperado.
 *
 * Números-fonte (seção 14.3 da spec, BTCUSDT, custo round-trip real 0,26%):
 *   15m: movimento típico 1,05% (MEDIDO, n=4.058) -> custo = 25% do movimento -> INVIÁVEL
 *   1h:  movimento típico 2,52% (MEDIDO, n=973)   -> custo = 10% do movimento -> FRONTEIRA
 *   4h:  movimento típico ~5%  (EXTRAPOLADO √t)   -> custo = ~5%  do movimento -> VIÁVEL
 *   1d:  movimento típico ~12% (EXTRAPOLADO √t)   -> custo = ~2%  do movimento -> VIÁVEL
 *
 * Confirmação executável (14.3): 15m pooled -US$1.447,73 (DSR 0%), 1h pooled
 * -US$73,55 (DSR 35,9%, abaixo do piso de 95%) — FRONTEIRA também perdeu
 * dinheiro na prática, por isso o gate abaixo NÃO aprova fronteira por padrão.
 *
 * Os limiares de classificação (7% / 12%) são uma leitura das 4 medições
 * acima, não um número novo pesquisado: escolhidos para que 15m (25%) caia em
 * INVIAVEL, 1h (10%) em FRONTEIRA, e 4h/1d (5%/2%) em VIAVEL — reproduzindo a
 * coluna "Viável?" da tabela 14.3.
 */

export type CostViabilityClassification = 'VIAVEL' | 'FRONTEIRA' | 'INVIAVEL';

export interface CostViabilityResult {
  costPercent: number;
  typicalMovementPercent: number;
  costAsPercentOfMovement: number;
  classification: CostViabilityClassification;
  approved: boolean;
  reason: string;
}

const FRONTEIRA_THRESHOLD = 0.07; // acima disso, custo já compromete demais o movimento
const INVIAVEL_THRESHOLD = 0.12;  // acima disso, custo domina o resultado esperado

/**
 * Avalia se um custo estimado (round-trip, em % do notional) é viável frente
 * ao movimento típico esperado no horizonte (também em % do preço). Não
 * assume nenhuma fonte de movimento — quem chama precisa fornecer um número
 * medido ou uma extrapolação explicitamente marcada (nunca fabricar dado).
 */
export function evaluateCostViability(costPercent: number, typicalMovementPercent: number): CostViabilityResult {
  if (costPercent < 0 || typicalMovementPercent < 0) {
    throw new Error('CostViabilityGate: costPercent e typicalMovementPercent não podem ser negativos');
  }
  if (typicalMovementPercent === 0) {
    return {
      costPercent,
      typicalMovementPercent,
      costAsPercentOfMovement: Infinity,
      classification: 'INVIAVEL',
      approved: false,
      reason: 'movimento típico é zero — custo é infinitamente maior que o movimento esperado',
    };
  }

  const ratio = costPercent / typicalMovementPercent;

  let classification: CostViabilityClassification;
  let reason: string;
  if (ratio <= FRONTEIRA_THRESHOLD) {
    classification = 'VIAVEL';
    reason = `custo consome ${(ratio * 100).toFixed(1)}% do movimento típico (≤ ${FRONTEIRA_THRESHOLD * 100}%)`;
  } else if (ratio <= INVIAVEL_THRESHOLD) {
    classification = 'FRONTEIRA';
    reason = `custo consome ${(ratio * 100).toFixed(1)}% do movimento típico — fronteira (seção 14.3: 1h pooled real perdeu dinheiro nesta faixa)`;
  } else {
    classification = 'INVIAVEL';
    reason = `custo consome ${(ratio * 100).toFixed(1)}% do movimento típico (> ${INVIAVEL_THRESHOLD * 100}%) — custo domina o resultado esperado`;
  }

  return {
    costPercent,
    typicalMovementPercent,
    costAsPercentOfMovement: ratio,
    classification,
    approved: classification === 'VIAVEL',
    reason,
  };
}

/**
 * Movimento típico medido/extrapolado para BTCUSDT (seção 14.3 da spec) —
 * único instrumento com medição real neste projeto até agora. Não usar para
 * outro ativo sem medição própria (violaria a regra de nunca fabricar dado).
 */
export const BTCUSDT_TYPICAL_MOVEMENT_PERCENT: Record<'15m' | '1h' | '4h' | '1d', { value: number; source: 'MEDIDO' | 'EXTRAPOLADO' }> = {
  '15m': { value: 1.05, source: 'MEDIDO' },
  '1h': { value: 2.52, source: 'MEDIDO' },
  '4h': { value: 5, source: 'EXTRAPOLADO' },
  '1d': { value: 12, source: 'EXTRAPOLADO' },
};

/**
 * Conveniência para o caso já medido nesta pesquisa: BTCUSDT, custo
 * round-trip real de 0,26% (`research/CostModel.ts`, classe CRYPTO).
 */
export function evaluateCostViabilityForBTCUSDT(
  timeframe: '15m' | '1h' | '4h' | '1d',
  costPercent = 0.26,
): CostViabilityResult & { movementSource: 'MEDIDO' | 'EXTRAPOLADO' } {
  const movement = BTCUSDT_TYPICAL_MOVEMENT_PERCENT[timeframe];
  return { ...evaluateCostViability(costPercent, movement.value), movementSource: movement.source };
}
