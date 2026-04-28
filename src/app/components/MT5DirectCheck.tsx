import React from 'react';
import { AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

/**
 * 🔍 MT5 Direct Check - Testa credenciais MetaApi DIRETAMENTE
 * Não depende do backend - testa direto na API da MetaApi
 */
export const MT5DirectCheck: React.FC = () => {
  const [result, setResult] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [accountId, setAccountId] = React.useState('');
  const [token, setToken] = React.useState('');
  const [showForm, setShowForm] = React.useState(false);

  const testCredentials = async (testAccountId?: string, testToken?: string) => {
    const finalAccountId = testAccountId || accountId;
    const finalToken = testToken || token;
    
    if (!finalAccountId || !finalToken) {
      setResult({
        error: 'Por favor, forneça Account ID e Token',
        status: 'missing_credentials'
      });
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('[MT5 DIRECT CHECK] 🔍 Testando credenciais diretamente...');
      console.log('[MT5 DIRECT CHECK] Account ID:', finalAccountId);
      console.log('[MT5 DIRECT CHECK] Token prefix:', finalToken.substring(0, 15) + '...');
      
      // Testar endpoint da MetaApi diretamente
      const url = `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${finalAccountId}`;
      
      console.log('[MT5 DIRECT CHECK] URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'auth-token': finalToken,
          'Accept': 'application/json'
        }
      });
      
      console.log('[MT5 DIRECT CHECK] Response status:', response.status);
      console.log('[MT5 DIRECT CHECK] Response OK:', response.ok);
      
      let data;
      try {
        data = await response.json();
        console.log('[MT5 DIRECT CHECK] Response data:', data);
      } catch (parseError) {
        const text = await response.text();
        console.error('[MT5 DIRECT CHECK] Parse error. Raw:', text.substring(0, 200));
        data = { 
          error: 'Resposta não é JSON válido',
          raw: text.substring(0, 200),
          status: response.status 
        };
      }
      
      if (response.ok && data && !data.error) {
        setResult({
          success: true,
          status: 'connected',
          account: {
            id: data._id || data.id || finalAccountId,
            name: data.name || 'N/A',
            type: data.type || 'N/A',
            platform: data.platform || 'MT5',
            broker: data.brokerName || data.broker || 'N/A',
            server: data.server || 'N/A',
            connectionStatus: data.connectionStatus || 'unknown',
            state: data.state || 'unknown'
          },
          raw_data: data
        });
      } else {
        setResult({
          error: data.error || data.message || `HTTP ${response.status}`,
          status: 'failed',
          http_status: response.status,
          details: data
        });
      }
      
    } catch (error: any) {
      console.error('[MT5 DIRECT CHECK] ❌ Erro:', error);
      setResult({
        error: error.message,
        error_type: error.name,
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-test se tiver credenciais no localStorage
  React.useEffect(() => {
    const savedAccountId = localStorage.getItem('mt5_account_id');
    const savedToken = localStorage.getItem('mt5_token');
    
    if (savedAccountId && savedToken) {
      setAccountId(savedAccountId);
      setToken(savedToken);
      testCredentials(savedAccountId, savedToken);
    } else {
      setShowForm(true);
    }
  }, []);

  const handleTest = () => {
    // Salvar no localStorage
    localStorage.setItem('mt5_account_id', accountId);
    localStorage.setItem('mt5_token', token);
    testCredentials();
  };

  const handleClear = () => {
    localStorage.removeItem('mt5_account_id');
    localStorage.removeItem('mt5_token');
    setAccountId('');
    setToken('');
    setResult(null);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-6 bg-blue-50/50 border border-blue-200 rounded-xl backdrop-blur-sm">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <div>
          <div className="text-blue-900 font-semibold">Testando conexão MetaApi...</div>
          <div className="text-blue-700 text-sm mt-1">Aguarde enquanto validamos suas credenciais</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-neutral-100">🔍 Diagnóstico MetaApi</h3>
          <p className="text-sm text-neutral-400 mt-1">Teste direto na API - sem passar pelo backend</p>
        </div>
        {result && (
          <button
            onClick={() => testCredentials()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Testar Novamente
          </button>
        )}
      </div>

      {/* FORM */}
      {(showForm || !result) && (
        <div className="bg-neutral-950/50 border border-white/5 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Account ID
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="ex: 1234abcd-5678-90ef-ghij-klmnopqrstuv"
              className="w-full px-4 py-2 bg-neutral-900/50 border border-white/10 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              API Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Seu token MetaApi"
              className="w-full px-4 py-2 bg-neutral-900/50 border border-white/10 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={!accountId || !token}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Testar Credenciais
            </button>
            {result && (
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-all"
              >
                Fechar
              </button>
            )}
          </div>

          <div className="text-xs text-neutral-500 bg-neutral-900/30 border border-white/5 rounded-lg p-3">
            <strong className="text-neutral-400">ℹ️ Onde encontrar:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Acesse: <a href="https://app.metaapi.cloud/accounts" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">app.metaapi.cloud/accounts</a></li>
              <li>Copie o <strong>Account ID</strong> da sua conta</li>
              <li>No menu, vá em "API tokens" e copie seu token</li>
            </ul>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {result && (
        <div className="space-y-4">
          {/* Status Card */}
          <div className={`p-6 rounded-xl border backdrop-blur-sm ${
            result.success 
              ? 'bg-green-950/30 border-green-500/30' 
              : 'bg-red-950/30 border-red-500/30'
          }`}>
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
              <div>
                <div className={`text-lg font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.success ? '✅ Conexão Bem-Sucedida!' : '❌ Falha na Conexão'}
                </div>
                <div className={`text-sm mt-1 ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                  {result.success 
                    ? 'Suas credenciais MetaApi estão corretas e funcionando.' 
                    : result.error || 'Não foi possível conectar à MetaApi'}
                </div>
              </div>
            </div>
          </div>

          {/* Account Details */}
          {result.success && result.account && (
            <div className="bg-neutral-950/50 border border-white/5 rounded-xl p-6 space-y-3">
              <h4 className="text-sm font-bold text-neutral-100 mb-4">📋 Detalhes da Conta</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Account ID</div>
                  <div className="text-sm text-neutral-100 font-mono">{result.account.id}</div>
                </div>
                
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Nome</div>
                  <div className="text-sm text-neutral-100">{result.account.name}</div>
                </div>
                
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Broker</div>
                  <div className="text-sm text-neutral-100">{result.account.broker}</div>
                </div>
                
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Servidor</div>
                  <div className="text-sm text-neutral-100">{result.account.server}</div>
                </div>
                
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Plataforma</div>
                  <div className="text-sm text-neutral-100">{result.account.platform}</div>
                </div>
                
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Status</div>
                  <div className={`text-sm font-semibold ${
                    result.account.connectionStatus === 'CONNECTED' ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {result.account.connectionStatus}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showForm ? 'Ocultar' : 'Editar'} Credenciais
                </button>
                <button
                  onClick={handleClear}
                  className="ml-4 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Limpar Dados
                </button>
              </div>
            </div>
          )}

          {/* Error Details */}
          {result.error && (
            <div className="bg-neutral-950/50 border border-red-500/20 rounded-xl p-6">
              <h4 className="text-sm font-bold text-red-400 mb-3">🔍 Detalhes do Erro</h4>
              <div className="space-y-2 text-xs text-neutral-400">
                <div>
                  <span className="text-neutral-500">Erro:</span>{' '}
                  <span className="text-red-400">{result.error}</span>
                </div>
                {result.http_status && (
                  <div>
                    <span className="text-neutral-500">HTTP Status:</span>{' '}
                    <span className="text-red-400">{result.http_status}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowForm(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Editar Credenciais
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
