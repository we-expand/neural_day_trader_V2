/**
 * 💎 PRICE FORMATTER - MÁXIMA PRECISÃO
 * 
 * Formata preços de acordo com o ativo sem perder precisão
 */

/**
 * Formata preço com 2 casas decimais, pra qualquer ativo (padrão único,
 * a pedido do Cleber — antes tinha precisão dinâmica por tipo de ativo,
 * de 2 até 8 casas, o que gerava inconsistência visual entre telas).
 */
export function formatPrice(price: number, symbol: string): string {
  if (!price || isNaN(price)) return '0.00';
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
