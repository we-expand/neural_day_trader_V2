/**
 * Client Supabase de service-role pro job de apuração mensal do Programa de
 * Parceiros IB. Mesma razão de existir do gêmeo em `ai-runner/lib/serviceClient.ts`:
 * o job não roda em nome de um usuário autenticado, então precisa ignorar RLS
 * de propósito para ler `broker_order_executions`/`partner_referrals` de todo
 * mundo e escrever em `partner_commission_entries`/`partner_accounts.tier`,
 * que o cliente só pode ler, nunca escrever.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[partner-commission-accrual] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
