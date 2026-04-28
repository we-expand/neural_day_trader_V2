import React from 'react';
import { motion } from 'motion/react';
import { Eye, Users, Zap, Check } from 'lucide-react';

export type OperationMode = 'SOLO' | 'HYBRID' | 'AUTONOMOUS';

interface OperationModeSelectorProps {
  currentMode: OperationMode;
  onModeChange: (mode: OperationMode) => void;
  disabled?: boolean;
}

interface ModeConfig {
  id: OperationMode;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  features: string[];
}

const MODES: ModeConfig[] = [
  {
    id: 'SOLO',
    icon: Eye,
    title: 'SOLO',
    subtitle: 'Modo Vigia',
    description: 'Você opera manualmente. A IA monitora risco e intervém apenas em desvios críticos ou anomalias invisíveis.',
    color: 'text-blue-400',
    bgGradient: 'from-blue-950/20 to-black',
    borderColor: 'border-blue-500/30',
    features: [
      'Controle total das operações',
      'Monitoramento de risco em tempo real',
      'Alertas de desvio do plano',
      'Detecção de anomalias de mercado'
    ]
  },
  {
    id: 'HYBRID',
    icon: Users,
    title: 'HÍBRIDO',
    subtitle: 'Modo Co-Piloto',
    description: 'A IA seleciona os 3 melhores ativos e sugere entradas. Aguarda sua confirmação vocal ou clique para executar.',
    color: 'text-purple-400',
    bgGradient: 'from-purple-950/20 to-black',
    borderColor: 'border-purple-500/30',
    features: [
      'IA seleciona melhores oportunidades',
      'Sugestões de entrada com análise completa',
      'Confirmação necessária para executar',
      'Equilíbrio entre humano e algoritmo'
    ]
  },
  {
    id: 'AUTONOMOUS',
    icon: Zap,
    title: 'AUTÔNOMO',
    subtitle: 'Modo Comandante',
    description: 'Execução 100% autônoma pelo algoritmo. A IA reporta status, lucros e ajustes de proteção proativamente via voz.',
    color: 'text-emerald-400',
    bgGradient: 'from-emerald-950/20 to-black',
    borderColor: 'border-emerald-500/30',
    features: [
      'Execução totalmente automatizada',
      'Reportes de status por voz',
      'Otimização contínua de estratégia',
      'Máxima eficiência algorítmica'
    ]
  }
];

export const OperationModeSelector: React.FC<OperationModeSelectorProps> = ({
  currentMode,
  onModeChange,
  disabled = false
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-black text-white mb-1 uppercase tracking-wide">
          Modo de Operação
        </h3>
        <p className="text-xs text-slate-400">
          Selecione como você deseja interagir com o Nexus Quantum Advisor
        </p>
      </div>

      {/* Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              onClick={() => !disabled && onModeChange(mode.id)}
              disabled={disabled}
              whileHover={{ scale: disabled ? 1 : 1.02 }}
              whileTap={{ scale: disabled ? 1 : 0.98 }}
              className={`relative bg-gradient-to-br ${mode.bgGradient} border-2 rounded-xl p-4 text-left transition-all ${
                isActive
                  ? `${mode.borderColor} shadow-[0_0_30px_rgba(168,85,247,0.2)]`
                  : 'border-white/10 hover:border-white/20'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg"
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              )}

              {/* Icon */}
              <div className={`w-12 h-12 rounded-lg bg-black/40 border ${mode.borderColor} flex items-center justify-center mb-3`}>
                <Icon className={`w-6 h-6 ${mode.color}`} />
              </div>

              {/* Title */}
              <div className="mb-2">
                <h4 className={`text-sm font-black uppercase tracking-wide ${mode.color}`}>
                  {mode.title}
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">
                  {mode.subtitle}
                </p>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                {mode.description}
              </p>

              {/* Features */}
              <div className="space-y-1.5">
                {mode.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className={`w-1 h-1 rounded-full ${mode.color.replace('text-', 'bg-')} mt-1.5 flex-shrink-0`} />
                    <span className="text-[10px] text-slate-400 leading-relaxed">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* Selection Pulse Effect */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-purple-500/50"
                  animate={{
                    opacity: [0.5, 0, 0.5],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Current Mode Info */}
      <div className="bg-black/40 border border-white/10 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-bold text-white">Modo Ativo:</span>
          </div>
          <span className="text-xs font-black text-purple-400 uppercase tracking-wider">
            {MODES.find(m => m.id === currentMode)?.title}
          </span>
        </div>
      </div>
    </div>
  );
};
