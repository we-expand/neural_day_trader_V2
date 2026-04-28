import React from 'react';
import { motion } from 'motion/react';
import { MessageCircle, X } from 'lucide-react';

interface FloatingAssistantButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function FloatingAssistantButton({ isOpen, onClick }: FloatingAssistantButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`fixed bottom-8 right-8 z-40 w-16 h-16 rounded-full shadow-2xl transition-all duration-300 ${
        isOpen
          ? 'bg-gradient-to-br from-red-600 to-red-700'
          : 'bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700'
      }`}
      style={{
        boxShadow: isOpen
          ? '0 0 40px rgba(239, 68, 68, 0.6), 0 0 80px rgba(239, 68, 68, 0.3)'
          : '0 0 40px rgba(168, 85, 247, 0.6), 0 0 80px rgba(168, 85, 247, 0.3)'
      }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Pulse Animation */}
        {!isOpen && (
          <>
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'loop'
              }}
              className="absolute inset-0 rounded-full bg-purple-500"
            />
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.7, 0, 0.7]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'loop',
                delay: 0.5
              }}
              className="absolute inset-0 rounded-full bg-pink-500"
            />
          </>
        )}

        {/* Icon */}
        <motion.div
          animate={
            isOpen
              ? {}
              : {
                  rotate: [0, -10, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }
          }
          transition={
            isOpen
              ? {}
              : {
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }
          }
          className="relative z-10"
        >
          {isOpen ? (
            <X className="w-7 h-7 text-white" />
          ) : (
            <div className="text-3xl">🌙</div>
          )}
        </motion.div>

        {/* Badge de notificação (opcional) */}
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-[#0a0a0a]"
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 1,
                repeat: Infinity
              }}
              className="w-2 h-2 bg-white rounded-full"
            />
          </motion.div>
        )}
      </div>

      {/* Tooltip */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-xl whitespace-nowrap pointer-events-none"
        >
          <div className="text-sm font-bold text-white">
            💬 Falar com Luna
          </div>
          <div className="text-xs text-purple-200">
            Sua melhor amiga do trade
          </div>
          
          {/* Arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full">
            <div className="w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-pink-600" />
          </div>
        </motion.div>
      )}
    </motion.button>
  );
}
