import React, { useMemo } from 'react';
import { AlertTriangle, Shield, Activity, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useTradingContext } from '../../contexts/TradingContext';

const MIN_SAMPLE_FOR_WIN_RATE = 10;

export function RiskThermometer() {
  const { portfolio, aiConfig, orderHistory, isSafeMode, safeModeReason } = useTradingContext();

  const currentDrawdown = Math.abs(portfolio.currentDrawdown || 0);
  const maxDrawdown = aiConfig.maxDrawdown || 15; // limite real que o Health Check Guardian aplica (aiConfig, não portfolio.maxDrawdownLimit, que nunca é sincronizado)

  // Mesmo cálculo de perda diária do Health Check Guardian (useApexLogic.ts) — replicado
  // aqui pra exibir o mesmo número real que efetivamente pausa a IA, não uma estimativa à parte.
  const { dailyLossPercent, dailyLossLimit } = useMemo(() => {
    const nowDate = new Date();
    const startOfUtcDay = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
    const closedToday = orderHistory.filter(t => t.closedAt && t.closedAt >= startOfUtcDay);
    const dailyPnL = closedToday.reduce((acc, t) => acc + (t.currentProfit || 0), 0);
    const dailyBase = portfolio.initialBalance || aiConfig.allocatedCapital || 100;
    return {
      dailyLossPercent: dailyPnL < 0 ? (Math.abs(dailyPnL) / dailyBase) * 100 : 0,
      dailyLossLimit: aiConfig.dailyLossLimit || 5,
    };
  }, [orderHistory, portfolio.initialBalance, aiConfig.allocatedCapital, aiConfig.dailyLossLimit]);

  const { currentWinRate, hasWinRateSample } = useMemo(() => {
    const closed = orderHistory.filter(t => t.closedAt);
    if (closed.length < MIN_SAMPLE_FOR_WIN_RATE) return { currentWinRate: null as number | null, hasWinRateSample: false };
    const wins = closed.filter(t => (t.currentProfit || 0) > 0).length;
    return { currentWinRate: (wins / closed.length) * 100, hasWinRateSample: true };
  }, [orderHistory]);

  // Score = pior dos 3 gatilhos reais que o Health Check Guardian aplica de verdade
  // (drawdown acumulado, perda diária, taxa de acerto) — nunca um número decorativo.
  const drawdownRatio = maxDrawdown > 0 ? (currentDrawdown / maxDrawdown) * 100 : 0;
  const dailyLossRatio = dailyLossLimit > 0 ? (dailyLossPercent / dailyLossLimit) * 100 : 0;
  const winRateRatio = hasWinRateSample && currentWinRate! < aiConfig.minWinRate
    ? ((aiConfig.minWinRate - currentWinRate!) / aiConfig.minWinRate) * 100 + 50 // já abaixo do mínimo = pelo menos "alto"
    : 0;

  const riskScore = isSafeMode ? 100 : Math.min(Math.max(drawdownRatio, dailyLossRatio, winRateRatio), 100);

  let riskLevel = 'Seguro';
  let riskColor = 'text-emerald-400';

  if (riskScore > 30) { riskLevel = 'Moderado'; riskColor = 'text-yellow-400'; }
  if (riskScore > 60) { riskLevel = 'Alto'; riskColor = 'text-orange-400'; }
  if (riskScore > 90) { riskLevel = 'Crítico'; riskColor = 'text-red-500'; }
  if (isSafeMode) { riskLevel = 'Safe Mode'; riskColor = 'text-red-500'; }

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-6 h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Termômetro de Risco
        </h2>
        <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase">Drawdown Atual</p>
            <p className={`text-lg font-mono font-bold ${riskColor}`}>
                {currentDrawdown.toFixed(2)}%
            </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="text-center">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-5xl font-bold tracking-tight mb-2 ${riskColor} flex items-center justify-center gap-2`}
            >
                {isSafeMode && <Lock className="w-8 h-8" />}
                {riskLevel}
            </motion.div>
            <p className="text-xs text-slate-500 tracking-wide">
              Exposição do Limite de Perda ({maxDrawdown}%)
            </p>
        </div>

        {/* Gauge Visual */}
        <div className="relative pt-2">
           {/* Scale Labels */}
           <div className="flex justify-between text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-2 px-1">
              <span>Seguro</span>
              <span>Crítico</span>
           </div>

           {/* Bar */}
           <div className="relative h-4 bg-white/5 rounded-full overflow-hidden border border-white/5">
              {/* Gradient Background */}
              <div className="absolute inset-0 opacity-80 bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-600" />
           </div>

           {/* Needle */}
           <motion.div
              className="absolute top-6 w-0.5 h-6 bg-white shadow-[0_0_10px_rgba(255,255,255,1)] z-10"
              initial={{ left: '0%' }}
              animate={{ left: `${riskScore}%` }}
              transition={{ type: "spring", stiffness: 50, damping: 10 }}
              style={{ transform: 'translateX(-50%)', top: '24px' }} // Align with bar
           >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
           </motion.div>
        </div>

        {/* Breakdown real dos 3 gatilhos que o Health Check Guardian avalia */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-[9px] text-slate-500 uppercase tracking-wide">Drawdown</p>
            <p className={`text-xs font-mono font-bold ${drawdownRatio > 90 ? 'text-red-400' : drawdownRatio > 60 ? 'text-orange-400' : 'text-slate-300'}`}>
              {currentDrawdown.toFixed(1)}% / {maxDrawdown}%
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-[9px] text-slate-500 uppercase tracking-wide">Perda Diária</p>
            <p className={`text-xs font-mono font-bold ${dailyLossRatio > 90 ? 'text-red-400' : dailyLossRatio > 60 ? 'text-orange-400' : 'text-slate-300'}`}>
              {dailyLossPercent.toFixed(1)}% / {dailyLossLimit}%
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-[9px] text-slate-500 uppercase tracking-wide">Taxa de Acerto</p>
            <p className={`text-xs font-mono font-bold ${hasWinRateSample && currentWinRate! < aiConfig.minWinRate ? 'text-red-400' : 'text-slate-300'}`}>
              {hasWinRateSample ? `${currentWinRate!.toFixed(0)}%` : '—'} / {aiConfig.minWinRate}%
            </p>
          </div>
        </div>

        {/* Info Box */}
        {isSafeMode && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3 mt-2">
            <Lock className="w-5 h-5 text-red-400 shrink-0" />
            <div>
                <h4 className="text-xs font-bold text-red-400 uppercase mb-1">Safe Mode Ativado — IA Pausada</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                    {safeModeReason || 'Limite de risco excedido.'}
                </p>
            </div>
            </div>
        )}

        {!isSafeMode && riskScore > 50 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-start gap-3 mt-2">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
                <h4 className="text-xs font-bold text-orange-400 uppercase mb-1">Atenção Necessária</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                    Aproximando de um dos limites configurados (drawdown, perda diária ou taxa de acerto). Se ultrapassar, o Safe Mode pausa a IA automaticamente.
                </p>
            </div>
            </div>
        )}

        {!isSafeMode && riskScore <= 50 && (
             <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3 mt-2">
                <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                    <h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Operação Saudável</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Parâmetros dentro da margem de segurança. A IA tem autorização total.
                    </p>
                </div>
             </div>
        )}
      </div>
    </div>
  );
}
