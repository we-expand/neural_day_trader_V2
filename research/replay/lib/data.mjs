// Carrega candles para o replay.
// - Cripto (BTCUSD/XETUSD/LNKUSD): klines publicos da Binance (serie completa, sem buraco).
//   BTCUSD ja e roteado pra Binance no servidor; ETH/LINK da Infinox acompanham o mesmo movimento.
// - Indices/commodities: ohlcv_data (Supabase), velas REAIS da MetaAPI que o motor arquivou
//   (neuralBridge.archiveCandles). Tem buracos: o simulador pula entradas cujo caminho cai num buraco.
// Cache em research/replay/cache/ (gitignored) pra nao rebaixar a cada rodada.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CACHE = path.join(ROOT, "cache");
const ENV_FILE = path.resolve(ROOT, "../../llm-active-brain/.env");

const BINANCE = { BTCUSD: "BTCUSDT", XETUSD: "ETHUSDT", LNKUSD: "LINKUSDT" };
export const TF_MS = { "5m": 300_000, "1h": 3_600_000 };

function readEnv() {
  const out = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function fetchBinance(pair, tf, fromMs, toMs) {
  const out = [];
  let cur = fromMs;
  while (cur < toMs) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${tf}&limit=1000&startTime=${cur}&endTime=${toMs - 1}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) break;
    for (const k of rows) out.push({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] });
    cur = rows[rows.length - 1][0] + 1;
    if (rows.length < 1000) break;
  }
  return out;
}

async function fetchSupabase(symbol, tf, fromMs, toMs) {
  const env = readEnv();
  const base = env.NEURAL_SUPABASE_URL;
  const key = env.NEURAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("NEURAL_SUPABASE_URL/NEURAL_SUPABASE_SERVICE_ROLE_KEY ausentes em llm-active-brain/.env");
  const out = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const q = new URLSearchParams({
      select: "timestamp,open,high,low,close,volume",
      asset_symbol: `eq.${symbol}`,
      timeframe: `eq.${tf}`,
      order: "timestamp.asc",
      limit: String(page),
      offset: String(offset),
    });
    q.append("timestamp", `gte.${new Date(fromMs).toISOString()}`);
    q.append("timestamp", `lt.${new Date(toMs).toISOString()}`);
    const res = await fetch(`${base}/rest/v1/ohlcv_data?${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
    const rows = await res.json();
    for (const r of rows) out.push({ t: Date.parse(r.timestamp), o: +r.open, h: +r.high, l: +r.low, c: +r.close, v: +(r.volume ?? 0) });
    if (rows.length < page) break;
  }
  return out;
}

/** Candles ordenados e sem duplicata, [fromMs, toMs). */
export async function loadCandles(symbol, tf, fromMs, toMs) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${symbol}_${tf}_${fromMs}_${toMs}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const raw = BINANCE[symbol]
    ? await fetchBinance(BINANCE[symbol], tf, fromMs, toMs)
    : await fetchSupabase(symbol, tf === "1h" ? "1h" : tf, fromMs, toMs);
  const byT = new Map();
  for (const c of raw) if ([c.o, c.h, c.l, c.c].every(Number.isFinite)) byT.set(c.t, c);
  const candles = [...byT.values()].sort((a, b) => a.t - b.t);
  fs.writeFileSync(file, JSON.stringify(candles));
  return candles;
}

export function dataSource(symbol) {
  return BINANCE[symbol] ? `Binance ${BINANCE[symbol]}` : "ohlcv_data (MetaAPI arquivado pelo motor)";
}
