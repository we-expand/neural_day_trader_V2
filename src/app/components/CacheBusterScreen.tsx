/**
 * 🔥 CACHE BUSTER SCREEN
 * Tela que aparece quando há código antigo em cache do navegador
 */

import React from 'react';
import { RefreshCw, AlertTriangle, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export function CacheBusterScreen() {
  const handleHardRefresh = () => {
    // Limpar TUDO do cache
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
    
    // Limpar localStorage e sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Hard reload
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto p-8 text-center"
      >
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-600 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-900/50">
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-3">
            Código Antigo em Cache
          </h1>
          
          <p className="text-lg text-slate-400 mb-6">
            Detectamos que seu navegador está usando uma versão antiga da plataforma.
          </p>
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Solução Rápida
          </h2>
          
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white font-bold text-sm">1</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Hard Refresh</h3>
                <p className="text-sm text-slate-400">
                  <kbd className="px-2 py-1 bg-zinc-800 rounded text-xs text-slate-300 mr-2">Mac:</kbd>
                  <code className="text-cyan-400">Cmd + Shift + R</code>
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  <kbd className="px-2 py-1 bg-zinc-800 rounded text-xs text-slate-300 mr-2">Windows:</kbd>
                  <code className="text-cyan-400">Ctrl + Shift + R</code>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white font-bold text-sm">2</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Ou clique no botão abaixo</h3>
                <p className="text-sm text-slate-400">
                  Faremos a limpeza automática do cache para você
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleHardRefresh}
          className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all shadow-2xl shadow-blue-900/50 hover:shadow-blue-900/70 hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
        >
          <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
          Atualizar Agora
        </button>

        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <p className="text-sm text-yellow-400">
            <strong>Nota:</strong> Isso limpará o cache e recarregará a página com a versão mais recente.
          </p>
        </div>

        <div className="mt-6 text-xs text-slate-600">
          Neural Day Trader Platform v3.4.0
        </div>
      </motion.div>
    </div>
  );
}
