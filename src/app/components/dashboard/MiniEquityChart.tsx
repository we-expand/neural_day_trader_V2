import React, { useId } from 'react';

interface MiniEquityChartProps {
  // Série real de equity (amostrada em useApexLogic.ts, nunca gerada/mock).
  // Sem histórico ainda (ex: sessão recém-iniciada), cai num fallback
  // honesto: linha reta no valor atual — nunca inventa movimento.
  data: number[];
}

// Catmull-Rom -> Bezier: suaviza a série sem inventar pontos, só interpola
// visualmente entre os valores reais já existentes.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function MiniEquityChart({ data }: MiniEquityChartProps) {
  const uid = useId().replace(/:/g, '');
  const equityData = data.length >= 2 ? data : data.length === 1 ? [data[0], data[0]] : [0, 0];

  const width = 100;
  const height = 40;
  const padding = 3;

  const min = Math.min(...equityData);
  const max = Math.max(...equityData);
  const range = max - min || 1;

  const pts = equityData.map((value, index) => ({
    x: (index / (equityData.length - 1)) * width,
    y: height - ((value - min) / range) * (height - padding * 2) - padding,
  }));

  const linePath = smoothPath(pts);
  const last = pts[pts.length - 1];
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const isFlat = data.length < 2;
  const isUp = !isFlat && equityData[equityData.length - 1] >= equityData[0];
  const strokeColor = isFlat ? '#64748b' : isUp ? '#2dd4bf' : '#fb7185';

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`equityGradient-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
            <stop offset="70%" stopColor={strokeColor} stopOpacity="0.04" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
          <filter id={`equityGlow-${uid}`} x="-30%" y="-60%" width="160%" height="240%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={areaPath} fill={`url(#equityGradient-${uid})`} />

        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#equityGlow-${uid})`}
        />

        {!isFlat && last && (
          <>
            <circle cx={last.x} cy={last.y} r="4" fill={strokeColor} opacity="0.18">
              <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.22;0;0.22" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={last.x} cy={last.y} r="1.6" fill={strokeColor} />
          </>
        )}
      </svg>
      {isFlat && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-neutral-500 font-mono">
          coletando dados...
        </span>
      )}
    </div>
  );
}
