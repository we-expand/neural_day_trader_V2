/**
 * 💰 ESPECIFICAÇÕES DE CONTRATO - VALORES REAIS DE TICK/PONTO
 * 
 * Define quanto vale cada movimento de preço para cada ativo
 * Baseado em especificações reais de contratos de mercado
 * 
 * CONCEITO:
 * - Tick Size: Menor incremento de preço possível (ex: 0.00001 para EURUSD)
 * - Tick Value: Valor monetário de 1 tick (ex: $0.10 para EURUSD mini lote)
 * - Point Value: Valor de 1 ponto de movimento (ex: $10 para 1 lote padrão de EURUSD)
 * 
 * FÓRMULA DE P&L:
 * pontos_movidos = (preço_saída - preço_entrada) / tick_size
 * valor_bruto = pontos_movidos * tick_value * quantidade_contratos
 * pnl_final = valor_bruto * direção (1 para LONG, -1 para SHORT)
 * 
 * 🏦 INFINOX BROKER: Inclui especificações para 300+ ativos
 */

import { INFINOX_CONTRACT_SPECS } from './infinoxContractSpecs';

export interface ContractSpec {
  symbol: string;
  category: 'FOREX' | 'CRYPTO' | 'INDICES' | 'COMMODITIES' | 'METALS' | 'ENERGY' | 'STOCKS_BR' | 'STOCKS_US' | 'STOCKS_UK' | 'STOCKS_EU' | 'BONDS' | 'FUTURES';
  tickSize: number;          // Menor movimento de preço (ex: 0.00001 para EUR/USD)
  tickValue: number;         // Valor de 1 tick em USD (ou moeda base)
  pointValue: number;        // Valor de 1 ponto inteiro em USD
  contractSize: number;      // Tamanho do contrato (ex: 100000 para lote padrão de Forex)
  currency: string;          // Moeda de cotação
  minLotSize: number;        // Tamanho mínimo de lote
  description: string;       // Descrição do ativo
}

/**
 * 📊 TABELA COMPLETA DE ESPECIFICAÇÕES POR ATIVO
 * Valores baseados em contratos padrão de mercado + Especificações Infinox
 */
export const CONTRACT_SPECS: Record<string, ContractSpec> = INFINOX_CONTRACT_SPECS as Record<string, ContractSpec>;

/**
 * ✅ OBTER ESPECIFICAÇÃO DE CONTRATO
 * @param symbol - Símbolo do ativo
 * @returns ContractSpec ou especificação padrão se não encontrado
 */
export function getContractSpec(symbol: string): ContractSpec {
  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Busca exata
  if (CONTRACT_SPECS[normalizedSymbol]) {
    return CONTRACT_SPECS[normalizedSymbol];
  }
  
  // Busca fuzzy (por conter)
  const fuzzyMatch = Object.keys(CONTRACT_SPECS).find(key => 
    normalizedSymbol.includes(key) || key.includes(normalizedSymbol)
  );
  
  if (fuzzyMatch) {
    return CONTRACT_SPECS[fuzzyMatch];
  }
  
  // Padrão genérico para ativos não mapeados
  console.warn(`⚠️ Especificação de contrato não encontrada para ${symbol}. Usando padrão genérico.`);
  return {
    symbol: normalizedSymbol,
    category: 'FOREX',
    tickSize: 0.00001,
    tickValue: 0.01,
    pointValue: 1,
    contractSize: 1,
    currency: 'USD',
    minLotSize: 0.01,
    description: 'Ativo Genérico'
  };
}

/**
 * 💰 CALCULAR P&L REALISTA
 * @param symbol - Símbolo do ativo
 * @param entryPrice - Preço de entrada
 * @param exitPrice - Preço de saída (ou atual)
 * @param side - 'LONG' ou 'SHORT'
 * @param lotSize - Tamanho da posição em lotes
 * @returns Lucro/Prejuízo em USD (ou moeda do contrato)
 */
export function calculateRealisticPnL(
  symbol: string,
  entryPrice: number,
  exitPrice: number,
  side: 'LONG' | 'SHORT',
  lotSize: number
): number {
  const spec = getContractSpec(symbol);
  
  // Calcular diferença de preço
  const priceDiff = exitPrice - entryPrice;
  
  // Ajustar direção (LONG lucra com alta, SHORT lucra com queda)
  const directionMultiplier = side === 'LONG' ? 1 : -1;
  
  // Calcular pontos movidos
  const pointsMoved = priceDiff / spec.tickSize;
  
  // Calcular valor bruto do movimento
  const grossValue = pointsMoved * spec.tickValue * lotSize;
  
  // Aplicar direção
  const pnl = grossValue * directionMultiplier;
  
  return pnl;
}

/**
 * 💵 CALCULAR P&L COM LEVERAGE
 * @param symbol - Símbolo do ativo
 * @param entryPrice - Preço de entrada
 * @param exitPrice - Preço de saída (ou atual)
 * @param side - 'LONG' ou 'SHORT'
 * @param marginAmount - Capital investido (sem leverage)
 * @param leverage - Alavancagem aplicada
 * @returns Lucro/Prejuízo em USD
 */
export function calculatePnLWithLeverage(
  symbol: string,
  entryPrice: number,
  exitPrice: number,
  side: 'LONG' | 'SHORT',
  marginAmount: number,
  leverage: number
): number {
  // ✅ CORREÇÃO CRÍTICA: Incluir contractSize no cálculo de effectiveSize
  // ANTES: const effectiveSize = (marginAmount * leverage) / entryPrice; (INCORRETO - gera P&L 100,000x maior)
  // AGORA: Divide também pelo contractSize para converter para lotes padrão
  const spec = getContractSpec(symbol);
  const effectiveSize = (marginAmount * leverage) / (entryPrice * spec.contractSize);
  
  // Usar a função de P&L realista
  return calculateRealisticPnL(symbol, entryPrice, exitPrice, side, effectiveSize);
}

/**
 * 📊 OBTER INFORMAÇÕES COMPLETAS DO CONTRATO
 * @param symbol - Símbolo do ativo
 * @returns Objeto com todas as informações do contrato
 */
export function getContractInfo(symbol: string) {
  const spec = getContractSpec(symbol);
  
  return {
    ...spec,
    pipValueFormatted: `$${spec.pointValue.toFixed(2)}`,
    categoryFormatted: {
      'FOREX': 'Câmbio',
      'CRYPTO': 'Criptomoeda',
      'INDICES': 'Índice',
      'COMMODITIES': 'Commodity Agrícola',
      'METALS': 'Metal Precioso',
      'ENERGY': 'Energia',
      'STOCKS_BR': 'Ação Brasileira',
      'STOCKS_US': 'Ação Americana',
      'STOCKS_UK': 'Ação Britânica',
      'STOCKS_EU': 'Ação Europeia',
      'BONDS': 'Título Público',
      'FUTURES': 'Contrato Futuro'
    }[spec.category],
    contractSizeFormatted: spec.category === 'FOREX' 
      ? `${(spec.contractSize / 1000).toFixed(0)}k unidades`
      : `${spec.contractSize} unidades`,
  };
}

/**
 * 🎯 CALCULAR MARGEM NECESSÁRIA
 * @param symbol - Símbolo do ativo
 * @param price - Preço atual
 * @param lotSize - Tamanho em lotes
 * @param leverage - Alavancagem
 * @returns Margem necessária em USD
 */
export function calculateRequiredMargin(
  symbol: string,
  price: number,
  lotSize: number,
  leverage: number
): number {
  const spec = getContractSpec(symbol);
  
  // Valor notional da posição
  const notionalValue = price * spec.contractSize * lotSize;
  
  // Margem = Valor Notional / Leverage
  const margin = notionalValue / leverage;
  
  return margin;
}

/**
 * 💡 EXEMPLO DE USO
 * 
 * // Operação em EUR/USD
 * const pnl = calculateRealisticPnL('EURUSD', 1.0850, 1.0950, 'LONG', 1.0);
 * // Resultado: $1000 (100 pips × $10 por pip × 1 lote)
 * 
 * // Operação em BTC/USDT
 * const btcPnl = calculateRealisticPnL('BTCUSDT', 50000, 51000, 'LONG', 0.1);
 * // Resultado: $100 (1000 pontos × $0.01 × 0.1 BTC)
 * 
 * // Operação em Mini Índice (WIN)
 * const winPnl = calculateRealisticPnL('WIN', 125000, 125500, 'LONG', 1);
 * // Resultado: R$ 100 (500 pontos × R$ 0.20 × 1 contrato)
 */