/**
 * 🔑 MODAL DE CONFIGURAÇÃO DE TOKEN METAAPI
 * Permite configurar o token diretamente pela interface web
 */

import { useState } from 'react';
import { X, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface TokenConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTokenPrefix?: string;
}

export function TokenConfigModal({ isOpen, onClose, currentTokenPrefix }: TokenConfigModalProps) {
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    setError('');
    setSuccess(false);

    // Validar token
    if (!token || token.length < 100) {
      setError('Token inválido. Deve ter mais de 100 caracteres.');
      return;
    }

    if (!token.startsWith('eyJ')) {
      setError('Token deve começar com "eyJ" (formato JWT).');
      return;
    }

    // Validar Account ID
    if (!accountId || accountId.length < 10) {
      setError('Account ID inválido. Deve ter pelo menos 10 caracteres.');
      return;
    }

    setSaving(true);

    try {
      // Salvar no backend (KV Store)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/config/metaapi`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token,
            accountId
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        setToken('');
        setAccountId('');
        
        // Fechar modal após 2 segundos
        setTimeout(() => {
          onClose();
          window.location.reload(); // Recarregar para aplicar mudanças
        }, 2000);
      } else {
        setError(result.error || 'Erro ao salvar configuração');
      }
    } catch (err: any) {
      console.error('[TokenConfig] Erro ao salvar:', err);
      setError(err.message || 'Erro ao conectar com servidor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border-2 border-yellow-600 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-yellow-600/30 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
              🔑
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configurar MetaAPI</h2>
              <p className="text-sm text-gray-400">Configure suas credenciais de acesso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Status Atual */}
          {currentTokenPrefix && (
            <div className="bg-black/30 rounded-lg p-4 border border-yellow-600/20">
              <p className="text-sm text-gray-400 mb-1">Token atual:</p>
              <p className="font-mono text-xs text-yellow-400">{currentTokenPrefix}</p>
            </div>
          )}

          {/* Instruções */}
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
              <span>📋</span>
              Como obter suas credenciais:
            </h3>
            <ol className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">1.</span>
                <span>
                  Acesse{' '}
                  <a
                    href="https://app.metaapi.cloud/token"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    app.metaapi.cloud/token
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">2.</span>
                <span>Copie o <strong>Token JWT</strong> (começa com eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9...)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">3.</span>
                <span>
                  Acesse{' '}
                  <a
                    href="https://app.metaapi.cloud/accounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    app.metaapi.cloud/accounts
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">4.</span>
                <span>Copie o <strong>Account ID</strong> da sua conta MT5</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">5.</span>
                <span>Cole ambos nos campos abaixo</span>
              </li>
            </ol>
          </div>

          {/* Campo Token */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              MetaAPI Token (JWT)
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder="eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-sm resize-none focus:outline-none focus:border-yellow-600 transition-colors"
              rows={4}
            />
            {token && !token.startsWith('eyJ') && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Token deve começar com "eyJ"
              </p>
            )}
          </div>

          {/* Campo Account ID */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              MetaAPI Account ID
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value.trim())}
              placeholder="abc123def456..."
              className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-yellow-600 transition-colors"
            />
            {accountId && accountId.length < 10 && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Account ID parece muito curto
              </p>
            )}
          </div>

          {/* Mensagens de Erro/Sucesso */}
          {error && (
            <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Erro ao salvar</p>
                <p className="text-xs text-red-200 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-600 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-300">Configuração salva!</p>
                <p className="text-xs text-green-200 mt-1">Recarregando aplicação...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-yellow-600/30 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !token || !accountId}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Salvar Configuração
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
