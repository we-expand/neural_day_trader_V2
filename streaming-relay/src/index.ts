/**
 * 🔌 STREAMING RELAY — MetaAPI (streaming/WebSocket) → Supabase Realtime
 *
 * Serviço sempre-ligado (Fly.io). Mantém UMA conexão de streaming persistente
 * com a conta MetaAPI de plataforma e repassa cada tick recebido pro canal
 * Supabase Realtime `turbo-main-channel` (evento `price-update`) — o MESMO
 * canal/formato que `src/app/hooks/useSupabaseRealtimeTurbo.ts` já sabe
 * consumir (hoje só ligado a 3 componentes secundários; o objetivo desta
 * mudança é o Dashboard/Ticker/AI real passarem a consumir daqui em vez de
 * fazer polling HTTP em `/mt5-prices`).
 *
 * Token MetaAPI e service_role do Supabase só existem aqui (env vars do
 * Fly.io) — nunca chegam ao navegador. Ver CLAUDE.md do projeto sobre a
 * Fase 1 de segurança (token nunca no client).
 */
import MetaApi, { SynchronizationListener, MetatraderSymbolPrice } from 'metaapi.cloud-sdk';
import { createClient } from '@supabase/supabase-js';
import { ALL_ASSETS } from '../../src/app/config/assetDatabase.js';
import { isAvailableOnBroker, isCryptoCfdAvailable, getBrokerSymbol } from '../../src/app/config/brokerRegistry.js';

const METAAPI_TOKEN = requireEnv('METAAPI_TOKEN');
const METAAPI_ACCOUNT_ID = requireEnv('METAAPI_ACCOUNT_ID');
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[streaming-relay] ❌ Env var obrigatória ausente: ${name}`);
    process.exit(1);
  }
  return value;
}

// Catálogo real disponível na Infinox (mesma fonte usada pelo frontend) —
// nome unificado -> nome real na corretora.
//
// ⚠️ CORRIGIDO 2026-07-14: `isAvailableOnBroker` sozinho não é suficiente pra
// cripto — só BTCUSD/SOLUSD/BNBUSD/XRPUSD/ADAUSD/DOTUSD/BATUSD têm CFD
// confirmado na Infinox (`CRYPTO_CFD_AVAILABLE` em brokerRegistry.ts); o
// resto (ex: ETHUSD) passa em `isAvailableOnBroker` mas NÃO EXISTE como CFD
// de verdade — assinar esse símbolo faz a MetaAPI rejeitar com
// `ValidationError: symbol does not exist`, que sem tratamento derrubava o
// processo inteiro (loop de crash-restart, nunca chegava a transmitir
// preço nenhum). Mesmo gate que o frontend já usa em `getRealMarketData`.
// ⚠️ 2026-08-31: BTCUSD passou a cotar direto da Binance em `/mt5-prices`
// (ver supabase/functions/server/index.ts, `BINANCE_DIRECT_SYMBOL_MAP`) pra
// bater exatamente com o site da Binance. Este relay HOJE ESTÁ DESLIGADO em
// produção (parado e o launch agent removido em 2026-07-23, ver
// CLAUDE_HISTORY.md — só existe o código-fonte no repo, não é a causa de
// nenhum sintoma atual), mas se for religado no futuro ele publicaria o tick
// do BROKER (Infinox/MetaAPI) por cima do valor Binance-preciso do polling
// (`ensureRealtimeStreamingInitialized` em RealMarketDataService.ts aplica
// `payload.price` direto) — exclusão preventiva de BTCUSD da assinatura de
// streaming aqui, pra esse religamento futuro não reintroduzir a divergência
// contra a Binance sem ninguém perceber.
const brokerSymbolByUnified = new Map<string, string>();
for (const asset of ALL_ASSETS) {
  if (asset.symbol === 'BTCUSD') continue;
  if (asset.category === 'CRYPTO' && !isCryptoCfdAvailable(asset.symbol, 'infinox')) continue;
  if (isAvailableOnBroker(asset.symbol, 'infinox')) {
    brokerSymbolByUnified.set(getBrokerSymbol(asset.symbol, 'infinox'), asset.symbol);
  }
}
console.log(`[streaming-relay] 📋 ${brokerSymbolByUnified.size} símbolos disponíveis na corretora, assinando streaming.`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { params: { eventsPerSecond: 20 } },
});
const relayChannel = supabase.channel('turbo-main-channel');

// Guarda o último `change`/`changePercent` conhecido por símbolo — a MetaAPI
// manda tick de preço puro (bid/ask), não variação diária pronta; calculamos
// aqui contra o `previousClose` do dia (mesma metodologia D1-close-de-ontem
// já usada em `/mt5-prices`, ver supabase/functions/server/index.ts).
const previousCloseBySymbol = new Map<string, number>();

class RelaySynchronizationListener extends SynchronizationListener {
  async onSymbolPriceUpdated(_instanceIndex: string, price: MetatraderSymbolPrice) {
    const unified = brokerSymbolByUnified.get(price.symbol);
    if (!unified) return; // símbolo fora do catálogo real, ignora

    const prevClose = previousCloseBySymbol.get(price.symbol);
    const change = typeof prevClose === 'number' ? price.bid - prevClose : 0;
    const changePercent = typeof prevClose === 'number' && prevClose > 0 ? (change / prevClose) * 100 : 0;

    relayChannel.send({
      type: 'broadcast',
      event: 'price-update',
      payload: {
        asset_symbol: unified,
        price: price.bid,
        bid: price.bid,
        ask: price.ask,
        change_24h: change,
        change_percent_24h: changePercent,
        volume: 0,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

async function main() {
  await relayChannel.subscribe();
  console.log('[streaming-relay] ✅ Conectado ao canal Supabase Realtime (turbo-main-channel).');

  const api = new MetaApi(METAAPI_TOKEN);
  const account = await api.metatraderAccountApi.getAccount(METAAPI_ACCOUNT_ID);
  await account.waitConnected();

  const connection = account.getStreamingConnection();
  connection.addSynchronizationListener(new RelaySynchronizationListener());

  await connection.connect();
  await connection.waitSynchronized();
  console.log('[streaming-relay] ✅ Conexão de streaming MetaAPI sincronizada.');

  // ⚠️ CORRIGIDO 2026-07-14: o seed do previousClose (candle D1) rodava
  // SEQUENCIAL e SEM TIMEOUT antes de qualquer assinatura de preço — se
  // `getHistoricalCandles` travasse (sem erro, sem timeout) pra QUALQUER um
  // dos 219 símbolos, o serviço inteiro ficava preso aí pra sempre e nunca
  // chegava a assinar preço nenhum (sintoma: relay "conectado e sincronizado"
  // no log, mas Dashboard nunca recebendo tick). Fix: assina os preços
  // PRIMEIRO (tick já flui imediatamente) e faz o seed do candle em paralelo,
  // em background, com timeout por chamada — se travar/falhar, só aquele
  // símbolo fica sem seed (change/changePercent começam em 0 até o primeiro
  // fechamento de candle real, já tratado sem piscar no frontend via
  // `rememberIfReal`, ver RealMarketDataService.ts).
  const symbols = [...brokerSymbolByUnified.keys()];
  const CHUNK_SIZE = 40;
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    await Promise.allSettled(chunk.map(async (symbol) => {
      try {
        await connection.subscribeToMarketData(symbol, [{ type: 'quotes' }]);
      } catch (error) {
        console.error(`[streaming-relay] ⚠️ Falha ao assinar ${symbol} (${brokerSymbolByUnified.get(symbol)}), ignorando:`, error instanceof Error ? error.message : error);
      }
    }));
    console.log(`[streaming-relay] 📡 Assinado lote ${i / CHUNK_SIZE + 1}/${Math.ceil(symbols.length / CHUNK_SIZE)} (${chunk.length} símbolos).`);
  }
  console.log(`[streaming-relay] 🚀 Streaming ativo pra ${symbols.length} símbolos.`);

  const CANDLE_TIMEOUT_MS = 5000;
  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  }

  (async () => {
    for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
      const chunk = symbols.slice(i, i + CHUNK_SIZE);
      await Promise.allSettled(
        chunk.map(async (brokerSymbol) => {
          const candles = await withTimeout(account.getHistoricalCandles(brokerSymbol, '1d', undefined, 2), CANDLE_TIMEOUT_MS);
          if (candles.length >= 1) {
            previousCloseBySymbol.set(brokerSymbol, candles[candles.length - 1].close);
          }
        })
      );
    }
    console.log(`[streaming-relay] 📈 Seed de previousClose concluído (${previousCloseBySymbol.size}/${symbols.length} símbolos).`);
  })();
}

main().catch((error) => {
  console.error('[streaming-relay] ❌ Erro fatal, encerrando (Fly.io reinicia automaticamente):', error);
  process.exit(1);
});
