/**
 * EXPECTANCY ENGINE — Bloco C do cérebro cognitivo (research/AI_COGNITIVE_SPEC.md).
 * ============================================================================
 * Matemática do risco pedida pelo Cleber, aplicada com uma disciplina: nada
 * aqui assume número — tudo é MEDIDO sobre a série real de trades do usuário
 * (via Bloco A / `ai_decisions` + `ai_trades`), ou recusa-se a responder com
 * erro explícito quando não há amostra suficiente.
 *
 * Três peças, nesta ordem porque cada uma alimenta a próxima:
 *
 * 1. `computeExpectancy` — expectativa matemática em R-multiples (Van Tharp:
 *    "nenhuma operação individual importa, o resultado vem da série"). Único
 *    número que resume se o sistema tem edge, incluindo custo real quando
 *    fornecido.
 * 2. `estimateRiskOfRuin` — Monte Carlo (não fórmula fechada — ver nota
 *    abaixo) sobre sizing fracionário real, não a fórmula clássica de
 *    "gambler's ruin" de aposta fixa, que não modela sizing em % de banca.
 * 3. `computeHonestKelly` — Kelly Criterion usando winRate/payoff MEDIDOS (não
 *    assumidos), com guarda de amostra pequena e de edge negativo.
 *
 * Resultado antecipado e documentado: sob a decisão (B) do Cleber
 * (`AI_BRAIN_SPEC.md` seção 14.5), com edge ≈ 0 medido nas 15 investigações
 * anteriores, `computeExpectancy` deve devolver expectancy ≈ 0 ou negativa
 * fora de amostras muito específicas, e `computeHonestKelly` deve devolver
 * fração ≈ 0 na maioria dos casos reais — a matemática dizendo "não aposte" é
 * o resultado CORRETO, não um bug. É a versão quantitativa de "o cérebro mais
 * eficiente é o que opera menos".
 */

// ============================================================================
// 1. EXPECTATIVA MATEMÁTICA (R-multiples, Van Tharp)
// ============================================================================

export interface TradeOutcome {
  /** PnL realizado do trade, em % do capital naquele momento (não em $). */
  pnlPercent: number;
  /** % do capital efetivamente arriscado nesse trade (distância até o stop
   *  em % × tamanho da posição) — é o denominador do R-multiple. Precisa ser
   *  > 0; um trade sem risco definido não pode ser expresso em R. */
  riskedPercent: number;
}

export interface ExpectancyResult {
  sampleSize: number;
  winRate: number; // 0-100
  /** Intervalo de confiança 95% (Wilson score) do winRate — mede o quão
   *  confiável é a amostra, não só o ponto estimado. */
  winRateCI95: { lower: number; upper: number };
  avgWinR: number; // R-multiple médio dos trades vencedores
  avgLossR: number; // R-multiple médio (positivo) dos trades perdedores
  payoffRatio: number; // avgWinR / avgLossR
  /** Expectativa matemática em R por trade: E[R] = winRate*avgWinR - lossRate*avgLossR. */
  expectancyR: number;
  /** Mesma expectativa, mas em % do capital, usando o riskedPercent médio da
   *  amostra — só uma conversão de unidade pra leitura direta. */
  expectancyPercent: number;
  /** true quando a amostra é grande o bastante (>= MIN_SAMPLE) pra reportar
   *  sem soar conclusivo. Abaixo disso, os números ainda saem, mas marcados. */
  conclusive: boolean;
}

export const MIN_SAMPLE_EXPECTANCY = 30;

/** Aproximação de Wilson pro intervalo de confiança de uma proporção — mais
 *  honesta que Normal (Wald) em amostra pequena/proporção extrema, que é
 *  exatamente o regime em que este módulo opera (poucos trades reais). */
function wilsonScoreInterval(successes: number, n: number, z = 1.96): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 100 };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    lower: Number((Math.max(0, (center - margin) / denom) * 100).toFixed(2)),
    upper: Number((Math.min(1, (center + margin) / denom) * 100).toFixed(2)),
  };
}

/**
 * Calcula a expectativa matemática real sobre uma série de trades fechados.
 * Nunca assume winRate/payoff — sempre mede. Lança erro explícito (nunca
 * fabrica dado) se algum trade tiver `riskedPercent <= 0`.
 */
export function computeExpectancy(trades: TradeOutcome[]): ExpectancyResult {
  if (trades.some(t => t.riskedPercent <= 0)) {
    throw new Error('computeExpectancy: trade com riskedPercent <= 0 — R-multiple indefinido, não dá pra fabricar o denominador.');
  }

  const n = trades.length;
  if (n === 0) {
    return {
      sampleSize: 0, winRate: 0, winRateCI95: { lower: 0, upper: 100 },
      avgWinR: 0, avgLossR: 0, payoffRatio: 0, expectancyR: 0, expectancyPercent: 0,
      conclusive: false,
    };
  }

  const rMultiples = trades.map(t => t.pnlPercent / t.riskedPercent);
  const wins = rMultiples.filter(r => r > 0);
  const losses = rMultiples.filter(r => r <= 0).map(r => -r); // guardado como magnitude positiva

  const winRate = (wins.length / n) * 100;
  const avgWinR = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossR = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const payoffRatio = avgLossR > 0 ? Number((avgWinR / avgLossR).toFixed(4)) : (avgWinR > 0 ? Infinity : 0);

  const p = winRate / 100;
  const expectancyR = Number((p * avgWinR - (1 - p) * avgLossR).toFixed(4));

  const avgRiskedPercent = trades.reduce((a, t) => a + t.riskedPercent, 0) / n;
  const expectancyPercent = Number((expectancyR * avgRiskedPercent).toFixed(4));

  return {
    sampleSize: n,
    winRate: Number(winRate.toFixed(2)),
    winRateCI95: wilsonScoreInterval(wins.length, n),
    avgWinR: Number(avgWinR.toFixed(4)),
    avgLossR: Number(avgLossR.toFixed(4)),
    payoffRatio,
    expectancyR,
    expectancyPercent,
    conclusive: n >= MIN_SAMPLE_EXPECTANCY,
  };
}

// ============================================================================
// 2. RISCO DE RUÍNA (Monte Carlo, sizing fracionário real)
// ============================================================================

export interface RiskOfRuinParams {
  winRate: number; // 0-100, MEDIDO via computeExpectancy — nunca assumido pelo chamador
  payoffRatio: number; // avgWinR/avgLossR, MEDIDO
  /** % do capital arriscado por trade (fixed-fractional — o padrão deste
   *  produto, ver `presetStrategies.ts`: "1% de risco por trade, fixed
   *  fractional, não Kelly pleno"). */
  riskPerTradePercent: number;
  /** Drawdown (%) que conta como "ruína" para este cálculo. Sizing
   *  fracionário nunca chega a zero de fato (sempre sobra uma fração da
   *  banca) — por isso "ruína" aqui é um limiar de drawdown definido pelo
   *  chamador, nunca "saldo = 0" literal. */
  ruinThresholdPercent: number;
  /** Quantos trades simular por caminho — horizonte do teste. */
  tradesPerPath: number;
  simulations: number;
  /** Seed do PRNG — determinístico de propósito, pra ser testável em
   *  `__validate__.ts` sem depender de aleatoriedade real do sistema. */
  seed: number;
}

export interface RiskOfRuinResult {
  /** % das simulações que tocaram o limiar de ruína em algum ponto do caminho. */
  ruinProbabilityPercent: number;
  simulations: number;
  tradesPerPath: number;
  /** Aviso explícito de método — nunca deixar o número parecer mais
   *  preciso/analítico do que é. */
  method: 'monte_carlo_fixed_fractional';
}

/** PRNG determinístico (mulberry32) — só pra este módulo ser testável sem
 *  depender de `Math.random()` (que a política do projeto já proíbe como
 *  fonte de dado apresentado como real; aqui é simulação declarada, não dado,
 *  mas a mesma disciplina de determinismo/testabilidade se aplica). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simula N caminhos de equity sob sizing fixed-fractional (cada trade arrisca
 * `riskPerTradePercent` da banca CORRENTE, não da banca inicial — é isso que
 * torna "ruína total" impossível e "drawdown de X%" a métrica certa) e mede
 * em quantos caminhos o drawdown desde o pico ultrapassa `ruinThresholdPercent`.
 *
 * Por que Monte Carlo e não fórmula fechada: a fórmula clássica de "risco de
 * ruína" (gambler's ruin) assume aposta de tamanho FIXO em $ — não modela
 * sizing em % de banca (o padrão real deste produto). Simulação é o jeito
 * honesto de responder a mesma pergunta sob o sizing real, ao custo de ser
 * uma estimativa (converge com `simulations` maior), não um número exato.
 */
export function estimateRiskOfRuin(params: RiskOfRuinParams): RiskOfRuinResult {
  const { winRate, payoffRatio, riskPerTradePercent, ruinThresholdPercent, tradesPerPath, simulations, seed } = params;
  if (winRate < 0 || winRate > 100) throw new Error('estimateRiskOfRuin: winRate fora de [0,100].');
  if (riskPerTradePercent <= 0) throw new Error('estimateRiskOfRuin: riskPerTradePercent precisa ser > 0.');
  if (ruinThresholdPercent <= 0 || ruinThresholdPercent >= 100) throw new Error('estimateRiskOfRuin: ruinThresholdPercent precisa estar em (0,100).');

  const rng = mulberry32(seed);
  const p = winRate / 100;
  let ruinCount = 0;

  for (let s = 0; s < simulations; s++) {
    let equity = 100; // base 100 = capital inicial em "unidades percentuais"
    let peak = 100;
    let ruined = false;

    for (let t = 0; t < tradesPerPath; t++) {
      const riskAmount = equity * (riskPerTradePercent / 100);
      const isWin = rng() < p;
      equity += isWin ? riskAmount * payoffRatio : -riskAmount;
      if (equity <= 0) { ruined = true; break; } // limite físico, além do limiar de ruína
      if (equity > peak) peak = equity;
      const drawdownFromPeak = ((peak - equity) / peak) * 100;
      if (drawdownFromPeak >= ruinThresholdPercent) { ruined = true; break; }
    }
    if (ruined) ruinCount++;
  }

  return {
    ruinProbabilityPercent: Number(((ruinCount / simulations) * 100).toFixed(2)),
    simulations,
    tradesPerPath,
    method: 'monte_carlo_fixed_fractional',
  };
}

// ============================================================================
// 3. KELLY HONESTO (winRate/payoff medidos, com guarda de amostra e de edge negativo)
// ============================================================================

export interface HonestKellyResult {
  /** Fração de Kelly PURA (não fracionada), pode ser negativa — negativa
   *  significa "o sistema tem edge negativo, não aposte nada". */
  kellyFractionRaw: number;
  /** Fração aplicada depois do multiplicador de segurança (ex: 0.25 = Kelly
   *  25%) e do piso em zero — nunca posição negativa. */
  kellyFractionApplied: number;
  /** % do capital sugerido pra posição, já com o multiplicador e o teto de
   *  segurança configurado. */
  recommendedPositionPercent: number;
  /** false quando a amostra é pequena demais, ou quando o limite inferior do
   *  IC 95% do winRate já implica edge negativo — nesses casos o resultado
   *  ainda é calculado, mas marcado como não-confiável, nunca escondido. */
  reliable: boolean;
  reason: string;
}

/**
 * Kelly Criterion aplicado sobre expectativa MEDIDA (nunca assumida) — recebe
 * o `ExpectancyResult` de `computeExpectancy`, não winRate/payoff soltos, pra
 * impossibilitar o erro de passar número inventado.
 */
export function computeHonestKelly(
  expectancy: ExpectancyResult,
  opts: { kellyMultiplier?: number; maxPositionPercent?: number } = {},
): HonestKellyResult {
  const kellyMultiplier = opts.kellyMultiplier ?? 0.25; // Kelly fracionário conservador por padrão
  const maxPositionPercent = opts.maxPositionPercent ?? 10;

  if (!expectancy.conclusive) {
    return {
      kellyFractionRaw: 0, kellyFractionApplied: 0, recommendedPositionPercent: 0,
      reliable: false,
      reason: `Amostra insuficiente (n=${expectancy.sampleSize} < ${MIN_SAMPLE_EXPECTANCY}) — Kelly não calculável com confiança, tratado como 0.`,
    };
  }

  const p = expectancy.winRate / 100;
  const q = 1 - p;
  const b = expectancy.payoffRatio;

  if (!isFinite(b) || b <= 0) {
    return {
      kellyFractionRaw: 0, kellyFractionApplied: 0, recommendedPositionPercent: 0,
      reliable: false,
      reason: 'Payoff ratio inválido (sem trades perdedores na amostra ou sem trades vencedores) — Kelly não calculável, tratado como 0.',
    };
  }

  const kellyFractionRaw = Number(((b * p - q) / b).toFixed(4));

  // Guarda de honestidade: usa o LIMITE INFERIOR do IC 95% do winRate (não o
  // ponto estimado) pra decidir se o edge é confiável — evita recomendar
  // posição baseada num winRate que pode, com 95% de confiança, ser bem menor.
  const pLower = expectancy.winRateCI95.lower / 100;
  const kellyLowerBound = (b * pLower - (1 - pLower)) / b;

  if (kellyLowerBound <= 0) {
    return {
      kellyFractionRaw, kellyFractionApplied: 0, recommendedPositionPercent: 0,
      reliable: false,
      reason: `Kelly bruto é ${(kellyFractionRaw * 100).toFixed(1)}%, mas o limite inferior do IC 95% do winRate (${expectancy.winRateCI95.lower}%) já implica edge <= 0 — recomendação conservadora é 0% (não apostar), mesmo com o ponto estimado positivo.`,
    };
  }

  const kellyFractionApplied = Math.max(0, kellyFractionRaw) * kellyMultiplier;
  const recommendedPositionPercent = Number(Math.min(kellyFractionApplied * 100, maxPositionPercent).toFixed(4));

  return {
    kellyFractionRaw,
    kellyFractionApplied: Number(kellyFractionApplied.toFixed(4)),
    recommendedPositionPercent,
    reliable: true,
    reason: `Kelly ${(kellyMultiplier * 100).toFixed(0)}% sobre edge medido (n=${expectancy.sampleSize}, winRate=${expectancy.winRate}%, payoff=${b}), robusto ao IC 95% inferior.`,
  };
}
