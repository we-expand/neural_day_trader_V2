import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

const CONFIG = {
  particleCount: 80,        // Aumentei a densidade
  connectionDist: 150,      // Aumentei o alcance das conexões
  mouseDist: 300,           // Aumentei o raio de interação
  baseSpeed: 0.35,          // Levemente mais rápido
  colorNode: '226, 232, 240', // Slate-200 (Muito mais claro/visível)
  colorActive: '6, 182, 212', // Cyan-500 (Mais vibrante)
  colorSignal: '192, 132, 252', // Purple-400 (Sinal mais brilhante)
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  pulsePhase: number;
}

interface Signal {
  startNodeIndex: number;
  endNodeIndex: number;
  progress: number; // 0.0 to 1.0
  speed: number;
}

const NeuralCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const particlesRef = useRef<Particle[]>([]);
  const signalsRef = useRef<Signal[]>([]); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrameId: number;

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      particlesRef.current = [];
      for (let i = 0; i < CONFIG.particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * CONFIG.baseSpeed,
          vy: (Math.random() - 0.5) * CONFIG.baseSpeed,
          size: Math.random() * 2.0 + 1.0, // Aumentei o tamanho base (1px a 3px)
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      const particles = particlesRef.current;
      const signals = signalsRef.current;

      // 1. UPDATE PARTICLES
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += 0.03; // Pulso mais rápido

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        if (mouseRef.current.active) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONFIG.mouseDist) {
            const force = (CONFIG.mouseDist - dist) / CONFIG.mouseDist;
            p.x += dx * force * 0.04;
            p.y += dy * force * 0.04;
          }
        }
      });

      // 2. DRAW CONNECTIONS
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONFIG.connectionDist) {
            const alpha = 1 - (dist / CONFIG.connectionDist);
            
            let isNearMouse = false;
            if (mouseRef.current.active) {
               const mouseDx = mouseRef.current.x - p1.x;
               const mouseDy = mouseRef.current.y - p1.y;
               if (Math.sqrt(mouseDx*mouseDx + mouseDy*mouseDy) < CONFIG.mouseDist) isNearMouse = true;
            }

            ctx.beginPath();
            if (isNearMouse) {
                ctx.strokeStyle = `rgba(${CONFIG.colorActive}, ${alpha * 0.6})`; // Mais visível no hover
                ctx.lineWidth = 1.2;
            } else {
                ctx.strokeStyle = `rgba(${CONFIG.colorNode}, ${alpha * 0.25})`; // MUITO mais visível em idle (era 0.15)
                ctx.lineWidth = 0.8;
            }
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Mais sinais neurais viajando
            if (Math.random() < 0.001) { 
               signals.push({
                   startNodeIndex: i,
                   endNodeIndex: j,
                   progress: 0,
                   speed: 0.015 + Math.random() * 0.02
               });
            }
          }
        }
      }

      // 3. DRAW SIGNALS
      for (let i = signals.length - 1; i >= 0; i--) {
         const sig = signals[i];
         sig.progress += sig.speed;
         
         if (sig.progress >= 1) {
            signals.splice(i, 1);
            continue;
         }

         const pStart = particles[sig.startNodeIndex];
         const pEnd = particles[sig.endNodeIndex];
         
         if (Math.sqrt(Math.pow(pStart.x - pEnd.x, 2) + Math.pow(pStart.y - pEnd.y, 2)) > CONFIG.connectionDist) {
             signals.splice(i, 1);
             continue;
         }

         const curX = pStart.x + (pEnd.x - pStart.x) * sig.progress;
         const curY = pStart.y + (pEnd.y - pStart.y) * sig.progress;

         ctx.beginPath();
         ctx.arc(curX, curY, 2.5, 0, Math.PI * 2); // Sinal maior (2.5px)
         ctx.fillStyle = `rgb(${CONFIG.colorSignal})`;
         ctx.shadowBlur = 10;
         ctx.shadowColor = `rgb(${CONFIG.colorSignal})`;
         ctx.fill();
         ctx.shadowBlur = 0;
      }

      // 4. DRAW NODES
      particles.forEach((p) => {
        const breathe = Math.sin(p.pulsePhase) * 0.3 + 1; 
        const actualSize = p.size * breathe;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, actualSize, 0, Math.PI * 2);
        
        let isNearMouse = false;
        if (mouseRef.current.active) {
            const dx = mouseRef.current.x - p.x;
            const dy = mouseRef.current.y - p.y;
            if (Math.sqrt(dx*dx + dy*dy) < CONFIG.mouseDist) isNearMouse = true;
        }

        if (isNearMouse) {
            ctx.fillStyle = `rgba(${CONFIG.colorActive}, 0.9)`;
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(${CONFIG.colorActive}, 0.5)`;
        } else {
            // Nó idle muito mais visível
            ctx.fillStyle = `rgba(${CONFIG.colorNode}, 0.5)`; 
            ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => init();
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    init();
    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full pointer-events-none" />;
};

export const AmbientBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#020617]">
      {/* 1. Deep Ocean Image Base */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 z-0"
      >
        <img 
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop" 
          className="w-full h-full object-cover opacity-40 grayscale-[20%] mix-blend-luminosity" 
          alt="Neural Texture"
        />
      </motion.div>

      {/* 2. Neural Canvas - REMOVIDA opacidade do container e mix-blend para máxima visibilidade */}
      <div className="absolute inset-0 z-10">
        <NeuralCanvas />
      </div>

      {/* 3. Vignette (Mantida suave nas bordas para foco no centro) */}
      <div className="absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,_transparent_40%,_#020617_100%)] opacity-90 pointer-events-none" />

      {/* 4. Film Grain */}
      <div className="absolute inset-0 z-30 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }} 
      />
    </div>
  );
};
