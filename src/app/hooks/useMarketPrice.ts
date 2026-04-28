/**
 * 🎯 HOOK DE PREÇO DE MERCADO - VERSÃO 2.0
 * 
 * ✅ USA DADOS REAIS do UnifiedMarketDataService (Binance via proxy backend)
 * ✅ Atualização em tempo real via polling (1 segundo)
 * ✅ Sincronizado entre todos os componentes
 * ✅ FONTE ÚNICA DE VERDADE (Single Source of Truth)
 * 
 * 🔥 ESTE É O HOOK OFICIAL - TODOS OS COMPONENTES DEVEM USAR ESTE!
 */

import { useState, useEffect, useRef } from 'react';
import { subscribeToRealtimeData, getUnifiedMarketData, type UnifiedMarketData } from '@/app/services/UnifiedMarketDataService';

export interface MarketPriceData {
  currentPrice: number;
  dailyChange: number;
  dailyChangePercent: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  isPositive: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  source: 'binance' | 'cache' | 'mock' | 'error';
  candles: any[];
}

/**
 * Hook que retorna dados de mercado em tempo real
 * 
 * @param symbol - Símbolo do ativo (ex: 'BTCUSDT', 'ETHUSDT', 'BTCUSD')
 * @param timeframe - Timeframe (não usado, mantido para compatibilidade)
 * @param refreshInterval - Intervalo de refresh (não usado, mantido para compatibilidade)
 * @returns Dados de mercado em tempo real
 * 
 * @example
 * ```tsx
 * const { currentPrice, dailyChangePercent, isPositive } = useMarketPrice('BTCUSDT');
 * ```
 */
export function useMarketPrice(
  symbol?: string,
  timeframe: string = '1H',
  refreshInterval: number = 3000
): MarketPriceData {
  
  const actualSymbol = symbol || 'BTCUSDT';
  
  // Estado inicial (loading)
  const [data, setData] = useState<MarketPriceData>({
    currentPrice: 0,
    dailyChange: 0,
    dailyChangePercent: 0,
    openPrice: 0,
    highPrice: 0,
    lowPrice: 0,
    volume: 0,
    isPositive: false,
    isLoading: true,
    error: null,
    lastUpdate: Date.now(),
    source: 'cache',
    candles: []
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // 🔥 Garantir formato correto (BTCUSD → BTCUSDT)
    const apiSymbol = actualSymbol.endsWith('USDT') 
      ? actualSymbol 
      : actualSymbol.replace('USD', 'USDT');

    console.log(`[useMarketPrice] 📡 Subscribing to REAL data: ${actualSymbol} → ${apiSymbol}`);
    
    // 🎯 Fetch inicial para popular dados IMEDIATAMENTE
    const fetchInitialData = async () => {
      try {
        const initialData = await getUnifiedMarketData(apiSymbol);
        
        if (!mountedRef.current) return;

        const openPrice = initialData.openPrice || initialData.price - initialData.change;
        
        setData({
          currentPrice: initialData.price,
          dailyChange: initialData.change,
          dailyChangePercent: initialData.changePercent,
          openPrice: openPrice,
          highPrice: initialData.highPrice || initialData.price,
          lowPrice: initialData.lowPrice || initialData.price,
          volume: initialData.volume || 0,
          isPositive: initialData.change >= 0,
          isLoading: false,
          error: null,
          lastUpdate: initialData.timestamp,
          source: initialData.source,
          candles: []
        });

        console.log(`[useMarketPrice] ✅ Initial data loaded: ${apiSymbol} @ $${initialData.price.toFixed(2)}`);
      } catch (error) {
        console.error(`[useMarketPrice] ❌ Error loading initial data for ${apiSymbol}:`, error);
        
        if (mountedRef.current) {
          setData(prev => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load market data',
            source: 'error'
          }));
        }
      }
    };

    fetchInitialData();
    
    // 🚀 Subscribe ao UnifiedMarketDataService (dados REAIS em tempo real!)
    unsubscribeRef.current = subscribeToRealtimeData(apiSymbol, (marketData: UnifiedMarketData) => {
      if (!mountedRef.current) return;

      console.log(`[useMarketPrice] 🔄 REAL-TIME UPDATE:`, {
        symbol: marketData.symbol,
        price: marketData.price,
        changePercent: marketData.changePercent?.toFixed(2) + '%',
        source: marketData.source
      });
      
      // Calcular preço de abertura
      const openPrice = marketData.openPrice || marketData.price - marketData.change;
      
      setData({
        currentPrice: marketData.price,
        dailyChange: marketData.change,
        dailyChangePercent: marketData.changePercent,
        openPrice: openPrice,
        highPrice: marketData.highPrice || marketData.price,
        lowPrice: marketData.lowPrice || marketData.price,
        volume: marketData.volume || 0,
        isPositive: marketData.change >= 0,
        isLoading: false,
        error: null,
        lastUpdate: marketData.timestamp,
        source: marketData.source,
        candles: []
      });
    });
    
    // Cleanup ao desmontar
    return () => {
      mountedRef.current = false;
      
      if (unsubscribeRef.current) {
        console.log(`[useMarketPrice] 🧹 Unsubscribing from ${apiSymbol}`);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [actualSymbol]);

  return data;
}
