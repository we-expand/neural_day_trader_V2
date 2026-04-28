/**
 * 🕒 MARKET STATUS HELPER
 * 
 * Verifica se os mercados estão abertos baseado em horários reais
 */

export interface MarketStatus {
  isOpen: boolean;
  status: 'ABERTO' | 'FECHADO';
  nextOpen?: string;
  nextClose?: string;
}

/**
 * Verificar se mercado de FOREX está aberto
 * Forex: 24h/5d (Domingo 17h ET - Sexta 17h ET)
 */
export function isForexOpen(): MarketStatus {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Domingo, 6 = Sábado
  const hourUTC = now.getUTCHours();
  
  // Forex fecha Sexta 22:00 UTC e abre Domingo 22:00 UTC
  const isClosed = 
    (dayOfWeek === 5 && hourUTC >= 22) || // Sexta após 22h UTC
    dayOfWeek === 6 || // Sábado
    (dayOfWeek === 0 && hourUTC < 22); // Domingo antes das 22h UTC
  
  return {
    isOpen: !isClosed,
    status: isClosed ? 'FECHADO' : 'ABERTO',
    nextOpen: isClosed ? 'Domingo 22:00 UTC' : undefined,
    nextClose: !isClosed ? 'Sexta 22:00 UTC' : undefined
  };
}

/**
 * Verificar se mercado de CRYPTO está aberto
 * Crypto: 24/7
 */
export function isCryptoOpen(): MarketStatus {
  return {
    isOpen: true,
    status: 'ABERTO'
  };
}

/**
 * Verificar se mercado de US STOCKS está aberto
 * NYSE/NASDAQ: 9:30 - 16:00 ET (Segunda-Sexta)
 */
export function isUSStocksOpen(): MarketStatus {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  
  // Converter para Eastern Time (UTC-5 ou UTC-4 DST)
  const etHour = now.getUTCHours() - 5; // Simplificado
  
  // Segunda a Sexta, 9:30 - 16:00 ET = 14:30 - 21:00 UTC
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMarketHours = now.getUTCHours() >= 14 && now.getUTCHours() < 21;
  
  const isOpen = isWeekday && isMarketHours;
  
  return {
    isOpen,
    status: isOpen ? 'ABERTO' : 'FECHADO',
    nextOpen: !isOpen ? 'Segunda 9:30 ET' : undefined,
    nextClose: isOpen ? '16:00 ET' : undefined
  };
}

/**
 * Verificar se mercado EUROPEU está aberto
 * LSE/XETRA: 8:00 - 16:30 GMT (Segunda-Sexta)
 */
export function isEuropeanStocksOpen(): MarketStatus {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  
  // Segunda a Sexta, 8:00 - 16:30 GMT
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMarketHours = now.getUTCHours() >= 8 && now.getUTCHours() < 17;
  
  const isOpen = isWeekday && isMarketHours;
  
  return {
    isOpen,
    status: isOpen ? 'ABERTO' : 'FECHADO',
    nextOpen: !isOpen ? 'Segunda 8:00 GMT' : undefined,
    nextClose: isOpen ? '16:30 GMT' : undefined
  };
}

/**
 * Verificar se mercado de ÍNDICES está aberto
 */
export function isIndicesOpen(symbol: string): MarketStatus {
  // US Indices (S&P, NASDAQ, DOW)
  if (['US500', 'NAS100', 'US30', 'US2000'].includes(symbol)) {
    return isUSStocksOpen();
  }
  
  // European Indices (DAX, FTSE, CAC)
  if (['DE40', 'UK100', 'FR40', 'EU50'].includes(symbol)) {
    return isEuropeanStocksOpen();
  }
  
  // Asian Indices (Nikkei, Hang Seng)
  if (['JPN225', 'HKG33'].includes(symbol)) {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMarketHours = now.getUTCHours() >= 1 && now.getUTCHours() < 8;
    const isOpen = isWeekday && isMarketHours;
    
    return {
      isOpen,
      status: isOpen ? 'ABERTO' : 'FECHADO',
      nextOpen: !isOpen ? 'Segunda 9:00 JST' : undefined,
      nextClose: isOpen ? '15:00 JST' : undefined
    };
  }
  
  // Default: horário US
  return isUSStocksOpen();
}

/**
 * Verificar se mercado de COMMODITIES está aberto
 */
export function isCommoditiesOpen(): MarketStatus {
  // Commodities geralmente seguem horário Forex (quase 24h)
  return isForexOpen();
}

/**
 * Obter status do mercado baseado em categoria
 */
export function getMarketStatus(category: string, symbol?: string): MarketStatus {
  switch (category.toUpperCase()) {
    case 'FOREX':
      return isForexOpen();
    
    case 'CRYPTO':
    case 'CRIPTOMOEDAS':
    case 'CRYPTOCURRENCY':
      return isCryptoOpen();
    
    case 'STOCKS_US':
    case 'AÇÕES USA':
      return isUSStocksOpen();
    
    case 'STOCKS_EU':
    case 'STOCKS_UK':
    case 'AÇÕES EUROPA':
    case 'AÇÕES UK':
      return isEuropeanStocksOpen();
    
    case 'INDICES':
    case 'ÍNDICES':
      return symbol ? isIndicesOpen(symbol) : isUSStocksOpen();
    
    case 'METALS':
    case 'METAIS':
    case 'ENERGY':
    case 'ENERGIA':
    case 'COMMODITIES':
      return isCommoditiesOpen();
    
    default:
      return isForexOpen(); // Default: Forex
  }
}
