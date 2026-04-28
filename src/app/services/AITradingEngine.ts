/**
 * 🧠 AI TRADING ENGINE - Motor Completo de Trading
 * 
 * Engine que utiliza TODA a potência da IA:
 * - Expert em Price Action
 * - Análise de Fibonacci (expansões e retrações)
 * - Gerenciamento de Risco avançado
 * - Confluência de múltiplos indicadores
 * - Estrutura de mercado
 * - Order Flow
 * - Supply & Demand Zones
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AIAnalysis {
  // Decisão
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  
  // Price Action
  priceAction: {
    pattern: string;
    strength: number;
    description: string;
  };
  
  // Fibonacci
  fibonacci: {
    levels: { level: number; price: number; type: 'support' | 'resistance' }[];
    currentZone: string;
    expansionTarget: number;
    description: string;
  };
  
  // Risk Management
  riskManagement: {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
    positionSize: number;
    maxRisk: number;
    description: string;
  };
  
  // Indicadores
  indicators: {
    rsi: { value: number; signal: 'bullish' | 'bearish' | 'neutral'; overbought: boolean; oversold: boolean };
    macd: { value: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' };
    ema: { ema20: number; ema50: number; ema200: number; alignment: 'bullish' | 'bearish' | 'mixed' };
    bollinger: { upper: number; middle: number; lower: number; position: 'upper' | 'middle' | 'lower' };
    atr: { value: number; volatility: 'low' | 'medium' | 'high' };
    adx: { value: number; trend: 'strong' | 'weak' };
  };
  
  // Market Structure
  marketStructure: {
    trend: 'uptrend' | 'downtrend' | 'sideways';
    higherHighs: boolean;
    higherLows: boolean;
    lowerHighs: boolean;
    lowerLows: boolean;
    keyLevels: { price: number; type: 'support' | 'resistance'; strength: number }[];
    description: string;
  };
  
  // Confluência
  confluence: {
    score: number; // 0-100
    factors: string[];
    description: string;
  };
  
  // Order Flow (simulado)
  orderFlow: {
    buyPressure: number;
    sellPressure: number;
    delta: number;
    imbalance: 'buy' | 'sell' | 'neutral';
    description: string;
  };
  
  // Supply & Demand
  supplyDemand: {
    zones: { price: number; type: 'supply' | 'demand'; strength: number }[];
    nearestZone: { price: number; type: 'supply' | 'demand'; distance: number } | null;
    description: string;
  };
}

export class AITradingEngine {
  private candles: Candle[] = [];
  private capital: number;
  private maxRiskPercent: number = 2; // 2% por trade
  
  constructor(capital: number) {
    this.capital = capital;
  }
  
  /**
   * Analisar mercado e tomar decisão
   */
  analyze(candles: Candle[]): AIAnalysis {
    this.candles = candles;
    const current = candles[candles.length - 1];
    
    // 1. PRICE ACTION ANALYSIS
    const priceAction = this.analyzePriceAction(candles);
    
    // 2. FIBONACCI ANALYSIS
    const fibonacci = this.analyzeFibonacci(candles);
    
    // 3. INDICATORS
    const indicators = this.analyzeIndicators(candles);
    
    // 4. MARKET STRUCTURE
    const marketStructure = this.analyzeMarketStructure(candles);
    
    // 5. ORDER FLOW
    const orderFlow = this.analyzeOrderFlow(candles);
    
    // 6. SUPPLY & DEMAND
    const supplyDemand = this.analyzeSupplyDemand(candles);
    
    // 7. CONFLUÊNCIA
    const confluence = this.calculateConfluence(
      priceAction,
      fibonacci,
      indicators,
      marketStructure,
      orderFlow,
      supplyDemand
    );
    
    // 8. DECISÃO
    const action = this.makeDecision(confluence, indicators, marketStructure);
    
    // 9. RISK MANAGEMENT
    const riskManagement = this.calculateRiskManagement(
      action,
      current.close,
      indicators.atr.value,
      marketStructure
    );
    
    return {
      action,
      confidence: confluence.score,
      priceAction,
      fibonacci,
      riskManagement,
      indicators,
      marketStructure,
      confluence,
      orderFlow,
      supplyDemand
    };
  }
  
  /**
   * 1. ANÁLISE DE PRICE ACTION
   */
  private analyzePriceAction(candles: Candle[]) {
    const recent = candles.slice(-10);
    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    
    // Detectar padrões
    const patterns = [];
    let pattern = 'Consolidação';
    let strength = 50;
    
    // Bullish Engulfing
    if (current.close > current.open && 
        prev.close < prev.open &&
        current.close > prev.open &&
        current.open < prev.close) {
      pattern = 'Bullish Engulfing';
      strength = 85;
      patterns.push('Bullish Engulfing detectado');
    }
    
    // Bearish Engulfing
    if (current.close < current.open && 
        prev.close > prev.open &&
        current.close < prev.open &&
        current.open > prev.close) {
      pattern = 'Bearish Engulfing';
      strength = 85;
      patterns.push('Bearish Engulfing detectado');
    }
    
    // Pin Bar (Hammer/Shooting Star)
    const bodySize = Math.abs(current.close - current.open);
    const totalSize = current.high - current.low;
    const upperWick = current.high - Math.max(current.open, current.close);
    const lowerWick = Math.min(current.open, current.close) - current.low;
    
    if (bodySize < totalSize * 0.3) {
      if (lowerWick > upperWick * 2) {
        pattern = 'Hammer (Bullish)';
        strength = 75;
        patterns.push('Hammer formado - possível reversão de alta');
      } else if (upperWick > lowerWick * 2) {
        pattern = 'Shooting Star (Bearish)';
        strength = 75;
        patterns.push('Shooting Star formado - possível reversão de baixa');
      }
    }
    
    // Doji
    if (bodySize < totalSize * 0.1) {
      pattern = 'Doji (Indecisão)';
      strength = 40;
      patterns.push('Doji indica indecisão do mercado');
    }
    
    return {
      pattern,
      strength,
      description: patterns.length > 0 
        ? patterns.join('. ')
        : 'Movimento lateral sem padrões claros de reversão'
    };
  }
  
  /**
   * 2. ANÁLISE DE FIBONACCI
   */
  private analyzeFibonacci(candles: Candle[]) {
    const recent = candles.slice(-50);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    const range = high - low;
    const current = candles[candles.length - 1];
    
    // Níveis de Fibonacci (retracement)
    const levels = [
      { level: 0, price: high, type: 'resistance' as const },
      { level: 23.6, price: high - range * 0.236, type: 'support' as const },
      { level: 38.2, price: high - range * 0.382, type: 'support' as const },
      { level: 50, price: high - range * 0.5, type: 'support' as const },
      { level: 61.8, price: high - range * 0.618, type: 'support' as const },
      { level: 78.6, price: high - range * 0.786, type: 'support' as const },
      { level: 100, price: low, type: 'support' as const }
    ];
    
    // Encontrar zona atual
    let currentZone = '50% (Equilíbrio)';
    for (let i = 0; i < levels.length - 1; i++) {
      if (current.close <= levels[i].price && current.close >= levels[i + 1].price) {
        currentZone = `${levels[i].level}% - ${levels[i + 1].level}%`;
        break;
      }
    }
    
    // Expansão de Fibonacci (targets)
    const expansionTarget = high + range * 0.618; // 161.8% extension
    
    return {
      levels,
      currentZone,
      expansionTarget,
      description: `Preço em zona ${currentZone} de Fibonacci. Próximo alvo de expansão em $${expansionTarget.toFixed(2)}`
    };
  }
  
  /**
   * 3. ANÁLISE DE INDICADORES
   */
  private analyzeIndicators(candles: Candle[]) {
    // RSI
    const rsi = this.calculateRSI(candles, 14);
    const rsiSignal = rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'neutral';
    
    // MACD
    const macd = this.calculateMACD(candles);
    const macdTrend = macd.histogram > 0 ? 'bullish' : 'bearish';
    
    // EMAs
    const ema20 = this.calculateEMA(candles, 20);
    const ema50 = this.calculateEMA(candles, 50);
    const ema200 = this.calculateEMA(candles, 200);
    const emaAlignment = ema20 > ema50 && ema50 > ema200 
      ? 'bullish' 
      : ema20 < ema50 && ema50 < ema200 
        ? 'bearish' 
        : 'mixed';
    
    // Bollinger Bands
    const bollinger = this.calculateBollinger(candles, 20, 2);
    const current = candles[candles.length - 1];
    const bbPosition = current.close > bollinger.upper 
      ? 'upper' 
      : current.close < bollinger.lower 
        ? 'lower' 
        : 'middle';
    
    // ATR
    const atr = this.calculateATR(candles, 14);
    const avgATR = atr;
    const volatility = atr < avgATR * 0.7 
      ? 'low' 
      : atr > avgATR * 1.3 
        ? 'high' 
        : 'medium';
    
    // ADX
    const adx = this.calculateADX(candles, 14);
    const adxTrend = adx > 25 ? 'strong' : 'weak';
    
    return {
      rsi: { 
        value: rsi, 
        signal: rsiSignal as 'bullish' | 'bearish' | 'neutral',
        overbought: rsi > 70,
        oversold: rsi < 30
      },
      macd: { 
        value: macd.macd, 
        signal: macd.signal, 
        histogram: macd.histogram,
        trend: macdTrend as 'bullish' | 'bearish'
      },
      ema: { 
        ema20, 
        ema50, 
        ema200, 
        alignment: emaAlignment as 'bullish' | 'bearish' | 'mixed'
      },
      bollinger: { 
        upper: bollinger.upper, 
        middle: bollinger.middle, 
        lower: bollinger.lower,
        position: bbPosition as 'upper' | 'middle' | 'lower'
      },
      atr: { 
        value: atr, 
        volatility: volatility as 'low' | 'medium' | 'high'
      },
      adx: { 
        value: adx, 
        trend: adxTrend as 'strong' | 'weak'
      }
    };
  }
  
  /**
   * 4. ANÁLISE DE ESTRUTURA DE MERCADO
   */
  private analyzeMarketStructure(candles: Candle[]) {
    const recent = candles.slice(-20);
    
    // Identificar HH, HL, LH, LL
    const highs = recent.map((c, i) => ({ index: i, price: c.high }));
    const lows = recent.map((c, i) => ({ index: i, price: c.low }));
    
    let higherHighs = false;
    let higherLows = false;
    let lowerHighs = false;
    let lowerLows = false;
    
    // Simplificado: comparar últimos 3 topos e fundos
    if (highs.length >= 3) {
      higherHighs = highs[highs.length - 1].price > highs[highs.length - 2].price &&
                    highs[highs.length - 2].price > highs[highs.length - 3].price;
      lowerHighs = highs[highs.length - 1].price < highs[highs.length - 2].price &&
                   highs[highs.length - 2].price < highs[highs.length - 3].price;
    }
    
    if (lows.length >= 3) {
      higherLows = lows[lows.length - 1].price > lows[lows.length - 2].price &&
                   lows[lows.length - 2].price > lows[lows.length - 3].price;
      lowerLows = lows[lows.length - 1].price < lows[lows.length - 2].price &&
                  lows[lows.length - 2].price < lows[lows.length - 3].price;
    }
    
    // Determinar tendência
    let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
    if (higherHighs && higherLows) trend = 'uptrend';
    else if (lowerHighs && lowerLows) trend = 'downtrend';
    
    // Key levels (simplificado)
    const allPrices = recent.flatMap(c => [c.high, c.low]);
    const keyLevels = [
      { price: Math.max(...allPrices), type: 'resistance' as const, strength: 90 },
      { price: Math.min(...allPrices), type: 'support' as const, strength: 90 }
    ];
    
    return {
      trend,
      higherHighs,
      higherLows,
      lowerHighs,
      lowerLows,
      keyLevels,
      description: trend === 'uptrend' 
        ? 'Estrutura de alta intacta com HH e HL'
        : trend === 'downtrend'
          ? 'Estrutura de baixa com LH e LL'
          : 'Mercado em consolidação lateral'
    };
  }
  
  /**
   * 5. ANÁLISE DE ORDER FLOW (Simulado)
   */
  private analyzeOrderFlow(candles: Candle[]) {
    const recent = candles.slice(-5);
    
    // Simular pressão de compra/venda baseado em volume e movimento
    let buyPressure = 0;
    let sellPressure = 0;
    
    recent.forEach(candle => {
      if (candle.close > candle.open) {
        buyPressure += candle.volume;
      } else {
        sellPressure += candle.volume;
      }
    });
    
    const total = buyPressure + sellPressure;
    buyPressure = (buyPressure / total) * 100;
    sellPressure = (sellPressure / total) * 100;
    
    const delta = buyPressure - sellPressure;
    const imbalance = delta > 10 ? 'buy' : delta < -10 ? 'sell' : 'neutral';
    
    return {
      buyPressure,
      sellPressure,
      delta,
      imbalance: imbalance as 'buy' | 'sell' | 'neutral',
      description: imbalance === 'buy'
        ? `Forte pressão compradora detectada (${buyPressure.toFixed(1)}% vs ${sellPressure.toFixed(1)}%)`
        : imbalance === 'sell'
          ? `Forte pressão vendedora detectada (${sellPressure.toFixed(1)}% vs ${buyPressure.toFixed(1)}%)`
          : 'Order flow equilibrado'
    };
  }
  
  /**
   * 6. ANÁLISE DE SUPPLY & DEMAND
   */
  private analyzeSupplyDemand(candles: Candle[]) {
    const recent = candles.slice(-30);
    const current = candles[candles.length - 1];
    
    // Identificar zonas (simplificado)
    const zones: { price: number; type: 'supply' | 'demand'; strength: number }[] = [];
    
    // Demand zones (onde houve forte compra)
    for (let i = 2; i < recent.length - 2; i++) {
      if (recent[i].low < recent[i-1].low && 
          recent[i].low < recent[i-2].low &&
          recent[i+1].close > recent[i].close &&
          recent[i+2].close > recent[i+1].close) {
        zones.push({
          price: recent[i].low,
          type: 'demand',
          strength: 75
        });
      }
    }
    
    // Supply zones (onde houve forte venda)
    for (let i = 2; i < recent.length - 2; i++) {
      if (recent[i].high > recent[i-1].high && 
          recent[i].high > recent[i-2].high &&
          recent[i+1].close < recent[i].close &&
          recent[i+2].close < recent[i+1].close) {
        zones.push({
          price: recent[i].high,
          type: 'supply',
          strength: 75
        });
      }
    }
    
    // Encontrar zona mais próxima
    let nearestZone = null;
    let minDistance = Infinity;
    
    for (const zone of zones) {
      const distance = Math.abs(current.close - zone.price);
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = { ...zone, distance };
      }
    }
    
    return {
      zones,
      nearestZone,
      description: nearestZone
        ? `Próximo a zona de ${nearestZone.type === 'demand' ? 'demanda' : 'oferta'} em $${nearestZone.price.toFixed(2)}`
        : 'Sem zonas relevantes próximas'
    };
  }
  
  /**
   * 7. CALCULAR CONFLUÊNCIA
   */
  private calculateConfluence(
    priceAction: any,
    fibonacci: any,
    indicators: any,
    marketStructure: any,
    orderFlow: any,
    supplyDemand: any
  ) {
    const factors: string[] = [];
    let score = 0;
    
    // Price Action (0-20 pontos)
    if (priceAction.strength > 70) {
      score += 20;
      factors.push(`${priceAction.pattern} confirmado`);
    } else if (priceAction.strength > 50) {
      score += 10;
    }
    
    // Fibonacci (0-15 pontos)
    if (fibonacci.currentZone.includes('61.8')) {
      score += 15;
      factors.push('Preço em zona dourada de Fibonacci (61.8%)');
    }
    
    // Indicadores (0-30 pontos)
    let indicatorScore = 0;
    if (indicators.rsi.oversold) {
      indicatorScore += 10;
      factors.push('RSI em sobrevendido');
    } else if (indicators.rsi.overbought) {
      indicatorScore += 10;
      factors.push('RSI em sobrecomprado');
    }
    
    if (indicators.macd.trend === 'bullish' && indicators.macd.histogram > 0) {
      indicatorScore += 10;
      factors.push('MACD com momentum bullish');
    } else if (indicators.macd.trend === 'bearish' && indicators.macd.histogram < 0) {
      indicatorScore += 10;
      factors.push('MACD com momentum bearish');
    }
    
    if (indicators.ema.alignment === 'bullish') {
      indicatorScore += 10;
      factors.push('EMAs alinhadas para alta');
    } else if (indicators.ema.alignment === 'bearish') {
      indicatorScore += 10;
      factors.push('EMAs alinhadas para baixa');
    }
    
    score += indicatorScore;
    
    // Market Structure (0-20 pontos)
    if (marketStructure.trend === 'uptrend' && marketStructure.higherHighs && marketStructure.higherLows) {
      score += 20;
      factors.push('Estrutura de mercado bullish intacta');
    } else if (marketStructure.trend === 'downtrend' && marketStructure.lowerHighs && marketStructure.lowerLows) {
      score += 20;
      factors.push('Estrutura de mercado bearish intacta');
    }
    
    // Order Flow (0-10 pontos)
    if (orderFlow.imbalance !== 'neutral') {
      score += 10;
      factors.push(orderFlow.description);
    }
    
    // Supply & Demand (0-5 pontos)
    if (supplyDemand.nearestZone && supplyDemand.nearestZone.distance < 100) {
      score += 5;
      factors.push(supplyDemand.description);
    }
    
    return {
      score: Math.min(score, 100),
      factors,
      description: factors.length > 0
        ? `${factors.length} fatores de confluência identificados`
        : 'Baixa confluência - aguardar setup melhor'
    };
  }
  
  /**
   * 8. TOMAR DECISÃO
   */
  private makeDecision(
    confluence: any,
    indicators: any,
    marketStructure: any
  ): 'BUY' | 'SELL' | 'HOLD' {
    // Requer alta confluência (>60) para operar
    if (confluence.score < 60) return 'HOLD';
    
    // BUY conditions
    if (indicators.rsi.oversold &&
        indicators.macd.trend === 'bullish' &&
        marketStructure.trend === 'uptrend') {
      return 'BUY';
    }
    
    // SELL conditions
    if (indicators.rsi.overbought &&
        indicators.macd.trend === 'bearish' &&
        marketStructure.trend === 'downtrend') {
      return 'SELL';
    }
    
    return 'HOLD';
  }
  
  /**
   * 9. GERENCIAMENTO DE RISCO
   */
  private calculateRiskManagement(
    action: 'BUY' | 'SELL' | 'HOLD',
    entryPrice: number,
    atr: number,
    marketStructure: any
  ) {
    if (action === 'HOLD') {
      return {
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        riskRewardRatio: 0,
        positionSize: 0,
        maxRisk: this.capital * (this.maxRiskPercent / 100),
        description: 'Sem posição aberta'
      };
    }
    
    // Stop Loss: 2x ATR
    const stopDistance = atr * 2;
    const stopLoss = action === 'BUY' 
      ? entryPrice - stopDistance 
      : entryPrice + stopDistance;
    
    // Take Profit: 3x ATR (R:R 1.5:1)
    const takeProfitDistance = atr * 3;
    const takeProfit = action === 'BUY'
      ? entryPrice + takeProfitDistance
      : entryPrice - takeProfitDistance;
    
    // Risk:Reward
    const riskRewardRatio = Math.abs((takeProfit - entryPrice) / (entryPrice - stopLoss));
    
    // Position Size baseado em risco de 2%
    const maxRisk = this.capital * (this.maxRiskPercent / 100);
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const positionSize = maxRisk / riskPerUnit;
    
    return {
      entryPrice,
      stopLoss,
      takeProfit,
      riskRewardRatio,
      positionSize: Math.floor(positionSize),
      maxRisk,
      description: `Risco de ${this.maxRiskPercent}% ($${maxRisk.toFixed(2)}) | R:R ${riskRewardRatio.toFixed(2)}:1`
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // INDICADORES TÉCNICOS
  // ═══════════════════════════════════════════════════════════
  
  private calculateRSI(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    
    const changes = candles.slice(-period - 1).map((c, i, arr) => 
      i === 0 ? 0 : c.close - arr[i - 1].close
    ).slice(1);
    
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    
    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  private calculateMACD(candles: Candle[]) {
    const ema12 = this.calculateEMA(candles, 12);
    const ema26 = this.calculateEMA(candles, 26);
    const macd = ema12 - ema26;
    
    // Signal line (EMA 9 of MACD) - simplificado
    const signal = macd * 0.9;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }
  
  private calculateEMA(candles: Candle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].close;
    
    const multiplier = 2 / (period + 1);
    let ema = candles.slice(-period)[0].close;
    
    for (let i = 1; i < period; i++) {
      ema = (candles[candles.length - period + i].close - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  private calculateBollinger(candles: Candle[], period: number = 20, stdDev: number = 2) {
    const recent = candles.slice(-period);
    const closes = recent.map(c => c.close);
    const middle = closes.reduce((a, b) => a + b, 0) / period;
    
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - middle, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    return {
      upper: middle + (std * stdDev),
      middle,
      lower: middle - (std * stdDev)
    };
  }
  
  private calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 100;
    
    const trs = candles.slice(-period).map((c, i, arr) => {
      if (i === 0) return c.high - c.low;
      const prev = arr[i - 1];
      return Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      );
    });
    
    return trs.reduce((a, b) => a + b, 0) / period;
  }
  
  private calculateADX(candles: Candle[], period: number = 14): number {
    // Simplificado - retorna valor entre 0-50
    if (candles.length < period) return 15;
    
    const recent = candles.slice(-period);
    let upMoves = 0;
    let downMoves = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const up = recent[i].high - recent[i - 1].high;
      const down = recent[i - 1].low - recent[i].low;
      
      if (up > down && up > 0) upMoves++;
      if (down > up && down > 0) downMoves++;
    }
    
    const trending = Math.max(upMoves, downMoves);
    return (trending / period) * 50;
  }
}
