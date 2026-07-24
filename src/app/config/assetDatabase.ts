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
  | 'US Indices' | 'European Indices' | 'Asian Indices' | 'LatAm Indices'
  | 'Precious Metals' | 'Energy' | 'Agriculture'
  | 'UK Stocks' | 'French Stocks' | 'German Stocks' | 'Spanish Stocks' | 'Portuguese Stocks' | 'Dutch Stocks' | 'Scandinavian Stocks' | 'US Stocks'
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
  // ✅ 2026-07-16: variante "horário estendido" do USDCHF (sufixo `-EXC` na
  // Infinox, ver override em brokerRegistry.ts). Confirmada real via
  // /mt5-prices antes de adicionar.
  { symbol: 'USDCHFEXC', name: 'US Dollar vs Swiss Franc (horário estendido)', category: 'FOREX', subCategory: 'Major Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/7', description: 'USD/CHF — variante -EXC da Infinox' },
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
  // ✅ 2026-07-15: confirmado CFD real na Infinox via script de auditoria
  // (`scripts/audit-broker-symbols.mjs USDBRL` — resposta OK com nome
  // unificado, sem precisar de override em brokerRegistry.ts).
  { symbol: 'USDBRL', name: 'US Dollar vs Brazilian Real', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 5, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'USD/BRL' },
  // ✅ 2026-07-16: confirmado CFD real na Infinox (nome unificado bate direto
  // com o nome da corretora, sem override necessário).
  { symbol: 'USDNGN', name: 'US Dollar vs Nigerian Naira', category: 'FOREX', subCategory: 'Exotic Pairs', icon: '💱', precision: 2, lotSize: 100000, minLot: 0.01, maxLot: 100, leverage: 50, tradingHours: '24/5', description: 'USD/NGN' },
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
  // ✅ 2026-07-16: BTCEUR não existia no catálogo — confirmado real via
  // /mt5-prices (~€55.918). Sem variante .crp (testada, HTTP 404).
  { symbol: 'BTCEUR', name: 'Bitcoin (EUR)', category: 'CRYPTO', subCategory: 'Bitcoin', icon: '₿', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Bitcoin — cotado em Euro' },
  // ✅ 2026-07-16: BTCBNB não existia no catálogo — não existe com esse nome
  // literal na Infinox (HTTP 404), mas existe como 'BTCXBN' (mesmo padrão
  // do XBN visto nesta sessão pro Binance Coin) — confirmado real via
  // /mt5-prices (~288,65), override em brokerRegistry.ts.
  { symbol: 'BTCBNB', name: 'Bitcoin (BNB)', category: 'CRYPTO', subCategory: 'Bitcoin', icon: '₿', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Bitcoin — cotado em Binance Coin' },
  // ✅ 2026-07-16: mesmo padrão do BTCBNB — BTCETH (real 'BTCXET' na
  // Infinox, ~34,15) e BTCLTC (real 'BTCXLC', ~1437,77) não existiam no
  // catálogo. Overrides em brokerRegistry.ts.
  { symbol: 'BTCETH', name: 'Bitcoin (ETH)', category: 'CRYPTO', subCategory: 'Bitcoin', icon: '₿', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Bitcoin — cotado em Ethereum' },
  { symbol: 'BTCLTC', name: 'Bitcoin (LTC)', category: 'CRYPTO', subCategory: 'Bitcoin', icon: '₿', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Bitcoin — cotado em Litecoin' },
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
  { symbol: 'BATUSD', name: 'Basic Attention Token', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🦁', precision: 5, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Basic Attention Token' },
  // ✅ 2026-07-16: variantes "liquidadas em cripto" vistas pelo Cleber no
  // terminal MT5 (sufixo `.crp` na Infinox) — instrumentos distintos dos
  // BTCUSD/ETHUSD/BNBUSD/LTCUSD normais (ver override em brokerRegistry.ts),
  // confirmados reais via /mt5-prices antes de adicionar.
  { symbol: 'BTCUSDCRP', name: 'Bitcoin (liquidação cripto)', category: 'CRYPTO', subCategory: 'Bitcoin', icon: '₿', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Bitcoin — variante .crp da Infinox' },
  // ✅ 2026-07-16: mesmo padrão do XBNUSD — Cleber notou que só o XETUSDCRP
  // existia. Testado 'XETUSD' normal (sem .crp) via /mt5-prices e é real
  // (~1871, variante de liquidação diferente do .crp, valores próximos).
  { symbol: 'XETUSD', name: 'Ethereum (XET)', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ξ', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Ethereum — contrato XETUSD da Infinox' },
  { symbol: 'XETUSDCRP', name: 'Ethereum (liquidação cripto)', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ξ', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Ethereum — variante .crp da Infinox' },
  // ✅ 2026-07-16: Cleber notou que só o XBNUSDCRP existia — testado o
  // 'XBNUSD' normal (sem .crp) via /mt5-prices e é real, contrato DISTINTO
  // do BNBUSD (~576 vs ~219, mesma relação já vista em GAUUSD/XAUUSD),
  // preço bate de perto com o próprio XBNUSDCRP (mesmo ativo, liquidação
  // diferente). Faltava adicionar o par junto do .crp.
  { symbol: 'XBNUSD', name: 'Binance Coin (XBN)', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🟡', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Binance Coin — contrato XBNUSD da Infinox, distinto do BNBUSD' },
  { symbol: 'XBNUSDCRP', name: 'Binance Coin (liquidação cripto)', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🟡', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Binance Coin — variante .crp da Infinox' },
  // ✅ 2026-07-16: mesmo padrão do XBNUSD/XETUSD — só o XLCUSDCRP existia.
  // Testado 'XLCUSD' normal via /mt5-prices e é real (~43,92).
  { symbol: 'XLCUSD', name: 'Litecoin (XLC)', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ł', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Litecoin — contrato XLCUSD da Infinox' },
  // ✅ 2026-07-16: XETEUR não existia no catálogo — mesmo padrão do BTCEUR
  // (contrato XET cotado em Euro em vez de USD), confirmado real via
  // /mt5-prices (~€1.630,48, bate com o print do Cleber ~€1.628,40).
  { symbol: 'XETEUR', name: 'Ethereum (XET/EUR)', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ξ', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 100, leverage: 5, tradingHours: '24/7', description: 'Ethereum (contrato XET) — cotado em Euro' },
  { symbol: 'XLCUSDCRP', name: 'Litecoin (liquidação cripto)', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ł', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Litecoin — variante .crp da Infinox' },
  // ✅ 2026-07-16: XETXBN e XETXLC não existiam no catálogo — Cleber notou
  // no terminal MT5. Confirmados reais via /mt5-prices (XETXBN ~8,36,
  // XETXLC ~41,43) — Ethereum (contrato XET) cotado em XBN/XLC, mesmo
  // padrão do BTCBNB/BTCETH/BTCLTC.
  { symbol: 'XETXBN', name: 'Ethereum (XET/XBN)', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ξ', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Ethereum (contrato XET) — cotado em Binance Coin (XBN)' },
  { symbol: 'XETXLC', name: 'Ethereum (XET/XLC)', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ξ', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Ethereum (contrato XET) — cotado em Litecoin (XLC)' },
  // ✅ 2026-07-16: Cleber reportou uma lista do MT5 com vários ativos "que
  // eu sei que não tem" — auditados um a um via /mt5-prices antes de
  // adicionar. Achado importante: FILUSD/GRTUSD/TRXUSD/ETCUSD/NEARUSD/
  // SANDUSD/ALGOUSD já existiam em ChartView.tsx (usado pelo Dashboard/
  // Gráfico), mas NUNCA tinham sido portados pra este catálogo oficial
  // (usado pelo Navegador de Ativos) — por isso "não apareciam" pra ele
  // mesmo já tendo preço real em outras telas. Confirmados reais de novo
  // aqui antes de portar.
  { symbol: 'FILUSD', name: 'Filecoin', category: 'CRYPTO', subCategory: 'Altcoins', icon: '📦', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Filecoin' },
  { symbol: 'GRTUSD', name: 'The Graph', category: 'CRYPTO', subCategory: 'Altcoins', icon: '📊', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'The Graph' },
  { symbol: 'TRXUSD', name: 'Tron', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔻', precision: 5, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Tron' },
  { symbol: 'ETCUSD', name: 'Ethereum Classic', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ξ', precision: 3, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'Ethereum Classic' },
  { symbol: 'NEARUSD', name: 'NEAR Protocol', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🌐', precision: 3, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'NEAR Protocol' },
  { symbol: 'SANDUSD', name: 'The Sandbox', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🏖️', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'The Sandbox' },
  { symbol: 'ALGOUSD', name: 'Algorand', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔷', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Algorand' },
  // ✅ 2026-07-16: os 8 abaixo eram genuinamente novos — não existiam em
  // nenhum dos 2 catálogos. Confirmados reais via /mt5-prices. ZECUSD/
  // XTZUSD/CRVUSD/NEOUSD têm o mesmo nome unificado e real na corretora
  // (sem override). SUSHIUSD/IOTAUSD têm nome real curto na Infinox
  // ('SUSUSD'/'IOTUSD', override em brokerRegistry.ts, mesmo padrão do
  // DOGEUSD/LINKUSD). ONEUSD (Harmony) já é o próprio ticker real, sem
  // sufixo diferente. INCUSD: identidade exata não confirmada (preço real
  // batendo, ~$0,071, mas sem certeza de qual altcoin é — nome mantido
  // literal até o Cleber confirmar no MT5 dele).
  { symbol: 'ZECUSD', name: 'Zcash', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🛡️', precision: 2, lotSize: 1, minLot: 0.01, maxLot: 1000, leverage: 5, tradingHours: '24/7', description: 'Zcash' },
  { symbol: 'XTZUSD', name: 'Tezos', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔵', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Tezos' },
  { symbol: 'CRVUSD', name: 'Curve DAO Token', category: 'CRYPTO', subCategory: 'DeFi', icon: '🌀', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Curve DAO Token' },
  { symbol: 'NEOUSD', name: 'NEO', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🟢', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 10000, leverage: 5, tradingHours: '24/7', description: 'NEO' },
  { symbol: 'SUSHIUSD', name: 'SushiSwap', category: 'CRYPTO', subCategory: 'DeFi', icon: '🍣', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'SushiSwap — contrato real da Infinox é SUSUSD' },
  { symbol: 'IOTAUSD', name: 'IOTA', category: 'CRYPTO', subCategory: 'Altcoins', icon: 'Ⓘ', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'IOTA — contrato real da Infinox é IOTUSD' },
  { symbol: 'ONEUSD', name: 'Harmony', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🔶', precision: 6, lotSize: 1, minLot: 100, maxLot: 1000000, leverage: 5, tradingHours: '24/7', description: 'Harmony' },
  { symbol: 'INCUSD', name: 'INC', category: 'CRYPTO', subCategory: 'Altcoins', icon: '🪙', precision: 4, lotSize: 1, minLot: 1, maxLot: 100000, leverage: 5, tradingHours: '24/7', description: 'Contrato INCUSD da Infinox — identidade exata não confirmada' },

  // ============================================================================
  // 📊 INDICES - ÍNDICES GLOBAIS (16 ÍNDICES)
  // ============================================================================
  
  // US INDICES
  { symbol: 'SPX500', name: 'S&P 500', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'S&P 500' },
  { symbol: 'NAS100', name: 'NASDAQ 100', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'NASDAQ 100' },
  { symbol: 'US30', name: 'Dow Jones Industrial Average', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'Dow Jones' },
  { symbol: 'US2000', name: 'Russell 2000', category: 'INDICES', subCategory: 'US Indices', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:00 ET', description: 'Russell 2000' },
  // ✅ 2026-07-16: confirmado CFD real na Infinox via /mt5-prices, nome
  // unificado funciona direto. Nota: o ChartView.tsx tinha um "DXY" que
  // testado agora dá HTTP 404 (nunca existiu de verdade) — corrigido junto.
  { symbol: 'USDX', name: 'US Dollar Index', category: 'INDICES', subCategory: 'US Indices', icon: '💵', precision: 3, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'US Dollar Index' },
  { symbol: 'VIX', name: 'CBOE Volatility Index', category: 'INDICES', subCategory: 'US Indices', icon: '📉', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '09:30-16:15 ET', description: 'CBOE Volatility Index' },
  
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

  // LATAM INDICES
  // ✅ 2026-07-16: BVSPX (Ibovespa) confirmado real via /mt5-prices antes de
  // adicionar — alternativas testadas (IBOV, BVSP, IBOVX, BRA50, WIN) deram
  // HTTP 404, nome real na corretora é BVSPX. Estava faltando no catálogo
  // (Cleber reportou "não existe").
  { symbol: 'BVSPX', name: 'Ibovespa', category: 'INDICES', subCategory: 'LatAm Indices', icon: '🇧🇷', precision: 2, lotSize: 1, minLot: 0.1, maxLot: 100, leverage: 100, tradingHours: '10:00-17:00 BRT', description: 'Ibovespa' },

  // ============================================================================
  // 🏅 COMMODITIES - METAIS E ENERGIA (14 ATIVOS)
  // ============================================================================
  
  // PRECIOUS METALS
  { symbol: 'XAUUSD', name: 'Gold', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold' },
  // ✅ 2026-07-16: variante "liquidação cripto" do ouro (sufixo `.crp` na
  // Infinox, ver override em brokerRegistry.ts) — costuma operar em horários
  // que o XAUUSD tradicional fecha (ex: fim de semana). Confirmada real via
  // /mt5-prices antes de adicionar.
  { symbol: 'XAUUSDCRP', name: 'Gold (liquidação cripto)', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/7', description: 'Gold — variante .crp da Infinox' },
  // ✅ 2026-07-16: GAUUSD confirmado real via /mt5-prices, mas com preço
  // (~130) muito diferente do XAUUSD (~4000) — contrato distinto (provável
  // variante mini/fracionária), não duplicata. Nome bate direto, sem
  // override necessário.
  { symbol: 'GAUUSD', name: 'Gold (contrato alternativo)', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold — contrato GAUUSD da Infinox, distinto do XAUUSD' },
  { symbol: 'XAGUSD', name: 'Silver', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥈', precision: 3, lotSize: 5000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Silver' },
  { symbol: 'XPTUSD', name: 'Platinum', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '⚪', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Platinum' },
  { symbol: 'XPDUSD', name: 'Palladium', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '⚪', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Palladium' },
  { symbol: 'XAUEUR', name: 'Gold vs Euro', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold priced in Euro' },
  // ✅ 2026-07-16: pares de ouro em outras moedas, confirmados reais via
  // /mt5-prices antes de adicionar.
  { symbol: 'XAUAUD', name: 'Gold vs Australian Dollar', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold priced in Australian Dollar' },
  { symbol: 'XAUGBP', name: 'Gold vs British Pound', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold priced in British Pound' },
  { symbol: 'XAUJPY', name: 'Gold vs Japanese Yen', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 0, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold priced in Japanese Yen' },
  { symbol: 'XAUCHF', name: 'Gold vs Swiss Franc', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold priced in Swiss Franc' },
  // ✅ 2026-07-16: GOLDft/SILVERft (contratos futuros, distintos do spot
  // XAUUSD/XAGUSD — mesma relação já vista em GAUUSD vs XAUUSD) confirmados
  // reais via /mt5-prices, a pedido do Cleber.
  // ⚠️ 2026-07-16: símbolo unificado precisa ser MAIÚSCULO (GOLDFT, não
  // GOLDft) — todo o pipeline de preço faz `.toUpperCase()` no símbolo antes
  // de qualquer busca (cache, seleção, fetch), então um símbolo com "ft"
  // minúsculo nunca sobrevivia à normalização e nunca batia com nada. O nome
  // REAL na Infinox É case-sensitive ("GOLDft") — daí o override abaixo.
  { symbol: 'GOLDFT', name: 'Gold Futures', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥇', precision: 2, lotSize: 100, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Gold — contrato futuro da Infinox, distinto do XAUUSD (spot)' },
  { symbol: 'SILVERFT', name: 'Silver Futures', category: 'COMMODITIES', subCategory: 'Precious Metals', icon: '🥈', precision: 3, lotSize: 5000, minLot: 0.01, maxLot: 100, leverage: 500, tradingHours: '24/5', description: 'Silver — contrato futuro da Infinox, distinto do XAGUSD (spot)' },

  // ENERGY
  { symbol: 'USOUSD', name: 'Crude Oil WTI', category: 'COMMODITIES', subCategory: 'Energy', icon: '🛢️', precision: 2, lotSize: 1000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'WTI Crude Oil' },
  { symbol: 'UKOUSD', name: 'Brent Oil', category: 'COMMODITIES', subCategory: 'Energy', icon: '🛢️', precision: 2, lotSize: 1000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Brent Crude Oil' },
  // ✅ 2026-07-16: CL-OIL (WTI, contrato distinto do USOUSD) e UKOUSDft
  // (Brent futuro, distinto do UKOUSD spot/CFD) confirmados reais via
  // /mt5-prices, a pedido do Cleber.
  { symbol: 'CL-OIL', name: 'Crude Oil WTI Futures', category: 'COMMODITIES', subCategory: 'Energy', icon: '🛢️', precision: 3, lotSize: 1000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'WTI — contrato futuro da Infinox, distinto do USOUSD' },
  // ⚠️ mesmo caso do GOLDFT/SILVERFT acima — símbolo unificado maiúsculo,
  // override case-sensitive pro nome real.
  { symbol: 'UKOUSDFT', name: 'Brent Oil Futures', category: 'COMMODITIES', subCategory: 'Energy', icon: '🛢️', precision: 3, lotSize: 1000, minLot: 0.01, maxLot: 100, leverage: 100, tradingHours: '24/5', description: 'Brent — contrato futuro da Infinox, distinto do UKOUSD (spot/CFD)' },
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
  // ✅ 2026-07-16: Cleber mandou uma lista grande do MT5 dele (ações UK) —
  // auditados um a um via /mt5-prices antes de adicionar. O símbolo usado
  // aqui (antes do ".L") já é o nome literal confirmado na Infinox — não
  // precisa de override em brokerRegistry.ts, segue o mesmo padrão do resto
  // do catálogo (stripExchangeSuffix já resolve certo).
  { symbol: 'ABF.L', name: 'Associated British Foods PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Food Products' },
  { symbol: 'PRU.L', name: 'Prudential PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Insurance' },
  { symbol: 'RELX.L', name: 'RELX PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Publishing & Analytics' },
  { symbol: 'ABDN.L', name: 'abrdn PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Asset Management' },
  { symbol: 'AUTO.L', name: 'Auto Trader Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Online Marketplace' },
  { symbol: 'BLND.L', name: 'British Land Company PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Real Estate' },
  { symbol: 'CRH.L', name: 'CRH PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Building Materials' },
  { symbol: 'ENT.L', name: 'Entain PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Gambling' },
  { symbol: 'EZJ.L', name: 'easyJet PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Airlines' },
  { symbol: 'FRAS.L', name: 'Frasers Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Retail' },
  { symbol: 'HSX.L', name: 'Hiscox Ltd', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Insurance' },
  { symbol: 'III.L', name: '3i Group PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Private Equity' },
  { symbol: 'ITV.L', name: 'ITV PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Media & Broadcasting' },
  { symbol: 'JMAT.L', name: 'Johnson Matthey PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Specialty Chemicals' },
  { symbol: 'KGF.L', name: 'Kingfisher PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Retail' },
  { symbol: 'MNDI.L', name: 'Mondi PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Packaging' },
  { symbol: 'NGRID.L', name: 'National Grid PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Utilities' },
  { symbol: 'NXT.L', name: 'Next PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Retail' },
  { symbol: 'PSH.L', name: 'Pershing Square Holdings Ltd', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Investment Trust' },
  { symbol: 'RMV.L', name: 'Rightmove PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Online Marketplace' },
  { symbol: 'RTO.L', name: 'Rentokil Initial PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Business Services' },
  { symbol: 'WPP.L', name: 'WPP PLC', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Advertising' },
  // TRST/SWR: preço real confirmado via /mt5-prices, mas identidade exata da
  // empresa não confirmada — mantidos com nome literal até o Cleber
  // confirmar no MT5 dele.
  { symbol: 'TRST.L', name: 'TRST', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Contrato TRST da Infinox — identidade exata não confirmada' },
  { symbol: 'SWR.L', name: 'SWR', category: 'STOCKS', subCategory: 'UK Stocks', icon: '🇬🇧', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 GMT', description: 'Contrato SWR da Infinox — identidade exata não confirmada' },

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
  // ✅ 2026-07-16: mesma lista do Cleber, auditados via /mt5-prices —
  // símbolo (antes do ".PA") já é o nome literal confirmado, sem precisar
  // de override.
  { symbol: 'ACA.PA', name: 'Credit Agricole SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'LR.PA', name: 'Legrand SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Electrical Equipment' },
  { symbol: 'RNO.PA', name: 'Renault SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles' },
  { symbol: 'STM.PA', name: 'STMicroelectronics NV', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Semiconductors' },
  // PUBP/TCFP: preço real confirmado, mas identidade exata não confirmada
  // (Publicis costuma ser "PUB", TechnipFMC costuma ser "FTI" — a corretora
  // usa nomes diferentes; mantidos literais até o Cleber confirmar no MT5).
  { symbol: 'PUBP.PA', name: 'PUBP', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato PUBP da Infinox — provável Publicis Groupe, identidade não confirmada' },
  { symbol: 'TCFP.PA', name: 'TCFP', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato TCFP da Infinox — identidade exata não confirmada' },
  // ✅ 2026-07-16: nova lista do Cleber (França/Espanha/Portugal/Holanda) —
  // auditados via /mt5-prices antes de adicionar.
  { symbol: 'AMUN.PA', name: 'Amundi SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Asset Management' },
  { symbol: 'CDI.PA', name: 'Christian Dior SE', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Luxury Goods' },
  { symbol: 'SW.PA', name: 'Sodexo SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Food Services' },
  // ADPR/DIM: preço real confirmado, identidade exata não confirmada
  // (ADPR provavelmente Aéroports de Paris, ticker usual "ADP").
  { symbol: 'ADPR.PA', name: 'ADPR', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato ADPR da Infinox — provável Aéroports de Paris, identidade não confirmada' },
  { symbol: 'DIM.PA', name: 'DIM', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato DIM da Infinox — identidade exata não confirmada' },
  { symbol: 'WLN.PA', name: 'Worldline SA', category: 'STOCKS', subCategory: 'French Stocks', icon: '🇫🇷', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Payment Services' },
  
  // GERMAN STOCKS (DAX 40) - Sample
  // ⚠️ 2026-07-16: auditoria confirmou 6 destas entradas com o código de
  // broker QUEBRADO (HTTP 404 genuíno via /mt5-prices, testado isolado
  // várias vezes pra descartar rate-limit) — caem sempre no fallback Yahoo
  // silenciosamente. DAI (Daimler) e DPW (Deutsche Post) têm causa raiz
  // conhecida: as empresas mudaram de nome/ticker (Daimler → Mercedes-Benz
  // Group/MBG em 2022; Deutsche Post → DHL Group/DHL) — os nomes novos
  // foram confirmados reais e adicionados abaixo (MBG.DE/DHL.DE). As outras
  // 4 (1COV, LHA, LIN, DTE) + MRK + BEI não têm substituto confirmado ainda
  // (testadas várias variantes, todas 404) — LIN (Linde) provavelmente
  // porque a empresa migrou o listing principal pra NYSE em 2023 e saiu da
  // Xetra. Pendente: Cleber confirmar o nome real de cada uma no MT5 dele.
  { symbol: '1COV.DE', name: 'Covestro AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — Chemicals' },
  { symbol: 'ADS.DE', name: 'Adidas AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Sporting Goods' },
  { symbol: 'ALV.DE', name: 'Allianz SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  { symbol: 'BAS.DE', name: 'BASF SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Chemicals' },
  { symbol: 'BAYN.DE', name: 'Bayer AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Pharmaceuticals' },
  { symbol: 'BEI.DE', name: 'Beiersdorf AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — Personal Care' },
  { symbol: 'BMW.DE', name: 'Bayerische Motoren Werke AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles' },
  { symbol: 'CBK.DE', name: 'Commerzbank AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'CON.DE', name: 'Continental AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Auto Parts' },
  { symbol: 'DAI.DE', name: 'Daimler AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — empresa renomeada, ver MBG.DE — Automobiles' },
  { symbol: 'DB1.DE', name: 'Deutsche Boerse AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Financial Services' },
  { symbol: 'DBK.DE', name: 'Deutsche Bank AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'DPW.DE', name: 'Deutsche Post AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — empresa renomeada, ver DHL.DE — Logistics' },
  { symbol: 'DTE.DE', name: 'Deutsche Telekom AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — Telecommunications' },
  { symbol: 'EOAN.DE', name: 'E.ON SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Utilities' },
  { symbol: 'FRE.DE', name: 'Fresenius SE & Co KGaA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Healthcare' },
  { symbol: 'FME.DE', name: 'Fresenius Medical Care AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Healthcare' },
  { symbol: 'HEN3.DE', name: 'Henkel AG & Co KGaA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Consumer Goods' },
  { symbol: 'IFX.DE', name: 'Infineon Technologies AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Semiconductors' },
  { symbol: 'LHA.DE', name: 'Deutsche Lufthansa AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — Airlines' },
  { symbol: 'LIN.DE', name: 'Linde PLC', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — Linde saiu da Xetra em 2023, listing principal virou só NYSE — Industrial Gases' },
  { symbol: 'MRK.DE', name: 'Merck KGaA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: '⚠️ QUEBRADO (HTTP 404) — não confundir com MRCK.DE (Merck & Co, EUA) — Pharmaceuticals' },
  { symbol: 'MUV2.DE', name: 'Muenchener Rueckversicherungs-Gesellschaft AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Reinsurance' },
  { symbol: 'RWE.DE', name: 'RWE AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Utilities' },
  { symbol: 'SAP.DE', name: 'SAP SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Software' },
  { symbol: 'SIE.DE', name: 'Siemens AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Conglomerate' },
  { symbol: 'VOW3.DE', name: 'Volkswagen AG (ações preferenciais)', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles' },
  // ✅ 2026-07-16: nova lista do Cleber — auditados via /mt5-prices antes de
  // adicionar. Alguns substituem/complementam entradas quebradas acima.
  { symbol: 'AFX.DE', name: 'Carl Zeiss Meditec AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Medical Technology' },
  { symbol: 'BNR.DE', name: 'Brenntag SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Chemical Distribution' },
  { symbol: 'MBG.DE', name: 'Mercedes-Benz Group AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles — sucessora da Daimler AG (DAI, quebrado)' },
  { symbol: 'DHER.DE', name: 'Delivery Hero SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Food Delivery' },
  { symbol: 'DWNI.DE', name: 'Deutsche Wohnen SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Real Estate' },
  { symbol: 'DWS.DE', name: 'DWS Group GmbH & Co KGaA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Asset Management' },
  // FIE/HOT/RAA/NEMD: preço real confirmado, identidade exata não
  // confirmada (melhores palpites: Fielmann, HOCHTIEF, Rational, Nemetschek).
  { symbol: 'FIE.DE', name: 'FIE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato FIE da Infinox — provável Fielmann AG, identidade não confirmada' },
  { symbol: 'FRA.DE', name: 'Fraport AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Airport Operator' },
  { symbol: 'G24.DE', name: 'Scout24 SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Online Marketplace' },
  { symbol: 'HEI.DE', name: 'Heidelberg Materials AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Building Materials' },
  { symbol: 'HLAG.DE', name: 'Hapag-Lloyd AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Shipping' },
  { symbol: 'HNR1.DE', name: 'Hannover Rueck SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Reinsurance' },
  { symbol: 'HOT.DE', name: 'HOT', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato HOT da Infinox — provável HOCHTIEF AG, identidade não confirmada' },
  { symbol: 'KBX.DE', name: 'Knorr-Bremse AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Braking Systems' },
  { symbol: 'KGX.DE', name: 'KION Group AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Industrial Equipment' },
  { symbol: 'KRN.DE', name: 'Krones AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Industrial Machinery' },
  { symbol: 'LEG.DE', name: 'LEG Immobilien SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Real Estate' },
  { symbol: 'MRCK.DE', name: 'Merck & Co Inc', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Pharmaceuticals — empresa americana, listada na Xetra sob esse código (distinta da Merck KGaA, MRK.DE, quebrada)' },
  { symbol: 'MTX.DE', name: 'MTU Aero Engines AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Aerospace' },
  { symbol: 'NEMD.DE', name: 'NEMD', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato NEMD da Infinox — provável Nemetschek SE, identidade não confirmada' },
  { symbol: 'PUM.DE', name: 'Puma SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Sporting Goods' },
  { symbol: 'RAA.DE', name: 'RAA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Contrato RAA da Infinox — provável Rational AG, identidade não confirmada' },
  { symbol: 'RRTL.DE', name: 'RTL Group SA', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Media & Broadcasting' },
  { symbol: 'SHL.DE', name: 'Siemens Healthineers AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Medical Technology' },
  { symbol: 'SRT3.DE', name: 'Sartorius AG (ações preferenciais)', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Laboratory Equipment' },
  { symbol: 'SY1.DE', name: 'Symrise AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Fragrances & Flavors' },
  { symbol: 'TLX.DE', name: 'Talanx AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  { symbol: 'UTDI.DE', name: 'United Internet AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Internet Services' },
  { symbol: 'VNA.DE', name: 'Vonovia SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Real Estate' },
  // VOW (ações ordinárias) é um instrumento DISTINTO de VOW3 (preferenciais,
  // já existia) — mesma relação já vista em BTCUSD/XBNUSD.
  { symbol: 'VOW.DE', name: 'Volkswagen AG (ações ordinárias)', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Automobiles' },
  { symbol: 'ZAL.DE', name: 'Zalando SE', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'E-commerce Retail' },
  { symbol: 'DHL.DE', name: 'DHL Group AG', category: 'STOCKS', subCategory: 'German Stocks', icon: '🇩🇪', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Logistics — sucessora da Deutsche Post AG (DPW, quebrado)' },

  // ============================================================================
  // 🇪🇸 SPANISH STOCKS (IBEX 35) — adicionado 2026-07-16, lista do Cleber
  // ============================================================================
  { symbol: 'BBVA.MC', name: 'Banco Bilbao Vizcaya Argentaria SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'CABK.MC', name: 'CaixaBank SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'ELE.MC', name: 'Endesa SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Utilities' },
  { symbol: 'IBE.MC', name: 'Iberdrola SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Utilities' },
  { symbol: 'ITX.MC', name: 'Industria de Diseno Textil SA (Inditex)', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Retail' },
  { symbol: 'MAP.MC', name: 'Mapfre SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  { symbol: 'REP.MC', name: 'Repsol SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Oil & Gas' },
  { symbol: 'SAB.MC', name: 'Banco de Sabadell SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  // ✅ Santander: nome real na Infinox é o nome completo "SANTANDER", não o
  // ticker curto "SAN" — evita colisão com SAN.PA (Sanofi, já no catálogo
  // francês).
  { symbol: 'SANTANDER.MC', name: 'Banco Santander SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'TEF.MC', name: 'Telefonica SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Telecommunications' },
  { symbol: 'AENA.MC', name: 'Aena SME SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Airport Operator' },
  { symbol: 'AMS.MC', name: 'Amadeus IT Group SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Travel Technology' },
  { symbol: 'ANA.MC', name: 'Acciona SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Construction & Renewables' },
  { symbol: 'CLNX.MC', name: 'Cellnex Telecom SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Telecom Infrastructure' },
  { symbol: 'VIS.MC', name: 'Viscofan SA', category: 'STOCKS', subCategory: 'Spanish Stocks', icon: '🇪🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Food Packaging' },

  // ============================================================================
  // 🇵🇹 PORTUGUESE STOCKS (PSI 20) — adicionado 2026-07-16, lista do Cleber
  // ============================================================================
  { symbol: 'GALP.LS', name: 'Galp Energia SGPS SA', category: 'STOCKS', subCategory: 'Portuguese Stocks', icon: '🇵🇹', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 WET', description: 'Oil & Gas' },
  { symbol: 'SON.LS', name: 'Sonae SGPS SA', category: 'STOCKS', subCategory: 'Portuguese Stocks', icon: '🇵🇹', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '08:00-16:30 WET', description: 'Retail & Holdings' },

  // ============================================================================
  // 🇳🇱 DUTCH STOCKS (AEX) — adicionado 2026-07-16, lista do Cleber
  // ============================================================================
  { symbol: 'ABN.AS', name: 'ABN AMRO Bank NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'AGN.AS', name: 'Aegon NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  // AIR (Airbus SE, listagem holandesa — já existe AIR.PA na França):
  // confirmado HTTP 404 em várias variantes ('AIR', 'AIR.AS', 'AIR.PA',
  // 'AIRP') — não adicionado, aguardando o Cleber confirmar o nome real
  // dessa listagem específica no MT5 dele.
  { symbol: 'ASML.AS', name: 'ASML Holding NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Semiconductor Equipment' },
  { symbol: 'HEIA.AS', name: 'Heineken NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Beverages' },
  { symbol: 'INGA.AS', name: 'ING Groep NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 4, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Banking' },
  { symbol: 'MT.AS', name: 'ArcelorMittal SA', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Steel Manufacturing' },
  { symbol: 'PHIA.AS', name: 'Koninklijke Philips NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Healthcare Technology' },
  { symbol: 'UNA.AS', name: 'Unilever NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Consumer Goods' },
  { symbol: 'AALB.AS', name: 'Aalberts NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Industrial Equipment' },
  { symbol: 'ADYEN.AS', name: 'Adyen NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Payment Technology' },
  { symbol: 'AKZA.AS', name: 'Akzo Nobel NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Specialty Chemicals' },
  { symbol: 'ASM.AS', name: 'ASM International NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Semiconductor Equipment' },
  { symbol: 'ASRNL.AS', name: 'ASR Nederland NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  { symbol: 'IMCD.AS', name: 'IMCD NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Chemical Distribution' },
  { symbol: 'NN.AS', name: 'NN Group NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Insurance' },
  { symbol: 'PRX.AS', name: 'Prosus NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Internet & Technology Investments' },
  { symbol: 'RAND.AS', name: 'Randstad NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Staffing Services' },
  { symbol: 'VPK.AS', name: 'Koninklijke Vopak NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Tank Storage' },
  { symbol: 'WKL.AS', name: 'Wolters Kluwer NV', category: 'STOCKS', subCategory: 'Dutch Stocks', icon: '🇳🇱', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:00-17:30 CET', description: 'Publishing & Software' },

  // ============================================================================
  // 🇺🇸 US STOCKS — não negociáveis via Infinox/MetaAPI (confirmado 404 em
  // auditoria, ver scripts/audit-broker-symbols.mjs); exibidos com dado real
  // via Yahoo Finance (rota /real/yahoo/:symbol) em vez de removidos da lista.
  // ============================================================================
  { symbol: 'AAPL', name: 'Apple', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Apple' },
  { symbol: 'ABBV', name: 'AbbVie', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'AbbVie' },
  { symbol: 'ABNB', name: 'Airbnb', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Airbnb' },
  { symbol: 'ACN', name: 'Accenture', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Accenture' },
  { symbol: 'ADBE', name: 'Adobe', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Adobe' },
  { symbol: 'ADI', name: 'Analog Devices', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Analog Devices' },
  { symbol: 'ADP', name: 'Automatic Data Processing', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Automatic Data Processing' },
  { symbol: 'AMGN', name: 'Amgen', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Amgen' },
  { symbol: 'AMT', name: 'American Tower', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'American Tower' },
  { symbol: 'AMZN', name: 'Amazon', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Amazon' },
  { symbol: 'ASML', name: 'ASML', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'ASML' },
  { symbol: 'AVGO', name: 'Broadcom', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Broadcom' },
  { symbol: 'AXP', name: 'American Express', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'American Express' },
  { symbol: 'BA', name: 'Boeing', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Boeing' },
  { symbol: 'BABA', name: 'Alibaba', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Alibaba' },
  { symbol: 'BAC', name: 'Bank of America', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Bank of America' },
  { symbol: 'BLK', name: 'BlackRock', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'BlackRock' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Bristol-Myers Squibb' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway B', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Berkshire Hathaway B' },
  { symbol: 'C', name: 'Citigroup', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Citigroup' },
  { symbol: 'CAT', name: 'Caterpillar', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Caterpillar' },
  { symbol: 'CHTR', name: 'Charter Communications', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Charter Communications' },
  { symbol: 'CL', name: 'Colgate-Palmolive', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Colgate-Palmolive' },
  { symbol: 'CMCSA', name: 'Comcast', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Comcast' },
  { symbol: 'COST', name: 'Costco', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Costco' },
  { symbol: 'CRM', name: 'Salesforce', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Salesforce' },
  { symbol: 'CSCO', name: 'Cisco', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Cisco' },
  { symbol: 'CVS', name: 'CVS Health', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'CVS Health' },
  { symbol: 'CVX', name: 'Chevron', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Chevron' },
  { symbol: 'DHR', name: 'Danaher', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Danaher' },
  { symbol: 'DIS', name: 'Disney', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Disney' },
  { symbol: 'EBAY', name: 'eBay', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'eBay' },
  { symbol: 'F', name: 'Ford', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Ford' },
  { symbol: 'FB', name: 'Meta (Facebook)', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Meta (Facebook)' },
  { symbol: 'FDX', name: 'FedEx', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'FedEx' },
  { symbol: 'GE', name: 'General Electric', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'General Electric' },
  { symbol: 'GILD', name: 'Gilead Sciences', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Gilead Sciences' },
  { symbol: 'GM', name: 'General Motors', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'General Motors' },
  { symbol: 'GOOG', name: 'Alphabet (Google) C', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Alphabet (Google) C' },
  { symbol: 'GOOGL', name: 'Alphabet (Google) A', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Alphabet (Google) A' },
  { symbol: 'GS', name: 'Goldman Sachs', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Goldman Sachs' },
  { symbol: 'HD', name: 'Home Depot', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Home Depot' },
  { symbol: 'HON', name: 'Honeywell', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Honeywell' },
  { symbol: 'IBM', name: 'IBM', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'IBM' },
  { symbol: 'INTC', name: 'Intel', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Intel' },
  { symbol: 'INTU', name: 'Intuit', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Intuit' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Johnson & Johnson' },
  { symbol: 'JPM', name: 'JPMorgan Chase', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'JPMorgan Chase' },
  { symbol: 'KO', name: 'Coca-Cola', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Coca-Cola' },
  { symbol: 'LIN', name: 'Linde', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Linde' },
  { symbol: 'LLY', name: 'Eli Lilly', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Eli Lilly' },
  { symbol: 'LMT', name: 'Lockheed Martin', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Lockheed Martin' },
  { symbol: 'LOW', name: 'Lowe\'s', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Lowe\'s' },
  { symbol: 'MA', name: 'Mastercard', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Mastercard' },
  { symbol: 'MCD', name: 'McDonald\'s', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'McDonald\'s' },
  { symbol: 'MDLZ', name: 'Mondelez', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Mondelez' },
  { symbol: 'MDT', name: 'Medtronic', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Medtronic' },
  { symbol: 'META', name: 'Meta Platforms', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Meta Platforms' },
  { symbol: 'MO', name: 'Altria', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Altria' },
  { symbol: 'MRK', name: 'Merck', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Merck' },
  { symbol: 'MS', name: 'Morgan Stanley', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Morgan Stanley' },
  { symbol: 'MSFT', name: 'Microsoft', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Microsoft' },
  { symbol: 'NFLX', name: 'Netflix', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Netflix' },
  { symbol: 'NKE', name: 'Nike', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Nike' },
  { symbol: 'NVDA', name: 'NVIDIA', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'NVIDIA' },
  { symbol: 'ORCL', name: 'Oracle', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Oracle' },
  { symbol: 'PEP', name: 'PepsiCo', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'PepsiCo' },
  { symbol: 'PFE', name: 'Pfizer', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Pfizer' },
  { symbol: 'PG', name: 'Procter & Gamble', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Procter & Gamble' },
  { symbol: 'PM', name: 'Philip Morris', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Philip Morris' },
  { symbol: 'PYPL', name: 'PayPal', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'PayPal' },
  { symbol: 'QCOM', name: 'Qualcomm', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Qualcomm' },
  { symbol: 'RTX', name: 'Raytheon Technologies', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Raytheon Technologies' },
  { symbol: 'SBUX', name: 'Starbucks', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Starbucks' },
  { symbol: 'SHOP', name: 'Shopify', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Shopify' },
  { symbol: 'SLB', name: 'Schlumberger', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Schlumberger' },
  { symbol: 'SO', name: 'Southern Company', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Southern Company' },
  { symbol: 'SPG', name: 'Simon Property Group', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Simon Property Group' },
  { symbol: 'SQ', name: 'Block (Square)', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Block (Square)' },
  { symbol: 'T', name: 'AT&T', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'AT&T' },
  { symbol: 'TGT', name: 'Target', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Target' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Thermo Fisher Scientific' },
  { symbol: 'TMUS', name: 'T-Mobile', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'T-Mobile' },
  { symbol: 'TSLA', name: 'Tesla', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Tesla' },
  { symbol: 'TXN', name: 'Texas Instruments', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Texas Instruments' },
  { symbol: 'UNH', name: 'UnitedHealth', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'UnitedHealth' },
  { symbol: 'UNP', name: 'Union Pacific', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Union Pacific' },
  { symbol: 'UPS', name: 'UPS', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'UPS' },
  { symbol: 'USB', name: 'U.S. Bancorp', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'U.S. Bancorp' },
  { symbol: 'V', name: 'Visa', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Visa' },
  { symbol: 'VZ', name: 'Verizon', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Verizon' },
  { symbol: 'WFC', name: 'Wells Fargo', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Wells Fargo' },
  { symbol: 'WMT', name: 'Walmart', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Walmart' },
  { symbol: 'XOM', name: 'Exxon Mobil', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Exxon Mobil' },
  { symbol: 'ZM', name: 'Zoom', category: 'STOCKS', subCategory: 'US Stocks', icon: '🇺🇸', precision: 2, lotSize: 1, minLot: 1, maxLot: 10000, leverage: 20, tradingHours: '09:30-16:00 ET', description: 'Zoom' },

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
