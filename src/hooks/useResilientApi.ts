/**
 * 🔄 RESILIENT API HOOK
 * 
 * React hook for making resilient API calls with automatic retry
 */

import { useState, useCallback } from 'react';
import { apiCall, resilientFetch } from '@/utils/api-client';

interface UseResilientApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  maxAttempts?: number;
}

export function useResilientApi<T = any>(options: UseResilientApiOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (url: string, requestOptions: RequestInit = {}) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiCall<T>(
          url,
          requestOptions,
          options.maxAttempts ? { maxAttempts: options.maxAttempts } : undefined
        );

        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    loading,
    error,
    data,
    execute,
    reset,
  };
}

/**
 * Hook for GET requests
 */
export function useResilientGet<T = any>(url: string, options: UseResilientApiOptions = {}) {
  const api = useResilientApi<T>(options);

  const fetch = useCallback(() => {
    return api.execute(url, { method: 'GET' });
  }, [url, api]);

  return {
    ...api,
    fetch,
  };
}

/**
 * Hook for POST requests
 */
export function useResilientPost<T = any>(url: string, options: UseResilientApiOptions = {}) {
  const api = useResilientApi<T>(options);

  const post = useCallback(
    (body?: any) => {
      return api.execute(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    [url, api]
  );

  return {
    ...api,
    post,
  };
}
