/**
 * Perfil do dia e do ativo para o agente de alvo (targetCalculator.ts) -- 16/10, pedido do Cleber.
 *
 * Mede, so com velas reais (1H e 15m, getDeepCandles): o tamanho tipico das PERNADAS, a volatilidade media, quanto
 * do range diario normal (ADR) o dia ja consumiu e a retracao de Fibonacci DIARIA (maxima x minima das ultimas 24h).
 * Funcao pura em `computeDayProfile`; sem vela suficiente devolve null e o alvo segue so pelos niveis.
 *
 * Os limiares (pernada = 3x o range medio da vela de 15m; teto do alvo = 0,8x a pernada tipica) sao JULGAMENTO
 * operacional do Cleber, nao foram validados estatisticamente. Nao promete edge: so impede alvo maior que o espaco
 * que o proprio ativo costuma andar.
 */
import { getDeepCandles } from "./atr.js";
import type { TargetBarrierInput } from "./targetCalculator.js";

export interface ProfileCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface FibDailyLevel {
  nome: string;
  price: number;
}

export interface DayProfile {
  /** Range diario medio (%) dos ~7 dias anteriores, em blocos de 24 velas de 1H. null = pouca historia. */
  adrPct: number | null;
  /** Range das ultimas 24h (%). */
  dayRangePct: number;
  /** dayRangePct / adrPct (1,0 = o dia ja andou o range normal). */
  dayConsumed: number | null;
  /** Variacao do fechamento atual contra a abertura de 24h atras (%). */
  dayChangePct: number;
  /** 0 = na minima das 24h, 1 = na maxima. */
  positionInRange: number;
  /** Range medio (%) por vela: volatilidade media. */
  avgRange1hPct: number;
  avgRange15mPct: number;
  /** Mediana das pernadas (%) medidas em 15m (zigzag). null = menos de 3 pernadas. */
  medianLegUpPct: number | null;
  medianLegDownPct: number | null;
  legsMeasured: number;
  /** Pernadas curtas (reversao 1,5x), a escala do scalp. */
  medianShortLegUpPct: number | null;
  medianShortLegDownPct: number | null;
  /** Perna do dia (da maxima para a minima ou vice-versa, a que veio por ultimo). */
  dayLeg: "ALTA" | "BAIXA";
  high24: number;
  low24: number;
  /** Retracoes (so informativas) e extensoes alem do extremo, na direcao da perna do dia. */
  retracements: FibDailyLevel[];
  extensions: FibDailyLevel[];
  /** Em que retracao (0-1) o preco esta da perna do dia. */
  retraceRatio: number;
  price: number;
  texto: string;
}

export const LEG_REVERSAL_RANGE_MULT = 3;
/** Pernada CURTA (scalp): reversao de 1,5x o range medio da vela de 15m. */
export const SHORT_LEG_REVERSAL_RANGE_MULT = 1.5;
const FIB_RETRACE = [0.236, 0.382, 0.5, 0.618, 0.786];
const FIB_EXT = [1.272, 1.618];

const pct = (v: number, d = 3) => `${v.toFixed(d)}%`;

function meanRangePct(c: ProfileCandle[]): number {
  const v = c.filter((x) => x.close > 0 && Number.isFinite(x.high) && Number.isFinite(x.low)).map((x) => ((x.high - x.low) / x.close) * 100);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function median(v: number[]): number | null {
  if (v.length < 3) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Zigzag por reversao minima em % do preco. Devolve o tamanho (%) de cada perna completa. */
export function zigzagLegs(c: ProfileCandle[], reversalPct: number): { dir: "UP" | "DOWN"; pct: number }[] {
  if (c.length < 5 || reversalPct <= 0) return [];
  const legs: { dir: "UP" | "DOWN"; pct: number }[] = [];
  let pivot = c[0].close;
  let ext = c[0].close;
  let dir: "UP" | "DOWN" | null = null;
  for (const k of c) {
    if (dir === null) {
      if ((k.high - pivot) / pivot * 100 >= reversalPct) { dir = "UP"; ext = k.high; }
      else if ((pivot - k.low) / pivot * 100 >= reversalPct) { dir = "DOWN"; ext = k.low; }
    } else if (dir === "UP") {
      if (k.high > ext) ext = k.high;
      else if ((ext - k.low) / ext * 100 >= reversalPct) {
        legs.push({ dir: "UP", pct: ((ext - pivot) / pivot) * 100 });
        pivot = ext; ext = k.low; dir = "DOWN";
      }
    } else {
      if (k.low < ext) ext = k.low;
      else if ((k.high - ext) / ext * 100 >= reversalPct) {
        legs.push({ dir: "DOWN", pct: ((pivot - ext) / pivot) * 100 });
        pivot = ext; ext = k.high; dir = "UP";
      }
    }
  }
  return legs;
}

export function computeDayProfile(h1: ProfileCandle[], m15: ProfileCandle[], price: number): DayProfile | null {
  if (h1.length < 30 || m15.length < 60 || !(price > 0)) return null;
  const day = h1.slice(-24);
  const high24 = Math.max(...day.map((x) => x.high));
  const low24 = Math.min(...day.map((x) => x.low));
  if (!(high24 > low24) || !(low24 > 0)) return null;
  const idxHigh = day.findIndex((x) => x.high === high24);
  const idxLow = day.findIndex((x) => x.low === low24);
  const dayLeg: "ALTA" | "BAIXA" = idxLow < idxHigh ? "ALTA" : "BAIXA"; // o extremo que veio por ultimo fecha a perna
  const range = high24 - low24;
  const dayRangePct = (range / price) * 100;

  // ADR: blocos de 24 velas anteriores ao dia atual
  const adrBlocks: number[] = [];
  for (let end = h1.length - 24; end - 24 >= 0 && adrBlocks.length < 7; end -= 24) {
    const b = h1.slice(end - 24, end);
    const bh = Math.max(...b.map((x) => x.high));
    const bl = Math.min(...b.map((x) => x.low));
    if (bl > 0) adrBlocks.push(((bh - bl) / b[b.length - 1].close) * 100);
  }
  const adrPct = adrBlocks.length >= 3 ? adrBlocks.reduce((a, b) => a + b, 0) / adrBlocks.length : null;

  const avgRange15mPct = meanRangePct(m15);
  const avgRange1hPct = meanRangePct(h1.slice(-72));
  const legs = zigzagLegs(m15, avgRange15mPct * LEG_REVERSAL_RANGE_MULT);
  const shortLegs = zigzagLegs(m15, avgRange15mPct * SHORT_LEG_REVERSAL_RANGE_MULT);
  const medianShortLegUpPct = median(shortLegs.filter((l) => l.dir === "UP").map((l) => l.pct));
  const medianShortLegDownPct = median(shortLegs.filter((l) => l.dir === "DOWN").map((l) => l.pct));
  const medianLegUpPct = median(legs.filter((l) => l.dir === "UP").map((l) => l.pct));
  const medianLegDownPct = median(legs.filter((l) => l.dir === "DOWN").map((l) => l.pct));

  // Fibonacci diario: retracao medida a partir do extremo que fechou a perna
  const retracements: FibDailyLevel[] = FIB_RETRACE.map((r) => ({
    nome: `retração ${(r * 100).toFixed(1)}%`,
    price: dayLeg === "ALTA" ? high24 - r * range : low24 + r * range,
  }));
  const extensions: FibDailyLevel[] = FIB_EXT.map((r) => ({
    nome: `extensão ${(r * 100).toFixed(1)}%`,
    price: dayLeg === "ALTA" ? low24 + r * range : high24 - r * range,
  }));
  const retraceRatio = dayLeg === "ALTA" ? (high24 - price) / range : (price - low24) / range;
  const positionInRange = (price - low24) / range;
  const dayChangePct = ((price - day[0].open) / day[0].open) * 100;

  const dayConsumed = adrPct ? dayRangePct / adrPct : null;
  const texto = [
    `Perna do dia: ${dayLeg} (24h: máx ${high24}, mín ${low24}; range ${pct(dayRangePct, 2)}${adrPct ? `, o normal do ativo é ${pct(adrPct, 2)} -> o dia já andou ${(dayConsumed! * 100).toFixed(0)}% do normal` : ""}). Variação 24h ${dayChangePct >= 0 ? "+" : ""}${dayChangePct.toFixed(2)}%.`,
    `Preço na retração de ${(retraceRatio * 100).toFixed(0)}% da perna do dia (${positionInRange < 0.25 ? "perto da mínima" : positionInRange > 0.75 ? "perto da máxima" : "no meio do range"}).`,
    `Volatilidade média: vela de 15m ${pct(avgRange15mPct)}, vela de 1H ${pct(avgRange1hPct)}.`,
    `Pernadas CURTAS de 15m (scalp, ${shortLegs.length} medidas): mediana de alta ${medianShortLegUpPct != null ? pct(medianShortLegUpPct) : "sem dado"}, de baixa ${medianShortLegDownPct != null ? pct(medianShortLegDownPct) : "sem dado"}.`,
    `Pernadas de 15m (${legs.length} medidas, reversão ≥ ${pct(avgRange15mPct * LEG_REVERSAL_RANGE_MULT)}): mediana de alta ${medianLegUpPct != null ? pct(medianLegUpPct) : "sem dado"}, de baixa ${medianLegDownPct != null ? pct(medianLegDownPct) : "sem dado"}.`,
  ].join(" ");

  return {
    adrPct, dayRangePct, dayConsumed, dayChangePct, positionInRange, avgRange1hPct, avgRange15mPct,
    medianLegUpPct, medianLegDownPct, legsMeasured: legs.length, medianShortLegUpPct, medianShortLegDownPct, dayLeg, high24, low24, retracements, extensions,
    retraceRatio, price, texto,
  };
}

export async function getDayProfile(symbol: string, price: number): Promise<DayProfile | null> {
  const [h1, m15] = await Promise.all([getDeepCandles(symbol, "1H", 300), getDeepCandles(symbol, "15m", 300)]);
  if (!h1 || !m15) return null;
  return computeDayProfile(h1 as ProfileCandle[], m15 as ProfileCandle[], price);
}

/**
 * Barreiras do Fibonacci diario para o lado do trade. A favor da perna do dia (LONG em perna de ALTA, SHORT em BAIXA)
 * so as EXTENSOES alem do extremo contam (o proprio extremo ja e barreira de 24h); contra a perna, as RETRACOES a frente.
 */
export function fibDailyBarriers(profile: DayProfile, side: "LONG" | "SHORT"): TargetBarrierInput[] {
  const aligned = (side === "LONG") === (profile.dayLeg === "ALTA");
  const levels = aligned ? profile.extensions : profile.retracements;
  const out: TargetBarrierInput[] = [];
  for (const l of levels) {
    const dist = side === "LONG" ? ((l.price - profile.price) / profile.price) * 100 : ((profile.price - l.price) / profile.price) * 100;
    if (dist > 0) out.push({ nome: `Fibonacci diário ${l.nome} (${l.price.toFixed(2)})`, distanciaPct: dist, rompido: false });
  }
  return out;
}

/** Tetos de alvo (fracao do preco) vindos do perfil: pernada tipica e espaco que o dia ainda tem. */
export function profileTargetCaps(profile: DayProfile, side: "LONG" | "SHORT", legFraction = 0.6, scalp = false): { nome: string; targetPct: number }[] {
  const caps: { nome: string; targetPct: number }[] = [];
  if (scalp) {
    // Scalp (Setup POUCOS): o alvo ocupa ~`legFraction` vela de 15m de range medio (minutos a ~1h), nao uma pernada.
    if (profile.avgRange15mPct > 0) caps.push({ nome: `scalp: ${legFraction}x o range médio da vela de 15m (${profile.avgRange15mPct.toFixed(3)}%)`, targetPct: (legFraction * profile.avgRange15mPct) / 100 });
  } else {
    const leg = side === "LONG" ? profile.medianLegUpPct : profile.medianLegDownPct;
    if (leg != null && leg > 0) caps.push({ nome: `${legFraction}x a pernada típica de ${side === "LONG" ? "alta" : "baixa"} (${leg.toFixed(3)}%)`, targetPct: (leg * legFraction) / 100 });
  }
  if (profile.adrPct) {
    // espaco que o range normal do dia ainda deixa na direcao do trade
    const adrAbs = (profile.adrPct / 100) * profile.price;
    const room = side === "LONG" ? profile.low24 + adrAbs - profile.price : profile.price - (profile.high24 - adrAbs);
    const floorRoom = 0.25 * adrAbs; // dia ja esgotado nao zera o alvo: piso de 25% do range normal
    caps.push({ nome: `espaço que o range normal do dia ainda deixa (${profile.adrPct.toFixed(2)}% de ADR)`, targetPct: Math.max(room, floorRoom) / profile.price });
  }
  return caps;
}
