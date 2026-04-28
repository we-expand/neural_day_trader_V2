/**
 * 🚨 ALERTA DE TOKEN METAAPI INVÁLIDO
 * Exibe instruções claras quando o token está como "aquela" ou inválido
 */

import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, X, Settings } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TokenConfigModal } from '@/app/components/TokenConfigModal';

interface TokenStatus {
  token_valid: boolean;
  token_configured: boolean;
  token_prefix: string;
  error?: {
    type: string;
    message: string;
    current_value: string;
    instructions: string[];
  };
}

export function MetaApiTokenAlert() {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/public/mt5-status`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('[TokenAlert] Erro ao verificar status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Não mostrar nada se:
  // - Ainda está carregando
  // - Token é válido
  // - Usuário já fechou o alerta
  if (loading || !status || status.token_valid || dismissed) {
    return (
      <>
        {/* Modal pode estar aberto mesmo se alerta foi fechado */}
        {showConfigModal && (
          <TokenConfigModal
            isOpen={showConfigModal}
            onClose={() => setShowConfigModal(false)}
            currentTokenPrefix={status?.token_prefix}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl w-full mx-4">
        <div className="bg-yellow-900/95 border-2 border-yellow-600 rounded-lg shadow-2xl p-6 text-white backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
            
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-200 mb-2">
                🚨 Token MetaAPI Inválido
              </h3>
              
              <p className="text-yellow-100 mb-4">
                {status.error?.message}: <span className="font-mono text-yellow-300">{status.error?.current_value}</span>
              </p>
              
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="inline-flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-2.5 rounded-md text-sm font-medium transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Configurar Agora
                </button>
                
                <a
                  href="https://app.metaapi.cloud/token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Obter Token
                </a>
                
                <button
                  onClick={() => setDismissed(true)}
                  className="text-yellow-400 hover:text-yellow-200 text-sm underline transition-colors"
                >
                  Fechar aviso
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setDismissed(true)}
              className="text-yellow-400 hover:text-yellow-200 transition-colors flex-shrink-0"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Configuração */}
      <TokenConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        currentTokenPrefix={status.token_prefix}
      />
    </>
  );
}