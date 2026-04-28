/**
 * 🔥 MARKET HOURS UTILITY
 * Detecta horários de mercado para diferentes ativos
 * Suporta: Crypto (24/7), Forex, US Stocks, EU Stocks, Asia Stocks, Commodities, B3
 */

export interface MarketStatus {
  isOpen: boolean;
  status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS';
  nextOpen?: string;
  nextClose?: string;
  timezone: string;
}

/**
 * Detecta o tipo de mercado baseado no símbolo
 */
function detectMarketType(symbol: string): 'CRYPTO' | 'FOREX' | 'US_STOCKS' | 'EU_STOCKS' | 'ASIA_STOCKS' | 'COMMODITIES' | 'B3' {
  const upperSymbol = symbol.toUpperCase();
  
  // CRYPTO - terminam com USDT ou são símbolos de crypto conhecidos
  if (upperSymbol.endsWith('USDT') || ['BTC', 'ETH', 'SOL', 'XRP', 'ADA'].some(c => upperSymbol.includes(c))) {
    return 'CRYPTO';
  }
  
  // FOREX - pares de moedas (6 caracteres, formato XXXYYY)
  if (upperSymbol.length === 6 && 
      ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].some(curr => upperSymbol.includes(curr))) {
    return 'FOREX';
  }
  
  // COMMODITIES - Ouro, Prata, Petróleo
  if (['XAU', 'XAG', 'WTI', 'BRENT', 'OIL', 'GOLD', 'SILVER'].some(comm => upperSymbol.includes(comm))) {
    return 'COMMODITIES';
  }
  
  // INDICES AMERICANOS
  if (['SPX', 'SP500', 'US500', 'NQ100', 'NASDAQ', 'US30', 'DOW'].some(idx => upperSymbol.includes(idx))) {
    return 'US_STOCKS';
  }
  
  // INDICES EUROPEUS
  if (['DAX', 'GER', 'FTSE', 'UK100', 'CAC', 'FRA', 'STOXX', 'ESP'].some(idx => upperSymbol.includes(idx))) {
    return 'EU_STOCKS';
  }
  
  // INDICES ASIÁTICOS
  if (['NIKKEI', 'JPN', 'HSI', 'HK', 'ASX', 'AUS'].some(idx => upperSymbol.includes(idx))) {
    return 'ASIA_STOCKS';
  }
  
  // B3 - Bolsa Brasileira
  if (['WIN', 'WDO', 'PETR', 'VALE', 'IBOV', 'B3SA'].some(b3 => upperSymbol.includes(b3))) {
    return 'B3';
  }
  
  // Fallback: assumir US_STOCKS
  return 'US_STOCKS';
}

/**
 * 🔥 NOVO: Retorna nome formatado do mercado
 */
function getMarketDisplayName(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  
  // S&P 500
  if (['SPX', 'SP500', 'US500'].some(idx => upperSymbol.includes(idx))) {
    return 'S&P 500';
  }
  
  // Bitcoin
  if (upperSymbol.includes('BTC')) {
    return 'Bitcoin';
  }
  
  // Ethereum
  if (upperSymbol.includes('ETH')) {
    return 'Ethereum';
  }
  
  const marketType = detectMarketType(symbol);
  
  switch (marketType) {
    case 'CRYPTO':
      return 'Cripto';
    case 'FOREX':
      return 'Forex';
    case 'US_STOCKS':
      return 'Índices US';
    case 'EU_STOCKS':
      return 'Índices EU';
    case 'ASIA_STOCKS':
      return 'Índices Ásia';
    case 'COMMODITIES':
      return 'Commodities';
    case 'B3':
      return 'B3';
    default:
      return 'Mercado';
  }
}

export function isMarketOpen(symbol: string): MarketStatus {
  const marketType = detectMarketType(symbol);
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const utcMinutes = now.getUTCMinutes();
  const totalMinutes = utcHours * 60 + utcMinutes;
  
  console.log('[isMarketOpen] 🕐 Checking market hours:', {
    symbol,
    marketType,
    utcDay,
    utcHours,
    utcMinutes,
    totalMinutes
  });

  // CRYPTO - Sempre aberto (24/7)
  if (marketType === 'CRYPTO') {
    return {
      isOpen: true,
      status: 'OPEN',
      timezone: 'UTC',
    };
  }

  // FOREX
  // Abre: Domingo 22:00 UTC (abertura de Sydney)
  // Fecha: Sexta 22:00 UTC (fechamento de NY)
  if (marketType === 'FOREX') {
    const isWeekend = utcDay === 6; // Apenas Sábado é realmente fechado
    const isSunday = utcDay === 0;
    const isFriday = utcDay === 5;
    
    if (isWeekend) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Domingo 22:00 UTC',
        timezone: 'UTC',
      };
    }
    
    // Domingo: abre 22:00 UTC
    if (isSunday && totalMinutes < 22 * 60) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Domingo 22:00 UTC',
        timezone: 'UTC',
      };
    }
    
    // Sexta: fecha 22:00 UTC
    if (isFriday && totalMinutes >= 22 * 60) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Domingo 22:00 UTC',
        timezone: 'UTC',
      };
    }
    
    // Segunda a Sexta durante horário comercial
    return {
      isOpen: true,
      status: 'OPEN',
      nextOpen: !isOpen ? 'Domingo 22:00 UTC' : undefined,
      nextClose: isOpen ? 'Sexta 22:00 UTC' : undefined,
      timezone: 'UTC',
    };
  }

  // US STOCKS & INDICES (NYSE/NASDAQ)
  // Horário: 9:30 AM - 4:00 PM ET (Eastern Time)
  // ET = UTC-5 (Standard) ou UTC-4 (Daylight)
  // Para simplificar, vamos usar UTC-5 (14:30 - 21:00 UTC)
  if (marketType === 'US_STOCKS') {
    // 🔥 CRÍTICO: 0 = Domingo, 6 = Sábado
    // Semana = Segunda(1) a Sexta(5)
    const isWeekend = utcDay === 0 || utcDay === 6; // Domingo ou Sábado
    const isWeekday = utcDay >= 1 && utcDay <= 5; // Segunda a Sexta
    
    // Pre-market: 9:00-9:30 ET = 14:00-14:30 UTC
    // Regular: 9:30-16:00 ET = 14:30-21:00 UTC  
    // After-hours: 16:00-20:00 ET = 21:00-01:00 UTC (next day)
    
    const preMarketStart = 14 * 60; // 14:00 UTC
    const regularOpen = 14 * 60 + 30; // 14:30 UTC
    const regularClose = 21 * 60; // 21:00 UTC
    const afterHoursClose = 25 * 60; // 01:00 UTC (next day, so 1 AM)
    
    // 🔥 FIM DE SEMANA: SEMPRE FECHADO
    if (isWeekend) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Segunda 14:30 UTC (9:30 AM ET)',
        timezone: 'ET (UTC-5)',
      };
    }
    
    // Check Pre-Market
    if (totalMinutes >= preMarketStart && totalMinutes < regularOpen) {
      return {
        isOpen: false,
        status: 'PRE_MARKET',
        nextOpen: '14:30 UTC (9:30 AM ET)',
        timezone: 'ET (UTC-5)',
      };
    }
    
    // Check Regular Hours
    if (totalMinutes >= regularOpen && totalMinutes < regularClose) {
      return {
        isOpen: true,
        status: 'OPEN',
        nextClose: '21:00 UTC (4:00 PM ET)',
        timezone: 'ET (UTC-5)',
      };
    }
    
    // Check After-Hours (only if not Friday late)
    // After-hours vai até 01:00 UTC do dia seguinte
    // Se for Sexta após 21:00 ou antes Segunda 01:00, está fechado
    const isFriday = utcDay === 5;
    const isMonday = utcDay === 1;
    
    if (totalMinutes >= regularClose && totalMinutes < 24 * 60) {
      // Após 21:00 hoje
      if (isFriday) {
        return {
          isOpen: false,
          status: 'CLOSED',
          nextOpen: 'Segunda 14:30 UTC (9:30 AM ET)',
          timezone: 'ET (UTC-5)',
        };
      }
      return {
        isOpen: false,
        status: 'AFTER_HOURS',
        nextOpen: 'Amanhã 14:30 UTC (9:30 AM ET)',
        timezone: 'ET (UTC-5)',
      };
    }
    
    // Antes de 14:00
    if (totalMinutes < preMarketStart) {
      // Se for Segunda de madrugada (antes de 01:00), ainda é fim de semana
      if (isMonday && totalMinutes < 60) {
        return {
          isOpen: false,
          status: 'CLOSED',
          nextOpen: 'Hoje 14:30 UTC (9:30 AM ET)',
          timezone: 'ET (UTC-5)',
        };
      }
      
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Hoje 14:30 UTC (9:30 AM ET)',
        timezone: 'ET (UTC-5)',
      };
    }
    
    // Fallback: fechado
    return {
      isOpen: false,
      status: 'CLOSED',
      nextOpen: 'Segunda 14:30 UTC (9:30 AM ET)',
      timezone: 'ET (UTC-5)',
    };
  }

  // EU STOCKS
  // Horário: 8:00 - 16:30 CET (7:00 - 15:30 UTC no inverno)
  if (marketType === 'EU_STOCKS') {
    const isWeekend = utcDay === 0 || utcDay === 6;
    const marketOpen = 7 * 60; // 07:00 UTC
    const marketClose = 15 * 60 + 30; // 15:30 UTC
    
    if (isWeekend) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Segunda 07:00 UTC',
        timezone: 'CET (UTC+1)',
      };
    }
    
    const isOpen = totalMinutes >= marketOpen && totalMinutes < marketClose;
    
    return {
      isOpen,
      status: isOpen ? 'OPEN' : 'CLOSED',
      nextOpen: !isOpen ? 'Amanhã 07:00 UTC' : undefined,
      nextClose: isOpen ? '15:30 UTC' : undefined,
      timezone: 'CET (UTC+1)',
    };
  }

  // ASIA STOCKS
  // Horário varia por mercado, usando Tokyo como referência: 00:00 - 06:00 UTC
  if (marketType === 'ASIA_STOCKS') {
    const isWeekend = utcDay === 0 || utcDay === 6;
    const marketOpen = 0; // 00:00 UTC
    const marketClose = 6 * 60; // 06:00 UTC
    
    if (isWeekend) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Segunda 00:00 UTC',
        timezone: 'JST (UTC+9)',
      };
    }
    
    const isOpen = totalMinutes >= marketOpen && totalMinutes < marketClose;
    
    return {
      isOpen,
      status: isOpen ? 'OPEN' : 'CLOSED',
      nextOpen: !isOpen ? 'Amanhã 00:00 UTC' : undefined,
      nextClose: isOpen ? '06:00 UTC' : undefined,
      timezone: 'JST (UTC+9)',
    };
  }

  // COMMODITIES (usando horário do ouro como referência)
  // Ouro: 23:00 Domingo - 22:00 Sexta UTC
  if (marketType === 'COMMODITIES') {
    const isWeekend = utcDay === 6 || (utcDay === 0 && totalMinutes < 23 * 60);
    const isFriday = utcDay === 5;
    
    if (isWeekend) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Domingo 23:00 UTC',
        timezone: 'UTC',
      };
    }
    
    if (isFriday && totalMinutes >= 22 * 60) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Domingo 23:00 UTC',
        timezone: 'UTC',
      };
    }
    
    return {
      isOpen: true,
      status: 'OPEN',
      nextClose: 'Sexta 22:00 UTC',
      timezone: 'UTC',
    };
  }

  // B3 - Bolsa do Brasil
  // Horário: 10:00 - 18:00 BRT (13:00 - 21:00 UTC)
  if (marketType === 'B3') {
    const isWeekend = utcDay === 0 || utcDay === 6;
    const marketOpen = 13 * 60; // 13:00 UTC
    const marketClose = 21 * 60; // 21:00 UTC
    
    if (isWeekend) {
      return {
        isOpen: false,
        status: 'CLOSED',
        nextOpen: 'Segunda 13:00 UTC (10:00 BRT)',
        timezone: 'BRT (UTC-3)',
      };
    }
    
    const isOpen = totalMinutes >= marketOpen && totalMinutes < marketClose;
    
    return {
      isOpen,
      status: isOpen ? 'OPEN' : 'CLOSED',
      nextOpen: !isOpen ? 'Amanhã 13:00 UTC (10:00 BRT)' : undefined,
      nextClose: isOpen ? '21:00 UTC (18:00 BRT)' : undefined,
      timezone: 'BRT (UTC-3)',
    };
  }

  // Fallback
  return {
    isOpen: false,
    status: 'CLOSED',
    timezone: 'UTC',
  };
}

/**
 * Retorna um emoji/ícone para o status do mercado
 */
export function getMarketStatusIcon(status: MarketStatus): string {
  switch (status.status) {
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
 * Retorna mensagem formatada do status com nome bonito do mercado
 */
export function getMarketStatusMessage(symbol: string): string {
  const status = isMarketOpen(symbol);
  const icon = getMarketStatusIcon(status);
  const marketName = getMarketDisplayName(symbol);
  
  if (status.isOpen) {
    return `${icon} ${marketName} ABERTO ${status.nextClose ? `· Fecha ${status.nextClose}` : ''}`;
  } else {
    // Formatação melhorada para mercado fechado
    if (status.nextOpen) {
      return `${icon} ${marketName} FECHADO · Abre ${status.nextOpen}`;
    }
    return `${icon} ${marketName} FECHADO`;
  }
}
