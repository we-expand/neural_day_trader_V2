/**
 * 🔄 BACKTEST DATA SERVICE
 * 
 * Serviço isolado para buscar dados históricos de candles
 * para o sistema de Replay de Mercado
 * 
 * FEATURES:
 * - Busca dados históricos de Bitcoin (Binance)
 * - Suporta múltiplos timeframes (1m, 5m, 15m, 1h, 4h, 1d)
 * - Cache de dados para performance
 * - Máximo de candles: 1000 por requisição (limite Binance)
 */

interface CandleData {
  time: number; // timestamp em ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoricalDataResponse {
  candles: CandleData[];
  startTime: number;
  endTime: number;
  totalCandles: number;
}

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

class BacktestDataService {
  private cache: Map<string, CandleData[]> = new Map();
  private baseUrl = 'https://api.binance.com/api/v3';

  /**
   * Converte timeframe para formato Binance
   */
  private getIntervalFromTimeframe(timeframe: Timeframe): string {
    const map: Record<Timeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d'
    };
    return map[timeframe];
  }

  /**
   * Busca dados históricos do Bitcoin
   * @param startDate Data inicial
   * @param endDate Data final
   * @param timeframe Timeframe dos candles
   */
  async fetchHistoricalData(
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe = '1m'
  ): Promise<HistoricalDataResponse> {
    const cacheKey = `BTCUSDT_${timeframe}_${startDate.getTime()}_${endDate.getTime()}`;

    console.log('[BACKTEST_DATA] 📊 Buscando dados históricos:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timeframe
    });

    // Verificar cache
    if (this.cache.has(cacheKey)) {
      console.log('[BACKTEST_DATA] ✅ Dados encontrados no cache');
      const candles = this.cache.get(cacheKey)!;
      return {
        candles,
        startTime: candles[0].time,
        endTime: candles[candles.length - 1].time,
        totalCandles: candles.length
      };
    }

    try {
      const interval = this.getIntervalFromTimeframe(timeframe);
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();

      // Binance API: https://api.binance.com/api/v3/klines
      const url = `${this.baseUrl}/klines?symbol=BTCUSDT&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;

      console.log('[BACKTEST_DATA] 🌐 Chamando Binance API:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const rawData: any[] = await response.json();

      // Converter para formato interno
      const candles: CandleData[] = rawData.map((item: any) => ({
        time: item[0], // timestamp
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }));

      console.log('[BACKTEST_DATA] ✅ Dados recebidos:', {
        totalCandles: candles.length,
        firstCandle: new Date(candles[0].time).toISOString(),
        lastCandle: new Date(candles[candles.length - 1].time).toISOString()
      });

      // Salvar no cache
      this.cache.set(cacheKey, candles);

      return {
        candles,
        startTime: candles[0].time,
        endTime: candles[candles.length - 1].time,
        totalCandles: candles.length
      };

    } catch (error) {
      console.error('[BACKTEST_DATA] ❌ Erro ao buscar dados:', error);
      throw error;
    }
  }

  /**
   * Busca múltiplos intervalos (para períodos muito longos)
   * Binance tem limite de 1000 candles por requisição
   */
  async fetchHistoricalDataChunked(
    startDate: Date,
    endDate: Date,
    timeframe: Timeframe = '1m'
  ): Promise<HistoricalDataResponse> {
    console.log('[BACKTEST_DATA] 📦 Buscando dados em chunks...');

    const allCandles: CandleData[] = [];
    const chunkSize = this.getChunkSizeInMs(timeframe);
    let currentStart = startDate.getTime();
    const finalEnd = endDate.getTime();

    while (currentStart < finalEnd) {
      const currentEnd = Math.min(currentStart + chunkSize, finalEnd);
      
      const chunk = await this.fetchHistoricalData(
        new Date(currentStart),
        new Date(currentEnd),
        timeframe
      );

      allCandles.push(...chunk.candles);
      currentStart = currentEnd;

      // Delay para não exceder rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('[BACKTEST_DATA] ✅ Total de candles carregados:', allCandles.length);

    return {
      candles: allCandles,
      startTime: allCandles[0].time,
      endTime: allCandles[allCandles.length - 1].time,
      totalCandles: allCandles.length
    };
  }

  /**
   * Calcula tamanho do chunk baseado no timeframe
   * Para não exceder 1000 candles por requisição
   */
  private getChunkSizeInMs(timeframe: Timeframe): number {
    const msPerCandle: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    // 1000 candles por chunk (limite Binance)
    return 1000 * msPerCandle[timeframe];
  }

  /**
   * Limpa o cache
   */
  clearCache(): void {
    console.log('[BACKTEST_DATA] 🗑️ Cache limpo');
    this.cache.clear();
  }

  /**
   * Obtém dados do cache (se existir)
   */
  getCachedData(startDate: Date, endDate: Date, timeframe: Timeframe): CandleData[] | null {
    const cacheKey = `BTCUSDT_${timeframe}_${startDate.getTime()}_${endDate.getTime()}`;
    return this.cache.get(cacheKey) || null;
  }
}

// Singleton
export const backtestDataService = new BacktestDataService();
export type { CandleData, HistoricalDataResponse, Timeframe };
