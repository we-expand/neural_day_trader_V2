/**
 * 🪝 USE MARKET DATA HOOK
 * 
 * Hook React para buscar e atualizar preços reais automaticamente
 * Atualiza a cada 10 segundos (configurável)
 */

import { useState, useEffect, useCallback } from 'react';
import { getMarketData, getMultipleMarketData, subscribeToRealTimeUpdates, MarketData } from '@/app/services/marketDataService';

export interface UseMarketDataOptions {
  updateInterval?: number; // Intervalo de atualização em ms (padrão: 10000 = 10s)
  realTime?: boolean; // Usar WebSocket para tempo real (apenas crypto)
}

// ============================================================================
// 🔥 Hook para UM ativo
// ============================================================================

export function useMarketData(symbol: string, options: UseMarketDataOptions = {}) {
  const { updateInterval = 10000, realTime = false } = options;
  
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const marketData = await getMarketData(symbol);
      setData(marketData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
      setLoading(false);
    }
  }, [symbol]);
  
  useEffect(() => {
    // Buscar imediatamente
    fetchData();
    
    // Se WebSocket habilitado E for crypto, usar tempo real
    if (realTime && symbol.includes('USD') && symbol !== 'BTCUSD') {
      const unsubscribe = subscribeToRealTimeUpdates([symbol], (newData) => {
        setData(newData);
        setLoading(false);
      });
      
      return unsubscribe;
    }
    
    // Senão, usar polling
    const interval = setInterval(fetchData, updateInterval);
    
    return () => clearInterval(interval);
  }, [symbol, realTime, updateInterval, fetchData]);
  
  return { data, loading, error, refresh: fetchData };
}

// ============================================================================
// 🔥 Hook para MÚLTIPLOS ativos
// ============================================================================

export function useMultipleMarketData(symbols: string[], options: UseMarketDataOptions = {}) {
  const { updateInterval = 10000, realTime = false } = options;
  
  const [data, setData] = useState<Map<string, MarketData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const marketData = await getMultipleMarketData(symbols);
      setData(marketData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
      setLoading(false);
    }
  }, [symbols]);
  
  useEffect(() => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }
    
    // Buscar imediatamente
    fetchData();
    
    // Se WebSocket habilitado, usar tempo real para crypto
    if (realTime) {
      const cryptoSymbols = symbols.filter(s => s.includes('USD') && s !== 'BTCUSD');
      
      if (cryptoSymbols.length > 0) {
        const unsubscribe = subscribeToRealTimeUpdates(cryptoSymbols, (newData) => {
          setData(prev => {
            const updated = new Map(prev);
            updated.set(newData.symbol, newData);
            return updated;
          });
        });
        
        return unsubscribe;
      }
    }
    
    // Polling para todos
    const interval = setInterval(fetchData, updateInterval);
    
    return () => clearInterval(interval);
  }, [symbols, realTime, updateInterval, fetchData]);
  
  return { data, loading, error, refresh: fetchData };
}

// ============================================================================
// 🎯 Hook especializado para ASSET BROWSER
// ============================================================================

export function useAssetBrowserData(symbols: string[]) {
  return useMultipleMarketData(symbols, {
    updateInterval: 15000, // 15 segundos
    realTime: false // Usar polling para evitar sobrecarga
  });
}

// ============================================================================
// 📊 Hook para DASHBOARD (Top 10 ativos)
// ============================================================================

export function useDashboardData(topAssets: string[]) {
  return useMultipleMarketData(topAssets, {
    updateInterval: 10000, // 10 segundos
    realTime: true // Tempo real para principais ativos
  });
}

// ============================================================================
// 🔔 Hook para ALERTAS (Detectar mudanças significativas)
// ============================================================================

export function useMarketAlerts(symbol: string, threshold: number = 1) {
  const { data } = useMarketData(symbol, { realTime: true });
  const [alerts, setAlerts] = useState<string[]>([]);
  
  useEffect(() => {
    if (!data) return;
    
    // Detectar variações acima do threshold
    if (Math.abs(data.changePercent) >= threshold) {
      const alert = `${data.symbol}: ${data.signal} ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`;
      setAlerts(prev => [alert, ...prev].slice(0, 10)); // Manter últimos 10 alertas
    }
  }, [data, threshold]);
  
  return { alerts, currentData: data };
}
