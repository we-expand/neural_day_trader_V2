/**
 * 📐 FIBONACCI & GANN CUSTOM ICONS
 * 
 * Ícones específicos para cada ferramenta de análise técnica
 * Baseados nos designs profissionais do TradingView
 * 
 * @version 1.0.0
 * @date 24 Janeiro 2026
 */

import React from 'react';

interface IconProps {
  className?: string;
}

// 📏 Retração de Fibonacci
export const FibRetracementIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="20" x2="4" y2="4" />
    <line x1="4" y1="20" x2="20" y2="20" />
    <line x1="4" y1="16" x2="20" y2="16" strokeDasharray="2 2" opacity="0.5" />
    <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2 2" opacity="0.5" />
    <line x1="4" y1="8" x2="20" y2="8" strokeDasharray="2 2" opacity="0.5" />
    <circle cx="7" cy="8" r="1.5" fill="currentColor" />
    <circle cx="17" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

// 📈 Extensão de Fibonacci
export const FibExtensionIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 20 L8 12 L12 16 L20 4" strokeLinecap="round" />
    <line x1="14" y1="8" x2="20" y2="8" strokeDasharray="2 2" opacity="0.5" />
    <line x1="16" y1="6" x2="20" y2="6" strokeDasharray="2 2" opacity="0.5" />
    <circle cx="8" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

// 📊 Canal de Fibonacci
export const FibChannelIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="18" x2="20" y2="6" />
    <line x1="4" y1="14" x2="20" y2="2" strokeDasharray="2 2" opacity="0.5" />
    <line x1="4" y1="22" x2="20" y2="10" strokeDasharray="2 2" opacity="0.5" />
    <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    <circle cx="20" cy="6" r="1.5" fill="currentColor" />
  </svg>
);

// ⏱️ Zona Temporal em Fibonacci
export const FibTimezoneIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="4" x2="4" y2="20" />
    <line x1="7" y1="4" x2="7" y2="20" strokeDasharray="2 2" opacity="0.5" />
    <line x1="10" y1="4" x2="10" y2="20" strokeDasharray="2 2" opacity="0.5" />
    <line x1="14" y1="4" x2="14" y2="20" strokeDasharray="2 2" opacity="0.5" />
    <line x1="19" y1="4" x2="19" y2="20" strokeDasharray="2 2" opacity="0.5" />
    <path d="M2 18 L22 18" strokeWidth="1" />
  </svg>
);

// 📐 Leque de Resistência e Velocidade (Speed Fan)
export const FibSpeedFanIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="20" x2="20" y2="4" />
    <line x1="4" y1="20" x2="18" y2="8" opacity="0.5" />
    <line x1="4" y1="20" x2="15" y2="12" opacity="0.5" />
    <circle cx="4" cy="20" r="1.5" fill="currentColor" />
  </svg>
);

// ⏰ Tempo de Fibonacci Baseado em Tendências
export const FibTimeIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 16 L8 12 L12 14 L16 8 L20 10" strokeLinecap="round" />
    <line x1="8" y1="4" x2="8" y2="20" strokeDasharray="2 2" opacity="0.5" />
    <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="2 2" opacity="0.5" />
    <line x1="16" y1="4" x2="16" y2="20" strokeDasharray="2 2" opacity="0.5" />
  </svg>
);

// ⭕ Círculos de Fibonacci
export const FibCirclesIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="12" cy="12" r="3" opacity="0.8" />
    <circle cx="12" cy="12" r="6" opacity="0.5" />
    <circle cx="12" cy="12" r="9" opacity="0.3" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

// 🌀 Espiral de Fibonacci
export const FibSpiralIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 12 Q16 12 16 8 Q16 4 12 4 Q8 4 8 8 Q8 12 12 12 Q16 12 16 16 Q16 20 12 20" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

// 🏹 Arcos de Resistência e Velocidade
export const FibSpeedArcsIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M4 20 Q8 16 12 16 Q16 16 20 20" />
    <path d="M4 20 Q10 12 12 12 Q14 12 20 20" opacity="0.6" />
    <path d="M4 20 Q11 8 12 8 Q13 8 20 20" opacity="0.4" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

// 📐 Cunha de Fibonacci
export const FibWedgeIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 20 L12 4 L20 20 Z" strokeLinejoin="round" />
    <line x1="6" y1="16" x2="18" y2="16" strokeDasharray="2 2" opacity="0.5" />
    <line x1="8" y1="12" x2="16" y2="12" strokeDasharray="2 2" opacity="0.5" />
    <circle cx="12" cy="4" r="1" fill="currentColor" />
  </svg>
);

// 📏 Leque de Linhas
export const FibFanIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="20" x2="20" y2="4" />
    <line x1="4" y1="20" x2="16" y2="8" opacity="0.6" />
    <line x1="4" y1="20" x2="12" y2="12" opacity="0.4" />
    <circle cx="4" cy="20" r="1.5" fill="currentColor" />
  </svg>
);

// === GANN ICONS ===

// 📦 Caixa de Gann
export const GannBoxIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2 2" opacity="0.5" />
    <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="2 2" opacity="0.5" />
    <line x1="4" y1="4" x2="20" y2="20" opacity="0.3" />
    <line x1="20" y1="4" x2="4" y2="20" opacity="0.3" />
  </svg>
);

// 🔲 Quadrado de Gann Fixo
export const GannSquareFixedIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="1" />
    <line x1="6" y1="12" x2="18" y2="12" opacity="0.4" />
    <line x1="12" y1="6" x2="12" y2="18" opacity="0.4" />
    <path d="M9 9 L15 15" opacity="0.3" strokeWidth="1" />
    <path d="M15 9 L9 15" opacity="0.3" strokeWidth="1" />
  </svg>
);

// 🔳 Quadrado de Gann
export const GannSquareIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="5" y="8" width="14" height="10" rx="1" />
    <line x1="5" y1="13" x2="19" y2="13" opacity="0.4" />
    <line x1="12" y1="8" x2="12" y2="18" opacity="0.4" />
    <line x1="5" y1="8" x2="19" y2="18" opacity="0.3" />
  </svg>
);

// 📐 Leque de Gann
export const GannFanIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2" />
    <line x1="4" y1="20" x2="18" y2="8" opacity="0.7" />
    <line x1="4" y1="20" x2="16" y2="10" opacity="0.5" />
    <line x1="4" y1="20" x2="14" y2="12" opacity="0.4" />
    <line x1="4" y1="20" x2="12" y2="14" opacity="0.3" />
    <circle cx="4" cy="20" r="1.5" fill="currentColor" />
  </svg>
);

// === OUTRAS FERRAMENTAS ===

// ✝️ Cruz (Crosshair) - Ícone customizado
export const CrossIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

// 📊 Logo Fibonacci
export const FibonacciLogoIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="3" y="15" width="4" height="4" />
    <rect x="7" y="11" width="4" height="8" />
    <rect x="11" y="7" width="4" height="12" />
    <rect x="15" y="3" width="4" height="16" />
  </svg>
);

// === DRAWING TOOLS ICONS ===

// 📈 Linha de Tendência (Trendline) - Estilo da imagem
export const TrendlineIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="18" x2="20" y2="6" strokeLinecap="round" />
    <circle cx="4" cy="18" r="2" fill="currentColor" />
    <circle cx="20" cy="6" r="2" fill="currentColor" />
  </svg>
);

// 📏 Raio (Ray) - Linha com um ponto e uma seta
export const RayIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="18" x2="20" y2="6" strokeLinecap="round" />
    <circle cx="4" cy="18" r="2" fill="currentColor" />
    <path d="M17 8 L20 6 L18 9" fill="currentColor" strokeWidth="1" />
  </svg>
);

// ℹ️ Linha com Informações
export const InfoLineIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="18" x2="20" y2="6" strokeLinecap="round" />
    <circle cx="4" cy="18" r="2" fill="currentColor" />
    <circle cx="20" cy="6" r="2" fill="currentColor" />
    <text x="12" y="10" fontSize="8" fill="currentColor" textAnchor="middle">i</text>
  </svg>
);

// 🔀 Linha Estendida (Extended Line)
export const ExtendedLineIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" strokeDasharray="1 2" opacity="0.3" />
    <line x1="6" y1="12" x2="18" y2="12" strokeLinecap="round" />
    <circle cx="6" cy="12" r="2" fill="currentColor" />
    <circle cx="18" cy="12" r="2" fill="currentColor" />
  </svg>
);

// 📐 Ângulo de Tendência
export const TrendAngleIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="18" x2="20" y2="6" strokeLinecap="round" />
    <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" strokeDasharray="2 2" opacity="0.4" />
    <path d="M12 18 Q14 16 16 14" fill="none" strokeWidth="1" opacity="0.6" />
    <circle cx="4" cy="18" r="2" fill="currentColor" />
  </svg>
);

// ➖ Linha Horizontal
export const HorizontalLineIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
    <circle cx="4" cy="12" r="1.5" fill="currentColor" />
    <circle cx="20" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

// ➡️ Raio Horizontal
export const HorizontalRayIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
    <circle cx="4" cy="12" r="2" fill="currentColor" />
    <path d="M17 10 L20 12 L17 14" fill="currentColor" strokeWidth="1" />
  </svg>
);

// ⬍ Linha Vertical
export const VerticalLineIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="12" y1="4" x2="12" y2="20" strokeLinecap="round" />
    <circle cx="12" cy="4" r="1.5" fill="currentColor" />
    <circle cx="12" cy="20" r="1.5" fill="currentColor" />
  </svg>
);

// ✖️ Linha Cruzada
export const CrossLineIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="12" y1="4" x2="12" y2="20" strokeLinecap="round" opacity="0.6" />
    <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" opacity="0.6" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>
);

// 📊 Canal Paralelo - Estilo da imagem
export const ParallelChannelIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="16" x2="20" y2="8" strokeLinecap="round" />
    <line x1="4" y1="20" x2="20" y2="12" strokeLinecap="round" strokeDasharray="3 2" opacity="0.5" />
    <line x1="4" y1="12" x2="20" y2="4" strokeLinecap="round" strokeDasharray="3 2" opacity="0.5" />
    <circle cx="4" cy="16" r="1.5" fill="currentColor" />
    <circle cx="20" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

// 📈 Tendência de Regressão
export const RegressionTrendIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="18" x2="20" y2="6" strokeLinecap="round" />
    <line x1="4" y1="16" x2="20" y2="4" strokeLinecap="round" strokeDasharray="2 2" opacity="0.4" />
    <line x1="4" y1="20" x2="20" y2="8" strokeLinecap="round" strokeDasharray="2 2" opacity="0.4" />
    <circle cx="7" cy="16" r="1" fill="currentColor" opacity="0.6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" opacity="0.6" />
    <circle cx="17" cy="8" r="1" fill="currentColor" opacity="0.6" />
  </svg>
);

// 📊 Topo/Fundo Plano
export const FlatTopBottomIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <line x1="4" y1="8" x2="20" y2="8" strokeLinecap="round" />
    <line x1="4" y1="16" x2="20" y2="16" strokeLinecap="round" />
    <line x1="8" y1="8" x2="8" y2="16" strokeLinecap="round" strokeDasharray="2 2" opacity="0.4" />
    <line x1="16" y1="8" x2="16" y2="16" strokeLinecap="round" strokeDasharray="2 2" opacity="0.4" />
    <circle cx="4" cy="8" r="1.5" fill="currentColor" />
    <circle cx="20" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

// 📐 Garfo (Pitchfork)
export const PitchforkIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <line x1="12" y1="4" x2="12" y2="20" strokeWidth="2" />
    <line x1="12" y1="4" x2="6" y2="20" opacity="0.6" />
    <line x1="12" y1="4" x2="18" y2="20" opacity="0.6" />
    <line x1="12" y1="12" x2="9" y2="20" opacity="0.4" strokeDasharray="2 2" />
    <line x1="12" y1="12" x2="15" y2="20" opacity="0.4" strokeDasharray="2 2" />
    <circle cx="12" cy="4" r="2" fill="currentColor" />
  </svg>
);