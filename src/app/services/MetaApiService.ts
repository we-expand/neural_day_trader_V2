/**
 * 🌐 METAAPI SERVICE - REAL-TIME MARKET DATA
 * Integração com servidor Supabase que conecta ao MetaApi
 * Com fallback para RealMarketDataService
 */

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getRealMarketData, isValidPrice, normalizePrice } from './RealMarketDataService';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6`;

export interface MetaApiTick {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  time: string;
}

export interface MetaApiCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number;
}

export interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: string;
  source?: string;
  isRealData?: boolean;
}

/**
 * ✅ REAL: Busca dados de mercado com FALLBACK INTELIGENTE
 * 🚨 MODO OFFLINE: Usa APENAS fallback local (Supabase desabilitado)
 */
export async function getMarketData(symbol: string): Promise<MarketData> {
  try {
    console.log('[MetaApi] 🔄 Using fallback service for', symbol);

    // 🚨 PULAR SERVIDOR COMPLETAMENTE - Usar fallback direto
    // Motivo: Quota Supabase excedida (erro 402)
    throw new Error('Offline mode - using fallback');

  } catch (error: any) {
    // 2. FALLBACK: Usar RealMarketDataService
    console.log(`[MetaApi] 🔄 Using fallback service for ${symbol}...`);

    try {
      const realData = await getRealMarketData(symbol);

      return {
        symbol: realData.symbol,
        bid: realData.bid || realData.price,
        ask: realData.ask || realData.price,
        last: realData.price,
        high: realData.high || realData.price,
        low: realData.low || realData.price,
        volume: realData.volume || 0,
        change: realData.change || 0,
        changePercent: realData.changePercent || 0,
        timestamp: new Date(realData.timestamp).toISOString(),
        source: realData.source,
        isRealData: realData.isRealData
      };
    } catch (fallbackError: any) {
      console.error('[MetaApi] ❌ All fallbacks failed:', fallbackError.message);

      // 3. ÚLTIMO RECURSO: Dados simulados básicos
      return getDefaultMarketData(symbol);
    }
  }
}

/**
 * ✅ REAL: Busca tick atual do MetaApi
 */
export async function getMetaApiTick(symbol: string): Promise<MetaApiTick | null> {
  try {
    console.log('[MetaApi] 🌐 Fetching REAL tick for', symbol);
    
    const response = await fetch(`${API_BASE}/metaapi/tick/${symbol}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`[MetaApi] Tick request failed with ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[MetaApi] ✅ Got REAL tick from MetaApi for ${symbol}`);
    return data;
  } catch (error) {
    console.warn('[MetaApi] Error fetching tick:', error);
    return null;
  }
}

/**
 * ✅ REAL: Busca candles históricos do MetaApi
 */
export async function getMetaApiCandles(
  symbol: string,
  timeframe: string = 'D1',
  limit: number = 2
): Promise<MetaApiCandle[]> {
  try {
    console.log('[MetaApi] 🌐 Fetching REAL candles for', symbol, timeframe, limit);
    
    // 🔥 FIX: Usar rota POST correta
    const response = await fetch(
      `${API_BASE}/mt5-candles`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol,
          timeframe,
          limit
        })
      }
    );

    if (!response.ok) {
      console.warn(`[MetaApi] Candles request failed with ${response.status}`);
      return [];
    }

    const result = await response.json();
    
    // A resposta vem em formato { success: true, candles: [...] }
    if (result.success && Array.isArray(result.candles)) {
      console.log(`[MetaApi] ✅ Got ${result.candles.length} candles from MetaApi (source: ${result.source})`);
      
      // Converter formato do servidor para MetaApiCandle
      return result.candles.map((c: any) => ({
        time: new Date(c.timestamp).toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        tickVolume: c.volume || 0
      }));
    }
    
    console.warn('[MetaApi] ⚠️ No candles in response');
    return [];
  } catch (error) {
    console.warn('[MetaApi] Error fetching candles:', error);
    return [];
  }
}

/**
 * 📊 Dados simulados básicos para uso em último recurso
 */
function getDefaultMarketData(symbol: string): MarketData {
  return {
    symbol: symbol,
    bid: 0,
    ask: 0,
    last: 0,
    high: 0,
    low: 0,
    volume: 0,
    change: 0,
    changePercent: 0,
    timestamp: new Date().toISOString(),
    source: 'default',
    isRealData: false
  };
}