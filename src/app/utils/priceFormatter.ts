/**
 * 💎 PRICE FORMATTER - MÁXIMA PRECISÃO
 * 
 * Formata preços de acordo com o ativo sem perder precisão
 */

/**
 * Formata preço com precisão dinâmica baseada no tipo de ativo
 * 
 * FOREX: 5 casas decimais (1.04127)
 * CRYPTO: 2-8 casas dependendo do valor
 * ÍNDICES: 2 casas decimais (5932.45)
 * COMMODITIES: 2-3 casas decimais
 */
export function formatPrice(price: number, symbol: string): string {
  if (!price || isNaN(price)) return '0.00';
  
  // CRYPTO - Precisão dinâmica
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('XRP') || 
      symbol.includes('BNB') || symbol.includes('SOL') || symbol.includes('ADA') ||
      symbol.includes('DOG') || symbol.includes('AVA') || symbol.includes('DOT') ||
      symbol.includes('MAT') || symbol.endsWith('USD') && !symbol.includes('XAU') && 
      !symbol.includes('XAG') && !symbol.includes('UKO') && !symbol.includes('USO')) {
    
    if (price >= 1000) {
      return price.toFixed(2); // BTC: 104,523.45
    } else if (price >= 1) {
      return price.toFixed(4); // ETH: 3,256.7845
    } else if (price >= 0.01) {
      return price.toFixed(6); // ADA: 0.450123
    } else {
      return price.toFixed(8); // DOGE: 0.00012345
    }
  }
  
  // FOREX - 5 casas decimais
  if (symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') ||
      symbol.includes('CHF') || symbol.includes('AUD') || symbol.includes('CAD') ||
      symbol.includes('NZD')) {
    
    if (symbol.includes('JPY')) {
      return price.toFixed(3); // USDJPY: 156.244
    }
    return price.toFixed(5); // EURUSD: 1.04127
  }
  
  // OURO E PRATA - 2 casas decimais
  if (symbol.includes('XAU') || symbol.includes('GOLD') || 
      symbol.includes('XAG') || symbol.includes('SILVER')) {
    return price.toFixed(2); // XAUUSD: 2,678.45
  }
  
  // ÍNDICES - 2 casas decimais
  if (symbol.includes('US500') || symbol.includes('NAS100') || symbol.includes('US30') ||
      symbol.includes('DE40') || symbol.includes('UK100') || symbol.includes('JPN225') ||
      symbol.includes('HKG33') || symbol.includes('SPX')) {
    return price.toFixed(2); // US500: 5,932.45
  }
  
  // COMMODITIES - 3 casas decimais
  if (symbol.includes('OIL') || symbol.includes('UKO') || symbol.includes('USO') ||
      symbol.includes('NGAS') || symbol.includes('COPPER') || symbol.includes('WHEAT')) {
    return price.toFixed(3); // OIL: 73.450
  }
  
  // AÇÕES - 2 casas decimais
  if (symbol === 'AAPL' || symbol === 'MSFT' || symbol === 'GOOGL' || 
      symbol === 'AMZN' || symbol === 'NVDA' || symbol === 'TSLA' ||
      symbol === 'META' || symbol === 'NFLX' || symbol === 'AMD' || symbol === 'INTC') {
    return price.toFixed(2); // AAPL: 234.56
  }
  
  // PADRÃO: 2 casas decimais
  return price.toFixed(2);
}

/**
 * Formata mudança percentual com precisão
 */
export function formatChangePercent(changePercent: number): string {
  if (!changePercent || isNaN(changePercent)) return '0.00';
  
  // Se for muito pequeno, mostrar mais casas
  if (Math.abs(changePercent) < 0.01) {
    return changePercent.toFixed(4);
  }
  
  return changePercent.toFixed(2);
}

/**
 * Adiciona separador de milhares
 */
export function formatPriceWithThousands(price: number, symbol: string): string {
  const formatted = formatPrice(price, symbol);
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
