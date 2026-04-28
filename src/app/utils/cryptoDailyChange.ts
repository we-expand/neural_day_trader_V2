/**
 * 🌐 CRYPTO DAILY CHANGE - DADOS REAIS DA BINANCE
 * Reset diário às 00:00 UTC (padrão Binance)
 */

export interface CryptoChangeData {
  symbol: string;
  currentPrice: number;
  openPrice: number;
  dailyChange: number;
  dailyChangePercent: number;
}

/**
 * ✅ REAL: Busca dados do dia atual da Binance (24h ticker)
 * Usa o endpoint oficial 24hr ticker que calcula automaticamente desde 00:00 UTC
 */
export async function calculateCryptoDailyChange(symbol: string): Promise<CryptoChangeData | null> {
  console.log('[CryptoDailyChange] 🌐 Fetching REAL data for', symbol);
  
  // Mapear símbolos para formato Binance
  const symbolMap: Record<string, string> = {
    'BTCUSDT': 'BTCUSDT',
    'ETHUSDT': 'ETHUSDT',
    'BTCUSD': 'BTCUSDT',
    'ETHUSD': 'ETHUSDT',
    'BTC': 'BTCUSDT',
    'ETH': 'ETHUSDT',
  };
  
  const binanceSymbol = symbolMap[symbol] || symbol;
  const apiUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}&_=${Date.now()}`;
  
  console.log('[CryptoDailyChange] 📡 Calling API:', apiUrl);
  
  try {
    const response = await fetch(apiUrl, { 
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    console.log('[CryptoDailyChange] 📥 Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('[CryptoDailyChange] 📦 Raw API response:', data);
    
    const currentPrice = parseFloat(data.lastPrice);
    const openPrice = parseFloat(data.openPrice);
    const dailyChange = parseFloat(data.priceChange);
    const dailyChangePercent = parseFloat(data.priceChangePercent);
    
    console.log(`[CryptoDailyChange] ✅ Parsed ${symbol}:`, {
      currentPrice,
      openPrice,
      dailyChange,
      dailyChangePercent,
      formatted: {
        current: currentPrice.toFixed(2),
        open: openPrice.toFixed(2),
        change: dailyChange.toFixed(2),
        changePercent: `${dailyChangePercent > 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%`
      }
    });
    
    return {
      symbol,
      currentPrice,
      openPrice,
      dailyChange,
      dailyChangePercent,
    };
  } catch (error) {
    console.error('[CryptoDailyChange] ❌ Error fetching data:', error);
    return null;
  }
}

/**
 * ✅ REAL: Alias para calculateCryptoDailyChange
 */
export async function getCrypto24hrChange(symbol: string): Promise<CryptoChangeData | null> {
  return calculateCryptoDailyChange(symbol);
}

/**
 * ✅ REAL: Busca mudança diária (24h)
 */
export async function getCryptoDailyChange(symbol: string): Promise<CryptoChangeData | null> {
  return calculateCryptoDailyChange(symbol);
}