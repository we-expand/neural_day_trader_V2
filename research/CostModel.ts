/**
 * CostModel — estimativa de custo real de execução (spread + comissão + slippage),
 * usada pelo research/CRITERIA.md para converter retorno BRUTO em retorno LÍQUIDO
 * antes de qualquer decisão de promoção pra produto.
 *
 * Não é chamado hoje por nenhum caminho de produto (Dashboard/IA ao vivo/Backtest).
 * É consumido só por scripts de pesquisa em research/experiments/*, junto do
 * MarketScoreValidator.ts, pra medir edge líquido.
 *
 * Números iniciais são estimativas conservadoras de mercado (spread típico de
 * varejo via CFD/market maker) — não são o spread real da Infinox, que varia por
 * condição de mercado e não está exposto pela API. Ajustar aqui quando houver
 * dado real de execução (ex: comparar preço de entrada do backtest com o preço
 * de execução real reportado por /broker/execute).
 */

export type AssetClass = 'FOREX_MAJOR' | 'FOREX_MINOR' | 'FOREX_EXOTIC' | 'INDEX' | 'COMMODITY' | 'CRYPTO' | 'STOCK';

export interface CostEstimate {
  spreadPoints: number;
  commissionPercent: number;
  slippagePoints: number;
}

// Estimativas conservadoras, em pontos (mesma unidade usada por TradeSizing.getPointValue)
const COST_TABLE: Record<AssetClass, CostEstimate> = {
  FOREX_MAJOR: { spreadPoints: 1.0, commissionPercent: 0, slippagePoints: 0.3 },
  FOREX_MINOR: { spreadPoints: 2.5, commissionPercent: 0, slippagePoints: 0.5 },
  FOREX_EXOTIC: { spreadPoints: 8.0, commissionPercent: 0, slippagePoints: 1.5 },
  INDEX: { spreadPoints: 2.0, commissionPercent: 0, slippagePoints: 1.0 },
  COMMODITY: { spreadPoints: 3.0, commissionPercent: 0, slippagePoints: 1.0 },
  CRYPTO: { spreadPoints: 0, commissionPercent: 0.1, slippagePoints: 0.05 },
  STOCK: { spreadPoints: 0, commissionPercent: 0.05, slippagePoints: 0.1 },
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
