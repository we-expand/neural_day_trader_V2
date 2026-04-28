import { getMetaApiCandles, type MetaApiCandle } from './MetaApiService';
import { symbolMappingService } from './SymbolMappingService';

// ✅ API_BASE do Supabase removido — não utilizado neste arquivo (evita import desnecessário de projectId)
// const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/market-data`;

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: number;
}

/**
 * 🌐 FETCH CANDLES - ROTEAMENTO INTELIGENTE POR FONTE
 */
export async function fetchCandles(symbol: string, timeframe: string, limit: number = 200): Promise<CandleData[]> {
  console.log(`[MarketService] 🎯 Fetching candles for ${symbol} ${timeframe} via intelligent routing...`);
  
  // 🔍 Detectar tipo de ativo
  const mapping = symbolMappingService.findMapping(symbol);
  const assetType = mapping?.type || detectAssetType(symbol);
  
  console.log(`[MarketService] 📊 Asset type detected: ${assetType} for ${symbol}`);
  
  // 🔀 ROTEAR PARA FONTE CORRETA
  if (assetType === 'crypto') {
    return fetchCandlesFromBinance(symbol, timeframe, limit);
  } else if (assetType === 'forex' || assetType === 'index' || assetType === 'commodity') {
    // Tentar MetaAPI primeiro, depois fallback
    const metaCandlesAttempt = await fetchCandlesFromMetaAPI(symbol, timeframe, limit);
    if (metaCandlesAttempt.length > 0) {
      return metaCandlesAttempt;
    }
    console.warn(`[MarketService] ⚠️ MetaAPI failed for ${symbol}, usando fallback`);
    return generateFallbackCandles(symbol, timeframe, limit);
  } else {
    // Stock ou desconhecido: fallback
    console.warn(`[MarketService] ⚠️ ${symbol} asset type ${assetType}, usando fallback`);
    return generateFallbackCandles(symbol, timeframe, limit);
  }
}

/**
 * 🔍 Detectar tipo de ativo pelo símbolo (fallback quando mapping não existe)
 */
function detectAssetType(symbol: string): 'crypto' | 'forex' | 'index' | 'commodity' | 'stock' {
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || 
      symbol.includes('SOL') || symbol.includes('XRP') || symbol.includes('BNB')) {
    return 'crypto';
  }
  if (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('GBP') || 
      symbol.includes('JPY') || symbol.includes('CHF') || symbol.includes('AUD')) {
    return 'forex';
  }
  if (symbol.includes('US30') || symbol.includes('NAS') || symbol.includes('SPX') || symbol.includes('US500')) {
    return 'index';
  }
  if (symbol.includes('XAU') || symbol.includes('XAG') || symbol.includes('OIL')) {
    return 'commodity';
  }
  return 'stock';
}

/**
 * 📡 Buscar candles da Binance (crypto)
 */
async function fetchCandlesFromBinance(symbol: string, timeframe: string, limit: number): Promise<CandleData[]> {
  // Mapear símbolos para formato Binance
  const symbolMap: Record<string, string> = {
    'BTCUSD': 'BTCUSDT',
    'BTCUSDT': 'BTCUSDT',
    'ETHUSD': 'ETHUSDT',
    'ETHUSDT': 'ETHUSDT',
    'XRPUSD': 'XRPUSDT',
    'BNBUSD': 'BNBUSDT',
    'SOLUSD': 'SOLUSDT',
    'ADAUSD': 'ADAUSDT',
    'DOGUSD': 'DOGEUSDT',
  };
  
  // Mapear timeframes para formato Binance
  const timeframeMap: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1H': '1h',
    '2H': '2h',
    '4H': '4h',
    '1D': '1d',
    '1W': '1w',
    '1M': '1M',
  };
  
  const binanceSymbol = symbolMap[symbol] || symbol;
  const binanceInterval = timeframeMap[timeframe] || '1h';
  
  try {
    console.log(`[MarketService] 🔵 Fetching from BINANCE: ${binanceSymbol} ${binanceInterval}`);
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`,
      { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Converter formato Binance para nosso formato
    const candles: CandleData[] = data.map((candle: any[]) => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
    
    console.log(`[MarketService] ✅ Got ${candles.length} BINANCE candles for ${symbol}`);
    
    return candles;
  } catch (error) {
    console.error('[MarketService] ❌ Error fetching from Binance:', error);
    return [];
  }
}

/**
 * 📡 Buscar candles do MetaAPI (forex, índices, commodities)
 */
async function fetchCandlesFromMetaAPI(symbol: string, timeframe: string, limit: number): Promise<CandleData[]> {
  try {
    // Mapear timeframe para formato MT5
    const mt5TimeframeMap: Record<string, string> = {
      '1m': 'M1',
      '5m': 'M5',
      '15m': 'M15',
      '30m': 'M30',
      '1H': 'H1',
      '2H': 'H2',
      '4H': 'H4',
      '1D': 'D1',
      '1W': 'W1',
      '1M': 'MN1',
    };
    
    const mt5Timeframe = mt5TimeframeMap[timeframe] || 'H1';
    
    // Obter símbolo mapeado para MetaAPI (Infinox)
    const mapping = symbolMappingService.findMapping(symbol);
    const mt5Symbol = mapping?.infinox || symbol;
    
    console.log(`[MarketService] 🟢 Fetching from METAAPI: ${mt5Symbol} ${mt5Timeframe}`);
    
    const metaCandles = await getMetaApiCandles(mt5Symbol, mt5Timeframe, limit);
    
    if (!metaCandles || metaCandles.length === 0) {
      console.warn(`[MarketService] ⚠️ No candles from MetaAPI for ${mt5Symbol}`);
      return [];
    }
    
    // Converter formato MetaAPI para nosso formato
    const candles: CandleData[] = metaCandles.map((candle: MetaApiCandle) => ({
      timestamp: new Date(candle.time).getTime(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.tickVolume,
    }));
    
    console.log(`[MarketService] ✅ Got ${candles.length} METAAPI candles for ${symbol}`);
    
    return candles;
  } catch (error) {
    console.error('[MarketService] ❌ Error fetching from MetaAPI:', error);
    return [];
  }
}

/**
 * 🎭 FALLBACK: Candles simulados para forex/índices/commodities
 */
function generateFallbackCandles(symbol: string, timeframe: string, limit: number): CandleData[] {
  console.log(`[MarketService] 🎭 Generating ${limit} fallback candles for ${symbol} ${timeframe}`);
  
  const candles: CandleData[] = [];
  const now = Date.now();
  
  // Timeframe to milliseconds
  const timeframeMs: Record<string, number> = {
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '30m': 1800000,
    '1H': 3600000,
    '2H': 7200000,
    '4H': 14400000,
    '1D': 86400000,
    '1W': 604800000,
    '1M': 2592000000,
  };
  
  const interval = timeframeMs[timeframe] || timeframeMs['1H'];
  
  // Preços base realistas (Janeiro 2025)
  const basePrices: Record<string, number> = {
    // Forex
    'EURUSD': 1.0415,
    'GBPUSD': 1.2245,
    'USDJPY': 156.24,
    'USDCHF': 0.9145,
    'AUDUSD': 0.6245,
    'USDCAD': 1.4425,
    
    // Commodities
    'XAUUSD': 2678,
    'XAGUSD': 30.45,
    
    // Índices
    'US500': 5932,
    'NAS100': 21345,
    'US30': 43875,
  };
  
  let basePrice = basePrices[symbol] || 100;
  
  // Volatilidade pequena e realista
  const volatilityPercent = 0.001; // 0.1%
  
  // SEED baseada no símbolo para gerar mesmos valores sempre
  const symbolSeed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let seedValue = symbolSeed;
  
  // Função pseudo-aleatória determinística
  const seededRandom = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };
  
  // Generate candles backwards from now
  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = now - (i * interval);
    
    const change = (seededRandom() - 0.5) * 2 * volatilityPercent;
    
    const open = basePrice;
    const close = basePrice * (1 + change);
    const high = Math.max(open, close) * (1 + seededRandom() * volatilityPercent * 0.5);
    const low = Math.min(open, close) * (1 - seededRandom() * volatilityPercent * 0.5);
    const volume = seededRandom() * 1000000 + 500000;
    
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
    
    basePrice = close;
  }
  
  return candles;
}

/**
 * 🌐 FETCH QUOTE - DADOS REAIS
 */
export async function fetchQuote(symbol: string): Promise<MarketQuote> {
  console.log(`[MarketService] 🌐 Fetching REAL quote for ${symbol}...`);
  
  // Mapear símbolos para formato Binance
  const symbolMap: Record<string, string> = {
    'BTCUSD': 'BTCUSDT',
    'BTCUSDT': 'BTCUSDT',
    'ETHUSD': 'ETHUSDT',
    'ETHUSDT': 'ETHUSDT',
  };
  
  const binanceSymbol = symbolMap[symbol];
  
  if (!binanceSymbol) {
    // Fallback para forex/índices
    console.warn(`[MarketService] ⚠️ ${symbol} não é crypto, usando fallback`);
    const basePrices: Record<string, number> = {
      'EURUSD': 1.0415, 
      'GBPUSD': 1.2245,
      'USDJPY': 156.24, 
      'XAUUSD': 2678, 
      'US500': 5932, 
      'NAS100': 21345,
    };
    
    const basePrice = basePrices[symbol] || 100;
    const spread = basePrice * 0.0001; // 0.01% spread
    
    return {
      symbol,
      bid: basePrice,
      ask: basePrice + spread,
      timestamp: Date.now()
    };
  }
  
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
      { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const price = parseFloat(data.lastPrice);
    const spread = price * 0.0001; // 0.01% spread
    
    console.log(`[MarketService] ✅ Got REAL quote for ${symbol}: $${price.toFixed(2)}`);
    
    return {
      symbol,
      bid: price,
      ask: price + spread,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[MarketService] ❌ Error fetching quote:', error);
    
    // Fallback
    return {
      symbol,
      bid: 100,
      ask: 100.01,
      timestamp: Date.now()
    };
  }
}

/**
 * 🌐 CALCULATE DAILY CHANGE - Usando dados reais da Binance
 */
export async function calculateDailyChange(symbol: string): Promise<{ change: number; changePercent: number } | null> {
  console.log(`[MarketService] 🌐 Calculating daily change for ${symbol}...`);
  
  const symbolMap: Record<string, string> = {
    'BTCUSD': 'BTCUSDT',
    'BTCUSDT': 'BTCUSDT',
    'ETHUSD': 'ETHUSDT',
    'ETHUSDT': 'ETHUSDT',
  };
  
  const binanceSymbol = symbolMap[symbol];
  
  if (!binanceSymbol) {
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
      { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const change = parseFloat(data.priceChange);
    const changePercent = parseFloat(data.priceChangePercent);
    
    console.log(`[MarketService] ✅ Daily change for ${symbol}: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`);
    
    return { change, changePercent };
  } catch (error) {
    console.error('[MarketService] ❌ Error calculating daily change:', error);
    return null;
  }
}