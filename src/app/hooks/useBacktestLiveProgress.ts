/**
 * 🎯 HOOK: BACKTEST LIVE PROGRESS
 * 
 * Gerencia estado e dados do backtest em tempo real
 * Simula execução de backtest com métricas ao vivo
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  timestamp: number;
  status: 'win' | 'loss';
  candleIndex: number;
  
  // Análise da IA
  aiAnalysis: {
    confidence: number;
    mainReason: string;
    supportingFactors: string[];
    indicators: {
      name: string;
      value: string;
      signal: 'bullish' | 'bearish' | 'neutral';
    }[];
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
  progress: BacktestProgress;
  metrics: BacktestMetrics;
  recentTrades: Trade[];
  equityCurve: Array<{ time: number; equity: number }>;
}

export function useBacktestLiveProgress(initialCapital: number = 10000) {
  const [state, setState] = useState<BacktestState>({
    isRunning: false,
    isPaused: false,
    progress: {
      currentCandle: 0,
      totalCandles: 1000,
      progress: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      candlesPerSecond: 0
    },
    metrics: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalProfitPercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      currentEquity: initialCapital,
      initialCapital
    },
    recentTrades: [],
    equityCurve: [{ time: 0, equity: initialCapital }]
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const tradesRef = useRef<Trade[]>([]);
  const equityCurveRef = useRef<Array<{ time: number; equity: number }>>([{ time: 0, equity: initialCapital }]);
  const peakEquityRef = useRef<number>(initialCapital);

  // Simular trade
  const simulateTrade = useCallback((currentCandle: number, currentEquity: number): Trade | null => {
    // Simular trade aleatório (30% de chance)
    if (Math.random() > 0.7) {
      const type = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const entryPrice = 50000 + Math.random() * 10000;
      
      // Win rate de ~55%
      const isWin = Math.random() > 0.45;
      const profitPercent = isWin 
        ? (Math.random() * 3 + 0.5) // 0.5% a 3.5% profit
        : -(Math.random() * 2 + 0.3); // -0.3% a -2.3% loss
      
      const profit = (currentEquity * profitPercent) / 100;
      const exitPrice = entryPrice * (1 + profitPercent / 100);
      
      // Gerar análise da IA realista
      const confidence = isWin ? 60 + Math.random() * 35 : 40 + Math.random() * 30;
      
      const buyReasons = [
        'RSI indicando sobrevendido (< 30), sugerindo possível reversão de alta',
        'Cruzamento de alta da EMA 12 sobre EMA 26, sinalizando início de tendência bullish',
        'MACD histograma virando positivo com momentum crescente',
        'Preço rompendo resistência importante com volume acima da média',
        'Formação de padrão bullish engulfing em suporte chave',
        'Divergência bullish entre preço e RSI detectada',
        'Preço testando banda inferior de Bollinger com RSI baixo',
        'ADX acima de 25 confirmando força da tendência de alta'
      ];
      
      const sellReasons = [
        'RSI indicando sobrecomprado (> 70), sugerindo possível correção',
        'Cruzamento de baixa da EMA 12 sob EMA 26, sinalizando reversão de tendência',
        'MACD histograma virando negativo com perda de momentum',
        'Preço rompendo suporte crítico com aumento de volume',
        'Formação de padrão bearish engulfing em resistência importante',
        'Divergência bearish entre preço e RSI identificada',
        'Preço testando banda superior de Bollinger com RSI elevado',
        'ADX acima de 25 confirmando força da tendência de baixa'
      ];
      
      const mainReasons = type === 'BUY' ? buyReasons : sellReasons;
      const mainReason = mainReasons[Math.floor(Math.random() * mainReasons.length)];
      
      const supportingFactors = [];
      if (isWin) {
        const winFactors = [
          'Volume de compra 35% acima da média móvel de 20 períodos',
          'Preço respeitando linha de tendência ascendente de longo prazo',
          'Suporte em EMA 50 mantido com rejeição clara',
          'Confluência entre Fibonacci 61.8% e zona de demanda',
          'Order flow mostrando absorção agressiva de vendas',
          'Correlação positiva com S&P 500 fortalecendo movimento',
          'Spread bid-ask reduzido indicando liquidez saudável'
        ];
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const factor = winFactors[Math.floor(Math.random() * winFactors.length)];
          if (!supportingFactors.includes(factor)) supportingFactors.push(factor);
        }
      } else {
        const lossFactors = [
          'Volume de venda 28% acima da média, sinalizando pressão vendedora',
          'Falha em romper resistência após 3 tentativas',
          'Divergência negativa entre preço e indicador de momentum',
          'Rejeição em zona de oferta previamente identificada',
          'Aumento de volatilidade com candles de indecisão',
          'Correlação inversa temporária com índices principais',
          'Spread bid-ask ampliado sugerindo baixa liquidez momentânea'
        ];
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const factor = lossFactors[Math.floor(Math.random() * lossFactors.length)];
          if (!supportingFactors.includes(factor)) supportingFactors.push(factor);
        }
      }
      
      const rsiValue = type === 'BUY' ? 25 + Math.random() * 40 : 60 + Math.random() * 35;
      const macdValue = type === 'BUY' ? (Math.random() * 2).toFixed(2) : (-Math.random() * 2).toFixed(2);
      const emaValue = entryPrice * (type === 'BUY' ? 0.97 + Math.random() * 0.02 : 1.01 + Math.random() * 0.02);
      
      const indicators = [
        { 
          name: 'RSI(14)', 
          value: rsiValue.toFixed(1), 
          signal: (rsiValue < 40 ? 'bullish' : rsiValue > 60 ? 'bearish' : 'neutral') as 'bullish' | 'bearish' | 'neutral'
        },
        { 
          name: 'MACD', 
          value: macdValue, 
          signal: (parseFloat(macdValue) > 0 ? 'bullish' : 'bearish') as 'bullish' | 'bearish'
        },
        { 
          name: 'EMA(50)', 
          value: `$${emaValue.toFixed(0)}`, 
          signal: (type === 'BUY' ? 'bullish' : 'bearish') as 'bullish' | 'bearish'
        }
      ];
      
      const marketContexts = [
        'Mercado em tendência de alta com correções saudáveis',
        'Fase de consolidação após movimento forte, aguardando definição',
        'Mercado lateral com oportunidades de swing trade',
        'Tendência de baixa com tentativas de reversão',
        'Alta volatilidade devido a notícias macroeconômicas',
        'Mercado em acumulação, buscando direção clara'
      ];
      
      const marketContext = marketContexts[Math.floor(Math.random() * marketContexts.length)];
      
      const exitReasons = isWin ? [
        'Take profit atingido conforme estratégia',
        'Sinal de reversão identificado pela IA',
        'Trailing stop acionado preservando lucro',
        'Alvo de Fibonacci 1.618 alcançado'
      ] : [
        'Stop loss acionado para proteção de capital',
        'Invalidação do setup original',
        'Rompimento de estrutura contrária à posição',
        'Gerenciamento de risco preventivo'
      ];
      
      const exitReason = exitReasons[Math.floor(Math.random() * exitReasons.length)];
      
      return {
        id: `trade-${Date.now()}-${Math.random()}`,
        type,
        entryPrice,
        exitPrice,
        profit,
        profitPercent,
        timestamp: currentCandle,
        status: isWin ? 'win' : 'loss',
        candleIndex: currentCandle,
        aiAnalysis: {
          confidence: Math.round(confidence),
          mainReason,
          supportingFactors,
          indicators,
          marketContext
        },
        result: {
          exitPrice,
          profit,
          profitPercent,
          status: isWin ? 'win' : 'loss',
          exitReason
        }
      };
    }
    return null;
  }, []);

  // Calcular métricas
  const calculateMetrics = useCallback((trades: Trade[], currentEquity: number): BacktestMetrics => {
    const winningTrades = trades.filter(t => t.status === 'win');
    const losingTrades = trades.filter(t => t.status === 'loss');
    
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    
    const avgWin = winningTrades.length > 0 
      ? totalWins / winningTrades.length 
      : 0;
    
    const avgLoss = losingTrades.length > 0 
      ? totalLosses / losingTrades.length 
      : 0;
    
    const profitFactor = totalLosses > 0 
      ? totalWins / totalLosses 
      : totalWins > 0 ? 999 : 0;
    
    const winRate = trades.length > 0 
      ? (winningTrades.length / trades.length) * 100 
      : 0;
    
    // Calcular drawdown
    const maxDrawdown = peakEquityRef.current - currentEquity;
    const maxDrawdownPercent = peakEquityRef.current > 0 
      ? (maxDrawdown / peakEquityRef.current) * 100 
      : 0;
    
    // Update peak
    if (currentEquity > peakEquityRef.current) {
      peakEquityRef.current = currentEquity;
    }
    
    // Calcular Sharpe Ratio simplificado
    const returns = trades.map(t => t.profitPercent);
    const avgReturn = returns.length > 0 
      ? returns.reduce((a, b) => a + b, 0) / returns.length 
      : 0;
    const stdDev = returns.length > 1
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
      : 1;
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) : 0;
    
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
      initialCapital
    };
  }, [initialCapital]);

  // Iniciar backtest
  const start = useCallback((totalCandles: number = 1000, speed: number = 50) => {
    console.log('[BACKTEST] 🚀 Iniciando backtest...');
    
    // Reset state
    tradesRef.current = [];
    equityCurveRef.current = [{ time: 0, equity: initialCapital }];
    peakEquityRef.current = initialCapital;
    startTimeRef.current = Date.now();
    
    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      progress: {
        currentCandle: 0,
        totalCandles,
        progress: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        candlesPerSecond: 0
      },
      metrics: {
        ...prev.metrics,
        currentEquity: initialCapital,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        sharpeRatio: 0
      },
      recentTrades: [],
      equityCurve: [{ time: 0, equity: initialCapital }]
    }));

    let currentCandle = 0;
    let currentEquity = initialCapital;

    // Simular backtest
    intervalRef.current = setInterval(() => {
      currentCandle++;
      
      // Simular trade
      const trade = simulateTrade(currentCandle, currentEquity);
      if (trade) {
        tradesRef.current.push(trade);
        currentEquity += trade.profit;
        equityCurveRef.current.push({ time: currentCandle, equity: currentEquity });
      }
      
      // Calcular progresso
      const progress = (currentCandle / totalCandles) * 100;
      const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
      const candlesPerSecond = currentCandle / elapsedTime;
      const estimatedTimeRemaining = (totalCandles - currentCandle) / candlesPerSecond;
      
      // Calcular métricas
      const metrics = calculateMetrics(tradesRef.current, currentEquity);
      
      // Update state
      setState(prev => ({
        ...prev,
        progress: {
          currentCandle,
          totalCandles,
          progress,
          elapsedTime,
          estimatedTimeRemaining,
          candlesPerSecond
        },
        metrics,
        recentTrades: [...tradesRef.current].reverse().slice(0, 10),
        equityCurve: [...equityCurveRef.current]
      }));
      
      // Finalizar
      if (currentCandle >= totalCandles) {
        console.log('[BACKTEST] ✅ Backtest finalizado!');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setState(prev => ({ ...prev, isRunning: false }));
      }
    }, speed);
  }, [initialCapital, simulateTrade, calculateMetrics]);

  // Pausar backtest
  const pause = useCallback(() => {
    console.log('[BACKTEST] ⏸️ Pausando backtest...');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setState(prev => ({ ...prev, isPaused: true, isRunning: false }));
  }, []);

  // Retomar backtest
  const resume = useCallback(() => {
    console.log('[BACKTEST] ▶️ Retomando backtest...');
    // TODO: Implementar resumo
  }, []);

  // Parar backtest
  const stop = useCallback(() => {
    console.log('[BACKTEST] 🛑 Parando backtest...');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setState(prev => ({ ...prev, isRunning: false, isPaused: false }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    start,
    pause,
    resume,
    stop
  };
}