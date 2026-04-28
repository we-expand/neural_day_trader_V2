/**
 * 🎮 USE BACKTEST REPLAY HOOK
 * 
 * Hook isolado para gerenciar o estado do sistema de Replay de Mercado
 * 
 * FEATURES:
 * - Controle de play/pause
 * - Ajuste de velocidade (0.5x, 1x, 2x, 5x, 10x)
 * - Navegação no tempo (seek)
 * - Estado isolado do resto da aplicação
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { backtestDataService, CandleData, Timeframe } from '../services/BacktestDataService';

export type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10;

export type ReplayState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

interface UseBacktestReplayReturn {
  // Estado
  state: ReplayState;
  currentCandle: CandleData | null;
  currentIndex: number;
  totalCandles: number;
  elapsedTime: number; // em segundos
  totalTime: number; // em segundos
  speed: ReplaySpeed;
  selectedDate: Date;
  timeframe: Timeframe;
  progress: number; // 0-100
  
  // Ações
  startReplay: (date: Date, timeframe: Timeframe) => Promise<void>;
  stopReplay: () => void;
  togglePlayPause: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
  seekToIndex: (index: number) => void;
  seekToProgress: (progress: number) => void;
  skipForward: (seconds: number) => void;
  skipBackward: (seconds: number) => void;
  reset: () => void;
  
  // Dados
  allCandles: CandleData[];
  error: string | null;
}

export function useBacktestReplay(): UseBacktestReplayReturn {
  const [state, setState] = useState<ReplayState>('idle');
  const [allCandles, setAllCandles] = useState<CandleData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Candle atual
  const currentCandle = allCandles[currentIndex] || null;

  // Cálculos derivados
  const totalCandles = allCandles.length;
  const progress = totalCandles > 0 ? (currentIndex / totalCandles) * 100 : 0;
  
  // Tempo (baseado no timeframe)
  const getTimeInSeconds = (index: number): number => {
    const msPerCandle: Record<Timeframe, number> = {
      '1m': 60,
      '5m': 5 * 60,
      '15m': 15 * 60,
      '1h': 60 * 60,
      '4h': 4 * 60 * 60,
      '1d': 24 * 60 * 60
    };
    return index * msPerCandle[timeframe];
  };

  const elapsedTime = getTimeInSeconds(currentIndex);
  const totalTime = getTimeInSeconds(totalCandles);

  /**
   * Inicia o replay
   */
  const startReplay = useCallback(async (date: Date, tf: Timeframe) => {
    console.log('[BACKTEST_REPLAY] 🚀 Iniciando replay:', { date, timeframe: tf });
    
    setState('loading');
    setError(null);
    setSelectedDate(date);
    setTimeframe(tf);

    try {
      // Buscar dados do dia inteiro
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('[BACKTEST_REPLAY] 📊 Buscando dados:', {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString()
      });

      const result = await backtestDataService.fetchHistoricalData(
        startOfDay,
        endOfDay,
        tf
      );

      if (result.candles.length === 0) {
        throw new Error('Nenhum dado encontrado para esta data');
      }

      console.log('[BACKTEST_REPLAY] ✅ Dados carregados:', {
        totalCandles: result.totalCandles,
        firstTime: new Date(result.startTime).toISOString(),
        lastTime: new Date(result.endTime).toISOString()
      });

      setAllCandles(result.candles);
      setCurrentIndex(0);
      setState('paused');
      startTimeRef.current = Date.now();

    } catch (err: any) {
      console.error('[BACKTEST_REPLAY] ❌ Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao carregar dados históricos');
      setState('idle');
    }
  }, []);

  /**
   * Para o replay
   */
  const stopReplay = useCallback(() => {
    console.log('[BACKTEST_REPLAY] ⏹️ Replay parado');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setState('idle');
    setAllCandles([]);
    setCurrentIndex(0);
    setError(null);
  }, []);

  /**
   * Toggle play/pause
   */
  const togglePlayPause = useCallback(() => {
    if (state === 'playing') {
      console.log('[BACKTEST_REPLAY] ⏸️ Pausado');
      setState('paused');
    } else if (state === 'paused') {
      console.log('[BACKTEST_REPLAY] ▶️ Reproduzindo');
      setState('playing');
    }
  }, [state]);

  /**
   * Navega para um índice específico
   */
  const seekToIndex = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, totalCandles - 1));
    console.log('[BACKTEST_REPLAY] ⏩ Seek para índice:', clampedIndex);
    setCurrentIndex(clampedIndex);
  }, [totalCandles]);

  /**
   * Navega para uma posição percentual (0-100)
   */
  const seekToProgress = useCallback((progressValue: number) => {
    const index = Math.floor((progressValue / 100) * totalCandles);
    seekToIndex(index);
  }, [totalCandles, seekToIndex]);

  /**
   * Pula para frente N segundos
   */
  const skipForward = useCallback((seconds: number) => {
    const msPerCandle: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    const candlesToSkip = Math.floor((seconds * 1000) / msPerCandle[timeframe]);
    seekToIndex(currentIndex + candlesToSkip);
  }, [currentIndex, timeframe, seekToIndex]);

  /**
   * Pula para trás N segundos
   */
  const skipBackward = useCallback((seconds: number) => {
    skipForward(-seconds);
  }, [skipForward]);

  /**
   * Reseta para o início
   */
  const reset = useCallback(() => {
    console.log('[BACKTEST_REPLAY] 🔄 Reset para início');
    setCurrentIndex(0);
    setState('paused');
  }, []);

  /**
   * Efeito para controlar o avanço automático
   */
  useEffect(() => {
    if (state === 'playing' && totalCandles > 0) {
      // Calcular intervalo baseado na velocidade
      // 1x = 1 candle por segundo (ajustar conforme necessário)
      const baseInterval = 1000; // 1 segundo por candle em 1x
      const interval = baseInterval / speed;

      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          
          if (next >= totalCandles) {
            console.log('[BACKTEST_REPLAY] 🏁 Replay finalizado');
            setState('ended');
            return prev;
          }
          
          return next;
        });
      }, interval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [state, speed, totalCandles]);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    // Estado
    state,
    currentCandle,
    currentIndex,
    totalCandles,
    elapsedTime,
    totalTime,
    speed,
    selectedDate,
    timeframe,
    progress,
    
    // Ações
    startReplay,
    stopReplay,
    togglePlayPause,
    setSpeed,
    seekToIndex,
    seekToProgress,
    skipForward,
    skipBackward,
    reset,
    
    // Dados
    allCandles,
    error
  };
}
