/**
 * ⚡ MOTOR DE TENDÊNCIA DE MERCADO
 * Agrega TODOS os insumos de múltiplas fontes e calcula a tendência do mercado
 * 
 * FONTES DE DADOS:
 * 1. Pressão de Mercado (Buy/Sell Volume)
 * 2. Fibonacci Retracements/Extensions
 * 3. Médias Móveis (MA20, MA50, MA200)
 * 4. Notícias da Web (Sentiment Analysis)
 * 5. Redes Sociais (Twitter, Reddit, Telegram)
 * 6. Order Book (Depth Analysis)
 * 7. Indicadores Técnicos (RSI, MACD, Bollinger)
 * 8. Volume Profile
 * 9. Market Sentiment Index
 * 10. Institutional Flow
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface MarketDataInput {
  symbol: string;
  timeframe: string;
  price: number;
  volume: number;
  timestamp: Date;
}

export interface PressureAnalysis {
  buyPressure: number;    // 0-100
  sellPressure: number;   // 0-100
  netPressure: number;    // -100 a +100
  volumeRatio: number;    // Buy volume / Sell volume
  score: number;          // -100 a +100 (negativo = bearish, positivo = bullish)
  confidence: number;     // 0-100
}

export interface FibonacciAnalysis {
  currentLevel: number;        // Qual nível Fib está agora (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)
  nearestSupport: number;      // Preço do suporte Fib mais próximo
  nearestResistance: number;   // Preço da resistência Fib mais próxima
  bias: 'bullish' | 'bearish' | 'neutral'; // Se está próximo de suporte (bullish) ou resistência (bearish)
  score: number;               // -100 a +100
  confidence: number;          // 0-100
}

export interface MovingAveragesAnalysis {
  ma20: number;
  ma50: number;
  ma200: number;
  priceVsMA20: number;     // % distância do preço vs MA20
  priceVsMA50: number;
  priceVsMA200: number;
  alignment: 'bullish' | 'bearish' | 'mixed'; // MA20 > MA50 > MA200 = bullish
  crossovers: {
    goldenCross: boolean;   // MA50 cruzou MA200 pra cima
    deathCross: boolean;    // MA50 cruzou MA200 pra baixo
  };
  score: number;            // -100 a +100
  confidence: number;       // 0-100
}

export interface NewsAnalysis {
  totalArticles: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  sentimentScore: number;  // -100 a +100
  topKeywords: string[];
  urgency: 'low' | 'medium' | 'high';
  confidence: number;      // 0-100
  recentHeadlines: Array<{
    title: string;
    source: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    timestamp: Date;
  }>;
}

export interface SocialMediaAnalysis {
  twitterSentiment: number;   // -100 a +100
  redditSentiment: number;    // -100 a +100
  telegramSentiment: number;  // -100 a +100
  overallSentiment: number;   // Média ponderada
  volume: number;             // Quantidade de mentions (0-100 normalizado)
  trending: boolean;          // Se o ativo está trending
  topHashtags: string[];
  influencerBias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;         // 0-100
}

export interface TechnicalIndicatorsAnalysis {
  rsi: number;                    // 0-100
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    position: 'overbought' | 'oversold' | 'neutral'; // Onde o preço está
  };
  stochastic: number;             // 0-100
  overallScore: number;           // -100 a +100
  confidence: number;             // 0-100
}

export interface OrderBookAnalysis {
  bidAskRatio: number;           // Bids / Asks
  depthImbalance: number;        // -100 a +100 (negativo = mais asks, positivo = mais bids)
  largeOrders: {
    bidWalls: number[];          // Preços com grandes bids
    askWalls: number[];          // Preços com grandes asks
  };
  spoofingDetected: boolean;
  score: number;                 // -100 a +100
  confidence: number;            // 0-100
}

export interface VolumeProfileAnalysis {
  poc: number;                   // Point of Control (preço com maior volume)
  valueAreaHigh: number;         // 70% do volume acima
  valueAreaLow: number;          // 70% do volume abaixo
  positionVsPOC: 'above' | 'below' | 'at';
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  score: number;                 // -100 a +100
  confidence: number;            // 0-100
}

export interface InstitutionalFlowAnalysis {
  netFlow: number;               // Positive = institutional buying, Negative = selling
  largeTransactions: number;     // Quantidade de transações > $100k
  smartMoneyBias: 'accumulating' | 'distributing' | 'neutral';
  score: number;                 // -100 a +100
  confidence: number;            // 0-100
}

export interface MarketTendency {
  symbol: string;
  direction: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  score: number;                 // -100 a +100 (agregado de todas as fontes)
  confidence: number;            // 0-100 (quão confiável é essa tendência)
  timeframe: string;
  timestamp: Date;
  
  // Breakdown por fonte
  sources: {
    pressure: PressureAnalysis;
    fibonacci: FibonacciAnalysis;
    movingAverages: MovingAveragesAnalysis;
    news: NewsAnalysis;
    socialMedia: SocialMediaAnalysis;
    technicalIndicators: TechnicalIndicatorsAnalysis;
    orderBook: OrderBookAnalysis;
    volumeProfile: VolumeProfileAnalysis;
    institutionalFlow: InstitutionalFlowAnalysis;
  };
  
  // Pesos de cada fonte (soma = 100)
  weights: {
    pressure: number;
    fibonacci: number;
    movingAverages: number;
    news: number;
    socialMedia: number;
    technicalIndicators: number;
    orderBook: number;
    volumeProfile: number;
    institutionalFlow: number;
  };
  
  // Recomendação
  recommendation: {
    action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    reasoning: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}

// ============================================
// PESOS PADRÃO (AJUSTÁVEIS)
// ============================================

export const DEFAULT_WEIGHTS = {
  pressure: 15,              // Volume e pressão de compra/venda
  fibonacci: 8,              // Níveis de Fibonacci
  movingAverages: 12,        // Médias móveis
  news: 10,                  // Notícias da web
  socialMedia: 8,            // Redes sociais
  technicalIndicators: 18,   // RSI, MACD, Bollinger, etc
  orderBook: 12,             // Order book depth
  volumeProfile: 10,         // Volume profile
  institutionalFlow: 7,      // Fluxo institucional
};

// ============================================
// MOTOR DE CÁLCULO
// ============================================

export class MarketTendencyEngine {
  private weights = DEFAULT_WEIGHTS;

  /**
   * Atualizar pesos de cada fonte
   */
  setWeights(newWeights: Partial<typeof DEFAULT_WEIGHTS>) {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Calcular tendência agregada de mercado
   */
  async calculateTendency(input: MarketDataInput): Promise<MarketTendency> {
    console.log('[TENDENCY ENGINE] 🧠 Calculando tendência para:', input.symbol);

    // 1. Calcular cada fonte em paralelo
    const [
      pressure,
      fibonacci,
      movingAverages,
      news,
      socialMedia,
      technicalIndicators,
      orderBook,
      volumeProfile,
      institutionalFlow
    ] = await Promise.all([
      this.calculatePressure(input),
      this.calculateFibonacci(input),
      this.calculateMovingAverages(input),
      this.analyzeNews(input.symbol),
      this.analyzeSocialMedia(input.symbol),
      this.calculateTechnicalIndicators(input),
      this.analyzeOrderBook(input),
      this.analyzeVolumeProfile(input),
      this.analyzeInstitutionalFlow(input),
    ]);

    // 2. Calcular score agregado (média ponderada)
    const totalWeight = Object.values(this.weights).reduce((a, b) => a + b, 0);
    const aggregatedScore = (
      (pressure.score * this.weights.pressure) +
      (fibonacci.score * this.weights.fibonacci) +
      (movingAverages.score * this.weights.movingAverages) +
      (news.sentimentScore * this.weights.news) +
      (socialMedia.overallSentiment * this.weights.socialMedia) +
      (technicalIndicators.overallScore * this.weights.technicalIndicators) +
      (orderBook.score * this.weights.orderBook) +
      (volumeProfile.score * this.weights.volumeProfile) +
      (institutionalFlow.score * this.weights.institutionalFlow)
    ) / totalWeight;

    // 3. Calcular confiança agregada
    const aggregatedConfidence = (
      (pressure.confidence * this.weights.pressure) +
      (fibonacci.confidence * this.weights.fibonacci) +
      (movingAverages.confidence * this.weights.movingAverages) +
      (news.confidence * this.weights.news) +
      (socialMedia.confidence * this.weights.socialMedia) +
      (technicalIndicators.confidence * this.weights.technicalIndicators) +
      (orderBook.confidence * this.weights.orderBook) +
      (volumeProfile.confidence * this.weights.volumeProfile) +
      (institutionalFlow.confidence * this.weights.institutionalFlow)
    ) / totalWeight;

    // 4. Determinar direção
    const direction = this.getDirection(aggregatedScore);

    // 5. Gerar recomendação
    const recommendation = this.generateRecommendation(
      aggregatedScore,
      aggregatedConfidence,
      { pressure, fibonacci, movingAverages, news, socialMedia, technicalIndicators, orderBook, volumeProfile, institutionalFlow }
    );

    const tendency: MarketTendency = {
      symbol: input.symbol,
      direction,
      score: aggregatedScore,
      confidence: aggregatedConfidence,
      timeframe: input.timeframe,
      timestamp: new Date(),
      sources: {
        pressure,
        fibonacci,
        movingAverages,
        news,
        socialMedia,
        technicalIndicators,
        orderBook,
        volumeProfile,
        institutionalFlow,
      },
      weights: this.weights,
      recommendation,
    };

    console.log('[TENDENCY ENGINE] ✅ Tendência calculada:', {
      direction,
      score: aggregatedScore.toFixed(2),
      confidence: aggregatedConfidence.toFixed(2),
    });

    return tendency;
  }

  // ============================================
  // CÁLCULOS INDIVIDUAIS
  // ============================================

  private async calculatePressure(input: MarketDataInput): Promise<PressureAnalysis> {
    // Simular cálculo de pressão (em produção, usar dados reais do order flow)
    const buyPressure = 50 + Math.random() * 50;
    const sellPressure = 50 + Math.random() * 50;
    const netPressure = buyPressure - sellPressure;
    const volumeRatio = buyPressure / sellPressure;
    
    return {
      buyPressure,
      sellPressure,
      netPressure,
      volumeRatio,
      score: netPressure,
      confidence: 75 + Math.random() * 20,
    };
  }

  private async calculateFibonacci(input: MarketDataInput): Promise<FibonacciAnalysis> {
    // Calcular níveis de Fibonacci (swing high/low dos últimos 50 candles)
    const high = input.price * 1.05;
    const low = input.price * 0.95;
    const diff = high - low;

    const levels = {
      0: low,
      0.236: low + diff * 0.236,
      0.382: low + diff * 0.382,
      0.5: low + diff * 0.5,
      0.618: low + diff * 0.618,
      0.786: low + diff * 0.786,
      1: high,
    };

    // Encontrar nível mais próximo
    let currentLevel = 0.5;
    let minDist = Infinity;
    for (const [level, price] of Object.entries(levels)) {
      const dist = Math.abs(price - input.price);
      if (dist < minDist) {
        minDist = dist;
        currentLevel = parseFloat(level);
      }
    }

    // Suporte e resistência mais próximos
    const nearestSupport = Object.entries(levels)
      .filter(([_, price]) => price < input.price)
      .sort((a, b) => b[1] - a[1])[0]?.[1] || low;

    const nearestResistance = Object.entries(levels)
      .filter(([_, price]) => price > input.price)
      .sort((a, b) => a[1] - b[1])[0]?.[1] || high;

    // Bias: se está mais próximo de suporte = bullish, resistência = bearish
    const distToSupport = input.price - nearestSupport;
    const distToResistance = nearestResistance - input.price;
    
    let bias: 'bullish' | 'bearish' | 'neutral';
    let score: number;
    
    if (distToSupport < distToResistance * 0.5) {
      bias = 'bullish';
      score = 30 + Math.random() * 30;
    } else if (distToResistance < distToSupport * 0.5) {
      bias = 'bearish';
      score = -30 - Math.random() * 30;
    } else {
      bias = 'neutral';
      score = -10 + Math.random() * 20;
    }

    return {
      currentLevel,
      nearestSupport,
      nearestResistance,
      bias,
      score,
      confidence: 70 + Math.random() * 20,
    };
  }

  private async calculateMovingAverages(input: MarketDataInput): Promise<MovingAveragesAnalysis> {
    // Simular MAs (em produção, calcular com histórico real)
    const ma20 = input.price * (0.98 + Math.random() * 0.04);
    const ma50 = input.price * (0.96 + Math.random() * 0.08);
    const ma200 = input.price * (0.90 + Math.random() * 0.20);

    const priceVsMA20 = ((input.price - ma20) / ma20) * 100;
    const priceVsMA50 = ((input.price - ma50) / ma50) * 100;
    const priceVsMA200 = ((input.price - ma200) / ma200) * 100;

    // Alinhamento
    let alignment: 'bullish' | 'bearish' | 'mixed';
    if (ma20 > ma50 && ma50 > ma200 && input.price > ma20) {
      alignment = 'bullish';
    } else if (ma20 < ma50 && ma50 < ma200 && input.price < ma20) {
      alignment = 'bearish';
    } else {
      alignment = 'mixed';
    }

    // Crossovers (simular)
    const goldenCross = ma50 > ma200 && Math.random() > 0.9;
    const deathCross = ma50 < ma200 && Math.random() > 0.9;

    // Score baseado em alinhamento e distância das MAs
    let score: number;
    if (alignment === 'bullish') {
      score = 40 + priceVsMA20 * 2;
    } else if (alignment === 'bearish') {
      score = -40 + priceVsMA20 * 2;
    } else {
      score = priceVsMA20;
    }

    score = Math.max(-100, Math.min(100, score));

    return {
      ma20,
      ma50,
      ma200,
      priceVsMA20,
      priceVsMA50,
      priceVsMA200,
      alignment,
      crossovers: { goldenCross, deathCross },
      score,
      confidence: 80 + Math.random() * 15,
    };
  }

  private async analyzeNews(symbol: string): Promise<NewsAnalysis> {
    // Em produção, fazer request para API de notícias (ex: NewsAPI, Alpha Vantage)
    // Por enquanto, simular
    const totalArticles = Math.floor(10 + Math.random() * 40);
    const positiveCount = Math.floor(totalArticles * (0.3 + Math.random() * 0.4));
    const negativeCount = Math.floor(totalArticles * (0.1 + Math.random() * 0.3));
    const neutralCount = totalArticles - positiveCount - negativeCount;

    const sentimentScore = ((positiveCount - negativeCount) / totalArticles) * 100;

    const recentHeadlines = [
      { title: `${symbol} atinge novo recorde histórico`, source: 'Bloomberg', sentiment: 'positive' as const, timestamp: new Date() },
      { title: `Analistas preveem alta de ${symbol}`, source: 'Reuters', sentiment: 'positive' as const, timestamp: new Date() },
      { title: `Reguladores investigam ${symbol}`, source: 'WSJ', sentiment: 'negative' as const, timestamp: new Date() },
    ];

    return {
      totalArticles,
      positiveCount,
      negativeCount,
      neutralCount,
      sentimentScore,
      topKeywords: ['alta', 'crescimento', 'investidores', 'mercado', 'análise'],
      urgency: totalArticles > 30 ? 'high' : totalArticles > 15 ? 'medium' : 'low',
      confidence: 60 + Math.random() * 30,
      recentHeadlines,
    };
  }

  private async analyzeSocialMedia(symbol: string): Promise<SocialMediaAnalysis> {
    // Em produção, integrar com APIs do Twitter, Reddit, Telegram
    const twitterSentiment = -50 + Math.random() * 100;
    const redditSentiment = -50 + Math.random() * 100;
    const telegramSentiment = -50 + Math.random() * 100;

    const overallSentiment = (twitterSentiment * 0.5 + redditSentiment * 0.3 + telegramSentiment * 0.2);

    return {
      twitterSentiment,
      redditSentiment,
      telegramSentiment,
      overallSentiment,
      volume: 50 + Math.random() * 50,
      trending: Math.random() > 0.7,
      topHashtags: ['#crypto', '#bitcoin', '#trading', '#bullish'],
      influencerBias: overallSentiment > 20 ? 'bullish' : overallSentiment < -20 ? 'bearish' : 'neutral',
      confidence: 50 + Math.random() * 40,
    };
  }

  private async calculateTechnicalIndicators(input: MarketDataInput): Promise<TechnicalIndicatorsAnalysis> {
    // Simular indicadores (em produção, calcular com histórico real)
    const rsi = 30 + Math.random() * 40;
    const macdValue = -5 + Math.random() * 10;
    const macdSignal = -5 + Math.random() * 10;
    const macdHistogram = macdValue - macdSignal;

    const bollingerMiddle = input.price;
    const bollingerUpper = input.price * 1.02;
    const bollingerLower = input.price * 0.98;

    let bollingerPosition: 'overbought' | 'oversold' | 'neutral';
    if (input.price > bollingerUpper * 0.99) {
      bollingerPosition = 'overbought';
    } else if (input.price < bollingerLower * 1.01) {
      bollingerPosition = 'oversold';
    } else {
      bollingerPosition = 'neutral';
    }

    const stochastic = 20 + Math.random() * 60;

    // Score agregado
    let overallScore = 0;
    
    // RSI
    if (rsi < 30) overallScore += 30; // Oversold = bullish
    else if (rsi > 70) overallScore -= 30; // Overbought = bearish
    else overallScore += (50 - rsi) * 0.5;

    // MACD
    if (macdHistogram > 0) overallScore += 20;
    else overallScore -= 20;

    // Bollinger
    if (bollingerPosition === 'oversold') overallScore += 25;
    else if (bollingerPosition === 'overbought') overallScore -= 25;

    overallScore = Math.max(-100, Math.min(100, overallScore));

    return {
      rsi,
      macd: {
        value: macdValue,
        signal: macdSignal,
        histogram: macdHistogram,
      },
      bollingerBands: {
        upper: bollingerUpper,
        middle: bollingerMiddle,
        lower: bollingerLower,
        position: bollingerPosition,
      },
      stochastic,
      overallScore,
      confidence: 75 + Math.random() * 20,
    };
  }

  private async analyzeOrderBook(input: MarketDataInput): Promise<OrderBookAnalysis> {
    const bidAskRatio = 0.8 + Math.random() * 0.4;
    const depthImbalance = (bidAskRatio - 1) * 50;

    const bidWalls = [input.price * 0.99, input.price * 0.97];
    const askWalls = [input.price * 1.01, input.price * 1.03];

    const spoofingDetected = Math.random() > 0.85;

    const score = depthImbalance;

    return {
      bidAskRatio,
      depthImbalance,
      largeOrders: { bidWalls, askWalls },
      spoofingDetected,
      score,
      confidence: 65 + Math.random() * 25,
    };
  }

  private async analyzeVolumeProfile(input: MarketDataInput): Promise<VolumeProfileAnalysis> {
    const poc = input.price * (0.98 + Math.random() * 0.04);
    const valueAreaHigh = input.price * 1.02;
    const valueAreaLow = input.price * 0.98;

    let positionVsPOC: 'above' | 'below' | 'at';
    if (input.price > poc * 1.005) positionVsPOC = 'above';
    else if (input.price < poc * 0.995) positionVsPOC = 'below';
    else positionVsPOC = 'at';

    const volumeTrend: 'increasing' | 'decreasing' | 'stable' = 
      Math.random() > 0.6 ? 'increasing' : Math.random() > 0.5 ? 'decreasing' : 'stable';

    let score = 0;
    if (positionVsPOC === 'above') score += 20;
    else if (positionVsPOC === 'below') score -= 20;

    if (volumeTrend === 'increasing') score += 30;
    else if (volumeTrend === 'decreasing') score -= 30;

    return {
      poc,
      valueAreaHigh,
      valueAreaLow,
      positionVsPOC,
      volumeTrend,
      score,
      confidence: 70 + Math.random() * 20,
    };
  }

  private async analyzeInstitutionalFlow(input: MarketDataInput): Promise<InstitutionalFlowAnalysis> {
    const netFlow = -10 + Math.random() * 20;
    const largeTransactions = Math.floor(5 + Math.random() * 20);

    let smartMoneyBias: 'accumulating' | 'distributing' | 'neutral';
    if (netFlow > 5) smartMoneyBias = 'accumulating';
    else if (netFlow < -5) smartMoneyBias = 'distributing';
    else smartMoneyBias = 'neutral';

    const score = netFlow * 5;

    return {
      netFlow,
      largeTransactions,
      smartMoneyBias,
      score,
      confidence: 60 + Math.random() * 30,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private getDirection(score: number): MarketTendency['direction'] {
    if (score >= 60) return 'STRONG_BULLISH';
    if (score >= 20) return 'BULLISH';
    if (score <= -60) return 'STRONG_BEARISH';
    if (score <= -20) return 'BEARISH';
    return 'NEUTRAL';
  }

  private generateRecommendation(
    score: number,
    confidence: number,
    sources: any
  ): MarketTendency['recommendation'] {
    let action: MarketTendency['recommendation']['action'];
    let reasoning: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high';

    // Determinar ação
    if (score >= 60 && confidence >= 70) {
      action = 'STRONG_BUY';
      riskLevel = 'low';
    } else if (score >= 20 && confidence >= 60) {
      action = 'BUY';
      riskLevel = 'medium';
    } else if (score <= -60 && confidence >= 70) {
      action = 'STRONG_SELL';
      riskLevel = 'low';
    } else if (score <= -20 && confidence >= 60) {
      action = 'SELL';
      riskLevel = 'medium';
    } else {
      action = 'HOLD';
      riskLevel = confidence < 50 ? 'high' : 'medium';
    }

    // Gerar reasoning
    if (sources.pressure.score > 30) {
      reasoning.push(`Forte pressão de compra (${sources.pressure.buyPressure.toFixed(0)}% vs ${sources.pressure.sellPressure.toFixed(0)}%)`);
    } else if (sources.pressure.score < -30) {
      reasoning.push(`Forte pressão de venda detectada`);
    }

    if (sources.movingAverages.alignment === 'bullish') {
      reasoning.push('Médias móveis alinhadas em tendência de alta');
    } else if (sources.movingAverages.alignment === 'bearish') {
      reasoning.push('Médias móveis indicam tendência de baixa');
    }

    if (sources.technicalIndicators.rsi < 30) {
      reasoning.push('RSI em zona de sobrevenda (possível reversão)');
    } else if (sources.technicalIndicators.rsi > 70) {
      reasoning.push('RSI em zona de sobrecompra (cuidado)');
    }

    if (sources.news.sentimentScore > 40) {
      reasoning.push('Notícias positivas dominando o mercado');
    } else if (sources.news.sentimentScore < -40) {
      reasoning.push('Sentimento negativo nas notícias');
    }

    if (sources.socialMedia.overallSentiment > 30) {
      reasoning.push('Redes sociais extremamente otimistas');
    } else if (sources.socialMedia.overallSentiment < -30) {
      reasoning.push('Sentimento pessimista nas redes sociais');
    }

    if (sources.institutionalFlow.smartMoneyBias === 'accumulating') {
      reasoning.push('Smart money está acumulando posições');
    } else if (sources.institutionalFlow.smartMoneyBias === 'distributing') {
      reasoning.push('Instituições estão distribuindo/vendendo');
    }

    if (reasoning.length === 0) {
      reasoning.push('Mercado em equilíbrio, aguardar melhor sinal');
    }

    return {
      action,
      reasoning,
      riskLevel,
    };
  }
}

// Singleton
export const marketTendencyEngine = new MarketTendencyEngine();
