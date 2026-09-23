/**
 * Classificador de Regime de Mercado — Hidden Markov Model (HMM), 100%
 * TypeScript nativo (sem processo/serviço externo, sem dependência de
 * runtime Python — pedido explícito do Cleber: "não precisa ser em Python,
 * pode adequar a tecnologia").
 *
 * MOTIVAÇÃO (2026-09-09, pedido direto do Cleber): nenhuma estratégia
 * funciona o tempo todo — a maior causa de perda é aplicar lógica de
 * TENDÊNCIA (rompimento, cruzamento de médias) num mercado CONSOLIDADO, ou
 * vice-versa. Este módulo classifica, de forma NÃO-SUPERVISIONADA, em qual
 * dos 3 regimes o símbolo está agora:
 *   - TENDENCIA_CLARA: retorno médio com magnitude alta e direção consistente.
 *   - CONSOLIDACAO_BAIXA_VOL: retorno perto de zero E volatilidade baixa.
 *   - CHOQUE_DE_VOLATILIDADE: volatilidade/amplitude muito acima do normal,
 *     independente da direção (notícia, liquidação em cascata, gap).
 *
 * POR QUE HMM (e não um classificador supervisionado): não existe rótulo
 * "verdade" de regime — ninguém anota candle a candle "isto é tendência".
 * O HMM trata o regime como um ESTADO OCULTO que gera as observações que a
 * gente REALMENTE mede (retorno, volatilidade, amplitude) — aprende sozinho,
 * a partir dos dados, a distribuição estatística de cada estado E a
 * probabilidade de transição entre eles (regimes persistem: um candle
 * lateral tende a continuar lateral no próximo, depois transiciona).
 *
 * COMO O MODELO ISOLA OS 3 ESTADOS, na prática:
 *   1. Cada candle vira um vetor de 3 features: retorno logarítmico
 *      (direção + magnitude), volatilidade realizada numa janela curta
 *      (dispersão dos retornos recentes) e amplitude normalizada
 *      (high-low relativo ao preço — "quanto o candle respirou").
 *   2. Um HMM Gaussiano de 3 estados (covariância diagonal) é treinado via
 *      Baum-Welch (Expectation-Maximization) sobre essa série — o algoritmo
 *      encontra sozinho 3 gaussianas no espaço de 3 features que melhor
 *      explicam os dados, mais a matriz de transição entre elas.
 *   3. Como o HMM não sabe rotular ("estado 0/1/2" são índices arbitrários
 *      atribuídos pelo treino), o rótulo humano é atribuído DEPOIS, ordenando
 *      os 3 estados pelas médias aprendidas — ver `labelStates()` abaixo:
 *      maior volatilidade média = CHOQUE; dos 2 restantes, maior |retorno
 *      médio| = TENDENCIA; o que sobra = CONSOLIDACAO.
 *   4. Forward-backward (em log-espaço, evita underflow numérico) dá a
 *      probabilidade posterior de cada estado no candle mais recente — é
 *      essa probabilidade que vira `confidence` (regime com 55% de certeza é
 *      bem diferente de um com 95%, o motor/LLM deve tratar isso diferente).
 *
 * DISCIPLINA DO PROJETO (nunca fabricar dado): candles insuficientes (ver
 * `MIN_CANDLES_FOR_HMM`) devolvem `null`, nunca um regime chutado — mesmo
 * padrão de getTrendInfo/getMarketRegime/analyzeSmc neste motor.
 *
 * LIMITAÇÃO CONHECIDA, DECLARADA (rigor estatístico exigido pelo Cleber): o
 * endpoint de candle real deste projeto (`/mt5-candles`) devolve no máximo
 * 60 velas por chamada (ver `requestCandles` em atr.ts) — bem abaixo do
 * mínimo geralmente recomendado pra treinar um HMM de 3 estados com
 * estabilidade estatística forte (a literatura usa centenas a milhares de
 * pontos). Com ~45-59 observações, o modelo é re-treinado do zero A CADA
 * CHAMADA (sem estado persistido entre ciclos) e a classificação deve ser
 * lida como um SINAL ADICIONAL de confluência, não uma verdade estatística
 * robusta — por isso este módulo entra só como CONTEXTO no prompt por
 * padrão, com o bloqueio mecânico opcional (`HMM_REGIME_GATE_ACTIVE`)
 * desligado até haver amostra real validando que a classificação bate com o
 * que se observa no gráfico (mesma disciplina de `ASSET_SCORECARD_ACTIVE`
 * já usada neste projeto).
 *
 * CASO CONHECIDO DE AMBIGUIDADE (validado com dado sintético, ver testes que
 * sustentaram os limiares em `labelStates`): um choque de volatilidade
 * PERFEITAMENTE simétrico (sem viés direcional algum, o candle inteiro sobe
 * ou desce por sorteio) e SEM nenhum trecho mais calmo na mesma janela pra
 * servir de referência cai em CONSOLIDACAO_BAIXA_VOL em vez de
 * CHOQUE_DE_VOLATILIDADE -- o modelo não tem como saber que "isto é raro"
 * sem ver um período mais calmo do MESMO símbolo pra comparar. Na prática
 * real isso é incomum (choques de mercado de verdade -- notícia, liquidação
 * em cascata -- quase sempre têm um viés direcional real, e a janela
 * buscada normalmente mistura momentos mais calmos), mas é um limite
 * conhecido, não escondido.
 */

export interface HmmCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export const HMM_STATE_TREND = "TENDENCIA_CLARA" as const;
export const HMM_STATE_CONSOLIDATION = "CONSOLIDACAO_BAIXA_VOL" as const;
export const HMM_STATE_SHOCK = "CHOQUE_DE_VOLATILIDADE" as const;
export type HmmRegimeLabel = typeof HMM_STATE_TREND | typeof HMM_STATE_CONSOLIDATION | typeof HMM_STATE_SHOCK;

export interface HmmRegimeResult {
  regime: HmmRegimeLabel;
  /** Probabilidade posterior (forward-backward) do estado atual -- 0 a 1. */
  confidence: number;
  stateProbabilities: Record<HmmRegimeLabel, number>;
  /** Só populado quando regime === TENDENCIA_CLARA. */
  direction: "ALTA" | "BAIXA" | null;
  sampleSize: number;
  logLikelihood: number;
  converged: boolean;
}

/** Mínimo de candles pra treinar com alguma estabilidade -- ver limitação declarada no cabeçalho do arquivo. Abaixo disso, `null` (nunca fabrica regime). */
const MIN_CANDLES_FOR_HMM = 45;
const VOLATILITY_WINDOW = 10;
const N_STATES = 3;
const MAX_EM_ITERATIONS = 80;
const EM_CONVERGENCE_TOLERANCE = 1e-4;
// 🔴 Piso de variância NA ESCALA PADRONIZADA (features com variância ~1 antes
// do EM rodar) -- um piso "pequeno" em termos absolutos (ex: 1e-6) ainda é
// gigantesco relativo à escala real dos dados, e com poucas dezenas de
// observações (ver limitação de MIN_CANDLES_FOR_HMM) isso deixa a variância
// de um estado colapsar quase a zero em cima de 1-2 pontos "isolados" --
// esse estado passa a ter verossimilhança absurdamente alta só pra esses
// pontos e "sequestra" quase toda a probabilidade posterior (confidence
// artificial perto de 100% num estado errado). Medido ao vivo com dado
// sintético (tendência clara sendo classificada como CHOQUE por causa
// disso) antes deste piso subir -- 0.05 (5% da variância nominal de uma
// gaussiana padrão) resolveu nos testes sintéticos de tendência/lateral/
// choque, mantendo estados distinguíveis sem permitir colapso degenerado.
const VARIANCE_FLOOR = 0.05;

function logSumExp(values: number[]): number {
  let max = -Infinity;
  for (const v of values) if (v > max) max = v;
  if (!Number.isFinite(max)) return -Infinity;
  let sum = 0;
  for (const v of values) sum += Math.exp(v - max);
  return max + Math.log(sum);
}

/** Log-densidade de uma gaussiana multivariada com covariância DIAGONAL (features assumidas independentes -- simplificação padrão do GaussianHMM(covariance_type="diag")). */
function logGaussianDiag(x: number[], mean: number[], variance: number[]): number {
  let logDensity = 0;
  for (let d = 0; d < x.length; d++) {
    const v = Math.max(variance[d], VARIANCE_FLOOR);
    logDensity += -0.5 * Math.log(2 * Math.PI * v) - ((x[d] - mean[d]) ** 2) / (2 * v);
  }
  return logDensity;
}

interface HmmModel {
  means: number[][]; // [state][feature]
  variances: number[][]; // [state][feature]
  transition: number[][]; // [from][to]
  initial: number[]; // [state]
}

/**
 * Extrai [retorno_medio_movel, volatilidade_realizada] por candle -- descarta
 * o 1º candle (sem retorno anterior).
 *
 * 🔴 Por que MÉDIA MÓVEL do retorno, e não o retorno instantâneo de cada
 * candle isolado: validado com dado sintético controlado (série de
 * tendência pura + ruído candle-a-candle) antes de aceitar esta versão --
 * usar o retorno CRU de cada candle faz o EM "separar o ruído": mesmo numa
 * tendência homogênea, metade dos candles tem retorno um pouco acima da
 * média e metade um pouco abaixo (puro ruído), e o algoritmo encontra 2
 * clusters nisso e rotula um deles como "consolidação" por engano -- a
 * classificação da última vela virava um sorteio de qual lado do ruído ela
 * caiu, com confiança > 99% (falsa certeza). A média móvel do retorno numa
 * janela curta (mesmo `VOLATILITY_WINDOW`) suaviza esse ruído candle-a-candle
 * e preserva o que realmente importa: se a DIREÇÃO tem sido consistente
 * (tendência) ou oscila perto de zero (consolidação) numa janela recente.
 */
function buildRawFeatures(candles: HmmCandle[]): number[][] {
  const closes = candles.map((c) => c.close);
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) logReturns.push(Math.log(closes[i] / closes[i - 1]));

  const rollingMeanReturn: number[] = [];
  const volatility: number[] = [];
  for (let i = 0; i < logReturns.length; i++) {
    const start = Math.max(0, i - VOLATILITY_WINDOW + 1);
    const window = logReturns.slice(start, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    rollingMeanReturn.push(mean);
    if (window.length > 1) {
      const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
      volatility.push(Math.sqrt(variance));
    } else {
      volatility.push(Math.abs(logReturns[i]));
    }
  }

  return rollingMeanReturn.map((r, i) => [r, volatility[i]]);
}

/**
 * Reescala cada feature pelo seu desvio padrão -- SEM subtrair a média.
 *
 * 🔴 Diferença deliberada do z-score clássico (validado com dado sintético
 * antes de aceitar esta versão): subtrair a média de toda a janela
 * apagaria exatamente o sinal que este módulo precisa detectar -- se a
 * janela inteira é uma tendência homogênea (sem nenhum trecho de
 * consolidação para contrastar), a média da janela JÁ CONTÉM o drift, e
 * demeanar faria o retorno "sumir" (ficar em torno de zero como qualquer
 * outra janela), tornando tendência indistinguível de consolidação. O
 * mesmo vale para volatilidade: uma janela inteira de choque (alta vol o
 * tempo todo) teria a "alta volatilidade" subtraída como se fosse a
 * "volatilidade normal" daquela amostra. Reescalar (dividir pelo desvio
 * padrão) só normaliza a UNIDADE de cada feature pra ficarem comparáveis
 * entre si no treino, preservando o nível absoluto -- sem apagar o sinal.
 */
function rescale(features: number[][]): number[][] {
  const nFeatures = features[0].length;
  const means = new Array(nFeatures).fill(0);
  const stds = new Array(nFeatures).fill(0);
  for (const row of features) for (let d = 0; d < nFeatures; d++) means[d] += row[d] / features.length;
  for (const row of features) for (let d = 0; d < nFeatures; d++) stds[d] += (row[d] - means[d]) ** 2 / features.length;
  for (let d = 0; d < nFeatures; d++) stds[d] = Math.sqrt(stds[d]) || 1e-8;
  return features.map((row) => row.map((v, d) => v / stds[d]));
}

/** Inicialização determinística (sem aleatoriedade -- resultado reprodutível): ordena os candles pela feature de retorno e divide em 3 blocos (baixo/meio/alto) como semente inicial dos centróides, refinados depois pelo EM de verdade. */
function initializeModel(features: number[][]): HmmModel {
  const nFeatures = features[0].length;
  const sortedByReturn = [...features].sort((a, b) => a[0] - b[0]);
  const third = Math.floor(sortedByReturn.length / 3) || 1;
  const blocks = [sortedByReturn.slice(0, third), sortedByReturn.slice(third, 2 * third), sortedByReturn.slice(2 * third)];

  const overallVariance = new Array(nFeatures).fill(0);
  const overallMean = new Array(nFeatures).fill(0);
  for (const row of features) for (let d = 0; d < nFeatures; d++) overallMean[d] += row[d] / features.length;
  for (const row of features) for (let d = 0; d < nFeatures; d++) overallVariance[d] += (row[d] - overallMean[d]) ** 2 / features.length;

  const means = blocks.map((block, s) => {
    if (block.length === 0) return [...overallMean];
    const mean = new Array(nFeatures).fill(0);
    for (const row of block) for (let d = 0; d < nFeatures; d++) mean[d] += row[d] / block.length;
    return mean;
  });

  const variances = blocks.map(() => overallVariance.map((v) => Math.max(v, VARIANCE_FLOOR)));

  // Transição inicial com viés de persistência (regimes tendem a continuar no candle seguinte).
  const transition = Array.from({ length: N_STATES }, (_, i) =>
    Array.from({ length: N_STATES }, (_, j) => (i === j ? 0.9 : 0.05))
  );
  const initial = new Array(N_STATES).fill(1 / N_STATES);

  return { means, variances, transition, initial };
}

function computeLogEmissions(features: number[][], model: HmmModel): number[][] {
  return features.map((x) => model.means.map((mean, s) => logGaussianDiag(x, mean, model.variances[s])));
}

/** Baum-Welch (EM) em log-espaço -- treina médias/variâncias/transições do zero a cada chamada (ver limitação declarada no cabeçalho: sem estado persistido entre ciclos). */
function trainHmm(features: number[][]): { model: HmmModel; gamma: number[][]; logLikelihood: number; converged: boolean } {
  let model = initializeModel(features);
  const T = features.length;
  let prevLogLikelihood = -Infinity;
  let converged = false;
  let gamma: number[][] = [];

  for (let iter = 0; iter < MAX_EM_ITERATIONS; iter++) {
    const logB = computeLogEmissions(features, model);

    // Forward
    const logAlpha: number[][] = Array.from({ length: T }, () => new Array(N_STATES).fill(-Infinity));
    for (let s = 0; s < N_STATES; s++) logAlpha[0][s] = Math.log(model.initial[s]) + logB[0][s];
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < N_STATES; j++) {
        const terms = [];
        for (let i = 0; i < N_STATES; i++) terms.push(logAlpha[t - 1][i] + Math.log(model.transition[i][j]));
        logAlpha[t][j] = logSumExp(terms) + logB[t][j];
      }
    }

    // Backward
    const logBeta: number[][] = Array.from({ length: T }, () => new Array(N_STATES).fill(0));
    for (let s = 0; s < N_STATES; s++) logBeta[T - 1][s] = 0;
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < N_STATES; i++) {
        const terms = [];
        for (let j = 0; j < N_STATES; j++) terms.push(Math.log(model.transition[i][j]) + logB[t + 1][j] + logBeta[t + 1][j]);
        logBeta[t][i] = logSumExp(terms);
      }
    }

    const logLikelihood = logSumExp(logAlpha[T - 1]);

    // Gamma (posterior marginal de estado por timestep)
    gamma = Array.from({ length: T }, (_, t) => {
      const unnormalized = logAlpha[t].map((a, s) => a + logBeta[t][s]);
      const norm = logSumExp(unnormalized);
      return unnormalized.map((v) => Math.exp(v - norm));
    });

    // Xi (posterior conjunta de transição i->j por timestep) -- acumulado direto pra reestimação de A
    const xiSum: number[][] = Array.from({ length: N_STATES }, () => new Array(N_STATES).fill(0));
    for (let t = 0; t < T - 1; t++) {
      const unnormalized: number[][] = [];
      const flat: number[] = [];
      for (let i = 0; i < N_STATES; i++) {
        unnormalized.push([]);
        for (let j = 0; j < N_STATES; j++) {
          const v = logAlpha[t][i] + Math.log(model.transition[i][j]) + logB[t + 1][j] + logBeta[t + 1][j];
          unnormalized[i].push(v);
          flat.push(v);
        }
      }
      const norm = logSumExp(flat);
      for (let i = 0; i < N_STATES; i++) for (let j = 0; j < N_STATES; j++) xiSum[i][j] += Math.exp(unnormalized[i][j] - norm);
    }

    // M-step
    const newInitial = gamma[0].slice();
    const newTransition = xiSum.map((row, i) => {
      const denom = row.reduce((a, b) => a + b, 0) || 1e-8;
      // denom deveria ser sum_t gamma[t][i] (t=0..T-2); equivalente pois xiSum[i][*] soma exatamente isso.
      return row.map((v) => v / denom);
    });
    const nFeatures = features[0].length;
    const newMeans: number[][] = [];
    const newVariances: number[][] = [];
    for (let s = 0; s < N_STATES; s++) {
      const weightSum = gamma.reduce((acc, g) => acc + g[s], 0) || 1e-8;
      const mean = new Array(nFeatures).fill(0);
      for (let t = 0; t < T; t++) for (let d = 0; d < nFeatures; d++) mean[d] += gamma[t][s] * features[t][d];
      for (let d = 0; d < nFeatures; d++) mean[d] /= weightSum;
      const variance = new Array(nFeatures).fill(0);
      for (let t = 0; t < T; t++) for (let d = 0; d < nFeatures; d++) variance[d] += gamma[t][s] * (features[t][d] - mean[d]) ** 2;
      for (let d = 0; d < nFeatures; d++) variance[d] = Math.max(variance[d] / weightSum, VARIANCE_FLOOR);
      newMeans.push(mean);
      newVariances.push(variance);
    }

    model = { means: newMeans, variances: newVariances, transition: newTransition, initial: newInitial };

    if (Math.abs(logLikelihood - prevLogLikelihood) < EM_CONVERGENCE_TOLERANCE) {
      converged = true;
      prevLogLikelihood = logLikelihood;
      break;
    }
    prevLogLikelihood = logLikelihood;
  }

  return { model, gamma, logLikelihood: prevLogLikelihood, converged };
}

/** Viterbi -- sequência mais provável de estados ocultos, usada só pra rotular os 3 estados (ver `labelStates`), não pra ler a classificação atual (isso vem de `gamma`, a probabilidade posterior). */
function viterbiDecode(features: number[][], model: HmmModel): number[] {
  const T = features.length;
  const logB = computeLogEmissions(features, model);
  const delta: number[][] = Array.from({ length: T }, () => new Array(N_STATES).fill(-Infinity));
  const psi: number[][] = Array.from({ length: T }, () => new Array(N_STATES).fill(0));

  for (let s = 0; s < N_STATES; s++) delta[0][s] = Math.log(model.initial[s]) + logB[0][s];
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N_STATES; j++) {
      let best = -Infinity;
      let bestIdx = 0;
      for (let i = 0; i < N_STATES; i++) {
        const v = delta[t - 1][i] + Math.log(model.transition[i][j]);
        if (v > best) {
          best = v;
          bestIdx = i;
        }
      }
      delta[t][j] = best + logB[t][j];
      psi[t][j] = bestIdx;
    }
  }

  const path = new Array(T).fill(0);
  let lastBest = -Infinity;
  for (let s = 0; s < N_STATES; s++) if (delta[T - 1][s] > lastBest) (lastBest = delta[T - 1][s]), (path[T - 1] = s);
  for (let t = T - 2; t >= 0; t--) path[t] = psi[t + 1][path[t + 1]];
  return path;
}

// 🔴 Limiares ABSOLUTOS (não só ranking relativo entre os 3 estados) --
// validado com dado sintético antes de aceitar esta versão: um ranking
// PURAMENTE relativo (sempre "o maior dos 3 é X") força um rótulo mesmo
// quando NENHUM dos 3 estados de fato exhibit esse comportamento -- ex: numa
// janela 100% consolidada, os 3 estados vão ter |retorno médio| perto de
// zero por definição, mas o argmax relativo ainda escolhe "o menos perto de
// zero dos 3" como TENDENCIA (falso positivo, confirmado no teste sintético
// de consolidação pura antes deste fix). Os limiares abaixo exigem que o
// candidato realmente pareça o que o rótulo diz, não só "o mais parecido
// dos 3 disponíveis" -- quando nenhum estado passa no limiar, o rótulo cai
// pra CONSOLIDACAO_BAIXA_VOL (mais de um estado pode legitimamente
// compartilhar esse rótulo -- não há problema em 2 dos 3 estados ocultos
// representarem sabores diferentes de "sem tendência/sem choque real").
// 🔴 1.2 (não 0.6) -- calibrado com dado sintético: um choque de alta
// volatilidade com sinal ALEATÓRIO a cada candle ainda pode gerar, por puro
// acaso estatístico numa janela curta de ~10 candles (mesmo limite de
// MIN_CANDLES_FOR_HMM/60 candles do endpoint real), uma média móvel de
// retorno com razão sinal/ruído perto de 1.0 sem nenhuma direção real por
// trás -- 1.2 mantém a detecção de tendência genuína (testada com folga
// bem acima disso, razão ~2-8 nos casos sintéticos de tendência real) sem
// confundir ruído simétrico de choque com direção real.
const MIN_TREND_SIGNAL_TO_NOISE = 1.2; // |retorno médio da janela| / volatilidade realizada -- abaixo disso, a "direção" é indistinguível de ruído
const MIN_SHOCK_VOLATILITY_RATIO = 1.6; // volatilidade do candidato / mediana dos outros 2 -- abaixo disso, a diferença de volatilidade não é grande o suficiente pra chamar de choque

/** Rotula os 3 estados ocultos (índices 0/1/2, sem significado a priori) usando as features CRUAS (não reescaladas) do candle atribuído a cada um pelo Viterbi -- ver limiares acima. */
function labelStates(rawFeatures: number[][], viterbiPath: number[]): Record<number, HmmRegimeLabel> {
  const stats = Array.from({ length: N_STATES }, () => ({ absReturn: 0, volatility: 0, count: 0 }));
  for (let t = 0; t < rawFeatures.length; t++) {
    const s = viterbiPath[t];
    stats[s].absReturn += Math.abs(rawFeatures[t][0]);
    stats[s].volatility += rawFeatures[t][1];
    stats[s].count++;
  }
  for (const s of stats) {
    if (s.count > 0) {
      s.absReturn /= s.count;
      s.volatility /= s.count;
    }
  }
  if (process.env.HMM_DEBUG === "true") console.error("[hmm-debug] labelStates stats=", stats);

  const labels: Record<number, HmmRegimeLabel> = { 0: HMM_STATE_CONSOLIDATION, 1: HMM_STATE_CONSOLIDATION, 2: HMM_STATE_CONSOLIDATION };

  // 🔴 ORDEM IMPORTA (validado com dado sintético antes de aceitar esta
  // versão): TENDÊNCIA é avaliada PRIMEIRO, sobre os 3 estados, usando a
  // razão sinal/ruído (direção/volatilidade) -- não a volatilidade sozinha.
  // Um mercado em tendência real costuma ter volatilidade MAIOR que um
  // mercado consolidado do mesmo símbolo (movimento genuíno desloca preço
  // mais que ruído parado) -- se CHOQUE fosse avaliado primeiro (maior
  // volatilidade relativa vence), uma tendência de verdade, mas mais
  // volátil que a consolidação anterior na mesma janela, seria confundida
  // com choque (confirmado no teste sintético "consolidação -> tendência"
  // antes deste reordenamento). CHOQUE é sobre volatilidade ALTA SEM
  // direção confiável (SNR baixo) -- por isso só é avaliado DEPOIS, e só
  // entre os estados que a tendência já descartou.
  const trendStates: number[] = [];
  for (const candidate of [0, 1, 2]) {
    const ratio = stats[candidate].absReturn / Math.max(stats[candidate].volatility, 1e-12);
    if (ratio >= MIN_TREND_SIGNAL_TO_NOISE) {
      labels[candidate] = HMM_STATE_TREND;
      trendStates.push(candidate);
    }
  }

  // Choque: só entre os estados que NÃO viraram tendência -- candidato
  // precisa ter volatilidade MATERIALMENTE acima da mediana dos outros
  // candidatos remanescentes (não da tendência, que pode legitimamente ter
  // volatilidade maior sem ser "choque").
  const nonTrendStates = [0, 1, 2].filter((s) => !trendStates.includes(s));
  if (nonTrendStates.length >= 2) {
    let shockState: number | null = null;
    for (const candidate of nonTrendStates) {
      const others = nonTrendStates.filter((s) => s !== candidate).map((s) => stats[s].volatility);
      const medianOthers = others.reduce((a, b) => a + b, 0) / others.length || 1e-12;
      const ratio = stats[candidate].volatility / medianOthers;
      if (ratio >= MIN_SHOCK_VOLATILITY_RATIO && (shockState === null || stats[candidate].volatility > stats[shockState].volatility)) {
        shockState = candidate;
      }
    }
    if (shockState !== null) labels[shockState] = HMM_STATE_SHOCK;
  }

  return labels;
}

/**
 * Função pura (sem I/O) -- recebe candles já buscados (mesmo padrão de
 * `analyzeSmc` em smc.ts) e devolve a classificação de regime do candle
 * MAIS RECENTE. `null` quando não há candle real suficiente (nunca fabrica).
 */
export function classifyRegimeHmm(candles: HmmCandle[]): HmmRegimeResult | null {
  if (candles.length < MIN_CANDLES_FOR_HMM) return null;

  const rawFeatures = buildRawFeatures(candles);
  const rescaled = rescale(rawFeatures);

  const { model, gamma, logLikelihood, converged } = trainHmm(rescaled);
  const viterbiPath = viterbiDecode(rescaled, model);
  const labels = labelStates(rawFeatures, viterbiPath);
  if (process.env.HMM_DEBUG === "true") {
    const counts = [0, 0, 0];
    for (const s of viterbiPath) counts[s]++;
    console.error("[hmm-debug] viterbiCounts=", counts, "labels=", labels, "means=", model.means, "variances=", model.variances);
  }

  const lastGamma = gamma[gamma.length - 1];
  const stateProbabilities = {
    [HMM_STATE_TREND]: 0,
    [HMM_STATE_CONSOLIDATION]: 0,
    [HMM_STATE_SHOCK]: 0,
  } as Record<HmmRegimeLabel, number>;
  // += (não =) -- 2 estados ocultos podem legitimamente compartilhar o mesmo
  // rótulo (ver labelStates: default CONSOLIDACAO quando nenhum candidato
  // passa no limiar de tendência/choque), a probabilidade desse rótulo é a
  // SOMA da probabilidade de todos os estados que o carregam.
  for (let s = 0; s < N_STATES; s++) stateProbabilities[labels[s]] += lastGamma[s];

  // Regime/confiança reportados vêm da probabilidade AGREGADA por rótulo
  // (não do estado bruto de maior posterior) -- consistente com a soma acima
  // quando 2 estados compartilham o mesmo rótulo.
  const regime = (Object.entries(stateProbabilities) as [HmmRegimeLabel, number][]).reduce((best, curr) => (curr[1] > best[1] ? curr : best))[0];
  const confidence = stateProbabilities[regime];

  let direction: "ALTA" | "BAIXA" | null = null;
  if (regime === HMM_STATE_TREND) {
    // Agrega candles de TODOS os estados rotulados TENDENCIA (pode ser mais
    // de um, ver labelStates) -- não só o primeiro encontrado.
    const returnsInTrend = rawFeatures.filter((_, t) => labels[viterbiPath[t]] === HMM_STATE_TREND).map((f) => f[0]);
    if (returnsInTrend.length > 0) {
      const meanReturn = returnsInTrend.reduce((a, b) => a + b, 0) / returnsInTrend.length;
      direction = meanReturn > 0 ? "ALTA" : "BAIXA";
    }
  }

  return {
    regime,
    confidence,
    stateProbabilities,
    direction,
    sampleSize: candles.length,
    logLikelihood,
    converged,
  };
}
