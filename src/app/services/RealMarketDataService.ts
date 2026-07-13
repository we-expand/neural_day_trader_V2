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
import { getBrokerSymbol, isAvailableOnBroker, isCryptoCfdAvailable } from '@/app/config/brokerRegistry';

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
 * 🕐 ÚLTIMO PREÇO REAL CONHECIDO — não expira (dura a sessão do navegador).
 *
 * ✅ 2026-07-11: Cleber reportou ativos "oscilando de correto pra errado"
 * (ex: EURJPY) — causa raiz: qualquer falha transitória (rate limit da
 * conta MetaAPI compartilhada, timeout) fazia o preço cair DIRETO pro
 * gerador sintético local, então a UI ficava alternando entre o preço real
 * (quando a chamada tinha sucesso) e um valor fake plausível mas errado
 * (quando falhava) — a cada ciclo de polling. Esse cache guarda o último
 * preço REAL (`isRealData: true`) de cada símbolo; em caso de falha, usamos
 * esse valor em vez do sintético — o preço fica "parado" no último real
 * conhecido (correto, só desatualizado) em vez de errado. Também deixa a
 * troca de ativo mais rápida percebida: ao selecionar um símbolo já visto
 * nesta sessão, a tela pode mostrar esse valor imediatamente em vez de
 * zerar e esperar o round-trip da rede.
 */
const lastRealPriceCache = new Map<string, RealMarketData>();

/**
 * ✅ 2026-07-11 (2ª parte): Cleber reportou NZDUSD/GBPNZD (e confirmou que
 * deveria acontecer com outros) oscilando a variação diária entre 0% e o
 * valor correto a cada polling — causa raiz diferente da anterior: aqui o
 * PREÇO chega certo (`/mt5-prices` responde HTTP 200 com `price` válido),
 * mas a busca do candle D1 (usada só pra calcular `change`/`changePercent`,
 * uma chamada separada no backend) falha nesse ciclo específico (mesmo
 * congestionamento da conta MetaAPI compartilhada) — o backend já cai pra
 * `change: 0, changePercent: 0` como default nesse caso (ver
 * `supabase/functions/server/index.ts`, rota `/mt5-prices`), indistinguível
 * de um dia genuinamente parado. Sem sinal explícito do backend, a defesa
 * possível no frontend: se a variação chegar EXATAMENTE zerada mas já
 * tínhamos uma variação real (não-zero) recente pra esse símbolo, mantém a
 * variação anterior (o preço novo ainda é usado) em vez de piscar pra 0% —
 * evita a oscilação visual. Não é infalível (um ativo genuinamente parado
 * também teria os dois zerados), mas 0.00000% exato é raro o bastante pra
 * ser um sinal melhor de "falha no candle" do que de "mercado parado".
 */
function rememberIfReal(data: RealMarketData): RealMarketData {
  if (!data.isRealData) return data;

  const suspiciousZeroChange = data.change === 0 && data.changePercent === 0;
  if (suspiciousZeroChange) {
    const previous = lastRealPriceCache.get(data.symbol);
    if (previous && (previous.change !== 0 || previous.changePercent !== 0)) {
      data = { ...data, change: previous.change, changePercent: previous.changePercent };
    }
  }

  lastRealPriceCache.set(data.symbol, data);
  return data;
}

/**
 * Fallback em caso de falha: usa o último preço REAL conhecido desse símbolo
 * (ainda que desatualizado) em vez de cair direto pro gerador sintético —
 * evita a oscilação "correto -> fake -> correto -> fake" a cada polling.
 *
 * ✅ CORRIGIDO 2026-07-11 (4ª parte): quando este símbolo NUNCA teve um preço
 * real nesta sessão (primeira vez que é selecionado), o código antigo caía no
 * gerador sintético (`getFallbackData`) — um preço INVENTADO (ex: EURCAD, que
 * não tem entrada na tabela de preços-base, virava $100.00 fixo com variação
 * aleatória) exibido na tela com a MESMA aparência de um preço real, sem
 * nenhum aviso. Cleber reportou exatamente isso: abriu EURCAD, viu preço e
 * variação "totalmente errados", e no ciclo de polling seguinte (2s depois)
 * corrigiu sozinho — sintoma clássico de fallback sintético mascarando uma
 * falha transitória (comum logo após reconectar a conta real, primeira
 * chamada ainda "aquecendo"). Pra dado financeiro, nunca é aceitável mostrar
 * um número inventado com a mesma confiança visual de um número real — agora,
 * sem preço real conhecido, retorna um estado explícito "sem dado ainda"
 * (price: 0, isRealData: false) — a tela deve tratar isso como "carregando",
 * nunca como um preço válido.
 */
function getFallbackOrLastKnown(symbol: string): RealMarketData {
  const lastKnown = lastRealPriceCache.get(symbol);
  if (lastKnown) return lastKnown;
  return {
    symbol,
    price: 0,
    change: 0,
    changePercent: 0,
    timestamp: Date.now(),
    source: 'generated',
    isRealData: false,
  };
}

/**
 * Pra troca instantânea de ativo: último preço real conhecido desse símbolo
 * nesta sessão, se houver (usado pra popular a tela sem esperar o fetch).
 */
export function getLastKnownRealPrice(symbol: string): RealMarketData | undefined {
  return lastRealPriceCache.get(symbol.toUpperCase().replace('/', '').replace(' ', ''));
}

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

    // ✅ 2026-07-10 (incidente), estendido 2026-07-11: as 3 fontes de preço de
    // cripto via Binance direto estão mortas em produção (CORS/403 — ver
    // BinancePollingService.ts). Cripto com CFD confirmado na Infinox
    // (auditoria em brokerRegistry.ts: BTC, SOL, BNB, XRP, ADA, DOT) roteia
    // pela MetaAPI/MT5 (pipeline saudável) em vez de Binance, até as fontes
    // externas serem restauradas ou substituídas.
    if (isCryptoSymbol(normalizedSymbol) && shouldRouteCryptoViaBroker(normalizedSymbol)) {
      data = await fetchMT5Data(toUnifiedCryptoSymbol(normalizedSymbol));
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
    rememberIfReal(data);
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

    // Fallback: último preço real conhecido, se houver; senão, sintético
    const fallbackData = getFallbackOrLastKnown(normalizedSymbol);
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
/**
 * Normaliza uma cripto pro formato unificado USD (BTCUSDT/BTC/BTCUSD -> BTCUSD)
 * pra checar contra `isCryptoCfdAvailable`, que guarda os símbolos auditados
 * no formato do catálogo canônico.
 */
function toUnifiedCryptoSymbol(symbol: string): string {
  if (symbol.endsWith('USDT')) return symbol.slice(0, -1); // USDT -> USD
  if (symbol.endsWith('USD')) return symbol;
  return `${symbol}USD`;
}

/**
 * Essa cripto deve rotear pela MetaAPI/corretora (CFD auditado, pipeline
 * saudável) em vez da Binance direta (as 3 fontes estão mortas em produção
 * desde 2026-07-10, ver `brokerRegistry.ts`)?
 */
function shouldRouteCryptoViaBroker(symbol: string): boolean {
  return isCryptoCfdAvailable(toUnifiedCryptoSymbol(symbol), 'infinox');
}

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
        return rememberIfReal({
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
        });
      }
    }

    // 🔄 Se Binance direta falhou, usar fallback silencioso (sem lançar erro)
    console.warn(`[Binance] ⚠️ Binance indisponível para ${symbol}, usando fallback.`);
    return getFallbackOrLastKnown(binanceSymbol);

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

    return rememberIfReal({
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
    });
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
      return getFallbackOrLastKnown(symbol);
    }

    const data = await res.json();

    if (!isValidPrice(data.price)) {
      return getFallbackOrLastKnown(symbol);
    }

    // ✅ 2026-07-13: rede de segurança contra ticker do Yahoo errado/ausente no
    // mapa do backend (achado real: XPTUSD/XPDUSD caíam no ticker literal
    // "XPTUSD"/"XPDUSD", que não existe no Yahoo — quando não dava erro
    // limpo, podia devolver preço de outro instrumento, sintoma relatado como
    // "oscila entre preço certo e completamente errado"). Se o preço desviar
    // mais de 20% do último preço REAL conhecido desse símbolo, é mais
    // provável ser ticker errado do que um movimento real — descarta e usa o
    // último preço real conhecido em vez de arriscar mostrar dado de outro
    // ativo com a mesma confiança visual de um preço real.
    const lastKnown = lastRealPriceCache.get(symbol);
    if (lastKnown && lastKnown.isRealData && lastKnown.price > 0) {
      const deviation = Math.abs(data.price - lastKnown.price) / lastKnown.price;
      if (deviation > 0.20) {
        console.warn(`[Yahoo] ⚠️ Preço de ${symbol} desviou ${(deviation * 100).toFixed(1)}% do último real conhecido (possível ticker errado) — mantendo último preço real.`, { recebido: data.price, ultimoReal: lastKnown.price });
        return lastKnown;
      }
    }

    return rememberIfReal({
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
    });
  } catch (error: any) {
    console.warn(`[Yahoo] ⚠️ Falha ao buscar ${symbol}, usando fallback local.`, error?.message);
    return getFallbackOrLastKnown(symbol);
  }
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
      results[symbol] = getFallbackOrLastKnown(symbol);
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
  // Cripto com CFD confirmado na Infinox (BTC/SOL/BNB/XRP/ADA/DOT) entra no
  // lote da corretora, igual forex/índices — as 3 fontes de Binance direta
  // estão mortas em produção (ver brokerRegistry.ts). As demais cripto
  // continuam na Binance (sem alternativa confirmada ainda).
  const cryptoSymbols = normalizedSymbols.filter(s => isCryptoSymbol(s) && !shouldRouteCryptoViaBroker(s));
  const brokerSymbols = normalizedSymbols
    .filter(s => !isCryptoSymbol(s) || shouldRouteCryptoViaBroker(s))
    .map(s => isCryptoSymbol(s) ? toUnifiedCryptoSymbol(s) : s);

  // Cripto sem CFD na corretora: Binance direto, em paralelo (barato, não usa a conta MetaAPI)
  await Promise.all(cryptoSymbols.map(async (symbol) => {
    try {
      results[symbol] = await fetchBinanceDataWithRetry(symbol);
    } catch {
      results[symbol] = getFallbackOrLastKnown(symbol);
    }
  }));

  if (brokerSymbols.length === 0) return results;

  // Forex/índices/commodities/ações/cripto-com-CFD: UMA chamada só, com todos
  // os símbolos disponíveis na corretora; os indisponíveis (confirmados via
  // brokerRegistry) vão direto pro Yahoo em paralelo, sem entrar no lote.
  const availableSymbols = brokerSymbols.filter(s => isAvailableOnBroker(s, 'infinox'));
  const unavailableSymbols = brokerSymbols.filter(s => !isAvailableOnBroker(s, 'infinox'));

  await Promise.all(unavailableSymbols.map(async (symbol) => {
    results[symbol] = await fetchYahooData(symbol);
  }));

  if (availableSymbols.length > 0) {
    // ✅ 2026-07-11: mandar TODOS os símbolos disponíveis (podem passar de 200,
    // ex. lista completa do InfinoxAssetsBrowser) numa única requisição rate-
    // limitava a conta MetaAPI compartilhada — confirmado via teste direto:
    // 207 símbolos numa chamada só, só 48 respondem com preço real, 139 vêm
    // HTTP 429. O resto caía no Yahoo por símbolo (Promise.all de ~190
    // chamadas em paralelo) e, sem mapeamento pra maioria dos pares/ações,
    // acabava tudo no gerador sintético local — o "preço fake repetido"
    // (~$99.90) em dezenas de ativos sem relação nenhuma entre si. Fix:
    // mesmo padrão de lotes pequenos que `scripts/audit-broker-symbols.mjs`
    // já usa (chunks de 40, com pausa entre eles) pra não sobrecarregar a
    // conta compartilhada.
    const CHUNK_SIZE = 40;
    const DELAY_BETWEEN_CHUNKS_MS = 500;

    const brokerNames = availableSymbols.map(s => getBrokerSymbol(s, 'infinox'));
    const priceByBrokerName = new Map<string, any>();
    let anyChunkSucceeded = false;

    for (let i = 0; i < brokerNames.length; i += CHUNK_SIZE) {
      const chunk = brokerNames.slice(i, i + CHUNK_SIZE);

      try {
        const res = await fetch(MT5_PRICES_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbols: chunk }),
        });

        const body = res.ok ? await res.json() : null;
        const prices = Array.isArray(body?.prices) ? body.prices : [];
        prices.forEach((p: any) => priceByBrokerName.set(p.symbol, p));
        if (prices.length > 0) anyChunkSucceeded = true;
      } catch (error: any) {
        console.warn('[RealMarketData] ⚠️ Falha num lote de /mt5-prices, símbolos desse lote vão pro Yahoo.', error?.message);
      }

      if (i + CHUNK_SIZE < brokerNames.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));
      }
    }

    if (!anyChunkSucceeded) {
      console.warn('[RealMarketData] ⚠️ Nenhum lote de /mt5-prices respondeu, usando Yahoo por símbolo.');
    }

    await Promise.all(availableSymbols.map(async (unified) => {
      const brokerName = getBrokerSymbol(unified, 'infinox');
      const tick = priceByBrokerName.get(brokerName);

      if (!tick || !isValidPrice(tick.price)) {
        results[unified] = await fetchYahooData(unified);
        return;
      }

      results[unified] = rememberIfReal({
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
      });
    }));
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