import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

const MagneticLetter = ({ children }: { children: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring configuration for smooth magnetic effect
  const springConfig = { damping: 15, stiffness: 200, mass: 0.5 };
  const mouseX = useSpring(x, springConfig);
  const mouseY = useSpring(y, springConfig);

  // Color interpolation
  // We can't easily animate color with bg-clip-text parent, 
  // so we'll use a text-shadow or color override if we want highlighting.
  // For now, let's stick to movement.

  const handleMouseMove = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      
      // Limit the movement range
      x.set(distanceX * 0.6);
      y.set(distanceY * 0.6);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <motion.span
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{ x: mouseX, y: mouseY }}
      className={`inline-block cursor-default select-none transition-colors duration-200 ${
        isHovered ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-transparent'
      }`}
    >
      {children}
    </motion.span>
  );
};

export const InteractiveTitle = ({ lines }: { lines: string[] }) => {
  return (
    <div className="flex flex-col items-center justify-center mb-8 relative z-20">
      {lines.map((line, lineIndex) => (
        <div 
          key={lineIndex} 
          className="flex flex-wrap justify-center gap-x-4 md:gap-x-6 text-6xl md:text-8xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 to-cyan-600"
        >
          {line.split(" ").map((word, wordIndex) => (
            <div key={wordIndex} className="flex">
              {word.split("").map((char, charIndex) => (
                <MagneticLetter key={`${lineIndex}-${wordIndex}-${charIndex}`}>
                  {char}
                </MagneticLetter>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
