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

  // ⚠️ 2026-08-03: os símbolos abaixo existem em assetDatabase.ts (catálogo de
  // preço/exibição) há várias sessões mas NUNCA tiveram entrada aqui —
  // getContractSpec() caía no fallback genérico (tickSize 0.00001, formato
  // forex de 5 casas), gerando P&L absurdo pra qualquer ativo cripto na faixa
  // de preço de dezenas/milhares de dólares (bug real encontrado com BTCEUR:
  // P&L de +$1.570 pra um movimento de -0,06% numa posição de $542 de
  // exposição). Bucket escolhido por ORDEM DE GRANDEZA de preço típico
  // (mesmo critério já usado nas linhas acima pra CRYPTO_STANDARD vs
  // CRYPTO_CHEAP) — não é tick real calibrado por símbolo, é aproximação de
  // categoria pra sair do fallback forex quebrado. Marcar como pendência se
  // precisar de precisão de tick real por ativo.
  'BTCEUR': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Bitcoin vs Euro' },
  'BTCBNB': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Bitcoin vs Binance Coin' },
  'BTCETH': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Bitcoin vs Ethereum' },
  'BTCLTC': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Bitcoin vs Litecoin' },
  'XETUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum (contrato XET) vs USD' },
  'XETUSDCRP': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum (contrato XET, liquidação cripto) vs USD' },
  'XBNUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Binance Coin (contrato XBN) vs USD' },
  'XBNUSDCRP': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Binance Coin (contrato XBN, liquidação cripto) vs USD' },
  'XLCUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Litecoin (contrato XLC) vs USD' },
  'XLCUSDCRP': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Litecoin (contrato XLC, liquidação cripto) vs USD' },
  'XETEUR': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum (contrato XET) vs Euro' },
  'XETXBN': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum (contrato XET) vs Binance Coin (XBN)' },
  'XETXLC': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum (contrato XET) vs Litecoin (XLC)' },
  'FILUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Filecoin vs USD' },
  'ETCUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Ethereum Classic vs USD' },
  'NEARUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'NEAR Protocol vs USD' },
  'ZECUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'Zcash vs USD' },
  'NEOUSD': { ...CRYPTO_STANDARD, category: 'CRYPTO', description: 'NEO vs USD' },
  'GRTUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'The Graph vs USD' },
  'TRXUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Tron vs USD' },
  'SANDUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'The Sandbox vs USD' },
  'ALGOUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Algorand vs USD' },
  'XTZUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Tezos vs USD' },
  'CRVUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Curve DAO vs USD' },
  'SUSHIUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'SushiSwap vs USD' },
  'IOTAUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'IOTA vs USD' },
  'ONEUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Harmony vs USD' },
  'INCUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'INC vs USD' },
  'BATUSD': { ...CRYPTO_CHEAP, category: 'CRYPTO', description: 'Basic Attention Token vs USD' },
  'SHIBUSD': { tickSize: 0.00001, tickValue: 0.00001, pointValue: 1, contractSize: 1, currency: 'USD', minLotSize: 10, category: 'CRYPTO', description: 'Shiba Inu vs USD' },

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

  // ═══════════════════════════════════════════════════════════
  // ⚠️ BLOCO GERADO EM LOTE (2026-08-03) — 336 símbolos que caíam
  // no fallback genérico forex OU num fuzzy match perigoso (ex. ações
  // batendo em specs de forex/cripto por coincidência de substring —
  // 'GE' -> 'GER40', 'F' -> 'USDCHF', 'LIN' -> 'LINKUSD', etc., achado real
  // via scripts/audit-contract-specs.mjs). Onde a spec real já existia sob
  // outro nome (comentado "alias real"), copiada 1:1 — zero número novo.
  // Onde não existia, aplicado o padrão de CATEGORIA já usado neste arquivo
  // pros ativos vizinhos (comentado "aprox. categoria") — não é tick real
  // calibrado por símbolo, é melhor que o fallback forex quebrado que
  // aplicava 5 casas decimais a preço de ação/índice/commodity.
  // ═══════════════════════════════════════════════════════════
  'USDCHFEXC': { ...FOREX_MAJOR, category: 'FOREX', description: 'US Dollar vs Swiss Franc (horário estendido)' }, // corrigido pra FOREX_MAJOR (variante de horário estendido de par MAJOR, não exótico)
  'USDNGN': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Nigerian Naira' }, // aprox. categoria (par exótico)
  'USDHUF': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Hungarian Forint' }, // aprox. categoria (par exótico)
  'USDMYR': { ...FOREX_EXOTIC, category: 'FOREX', description: 'US Dollar vs Malaysian Ringgit' }, // aprox. categoria (par exótico)
  // ⚠️ SEM REGRA: 'DOGEUSD' (CRYPTO/Meme Coins) — revisar manualmente
  // ⚠️ SEM REGRA: 'BTCUSDCRP' (CRYPTO/Bitcoin) — revisar manualmente
  'SPX500': { ...INDICES_US, category: 'INDICES', description: 'S&P 500' }, // aprox. categoria (INDICES_US genérico)
  'USDX': { ...INDICES_US, category: 'INDICES', description: 'US Dollar Index' }, // aprox. categoria (INDICES_US genérico)
  'ESP35': { ...INDICES_US, currency: 'EUR', category: 'INDICES', description: 'IBEX 35' }, // aprox. categoria (INDICES_US genérico, moeda corrigida)
  'NETH25': { ...INDICES_US, currency: 'EUR', category: 'INDICES', description: 'AEX 25' }, // aprox. categoria (INDICES_US genérico, moeda corrigida)
  'SUI20': { ...INDICES_US, currency: 'CHF', category: 'INDICES', description: 'SMI 20' }, // aprox. categoria (INDICES_US genérico, moeda corrigida)
  'EUSTX50': { ...INDICES_US, currency: 'EUR', category: 'INDICES', description: 'Euro Stoxx 50' }, // aprox. categoria (INDICES_US genérico, moeda corrigida)
  'JP225': { tickSize: 1, tickValue: 5, pointValue: 5, contractSize: 1, currency: 'JPY', minLotSize: 0.1, category: 'INDICES', description: 'Nikkei 225 (Japan)' }, // = mesmos valores de 'JPN225' (nome diferente pro mesmo instrumento)
  'CHINA50': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 1, currency: 'CNY', minLotSize: 0.1, category: 'INDICES', description: 'FTSE China A50' }, // = mesmos valores de 'CN50' (nome diferente pro mesmo instrumento)
  'BVSPX': { ...INDICES_US, category: 'INDICES', description: 'Ibovespa' }, // aprox. categoria (INDICES_US genérico)
  'XAUUSDCRP': { ...METAL_GOLD, category: 'METALS', description: 'Gold (liquidação cripto)' }, // aprox. categoria (variante de ouro)
  'GAUUSD': { ...METAL_GOLD, category: 'METALS', description: 'Gold (contrato alternativo)' }, // aprox. categoria (variante de ouro)
  'XAUJPY': { ...METAL_GOLD, category: 'METALS', description: 'Gold vs Japanese Yen' }, // aprox. categoria (variante de ouro)
  'XAUCHF': { ...METAL_GOLD, category: 'METALS', description: 'Gold vs Swiss Franc' }, // aprox. categoria (variante de ouro)
  'GOLDFT': { ...METAL_GOLD, category: 'METALS', description: 'Gold Futures' }, // aprox. categoria (variante de ouro)
  'SILVERFT': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Silver Futures' }, // aprox. categoria (genérico, sem match melhor)
  'CLOIL': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Crude Oil WTI Futures' }, // aprox. categoria (genérico, sem match melhor)
  'UKOUSDFT': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Brent Oil Futures' }, // aprox. categoria (genérico, sem match melhor)
  'XNGUSD': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Natural Gas' }, // aprox. categoria (genérico, sem match melhor)
  'WHEUSD': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Wheat' }, // = mesmos valores de 'WHEATUSD' (nome diferente pro mesmo instrumento)
  'SOYUSD': { ...COMMODITY_STANDARD, category: 'COMMODITIES', description: 'Soybeans' }, // = mesmos valores de 'SOYBEANUSD' (nome diferente pro mesmo instrumento)
  'COTUSD': { tickSize: 0.01, tickValue: 5, pointValue: 500, contractSize: 50000, currency: 'USD', minLotSize: 0.1, category: 'COMMODITIES', description: 'Cotton' }, // = mesmos valores de 'COTTONUSD' (nome diferente pro mesmo instrumento)
  'COFUSD': { tickSize: 0.05, tickValue: 18.75, pointValue: 375, contractSize: 37500, currency: 'USD', minLotSize: 0.1, category: 'COMMODITIES', description: 'Coffee' }, // = mesmos valores de 'COFFEEUSD' (nome diferente pro mesmo instrumento)
  'SUGUSD': { tickSize: 0.01, tickValue: 11.20, pointValue: 1120, contractSize: 112000, currency: 'USD', minLotSize: 0.1, category: 'COMMODITIES', description: 'Sugar' }, // = mesmos valores de 'SUGARUSD' (nome diferente pro mesmo instrumento)
  'COCUSD': { tickSize: 1, tickValue: 10, pointValue: 10, contractSize: 10, currency: 'USD', minLotSize: 1, category: 'COMMODITIES', description: 'Cocoa' }, // = mesmos valores de 'COCOAUSD' (nome diferente pro mesmo instrumento)
  'AALL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Anglo American PLC' }, // aprox. categoria
  'AHTL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Ashtead Group PLC' }, // aprox. categoria
  'ANTOL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Antofagasta PLC' }, // aprox. categoria
  'AVL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Aviva PLC' }, // aprox. categoria
  'AZNL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'AstraZeneca PLC' }, // aprox. categoria
  'BAL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'BAE Systems PLC' }, // aprox. categoria
  'BARCL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Barclays PLC' }, // aprox. categoria
  'BATSL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'British American Tobacco PLC' }, // aprox. categoria
  'BDEVL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Barratt Developments PLC' }, // aprox. categoria
  'BKGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Berkeley Group Holdings PLC' }, // aprox. categoria
  'BNZLL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Bunzl PLC' }, // aprox. categoria
  'BPL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'BP PLC' }, // aprox. categoria
  'BRBYL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Burberry Group PLC' }, // aprox. categoria
  'BTAL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'BT Group PLC' }, // aprox. categoria
  'CCHL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Coca-Cola HBC AG' }, // aprox. categoria
  'CNAL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Centrica PLC' }, // aprox. categoria
  'CPGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Compass Group PLC' }, // aprox. categoria
  'CRDAL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Croda International PLC' }, // aprox. categoria
  'DCCL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'DCC PLC' }, // aprox. categoria
  'DGEL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Diageo PLC' }, // aprox. categoria
  'EXPNL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Experian PLC' }, // aprox. categoria
  'FLTRL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Flutter Entertainment PLC' }, // aprox. categoria
  'FRESL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Fresnillo PLC' }, // aprox. categoria
  'GLENL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Glencore PLC' }, // aprox. categoria
  'GSKL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'GSK PLC' }, // aprox. categoria
  'HIKL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Hikma Pharmaceuticals PLC' }, // aprox. categoria
  'HLMAL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Halma PLC' }, // aprox. categoria
  'HSBAL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'HSBC Holdings PLC' }, // aprox. categoria
  'IAGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'International Consolidated Airlines Group SA' }, // aprox. categoria
  'ICPL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Intermediate Capital Group PLC' }, // aprox. categoria
  'IHGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'InterContinental Hotels Group PLC' }, // aprox. categoria
  'IMBL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Imperial Brands PLC' }, // aprox. categoria
  'INFL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Informa PLC' }, // aprox. categoria
  'ITRKL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Intertek Group PLC' }, // aprox. categoria
  'JDL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'JD Sports Fashion PLC' }, // aprox. categoria
  'LANDL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Land Securities Group PLC' }, // aprox. categoria
  'LGENL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Legal & General Group PLC' }, // aprox. categoria
  'LLOYL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Lloyds Banking Group PLC' }, // aprox. categoria
  'LSEGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'London Stock Exchange Group PLC' }, // aprox. categoria
  'MNGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'M&G PLC' }, // aprox. categoria
  'MROL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Melrose Industries PLC' }, // aprox. categoria
  'NGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'National Grid PLC' }, // aprox. categoria
  'NWGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'NatWest Group PLC' }, // aprox. categoria
  'OCDOL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Ocado Group PLC' }, // aprox. categoria
  'PSONL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Pearson PLC' }, // aprox. categoria
  'PSNL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Persimmon PLC' }, // aprox. categoria
  'PURGL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Purplebricks Group PLC' }, // aprox. categoria
  'RIOL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Rio Tinto PLC' }, // aprox. categoria
  'RKTL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Reckitt Benckiser Group PLC' }, // aprox. categoria
  'RRL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Rolls-Royce Holdings PLC' }, // aprox. categoria
  'RS1L': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'RS Group PLC' }, // aprox. categoria
  'SBRYL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'J Sainsbury PLC' }, // aprox. categoria
  'SDRL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Schroders PLC' }, // aprox. categoria
  'SGEL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Sage Group PLC' }, // aprox. categoria
  'SGROL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Segro PLC' }, // aprox. categoria
  'SHELL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Shell PLC' }, // aprox. categoria
  'SMDSL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'DS Smith PLC' }, // aprox. categoria
  'SMINL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Smiths Group PLC' }, // aprox. categoria
  'SMTL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Scottish Mortgage Investment Trust PLC' }, // aprox. categoria
  'SNL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Smith & Nephew PLC' }, // aprox. categoria
  'SPXL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Spirax-Sarco Engineering PLC' }, // aprox. categoria
  'SSEL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'SSE PLC' }, // aprox. categoria
  'STANL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Standard Chartered PLC' }, // aprox. categoria
  'STJL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'St. James Place PLC' }, // aprox. categoria
  'SVTL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Severn Trent PLC' }, // aprox. categoria
  'TSCOL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Tesco PLC' }, // aprox. categoria
  'TWL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Taylor Wimpey PLC' }, // aprox. categoria
  'ULVRL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Unilever PLC' }, // aprox. categoria
  'UUL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'United Utilities Group PLC' }, // aprox. categoria
  'VODL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Vodafone Group PLC' }, // aprox. categoria
  'WTBL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Whitbread PLC' }, // aprox. categoria
  'ABFL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Associated British Foods PLC' }, // aprox. categoria
  'PRUL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Prudential PLC' }, // aprox. categoria
  'RELXL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'RELX PLC' }, // aprox. categoria
  'ABDNL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'abrdn PLC' }, // aprox. categoria
  'AUTOL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Auto Trader Group PLC' }, // aprox. categoria
  'BLNDL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'British Land Company PLC' }, // aprox. categoria
  'CRHL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'CRH PLC' }, // aprox. categoria
  'ENTL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Entain PLC' }, // aprox. categoria
  'EZJL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'easyJet PLC' }, // aprox. categoria
  'FRASL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Frasers Group PLC' }, // aprox. categoria
  'HSXL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Hiscox Ltd' }, // aprox. categoria
  'IIIL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: '3i Group PLC' }, // aprox. categoria
  'ITVL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'ITV PLC' }, // aprox. categoria
  'JMATL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Johnson Matthey PLC' }, // aprox. categoria
  'KGFL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Kingfisher PLC' }, // aprox. categoria
  'MNDIL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Mondi PLC' }, // aprox. categoria
  'NGRIDL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'National Grid PLC' }, // aprox. categoria
  'NXTL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Next PLC' }, // aprox. categoria
  'PSHL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Pershing Square Holdings Ltd' }, // aprox. categoria
  'RMVL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Rightmove PLC' }, // aprox. categoria
  'RTOL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'Rentokil Initial PLC' }, // aprox. categoria
  'WPPL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'WPP PLC' }, // aprox. categoria
  'TRSTL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'TRST' }, // aprox. categoria
  'SWRL': { ...STOCK_STANDARD, currency: 'GBP', category: 'STOCKS_UK', description: 'SWR' }, // aprox. categoria
  'ACPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Accor SA' }, // aprox. categoria
  'AIPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Air Liquide SA' }, // aprox. categoria
  'AIRPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Airbus SE' }, // aprox. categoria
  'ALOPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Alstom SA' }, // aprox. categoria
  'ATOPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Atos SE' }, // aprox. categoria
  'BNPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Danone SA' }, // aprox. categoria
  'BNPPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'BNP Paribas SA' }, // aprox. categoria
  'CAPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Carrefour SA' }, // aprox. categoria
  'CAPPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Capgemini SE' }, // aprox. categoria
  'CSPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'AXA SA' }, // aprox. categoria
  'DGPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Vinci SA' }, // aprox. categoria
  'DSYPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Dassault Systemes SE' }, // aprox. categoria
  'ENGIPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Engie SA' }, // aprox. categoria
  'FPPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'TotalEnergies SE' }, // aprox. categoria
  'GLEPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Societe Generale SA' }, // aprox. categoria
  'KERPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Kering SA' }, // aprox. categoria
  'MCPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'LVMH Moet Hennessy Louis Vuitton SE' }, // aprox. categoria
  'MLPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Michelin' }, // aprox. categoria
  'ORAPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Orange SA' }, // aprox. categoria
  'RIPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Pernod Ricard SA' }, // aprox. categoria
  'RMSPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Hermes International SA' }, // aprox. categoria
  'SANPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Sanofi SA' }, // aprox. categoria
  'SAFPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Safran SA' }, // aprox. categoria
  'SGOPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Compagnie de Saint-Gobain SA' }, // aprox. categoria
  'SUPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Schneider Electric SE' }, // aprox. categoria
  'TEPPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Teleperformance SE' }, // aprox. categoria
  'URWPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Unibail-Rodamco-Westfield SE' }, // aprox. categoria
  'VIEPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Veolia Environnement SA' }, // aprox. categoria
  'VIVPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Vivendi SE' }, // aprox. categoria
  'ACAPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Credit Agricole SA' }, // aprox. categoria
  'LRPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Legrand SA' }, // aprox. categoria
  'RNOPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Renault SA' }, // aprox. categoria
  'STMPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'STMicroelectronics NV' }, // aprox. categoria
  'PUBPPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'PUBP' }, // aprox. categoria
  'TCFPPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'TCFP' }, // aprox. categoria
  'AMUNPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Amundi SA' }, // aprox. categoria
  'CDIPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Christian Dior SE' }, // aprox. categoria
  'SWPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Sodexo SA' }, // aprox. categoria
  'ADPRPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ADPR' }, // aprox. categoria
  'DIMPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'DIM' }, // aprox. categoria
  'WLNPA': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Worldline SA' }, // aprox. categoria
  '1COVDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Covestro AG' }, // aprox. categoria
  'ADSDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Adidas AG' }, // aprox. categoria
  'ALVDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Allianz SE' }, // aprox. categoria
  'BASDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'BASF SE' }, // aprox. categoria
  'BAYNDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Bayer AG' }, // aprox. categoria
  'BEIDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Beiersdorf AG' }, // aprox. categoria
  'BMWDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Bayerische Motoren Werke AG' }, // aprox. categoria
  'CBKDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Commerzbank AG' }, // aprox. categoria
  'CONDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Continental AG' }, // aprox. categoria
  'DAIDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Daimler AG' }, // aprox. categoria
  'DB1DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Deutsche Boerse AG' }, // aprox. categoria
  'DBKDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Deutsche Bank AG' }, // aprox. categoria
  'DPWDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Deutsche Post AG' }, // aprox. categoria
  'DTEDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Deutsche Telekom AG' }, // aprox. categoria
  'EOANDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'E.ON SE' }, // aprox. categoria
  'FREDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Fresenius SE & Co KGaA' }, // aprox. categoria
  'FMEDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Fresenius Medical Care AG' }, // aprox. categoria
  'HEN3DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Henkel AG & Co KGaA' }, // aprox. categoria
  'IFXDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Infineon Technologies AG' }, // aprox. categoria
  'LHADE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Deutsche Lufthansa AG' }, // aprox. categoria
  'LINDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Linde PLC' }, // aprox. categoria
  'MRKDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Merck KGaA' }, // aprox. categoria
  'MUV2DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Muenchener Rueckversicherungs-Gesellschaft AG' }, // aprox. categoria
  'RWEDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'RWE AG' }, // aprox. categoria
  'SAPDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'SAP SE' }, // aprox. categoria
  'SIEDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Siemens AG' }, // aprox. categoria
  'VOW3DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Volkswagen AG (ações preferenciais)' }, // aprox. categoria
  'AFXDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Carl Zeiss Meditec AG' }, // aprox. categoria
  'BNRDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Brenntag SE' }, // aprox. categoria
  'MBGDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Mercedes-Benz Group AG' }, // aprox. categoria
  'DHERDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Delivery Hero SE' }, // aprox. categoria
  'DWNIDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Deutsche Wohnen SE' }, // aprox. categoria
  'DWSDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'DWS Group GmbH & Co KGaA' }, // aprox. categoria
  'FIEDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'FIE' }, // aprox. categoria
  'FRADE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Fraport AG' }, // aprox. categoria
  'G24DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Scout24 SE' }, // aprox. categoria
  'HEIDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Heidelberg Materials AG' }, // aprox. categoria
  'HLAGDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Hapag-Lloyd AG' }, // aprox. categoria
  'HNR1DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Hannover Rueck SE' }, // aprox. categoria
  'HOTDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'HOT' }, // aprox. categoria
  'KBXDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Knorr-Bremse AG' }, // aprox. categoria
  'KGXDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'KION Group AG' }, // aprox. categoria
  'KRNDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Krones AG' }, // aprox. categoria
  'LEGDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'LEG Immobilien SE' }, // aprox. categoria
  'MRCKDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Merck & Co Inc' }, // aprox. categoria
  'MTXDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'MTU Aero Engines AG' }, // aprox. categoria
  'NEMDDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'NEMD' }, // aprox. categoria
  'PUMDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Puma SE' }, // aprox. categoria
  'RAADE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'RAA' }, // aprox. categoria
  'RRTLDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'RTL Group SA' }, // aprox. categoria
  'SHLDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Siemens Healthineers AG' }, // aprox. categoria
  'SRT3DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Sartorius AG (ações preferenciais)' }, // aprox. categoria
  'SY1DE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Symrise AG' }, // aprox. categoria
  'TLXDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Talanx AG' }, // aprox. categoria
  'UTDIDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'United Internet AG' }, // aprox. categoria
  'VNADE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Vonovia SE' }, // aprox. categoria
  'VOWDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Volkswagen AG (ações ordinárias)' }, // aprox. categoria
  'ZALDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Zalando SE' }, // aprox. categoria
  'DHLDE': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'DHL Group AG' }, // aprox. categoria
  'BBVAMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Banco Bilbao Vizcaya Argentaria SA' }, // aprox. categoria
  'CABKMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'CaixaBank SA' }, // aprox. categoria
  'ELEMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Endesa SA' }, // aprox. categoria
  'IBEMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Iberdrola SA' }, // aprox. categoria
  'ITXMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Industria de Diseno Textil SA (Inditex)' }, // aprox. categoria
  'MAPMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Mapfre SA' }, // aprox. categoria
  'REPMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Repsol SA' }, // aprox. categoria
  'SABMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Banco de Sabadell SA' }, // aprox. categoria
  'SANTANDERMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Banco Santander SA' }, // aprox. categoria
  'TEFMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Telefonica SA' }, // aprox. categoria
  'AENAMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Aena SME SA' }, // aprox. categoria
  'AMSMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Amadeus IT Group SA' }, // aprox. categoria
  'ANAMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Acciona SA' }, // aprox. categoria
  'CLNXMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Cellnex Telecom SA' }, // aprox. categoria
  'VISMC': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Viscofan SA' }, // aprox. categoria
  'GALPLS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Galp Energia SGPS SA' }, // aprox. categoria
  'SONLS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Sonae SGPS SA' }, // aprox. categoria
  'ABNAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ABN AMRO Bank NV' }, // aprox. categoria
  'AGNAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Aegon NV' }, // aprox. categoria
  'ASMLAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ASML Holding NV' }, // aprox. categoria
  'HEIAAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Heineken NV' }, // aprox. categoria
  'INGAAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ING Groep NV' }, // aprox. categoria
  'MTAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ArcelorMittal SA' }, // aprox. categoria
  'PHIAAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Koninklijke Philips NV' }, // aprox. categoria
  'UNAAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Unilever NV' }, // aprox. categoria
  'AALBAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Aalberts NV' }, // aprox. categoria
  'ADYENAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Adyen NV' }, // aprox. categoria
  'AKZAAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Akzo Nobel NV' }, // aprox. categoria
  'ASMAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ASM International NV' }, // aprox. categoria
  'ASRNLAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'ASR Nederland NV' }, // aprox. categoria
  'IMCDAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'IMCD NV' }, // aprox. categoria
  'NNAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'NN Group NV' }, // aprox. categoria
  'PRXAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Prosus NV' }, // aprox. categoria
  'RANDAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Randstad NV' }, // aprox. categoria
  'VPKAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Koninklijke Vopak NV' }, // aprox. categoria
  'WKLAS': { ...STOCK_STANDARD, currency: 'EUR', category: 'STOCKS_EU', description: 'Wolters Kluwer NV' }, // aprox. categoria
  'ABBV': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'AbbVie' }, // aprox. categoria
  'ABNB': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Airbnb' }, // aprox. categoria
  'ACN': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Accenture' }, // aprox. categoria
  'ADBE': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Adobe' }, // aprox. categoria
  'ADI': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Analog Devices' }, // aprox. categoria
  'ADP': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Automatic Data Processing' }, // aprox. categoria
  'AMGN': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Amgen' }, // aprox. categoria
  'AMT': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'American Tower' }, // aprox. categoria
  'ASML': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'ASML' }, // aprox. categoria
  'AVGO': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Broadcom' }, // aprox. categoria
  'AXP': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'American Express' }, // aprox. categoria
  'BABA': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Alibaba' }, // aprox. categoria
  'BLK': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'BlackRock' }, // aprox. categoria
  'BMY': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Bristol-Myers Squibb' }, // aprox. categoria
  'BRKB': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Berkshire Hathaway B' }, // aprox. categoria
  'C': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Citigroup' }, // aprox. categoria
  'CAT': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Caterpillar' }, // aprox. categoria
  'CHTR': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Charter Communications' }, // aprox. categoria
  'CMCSA': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Comcast' }, // aprox. categoria
  'COST': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Costco' }, // aprox. categoria
  'CRM': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Salesforce' }, // aprox. categoria
  'CSCO': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Cisco' }, // aprox. categoria
  'CVS': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'CVS Health' }, // aprox. categoria
  'DHR': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Danaher' }, // aprox. categoria
  'EBAY': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'eBay' }, // aprox. categoria
  'F': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Ford' }, // aprox. categoria
  'FB': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Meta (Facebook)' }, // aprox. categoria
  'FDX': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'FedEx' }, // aprox. categoria
  'GE': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'General Electric' }, // aprox. categoria
  'GILD': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Gilead Sciences' }, // aprox. categoria
  'GM': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'General Motors' }, // aprox. categoria
  'GOOG': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Alphabet (Google) C' }, // aprox. categoria
  'GS': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Goldman Sachs' }, // aprox. categoria
  'HD': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Home Depot' }, // aprox. categoria
  'HON': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Honeywell' }, // aprox. categoria
  'IBM': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'IBM' }, // aprox. categoria
  'INTU': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Intuit' }, // aprox. categoria
  'LIN': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Linde' }, // aprox. categoria
  'LLY': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Eli Lilly' }, // aprox. categoria
  'LMT': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Lockheed Martin' }, // aprox. categoria
  'MDLZ': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Mondelez' }, // aprox. categoria
  'MDT': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Medtronic' }, // aprox. categoria
  'MO': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Altria' }, // aprox. categoria
  'MRK': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Merck' }, // aprox. categoria
  'MS': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Morgan Stanley' }, // aprox. categoria
  'NKE': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Nike' }, // aprox. categoria
  'ORCL': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Oracle' }, // aprox. categoria
  'PM': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Philip Morris' }, // aprox. categoria
  'PYPL': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'PayPal' }, // aprox. categoria
  'QCOM': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Qualcomm' }, // aprox. categoria
  'RTX': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Raytheon Technologies' }, // aprox. categoria
  'SBUX': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Starbucks' }, // aprox. categoria
  'SHOP': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Shopify' }, // aprox. categoria
  'SLB': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Schlumberger' }, // aprox. categoria
  'SO': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Southern Company' }, // aprox. categoria
  'SPG': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Simon Property Group' }, // aprox. categoria
  'SQ': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Block (Square)' }, // aprox. categoria
  'T': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'AT&T' }, // aprox. categoria
  'TGT': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Target' }, // aprox. categoria
  'TMO': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Thermo Fisher Scientific' }, // aprox. categoria
  'TMUS': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'T-Mobile' }, // aprox. categoria
  'TXN': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Texas Instruments' }, // aprox. categoria
  'UNH': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'UnitedHealth' }, // aprox. categoria
  'UNP': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Union Pacific' }, // aprox. categoria
  'UPS': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'UPS' }, // aprox. categoria
  'USB': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'U.S. Bancorp' }, // aprox. categoria
  'VZ': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Verizon' }, // aprox. categoria
  'WFC': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Wells Fargo' }, // aprox. categoria
  'ZM': { ...STOCK_STANDARD, currency: 'USD', category: 'STOCKS_US', description: 'Zoom' }, // aprox. categoria
  'BUND10Y': { ...BOND_US, currency: 'EUR', category: 'BONDS', description: 'German 10-Year Bund' }, // aprox. categoria (BOND_US genérico, moeda corrigida)
  'UK10Y': { ...BOND_US, currency: 'GBP', category: 'BONDS', description: 'UK 10-Year Gilt' }, // aprox. categoria (BOND_US genérico, moeda corrigida)
  'FR10Y': { ...BOND_US, currency: 'EUR', category: 'BONDS', description: 'French 10-Year OAT' }, // aprox. categoria (BOND_US genérico, moeda corrigida)
  'US10Y': { ...BOND_US, category: 'BONDS', description: 'US 10-Year Treasury Note' }, // aprox. categoria (BOND_US genérico)
  'US30Y': { ...BOND_US, category: 'BONDS', description: 'US 30-Year Treasury Bond' }, // aprox. categoria (BOND_US genérico)
  'US2Y': { ...BOND_US, category: 'BONDS', description: 'US 2-Year Treasury Note' }, // aprox. categoria (BOND_US genérico)
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
