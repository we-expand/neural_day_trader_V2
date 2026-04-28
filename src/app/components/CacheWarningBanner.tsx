/**
 * 🔥 CACHE WARNING BANNER
 * Banner que aparece APENAS quando há erro real de cache detectado
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function CacheWarningBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // ✅ NÃO MOSTRAR MAIS AUTOMATICAMENTE
    // O banner só deve aparecer se houver erro REAL detectado
    
    // Verificar se já foi dispensado nesta sessão
    const wasDismissed = sessionStorage.getItem('cache-warning-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // ✅ NOVA LÓGICA: Detectar ERRO REAL de cache
    // Escutar por erros de módulo/componente
    const handleError = (event: ErrorEvent) => {
      const error = event.error || event.message;
      const errorStr = String(error);
      
      // Detectar erros relacionados a cache/módulos
      const isCacheError = 
        errorStr.includes('deve ser usado dentro de') ||
        errorStr.includes('must be used within') ||
        errorStr.includes('Provider') ||
        errorStr.includes('Context') ||
        errorStr.includes('undefined') && (
          errorStr.includes('useMarket') ||
          errorStr.includes('useTrading') ||
          errorStr.includes('useSimulator')
        );
      
      if (isCacheError && !dismissed) {
        console.warn('[CacheWarningBanner] ⚠️ Erro de cache detectado - mostrando banner');
        setShow(true);
      }
    };

    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [dismissed]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem('cache-warning-dismissed', 'true');
  };

  const handleRefresh = () => {
    // Limpar TUDO
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
    
    // Hard reload
    window.location.reload();
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[9998] px-4 pt-4"
        >
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-orange-900/90 to-red-900/90 backdrop-blur-xl border border-orange-500/30 rounded-xl shadow-2xl shadow-orange-900/50 p-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white mb-1">
                  ⚠️ Problemas ao Abrir Módulos? Pode ser Cache!
                </h3>
                <p className="text-sm text-orange-100 mb-3">
                  Se você vir erros ao clicar em <strong>AI Trader</strong> ou outros módulos, é porque seu navegador está usando código antigo em cache.
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-orange-50 text-black rounded-lg font-bold text-sm transition-colors shadow-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar Agora
                  </button>
                  
                  <div className="flex items-center gap-2 px-4 py-2 bg-black/30 rounded-lg text-xs text-orange-100">
                    <kbd className="px-2 py-1 bg-black/50 rounded text-[10px] text-white">
                      Cmd+Shift+R
                    </kbd>
                    <span className="opacity-70">ou</span>
                    <kbd className="px-2 py-1 bg-black/50 rounded text-[10px] text-white">
                      Ctrl+Shift+R
                    </kbd>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleDismiss}
                className="shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}