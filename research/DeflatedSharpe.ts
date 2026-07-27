/**
 * Deflated Sharpe Ratio (DSR) — Bailey & López de Prado, "The Deflated Sharpe
 * Ratio: Correcting for Selection Bias, Backtest Overfitting and Non-Normality"
 * (Journal of Portfolio Management, 2014). Existe desde a criação do
 * research/AI_BRAIN_SPEC.md (seção 8, item 4) como critério de promoção, mas
 * nunca tinha sido implementado — esta é a primeira vez.
 *
 * O problema que resolve: testar N combinações de parâmetro e escolher a
 * melhor produz um Sharpe alto POR ACASO, mesmo sem edge real — quanto mais
 * combinações testadas, maior o Sharpe esperado do "melhor" resultado só por
 * seleção. DSR corrige isso: dado quantos trials foram tentados (N) e a
 * variância dos Sharpes observados entre eles, calcula o Sharpe mínimo que
 * seria esperado por acaso (SR0) e reporta a probabilidade de o Sharpe
 * observado ser real, não só o vencedor da loteria de tentativas.
 *
 * SIMPLIFICAÇÃO DECLARADA: a fórmula completa usa assimetria (γ3) e curtose
 * (γ4) empíricas dos retornos de trade. Esta implementação assume retornos
 * gaussianos (γ3=0, γ4=3) — é a simplificação padrão quando não se quer
 * depender de estimativa de momentos de ordem superior com amostra pequena
 * (que é instável). Retornos de trade real quase sempre têm cauda mais gorda
 * que a normal, então esta versão tende a ser LIBERAL demais, não conservadora
 * — DSR calculado aqui é um limite otimista, não um veredito final duro.
 * Declarado, não escondido: nunca tratar um DSR alto daqui como prova
 * definitiva sem também olhar o resultado bruto (sample size, consistência
 * entre folds).
 */

/** Aproximação de Φ (CDF normal padrão) via função erro — precisão ~1e-7, suficiente aqui. */
function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** Inversa de Φ — Acklam (2003), precisão ~1.15e-9. */
function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function sharpeRatio(returns: number[]): number {
  const n = returns.length;
  if (n < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  return stdDev > 0 ? mean / stdDev : 0;
}

/**
 * Sortino Ratio — mesma ideia do Sharpe (retorno médio / risco), mas o risco
 * é só o desvio-padrão dos retornos NEGATIVOS (downside deviation), não a
 * variância total. Diferença prática: Sharpe penaliza ganhos grandes tanto
 * quanto perdas grandes (mesma variância); Sortino só penaliza o lado que
 * importa pra "restrição de sobrevivência" (seção 1 do AI_BRAIN_SPEC.md, que
 * já declara Sharpe/Sortino como objetivo formal). Mais adequado pra
 * trend-following como Donchian, que por desenho tem retornos assimétricos
 * (muitas perdas pequenas capadas por stop, raros ganhos grandes de tendência
 * — Sharpe pune exatamente a variância que é o ganho pretendido).
 *
 * `target` = limiar abaixo do qual um retorno conta como "downside" (0 =
 * qualquer retorno negativo).
 */
export function sortinoRatio(returns: number[], target = 0): number {
  const n = returns.length;
  if (n < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const downside = returns.filter(r => r < target);
  if (downside.length === 0) return mean > 0 ? Infinity : 0;
  const downsideVariance = downside.reduce((a, r) => a + (r - target) ** 2, 0) / n; // divide por n total, não só downside.length (convenção padrão)
  const downsideDeviation = Math.sqrt(downsideVariance);
  return downsideDeviation > 0 ? mean / downsideDeviation : 0;
}

/**
 * Versão "deflated" do Sortino, reaproveitando a MESMA estrutura da fórmula
 * de Bailey & López de Prado usada pro Sharpe (deflatedSharpeRatio acima) —
 * substitui a estatística, não a fórmula. AVISO MAIS FORTE que o do Sharpe: a
 * derivação original do DSR é especificamente pra distribuição assintótica do
 * Sharpe Ratio, não foi provada pra Sortino. Esta função é uma aproximação
 * heurística (mesma forma funcional, sr0/nObservations no lugar certo) —
 * trate o número resultante como um guia direcional mais fraco que o DSR do
 * Sharpe, nunca como prova formal. Preferir bootstrap empírico
 * (`bootstrapSortinoSignificance` abaixo) quando a decisão importar de fato.
 */
export function deflatedSortinoRatio(sortinoHat: number, sr0: number, nObservations: number): number {
  if (nObservations < 2 || !isFinite(sortinoHat)) return 0;
  const denom = Math.sqrt(1 + (sortinoHat * sortinoHat) / 2);
  const z = ((sortinoHat - sr0) * Math.sqrt(nObservations - 1)) / denom;
  return normalCdf(z);
}

/**
 * Teste de significância por bootstrap (reamostragem com reposição) — mais
 * robusto que a aproximação gaussiana acima porque não assume nenhuma forma
 * de distribuição. Reamostra os retornos de trade N vezes, recalcula Sortino
 * em cada reamostra, e retorna a fração das reamostras com Sortino ≤ 0 (i.e.,
 * a probabilidade empírica de o Sortino real ser zero ou negativo). Sem
 * Math.random() bruto sem seed — usa um LCG determinístico simples pra
 * manter o script reproduzível (mesma disciplina "determinístico" do
 * BacktestEngine).
 */
export function bootstrapSortinoSignificance(returns: number[], iterations = 2000, seed = 42): { probPositive: number; sortinoDistribution: number[] } {
  if (returns.length < 2) return { probPositive: 0, sortinoDistribution: [] };
  let state = seed;
  const lcgRandom = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const n = returns.length;
  const distribution: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample: number[] = [];
    for (let j = 0; j < n; j++) sample.push(returns[Math.floor(lcgRandom() * n)]);
    distribution.push(sortinoRatio(sample));
  }
  const positiveCount = distribution.filter(s => s > 0 && isFinite(s)).length;
  return { probPositive: positiveCount / iterations, sortinoDistribution: distribution };
}

/**
 * Sharpe mínimo esperado por puro acaso, dado N trials independentes e a
 * variância dos Sharpes observados entre eles (Bailey & López de Prado, eq. 8,
 * γ = constante de Euler-Mascheroni ≈ 0.5772).
 */
export function expectedMaxSharpeUnderNull(sharpeVarianceAcrossTrials: number, nTrials: number): number {
  if (nTrials <= 1) return 0;
  const EULER_MASCHERONI = 0.5772156649;
  const sd = Math.sqrt(Math.max(sharpeVarianceAcrossTrials, 0));
  return sd * ((1 - EULER_MASCHERONI) * normalInv(1 - 1 / nTrials) + EULER_MASCHERONI * normalInv(1 - 1 / (nTrials * Math.E)));
}

/**
 * DSR — probabilidade de o Sharpe observado (`sharpeHat`, medido sobre
 * `nObservations` trades) ser real, corrigida pelo número de trials testados
 * (via `sr0`, ver expectedMaxSharpeUnderNull). Retorna valor em [0,1] — >0.95
 * é o piso convencional de "provavelmente real, não seleção".
 */
export function deflatedSharpeRatio(sharpeHat: number, sr0: number, nObservations: number): number {
  if (nObservations < 2) return 0;
  // Simplificação gaussiana (γ3=0, γ4=3) — ver aviso no cabeçalho do arquivo.
  const denom = Math.sqrt(1 + (sharpeHat * sharpeHat) / 2);
  const z = ((sharpeHat - sr0) * Math.sqrt(nObservations - 1)) / denom;
  return normalCdf(z);
}
