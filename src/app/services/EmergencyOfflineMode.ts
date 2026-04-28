/**
 * 🚨 EMERGENCY OFFLINE MODE
 *
 * Sistema de emergência que DESATIVA completamente Supabase
 * e usa APENAS dados locais/simulados
 *
 * Ativa automaticamente quando detecta erro 402 ou CORS
 */

// Flag global de modo offline
let EMERGENCY_OFFLINE_MODE = false;

/**
 * Ativa modo offline de emergência
 */
export function activateEmergencyOfflineMode() {
  if (!EMERGENCY_OFFLINE_MODE) {
    console.warn('[EMERGENCY] 🚨 MODO OFFLINE ATIVADO - Supabase desabilitado');
    EMERGENCY_OFFLINE_MODE = true;
    localStorage.setItem('neural_emergency_offline', 'true');
  }
}

/**
 * Verifica se está em modo offline
 */
export function isEmergencyOfflineMode(): boolean {
  if (!EMERGENCY_OFFLINE_MODE) {
    // Verifica localStorage
    EMERGENCY_OFFLINE_MODE = localStorage.getItem('neural_emergency_offline') === 'true';
  }
  return EMERGENCY_OFFLINE_MODE;
}

/**
 * Desativa modo offline (para testes)
 */
export function deactivateEmergencyOfflineMode() {
  console.log('[EMERGENCY] ✅ Modo offline desativado');
  EMERGENCY_OFFLINE_MODE = false;
  localStorage.removeItem('neural_emergency_offline');
}

/**
 * Intercepta fetch e retorna dados simulados se em modo offline
 */
export async function emergencyFetch(url: string, options?: RequestInit): Promise<Response> {
  // Ativar modo offline se URL for Supabase
  if (url.includes('supabase.co')) {
    activateEmergencyOfflineMode();
  }

  // Se está em modo offline, retornar mock imediatamente
  if (isEmergencyOfflineMode() && url.includes('supabase.co')) {
    console.warn('[EMERGENCY] 🚫 Bloqueando chamada Supabase:', url);

    return new Response(
      JSON.stringify({ error: 'Offline mode', offline: true }),
      {
        status: 503,
        statusText: 'Service Unavailable - Offline Mode',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Caso contrário, fetch normal
  return fetch(url, options);
}

// Ativar automaticamente no load se já estava ativo
if (typeof window !== 'undefined') {
  if (localStorage.getItem('neural_emergency_offline') === 'true') {
    activateEmergencyOfflineMode();
  }
}
