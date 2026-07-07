/**
 * Verificação independente de um trade do Backtest: busca de novo (fetch fresco,
 * não usa o cache do backtest) os candles reais em torno do horário do trade e
 * reavalia a condição de entrada da estratégia nesse candle — pra confirmar que
 * (a) o dado usado é realmente dado de mercado real daquele momento, e (b) a
 * condição de entrada realmente batia ali, sem depender de "confiar" no cálculo
 * original do backtest.
 */
import { Strategy } from '../../types/strategy';
import { backtestDataService, Timeframe as DataTimeframe } from '../BacktestDataService';
import { IndicatorCache, evaluateStrategyAt } from './StrategyEvaluator';

export interface TradeVerificationResult {
  ok: boolean;
  dataMatches: boolean;
  conditionReconfirmed: boolean;
  freshCandle: { open: number; high: number; low: number; close: number } | null;
  originalEntryPrice: number;
  priceDiffPercent: number;
  reconfirmedSignal: 'BUY' | 'SELL' | null;
  tradingViewUrl: string;
  message: string;
}

export async function verifyTrade(
  trade: { symbol: string; type: 'BUY' | 'SELL'; entryPrice: number; timestamp: number },
  strategy: Strategy,
  timeframe: DataTimeframe
): Promise<TradeVerificationResult> {
  const tradingViewUrl = `https://www.tradingview.com/symbols/${encodeURIComponent(trade.symbol)}/`;

  try {
    const lookbackCandles = 250; // margem suficiente pra qualquer indicador (EMA200 etc.) estabilizar
    const msPerCandle: Record<DataTimeframe, number> = {
      '1m': 60_000, '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 3_600_000, '4h': 4 * 3_600_000, '1d': 86_400_000,
    };
    const start = new Date(trade.timestamp - lookbackCandles * msPerCandle[timeframe]);
    const end = new Date(trade.timestamp + msPerCandle[timeframe]);

    // Fetch INDEPENDENTE — não usa o cache que o backtest usou, busca de novo na fonte.
    const fresh = await backtestDataService.fetchHistoricalData(trade.symbol, start, end, timeframe);
    const candles = fresh.candles;

    if (candles.length < 30) {
      return {
        ok: false, dataMatches: false, conditionReconfirmed: false, freshCandle: null,
        originalEntryPrice: trade.entryPrice, priceDiffPercent: 0, reconfirmedSignal: null,
        tradingViewUrl,
        message: 'Histórico insuficiente na nova busca pra reconfirmar (não é falha do trade, é limite de dado disponível agora).',
      };
    }

    // Acha o candle mais próximo do timestamp do trade
    let closestIndex = 0;
    let closestDiff = Infinity;
    candles.forEach((c, i) => {
      const diff = Math.abs(c.time - trade.timestamp);
      if (diff < closestDiff) { closestDiff = diff; closestIndex = i; }
    });

    const freshCandle = candles[closestIndex];
    const priceDiffPercent = Math.abs(freshCandle.close - trade.entryPrice) / trade.entryPrice * 100;
    const dataMatches = priceDiffPercent < 0.5; // tolerância pequena (fonte pode ter atualizado levemente, mas não pode divergir muito)

    const cache = new IndicatorCache(candles);
    const result = evaluateStrategyAt(strategy, candles, closestIndex, cache);
    const conditionReconfirmed = result.signal === trade.type;

    return {
      ok: dataMatches && conditionReconfirmed,
      dataMatches,
      conditionReconfirmed,
      freshCandle: { open: freshCandle.open, high: freshCandle.high, low: freshCandle.low, close: freshCandle.close },
      originalEntryPrice: trade.entryPrice,
      priceDiffPercent,
      reconfirmedSignal: result.signal,
      tradingViewUrl,
      message: dataMatches && conditionReconfirmed
        ? 'Confirmado: preço real bate com o usado no backtest e a condição de entrada reavaliada de forma independente dá o mesmo sinal.'
        : !dataMatches
          ? `Preço divergente: backtest usou $${trade.entryPrice.toFixed(2)}, nova busca encontrou $${freshCandle.close.toFixed(2)} (${priceDiffPercent.toFixed(2)}% de diferença).`
          : `Condição não reconfirmada: reavaliação independente não deu sinal ${trade.type} nesse candle.`,
    };
  } catch (error: any) {
    return {
      ok: false, dataMatches: false, conditionReconfirmed: false, freshCandle: null,
      originalEntryPrice: trade.entryPrice, priceDiffPercent: 0, reconfirmedSignal: null,
      tradingViewUrl,
      message: error?.message || 'Falha ao buscar dado fresco pra verificação.',
    };
  }
}
