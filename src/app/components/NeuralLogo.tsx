import React from 'react';

interface NeuralLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

export const NeuralLogo: React.FC<NeuralLogoProps> = ({ 
  size = 'md', 
  className = '',
  animated = true 
}) => {
  const sizeMap = {
    sm: 'w-24 h-auto',
    md: 'w-36 h-auto',
    lg: 'w-48 h-auto',
    xl: 'w-60 h-auto'
  };

  return (
    <div className={`relative inline-block ${sizeMap[size]} ${className}`}>
      <svg 
        id="neural-logo" 
        xmlns="http://www.w3.org/2000/svg" 
        xmlnsXlink="http://www.w3.org/1999/xlink" 
        viewBox="0 -50 320 280"
        className="relative z-10"
      >
        <defs>
          <style>{`
            .cls-1 { fill: #fff; }
            .cls-2 { fill: url(#grad-1); }
            .cls-3 { fill: url(#grad-2); }
            .cls-4 { fill: url(#grad-3); }
            .cls-5 { fill: url(#grad-4); }
            .cls-6 { fill: url(#grad-5); }
            .cls-7 { fill: url(#grad-6); }
            .cls-8 { fill: url(#grad-7); }
            
            /* Brilho nas bolinhas - Timings aleatórios e lentos */
            @keyframes nodePulseRandom {
              0%, 100% { 
                opacity: 0.5;
                filter: drop-shadow(0 0 0px rgba(0, 255, 255, 0));
              }
              10%, 15% { 
                opacity: 1;
                filter: drop-shadow(0 0 10px rgba(0, 255, 255, 1)) drop-shadow(0 0 18px rgba(0, 255, 255, 0.8));
              }
            }
            
            .neural-node-1 {
              animation: nodePulseRandom 6.5s ease-in-out infinite;
              animation-delay: 0s;
            }
            
            .neural-node-2 {
              animation: nodePulseRandom 7.8s ease-in-out infinite;
              animation-delay: 2.1s;
            }
            
            .neural-node-3 {
              animation: nodePulseRandom 7.2s ease-in-out infinite;
              animation-delay: 4.3s;
            }
            
            .neural-node-center {
              animation: nodePulseRandom 8.1s ease-in-out infinite;
              animation-delay: 6.2s;
            }
          `}</style>
          
          {/* Gradientes */}
          <linearGradient id="grad-1" x1="176.64" y1="104.01" x2="122.97" y2="104.01" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="aqua"/>
            <stop offset="0.44" stopColor="#01f7f7"/>
            <stop offset="1" stopColor="#000"/>
          </linearGradient>
          <linearGradient id="grad-2" x1="227.8" y1="145.52" x2="120.66" y2="145.52" xlinkHref="#grad-1"/>
          <linearGradient id="grad-3" x1="226.23" y1="104.35" x2="172.64" y2="104.35" xlinkHref="#grad-1"/>
          <linearGradient id="grad-4" x1="140.75" y1="62.1" x2="124.19" y2="62.1" xlinkHref="#grad-1"/>
          <linearGradient id="grad-5" x1="138.34" y1="5.87" x2="126.6" y2="5.87" xlinkHref="#grad-1"/>
          <linearGradient id="grad-6" x1="88.75" y1="87.57" x2="77.01" y2="87.57" xlinkHref="#grad-1"/>
          <linearGradient id="grad-7" x1="187.4" y1="87.57" x2="175.66" y2="87.57" xlinkHref="#grad-1"/>
        </defs>

        {/* Hexágono 3D */}
        <g transform="translate(-42.24, -57.67) translate(0, 22) translate(174.18, 104.35) scale(0.6, 0.52) translate(-174.18, -104.35)">
          <path className="cls-2" d="M123,89l53.67-30v60L123,149Zm4,53.26,45.69-25.52v-51L127,91.25Z"/>
          <path className="cls-3" d="M174.18,115.36l53.62,30.57-53.51,29.75-53.63-30.56ZM128,145.64,174.16,172l46.31-26-46.16-26.3Z"/>
          <path className="cls-4" d="M226.23,149.64l-53.59-30.2V59.05l53.59,30.2Zm-4-58.14L176.62,65.79V117.2l45.62,25.7Z"/>
        </g>

        {/* Nós Neurais - Posicionados nos vértices do hexágono */}
        <g transform="translate(-42.24, -57.67) translate(0, 22) translate(174.18, 104.35) scale(0.6, 0.52) translate(-174.18, -104.35)">
          {/* 0° - Topo (12h) - NORTE - Trigger/Entrada Principal */}
          <circle className="cls-1 neural-node-1" cx="174.18" cy="59.05" r="5.87"/>
          
          {/* 120° - Inferior Direito - Confirmações/Filtros */}
          <circle className="cls-1 neural-node-2" cx="226.8" cy="149.65" r="5.87"/>
          
          {/* 240° - Inferior Esquerdo - Confirmações/Filtros */}
          <circle className="cls-1 neural-node-3" cx="121.56" cy="149.65" r="5.87"/>
          
          {/* Centro do Hexágono - Ajustado para baixo */}
          <circle className="cls-1 neural-node-center" cx="174.18" cy="115" r="5.87"/>
        </g>

        {/* Texto NEURAL */}
        <g style={{fill: 'rgb(176, 176, 176)', fillOpacity: 1, fontFamily: 'Montserrat, sans-serif', fontWeight: 400}} transform="translate(-42.24, -69.3) translate(170, 224.74) scale(0.94) translate(-170, -224.74)">
          <path d="M42.24,242.24v-35h2.15l25,31.85H68.19V207.24h2.55v35h-2.1l-25-31.85h1.15v31.85Z"/>
          <path d="M92.94,242.24v-35h23.4v2.3H95.49v30.4h21.6v2.3Zm2.25-16.65v-2.25h19v2.25Z"/>
          <path d="M150.09,242.49q-6.51,0-10.25-3.8t-3.75-11.3V207.24h2.55v20q0,6.56,3,9.7t8.5,3.15q5.45,0,8.45-3.15t3-9.7v-20h2.55v20.15q0,7.5-3.75,11.3T150.09,242.49Z"/>
          <path d="M186,242.24v-35h12.55q6.6,0,10.35,3.1a10.67,10.67,0,0,1,3.75,8.7,11.34,11.34,0,0,1-1.7,6.28,11,11,0,0,1-4.85,4.05,18.23,18.23,0,0,1-7.55,1.42H187.44l1.15-1.2v12.65Zm2.55-12.5-1.15-1.2h11.15q5.64,0,8.57-2.5a9.85,9.85,0,0,0,0-14q-2.92-2.47-8.57-2.48H187.44l1.15-1.25Zm21.75,12.5-9.1-12.7h2.9l9.1,12.7Z"/>
          <path d="M226.18,242.24l16.1-35h2.55l16.1,35h-2.75L243,208.84h1.1l-15.15,33.4Zm5.9-9.85.85-2.15h20.95l.85,2.15Z"/>
          <path d="M277.28,242.24v-35h2.55v32.7H300v2.3Z"/>
        </g>

        {/* Texto "DAY TRADER" abaixo de NEURAL em Montserrat Regular branco chapado */}
        <text 
          x="129" 
          y="205" 
          textAnchor="middle" 
          style={{
            fill: 'rgb(255, 255, 255)', 
            fillOpacity: 1, 
            fontFamily: 'Montserrat, sans-serif', 
            fontWeight: 400,
            fontSize: '16px',
            letterSpacing: '0.15em'
          }}
        >
          DAY TRADER
        </text>
      </svg>
    </div>
  );
};

export default NeuralLogo;