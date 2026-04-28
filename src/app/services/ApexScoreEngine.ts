export interface MarketData {
  symbol: string;
  currentPrice: number;
  volatilityATR: number;
  volume24h: number;
  recentHeadlines: string[];
}

export interface ScoreResult {
  score: number;
  classification: string;
  insight: string;
  technicalAnalysis: {
    indicators: { name: string; value: string }[];
  };
}

// ✅ TIPO COMPLETO PARA APEX SCORE RESPONSE
export interface ApexScoreResponse {
  score: number;
  classification: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  marketPhase: 'EXPANSION' | 'RETRACTION' | 'CONSOLIDATION' | 'ACCUMULATION' | 'DISTRIBUTION';
  components: {
    technical: number;
    sentiment: number;
    institutionalflow: number;
  };
  technicalAnalysis: {
    indicators: Array<{
      name: string;
      value: string;
      signal: 'BUY' | 'SELL' | 'NEUTRAL';
    }>;
  };
  orderFlow: {
    buyPressure: number;
    sellPressure: number;
    imbalance: 'BUY' | 'SELL' | 'NEUTRAL';
  };
  volatility: {
    vix: number;
    status: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
  };
  insight: string;
  execution: {
    suggestedEntry: number;
    stopLoss: number;
    takeProfitTarget1: number;
    takeProfitTarget2: number;
    maxLeverage: number;
  };
  timestamp: string;
}

// Global log controls
const DEBUG_SCORE = false; // Set to true to enable score engine logs

export class ApexScoreEngine {
  private static priceHistory: Map<string, number[]> = new Map();
  
  /**
   * 🎯 CÁLCULO COMPLETO DO APEX SCORE COM TODOS OS INDICADORES E SINAIS
   */
  static async calculate(data: MarketData, timeframe: string): Promise<ApexScoreResponse> {
    const { symbol, currentPrice, volatilityATR, volume24h } = data;
    
    // CRITICAL FIX: Use REAL price data to determine trend
    // Store price history for trend detection
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const history = this.priceHistory.get(symbol)!;
    history.push(currentPrice);
    
    // Keep only last 20 prices (sliding window)
    if (history.length > 20) {
      history.shift();
    }
    
    // =========================================================================
    // 1. CÁLCULO DE TENDÊNCIA
    // =========================================================================
    let trend = 0; // -1 = bearish, 0 = neutral, 1 = bullish
    let trendStrength = 0; // 0-100
    
    if (history.length >= 3) {
      const avg = history.reduce((a, b) => a + b, 0) / history.length;
      const recentAvg = history.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, history.slice(-5).length);
      
      // Trend Direction
      if (recentAvg > avg * 1.002) {
        trend = 1; // Bullish
        trendStrength = Math.min(100, ((recentAvg - avg) / avg) * 10000);
      } else if (recentAvg < avg * 0.998) {
        trend = -1; // Bearish
        trendStrength = Math.min(100, ((avg - recentAvg) / avg) * 10000);
      } else {
        trend = 0; // Neutral
        trendStrength = 0;
      }
      
      if (DEBUG_SCORE) {
        console.warn(`📈 [APEX SCORE ENGINE] ${symbol}:`, {
          currentPrice,
          historicalAvg: avg.toFixed(5),
          recentAvg: recentAvg.toFixed(5),
          trend: trend === 1 ? 'ALTA' : trend === -1 ? 'BAIXA' : 'NEUTRO',
          trendStrength: trendStrength.toFixed(1) + '%'
        });
      }
    } else {
      // Not enough data, use neutral
      trend = 0;
      trendStrength = 50;
      if (DEBUG_SCORE) {
        console.warn(`⚠️ [APEX SCORE ENGINE] ${symbol}: Dados insuficientes, usando neutro`);
      }
    }
    
    // =========================================================================
    // 2. CÁLCULO DO RSI (Relative Strength Index)
    // =========================================================================
    let rsi = 50;
    let rsiSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    
    if (history.length >= 14) {
      // Calcular ganhos e perdas
      let gains = 0;
      let losses = 0;
      
      for (let i = 1; i < Math.min(14, history.length); i++) {
        const change = history[history.length - i] - history[history.length - i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      
      if (avgLoss === 0) {
        rsi = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
    } else {
      // Aproximação baseada em tendência
      if (trend === 1) {
        rsi = 50 + (trendStrength * 0.3); // 50-80 for bullish
      } else if (trend === -1) {
        rsi = 50 - (trendStrength * 0.3); // 20-50 for bearish
      }
    }
    
    // RSI Signal Logic
    if (rsi > 70) rsiSignal = 'SELL'; // Sobrecomprado
    else if (rsi < 30) rsiSignal = 'BUY'; // Sobrevendido
    else if (rsi > 55) rsiSignal = 'BUY'; // Levemente altista
    else if (rsi < 45) rsiSignal = 'SELL'; // Levemente baixista
    else rsiSignal = 'NEUTRAL';
    
    // =========================================================================
    // 3. CÁLCULO DE FIBONACCI
    // =========================================================================
    const fibValue = this.calculateFibonacciLevel(history);
    let fibSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    
    // Fibonacci signal baseado em níveis de retração
    if (fibValue.includes('0.236') || fibValue.includes('0.382')) {
      fibSignal = trend === 1 ? 'BUY' : 'SELL';
    } else if (fibValue.includes('0.618') || fibValue.includes('0.786')) {
      fibSignal = trend === 1 ? 'SELL' : 'BUY';
    } else if (fibValue.includes('0.500')) {
      fibSignal = 'NEUTRAL';
    }
    
    // =========================================================================
    // 4. CÁLCULO DE VOLUMETRIA
    // =========================================================================
    const volumeRatio = volume24h / 15000000; // Normalizado
    let volSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    
    if (volumeRatio > 1.5 && trend === 1) volSignal = 'BUY'; // Alto volume + alta
    else if (volumeRatio > 1.5 && trend === -1) volSignal = 'SELL'; // Alto volume + baixa
    else if (volumeRatio < 0.7) volSignal = 'NEUTRAL'; // Baixo volume
    else volSignal = trend === 1 ? 'BUY' : trend === -1 ? 'SELL' : 'NEUTRAL';
    
    const volValue = `${(volumeRatio * 100).toFixed(0)}%`;
    
    // =========================================================================
    // 5. CÁLCULO DE OBV (On-Balance Volume)
    // =========================================================================
    let obvSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    const obvTrend = trend === 1 ? '+' : trend === -1 ? '-' : '~';
    
    // OBV signal alinhado com tendência de volume
    if (volumeRatio > 1.2 && trend === 1) obvSignal = 'BUY';
    else if (volumeRatio > 1.2 && trend === -1) obvSignal = 'SELL';
    else obvSignal = 'NEUTRAL';
    
    const obvValue = `${obvTrend}${(volume24h / 1000000).toFixed(1)}M`;
    
    // =========================================================================
    // 6. CÁLCULO DO SCORE BASE
    // =========================================================================
    let baseScore = 50; // Neutral baseline
    
    if (trend === 1) {
      baseScore = 50 + (trendStrength * 0.5); // 50-100
    } else if (trend === -1) {
      baseScore = 50 - (trendStrength * 0.5); // 0-50
    }
    
    // Add volatility component
    const volatilityBoost = volatilityATR > 0.002 ? 10 : 0;
    
    // Add volume component
    const volumeBoost = volume24h > 1000000 ? 5 : 0;
    
    // Final score with bounds
    const finalScore = Math.max(0, Math.min(100, baseScore + volatilityBoost + volumeBoost));
    
    // =========================================================================
    // 7. CLASSIFICAÇÃO E FASE DE MERCADO
    // =========================================================================
    let classification: ApexScoreResponse['classification'] = 'NEUTRAL';
    if (finalScore > 75) classification = 'STRONG_BUY';
    else if (finalScore > 60) classification = 'BUY';
    else if (finalScore < 25) classification = 'STRONG_SELL';
    else if (finalScore < 40) classification = 'SELL';
    
    // Market Phase
    let marketPhase: ApexScoreResponse['marketPhase'] = 'CONSOLIDATION';
    if (finalScore > 70 && volumeRatio > 1.2) marketPhase = 'EXPANSION';
    else if (finalScore < 30 && volumeRatio > 1.2) marketPhase = 'RETRACTION';
    else if (volumeRatio > 1.0 && finalScore > 55) marketPhase = 'ACCUMULATION';
    else if (volumeRatio > 1.0 && finalScore < 45) marketPhase = 'DISTRIBUTION';
    
    // =========================================================================
    // 8. COMPONENTES DO SCORE
    // =========================================================================
    const technicalComponent = finalScore;
    const sentimentComponent = trend === 1 ? 60 + Math.random() * 20 : trend === -1 ? 20 + Math.random() * 20 : 45 + Math.random() * 10;
    const institutionalComponent = volumeRatio > 1.2 ? 70 + Math.random() * 15 : 40 + Math.random() * 20;
    
    // =========================================================================
    // 9. ORDER FLOW (PRESSÃO DE COMPRA/VENDA)
    // =========================================================================
    let buyPressure = 50;
    let sellPressure = 50;
    
    if (trend === 1) {
      buyPressure = 50 + (trendStrength * 0.4);
      sellPressure = 100 - buyPressure;
    } else if (trend === -1) {
      sellPressure = 50 + (trendStrength * 0.4);
      buyPressure = 100 - sellPressure;
    }
    
    const imbalance = buyPressure > 60 ? 'BUY' : sellPressure > 60 ? 'SELL' : 'NEUTRAL';
    
    // =========================================================================
    // 10. VOLATILIDADE
    // =========================================================================
    const vix = Math.min(100, (volatilityATR / 0.001) * 15);
    let vixStatus: ApexScoreResponse['volatility']['status'] = 'NORMAL';
    
    if (vix < 12) vixStatus = 'LOW';
    else if (vix > 25) vixStatus = 'HIGH';
    else if (vix > 40) vixStatus = 'EXTREME';
    
    // =========================================================================
    // 11. EXECUTION PARAMETERS
    // =========================================================================
    const atrDistance = volatilityATR * 2.5; // 2.5 ATR para stop
    
    const execution = {
      suggestedEntry: currentPrice,
      stopLoss: trend === 1 ? currentPrice - atrDistance : currentPrice + atrDistance,
      takeProfitTarget1: trend === 1 ? currentPrice + (atrDistance * 1.5) : currentPrice - (atrDistance * 1.5),
      takeProfitTarget2: trend === 1 ? currentPrice + (atrDistance * 2.5) : currentPrice - (atrDistance * 2.5),
      maxLeverage: vix < 15 ? 10 : vix < 25 ? 5 : 2
    };
    
    // =========================================================================
    // 12. INSIGHT FINAL
    // =========================================================================
    let insight = '';
    if (finalScore > 70) {
      insight = `🚀 EXPANSÃO DE ALTA: Tendência ascendente forte detectada. RSI em ${rsi.toFixed(1)} sugere momentum comprador. Volume ${volumeRatio > 1.2 ? 'acima da média' : 'moderado'}.`;
    } else if (finalScore > 55) {
      insight = `📈 ALTA MODERADA: Movimento altista confirmado por análise técnica. Fibonacci em ${fibValue}. Pressão compradora em ${buyPressure.toFixed(0)}%.`;
    } else if (finalScore < 30) {
      insight = `📉 QUEDA FORTE: Tendência de baixa dominante. RSI em ${rsi.toFixed(1)} indica sobrevenda. Pressão vendedora em ${sellPressure.toFixed(0)}%.`;
    } else if (finalScore < 45) {
      insight = `⬇️ BAIXA MODERADA: Pressão vendedora detectada. Volume ${volumeRatio > 1 ? 'confirmando movimento' : 'fraco'}.`;
    } else {
      insight = `⚖️ MERCADO NEUTRO: Aguardando definição de tendência. Score em ${finalScore.toFixed(0)}. Volatilidade ${vixStatus.toLowerCase()}.`;
    }
    
    if (DEBUG_SCORE) {
      console.warn(`🎯 [SCORE FINAL] ${symbol}:`, {
        score: finalScore.toFixed(0),
        classification,
        insight
      });
    }
    
    // =========================================================================
    // 13. RETORNO COMPLETO
    // =========================================================================
    return {
      score: Math.round(finalScore),
      classification,
      marketPhase,
      components: {
        technical: Math.round(technicalComponent),
        sentiment: Math.round(sentimentComponent),
        institutionalflow: Math.round(institutionalComponent)
      },
      technicalAnalysis: {
        indicators: [
          { 
            name: 'RSI (14)', 
            value: rsi.toFixed(1),
            signal: rsiSignal
          },
          { 
            name: 'Fibonacci', 
            value: fibValue,
            signal: fibSignal
          },
          { 
            name: 'Volumetria', 
            value: volValue,
            signal: volSignal
          },
          { 
            name: 'OBV', 
            value: obvValue,
            signal: obvSignal
          }
        ]
      },
      orderFlow: {
        buyPressure: Math.round(buyPressure),
        sellPressure: Math.round(sellPressure),
        imbalance
      },
      volatility: {
        vix: Math.round(vix),
        status: vixStatus
      },
      insight,
      execution,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 🎯 CALCULA NÍVEL DE FIBONACCI BASEADO NA POSIÇÃO DO PREÇO
   */
  private static calculateFibonacciLevel(history: number[]): string {
    if (history.length < 10) return '0.500';
    
    const high = Math.max(...history);
    const low = Math.min(...history);
    const current = history[history.length - 1];
    const range = high - low;
    
    if (range === 0) return '0.500';
    
    const position = (current - low) / range;
    
    // Retornar nível de Fibonacci mais próximo
    if (position < 0.236) return '0.000';
    else if (position < 0.382) return '0.236';
    else if (position < 0.500) return '0.382';
    else if (position < 0.618) return '0.500';
    else if (position < 0.786) return '0.618';
    else if (position < 1.0) return '0.786';
    else return '1.000';
  }
}