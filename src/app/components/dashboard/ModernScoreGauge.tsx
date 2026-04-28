import React from 'react';

interface ModernScoreGaugeProps {
  score: number;
  marketStatus?: 'OPEN' | 'CLOSED';
}

export const ModernScoreGauge: React.FC<ModernScoreGaugeProps> = ({ score, marketStatus = 'OPEN' }) => {
  const radius = 103.5; // Aumentado de 90 para 103.5 (+15%)
  const strokeWidth = 13.8; // Aumentado de 12 para 13.8 (+15%)
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  
  // Calcular circumferência
  const circumference = 2 * Math.PI * radius;
  
  // Calcular offset para criar o gap (deixar 10% de gap no topo)
  const gapPercent = 10;
  const effectiveCircumference = circumference * (1 - gapPercent / 100);
  const offset = effectiveCircumference * (1 - normalizedScore / 100);
  
  // Criar gradiente baseado no score
  const getGradientId = () => 'scoreGradient';
  
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible">
      <svg 
        className="w-full h-full overflow-visible" 
        viewBox="-20 -20 240 240"
        style={{ transform: 'rotate(126deg)', overflow: 'visible' }} // Começar do canto inferior esquerdo
      >
        <defs>
          {/* Gradiente Cyan → Amarelo → Laranja */}
          <linearGradient id={getGradientId()} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan */}
            <stop offset="50%" stopColor="#10b981" /> {/* Green */}
            <stop offset="75%" stopColor="#eab308" /> {/* Yellow */}
            <stop offset="100%" stopColor="#f97316" /> {/* Orange */}
          </linearGradient>
        </defs>
        
        {/* Background Track */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="#1f2937"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={effectiveCircumference}
          strokeDashoffset={0}
        />
        
        {/* Animated Progress Circle */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke={marketStatus === 'CLOSED' ? '#64748b' : `url(#${getGradientId()})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={effectiveCircumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ 
            filter: marketStatus === 'CLOSED' 
              ? 'none' 
              : `drop-shadow(0 0 12px ${score > 60 ? '#10b981' : score < 40 ? '#f97316' : '#eab308'})`
          }}
        />
      </svg>
      
      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {marketStatus === 'CLOSED' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {/* Círculo animado de fundo */}
              <div className="absolute inset-0 rounded-full bg-slate-700/20 animate-pulse" />
              {/* Ícone de relógio */}
              <svg 
                className="w-12 h-12 text-slate-500 relative z-10" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-400 tracking-tight uppercase mt-1">
              Fechado
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-6xl font-black text-white tracking-tighter leading-none">
              {Math.round(normalizedScore)}
            </span>
            <span className="text-xs font-medium text-neutral-500 mt-1">/ 100</span>
          </div>
        )}
      </div>
    </div>
  );
};