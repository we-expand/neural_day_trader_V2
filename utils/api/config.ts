/**
 * 🔧 API Configuration
 * Centraliza URLs das APIs para facilitar migração entre ambientes
 */

// Detectar se está rodando localmente ou em produção
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// URL base da API - pode ser Supabase ou Vercel
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  (isLocal
    ? 'http://localhost:3000/api'  // Desenvolvimento local
    : 'https://neural-trader-platform.vercel.app/api' // Produção Vercel - ATUALIZADO
  );

// Legacy Supabase URL (mantido como fallback)
export const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/make-server-1dbacac6`
  : 'https://bgarakvnuppzkugzptsr.supabase.co/functions/v1/make-server-1dbacac6';

// Preferir Vercel sobre Supabase (para economizar quota)
// ✅ ATIVADO para migrar do Supabase 402 error
export const USE_VERCEL_API = true;

/**
 * Helper para construir URL de endpoint
 */
export function getApiUrl(endpoint: string): string {
  // Se estiver em modo offline, e for para Supabase, retornar URL nula ou mock
  const isOffline = typeof window !== 'undefined' && localStorage.getItem('neural_emergency_offline') === 'true';
  
  if (USE_VERCEL_API) {
    // Remove leading slash se existir
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Fallback se URL da Vercel ainda não estiver configurada
    if (API_BASE_URL.includes('your-project.vercel.app')) {
       // Se ainda é o placeholder, tenta Supabase se não estiver em modo offline
       if (!isOffline) return `${SUPABASE_FUNCTIONS_URL}/${endpoint}`;
       return `/api/offline-fallback?endpoint=${endpoint}`;
    }
    
    return `${API_BASE_URL}/${cleanEndpoint}`;
  }

  if (isOffline) {
    return `/api/offline-fallback?endpoint=${endpoint}`;
  }

  return `${SUPABASE_FUNCTIONS_URL}/${endpoint}`;
}

/**
 * Endpoints disponíveis
 */
export const API_ENDPOINTS = {
  // Auth
  signup: '/signup',
  deleteUser: '/delete-user',

  // Market Data
  binance: (symbol: string) => `/binance?symbol=${symbol}`,
  yahoo: (symbol: string) => `/yahoo?symbol=${symbol}`,

  // Health
  health: '/health',
} as const;
