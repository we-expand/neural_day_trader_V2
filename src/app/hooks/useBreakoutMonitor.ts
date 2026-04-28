/**
 * Hook simplificado para monitorar apenas BTC
 */
export function useBTCBreakoutMonitor(enabled: boolean = true) {
  return useBreakoutMonitor({
    symbols: ['BTC/USD', 'BTCUSDT'],
    enabled,
    checkInterval: 10000, // 🔧 AUMENTADO: 10 segundos (antes: 20s) - 2x mais frequente
    timeframe: '1h'
  });
}

/**
 * Hook para monitorar múltiplos ativos
 */
export function useMultiAssetBreakoutMonitor(
  symbols: string[],
  enabled: boolean = true
) {
  return useBreakoutMonitor({
    symbols,
    enabled,
    checkInterval: 15000, // 🔧 AUMENTADO: 15 segundos (antes: 30s) - 2x mais frequente
    timeframe: '1h'
  });
}