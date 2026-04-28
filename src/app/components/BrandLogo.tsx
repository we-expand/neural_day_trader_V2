import React from 'react';
import { NeuralLogo as NeuralLogoIcon } from './NeuralLogo';

interface LogoProps {
  variant?: 'full' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

export const BrandLogo: React.FC<LogoProps> = ({ 
  variant = 'full', 
  size = 'md',
  animated = true 
}) => {
  const textScales = {
    sm: { text: 'text-lg', subtext: 'text-[10px]' },
    md: { text: 'text-3xl', subtext: 'text-sm' },
    lg: { text: 'text-5xl', subtext: 'text-lg' },
    xl: { text: 'text-7xl', subtext: 'text-3xl' }
  };

  const currentText = textScales[size];

  // ✅ No motion animation on this wrapper — prevents logo re-animating on every re-render.
  // The NeuralLogoIcon SVG handles its own internal animated nodes independently.
  return (
    <div className="flex items-center gap-3 select-none cursor-pointer">
      {variant === 'icon-only' ? (
        <NeuralLogoIcon size={size} animated={animated} />
      ) : (
        <div className="flex items-center gap-3">
          <NeuralLogoIcon size={size} animated={animated} />
          <div className="flex flex-col justify-center items-center">
            <h1
              className={`font-sans tracking-[0.25em] font-light text-white ${currentText.text} leading-none`}
              style={{ textShadow: '0 4px 8px rgba(0,0,0,0.5), 0 0 10px rgba(34,211,238,0.3)' }}
            >
              NEURAL
            </h1>
            <span
              className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-white ${currentText.subtext} tracking-[0.58em] uppercase leading-none mt-1`}
            >
              TRADER
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const NeuralLogo = BrandLogo;