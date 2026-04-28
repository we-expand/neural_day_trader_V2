import React from 'react';
import { AlertTriangle, Shield, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { useTradingContext } from '../../contexts/TradingContext';

export function RiskThermometer() {
  const { portfolio } = useTradingContext();

  const currentDrawdown = Math.abs(portfolio.currentDrawdown || 0);
  const maxDrawdown = portfolio.maxDrawdownLimit || 15; // Limit default
  
  // Calculate Risk Score (0-100)
  // 0% DD = 0 Score
  // Max DD = 100 Score
  const riskScore = Math.min((currentDrawdown / maxDrawdown) * 100, 100);

  let riskLevel = 'Seguro';
  let riskColor = 'text-emerald-400';
  
  if (riskScore > 30) { riskLevel = 'Moderado'; riskColor = 'text-yellow-400'; }
  if (riskScore > 60) { riskLevel = 'Alto'; riskColor = 'text-orange-400'; }
  if (riskScore > 90) { riskLevel = 'Crítico'; riskColor = 'text-red-500'; }

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-emerald-400';
    if (score < 70) return 'text-orange-400';
    return 'text-red-400';
  };

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
                className={`text-5xl font-bold tracking-tight mb-2 ${riskColor}`}
            >
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

        {/* Info Box */}
        {riskScore > 50 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-start gap-3 mt-4">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
                <h4 className="text-xs font-bold text-orange-400 uppercase mb-1">Atenção Necessária</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                    Volatilidade alta ou Drawdown elevado. O sistema pode reduzir lotes automaticamente.
                </p>
            </div>
            </div>
        )}
        
        {riskScore <= 50 && (
             <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3 mt-4">
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
