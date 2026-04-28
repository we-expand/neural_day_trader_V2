import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, FileText, CheckCircle2 } from 'lucide-react';

export function PrivacyConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('privacy_accepted');
    if (!accepted) {
      // Delay pequeno para animação suave na entrada
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('privacy_accepted', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.5, ease: "circOut" }}
          className="fixed bottom-6 right-6 z-50 max-w-md w-full md:w-auto"
        >
          <div className="bg-[#0f1115]/90 backdrop-blur-xl border border-white/10 p-6 rounded-lg shadow-2xl shadow-black/50 relative overflow-hidden">
            {/* Efeito de brilho sutil */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            
            <div className="flex gap-4">
              <div className="mt-1">
                <div className="p-2.5 bg-[#0a0a0a] rounded-xl border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Shield className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  PROTOCOLO DE DADOS & PRIVACIDADE
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Para operar em conformidade com regulações institucionais e proteger sua propriedade intelectual de trading, precisamos do seu consentimento para processamento de dados criptografados.
                </p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Criptografia End-to-End (AES-256)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Execução Local (Non-Custodial)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Logs de Auditoria Neural</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={handleAccept}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-2.5 px-4 rounded transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-wide"
                  >
                    ACEITAR PROTOCOLOS
                  </button>
                  <button className="px-4 py-2.5 border border-white/10 hover:bg-white/5 rounded text-[11px] font-medium text-slate-400 transition-colors">
                    Ler Termos
                  </button>
                </div>
              </div>
            </div>
            
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
