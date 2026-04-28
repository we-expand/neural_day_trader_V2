/**
 * Binance Validator - Garante 100% de precisão com a API Binance
 * Valida e corrige qualquer discrepância entre app e Binance
 */

export interface BinanceTickerData {
  symbol: string;
  lastPrice: number;
  openPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  timestamp: number;
}

export interface ValidationResult {
  isValid: boolean;
  binanceData: BinanceTickerData;
  appData: {
    price: number;
    change: number;
    changePercent: number;
  };
  discrepancy: {
    priceDiff: number;
    changeDiff: number;
    changePercentDiff: number;
  };
  warnings: string[];
}

/**
 * Busca dados DIRETOS da Binance sem transformações
 */
export async function getBinanceRawData(symbol: string): Promise<BinanceTickerData | null> {
  try {
    // Normalizar símbolo para formato Binance
    let binanceSymbol = symbol.toUpperCase();
    if (!binanceSymbol.endsWith('USDT')) {
      binanceSymbol = binanceSymbol.replace('USD', 'USDT');
    }
    if (!binanceSymbol.includes('USDT') && !binanceSymbol.includes('BUSD')) {
      binanceSymbol = `${binanceSymbol}USDT`;
    }

    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
    console.log(`[BinanceValidator] 📡 Fetching: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[BinanceValidator] ❌ HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // ZERO TRANSFORMAÇÕES - apenas parse direto
    const result: BinanceTickerData = {
      symbol: data.symbol,
      lastPrice: parseFloat(data.lastPrice),
      openPrice: parseFloat(data.openPrice),
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      highPrice: parseFloat(data.highPrice),
      lowPrice: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
      timestamp: Date.now(),
    };

    console.log(`[BinanceValidator] ✅ RAW DATA:`, {
      symbol: result.symbol,
      lastPrice: result.lastPrice,
      priceChange: result.priceChange,
      priceChangePercent: result.priceChangePercent,
    });

    return result;
  } catch (error: any) {
    console.error(`[BinanceValidator] ❌ Error:`, error.message);
    return null;
  }
}

/**
 * Valida se os valores do app correspondem EXATAMENTE aos da Binance
 */
export async function validateAgainstBinance(
  symbol: string,
  appPrice: number,
  appChange: number,
  appChangePercent: number
): Promise<ValidationResult> {
  const binanceData = await getBinanceRawData(symbol);
  
  if (!binanceData) {
    return {
      isValid: false,
      binanceData: {
        symbol: '',
        lastPrice: 0,
        openPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
        timestamp: Date.now(),
      },
      appData: { price: appPrice, change: appChange, changePercent: appChangePercent },
      discrepancy: { priceDiff: 0, changeDiff: 0, changePercentDiff: 0 },
      warnings: ['Failed to fetch Binance data'],
    };
  }

  const priceDiff = Math.abs(binanceData.lastPrice - appPrice);
  const changeDiff = Math.abs(binanceData.priceChange - appChange);
  const changePercentDiff = Math.abs(binanceData.priceChangePercent - appChangePercent);

  const warnings: string[] = [];
  
  // Tolerância: 0.01% para preço, 0.001 para change absoluto, 0.01 para percentual
  const PRICE_TOLERANCE = binanceData.lastPrice * 0.0001; // 0.01%
  const CHANGE_TOLERANCE = 0.01;
  const PERCENT_TOLERANCE = 0.01;

  if (priceDiff > PRICE_TOLERANCE) {
    warnings.push(`Price discrepancy: ${priceDiff.toFixed(2)} (${((priceDiff / binanceData.lastPrice) * 100).toFixed(4)}%)`);
  }

  if (changeDiff > CHANGE_TOLERANCE) {
    warnings.push(`Change discrepancy: ${changeDiff.toFixed(4)}`);
  }

  if (changePercentDiff > PERCENT_TOLERANCE) {
    warnings.push(`Change % discrepancy: ${changePercentDiff.toFixed(4)}%`);
  }

  const isValid = warnings.length === 0;

  console.log(`[BinanceValidator] ${isValid ? '✅' : '⚠️'} Validation:`, {
    binance: {
      price: binanceData.lastPrice,
      change: binanceData.priceChange,
      changePercent: binanceData.priceChangePercent,
    },
    app: {
      price: appPrice,
      change: appChange,
      changePercent: appChangePercent,
    },
    diff: {
      price: priceDiff,
      change: changeDiff,
      changePercent: changePercentDiff,
    },
    warnings,
  });

  return {
    isValid,
    binanceData,
    appData: { price: appPrice, change: appChange, changePercent: appChangePercent },
    discrepancy: {
      priceDiff,
      changeDiff,
      changePercentDiff,
    },
    warnings,
  };
}

/**
 * Retorna valores PUROS da Binance - SEM nenhuma transformação
 */
export async function getBinancePureValues(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
} | null> {
  const data = await getBinanceRawData(symbol);
  
  if (!data) return null;

  return {
    price: data.lastPrice,
    change: data.priceChange,
    changePercent: data.priceChangePercent,
  };
}
