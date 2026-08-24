/**
 * Client Supabase de service-role pro Jarvis. Mesma razão de existir dos
 * gêmeos em `ai-runner/lib/serviceClient.ts` e
 * `asset-performance-scorecard/lib/serviceClient.ts`: o job não roda em nome
 * de um usuário autenticado, então precisa ignorar RLS de propósito pra ler
 * `ai_trades`/`price_guard_events` de todo mundo e escrever nas tabelas
 * `jarvis_*`, que o client só pode ler (auditoria pública), nunca escrever.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[jarvis] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
