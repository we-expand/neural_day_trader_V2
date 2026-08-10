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
import { Strategy } from '../types/strategy';
import { backtestDataService, Timeframe as DataTimeframe } from '../services/BacktestDataService';
import { runBacktest, type Trade } from '../services/strategy/BacktestEngine';
import { getPointValue } from '../services/strategy/TradeSizing';
import { symbolMappingService } from '../services/SymbolMappingService';
import { estimateCostPercent, type AssetClass as CostAssetClass } from '../../../research/CostModel';

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

    // 🔴 FIX 2026-07-31: até aqui o backtest da UI rodava com custo ZERO —
    // resultado bruto, sistematicamente mais otimista que qualquer execução
    // real (o comentário original em BacktestEngine.ts já registrava isso como
    // "erro #1 de rigor"). Agora usa o mesmo CostModel.ts calibrado, mesma
    // convenção dos scripts de pesquisa (research/experiments/*) e do gate de
    // custo em useApexLogic.ts: classe de ativo via SymbolMappingService (forex
    // sempre cai em FOREX_MAJOR por falta de granularidade minor/exotic — pode
    // subestimar custo nesses casos, mesma aproximação já documentada) e preço
    // de referência = último candle do período testado.
    const symbolType = symbolMappingService.findMapping(config.symbol)?.type;
    const assetClassForCost: CostAssetClass =
      symbolType === 'crypto' ? 'CRYPTO' :
      symbolType === 'commodity' ? 'COMMODITY' :
      symbolType === 'index' ? 'INDEX' :
      symbolType === 'stock' ? 'STOCK' :
      'FOREX_MAJOR';
    const priceLevel = candles[candles.length - 1]?.close ?? 1;
    const pointValue = getPointValue(config.symbol);
    const roundTripCostPercent = estimateCostPercent(assetClassForCost, priceLevel, pointValue) * 2;

    const { trades, equityCurve } = runBacktest(candles, config.strategy, config.symbol, config.tradeDirection, config.initialCapital, roundTripCostPercent);

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
