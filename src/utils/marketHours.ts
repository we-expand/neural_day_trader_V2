/**
 * 🕐 MARKET HOURS DETECTOR
 * 
 * Detecta se um ativo está com mercado ABERTO ou FECHADO
 * baseado no horário atual e regras de cada mercado
 */

export type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS';

export interface MarketHoursInfo {
  status: MarketStatus;
  nextOpen?: Date;
  nextClose?: Date;
  timezone: string;
}

/**
 * Categorias de mercado por tipo de ativo
 */
export type MarketType = 
  | 'CRYPTO'      // 24/7
  | 'FOREX'       // 24/5 (fecha fim de semana)
  | 'US_STOCK'    // NYSE/NASDAQ (9:30-16:00 ET)
  | 'COMMODITY'   // Varia por commodity
  | 'INDEX';      // Varia por índice

/**
 * Mapa de ativos para tipo de mercado
 */
const ASSET_MARKET_TYPE_MAP: Record<string, MarketType> = {
  // CRYPTO (24/7)
  'BTCUSDT': 'CRYPTO',
  'ETHUSDT': 'CRYPTO',
  'BNBUSDT': 'CRYPTO',
  'SOLUSDT': 'CRYPTO',
  'XRPUSDT': 'CRYPTO',
  'ADAUSDT': 'CRYPTO',
  'DOGEUSDT': 'CRYPTO',
  'MATICUSDT': 'CRYPTO',
  'DOTUSDT': 'CRYPTO',
  'AVAXUSDT': 'CRYPTO',
  'LINKUSDT': 'CRYPTO',
  'UNIUSDT': 'CRYPTO',
  'LTCUSDT': 'CRYPTO',
  'ATOMUSDT': 'CRYPTO',
  'ETCUSDT': 'CRYPTO',
  'XLMUSDT': 'CRYPTO',
  'NEARUSDT': 'CRYPTO',
  'APTUSDT': 'CRYPTO',
  'ARBUSDT': 'CRYPTO',
  'OPUSDT': 'CRYPTO',
  
  // FOREX (24/5)
  'EURUSD': 'FOREX',
  'GBPUSD': 'FOREX',
  'USDJPY': 'FOREX',
  'USDCHF': 'FOREX',
  'AUDUSD': 'FOREX',
  'USDCAD': 'FOREX',
  'NZDUSD': 'FOREX',
  'EURGBP': 'FOREX',
  'EURJPY': 'FOREX',
  'GBPJPY': 'FOREX',
  'EURCHF': 'FOREX',
  'AUDJPY': 'FOREX',
  'EURAUD': 'FOREX',
  'GBPAUD': 'FOREX',
  'CHFJPY': 'FOREX',
  
  // INDICES
  'SPX500': 'US_STOCK',
  'NQ100': 'US_STOCK',
  'US30': 'US_STOCK',
  'UK100': 'US_STOCK',
  'GER40': 'US_STOCK',
  'FRA40': 'US_STOCK',
  'ESP35': 'US_STOCK',
  'AUS200': 'US_STOCK',
  'HK50': 'US_STOCK',
  'JPN225': 'US_STOCK',
  
  // COMMODITIES
  'XAUUSD': 'COMMODITY', // Gold
  'XAGUSD': 'COMMODITY', // Silver
  'WTIUSD': 'COMMODITY', // Oil WTI
  'UKOUSD': 'COMMODITY', // Brent Oil
  'XPTUSD': 'COMMODITY', // Platinum
  'XPDUSD': 'COMMODITY', // Palladium
  'COPPER': 'COMMODITY',
  'NATGAS': 'COMMODITY',
  
  // STOCKS
  'AAPL': 'US_STOCK',
  'MSFT': 'US_STOCK',
  'GOOGL': 'US_STOCK',
  'AMZN': 'US_STOCK',
  'TSLA': 'US_STOCK',
  'NVDA': 'US_STOCK',
  'META': 'US_STOCK',
  'NFLX': 'US_STOCK',
};

/**
 * Detecta o tipo de mercado de um ativo
 */
export function getMarketType(symbol: string): MarketType {
  // Normalizar símbolo
  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Procurar no mapa
  if (ASSET_MARKET_TYPE_MAP[normalizedSymbol]) {
    return ASSET_MARKET_TYPE_MAP[normalizedSymbol];
  }
  
  // Detecção automática por padrão
  if (normalizedSymbol.endsWith('USDT') || normalizedSymbol.endsWith('BTC')) {
    return 'CRYPTO';
  }
  
  if (normalizedSymbol.includes('USD') || normalizedSymbol.includes('EUR') || 
      normalizedSymbol.includes('GBP') || normalizedSymbol.includes('JPY')) {
    return 'FOREX';
  }
  
  if (normalizedSymbol.includes('XAU') || normalizedSymbol.includes('XAG') || 
      normalizedSymbol.includes('WTI') || normalizedSymbol.includes('OIL')) {
    return 'COMMODITY';
  }
  
  // Default: assumir US_STOCK
  return 'US_STOCK';
}

/**
 * Verifica se mercado CRYPTO está aberto (sempre 24/7)
 */
function isCryptoMarketOpen(): MarketHoursInfo {
  return {
    status: 'OPEN',
    timezone: 'UTC',
  };
}

/**
 * Verifica se mercado FOREX está aberto (24h, fecha fim de semana)
 */
function isForexMarketOpen(): MarketHoursInfo {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Domingo, 6 = Sábado
  const hour = now.getUTCHours();
  
  // FOREX fecha das 22h Sexta (UTC) até 22h Domingo (UTC)
  const isFridayNight = day === 5 && hour >= 22;
  const isSaturday = day === 6;
  const isSundayBeforeOpen = day === 0 && hour < 22;
  
  if (isFridayNight || isSaturday || isSundayBeforeOpen) {
    // Calcular próxima abertura (Domingo 22h UTC)
    const nextOpen = new Date(now);
    const daysUntilSunday = day === 5 ? 2 : day === 6 ? 1 : 0;
    nextOpen.setUTCDate(now.getUTCDate() + daysUntilSunday);
    nextOpen.setUTCHours(22, 0, 0, 0);
    
    return {
      status: 'CLOSED',
      nextOpen,
      timezone: 'UTC',
    };
  }
  
  return {
    status: 'OPEN',
    timezone: 'UTC',
  };
}

/**
 * Verifica se mercado US_STOCK está aberto (9:30-16:00 ET)
 */
function isUSStockMarketOpen(): MarketHoursInfo {
  const now = new Date();
  
  // Converter para ET (Eastern Time)
  // Simplificação: ET = UTC - 5h (sem considerar DST por enquanto)
  const etHour = now.getUTCHours() - 5;
  const etMinutes = now.getUTCMinutes();
  const day = now.getUTCDay();
  
  // Fim de semana (Sábado ou Domingo)
  if (day === 0 || day === 6) {
    return {
      status: 'CLOSED',
      timezone: 'ET',
    };
  }
  
  // Converter hora para minutos desde meia-noite
  const currentMinutes = etHour * 60 + etMinutes;
  const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
  const marketCloseMinutes = 16 * 60; // 4:00 PM
  
  if (currentMinutes < marketOpenMinutes) {
    return {
      status: 'PRE_MARKET',
      timezone: 'ET',
    };
  }
  
  if (currentMinutes >= marketCloseMinutes) {
    return {
      status: 'AFTER_HOURS',
      timezone: 'ET',
    };
  }
  
  return {
    status: 'OPEN',
    timezone: 'ET',
  };
}

/**
 * Verifica se mercado COMMODITY está aberto
 * (Simplificação: similar ao FOREX)
 */
function isCommodityMarketOpen(): MarketHoursInfo {
  return isForexMarketOpen();
}

/**
 * 🎯 FUNÇÃO PRINCIPAL: Detecta status do mercado para um ativo
 */
export function getMarketStatus(symbol: string): MarketHoursInfo {
  const marketType = getMarketType(symbol);
  
  switch (marketType) {
    case 'CRYPTO':
      return isCryptoMarketOpen();
    
    case 'FOREX':
      return isForexMarketOpen();
    
    case 'US_STOCK':
    case 'INDEX':
      return isUSStockMarketOpen();
    
    case 'COMMODITY':
      return isCommodityMarketOpen();
    
    default:
      return isCryptoMarketOpen(); // Default: 24/7
  }
}

/**
 * Helper: Verifica se mercado está aberto (simplificado)
 */
export function isMarketOpen(symbol: string): boolean {
  const status = getMarketStatus(symbol);
  return status.status === 'OPEN';
}

/**
 * Helper: Retorna emoji baseado no status
 */
export function getMarketStatusEmoji(status: MarketStatus): string {
  switch (status) {
    case 'OPEN':
      return '🟢';
    case 'CLOSED':
      return '🔴';
    case 'PRE_MARKET':
      return '🟡';
    case 'AFTER_HOURS':
      return '🟠';
    default:
      return '⚪';
  }
}

/**
 * Helper: Retorna texto do status em português
 */
export function getMarketStatusText(status: MarketStatus): string {
  switch (status) {
    case 'OPEN':
      return 'ABERTO';
    case 'CLOSED':
      return 'FECHADO';
    case 'PRE_MARKET':
      return 'PRÉ-MERCADO';
    case 'AFTER_HOURS':
      return 'PÓS-MERCADO';
    default:
      return 'DESCONHECIDO';
  }
}

/**
 * Helper: Retorna cor Tailwind baseado no status
 */
export function getMarketStatusColor(status: MarketStatus): string {
  switch (status) {
    case 'OPEN':
      return 'text-emerald-400';
    case 'CLOSED':
      return 'text-red-400';
    case 'PRE_MARKET':
      return 'text-yellow-400';
    case 'AFTER_HOURS':
      return 'text-orange-400';
    default:
      return 'text-neutral-400';
  }
}
