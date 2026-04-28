/**
 * 🌐 REAL PRICE PROVIDER - DESABILITADO
 * 
 * REMOVIDO: Agora usamos os candles do gráfico como fonte única da verdade
 * Isso garante que preço mostrado = preço no gráfico (100% alinhado)
 */

export interface RealPrice {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface BatchPriceResult {
  symbol: string;
  price: number;
  change24h: number;
  changePercent: number;
  timestamp: number;
  source: string;
}

/**
 * ✅ DESABILITADO - Não usar mais preços externos
 * Usar candles do gráfico ao invés disso
 */
export async function fetchRealPricesBatch(symbols: string[]): Promise<Record<string, BatchPriceResult>> {
  console.log('[realPriceProvider] ⚠️ DESABILITADO - Use os candles do gráfico');
  
  const result: Record<string, BatchPriceResult> = {};
  
  // Retornar objeto vazio - forçar uso dos candles
  return result;
}