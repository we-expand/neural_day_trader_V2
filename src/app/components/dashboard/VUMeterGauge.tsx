import React from 'react';

interface VUMeterGaugeProps {
  score: number;
  marketStatus?: 'OPEN' | 'CLOSED';
}

export const VUMeterGauge = React.memo(({ score, marketStatus = 'OPEN' }: VUMeterGaugeProps) => {
  const safeScore = Number.isFinite(score) ? score : 50;
  const normalizedScore = Math.min(Math.max(safeScore, 0), 100);
  
  // VU Meter angle: -45deg to +45deg (90deg range) - more realistic
  const angle = -45 + (normalizedScore / 100) * 90;
  
  const getColor = () => {
    if (marketStatus === 'CLOSED') return '#78716c';
    if (normalizedScore < 30) return '#7c2d12';
    if (normalizedScore < 50) return '#ca8a04';
    if (normalizedScore < 70) return '#65a30d';
    return '#15803d';
  };

  const needleColor = getColor();

  return (
    <div className="relative w-full h-full flex items-center justify-center p-3">
      {/* 🎨 Vintage meter housing - rounded rectangle */}
      <div className="relative w-full h-full bg-gradient-to-br from-stone-800 via-stone-900 to-zinc-900 rounded-3xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_8px_32px_rgba(0,0,0,0.6)] border-4 border-stone-700/50 overflow-hidden">
        
        {/* Brushed metal texture overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}></div>

        {/* Corner screws - decorative vintage detail */}
        <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-zinc-800 border border-zinc-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0.5 border-t border-l border-zinc-500/20"></div>
        </div>
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-zinc-800 border border-zinc-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0.5 border-t border-l border-zinc-500/20"></div>
        </div>
        <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-zinc-800 border border-zinc-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0.5 border-t border-l border-zinc-500/20"></div>
        </div>
        <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-zinc-800 border border-zinc-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0.5 border-t border-l border-zinc-500/20"></div>
        </div>

        {/* Glass/acrylic cover effect - curved */}
        <div className="absolute inset-3 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-black/20 pointer-events-none"></div>
        <div className="absolute top-3 left-3 right-1/2 bottom-1/2 rounded-tl-2xl bg-white/10 blur-sm pointer-events-none"></div>

        {/* Meter face background - cream vintage */}
        <div className="absolute inset-6 rounded-2xl bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)] flex items-center justify-center overflow-hidden">
          
          {/* Paper texture */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\' opacity=\'0.3\'/%3E%3C/svg%3E")'
          }}></div>

          {/* VU Meter SVG */}
          <svg viewBox="0 0 200 140" className="w-full h-full">
            <defs>
              {/* Vintage color zones gradient */}
              <linearGradient id="vintageZones" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c2d12"/>
                <stop offset="30%" stopColor="#ca8a04"/>
                <stop offset="60%" stopColor="#65a30d"/>
                <stop offset="100%" stopColor="#15803d"/>
              </linearGradient>
              
              {/* Needle shadow */}
              <filter id="needleShadow">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                <feOffset dx="1" dy="2" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.4"/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              {/* Metallic needle gradient */}
              <linearGradient id="needleMetal" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7"/>
                <stop offset="50%" stopColor="#f59e0b"/>
                <stop offset="100%" stopColor="#78350f"/>
              </linearGradient>
            </defs>

            {/* Color zone arcs - vintage style */}
            <g opacity="0.3">
              {/* Red zone */}
              <path d="M 30 110 A 70 70 0 0 1 70 52" fill="none" stroke="#7c2d12" strokeWidth="14"/>
              {/* Yellow zone */}
              <path d="M 70 52 A 70 70 0 0 1 100 42" fill="none" stroke="#ca8a04" strokeWidth="14"/>
              {/* Light green zone */}
              <path d="M 100 42 A 70 70 0 0 1 130 52" fill="none" stroke="#65a30d" strokeWidth="14"/>
              {/* Dark green zone */}
              <path d="M 130 52 A 70 70 0 0 1 170 110" fill="none" stroke="#15803d" strokeWidth="14"/>
            </g>

            {/* Scale marks - classic VU style */}
            {[-20, -10, -7, -5, -3, 0, 1, 2, 3, 5, 7].map((db, idx) => {
              const normalized = ((db + 20) / 27) * 100; // Map dB to 0-100
              const markAngle = -45 + (normalized / 100) * 90;
              const radians = (markAngle * Math.PI) / 180;
              const isMajor = [0, 20, 30, 50, 70, 90, 100].includes(Math.round(normalized));
              const x1 = 100 + Math.cos(radians) * 58;
              const y1 = 110 + Math.sin(radians) * 58;
              const x2 = 100 + Math.cos(radians) * (isMajor ? 66 : 62);
              const y2 = 110 + Math.sin(radians) * (isMajor ? 66 : 62);
              
              return (
                <g key={idx}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#292524"
                    strokeWidth={isMajor ? 2 : 1}
                    strokeLinecap="round"
                  />
                  {isMajor && (
                    <text
                      x={100 + Math.cos(radians) * 75}
                      y={110 + Math.sin(radians) * 75}
                      fill="#1c1917"
                      fontSize="7"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-serif"
                    >
                      {db > 0 ? `+${db}` : db}
                    </text>
                  )}
                </g>
              );
            })}

            {/* "VU" text labels - classic positioning */}
            <text x="45" y="95" fill="#7c2d12" fontSize="8" fontWeight="bold" className="font-serif">-20</text>
            <text x="90" y="35" fill="#ca8a04" fontSize="9" fontWeight="bold" className="font-serif">0</text>
            <text x="155" y="95" fill="#15803d" fontSize="8" fontWeight="bold" className="font-serif">+7</text>

            {/* Center pivot assembly */}
            <circle cx="100" cy="110" r="5" fill="#1c1917" stroke="#404040" strokeWidth="1"/>
            
            {/* Needle - realistic tapered design */}
            <g
              filter="url(#needleShadow)"
              style={{
                transform: `rotate(${marketStatus === 'CLOSED' ? -45 : angle}deg)`,
                transformOrigin: '100px 110px',
                transition: 'transform 1500ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* Main needle body - tapered triangle */}
              <path
                d="M 100,110 L 97,45 L 100,40 L 103,45 Z"
                fill="url(#needleMetal)"
                stroke="#78350f"
                strokeWidth="0.5"
              />
              
              {/* Red tip for classic VU look */}
              <circle cx="100" cy="42" r="2.5" fill="#dc2626"/>
              
              {/* Counterweight at base */}
              <circle cx="100" cy="110" r="3" fill="#292524"/>
            </g>

            {/* Center cap - brass/gold look */}
            <circle cx="100" cy="110" r="4" fill="url(#needleMetal)" stroke="#78350f" strokeWidth="1"/>
            <circle cx="100" cy="110" r="1.5" fill="#1c1917"/>
          </svg>

          {/* Brand label - vintage typography */}
          <div className="absolute top-2 left-0 right-0 flex justify-center">
            <span className="text-xs font-serif font-bold text-stone-700 tracking-wider">
              NEURAL VU
            </span>
          </div>

          {/* Bottom scale label */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <span className="text-[9px] font-serif text-stone-600 tracking-widest">
              SIGNAL STRENGTH
            </span>
          </div>
        </div>

        {/* LED digital readout - vintage 7-segment style */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black via-zinc-900 to-transparent flex items-center justify-center gap-3 px-4 rounded-b-3xl">
          
          {/* Left indicator */}
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${marketStatus === 'OPEN' ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-stone-600'}`}></div>
            <span className="text-[8px] font-mono font-bold text-stone-400 uppercase tracking-wider">
              {marketStatus === 'OPEN' ? 'Active' : 'Standby'}
            </span>
          </div>

          {/* Center digital display */}
          <div className="bg-black/80 px-3 py-1 rounded border border-stone-700/50 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]">
            <span 
              className="font-mono text-xl font-black tracking-tight"
              style={{
                color: marketStatus === 'CLOSED' ? '#78716c' : needleColor,
                textShadow: marketStatus === 'OPEN' ? `0 0 8px ${needleColor}80` : 'none',
                filter: 'brightness(1.5)'
              }}
            >
              {marketStatus === 'CLOSED' ? '--' : Math.round(normalizedScore)}
            </span>
          </div>

          {/* Right label */}
          <span className="text-[8px] font-mono font-bold text-stone-500 uppercase tracking-wider">
            dB
          </span>
        </div>
      </div>
    </div>
  );
});

VUMeterGauge.displayName = 'VUMeterGauge';