import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseAnonKey = publicAnonKey;

export const isSupabaseActive = !!(supabaseUrl && supabaseAnonKey);

// ✅ SUPABASE CLIENT RE-HABILITADO - Proteções mantidas para prevenir IframeMessageAbortError
// Cliente criado com proteções de ambiente e storage seguro
export const supabase = isSupabaseActive 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // 🛡️ FIX: Usar localStorage apenas se disponível
        storage: typeof window !== 'undefined' && window.localStorage 
          ? window.localStorage 
          : undefined
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;