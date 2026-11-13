/**
 * Tick em tempo real vindo do `streaming-relay` (MetaAPI streaming -> canal
 * Supabase Realtime `turbo-main-channel`, evento `price-update`).
 *
 * Existe pra tirar o polling REST de `/mt5-prices` (1 `current-tick` por
 * simbolo) do caminho quente e aliviar o rate limit da conta MetaAPI
 * compartilhada. OPT-IN (STREAMING_TICKS_ENABLED=true): desligado, nada aqui
 * roda e o motor continua 100% REST como sempre.
 *
 * Regra de seguranca: este cache so responde enquanto o tick for RECENTE
 * (`maxAgeMs`). Feed parado = relay para de publicar = entrada envelhece =
 * `getStreamTick` devolve null e o chamador cai pro REST. Nunca serve preco
 * velho como se fosse vivo.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export interface StreamTick {
  price: number;
  bid: number;
  ask: number;
  /** Horario do tick na corretora (ISO), quando o relay mandou; senao o horario de recebimento. */
  timestamp: string;
  changePercent: number;
}

const ticks = new Map<string, { tick: StreamTick; receivedAtMs: number }>();
let started = false;

export const STREAM_TICK_MAX_AGE_MS = 5_000;

export function startStreamingTicks(): void {
  if (started || process.env.STREAMING_TICKS_ENABLED !== "true") return;
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseAnonKey) {
    console.warn("[streamingTicks] NEURAL_SUPABASE_URL/ANON_KEY ausentes -- streaming nao iniciado, segue REST.");
    return;
  }
  started = true;
  const supabase = createClient(config.neuralSupabaseUrl, config.neuralSupabaseAnonKey);
  supabase
    .channel("turbo-main-channel")
    .on("broadcast", { event: "price-update" }, ({ payload }: { payload: unknown }) => {
      const p = payload as Record<string, unknown> | undefined;
      const symbol = typeof p?.asset_symbol === "string" ? p.asset_symbol : null;
      const price = Number(p?.price);
      if (!symbol || !Number.isFinite(price) || price <= 0) return; // nunca aceita preco 0/invalido
      const bid = Number(p?.bid);
      const ask = Number(p?.ask);
      const tickTime = typeof p?.tick_time === "string" ? p.tick_time : typeof p?.timestamp === "string" ? p.timestamp : new Date().toISOString();
      ticks.set(symbol, {
        receivedAtMs: Date.now(),
        tick: {
          price,
          bid: Number.isFinite(bid) && bid > 0 ? bid : price,
          ask: Number.isFinite(ask) && ask > 0 ? ask : price,
          timestamp: tickTime,
          changePercent: Number(p?.change_percent_24h) || 0,
        },
      });
    })
    .subscribe((status: string) => console.log(`[streamingTicks] canal turbo-main-channel: ${status}`));
}

/** Ultimo tick do streaming, ou null se nao houver um recebido ha menos de `maxAgeMs`. */
export function getStreamTick(symbol: string, maxAgeMs: number = STREAM_TICK_MAX_AGE_MS): StreamTick | null {
  const entry = ticks.get(symbol);
  if (!entry || Date.now() - entry.receivedAtMs > maxAgeMs) return null;
  return entry.tick;
}
