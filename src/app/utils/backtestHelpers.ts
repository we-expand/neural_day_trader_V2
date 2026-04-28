/**
 * 🛠️ BACKTEST HELPERS
 * 
 * Funções utilitárias para o sistema de Backtest/Replay
 */

import { CandleData } from '../services/BacktestDataService';

/**
 * Formata timestamp para display legível
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Formata duração em segundos para HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calcula estatísticas de um conjunto de candles
 */
export function calculateCandleStats(candles: CandleData[]) {
  if (candles.length === 0) {
    return {
      high: 0,
      low: 0,
      open: 0,
      close: 0,
      totalVolume: 0,
      priceChange: 0,
      priceChangePercent: 0,
      avgVolume: 0
    };
  }

  const prices = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));
  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
  const avgVolume = totalVolume / volumes.length;
  const priceChange = close - open;
  const priceChangePercent = (priceChange / open) * 100;

  return {
    high,
    low,
    open,
    close,
    totalVolume,
    priceChange,
    priceChangePercent,
    avgVolume
  };
}

/**
 * Verifica se uma data tem dados disponíveis (não é futuro)
 */
export function isDateAvailable(date: Date): boolean {
  const now = new Date();
  return date <= now;
}

/**
 * Obtém a data de ontem
 */
export function getYesterday(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Obtém o início do dia para uma data
 */
export function getStartOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

/**
 * Obtém o fim do dia para uma data
 */
export function getEndOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

/**
 * Calcula quantos candles cabem em um período
 */
export function calculateMaxCandles(
  startDate: Date,
  endDate: Date,
  timeframeMinutes: number
): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return Math.floor(diffMinutes / timeframeMinutes);
}

/**
 * Converte timeframe para minutos
 */
export function timeframeToMinutes(timeframe: string): number {
  const map: Record<string, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '2h': 120,
    '4h': 240,
    '1d': 1440,
    '1w': 10080
  };
  return map[timeframe] || 1;
}

/**
 * Valida se um candle é válido
 */
export function isValidCandle(candle: CandleData): boolean {
  return (
    candle.time > 0 &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0 &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close
  );
}

/**
 * Filtra candles inválidos
 */
export function filterValidCandles(candles: CandleData[]): CandleData[] {
  return candles.filter(isValidCandle);
}

/**
 * Gera nome de arquivo para exportação
 */
export function generateExportFilename(
  asset: string,
  date: Date,
  timeframe: string
): string {
  const dateStr = date.toISOString().split('T')[0];
  return `backtest_${asset}_${dateStr}_${timeframe}.json`;
}

/**
 * Exporta dados de backtest para JSON
 */
export function exportBacktestData(
  candles: CandleData[],
  filename: string
): void {
  const data = JSON.stringify(candles, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Calcula a cor do candle (verde/vermelho)
 */
export function getCandleColor(candle: CandleData): 'green' | 'red' {
  return candle.close >= candle.open ? 'green' : 'red';
}

/**
 * Calcula o body do candle (diferença entre open e close)
 */
export function getCandleBody(candle: CandleData): number {
  return Math.abs(candle.close - candle.open);
}

/**
 * Calcula as sombras do candle
 */
export function getCandleShadows(candle: CandleData): {
  upperShadow: number;
  lowerShadow: number;
} {
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  
  return { upperShadow, lowerShadow };
}
