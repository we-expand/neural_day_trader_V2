/**
 * 🚀 BREAKOUT ALERT PANEL
 * 
 * Painel visual no dashboard que exibe:
 * - Sinais de breakout ativos
 * - Níveis de preço críticos
 * - Countdown até possível rompimento
 * - Botões de ação rápida
 * 
 * @version 1.0.0
 * @date 31 Janeiro 2026
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Target,
  Shield,
  Zap,
  X,
  ChevronRight
} from 'lucide-react';
import { useBTCBreakoutMonitor } from '@/app/hooks/useBreakoutMonitor';
import { BreakoutSignal, BreakoutStage } from '@/app/services/BreakoutDetector';

interface BreakoutAlertPanelProps {
  className?: string;
}

export function BreakoutAlertPanel({ className = '' }: BreakoutAlertPanelProps) {
  const { signals, isMonitoring, lastCheck, forceCheck } = useBTCBreakoutMonitor(true);
  const [selectedSignal, setSelectedSignal] = useState<BreakoutSignal | null>(null);

  // Auto-selecionar primeiro sinal
  useEffect(() => {
    if (signals.length > 0 && !selectedSignal) {
      setSelectedSignal(signals[0]);
    }
  }, [signals, selectedSignal]);

  if (signals.length === 0) {
    return (
      <div className={`bg-[#1a1a1a] border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Breakout Monitor
          </h3>
          <div className="flex items-center gap-2">
            {isMonitoring && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-green-500"
              />
            )}
            <span className="text-xs text-gray-400">
              {lastCheck ? `Última checagem: ${lastCheck.toLocaleTimeString('pt-BR')}` : 'Aguardando...'}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="w-12 h-12 text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">Nenhum breakout detectado</p>
          <p className="text-sm text-gray-500">Monitorando BTC em busca de rompimentos...</p>
          <button
            onClick={forceCheck}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
          >
            Verificar Agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-white/10 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-red-600/20 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              🚀
            </motion.div>
            Breakout Detectado!
          </h3>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30"
            >
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-400 font-medium">LIVE</span>
            </motion.div>
            <span className="text-xs text-gray-400">
              {signals.length} {signals.length === 1 ? 'sinal' : 'sinais'}
            </span>
          </div>
        </div>
      </div>

      {/* Signals List (se múltiplos) */}
      {signals.length > 1 && (
        <div className="px-6 py-3 bg-black/20 border-b border-white/5 flex gap-2 overflow-x-auto">
          {signals.map((signal, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSignal(signal)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedSignal === signal
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {signal.symbol}
            </button>
          ))}
        </div>
      )}

      {/* Signal Detail */}
      <AnimatePresence mode="wait">
        {selectedSignal && (
          <motion.div
            key={selectedSignal.symbol}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-6"
          >
            {/* Stage Badge */}
            <div className="mb-4">
              <StageBadge stage={selectedSignal.stage} type={selectedSignal.type} />
            </div>

            {/* Price Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                <div className="text-xs text-gray-400 mb-1">Preço Atual</div>
                <div className="text-2xl font-bold text-white">
                  ${selectedSignal.currentPrice.toFixed(2)}
                </div>
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                <div className="text-xs text-gray-400 mb-1">Nível Chave</div>
                <div className="text-2xl font-bold text-yellow-500">
                  ${selectedSignal.keyLevel.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <MetricCard
                label="Confiança"
                value={`${selectedSignal.confidence}%`}
                color={selectedSignal.confidence > 70 ? 'green' : 'yellow'}
              />
              <MetricCard
                label="Volume"
                value={`${selectedSignal.volumeRatio.toFixed(1)}x`}
                color={selectedSignal.volumeRatio > 1.5 ? 'green' : 'gray'}
              />
              <MetricCard
                label="RSI"
                value={selectedSignal.rsi.toFixed(0)}
                color={selectedSignal.rsi > 70 || selectedSignal.rsi < 30 ? 'orange' : 'gray'}
              />
            </div>

            {/* Trade Setup */}
            <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-xl p-4 border border-purple-500/20 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-300">Setup de Trade</span>
              </div>
              
              <div className="space-y-2">
                <TradeLevel
                  label="Entry"
                  price={selectedSignal.entryPrice}
                  icon={<ChevronRight className="w-4 h-4" />}
                  color="blue"
                />
                <TradeLevel
                  label="Stop Loss"
                  price={selectedSignal.stopLoss}
                  icon={<Shield className="w-4 h-4" />}
                  color="red"
                />
                <TradeLevel
                  label="Take Profit 1"
                  price={selectedSignal.takeProfit1}
                  icon={<Target className="w-4 h-4" />}
                  color="green"
                />
                <TradeLevel
                  label="Take Profit 2"
                  price={selectedSignal.takeProfit2}
                  icon={<Target className="w-4 h-4" />}
                  color="green"
                />
              </div>

              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-gray-400">Risk:Reward</span>
                <span className="text-sm font-bold text-green-400">
                  1:{selectedSignal.riskRewardRatio.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Button */}
            <ActionButton signal={selectedSignal} />

            {/* Expiration Timer */}
            <ExpirationTimer expiresAt={selectedSignal.expiresAt} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StageBadge({ stage, type }: { stage: BreakoutStage; type: string }) {
  const config = {
    FORMING: { label: '🔄 Setup Formando', color: 'from-blue-600 to-cyan-600' },
    IMMINENT: { label: '⚡ IMINENTE!', color: 'from-yellow-600 to-orange-600' },
    CONFIRMED: { label: '✅ CONFIRMADO', color: 'from-green-600 to-emerald-600' },
    FAILED: { label: '❌ Falhou', color: 'from-red-600 to-rose-600' }
  };

  const { label, color } = config[stage];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${color} rounded-full text-white font-bold text-sm shadow-lg`}
    >
      {type === 'BULLISH' ? (
        <TrendingUp className="w-5 h-5" />
      ) : (
        <TrendingDown className="w-5 h-5" />
      )}
      <span>{label}</span>
      <span className="text-xs opacity-75">• {type}</span>
    </motion.div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = {
    green: 'text-green-400 border-green-500/30 bg-green-500/10',
    yellow: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    orange: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    gray: 'text-gray-400 border-white/10 bg-white/5'
  };

  return (
    <div className={`rounded-lg p-3 border ${colors[color as keyof typeof colors]}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function TradeLevel({ label, price, icon, color }: any) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
    green: 'text-green-400 bg-green-500/10'
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/20">
      <div className="flex items-center gap-2">
        <div className={`${colors[color as keyof typeof colors]} p-1 rounded`}>
          {icon}
        </div>
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <span className="text-sm font-mono font-semibold text-white">
        ${price.toFixed(2)}
      </span>
    </div>
  );
}

function ActionButton({ signal }: { signal: BreakoutSignal }) {
  const config = {
    PREPARE: { 
      label: 'Prepare-se para Entrar', 
      color: 'from-yellow-600 to-orange-600',
      icon: <AlertTriangle className="w-5 h-5" />
    },
    ENTER: { 
      label: 'ENTRAR AGORA!', 
      color: 'from-green-600 to-emerald-600',
      icon: <Zap className="w-5 h-5" />
    },
    WAIT: { 
      label: 'Aguardar Confirmação', 
      color: 'from-gray-600 to-gray-700',
      icon: <Clock className="w-5 h-5" />
    },
    AVOID: { 
      label: 'Evitar - Setup Falhou', 
      color: 'from-red-600 to-rose-600',
      icon: <X className="w-5 h-5" />
    }
  };

  const { label, color, icon } = config[signal.suggestedAction];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r ${color} text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all`}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function ExpirationTimer({ expiresAt }: { expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeLeft('Expirado');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="mt-4 text-center text-xs text-gray-500">
      <Clock className="w-3 h-3 inline mr-1" />
      Sinal expira em: <span className="font-mono text-gray-400">{timeLeft}</span>
    </div>
  );
}
