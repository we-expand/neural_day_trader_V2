import React, { useId } from 'react';

interface MiniEquityChartProps {
  // Série real de equity (amostrada em useApexLogic.ts, nunca gerada/mock).
  // Sem histórico ainda (ex: sessão recém-iniciada), cai num fallback
  // honesto: linha reta no valor atual — nunca inventa movimento.
  data: number[];
}

// Catmull-Rom -> Bezier, com reflexão nas pontas (em vez de duplicar o
// ponto extremo) pra evitar os trechos perfeitamente retos que aparecem
// quando a série tem poucos pontos reais.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  const reflect = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: 2 * a.x - b.x,
    y: 2 * a.y - b.y,
  });

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || reflect(pts[i], pts[i + 1]);
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || reflect(pts[i + 1], pts[i]);

    const segMin = Math.min(p1.y, p2.y);
    const segMax = Math.max(p1.y, p2.y);
    const clampY = (y: number) => Math.min(segMax, Math.max(segMin, y));

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function MiniEquityChart({ data }: MiniEquityChartProps) {
  const uid = useId().replace(/:/g, '');
  const equityData = data.length >= 2 ? data : data.length === 1 ? [data[0], data[0]] : [0, 0];

  const width = 100;
  const height = 40;
  const padding = 5;

  const min = Math.min(...equityData);
  const max = Math.max(...equityData);
  const range = max - min || 1;

  const pts = equityData.map((value, index) => ({
    x: (index / (equityData.length - 1)) * width,
    y: height - ((value - min) / range) * (height - padding * 2) - padding,
  }));

  const linePath = smoothPath(pts);
  const first = pts[0];
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
          <linearGradient id={`equityFill-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="70%" stopColor={strokeColor} stopOpacity="0.03" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`equityStroke-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="1" />
          </linearGradient>
          <filter id={`equityGlow-${uid}`} x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="0.9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grid minimalista */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={width}
            y1={padding + (height - padding * 2) * f}
            y2={padding + (height - padding * 2) * f}
            stroke="currentColor"
            className="text-neutral-500/10"
            strokeWidth="0.4"
          />
        ))}

        {/* linha-base: valor inicial da sessão, referência de evolução */}
        {!isFlat && first && (
          <line
            x1="0"
            x2={width}
            y1={first.y}
            y2={first.y}
            stroke={strokeColor}
            strokeOpacity="0.22"
            strokeWidth="0.5"
            strokeDasharray="1.5 1.5"
          />
        )}

        <path d={areaPath} fill={`url(#equityFill-${uid})`} />

        <path
          d={linePath}
          fill="none"
          stroke={`url(#equityStroke-${uid})`}
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#equityGlow-${uid})`}
          pathLength={100}
          style={{
            strokeDasharray: 100,
            strokeDashoffset: 0,
            animation: 'equity-draw 900ms ease-out',
          }}
        />

        {!isFlat && first && (
          <circle cx={first.x} cy={first.y} r="1" fill={strokeColor} opacity="0.35" />
        )}

        {!isFlat && last && (
          <>
            <circle cx={last.x} cy={last.y} r="3" fill={strokeColor} opacity="0.16">
              <animate attributeName="r" values="2.5;5;2.5" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.2;0;0.2" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={last.x} cy={last.y} r="1.3" fill={strokeColor} />
          </>
        )}
      </svg>

      <style>{`
        @keyframes equity-draw {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {isFlat && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-neutral-500 font-mono">
          coletando dados...
        </span>
      )}
    </div>
  );
}
