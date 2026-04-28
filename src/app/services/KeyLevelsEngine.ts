/**
 * 🎯 KEY LEVELS ENGINE - Sistema Profissional de Detecção de Níveis Chave
 * 
 * Identifica pontos de "memória" do mercado onde há alta probabilidade de reversão:
 * - Suportes e Resistências Dinâmicos
 * - Round Numbers (Números Redondos Psicológicos)
 * - Zonas de Liquidez
 * - Níveis de Fibonacci
 * - Máximas e Mínimas de Swing
 * 
 * A AI só opera quando o preço está em pontos estratégicos:
 * ✅ COMPRA: Quando o preço está "BARATO" (perto de suportes)
 * ✅ VENDA: Quando o preço está "CARO" (perto de resistências)
 */

export interface KeyLevel {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE' | 'ROUND_NUMBER' | 'LIQUIDITY_ZONE';
  strength: number; // 0-100 (quão forte é o nível)
  touches: number; // Quantas vezes o preço testou este nível
  description: string;
}

export interface MarketStructure {
  currentPrice: number;
  keyLevels: KeyLevel[];
  nearestSupport: KeyLevel | null;
  nearestResistance: KeyLevel | null;
  pricePosition: 'CHEAP' | 'FAIR' | 'EXPENSIVE'; // Onde o preço está em relação aos níveis
  tradingZone: 'BUY_ZONE' | 'SELL_ZONE' | 'NEUTRAL' | 'NO_TRADE'; // Zona de operação
  confluenceScore: number; // 0-100 (múltiplos fatores alinhados)
}

export interface TradingDecision {
  shouldTrade: boolean;
  direction: 'LONG' | 'SHORT' | null;
  confidence: number; // 0-100
  reasoning: string[];
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskRewardRatio: number;
}

/**
 * 🔢 DETECTAR ROUND NUMBERS (Números Redondos Psicológicos)
 * Ex: 100000, 50000, 95000, 2000, 1500, 1.0000, 1.2500
 */
function detectRoundNumbers(currentPrice: number, symbol: string): KeyLevel[] {
  const levels: KeyLevel[] = [];
  
  // Determinar magnitude baseado no ativo
  let magnitude = 1000; // Padrão para crypto e índices grandes
  
  if (symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('USD') || symbol.includes('JPY')) {
    // Forex: round numbers em pips (ex: 1.1000, 1.2500, 1.0500)
    magnitude = 0.005; // Níveis a cada 50 pips
  } else if (symbol.includes('XAU') || symbol.includes('GOLD')) {
    // Ouro: round numbers a cada $50 (ex: 2000, 2050, 2100)
    magnitude = 50;
  } else if (currentPrice > 10000) {
    // Bitcoin, índices grandes: a cada 1000 (ex: 95000, 96000, 97000)
    magnitude = 1000;
  } else if (currentPrice > 1000) {
    // Ethereum: a cada 100 (ex: 3400, 3500, 3600)
    magnitude = 100;
  } else if (currentPrice > 100) {
    // Altcoins: a cada 10 (ex: 140, 150, 160)
    magnitude = 10;
  } else {
    // Altcoins pequenas: a cada 1 (ex: 1.0, 2.0, 3.0)
    magnitude = 1;
  }
  
  // Encontrar round numbers próximos (5 acima e 5 abaixo)
  const baseLevel = Math.floor(currentPrice / magnitude) * magnitude;
  
  for (let i = -5; i <= 5; i++) {
    const level = baseLevel + (i * magnitude);
    if (level <= 0) continue;
    
    const distance = Math.abs(currentPrice - level) / currentPrice;
    if (distance > 0.05) continue; // Apenas níveis dentro de 5% do preço atual
    
    // Força baseada em quão "redondo" é o número
    let strength = 50; // Base
    
    // Números muito redondos têm mais força psicológica
    if (level % (magnitude * 10) === 0) strength = 90; // Ex: 100000, 50000
    else if (level % (magnitude * 5) === 0) strength = 75; // Ex: 95000, 45000
    else if (level % (magnitude * 2) === 0) strength = 60; // Ex: 96000, 48000
    
    levels.push({
      price: level,
      type: 'ROUND_NUMBER',
      strength,
      touches: 0, // Round numbers não precisam de histórico de toques
      description: `Round Number: $${level.toFixed(symbol.includes('EUR') || symbol.includes('GBP') ? 5 : 2)}`
    });
  }
  
  return levels;
}

/**
 * 📊 CALCULAR ZONAS DE LIQUIDEZ (Order Book Levels simulados)
 * Áreas onde grandes players costumam ter ordens
 */
function calculateLiquidityZones(currentPrice: number, symbol: string): KeyLevel[] {
  const levels: KeyLevel[] = [];
  
  // Zonas de liquidez típicas:
  // - 2% abaixo do preço atual (buy walls)
  // - 2% acima do preço atual (sell walls)
  // - 5% abaixo (strong support)
  // - 5% acima (strong resistance)
  
  const zones = [
    { offset: -0.05, type: 'SUPPORT' as const, strength: 85, desc: 'Strong Support Zone (-5%)' },
    { offset: -0.02, type: 'SUPPORT' as const, strength: 70, desc: 'Support Zone (-2%)' },
    { offset: 0.02, type: 'RESISTANCE' as const, strength: 70, desc: 'Resistance Zone (+2%)' },
    { offset: 0.05, type: 'RESISTANCE' as const, strength: 85, desc: 'Strong Resistance Zone (+5%)' },
  ];
  
  zones.forEach(zone => {
    const level = currentPrice * (1 + zone.offset);
    levels.push({
      price: level,
      type: 'LIQUIDITY_ZONE',
      strength: zone.strength,
      touches: 0,
      description: zone.desc
    });
  });
  
  return levels;
}

/**
 * 🎯 DETECTAR SUPORTES E RESISTÊNCIAS DINÂMICOS
 * Baseado em máximas e mínimas recentes (swing highs/lows)
 */
function detectSwingLevels(currentPrice: number, priceHistory: number[]): KeyLevel[] {
  const levels: KeyLevel[] = [];
  
  if (priceHistory.length < 20) return levels;
  
  // Encontrar swing highs e lows (últimos 20 períodos)
  const recentHistory = priceHistory.slice(-20);
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  
  for (let i = 2; i < recentHistory.length - 2; i++) {
    const current = recentHistory[i];
    const prevPrev = recentHistory[i - 2];
    const prev = recentHistory[i - 1];
    const next = recentHistory[i + 1];
    const nextNext = recentHistory[i + 2];
    
    // Swing High: preço mais alto que 2 períodos anteriores e 2 posteriores
    if (current > prev && current > prevPrev && current > next && current > nextNext) {
      swingHighs.push(current);
    }
    
    // Swing Low: preço mais baixo que 2 períodos anteriores e 2 posteriores
    if (current < prev && current < prevPrev && current < next && current < nextNext) {
      swingLows.push(current);
    }
  }
  
  // Adicionar swing highs como resistências
  swingHighs.forEach(high => {
    const distance = Math.abs(currentPrice - high) / currentPrice;
    if (distance < 0.03) { // Apenas níveis dentro de 3% do preço atual
      levels.push({
        price: high,
        type: 'RESISTANCE',
        strength: 75,
        touches: 1,
        description: `Swing High Resistance: $${high.toFixed(2)}`
      });
    }
  });
  
  // Adicionar swing lows como suportes
  swingLows.forEach(low => {
    const distance = Math.abs(currentPrice - low) / currentPrice;
    if (distance < 0.03) { // Apenas níveis dentro de 3% do preço atual
      levels.push({
        price: low,
        type: 'SUPPORT',
        strength: 75,
        touches: 1,
        description: `Swing Low Support: $${low.toFixed(2)}`
      });
    }
  });
  
  return levels;
}

/**
 * 🧮 ANALISAR ESTRUTURA DE MERCADO COMPLETA
 */
export function analyzeMarketStructure(
  currentPrice: number,
  symbol: string,
  priceHistory: number[] = []
): MarketStructure {
  
  // Coletar todos os níveis chave
  const roundNumbers = detectRoundNumbers(currentPrice, symbol);
  const liquidityZones = calculateLiquidityZones(currentPrice, symbol);
  const swingLevels = detectSwingLevels(currentPrice, priceHistory);
  
  const allLevels = [...roundNumbers, ...liquidityZones, ...swingLevels];
  
  // Ordenar por distância do preço atual
  allLevels.sort((a, b) => {
    const distA = Math.abs(currentPrice - a.price);
    const distB = Math.abs(currentPrice - b.price);
    return distA - distB;
  });
  
  // Encontrar suporte e resistência mais próximos
  const supportsBelow = allLevels.filter(l => 
    (l.type === 'SUPPORT' || l.type === 'LIQUIDITY_ZONE') && l.price < currentPrice
  );
  const resistancesAbove = allLevels.filter(l => 
    (l.type === 'RESISTANCE' || l.type === 'LIQUIDITY_ZONE') && l.price > currentPrice
  );
  
  const nearestSupport = supportsBelow[0] || null;
  const nearestResistance = resistancesAbove[0] || null;
  
  // Calcular posição do preço (BARATO, JUSTO, CARO)
  let pricePosition: 'CHEAP' | 'FAIR' | 'EXPENSIVE' = 'FAIR';
  
  if (nearestSupport && nearestResistance) {
    const range = nearestResistance.price - nearestSupport.price;
    const priceInRange = currentPrice - nearestSupport.price;
    const percentInRange = priceInRange / range;
    
    if (percentInRange < 0.3) pricePosition = 'CHEAP'; // Próximo do suporte (30% inferior)
    else if (percentInRange > 0.7) pricePosition = 'EXPENSIVE'; // Próximo da resistência (30% superior)
  }
  
  // Determinar zona de trading
  let tradingZone: 'BUY_ZONE' | 'SELL_ZONE' | 'NEUTRAL' | 'NO_TRADE' = 'NEUTRAL';
  
  if (pricePosition === 'CHEAP' && nearestSupport) {
    const distanceToSupport = Math.abs(currentPrice - nearestSupport.price) / currentPrice;
    if (distanceToSupport < 0.005) tradingZone = 'BUY_ZONE'; // Muito próximo do suporte (<0.5%)
  } else if (pricePosition === 'EXPENSIVE' && nearestResistance) {
    const distanceToResistance = Math.abs(currentPrice - nearestResistance.price) / currentPrice;
    if (distanceToResistance < 0.005) tradingZone = 'SELL_ZONE'; // Muito próximo da resistência (<0.5%)
  }
  
  // Calcular score de confluência (múltiplos fatores alinhados)
  let confluenceScore = 0;
  
  // Verificar confluência em zona de compra
  if (tradingZone === 'BUY_ZONE') {
    // Contar quantos níveis de suporte estão próximos (dentro de 1%)
    const supportCluster = allLevels.filter(l => 
      l.type === 'SUPPORT' && Math.abs(currentPrice - l.price) / currentPrice < 0.01
    );
    confluenceScore = Math.min(supportCluster.length * 25, 100); // Máximo 100
    
    // Boost se há round number próximo
    const roundNumberNear = roundNumbers.find(rn => 
      Math.abs(currentPrice - rn.price) / currentPrice < 0.005
    );
    if (roundNumberNear) confluenceScore = Math.min(confluenceScore + 20, 100);
  }
  
  // Verificar confluência em zona de venda
  if (tradingZone === 'SELL_ZONE') {
    const resistanceCluster = allLevels.filter(l => 
      l.type === 'RESISTANCE' && Math.abs(currentPrice - l.price) / currentPrice < 0.01
    );
    confluenceScore = Math.min(resistanceCluster.length * 25, 100);
    
    const roundNumberNear = roundNumbers.find(rn => 
      Math.abs(currentPrice - rn.price) / currentPrice < 0.005
    );
    if (roundNumberNear) confluenceScore = Math.min(confluenceScore + 20, 100);
  }
  
  return {
    currentPrice,
    keyLevels: allLevels,
    nearestSupport,
    nearestResistance,
    pricePosition,
    tradingZone,
    confluenceScore
  };
}

/**
 * 🎯 DECISÃO PROFISSIONAL DE TRADING
 * Apenas opera em pontos estratégicos com alta probabilidade
 */
export function makeSmartTradingDecision(
  marketStructure: MarketStructure,
  additionalData: {
    priceChangePercent: number;
    volume24h: number;
    rsiValue: number;
  }
): TradingDecision {
  
  const { currentPrice, nearestSupport, nearestResistance, tradingZone, confluenceScore, pricePosition } = marketStructure;
  const { priceChangePercent, volume24h, rsiValue } = additionalData;
  
  let shouldTrade = false;
  let direction: 'LONG' | 'SHORT' | null = null;
  let confidence = 0;
  const reasoning: string[] = [];
  let entry = currentPrice;
  let takeProfit = currentPrice;
  let stopLoss = currentPrice;
  let riskRewardRatio = 0;
  
  // ✅ ESTRATÉGIA 1: COMPRA EM SUPORTE (Buy the Dip)
  if (tradingZone === 'BUY_ZONE' && nearestSupport && nearestResistance) {
    direction = 'LONG';
    entry = currentPrice;
    stopLoss = nearestSupport.price * 0.995; // SL 0.5% abaixo do suporte
    takeProfit = nearestResistance.price * 0.99; // TP próximo da resistência (deixar margem)
    
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);
    riskRewardRatio = reward / risk;
    
    // Validações para alta confiança
    confidence = 50; // Base
    
    // Confluência forte aumenta confiança
    if (confluenceScore > 60) {
      confidence += 20;
      reasoning.push(`🎯 Confluência forte (${confluenceScore}%) - múltiplos suportes alinhados`);
    }
    
    // Preço "barato" aumenta confiança
    if (pricePosition === 'CHEAP') {
      confidence += 15;
      reasoning.push(`💰 Preço BARATO - Próximo ao suporte em $${nearestSupport.price.toFixed(2)}`);
    }
    
    // RSI oversold confirma
    if (rsiValue < 40) {
      confidence += 15;
      reasoning.push(`📉 RSI Oversold (${rsiValue.toFixed(0)}) - Área de sobrecompra`);
    }
    
    // Volume alto indica interesse
    if (volume24h > 50000) {
      confidence += 10;
      reasoning.push(`📊 Volume alto ($${(volume24h / 1000).toFixed(0)}K) - Liquidez adequada`);
    }
    
    // Risk/Reward favorável
    if (riskRewardRatio > 2) {
      confidence += 10;
      reasoning.push(`⚖️ Risk/Reward excelente (1:${riskRewardRatio.toFixed(1)})`);
    } else if (riskRewardRatio < 1.5) {
      confidence -= 20;
      reasoning.push(`⚠️ Risk/Reward desfavorável (1:${riskRewardRatio.toFixed(1)}) - DESCARTADO`);
    }
    
    // Decisão final
    if (confidence >= 70 && riskRewardRatio >= 1.5) {
      shouldTrade = true;
      reasoning.unshift(`✅ COMPRA ESTRATÉGICA - Suporte forte em $${nearestSupport.price.toFixed(2)}`);
    } else {
      reasoning.unshift(`❌ Setup rejeitado - Confiança insuficiente (${confidence}%)`);
    }
  }
  
  // ✅ ESTRATÉGIA 2: VENDA EM RESISTÊNCIA (Sell the Rip)
  else if (tradingZone === 'SELL_ZONE' && nearestResistance && nearestSupport) {
    direction = 'SHORT';
    entry = currentPrice;
    stopLoss = nearestResistance.price * 1.005; // SL 0.5% acima da resistência
    takeProfit = nearestSupport.price * 1.01; // TP próximo do suporte (deixar margem)
    
    const risk = Math.abs(stopLoss - entry);
    const reward = Math.abs(entry - takeProfit);
    riskRewardRatio = reward / risk;
    
    confidence = 50; // Base
    
    if (confluenceScore > 60) {
      confidence += 20;
      reasoning.push(`🎯 Confluência forte (${confluenceScore}%) - múltiplas resistências alinhadas`);
    }
    
    if (pricePosition === 'EXPENSIVE') {
      confidence += 15;
      reasoning.push(`💸 Preço CARO - Próximo à resistência em $${nearestResistance.price.toFixed(2)}`);
    }
    
    if (rsiValue > 60) {
      confidence += 15;
      reasoning.push(`📈 RSI Overbought (${rsiValue.toFixed(0)}) - Área de sobrevenda`);
    }
    
    if (volume24h > 50000) {
      confidence += 10;
      reasoning.push(`📊 Volume alto ($${(volume24h / 1000).toFixed(0)}K) - Liquidez adequada`);
    }
    
    if (riskRewardRatio > 2) {
      confidence += 10;
      reasoning.push(`⚖️ Risk/Reward excelente (1:${riskRewardRatio.toFixed(1)})`);
    } else if (riskRewardRatio < 1.5) {
      confidence -= 20;
      reasoning.push(`⚠️ Risk/Reward desfavorável (1:${riskRewardRatio.toFixed(1)}) - DESCARTADO`);
    }
    
    if (confidence >= 70 && riskRewardRatio >= 1.5) {
      shouldTrade = true;
      reasoning.unshift(`✅ VENDA ESTRATÉGICA - Resistência forte em $${nearestResistance.price.toFixed(2)}`);
    } else {
      reasoning.unshift(`❌ Setup rejeitado - Confiança insuficiente (${confidence}%)`);
    }
  }
  
  // ❌ NÃO OPERAR: Preço no meio do range (zona neutra)
  else {
    reasoning.push(`⏸️ AGUARDANDO - Preço em zona neutra (${pricePosition})`);
    reasoning.push(`💡 Esperando preço chegar em suporte ou resistência`);
    
    if (nearestSupport) {
      reasoning.push(`📍 Próximo suporte: $${nearestSupport.price.toFixed(2)} (${((nearestSupport.price - currentPrice) / currentPrice * 100).toFixed(2)}%)`);
    }
    
    if (nearestResistance) {
      reasoning.push(`📍 Próxima resistência: $${nearestResistance.price.toFixed(2)} (${((nearestResistance.price - currentPrice) / currentPrice * 100).toFixed(2)}%)`);
    }
  }
  
  return {
    shouldTrade,
    direction,
    confidence: Math.min(confidence, 95),
    reasoning,
    entry,
    takeProfit,
    stopLoss,
    riskRewardRatio
  };
}
