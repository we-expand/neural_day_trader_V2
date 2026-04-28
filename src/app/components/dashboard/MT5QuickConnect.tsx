/**
 * 🚀 MT5 QUICK CONNECT - Ativação Rápida da Conta Real
 * 
 * Interface simplificada para conectar MetaAPI e obter preços 100% reais
 */

import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle, XCircle, AlertCircle, ExternalLink, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MT5QuickConnectProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MT5QuickConnect({ isOpen, onClose }: MT5QuickConnectProps) {
  const [step, setStep] = useState<'credentials' | 'testing' | 'success' | 'error'>('credentials');
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar credenciais salvas
  useEffect(() => {
    if (isOpen) {
      const savedToken = localStorage.getItem('metaapi_token') || '';
      const savedAccountId = localStorage.getItem('metaapi_account_id') || '';
      setToken(savedToken);
      setAccountId(savedAccountId);
      
      if (savedToken && savedAccountId) {
        // Se já tem credenciais, testar automaticamente
        handleTest(savedToken, savedAccountId);
      }
    }
  }, [isOpen]);

  // Testar conexão
  const handleTest = async (testToken?: string, testAccountId?: string) => {
    const finalToken = testToken || token;
    const finalAccountId = testAccountId || accountId;

    if (!finalToken || !finalAccountId) {
      setError('❌ Preencha Token e Account ID');
      return;
    }

    setIsLoading(true);
    setStep('testing');
    setError('');

    try {
      // PASSO 1: Tentar listar contas disponíveis (ajuda no diagnóstico)
      console.log('[MT5 Quick Connect] 🔍 Listando contas disponíveis...');
      const listUrl = 'https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts';
      
      try {
        const listResponse = await fetch(listUrl, {
          method: 'GET',
          headers: { 'auth-token': finalToken },
        });
        
        if (listResponse.ok) {
          const accounts = await listResponse.json();
          console.log('[MT5 Quick Connect] 📋 Contas encontradas:', accounts.length);
          accounts.forEach((acc: any, i: number) => {
            console.log(`  ${i + 1}. ${acc.name} (ID: ${acc._id}) - ${acc.state} - Região: ${acc.region || 'new-york'}`);
          });
        } else {
          console.log('[MT5 Quick Connect] ⚠️ Não conseguiu listar contas (pode ser problema de token)');
        }
      } catch (listErr) {
        console.log('[MT5 Quick Connect] ⚠️ Erro ao listar contas:', listErr);
      }

      // PASSO 2: Tentar todas as regiões disponíveis
      const regions = ['new-york', 'london', 'singapore'];
      let successResult: any = null;
      let successRegion = '';

      for (const region of regions) {
        const url = `https://mt-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${finalAccountId}`;
        
        console.log(`[MT5 Quick Connect] 🧪 Testando região: ${region}`);
        
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'auth-token': finalToken },
          });

          const data = await response.json();
          
          if (response.ok && data._id) {
            // ✅ SUCESSO nesta região!
            successResult = data;
            successRegion = region;
            console.log(`[MT5 Quick Connect] ✅ Conexão bem-sucedida na região: ${region}`, data);
            break;
          } else {
            console.log(`[MT5 Quick Connect] ❌ Região ${region} falhou:`, response.status);
          }
        } catch (regionErr) {
          console.log(`[MT5 Quick Connect] ❌ Erro na região ${region}:`, regionErr);
        }
      }

      if (successResult && successRegion) {
        // ✅ SUCESSO!
        console.log(`[MT5 Quick Connect] 🎉 Conectado com sucesso na região: ${successRegion}`);
        
        // Salvar credenciais + região
        localStorage.setItem('metaapi_token', finalToken);
        localStorage.setItem('metaapi_account_id', finalAccountId);
        localStorage.setItem('metaapi_region', successRegion);
        
        setTestResult(successResult);
        setStep('success');
        
        toast.success(`✅ MT5 conectado com sucesso! (Região: ${successRegion})`);
        
        // Fechar após 2 segundos e recarregar
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 2000);
      } else {
        // ❌ ERRO - Nenhuma região funcionou
        console.error('[MT5 Quick Connect] ❌ Falha em todas as regiões');
        
        let errorMessage = `❌ Account ID não encontrado em NENHUMA região.\n\n🔍 Regiões testadas: ${regions.join(', ')}\n\n✅ POSSÍVEIS CAUSAS:\n1. Account ID incorreto - Copie o ID EXATO de app.metaapi.cloud\n2. Token sem acesso - Token não tem permissão para essa conta\n3. Conta não provisionada - Conta não está deployada ainda\n\n💡 DICA: Verifique o console (F12) para ver as contas disponíveis`;
        
        setError(errorMessage);
        setStep('error');
        toast.error('Falha na conexão MT5');
      }
    } catch (err: any) {
      console.error('[MT5 Quick Connect] ❌ Erro ao testar:', err);
      setError(`❌ Erro de conexão.\n\n🔍 DEBUG INFO:\n• ${err.message}\n\n✅ Verifique sua internet.`);
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText('https://app.metaapi.cloud/accounts');
    toast.success('Link copiado!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-2xl mx-4 bg-gradient-to-br from-[#131722] to-[#1a1e2e] rounded-2xl border border-emerald-500/30 shadow-2xl">
        {/* Header */}
        <div className="relative p-6 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Zap className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                🚀 Ativação Rápida MT5
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Conecte sua conta real do MetaTrader 5 e obtenha preços 100% precisos
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status atual */}
          {step === 'testing' && (
            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <div>
                <div className="text-blue-300 font-semibold">Testando conexão...</div>
                <div className="text-blue-400 text-sm">Validando suas credenciais no MetaAPI</div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-emerald-300 font-semibold">✅ Conectado com sucesso!</div>
                <div className="text-emerald-400 text-sm">
                  Conta: {testResult?.login || accountId} | Broker: {testResult?.brokerName || 'MT5'}
                </div>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-red-300 font-semibold">❌ Falha na conexão</div>
                <div className="text-red-400 text-sm mt-1 whitespace-pre-line">{error}</div>
              </div>
            </div>
          )}

          {/* Passo 1: Obter credenciais */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-300">
                <strong className="block mb-2">📋 Como obter suas credenciais:</strong>
                <ol className="space-y-2 ml-4 list-decimal">
                  <li>
                    Acesse sua conta MetaAPI:{' '}
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline"
                    >
                      app.metaapi.cloud/accounts
                      <Copy className="w-3 h-3" />
                    </button>
                  </li>
                  <li>Clique na sua conta MT5 conectada</li>
                  <li>Copie o <strong className="text-white">Account ID</strong> (campo "id" no topo)</li>
                  <li>
                    Vá em "API tokens" no menu lateral e copie seu{' '}
                    <strong className="text-white">Token</strong>
                  </li>
                </ol>
              </div>
            </div>

            {/* Token */}
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                🔑 MetaAPI Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-4 py-3 pr-12 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-700 rounded transition-colors"
                >
                  {showToken ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Token longo (500+ caracteres) começando com "eyJhbGci..."
              </div>
            </div>

            {/* Account ID */}
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                🆔 Account ID
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                className="w-full px-4 py-3 bg-[#1e222d] border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <div className="mt-1 text-xs text-gray-400">
                ID único da sua conta (formato UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
              </div>
            </div>
          </div>

          {/* Benefícios */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="text-sm font-bold text-white mb-3">✨ Benefícios da conexão real:</div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Preços 100% reais</strong> de todos os 300+ ativos</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Spreads reais</strong> do seu broker</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Histórico completo</strong> de candles para backtesting</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Execução de ordens reais</strong> (quando ativar AI)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Sincronização automática</strong> com MT5</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between gap-4">
          <a
            href="https://app.metaapi.cloud/accounts"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm font-semibold"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir MetaAPI
          </a>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors font-semibold text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleTest()}
              disabled={!token || !accountId || isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 rounded-lg transition-all font-bold text-sm shadow-lg shadow-emerald-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Conectar MT5
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}