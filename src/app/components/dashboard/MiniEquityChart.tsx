import React from 'react';

export function MiniEquityChart() {
  // Mock equity data
  const equityData = [100, 102, 98, 105, 107, 103, 108, 112, 109, 115];
  
  // Calculate SVG path
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

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <path
          d={areaData}
          fill="url(#equityGradient)"
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
