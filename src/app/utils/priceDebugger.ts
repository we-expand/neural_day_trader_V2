/**
 * 🐛 Price Debugger - REATIVADO
 * 
 * Ferramenta para comparar nossos dados com fontes externas e identificar discrepâncias
 */

interface PriceComparison {
  symbol: string;
  ourPrice: number;
  ourChange: number;
  ourChangePercent: number;
  externalPrice?: number;
  externalChange?: number;
  externalChangePercent?: number;
  discrepancy?: number;
  source: string;
}

/**
 * Converter símbolos para formato Yahoo Finance
 */
function convertToYahooSymbol(symbol: string): string {
  const yahooMap: Record<string, string> = {
    'BTCUSD': 'BTC-USD',
    'ETHUSD': 'ETH-USD',
    'XRPUSD': 'XRP-USD',
    'EURUSD': 'EURUSD=X',
    'GBPUSD': 'GBPUSD=X',
    'USDJPY': 'JPY=X',
    'XAUUSD': 'GC=F',
    'US500': '^GSPC',
    'NAS100': '^IXIC',
  };
  
  return yahooMap[symbol] || symbol;
}

/**
 * ✅ REAL: Buscar dados externos do Yahoo Finance
 */
async function fetchExternalPrice(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
} | null> {
  try {
    const yahooSymbol = convertToYahooSymbol(symbol);
    
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (result?.meta) {
      const currentPrice = result.meta.regularMarketPrice;
      const previousClose = result.meta.chartPreviousClose;
      const change = currentPrice - previousClose;
      const changePercent = (change / previousClose) * 100;
      
      return {
        price: currentPrice,
        change,
        changePercent
      };
    }
    
    return null;
  } catch (error) {
    console.warn('[Price Debugger] Error fetching external price:', error);
    return null;
  }
}

/**
 * ✅ REAL: Compare price with external sources
 */
export async function comparePrice(
  symbol: string,
  ourPrice: number,
  ourChange: number,
  ourChangePercent: number
): Promise<PriceComparison> {
  console.log('[Price Debugger] 🔍 Comparing', symbol);
  
  const externalData = await fetchExternalPrice(symbol);
  
  if (externalData) {
    const discrepancy = Math.abs(ourPrice - externalData.price) / externalData.price * 100;
    
    console.log(`[Price Debugger] ${symbol}: Our=${ourPrice.toFixed(2)}, External=${externalData.price.toFixed(2)}, Diff=${discrepancy.toFixed(2)}%`);
    
    return {
      symbol,
      ourPrice,
      ourChange,
      ourChangePercent,
      externalPrice: externalData.price,
      externalChange: externalData.change,
      externalChangePercent: externalData.changePercent,
      discrepancy,
      source: 'Yahoo Finance',
    };
  }
  
  return {
    symbol,
    ourPrice,
    ourChange,
    ourChangePercent,
    source: 'No external data',
  };
}

/**
 * ✅ REAL: Compare multiple prices in batch
 */
export async function comparePricesBatch(
  assets: Array<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
  }>
): Promise<PriceComparison[]> {
  console.log('[Price Debugger] 🚀 Iniciando comparação REAL de', assets.length, 'ativos...');
  
  const comparisons = await Promise.all(
    assets.map(asset => 
      comparePrice(asset.symbol, asset.price, asset.change, asset.changePercent)
    )
  );
  
  console.log('[Price Debugger] ✅ Comparação concluída');
  return comparisons;
}