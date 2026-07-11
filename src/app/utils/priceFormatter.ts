/**
 * 💎 PRICE FORMATTER - MÁXIMA PRECISÃO
 *
 * Formata preços de acordo com o ativo sem perder precisão
 */

import { getAssetBySymbol } from '@/app/config/assetDatabase';

/**
 * ✅ 2026-07-11: voltou a ser precisão POR ATIVO (Cleber pediu de volta,
 * exemplo dado: "AUDCAD 0.9838 | XAUUSD 4119.72") — a sessão anterior tinha
 * padronizado tudo em 2 casas fixas, mas isso arredondava forex/cripto de
 * baixo valor a ponto de perder a variação real (ex: EURUSD 1.14 em vez de
 * 1.14143). Usa o campo `precision` já curado por ativo em
 * `assetDatabase.ts` (ex: EURUSD:5, USDJPY:3, XAUUSD:2, BTCUSD:2); símbolos
 * fora do catálogo caem numa heurística por magnitude (preço baixo = mais
 * casas, senão perde toda a variação percentual visível).
 */
export function formatPrice(price: number, symbol: string): string {
  if (!price || isNaN(price)) return '0.00';

  const precision = getPrecisionForSymbol(symbol, price);
  return price.toFixed(precision);
}

export function getPrecisionForSymbol(symbol: string, price: number): number {
  const normalized = symbol.toUpperCase().replace('/', '').replace(' ', '');
  const asset = getAssetBySymbol(normalized) ?? getAssetBySymbol(normalized.replace(/T$/, ''));
  if (asset) return asset.precision;

  // Símbolo fora do catálogo: heurística por magnitude do preço.
  if (price >= 1000) return 2;
  if (price >= 10) return 3;
  if (price >= 1) return 4;
  return 6;
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
