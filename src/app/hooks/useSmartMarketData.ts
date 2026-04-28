/**
 * 🎯 USE SMART MARKET DATA HOOK
 * 
 * Hook personalizado que usa o DataSourceRouter para obter dados
 * automaticamente da melhor fonte disponível.
 * 
 * USO:
 * ```tsx
 * const { data, loading, error, quality, validate } = useSmartMarketData('BTCUSD');
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { dataSourceRouter, type SourcedMarketData } from '@/app/services/DataSourceRouter';
import { dataQualityMonitor, type ValidationResult } from '@/app/services/DataQualityMonitor';

interface UseSmartMarketDataReturn {
  data: SourcedMarketData | null;
  validation: ValidationResult | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  validate: () => Promise<void>;
}

export function useSmartMarketData(
  symbol: string,
  autoRefresh: boolean = true,
  refreshInterval: number = 2000 // 2 segundos
): UseSmartMarketDataReturn {
  const [data, setData] = useState<SourcedMarketData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch de dados
  const fetchData = useCallback(async () => {
    if (!symbol) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataSourceRouter.getMarketData(symbol);
      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao buscar dados');
      setError(error);
      console.error(`[useSmartMarketData] Erro ao buscar ${symbol}:`, error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Validação de qualidade
  const validate = useCallback(async () => {
    if (!symbol) return;
    
    try {
      const result = await dataQualityMonitor.validateSymbol(symbol);
      setValidation(result);
    } catch (err) {
      console.error(`[useSmartMarketData] Erro ao validar ${symbol}:`, err);
    }
  }, [symbol]);

  // Refresh manual
  const refresh = useCallback(async () => {
    await fetchData();
    await validate();
  }, [fetchData, validate]);

  // Auto-refresh
  useEffect(() => {
    // Fetch inicial
    fetchData();
    
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh, refreshInterval]);

  return {
    data,
    validation,
    loading,
    error,
    refresh,
    validate
  };
}

/**
 * 🔍 Hook para validação de qualidade em lote
 */
export function useSmartMarketDataBatch(
  symbols: string[],
  autoRefresh: boolean = true,
  refreshInterval: number = 60000 // 60 segundos
) {
  const [validations, setValidations] = useState<Map<string, ValidationResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const validateAll = useCallback(async () => {
    if (symbols.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const results = await dataQualityMonitor.validateBatch(symbols);
      setValidations(results);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao validar lote');
      setError(error);
      console.error('[useSmartMarketDataBatch] Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  // Auto-refresh
  useEffect(() => {
    // Validação inicial
    validateAll();
    
    if (!autoRefresh) return;
    
    const interval = setInterval(validateAll, refreshInterval);
    
    return () => clearInterval(interval);
  }, [validateAll, autoRefresh, refreshInterval]);

  return {
    validations,
    loading,
    error,
    refresh: validateAll
  };
}
