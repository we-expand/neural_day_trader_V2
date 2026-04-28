/**
 * 🏦 INFINOX BROKER - ESPECIFICAÇÕES COMPLETAS DE ATIVOS
 * 
 * Define todos os ativos disponíveis na corretora Infinox
 * Nomenclaturas exatas conforme plataforma MT5 da Infinox
 * 
 * Total: 300+ ativos organizados por categoria
 */

import { ContractSpec } from './contractSpecs';

/**
 * 📋 LISTA COMPLETA DE ATIVOS INFINOX POR CATEGORIA
 */
export const INFINOX_ASSETS = {
  
  // ============================================================
  // 💱 FOREX - PARES PRINCIPAIS E CROSSES
  // ============================================================
  FOREX: {
    // Majors
    'GBPUSD': true,
    'EURUSD': true,
    'USDJPY': true,
    'USDCHF': true,
    'AUDUSD': true,
    'USDCAD': true,
    'NZDUSD': true,
    
    // Crosses EUR
    'EURAUD': true,
    'EURCAD': true,
    'EURCHF': true,
    'EURGBP': true,
    'EURJPY': true,
    'EURNOK': true,
    'EURNZD': true,
    'EURSEK': true,
    'EURSGD': true,
    'EURZAR': true,
    'EURMXN': true,
    'EURHKD': true,
    'EURHUF': true,
    'EURTRY': true,
    
    // Crosses GBP
    'GBPAUD': true,
    'GBPCAD': true,
    'GBPCHF': true,
    'GBPJPY': true,
    'GBPNZD': true,
    'GBPSEK': true,
    
    // Crosses AUD
    'AUDCAD': true,
    'AUDCHF': true,
    'AUDJPY': true,
    'AUDNZD': true,
    
    // Crosses NZD
    'NZDCAD': true,
    'NZDCHF': true,
    'NZDJPY': true,
    'NZDSGD': true,
    
    // Crosses CAD
    'CADCHF': true,
    'CADJPY': true,
    
    // Crosses CHF
    'CHFJPY': true,
    
    // USD Exotics
    'USDCNH': true,
    'USDDKK': true,
    'USDHKD': true,
    'USDINR': true,
    'USDMXN': true,
    'USDNOK': true,
    'USDPLN': true,
    'USDRUB': true,
    'USDSEK': true,
    'USDSGD': true,
    'USDTHB': true,
    'USDTRY': true,
    'USDCLP': true,
    'USDCOP': true,
    'USDCZK': true,
    'USDIDR': true,
    'USDKRW': true,
    'USDPHP': true,
    'USDTWD': true,
    'USDVND': true,
    'USDBRL': true,
    'USDZAR': true,
  },
  
  // ============================================================
  // 🥇 METAIS PRECIOSOS
  // ============================================================
  METALS: {
    'XAUUSD': true,    // Ouro vs USD
    'XAGUSD': true,    // Prata vs USD
    'XAUEUR': true,    // Ouro vs EUR
    'XPTUSD': true,    // Platina vs USD
    'XPDUSD': true,    // Paládio vs USD
    'GOLDft': true,    // Ouro Futuro
    'SILVERft': true,  // Prata Futuro
  },
  
  // ============================================================
  // 🛢️ ENERGIA & COMMODITIES
  // ============================================================
  ENERGY: {
    'CL-OIL': true,     // Petróleo WTI
    'UKOUSD': true,     // Petróleo Brent
    'UKOUSDft': true,   // Petróleo Brent Futuro
    'USOUSD': true,     // Petróleo WTI Spot
    'NGAS': true,       // Gás Natural
  },
  
  COMMODITIES: {
    'Coffee': true,     // Café
    'Cocoa': true,      // Cacau
    'Wheat': true,      // Trigo
    'XPTUSD': true,     // Platina
    'NG': true,         // Gás Natural
  },
  
  // ============================================================
  // ₿ CRIPTOMOEDAS
  // ============================================================
  CRYPTO: {
    'BTCUSD': true,     // Bitcoin
    'BCHUSD': true,     // Bitcoin Cash
    'ETHUSD': true,     // Ethereum
    'LTCUSD': true,     // Litecoin
    'XRPUSD': true,     // Ripple
    'XLCUSD': true,     // Stellar Lumens
    'XBNUSD': true,     // Binance Coin
    'XBRUSD': true,     // Bitcoin BRL
    'DOGUSD': true,     // Dogecoin
    'XETUSD': true,     // Ethereum Classic
    'XFCUSD': true,     // Filecoin
    'BTCEUR': true,     // Bitcoin EUR
    'BTCGBP': true,     // Bitcoin GBP
    'ETHEUR': true,     // Ethereum EUR
    'XRPEUR': true,     // Ripple EUR
    'BTCXBT': true,     // Bitcoin XBT
    'BTCXET': true,     // Bitcoin Ethereum
    'ATSUSD': true,     // Cosmos
    'XLMUSD': true,     // Stellar
    'FTMUSD': true,     // Fantom
    'BNBUSD': true,     // Binance USD
    'CRYUSD': true,     // Crypto.com Coin
    'ERYUSD': true,     // Ethereum Classic
    'INCUSD': true,     // Internet Computer
    'LRCUSD': true,     // Loopring
    'NEOUSD': true,     // NEO
    'SANUSD': true,     // Sandbox
    'USDUSD': true,     // USDC
    'XTEUSD': true,     // Tether
    'XTZUSD': true,     // Tezos
    'BATUSD': true,     // Basic Attention Token
    'IOTUSD': true,     // IOTA
    'TRXUSD': true,     // Tron
    'ZECUSD': true,     // Zcash
    'ALGUSD': true,     // Algorand
    'FLRUSD': true,     // Flare
    'GRTUSD': true,     // The Graph
  },
  
  // ============================================================
  // 📈 ÍNDICES GLOBAIS
  // ============================================================
  INDICES: {
    // USA
    'US30': true,        // Dow Jones
    'SPX500': true,      // 🆕 S&P 500 (PRIORITÁRIO - 70% da AI) - Nomenclatura Infinox
    'USX': true,         // US Dollar Index
    'NAS100': true,      // NASDAQ 100
    'NAS100R': true,     // NASDAQ 100 Rollover
    'SP500IT': true,     // S&P 500 IT
    'SP500TR': true,     // S&P 500 TR
    'SP500R': true,      // S&P 500 Rollover
    'US100IT': true,     // US 100 IT
    'VIX': true,         // VIX Volatility
    'US2000': true,      // Russell 2000
    
    // Europa
    'UK100': true,       // FTSE 100
    'UK100IT': true,     // FTSE 100 IT
    'FR40': true,        // CAC 40
    'DE40': true,        // DAX 40
    'GERHUft': true,     // DAX Futuro
    'ESP35': true,       // IBEX 35
    'EU50': true,        // Euro Stoxx 50
    'EUBTX50': true,     // Euro Stoxx 50 Banks
    'DJV600': true,      // DJ Euro Stoxx 600
    
    // Ásia/Pacífico
    'JPN225': true,      // Nikkei 225
    'HKG33': true,       // Hang Seng
    'HK50IT': true,      // Hang Seng IT
    'CHINA50': true,     // China A50
    'AUS200': true,      // ASX 200
    
    // Brasil
    'BVSPX': true,       // Bovespa
  },
  
  // ============================================================
  // 📊 AÇÕES UK (FTSE 100)
  // ============================================================
  STOCKS_UK: {
    'GBXUSD': true,      // GBX/USD Rate
    'AAL': true,         // Anglo American
    'ABF': true,         // Associated British Foods
    'ABDN': true,        // Abrdn
    'AHT': true,         // Ashtead Group
    'ANTO': true,        // Antofagasta
    'AUTO': true,        // Auto Trader Group
    'AVIVA': true,       // Aviva
    'AZN': true,         // AstraZeneca
    'BA.': true,         // BAE Systems
    'BARC': true,        // Barclays
    'BATS': true,        // British American Tobacco
    'BKG': true,         // Berkeley Group
    'BLND': true,        // British Land
    'BME': true,         // B&M European Value Retail
    'BNZL': true,        // Bunzl
    'BP': true,          // BP
    'BRBY': true,        // Burberry
    'BT.A': true,        // BT Group
    'CCH': true,         // Coca-Cola HBC
    'CCL': true,         // Carnival
    'CNA': true,         // Centrica
    'CPG': true,         // Compass Group
    'CRDA': true,        // Croda International
    'DCC': true,         // DCC
    'DGE': true,         // Diageo
    'EXPN': true,        // Experian
    'EZJ': true,         // easyJet
    'FERG': true,        // Ferguson
    'FLTR': true,        // Flutter Entertainment
    'FRAS': true,        // Frasers Group
    'FRES': true,        // Fresnillo
    'GLEN': true,        // Glencore
    'GSK': true,         // GSK
    'HLMA': true,        // Halma
    'HIK': true,         // Hikma Pharmaceuticals
    'HSBA': true,        // HSBC
    'HSX': true,         // Hiscox
    'IHG': true,         // InterContinental Hotels
    'III': true,         // 3i Group
    'IMB': true,         // Imperial Brands
    'INF': true,         // Informa
    'ITRK': true,        // Intertek
    'ITV': true,         // ITV
    'JD.': true,         // JD Sports Fashion
    'JMAT': true,        // Johnson Matthey
    'KGF': true,         // Kingfisher
    'LAND': true,        // Land Securities
    'LGEN': true,        // Legal & General
    'LLOY': true,        // Lloyds Banking Group
    'LSEG': true,        // London Stock Exchange Group
    'MNG': true,         // M&G
    'MNDI': true,        // Mondi
    'NG.': true,         // National Grid
    'NGRID': true,       // National Grid (alt)
    'NWG': true,         // NatWest Group
    'NXT': true,         // Next
    'OCDO': true,        // Ocado
    'PHNX': true,        // Phoenix Group
    'PRU': true,         // Prudential
    'PSH': true,         // Pershing Square Holdings
    'PSN': true,         // Persimmon
    'PSON': true,        // Pearson
    'REL': true,         // RELX
    'RELX': true,        // RELX (alt)
    'RIO': true,         // Rio Tinto
    'RMV': true,         // Rightmove
    'RR.': true,         // Rolls-Royce
    'RB': true,          // Reckitt
    'RS1': true,         // Rolls-Royce
    'SBRY': true,        // Sainsbury's
    'SDR': true,         // Schroders
    'SGE': true,         // Sage Group
    'SGRO': true,        // Segro
    'SHEL': true,        // Shell
    'SHELL': true,       // Shell (alt)
    'SMDS': true,        // DS Smith
    'SMIN': true,        // Smiths Group
    'SMT': true,         // Scottish Mortgage
    'SN.': true,         // Smith & Nephew
    'SPX': true,         // Spirax-Sarco
    'SSE': true,         // SSE
    'STAN': true,        // Standard Chartered
    'STJ': true,         // St. James's Place
    'SVT': true,         // Severn Trent
    'TESCO': true,       // Tesco
    'TW.': true,         // Taylor Wimpey
    'ULTI': true,        // Ultimate
    'ULVR': true,        // Unilever
    'VOD': true,         // Vodafone
    'VTY': true,         // Vistry Group
    'WPP': true,         // WPP
    'WTB': true,         // Whitbread
    'TRST': true,        // Trust Payments
  },
  
  // ============================================================
  // 📊 AÇÕES EUROPA CONTINENTAL
  // ============================================================
  STOCKS_EU: {
    // França
    'AC': true,          // Accor
    'AI': true,          // Air Liquide
    'AIR': true,         // Airbus
    'ATO': true,         // Atos
    'ATOS': true,        // Atos (alt)
    'BN': true,          // Danone
    'BNP': true,         // BNP Paribas
    'CA': true,          // Carrefour
    'CAP': true,         // Capgemini
    'CS': true,          // AXA
    'DAST': true,        // Dassault Systèmes
    'DG': true,          // Vinci
    'EL': true,          // EssilorLuxottica
    'ENGI': true,        // Engie
    'ERA': true,         // Eramet
    'FP': true,          // TotalEnergies
    'FRA': true,         // Fraport
    'FRE': true,         // Fresenius
    'G24': true,         // Delivery Hero
    'GLE': true,         // Société Générale
    'HRMS': true,        // Hermès
    'KER': true,         // Kering
    'ML': true,          // Michelin
    'OR': true,          // L'Oréal
    'PUBP': true,        // Publicis
    'RI': true,          // Pernod Ricard
    'RNO': true,         // Renault
    'SAF': true,         // Safran
    'SGO': true,         // Saint-Gobain
    'STM': true,         // STMicroelectronics
    'SU': true,          // Schneider Electric
    'TCFP': true,        // TotalEnergies (alt)
    'URW': true,         // Unibail-Rodamco-Westfield
    'VIE': true,         // Veolia
    'VIV': true,         // Vivendi
    
    // Espanha
    'ADPR': true,        // Aena
    'AENA': true,        // Aena (alt)
    'AMS': true,         // Amadeus IT
    'ANA': true,         // Acciona
    'ABG': true,         // Abengoa
    'BBVA': true,        // Banco Bilbao Vizcaya
    'CABK': true,        // CaixaBank
    'CDI': true,         // Cellnex
    'CLIX': true,        // Cellnex (alt)
    'DIM': true,         // Dia
    'ELE': true,         // Endesa
    'GALP': true,        // Galp Energia
    'IBE': true,         // Iberdrola
    'ITX': true,         // Inditex
    'MAP': true,         // Mapfre
    'REP': true,         // Repsol
    'SAB': true,         // Banco Sabadell
    'SANTAN': true,      // Banco Santander
    'SON': true,         // Sonae
    'SW': true,          // Sacyr
    'TEF': true,         // Telefónica
    'VIS': true,         // Viscofan
    'AMUN': true,        // ArcelorMittal
    
    // Holanda
    'ABN': true,         // ABN AMRO
    'ADYEN': true,       // Adyen
    'AGN': true,         // Aegon
    'AKZA': true,        // Akzo Nobel
    'ASM': true,         // ASM International
    'ASML': true,        // ASML
    'ASRNL': true,       // ASR Nederland
    'GLPG': true,        // Galapagos
    'HEIA': true,        // Heineken
    'IMCD': true,        // IMCD
    'INGA': true,        // ING Group
    'KPN': true,         // KPN
    'MT': true,          // ArcelorMittal
    'NN': true,          // NN Group
    'PHIA': true,        // Philips
    'PRX': true,         // Prosus
    'RAND': true,        // Randstad
    'UNA': true,         // Unilever
    'VPK': true,         // Koninklijke Vopak
    'WKL': true,         // Wolters Kluwer
    'AALB': true,        // Aalberts
    
    // Alemanha
    'ADS': true,         // Adidas
    'AFX': true,         // Carl Zeiss Meditec
    'ALV': true,         // Allianz
    'BAS': true,         // BASF
    'BAYN': true,        // Bayer
    'BEI': true,         // Beiersdorf
    'BMW': true,         // BMW
    'BMWI': true,        // BMW (alt)
    'BNRR': true,        // Brenntag
    'CBK': true,         // Commerzbank
    'CON': true,         // Continental
    'DB1': true,         // Deutsche Börse
    'DBK': true,         // Deutsche Bank
    'DHER': true,        // Delivery Hero
    'DWS': true,         // DWS Group
    'DWNI': true,        // Deutsche Wohnen
    'EOAN': true,        // E.ON
    'FIE': true,         // Fielmann
    'FME': true,         // Fresenius Medical Care
    'HEI': true,         // HeidelbergCement
    'HEN3': true,        // Henkel
    'HLAG': true,        // Hapag-Lloyd
    'HNR1': true,        // Hannover Re
    'HOT': true,         // Hochtief
    'IFX': true,         // Infineon
    'KBX': true,         // Knorr-Bremse
    'KGX': true,         // KION Group
    'KRN': true,         // Krones
    'LEG': true,         // LEG Immobilien
    'MBG': true,         // Mercedes-Benz
    'MRCK': true,        // Merck KGaA
    'MTX': true,         // MTU Aero Engines
    'MUV2': true,        // Munich Re
    'NEMD': true,        // Nemetschek
    'PUM': true,         // Puma
    'RAA': true,         // Rational
    'RRTL': true,        // RTL Group
    'RWE': true,         // RWE
    'SAP': true,         // SAP
    'SHL': true,         // Siemens Healthineers
    'SIE': true,         // Siemens
    'SRTS': true,        // Sartorius
    'SY1': true,         // Symrise
    'TLX': true,         // Talanx
    
    // Itália
    'BIM': true,         // Banca Intesa
    'ENI': true,         // ENI
    'ENEL': true,        // Enel
    'FCA': true,         // Fiat Chrysler
    'G': true,           // Assicurazioni Generali
    'ISP': true,         // Intesa Sanpaolo
    'LUX': true,         // Luxottica
    'TIT': true,         // Telecom Italia
    'UCG': true,         // UniCredit
  },
  
  // ============================================================
  // 📊 AÇÕES USA
  // ============================================================
  STOCKS_US: {
    'AAPL': true,        // Apple
    'ABBV': true,        // AbbVie
    'ABNB': true,        // Airbnb
    'ACN': true,         // Accenture
    'ADBE': true,        // Adobe
    'ADI': true,         // Analog Devices
    'ADP': true,         // Automatic Data Processing
    'AMGN': true,        // Amgen
    'AMT': true,         // American Tower
    'AMZN': true,        // Amazon
    'ASML': true,        // ASML
    'AVGO': true,        // Broadcom
    'AXP': true,         // American Express
    'BA': true,          // Boeing
    'BABA': true,        // Alibaba
    'BAC': true,         // Bank of America
    'BLK': true,         // BlackRock
    'BMY': true,         // Bristol-Myers Squibb
    'BRK.B': true,       // Berkshire Hathaway B
    'C': true,           // Citigroup
    'CAT': true,         // Caterpillar
    'CHTR': true,        // Charter Communications
    'CL': true,          // Colgate-Palmolive
    'CMCSA': true,       // Comcast
    'COST': true,        // Costco
    'CRM': true,         // Salesforce
    'CSCO': true,        // Cisco
    'CVS': true,         // CVS Health
    'CVX': true,         // Chevron
    'DHR': true,         // Danaher
    'DIS': true,         // Disney
    'EBAY': true,        // eBay
    'F': true,           // Ford
    'FB': true,          // Meta (Facebook)
    'FDX': true,         // FedEx
    'GE': true,          // General Electric
    'GILD': true,        // Gilead Sciences
    'GM': true,          // General Motors
    'GOOG': true,        // Alphabet (Google) C
    'GOOGL': true,       // Alphabet (Google) A
    'GS': true,          // Goldman Sachs
    'HD': true,          // Home Depot
    'HON': true,         // Honeywell
    'IBM': true,         // IBM
    'INTC': true,        // Intel
    'INTU': true,        // Intuit
    'JNJ': true,         // Johnson & Johnson
    'JPM': true,         // JPMorgan Chase
    'KO': true,          // Coca-Cola
    'LIN': true,         // Linde
    'LLY': true,         // Eli Lilly
    'LMT': true,         // Lockheed Martin
    'LOW': true,         // Lowe's
    'MA': true,          // Mastercard
    'MCD': true,         // McDonald's
    'MDLZ': true,        // Mondelez
    'MDT': true,         // Medtronic
    'META': true,        // Meta Platforms
    'MO': true,          // Altria
    'MRK': true,         // Merck
    'MS': true,          // Morgan Stanley
    'MSFT': true,        // Microsoft
    'NFLX': true,        // Netflix
    'NKE': true,         // Nike
    'NVDA': true,        // NVIDIA
    'ORCL': true,        // Oracle
    'PEP': true,         // PepsiCo
    'PFE': true,         // Pfizer
    'PG': true,          // Procter & Gamble
    'PM': true,          // Philip Morris
    'PYPL': true,        // PayPal
    'QCOM': true,        // Qualcomm
    'RTX': true,         // Raytheon Technologies
    'SBUX': true,        // Starbucks
    'SHOP': true,        // Shopify
    'SLB': true,         // Schlumberger
    'SO': true,          // Southern Company
    'SPG': true,         // Simon Property Group
    'SQ': true,          // Block (Square)
    'T': true,           // AT&T
    'TGT': true,         // Target
    'TMO': true,         // Thermo Fisher Scientific
    'TMUS': true,        // T-Mobile
    'TSLA': true,        // Tesla
    'TXN': true,         // Texas Instruments
    'UNH': true,         // UnitedHealth
    'UNP': true,         // Union Pacific
    'UPS': true,         // UPS
    'USB': true,         // U.S. Bancorp
    'V': true,           // Visa
    'VZ': true,          // Verizon
    'WFC': true,         // Wells Fargo
    'WMT': true,         // Walmart
    'XOM': true,         // Exxon Mobil
    'ZM': true,          // Zoom
  },
  
  // ============================================================
  // 📈 BONDS & EUROBONDS
  // ============================================================
  BONDS: {
    'EUB10Y': true,      // Euro Bond 10Y
    'EUB2Y': true,       // Euro Bond 2Y
    'EUB30Y': true,      // Euro Bond 30Y
    'EUB5Y': true,       // Euro Bond 5Y
    'EURIBOR3M': true,   // Euribor 3 Meses
    'LongGilt': true,    // UK Long Gilt
    'USNote10Y': true,   // US Treasury 10Y
  },
  
  // ============================================================
  // 📊 FUTUROS
  // ============================================================
  FUTURES: {
    'EURGBPft': true,    // EUR/GBP Futuro
    'EURUSDft': true,    // EUR/USD Futuro
    'GBPUSDft': true,    // GBP/USD Futuro
  },
};

/**
 * 🔍 VERIFICAR SE ATIVO ESTÁ DISPONÍVEL NA INFINOX
 */
export function isInfinoxAsset(symbol: string): boolean {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Buscar em todas as categorias
  for (const category of Object.values(INFINOX_ASSETS)) {
    if (category[normalized]) {
      return true;
    }
  }
  
  return false;
}

/**
 * 📋 OBTER CATEGORIA DO ATIVO INFINOX
 */
export function getInfinoxCategory(symbol: string): string | null {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  for (const [categoryName, assets] of Object.entries(INFINOX_ASSETS)) {
    if (assets[normalized]) {
      return categoryName;
    }
  }
  
  return null;
}

/**
 * 📊 OBTER TODOS OS ATIVOS POR CATEGORIA
 */
export function getInfinoxAssetsByCategory(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  
  for (const [categoryName, assets] of Object.entries(INFINOX_ASSETS)) {
    result[categoryName] = Object.keys(assets).sort();
  }
  
  return result;
}

/**
 * 🔢 ESTATÍSTICAS DOS ATIVOS INFINOX
 */
export function getInfinoxStats() {
  let totalAssets = 0;
  const categoryStats: Record<string, number> = {};
  
  for (const [categoryName, assets] of Object.entries(INFINOX_ASSETS)) {
    const count = Object.keys(assets).length;
    categoryStats[categoryName] = count;
    totalAssets += count;
  }
  
  return {
    total: totalAssets,
    byCategory: categoryStats,
  };
}

/**
 * 🎯 MAPEAR NOMES AMIGÁVEIS DAS CATEGORIAS
 */
export const INFINOX_CATEGORY_NAMES: Record<string, string> = {
  FOREX: '💱 Forex',
  METALS: '🥇 Metais',
  ENERGY: '🛢️ Energia',
  COMMODITIES: '🌾 Commodities',
  CRYPTO: '₿ Criptomoedas',
  INDICES: '📈 Índices',
  STOCKS_UK: '🇬🇧 Ações UK',
  STOCKS_EU: '🇪🇺 Ações Europa',
  STOCKS_US: '🇺🇸 Ações USA',
  BONDS: '📊 Bonds',
  FUTURES: '📈 Futuros',
};