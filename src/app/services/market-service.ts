import { symbolMappingService } from './SymbolMappingService';
import { supabase } from '@/lib/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const MT5_CANDLES_HISTORY_URL = `https://${projectId}.supabase.co/functions/v1/server/mt5-candles-history`;

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
    console.warn(`[MarketService] ⚠️ Sem candles reais para ${symbol} (MetaAPI indisponível)`);
    return [];
  } else {
    // Stock ou desconhecido: sem fonte real de candles
    console.warn(`[MarketService] ⚠️ ${symbol} asset type ${assetType} sem fonte de candles real`);
    return [];
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
 *
 * Usa /mt5-candles-history (a mesma rota já usada pelo Backtest/Replay) em vez
 * da antiga /mt5-candles — aquela cai silenciosamente em candles SIMULADOS
 * (preço-base desatualizado) em qualquer falha, o que fazia o corpo do gráfico
 * mostrar um histórico falso mesmo quando o preço atual no topo (via
 * DataSourceRouter/mt5-prices) era real — os dois nunca combinavam.
 * /mt5-candles-history nunca mente: se não tiver dado real, retorna erro
 * explícito e aqui tratamos como "sem candles" (fallback local assume por
 * cima, mas pelo menos não finge ser real).
 */
async function fetchCandlesFromMetaAPI(symbol: string, timeframe: string, limit: number): Promise<CandleData[]> {
  try {
    // Mapear timeframe pro formato aceito por /mt5-candles-history
    const mt5TimeframeMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1H': '1H',
      '2H': '1H',
      '4H': '4H',
      '1D': '1D',
      '1W': '1W',
      '1M': '1D',
    };
    const mt5Timeframe = mt5TimeframeMap[timeframe] || '1H';

    const msPerCandle: Record<string, number> = {
      '1m': 60_000, '5m': 5 * 60_000, '15m': 15 * 60_000, '30m': 30 * 60_000,
      '1H': 3_600_000, '4H': 4 * 3_600_000, '1D': 86_400_000, '1W': 7 * 86_400_000,
    };

    // Obter símbolo mapeado para MetaAPI (Infinox)
    const mapping = symbolMappingService.findMapping(symbol);
    const mt5Symbol = mapping?.infinox || symbol;

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - limit * (msPerCandle[mt5Timeframe] || 3_600_000));

    console.log(`[MarketService] 🟢 Fetching from METAAPI HISTORY: ${mt5Symbol} ${mt5Timeframe}`);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const response = await fetch(MT5_CANDLES_HISTORY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || publicAnonKey}`,
      },
      body: JSON.stringify({
        symbol: mt5Symbol,
        timeframe: mt5Timeframe,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success || !Array.isArray(result.candles) || result.candles.length === 0) {
      console.warn(`[MarketService] ⚠️ /mt5-candles-history sem dado real para ${mt5Symbol}:`, result?.message || result?.error);
      return [];
    }

    const candles: CandleData[] = result.candles.map((c: any) => ({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 0,
    }));

    console.log(`[MarketService] ✅ Got ${candles.length} METAAPI candles REAIS para ${symbol}`);

    return candles;
  } catch (error) {
    console.error('[MarketService] ❌ Error fetching from MetaAPI history:', error);
    return [];
  }
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