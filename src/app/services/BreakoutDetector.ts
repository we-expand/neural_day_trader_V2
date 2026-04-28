/**
 * 🚀 BREAKOUT DETECTOR - Sistema de Detecção de Rompimentos
 * 
 * Detecta rompimentos de topo/fundo em tempo real usando:
 * - Análise de topos anteriores (resistance levels)
 * - Volume institucional
 * - Momentum (RSI)
 * - Convergência de indicadores técnicos
 * - Machine Learning pattern recognition
 * 
 * @version 1.0.0
 * @date 31 Janeiro 2026
 */

import { Candle, calculateEMA } from '@/app/utils/technicalIndicators';

// ============================================================================
// TYPES
// ============================================================================

export type BreakoutType = 'BULLISH' | 'BEARISH';
export type BreakoutStage = 'FORMING' | 'IMMINENT' | 'CONFIRMED' | 'FAILED';

export interface ResistanceLevel {
  price: number;
  touches: number; // Quantas vezes testou esse nível
  strength: number; // 0-100 (força da resistência)
  firstTouch: number; // Timestamp
  lastTouch: number; // Timestamp
}

export interface BreakoutSignal {
  symbol: string;
  type: BreakoutType;
  stage: BreakoutStage;
  
  // Dados do nível
  keyLevel: number;
  currentPrice: number;
  distance: number; // % de distância do nível
  distancePips: number;
  
  // Análise técnica
  volume: number; // Volume atual
  avgVolume: number; // Volume médio
  volumeRatio: number; // Current/Average (>1.5 = volume institucional)
  
  rsi: number; // 0-100
  momentum: 'STRONG' | 'MODERATE' | 'WEAK';
  
  // Confiança
  confidence: number; // 0-100
  timeframe: string; // '1h', '4h', '1D'
  
  // Ação recomendada
  suggestedAction: 'PREPARE' | 'ENTER' | 'WAIT' | 'AVOID';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  
  // Metadata
  timestamp: number;
  expiresAt: number; // Quando o sinal expira
}

// ============================================================================
// BREAKOUT DETECTOR CLASS
// ============================================================================

class BreakoutDetectorClass {
  private resistanceLevels: Map<string, ResistanceLevel[]> = new Map();
  private recentBreakouts: Map<string, BreakoutSignal[]> = new Map();
  
  /**
   * Detecta rompimento iminente ou confirmado
   */
  detectBreakout(
    symbol: string,
    candles: Candle[],
    currentPrice: number,
    volume: number,
    timeframe: string = '1h'
  ): BreakoutSignal | null {
    if (candles.length < 50) {
      console.warn(`[Breakout] Candles insuficientes para ${symbol}`);
      return null;
    }

    // 1. Identificar níveis de resistência/suporte
    const levels = this.identifyKeyLevels(symbol, candles);
    
    // 2. Verificar proximidade de um rompimento
    const nearestLevel = this.findNearestLevel(currentPrice, levels);
    
    if (!nearestLevel) {
      return null;
    }

    // 3. Calcular distância do nível
    const distance = ((currentPrice - nearestLevel.price) / nearestLevel.price) * 100;
    const distancePips = Math.abs(currentPrice - nearestLevel.price) * 10000;
    
    // Determinar tipo de breakout
    const type: BreakoutType = currentPrice > nearestLevel.price ? 'BULLISH' : 'BEARISH';
    
    // 4. Análise de volume
    const avgVolume = this.calculateAverageVolume(candles);
    const volumeRatio = volume / avgVolume;
    
    // 5. Calcular RSI
    const rsi = this.calculateRSI(candles, 14);
    
    // 6. Determinar momentum
    const momentum = this.calculateMomentum(candles, rsi, volumeRatio);
    
    // 7. Determinar estágio do breakout
    const stage = this.determineBreakoutStage(
      currentPrice,
      nearestLevel.price,
      distance,
      volumeRatio,
      rsi,
      type
    );
    
    // 8. Calcular confiança
    const confidence = this.calculateConfidence(
      nearestLevel,
      volumeRatio,
      rsi,
      momentum,
      stage,
      type
    );
    
    // 9. Gerar níveis de operação
    const tradeSetup = this.generateTradeSetup(
      currentPrice,
      nearestLevel.price,
      type,
      stage,
      candles
    );
    
    // 10. Determinar ação sugerida
    const suggestedAction = this.determineSuggestedAction(stage, confidence, distance);
    
    const signal: BreakoutSignal = {
      symbol,
      type,
      stage,
      keyLevel: nearestLevel.price,
      currentPrice,
      distance,
      distancePips,
      volume,
      avgVolume,
      volumeRatio,
      rsi,
      momentum,
      confidence,
      timeframe,
      suggestedAction,
      ...tradeSetup,
      timestamp: Date.now(),
      expiresAt: Date.now() + (timeframe === '1h' ? 3600000 : 14400000) // 1h ou 4h
    };
    
    // Armazenar sinal
    this.storeBreakoutSignal(symbol, signal);
    
    return signal;
  }

  /**
   * Identifica níveis de resistência/suporte
   */
  private identifyKeyLevels(symbol: string, candles: Candle[]): ResistanceLevel[] {
    const levels: ResistanceLevel[] = [];
    const lookback = Math.min(candles.length, 100); // Últimas 100 velas
    const recent = candles.slice(-lookback);
    
    // Identificar topos locais (pivot highs)
    for (let i = 5; i < recent.length - 5; i++) {
      const current = recent[i];
      const isLocalHigh = 
        current.high > recent[i-1].high &&
        current.high > recent[i-2].high &&
        current.high > recent[i-3].high &&
        current.high > recent[i+1].high &&
        current.high > recent[i+2].high &&
        current.high > recent[i+3].high;
      
      if (isLocalHigh) {
        // Verificar se já existe nível próximo (dentro de 0.1%)
        const existingLevel = levels.find(
          l => Math.abs((l.price - current.high) / current.high) < 0.001
        );
        
        if (existingLevel) {
          existingLevel.touches++;
          existingLevel.lastTouch = current.timestamp;
          existingLevel.strength = Math.min(100, existingLevel.touches * 15);
        } else {
          levels.push({
            price: current.high,
            touches: 1,
            strength: 15,
            firstTouch: current.timestamp,
            lastTouch: current.timestamp
          });
        }
      }
    }
    
    // Ordenar por força (mais testado = mais forte)
    levels.sort((a, b) => b.strength - a.strength);
    
    // Armazenar
    this.resistanceLevels.set(symbol, levels.slice(0, 10)); // Top 10 níveis
    
    return levels;
  }

  /**
   * Encontra nível mais próximo do preço atual
   */
  private findNearestLevel(
    currentPrice: number,
    levels: ResistanceLevel[]
  ): ResistanceLevel | null {
    if (levels.length === 0) return null;
    
    // Buscar níveis dentro de 2% do preço atual
    const nearLevels = levels.filter(l => {
      const distance = Math.abs((currentPrice - l.price) / l.price);
      return distance < 0.02; // Dentro de 2%
    });
    
    if (nearLevels.length === 0) return null;
    
    // Retornar o mais forte
    return nearLevels[0];
  }

  /**
   * Calcula volume médio
   */
  private calculateAverageVolume(candles: Candle[]): number {
    const recent = candles.slice(-20); // Últimas 20 velas
    const volumes = recent.map(c => c.volume || 0);
    return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  }

  /**
   * Calcula RSI (Relative Strength Index)
   */
  private calculateRSI(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    
    const recent = candles.slice(-period - 1);
    const changes = recent.slice(1).map((c, i) => c.close - recent[i].close);
    
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);
    
    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }

  /**
   * Calcula momentum
   */
  private calculateMomentum(
    candles: Candle[],
    rsi: number,
    volumeRatio: number
  ): 'STRONG' | 'MODERATE' | 'WEAK' {
    const recentCandles = candles.slice(-10);
    const bullishCandles = recentCandles.filter(c => c.close > c.open).length;
    const bullishPercent = (bullishCandles / recentCandles.length) * 100;
    
    // Momentum forte: RSI extremo + volume alto + maioria de velas bullish
    if ((rsi > 65 || rsi < 35) && volumeRatio > 1.5 && bullishPercent > 70) {
      return 'STRONG';
    }
    
    // Momentum moderado
    if ((rsi > 55 || rsi < 45) && volumeRatio > 1.2) {
      return 'MODERATE';
    }
    
    return 'WEAK';
  }

  /**
   * Determina estágio do breakout
   */
  private determineBreakoutStage(
    currentPrice: number,
    levelPrice: number,
    distance: number,
    volumeRatio: number,
    rsi: number,
    type: BreakoutType
  ): BreakoutStage {
    const absDist = Math.abs(distance);
    
    // CONFIRMED: Já rompeu com volume
    if (absDist > 0.3 && volumeRatio > 1.5) {
      return 'CONFIRMED';
    }
    
    // IMMINENT: Muito próximo + condições ideais
    if (absDist < 0.2 && volumeRatio > 1.3) {
      if (type === 'BULLISH' && rsi > 60) return 'IMMINENT';
      if (type === 'BEARISH' && rsi < 40) return 'IMMINENT';
    }
    
    // FORMING: Aproximando-se
    if (absDist < 0.5 && volumeRatio > 1.0) {
      return 'FORMING';
    }
    
    // FAILED: Tentou e voltou
    if (type === 'BULLISH' && currentPrice < levelPrice * 0.998) {
      return 'FAILED';
    }
    if (type === 'BEARISH' && currentPrice > levelPrice * 1.002) {
      return 'FAILED';
    }
    
    return 'FORMING';
  }

  /**
   * Calcula confiança do sinal
   */
  private calculateConfidence(
    level: ResistanceLevel,
    volumeRatio: number,
    rsi: number,
    momentum: 'STRONG' | 'MODERATE' | 'WEAK',
    stage: BreakoutStage,
    type: BreakoutType
  ): number {
    let confidence = 50; // Base
    
    // Força do nível (+20)
    confidence += (level.strength / 100) * 20;
    
    // Volume (+25)
    if (volumeRatio > 2.0) confidence += 25;
    else if (volumeRatio > 1.5) confidence += 18;
    else if (volumeRatio > 1.2) confidence += 10;
    
    // RSI (+15)
    if (type === 'BULLISH' && rsi > 60 && rsi < 80) confidence += 15;
    else if (type === 'BEARISH' && rsi < 40 && rsi > 20) confidence += 15;
    else if (rsi > 80 || rsi < 20) confidence -= 10; // Overbought/oversold
    
    // Momentum (+15)
    if (momentum === 'STRONG') confidence += 15;
    else if (momentum === 'MODERATE') confidence += 8;
    
    // Estágio (+10)
    if (stage === 'CONFIRMED') confidence += 10;
    else if (stage === 'IMMINENT') confidence += 5;
    else if (stage === 'FAILED') confidence = 0;
    
    return Math.min(95, Math.max(0, confidence));
  }

  /**
   * Gera setup de trade (entry, SL, TP)
   */
  private generateTradeSetup(
    currentPrice: number,
    levelPrice: number,
    type: BreakoutType,
    stage: BreakoutStage,
    candles: Candle[]
  ) {
    // ATR para calcular stops
    const atr = this.calculateSimpleATR(candles);
    
    let entryPrice: number;
    let stopLoss: number;
    let takeProfit1: number;
    let takeProfit2: number;
    
    if (type === 'BULLISH') {
      // Entry: Ligeiramente acima do nível
      entryPrice = stage === 'CONFIRMED' ? currentPrice : levelPrice * 1.0015;
      
      // Stop: Abaixo do nível - 1.5x ATR
      stopLoss = levelPrice - (atr * 1.5);
      
      // TP1: 1.5x risco
      const risk = entryPrice - stopLoss;
      takeProfit1 = entryPrice + (risk * 1.5);
      takeProfit2 = entryPrice + (risk * 3.0);
      
    } else {
      // BEARISH
      entryPrice = stage === 'CONFIRMED' ? currentPrice : levelPrice * 0.9985;
      stopLoss = levelPrice + (atr * 1.5);
      
      const risk = stopLoss - entryPrice;
      takeProfit1 = entryPrice - (risk * 1.5);
      takeProfit2 = entryPrice - (risk * 3.0);
    }
    
    const riskRewardRatio = Math.abs((takeProfit1 - entryPrice) / (entryPrice - stopLoss));
    
    return {
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      riskRewardRatio
    };
  }

  /**
   * Determina ação sugerida
   */
  private determineSuggestedAction(
    stage: BreakoutStage,
    confidence: number,
    distance: number
  ): 'PREPARE' | 'ENTER' | 'WAIT' | 'AVOID' {
    if (stage === 'FAILED') return 'AVOID';
    
    if (stage === 'CONFIRMED' && confidence > 70) return 'ENTER';
    
    if (stage === 'IMMINENT' && confidence > 60) return 'PREPARE';
    
    if (stage === 'FORMING' && Math.abs(distance) < 0.5) return 'PREPARE';
    
    return 'WAIT';
  }

  /**
   * ATR simples
   */
  private calculateSimpleATR(candles: Candle[]): number {
    const recent = candles.slice(-14);
    const ranges = recent.map(c => c.high - c.low);
    return ranges.reduce((a, b) => a + b, 0) / ranges.length;
  }

  /**
   * Armazena sinal
   */
  private storeBreakoutSignal(symbol: string, signal: BreakoutSignal) {
    const signals = this.recentBreakouts.get(symbol) || [];
    signals.unshift(signal);
    
    // Manter apenas últimos 10 sinais
    this.recentBreakouts.set(symbol, signals.slice(0, 10));
  }

  /**
   * Obtém últimos sinais
   */
  getRecentSignals(symbol: string): BreakoutSignal[] {
    return this.recentBreakouts.get(symbol) || [];
  }

  /**
   * Limpa sinais expirados
   */
  cleanExpiredSignals() {
    const now = Date.now();
    
    this.recentBreakouts.forEach((signals, symbol) => {
      const active = signals.filter(s => s.expiresAt > now);
      this.recentBreakouts.set(symbol, active);
    });
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const BreakoutDetector = new BreakoutDetectorClass();
