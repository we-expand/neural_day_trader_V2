import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Target, Clock, Zap, Trophy, Rocket, DollarSign, Activity } from 'lucide-react';
import { useTradingContext } from '@/app/contexts/TradingContext';
import { toast } from 'sonner';
import type { AIConfig } from '@/app/contexts/TradingContext';

interface AIRecoveryChallengeProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (targetTime: string) => void;
  initialBalance: number;
}

export function AIRecoveryChallenge({ isOpen, onClose, onStart, initialBalance }: AIRecoveryChallengeProps) {
  const { setConfig, portfolio, toggleAI, status } = useTradingContext();
  const [targetTime, setTargetTime] = useState('22:00');
  const [isStarting, setIsStarting] = useState(false);
  const [currentProfit, setCurrentProfit] = useState(0);
  const [profitPercent, setProfilePercent] = useState(0);

  // Calcular lucro em tempo real
  useEffect(() => {
    if (status === 'running') {
      const profit = portfolio.equity - initialBalance;
      const percent = (profit / initialBalance) * 100;
      setCurrentProfit(profit);
      setProfilePercent(percent);
    }
  }, [portfolio.equity, initialBalance, status]);

  const handleStartChallenge = async () => {
    setIsStarting(true);

    // 🔥 CONFIGURAÇÃO ULTRA-AGRESSIVA PARA MICRO-CONTA ($0.43)
    const recoveryConfig: Partial<AIConfig> = {
      // 📊 SCALPING ULTRA-RÁPIDO
      targetPoints: 'POUCOS', // 5-10 pontos
      timeframe: '1min', // Máxima frequência
      
      // 💰 GESTÃO DE RISCO AGRESSIVA
      riskPerTrade: 50, // 🔥 50% por trade (ultra-agressivo)
      leverage: 500, // Máxima alavancagem
      
      // 🎯 MÚLTIPLOS ATIVOS SIMULTANEAMENTE
      activeAssets: [
        'EURUSD',    // Forex majors (spread baixo)
        'GBPUSD',
        'USDJPY',
        'BTCUSD',    // Crypto (volatilidade)
        'ETHUSD',
        'XAUUSD',    // Ouro (movimentos rápidos)
        'US30',      // Índices
        'NAS100',
        'SPX500'
      ],
      
      // ⚡ EXECUÇÃO MÁXIMA
      maxConcurrentTrades: 10, // Múltiplas posições simultâneas
      hedgingEnabled: true, // Hedge para proteção
      closeOnProfit: false, // Deixar correr até TP
      
      // 🕐 HORÁRIO ESTENDIDO
      tradingHours: {
        start: '00:00',
        end: targetTime, // Até 22h Portugal
        timezone: 'Europe/Lisbon'
      },
      
      // 🎯 TAKE PROFIT E STOP LOSS
      takeProfitPoints: 8, // 8 pontos por trade
      stopLossPoints: 4, // 4 pontos SL (ratio 2:1)
      
      // 🔄 MARTINGALE CONTROLADO
      useMartingale: true,
      martingaleMultiplier: 1.5,
      maxMartingaleLevels: 3,
      
      // 📈 INDICADORES TÉCNICOS
      indicators: {
        useRSI: true,
        useMACD: true,
        useEMA: true,
        useBollinger: true,
        useVolume: true
      }
    };

    // Aplicar configuração
    setConfig(prev => ({
      ...prev,
      ...recoveryConfig
    }));

    // Aguardar aplicação
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 🚀 INICIAR IA
    if (status !== 'running') {
      toggleAI();
    }

    // Notificação de início
    toast.success('🚀 AI Recovery Challenge INICIADO!', {
      description: `Meta: Maximizar $${initialBalance.toFixed(2)} até ${targetTime}h Portugal`,
      duration: 8000
    });

    // Narração por voz
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Desafio de recuperação iniciado. Capital inicial: ${initialBalance.toFixed(2)} dólares. Meta: maximizar até às ${targetTime} horas. Modo scalping ultra agressivo ativado. Operando em 9 ativos simultaneamente. Boa sorte!`
      );
      utterance.lang = 'pt-PT';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }

    setIsStarting(false);
    onStart(targetTime); // Passar targetTime para o parent
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-purple-500/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Rocket className="w-8 h-8 text-white" />
              <h2 className="text-3xl font-bold text-white">AI Recovery Challenge</h2>
            </div>
            <p className="text-purple-100">Missão: Maximizar $0.43 com IA Preditiva Ultra-Agressiva</p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Inicial */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">💰 Capital Inicial</p>
                  <p className="text-3xl font-bold text-green-400">${initialBalance.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">🎯 Meta</p>
                  <p className="text-3xl font-bold text-purple-400">MÁXIMO</p>
                </div>
              </div>
            </div>

            {/* Horário Limite */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-white">Horário de Operação</h3>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white font-mono text-lg"
                />
                <span className="text-gray-400">Portugal (Lisboa)</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">⚠️ A IA irá operar continuamente até este horário</p>
            </div>

            {/* Estratégia */}
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white">Estratégia Ultra-Agressiva</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Activity className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Scalping 1min</p>
                    <p className="text-gray-400 text-xs">Máxima frequência</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">TP: 8 pts | SL: 4 pts</p>
                    <p className="text-gray-400 text-xs">Ratio 2:1</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">9 Ativos Simultâneos</p>
                    <p className="text-gray-400 text-xs">Forex + Crypto + Índices</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Risco: 50% por trade</p>
                    <p className="text-gray-400 text-xs">Ultra-agressivo</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-purple-500/30">
                <p className="text-xs text-gray-400">
                  📊 <span className="font-semibold text-white">Ativos:</span> EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, XAUUSD, US30, NAS100, SPX500
                </p>
              </div>
            </div>

            {/* Avisos */}
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
                <div className="space-y-2 text-sm">
                  <p className="text-red-300 font-semibold">⚠️ MODO ULTRA-AGRESSIVO</p>
                  <ul className="text-gray-400 space-y-1 text-xs">
                    <li>• Risco elevado: 50% do capital por trade</li>
                    <li>• Múltiplas posições simultâneas (até 10)</li>
                    <li>• Martingale ativado (3 níveis)</li>
                    <li>• Operação contínua até {targetTime}h</li>
                    <li>• Resultado pode variar significativamente</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Progresso (se já iniciado) */}
            {status === 'running' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/50 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-semibold text-white">Progresso em Tempo Real</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Lucro/Perda</p>
                    <p className={`text-2xl font-bold ${currentProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {currentProfit >= 0 ? '+' : ''}{currentProfit.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Variação %</p>
                    <p className={`text-2xl font-bold ${profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-gray-400 text-sm mb-1">Capital Atual</p>
                  <p className="text-3xl font-bold text-white">${portfolio.equity.toFixed(2)}</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all"
              disabled={isStarting}
            >
              Cancelar
            </button>
            <button
              onClick={handleStartChallenge}
              disabled={isStarting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isStarting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  <span>🚀 INICIAR DESAFIO</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
