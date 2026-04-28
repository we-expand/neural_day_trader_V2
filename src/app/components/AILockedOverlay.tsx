/**
 * 🔒 AI LOCKED OVERLAY
 * Overlay que bloqueia módulos da IA quando MT5 não está conectado
 */

import { Lock, AlertTriangle, Wifi } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  moduleName: string;
  message?: string;
  onConnectClick?: () => void;
}

export const AILockedOverlay = ({ 
  moduleName, 
  message = 'Este módulo requer dados em tempo real do MT5',
  onConnectClick 
}: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="max-w-lg mx-auto p-8 text-center">
        {/* Ícone de Bloqueio */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex p-6 bg-red-500/20 rounded-full border-4 border-red-500/30 mb-6"
        >
          <Lock className="w-16 h-16 text-red-400" />
        </motion.div>

        {/* Título */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-white mb-4 uppercase tracking-wide"
        >
          🔒 IA Bloqueada
        </motion.h2>

        {/* Nome do Módulo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400 uppercase">
              {moduleName}
            </span>
          </div>
        </motion.div>

        {/* Mensagem */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-neutral-300 mb-8 leading-relaxed"
        >
          {message}
        </motion.p>

        {/* Requisitos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8"
        >
          <h3 className="text-sm font-bold text-white uppercase mb-4">
            Para desbloquear você precisa:
          </h3>
          
          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Wifi className="w-3 h-3 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Conectar ao MT5</h4>
                <p className="text-xs text-neutral-400">
                  Conectar sua conta MetaTrader 5 via MetaAPI
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-emerald-400">✓</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Dados Reais</h4>
                <p className="text-xs text-neutral-400">
                  A plataforma só opera com preços 100% reais do mercado
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Botão de Ação */}
        {onConnectClick && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            onClick={onConnectClick}
            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold uppercase tracking-wide text-white shadow-lg shadow-cyan-500/30 transition-all"
          >
            🔓 Ir para Dashboard e Conectar
          </motion.button>
        )}

        {/* Nota */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs text-neutral-500 mt-6"
        >
          <strong className="text-red-400">SEM FALLBACK</strong> • APENAS DADOS REAIS • MÁXIMA PRECISÃO
        </motion.p>
      </div>
    </motion.div>
  );
};

export default AILockedOverlay;
