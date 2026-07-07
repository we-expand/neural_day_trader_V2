import { Strategy, StrategyBlock } from '../types/strategy';

let blockCounter = 0;
function block(partial: Omit<StrategyBlock, 'id' | 'enabled'>): StrategyBlock {
  blockCounter += 1;
  return { ...partial, id: `preset-block-${blockCounter}`, enabled: true };
}

const baseDefaults = {
  isPreset: true as const,
  direction: 'AUTO' as const,
  trailingStop: true,
  riskProfile: 'MODERATE' as const,
  positionSizePercent: 2,
  timeframe: '15m' as const,
  maxConcurrentTrades: 3,
};

/**
 * As 6 estratégias que já existiam como nome+descrição decorativos em
 * BacktestConfigModal.tsx ganham aqui regras reais equivalentes ao que o nome
 * descreve — cada bloco é avaliado por StrategyEvaluator.ts sobre indicadores
 * reais (TechnicalIndicators.ts), tanto no Backtest quanto (depois) na IA ao vivo.
 */
export const PRESET_STRATEGIES: Strategy[] = [
  {
    ...baseDefaults,
    id: '1',
    name: 'Rompimento',
    description: 'Estratégia de rompimento de suporte/resistência (Bollinger Bands + volume)',
    stopLoss: 120,
    takeProfit: 400,
    entryBlocks: [
      block({ type: 'ENTRY', category: 'volatility', indicator: 'PRICE', period: 20, operator: 'CROSS_ABOVE', compareIndicator: 'BB_UPPER', comparePeriod: 20, label: 'Preço rompe banda superior de Bollinger' }),
      block({ type: 'ENTRY', category: 'volume', indicator: 'OBV', operator: 'RISING', label: 'OBV em alta (confirma volume no rompimento)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'volatility', indicator: 'PRICE', period: 20, operator: 'CROSS_BELOW', compareIndicator: 'BB_UPPER', comparePeriod: 20, label: 'Preço volta pra dentro da banda' }),
    ],
    filterBlocks: [
      block({ type: 'FILTER', category: 'trend', indicator: 'ADX', period: 14, operator: 'ABOVE', value: 20, label: 'ADX > 20 (mercado com tendência, não lateral)' }),
    ],
  },
  {
    ...baseDefaults,
    id: '2',
    name: 'TDSM_98',
    description: 'Tendência + RSI divergência (EMA 50/200 + RSI)',
    stopLoss: 150,
    takeProfit: 450,
    entryBlocks: [
      block({ type: 'ENTRY', category: 'trend', indicator: 'EMA', period: 50, operator: 'CROSS_ABOVE', compareIndicator: 'EMA', comparePeriod: 200, label: 'EMA50 cruza acima da EMA200 (golden cross)' }),
      block({ type: 'ENTRY', category: 'momentum', indicator: 'RSI', period: 14, operator: 'ABOVE', value: 50, label: 'RSI > 50 (momentum a favor da tendência)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'trend', indicator: 'EMA', period: 50, operator: 'CROSS_BELOW', compareIndicator: 'EMA', comparePeriod: 200, label: 'EMA50 cruza abaixo da EMA200 (death cross)' }),
      block({ type: 'EXIT', category: 'momentum', indicator: 'RSI', period: 14, operator: 'ABOVE', value: 70, label: 'RSI > 70 (sobrecompra, realiza lucro)' }),
    ],
    filterBlocks: [],
  },
  {
    ...baseDefaults,
    id: '3',
    name: 'Indicador de Retrocessos',
    description: 'Retração/pullback com EMA + estocástico',
    stopLoss: 100,
    takeProfit: 300,
    entryBlocks: [
      block({ type: 'ENTRY', category: 'trend', indicator: 'EMA', period: 21, operator: 'ABOVE', compareIndicator: 'EMA', comparePeriod: 55, label: 'EMA21 acima da EMA55 (tendência de alta)' }),
      block({ type: 'ENTRY', category: 'momentum', indicator: 'STOCH', period: 14, operator: 'CROSS_ABOVE', value: 20, label: 'Estocástico cruza acima de 20 (saída de sobrevenda = fim do retrocesso)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'momentum', indicator: 'STOCH', period: 14, operator: 'ABOVE', value: 80, label: 'Estocástico > 80 (sobrecompra)' }),
    ],
    filterBlocks: [],
  },
  {
    ...baseDefaults,
    id: '4',
    name: 'False Breaktroughs',
    description: 'Detecção de falso rompimento (reversão em extremos de Bollinger + RSI)',
    stopLoss: 90,
    takeProfit: 200,
    entryBlocks: [
      block({ type: 'ENTRY', category: 'volatility', indicator: 'PRICE', period: 20, operator: 'CROSS_ABOVE', compareIndicator: 'BB_LOWER', comparePeriod: 20, label: 'Preço reentra na banda após romper a inferior (falso rompimento revertendo)' }),
      block({ type: 'ENTRY', category: 'momentum', indicator: 'RSI', period: 14, operator: 'BELOW', value: 40, label: 'RSI ainda baixo (sobrevenda recente, reversão provável)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'momentum', indicator: 'RSI', period: 14, operator: 'ABOVE', value: 50, label: 'RSI volta pra cima de 50 (reversão concluída)' }),
    ],
    filterBlocks: [
      block({ type: 'FILTER', category: 'trend', indicator: 'ADX', period: 14, operator: 'BELOW', value: 25, label: 'ADX < 25 (mercado lateral, propenso a falso rompimento)' }),
    ],
  },
  {
    ...baseDefaults,
    id: '5',
    name: 'AA PURE BREAK',
    description: 'Breakout puro por ATR + preço em máxima/mínima recente',
    stopLoss: 130,
    takeProfit: 500,
    entryBlocks: [
      block({ type: 'ENTRY', category: 'volatility', indicator: 'ATR', period: 14, operator: 'RISING', label: 'ATR em expansão (volatilidade aumentando)' }),
      block({ type: 'ENTRY', category: 'momentum', indicator: 'CCI', period: 20, operator: 'ABOVE', value: 100, label: 'CCI > 100 (força de rompimento)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'momentum', indicator: 'CCI', period: 20, operator: 'BELOW', value: 0, label: 'CCI volta abaixo de 0 (perda de força)' }),
    ],
    filterBlocks: [],
  },
  {
    ...baseDefaults,
    id: '6',
    name: 'WIKIOSKIT EXECUTION',
    description: 'Execução baseada em volume (VWAP + OBV)',
    stopLoss: 80,
    takeProfit: 240,
    timeframe: '5m',
    entryBlocks: [
      block({ type: 'ENTRY', category: 'volume', indicator: 'PRICE', operator: 'CROSS_ABOVE', compareIndicator: 'VWAP', label: 'Preço cruza acima do VWAP' }),
      block({ type: 'ENTRY', category: 'volume', indicator: 'OBV', operator: 'RISING', label: 'OBV confirmando volume comprador' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'volume', indicator: 'PRICE', operator: 'CROSS_BELOW', compareIndicator: 'VWAP', label: 'Preço cruza abaixo do VWAP' }),
    ],
    filterBlocks: [],
  },
];

export function getPresetStrategyById(id: string): Strategy | undefined {
  return PRESET_STRATEGIES.find(s => s.id === id);
}
