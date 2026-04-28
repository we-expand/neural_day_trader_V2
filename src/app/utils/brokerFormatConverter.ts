/**
 * 🔄 BROKER FORMAT CONVERTER
 * 
 * Diferentes brokers usam multiplicadores diferentes para índices:
 * - MetaTrader SPX500: valor real × 10 (ex: 59,598 para S&P em 5,959.8)
 * - MetaTrader US500: pode variar
 * - Yahoo Finance: valor real sem multiplicador
 */

export interface BrokerConfig {
  name: string;
  multipliers: {
    SPX500: number;
    NAS100: number;
    US30: number;
    [key: string]: number;
  };
}

// 🏦 CONFIGURAÇÕES DE BROKERS CONHECIDOS
export const BROKER_CONFIGS: Record<string, BrokerConfig> = {
  // MetaTrader com multiplicador 10x
  MT5_10X: {
    name: 'MetaTrader 5 (10x)',
    multipliers: {
      SPX500: 10,
      NAS100: 10,
      US30: 10,
    },
  },
  
  // MetaTrader com multiplicador 1x (padrão)
  MT5_1X: {
    name: 'MetaTrader 5 (1x)',
    multipliers: {
      SPX500: 1,
      NAS100: 1,
      US30: 1,
    },
  },
  
  // Yahoo Finance / TradingView (padrão real)
  STANDARD: {
    name: 'Standard (Real Price)',
    multipliers: {
      SPX500: 1,
      NAS100: 1,
      US30: 1,
    },
  },
};

// 🎯 CONFIGURAÇÃO ATUAL (AJUSTE AQUI!)
let currentBrokerConfig: BrokerConfig = BROKER_CONFIGS.MT5_10X; // ✅ MUDAR PARA MT5_10X se seu broker usa 10x

/**
 * 🔧 DEFINIR BROKER
 */
export function setBrokerConfig(configKey: keyof typeof BROKER_CONFIGS) {
  currentBrokerConfig = BROKER_CONFIGS[configKey];
  console.log(`[BrokerConverter] ✅ Broker configurado: ${currentBrokerConfig.name}`);
}

/**
 * 📊 CONVERTER DE VALOR REAL PARA BROKER
 * 
 * Ex: S&P500 real = 5,959.81
 *     MT5 10x = 59,598.1
 */
export function toDisplayPrice(symbol: string, realPrice: number): number {
  const multiplier = currentBrokerConfig.multipliers[symbol] || 1;
  return realPrice * multiplier;
}

/**
 * 📊 CONVERTER DE BROKER PARA VALOR REAL
 * 
 * Ex: MT5 mostra 59,598.1
 *     Valor real = 5,959.81
 */
export function toRealPrice(symbol: string, displayPrice: number): number {
  const multiplier = currentBrokerConfig.multipliers[symbol] || 1;
  return displayPrice / multiplier;
}

/**
 * 🎯 AUTO-DETECTAR BROKER PELO VALOR
 * 
 * Se o S&P500 está em 60,000+, provavelmente é 10x
 * Se está em 6,000+, provavelmente é 1x
 */
export function detectBrokerFormat(symbol: string, price: number): 'MT5_10X' | 'MT5_1X' | 'STANDARD' {
  if (symbol === 'SPX500') {
    // S&P500 típico: 5,000-6,500
    if (price > 50000) return 'MT5_10X';  // 50k+ = provavelmente 10x
    if (price > 5000) return 'STANDARD';  // 5k-10k = valor real
  }
  
  if (symbol === 'NAS100') {
    // NASDAQ típico: 18,000-22,000
    if (price > 180000) return 'MT5_10X';
    if (price > 18000) return 'STANDARD';
  }
  
  if (symbol === 'US30') {
    // Dow Jones típico: 38,000-46,000
    if (price > 380000) return 'MT5_10X';
    if (price > 38000) return 'STANDARD';
  }
  
  return 'STANDARD';
}

/**
 * 🔧 OBTER MULTIPLICADOR ATUAL
 */
export function getCurrentMultiplier(symbol: string): number {
  return currentBrokerConfig.multipliers[symbol] || 1;
}

/**
 * 📝 OBTER NOME DO BROKER ATUAL
 */
export function getCurrentBrokerName(): string {
  return currentBrokerConfig.name;
}

/**
 * 🎨 FORMATAR PREÇO COM SEPARADORES CORRETOS
 * 
 * Ex: 59598.1 → "59,598.10"
 *     5959.81 → "5,959.81"
 */
export function formatPrice(symbol: string, price: number, useBrokerFormat: boolean = true): string {
  const finalPrice = useBrokerFormat ? toDisplayPrice(symbol, price) : price;
  
  // Detectar quantas casas decimais usar
  let decimals = 2;
  if (symbol.includes('USD') && !symbol.includes('XAU') && !symbol.includes('XAG')) {
    decimals = 4; // Forex: 4 decimais
  }
  
  return finalPrice.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 🔄 CONVERTER DADOS DE API PARA FORMATO DO BROKER
 */
export function convertMarketData(
  symbol: string,
  realValue: number,
  realChange: number,
  realChangePercent: number,
  useBrokerFormat: boolean = true
) {
  if (!useBrokerFormat) {
    return { value: realValue, change: realChange, changePercent: realChangePercent };
  }
  
  const multiplier = getCurrentMultiplier(symbol);
  
  return {
    value: realValue * multiplier,
    change: realChange * multiplier,
    changePercent: realChangePercent, // Percentual não muda!
  };
}
