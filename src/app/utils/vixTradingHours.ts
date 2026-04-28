/**
 * 📅 VIX TRADING HOURS CHECKER
 * 
 * Gerencia horários de funcionamento do VIX (CBOE Volatility Index)
 * 
 * Horário Oficial:
 * - Abre: 9:30 AM ET
 * - Fecha: 16:00 PM ET (4:00 PM)
 * - Mercado: Segunda a Sexta (exceto feriados dos EUA)
 * 
 * Conversões (Horário Padrão EST):
 * - 9:30 AM ET = 14:30 UTC = 11:30 PT
 * - 4:00 PM ET = 21:00 UTC = 18:00 PT
 * 
 * Conversões (Horário de Verão EDT - Mar a Nov):
 * - 9:30 AM EDT = 13:30 UTC = 10:30 PT
 * - 4:00 PM EDT = 20:00 UTC = 17:00 PT
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 21 Janeiro 2026
 */

export interface VIXTradingStatus {
  isOpen: boolean;
  currentTime: Date;
  nextOpen: Date | null;
  nextClose: Date | null;
  timeUntilNextEvent: string;
  marketSession: 'PRE_MARKET' | 'OPEN' | 'CLOSED' | 'AFTER_HOURS';
  reason: string;
}

/**
 * Verificar se hoje é um dia útil (Segunda a Sexta)
 */
function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // 1=Monday, 5=Friday
}

/**
 * Detectar se estamos em horário de verão (EDT) ou padrão (EST)
 * 
 * Horário de verão nos EUA:
 * - Inicia: Segundo domingo de Março às 2:00 AM
 * - Termina: Primeiro domingo de Novembro às 2:00 AM
 */
function isDaylightSavingTime(date: Date): boolean {
  const year = date.getFullYear();
  
  // Segundo domingo de março
  const marchSecondSunday = new Date(year, 2, 1); // 1º de março
  marchSecondSunday.setDate(1 + (7 - marchSecondSunday.getDay()) + 7); // +7 para segunda semana
  
  // Primeiro domingo de novembro
  const novFirstSunday = new Date(year, 10, 1); // 1º de novembro
  novFirstSunday.setDate(1 + (7 - novFirstSunday.getDay())); // Primeiro domingo
  
  return date >= marchSecondSunday && date < novFirstSunday;
}

/**
 * Obter horários de abertura/fechamento em UTC considerando DST
 */
function getVIXHoursUTC(date: Date): { openUTC: number; closeUTC: number } {
  const isDST = isDaylightSavingTime(date);
  
  if (isDST) {
    // EDT (UTC-4): 9:30 AM EDT = 13:30 UTC, 4:00 PM EDT = 20:00 UTC
    return {
      openUTC: 13.5,  // 13:30 UTC
      closeUTC: 20    // 20:00 UTC
    };
  } else {
    // EST (UTC-5): 9:30 AM EST = 14:30 UTC, 4:00 PM EST = 21:00 UTC
    return {
      openUTC: 14.5,  // 14:30 UTC
      closeUTC: 21    // 21:00 UTC
    };
  }
}

/**
 * Checar se o VIX está em horário de negociação
 */
export function checkVIXTradingHours(): VIXTradingStatus {
  const now = new Date();
  const nowUTC = now.getTime();
  
  // Verificar se é dia útil
  if (!isWeekday(now)) {
    const nextMonday = getNextMonday(now);
    return {
      isOpen: false,
      currentTime: now,
      nextOpen: nextMonday,
      nextClose: null,
      timeUntilNextEvent: formatTimeUntil(nextMonday),
      marketSession: 'CLOSED',
      reason: 'Final de semana - VIX abre Segunda-feira às 9:30 AM ET'
    };
  }
  
  const hours = getVIXHoursUTC(now);
  const currentHourUTC = now.getUTCHours() + (now.getUTCMinutes() / 60);
  
  // PRE-MARKET (antes das 9:30 AM ET)
  if (currentHourUTC < hours.openUTC) {
    const todayOpen = new Date(now);
    todayOpen.setUTCHours(Math.floor(hours.openUTC), (hours.openUTC % 1) * 60, 0, 0);
    
    return {
      isOpen: false,
      currentTime: now,
      nextOpen: todayOpen,
      nextClose: null,
      timeUntilNextEvent: formatTimeUntil(todayOpen),
      marketSession: 'PRE_MARKET',
      reason: `Pré-mercado - Abre hoje às ${formatETTime(todayOpen)}`
    };
  }
  
  // HORÁRIO DE NEGOCIAÇÃO (9:30 AM - 4:00 PM ET)
  if (currentHourUTC >= hours.openUTC && currentHourUTC < hours.closeUTC) {
    const todayClose = new Date(now);
    todayClose.setUTCHours(Math.floor(hours.closeUTC), (hours.closeUTC % 1) * 60, 0, 0);
    
    return {
      isOpen: true,
      currentTime: now,
      nextOpen: null,
      nextClose: todayClose,
      timeUntilNextEvent: formatTimeUntil(todayClose),
      marketSession: 'OPEN',
      reason: `Mercado ABERTO - Fecha às ${formatETTime(todayClose)}`
    };
  }
  
  // AFTER-HOURS / FECHADO (depois das 4:00 PM ET)
  const nextOpen = new Date(now);
  
  // Se é sexta-feira, próximo pregão é segunda
  if (now.getDay() === 5) {
    nextOpen.setDate(nextOpen.getDate() + 3); // +3 dias = segunda
  } else {
    nextOpen.setDate(nextOpen.getDate() + 1); // Próximo dia útil
  }
  
  // Setar horário de abertura (9:30 AM ET)
  const nextDayHours = getVIXHoursUTC(nextOpen);
  nextOpen.setUTCHours(Math.floor(nextDayHours.openUTC), (nextDayHours.openUTC % 1) * 60, 0, 0);
  
  return {
    isOpen: false,
    currentTime: now,
    nextOpen: nextOpen,
    nextClose: null,
    timeUntilNextEvent: formatTimeUntil(nextOpen),
    marketSession: 'AFTER_HOURS',
    reason: `Mercado FECHADO - Reabre ${formatNextOpenDay(nextOpen)}`
  };
}

/**
 * Obter próxima segunda-feira
 */
function getNextMonday(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Se domingo = 1 dia, senão = dias até próxima semana
  
  result.setDate(result.getDate() + daysUntilMonday);
  
  const hours = getVIXHoursUTC(result);
  result.setUTCHours(Math.floor(hours.openUTC), (hours.openUTC % 1) * 60, 0, 0);
  
  return result;
}

/**
 * Formatar tempo até próximo evento
 */
function formatTimeUntil(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  
  if (diff < 0) return 'Agora';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  
  return `${minutes}min`;
}

/**
 * Formatar horário ET (Eastern Time)
 */
function formatETTime(date: Date): string {
  const isDST = isDaylightSavingTime(date);
  const timezone = isDST ? 'EDT' : 'EST';
  
  // Converter UTC para ET
  const offsetHours = isDST ? -4 : -5;
  const etDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));
  
  const hours = etDate.getUTCHours();
  const minutes = etDate.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm} ${timezone}`;
}

/**
 * Formatar próximo dia de abertura
 */
function formatNextOpenDay(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Se é amanhã
  if (date.toDateString() === tomorrow.toDateString()) {
    return `amanhã às ${formatETTime(date)}`;
  }
  
  // Se é hoje (improvável mas possível)
  if (date.toDateString() === now.toDateString()) {
    return `hoje às ${formatETTime(date)}`;
  }
  
  // Dias da semana
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dayName = dayNames[date.getDay()];
  
  return `${dayName} às ${formatETTime(date)}`;
}

/**
 * Verificar se devemos mostrar dados históricos (mercado fechado)
 */
export function shouldShowHistoricalVIX(): boolean {
  const status = checkVIXTradingHours();
  return !status.isOpen;
}

/**
 * Obter mensagem de status para UI
 */
export function getVIXStatusMessage(): string {
  const status = checkVIXTradingHours();
  
  if (status.isOpen) {
    return `🟢 MERCADO ABERTO - Fecha em ${status.timeUntilNextEvent}`;
  }
  
  switch (status.marketSession) {
    case 'PRE_MARKET':
      return `🟡 PRÉ-MERCADO - Abre em ${status.timeUntilNextEvent}`;
    case 'AFTER_HOURS':
      return `🔴 FECHADO - Reabre em ${status.timeUntilNextEvent}`;
    case 'CLOSED':
      return `🔴 FINAL DE SEMANA - Reabre ${status.timeUntilNextEvent}`;
    default:
      return '⚪ Status desconhecido';
  }
}

/**
 * Obter cor do badge baseado no status
 */
export function getVIXStatusColor(): string {
  const status = checkVIXTradingHours();
  
  if (status.isOpen) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (status.marketSession === 'PRE_MARKET') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}
