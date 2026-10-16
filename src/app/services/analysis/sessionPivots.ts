/**
 * Pivôs clássicos do último pregão concluído -- as "resistências pesadas" que o Cleber vê no MT5.
 *
 * Origem (2026-10-08, print do MT5 dele): o indicador Order Block Finder 3.08 desenha, além das zonas de
 * order block, as linhas de pivô do último pregão concluído (ShowPivot=true, pivotTime=LastCompletedSession;
 * resistências em vermelho, suportes em verde, pivô em prata). A resistência de 106,254 do UKOUSD que ele
 * apontou é a R1. Fórmula clássica de piso (a mesma que reproduz as 7 linhas do print dentro de ±0,03):
 *   P  = (H + L + C) / 3
 *   R1 = 2P - L      S1 = 2P - H
 *   R2 = P + (H - L) S2 = P - (H - L)
 *   R3 = H + 2(P - L) S3 = L - 2(H - P)
 *
 * H, L e C são a máxima, a mínima e o fechamento do pregão. O que falta é a definição do pregão POR ATIVO:
 * pelo print do UKOUSD, o pregão vai de 22:00 do servidor do MT5 (19:00 UTC no horário de verão americano)
 * de um dia a 22:00 do dia seguinte -- a máxima, a mínima e o fechamento (vela de 1H das 18:00 UTC) batem.
 * Só o UKOUSD está CALIBRADO. Os demais usam a virada padrão do dia do servidor (00:00) e saem marcados como
 * `calibrated: false` -- o gráfico mostra com asterisco, e a IA NÃO deve usar um nível não calibrado.
 *
 * O servidor do MT5 segue o horário de verão dos EUA: GMT+3 de 2º domingo de março a 1º domingo de novembro,
 * GMT+2 no resto -- então a virada em UTC se desloca 1h no inverno.
 *
 * Arquivo puro (sem rede, sem React): o gráfico do app e, depois, o motor importam daqui, pra os dois verem
 * exatamente os mesmos níveis.
 */

export interface PivotCandle {
  /** Início da vela, em ms UTC. */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ClassicPivots {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface SessionPivotsResult {
  pivots: ClassicPivots;
  /** Máxima, mínima e fechamento do pregão usados. */
  high: number;
  low: number;
  close: number;
  /** Janela do pregão em ms UTC: [sessionStart, sessionEnd). */
  sessionStart: number;
  sessionEnd: number;
  candlesUsed: number;
  /** true só quando a virada do pregão deste ativo foi conferida contra o MT5 do Cleber. */
  calibrated: boolean;
}

/** Hora do servidor do MT5 em que o pregão vira, por ativo. Só entra aqui o que foi conferido contra o MT5. */
export const PIVOT_SESSION_ROLLOVER_SERVER_HOUR: Record<string, number> = {
  UKOUSD: 22,
};

/** Virada padrão para ativo ainda não calibrado: 00:00 do servidor (barra diária padrão do MT5). */
export const DEFAULT_PIVOT_ROLLOVER_SERVER_HOUR = 0;

const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const MIN_CANDLES_PER_SESSION = 6;
const MAX_SESSIONS_BACK = 5; // pula fim de semana/feriado sem candles suficientes

export function computeClassicPivots(high: number, low: number, close: number): ClassicPivots {
  const pivot = (high + low + close) / 3;
  return {
    pivot,
    r1: 2 * pivot - low,
    s1: 2 * pivot - high,
    r2: pivot + (high - low),
    s2: pivot - (high - low),
    r3: high + 2 * (pivot - low),
    s3: low - 2 * (high - pivot),
  };
}

/** n-ésimo domingo (1 = primeiro) do mês (0-11) do ano, à meia-noite UTC. */
function nthSundayUtc(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1));
  const offsetToSunday = (7 - first.getUTCDay()) % 7;
  return Date.UTC(year, month, 1 + offsetToSunday + (n - 1) * 7);
}

/** Horário de verão dos EUA (segue o servidor do MT5): 2º domingo de março até o 1º domingo de novembro. */
export function usDstActive(utcMs: number): boolean {
  const year = new Date(utcMs).getUTCFullYear();
  return utcMs >= nthSundayUtc(year, 2, 2) && utcMs < nthSundayUtc(year, 10, 1);
}

/** Deslocamento do servidor do MT5 em relação ao UTC, em horas (+3 no verão americano, +2 no resto). */
export function brokerServerOffsetHours(utcMs: number): number {
  return usDstActive(utcMs) ? 3 : 2;
}

/** Instante UTC (ms) da virada do pregão que cai na data UTC de `dayUtcMidnightMs`. */
function rolloverBoundaryUtc(dayUtcMidnightMs: number, rolloverServerHour: number): number {
  const offset = brokerServerOffsetHours(dayUtcMidnightMs + 12 * HOUR_MS);
  return dayUtcMidnightMs + (rolloverServerHour - offset) * HOUR_MS;
}

export function sessionRolloverServerHour(symbol: string): { hour: number; calibrated: boolean } {
  const hour = PIVOT_SESSION_ROLLOVER_SERVER_HOUR[symbol.toUpperCase()];
  return hour === undefined ? { hour: DEFAULT_PIVOT_ROLLOVER_SERVER_HOUR, calibrated: false } : { hour, calibrated: true };
}

/**
 * Pivôs clássicos do último pregão concluído a partir de velas de 1H (ou menores).
 * Devolve null quando não há candles suficientes em nenhum dos últimos pregões (nunca inventa nível).
 */
export function lastCompletedSessionPivots(
  candles: PivotCandle[],
  symbol: string,
  nowMs: number,
): SessionPivotsResult | null {
  const valid = candles
    .filter((c) => [c.timestamp, c.high, c.low, c.close].every(Number.isFinite) && c.high >= c.low)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (valid.length < MIN_CANDLES_PER_SESSION) return null;

  const { hour, calibrated } = sessionRolloverServerHour(symbol);
  const todayMidnight = Math.floor(nowMs / DAY_MS) * DAY_MS;
  // Viradas candidatas, da mais recente que já passou para trás.
  const boundaries: number[] = [];
  for (let d = todayMidnight + DAY_MS; d >= todayMidnight - (MAX_SESSIONS_BACK + 2) * DAY_MS; d -= DAY_MS) {
    const b = rolloverBoundaryUtc(d, hour);
    if (b <= nowMs) boundaries.push(b);
  }
  boundaries.sort((a, b) => b - a);

  for (let k = 0; k < MAX_SESSIONS_BACK && k + 1 < boundaries.length; k++) {
    const end = boundaries[k];
    const start = boundaries[k + 1];
    const inSession = valid.filter((c) => c.timestamp >= start && c.timestamp < end);
    if (inSession.length < MIN_CANDLES_PER_SESSION) continue;
    const high = Math.max(...inSession.map((c) => c.high));
    const low = Math.min(...inSession.map((c) => c.low));
    const close = inSession[inSession.length - 1].close;
    return {
      pivots: computeClassicPivots(high, low, close),
      high,
      low,
      close,
      sessionStart: start,
      sessionEnd: end,
      candlesUsed: inSession.length,
      calibrated,
    };
  }
  return null;
}
