/**
 * Virada do dia do MT5 (2026-11-13, pedido do Cleber).
 *
 * Regra dele: quando o ativo "zera o dia", a chance de comecar o dia seguinte
 * para o lado oposto ao do dia que acabou e grande (efeito bolinha de tenis),
 * entao o motor nao deve estar posicionado nessa hora: fecha o que e do motor
 * antes da virada e nao abre nada ate passar um tempo depois dela.
 *
 * Que "dia"? O mesmo que o grafico do MT5 mostra, igual para TODOS os ativos
 * (inclusive cripto): a vela D1 da corretora abre as 17:00 de Nova York
 * (medido em 13/11/2026: velas de 4H abrem 22:00/02:00/... UTC = 00:00 do
 * servidor, e o relogio acompanha o horario de verao dos EUA). Por isso o
 * calculo usa America/New_York e nao um horario UTC/Brasilia fixo.
 *
 * Isto e regra de operacao pedida pelo Cleber, ainda sem validacao
 * estatistica propria. Rollback: DAY_ROLLOVER_FLAT_ACTIVE=false.
 */
import { config } from "./config.js";

const ROLLOVER_MIN_NY = 17 * 60; // 17:00 America/New_York

function nyMinutesOfDay(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return get("hour") * 60 + get("minute");
}

export type DayRolloverStatus = {
  /** BEFORE = faltam poucos minutos para a virada; AFTER = a virada acabou de passar; null = fora da janela. */
  phase: "BEFORE" | "AFTER" | null;
  /** Minutos ate a proxima virada (0..1439). */
  minutesToRollover: number;
  /** Minutos desde a ultima virada (0..1439). */
  minutesSinceRollover: number;
};

export function getDayRolloverStatus(now: Date = new Date()): DayRolloverStatus {
  const m = nyMinutesOfDay(now);
  const minutesToRollover = (ROLLOVER_MIN_NY - m + 1440) % 1440;
  const minutesSinceRollover = (m - ROLLOVER_MIN_NY + 1440) % 1440;
  let phase: DayRolloverStatus["phase"] = null;
  if (config.dayRolloverFlatActive) {
    if (minutesToRollover > 0 && minutesToRollover <= config.dayRolloverMinutesBefore) phase = "BEFORE";
    else if (minutesSinceRollover < config.dayRolloverMinutesAfter) phase = "AFTER";
  }
  return { phase, minutesToRollover, minutesSinceRollover };
}
