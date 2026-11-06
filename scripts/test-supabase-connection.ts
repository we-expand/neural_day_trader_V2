import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wyvdsxtcmizettljxtbg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dmRzeHRjbWl6ZXR0bGp4dGJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjU4OTM5NiwiZXhwIjoyMDgyMTY1Mzk2fQ.VQN49Rs15n3_7Vs7Om_Nh80s6-IQbnCZ10tu1WGm_5s'
);

async function test() {
  console.log('Testando conexão ao Supabase com service_role key...\n');

  try {
    // 1. Teste simples: listar todas as sessões
    const { data: sessions, error } = await supabase
      .from('ai_sessions')
      .select('id, user_id, strategy_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erro na query:', error);
      return;
    }

    console.log(`✅ Conexão OK! Encontradas ${sessions?.length || 0} sessões:\n`);
    sessions?.forEach((s: any) => {
      console.log(`   ${s.strategy_name} | User: ${s.user_id} | Status: ${s.status} | Created: ${new Date(s.created_at).toLocaleString('pt-BR')}`);
    });

    // 2. Procurar especificamente por LLM_ACTIVE_BRAIN_MT5
    const { data: mt5Sessions } = await supabase
      .from('ai_sessions')
      .select('*')
      .eq('strategy_name', 'LLM_ACTIVE_BRAIN_MT5');

    console.log(`\n🔍 Sessões LLM_ACTIVE_BRAIN_MT5: ${mt5Sessions?.length || 0}`);
    mt5Sessions?.forEach((s: any) => {
      console.log(`   ID: ${s.id} | User: ${s.user_id} | Created: ${new Date(s.created_at).toLocaleString('pt-BR')}`);
    });

    // 3. Procurar por user_id específico
    const userId = 'aeb3ec15-f660-4775-856b-2a04b20f4592';
    const { data: userSessions } = await supabase
      .from('ai_sessions')
      .select('*')
      .eq('user_id', userId);

    console.log(`\n👤 Sessões do usuário ${userId}: ${userSessions?.length || 0}`);
    userSessions?.forEach((s: any) => {
      console.log(`   ${s.strategy_name} | Status: ${s.status} | Created: ${new Date(s.created_at).toLocaleString('pt-BR')}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  }

  process.exit(0);
}

test();
