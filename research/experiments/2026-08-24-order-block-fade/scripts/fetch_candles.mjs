/**
 * ETL de candles REAIS para o teste de Order Block Fade (2026-08-24).
 * Mesmo padrão de `2026-08-05-taxa-base/scripts/fetch_candles.mjs` — dado
 * buscado de novo (não reusa cache de 3 semanas atrás), mesmas fontes reais:
 *   - Cripto: Binance (klines públicos).
 *   - Forex/índices/metais: Edge Function `/mt5-candles-history` (MetaAPI,
 *     conta de plataforma compartilhada — chamadas seriais, nunca em paralelo).
 *
 * DISCIPLINA: nada é fabricado. Ativo/timeframe sem dado real vira arquivo
 * AUSENTE + linha "SEM DADO REAL" no manifesto.
 *
 * Uso: node research/experiments/2026-08-24-order-block-fade/scripts/fetch_candles.mjs
 */
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const PROJECT_ID = 'wyvdsxtcmizettljxtbg';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dmRzeHRjbWl6ZXR0bGp4dGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1ODkzOTYsImV4cCI6MjA4MjE2NTM5Nn0.tYX5fBwz0LKa8Umak1MB9SBp_sIQ4Df_31H6GyI9eo4';

// Mesma cesta de 2026-08-05-taxa-base — universo real do produto, não escolha nova.
const ASSETS = [
  { symbol: 'BTCUSD', source: 'binance', binance: 'BTCUSDT' },
  { symbol: 'XBNUSD', source: 'binance', binance: 'BTCUSDT' },
  { symbol: 'EURUSD', source: 'metaapi' },
  { symbol: 'XAUUSD', source: 'metaapi' },
  { symbol: 'XAGUSD', source: 'metaapi' },
  { symbol: 'US30', source: 'metaapi' },
  { symbol: 'NAS100', source: 'metaapi' },
  { symbol: 'SPX500', source: 'metaapi' },
  { symbol: 'GER40', source: 'metaapi' },
];

const TIMEFRAMES = [
  { tf: '5m', mt5: '5m', days: 45 },
  { tf: '15m', mt5: '15m', days: 120 },
  { tf: '1h', mt5: '1H', days: 365 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBinance(ticker, interval, startMs, endMs) {
  const out = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${interval}&startTime=${cursor}&endTime=${endMs}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status} para ${ticker} ${interval}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const k of chunk) {
      out.push({ time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]) });
    }
    const last = chunk[chunk.length - 1][0];
    if (last <= cursor) break;
    cursor = last + 1;
    await sleep(120);
  }
  return out;
}

const TRANSIENT = new Set([429, 502, 503, 504]);

async function fetchMetaApi(symbol, mt5Timeframe, startMs, endMs) {
  const delays = [1500, 4000, 9000];
  let lastMsg = '';
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) {
      console.log(`      ↻ retry ${attempt}/${delays.length} em ${delays[attempt - 1]}ms (conta compartilhada sob carga)`);
      await sleep(delays[attempt - 1]);
    }
    const res = await fetch(`https://${PROJECT_ID}.supabase.co/functions/v1/server/mt5-candles-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ symbol, timeframe: mt5Timeframe, startTime: new Date(startMs).toISOString(), endTime: new Date(endMs).toISOString() }),
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      lastMsg = `resposta não-JSON (HTTP ${res.status})`;
      if (TRANSIENT.has(res.status) && attempt < delays.length) continue;
      throw new Error(lastMsg);
    }
    if (!res.ok || !data.success) {
      lastMsg = data?.message || data?.error || `HTTP ${res.status}`;
      if (TRANSIENT.has(res.status) && attempt < delays.length) continue;
      throw new Error(lastMsg);
    }
    // 'metaapi' = busca ao vivo pura; 'metaapi+cache' = ao vivo mesclado com
    // cache Postgres próprio (ohlcv_data), só de candles FECHADOS já buscados
    // ao vivo antes (ver supabase/functions/server/index.ts:5108) — sem
    // nenhum caminho sintético nos dois. 'cache' sozinho (sem 'metaapi' ao
    // vivo nesta chamada) também é aceito pelo mesmo motivo. Rejeita só o
    // que não bater com nenhum desses.
    const REAL_SOURCES = new Set(['metaapi', 'metaapi+cache', 'cache']);
    if (data.source && !REAL_SOURCES.has(data.source)) {
      throw new Error(`fonte inesperada "${data.source}" — recusado (só dado real conta)`);
    }
    return data.candles.map((c) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
  }
  throw new Error(lastMsg || 'falha desconhecida');
}

const now = Date.now();
const manifest = [];

for (const asset of ASSETS) {
  for (const t of TIMEFRAMES) {
    const file = join(DATA_DIR, `${asset.symbol}_${t.tf}.json`);
    const label = `${asset.symbol} ${t.tf}`;
    if (existsSync(file)) {
      const cached = JSON.parse(readFileSync(file, 'utf8'));
      console.log(`  ✓ ${label.padEnd(16)} cache (${cached.candles.length} candles)`);
      manifest.push({ symbol: asset.symbol, tf: t.tf, ok: true, count: cached.candles.length, source: cached.source });
      continue;
    }
    const startMs = now - t.days * 86_400_000;
    process.stdout.write(`  … ${label.padEnd(16)} buscando ${t.days}d de ${asset.source}\n`);
    try {
      const candles = asset.source === 'binance' ? await fetchBinance(asset.binance, t.tf, startMs, now) : await fetchMetaApi(asset.symbol, t.mt5, startMs, now);
      if (!candles.length) throw new Error('0 candles retornados');
      const bad = candles.filter((c) => !(c.high >= c.low && c.high >= c.open && c.high >= c.close && c.low <= c.open && c.low <= c.close) || !(c.close > 0));
      if (bad.length) throw new Error(`${bad.length} candles com OHLC incoerente`);
      const payload = { symbol: asset.symbol, timeframe: t.tf, source: asset.source === 'binance' ? 'binance' : 'metaapi', fetchedAt: new Date().toISOString(), requestedDays: t.days, candles };
      writeFileSync(file, JSON.stringify(payload));
      const span = (candles[candles.length - 1].time - candles[0].time) / 86_400_000;
      console.log(`  ✓ ${label.padEnd(16)} ${candles.length} candles, ${span.toFixed(1)} dias corridos`);
      manifest.push({ symbol: asset.symbol, tf: t.tf, ok: true, count: candles.length, source: payload.source });
    } catch (err) {
      console.log(`  ✗ ${label.padEnd(16)} SEM DADO REAL — ${err.message}`);
      manifest.push({ symbol: asset.symbol, tf: t.tf, ok: false, error: err.message });
    }
    if (asset.source === 'metaapi') await sleep(2500);
  }
}

writeFileSync(join(DATA_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2));
const ok = manifest.filter((m) => m.ok).length;
console.log(`\nManifesto: ${ok}/${manifest.length} séries com dado real.`);
