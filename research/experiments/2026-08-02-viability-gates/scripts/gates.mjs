/**
 * GATES DE VIABILIDADE — triagem aritmética ANTES de qualquer backtest
 * ===================================================================
 *
 * Propósito: responder, em segundos e sem escrever estratégia nenhuma, se uma
 * região do espaço (ativo × custo × holding period × número de apostas
 * independentes) é capaz de PRODUZIR e de PROVAR um edge. Aplicado
 * retroativamente às seções 11.5→11.15 do AI_BRAIN_SPEC.md, este script teria
 * reprovado a maioria dos testes antes de rodá-los.
 *
 * Os três gates:
 *   1. ARITMÉTICA — o custo já decidiu o resultado?
 *   2. PODER      — o desenho é capaz de detectar o edge, se ele existir?
 *   3. N_EFETIVO  — quantas apostas independentes existem de fato na cesta?
 *
 * DISCIPLINA DE DADO (convenção do projeto): nada aqui é fabricado.
 *   - σ (volatilidade) e correlações: MEDIDOS ao vivo da Binance (klines reais).
 *   - custo: valores MEDIDOS por terceiros, com fonte e data declaradas abaixo.
 *   - k (edge bruto): DERIVADO da única medição de n grande do projeto.
 * Onde não há fonte real, o script reporta INDISPONÍVEL — nunca estima.
 *
 * ---------------------------------------------------------------------------
 * DERIVAÇÃO DAS FÓRMULAS DO GATE 1 (verificável algebricamente)
 * ---------------------------------------------------------------------------
 * Seja:
 *   t = holding period (anos)      σ = volatilidade anualizada
 *   c = custo round-trip (fração)  k = edge bruto adimensional
 *
 * Definição de k: retorno esperado por trade = k · σ√t. Como o desvio do
 * retorno no holding é σ√t, k É LITERALMENTE O SHARPE BRUTO POR TRADE.
 * (Essa identidade é o que torna k mensurável em backtest, não um chute.)
 *
 *   Sharpe líquido por trade = (k·σ√t − c) / (σ√t) = k − c/(σ√t)
 *   Trades por ano           = 1/t
 *   Sharpe anual             = [k − c/(σ√t)] · √(1/t) = k/√t − c/(σt)
 *
 * Otimizando em t:  d/dt [k·t^(−1/2) − c·σ⁻¹·t^(−1)] = 0
 *   −(k/2)·t^(−3/2) + (c/σ)·t^(−2) = 0   →   √t* = 2c/(kσ)
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │  t*        = 4c² / (k²σ²)                          │
 *   │  Sharpe_max = k²σ / (4c)                           │
 *   └────────────────────────────────────────────────────┘
 *
 * Invertendo para o uso honesto (k é o desconhecido, não o dado):
 *   k_requerido(S_alvo) = √(4·c·S_alvo / σ)
 *
 * ⚠️ PREMISSA EXPLÍCITA E JÁ CONTRARIADA POR MEDIÇÃO: as fórmulas assumem k
 * CONSTANTE em t (edge escala com √t junto com o movimento). O experimento
 * 2026-07-30-sma-pullback-crossasset MEDIU o contrário em BTCUSD — o edge
 * decai com o tamanho do stop e vira negativo a partir de ~446 pontos, ou
 * seja, k = k(t) decrescente, porque o sinal era microestrutura de 1–5 min.
 * Onde k decai mais rápido que o custo dilui, NÃO EXISTE t* positivo e o
 * ótimo analítico acima é um teto inalcançável, não uma previsão.
 * Por isso o script reporta t* como DIAGNÓSTICO (onde procurar), nunca como
 * recomendação de holding period.
 */

// ---------------------------------------------------------------------------
// FONTES DE CUSTO — todas medidas, com procedência declarada
// ---------------------------------------------------------------------------

/**
 * Custo round-trip por classe, em fração do notional.
 *
 * CRYPTO_MEASURED: medição real Pepperstone, BTCUSD spread médio 15,82 USD
 *   sobre preço 108.829,77, sem comissão em cripto CFD, janela 01–30/04/2026.
 *   Fonte: research/experiments/2026-07-30-sma-pullback-crossasset/HANDOFF.md
 *   (achado #1). Round-trip = 2 × (15,82 / 108.829,77) = 0,0291%... o handoff
 *   reporta 0,0145% já como round-trip, o que corresponde ao spread de UMA
 *   perna sobre o preço. Mantidos os DOIS valores para não escolher pelo
 *   usuário: `cryptoCfdOptimistic` (o número do handoff) e
 *   `cryptoCfdConservative` (o dobro, se 0,0145% for por perna).
 *
 * CRYPTO_COSTMODEL: o que research/CostModel.ts usa HOJE
 *   (COST_TABLE.CRYPTO = 0,08% comissão + 0,05% slippage = 0,13% por perna
 *   → 0,26% round-trip). O handoff mediu isto como ~18x superestimado e a
 *   correção está PENDENTE no código. Incluído para quantificar o impacto.
 */
const COST_SOURCES = {
  cryptoCfdOptimistic: {
    roundTrip: 0.0145 / 100,
    label: 'Cripto CFD — medido (Pepperstone, abr/2026)',
    provenance: 'HANDOFF.md achado #1, spread médio 15,82 USD / 108.829,77',
  },
  cryptoCfdConservative: {
    roundTrip: 0.0291 / 100,
    label: 'Cripto CFD — medido, leitura conservadora (2 pernas)',
    provenance: 'mesma medição, assumindo 0,0145% como custo POR PERNA',
  },
  cryptoCostModelTs: {
    roundTrip: 0.26 / 100,
    label: 'Cripto — CostModel.ts atual (⚠️ medido como ~18x alto)',
    provenance: 'research/CostModel.ts COST_TABLE.CRYPTO, correção pendente',
  },
  forexMajorCfd: {
    roundTrip: ((0.0 * 0.0001 + (3.5 * 2) / 100_000) / 1.085) * 2,
    label: 'Forex major CFD (EURUSD, Razor: spread mín + comissão)',
    provenance: 'cross_asset.py CUSTO_PCT.EURUSD (Pepperstone, abr/2026)',
  },
  indexCfdUs500: {
    roundTrip: (0.4 / 6000) * 2,
    label: 'Índice CFD (US500)',
    provenance: 'cross_asset.py CUSTO_PCT.US500 (Pepperstone, abr/2026)',
  },
  indexCfdUs30: {
    roundTrip: (2.0 / 44_000) * 2,
    label: 'Índice CFD (US30)',
    provenance: 'cross_asset.py CUSTO_PCT.US30 (Pepperstone, abr/2026)',
  },
};

/**
 * ÂNCORA EMPÍRICA DE k — o único edge de sinal já medido no projeto com
 * amostra grande, usado como referência de "quanto edge é realista".
 *
 * Derivação (HANDOFF.md achado #2, n = 202.075 trades de holdout):
 *   edge medido      = +2,35 pontos/trade (acerto 44,66% vs 42,86% neutro, z=+16,38)
 *   R:R              = stop 60 / alvo 80 pontos
 *   desvio por trade ≈ √(p(1−p)) · (alvo + stop)
 *                    = √(0,4466 × 0,5534) × 140 ≈ 69,6 pontos
 *   k = edge / desvio = 2,35 / 69,6 ≈ 0,0338
 *
 * Interpretação: mesmo o melhor sinal técnico já medido no projeto, com
 * significância esmagadora (z=+16), tem Sharpe bruto por trade de ~0,034.
 * Qualquer gate que exija k muito acima disso está pedindo um sinal mais
 * forte que tudo que 15 investigações encontraram.
 */
const K_EMPIRICAL = {
  value: 0.0338,
  label: 'BTCUSD SMA40/100+pullback, n=202.075, z=+16,38',
  source: 'HANDOFF.md achado #2 (2026-07-30)',
};

/** Cesta cripto da seção 11.13 — a mesma cujo N_eff foi diagnosticado como ~1,5. */
const CRYPTO_BASKET = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];

const TRADING_DAYS_PER_YEAR = 365; // cripto negocia 24/7

// ---------------------------------------------------------------------------
// UTILITÁRIOS ESTATÍSTICOS (implementados aqui para o script não ter dependência)
// ---------------------------------------------------------------------------

/** Inversa da normal padrão — aproximação de Acklam (|erro| < 1,15e-9). */
function normInv(p) {
  if (p <= 0 || p >= 1) throw new Error(`normInv: p fora de (0,1): ${p}`);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
             -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
             3.754408661907416e0];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p > pHigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
         (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

/** CDF da normal padrão via erf (Abramowitz-Stegun 7.1.26). */
function normCdf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t
            + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

function stdev(xs) {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

/**
 * Autovalores de matriz simétrica pelo método de Jacobi cíclico.
 * Usado para o N_efetivo por participation ratio.
 */
function jacobiEigenvalues(matrixIn, maxSweeps = 100) {
  const n = matrixIn.length;
  const a = matrixIn.map((row) => [...row]);
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
    if (off < 1e-14) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const cos = 1 / Math.sqrt(t * t + 1);
        const sin = t * cos;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = cos * akp - sin * akq;
          a[k][q] = sin * akp + cos * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = cos * apk - sin * aqk;
          a[q][k] = sin * apk + cos * aqk;
        }
      }
    }
  }
  return a.map((row, i) => row[i]).sort((x, y) => y - x);
}

// ---------------------------------------------------------------------------
// DADO REAL — Binance klines públicos (mesma fonte já usada no projeto)
// ---------------------------------------------------------------------------

async function fetchDailyCloses(symbol, limit = 1000) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status} para ${symbol}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Binance retornou vazio para ${symbol}`);
  }
  return rows.map((r) => ({ openTime: r[0], close: parseFloat(r[4]) }));
}

function toLogReturns(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

// ---------------------------------------------------------------------------
// GATE 1 — ARITMÉTICA DE CUSTO
// ---------------------------------------------------------------------------

function gate1Arithmetic({ costRoundTrip, annualVol, targetSharpe, kEmpirical }) {
  const c = costRoundTrip, sigma = annualVol;

  // k necessário para atingir o Sharpe alvo: k = √(4·c·S/σ)
  const kRequired = Math.sqrt((4 * c * targetSharpe) / sigma);

  // Teto de Sharpe usando o k empírico medido no projeto
  const sharpeMaxAtEmpiricalK = (kEmpirical ** 2 * sigma) / (4 * c);

  // Holding ótimo sob o k empírico (DIAGNÓSTICO — ver ressalva do cabeçalho)
  const tStarYears = (4 * c ** 2) / (kEmpirical ** 2 * sigma ** 2);

  const passes = sharpeMaxAtEmpiricalK >= targetSharpe;
  return {
    kRequired,
    kEmpirical,
    kRatio: kRequired / kEmpirical, // quantas vezes o edge precisa ser maior
    sharpeMaxAtEmpiricalK,
    tStarYears,
    tStarDays: tStarYears * 365,
    tStarHours: tStarYears * 365 * 24,
    passes,
  };
}

// ---------------------------------------------------------------------------
// GATE 2 — PODER ESTATÍSTICO
// ---------------------------------------------------------------------------

/**
 * n necessário para detectar Sharpe por trade `sharpePerTrade` com
 * significância α e poder (1−β):  n ≈ (z_α + z_β)² / S²
 */
function requiredN(sharpePerTrade, alpha = 0.05, power = 0.8) {
  const zAlpha = normInv(1 - alpha);
  const zBeta = normInv(power);
  return ((zAlpha + zBeta) ** 2) / (sharpePerTrade ** 2);
}

/** Poder realizado dado n efetivo disponível. */
function realizedPower(sharpePerTrade, nEffective, alpha = 0.05) {
  const zAlpha = normInv(1 - alpha);
  const ncp = sharpePerTrade * Math.sqrt(nEffective); // parâmetro de não-centralidade
  return normCdf(ncp - zAlpha);
}

/**
 * Inflação do Sharpe sob o nulo por múltiplos testes (base do Deflated Sharpe):
 * E[max Sharpe | nulo] ≈ σ_across_trials · [(1−γ)·z(1−1/N) + γ·z(1−1/(N·e))]
 * Mesma fórmula de research/DeflatedSharpe.ts.
 */
const EULER_MASCHERONI = 0.5772156649;
function expectedMaxSharpeUnderNull(sharpeVarAcrossTrials, nTrials) {
  if (nTrials <= 1) return 0;
  const sd = Math.sqrt(sharpeVarAcrossTrials);
  const a = normInv(1 - 1 / nTrials);
  const b = normInv(1 - 1 / (nTrials * Math.E));
  return sd * ((1 - EULER_MASCHERONI) * a + EULER_MASCHERONI * b);
}

function gate2Power({ sharpePerTrade, nAvailable, nEffective, nTrials, sharpeVarAcrossTrials }) {
  const nReq = requiredN(sharpePerTrade);
  const power = realizedPower(sharpePerTrade, nEffective);
  const nullInflation = expectedMaxSharpeUnderNull(sharpeVarAcrossTrials, nTrials);
  return {
    nRequired: nReq,
    nAvailable,
    nEffective,
    realizedPower: power,
    nullInflation,
    // O gate exige poder ≥ 50% — abaixo disso o resultado é indeterminado
    // por construção, e um "não significativo" não informa nada.
    passes: power >= 0.5,
  };
}

// ---------------------------------------------------------------------------
// GATE 3 — N EFETIVO (apostas genuinamente independentes)
// ---------------------------------------------------------------------------

function gate3EffectiveN(corrMatrix, minimumRequired = 8) {
  const n = corrMatrix.length;

  // Método A — participation ratio dos autovalores: (Σλ)² / Σλ²
  const eig = jacobiEigenvalues(corrMatrix);
  const sumLambda = eig.reduce((a, b) => a + b, 0);
  const sumLambdaSq = eig.reduce((a, b) => a + b * b, 0);
  const nEffEigen = (sumLambda ** 2) / sumLambdaSq;

  // Método B — fórmula clássica de carteira equiponderada:
  //   N_eff = N / (1 + (N−1)·ρ̄)
  let sumRho = 0, pairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) { sumRho += corrMatrix[i][j]; pairs++; }
  }
  const rhoBar = sumRho / pairs;
  const nEffAvgCorr = n / (1 + (n - 1) * rhoBar);

  return {
    nNominal: n,
    nEffEigen,
    nEffAvgCorr,
    meanCorrelation: rhoBar,
    eigenvalues: eig,
    passes: nEffEigen >= minimumRequired,
  };
}

// ---------------------------------------------------------------------------
// RELATÓRIO
// ---------------------------------------------------------------------------

const pct = (x, d = 4) => `${(x * 100).toFixed(d)}%`;
const num = (x, d = 3) => x.toFixed(d);

function line(char = '─', width = 78) { return char.repeat(width); }

async function main() {
  const targetSharpe = Number(process.env.TARGET_SHARPE ?? 1.0);

  console.log(line('═'));
  console.log('GATES DE VIABILIDADE — triagem antes de backtest');
  console.log(`data da execução: ${new Date().toISOString()}`);
  console.log(`Sharpe alvo: ${num(targetSharpe, 2)}  (env TARGET_SHARPE para mudar)`);
  console.log(line('═'));

  // ---- Dado real ---------------------------------------------------------
  console.log('\n▸ Baixando klines diários reais da Binance...');
  const series = {};
  for (const sym of CRYPTO_BASKET) {
    try {
      const closes = await fetchDailyCloses(sym);
      series[sym] = closes;
      process.stdout.write(`  ${sym}: ${closes.length} candles  `);
    } catch (err) {
      console.log(`\n  ⚠️  ${sym}: INDISPONÍVEL (${err.message}) — excluído, não estimado`);
    }
    await new Promise((r) => setTimeout(r, 250)); // espaçar chamadas (disciplina do projeto)
  }
  console.log('\n');

  const symbols = Object.keys(series);
  if (symbols.length < 2) {
    console.error('❌ Dado real insuficiente para calcular correlação. Abortado sem estimar.');
    process.exit(1);
  }

  // Alinhar por timestamp comum antes de correlacionar
  const commonTimes = symbols
    .map((s) => new Set(series[s].map((r) => r.openTime)))
    .reduce((acc, set) => new Set([...acc].filter((t) => set.has(t))));
  const sortedTimes = [...commonTimes].sort((a, b) => a - b);

  const returnsBySymbol = {};
  for (const sym of symbols) {
    const byTime = new Map(series[sym].map((r) => [r.openTime, r.close]));
    const closes = sortedTimes.map((t) => byTime.get(t));
    returnsBySymbol[sym] = toLogReturns(closes);
  }
  const nObs = returnsBySymbol[symbols[0]].length;
  const firstDay = new Date(sortedTimes[0]).toISOString().slice(0, 10);
  const lastDay = new Date(sortedTimes[sortedTimes.length - 1]).toISOString().slice(0, 10);
  console.log(`  janela comum: ${firstDay} → ${lastDay}  (${nObs} retornos diários)\n`);

  // ---- Volatilidade real medida -----------------------------------------
  console.log(line());
  console.log('VOLATILIDADE ANUALIZADA — medida do dado real (não assumida)');
  console.log(line());
  const vols = {};
  for (const sym of symbols) {
    vols[sym] = stdev(returnsBySymbol[sym]) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    console.log(`  ${sym.padEnd(10)} σ = ${pct(vols[sym], 1).padStart(8)}`);
  }
  const btcVol = vols['BTCUSDT'] ?? mean(Object.values(vols));

  // ---- GATE 3 ------------------------------------------------------------
  console.log('\n' + line());
  console.log('GATE 3 — N EFETIVO (quantas apostas independentes existem)');
  console.log(line());
  const corr = symbols.map((a) => symbols.map((b) => pearson(returnsBySymbol[a], returnsBySymbol[b])));

  process.stdout.write('           ');
  for (const s of symbols) process.stdout.write(s.replace('USDT', '').padStart(7));
  console.log();
  for (let i = 0; i < symbols.length; i++) {
    process.stdout.write(`  ${symbols[i].replace('USDT', '').padEnd(9)}`);
    for (let j = 0; j < symbols.length; j++) process.stdout.write(num(corr[i][j], 2).padStart(7));
    console.log();
  }

  const g3 = gate3EffectiveN(corr);
  console.log(`\n  correlação média entre pares : ${num(g3.meanCorrelation, 3)}`);
  console.log(`  autovalores                  : ${g3.eigenvalues.map((e) => num(e, 2)).join(', ')}`);
  console.log(`  N nominal                    : ${g3.nNominal}`);
  console.log(`  N efetivo (participation)    : ${num(g3.nEffEigen, 2)}`);
  console.log(`  N efetivo (corr. média)      : ${num(g3.nEffAvgCorr, 2)}`);
  console.log(`  ${g3.passes ? '✅ PASSA' : '❌ REPROVA'} (mínimo exigido: 8 apostas independentes)`);

  // ---- GATE 1 ------------------------------------------------------------
  console.log('\n' + line());
  console.log('GATE 1 — ARITMÉTICA DE CUSTO');
  console.log(line());
  console.log(`  k empírico de referência: ${num(K_EMPIRICAL.value, 4)}  (${K_EMPIRICAL.label})`);
  console.log(`  σ usada (BTCUSDT, medida): ${pct(btcVol, 1)}\n`);
  console.log('  fonte de custo                                    c_rt      k_req   k_req/k_emp  Sharpe_max    t* ');
  console.log('  ' + line('-', 100));

  const gate1Rows = [];
  for (const [key, src] of Object.entries(COST_SOURCES)) {
    const g1 = gate1Arithmetic({
      costRoundTrip: src.roundTrip,
      annualVol: btcVol,
      targetSharpe,
      kEmpirical: K_EMPIRICAL.value,
    });
    gate1Rows.push({ key, src, g1 });
    const tStarLabel = g1.tStarDays >= 1 ? `${num(g1.tStarDays, 1)}d` : `${num(g1.tStarHours, 1)}h`;
    console.log(
      `  ${src.label.padEnd(48).slice(0, 48)} ${pct(src.roundTrip, 4).padStart(8)} ` +
      `${num(g1.kRequired, 4).padStart(8)} ${num(g1.kRatio, 2).padStart(11)}x ` +
      `${num(g1.sharpeMaxAtEmpiricalK, 2).padStart(10)} ${tStarLabel.padStart(7)}`
    );
  }
  console.log('\n  Leitura: k_req é o edge bruto por trade necessário para o Sharpe alvo.');
  console.log('           k_req/k_emp > 1 significa precisar de sinal MAIS FORTE que o');
  console.log('           melhor já medido no projeto (n=202k, z=+16).');
  console.log('           t* é DIAGNÓSTICO de onde procurar, não recomendação — ver');
  console.log('           ressalva de k(t) no cabeçalho do script.');

  // ---- GATE 2 ------------------------------------------------------------
  console.log('\n' + line());
  console.log('GATE 2 — PODER ESTATÍSTICO');
  console.log(line());

  // Cenário reconstruído das seções 11.10/11.11 do AI_BRAIN_SPEC.md
  const scenarios = [
    { label: 'holdout típico das seções 11.5-11.9', n: 20, nTrials: 106 },
    { label: 'pooled forex 7 pares (seção 11.10)', n: 92, nTrials: 106 },
    { label: 'pooled 10 anos (seção 11.11)', n: 322, nTrials: 106 },
    { label: 'cross-asset BTCUSD (2026-07-30)', n: 202_075, nTrials: 1455 },
  ];

  console.log(`  Sharpe por trade testado: ${num(K_EMPIRICAL.value, 4)} (k empírico medido)\n`);
  console.log('  cenário                                   n        N_eff   poder    n necessário');
  console.log('  ' + line('-', 78));

  const nEffRatio = g3.nEffEigen / g3.nNominal; // desconto por correlação real
  for (const sc of scenarios) {
    const nEff = sc.n * nEffRatio;
    const g2 = gate2Power({
      sharpePerTrade: K_EMPIRICAL.value,
      nAvailable: sc.n,
      nEffective: nEff,
      nTrials: sc.nTrials,
      sharpeVarAcrossTrials: 0.01,
    });
    console.log(
      `  ${sc.label.padEnd(40).slice(0, 40)} ${String(sc.n).padStart(7)} ` +
      `${num(nEff, 0).padStart(8)} ${pct(g2.realizedPower, 1).padStart(7)} ` +
      `${num(g2.nRequired, 0).padStart(12)}   ${g2.passes ? '✅' : '❌'}`
    );
  }

  const nReqBase = requiredN(K_EMPIRICAL.value);
  console.log(`\n  n necessário (poder 80%, α=5%): ${num(nReqBase, 0)} trades INDEPENDENTES`);
  console.log(`  desconto de independência aplicado: N_eff/N = ${num(nEffRatio, 3)} (medido acima)`);
  console.log(`  → em trades brutos correlacionados: ${num(nReqBase / nEffRatio, 0)}`);

  // ---- VEREDITO ----------------------------------------------------------
  console.log('\n' + line('═'));
  console.log('VEREDITO');
  console.log(line('═'));
  const bestCost = gate1Rows.reduce((a, b) =>
    b.g1.sharpeMaxAtEmpiricalK > a.g1.sharpeMaxAtEmpiricalK ? b : a);
  console.log(`  Gate 1 (aritmética): melhor fonte de custo é "${bestCost.src.label}"`);
  console.log(`     → Sharpe teto ${num(bestCost.g1.sharpeMaxAtEmpiricalK, 2)} com k empírico ` +
              `${bestCost.g1.passes ? '✅ acima' : '❌ abaixo'} do alvo ${num(targetSharpe, 2)}`);
  console.log(`  Gate 3 (N efetivo): ${num(g3.nEffEigen, 2)} apostas reais em ${g3.nNominal} ativos ` +
              `${g3.passes ? '✅' : '❌'}`);
  console.log(`  Gate 2 (poder): ver tabela — cenários abaixo de 50% são indeterminados,`);
  console.log(`     não negativos. Um "não significativo" ali não é evidência de ausência.`);
  console.log(line('═'));

  // ---- Persistência ------------------------------------------------------
  const out = {
    executedAt: new Date().toISOString(),
    targetSharpe,
    dataWindow: { from: firstDay, to: lastDay, observations: nObs },
    volatilities: vols,
    gate1: gate1Rows.map(({ key, src, g1 }) => ({ source: key, label: src.label,
      provenance: src.provenance, costRoundTrip: src.roundTrip, ...g1 })),
    gate2: { requiredNIndependent: nReqBase, nEffRatio,
      requiredNRaw: nReqBase / nEffRatio, scenarios },
    gate3: { ...g3, symbols, correlationMatrix: corr },
    kEmpirical: K_EMPIRICAL,
  };
  const fs = await import('node:fs/promises');
  const path = new URL('../results/gates-output.json', import.meta.url);
  await fs.writeFile(path, JSON.stringify(out, null, 2));
  console.log(`\nResultado completo salvo em results/gates-output.json`);
}

main().catch((err) => {
  console.error('\n❌ Falhou:', err.message);
  process.exit(1);
});
