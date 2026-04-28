/**
 * Formata valores monetários com segurança, tratando valores null/undefined
 */
export const formatCurrency = (
  value: number | null | undefined, 
  fallback: number = 0,
  options?: Intl.NumberFormatOptions
): string => {
  const num = value ?? fallback;
  return num.toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2,
    ...options
  });
};

/**
 * Formata números com segurança, tratando valores null/undefined
 */
export const formatNumber = (
  value: number | null | undefined, 
  fallback: number = 0,
  options?: Intl.NumberFormatOptions
): string => {
  const num = value ?? fallback;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  });
};

/**
 * Formata percentual com segurança
 */
export const formatPercent = (
  value: number | null | undefined, 
  fallback: number = 0,
  decimals: number = 2
): string => {
  const num = value ?? fallback;
  return num.toFixed(decimals);
};

/**
 * ✅ NOVO: Valida se um valor é um número válido
 */
export const isValidNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

/**
 * ✅ NOVO: Normaliza valor para número válido
 */
export const normalizeNumber = (value: any, fallback: number = 0): number => {
  if (isValidNumber(value)) {
    return value;
  }
  return fallback;
};

/**
 * ✅ NOVO: Formata preço com detecção automática de decimais
 */
export const formatPrice = (
  price: number | null | undefined,
  symbol?: string,
  fallback: number = 0
): string => {
  const num = normalizeNumber(price, fallback);
  
  // Detectar quantas casas decimais usar baseado no símbolo
  let decimals = 2;
  
  if (symbol) {
    const upper = symbol.toUpperCase();
    
    // Forex: 5 decimais
    if (upper.length === 6 && /^[A-Z]{6}$/.test(upper)) {
      decimals = 5;
    }
    // JPY pares: 3 decimais
    else if (upper.includes('JPY')) {
      decimals = 3;
    }
    // Crypto: 2 decimais
    else if (upper.includes('USDT') || upper.includes('USD')) {
      decimals = 2;
    }
  }
  
  return num.toFixed(decimals);
};

/**
 * ✅ NOVO: Formata variação com sinal +/-
 */
export const formatChange = (
  change: number | null | undefined,
  decimals: number = 2
): string => {
  const num = normalizeNumber(change, 0);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}`;
};

/**
 * ✅ NOVO: Formata percentual com sinal +/-
 */
export const formatChangePercent = (
  changePercent: number | null | undefined,
  decimals: number = 2
): string => {
  const num = normalizeNumber(changePercent, 0);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
};