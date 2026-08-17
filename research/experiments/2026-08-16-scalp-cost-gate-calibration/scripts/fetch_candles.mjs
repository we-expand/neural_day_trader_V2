/**
 * ETL de candles REAIS de 1m para calibrar o gate de custo do modo SCALP
 * (2026-08-16). Motivo: `CostViabilityGate` foi calibrado com movimento
 * típico de BTCUSDT em 15m/1h/4h/1d (seção 14.3 da spec) e a implementação em
 * produção usa ATR(14) INSTANTÂNEO do candle corrente como proxy de
 * "movimento típico" — em 1m isso reprova quase todo sinal do preset 5
 * (achado da sessão 2026-08-16, `SESSAO_2026-08-16_CALIBRACAO_RUNNER_1M.md`
 * e a investigação que motivou este script). Este ETL busca dado real de 1m
 * pra medir o movimento típico de verdade nesse timeframe, por ativo.
 *
 * Fontes — as mesmas do produto, nenhuma nova, nenhuma sintética:
 *   - Cripto (BTCUSD, XBNUSD): API pública da Binance (klines).
 *   - Forex/índice/metal: Edge Function `/mt5-candles-history` (MetaAPI,
 *     conta de plataforma).
 *
 * DISCIPLINA (convenção nº1 do projeto): nada é fabricado. Ativo sem dado
 * real vira arquivo AUSENTE — nunca preenchido, nunca interpolado.
 *
 * A conta MetaAPI é COMPARTILHADA — uma requisição por vez, pausa entre elas,
 * retry com backoff, nunca em paralelo. Cache em disco.
 *
 * Uso: node research/experiments/2026-08-16-scalp-cost-gate-calibration/scripts/fetch_candles.mjs
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

/**
 * Os 6 ativos são exatamente `config.activeAssets` da sessão RUNNING
 * 41378b46-2a7d-4155-bde0-b3b099df6c1a (a sessão de calibração de scalp que o
 * Cleber deixou ligada) — universo real, não escolha de conveniência.
 */
const ASSETS = [
  { symbol: 'BTCUSD', source: 'binance', binance: 'BTCUSDT' },
  { symbol: 'XBNUSD', source: 'binance', binance: 'BTCUSDT' },
  { symbol: 'EURUSD', source: 'metaapi' },
  { symbol: 'XAUUSD', source: 'metaapi' },
  { symbol: 'GER40', source: 'metaapi' },
  { symbol: 'SPX500', source: 'metaapi' },
];

// 1m: 10 dias corridos ~ 14.400 candles teto (dentro do limite de 60k/página
// do servidor), amostra suficiente pra mediana robusta sem exagerar na carga
// da conta MetaAPI compartilhada.
const TF = { tf: '1m', mt5: '1m', days: 3 };

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
      out.push({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      });
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
      body: JSON.stringify({
        symbol,
        timeframe: mt5Timeframe,
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
      }),
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
    // "metaapi+cache" = dado real da MetaAPI servido do cache do servidor —
    // ainda é dado real, não sintético. Só recusamos fonte que não seja MetaAPI.
    if (data.source && !String(data.source).startsWith('metaapi')) {
      throw new Error(`fonte inesperada "${data.source}" — recusado (só dado real conta)`);
    }
    return data.candles.map((c) => ({
      time: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }
  throw new Error(lastMsg || 'falha desconhecida');
}

const now = Date.now();
const manifest = [];

for (const asset of ASSETS) {
  const file = join(DATA_DIR, `${asset.symbol}_${TF.tf}.json`);
  const label = `${asset.symbol} ${TF.tf}`;
  if (existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, 'utf8'));
    console.log(`  ✓ ${label.padEnd(16)} cache (${cached.candles.length} candles)`);
    manifest.push({ symbol: asset.symbol, tf: TF.tf, ok: true, count: cached.candles.length, source: cached.source });
    continue;
  }
  const startMs = now - TF.days * 86_400_000;
  process.stdout.write(`  … ${label.padEnd(16)} buscando ${TF.days}d de ${asset.source}\n`);
  try {
    const candles =
      asset.source === 'binance'
        ? await fetchBinance(asset.binance, TF.tf, startMs, now)
        : await fetchMetaApi(asset.symbol, TF.mt5, startMs, now);

    if (!candles.length) throw new Error('0 candles retornados');

    const bad = candles.filter(
      (c) => !(c.high >= c.low && c.high >= c.open && c.high >= c.close && c.low <= c.open && c.low <= c.close) || !(c.close > 0)
    );
    if (bad.length) throw new Error(`${bad.length} candles com OHLC incoerente`);

    const payload = {
      symbol: asset.symbol,
      timeframe: TF.tf,
      source: asset.source === 'binance' ? 'binance' : 'metaapi',
      fetchedAt: new Date().toISOString(),
      requestedDays: TF.days,
      candles,
    };
    writeFileSync(file, JSON.stringify(payload));
    const span = (candles[candles.length - 1].time - candles[0].time) / 86_400_000;
    console.log(`  ✓ ${label.padEnd(16)} ${candles.length} candles, ${span.toFixed(1)} dias corridos`);
    manifest.push({ symbol: asset.symbol, tf: TF.tf, ok: true, count: candles.length, source: payload.source });
  } catch (err) {
    console.log(`  ✗ ${label.padEnd(16)} SEM DADO REAL — ${err.message}`);
    manifest.push({ symbol: asset.symbol, tf: TF.tf, ok: false, error: err.message });
  }
  if (asset.source === 'metaapi') await sleep(2500);
}

writeFileSync(join(DATA_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2));
const ok = manifest.filter((m) => m.ok).length;
console.log(`\nManifesto: ${ok}/${manifest.length} séries com dado real.`);
