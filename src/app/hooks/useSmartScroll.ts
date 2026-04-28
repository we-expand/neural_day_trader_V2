import { useEffect, useRef, useState } from 'react';

export interface SmartScrollOptions {
  /**
   * Tempo em ms que o scroll fica visível após movimento do mouse
   * @default 1500
   */
  hintDuration?: number;
  
  /**
   * Distância em pixels da borda do scroll para ativar a visibilidade
   * @default 30
   */
  proximityThreshold?: number;
  
  /**
   * Tempo de transição do fade in/out em ms
   * @default 300
   */
  transitionDuration?: number;
  
  /**
   * Se deve mostrar hint na primeira montagem
   * @default true
   */
  showInitialHint?: boolean;

  /**
   * Tempo de espera em ms antes de esconder scroll após parar de scrollar
   * @default 1000
   */
  scrollHideDelay?: number;
}

export const useSmartScroll = (options: SmartScrollOptions = {}) => {
  const {
    hintDuration = 1500,
    proximityThreshold = 30,
    transitionDuration = 300,
    showInitialHint = true,
    scrollHideDelay = 1000
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrollVisible, setIsScrollVisible] = useState(false);
  const [isPulse, setIsPulse] = useState(false); // Para animação de pulse inicial
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMouseMoveRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 🎯 MOSTRAR HINT INICIAL ao montar (educar usuário com pulse)
    if (showInitialHint) {
      setIsScrollVisible(true);
      setIsPulse(true); // Ativar animação de pulse
      
      hintTimeoutRef.current = setTimeout(() => {
        setIsPulse(false); // Desativar pulse após o hint
        setIsScrollVisible(false);
      }, hintDuration);
    }

    // 🎯 DETECTAR MOVIMENTO DO MOUSE (mostrar hint temporário)
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Verificar se o mouse está dentro do container
      const isInsideContainer = 
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom;

      if (!isInsideContainer) {
        lastMouseMoveRef.current = null;
        return;
      }

      // Detectar movimento significativo
      if (lastMouseMoveRef.current) {
        const deltaX = Math.abs(mouseX - lastMouseMoveRef.current.x);
        const deltaY = Math.abs(mouseY - lastMouseMoveRef.current.y);

        // Se houve movimento significativo (> 5px), mostrar hint
        if (deltaX > 5 || deltaY > 5) {
          setIsScrollVisible(true);

          // Limpar timeout anterior
          if (hintTimeoutRef.current) {
            clearTimeout(hintTimeoutRef.current);
          }

          // Esconder após o tempo de hint
          hintTimeoutRef.current = setTimeout(() => {
            // Só esconder se não estiver próximo do scroll
            const distanceToEdge = rect.right - mouseX;
            if (distanceToEdge > proximityThreshold) {
              setIsScrollVisible(false);
            }
          }, hintDuration);
        }
      }

      lastMouseMoveRef.current = { x: mouseX, y: mouseY };

      // 🎯 DETECTAR PROXIMIDADE DO SCROLL (vertical - lado direito)
      const distanceToRightEdge = rect.right - mouseX;
      const distanceToBottomEdge = rect.bottom - mouseY;

      // Verificar se tem scroll vertical
      const hasVerticalScroll = container.scrollHeight > container.clientHeight;
      const hasHorizontalScroll = container.scrollWidth > container.clientWidth;

      // Mostrar se estiver próximo da área do scroll
      if (hasVerticalScroll && distanceToRightEdge <= proximityThreshold) {
        setIsScrollVisible(true);
        
        // Limpar timeout de hint se existir
        if (hintTimeoutRef.current) {
          clearTimeout(hintTimeoutRef.current);
          hintTimeoutRef.current = null;
        }
      } else if (hasHorizontalScroll && distanceToBottomEdge <= proximityThreshold) {
        setIsScrollVisible(true);
        
        if (hintTimeoutRef.current) {
          clearTimeout(hintTimeoutRef.current);
          hintTimeoutRef.current = null;
        }
      } else if (!hintTimeoutRef.current) {
        // Se não está próximo e não há timeout de hint ativo, esconder
        setIsScrollVisible(false);
      }
    };

    // 🎯 DETECTAR MOUSE LEAVE (esconder scroll)
    const handleMouseLeave = () => {
      lastMouseMoveRef.current = null;
      
      // Limpar timeout se existir
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
      
      setIsScrollVisible(false);
    };

    // 🎯 DETECTAR SCROLL (mostrar enquanto scrolla)
    const handleScroll = () => {
      setIsScrollVisible(true);

      // Limpar timeout anterior
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }

      // Esconder após parar de scrollar
      hintTimeoutRef.current = setTimeout(() => {
        setIsScrollVisible(false);
      }, scrollHideDelay);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('scroll', handleScroll);
      
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
    };
  }, [hintDuration, proximityThreshold, showInitialHint, scrollHideDelay]);

  return {
    containerRef,
    isScrollVisible,
    isPulse,
    scrollbarClassName: isScrollVisible ? 'smart-scroll-visible' : 'smart-scroll-hidden'
  };
};