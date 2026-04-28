import { useState, useEffect, useRef } from 'react';
import { subscribeToRealtimeData, getUnifiedMarketData } from '@/app/services/UnifiedMarketDataService';

export interface RealtimePriceData {
  price: number;
  change: number;
  changePercent: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  isPositive: boolean;
  source: 'binance' | 'cache' | 'mock' | 'error';
  lastUpdate: Date;
  isLoading: boolean;
}

/**
 * 🎯 HOOK CENTRALIZADO - FONTE ÚNICA DE VERDADE
 * 
 * Todos os componentes que precisam de preço em tempo real DEVEM usar este hook.
 * 
 * Características:
 * - ✅ Subscription automática ao polling da Binance
 * - ✅ Atualização em tempo real (1 segundo)
 * - ✅ Cleanup automático ao desmontar
 * - ✅ Cache para evitar re-renders desnecessários
 * - ✅ Fonte única de verdade (Single Source of Truth)
 * 
 * @param symbol - Símbolo do ativo (ex: 'BTCUSDT', 'ETHUSDT')
 * @returns Dados de preço em tempo real
 * 
 * @example
 * ```tsx
 * const { price, changePercent, isPositive } = useRealtimePrice('BTCUSDT');
 * return <div>${price.toFixed(2)} ({changePercent.toFixed(2)}%)</div>
 * ```
 */
export function useRealtimePrice(symbol: string): RealtimePriceData {
  const [data, setData] = useState<RealtimePriceData>({
    price: 0,
    change: 0,
    changePercent: 0,
    openPrice: 0,
    highPrice: 0,
    lowPrice: 0,
    volume: 0,
    isPositive: false,
    source: 'cache',
    lastUpdate: new Date(),
    isLoading: true
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    // 🔥 IMPORTANTE: Converter símbolo para formato Binance
    const apiSymbol = symbol.endsWith('USDT') 
      ? symbol 
      : symbol.replace('USD', 'USDT');

    console.log(`[useRealtimePrice] 🚀 Iniciando subscription: ${symbol} → ${apiSymbol}`);

    // 🎯 Fetch inicial para popular dados imediatamente
    const fetchInitialData = async () => {
      try {
        const initialData = await getUnifiedMarketData(apiSymbol);
        
        if (mountedRef.current) {
          setData({
            price: initialData.price,
            change: initialData.change || 0,
            changePercent: initialData.changePercent || 0,
            openPrice: initialData.openPrice || initialData.price - (initialData.change || 0),
            highPrice: initialData.highPrice || initialData.price,
            lowPrice: initialData.lowPrice || initialData.price,
            volume: initialData.volume || 0,
            isPositive: (initialData.changePercent || 0) >= 0,
            source: initialData.source,
            lastUpdate: new Date(),
            isLoading: false
          });

          console.log(`[useRealtimePrice] ✅ Dados iniciais carregados: ${symbol} @ $${initialData.price.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`[useRealtimePrice] ❌ Erro ao carregar dados iniciais de ${symbol}:`, error);
        
        if (mountedRef.current) {
          setData(prev => ({
            ...prev,
            isLoading: false,
            source: 'error'
          }));
        }
      }
    };

    fetchInitialData();

    // 🔄 Subscribe ao streaming em tempo real
    unsubscribeRef.current = subscribeToRealtimeData(apiSymbol, (marketData) => {
      if (!mountedRef.current) return;

      const newData: RealtimePriceData = {
        price: marketData.price,
        change: marketData.change || 0,
        changePercent: marketData.changePercent || 0,
        openPrice: marketData.openPrice || marketData.price - (marketData.change || 0),
        highPrice: marketData.highPrice || marketData.price,
        lowPrice: marketData.lowPrice || marketData.price,
        volume: marketData.volume || 0,
        isPositive: (marketData.changePercent || 0) >= 0,
        source: marketData.source,
        lastUpdate: new Date(),
        isLoading: false
      };

      setData(newData);

      console.log(`[useRealtimePrice] 🔄 UPDATE: ${symbol} @ $${marketData.price.toFixed(2)} (${marketData.changePercent?.toFixed(2)}%)`);
    });

    // 🧹 Cleanup
    return () => {
      mountedRef.current = false;
      
      if (unsubscribeRef.current) {
        console.log(`[useRealtimePrice] 🔌 Desconectando: ${symbol}`);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [symbol]);

  return data;
}

/**
 * 🎯 HOOK SIMPLIFICADO - APENAS PREÇO
 * 
 * Para componentes que só precisam do preço (sem estatísticas).
 * 
 * @param symbol - Símbolo do ativo
 * @returns Preço atual
 * 
 * @example
 * ```tsx
 * const price = useRealtimePriceSimple('BTCUSDT');
 * return <div>${price.toFixed(2)}</div>
 * ```
 */
export function useRealtimePriceSimple(symbol: string): number {
  const { price } = useRealtimePrice(symbol);
  return price;
}
