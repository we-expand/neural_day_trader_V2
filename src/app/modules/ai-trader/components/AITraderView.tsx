/**
 * 🤖 AI TRADER VIEW
 * 
 * Componente wrapper para o AI Trader completo
 * Importa e renderiza o AITrader.tsx existente
 * 
 * Este módulo serve como ponto de entrada organizado
 * para o sistema de trading automatizado.
 */

import React from 'react';
import { AITrader } from '@/app/components/AITrader';

/**
 * Logs prefixados para debug
 */
const log = {
  info: (...args: any[]) => console.log('[AI_TRADER] 🤖', ...args),
  error: (...args: any[]) => console.error('[AI_TRADER] ❌', ...args),
  success: (...args: any[]) => console.log('[AI_TRADER] ✅', ...args),
  debug: (...args: any[]) => console.log('[AI_TRADER] 🔍', ...args)
};

/**
 * Props do AITraderView
 */
interface AITraderViewProps {
  /**
   * Modo compacto (apenas monitor)
   * @default false
   */
  compact?: boolean;
}

/**
 * AITraderView Component
 * 
 * Wrapper principal para o AI Trader
 * 
 * @example
 * ```tsx
 * // Modo completo
 * <AITraderView />
 * 
 * // Modo compacto (Dashboard)
 * <AITraderView compact={true} />
 * ```
 */
export function AITraderView({ compact = false }: AITraderViewProps) {
  React.useEffect(() => {
    log.info('AI Trader carregado', { compact });
  }, [compact]);

  return (
    <div className="ai-trader-module">
      <AITrader compact={compact} />
    </div>
  );
}

/**
 * Exports adicionais para facilitar uso
 */
export type { AITraderViewProps };
