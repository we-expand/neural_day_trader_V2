/**
 * Client Supabase de service-role pro NEXUS. Mesma razão de existir dos
 * gêmeos em `ai-runner/lib/serviceClient.ts` e `jarvis/lib/serviceClient.ts`:
 * o endpoint precisa ler ai_trades/ai_sessions de qualquer usuário
 * autenticado (chamado a partir do próprio browser dele) e gravar em
 * nexus_alerts quando chamado pelo tick do ai-runner, sem depender de RLS
 * de sessão de usuário.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[nexus-brain] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
