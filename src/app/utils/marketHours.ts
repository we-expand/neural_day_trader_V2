/**
 * 🔥 MARKET HOURS UTILITY
 *
 * Detecta horários de mercado para diferentes classes de ativos.
 *
 * ⚠️ CONCEITO CENTRAL (ler antes de mexer aqui):
 * Este app negocia CFDs via MetaAPI/Infinox — NÃO o pregão à vista da bolsa.
 * O CFD de um índice (SPX500, NAS100, US30, GER40, UK100...) segue o horário
 * do MERCADO FUTURO/CFD do broker, que é quase 24h por dia, 5 dias por
 * semana, com uma pausa diária curta de manutenção — NÃO o horário estreito
 * do pregão à vista (ex: NYSE 9:30-16:00 ET).
 *
 * Exemplo confirmado pelo Cleber (S&P 500 E-mini / CFD, horário de Brasília):
 *   Abre:  Domingo 20:00 BRT
 *   Fecha: Sexta   19:00 BRT
 *   Pausa diária: 19:00-20:00 BRT (manutenção do sistema)
 * Em UTC (BRT = UTC-3, sem horário de verão no Brasil desde 2019):
 *   Abre:  Domingo 23:00 UTC
 *   Fecha: Sexta   22:00 UTC
 *   Pausa diária: 22:00-23:00 UTC
 *
 * Esse é o MESMO padrão que forex e commodities (ouro, petróleo) já
 * seguem — faz sentido, todos são CFDs do mesmo broker. Por isso índices,
 * forex e commodities agora usam a mesma função `isCfdMarketOpen()`.
 *
 * Ações individuais (AAPL, MSFT...) SÃO negociadas no pregão à vista real
 * (a Infinox não oferece CFD 24h pra ações), então essas continuam usando
 * o horário estreito da bolsa local — com ajuste de horário de verão (DST),
 * que a versão anterior deste arquivo não tinha (causava 1h de erro no
 * status "aberto/fechado" durante ~8 meses por ano nos EUA/Europa).
 *
 * Se algum dia formos operar em outra plataforma (ex: pregão à vista puro,
 * sem CFD), reavaliar `isCfdMarketOpen()` pros índices.
 */

export interface MarketStatus {
  isOpen: boolean;
  status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS';
  nextOpen?: string;
  nextClose?: string;
  timezone: string;
}

type MarketType = 'CRYPTO' | 'FOREX' | 'US_STOCKS' | 'EU_STOCKS' | 'ASIA_STOCKS' | 'COMMODITIES' | 'B3' | 'STOCK';

/**
 * Detecta o tipo de mercado baseado no símbolo
 */
function detectMarketType(symbol: string): MarketType {
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
  if (['XAU', 'XAG', 'XPT', 'XPD', 'WTI', 'BRENT', 'OIL', 'GOLD', 'SILVER', 'USOUSD', 'UKOUSD'].some(comm => upperSymbol.includes(comm))) {
    return 'COMMODITIES';
  }

  // ÍNDICES AMERICANOS (CFD — near 24/5, ver isCfdMarketOpen)
  if (['SPX', 'SP500', 'US500', 'NQ100', 'NASDAQ', 'NAS100', 'US30', 'DOW', 'US2000', 'VIX'].some(idx => upperSymbol.includes(idx))) {
    return 'US_STOCKS';
  }

  // ÍNDICES EUROPEUS (CFD — near 24/5)
  if (['DAX', 'GER40', 'GER', 'FTSE', 'UK100', 'CAC', 'FRA40', 'FRA', 'STOXX', 'EUSTX', 'ESP35', 'ESP', 'ITA40', 'NETH25'].some(idx => upperSymbol.includes(idx))) {
    return 'EU_STOCKS';
  }

  // ÍNDICES ASIÁTICOS (CFD — near 24/5)
  if (['NIKKEI', 'JPN225', 'JPN', 'HSI', 'HKG', 'HK50', 'HK', 'ASX', 'AUS200', 'AUS', 'CHINA50'].some(idx => upperSymbol.includes(idx))) {
    return 'ASIA_STOCKS';
  }

  // B3 - Bolsa Brasileira
  if (['WIN', 'WDO', 'PETR', 'VALE', 'IBOV', 'B3SA'].some(b3 => upperSymbol.includes(b3))) {
    return 'B3';
  }

  // AÇÕES INDIVIDUAIS — pregão à vista real (sem CFD 24h), com DST
  if (upperSymbol.length <= 5 && /^[A-Z.]+$/.test(upperSymbol)) {
    return 'STOCK';
  }

  // Fallback: assumir US_STOCKS (CFD near 24/5)
  return 'US_STOCKS';
}

/**
 * 🔥 Retorna nome formatado do mercado
 */
function getMarketDisplayName(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();

  if (['SPX', 'SP500', 'US500'].some(idx => upperSymbol.includes(idx))) {
    return 'S&P 500';
  }
  if (upperSymbol.includes('BTC')) {
    return 'Bitcoin';
  }
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
    case 'STOCK':
      return 'Ação';
    default:
      return 'Mercado';
  }
}

/**
 * 🌍 CFD near-24/5 (índices, forex, commodities via MetaAPI/Infinox)
 *
 * Abre:  Domingo 23:00 UTC
 * Fecha: Sexta   22:00 UTC
 * Pausa diária:  22:00-23:00 UTC (manutenção), todo dia de segunda a quinta
 *
 * Isso é o horário real do broker (confirmado contra E-mini S&P / MetaTrader
 * do Cleber, 2026-07-08) — reaproveitar esta função pra qualquer CFD novo
 * que a plataforma passar a oferecer, em vez de reinventar o cálculo.
 */
function isCfdMarketOpen(now: Date): MarketStatus {
  const utcDay = now.getUTCDay(); // 0 = Domingo, 6 = Sábado
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dailyBreakStart = 22 * 60; // 22:00 UTC
  const dailyBreakEnd = 23 * 60;   // 23:00 UTC

  // Sábado inteiro: fechado
  if (utcDay === 6) {
    return { isOpen: false, status: 'CLOSED', nextOpen: 'Domingo 23:00 UTC (20:00 BRT)', timezone: 'UTC' };
  }

  // Domingo antes das 23:00 UTC: ainda fechado (fim de semana)
  if (utcDay === 0 && totalMinutes < dailyBreakEnd) {
    return { isOpen: false, status: 'CLOSED', nextOpen: 'Hoje 23:00 UTC (20:00 BRT)', timezone: 'UTC' };
  }

  // Sexta após 22:00 UTC: fechado até domingo
  if (utcDay === 5 && totalMinutes >= dailyBreakStart) {
    return { isOpen: false, status: 'CLOSED', nextOpen: 'Domingo 23:00 UTC (20:00 BRT)', timezone: 'UTC' };
  }

  // Pausa diária de manutenção (Dom-Qui): 22:00-23:00 UTC
  if (totalMinutes >= dailyBreakStart && totalMinutes < dailyBreakEnd) {
    return { isOpen: false, status: 'CLOSED', nextOpen: 'Hoje 23:00 UTC (20:00 BRT) — pausa de manutenção', timezone: 'UTC' };
  }

  return { isOpen: true, status: 'OPEN', nextClose: 'Sexta 22:00 UTC (19:00 BRT)', timezone: 'UTC' };
}

/**
 * 🕐 Calcula o offset de fuso (em minutos, relativo a UTC) de Nova Iorque
 * pra uma data específica, considerando horário de verão (EDT/EST).
 * DST nos EUA: 2ª domingo de março às 2h → 1º domingo de novembro às 2h.
 * EST = UTC-5 (inverno) | EDT = UTC-4 (verão)
 */
function getNyOffsetMinutes(now: Date): number {
  const year = now.getUTCFullYear();

  const nthSunday = (month: number, n: number): Date => {
    const d = new Date(Date.UTC(year, month, 1));
    const firstSundayOffset = (7 - d.getUTCDay()) % 7;
    d.setUTCDate(1 + firstSundayOffset + (n - 1) * 7);
    return d;
  };

  const dstStart = nthSunday(2, 2);  // 2ª domingo de março
  const dstEnd = nthSunday(10, 1);   // 1º domingo de novembro

  const isDst = now.getTime() >= dstStart.getTime() && now.getTime() < dstEnd.getTime();
  return isDst ? -4 * 60 : -5 * 60; // EDT ou EST, em minutos
}

/**
 * 🕐 Offset de Londres (UK) em minutos, considerando BST/GMT.
 * DST no Reino Unido: último domingo de março às 1h UTC → último domingo
 * de outubro às 1h UTC. BST = UTC+1 (verão) | GMT = UTC+0 (inverno).
 */
function getLondonOffsetMinutes(now: Date): number {
  const year = now.getUTCFullYear();

  const lastSunday = (month: number): Date => {
    const d = new Date(Date.UTC(year, month + 1, 0)); // último dia do mês
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d;
  };

  const dstStart = lastSunday(2);  // último domingo de março
  const dstEnd = lastSunday(9);    // último domingo de outubro

  const isDst = now.getTime() >= dstStart.getTime() && now.getTime() < dstEnd.getTime();
  return isDst ? 60 : 0; // BST ou GMT, em minutos
}

export function isMarketOpen(symbol: string): MarketStatus {
  const marketType = detectMarketType(symbol);
  const now = new Date();
  const utcDay = now.getUTCDay();
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // CRYPTO - Sempre aberto (24/7)
  if (marketType === 'CRYPTO') {
    return { isOpen: true, status: 'OPEN', timezone: 'UTC' };
  }

  // ÍNDICES (US/EU/Ásia) + FOREX + COMMODITIES → CFD near-24/5 (ver isCfdMarketOpen)
  if (marketType === 'US_STOCKS' || marketType === 'EU_STOCKS' || marketType === 'ASIA_STOCKS' ||
      marketType === 'FOREX' || marketType === 'COMMODITIES') {
    return isCfdMarketOpen(now);
  }

  // AÇÕES INDIVIDUAIS (pregão à vista real, com DST) — NYSE/NASDAQ
  // Regular: 9:30-16:00 ET (ajustado por DST)
  if (marketType === 'STOCK') {
    const isWeekend = utcDay === 0 || utcDay === 6;
    if (isWeekend) {
      return { isOpen: false, status: 'CLOSED', nextOpen: 'Segunda 9:30 AM ET', timezone: 'ET (DST-aware)' };
    }

    const nyOffset = getNyOffsetMinutes(now); // -240 (EDT) ou -300 (EST)
    const nyMinutesOfDay = ((totalMinutes + nyOffset) % 1440 + 1440) % 1440;

    const preMarketStart = 9 * 60;      // 9:00 ET
    const regularOpen = 9 * 60 + 30;    // 9:30 ET
    const regularClose = 16 * 60;       // 16:00 ET
    const afterHoursEnd = 20 * 60;      // 20:00 ET

    const tzLabel = nyOffset === -240 ? 'EDT (UTC-4)' : 'EST (UTC-5)';

    if (nyMinutesOfDay >= preMarketStart && nyMinutesOfDay < regularOpen) {
      return { isOpen: false, status: 'PRE_MARKET', nextOpen: '9:30 AM ET', timezone: tzLabel };
    }
    if (nyMinutesOfDay >= regularOpen && nyMinutesOfDay < regularClose) {
      return { isOpen: true, status: 'OPEN', nextClose: '4:00 PM ET', timezone: tzLabel };
    }
    if (nyMinutesOfDay >= regularClose && nyMinutesOfDay < afterHoursEnd) {
      return { isOpen: false, status: 'AFTER_HOURS', nextOpen: 'Amanhã 9:30 AM ET', timezone: tzLabel };
    }
    return { isOpen: false, status: 'CLOSED', nextOpen: 'Amanhã 9:30 AM ET', timezone: tzLabel };
  }

  // B3 - Bolsa do Brasil (BRT, sem DST desde 2019)
  if (marketType === 'B3') {
    const isWeekend = utcDay === 0 || utcDay === 6;
    const marketOpen = 13 * 60; // 13:00 UTC = 10:00 BRT
    const marketClose = 21 * 60; // 21:00 UTC = 18:00 BRT

    if (isWeekend) {
      return { isOpen: false, status: 'CLOSED', nextOpen: 'Segunda 13:00 UTC (10:00 BRT)', timezone: 'BRT (UTC-3)' };
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
  return { isOpen: false, status: 'CLOSED', timezone: 'UTC' };
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
    if (status.nextOpen) {
      return `${icon} ${marketName} FECHADO · Abre ${status.nextOpen}`;
    }
    return `${icon} ${marketName} FECHADO`;
  }
}
