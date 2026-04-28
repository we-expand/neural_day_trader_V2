import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Target, Clock, Activity, TrendingUp, AlertTriangle } from 'lucide-react';

interface DisciplinePillars {
  timing: number; // 0-100: Adherence to AI signal timing
  riskManagement: number; // 0-100: Compliance with lot size rules
  stopTargetFidelity: number; // 0-100: Respect for SL/TP levels
  emotionalStability: number; // 0-100: Biometric voice analysis
}

interface TradeRecord {
  id: string;
  timestamp: number;
  aiSignalTime: number;
  entryTime: number;
  plannedLotSize: number;
  actualLotSize: number;
  plannedStop: number;
  actualStop: number;
  plannedTarget: number;
  actualTarget: number;
  emotionalState: 'calm' | 'confident' | 'anxious' | 'stressed' | 'tilted';
  stressLevel: number;
  profit: number;
}

interface DisciplineScoreProps {
  trades: TradeRecord[];
  currentStressLevel: number;
  currentEmotionalState: string;
}

export const DisciplineScore: React.FC<DisciplineScoreProps> = ({
  trades,
  currentStressLevel,
  currentEmotionalState
}) => {
  const [overallScore, setOverallScore] = useState(75);
  const [pillars, setPillars] = useState<DisciplinePillars>({
    timing: 80,
    riskManagement: 85,
    stopTargetFidelity: 70,
    emotionalStability: 65
  });

  // Calculate discipline metrics from trades
  useEffect(() => {
    if (trades.length === 0) {
      setOverallScore(75); // Default neutral score
      return;
    }

    let timingScore = 0;
    let riskScore = 0;
    let stopTargetScore = 0;
    let emotionalScore = 0;

    trades.forEach(trade => {
      // 1. TIMING: Penalize hesitation (delay > 5 seconds = bad)
      const delaySeconds = (trade.entryTime - trade.aiSignalTime) / 1000;
      if (delaySeconds <= 5) {
        timingScore += 100;
      } else if (delaySeconds <= 15) {
        timingScore += 70;
      } else {
        timingScore += 30; // Late entry ("chasing")
      }

      // 2. RISK MANAGEMENT: Lot size compliance
      const lotRatio = trade.actualLotSize / trade.plannedLotSize;
      if (lotRatio >= 0.9 && lotRatio <= 1.1) {
        riskScore += 100; // Perfect
      } else if (lotRatio > 1.1) {
        riskScore += Math.max(0, 100 - (lotRatio - 1) * 500); // Penalty for overleveraging
      } else {
        riskScore += 80; // Minor penalty for under-leveraging
      }

      // 3. STOP/TARGET FIDELITY: Did they move SL or close early?
      const stopMoved = Math.abs(trade.actualStop - trade.plannedStop) > 0.0001;
      const targetMoved = Math.abs(trade.actualTarget - trade.plannedTarget) > 0.0001;
      
      if (!stopMoved && !targetMoved) {
        stopTargetScore += 100; // Perfect discipline
      } else if (stopMoved && !targetMoved) {
        stopTargetScore += 40; // Moving SL is dangerous
      } else {
        stopTargetScore += 60; // Closing early due to fear
      }

      // 4. EMOTIONAL STABILITY: Biometric voice analysis
      const emotionPenalty = {
        'calm': 0,
        'confident': 5,
        'anxious': 20,
        'stressed': 40,
        'tilted': 70
      }[trade.emotionalState] || 0;

      emotionalScore += Math.max(0, 100 - emotionPenalty - (trade.stressLevel * 0.5));
    });

    // Calculate averages
    const count = trades.length;
    const newPillars: DisciplinePillars = {
      timing: Math.round(timingScore / count),
      riskManagement: Math.round(riskScore / count),
      stopTargetFidelity: Math.round(stopTargetScore / count),
      emotionalStability: Math.round(emotionalScore / count)
    };

    setPillars(newPillars);

    // Overall SDQ Score (weighted average)
    const weightedScore = (
      newPillars.timing * 0.20 +
      newPillars.riskManagement * 0.35 +
      newPillars.stopTargetFidelity * 0.30 +
      newPillars.emotionalStability * 0.15
    );

    setOverallScore(Math.round(weightedScore));
  }, [trades]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500' };
    if (score >= 60) return { text: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500' };
    if (score >= 40) return { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500' };
    return { text: 'text-rose-400', bg: 'bg-rose-500', border: 'border-rose-500' };
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', label: 'Excepcional' };
    if (score >= 80) return { grade: 'A', label: 'Excelente' };
    if (score >= 70) return { grade: 'B', label: 'Muito Bom' };
    if (score >= 60) return { grade: 'C', label: 'Bom' };
    if (score >= 50) return { grade: 'D', label: 'Aceitável' };
    return { grade: 'F', label: 'Crítico' };
  };

  const scoreColor = getScoreColor(overallScore);
  const scoreGrade = getScoreGrade(overallScore);

  const pillarData = [
    {
      id: 'timing',
      icon: Clock,
      title: 'Timing de Entrada',
      description: 'Adesão ao gatilho da IA',
      value: pillars.timing,
      color: getScoreColor(pillars.timing)
    },
    {
      id: 'risk',
      icon: Shield,
      title: 'Gestão de Risco',
      description: 'Compliance com lote planejado',
      value: pillars.riskManagement,
      color: getScoreColor(pillars.riskManagement)
    },
    {
      id: 'stopTarget',
      icon: Target,
      title: 'Fidelidade Stop/Target',
      description: 'Respeito aos níveis definidos',
      value: pillars.stopTargetFidelity,
      color: getScoreColor(pillars.stopTargetFidelity)
    },
    {
      id: 'emotional',
      icon: Activity,
      title: 'Estabilidade Emocional',
      description: 'Análise biométrica vocal',
      value: pillars.emotionalStability,
      color: getScoreColor(pillars.emotionalStability)
    }
  ];

  return (
    <div className="bg-gradient-to-br from-purple-950/20 to-black border border-purple-500/30 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-black text-white uppercase tracking-wide">
            Score de Disciplina Quântica
          </h3>
          <p className="text-[10px] text-slate-400">
            O processo acima do resultado • {trades.length} operações analisadas
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-black ${scoreColor.text} leading-none`}>
            {overallScore}
          </div>
          <div className="flex items-center gap-1 justify-end mt-1">
            <span className={`text-xs font-bold ${scoreColor.text}`}>
              {scoreGrade.grade}
            </span>
            <span className="text-[10px] text-slate-400">
              {scoreGrade.label}
            </span>
          </div>
        </div>
      </div>

      {/* Overall Score Visualization */}
      <div className="mb-4">
        <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden relative border border-white/10">
          <motion.div
            className={`h-full ${scoreColor.bg} relative`}
            initial={{ width: 0 }}
            animate={{ width: `${overallScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </motion.div>
          
          {/* Score markers */}
          <div className="absolute inset-0 flex justify-between px-1">
            {[0, 25, 50, 75, 100].map((mark) => (
              <div key={mark} className="w-px h-full bg-white/10" />
            ))}
          </div>
        </div>
        <div className="flex justify-between text-[8px] text-slate-500 mt-1">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* The 4 Pillars */}
      <div className="space-y-2 mb-4">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Os 4 Pilares da Disciplina
        </div>
        {pillarData.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div
              key={pillar.id}
              className="bg-black/40 border border-white/5 rounded-lg p-3 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-black/60 border ${pillar.color.border}/30 flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${pillar.color.text}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {pillar.title}
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {pillar.description}
                    </div>
                  </div>
                </div>
                <div className={`text-lg font-black ${pillar.color.text}`}>
                  {pillar.value}
                </div>
              </div>
              
              {/* Pillar Progress Bar */}
              <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${pillar.color.bg}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pillar.value}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Insights */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          {overallScore >= 70 ? (
            <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-[10px] font-bold text-white uppercase mb-1">
              {overallScore >= 70 ? '✓ Disciplina Consistente' : '⚠ Atenção Necessária'}
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              {overallScore >= 80
                ? 'Parabéns! Você está operando com disciplina profissional. Continue seguindo o plano e o algoritmo quântico.'
                : overallScore >= 60
                ? 'Boa performance! Para evoluir, foque em executar os gatilhos imediatamente e manter o plano de risco.'
                : overallScore >= 40
                ? 'Sua disciplina está comprometendo os resultados. Revise os pilares mais fracos e considere pausar se estiver em tilt.'
                : 'ALERTA CRÍTICO: Seu score indica operação emocional. Pause imediatamente e retome após análise dos erros.'}
            </p>
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="bg-black/40 rounded p-2 border border-white/5">
          <div className="text-[8px] text-slate-500 uppercase mb-1">Trades</div>
          <div className="text-sm font-bold text-white">{trades.length}</div>
        </div>
        <div className="bg-black/40 rounded p-2 border border-white/5">
          <div className="text-[8px] text-slate-500 uppercase mb-1">Stress Atual</div>
          <div className={`text-sm font-bold ${
            currentStressLevel > 70 ? 'text-rose-400' :
            currentStressLevel > 40 ? 'text-yellow-400' :
            'text-emerald-400'
          }`}>
            {currentStressLevel}%
          </div>
        </div>
        <div className="bg-black/40 rounded p-2 border border-white/5">
          <div className="text-[8px] text-slate-500 uppercase mb-1">Estado</div>
          <div className="text-[10px] font-bold text-purple-400 capitalize">
            {currentEmotionalState}
          </div>
        </div>
      </div>
    </div>
  );
};
