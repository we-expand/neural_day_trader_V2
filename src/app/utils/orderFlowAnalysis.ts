/**
 * 💧 ORDER FLOW ANALYSIS ENGINE
 * 
 * Algoritmos avançados para análise de fluxo de ordens e detecção de liquidez:
 * 
 * 1. LIQUIDITY ZONES DETECTION
 *    - Identificar áreas de alta concentração de ordens
 *    - Calcular força e tipo de zona (suporte/resistência)
 * 
 * 2. ICEBERG ORDERS DETECTION
 *    - Detectar ordens grandes escondidas (iceberg/hidden orders)
 *    - Análise de padrões de refill (recarga constante)
 * 
 * 3. ORDER FLOW IMBALANCE
 *    - Medir desbalanceamento entre compra/venda
 *    - Identificar pressão dominante
 * 
 * 4. STOP HUNT ZONES
 *    - Detectar áreas prováveis de liquidação de stops
 *    - Calcular probabilidade de stop run
 * 
 * 5. INSTITUTIONAL FOOTPRINT
 *    - Identificar padrões de trading institucional
 *    - Score de presença institucional
 * 
 * @version 2.0.0
 * @author Neural Day Trader Platform
 * @date 21 Janeiro 2026
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface OrderFlowData {
  symbol: string;
  timestamp: number;
  currentPrice: number;
  bidDepth: OrderBookLevel[];
  askDepth: OrderBookLevel[];
  volumeProfile: VolumeProfileLevel[];
  timeAndSales: Trade[];
  totalBidVolume: number;
  totalAskVolume: number;
}

export interface OrderBookLevel {
  price: number;
  volume: number;
  orders: number;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface Trade {
  price: number;
  volume: number;
  timestamp: number;
  side: 'BUY' | 'SELL';
  aggressive: boolean;
}

export interface LiquidityZone {
  priceLevel: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  strength: number; // 0-1
  type: 'HIGH_LIQUIDITY' | 'SUPPORT' | 'RESISTANCE' | 'STOP_CLUSTER' | 'ICEBERG';
  orderType: 'LIMIT' | 'STOP' | 'MARKET' | 'MIXED';
  confidence?: number; // 0-1
  distance?: number; // Distância do preço atual
}

export interface IcebergOrder {
  price: number;
  side: 'BUY' | 'SELL';
  visibleVolume: number;
  estimatedTotalVolume: number;
  confidence: number; // 0-1
  refillCount?: number;
  detectionTime: number;
}

export interface OrderFlowImbalance {
  bidAskRatio: number;
  buyPressure: number; // 0-1
  sellPressure: number; // 0-1
  netFlow: number;
  dominantSide: 'BUY' | 'SELL' | 'NEUTRAL';
}

export interface StopHuntZone {
  price: number;
  side: 'LONG' | 'SHORT'; // De quem são os stops
  volume: number;
  probability: number; // 0-1
  targetPrice?: number;
}

export interface InstitutionalFootprint {
  score: number; // 0-1
  patterns: string[];
  confidence: number;
  characteristics: {
    largeOrders: number;
    icebergActivity: number;
    volumeConcentration: number;
    priceManipulation: number;
  };
}

// ============================================================================
// 1. LIQUIDITY ZONES DETECTION
// ============================================================================

/**
 * Analisar zonas de liquidez no order book
 */
export function analyzeLiquidityZones(data: OrderFlowData): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  const { bidDepth, askDepth, volumeProfile, currentPrice } = data;
  
  // 1.1 Detectar zonas de alta liquidez no BID
  const bidZones = detectHighLiquidityLevels(bidDepth, 'BID', currentPrice);
  zones.push(...bidZones);
  
  // 1.2 Detectar zonas de alta liquidez no ASK
  const askZones = detectHighLiquidityLevels(askDepth, 'ASK', currentPrice);
  zones.push(...askZones);
  
  // 1.3 Detectar suportes/resistências baseado em volume profile
  const srZones = detectSupportResistance(volumeProfile, currentPrice);
  zones.push(...srZones);
  
  // 1.4 Detectar clusters de stop loss
  const stopZones = detectStopClusters(bidDepth, askDepth, currentPrice);
  zones.push(...stopZones);
  
  // Ordenar por força (mais forte primeiro)
  return zones.sort((a, b) => b.strength - a.strength);
}

/**
 * Detectar níveis de alta liquidez
 */
function detectHighLiquidityLevels(
  depth: OrderBookLevel[], 
  side: 'BID' | 'ASK',
  currentPrice: number
): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  
  // Calcular volume médio
  const avgVolume = depth.reduce((sum, level) => sum + level.volume, 0) / depth.length;
  const threshold = avgVolume * 2; // 200% do volume médio
  
  depth.forEach((level, index) => {
    if (level.volume >= threshold) {
      // Níve de alta liquidez detectado
      const strength = Math.min(level.volume / (avgVolume * 5), 1); // Normalizar 0-1
      const distance = Math.abs(level.price - currentPrice) / currentPrice;
      
      zones.push({
        priceLevel: level.price,
        volume: level.volume,
        bidVolume: side === 'BID' ? level.volume : 0,
        askVolume: side === 'ASK' ? level.volume : 0,
        strength,
        type: 'HIGH_LIQUIDITY',
        orderType: 'LIMIT',
        confidence: calculateConfidence(level, depth, index),
        distance
      });
    }
  });
  
  return zones;
}

/**
 * Detectar suportes e resistências baseado em volume profile
 */
function detectSupportResistance(
  volumeProfile: VolumeProfileLevel[],
  currentPrice: number
): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  
  if (volumeProfile.length === 0) return zones;
  
  // Encontrar VPOC (Volume Point of Control) - maior volume
  const vpoc = volumeProfile.reduce((max, level) => 
    level.volume > max.volume ? level : max
  );
  
  // VPOC como zona de alta liquidez
  zones.push({
    priceLevel: vpoc.price,
    volume: vpoc.volume,
    bidVolume: vpoc.buyVolume,
    askVolume: vpoc.sellVolume,
    strength: 1.0,
    type: 'HIGH_LIQUIDITY',
    orderType: 'MIXED',
    confidence: 0.9,
    distance: Math.abs(vpoc.price - currentPrice) / currentPrice
  });
  
  // Detectar suportes (abaixo do preço atual)
  const supports = volumeProfile
    .filter(level => level.price < currentPrice)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3); // Top 3 suportes
  
  supports.forEach(level => {
    zones.push({
      priceLevel: level.price,
      volume: level.volume,
      bidVolume: level.buyVolume,
      askVolume: level.sellVolume,
      strength: level.volume / vpoc.volume,
      type: 'SUPPORT',
      orderType: 'LIMIT',
      confidence: 0.7,
      distance: Math.abs(level.price - currentPrice) / currentPrice
    });
  });
  
  // Detectar resistências (acima do preço atual)
  const resistances = volumeProfile
    .filter(level => level.price > currentPrice)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3); // Top 3 resistências
  
  resistances.forEach(level => {
    zones.push({
      priceLevel: level.price,
      volume: level.volume,
      bidVolume: level.buyVolume,
      askVolume: level.sellVolume,
      strength: level.volume / vpoc.volume,
      type: 'RESISTANCE',
      orderType: 'LIMIT',
      confidence: 0.7,
      distance: Math.abs(level.price - currentPrice) / currentPrice
    });
  });
  
  return zones;
}

/**
 * Detectar clusters de stop loss
 */
function detectStopClusters(
  bidDepth: OrderBookLevel[],
  askDepth: OrderBookLevel[],
  currentPrice: number
): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  
  // Stops de LONG geralmente ficam abaixo do preço atual (no BID)
  // Stops de SHORT geralmente ficam acima do preço atual (no ASK)
  
  // Procurar por "degraus" no order book que indicam stops agrupados
  const bidStops = findStopClustersInDepth(bidDepth, 'BELOW', currentPrice);
  const askStops = findStopClustersInDepth(askDepth, 'ABOVE', currentPrice);
  
  zones.push(...bidStops, ...askStops);
  
  return zones;
}

function findStopClustersInDepth(
  depth: OrderBookLevel[],
  direction: 'ABOVE' | 'BELOW',
  currentPrice: number
): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  
  // Procurar por aumentos súbitos de volume (indicativo de stops)
  for (let i = 1; i < depth.length - 1; i++) {
    const prev = depth[i - 1];
    const curr = depth[i];
    const next = depth[i + 1];
    
    // Se volume atual é 3x maior que anterior E próximo, é possível cluster de stops
    if (curr.volume > prev.volume * 3 && curr.volume > next.volume * 2) {
      zones.push({
        priceLevel: curr.price,
        volume: curr.volume,
        bidVolume: direction === 'BELOW' ? curr.volume : 0,
        askVolume: direction === 'ABOVE' ? curr.volume : 0,
        strength: 0.7,
        type: 'STOP_CLUSTER',
        orderType: 'STOP',
        confidence: 0.6,
        distance: Math.abs(curr.price - currentPrice) / currentPrice
      });
    }
  }
  
  return zones;
}

/**
 * Calcular confiança de uma zona de liquidez
 */
function calculateConfidence(
  level: OrderBookLevel,
  allLevels: OrderBookLevel[],
  index: number
): number {
  let confidence = 0.5;
  
  // +0.2 se volume é muito maior que média
  const avgVolume = allLevels.reduce((sum, l) => sum + l.volume, 0) / allLevels.length;
  if (level.volume > avgVolume * 3) confidence += 0.2;
  
  // +0.1 se tem múltiplas ordens (não é uma ordem gigante única)
  if (level.orders > 5) confidence += 0.1;
  
  // +0.1 se está próximo de níveis redondos (psicológicos)
  const priceStr = level.price.toFixed(5);
  if (priceStr.endsWith('00000') || priceStr.endsWith('50000')) {
    confidence += 0.1;
  }
  
  // -0.1 se está muito longe do preço atual (>1%)
  // (menos confiável pois pode ser cancelado)
  
  return Math.min(confidence, 1.0);
}

// ============================================================================
// 2. ICEBERG ORDERS DETECTION
// ============================================================================

/**
 * Detectar iceberg orders (ordens grandes escondidas)
 */
export function detectIcebergOrders(data: OrderFlowData): IcebergOrder[] {
  const icebergs: IcebergOrder[] = [];
  const { bidDepth, askDepth, timeAndSales } = data;
  
  // Algoritmo de detecção:
  // 1. Procurar por níveis que se "recarregam" constantemente
  // 2. Volume executado > volume visível = iceberg
  // 3. Mesmo preço aparece múltiplas vezes com volume similar
  
  // Analisar BID side
  const bidIcebergs = detectIcebergsInDepth(bidDepth, 'BUY', timeAndSales);
  icebergs.push(...bidIcebergs);
  
  // Analisar ASK side
  const askIcebergs = detectIcebergsInDepth(askDepth, 'SELL', timeAndSales);
  icebergs.push(...askIcebergs);
  
  return icebergs;
}

function detectIcebergsInDepth(
  depth: OrderBookLevel[],
  side: 'BUY' | 'SELL',
  trades: Trade[]
): IcebergOrder[] {
  const icebergs: IcebergOrder[] = [];
  
  // Procurar por níveis com volume consistente ao longo do tempo
  // (indicativo de recarga automática)
  depth.forEach((level, index) => {
    // Heurística: Se volume está "estável" mas há execuções nesse preço = iceberg
    const tradesAtPrice = trades.filter(t => 
      Math.abs(t.price - level.price) < 0.00001 && 
      t.side === side
    );
    
    if (tradesAtPrice.length > 3) {
      // Múltiplas execuções no mesmo preço
      const totalExecuted = tradesAtPrice.reduce((sum, t) => sum + t.volume, 0);
      
      if (totalExecuted > level.volume * 2) {
        // Volume executado > volume visível = iceberg!
        icebergs.push({
          price: level.price,
          side,
          visibleVolume: level.volume,
          estimatedTotalVolume: totalExecuted + level.volume,
          confidence: 0.8,
          refillCount: tradesAtPrice.length,
          detectionTime: Date.now()
        });
      }
    }
    
    // Heurística 2: Volume muito pequeno mas muitas ordens = possível iceberg
    if (level.orders > 10 && level.volume / level.orders < 10) {
      icebergs.push({
        price: level.price,
        side,
        visibleVolume: level.volume,
        estimatedTotalVolume: level.volume * 5, // Estimativa conservadora
        confidence: 0.5,
        detectionTime: Date.now()
      });
    }
  });
  
  return icebergs;
}

// ============================================================================
// 3. ORDER FLOW IMBALANCE
// ============================================================================

/**
 * Calcular desbalanceamento entre compra/venda
 */
export function calculateOrderFlowImbalance(data: OrderFlowData): OrderFlowImbalance {
  const { totalBidVolume, totalAskVolume, bidDepth, askDepth } = data;
  
  // Bid/Ask Ratio
  const bidAskRatio = totalBidVolume / (totalAskVolume || 1);
  
  // Pressão de compra/venda (0-1)
  const totalVolume = totalBidVolume + totalAskVolume;
  const buyPressure = totalBidVolume / totalVolume;
  const sellPressure = totalAskVolume / totalVolume;
  
  // Net Flow (positivo = compra, negativo = venda)
  const netFlow = totalBidVolume - totalAskVolume;
  
  // Lado dominante
  let dominantSide: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (bidAskRatio > 1.2) dominantSide = 'BUY';
  else if (bidAskRatio < 0.8) dominantSide = 'SELL';
  
  return {
    bidAskRatio,
    buyPressure,
    sellPressure,
    netFlow,
    dominantSide
  };
}

// ============================================================================
// 4. STOP HUNT ZONES
// ============================================================================

/**
 * Identificar zonas prováveis de stop hunt
 */
export function identifyStopHuntZones(data: OrderFlowData): StopHuntZone[] {
  const zones: StopHuntZone[] = [];
  const { bidDepth, askDepth, currentPrice, volumeProfile } = data;
  
  // Stops de LONG ficam abaixo do preço (ordem STOP SELL)
  // Stops de SHORT ficam acima do preço (ordem STOP BUY)
  
  // Procurar por "degraus" indicativos de stops agrupados
  
  // Stops de LONG (abaixo do preço)
  const longStops = findStopHuntLevels(bidDepth, 'LONG', currentPrice);
  zones.push(...longStops);
  
  // Stops de SHORT (acima do preço)
  const shortStops = findStopHuntLevels(askDepth, 'SHORT', currentPrice);
  zones.push(...shortStops);
  
  return zones.sort((a, b) => b.probability - a.probability);
}

function findStopHuntLevels(
  depth: OrderBookLevel[],
  side: 'LONG' | 'SHORT',
  currentPrice: number
): StopHuntZone[] {
  const zones: StopHuntZone[] = [];
  
  // Procurar por níveis psicológicos (round numbers)
  // Ex: 1.08000, 1.08500, etc
  depth.forEach(level => {
    const priceStr = level.price.toFixed(5);
    const isRoundNumber = 
      priceStr.endsWith('00000') || 
      priceStr.endsWith('50000') ||
      priceStr.endsWith('00');
    
    if (isRoundNumber && level.volume > 0) {
      // Calcular probabilidade de stop hunt
      const distance = Math.abs(level.price - currentPrice) / currentPrice;
      
      // Mais provável se:
      // - Está perto do preço atual (0.2% - 1%)
      // - Número redondo
      // - Volume significativo
      let probability = 0.3;
      
      if (distance > 0.002 && distance < 0.01) probability += 0.3; // 0.2% - 1%
      if (priceStr.endsWith('00000')) probability += 0.2; // Muito redondo
      if (level.volume > 500) probability += 0.2; // Volume alto
      
      if (probability > 0.5) {
        zones.push({
          price: level.price,
          side,
          volume: level.volume,
          probability: Math.min(probability, 1.0),
          targetPrice: side === 'LONG' 
            ? level.price * 0.998  // -0.2% (sweep stops)
            : level.price * 1.002  // +0.2%
        });
      }
    }
  });
  
  return zones;
}

// ============================================================================
// 5. INSTITUTIONAL FOOTPRINT
// ============================================================================

/**
 * Identificar presença institucional no fluxo
 */
export function getInstitutionalFootprint(data: OrderFlowData): InstitutionalFootprint {
  const patterns: string[] = [];
  let score = 0;
  
  const characteristics = {
    largeOrders: 0,
    icebergActivity: 0,
    volumeConcentration: 0,
    priceManipulation: 0
  };
  
  // 1. Detectar ordens grandes (>1000 lotes)
  const largeOrders = [...data.bidDepth, ...data.askDepth].filter(l => l.volume > 1000);
  if (largeOrders.length > 0) {
    patterns.push('Large orders detected');
    characteristics.largeOrders = largeOrders.length / 10; // Normalizar
    score += 0.2;
  }
  
  // 2. Icebergs = forte indicativo institucional
  const icebergs = detectIcebergOrders(data);
  if (icebergs.length > 0) {
    patterns.push('Iceberg orders active');
    characteristics.icebergActivity = Math.min(icebergs.length / 5, 1);
    score += 0.3;
  }
  
  // 3. Concentração de volume em poucos níveis
  const totalVolume = data.totalBidVolume + data.totalAskVolume;
  const top5Levels = [...data.bidDepth, ...data.askDepth]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);
  const top5Volume = top5Levels.reduce((sum, l) => sum + l.volume, 0);
  const concentration = top5Volume / totalVolume;
  
  if (concentration > 0.5) {
    patterns.push('High volume concentration');
    characteristics.volumeConcentration = concentration;
    score += 0.2;
  }
  
  // 4. Padrões de manipulação (spoofing)
  // Ordens grandes longe do preço que somem rapidamente
  const farOrders = [...data.bidDepth, ...data.askDepth].filter(l => {
    const distance = Math.abs(l.price - data.currentPrice) / data.currentPrice;
    return distance > 0.01 && l.volume > 500; // >1% de distância
  });
  
  if (farOrders.length > 3) {
    patterns.push('Potential spoofing detected');
    characteristics.priceManipulation = Math.min(farOrders.length / 10, 1);
    score += 0.1;
  }
  
  // Normalizar score
  score = Math.min(score, 1.0);
  
  // Confiança baseada em quantos padrões foram encontrados
  const confidence = patterns.length / 4;
  
  return {
    score,
    patterns,
    confidence,
    characteristics
  };
}
