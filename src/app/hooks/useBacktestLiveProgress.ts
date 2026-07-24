/**
 * 🎯 HOOK: BACKTEST LIVE PROGRESS
 *
 * Backtest REAL: roda a estratégia escolhida (pronta ou customizada) sobre
 * candles históricos reais (Binance/MetaAPI via BacktestDataService), usando
 * o mesmo motor de avaliação (StrategyEvaluator) e o mesmo cálculo de
 * posição/TP/SL (TradeSizing) que a IA ao vivo usa. Determinístico: mesma
 * estratégia + mesmo período + mesmos dados = mesmo resultado, sempre —
 * nenhum Math.random() em qualquer ponto do cálculo de trades/métricas.
 * A "animação" de progresso é só apresentação: os trades já foram todos
 * calculados de antemão, e o loop de UI apenas revela o resultado aos poucos.
 */

import { useState, useCallback, useRef } from 'react';
import { Candle } from '../services/indicators/TechnicalIndicators';
import { IndicatorCache, evaluateStrategyAt, evaluateExitAt } from '../services/strategy/StrategyEvaluator';
import { calculatePositionSize, getPointValue, trailStopLoss, resolveTpSl } from '../services/strategy/TradeSizing';
import { Strategy } from '../types/strategy';
import { backtestDataService, Timeframe as DataTimeframe } from '../services/BacktestDataService';

interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  timestamp: number;
  status: 'win' | 'loss';
  candleIndex: number;
  aiAnalysis: {
    confidence: number;
    mainReason: string;
    supportingFactors: string[];
    indicators: { name: string; value: string; signal: 'bullish' | 'bearish' | 'neutral' }[];
    marketContext: string;
  };
  result?: {
    exitPrice: number;
    profit: number;
    profitPercent: number;
    status: 'win' | 'loss';
    exitReason: string;
  };
}

export type { Trade };

interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalProfitPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  currentEquity: number;
  initialCapital: number;
}

interface BacktestProgress {
  currentCandle: number;
  totalCandles: number;
  progress: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  candlesPerSecond: number;
}

interface BacktestState {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  error: string | null;
  progress: BacktestProgress;
  metrics: BacktestMetrics;
  recentTrades: Trade[];
  allTrades: Trade[];
  equityCurve: Array<{ time: number; equity: number }>;
}

export interface BacktestRunConfig {
  strategy: Strategy;
  symbol: string;
  startDate: Date;
  endDate: Date;
  timeframe: DataTimeframe;
  tradeDirection: 'long' | 'short' | 'both';
  initialCapital: number;
}

function emptyMetrics(initialCapital: number): BacktestMetrics {
  return {
    totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0,
    totalProfit: 0, totalProfitPercent: 0, maxDrawdown: 0, maxDrawdownPercent: 0,
    averageWin: 0, averageLoss: 0, profitFactor: 0, sharpeRatio: 0,
    currentEquity: initialCapital, initialCapital,
  };
}

function calculateMetrics(trades: Trade[], currentEquity: number, initialCapital: number, peakEquity: number): BacktestMetrics {
  const winningTrades = trades.filter(t => t.status === 'win');
  const losingTrades = trades.filter(t => t.status === 'loss');

  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.profit, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));

  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const maxDrawdown = peakEquity - currentEquity;
  const maxDrawdownPercent = peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : 0;

  const returns = trades.map(t => t.profitPercent);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
    : 1;
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    totalProfit,
    totalProfitPercent: (totalProfit / initialCapital) * 100,
    maxDrawdown,
    maxDrawdownPercent,
    averageWin: avgWin,
    averageLoss: avgLoss,
    profitFactor,
    sharpeRatio,
    currentEquity,
    initialCapital,
  };
}

function indicatorSnapshot(cache: IndicatorCache, i: number) {
  const rsi = cache.get('RSI', 14)[i];
  const macd = cache.get('MACD')[i];
  const ema = cache.get('EMA', 21)[i];
  return [
    { name: 'RSI(14)', value: rsi !== null ? rsi.toFixed(1) : 'n/d', signal: (rsi !== null ? (rsi < 40 ? 'bullish' : rsi > 60 ? 'bearish' : 'neutral') : 'neutral') as 'bullish' | 'bearish' | 'neutral' },
    { name: 'MACD', value: macd !== null ? macd.toFixed(4) : 'n/d', signal: (macd !== null ? (macd > 0 ? 'bullish' : 'bearish') : 'neutral') as 'bullish' | 'bearish' | 'neutral' },
    { name: 'EMA(21)', value: ema !== null ? `$${ema.toFixed(2)}` : 'n/d', signal: 'neutral' as const },
  ];
}

/**
 * Roda a estratégia sobre a série de candles inteira e retorna os trades
 * (cálculo 100% determinístico — sem aleatoriedade em nenhum passo).
 */
function runBacktest(candles: Candle[], strategy: Strategy, symbol: string, direction: 'long' | 'short' | 'both', initialCapital: number) {
  const cache = new IndicatorCache(candles);
  const trades: Trade[] = [];
  const equityCurve: Array<{ time: number; equity: number }> = [{ time: 0, equity: initialCapital }];

  let equity = initialCapital;
  let openPosition: null | {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    entryIndex: number;
    tp: number | null; // null = TRAILING_ONLY, sem alvo fixo (ver Strategy.takeProfitMode)
    sl: number;
    originalSl: number;
    tradeCapital: number;
    reasons: string[];
    confidence: number;
  } = null;

  const pointValue = getPointValue(symbol);
  const warmup = 60; // candles mínimos pra indicadores lentos (EMA200 etc.) estabilizarem

  for (let i = warmup; i < candles.length; i++) {
    if (openPosition) {
      const candle = candles[i];

      if (strategy.trailingStop) {
        openPosition.sl = trailStopLoss(openPosition.side, openPosition.entryPrice, openPosition.originalSl, openPosition.sl, candle.close);
      }

      const hitTp = openPosition.tp !== null && (openPosition.side === 'LONG' ? candle.high >= openPosition.tp : candle.low <= openPosition.tp);
      const hitSl = openPosition.side === 'LONG' ? candle.low <= openPosition.sl : candle.high >= openPosition.sl;
      const ruleExit = evaluateExitAt(strategy, candles, i, cache);

      if (hitTp || hitSl || ruleExit) {
        const exitPrice = hitTp ? openPosition.tp! : hitSl ? openPosition.sl : candle.close;
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const profitPercent = (priceDiff / openPosition.entryPrice) * 100;
        const profit = (openPosition.tradeCapital * profitPercent) / 100;
        const isWin = profit >= 0;
        equity += profit;

        trades.push({
          id: `bt-${openPosition.entryIndex}-${i}`,
          symbol,
          type: openPosition.side === 'LONG' ? 'BUY' : 'SELL',
          entryPrice: openPosition.entryPrice,
          exitPrice,
          profit,
          profitPercent,
          timestamp: candle.time,
          status: isWin ? 'win' : 'loss',
          candleIndex: i,
          aiAnalysis: {
            confidence: openPosition.confidence,
            mainReason: openPosition.reasons[0] || `${strategy.name}: sinal de ${openPosition.side === 'LONG' ? 'compra' : 'venda'}`,
            supportingFactors: openPosition.reasons.slice(1),
            indicators: indicatorSnapshot(cache, openPosition.entryIndex),
            marketContext: `Estratégia "${strategy.name}" em ${symbol}`,
          },
          result: {
            exitPrice,
            profit,
            profitPercent,
            status: isWin ? 'win' : 'loss',
            exitReason: hitTp ? 'Take profit atingido' : hitSl ? 'Stop loss acionado' : 'Regra de saída da estratégia satisfeita',
          },
        });

        equityCurve.push({ time: i, equity });
        openPosition = null;
      }
      continue;
    }

    const result = evaluateStrategyAt(strategy, candles, i, cache);
    if (!result.signal) continue;

    const side: 'LONG' | 'SHORT' = result.signal === 'BUY' ? 'LONG' : 'SHORT';
    if (direction === 'long' && side !== 'LONG') continue;
    if (direction === 'short' && side !== 'SHORT') continue;

    const entryPrice = candles[i].close;
    // ATR(14) do próprio candle de entrada — dimensiona SL/TP pela volatilidade
    // real do ativo/momento quando a estratégia pede stopLossMode/takeProfitMode
    // 'ATR' (ver TradeSizing.resolveTpSl); cai para pontos fixos senão.
    const atrAtEntry = cache.get('ATR', 14)[i];
    const { tp, sl } = resolveTpSl(strategy, side, entryPrice, pointValue, atrAtEntry);

    const tradeCapital = calculatePositionSize({
      currentBalance: equity,
      allocatedCapital: equity,
      riskPerTradePercent: strategy.positionSizePercent,
      riskProfile: strategy.riskProfile,
    });

    openPosition = {
      side, entryPrice, entryIndex: i, tp, sl, originalSl: sl,
      tradeCapital, reasons: result.reasons, confidence: result.confidence,
    };
  }

  return { trades, equityCurve, finalEquity: equity };
}

export function useBacktestLiveProgress(initialCapitalDefault: number = 10000) {
  const [state, setState] = useState<BacktestState>({
    isRunning: false,
    isPaused: false,
    isCompleted: false,
    error: null,
    progress: { currentCandle: 0, totalCandles: 0, progress: 0, elapsedTime: 0, estimatedTimeRemaining: 0, candlesPerSecond: 0 },
    metrics: emptyMetrics(initialCapitalDefault),
    recentTrades: [],
    allTrades: [],
    equityCurve: [{ time: 0, equity: initialCapitalDefault }],
  });

  const revealIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (revealIntervalRef.current) {
      clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
    }
    // Parada manual (cancelamento) não é a mesma coisa que terminar o backtest —
    // não abre a tela de resultados, só encerra.
    setState(prev => ({ ...prev, isRunning: false, isPaused: false, isCompleted: false }));
  }, []);

  const dismissResults = useCallback(() => {
    setState(prev => ({ ...prev, isCompleted: false }));
  }, []);

  const pause = useCallback(() => {
    if (revealIntervalRef.current) {
      clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isPaused: true, isRunning: false }));
  }, []);

  const resume = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false, isRunning: true }));
  }, []);

  const start = useCallback(async (config: BacktestRunConfig) => {
    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
      error: null,
      progress: { currentCandle: 0, totalCandles: 0, progress: 0, elapsedTime: 0, estimatedTimeRemaining: 0, candlesPerSecond: 0 },
      metrics: emptyMetrics(config.initialCapital),
      recentTrades: [],
      allTrades: [],
      equityCurve: [{ time: 0, equity: config.initialCapital }],
    }));

    let candles: Candle[];
    try {
      const result = await backtestDataService.fetchHistoricalData(config.symbol, config.startDate, config.endDate, config.timeframe);
      candles = result.candles;
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: err?.message || `Sem dado histórico real disponível para ${config.symbol}. Backtest cancelado — nunca roda sobre dado sintético.`,
      }));
      return;
    }

    if (candles.length < 70) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: `Período/timeframe escolhido retornou só ${candles.length} candles reais — insuficiente para indicadores estáveis (mínimo ~70). Escolha um período maior.`,
      }));
      return;
    }

    const { trades, equityCurve } = runBacktest(candles, config.strategy, config.symbol, config.tradeDirection, config.initialCapital);

    // Revela os trades já calculados aos poucos, só para dar sensação de execução ao vivo —
    // os números finais já estão 100% definidos aqui, a animação não afeta o resultado.
    startTimeRef.current = Date.now();
    let revealIndex = 0;
    const totalCandles = candles.length;
    const stepCandles = Math.max(1, Math.floor(totalCandles / 200));

    revealIntervalRef.current = setInterval(() => {
      revealIndex = Math.min(revealIndex + stepCandles, totalCandles);

      const visibleTrades = trades.filter(t => t.candleIndex <= revealIndex);
      const visibleEquityPoints = equityCurve.filter(p => p.time <= revealIndex);
      const currentEquity = visibleEquityPoints.length > 0 ? visibleEquityPoints[visibleEquityPoints.length - 1].equity : config.initialCapital;
      const peakEquity = visibleEquityPoints.reduce((max, p) => Math.max(max, p.equity), config.initialCapital);

      const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
      const progressPercent = (revealIndex / totalCandles) * 100;
      const candlesPerSecond = elapsedTime > 0 ? revealIndex / elapsedTime : 0;
      const estimatedTimeRemaining = candlesPerSecond > 0 ? (totalCandles - revealIndex) / candlesPerSecond : 0;

      setState(prev => ({
        ...prev,
        progress: { currentCandle: revealIndex, totalCandles, progress: progressPercent, elapsedTime, estimatedTimeRemaining, candlesPerSecond },
        metrics: calculateMetrics(visibleTrades, currentEquity, config.initialCapital, peakEquity),
        recentTrades: [...visibleTrades].reverse().slice(0, 10),
        equityCurve: visibleEquityPoints,
      }));

      if (revealIndex >= totalCandles) {
        if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
        setState(prev => ({
          ...prev,
          isRunning: false,
          isCompleted: true,
          allTrades: [...trades].reverse(),
        }));
      }
    }, 30);
  }, []);

  return { ...state, start, pause, resume, stop, dismissResults };
}
