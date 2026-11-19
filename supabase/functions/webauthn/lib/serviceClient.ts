/**
 * Client Supabase de service-role pro webauthn. Mesmo padrão de
 * nexus-brain/ai-runner/jarvis — precisa gravar/ler credenciais e
 * challenges de qualquer usuário sem depender de sessão dele (a
 * autenticação por biometria acontece ANTES de existir uma sessão).
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[webauthn] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
