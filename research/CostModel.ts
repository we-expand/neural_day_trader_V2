/**
 * CostModel — estimativa de custo real de execução (spread + comissão + slippage),
 * usada pelo research/CRITERIA.md para converter retorno BRUTO em retorno LÍQUIDO
 * antes de qualquer decisão de promoção pra produto.
 *
 * Não é chamado hoje por nenhum caminho de produto (Dashboard/IA ao vivo/Backtest).
 * É consumido só por scripts de pesquisa em research/experiments/*, junto do
 * MarketScoreValidator.ts, pra medir edge líquido.
 *
 * CALIBRADO EM 2026-07-24 contra pesquisa real de corretoras concorrentes da
 * Infinox (IC Markets, Pepperstone, FXTM, Exness — contas Raw/ECN, que são o
 * modelo relevante para um sistema automatizado via MT5/MetaAPI, não conta
 * Standard de varejo iniciante). Ver research/AI_BRAIN_SPEC.md para o relatório
 * completo com fontes. Números "iguais ou um pouco abaixo" da concorrência —
 * nem o mais caro do mercado, nem uma promessa de spread irrealista.
 *
 * Onde a pesquisa não achou dado publicado direto (EURGBP minor, USDZAR, ação
 * CFD), o número abaixo é uma extrapolação explícita marcada como tal — nunca
 * apresentada como fato confirmado. Recalibrar quando houver dado real de
 * execução (comparar preço solicitado vs. preço reportado por /broker/execute).
 */

export type AssetClass = 'FOREX_MAJOR' | 'FOREX_MINOR' | 'FOREX_EXOTIC' | 'INDEX' | 'COMMODITY' | 'CRYPTO' | 'STOCK';

export interface CostEstimate {
  spreadPoints: number;
  commissionPercent: number;
  slippagePoints: number;
}

// Round-trip total recomendado por classe (research/AI_BRAIN_SPEC.md, 2026-07-24):
//   FOREX_MAJOR  0,8-1,0 pip  -> spread 0,1 (Raw) + comissão embutida como pontos equivalentes
//   FOREX_MINOR  1,2-1,5 pips -> SEM dado publicado direto; extrapolado como +50% sobre major
//   FOREX_EXOTIC 15-20 pips   -> ancorado em USDTRY real (~16 pips, Pepperstone)
//   INDEX        spread pequeno relativo ao nível de preço (Pepperstone US30 ~30 pts em ~44000)
//   COMMODITY    XAUUSD 1,0-1,5 pip (Infinox/Pepperstone Raw)
//   CRYPTO       spread modelado em % do notional, não pips fixos (cripto tem spread proporcional ao preço)
//   STOCK        NÃO pesquisado nesta rodada — mantido o valor anterior, marcado como pendente
const COST_TABLE: Record<AssetClass, CostEstimate> = {
  FOREX_MAJOR: { spreadPoints: 0.5, commissionPercent: 0, slippagePoints: 0.2 },   // spread Raw ~0,1 + comissão (~$7/lote ≈ 0,5-0,7pt em EURUSD) + slippage residual
  FOREX_MINOR: { spreadPoints: 1.0, commissionPercent: 0, slippagePoints: 0.3 },   // ⚠️ extrapolado (sem dado direto): ~+50% sobre major
  FOREX_EXOTIC: { spreadPoints: 12.0, commissionPercent: 0, slippagePoints: 3.0 }, // ancorado em USDTRY real (~16pt spread), com folga p/ slippage de baixa liquidez
  INDEX: { spreadPoints: 3.0, commissionPercent: 0, slippagePoints: 1.5 },        // Pepperstone US30 Raw; gaps de abertura de sessão contam no slippage
  COMMODITY: { spreadPoints: 1.2, commissionPercent: 0, slippagePoints: 0.5 },     // XAUUSD Raw (Infinox/Pepperstone)
  CRYPTO: { spreadPoints: 0, commissionPercent: 0.08, slippagePoints: 0.05 },      // spread + comissão modelados juntos em %, cripto tem spread proporcional ao preço, não pips fixos
  STOCK: { spreadPoints: 0, commissionPercent: 0.05, slippagePoints: 0.1 },        // ⚠️ NÃO pesquisado nesta rodada (2026-07-24) — valor anterior mantido, pendente calibração real
};

/**
 * Custo estimado por trade, em % do valor nocional. Usar pra descontar de
 * qualquer retorno bruto medido pelo MarketScoreValidator antes de comparar
 * contra o piso de amostra/degradação do CRITERIA.md.
 */
export function estimateCostPercent(assetClass: AssetClass, priceLevel: number, pointValue: number): number {
  const cost = COST_TABLE[assetClass];
  const spreadCost = (cost.spreadPoints * pointValue) / priceLevel;
  const slippageCost = (cost.slippagePoints * pointValue) / priceLevel;
  return spreadCost + slippageCost + cost.commissionPercent / 100;
}

/**
 * Converte retorno bruto (%) num trade em retorno líquido, descontando o custo
 * estimado de entrada + saída (o round-trip completo, não só uma perna).
 */
export function toNetReturn(grossReturnPercent: number, assetClass: AssetClass, priceLevel: number, pointValue: number): number {
  const roundTripCost = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;
  return grossReturnPercent - roundTripCost * 100;
}
