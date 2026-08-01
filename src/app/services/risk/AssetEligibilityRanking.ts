/**
 * Ranking mecânico de ativos elegíveis — próximo componente do cérebro de
 * execução declarado em `SESSAO_2026-07-31_DEVLAB_AUDITORIA.md` ("Faltam 2
 * blocos maiores", item 1) e alinhado à decisão (B) de `AI_BRAIN_SPEC.md`
 * seção 14.5: o cérebro rankeia por QUALIDADE DE RISCO (custo/volatilidade),
 * nunca por expectativa de retorno — não existe sinal com edge comprovado
 * (seções 11-11.15), então qualquer rank por "probabilidade de acerto" seria
 * fabricar confiança que não existe.
 *
 * Critério de rank: fração do movimento típico consumida pelo custo
 * round-trip (`CostViabilityGate.costAsPercentOfMovement`), ascendente — o
 * mesmo número que já decide viável/inviável, só usado agora para ORDENAR os
 * viáveis entre si em vez de só aprovar/reprovar um por um. Ativos INVIAVEL
 * nunca aparecem no ranking, mesmo que sejam o "menos pior" da lista.
 */
import { evaluateCostViability, type CostViabilityResult } from './CostViabilityGate';

export interface AssetCandidate {
  symbol: string;
  /** Custo round-trip estimado, em % do notional (spread + comissão + slippage). */
  costPercent: number;
  /** Movimento típico esperado no horizonte de operação, em % do preço (ATR/preço ou MFE medido). */
  typicalMovementPercent: number;
}

export interface RankedAsset extends CostViabilityResult {
  symbol: string;
  rank: number;
}

export interface AssetRankingResult {
  eligible: RankedAsset[];
  rejected: Array<{ symbol: string; costPercent: number; typicalMovementPercent: number; reason: string }>;
}

/**
 * Rankeia candidatos por viabilidade de custo. Não decide direção nem
 * tamanho de posição — só ordena "onde o custo deixa mais espaço pro
 * movimento typico", pra alimentar a seleção de ativo (R2/R3 da spec) sem
 * depender de nenhuma previsão.
 */
export function rankEligibleAssets(candidates: AssetCandidate[]): AssetRankingResult {
  const eligible: RankedAsset[] = [];
  const rejected: AssetRankingResult['rejected'] = [];

  for (const candidate of candidates) {
    const result = evaluateCostViability(candidate.costPercent, candidate.typicalMovementPercent);
    if (result.approved) {
      eligible.push({ ...result, symbol: candidate.symbol, rank: 0 });
    } else {
      rejected.push({
        symbol: candidate.symbol,
        costPercent: candidate.costPercent,
        typicalMovementPercent: candidate.typicalMovementPercent,
        reason: result.reason,
      });
    }
  }

  eligible.sort((a, b) => a.costAsPercentOfMovement - b.costAsPercentOfMovement);
  eligible.forEach((item, index) => {
    item.rank = index + 1;
  });

  return { eligible, rejected };
}
