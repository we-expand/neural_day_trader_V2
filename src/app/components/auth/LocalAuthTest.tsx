/**
 * 🧪 LOCAL AUTH TEST COMPONENT
 * Componente de teste para verificar se o LocalAuth está funcionando
 */

import React, { useState } from 'react';
import * as LocalAuth from '../../services/LocalAuthService';
import { toast } from 'sonner';

export function LocalAuthTest() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (msg: string) => {
    console.log('[LocalAuthTest]', msg);
    setTestResults(prev => [...prev, msg]);
  };

  const runTests = async () => {
    setTestResults([]);
    addResult('🧪 Iniciando testes...');

    try {
      // Teste 1: Criar usuário
      addResult('📝 Teste 1: Criando usuário teste@local.com...');
      const signUpResult = await LocalAuth.signUpLocal('teste@local.com', '123456', 'Teste User');

      if (signUpResult.error && signUpResult.error !== 'Usuário já existe') {
        addResult(`❌ Falha no signup: ${signUpResult.error}`);
        return;
      }

      addResult(`✅ Usuário criado: ${signUpResult.user.email}`);

      // Teste 2: Login com senha correta
      addResult('🔐 Teste 2: Login com senha correta...');
      const loginResult = await LocalAuth.signInLocal('teste@local.com', '123456');

      if (loginResult.error) {
        addResult(`❌ Falha no login: ${loginResult.error}`);
        return;
      }

      addResult(`✅ Login bem sucedido: ${loginResult.user?.email}`);

      // Teste 3: Login com senha errada
      addResult('🔐 Teste 3: Login com senha errada...');
      const wrongPasswordResult = await LocalAuth.signInLocal('teste@local.com', 'senha_errada');

      if (wrongPasswordResult.user) {
        addResult(`❌ ERRO: Login deveria falhar mas passou!`);
        return;
      }

      addResult(`✅ Login rejeitado corretamente: ${wrongPasswordResult.error}`);

      // Teste 4: Verificar sessão
      addResult('📊 Teste 4: Verificando sessão...');
      const session = LocalAuth.getLocalSession();

      if (!session) {
        addResult(`⚠️ Nenhuma sessão ativa`);
      } else {
        addResult(`✅ Sessão encontrada: ${session.email}`);
      }

      // Teste 5: Listar usuários
      addResult('📋 Teste 5: Listando usuários...');
      const users = LocalAuth.listLocalUsers();
      addResult(`✅ ${users.length} usuário(s) no sistema: ${users.join(', ')}`);

      addResult('🎉 TODOS OS TESTES PASSARAM!');
      toast.success('Testes Concluídos!', { description: 'LocalAuth funcionando corretamente' });

    } catch (error: any) {
      addResult(`❌ ERRO CRÍTICO: ${error.message}`);
      console.error('[LocalAuthTest] Erro:', error);
      toast.error('Erro nos Testes', { description: error.message });
    }
  };

  const clearStorage = () => {
    localStorage.clear();
    setTestResults([]);
    addResult('🗑️ LocalStorage limpo');
    toast.info('Storage Limpo', { description: 'Todos os dados locais foram apagados' });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[999] bg-black/90 backdrop-blur-lg border border-white/10 rounded-lg p-4 max-w-md">
      <h3 className="text-white font-bold mb-3 text-sm">🧪 LocalAuth Test</h3>

      <div className="flex gap-2 mb-3">
        <button
          onClick={runTests}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
        >
          Rodar Testes
        </button>
        <button
          onClick={clearStorage}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
        >
          Limpar Storage
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="bg-slate-900/50 rounded p-2 max-h-60 overflow-y-auto">
          {testResults.map((result, i) => (
            <div key={i} className="text-xs font-mono text-slate-300 mb-1">
              {result}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
