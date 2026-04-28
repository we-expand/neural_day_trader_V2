/**
 * 📊 LOGGER DE P&L REALISTA
 * 
 * Utilitário para logar cálculos de P&L com detalhes sobre as especificações de contrato
 * Útil para debugging e transparência no sistema
 */

import { getContractSpec } from '@/config/contractSpecs';

export interface PnLLogDetails {
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  side: 'LONG' | 'SHORT';
  marginAmount: number;
  leverage: number;
  pnlValue: number;
  timestamp?: number;
}

/**
 * 📝 Logar cálculo de P&L detalhado
 */
export function logPnLCalculation(details: PnLLogDetails, enableLog = false) {
  if (!enableLog) return;

  const spec = getContractSpec(details.symbol);
  const priceDiff = details.exitPrice - details.entryPrice;
  const pointsMoved = Math.abs(priceDiff / spec.tickSize);
  const effectiveSize = (details.marginAmount * details.leverage) / details.entryPrice;

  console.group(`💰 P&L Calculation: ${details.symbol} ${details.side}`);
  console.log('📌 Contract Specs:', {
    category: spec.category,
    tickSize: spec.tickSize,
    tickValue: spec.tickValue,
    pointValue: spec.pointValue,
    contractSize: spec.contractSize,
    currency: spec.currency
  });
  console.log('📊 Trade Details:', {
    entryPrice: details.entryPrice.toFixed(5),
    exitPrice: details.exitPrice.toFixed(5),
    priceDiff: priceDiff.toFixed(5),
    pointsMoved: pointsMoved.toFixed(0),
    side: details.side,
    marginAmount: details.marginAmount.toFixed(2),
    leverage: details.leverage,
    effectiveSize: effectiveSize.toFixed(3)
  });
  console.log('💵 Result:', {
    pnlValue: details.pnlValue.toFixed(2),
    pnlFormatted: `${details.pnlValue >= 0 ? '+' : ''}${spec.currency} ${details.pnlValue.toFixed(2)}`,
    roi: ((details.pnlValue / details.marginAmount) * 100).toFixed(2) + '%'
  });
  console.groupEnd();
}

/**
 * 📊 Criar resumo de P&L para múltiplas operações
 */
export function createPnLSummary(operations: PnLLogDetails[]) {
  const totalPnL = operations.reduce((sum, op) => sum + op.pnlValue, 0);
  const totalMargin = operations.reduce((sum, op) => sum + op.marginAmount, 0);
  const wins = operations.filter(op => op.pnlValue > 0).length;
  const losses = operations.filter(op => op.pnlValue < 0).length;
  const winRate = operations.length > 0 ? (wins / operations.length) * 100 : 0;

  return {
    totalOperations: operations.length,
    totalWins: wins,
    totalLosses: losses,
    winRate: winRate.toFixed(2) + '%',
    totalPnL: totalPnL.toFixed(2),
    totalMargin: totalMargin.toFixed(2),
    avgPnL: (totalPnL / operations.length).toFixed(2),
    roi: ((totalPnL / totalMargin) * 100).toFixed(2) + '%',
    profitFactor: calculateProfitFactor(operations)
  };
}

/**
 * 📈 Calcular Profit Factor
 */
function calculateProfitFactor(operations: PnLLogDetails[]): string {
  const grossProfit = operations
    .filter(op => op.pnlValue > 0)
    .reduce((sum, op) => sum + op.pnlValue, 0);
  
  const grossLoss = Math.abs(
    operations
      .filter(op => op.pnlValue < 0)
      .reduce((sum, op) => sum + op.pnlValue, 0)
  );

  if (grossLoss === 0) return grossProfit > 0 ? '∞' : '0';
  
  return (grossProfit / grossLoss).toFixed(2);
}

/**
 * 🎯 Validar se o P&L calculado está dentro de limites razoáveis
 */
export function validatePnL(pnlValue: number, marginAmount: number, leverage: number): {
  isValid: boolean;
  warning?: string;
} {
  const maxReasonableReturn = marginAmount * leverage * 2; // 200% do capital alavancado
  const maxReasonableLoss = -marginAmount * leverage; // 100% do capital alavancado (margem call)

  if (pnlValue > maxReasonableReturn) {
    return {
      isValid: false,
      warning: `⚠️ P&L suspeito: ${pnlValue.toFixed(2)} excede retorno razoável de ${maxReasonableReturn.toFixed(2)}`
    };
  }

  if (pnlValue < maxReasonableLoss) {
    return {
      isValid: false,
      warning: `⚠️ P&L suspeito: ${pnlValue.toFixed(2)} excede perda razoável de ${maxReasonableLoss.toFixed(2)}`
    };
  }

  return { isValid: true };
}

/**
 * 📋 Gerar relatório de P&L formatado
 */
export function generatePnLReport(operations: PnLLogDetails[]): string {
  const summary = createPnLSummary(operations);
  
  let report = '📊 RELATÓRIO DE P&L - VALORES REALISTAS\n';
  report += '━'.repeat(50) + '\n\n';
  
  report += `Total de Operações: ${summary.totalOperations}\n`;
  report += `Ganhos: ${summary.totalWins} | Perdas: ${summary.totalLosses}\n`;
  report += `Win Rate: ${summary.winRate}\n`;
  report += `Profit Factor: ${summary.profitFactor}\n\n`;
  
  report += `Total Investido: $${summary.totalMargin}\n`;
  report += `P&L Total: $${summary.totalPnL}\n`;
  report += `P&L Médio: $${summary.avgPnL}\n`;
  report += `ROI: ${summary.roi}\n\n`;
  
  report += '━'.repeat(50) + '\n';
  report += 'DETALHAMENTO POR OPERAÇÃO:\n\n';
  
  operations.forEach((op, index) => {
    const spec = getContractSpec(op.symbol);
    const roi = ((op.pnlValue / op.marginAmount) * 100).toFixed(2);
    
    report += `${index + 1}. ${op.symbol} ${op.side}\n`;
    report += `   Entrada: ${op.entryPrice.toFixed(5)} → Saída: ${op.exitPrice.toFixed(5)}\n`;
    report += `   Capital: $${op.marginAmount.toFixed(2)} (${op.leverage}x leverage)\n`;
    report += `   P&L: ${spec.currency} ${op.pnlValue.toFixed(2)} (ROI: ${roi}%)\n\n`;
  });
  
  return report;
}
