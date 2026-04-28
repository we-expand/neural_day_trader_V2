/**
 * 🏦 INFINOX BROKER - ESPECIFICAÇÕES COMPLETAS DE CONTRATOS
 * 
 * Valores de tick/point para TODOS os 300+ ativos disponíveis na Infinox
 * Baseado em especificações reais de mercado MT5
 * 
 * FÓRMULA DE P&L:
 * pnl = (preço_saída - preço_entrada) × lote × valor_por_ponto
 * 
 * Valores padrão por categoria:
 * - FOREX Majors: $10 por pip (lote padrão)
 * - FOREX Crosses: $7-12 por pip (dependendo da força das moedas)
 * - FOREX Exóticos: $5-8 por pip
 * - Crypto: $1 por ponto de movimento
 * - Índices: $5-50 por ponto (dependendo do índice)
 * - Metais: $1-50 por ponto
 * - Energia: $10-1000 por ponto
 * - Commodities: $10-50 por ponto
 * - Ações: $1 por ponto (1 ação)
 * - Bonds: $10-31.25 por tick
 * - Futuros: Varia por contrato
 */

import { ContractSpec } from './contractSpecs';

/**
 * 🔧 GERADOR DE ESPECIFICAÇÕES POR PADRÃO
 */

// Padrões por categoria
const FOREX_MAJOR = {
  tickSize: 0.00001,
  tickValue: 1,
  pointValue: 10,
  contractSize: 100000,
  currency: 'USD',
  minLotSize: 0.01,
};

const FOREX_CROSS_STRONG = {
  tickSize: 0.00001,
  tickValue: 1.2,
  pointValue: 12,
  contractSize: 100000,
  currency: 'USD',
  minLotSize: 0.01,
};

const FOREX_CROSS_WEAK = {
  tickSize: 0.00001,
  tickValue: 0.7,
  pointValue: 7,
  contractSize: 100000,
  currency: 'USD',
  minLotSize: 0.01,
};

const FOREX_JPY = {
  tickSize: 0.001,
  tickValue: 0.1,
  pointValue: 10,
  contractSize: 100000,
  currency: 'USD',
  minLotSize: 0.01,
};

const FOREX_EXOTIC = {
  tickSize: 0.00001,
  tickValue: 0.5,
  pointValue: 5,
  contractSize: 100000,
  currency: 'USD',
  minLotSize: 0.01,
};

const CRYPTO_STANDARD = {
  tickSize: 0.01,
  tickValue: 0.01,
  pointValue: 1,
  contractSize: 1,
  currency: 'USD',
  minLotSize: 0.01,
};

const CRYPTO_CHEAP = {
  tickSize: 0.0001,
  tickValue: 0.0001,
  pointValue: 1,
  contractSize: 1,
  currency: 'USD',
  minLotSize: 1,
};

const INDICES_US = {
  tickSize: 0.25,
  tickValue: 12.50,
  pointValue: 50,
  contractSize: 1,
  currency: 'USD',
  minLotSize: 0.1,
};

const INDICES_EU = {
  tickSize: 0.5,
  tickValue: 12.50,
  pointValue: 25,
  contractSize: 1,
  currency: 'EUR',
  minLotSize: 0.1,
};

const METAL_GOLD = {
  tickSize: 0.01,
  tickValue: 0.01,
  pointValue: 1,
  contractSize: 100,
  currency: 'USD',
  minLotSize: 0.01,
};

const METAL_SILVER = {
  tickSize: 0.001,
  tickValue: 0.05,
  pointValue: 50,
  contractSize: 5000,
  currency: 'USD',
  minLotSize: 0.01,
};

const ENERGY_OIL = {
  tickSize: 0.01,
  tickValue: 10,
  pointValue: 1000,
  contractSize: 1000,
  currency: 'USD',
  minLotSize: 0.01,
};

const COMMODITY_STANDARD = {
  tickSize: 0.25,
  tickValue: 12.50,
  pointValue: 50,
  contractSize: 5000,
  currency: 'USD',
  minLotSize: 0.1,
};

const STOCK_STANDARD = {
  tickSize: 0.01,
  tickValue: 0.01,
  pointValue: 1,
  contractSize: 100,
  currency: 'USD',
  minLotSize: 1,
};

const BOND_US = {
  tickSize: 0.015625, // 1/64
  tickValue: 15.625,
  pointValue: 1000,
  contractSize: 1000,
  currency: 'USD',
  minLotSize: 1,
};

/**
 * 📋 ESPECIFICAÇÕES COMPLETAS - TODOS OS ATIVOS INFINOX
 */
export const INFINOX_CONTRACT_SPECS: Record<string, Partial<ContractSpec>> = {
  
  // ============================================================
  // 💱 FOREX - MAJORS
  // ============================================================
  'EURUSD': { ...FOREX_MAJOR, category: 'FOREX', description: 'Euro vs US Dollar' },
  'GBPUSD': { ...FOREX_MAJOR, category: 'FOREX', description: 'British Pound vs US Dollar' },
  'USDJPY': { ...FOREX_JPY, category: 'FOREX', description: 'US Dollar vs Japanese Yen' },
  'USDCHF': { ...FOREX_MAJOR, category: 'FOREX', description: 'US Dollar vs Swiss Franc' },
  'AUDUSD': { ...FOREX_MAJOR, category: 'FOREX', description: 'Australian Dollar vs US Dollar' },
  'USDCAD': { ...FOREX_MAJOR, tickValue: 0.8, pointValue: 8, category: 'FOREX', description: 'US Dollar vs Canadian Dollar' },
  'NZDUSD': { ...FOREX_MAJOR, category: 'FOREX', description: 'New Zealand Dollar vs US Dollar' },

  // ============================================================
  // 💱 FOREX - EUR CROSSES
  // ============================================================
  'EURAUD': { ...FOREX_CROSS_WEAK, category: 'FOREX', description: 'Euro vs Australian Dollar' },
  'EURCAD': { ...FOREX_CROSS_WEAK, pointValue: 7.5, category: 'FOREX', description: 'Euro vs Canadian Dollar' },
  'EURCHF': { ...FOREX_CROSS_STRONG, pointValue: 11, category: 'FOREX', description: 'Euro vs Swiss Franc' },
  'EURGBP': { ...FOREX_CROSS_STRONG, category: 'FOREX', description: 'Euro vs British Pound' },
  'EURJPY': { ...FOREX_JPY, tickValue: 0.09, pointValue: 9, category: 'FOREX', description: 'Euro vs Japanese Yen' },
  'EURNOK': { ...FOREX_EXOTIC, pointValue: 6, category: 'FOREX', description: 'Euro vs Norwegian Krone' },
  'EURNZD': { ...FOREX_CROSS_WEAK, pointValue: 6, category: 'FOREX', description: 'Euro vs New Zealand Dollar' },
  'EURSEK': { ...FOREX_EXOTIC, pointValue: 6, category: 'FOREX', description: 'Euro vs Swedish Krona' },
  'EURSGD': { ...FOREX_EXOTIC, pointValue: 7, category: 'FOREX', description: 'Euro vs Singapore Dollar' },
  'EURZAR': { ...FOREX_EXOTIC, pointValue: 4, category: 'FOREX', description: 'Euro vs South African Rand' },
  'EURMXN': { ...FOREX_EXOTIC, pointValue: 3, category: 'FOREX', description: 'Euro vs Mexican Peso' },
  'EURHKD': { ...FOREX_EXOTIC, pointValue: 6, category: 'FOREX', description: 'Euro vs Hong Kong Dollar' },
  'EURHUF': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'Euro vs Hungarian Forint' },
  'EURTRY': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'Euro vs Turkish Lira' },

  // ============================================================
  // 💱 FOREX - GBP CROSSES
  // ============================================================
  'GBPAUD': { ...FOREX_CROSS_WEAK, pointValue: 8.5, category: 'FOREX', description: 'British Pound vs Australian Dollar' },
  'GBPCAD': { ...FOREX_CROSS_WEAK, pointValue: 9, category: 'FOREX', description: 'British Pound vs Canadian Dollar' },
  'GBPCHF': { ...FOREX_CROSS_STRONG, pointValue: 13, category: 'FOREX', description: 'British Pound vs Swiss Franc' },
  'GBPJPY': { ...FOREX_JPY, tickValue: 0.11, pointValue: 11, category: 'FOREX', description: 'British Pound vs Japanese Yen' },
  'GBPNZD': { ...FOREX_CROSS_WEAK, pointValue: 7, category: 'FOREX', description: 'British Pound vs New Zealand Dollar' },
  'GBPSEK': { ...FOREX_EXOTIC, pointValue: 6.5, category: 'FOREX', description: 'British Pound vs Swedish Krona' },

  // ============================================================
  // 💱 FOREX - AUD CROSSES
  // ============================================================
  'AUDCAD': { ...FOREX_CROSS_WEAK, pointValue: 7, category: 'FOREX', description: 'Australian Dollar vs Canadian Dollar' },
  'AUDCHF': { ...FOREX_CROSS_WEAK, pointValue: 8, category: 'FOREX', description: 'Australian Dollar vs Swiss Franc' },
  'AUDJPY': { ...FOREX_JPY, tickValue: 0.09, pointValue: 9, category: 'FOREX', description: 'Australian Dollar vs Japanese Yen' },
  'AUDNZD': { ...FOREX_CROSS_WEAK, pointValue: 6.5, category: 'FOREX', description: 'Australian Dollar vs New Zealand Dollar' },

  // ============================================================
  // 💱 FOREX - NZD CROSSES
  // ============================================================
  'NZDCAD': { ...FOREX_CROSS_WEAK, pointValue: 6.5, category: 'FOREX', description: 'New Zealand Dollar vs Canadian Dollar' },
  'NZDCHF': { ...FOREX_CROSS_WEAK, pointValue: 7, category: 'FOREX', description: 'New Zealand Dollar vs Swiss Franc' },
  'NZDJPY': { ...FOREX_JPY, tickValue: 0.08, pointValue: 8, category: 'FOREX', description: 'New Zealand Dollar vs Japanese Yen' },
  'NZDSGD': { ...FOREX_EXOTIC, pointValue: 6, category: 'FOREX', description: 'New Zealand Dollar vs Singapore Dollar' },

  // ============================================================
  // 💱 FOREX - CAD/CHF CROSSES
  // ============================================================
  'CADCHF': { ...FOREX_CROSS_WEAK, pointValue: 7, category: 'FOREX', description: 'Canadian Dollar vs Swiss Franc' },
  'CADJPY': { ...FOREX_JPY, tickValue: 0.08, pointValue: 8, category: 'FOREX', description: 'Canadian Dollar vs Japanese Yen' },
  'CHFJPY': { ...FOREX_JPY, category: 'FOREX', description: 'Swiss Franc vs Japanese Yen' },

  // ============================================================
  // 💱 FOREX - USD EXOTICS
  // ============================================================
  'USDCNH': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Chinese Yuan' },
  'USDDKK': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Danish Krone' },
  'USDHKD': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Hong Kong Dollar' },
  'USDINR': { ...FOREX_EXOTIC, pointValue: 3, category: 'FOREX', description: 'US Dollar vs Indian Rupee' },
  'USDMXN': { ...FOREX_EXOTIC, pointValue: 3, category: 'FOREX', description: 'US Dollar vs Mexican Peso' },
  'USDNOK': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Norwegian Krone' },
  'USDPLN': { ...FOREX_EXOTIC, pointValue: 4, category: 'FOREX', description: 'US Dollar vs Polish Zloty' },
  'USDRUB': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'US Dollar vs Russian Ruble' },
  'USDSEK': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Swedish Krona' },
  'USDSGD': { ...FOREX_EXOTIC, pointValue: 7, category: 'FOREX', description: 'US Dollar vs Singapore Dollar' },
  'USDTHB': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'US Dollar vs Thai Baht' },
  'USDTRY': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'US Dollar vs Turkish Lira' },
  'USDCLP': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'US Dollar vs Chilean Peso' },
  'USDCOP': { ...FOREX_EXOTIC, pointValue: 1.5, category: 'FOREX', description: 'US Dollar vs Colombian Peso' },
  'USDCZK': { ...FOREX_EXOTIC, pointValue: 3, category: 'FOREX', description: 'US Dollar vs Czech Koruna' },
  'USDIDR': { ...FOREX_EXOTIC, pointValue: 1, category: 'FOREX', description: 'US Dollar vs Indonesian Rupiah' },
  'USDKRW': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'US Dollar vs South Korean Won' },
  'USDPHP': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'US Dollar vs Philippine Peso' },
  'USDTWD': { ...FOREX_EXOTIC, pointValue: 2, category: 'FOREX', description: 'US Dollar vs Taiwan Dollar' },
  'USDVND': { ...FOREX_EXOTIC, pointValue: 1, category: 'FOREX', description: 'US Dollar vs Vietnamese Dong' },
  'USDBRL': { ...FOREX_EXOTIC, pointValue: 3, category: 'FOREX', description: 'US Dollar vs Brazilian Real' },
  'USDZAR': { ...FOREX_EXOTIC, pointValue: 4, category: 'FOREX', description: 'US Dollar vs South African Rand' },

  // ============================================================
  // 🥇 METAIS PRECIOSOS
  // ============================================================
  'XAUUSD': { ...METAL_GOLD, category: 'METALS', description: 'Gold vs US Dollar' },
  'XAGUSD': { ...METAL_SILVER, category: 'METALS', description: 'Silver vs US Dollar' },
  'XAUEUR': { ...METAL_GOLD, currency: 'EUR', category: 'METALS', description: 'Gold vs Euro' },
  'XAUGBP': { ...METAL_GOLD, currency: 'GBP', category: 'METALS', description: 'Gold vs British Pound' },
  'XAUAUD': { ...METAL_GOLD, currency: 'AUD', category: 'METALS', description: 'Gold vs Australian Dollar' },
  'XPTUSD': { ...METAL_GOLD, pointValue: 1, category: 'METALS', description: 'Platinum vs US Dollar' },
  'XPDUSD': { ...METAL_GOLD, pointValue: 1, category: 'METALS', description: 'Palladium vs US Dollar' },
  'COPPER': { tickSize: 0.0001, tickValue: 0.25, pointValue: 25, contractSize: 25000, currency: 'USD', minLotSize: 1, category: 'METALS', description: 'Copper Futures' },

  // ============================================================
  // ⚡ ENERGIA
  // ============================================================
  'USOUSD': { ...ENERGY_OIL, category: 'ENERGY', description: 'WTI Crude Oil' },
  'UKOUSD': { ...ENERGY_OIL, category: 'ENERGY', description: 'Brent Crude Oil' },
  'NGAS': { tickSize: 0.001, tickValue: 10, pointValue: 10000, contractSize: 10000, currency: 'USD', minLotSize: 0.01, category: 'ENERGY', description: 'Natural Gas' },

  // ============================================================
  // 🌾 COMMODITIES
  // ============================================================
  'WHEATUSD': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Wheat Futures' },
  'CORNUSD': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Corn Futures' },
  'SOYBEANUSD': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Soybean Futures' },
  'COFFEEUSD': { tickSize: 0.05, tickValue: 18.75, pointValue: 375, contractSize: 37500, currency: 'USD', minLotSize: 0.1, category: 'COMMODITIES', description: 'Coffee Arabica' },
  'SUGARUSD': { tickSize: 0.01, tickValue: 11.20, pointValue: 1120, contractSize: 112000, currency: 'USD', minLotSize: 0.1, category: 'COMMODITIES', description: 'Sugar' },
  'COTTONUSD': { tickSize: 0.01, tickValue: 5, pointValue: 500, contractSize: 50000, currency: 'USD', minLotSize: 0.1, category: 'COMMODITIES', description: 'Cotton' },
  'COCOAUSD': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 10, currency: 'USD', minLotSize: 1, category: 'COMMODITIES', description: 'Cocoa' },

  // ============================================================
  // 📈 ÍNDICES
  // ============================================================
  'US500': { ...INDICES_US, category: 'INDICES', description: 'S&P 500 E-mini' },
  'NAS100': { tickSize: 0.25, tickValue: 5, pointValue: 20, contractSize: 1, currency: 'USD', minLotSize: 0.1, category: 'INDICES', description: 'NASDAQ 100 E-mini' },
  'US30': { tickSize: 1, tickValue: 5, pointValue: 5, contractSize: 1, currency: 'USD', minLotSize: 0.1, category: 'INDICES', description: 'Dow Jones E-mini' },
  'US2000': { tickSize: 0.1, tickValue: 5, pointValue: 50, contractSize: 1, currency: 'USD', minLotSize: 0.1, category: 'INDICES', description: 'Russell 2000 E-mini' },
  'VIX': { tickSize: 0.05, tickValue: 50, pointValue: 1000, contractSize: 1000, currency: 'USD', minLotSize: 1, category: 'INDICES', description: 'Volatility Index' },
  
  'GER40': { ...INDICES_EU, category: 'INDICES', description: 'DAX 40 (Germany)' },
  'UK100': { tickSize: 0.5, tickValue: 5, pointValue: 10, contractSize: 1, currency: 'GBP', minLotSize: 0.1, category: 'INDICES', description: 'FTSE 100 (UK)' },
  'FRA40': { ...INDICES_EU, category: 'INDICES', description: 'CAC 40 (France)' },
  'EU50': { ...INDICES_EU, category: 'INDICES', description: 'Euro Stoxx 50' },
  'SPA35': { ...INDICES_EU, category: 'INDICES', description: 'IBEX 35 (Spain)' },
  'ITA40': { ...INDICES_EU, category: 'INDICES', description: 'FTSE MIB (Italy)' },
  'SWI20': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 1, currency: 'CHF', minLotSize: 0.1, category: 'INDICES', description: 'SMI (Switzerland)' },
  'AUS200': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 1, currency: 'AUD', minLotSize: 0.1, category: 'INDICES', description: 'ASX 200 (Australia)' },
  'JPN225': { tickSize: 1, tickValue: 5, pointValue: 5, contractSize: 1, currency: 'JPY', minLotSize: 0.1, category: 'INDICES', description: 'Nikkei 225 (Japan)' },
  'HK50': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 1, currency: 'HKD', minLotSize: 0.1, category: 'INDICES', description: 'Hang Seng (Hong Kong)' },
  'CN50': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 1, currency: 'CNY', minLotSize: 0.1, category: 'INDICES', description: 'China A50' },
  'SING': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 1, currency: 'SGD', minLotSize: 0.1, category: 'INDICES', description: 'Singapore Index' },

  // ============================================================
  // ₿ CRIPTOMOEDAS
  // ============================================================
  'BTCUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Bitcoin vs USD' },
  'BTCUSDT': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Bitcoin vs USDT' },
  'ETHUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum vs USD' },
  'ETHUSDT': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum vs USDT' },
  'BCHUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Bitcoin Cash vs USD' },
  'LTCUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Litecoin vs USD' },
  'XRPUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Ripple vs USD' },
  'XRPUSDT': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Ripple vs USDT' },
  'EOSUSD': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'EOS vs USD' },
  'XLMUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Stellar vs USD' },
  'ADAUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Cardano vs USD' },
  'ADAUSDT': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Cardano vs USDT' },
  'BNBUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Binance Coin vs USD' },
  'BNBUSDT': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Binance Coin vs USDT' },
  'DOTUSD': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Polkadot vs USD' },
  'UNIUSD': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Uniswap vs USD' },
  'LINKUSD': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Chainlink vs USD' },
  'SOLUSD': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Solana vs USD' },
  'SOLUSDT': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Solana vs USDT' },
  'MATICUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Polygon vs USD' },
  'AVAXUSD': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Avalanche vs USD' },
  'AVAXUSDT': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Avalanche vs USDT' },
  'ATOMUSD': { ...CRYPTO_STANDARD, minLotSize: 0.1, category: 'CRYPTO', description: 'Cosmos vs USD' },
  'DOGEUSDT': { tickSize: 0.00001, tickValue: 0.00001, pointValue: 1, contractSize: 1, currency: 'USD', minLotSize: 10, category: 'CRYPTO', description: 'Dogecoin vs USDT' },

  // ============================================================
  // 📊 AÇÕES UK
  // ============================================================
  'LLOY': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Lloyds Banking Group' },
  'BARC': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Barclays' },
  'HSBA': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'HSBC Holdings' },
  'BP': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'BP plc' },
  'RDSA': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Royal Dutch Shell A' },
  'VOD': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Vodafone Group' },
  'GSK': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'GlaxoSmithKline' },
  'AZN': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'AstraZeneca' },
  'TSCO': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Tesco' },
  'RR': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Rolls-Royce Holdings' },

  // ============================================================
  // 📊 AÇÕES EU
  // ============================================================
  'AIR': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Airbus SE' },
  'SAN': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Banco Santander' },
  'BMW': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'BMW' },
  'BNP': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'BNP Paribas' },
  'DANO': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Danone' },
  'DTE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Deutsche Telekom' },
  'ENGI': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ENGIE' },
  'MC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'LVMH' },
  'OR': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: "L'Oréal" },
  'SAP': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'SAP SE' },
  'SIE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Siemens' },
  'VOW': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Volkswagen' },

  // ============================================================
  // 📊 AÇÕES US
  // ============================================================
  'AAPL': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Apple Inc.' },
  'MSFT': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Microsoft Corporation' },
  'GOOGL': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Alphabet Inc.' },
  'AMZN': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Amazon.com Inc.' },
  'TSLA': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Tesla Inc.' },
  'NVDA': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'NVIDIA Corporation' },
  'META': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Meta Platforms Inc.' },
  'NFLX': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Netflix Inc.' },
  'AMD': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Advanced Micro Devices' },
  'INTC': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Intel Corporation' },
  'BA': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Boeing Company' },
  'DIS': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Walt Disney Company' },
  'JPM': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'JPMorgan Chase & Co.' },
  'BAC': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Bank of America' },
  'WMT': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Walmart Inc.' },
  'V': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Visa Inc.' },
  'MA': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Mastercard Inc.' },
  'PG': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Procter & Gamble' },
  'JNJ': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Johnson & Johnson' },
  'XOM': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Exxon Mobil' },
  'CVX': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Chevron Corporation' },
  'PFE': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Pfizer Inc.' },
  'KO': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'Coca-Cola Company' },
  'PEP': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'PepsiCo Inc.' },
  'MCD': { ...STOCK_STANDARD, category: 'STOCKS_US', description: 'McDonald\'s Corporation' },

  // ============================================================
  // 📜 BONDS
  // ============================================================
  'US10YR': { ...BOND_US, category: 'BONDS', description: 'US 10-Year Treasury Note' },
  'US30YR': { ...BOND_US, category: 'BONDS', description: 'US 30-Year Treasury Bond' },
  'US5YR': { ...BOND_US, category: 'BONDS', description: 'US 5-Year Treasury Note' },
  'US2YR': { ...BOND_US, category: 'BONDS', description: 'US 2-Year Treasury Note' },
  'BUND': { tickSize: 0.01, tickValue: 10, pointValue: 1000, contractSize: 1000, currency: 'EUR', minLotSize: 1, category: 'BONDS', description: 'German 10-Year Bund' },
  'GILT': { tickSize: 0.01, tickValue: 10, pointValue: 1000, contractSize: 1000, currency: 'GBP', minLotSize: 1, category: 'BONDS', description: 'UK 10-Year Gilt' },

  // ============================================================
  // 📅 FUTUROS
  // ============================================================
  'ES': { ...INDICES_US, category: 'FUTURES', description: 'E-mini S&P 500 Futures' },
  'NQ': { tickSize: 0.25, tickValue: 5, pointValue: 20, contractSize: 1, currency: 'USD', minLotSize: 1, category: 'FUTURES', description: 'E-mini NASDAQ 100 Futures' },
  'YM': { tickSize: 1, tickValue: 5, pointValue: 5, contractSize: 1, currency: 'USD', minLotSize: 1, category: 'FUTURES', description: 'E-mini Dow Futures' },
  'RTY': { tickSize: 0.1, tickValue: 5, pointValue: 50, contractSize: 1, currency: 'USD', minLotSize: 1, category: 'FUTURES', description: 'E-mini Russell 2000 Futures' },
  'CL': { ...ENERGY_OIL, category: 'FUTURES', description: 'Crude Oil Futures' },
  'GC': { ...METAL_GOLD, category: 'FUTURES', description: 'Gold Futures' },
  'SI': { ...METAL_SILVER, category: 'FUTURES', description: 'Silver Futures' },
  'ZB': { ...BOND_US, category: 'FUTURES', description: '30-Year T-Bond Futures' },
  'ZN': { ...BOND_US, category: 'FUTURES', description: '10-Year T-Note Futures' },
};

/**
 * ✅ MERGE COM CONTRACT_SPECS PRINCIPAL
 * Esta função deve ser chamada no boot para mesclar as especificações
 */
export function getInfinoxContractSpec(symbol: string): ContractSpec | null {
  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const spec = INFINOX_CONTRACT_SPECS[normalizedSymbol];
  
  if (!spec) {
    return null;
  }

  return {
    symbol: normalizedSymbol,
    ...spec,
  } as ContractSpec;
}

/**
 * 📊 ESTATÍSTICAS
 */
export function getInfinoxContractStats() {
  const total = Object.keys(INFINOX_CONTRACT_SPECS).length;
  const byCategory: Record<string, number> = {};
  
  Object.values(INFINOX_CONTRACT_SPECS).forEach(spec => {
    if (spec.category) {
      byCategory[spec.category] = (byCategory[spec.category] || 0) + 1;
    }
  });

  return {
    total,
    byCategory,
    symbols: Object.keys(INFINOX_CONTRACT_SPECS).sort(),
  };
}
