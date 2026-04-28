/**
 * 🎯 UNIFIED MARKET DATA SERVICE
 * 
 * Serviço centralizado para garantir que Dashboard e ChartView
 * usem EXATAMENTE a mesma fonte de dados da Binance.
 * 
 * ✅ Um único ponto de entrada
 * ✅ Polling REST API (WebSocket bloqueado por CSP do Figma)
 * ✅ Fallback para REST API
 * ✅ Cache para performance
 * ✅ Sincronização garantida entre componentes
 * ⚡ OTIMIZADO: Atualização a cada 1 segundo
 */

import { getBinancePureValues, getBinanceRawData } from '@/app/utils/binanceValidator';
import { binancePolling, type BinanceTickerData } from '@/app/services/BinancePollingService'; // 🔄 MUDADO: Polling em vez de WebSocket
import { debugLog, debugError, DEBUG_CONFIG } from '@/app/config/debug';

export interface UnifiedMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  volume?: number;
  openPrice?: number;
  timestamp: number;
  source: 'binance' | 'websocket' | 'fallback';
}

// Cache global para sincronizar preços entre componentes
const priceCache = new Map<string, { data: UnifiedMarketData; timestamp: number }>();
const CACHE_TTL = 500; // 500ms - mesma frequência da atualização

// 🚀 WEBSOCKET: Cache de dados do stream em tempo real
const webSocketCache = new Map<string, UnifiedMarketData>();
const activeSubscriptions = new Map<string, () => void>(); // Cleanup functions

/**
 * 🚀 NOVO: Subscribe ao WebSocket para streaming em tempo real
 */
export function subscribeToRealtimeData(
  symbol: string, 
  callback: (data: UnifiedMarketData) => void
): () => void {
  // 🔥 FIX: Normalizar símbolo SEM adicionar T duplo!
  let normalizedSymbol = symbol.toUpperCase();
  
  // Se não termina com USDT, adiciona
  if (!normalizedSymbol.endsWith('USDT') && !normalizedSymbol.includes('USD')) {
    normalizedSymbol += 'USDT';
  } else if (normalizedSymbol.endsWith('USD')) {
    // Se termina com USD (mas não USDT), substitui por USDT
    normalizedSymbol = normalizedSymbol.replace(/USD$/, 'USDT');
  }
  // Se já termina com USDT, não faz nada!
  
  console.log(`[UnifiedMarketData] 📡 Símbolo normalizado: ${symbol} → ${normalizedSymbol}`);
  
  // Cleanup subscription anterior se existir
  if (activeSubscriptions.has(normalizedSymbol)) {
    const cleanup = activeSubscriptions.get(normalizedSymbol)!;
    cleanup();
  }
  
  // 🔄 Subscribe ao POLLING (REST API a cada 1 segundo)
  const unsubscribe = binancePolling.subscribe(normalizedSymbol, (tickerData: BinanceTickerData) => {
    console.log(`[UnifiedMarketData] 🔄 RECEBIDO DO POLLING:`, {
      '🔴 tickerData.price': tickerData.price,
      '🔴 tickerData.change': tickerData.change,
      '🔴 tickerData.changePercent': tickerData.changePercent
    });
    
    const unifiedData: UnifiedMarketData = {
      symbol: tickerData.symbol,
      price: tickerData.price,
      change: tickerData.change,
      changePercent: tickerData.changePercent,
      timestamp: tickerData.timestamp,
      source: 'websocket' // Mantém 'websocket' para compatibilidade
    };
    
    console.log(`[UnifiedMarketData] 📤 ENVIANDO PARA COMPONENTES:`, {
      '✅ unifiedData.price': unifiedData.price,
      '✅ unifiedData.change': unifiedData.change,
      '✅ unifiedData.changePercent': unifiedData.changePercent
    });
    
    // Atualizar cache do WebSocket
    webSocketCache.set(normalizedSymbol, unifiedData);
    
    // Atualizar cache global também
    priceCache.set(normalizedSymbol, { data: unifiedData, timestamp: Date.now() });
    
    // Notificar callback
    callback(unifiedData);
  });
  
  // Armazenar cleanup function
  activeSubscriptions.set(normalizedSymbol, unsubscribe);
  
  // Retornar função de cleanup
  return () => {
    console.log(`[UnifiedMarketData] 🔌 Unsubscribe: ${normalizedSymbol}`);
    unsubscribe();
    activeSubscriptions.delete(normalizedSymbol);
  };
}

/**
 * 🎯 FUNÇÃO PRINCIPAL - Retorna dados unificados da Binance
 */
export async function getUnifiedMarketData(symbol: string): Promise<UnifiedMarketData> {
  const normalizedSymbol = symbol.toUpperCase().replace('/', '').replace(' ', '');
  
  // Verificar cache (garante que Dashboard e ChartView vejam o MESMO valor)
  const cached = priceCache.get(normalizedSymbol);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const isCrypto = normalizedSymbol.endsWith('USDT') || 
                     ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].some(c => normalizedSymbol.includes(c));
    
    if (isCrypto) {
      // 🔥 CRYPTO: Buscar dados PUROS da Binance
      const rawData = await getBinanceRawData(normalizedSymbol);
      
      if (rawData) {
        const unifiedData: UnifiedMarketData = {
          symbol: rawData.symbol,
          price: rawData.lastPrice,
          change: rawData.priceChange,
          changePercent: rawData.priceChangePercent,
          high: rawData.highPrice,
          low: rawData.lowPrice,
          volume: rawData.volume,
          openPrice: rawData.openPrice,
          timestamp: Date.now(),
          source: 'binance'
        };
        
        // Armazenar no cache global
        priceCache.set(normalizedSymbol, { data: unifiedData, timestamp: Date.now() });
        
        console.log(`[UnifiedMarketData] ✅ ${normalizedSymbol}:`, {
          price: unifiedData.price.toFixed(2),
          change: unifiedData.change.toFixed(2),
          changePercent: unifiedData.changePercent.toFixed(2) + '%',
          '⚠️ BINANCE RAW %': rawData.priceChangePercent,
          openPrice: rawData.openPrice.toFixed(2)
        });
        
        return unifiedData;
      }
    }
    
    // Fallback: dados simulados
    return getFallbackData(normalizedSymbol);
    
  } catch (error: any) {
    console.error(`[UnifiedMarketData] ❌ Error for ${normalizedSymbol}:`, error.message);
    return getFallbackData(normalizedSymbol);
  }
}

/**
 * 🔄 FALLBACK - Dados simulados realistas
 */
function getFallbackData(symbol: string): UnifiedMarketData {
  const basePrice = getBasePrice(symbol);
  const randomChange = (Math.random() - 0.5) * 0.02; // ±1%
  
  return {
    symbol,
    price: basePrice * (1 + randomChange),
    change: basePrice * randomChange,
    changePercent: randomChange * 100,
    timestamp: Date.now(),
    source: 'fallback'
  };
}

/**
 * 📊 Base prices para fallback
 */
function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    'BTCUSDT': 95000,
    'ETHUSDT': 3300,
    'SOLUSDT': 180,
    'BNBUSDT': 600,
    'XRPUSDT': 2.5,
  };
  
  return prices[symbol] || 100;
}

/**
 * 🧹 Limpar cache periodicamente
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of priceCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      priceCache.delete(key);
    }
  }
}, 10000); // Limpar a cada 10 segundos