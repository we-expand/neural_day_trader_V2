import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ResetAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  activeOrdersCount: number;
}

export function ResetAccountModal({ isOpen, onClose, onConfirm, activeOrdersCount }: ResetAccountModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-4"
          >
            {/* Premium Card */}
            <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-black border-2 border-red-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20">
              {/* Animated Top Bar */}
              <div className="h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-gradient-x" />
              
              {/* Content */}
              <div className="p-8 space-y-6">
                {/* Icon + Title */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Reinicialização Total</h2>
                    <p className="text-sm text-neutral-400 mt-1">Esta ação é permanente e irreversível</p>
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-3 bg-black/40 border border-white/5 rounded-xl p-5">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">O que será executado:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-neutral-300">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      <span>Fechamento de <strong className="text-white">{activeOrdersCount} {activeOrdersCount === 1 ? 'posição aberta' : 'posições abertas'}</strong></span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-neutral-300">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      <span>Reset de saldo para <strong className="text-white">$100.00</strong></span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-neutral-300">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      <span>Eliminação do histórico de operações</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-6 py-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-bold uppercase text-sm tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      onConfirm();
                      onClose();
                      // 🔇 REMOVIDO: toast.info('Conta DEMO reinicializada');
                    }}
                    className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black uppercase text-sm tracking-wider shadow-lg shadow-red-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Confirmar Reset
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}