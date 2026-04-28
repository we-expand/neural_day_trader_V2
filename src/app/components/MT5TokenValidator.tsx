import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useAuth } from '@/app/contexts/AuthContext';
import { useTradingContext } from '@/app/contexts/TradingContext';

interface TokenValidation {
  isValid: boolean;
  length: number;
  hasCorrectPrefix: boolean;
  message: string;
  color: string;
  source: 'backend' | 'config' | 'none';
}

export function MT5TokenValidator() {
  const { user } = useAuth();
  const { config } = useTradingContext();
  const [isChecking, setIsChecking] = useState(false);
  const [validation, setValidation] = useState<TokenValidation | null>(null);

  const checkToken = async () => {
    setIsChecking(true);
    
    try {
      let token = '';
      let tokenSource: 'backend' | 'config' | 'none' = 'none';

      // 🎯 ESTRATÉGIA 1: Tentar buscar do backend (se usuário logado)
      if (user?.id) {
        try {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/mt5-token/load?userId=${user.id}`, {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          });
          const data = await response.json();
          if (data.token) {
            token = data.token;
            tokenSource = 'backend';
            console.log('✅ Token carregado do backend:', token.substring(0, 30) + '...');
          }
        } catch (err) {
          console.warn('⚠️ Falha ao buscar token do backend:', err);
        }
      }

      // 🎯 ESTRATÉGIA 2: Tentar buscar do config (Trading Context)
      if (!token && config.metaApiToken) {
        token = config.metaApiToken;
        tokenSource = 'config';
        console.log('✅ Token carregado do config:', token.substring(0, 30) + '...');
      }

      // 🎯 ESTRATÉGIA 3: Tentar buscar do localStorage
      if (!token) {
        const STORAGE_KEY = 'apex_logic_state_v14_CLEAN';
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.config?.metaApiToken) {
            token = parsed.config.metaApiToken;
            tokenSource = 'config';
            console.log('✅ Token carregado do localStorage:', token.substring(0, 30) + '...');
          }
        }
      }
      
      // Validar token
      const tokenLength = token.length;
      const hasCorrectPrefix = token.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9');
      const isValid = tokenLength >= 500 && hasCorrectPrefix;

      setValidation({
        isValid,
        length: tokenLength,
        hasCorrectPrefix,
        source: tokenSource,
        message: isValid 
          ? `✅ Token MetaAPI configurado corretamente! (${tokenSource === 'backend' ? 'Backend' : 'Local'})` 
          : tokenLength === 0 
            ? '❌ Token MetaAPI não encontrado. Configure no painel MT5.'
            : tokenLength < 100
              ? `❌ Token muito curto (${tokenLength} chars) - Isso parece um Login MT5, não o Token MetaAPI!`
              : tokenLength < 500
                ? `❌ Token incompleto (${tokenLength} chars, esperado ~500+)`
                : '❌ Token com formato inválido',
        color: isValid ? 'green' : 'red'
      });
    } catch (error) {
      setValidation({
        isValid: false,
        length: 0,
        hasCorrectPrefix: false,
        source: 'none',
        message: '❌ Erro ao verificar token',
        color: 'red'
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-[#1e222d] border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">🔍 Validador de Token MetaAPI</h3>
        <button
          onClick={checkToken}
          disabled={isChecking}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs font-semibold rounded transition-colors flex items-center gap-2"
        >
          {isChecking ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Verificando...
            </>
          ) : (
            'Verificar Token'
          )}
        </button>
      </div>

      {validation && (
        <div className={`p-3 rounded-lg border ${
          validation.color === 'green' 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-start gap-3">
            {validation.isValid ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                validation.isValid ? 'text-green-400' : 'text-red-400'
              }`}>
                {validation.message}
              </p>
              <div className="mt-2 space-y-1 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  {validation.length > 0 ? (
                    validation.length >= 500 ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400" />
                    )
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span>Tamanho: {validation.length} caracteres {validation.length >= 500 ? '(OK)' : validation.length < 100 ? '(Login MT5 ≠ Token)' : '(esperado ~500+)'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {validation.hasCorrectPrefix ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span>Formato JWT: {validation.hasCorrectPrefix ? 'Válido ✓' : 'Inválido ✗'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-blue-400" />
                  <span>Fonte: {validation.source === 'backend' ? '☁️ Backend (Persistente)' : validation.source === 'config' ? '💾 Config Local' : '❌ Não configurado'}</span>
                </div>
              </div>

              {!validation.isValid && (
                <div className="mt-3 p-2 bg-black/30 rounded border border-gray-700">
                  <p className="text-[10px] text-gray-400 font-semibold mb-2">📋 Como corrigir:</p>
                  <ol className="text-[10px] text-gray-400 space-y-1 list-decimal list-inside">
                    <li>
                      Acesse{' '}
                      <a 
                        href="https://app.metaapi.cloud/token" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        app.metaapi.cloud/token
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </li>
                    <li>Copie o token JWT COMPLETO (~500+ caracteres, começa com "eyJhbGciOi...")</li>
                    <li>Abra o painel MT5 (botão ⚙️ no AI Trader)</li>
                    <li>Cole o token no campo "Chave Mestra MetaAPI"</li>
                    <li>Clique em "CONECTAR & HABILITAR"</li>
                  </ol>
                  
                  {validation.length > 0 && validation.length < 100 && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                      <p className="text-[10px] text-yellow-400 font-bold">⚠️ ATENÇÃO:</p>
                      <p className="text-[10px] text-yellow-300">
                        Você colocou o <strong>LOGIN da conta MT5</strong> ({validation.length} dígitos) ao invés do <strong>TOKEN METAAPI</strong> (500+ caracteres). 
                        São campos diferentes!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!validation && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle className="w-4 h-4" />
          <span>Clique em "Verificar Token" para validar a configuração MetaAPI</span>
        </div>
      )}
    </div>
  );
}