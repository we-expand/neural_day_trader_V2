/**
 * Preço real do MESMO pipeline que o motor mecânico do Neural Day Trader usa
 * (rota `/mt5-prices` do Supabase, autenticada com METAAPI_TOKEN — conta de
 * plataforma, não credencial do usuário) — ver `RealMarketDataService.ts`
 * (`fetchMT5Data`) no repo principal, esta função espelha exatamente aquela
 * chamada. Nenhuma dependência de Binance/cripto: 2026-08-29, pedido do
 * Cleber — "não precisamos utilizar a Binance... com a nossa cesta de
 * ativos... como se estivesse no lugar do motor que a gente tinha
 * desenvolvido".
 */
import { config } from "./config.js";
import { recordTick } from "./tickHistory.js";

interface Mt5PriceTick {
  price: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  /** Horario REAL do tick na corretora (`tickerData.time` da MetaAPI, repassado por /mt5-prices). */
  timestamp?: string;
}

export interface Mt5Quote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  changePercent: number;
  /** Spread real do MESMO tick, em % do bid. NaN quando o provedor nao mandou bid/ask separados. */
  spreadPct: number;
  /** Idade real do tick (agora - horario do tick na corretora), em segundos. null se o provedor nao mandou timestamp. */
  tickAgeSeconds: number | null;
  /** true quando o tick e mais velho que STALE_TICK_MS -- preco REAL, porem morto (mercado fechado / feed parado). */
  stale: boolean;
}

// 🔴 2026-08-30 (investigacao de feed travado / spread anormal): a resposta de
// /mt5-prices ja carregava `timestamp` (horario REAL do tick na corretora,
// `tickerData.time` da MetaAPI) e este modulo simplesmente IGNORAVA esse campo.
// Consequencia medida ao vivo neste dia: XPTUSD (platina, mercado FECHADO no
// fim de semana) devolvia bid=1819.93/ask=1828.36 com timestamp
// 2026-08-28T20:59:58Z -- ~29,8 HORAS de idade -- e o agente consumia isso como
// se fosse cotacao viva, alimentando ate o historico de tick (tickHistory.ts)
// com o mesmo preco morto a cada 10s, fabricando uma "tendencia LATERAL" e uma
// "volatilidade" que nao existem. Nada disso era SIMULATED (o dado e real), so
// estava MORTO -- exatamente o tipo de coisa que a convencao do projeto manda
// sinalizar explicitamente em vez de mascarar.
// 120s de tolerancia: a maior lacuna legitima medida entre ticks nesta cesta
// (fim de semana, conta MetaAPI compartilhada) foi ~25s; 120s da folga larga
// sem deixar passar mercado fechado (horas/dias).
const STALE_TICK_MS = 120_000;

/** Ultimo horario de tick JA gravado no historico, por simbolo (dedupe -- ver recordTick abaixo). */
const lastRecordedTickTimeBySymbol: Record<string, number> = {};

// 🔴 2026-08-29 (achado da auditoria): 7 posicoes BTCUSD abertas no MESMO
// preco exato ao longo de 12min (feed provavelmente travado num tick velho
// sem sinalizar SIMULATED, que so cobre preco FABRICADO, nao preco REAL
// porem obsoleto). Isso so registra/avisa -- a trava de bloqueio de verdade
// fica em tools.ts/open_position (nao abre 2x no mesmo preco). Aqui e so
// para deixar rastro no log quando acontecer, pra confirmar se e feed
// travado ou coincidencia de mercado muito parado.
let lastPriceBySymbol: Record<string, number> = {};
let repeatCountBySymbol: Record<string, number> = {};

// 🔴 2026-08-29 (pedido do Cleber, "as entradas nao estao contemplando o
// spread"): antes, abertura/fechamento/PnL flutuante usavam um unico "price"
// (o mid/last tick) -- isso escondia o custo real de operar (o LLM comprava e
// vendia no MESMO preco, como se o spread nao existisse). Agora devolve
// bid/ask reais do MESMO tick da MetaAPI -- quem usa esta cotacao pra abrir/
// fechar posicao (tools.ts, neuralBridge.ts) preenche no lado certo: LONG
// compra no ask e vende (fecha) no bid, SHORT vende no bid e compra (fecha)
// no ask. Efeito esperado (pedido explicito): uma posicao recem-aberta ja
// mostra PnL flutuante igual a -spread ate o preco andar o suficiente pra
// cobrir esse custo -- exatamente como uma corretora real mostra. Se o
// provedor nao devolver bid/ask (raro), cai pra price em ambos -- spread
// vira 0 nesse caso, nunca inventa um spread fabricado.
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 🔴 2026-08-29 (achado real): open_position/close_position chamam getQuote
// de novo internamente (nao reaproveitam a cotacao que o LLM ja tinha visto
// via get_mt5_quote segundos antes) -- uma unica falha transitoria de rede
// contra o endpoint MetaAPI compartilhado (rate-limit/504, risco cronico ja
// documentado no CLAUDE.md) fazia open_position devolver "sem cotacao
// disponivel" e abortar a entrada, mesmo com o feed saudavel no instante
// seguinte. 3 tentativas com pequeno backoff absorve esse tipo de soluco sem
// mascarar uma falha real e persistente (essa ainda devolve null no fim).
const QUOTE_RETRY_ATTEMPTS = 3;
const QUOTE_RETRY_DELAY_MS = 500;

async function fetchTicks(symbols: string[]): Promise<Map<string, Mt5PriceTick> | null> {
  const url = `${config.neuralSupabaseUrl}/functions/v1/server/mt5-prices`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.neuralSupabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbols }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const result = await res.json();
    if (result.source === "SIMULATED" || !Array.isArray(result?.prices)) return null;
    const bySymbol = new Map<string, Mt5PriceTick>();
    for (const tick of result.prices as (Mt5PriceTick & { symbol?: string })[]) {
      if (tick?.symbol) bySymbol.set(tick.symbol, tick);
    }
    return bySymbol;
  } catch {
    return null;
  }
}

function processTick(symbol: string, tick: Mt5PriceTick | null | undefined): Mt5Quote | null {
    if (!tick || !Number.isFinite(tick.price) || tick.price <= 0) return null;

    if (lastPriceBySymbol[symbol] === tick.price) {
      repeatCountBySymbol[symbol] = (repeatCountBySymbol[symbol] ?? 1) + 1;
      if (repeatCountBySymbol[symbol] >= 3) {
        console.warn(
          `[mt5Broker] ⚠️ ${symbol} devolveu o MESMO preco (${tick.price}) ${repeatCountBySymbol[symbol]}x seguidas -- ` +
            `possivel feed travado (tick obsoleto, nao SIMULATED). Investigar se persistir.`
        );
      }
    } else {
      repeatCountBySymbol[symbol] = 1;
      lastPriceBySymbol[symbol] = tick.price;
    }

    const bid = Number.isFinite(tick.bid) ? (tick.bid as number) : tick.price;
    const ask = Number.isFinite(tick.ask) ? (tick.ask as number) : tick.price;
    const hasRealSpread = Number.isFinite(tick.bid) && Number.isFinite(tick.ask) && bid > 0;
    const spreadPct = hasRealSpread ? ((ask - bid) / bid) * 100 : NaN;

    // Idade REAL do tick na corretora. Clamp em 0: a MetaAPI as vezes devolve
    // timestamp alguns segundos a FRENTE do relogio local (skew medido: ate
    // ~3s) -- idade negativa nao existe, mas nao e sinal de problema nenhum.
    const tickTimeMs = tick.timestamp ? new Date(tick.timestamp).getTime() : NaN;
    const hasTickTime = Number.isFinite(tickTimeMs);
    const tickAgeMs = hasTickTime ? Math.max(0, Date.now() - tickTimeMs) : null;
    const stale = tickAgeMs !== null && tickAgeMs > STALE_TICK_MS;
    if (stale) {
      console.warn(
        `[mt5Broker] ⚠️ ${symbol}: tick REAL porem OBSOLETO (${(tickAgeMs! / 1000).toFixed(0)}s de idade, ` +
          `horario do tick ${tick.timestamp}) -- mercado provavelmente fechado ou feed parado. ` +
          `Cotacao devolvida marcada como stale (open_position bloqueia; PnL/fechamento continuam usando o ultimo preco real conhecido).`
      );
    }

    // 🔴 2026-08-29 (achado do Cleber: "não está conseguindo ver pra onde o
    // mercado está indo"): todo tick REAL (nunca chega aqui se for SIMULATED,
    // ver checagem acima) alimenta o histórico em memória deste processo --
    // ver tickHistory.ts. É o que passa a sustentar tendência/volatilidade/
    // momentum quando o endpoint de candles (fonte original dessas métricas)
    // está fora do ar, como está agora.
    // 🔴 2026-08-30: so grava no historico tick VIVO e NOVO. Antes, todo
    // retorno da rota virava uma "amostra" -- inclusive o mesmo tick morto de
    // XPTUSD repetido a cada 10s -- o que fabricava serie temporal (tendencia
    // LATERAL, volatilidade, extensao) em cima de um unico preco de 30h atras.
    // Dedupe pelo horario do tick da corretora: dois retornos do MESMO tick
    // sao a mesma observacao, nao duas.
    if (!stale) {
      const alreadyRecorded = hasTickTime && lastRecordedTickTimeBySymbol[symbol] === tickTimeMs;
      if (!alreadyRecorded) {
        if (hasTickTime) lastRecordedTickTimeBySymbol[symbol] = tickTimeMs;
        recordTick(symbol, tick.price, hasTickTime ? tickTimeMs : Date.now());
      }
    }

    return {
      symbol,
      price: tick.price,
      bid,
      ask,
      changePercent: tick.changePercent ?? 0,
      spreadPct,
      tickAgeSeconds: tickAgeMs === null ? null : Number((tickAgeMs / 1000).toFixed(1)),
      stale,
    };
}

// 🔴 2026-09-02 (achado real: rate-limit crônico da conta MetaAPI
// compartilhada piorando mesmo depois de reduzir a cesta 16→10→7 -- ver
// SESSAO_2026-09-02_RATE_LIMIT_METAAPI_BATCH_QUOTES.md): cada get_mt5_quote,
// open_position, close_position e enforceMt5StopsAndTargets disparava sua
// PRÓPRIA requisição a /mt5-prices com 1 símbolo só -- um ciclo de 10s com 7
// ativos na cesta virava até 7+ requisições HTTP sequenciais separadas
// disputando a mesma conta com o polling do Gráfico no navegador. O TTL do
// cache compartilhado do servidor é de só 2,5s (`PRICE_CACHE_TTL_MS`), então
// símbolos diferentes quase nunca reaproveitavam cache entre si. Agora
// `primeQuotes` busca a cesta INTEIRA numa única requisição por ciclo (o
// endpoint já suporta `symbols: [...]` e já teria concorrência limitada
// internamente pra um lote só) e populated um cache local de curta duração;
// `getQuote` lê desse cache primeiro, só cai pro fetch individual (com retry)
// se o símbolo não foi priming ou o cache expirou -- nunca perde a proteção
// existente, só evita repetir a mesma cotação 5-7x por ciclo.
// 🔴 2026-09-03: subido de 8s pra 12s -- menor que 2 ticks do stop-watchdog
// (5s cada, ver STOP_WATCHDOG_INTERVAL_MS em index.ts) fazia praticamente
// TODO tick com posição aberta errar o cache e disparar fetch individual
// novo, alvo fácil de virar rajada sob rate-limit (ver getQuoteSingleAttempt
// acima). 12s garante que pelo menos 1 em cada 2 ticks reaproveita o cache.
const QUOTE_CACHE_TTL_MS = 12_000;
const quoteCache = new Map<string, { quote: Mt5Quote; fetchedAtMs: number }>();

function cacheQuote(quote: Mt5Quote) {
  quoteCache.set(quote.symbol, { quote, fetchedAtMs: Date.now() });
}

function getFreshCachedQuote(symbol: string): Mt5Quote | null {
  const entry = quoteCache.get(symbol);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAtMs > QUOTE_CACHE_TTL_MS) return null;
  return entry.quote;
}

/** Busca a cesta inteira numa única requisição e popula o cache -- chamar 1x por ciclo, antes do agente decidir. Nunca lança: falha silenciosa aqui só significa que getQuote cai pro fetch individual de sempre. */
export async function primeQuotes(symbols: string[]): Promise<void> {
  if (symbols.length === 0) return;
  const ticksBySymbol = await fetchTicks(symbols);
  if (!ticksBySymbol) return;
  for (const symbol of symbols) {
    const quote = processTick(symbol, ticksBySymbol.get(symbol));
    if (quote) cacheQuote(quote);
  }
}

async function fetchQuoteOnce(symbol: string): Promise<Mt5Quote | null> {
  const ticksBySymbol = await fetchTicks([symbol]);
  const quote = processTick(symbol, ticksBySymbol?.get(symbol));
  if (quote) cacheQuote(quote);
  return quote;
}

export async function getQuote(symbol: string): Promise<Mt5Quote | null> {
  const cached = getFreshCachedQuote(symbol);
  if (cached) return cached;

  for (let attempt = 1; attempt <= QUOTE_RETRY_ATTEMPTS; attempt++) {
    const quote = await fetchQuoteOnce(symbol);
    if (quote) return quote;
    if (attempt < QUOTE_RETRY_ATTEMPTS) await sleep(QUOTE_RETRY_DELAY_MS * attempt);
  }
  return null;
}

// 🔴 2026-09-03 (achado ao vivo: NAS100 travando no Gráfico do cliente,
// "só ele" -- causa raiz era o PRÓPRIO motor, não o navegador): o
// stop-watchdog (index.ts, roda sozinho a cada 5s pra TODA posição aberta,
// fora do ritmo lento do ciclo do LLM) chamava `getQuote` normal -- com
// cache de 8s (mais curto que 2 ticks de 5s) e até 3 retries por chamada
// (QUOTE_RETRY_ATTEMPTS acima), um símbolo com posição aberta virava alvo
// de rajadas de requisição individual (não-batched) na conta MetaAPI
// compartilhada, sempre que ela já estivesse sob rate-limit -- confirmado
// no log real: só NAS100 (único com posição aberta na sessão) mostrando
// "endpoint lento/rate-limited/off" repetidamente, competindo pela mesma
// cota que o Gráfico do cliente usa pra esse mesmo símbolo. O watchdog já
// tenta de novo sozinho no próximo tick (5s) se falhar -- não precisa
// insistir 3x imediatamente na mesma cota já saturada, isso só piora.
export async function getQuoteSingleAttempt(symbol: string): Promise<Mt5Quote | null> {
  const cached = getFreshCachedQuote(symbol);
  if (cached) return cached;
  return fetchQuoteOnce(symbol);
}
