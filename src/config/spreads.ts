/**
 * 📊 CONFIGURAÇÃO DE SPREADS REALISTAS
 * 
 * Spreads em pips para cada símbolo
 * Aplicados apenas em modo DEMO para simular custos reais de operação
 * Modo LIVE usa spreads reais do broker
 */

export interface SpreadConfig {
  symbol: string;
  spread: number; // em pips
}

/**
 * Tabela de spreads por símbolo
 * Valores fornecidos pela corretora
 */
export const SPREADS: Record<string, number> = {
  // Majors
  'EURUSD': 0.3,
  'GBPUSD': 0.4,
  'USDJPY': 0.4,
  'USDCHF': 0.4,
  'AUDUSD': 0.3,
  'USDCAD': 0.5,
  'NZDUSD': 0.3,
  
  // Cross Currencies
  'EURJPY': 0.4,
  'EURGBP': 0.3,
  'EURCHF': 0.9,
  'EURAUD': 0.5,
  'EURCAD': 1.2,
  'EURNZD': 2.5,
  'GBPJPY': 0.4,
  'GBPCHF': 0.6,
  'GBPAUD': 0.6,
  'GBPCAD': 0.6,
  'GBPNZD': 2.3,
  'AUDJPY': 0.3,
  'AUDCAD': 0.7,
  'AUDCHF': 0.5,
  'AUDNZD': 0.5,
  'CADJPY': 0.9,
  'CADCHF': 0.2,
  'CHFJPY': 0.5,
  'NZDCHF': 0.6,
  
  // Metals
  'XAUUSD': 1.8,
  'XAGUSD': 0.8,
  'XAUEUR': 1.8,
  
  // Exotics - Scandinavian
  'EURSEK': 10.0,
  'EURNOK': 9.8,
  'USDSEK': 13.6,
  'USDNOK': 7.3,
  
  // Exotics - Latin America
  'USDMXN': 9.6,
  'EURMXN': 85.7,
  
  // Exotics - Eastern Europe
  'EURHUF': 23.5,
  'USDHUF': 19.7,
  
  // Exotics - Emerging Markets
  'USDZAR': 59.4,
  'EURZAR': 61.3,
  'USDHKD': 15.3,
  'USDRUB': 1.4,
  'USDTRY': 46.0,
  'EURTRY': 54.2,
};

/**
 * Obter spread para um símbolo
 * @param symbol - Símbolo do ativo (ex: EURUSD)
 * @returns Spread em pips (0 se não encontrado)
 */
export function getSpread(symbol: string): number {
  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z]/g, '');
  return SPREADS[normalizedSymbol] || 0;
}

/**
 * Converter pips para valor decimal baseado no símbolo
 * @param symbol - Símbolo do ativo
 * @param pips - Quantidade de pips
 * @returns Valor decimal
 */
export function pipsToDecimal(symbol: string, pips: number): number {
  const normalizedSymbol = symbol.toUpperCase();
  
  // JPY pairs têm 2 casas decimais (1 pip = 0.01)
  if (normalizedSymbol.includes('JPY')) {
    return pips * 0.01;
  }
  
  // HUF, SEK, NOK também têm precisão diferente
  if (normalizedSymbol.includes('HUF') || 
      normalizedSymbol.includes('SEK') || 
      normalizedSymbol.includes('NOK')) {
    return pips * 0.01;
  }
  
  // Maioria dos pares têm 4 casas decimais (1 pip = 0.0001)
  return pips * 0.0001;
}

/**
 * Aplicar spread ao preço baseado no lado da operação
 * @param price - Preço base
 * @param symbol - Símbolo do ativo
 * @param side - 'BUY' ou 'SELL'
 * @returns Preço com spread aplicado
 */
export function applySpread(price: number, symbol: string, side: 'BUY' | 'SELL'): number {
  const spreadPips = getSpread(symbol);
  const spreadValue = pipsToDecimal(symbol, spreadPips);
  
  // BUY: preço de entrada mais alto (ask)
  // SELL: preço de entrada mais baixo (bid)
  if (side === 'BUY') {
    return price + (spreadValue / 2);
  } else {
    return price - (spreadValue / 2);
  }
}

/**
 * Calcular custo do spread para uma operação
 * @param symbol - Símbolo do ativo
 * @param lots - Tamanho da posição em lotes
 * @returns Custo do spread em USD
 */
export function calculateSpreadCost(symbol: string, lots: number): number {
  const spreadPips = getSpread(symbol);
  const normalizedSymbol = symbol.toUpperCase();
  
  // Valor de 1 pip para 1 lote padrão
  let pipValue = 10; // USD por pip (padrão para majors)
  
  // JPY pairs
  if (normalizedSymbol.includes('JPY')) {
    pipValue = 10;
  }
  
  // XAU/XAG (metais)
  if (normalizedSymbol.includes('XAU')) {
    pipValue = 10;
  }
  if (normalizedSymbol.includes('XAG')) {
    pipValue = 50;
  }
  
  return spreadPips * pipValue * lots;
}

/**
 * Obter informações completas do spread
 * @param symbol - Símbolo do ativo
 * @returns Objeto com informações do spread
 */
export function getSpreadInfo(symbol: string) {
  const spreadPips = getSpread(symbol);
  const spreadDecimal = pipsToDecimal(symbol, spreadPips);
  
  return {
    symbol,
    spreadPips,
    spreadDecimal,
    spreadPercentage: (spreadDecimal * 100).toFixed(4) + '%',
    hasSpreads: spreadPips > 0
  };
}
