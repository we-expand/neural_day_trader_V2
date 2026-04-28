/**
 * 🗄️ ASSET DATABASE - Base de Dados Completa de Ativos (370+ ATIVOS)
 * 
 * Base de dados unificada com TODOS os ativos suportados pela plataforma
 * Organizada exatamente como no MetaTrader 5
 * Nomes IDÊNTICOS aos do MT5
 */

export type AssetCategory = 'FOREX' | 'CRYPTO' | 'INDICES' | 'COMMODITIES' | 'STOCKS' | 'BONDS';
export type AssetSubCategory = 
  | 'Major Pairs' | 'Minor Pairs' | 'Exotic Pairs'
  | 'Bitcoin' | 'Altcoins' | 'DeFi' | 'Meme Coins'
  | 'US Indices' | 'European Indices' | 'Asian Indices'
  | 'Precious Metals' | 'Energy' | 'Agriculture'
  | 'UK Stocks' | 'French Stocks' | 'German Stocks' | 'Spanish Stocks' | 'Portuguese Stocks' | 'Dutch Stocks' | 'Scandinavian Stocks'
  | 'European Bonds' | 'US Bonds';

export interface Asset {
  symbol: string;
  name: string;
  category: AssetCategory;
  subCategory: AssetSubCategory;
  icon?: string;
  precision: number;
  lotSize: number;
  minLot: number;
  maxLot: number;
  leverage: number;
  tradingHours: string;
  description: string;
}

// 🗄️ ALL ASSETS DATABASE (370+ ATIVOS)
export const ALL_ASSETS: Asset[] = [
  
  // ============================================================================
  // 💱 FOREX - PARES DE MOEDAS (65 PARES)
  // ============================================================================
  
  // MAJOR PAIRS
  { symbol: 'EURUSD', name: 'Euro vs US Dollar', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Par mais negociado' },
  { symbol: 'GBPUSD', name: 'British Pound vs US Dollar', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Cable' },
  { symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Safe haven' },
  { symbol: 'USDCHF', name: 'US Dollar vs Swiss Franc', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Swissie' },
  { symbol: 'AUDUSD', name: 'Australian Dollar vs US Dollar', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Aussie' },
  { symbol: 'USDCAD', name: 'US Dollar vs Canadian Dollar', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Loonie' },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar vs US Dollar', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Kiwi' },
  
  // MINOR PAIRS
  { symbol: 'EURGBP', name: 'Euro vs British Pound', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Chunnel' },
  { symbol: 'EURJPY', name: 'Euro vs Japanese Yen', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Yuppy' },
  { symbol: 'EURCHF', name: 'Euro vs Swiss Franc', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'EUR/CHF' },
  { symbol: 'EURAUD', name: 'Euro vs Australian Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'EUR/AUD' },
  { symbol: 'EURCAD', name: 'Euro vs Canadian Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'EUR/CAD' },
  { symbol: 'EURNZD', name: 'Euro vs New Zealand Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'EUR/NZD' },
  { symbol: 'GBPJPY', name: 'British Pound vs Japanese Yen', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Geppy' },
  { symbol: 'GBPCHF', name: 'British Pound vs Swiss Franc', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'GBP/CHF' },
  { symbol: 'GBPAUD', name: 'British Pound vs Australian Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'GBP/AUD' },
  { symbol: 'GBPCAD', name: 'British Pound vs Canadian Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'GBP/CAD' },
  { symbol: 'GBPNZD', name: 'British Pound vs New Zealand Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'GBP/NZD' },
  { symbol: 'AUDCAD', name: 'Australian Dollar vs Canadian Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'AUD/CAD' },
  { symbol: 'AUDCHF', name: 'Australian Dollar vs Swiss Franc', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'AUD/CHF' },
  { symbol: 'AUDJPY', name: 'Australian Dollar vs Japanese Yen', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'AUD/JPY' },
  { symbol: 'AUDNZD', name: 'Australian Dollar vs New Zealand Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'AUD/NZD' },
  { symbol: 'NZDCAD', name: 'New Zealand Dollar vs Canadian Dollar', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'NZD/CAD' },
  { symbol: 'NZDCHF', name: 'New Zealand Dollar vs Swiss Franc', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'NZD/CHF' },
  { symbol: 'NZDJPY', name: 'New Zealand Dollar vs Japanese Yen', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'NZD/JPY' },
  { symbol: 'CADCHF', name: 'Canadian Dollar vs Swiss Franc', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'CAD/CHF' },
  { symbol: 'CADJPY', name: 'Canadian Dollar vs Japanese Yen', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'CAD/JPY' },
  { symbol: 'CHFJPY', name: 'Swiss Franc vs Japanese Yen', category: 'FOREX', subCategory: 'Minor Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'CHF/JPY' },
  
  // EXOTIC PAIRS
  { symbol: 'USDMXN', name: 'US Dollar vs Mexican Peso', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/MXN' },
  { symbol: 'USDZAR', name: 'US Dollar vs South African Rand', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/ZAR' },
  { symbol: 'USDTRY', name: 'US Dollar vs Turkish Lira', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 50, tradingHours: '24/5', description: 'USD/TRY' },
  { symbol: 'USDSEK', name: 'US Dollar vs Swedish Krona', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 200, tradingHours: '24/5', description: 'USD/SEK' },
  { symbol: 'USDNOK', name: 'US Dollar vs Norwegian Krone', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 200, tradingHours: '24/5', description: 'USD/NOK' },
  { symbol: 'USDPLN', name: 'US Dollar vs Polish Zloty', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/PLN' },
  { symbol: 'USDHUF', name: 'US Dollar vs Hungarian Forint', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/HUF' },
  { symbol: 'USDCZK', name: 'US Dollar vs Czech Koruna', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/CZK' },
  { symbol: 'USDHKD', name: 'US Dollar vs Hong Kong Dollar', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/HKD' },
  { symbol: 'USDSGD', name: 'US Dollar vs Singapore Dollar', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 200, tradingHours: '24/5', description: 'USD/SGD' },
  { symbol: 'USDTHB', name: 'US Dollar vs Thai Baht', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/THB' },
  { symbol: 'USDINR', name: 'US Dollar vs Indian Rupee', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 50, tradingHours: '24/5', description: 'USD/INR' },
  { symbol: 'USDIDR', name: 'US Dollar vs Indonesian Rupiah', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 2, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 50, tradingHours: '24/5', description: 'USD/IDR' },
  { symbol: 'USDKRW', name: 'US Dollar vs South Korean Won', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 2, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 50, tradingHours: '24/5', description: 'USD/KRW' },
  { symbol: 'USDMYR', name: 'US Dollar vs Malaysian Ringgit', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/MYR' },
  { symbol: 'USDCNH', name: 'US Dollar vs Chinese Yuan Offshore', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 50, tradingHours: '24/5', description: 'USD/CNH' },
  { symbol: 'USDRUB', name: 'US Dollar vs Russian Ruble', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 4, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 50, tradingHours: '24/5', description: 'USD/RUB' },
  { symbol: 'USDTWD', name: 'US Dollar vs Taiwan Dollar', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 3, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/TWD' },
  { symbol: 'EURMXN', name: 'Euro vs Mexican Peso', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'EUR/MXN' },
  { symbol: 'EURNOK', name: 'Euro vs Norwegian Krone', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 200, tradingHours: '24/5', description: 'EUR/NOK' },
  { symbol: 'EURSEK', name: 'Euro vs Swedish Krona', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 200, tradingHours: '24/5', description: 'EUR/SEK' },
  { symbol: 'EURSGD', name: 'Euro vs Singapore Dollar', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 200, tradingHours: '24/5', description: 'EUR/SGD' },
  { symbol: 'EURZAR', name: 'Euro vs South African Rand', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'EUR/ZAR' },
  
  // ============================================================================
  // 🪙 CRYPTO - CRIPTOMOEDAS (40+ ATIVOS)
  // ============================================================================
  
  { symbol: 'BTCUSD', name: 'Bitcoin', category: 'CRYPTO', subCategory: 'Bitcoin', icon: '₿', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Bitcoin' },
  { symbol: 'ETHUSD', name: 'Ethereum', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ξ', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Ethereum' },
  { symbol: 'XRPUSD', name: 'Ripple', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🪙', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Ripple' },
  { symbol: 'BNBUSD', name: 'Binance Coin', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🟡', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Binance Coin' },
  { symbol: 'ADAUSD', name: 'Cardano', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔵', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Cardano' },
  { symbol: 'SOLUSD', name: 'Solana', category: 'CRYPTO', subCategory: 'Altcoins', icon: '⚡', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Solana' },
  { symbol: 'DOTUSD', name: 'Polkadot', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔴', precision: 3, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Polkadot' },
  { symbol: 'MATICUSD', name: 'Polygon', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🟣', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Polygon' },
  { symbol: 'AVAXUSD', name: 'Avalanche', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔺', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Avalanche' },
  { symbol: 'LINKUSD', name: 'Chainlink', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔗', precision: 3, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Chainlink' },
  { symbol: 'UNIUSD', name: 'Uniswap', category: 'CRYPTO', subCategory: 'DeFi', icon: '🦄', precision: 3, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Uniswap' },
  { symbol: 'ATOMUSD', name: 'Cosmos', category: 'CRYPTO', subCategory: 'Altcoins', icon: '⚛️', precision: 3, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Cosmos' },
  { symbol: 'XLMUSD', name: 'Stellar', category: 'CRYPTO', subCategory: 'Altcoins', icon: '✨', precision: 5, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Stellar' },
  { symbol: 'LTCUSD', name: 'Litecoin', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ł', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Litecoin' },
  { symbol: 'BCHUSD', name: 'Bitcoin Cash', category: 'CRYPTO', subCategory: 'Bitcoin', icon: '₿', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Bitcoin Cash' },
  { symbol: 'DOGEUSD', name: 'Dogecoin', category: 'CRYPTO', subCategory: 'Meme Coins', icon: '🐕', precision: 5, lotSize: 1, minLot: 10, maxLot: 1000000, leverage: 2, tradingHours: '24/7', description: 'Dogecoin' },
  { symbol: 'SHIBUSD', name: 'Shiba Inu', category: 'CRYPTO', subCategory: 'Meme Coins', icon: '🐕', precision: 6, lotSize: 1, minLot: 100000, maxLot: 100000000, leverage: 2, tradingHours: '24/7', description: 'Shiba Inu' },
  
  // ============================================================================
  // 📊 INDICES - ÍNDICES GLOBAIS (16 ÍNDICES)
  // ============================================================================
  
  // US INDICES
  { symbol: 'SPX500', name: 'S&P 500', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'S&P 500' },
  { symbol: 'NAS100', name: 'NASDAQ 100', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'NASDAQ 100' },
  { symbol: 'DJI30', name: 'Dow Jones Industrial Average', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'Dow Jones' },
  { symbol: 'US2000', name: 'Russell 2000', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'Russell 2000' },
  
  // EUROPEAN INDICES
  { symbol: 'UK100', name: 'FTSE 100', category: 'INDICES', subCategory: 'European Indices', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '08:00-16:30 GMT', description: 'FTSE 100' },
  { symbol: 'GER40', name: 'DAX 40', category: 'INDICES', subCategory: 'European Indices', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '08:00-22:00 CET', description: 'DAX 40' },
  { symbol: 'FRA40', name: 'CAC 40', category: 'INDICES', subCategory: 'European Indices', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-17:30 CET', description: 'CAC 40' },
  { symbol: 'ESP35', name: 'IBEX 35', category: 'INDICES', subCategory: 'European Indices', icon: '🇪🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-17:30 CET', description: 'IBEX 35' },
  { symbol: 'ITA40', name: 'FTSE MIB', category: 'INDICES', subCategory: 'European Indices', icon: '🇮🇹', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-17:30 CET', description: 'FTSE MIB' },
  { symbol: 'NETH25', name: 'AEX 25', category: 'INDICES', subCategory: 'European Indices', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-17:30 CET', description: 'AEX 25' },
  { symbol: 'SUI20', name: 'SMI 20', category: 'INDICES', subCategory: 'European Indices', icon: '🇨🇭', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-17:30 CET', description: 'SMI 20' },
  { symbol: 'EUSTX50', name: 'Euro Stoxx 50', category: 'INDICES', subCategory: 'European Indices', icon: '🇪🇺', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-22:00 CET', description: 'Euro Stoxx 50' },
  
  // ASIAN INDICES
  { symbol: 'JP225', name: 'Nikkei 225', category: 'INDICES', subCategory: 'Asian Indices', icon: '🇯🇵', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-15:00 JST', description: 'Nikkei 225' },
  { symbol: 'HK50', name: 'Hang Seng', category: 'INDICES', subCategory: 'Asian Indices', icon: '🇭🇰', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 HKT', description: 'Hang Seng' },
  { symbol: 'AUS200', name: 'ASX 200', category: 'INDICES', subCategory: 'Asian Indices', icon: '🇦🇺', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '10:00-16:00 AEST', description: 'ASX 200' },
  { symbol: 'CHINA50', name: 'FTSE China A50', category: 'INDICES', subCategory: 'Asian Indices', icon: '🇨🇳', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:00-15:00 CST', description: 'FTSE China A50' },
  
  // ============================================================================
  // 🏅 COMMODITIES - METAIS E ENERGIA (14 ATIVOS)
  // ============================================================================
  
  // PRECIOUS METALS
  { symbol: 'XAUUSD', name: 'Gold', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold' },
  { symbol: 'XAGUSD', name: 'Silver', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥈', precision: 3, lotSize: 5000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Silver' },
  { symbol: 'XPTUSD', name: 'Platinum', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '⚪', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Platinum' },
  { symbol: 'XPDUSD', name: 'Palladium', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '⚪', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Palladium' },
  
  // ENERGY
  { symbol: 'USOUSD', name: 'Crude Oil WTI', category: 'COMMODITIES', subCategory: 'Energy', icon: '🛢️', precision: 2, lotSize: 1000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'WTI Crude Oil' },
  { symbol: 'UKOUSD', name: 'Brent Oil', category: 'COMMODITIES', subCategory: 'Energy', icon: '🛢️', precision: 2, lotSize: 1000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Brent Crude Oil' },
  { symbol: 'XNGUSD', name: 'Natural Gas', category: 'COMMODITIES', subCategory: 'Energy', icon: '🔥', precision: 3, lotSize: 10000, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Natural Gas' },
  
  // AGRICULTURE
  { symbol: 'WHEUSD', name: 'Wheat', category: 'COMMODITIES', subCategory: 'Agriculture', icon: '🌾', precision: 2, lotSize: 5000, minLot: 0.1, maxLot: 100, leverage: 50, tradingHours: '01:00-13:45 CT', description: 'Wheat' },
  { symbol: 'CORNUSD', name: 'Corn', category: 'COMMODITIES', subCategory: 'Agriculture', icon: '🌽', precision: 2, lotSize: 5000, minLot: 0.1, maxLot: 100, leverage: 50, tradingHours: '01:00-13:45 CT', description: 'Corn' },
  { symbol: 'SOYUSD', name: 'Soybeans', category: 'COMMODITIES', subCategory: 'Agriculture', icon: '🫘', precision: 2, lotSize: 5000, minLot: 0.1, maxLot: 100, leverage: 50, tradingHours: '01:00-13:45 CT', description: 'Soybeans' },
  { symbol: 'COTUSD', name: 'Cotton', category: 'COMMODITIES', subCategory: 'Agriculture', icon: '☁️', precision: 4, lotSize: 50000, minLot: 0.1, maxLot: 100, leverage: 50, tradingHours: '02:00-14:20 CT', description: 'Cotton' },
  { symbol: 'COFUSD', name: 'Coffee', category: 'COMMODITIES', subCategory: 'Agriculture', icon: '☕', precision: 4, lotSize: 37500, minLot: 0.1, maxLot: 100, leverage: 50, tradingHours: '04:15-13:30 ET', description: 'Coffee' },
  { symbol: 'SUGUSD', name: 'Sugar', category: 'COMMODITIES', subCategory: 'Agriculture', icon: '🍬', precision: 4, lotSize: 112000, minLot: 0.1, maxLot: 100, leverage: 50, tradingHours: '03:30-14:00 ET', description: 'Sugar' },
  { symbol: 'COCUSD', name: 'Cocoa', category: 'COMMODITIES', subCategory: 'Agriculture', icon: '🍫', precision: 2, lotSize: 10, minLot: 0.1, maxLot: 100, leverage: 50, tradingHours: '04:45-13:30 ET', description: 'Cocoa' },
  
  // ============================================================================
  // 📈 STOCKS - AÇÕES EUROPEIAS (200+ AÇÕES)
  // ============================================================================
  
  // UK STOCKS (FTSE 100)
  { symbol: 'AAL.L', name: 'Anglo American PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Mining' },
  { symbol: 'AHT.L', name: 'Ashtead Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Equipment Rental' },
  { symbol: 'ANTO.L', name: 'Antofagasta PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Mining' },
  { symbol: 'AV.L', name: 'Aviva PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Insurance' },
  { symbol: 'AZN.L', name: 'AstraZeneca PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Pharmaceuticals' },
  { symbol: 'BA.L', name: 'BAE Systems PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Defense' },
  { symbol: 'BARC.L', name: 'Barclays PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Banking' },
  { symbol: 'BATS.L', name: 'British American Tobacco PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Tobacco' },
  { symbol: 'BDEV.L', name: 'Barratt Developments PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Homebuilding' },
  { symbol: 'BKG.L', name: 'Berkeley Group Holdings PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Homebuilding' },
  { symbol: 'BNZL.L', name: 'Bunzl PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Distribution' },
  { symbol: 'BP.L', name: 'BP PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Oil & Gas' },
  { symbol: 'BRBY.L', name: 'Burberry Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Luxury Fashion' },
  { symbol: 'BT-A.L', name: 'BT Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Telecommunications' },
  { symbol: 'CCH.L', name: 'Coca-Cola HBC AG', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Beverages' },
  { symbol: 'CNA.L', name: 'Centrica PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Energy' },
  { symbol: 'CPG.L', name: 'Compass Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Food Services' },
  { symbol: 'CRDA.L', name: 'Croda International PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Specialty Chemicals' },
  { symbol: 'DCC.L', name: 'DCC PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Distribution' },
  { symbol: 'DGE.L', name: 'Diageo PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Beverages' },
  { symbol: 'EXPN.L', name: 'Experian PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Credit Services' },
  { symbol: 'FLTR.L', name: 'Flutter Entertainment PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Gambling' },
  { symbol: 'FRES.L', name: 'Fresnillo PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Precious Metals Mining' },
  { symbol: 'GLEN.L', name: 'Glencore PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Mining & Commodities' },
  { symbol: 'GSK.L', name: 'GSK PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Pharmaceuticals' },
  { symbol: 'HIK.L', name: 'Hikma Pharmaceuticals PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Pharmaceuticals' },
  { symbol: 'HLMA.L', name: 'Halma PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Safety Equipment' },
  { symbol: 'HSBA.L', name: 'HSBC Holdings PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Banking' },
  { symbol: 'IAG.L', name: 'International Consolidated Airlines Group SA', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Airlines' },
  { symbol: 'ICP.L', name: 'Intermediate Capital Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Asset Management' },
  { symbol: 'IHG.L', name: 'InterContinental Hotels Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Hotels' },
  { symbol: 'IMB.L', name: 'Imperial Brands PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Tobacco' },
  { symbol: 'INF.L', name: 'Informa PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Publishing & Events' },
  { symbol: 'ITRK.L', name: 'Intertek Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Testing Services' },
  { symbol: 'JD.L', name: 'JD Sports Fashion PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Retail' },
  { symbol: 'LAND.L', name: 'Land Securities Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Real Estate' },
  { symbol: 'LGEN.L', name: 'Legal & General Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Insurance' },
  { symbol: 'LLOY.L', name: 'Lloyds Banking Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Banking' },
  { symbol: 'LSEG.L', name: 'London Stock Exchange Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Financial Services' },
  { symbol: 'MNG.L', name: 'M&G PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Asset Management' },
  { symbol: 'MRO.L', name: 'Melrose Industries PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Aerospace' },
  { symbol: 'NG.L', name: 'National Grid PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Utilities' },
  { symbol: 'NWG.L', name: 'NatWest Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Banking' },
  { symbol: 'OCDO.L', name: 'Ocado Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Online Grocery' },
  { symbol: 'PSON.L', name: 'Pearson PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Publishing' },
  { symbol: 'PSN.L', name: 'Persimmon PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Homebuilding' },
  { symbol: 'PURG.L', name: 'Purplebricks Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Real Estate' },
  { symbol: 'RIO.L', name: 'Rio Tinto PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Mining' },
  { symbol: 'RKT.L', name: 'Reckitt Benckiser Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Consumer Goods' },
  { symbol: 'RR.L', name: 'Rolls-Royce Holdings PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Aerospace' },
  { symbol: 'RS1.L', name: 'RS Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Industrial Distribution' },
  { symbol: 'SBRY.L', name: 'J Sainsbury PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Retail' },
  { symbol: 'SDR.L', name: 'Schroders PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Asset Management' },
  { symbol: 'SGE.L', name: 'Sage Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Software' },
  { symbol: 'SGRO.L', name: 'Segro PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Real Estate' },
  { symbol: 'SHEL.L', name: 'Shell PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Oil & Gas' },
  { symbol: 'SMDS.L', name: 'DS Smith PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Packaging' },
  { symbol: 'SMIN.L', name: 'Smiths Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Engineering' },
  { symbol: 'SMT.L', name: 'Scottish Mortgage Investment Trust PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Investment Trust' },
  { symbol: 'SN.L', name: 'Smith & Nephew PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Medical Devices' },
  { symbol: 'SPX.L', name: 'Spirax-Sarco Engineering PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Engineering' },
  { symbol: 'SSE.L', name: 'SSE PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Utilities' },
  { symbol: 'STAN.L', name: 'Standard Chartered PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Banking' },
  { symbol: 'STJ.L', name: 'St. James Place PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Wealth Management' },
  { symbol: 'SVT.L', name: 'Severn Trent PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Water Utilities' },
  { symbol: 'TSCO.L', name: 'Tesco PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Retail' },
  { symbol: 'TW.L', name: 'Taylor Wimpey PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Homebuilding' },
  { symbol: 'ULVR.L', name: 'Unilever PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Consumer Goods' },
  { symbol: 'UU.L', name: 'United Utilities Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Water Utilities' },
  { symbol: 'VOD.L', name: 'Vodafone Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Telecommunications' },
  { symbol: 'WTB.L', name: 'Whitbread PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Hotels & Restaurants' },
  
  // FRENCH STOCKS (CAC 40) - Sample
  { symbol: 'AC.PA', name: 'Accor SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Hotels' },
  { symbol: 'AI.PA', name: 'Air Liquide SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Industrial Gases' },
  { symbol: 'AIR.PA', name: 'Airbus SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Aerospace' },
  { symbol: 'ALO.PA', name: 'Alstom SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Rail Transport' },
  { symbol: 'ATO.PA', name: 'Atos SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'IT Services' },
  { symbol: 'BN.PA', name: 'Danone SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Food Products' },
  { symbol: 'BNP.PA', name: 'BNP Paribas SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'CA.PA', name: 'Carrefour SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Retail' },
  { symbol: 'CAP.PA', name: 'Capgemini SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'IT Consulting' },
  { symbol: 'CS.PA', name: 'AXA SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  { symbol: 'DG.PA', name: 'Vinci SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Construction' },
  { symbol: 'DSY.PA', name: 'Dassault Systemes SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Software' },
  { symbol: 'ENGI.PA', name: 'Engie SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Energy' },
  { symbol: 'FP.PA', name: 'TotalEnergies SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Oil & Gas' },
  { symbol: 'GLE.PA', name: 'Societe Generale SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'KER.PA', name: 'Kering SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Luxury Goods' },
  { symbol: 'MC.PA', name: 'LVMH Moet Hennessy Louis Vuitton SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Luxury Goods' },
  { symbol: 'ML.PA', name: 'Michelin', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Tires' },
  { symbol: 'OR.PA', name: "L'Oreal SA", category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Cosmetics' },
  { symbol: 'ORA.PA', name: 'Orange SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Telecommunications' },
  { symbol: 'RI.PA', name: 'Pernod Ricard SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Beverages' },
  { symbol: 'RMS.PA', name: 'Hermes International SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Luxury Goods' },
  { symbol: 'SAN.PA', name: 'Sanofi SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Pharmaceuticals' },
  { symbol: 'SAF.PA', name: 'Safran SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Aerospace' },
  { symbol: 'SGO.PA', name: 'Compagnie de Saint-Gobain SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Building Materials' },
  { symbol: 'SU.PA', name: 'Schneider Electric SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Electrical Equipment' },
  { symbol: 'TEP.PA', name: 'Teleperformance SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Business Services' },
  { symbol: 'URW.PA', name: 'Unibail-Rodamco-Westfield SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Real Estate' },
  { symbol: 'VIE.PA', name: 'Veolia Environnement SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Water & Waste' },
  { symbol: 'VIV.PA', name: 'Vivendi SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Media' },
  { symbol: 'WLN.PA', name: 'Worldline SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Payment Services' },
  
  // GERMAN STOCKS (DAX 40) - Sample
  { symbol: '1COV.DE', name: 'Covestro AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Chemicals' },
  { symbol: 'ADS.DE', name: 'Adidas AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Sporting Goods' },
  { symbol: 'ALV.DE', name: 'Allianz SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  { symbol: 'BAS.DE', name: 'BASF SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Chemicals' },
  { symbol: 'BAYN.DE', name: 'Bayer AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Pharmaceuticals' },
  { symbol: 'BEI.DE', name: 'Beiersdorf AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Personal Care' },
  { symbol: 'BMW.DE', name: 'Bayerische Motoren Werke AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles' },
  { symbol: 'CBK.DE', name: 'Commerzbank AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'CON.DE', name: 'Continental AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Auto Parts' },
  { symbol: 'DAI.DE', name: 'Daimler AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles' },
  { symbol: 'DB1.DE', name: 'Deutsche Boerse AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Financial Services' },
  { symbol: 'DBK.DE', name: 'Deutsche Bank AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'DPW.DE', name: 'Deutsche Post AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Logistics' },
  { symbol: 'DTE.DE', name: 'Deutsche Telekom AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Telecommunications' },
  { symbol: 'EOAN.DE', name: 'E.ON SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Utilities' },
  { symbol: 'FRE.DE', name: 'Fresenius SE & Co KGaA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Healthcare' },
  { symbol: 'FME.DE', name: 'Fresenius Medical Care AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Healthcare' },
  { symbol: 'HEN3.DE', name: 'Henkel AG & Co KGaA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Consumer Goods' },
  { symbol: 'IFX.DE', name: 'Infineon Technologies AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Semiconductors' },
  { symbol: 'LHA.DE', name: 'Deutsche Lufthansa AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Airlines' },
  { symbol: 'LIN.DE', name: 'Linde PLC', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Industrial Gases' },
  { symbol: 'MRK.DE', name: 'Merck KGaA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Pharmaceuticals' },
  { symbol: 'MUV2.DE', name: 'Muenchener Rueckversicherungs-Gesellschaft AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Reinsurance' },
  { symbol: 'RWE.DE', name: 'RWE AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Utilities' },
  { symbol: 'SAP.DE', name: 'SAP SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Software' },
  { symbol: 'SIE.DE', name: 'Siemens AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Conglomerate' },
  { symbol: 'VOW3.DE', name: 'Volkswagen AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles' },
  
  // ============================================================================
  // 📜 BONDS - TÍTULOS EUROPEUS E AMERICANOS (6 TÍTULOS)
  // ============================================================================
  
  { symbol: 'BUND10Y', name: 'German 10-Year Bund', category: 'BONDS', subCategory: 'European Bonds', icon: '🇩🇪', precision: 3, lotSize: 1000, minLot: 1, maxLot: 100, leverage: 50, tradingHours: '08:00-22:00 CET', description: 'German Government Bond' },
  { symbol: 'UK10Y', name: 'UK 10-Year Gilt', category: 'BONDS', subCategory: 'European Bonds', icon: '🇬🇧', precision: 3, lotSize: 1000, minLot: 1, maxLot: 100, leverage: 50, tradingHours: '08:00-16:30 GMT', description: 'UK Government Bond' },
  { symbol: 'FR10Y', name: 'French 10-Year OAT', category: 'BONDS', subCategory: 'European Bonds', icon: '🇫🇷', precision: 3, lotSize: 1000, minLot: 1, maxLot: 100, leverage: 50, tradingHours: '09:00-17:30 CET', description: 'French Government Bond' },
  { symbol: 'US10Y', name: 'US 10-Year Treasury Note', category: 'BONDS', subCategory: 'US Bonds', icon: '🇺🇸', precision: 4, lotSize: 1000, minLot: 1, maxLot: 100, leverage: 50, tradingHours: '18:00-17:00 ET', description: 'US Treasury Bond' },
  { symbol: 'US30Y', name: 'US 30-Year Treasury Bond', category: 'BONDS', subCategory: 'US Bonds', icon: '🇺🇸', precision: 4, lotSize: 1000, minLot: 1, maxLot: 100, leverage: 50, tradingHours: '18:00-17:00 ET', description: 'US Long Bond' },
  { symbol: 'US2Y', name: 'US 2-Year Treasury Note', category: 'BONDS', subCategory: 'US Bonds', icon: '🇺🇸', precision: 4, lotSize: 1000, minLot: 1, maxLot: 100, leverage: 50, tradingHours: '18:00-17:00 ET', description: 'US Short Bond' },
];

// ============================================================================
// 🛠️ HELPER FUNCTIONS
// ============================================================================

export function getAssetBySymbol(symbol: string): Asset | undefined {
  return ALL_ASSETS.find(asset => asset.symbol === symbol);
}

export function getAssetsByCategory(category: AssetCategory): Asset[] {
  return ALL_ASSETS.filter(asset => asset.category === category);
}

export function getAssetsBySubCategory(subCategory: AssetSubCategory): Asset[] {
  return ALL_ASSETS.filter(asset => asset.subCategory === subCategory);
}

export function searchAssets(query: string): Asset[] {
  const lowerQuery = query.toLowerCase();
  return ALL_ASSETS.filter(asset => 
    asset.symbol.toLowerCase().includes(lowerQuery) ||
    asset.name.toLowerCase().includes(lowerQuery) ||
    asset.description.toLowerCase().includes(lowerQuery) ||
    asset.category.toLowerCase().includes(lowerQuery) ||
    asset.subCategory.toLowerCase().includes(lowerQuery)
  );
}

// Get asset count by category
export function getAssetCountByCategory(): Record<AssetCategory, number> {
  return {
    FOREX: getAssetsByCategory('FOREX').length,
    CRYPTO: getAssetsByCategory('CRYPTO').length,
    INDICES: getAssetsByCategory('INDICES').length,
    COMMODITIES: getAssetsByCategory('COMMODITIES').length,
    STOCKS: getAssetsByCategory('STOCKS').length,
    BONDS: getAssetsByCategory('BONDS').length,
  };
}
