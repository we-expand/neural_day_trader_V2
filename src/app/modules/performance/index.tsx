/**
 * 📊 PERFORMANCE MODULE
 * 
 * Módulo independente para análise de performance de trading
 * Completamente isolado para fácil manutenção e correção de bugs
 * 
 * Estrutura:
 * - PerformanceView.tsx - Componente principal (wrapper)
 * - components/ - Subcomponentes isolados
 * - types.ts - Tipos TypeScript
 * - utils.ts - Funções auxiliares
 * 
 * Logs prefixados: [PERFORMANCE]
 */

export { PerformanceView } from './PerformanceView';
export type { PerformanceMetrics, TradeHistory } from './types';
