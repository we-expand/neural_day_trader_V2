import React from 'react';
import { motion } from 'motion/react';

export const NeuralPortfolioEmpty = () => {
  return (
    <div className="relative w-full h-64 flex flex-col items-center justify-center overflow-hidden bg-black/40 rounded-lg border border-white/5 border-dashed group">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px]" />
      
      {/* Central Neural Pulse */}
      <div className="relative z-10 mb-6">
        <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer Rotating Ring */}
            <motion.svg 
                viewBox="0 0 100 100" 
                className="absolute inset-0 w-full h-full text-purple-500/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="10 5" />
                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="2 150" strokeLinecap="round" className="text-purple-400" />
            </motion.svg>

            {/* Inner Rotating Ring (Counter) */}
            <motion.svg 
                viewBox="0 0 100 100" 
                className="absolute inset-0 w-full h-full text-blue-500/30 scale-75"
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            >
                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
            </motion.svg>

            {/* Core Pulse */}
            <motion.div 
                className="w-3 h-3 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
            
            {/* Connecting Lines */}
            <motion.svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                    <motion.line
                        key={i}
                        x1="50" y1="50" x2="50" y2="10"
                        stroke="url(#grad1)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        transform={`rotate(${deg} 50 50)`}
                        className="text-slate-700"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.5, 0] }}
                        transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                    />
                ))}
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(168,85,247,0)" />
                        <stop offset="50%" stopColor="rgba(168,85,247,0.5)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                    </linearGradient>
                </defs>
            </motion.svg>
        </div>
      </div>

      <div className="relative z-10 text-center space-y-1">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Scanner Neural Ativo</h4>
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Buscando Oportunidades
        </div>
      </div>
    </div>
  );
};

export const NeuralLogsEmpty = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] opacity-60">
        <div className="w-full max-w-[200px] h-12 relative flex items-center justify-center">
            {/* Animated Audio/Data Wave */}
            <div className="flex items-center justify-center gap-1 h-full">
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-0.5 bg-gradient-to-t from-transparent via-emerald-500/50 to-transparent rounded-full"
                        animate={{ 
                            height: ["20%", "80%", "20%"],
                            opacity: [0.3, 1, 0.3]
                        }}
                        transition={{ 
                            duration: 1.5, 
                            repeat: Infinity, 
                            ease: "easeInOut",
                            delay: i * 0.1 
                        }}
                        style={{
                            height: '40%'
                        }}
                    />
                ))}
            </div>
            
            {/* Dashed Overlay Line */}
            <motion.div 
                className="absolute top-1/2 left-0 w-full h-[1px] border-t border-dashed border-emerald-500/30"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1 }}
            />
        </div>
        
        <p className="mt-2 text-[10px] font-mono text-emerald-500/50 uppercase tracking-widest animate-pulse">
            Aguardando Sinal da Rede...
        </p>
    </div>
  );
};
