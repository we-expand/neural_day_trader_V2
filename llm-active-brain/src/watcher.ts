// 🔴 2026-09-23 (pedido do Cleber: a IA "esta morosa" -- um ciclo do LLM leva
// ~16min pra olhar 7 ativos em serie, e um humano nao consegue vigiar todos
// ao mesmo tempo, a IA deveria): VIGIA MECANICO da cesta inteira.
//
// FASE 1 (sempre ativa) = observador: registra gatilhos e o resultado. FASE 2
// (pedido do Cleber: "nao e so olhar, e olhar e entender... bidar") = cada
// gatilho aciona uma analise FOCADA do LLM so naquele ativo (llmQueue.ts +
// index.ts). O vigia em si nunca abre/fecha posicao; quem decide e o LLM, com
// TODAS as travas de open_position intactas.
// (Texto original da Fase 1:) Nao chama LLM, nao abre nem fecha posicao, nao muda
// nenhuma decisao do motor. A cada poucos segundos varre a cesta ativa e
// registra em ledger/watcher_events.jsonl cada GATILHO tecnico (preco cruzou
// EMA9/SMA20, MACD cruzou, Estocastico cruzou), e depois (+5/+15/+30min) o
// que o preco realmente fez. Objetivo: PROVAR com dado real se o vigia pega
// os movimentos antes de ligar isto ao LLM (Fase 2, acionar o LLM so pro ativo
// que disparou). Sem essa prova nao ha razao pra ligar -- mesma disciplina do
// resto do projeto (nada de alegar edge sem medir).
//
// Custo controlado: preco vem de 1 requisicao em lote (primeQuotes); os
// indicadores usam os MESMOS candles em cache do resto do motor e so sao
// recalculados a cada INDICATOR_REFRESH_MS por simbolo, em serie, pra nunca
// reintroduzir o rate-limit cronico da MetaAPI compartilhada.
import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getMacd, getMovingAverageDistance, getSlowStochastic } from "./atr.js";
import { MT5_ASSET_BASKET, isSymbolTradable } from "./assetBasket.js";
import { getQuote, primeQuotes } from "./mt5Broker.js";
import { enqueueTrigger } from "./llmQueue.js";
import { listEligibleMt5Sessions, getUserTradingConfig } from "./neuralBridge.js";

const TICK_MS = 20_000;
const INDICATOR_REFRESH_MS = 60_000;
const SYMBOLS_REFRESH_MS = 5 * 60_000;
const TRIGGER_COOLDOWN_MS = 5 * 60_000;
const CROSS_DEADBAND_PCT = 0.01; // ignora oscilacao de <0,01% colada na media (ruido, nao cruzamento)
const OUTCOME_HORIZONS_MIN = [5, 15, 30];
const LLM_SYMBOL_COOLDOWN_MS = 3 * 60_000; // no maximo 1 analise focada por ativo a cada 3min
const llmLastAt = new Map<string, number>();
// Fase 2: gatilho aciona analise focada do LLM naquele ativo. Desliga com WATCHER_LLM_ENABLED=false (volta a ser so observador).
const LLM_ENABLED = process.env.WATCHER_LLM_ENABLED !== "false";
let onTrigger: (() => void) | undefined;

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = join(__dirname, "..", "ledger");
const EVENTS_FILE = join(LEDGER_DIR, "watcher_events.jsonl");

type Direction = "UP" | "DOWN";

interface SymbolState {
  ema9: number | null;
  sma20: number | null;
  indicatorsAt: number;
  lastSideEma9: Direction | null;
  lastSideSma20: Direction | null;
  lastTriggerAt: Map<string, number>;
}

interface PendingOutcome {
  id: string;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  dueAt: number;
  horizonMin: number;
}

const states = new Map<string, SymbolState>();
const pending: PendingOutcome[] = [];
let symbols: string[] = [];
let symbolsAt = 0;
let busy = false;
let timer: ReturnType<typeof setInterval> | undefined;

function write(record: Record<string, unknown>): void {
  try {
    mkdirSync(LEDGER_DIR, { recursive: true });
    appendFileSync(EVENTS_FILE, JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
  } catch (err) {
    console.error("[watcher] falha ao gravar evento:", err instanceof Error ? err.message : err);
  }
}

async function refreshSymbols(): Promise<void> {
  if (symbols.length > 0 && Date.now() - symbolsAt < SYMBOLS_REFRESH_MS) return;
  const set = new Set<string>();
  try {
    const sessions = await listEligibleMt5Sessions();
    for (const s of sessions) {
      const cfg = await getUserTradingConfig(s.userId, MT5_ASSET_BASKET);
      for (const sym of cfg?.activeAssets ?? MT5_ASSET_BASKET) set.add(sym);
    }
  } catch (err) {
    console.error("[watcher] falha ao resolver cesta ativa:", err instanceof Error ? err.message : err);
  }
  if (set.size > 0) {
    symbols = Array.from(set);
    symbolsAt = Date.now();
  }
}

function getState(symbol: string): SymbolState {
  let s = states.get(symbol);
  if (!s) {
    s = { ema9: null, sma20: null, indicatorsAt: 0, lastSideEma9: null, lastSideSma20: null, lastTriggerAt: new Map() };
    states.set(symbol, s);
  }
  return s;
}

function fire(symbol: string, price: number, trigger: string, direction: Direction, state: SymbolState): void {
  const key = `${trigger}`;
  const last = state.lastTriggerAt.get(key) ?? 0;
  if (Date.now() - last < TRIGGER_COOLDOWN_MS) return;
  state.lastTriggerAt.set(key, Date.now());
  const id = `${symbol}-${trigger}-${Date.now()}`;
  write({ type: "trigger", id, symbol, trigger, direction, price });
  console.log(`[watcher] GATILHO ${symbol} ${trigger} (${direction}) @ ${price}`);
  if (LLM_ENABLED && Date.now() - (llmLastAt.get(symbol) ?? 0) >= LLM_SYMBOL_COOLDOWN_MS) {
    llmLastAt.set(symbol, Date.now());
    enqueueTrigger({ symbol, trigger, direction, price, at: Date.now() });
    onTrigger?.();
  }
  for (const horizonMin of OUTCOME_HORIZONS_MIN) {
    pending.push({ id, symbol, direction, entryPrice: price, dueAt: Date.now() + horizonMin * 60_000, horizonMin });
  }
}

async function refreshIndicators(symbol: string, price: number, state: SymbolState): Promise<void> {
  const [ma, macd, stoch] = await Promise.all([
    getMovingAverageDistance(symbol, "5m").catch(() => null),
    getMacd(symbol, "5m").catch(() => null),
    getSlowStochastic(symbol, "5m").catch(() => null),
  ]);
  state.indicatorsAt = Date.now();
  if (ma) {
    state.ema9 = ma.ema9;
    state.sma20 = ma.sma20;
  }
  if (macd?.crossing) {
    fire(symbol, price, `MACD_${macd.crossing}`, macd.crossing === "CRUZOU_PARA_CIMA" ? "UP" : "DOWN", state);
  }
  if (stoch?.crossing) {
    fire(symbol, price, `STOCH_${stoch.crossing}`, stoch.crossing === "CRUZOU_PARA_CIMA" ? "UP" : "DOWN", state);
  }
}

function checkMaCross(symbol: string, price: number, state: SymbolState): void {
  const levels: Array<["EMA9" | "SMA20", number | null]> = [
    ["EMA9", state.ema9],
    ["SMA20", state.sma20],
  ];
  for (const [name, level] of levels) {
    if (level == null || !(level > 0)) continue;
    const distPct = ((price - level) / level) * 100;
    if (Math.abs(distPct) < CROSS_DEADBAND_PCT) continue;
    const side: Direction = distPct > 0 ? "UP" : "DOWN";
    const prev = name === "EMA9" ? state.lastSideEma9 : state.lastSideSma20;
    if (name === "EMA9") state.lastSideEma9 = side;
    else state.lastSideSma20 = side;
    if (prev && prev !== side) fire(symbol, price, `PRICE_CROSS_${name}_${side}`, side, state);
  }
}

async function resolveOutcomes(): Promise<void> {
  const now = Date.now();
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i];
    if (p.dueAt > now) continue;
    pending.splice(i, 1);
    const q = await getQuote(p.symbol).catch(() => null);
    if (!q || q.stale) {
      write({ type: "outcome", id: p.id, symbol: p.symbol, horizonMin: p.horizonMin, unresolved: "cotacao indisponivel/obsoleta" });
      continue;
    }
    const rawMovePct = ((q.price - p.entryPrice) / p.entryPrice) * 100;
    // movePct > 0 = preco andou NO SENTIDO do gatilho (UP sobe / DOWN cai).
    const movePct = p.direction === "UP" ? rawMovePct : -rawMovePct;
    write({ type: "outcome", id: p.id, symbol: p.symbol, horizonMin: p.horizonMin, exitPrice: q.price, movePct: Number(movePct.toFixed(4)) });
  }
}

async function tick(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await refreshSymbols();
    const active = symbols.filter((s) => isSymbolTradable(s));
    if (active.length === 0) return;
    await primeQuotes(active);
    for (const symbol of active) {
      const q = await getQuote(symbol).catch(() => null);
      if (!q || q.stale) continue;
      const state = getState(symbol);
      if (Date.now() - state.indicatorsAt >= INDICATOR_REFRESH_MS) {
        await refreshIndicators(symbol, q.price, state);
      }
      checkMaCross(symbol, q.price, state);
    }
    await resolveOutcomes();
  } catch (err) {
    console.error("[watcher] erro no tick:", err instanceof Error ? err.message : err);
  } finally {
    busy = false;
  }
}

export function startMarketWatcher(drain?: () => void): void {
  if (timer) return;
  onTrigger = drain;
  console.log(`[watcher] vigia mecanico ligado (LLM focado por gatilho: ${LLM_ENABLED}) -- varre a cesta a cada ${TICK_MS / 1000}s, grava em ledger/watcher_events.jsonl`);
  timer = setInterval(() => void tick(), TICK_MS);
  void tick();
}
