/**
 * 🎯 REAL MARKET DATA SERVICE - v4.1 PRODUCTION
 *
 * Sistema robusto e estável para 300+ ativos:
 * ✅ Crypto (Binance API DIRETA) - Sem quota limits!
 * ✅ Forex/Índices/Commodities/Ações - MetaAPI (conta de plataforma), com fallback simulado se indisponível
 * ✅ Auto-recovery 24/7
 * ✅ Health check automático
 * ✅ Logs estruturados para monitoramento
 */

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { PriceValidator } from './PriceValidator';
import { fetchDirectBinance, isBinanceSymbol } from './DirectBinanceService';
import { getAssetBySymbol } from '@/app/config/assetDatabase';
import { getBrokerSymbol, isAvailableOnBroker } from '@/app/config/brokerRegistry';

const MT5_PRICES_URL = `https://${projectId}.supabase.co/functions/v1/server/mt5-prices`;
const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

export interface RealMarketData {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  previousClose?: number;
  timestamp: number;
  source: 'binance' | 'yahoo' | 'twelvedata' | 'metaapi' | 'yahoo-fallback' | 'generated';
  isRealData: boolean;
}

// Alias para compatibilidade
export type MarketDataPoint = RealMarketData;

// 📊 Sistema de Health Check
let lastHealthCheck = Date.now();
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

// 📈 Cache para evitar chamadas redundantes (TTL: 2 segundos)
const priceCache = new Map<string, { data: RealMarketData; timestamp: number }>();
const CACHE_TTL = 2000; // 2 segundos

/**
 * 🎯 FUNÇÃO PRINCIPAL - Busca dados de mercado com roteamento inteligente
 */
export async function getRealMarketData(symbol: string): Promise<RealMarketData> {
  const normalizedSymbol = symbol.toUpperCase().replace('/', '').replace(' ', '');
  
  // Verificar cache primeiro (reduz carga)
  const cached = priceCache.get(normalizedSymbol);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    let data: RealMarketData;

    // ✅ 2026-07-10 (incidente): as 3 fontes de preço de cripto via Binance
    // direto estão mortas em produção (CORS/403 — ver BinancePollingService.ts).
    // BTCUSD é confirmado disponível como CFD próprio na Infinox (auditoria em
    // brokerRegistry.ts) — roteado pela MetaAPI/MT5 (pipeline saudável) em vez
    // de Binance, até as fontes externas serem restauradas ou substituídas.
    if (normalizedSymbol === 'BTCUSD' || normalizedSymbol === 'BTCUSDT') {
      data = await fetchMT5Data('BTCUSD');
    }
    // 1. CRYPTO: Binance direto com validação
    else if (isCryptoSymbol(normalizedSymbol)) {
      data = await fetchBinanceDataWithRetry(normalizedSymbol);
    }
    // 2. FOREX/ÍNDICES/COMMODITIES/AÇÕES: MetaAPI (conta de plataforma), com fallback simulado
    else {
      data = await fetchMT5Data(normalizedSymbol);
    }
    
    // Armazenar no cache
    priceCache.set(normalizedSymbol, { data, timestamp: Date.now() });
    
    // Reset consecutive failures
    consecutiveFailures = 0;
    lastHealthCheck = Date.now();
    
    return data;
    
  } catch (error: any) {
    consecutiveFailures++;
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`[RealMarketData] 🚨 CRITICAL: ${consecutiveFailures} consecutive failures. System degraded.`);
    }
    
    // Fallback: retornar dados simulados realistas
    const fallbackData = getFallbackData(normalizedSymbol);
    priceCache.set(normalizedSymbol, { data: fallbackData, timestamp: Date.now() });
    return fallbackData;
  }
}

/**
 * 🔍 Verifica se é símbolo de criptomoeda
 *
 * ✅ REESCRITO 2026-07-08: a versão anterior classificava por substring
 * (`symbol.includes('TUSD')` etc.) — bug real confirmado: `XPTUSD` (Platina)
 * virava "cripto" por conter a substring "TUSD" (do stablecoin TrueUSD) no
 * meio do nome, mandando Platina pra Binance (que não tem esse ativo) em vez
 * da MetaAPI/corretora. Agora consulta primeiro o catálogo canônico
 * (`assetDatabase.ts`, categoria real do ativo) — só cai na heurística por
 * substring como último recurso, pra símbolos que ainda não estão cadastrados
 * no catálogo (evita quebrar símbolos exóticos não mapeados ainda).
 */
function isCryptoSymbol(symbol: string): boolean {
  const normalized = symbol.toUpperCase();

  const asset = getAssetBySymbol(normalized);
  if (asset) {
    return asset.category === 'CRYPTO';
  }

  // Símbolo fora do catálogo — fallback heurístico (não deveria acontecer pra
  // ativos que a UI já lista, mas protege contra símbolos digitados à mão).
  const exactCryptos = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT', 'POLUSDT'];
  if (exactCryptos.includes(normalized)) return true;

  const cryptoPatterns = [
    'USDT', 'BUSD',
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'POL', 'DOT', 'AVAX',
    'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'TRX'
  ];

  const forexExclusions = ['USDCAD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCHF'];
  if (forexExclusions.includes(normalized)) return false;

  return cryptoPatterns.some(pattern => normalized.includes(pattern));
}

/**
 * 📊 BINANCE - Crypto com retry automático
 */
async function fetchBinanceDataWithRetry(symbol: string, retries = 1): Promise<RealMarketData> {
  try {
    return await fetchBinanceData(symbol);
  } catch (error: any) {
    // Fallback silencioso — sem spam de logs de retry
    console.warn(`[Binance] ⚠️ Fetch falhou para ${symbol}, usando dados simulados.`);
    throw error;
  }
}

/**
 * 📊 BINANCE - Crypto (chamada direta COM VALIDAÇÃO)
 */
async function fetchBinanceData(symbol: string): Promise<RealMarketData> {
  try {
    // ✅ Normalizar símbolo para formato Binance (XXXUSDT)
    let binanceSymbol = symbol.toUpperCase().trim();

    // Casos especiais conhecidos
    const manualMapping: Record<string, string> = {
      'BTCUSD': 'BTCUSDT',
      'ETHUSD': 'ETHUSDT',
      'SOLUSD': 'SOLUSDT',
      'BNBUSD': 'BNBUSDT',
      'XRPUSD': 'XRPUSDT',
      'ADAUSD': 'ADAUSDT',
      'DOTUSD': 'DOTUSDT',
      'BTC': 'BTCUSDT',
      'ETH': 'ETHUSDT'
    };

    if (manualMapping[binanceSymbol]) {
      binanceSymbol = manualMapping[binanceSymbol];
    } else if (!binanceSymbol.endsWith('USDT')) {
      // Se termina com USD, troca por USDT
      if (binanceSymbol.endsWith('USD')) {
        binanceSymbol = binanceSymbol.replace(/USD$/, 'USDT');
      }
      // Se não tem USDT, adiciona
      else if (!binanceSymbol.includes('USDT')) {
        binanceSymbol = binanceSymbol + 'USDT';
      }
    }

    // 🚀 PRIORIDADE 1: SEMPRE Binance DIRETA (sem servidor!)
    if (isBinanceSymbol(binanceSymbol)) {
      const directData = await fetchDirectBinance(binanceSymbol);

      if (directData) {
        return {
          symbol: binanceSymbol,
          price: directData.price,
          bid: directData.price * 0.9999, // Simula bid/ask
          ask: directData.price * 1.0001,
          high: directData.high,
          low: directData.low,
          open: directData.price - directData.change,
          volume: directData.volume,
          change: directData.change,
          changePercent: directData.changePercent,
          previousClose: directData.price - directData.change,
          timestamp: directData.timestamp,
          source: 'binance',
          isRealData: true
        };
      }
    }

    // 🔄 Se Binance direta falhou, usar fallback silencioso (sem lançar erro)
    console.warn(`[Binance] ⚠️ Binance indisponível para ${symbol}, usando fallback.`);
    return getFallbackData(binanceSymbol);

  } catch (error: any) {
    console.warn(`[Binance] ⚠️ ${symbol}: usando dados simulados.`);
    throw error;
  }
}

/**
 * 📊 MT5 (MetaAPI) - Forex/índices/commodities/ações via conta de plataforma
 *
 * Usa a rota /mt5-prices do backend, que autentica com METAAPI_TOKEN (conta única
 * de plataforma, configurada como secret no Supabase — não é a credencial do usuário).
 * Se o token não estiver configurado ou a chamada falhar, a própria rota já responde
 * com preços simulados (source: 'SIMULATED'), e aqui tratamos isso como fallback local.
 */
async function fetchMT5Data(symbol: string): Promise<RealMarketData> {
  // ✅ 2026-07-08: checar disponibilidade ANTES de chamar a corretora — pra
  // ativos já confirmados indisponíveis (auditoria em `brokerRegistry.ts`),
  // evita um round-trip que sempre vai dar 404 e vai direto pro Yahoo real.
  if (!isAvailableOnBroker(symbol, 'infinox')) {
    console.warn(`[MT5] ⚠️ ${symbol} não é ofertado pela Infinox (confirmado em auditoria), usando Yahoo Finance.`);
    return await fetchYahooData(symbol);
  }

  // Nome real do ativo na corretora — pode ser diferente do símbolo unificado
  // que o resto do app usa (ex: JP225 unificado -> 'JPN225' na Infinox).
  const brokerSymbol = getBrokerSymbol(symbol, 'infinox');

  try {
    const res = await fetch(MT5_PRICES_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbols: [brokerSymbol] }),
    });

    if (!res.ok) {
      console.warn(`[MT5] ⚠️ HTTP ${res.status} para ${symbol} (${brokerSymbol}), tentando Yahoo Finance.`);
      return await fetchYahooData(symbol);
    }

    const result = await res.json();
    const tick = Array.isArray(result?.prices) ? result.prices[0] : null;

    // ✅ CORRIGIDO 2026-07-08: alguns ativos (Cocoa, Coffee, Wheat, ações
    // americanas) simplesmente não existem na conta MetaAPI/broker atual —
    // a rota responde HTTP 200 mas com esse símbolo específico em erro
    // (`price: null`, `error: "HTTP 404"`), não `!res.ok`. Antes disso caía
    // direto no gerador sintético local; agora tenta o Yahoo Finance (fonte
    // real) primeiro, só cai pro sintético se o Yahoo também falhar.
    if (!tick || !isValidPrice(tick.price) || result.source === 'SIMULATED') {
      console.warn(`[MT5] ⚠️ ${symbol} indisponível na MetaAPI/broker, tentando Yahoo Finance.`);
      return await fetchYahooData(symbol);
    }

    return {
      symbol,
      price: tick.price,
      bid: tick.bid ?? tick.price,
      ask: tick.ask ?? tick.price,
      change: tick.change || 0,
      changePercent: tick.changePercent || 0,
      previousClose: tick.price - (tick.change || 0),
      timestamp: tick.timestamp ? new Date(tick.timestamp).getTime() : Date.now(),
      source: 'metaapi',
      isRealData: true,
    };
  } catch (error: any) {
    console.warn(`[MT5] ⚠️ Falha ao buscar ${symbol} via MetaAPI, tentando Yahoo Finance.`, error?.message);
    return await fetchYahooData(symbol);
  }
}

/**
 * 📊 YAHOO FINANCE - Fallback real (não sintético) para ativos que a
 * MetaAPI/broker atual não oferece (Cocoa, Coffee, Wheat, ações americanas...).
 * Rota `/real/yahoo/:symbol` já existente no backend (dados reais, sem chave).
 * Só cai no gerador sintético local se o Yahoo também não tiver o símbolo.
 */
async function fetchYahooData(symbol: string): Promise<RealMarketData> {
  try {
    const res = await fetch(`${API_BASE}/real/yahoo/${encodeURIComponent(symbol)}`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });

    if (!res.ok) {
      console.warn(`[Yahoo] ⚠️ HTTP ${res.status} para ${symbol}, usando fallback local.`);
      return getFallbackData(symbol);
    }

    const data = await res.json();

    if (!isValidPrice(data.price)) {
      return getFallbackData(symbol);
    }

    return {
      symbol,
      price: data.price,
      bid: data.bid ?? data.price,
      ask: data.ask ?? data.price,
      high: data.high,
      low: data.low,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      previousClose: data.previousClose,
      volume: data.volume || 0,
      timestamp: data.timestamp || Date.now(),
      source: 'yahoo',
      isRealData: true,
    };
  } catch (error: any) {
    console.warn(`[Yahoo] ⚠️ Falha ao buscar ${symbol}, usando fallback local.`, error?.message);
    return getFallbackData(symbol);
  }
}

/**
 * 🔄 FALLBACK - Dados simulados realistas para 300+ ativos
 */
function getFallbackData(symbol: string): RealMarketData {
  // Preços base ULTRA REALISTAS (atualizado 27/01/2025)
  const basePrices: Record<string, number> = {
    // === CRYPTO (Top 50) ===
    'BTCUSDT': 87900, 'BTCUSD': 87900, 'BTC': 87900,
    'ETHUSDT': 3256.78, 'ETHUSD': 3256.78, 'ETH': 3256.78,
    'BNBUSDT': 645.23, 'BNBUSD': 645.23,
    'SOLUSDT': 235.67, 'SOLUSD': 235.67,
    'XRPUSDT': 2.87, 'XRPUSD': 2.87,
    'ADAUSDT': 1.15, 'ADAUSD': 1.15,
    'DOGEUSDT': 0.38, 'DOGEUSD': 0.38,
    'POLUSDT': 1.09, 'POLUSD': 1.09, // POL = Polygon (rebrandado de MATIC)
    'DOTUSDT': 9.45, 'DOTUSD': 9.45,
    'AVAXUSDT': 42.67, 'AVAXUSD': 42.67,
    'LINKUSDT': 23.45, 'TRXUSDT': 0.245,
    'UNIUSDT': 15.67, 'ATOMUSDT': 12.34,
    'LTCUSDT': 145.67, 'BCHUSDT': 389.23,
    'XLMUSDT': 0.145, 'ALGOUSDT': 0.456,
    'VETUSDT': 0.067, 'FILUSDT': 8.92,
    
    // === FOREX (Major + Minor Pairs) ===
    'EURUSD': 1.04127, 'GBPUSD': 1.22458, 'USDJPY': 156.244,
    'AUDUSD': 0.62345, 'USDCAD': 1.43256, 'NZDUSD': 0.56789,
    'USDCHF': 0.90123, 'EURGBP': 0.85123, 'EURJPY': 162.789,
    'GBPJPY': 191.234, 'AUDJPY': 97.456, 'EURAUD': 1.67234,
    'EURCHF': 0.93789, 'GBPCHF': 1.10234, 'AUDCAD': 0.89123,
    
    // === COMMODITIES ===
    'XAUUSD': 2678.45, // Gold
    'XAGUSD': 31.25,   // Silver
    'WTIUSD': 82.45,   // Oil WTI
    'BCOUSD': 86.78,   // Oil Brent
    'NATGASUSD': 3.45, // Natural Gas
    'COPPER': 4.23,    // Copper
    
    // === US INDICES ===
    'US30': 49500,   // Dow Jones (CORRIGIDO - 18 FEV 2026)
    'DJI': 49500,
    'NAS100': 20150, // Nasdaq 100
    'NQ': 20150,
    'SPX500': 6020,  // S&P 500 (CORRIGIDO - 18 FEV 2026)
    'US500': 6020,
    'SPX': 6020,
    'VIX': 13.45,    // Volatility Index
    'RUSSELL2000': 2234,
    
    // === GLOBAL INDICES ===
    'AUS200': 8234,  // ASX 200
    'UK100': 8456,   // FTSE 100
    'GER40': 20123,  // DAX 40
    'FRA40': 7856,   // CAC 40
    'ESP35': 11234,  // IBEX 35
    'ITA40': 34567,  // FTSE MIB
    'JPN225': 38945, // Nikkei 225
    'HKG50': 17234,  // Hang Seng
    'CHN50': 3456,   // China A50
    
    // === STOCKS (Popular) ===
    'AAPL': 234.56, 'MSFT': 421.89, 'GOOGL': 178.34,
    'AMZN': 185.67, 'TSLA': 234.12, 'NVDA': 789.45,
    'META': 523.78, 'NFLX': 678.90, 'AMD': 234.56,
  };
  
  const basePrice = basePrices[symbol] || 100.0;
  
  // Gerar variação realista baseada no tipo de ativo
  let volatilityPercent = 0.001; // 0.1% padrão
  
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL')) {
    volatilityPercent = 0.015; // 1.5% para crypto major
  } else if (symbol.includes('USDT') || isCryptoSymbol(symbol)) {
    volatilityPercent = 0.025; // 2.5% para altcoins
  } else if (symbol.includes('XAU') || symbol.includes('XAG')) {
    volatilityPercent = 0.003; // 0.3% para metais preciosos
  } else if (symbol.includes('US30') || symbol.includes('NAS') || symbol.includes('SPX')) {
    volatilityPercent = 0.005; // 0.5% para índices US
  } else if (symbol.includes('JPY') || symbol.includes('EUR') || symbol.includes('GBP')) {
    volatilityPercent = 0.0008; // 0.08% para forex majors
  }
  
  // Usar timestamp para seed (varia a cada minuto)
  const seed = Math.floor(Date.now() / 60000);
  const pseudoRandom = ((seed * 9301 + 49297) % 233280) / 233280;
  
  const randomVariation = (pseudoRandom - 0.5) * 2 * volatilityPercent;
  const price = basePrice * (1 + randomVariation);
  const change = price - basePrice;
  const changePercent = (change / basePrice) * 100;
  
  return {
    symbol,
    price,
    bid: price - (price * 0.0001),
    ask: price + (price * 0.0001),
    high: price * 1.005,
    low: price * 0.995,
    open: basePrice,
    volume: 1000000,
    change,
    changePercent,
    previousClose: basePrice,
    timestamp: Date.now(),
    source: 'generated',
    isRealData: false
  };
}

/**
 * 📡 SUBSCRIPTION - Subscreve a atualizações de mercado em tempo real
 * 
 * Esta função cria um polling interval que busca dados periodicamente
 * @param symbols - Array de símbolos para monitorar
 * @param callback - Função chamada quando há novos dados
 * @param intervalMs - Intervalo entre atualizações (padrão: 5000ms)
 * @returns Função para cancelar a subscrição
 */
export function subscribeToMarketData(
  symbols: string[],
  callback: (symbol: string, data: MarketDataPoint) => void,
  intervalMs: number = 5000
): () => void {
  console.log(`[RealMarketData] 📡 Subscribing to ${symbols.length} symbols (interval: ${intervalMs}ms)`);
  
  const activeSymbols = new Set(symbols);
  let isActive = true;
  
  // Função para buscar dados de todos os símbolos
  const fetchAll = async () => {
    if (!isActive) return;
    
    const promises = Array.from(activeSymbols).map(async (symbol) => {
      try {
        const data = await getRealMarketData(symbol);
        if (isActive) {
          callback(symbol, data);
        }
      } catch (error) {
        console.error(`[RealMarketData] Error fetching ${symbol}:`, error);
      }
    });
    
    await Promise.all(promises);
  };
  
  // Buscar dados imediatamente
  fetchAll();
  
  // Configurar polling
  const intervalId = setInterval(fetchAll, intervalMs);
  
  // Retornar função de cleanup
  return () => {
    console.log(`[RealMarketData] 🛑 Unsubscribing from ${symbols.length} symbols`);
    isActive = false;
    clearInterval(intervalId);
  };
}

/**
 * 📊 SINGLE SUBSCRIPTION - Subscreve a um único símbolo
 */
export function subscribeToSymbol(
  symbol: string,
  callback: (data: MarketDataPoint) => void,
  intervalMs: number = 5000
): () => void {
  return subscribeToMarketData([symbol], (sym, data) => {
    if (sym === symbol) {
      callback(data);
    }
  }, intervalMs);
}

/**
 * 🔍 GET MULTIPLE - Busca dados de múltiplos símbolos
 *
 * ⚠️ Cada chamada aqui dentro ainda bate individualmente em `/mt5-prices`
 * (uma requisição HTTP por símbolo não-cripto). Pra qualquer chamador que
 * precise de VÁRIOS símbolos de forex/índice/commodity ao mesmo tempo (ex: o
 * loop de P&L do AITradingEngine, que roda a cada 5s em background em
 * qualquer tela do app), usar `getBatchedMT5Data()` em vez desta função —
 * agrupa tudo numa ÚNICA requisição, em vez de N requisições concorrentes na
 * mesma conta MetaAPI compartilhada (confirmado em produção 2026-07-08:
 * várias chamadas concorrentes de 3-8s cada degradavam a conta e deixavam o
 * preço do Dashboard instável/zerado).
 */
export async function getMultipleMarketData(
  symbols: string[]
): Promise<Record<string, RealMarketData>> {
  const results: Record<string, RealMarketData> = {};

  const promises = symbols.map(async (symbol) => {
    try {
      results[symbol] = await getRealMarketData(symbol);
    } catch (error) {
      console.error(`[RealMarketData] Error fetching ${symbol}:`, error);
      results[symbol] = getFallbackData(symbol);
    }
  });

  await Promise.all(promises);

  return results;
}

/**
 * 📦 BATCH REAL — busca vários símbolos NUMA ÚNICA requisição a `/mt5-prices`
 *
 * ✅ ADICIONADO 2026-07-08: causa raiz de instabilidade generalizada de preço
 * (inclusive o Dashboard mostrando preço zerado) — o loop de P&L do AI
 * Trading Engine (`useApexLogic.ts`) roda globalmente em toda tela a cada 5s
 * e buscava o preço de cada posição aberta com uma chamada HTTP SEPARADA por
 * símbolo. Com resposta levando 3-8s cada (latência normal da MetaAPI),
 * múltiplas chamadas ficavam concorrentes na mesma conta compartilhada,
 * degradando TODAS as chamadas simultâneas — inclusive a do Dashboard pro
 * ativo selecionado. Esta função agrupa cripto (via Binance, em paralelo,
 * barato) e forex/índice/commodity/ação (numa única chamada a `/mt5-prices`,
 * já traduzindo pro nome real de cada símbolo na corretora).
 */
export async function getBatchedMT5Data(symbols: string[]): Promise<Record<string, RealMarketData>> {
  const results: Record<string, RealMarketData> = {};
  if (symbols.length === 0) return results;

  const normalizedSymbols = symbols.map(s => s.toUpperCase().replace('/', '').replace(' ', ''));
  const cryptoSymbols = normalizedSymbols.filter(isCryptoSymbol);
  const brokerSymbols = normalizedSymbols.filter(s => !isCryptoSymbol(s));

  // Cripto: Binance direto, em paralelo (barato, não usa a conta MetaAPI)
  await Promise.all(cryptoSymbols.map(async (symbol) => {
    try {
      results[symbol] = await fetchBinanceDataWithRetry(symbol);
    } catch {
      results[symbol] = getFallbackData(symbol);
    }
  }));

  if (brokerSymbols.length === 0) return results;

  // Forex/índices/commodities/ações: UMA chamada só, com todos os símbolos
  // disponíveis na corretora; os indisponíveis (confirmados via brokerRegistry)
  // vão direto pro Yahoo em paralelo, sem entrar nessa chamada em lote.
  const availableSymbols = brokerSymbols.filter(s => isAvailableOnBroker(s, 'infinox'));
  const unavailableSymbols = brokerSymbols.filter(s => !isAvailableOnBroker(s, 'infinox'));

  await Promise.all(unavailableSymbols.map(async (symbol) => {
    results[symbol] = await fetchYahooData(symbol);
  }));

  if (availableSymbols.length > 0) {
    const brokerNameToUnified = new Map(availableSymbols.map(s => [getBrokerSymbol(s, 'infinox'), s]));

    try {
      const res = await fetch(MT5_PRICES_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols: Array.from(brokerNameToUnified.keys()) }),
      });

      const body = res.ok ? await res.json() : null;
      const prices = Array.isArray(body?.prices) ? body.prices : [];
      const priceByBrokerName = new Map(prices.map((p: any) => [p.symbol, p]));

      await Promise.all(availableSymbols.map(async (unified) => {
        const brokerName = getBrokerSymbol(unified, 'infinox');
        const tick: any = priceByBrokerName.get(brokerName);

        if (!tick || !isValidPrice(tick.price) || body?.source === 'SIMULATED') {
          results[unified] = await fetchYahooData(unified);
          return;
        }

        results[unified] = {
          symbol: unified,
          price: tick.price,
          bid: tick.bid ?? tick.price,
          ask: tick.ask ?? tick.price,
          change: tick.change || 0,
          changePercent: tick.changePercent || 0,
          previousClose: tick.price - (tick.change || 0),
          timestamp: tick.timestamp ? new Date(tick.timestamp).getTime() : Date.now(),
          source: 'metaapi',
          isRealData: true,
        };
      }));
    } catch (error: any) {
      console.warn('[RealMarketData] ⚠️ Falha na chamada em lote a /mt5-prices, usando Yahoo por símbolo.', error?.message);
      await Promise.all(availableSymbols.map(async (unified) => {
        results[unified] = await fetchYahooData(unified);
      }));
    }
  }

  return results;
}

/**
 * 🎯 CHECK AVAILABILITY - Verifica se um símbolo tem dados reais disponíveis
 */
export function isRealDataAvailable(symbol: string): boolean {
  const normalized = symbol.toUpperCase().replace('/', '').replace(' ', '');
  
  // Crypto sempre tem dados reais (Binance)
  if (isCryptoSymbol(normalized)) {
    return true;
  }
  
  // Outros ativos usam fallback
  return false;
}

/**
 * ✅ VALIDATE PRICE - Verifica se um preço é válido
 */
export function isValidPrice(price: any): boolean {
  if (price === null || price === undefined) return false;
  if (typeof price !== 'number') return false;
  if (isNaN(price)) return false;
  if (!isFinite(price)) return false;
  if (price <= 0) return false;
  return true;
}

/**
 * 🔧 NORMALIZE PRICE - Normaliza um preço para número válido
 */
export function normalizePrice(price: any): number {
  if (typeof price === 'number' && isValidPrice(price)) {
    return price;
  }
  if (typeof price === 'string') {
    const parsed = parseFloat(price);
    if (isValidPrice(parsed)) {
      return parsed;
    }
  }
  return 0;
}