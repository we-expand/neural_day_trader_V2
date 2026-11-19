/**
 * 🚀 DIRECT BINANCE SERVICE
 *
 * Busca dados DIRETAMENTE da Binance API pública.
 * Tentativa 1: api.binance.com direto
 * Tentativa 2: allorigins CORS proxy
 * Tentativa 3: corsproxy.io
 * Retorna null silenciosamente se todas falharem — sem erros críticos.
 */

import { projectId, publicAnonKey } from '../../../utils/supabase/info.tsx';

export interface BinanceTickerData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  volume?: number;
  high?: number;
  low?: number;
}

// URL base da Binance
const BINANCE_BASE = 'https://api.binance.com/api/v3';

// Proxies CORS públicos para fallback (sandbox / iframe)
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchOne(url: string): Promise<any> {
  // ✅ 2026-07-11: 4s bastava pra 1 símbolo isolado, mas `getBatchedMT5Data`
  // dispara todas as cripto sem CFD (ETH/DOGE/POL/AVAX/LTC/BNB...) em
  // paralelo (Promise.all) — cada uma correndo direto + 2 proxies (Promise.
  // any) ao mesmo tempo, o navegador enfileira parte das conexões pro mesmo
  // host, e algumas estouravam os 4s antes mesmo de terminar, caindo pro
  // sintético mesmo com a Binance disponível (confirmado: BNBUSD/LTCUSD
  // "corretos" só quando testados isolados, errados junto com o resto).
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // ✅ 2026-07-11: os proxies CORS às vezes respondem HTTP 200 (ok) mas com o
  // corpo de ERRO da própria Binance repassado por dentro (confirmado:
  // allorigins.win devolvendo `{"code":0,"msg":"Service unavailable from a
  // restricted location..."}`) — tecnicamente "sucesso" pro fetch, mas sem
  // `lastPrice` nenhum. Como corre em paralelo com a chamada direta via
  // `Promise.any` (primeiro que RESOLVER ganha, não o melhor), essa resposta
  // lixo podia vencer a corrida contra a chamada direta real se chegasse
  // primeiro sob carga concorrente (várias cripto buscadas ao mesmo tempo).
  // Rejeitar aqui, dentro da tentativa individual, garante que `Promise.any`
  // pule pra próxima tentativa em vez de aceitar isso como resposta boa.
  if (typeof data?.lastPrice === 'undefined') {
    throw new Error(`Resposta sem lastPrice (provável erro da Binance repassado pelo proxy): ${JSON.stringify(data).slice(0, 120)}`);
  }

  return data;
}

// ✅ 2026-07-23: circuit breaker por path — sem isso, cada ciclo de polling
// (ticker do rodapé a cada 10s + painel demonstrativo do Dashboard a cada 5s)
// disparava de novo as 3 tentativas (direto + 2 proxies) pra QUALQUER cripto
// sem CFD na corretora (ETH, POL, etc — ver CRYPTO_CFD_AVAILABLE), mesmo
// sabendo que os 2 proxies estão mortos há sessões (403/408 confirmados em
// toda tentativa, nunca voltam a funcionar sozinhos no meio de uma sessão).
// Isso inundava a fila de conexões do navegador com dezenas de requisições
// fadadas ao fracasso por ciclo, atrasando/starvando chamadas legítimas em
// voo ao mesmo tempo (ex: /mt5-prices do BTCUSD) — causa raiz confirmada do
// "Dashboard fica zerado por minutos e corrige sozinho" (Cleber, 2026-07-23).
// Depois de uma falha total, pula a rede por 60s pra esse path específico —
// mesma degradação graciosa de sempre (cai no fallback), sem martelar rede.
const FAILURE_COOLDOWN_MS = 60_000;
const recentFailures = new Map<string, number>();

// ✅ 2026-08-20: as 3 tentativas client-side abaixo (direto + 2 proxies CORS)
// estão confirmadas mortas em produção desde 2026-07-10 (CORS/403 bloqueado
// no domínio do navegador — bloqueio é do NAVEGADOR, não existe pro
// servidor). Rota nova `/binance-ticker/:symbol` (supabase/functions/server/
// index.ts) faz a mesma chamada server-side, sem CORS, sem fabricar dado em
// falha (erro explícito). Tentada primeiro; as tentativas antigas continuam
// como fallback adicional (ex: se o backend estiver fora do ar), sem custo
// real já que rodam em paralelo via Promise.any de qualquer forma.
async function fetchViaServerProxy(symbol: string): Promise<any | null> {
  try {
    const url = `https://${projectId}.supabase.co/functions/v1/server/binance-ticker/${symbol}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${publicAnonKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error || typeof data?.price !== 'number') return null;
    // Normaliza pro formato que fetchOne/parse abaixo espera (campos crus da Binance)
    return {
      lastPrice: String(data.price),
      priceChange: String(data.change),
      priceChangePercent: String(data.changePercent),
      volume: String(data.volume),
      highPrice: String(data.high),
      lowPrice: String(data.low),
    };
  } catch {
    return null;
  }
}

async function fetchWithFallback(path: string): Promise<any | null> {
  const lastFailureAt = recentFailures.get(path);
  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
    return null;
  }

  const directUrl = `${BINANCE_BASE}${path}`;

  // 🚀 PERF: proxy do servidor + direto + proxies CORS disparados EM PARALELO
  // (Promise.any) — o proxy do servidor deveria vencer sempre (sem CORS), os
  // outros são só rede de segurança caso o backend caia.
  const symbolMatch = path.match(/symbol=([A-Z]+)/);
  const attempts: Promise<any>[] = [directUrl, ...CORS_PROXIES.map(build => build(directUrl))].map(fetchOne);
  if (symbolMatch) {
    attempts.push(
      fetchViaServerProxy(symbolMatch[1]).then((r) => {
        if (!r) throw new Error('server proxy sem dado');
        return r;
      })
    );
  }

  try {
    const result = await Promise.any(attempts);
    recentFailures.delete(path); // sucesso — reseta o cooldown se tinha algum
    return result;
  } catch {
    recentFailures.set(path, Date.now()); // ativa o cooldown pra esse path
    return null; // Todas as tentativas falharam — retorna null sem lançar erro
  }
}

/**
 * Busca ticker de 24h de um símbolo diretamente da Binance
 */
export async function fetchDirectBinance(symbol: string): Promise<BinanceTickerData | null> {
  const normalizedSymbol = symbol.toUpperCase();

  const data = await fetchWithFallback(`/ticker/24hr?symbol=${normalizedSymbol}`);
  if (!data) return null;

  const price = parseFloat(data.lastPrice);
  const change = parseFloat(data.priceChange);
  const changePercent = parseFloat(data.priceChangePercent);

  // ✅ 2026-07-11: os proxies CORS (allorigins/corsproxy) às vezes respondem
  // HTTP 200 com um corpo válido em JSON mas sem os campos esperados (ex:
  // página de erro do proxy encapsulada) — como corre em paralelo com a
  // chamada direta via `Promise.any`, um proxy assim podia "vencer" a corrida
  // e virar preço `NaN` na tela (visto com ETHUSD/DOGEUSD/etc), sem cair no
  // fallback sintético porque tecnicamente não lançava erro nenhum. Validar
  // os números antes de aceitar a resposta.
  if (!isFinite(price) || !isFinite(change) || !isFinite(changePercent)) {
    return null;
  }

  return {
    symbol: normalizedSymbol,
    price,
    change,
    changePercent,
    volume: parseFloat(data.volume),
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
    timestamp: Date.now(),
  };
}

/**
 * Busca múltiplos símbolos em paralelo
 */
export async function fetchMultipleBinance(symbols: string[]): Promise<Map<string, BinanceTickerData>> {
  const results = new Map<string, BinanceTickerData>();

  await Promise.all(
    symbols.map(async (symbol) => {
      const data = await fetchDirectBinance(symbol);
      if (data) results.set(symbol, data);
    })
  );

  return results;
}

/**
 * Verifica se um símbolo é crypto Binance
 */
export function isBinanceSymbol(symbol: string): boolean {
  const normalized = symbol.toUpperCase();
  const known = [
    'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT',
    'DOGEUSDT','DOTUSDT','LTCUSDT','AVAXUSDT','LINKUSDT','ATOMUSDT',
    'UNIUSDT','NEARUSDT','TRXUSDT','APTUSDT','FTMUSDT','MATICUSDT',
    'POLUSDT','GALAUSDT','AXSUSDT','BCHUSDT','XLMUSDT','ALGOUSDT',
  ];
  return known.includes(normalized) || normalized.endsWith('USDT');
}