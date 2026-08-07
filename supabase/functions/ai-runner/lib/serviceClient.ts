/**
 * Client Supabase de service-role pro runner escrever/ler diretamente
 * (ai_sessions, ai_trades, ai_decisions, ai_portfolio_snapshots) — fora do
 * fecho do motor, que só usa o shim em ../shims/supabaseClient.ts.
 *
 * Service-role ignora RLS de propósito: o runner não roda em nome de uma
 * sessão de usuário autenticado, mas o resultado (persistência das mesmas
 * tabelas, mesmo formato) precisa ser indistinguível do que o driver browser
 * grava sob RLS.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[ai-runner] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
