import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Target, Clock, Zap, Activity, DollarSign } from 'lucide-react';
import { useTradingContext } from '@/app/contexts/TradingContext';

interface RecoveryProgressHUDProps {
  initialBalance: number;
  targetTime: string;
  startTime: Date;
  onStop?: () => void;
}

export function RecoveryProgressHUD({ initialBalance, targetTime, startTime, onStop }: RecoveryProgressHUDProps) {
  const { portfolio, activeOrders, status, recentLogs } = useTradingContext();
  const [timeRemaining, setTimeRemaining] = useState('');
  const [profit, setProfit] = useState(0);
  const [profitPercent, setProfitPercent] = useState(0);
  const [totalTrades, setTotalTrades] = useState(0);
  const [winRate, setWinRate] = useState(0);

  // Calcular tempo restante
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const [hours, minutes] = targetTime.split(':').map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);

      if (target < now) {
        target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - now.getTime();
      const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeRemaining(`${hoursLeft}h ${minutesLeft}m`);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  // Calcular métricas
  useEffect(() => {
    const currentProfit = portfolio.equity - initialBalance;
    const currentPercent = (currentProfit / initialBalance) * 100;
    
    setProfit(currentProfit);
    setProfitPercent(currentPercent);

    // Contar trades dos logs (simplificado)
    const tradeCount = recentLogs.filter(log => 
      log.message.includes('✅ ORDEM EXECUTADA') || 
      log.message.includes('📈 COMPRA') ||
      log.message.includes('📉 VENDA')
    ).length;
    setTotalTrades(tradeCount);

    // Win rate (simplificado - baseado em trades positivos)
    const wins = recentLogs.filter(log => 
      log.message.includes('LUCRO') || 
      log.message.includes('PROFIT')
    ).length;
    const rate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
    setWinRate(rate);
  }, [portfolio, recentLogs, initialBalance]);

  const isPositive = profit >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-4 right-4 z-40 w-80"
    >
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-purple-500/50 rounded-xl shadow-2xl shadow-purple-500/20 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-300 animate-pulse" />
              <span className="font-bold text-white text-sm">Recovery Challenge</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-white font-mono">ATIVO</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Lucro Principal */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Lucro/Perda</span>
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{profit.toFixed(2)}
              </span>
              <span className="text-sm text-gray-400">USD</span>
            </div>
            <div className={`text-xs font-semibold mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{profitPercent.toFixed(2)}%
            </div>
          </div>

          {/* Grid de Métricas */}
          <div className="grid grid-cols-2 gap-2">
            {/* Capital Atual */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-gray-400 uppercase">Capital</span>
              </div>
              <p className="text-sm font-bold text-white">${portfolio.equity.toFixed(2)}</p>
            </div>

            {/* Tempo Restante */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[10px] text-gray-400 uppercase">Tempo</span>
              </div>
              <p className="text-sm font-bold text-white">{timeRemaining}</p>
            </div>

            {/* Total Trades */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] text-gray-400 uppercase">Trades</span>
              </div>
              <p className="text-sm font-bold text-white">{totalTrades}</p>
            </div>

            {/* Win Rate */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[10px] text-gray-400 uppercase">Win Rate</span>
              </div>
              <p className="text-sm font-bold text-white">{winRate.toFixed(0)}%</p>
            </div>
          </div>

          {/* Posições Abertas */}
          {activeOrders.length > 0 && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-300 font-medium">Posições Abertas</span>
                <span className="text-lg font-bold text-blue-400">{activeOrders.length}</span>
              </div>
            </div>
          )}

          {/* Status da IA */}
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-xs text-purple-300 font-medium">
                {status === 'running' ? 'Analisando mercados...' : 'Aguardando...'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full ${isPositive ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min(Math.abs(profitPercent), 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-[10px] text-gray-500">
            <Target className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <p>IA operando em modo ultra-agressivo até {targetTime}h Portugal</p>
          </div>

          {/* Botão Parar Challenge */}
          {onStop && (
            <button
              onClick={onStop}
              className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all mt-2"
            >
              ⏹️ Parar Challenge
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
