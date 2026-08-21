/**
 * Client Supabase de service-role pro job do scorecard de performance por
 * ativo. Mesma razão de existir dos gêmeos em `ai-runner/lib/serviceClient.ts`
 * e `partner-commission-accrual/lib/serviceClient.ts`: o job não roda em nome
 * de um usuário autenticado, então precisa ignorar RLS de propósito pra ler
 * `ai_trades` de todo mundo e escrever em `asset_performance_scorecard`, que
 * o client só pode ler (a própria linha), nunca escrever.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[asset-performance-scorecard] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
