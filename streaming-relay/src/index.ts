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
import { isAvailableOnBroker, getBrokerSymbol } from '../../src/app/config/brokerRegistry.js';

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
const brokerSymbolByUnified = new Map<string, string>();
for (const asset of ALL_ASSETS) {
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

  // Seed do previousClose via terminal state (candle D1 mais recente por
  // símbolo) antes de assinar — sem isso, os primeiros ticks de cada símbolo
  // vêm com change/changePercent = 0 até o primeiro candle fechar.
  for (const [brokerSymbol] of brokerSymbolByUnified) {
    try {
      const candles = await account.getHistoricalCandles(brokerSymbol, '1d', undefined, 2);
      if (candles.length >= 1) {
        previousCloseBySymbol.set(brokerSymbol, candles[candles.length - 1].close);
      }
    } catch {
      // símbolo sem candle D1 disponível ainda — segue sem seed, corrige no
      // próximo fechamento de candle diário.
    }
  }

  const symbols = [...brokerSymbolByUnified.keys()];
  const CHUNK_SIZE = 40;
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(symbol => connection.subscribeToMarketData(symbol, [{ type: 'quotes' }])));
    console.log(`[streaming-relay] 📡 Assinado lote ${i / CHUNK_SIZE + 1}/${Math.ceil(symbols.length / CHUNK_SIZE)} (${chunk.length} símbolos).`);
  }

  console.log(`[streaming-relay] 🚀 Streaming ativo pra ${symbols.length} símbolos.`);
}

main().catch((error) => {
  console.error('[streaming-relay] ❌ Erro fatal, encerrando (Fly.io reinicia automaticamente):', error);
  process.exit(1);
});
