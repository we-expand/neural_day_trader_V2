import React from 'react';
import { useSmartScroll, type SmartScrollOptions } from '@/app/hooks/useSmartScroll';

interface SmartScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  smartScrollOptions?: SmartScrollOptions;
  /**
   * Direção do scroll
   * @default 'vertical'
   */
  scrollDirection?: 'vertical' | 'horizontal' | 'both';
}

/**
 * 🎯 SMART SCROLL CONTAINER
 * 
 * Container inteligente com scroll que:
 * 1. Esconde o scrollbar por padrão
 * 2. Mostra brevemente ao mover o mouse (hint educativo)
 * 3. Aparece quando o mouse está próximo da área do scroll
 * 4. Esconde quando o mouse sai
 * 
 * @example
 * ```tsx
 * <SmartScrollContainer className="h-64">
 *   <div>Conteúdo com scroll...</div>
 * </SmartScrollContainer>
 * ```
 */
export const SmartScrollContainer: React.FC<SmartScrollContainerProps> = ({
  children,
  smartScrollOptions,
  scrollDirection = 'vertical',
  className = '',
  ...props
}) => {
  const { containerRef, scrollbarClassName, isPulse } = useSmartScroll(smartScrollOptions);

  const scrollDirectionClass = 
    scrollDirection === 'vertical' ? 'overflow-y-auto overflow-x-hidden' :
    scrollDirection === 'horizontal' ? 'overflow-x-auto overflow-y-hidden' :
    'overflow-auto';

  // Combinar className com pulse se necessário
  const pulseClass = isPulse ? 'smart-scroll-pulse' : '';

  return (
    <div
      ref={containerRef}
      className={`smart-scroll-container ${scrollDirectionClass} ${scrollbarClassName} ${pulseClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};