import React from 'react';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export const MT5Diagnostics: React.FC = () => {
  const [result, setResult] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<boolean>(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      console.log('[MT5 DIAGNOSTICS] Iniciando requisição...');
      console.log('[MT5 DIAGNOSTICS] Project ID:', projectId);
      console.log('[MT5 DIAGNOSTICS] Public Anon Key:', publicAnonKey ? `${publicAnonKey.substring(0, 20)}...` : 'NOT_SET');
      
      // Testar múltiplos endpoints
      const endpoints = [
        {
          name: 'Health Check',
          url: `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/health`,
          method: 'GET',
          needsAuth: false
        },
        {
          name: 'Public MT5 Status',
          url: `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/public/mt5-status`,
          method: 'GET',
          needsAuth: false
        },
        {
          name: 'MT5 Check (Autenticado)',
          url: `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/mt5-check`,
          method: 'GET',
          needsAuth: true
        }
      ];
      
      const results: any = {};
      
      for (const endpoint of endpoints) {
        console.log(`[MT5 DIAGNOSTICS] Testando: ${endpoint.name}`);
        console.log(`[MT5 DIAGNOSTICS] URL: ${endpoint.url}`);
        
        try {
          const headers: any = {
            'Content-Type': 'application/json',
          };
          
          if (endpoint.needsAuth) {
            headers['Authorization'] = `Bearer ${publicAnonKey}`;
          }
          
          const response = await fetch(endpoint.url, {
            method: endpoint.method,
            headers,
          });
          
          console.log(`[MT5 DIAGNOSTICS] ${endpoint.name} - Status:`, response.status);
          
          let data;
          try {
            data = await response.json();
            console.log(`[MT5 DIAGNOSTICS] ${endpoint.name} - Data:`, data);
          } catch (parseError) {
            const text = await response.text();
            console.error(`[MT5 DIAGNOSTICS] ${endpoint.name} - Parse error. Raw:`, text.substring(0, 200));
            data = { error: `Parse error: ${text.substring(0, 100)}...`, raw_status: response.status };
          }
          
          results[endpoint.name] = {
            status: response.status,
            ok: response.ok,
            data
          };
          
          // Se conseguiu conectar com sucesso, usar esse resultado
          if (response.ok && data && !data.error) {
            setResult(data);
            return;
          }
          
          // Se receber 401, marcar erro de autenticação
          if (response.status === 401) {
            setAuthError(true);
          }
          
        } catch (fetchError: any) {
          console.error(`[MT5 DIAGNOSTICS] ${endpoint.name} - Fetch error:`, fetchError);
          results[endpoint.name] = {
            error: fetchError.message,
            error_type: fetchError.name
          };
        }
      }
      
      // Se nenhum endpoint funcionou, mostrar todos os resultados
      console.log('[MT5 DIAGNOSTICS] Todos os resultados:', results);
      setResult({
        error: 'Não foi possível conectar a nenhum endpoint',
        all_results: results,
        message: 'Verifique os logs do console para mais detalhes'
      });
      
    } catch (error: any) {
      console.error('[MT5 DIAGNOSTICS] Erro geral:', error);
      setResult({ error: error.message, error_type: error.name });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    runDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-blue-900">Verificando credenciais MetaApi...</span>
      </div>
    );
  }

  if (!result) return null;

  const isConfigured = result.env_configured && result.token_exists && result.account_id && result.account_id !== 'NOT_SET';
  const isWorking = result.test_request?.ok;

  return (
    <div className="space-y-4 p-6 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-2">
        {isWorking ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : isConfigured ? (
          <AlertCircle className="w-6 h-6 text-yellow-600" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600" />
        )}
        <h3 className="text-lg font-semibold text-gray-900">
          {isWorking ? '✅ MetaApi Conectado' : isConfigured ? '⚠️ MetaApi Configurado (Verificar Account ID)' : '❌ MetaApi Não Configurado'}
        </h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Token:</span>
          {result.token_exists ? (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Configurado ({result.token_length} caracteres)
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              Não configurado
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Account ID:</span>
          {result.account_id && result.account_id !== 'NOT_SET' ? (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {result.account_id}
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              Não configurado
            </span>
          )}
        </div>

        {result.test_request && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <div className="text-sm font-medium text-gray-700 mb-2">Teste de Conexão:</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <span className={result.test_request.ok ? 'text-green-600' : 'text-red-600'}>
                  {result.test_request.status} {result.test_request.ok ? '✓' : '✗'}
                </span>
              </div>
              {result.test_request.body && (
                <div className="mt-2">
                  <span className="font-medium">Resposta:</span>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(result.test_request.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {result.test_error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <div className="text-sm font-medium text-red-700 mb-1">Erro de Conexão:</div>
            <div className="text-xs text-red-600">{result.test_error}</div>
          </div>
        )}
      </div>

      {!isConfigured && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <div className="text-sm font-medium text-yellow-900 mb-2">📋 Como Configurar:</div>
          <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
            <li>Acesse: <a href="https://app.metaapi.cloud/accounts" target="_blank" rel="noopener noreferrer" className="underline">https://app.metaapi.cloud/accounts</a></li>
            <li>Copie o <strong>Account ID</strong> da sua conta MT5</li>
            <li>No Supabase, configure as variáveis de ambiente:
              <ul className="ml-6 mt-1 space-y-1">
                <li>• <code className="bg-yellow-100 px-1 py-0.5 rounded">METAAPI_TOKEN</code></li>
                <li>• <code className="bg-yellow-100 px-1 py-0.5 rounded">METAAPI_ACCOUNT_ID</code></li>
              </ul>
            </li>
            <li>Recarregue a página (F5)</li>
          </ol>
        </div>
      )}

      {isConfigured && !isWorking && result.test_request?.body?.error === 'NotFoundError' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
          <div className="text-sm font-medium text-red-900 mb-2">❌ Account ID Inválido</div>
          <div className="text-sm text-red-800">
            O Account ID <code className="bg-red-100 px-1 py-0.5 rounded font-mono">{result.account_id}</code> não existe no MetaApi.
            <br />
            <br />
            <strong>Verifique:</strong>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Se o Account ID está correto no dashboard MetaApi</li>
              <li>Se a conta está ativa e conectada</li>
              <li>Se você copiou o ID completo (sem espaços extras)</li>
            </ul>
          </div>
        </div>
      )}

      {authError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
          <div className="text-sm font-medium text-red-900 mb-2">❌ Erro de Autenticação</div>
          <div className="text-sm text-red-800">
            O token de autenticação fornecido é inválido ou ausente.
            <br />
            <br />
            <strong>Verifique:</strong>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Se o token está correto no Supabase</li>
              <li>Se o token não expirou</li>
              <li>Se você copiou o token completo (sem espaços extras)</li>
            </ul>
          </div>
        </div>
      )}

      <button
        onClick={runDiagnostics}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        🔄 Verificar Novamente
      </button>
    </div>
  );
};