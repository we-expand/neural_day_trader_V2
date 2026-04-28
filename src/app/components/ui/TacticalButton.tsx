import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

interface TacticalButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'ghost';
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function TacticalButton({ 
  onClick, 
  children, 
  variant = 'primary', 
  isLoading, 
  disabled,
  className = '',
  icon
}: TacticalButtonProps) {
  
  const variants = {
    primary: "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] border-emerald-400",
    danger: "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] border-red-500",
    ghost: "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white"
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        relative overflow-hidden px-6 py-3 rounded-lg font-bold uppercase tracking-widest text-sm
        border transition-all duration-300 group
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${variants[variant]}
        ${className}
      `}
      whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.96, y: 1 }}
    >
      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
      
      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          <span className="group-hover:scale-110 transition-transform duration-300">{icon}</span>
        ) : null}
        
        {children}
      </span>

      {/* Background Pulse on Hover (Primary only) */}
      {variant === 'primary' && !disabled && (
        <span className="absolute inset-0 rounded-lg ring-2 ring-white/20 opacity-0 group-hover:opacity-100 animate-pulse transition-opacity" />
      )}
    </motion.button>
  );
}
