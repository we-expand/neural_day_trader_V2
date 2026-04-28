/**
 * 🤖 AI TRADER MODULE - BARREL EXPORT
 * 
 * Exporta todos os componentes do módulo AI Trader
 * Permite importações limpas em outros arquivos
 * 
 * Uso:
 * import { AITraderView } from '@/app/modules/ai-trader';
 */

// Components
export { AITraderView } from './components/AITraderView';
export type { AITraderViewProps } from './components/AITraderView';

// Re-export do componente original para compatibilidade
export { AITrader } from '@/app/components/AITrader';
