/**
 * 🚀 HOOK: useBinanceWebSocket
 * 
 * React hook para usar WebSocket da Binance com facilidade
 * Latência: ~100-300ms (vs 5.000ms REST)
 * 
 * Uso:
 * ```tsx
 * const { prices, isConnected } = useBinanceWebSocket(['BTCUSDT', 'ETHUSDT']);
 * console.log(prices.BTCUSDT?.price); // Preço em tempo real!
 * ```
 */

import { useEffect, useState, useRef } from 'react';
import { getBinanceWebSocketManager, PriceUpdate } from '../services/BinanceWebSocketManager';

interface UseBinanceWebSocketReturn {
  prices: Record<string, PriceUpdate>;
  isConnected: boolean;
  stats: {
    cachedSymbols: number;
    monitoredSymbols: number;
    reconnectAttempts: number;
  };
}

export function useBinanceWebSocket(symbols: string[]): UseBinanceWebSocketReturn {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    cachedSymbols: 0,
    monitoredSymbols: 0,
    reconnectAttempts: 0
  });
  
  const managerRef = useRef(getBinanceWebSocketManager());
  
  useEffect(() => {
    const manager = managerRef.current;
    
    // Conectar ao WebSocket
    if (symbols.length > 0) {
      console.log('[useBinanceWebSocket] 🔌 Conectando aos símbolos:', symbols);
      manager.connect(symbols);
    }
    
    // Registrar callback para updates
    const unsubscribe = manager.onPriceUpdate((update) => {
      setPrices(prev => ({
        ...prev,
        [update.symbol]: update
      }));
    });
    
    // Atualizar estado de conexão a cada 2 segundos
    const statusInterval = setInterval(() => {
      setIsConnected(manager.isConnected());
      
      const currentStats = manager.getStats();
      setStats({
        cachedSymbols: currentStats.cachedSymbols,
        monitoredSymbols: currentStats.monitoredSymbols,
        reconnectAttempts: currentStats.reconnectAttempts
      });
    }, 2000);
    
    // Cleanup
    return () => {
      unsubscribe();
      clearInterval(statusInterval);
      // NÃO desconectar o WebSocket aqui, pois outros componentes podem estar usando
    };
  }, [symbols.join(',')]); // Reconectar apenas se símbolos mudarem
  
  return {
    prices,
    isConnected,
    stats
  };
}

/**
 * 🔥 HOOK SIMPLIFICADO: Apenas um símbolo
 */
export function useBinancePrice(symbol: string): PriceUpdate | null {
  const { prices } = useBinanceWebSocket([symbol]);
  
  // Normalizar símbolo para formato Binance
  const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, '');
  const binanceSymbol = normalized.endsWith('USDT') ? normalized : normalized.replace('USD', '') + 'USDT';
  
  return prices[binanceSymbol] || null;
}
