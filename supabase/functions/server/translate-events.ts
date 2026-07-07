import { Hono } from 'npm:hono@4';
export default new Hono();

// Traduz nomes de países pra português — mesmo mapa usado no fallback de
// `/economic-calendar` em index.ts, extraído aqui pra ser reaproveitado
// pelos eventos reais (MQL5/Investing.com/Yahoo Finance).
const COUNTRY_MAP: Record<string, string> = {
  'AU': 'Austrália', 'JP': 'Japão', 'CN': 'China', 'FR': 'França',
  'DE': 'Alemanha', 'GB': 'Reino Unido', 'IT': 'Itália', 'ES': 'Espanha',
  'BR': 'Brasil', 'US': 'Estados Unidos', 'CA': 'Canadá', 'CH': 'Suíça',
  'IN': 'Índia', 'RU': 'Rússia', 'KR': 'Coreia do Sul', 'MX': 'México',
  'ID': 'Indonésia', 'NL': 'Holanda', 'SA': 'Arábia Saudita', 'TR': 'Turquia',
  'PL': 'Polônia', 'BE': 'Bélgica', 'SE': 'Suécia', 'AR': 'Argentina',
  'NO': 'Noruega', 'AT': 'Áustria', 'IE': 'Irlanda', 'DK': 'Dinamarca',
  'SG': 'Singapura', 'MY': 'Malásia', 'HK': 'Hong Kong', 'PH': 'Filipinas',
  'IL': 'Israel', 'AE': 'Emirados Árabes', 'CZ': 'República Tcheca',
  'RO': 'Romênia', 'CL': 'Chile', 'CO': 'Colômbia', 'PK': 'Paquistão',
  'BD': 'Bangladesh', 'EG': 'Egito', 'VN': 'Vietnã', 'NZ': 'Nova Zelândia',
  'PT': 'Portugal', 'GR': 'Grécia', 'FI': 'Finlândia', 'HU': 'Hungria',
  'EU': 'EURO',
};

const IMPORTANCE_MAP: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
const IMPACT_LABEL: Record<number, string> = { 3: 'high', 2: 'medium', 1: 'low' };

export const translateEvent = (event: any) => {
  const rawCountry = event.Country || event.country || '';
  const importanceNum = IMPORTANCE_MAP[event.Importance] ?? (Number(event.importance) || 1);
  return {
    time: event.Date || event.date || event.time || '',
    currency: event.Currency || event.currency || '',
    importance: importanceNum,
    impact: IMPACT_LABEL[importanceNum] || 'low',
    event: event.Event || event.event || 'Evento Econômico',
    actual: event.Actual || event.actual || '',
    forecast: event.Forecast || event.forecast || '',
    previous: event.Previous || event.previous || '',
    country: COUNTRY_MAP[rawCountry] || rawCountry,
    period: event.Period || event.period || '',
  };
};

// Antes retornava sempre [] — descartava os eventos reais já raspados pelo
// MQL5/Investing.com/Yahoo Finance em index.ts, fazendo `/economic-calendar`
// nunca devolver dado real mesmo quando o scraping funcionava. Agora traduz
// de fato, no mesmo formato usado pelo fallback (`EconomicCalendar.tsx` e o
// gate de notícias em `useApexLogic.ts` esperam esse shape).
export const translateEconomicEvents = (events: any[]) =>
  Array.isArray(events) ? events.map(translateEvent) : [];

// Mantido como stub intencional: não há fonte de dados real conectada aqui
// (é só o fallback final de última instância, `createInvestingEvents` de
// `investing-events-pt.ts` já cobre isso); ver index.ts.
export const createInvestingEvents = (_x: any) => [];

export const synthesizeSpeech = async () => null;
export const validateGoogleTTSKey = () => false;
export const transcribeAudio = async () => null;
export const validateGoogleSTTKey = () => false;
export const processUserQuestion = async () => "Error";
export const generateAlertResponse = async () => "Error";
