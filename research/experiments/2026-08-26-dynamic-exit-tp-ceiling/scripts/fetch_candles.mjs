/**
 * Candles REAIS (Binance, klines públicos) pro backtest de teto de TP.
 * DISCIPLINA: nada fabricado — sem dado real, o script falha, não preenche.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const PAIRS = [
  { symbol: 'BTCUSD', binance: 'BTCUSDT' },
  { symbol: 'ETHUSD', binance: 'ETHUSDT' },
  { symbol: 'SOLUSD', binance: 'SOLUSDT' },
];

// Cobre 2026-08-17 20:55 -> 2026-08-26 14:41 com folga (aquecimento ATR-14 antes, hold longo depois)
const START = Date.parse('2026-08-16T00:00:00Z');
const END = Date.parse('2026-08-28T00:00:00Z');
const INTERVAL = '15m';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBinance(ticker) {
  const out = [];
  let cursor = START;
  while (cursor < END) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${INTERVAL}&startTime=${cursor}&endTime=${END}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status} para ${ticker}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const k of chunk) {
      out.push({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] });
    }
    const last = chunk[chunk.length - 1][0];
    if (last <= cursor) break;
    cursor = last + 60_000;
    await sleep(150);
  }
  return out;
}

for (const p of PAIRS) {
  console.log(`Buscando ${p.binance} (${INTERVAL})...`);
  const candles = await fetchBinance(p.binance);
  console.log(`  ${candles.length} candles, ${new Date(candles[0].time).toISOString()} -> ${new Date(candles[candles.length - 1].time).toISOString()}`);
  writeFileSync(join(DATA_DIR, `${p.symbol}_15m.json`), JSON.stringify(candles));
}
console.log('OK');
