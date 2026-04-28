import { useState, useEffect, useCallback, useRef } from 'react';
import { publicAnonKey } from '/utils/supabase/info';
import { getApiUrl } from '/utils/api/config';
import { isEmergencyOfflineMode } from '@/app/services/EmergencyOfflineMode';

interface MT5Price {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  bid?: number;
  ask?: number;
  timestamp: string;
  error?: string;
}

interface MT5PricesResponse {
  success: boolean;
  count: number;
  total: number;
  prices: MT5Price[];
  timestamp: string;
}

/**
 * 🚀 HOOK: useMT5Prices
 * 
 * Busca preços REAIS do MT5 via MetaApi para múltiplos ativos.
 * Atualiza automaticamente a cada 10 segundos.
 */
export function useMT5Prices(symbols: string[], enabled = true) {
  const [prices, setPrices] = useState<Record<string, MT5Price>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 CRÍTICO: Estabilizar symbols com ref + JSON para evitar recriação de callback
  // Se `symbols` é um novo array a cada render, o useCallback recria fetchPrices
  // causando o useEffect reiniciar o interval desnecessariamente
  const symbolsRef = useRef<string[]>(symbols);
  const symbolsKey = symbols.join(',');

  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPrices = useCallback(async () => {
    const currentSymbols = symbolsRef.current;
    if (!enabled || currentSymbols.length === 0) return;

    // Buscar credenciais MT5 do localStorage
    const mt5Token = localStorage.getItem('mt5_token');
    const mt5AccountId = localStorage.getItem('mt5_accountId');

    if (!mt5Token || !mt5AccountId) {
      console.warn('[useMT5Prices] ⚠️ Credenciais MT5 não configuradas');
      setError('MT5 não configurado');
      return;
    }

    if (isEmergencyOfflineMode()) {
      console.log('[useMT5Prices] 🚫 Modo offline ativado - pulando fetch');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const apiUrl = getApiUrl('mt5-prices');
      const response = await fetch(
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            symbols: currentSymbols,
            token: mt5Token,
            accountId: mt5AccountId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: MT5PricesResponse = await response.json();

      // Converter array para objeto indexado por símbolo
      const pricesMap: Record<string, MT5Price> = {};
      data.prices.forEach((p) => {
        pricesMap[p.symbol] = p;
      });

      setPrices(pricesMap);
      
      const successCount = data.prices.filter(p => p.price !== null).length;
      console.log(`[useMT5Prices] ✅ ${successCount}/${currentSymbols.length} preços obtidos`);

    } catch (err: any) {
      console.error('[useMT5Prices] ❌ Erro:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled]); // 🔥 Removido `symbols` das deps — lemos via ref para evitar loop

  // Buscar ao montar e a cada 10 segundos
  // 🔥 symbolsKey garante que reiniciamos o interval quando os símbolos realmente mudam
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000); // 10s
    return () => clearInterval(interval);
  }, [fetchPrices, symbolsKey]);

  return {
    prices,
    loading,
    error,
    refresh: fetchPrices,
  };
}

/**
 * 🚀 HOOK: useMT5Price (singular)
 * 
 * Busca preço REAL de um único ativo do MT5.
 */
export function useMT5Price(symbol: string, enabled = true) {
  const { prices, loading, error, refresh } = useMT5Prices([symbol], enabled);
  return {
    price: prices[symbol] || null,
    loading,
    error,
    refresh,
  };
}