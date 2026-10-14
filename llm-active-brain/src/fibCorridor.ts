/**
 * Corredor de Fibonacci (extensao) -- modulo de CALCULO, sem rede e sem efeito na mesa.
 *
 * Metodo do Cleber (14/10): em rompimento de topo/fundo o mercado entra em modo EXPANSAO e so o
 * Fibonacci mede ate onde vai. Desenha-se no 15m e, se o 15m esta para ser rompido no 161,8%,
 * redesenha-se no 1H (sempre 15m e 1H). Para uma queda:
 *   - perna = do TOPO anterior (A) ate o FUNDO rompido (B);
 *   - o nivel 0 fica em B e os degraus saem para BAIXO: B - r * (A - B), com r = 0,618 / 1 / 1,618.
 * Para uma alta, o espelho (0 no topo rompido, degraus para CIMA).
 *
 * Isto NAO preve nada: e um mapa de niveis. Ligar na mesa so depois de validar contra os desenhos
 * do Cleber e contra dados historicos (scripts/test-fib-corridor.ts).
 */

export interface FibCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const FIB_RATIOS = [0.618, 1, 1.618] as const;

export interface FibStep {
  ratio: number;
  price: number;
  /** o fechamento da ultima vela ja passou deste degrau no sentido da expansao */
  rompido: boolean;
}

export interface FibCorridor {
  tf: string;
  direcao: "BAIXA" | "ALTA";
  /** topo anterior (baixa) ou fundo anterior (alta): inicio da perna */
  pontoA: number;
  /** fundo rompido (baixa) ou topo rompido (alta): nivel 0 */
  pontoB: number;
  perna: number;
  degraus: FibStep[];
  /** primeiro degrau ainda nao rompido, ou null se todos foram */
  proximoDegrau: FibStep | null;
  /** distancia em % do preco atual ate o proximo degrau (sempre positiva) */
  distanciaProximoPct: number | null;
  /** o ultimo fechamento ja passou do 0 (esta dentro da expansao) */
  emExpansao: boolean;
  /** todos os degraus foram rompidos: redesenhar num tempo maior (ou refazer a perna) */
  redesenhar: boolean;
}

export interface FibOptions {
  tf: string;
  /** janela: so as ultimas N velas entram (15m: 96 = 24h; 1H: 120 = 5 dias) */
  window?: number;
  /** a primeira perna "termina" quando o preco devolve esta fracao dela (0,3 = 30%) */
  retrace?: number;
}

/** Niveis a partir das ancoras. baixa: B - r*(A-B); alta: B + r*(B-A). */
export function fibLevelsFromAnchors(direcao: "BAIXA" | "ALTA", pontoA: number, pontoB: number): { ratio: number; price: number }[] {
  const perna = Math.abs(pontoA - pontoB);
  return FIB_RATIOS.map((ratio) => ({
    ratio,
    price: direcao === "BAIXA" ? pontoB - ratio * perna : pontoB + ratio * perna,
  }));
}

/**
 * Perna de BAIXA a partir do topo da janela (A). B = o MENOR minimo depois de A que foi seguido de um repique
 * relevante (>= `retrace` da propria perna): o fundo "de verdade" (o que o mercado respeitou), nao um
 * minimo qualquer dentro do movimento. Os minimos mais recentes, ainda sem repique, ficam de fora: e o
 * rompimento deles que e a expansao. O espelho vale para ALTA (maior maximo seguido de recuo relevante).
 */
function primeiraPerna(c: FibCandle[], baixa: boolean, retrace: number): { ia: number; pontoA: number; ib: number; pontoB: number } | null {
  let ia = 0;
  for (let i = 1; i < c.length; i++) if (baixa ? c[i].high >= c[ia].high : c[i].low <= c[ia].low) ia = i;
  if (ia >= c.length - 2) return null; // o extremo e a vela atual: ainda nao ha perna
  const pontoA = baixa ? c[ia].high : c[ia].low;
  // melhor repique depois de cada vela (maxima futura para baixa, minima futura para alta)
  const fut: number[] = new Array(c.length);
  let acc = baixa ? -Infinity : Infinity;
  for (let i = c.length - 1; i >= 0; i--) {
    fut[i] = acc;
    acc = baixa ? Math.max(acc, c[i].high) : Math.min(acc, c[i].low);
  }
  let ib = -1;
  for (let i = ia + 1; i < c.length - 1; i++) {
    const ext = baixa ? c[i].low : c[i].high;
    const perna = Math.abs(pontoA - ext);
    const repique = baixa ? fut[i] - ext : ext - fut[i];
    if (perna > 0 && repique >= retrace * perna && (ib < 0 || (baixa ? ext < c[ib].low : ext > c[ib].high))) ib = i;
  }
  if (ib < 0) return null;
  return { ia, pontoA, ib, pontoB: baixa ? c[ib].low : c[ib].high };
}

/**
 * Corredor do rompimento mais recente: tenta a perna de BAIXA (topo da janela -> fundo da 1a perna) e a de ALTA
 * e fica com a que o preco atual JA ROMPEU (fechamento alem do 0). Se nenhuma foi rompida, null.
 * Velas em ordem cronologica; a ultima e a vela atual.
 */
export function computeFibCorridor(candles: FibCandle[], opts: FibOptions): FibCorridor | null {
  const win = opts.window ?? 96;
  const retrace = opts.retrace ?? 0.3;
  if (!candles || candles.length < 20) return null;
  const c = candles.slice(-win);
  const price = c[c.length - 1].close;

  const tenta = (baixa: boolean) => {
    const p = primeiraPerna(c, baixa, retrace);
    if (!p) return null;
    const perna = Math.abs(p.pontoA - p.pontoB);
    if (!(perna > 0)) return null;
    const rompeu = baixa ? price < p.pontoB : price > p.pontoB;
    return rompeu ? { ...p, perna, d: baixa ? ("BAIXA" as const) : ("ALTA" as const) } : null;
  };
  const b = tenta(true);
  const a = tenta(false);
  const e = b && a ? (b.ib >= a.ib ? b : a) : b ?? a;
  if (!e) return null;

  const degraus: FibStep[] = fibLevelsFromAnchors(e.d, e.pontoA, e.pontoB).map((l) => ({
    ...l,
    rompido: e.d === "BAIXA" ? price < l.price : price > l.price,
  }));
  const proximoDegrau = degraus.find((d) => !d.rompido) ?? null;
  return {
    tf: opts.tf,
    direcao: e.d,
    pontoA: e.pontoA,
    pontoB: e.pontoB,
    perna: e.perna,
    degraus,
    proximoDegrau,
    distanciaProximoPct: proximoDegrau ? (Math.abs(price - proximoDegrau.price) / price) * 100 : null,
    emExpansao: true,
    redesenhar: proximoDegrau === null,
  };
}

/** Texto curto para a mesa (so fatos calculados). */
export function describeFibCorridor(c: FibCorridor | null): string {
  if (!c) return "sem rompimento de topo/fundo recente: fora de modo expansão neste tempo";
  const lv = c.degraus.map((d) => `${(d.ratio * 100).toFixed(1)}%=${d.price.toFixed(2)}${d.rompido ? " (rompido)" : ""}`).join(", ");
  const prox = c.proximoDegrau
    ? `próximo degrau ${(c.proximoDegrau.ratio * 100).toFixed(1)}% em ${c.proximoDegrau.price.toFixed(2)} (a ${c.distanciaProximoPct!.toFixed(2)}%)`
    : "todos os degraus rompidos: redesenhar em tempo maior";
  return `${c.tf}: expansão de ${c.direcao} (perna ${c.pontoA.toFixed(2)} → ${c.pontoB.toFixed(2)}; 0 em ${c.pontoB.toFixed(2)}). Degraus: ${lv}. ${prox}.`;
}
