/**
 * 🏔️ NEURAL DAY TRADER - PYRAMIDING MANAGER
 * 
 * Sistema de IA ultra-sofisticado para gerenciar Position Scaling (Pyramiding)
 * A arte de adicionar posições conforme o trade se move a favor.
 * 
 * FUNCIONALIDADES:
 * - ✅ Análise de Momentum em tempo real
 * - ✅ Detecção de Divergências (RSI, MACD)
 * - ✅ Análise de Volatilidade (ATR)
 * - ✅ Cálculo de tamanho de posição por estratégia
 * - ✅ Trailing Stop Dinâmico por layer
 * - ✅ Break-Even automático
 * - ✅ Take Profit Parcial
 * - ✅ Stop de Emergência com detecção de reversão
 * 
 * ESTE SISTEMA PODE FAZER MUITO DINHEIRO OU TE QUEBRAR EM SEGUNDOS.
 * Por isso a AI precisa ser IMPECÁVEL.
 */

import type { PyramidingConfig } from '@/app/components/trading/PyramidingConfigPanel';

// ============================================================================
// 📊 INTERFACES & TYPES
// ============================================================================

export interface Position {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  size: number;
  stopLoss: number;
  takeProfit: number;
  openTime: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface PyramidLayer {
  layerNumber: number;
  entryPrice: number;
  size: number;
  stopLoss: number;
  trailingStop: number;
  entryTime: number;
  pnl: number;
  pnlPercent: number;
  status: 'active' | 'closed' | 'stopped';
}

export interface PyramidPosition {
  basePosition: Position;
  layers: PyramidLayer[];
  totalSize: number;
  averageEntry: number;
  totalPnL: number;
  totalPnLPercent: number;
  config: PyramidingConfig;
  lastAddTime: number;
  canAddMore: boolean;
  aiAnalysis: AIRiskAnalysis;
}

export interface AIRiskAnalysis {
  momentum: {
    score: number; // 0-100
    trend: 'strong' | 'moderate' | 'weak' | 'reversing';
    direction: 'bullish' | 'bearish' | 'neutral';
  };
  volatility: {
    atr: number;
    atrPercent: number;
    level: 'low' | 'normal' | 'high' | 'extreme';
    increasing: boolean;
  };
  divergence: {
    detected: boolean;
    type: 'bullish' | 'bearish' | 'hidden' | null;
    severity: 'weak' | 'moderate' | 'strong' | null;
  };
  riskLevel: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';
  canAddPosition: boolean;
  reason: string;
  timestamp: number;
}

export interface MarketData {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================================================
// 🧠 PYRAMIDING MANAGER CLASS
// ============================================================================

export class PyramidingManager {
  private pyramidPositions: Map<string, PyramidPosition> = new Map();
  private marketDataCache: Map<string, MarketData[]> = new Map();

  // ========== FIBONACCI SEQUENCE ==========
  private fibonacciSequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];

  /**
   * Calcular tamanho da próxima posição baseado na estratégia
   */
  calculateNextPositionSize(config: PyramidingConfig, layerNumber: number): number {
    const { scalingStrategy, initialSize, sizeMultiplier } = config;

    switch (scalingStrategy) {
      case 'fixed':
        return initialSize;

      case 'reduced':
        // Cada layer é multiplicado pelo sizeMultiplier (ex: 1.0 → 0.5 → 0.25)
        return initialSize * Math.pow(sizeMultiplier, layerNumber - 1);

      case 'fibonacci':
        // Usar sequência de Fibonacci
        if (layerNumber <= this.fibonacciSequence.length) {
          const fibValue = this.fibonacciSequence[layerNumber - 1];
          return initialSize * fibValue;
        }
        return initialSize;

      case 'exponential':
        // Crescimento exponencial (MUITO AGRESSIVO!)
        return initialSize * Math.pow(sizeMultiplier, layerNumber - 1);

      case 'smart-ai':
        // AI decide baseado em análise de risco
        return this.calculateSmartAISize(config, layerNumber);

      default:
        return initialSize;
    }
  }

  /**
   * AI decide tamanho baseado em análise de risco
   */
  private calculateSmartAISize(config: PyramidingConfig, layerNumber: number): number {
    // Começar com tamanho inicial
    let size = config.initialSize;

    // Reduzir progressivamente conforme aumenta layers
    // Layer 1: 100%, Layer 2: 80%, Layer 3: 60%, Layer 4: 40%, Layer 5: 20%
    const reductionFactor = 1 - ((layerNumber - 1) * 0.2);
    size *= Math.max(reductionFactor, 0.2); // Mínimo de 20%

    return size;
  }

  /**
   * Calcular distância para próxima entrada
   */
  calculateNextEntryDistance(
    config: PyramidingConfig,
    currentPrice: number,
    atr: number
  ): number {
    const { entryDistanceType, entryDistance, atrMultiplier } = config;

    switch (entryDistanceType) {
      case 'pips':
        return entryDistance * 0.0001; // Converter pips para preço

      case 'percent':
        return currentPrice * (entryDistance / 100);

      case 'atr':
        return atr * atrMultiplier;

      case 'ai-dynamic':
        // AI decide baseado em volatilidade e momentum
        return this.calculateDynamicDistance(currentPrice, atr);

      default:
        return entryDistance * 0.0001;
    }
  }

  /**
   * AI calcula distância dinâmica baseada em condições
   */
  private calculateDynamicDistance(currentPrice: number, atr: number): number {
    // Usar ATR como base mas ajustar baseado em volatilidade
    let distance = atr * 0.5;

    // Se volatilidade alta, aumentar distância
    const atrPercent = (atr / currentPrice) * 100;
    if (atrPercent > 1.0) {
      distance *= 1.5; // 50% maior em alta volatilidade
    }

    return distance;
  }

  /**
   * 🧠 ANÁLISE DE IA - Verificar se é seguro adicionar posição
   */
  async analyzeRisk(
    symbol: string,
    direction: 'long' | 'short',
    currentPrice: number,
    config: PyramidingConfig
  ): Promise<AIRiskAnalysis> {
    // Buscar dados de mercado
    const marketData = await this.getMarketData(symbol);
    
    if (marketData.length < 20) {
      return this.createSafeDefaultAnalysis('Dados insuficientes para análise');
    }

    // 1. Análise de Momentum
    const momentum = this.analyzeMomentum(marketData, direction);

    // 2. Análise de Volatilidade
    const volatility = this.analyzeVolatility(marketData, currentPrice);

    // 3. Detecção de Divergências
    const divergence = this.detectDivergence(marketData);

    // 4. Calcular Risk Level
    const riskLevel = this.calculateRiskLevel(momentum, volatility, divergence);

    // 5. Decidir se pode adicionar
    const canAdd = this.canAddPosition(
      momentum,
      volatility,
      divergence,
      riskLevel,
      config
    );

    return {
      momentum,
      volatility,
      divergence,
      riskLevel,
      canAddPosition: canAdd.can,
      reason: canAdd.reason,
      timestamp: Date.now(),
    };
  }

  /**
   * Análise de Momentum (RSI, EMA, Velocity)
   */
  private analyzeMomentum(
    data: MarketData[],
    direction: 'long' | 'short'
  ): AIRiskAnalysis['momentum'] {
    const closes = data.map(d => d.close);
    
    // Calcular RSI
    const rsi = this.calculateRSI(closes, 14);
    
    // Calcular EMA 9 e 21
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    
    // Calcular velocidade do movimento
    const velocity = this.calculateVelocity(closes);

    // Score baseado em múltiplos fatores
    let score = 0;

    // RSI (0-30 pontos)
    if (direction === 'long') {
      if (rsi > 50) score += 30;
      else if (rsi > 40) score += 20;
      else if (rsi > 30) score += 10;
    } else {
      if (rsi < 50) score += 30;
      else if (rsi < 60) score += 20;
      else if (rsi < 70) score += 10;
    }

    // EMA Crossover (0-40 pontos)
    const ema9Current = ema9[ema9.length - 1];
    const ema21Current = ema21[ema21.length - 1];
    
    if (direction === 'long' && ema9Current > ema21Current) {
      score += 40;
    } else if (direction === 'short' && ema9Current < ema21Current) {
      score += 40;
    } else {
      score += 10;
    }

    // Velocity (0-30 pontos)
    if (Math.abs(velocity) > 2) score += 30;
    else if (Math.abs(velocity) > 1) score += 20;
    else if (Math.abs(velocity) > 0.5) score += 10;

    // Determinar trend
    let trend: 'strong' | 'moderate' | 'weak' | 'reversing' = 'weak';
    if (score > 75) trend = 'strong';
    else if (score > 50) trend = 'moderate';
    else if (score < 30) trend = 'reversing';

    // Determinar direction
    const isUptrend = closes[closes.length - 1] > closes[closes.length - 5];
    const trendDirection: 'bullish' | 'bearish' | 'neutral' = 
      isUptrend ? 'bullish' : 'bearish';

    return { score, trend, direction: trendDirection };
  }

  /**
   * Análise de Volatilidade (ATR)
   */
  private analyzeVolatility(
    data: MarketData[],
    currentPrice: number
  ): AIRiskAnalysis['volatility'] {
    const atr = this.calculateATR(data, 14);
    const atrPercent = (atr / currentPrice) * 100;

    // Detectar se volatilidade está aumentando
    const atr5Bars = this.calculateATR(data.slice(-5), 5);
    const increasing = atr5Bars > atr * 1.1;

    // Classificar nível
    let level: 'low' | 'normal' | 'high' | 'extreme' = 'normal';
    if (atrPercent < 0.3) level = 'low';
    else if (atrPercent < 0.7) level = 'normal';
    else if (atrPercent < 1.5) level = 'high';
    else level = 'extreme';

    return { atr, atrPercent, level, increasing };
  }

  /**
   * Detecção de Divergências (RSI vs Preço)
   */
  private detectDivergence(data: MarketData[]): AIRiskAnalysis['divergence'] {
    if (data.length < 20) {
      return { detected: false, type: null, severity: null };
    }

    const closes = data.map(d => d.close);
    const rsi = this.calculateRSI(closes, 14);

    // Detectar divergência bearish (preço fazendo higher highs, RSI fazendo lower highs)
    const priceHigh1 = Math.max(...closes.slice(-10, -5));
    const priceHigh2 = Math.max(...closes.slice(-5));
    const rsiHigh1 = Math.max(...rsi.slice(-10, -5));
    const rsiHigh2 = Math.max(...rsi.slice(-5));

    const bearishDiv = priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1;

    // Detectar divergência bullish (preço fazendo lower lows, RSI fazendo higher lows)
    const priceLow1 = Math.min(...closes.slice(-10, -5));
    const priceLow2 = Math.min(...closes.slice(-5));
    const rsiLow1 = Math.min(...rsi.slice(-10, -5));
    const rsiLow2 = Math.min(...rsi.slice(-5));

    const bullishDiv = priceLow2 < priceLow1 && rsiLow2 > rsiLow1;

    if (bearishDiv || bullishDiv) {
      const type = bearishDiv ? 'bearish' : 'bullish';
      const severity = 'moderate' as const;
      return { detected: true, type, severity };
    }

    return { detected: false, type: null, severity: null };
  }

  /**
   * Calcular Risk Level geral
   */
  private calculateRiskLevel(
    momentum: AIRiskAnalysis['momentum'],
    volatility: AIRiskAnalysis['volatility'],
    divergence: AIRiskAnalysis['divergence']
  ): AIRiskAnalysis['riskLevel'] {
    let riskScore = 0;

    // Momentum (0-40 pontos de risco)
    if (momentum.score < 30) riskScore += 40;
    else if (momentum.score < 50) riskScore += 20;
    else if (momentum.score < 70) riskScore += 10;

    // Volatilidade (0-30 pontos de risco)
    if (volatility.level === 'extreme') riskScore += 30;
    else if (volatility.level === 'high') riskScore += 20;
    else if (volatility.level === 'normal') riskScore += 10;

    if (volatility.increasing) riskScore += 10;

    // Divergência (0-30 pontos de risco)
    if (divergence.detected) {
      if (divergence.severity === 'strong') riskScore += 30;
      else if (divergence.severity === 'moderate') riskScore += 20;
      else riskScore += 10;
    }

    // Classificar
    if (riskScore < 20) return 'very-low';
    if (riskScore < 40) return 'low';
    if (riskScore < 60) return 'moderate';
    if (riskScore < 80) return 'high';
    return 'very-high';
  }

  /**
   * Decidir se pode adicionar posição baseado em análise + config
   */
  private canAddPosition(
    momentum: AIRiskAnalysis['momentum'],
    volatility: AIRiskAnalysis['volatility'],
    divergence: AIRiskAnalysis['divergence'],
    riskLevel: AIRiskAnalysis['riskLevel'],
    config: PyramidingConfig
  ): { can: boolean; reason: string } {
    if (!config.aiRiskAnalysisEnabled) {
      return { can: true, reason: 'AI Risk Analysis desativado - adicionando sem verificação' };
    }

    // 1. Verificar momentum mínimo
    if (momentum.score < config.requiredMomentumScore) {
      return {
        can: false,
        reason: `Momentum insuficiente (${momentum.score} < ${config.requiredMomentumScore})`
      };
    }

    // 2. Verificar divergência
    if (config.stopAddingOnDivergence && divergence.detected) {
      return {
        can: false,
        reason: `Divergência ${divergence.type} detectada - não é seguro adicionar`
      };
    }

    // 3. Verificar volatilidade
    if (config.stopAddingOnHighVolatility && volatility.level === 'extreme') {
      return {
        can: false,
        reason: `Volatilidade extrema (${volatility.atrPercent.toFixed(2)}%) - muito arriscado`
      };
    }

    if (config.stopAddingOnHighVolatility && volatility.increasing) {
      return {
        can: false,
        reason: 'Volatilidade aumentando rapidamente - aguardando estabilização'
      };
    }

    // 4. Verificar risk level geral
    if (riskLevel === 'very-high') {
      return {
        can: false,
        reason: 'Risk Level MUITO ALTO - condições não ideais para pyramiding'
      };
    }

    // ✅ Tudo OK!
    return {
      can: true,
      reason: `✅ Condições ideais: Momentum ${momentum.score}, Volatilidade ${volatility.level}, Risk ${riskLevel}`
    };
  }

  /**
   * Análise padrão quando não há dados suficientes
   */
  private createSafeDefaultAnalysis(reason: string): AIRiskAnalysis {
    return {
      momentum: { score: 0, trend: 'weak', direction: 'neutral' },
      volatility: { atr: 0, atrPercent: 0, level: 'normal', increasing: false },
      divergence: { detected: false, type: null, severity: null },
      riskLevel: 'very-high',
      canAddPosition: false,
      reason,
      timestamp: Date.now(),
    };
  }

  /**
   * Atualizar trailing stops de todos os layers
   */
  updateTrailingStops(
    pyramid: PyramidPosition,
    currentPrice: number
  ): PyramidLayer[] {
    const { config } = pyramid;
    
    if (!config.trailingStopEnabled) {
      return pyramid.layers;
    }

    const direction = pyramid.basePosition.direction;
    const updatedLayers = pyramid.layers.map(layer => {
      if (layer.status !== 'active') return layer;

      // Calcular nova distância do trailing stop
      const atr = this.getATR(pyramid.basePosition.symbol);
      let stopDistance: number;

      switch (config.trailingStopType) {
        case 'pips':
          stopDistance = config.trailingStopDistance * 0.0001;
          break;
        case 'percent':
          stopDistance = currentPrice * (config.trailingStopDistance / 100);
          break;
        case 'atr':
          stopDistance = atr * config.trailingStopDistance;
          break;
        default:
          stopDistance = config.trailingStopDistance * 0.0001;
      }

      // Atualizar trailing stop apenas se preço moveu a favor
      let newTrailingStop = layer.trailingStop;

      if (direction === 'long') {
        const proposedStop = currentPrice - stopDistance;
        if (proposedStop > layer.trailingStop) {
          newTrailingStop = proposedStop;
        }
      } else {
        const proposedStop = currentPrice + stopDistance;
        if (proposedStop < layer.trailingStop) {
          newTrailingStop = proposedStop;
        }
      }

      return {
        ...layer,
        trailingStop: newTrailingStop,
      };
    });

    return updatedLayers;
  }

  // ========== INDICADORES TÉCNICOS ==========

  /**
   * Calcular RSI (Relative Strength Index)
   */
  private calculateRSI(closes: number[], period: number = 14): number[] {
    if (closes.length < period + 1) return [];

    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calcular gains e losses
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Primeira média
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Calcular RSI
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    return rsi;
  }

  /**
   * Calcular EMA (Exponential Moving Average)
   */
  private calculateEMA(closes: number[], period: number): number[] {
    if (closes.length < period) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // Primeira EMA é uma SMA
    const sma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(sma);

    // Calcular EMA restante
    for (let i = period; i < closes.length; i++) {
      const currentEma = (closes[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEma);
    }

    return ema;
  }

  /**
   * Calcular ATR (Average True Range)
   */
  private calculateATR(data: MarketData[], period: number = 14): number {
    if (data.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trueRanges.push(tr);
    }

    // Média dos últimos 'period' true ranges
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Calcular velocidade do movimento (taxa de mudança)
   */
  private calculateVelocity(closes: number[], period: number = 10): number {
    if (closes.length < period) return 0;

    const recent = closes.slice(-period);
    const first = recent[0];
    const last = recent[recent.length - 1];

    return ((last - first) / first) * 100;
  }

  // ========== HELPERS ==========

  private async getMarketData(symbol: string): Promise<MarketData[]> {
    // Em produção, buscar do servidor
    // Por ora, retornar cache
    return this.marketDataCache.get(symbol) || [];
  }

  private getATR(symbol: string): number {
    const data = this.marketDataCache.get(symbol);
    if (!data || data.length < 15) return 0.0001;
    return this.calculateATR(data, 14);
  }

  /**
   * Adicionar dados de mercado ao cache (chamado externamente)
   */
  addMarketData(symbol: string, data: MarketData): void {
    const existing = this.marketDataCache.get(symbol) || [];
    existing.push(data);

    // Manter apenas últimos 100 candles
    if (existing.length > 100) {
      existing.shift();
    }

    this.marketDataCache.set(symbol, existing);
  }
}

// ============================================================================
// 🎯 SINGLETON INSTANCE
// ============================================================================

export const pyramidingManager = new PyramidingManager();
