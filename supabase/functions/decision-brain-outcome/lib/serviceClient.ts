/**
 * Client Supabase de service-role pra este job. Mesma razão de existir dos
 * gêmeos em `ai-runner/lib/serviceClient.ts`, `jarvis/lib/serviceClient.ts`
 * e `asset-performance-scorecard/lib/serviceClient.ts`: o job não roda em
 * nome de usuário autenticado — precisa ignorar RLS de propósito pra ler
 * `ai_decision_brain_shadow` de todo mundo e gravar o resultado hipotético.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[decision-brain-outcome] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
