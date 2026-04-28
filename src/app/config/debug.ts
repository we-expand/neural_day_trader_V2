/**
 * 🎛️ DEBUG CONFIGURATION
 * 
 * Controla logs e features de debug para otimizar performance.
 * 
 * ⚠️ IMPORTANTE: 
 * - DEBUG_MODE = true → Logs detalhados (LENTO, apenas desenvolvimento)
 * - DEBUG_MODE = false → Zero logs (RÁPIDO, produção)
 */

export const DEBUG_CONFIG = {
  // 🔥 MASTER SWITCH: Desativa TODOS os logs de debug
  ENABLED: true, // ← REATIVADO TEMPORARIAMENTE para debug
  
  // Logs específicos (só funcionam se ENABLED = true)
  LOGS: {
    WEBSOCKET: false,      // Logs do BinanceWebSocketService
    MARKET_DATA: true,     // ✅ Logs do UnifiedMarketDataService
    DASHBOARD: true,       // ✅ Logs do MarketScoreBoard
    CHARTVIEW: false,      // Logs do ChartView
    BINANCE_API: false,    // Logs das chamadas REST API
  },
  
  // Performance
  WEBSOCKET_THROTTLE: 1000, // Atualizar UI apenas a cada 1 segundo (em vez de 250ms)
  SHOW_DEBUG_PANEL: false,  // ❌ Ocultar painel amarelo de debug (production mode)
};

/**
 * Helper para logs condicionais
 */
export function debugLog(category: keyof typeof DEBUG_CONFIG.LOGS, ...args: any[]) {
  if (!DEBUG_CONFIG.ENABLED) return;
  if (!DEBUG_CONFIG.LOGS[category]) return;
  
  console.log(...args);
}

/**
 * Helper para erros (sempre mostra)
 */
export function debugError(...args: any[]) {
  console.error(...args);
}

/**
 * Helper para warnings importantes
 */
export function debugWarn(...args: any[]) {
  if (!DEBUG_CONFIG.ENABLED) return;
  console.warn(...args);
}