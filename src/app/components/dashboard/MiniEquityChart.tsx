import React from 'react';

interface MiniEquityChartProps {
  // Série real de equity (amostrada em useApexLogic.ts, nunca gerada/mock).
  // Sem histórico ainda (ex: sessão recém-iniciada), cai num fallback
  // honesto: linha reta no valor atual — nunca inventa movimento.
  data: number[];
}

export function MiniEquityChart({ data }: MiniEquityChartProps) {
  const equityData = data.length >= 2 ? data : data.length === 1 ? [data[0], data[0]] : [0, 0];

  const width = 100;
  const height = 40;
  const padding = 2;

  const min = Math.min(...equityData);
  const max = Math.max(...equityData);
  const range = max - min || 1;

  const points = equityData.map((value, index) => {
    const x = (index / (equityData.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  }).join(' ');

  const pathData = `M ${points.split(' ').join(' L ')}`;
  const areaData = `${pathData} L ${width},${height} L 0,${height} Z`;
  const isFlat = data.length < 2;
  const isUp = !isFlat && equityData[equityData.length - 1] >= equityData[0];
  const strokeColor = isFlat ? '#64748b' : isUp ? '#10b981' : '#f43f5e';

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaData} fill="url(#equityGradient)" />

        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {isFlat && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-neutral-500 font-mono">
          coletando dados...
        </span>
      )}
    </div>
  );
}
