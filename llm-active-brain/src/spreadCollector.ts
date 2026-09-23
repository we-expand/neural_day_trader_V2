/**
 * Coletor de spread REAL do mercado (bid/ask do feed da corretora), a cada 5 min.
 * Grava em `market_spread_samples` e recarrega a mediana de 7 dias em memória
 * (`research/MeasuredSpreads.ts`) — é dela que sai o custo (commissionModel.ts).
 * Ver research/COST_SOURCE_OF_TRUTH.md.
 *
 * BTCUSD é roteado pra Binance no servidor (spread ~0,00001%, não é o da
 * corretora); o spread real de BTC vem do proxy BTCEUR (mesmo instrumento, mesma
 * corretora) e é gravado sob 'BTCUSD' com source 'proxy:BTCEUR'.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { setMeasuredSpreads, parseSpreadRow } from "../../research/MeasuredSpreads.ts";

const supa = () => createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);
const SAMPLE_INTERVAL_MS = 5 * 60_000;
const RETENTION_DAYS = 30;
const SYMBOLS = [
  "XETUSD", "DOGUSD", "DOTUSD", "XRPUSD", "SOLUSD", "ADAUSD", "LNKUSD", "UNIUSD", "TRXUSD", "ATMUSD", "XLMUSD",
  "FILUSD", "BNBUSD", "AVAUSD", "BTCEUR", "XAUUSD", "UKOUSD", "GER40", "SPX500", "NAS100", "UK100", "FRA40",
  "AUS200", "JPN225", "HKG33", "CHINA50", "EURUSD", "USDJPY", "AUDUSD", "NZDUSD", "AUDJPY", "NZDJPY", "USDCNH",
  "USDSGD", "USDTWD",
];

async function reload(): Promise<void> {
  const { data, error } = await supa().from("market_spread_current").select("*");
  if (error) throw error;
  setMeasuredSpreads((data ?? []).map(parseSpreadRow).filter((r): r is NonNullable<typeof r> => !!r));
}

async function sample(): Promise<void> {
  const res = await fetch(`${config.neuralSupabaseUrl}/functions/v1/server/mt5-prices`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.neuralSupabaseAnonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ symbols: SYMBOLS }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`mt5-prices HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.source === "SIMULATED" || !Array.isArray(json?.prices)) throw new Error("cotacao simulada/invalida");
  const rows: any[] = [];
  for (const t of json.prices) {
    if (!t?.symbol || !(t.bid > 0) || !(t.ask > 0) || t.ask < t.bid) continue;
    const spread_pct = ((t.ask - t.bid) / t.bid) * 100;
    if (t.symbol === "BTCEUR") rows.push({ symbol: "BTCUSD", bid: t.bid, ask: t.ask, spread_pct, source: "proxy:BTCEUR" });
    rows.push({ symbol: t.symbol, bid: t.bid, ask: t.ask, spread_pct, source: "broker_tick" });
  }
  if (rows.length === 0) return;
  const { error } = await supa().from("market_spread_samples").insert(rows);
  if (error) throw error;
}

async function cleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await supa().from("market_spread_samples").delete().lt("ts", cutoff);
}

let ticks = 0;
async function tick(): Promise<void> {
  try {
    await sample();
    await reload();
    if (++ticks % 288 === 0) await cleanup(); // ~1x/dia
  } catch (err) {
    console.warn("[spreadCollector] falha (custo cai na tabela estática até voltar):", err instanceof Error ? err.message : err);
  }
}

export function startSpreadCollector(): void {
  void reload().catch(() => {}); // carrega o que já existe antes da 1ª amostra
  void tick();
  setInterval(() => void tick(), SAMPLE_INTERVAL_MS);
}
