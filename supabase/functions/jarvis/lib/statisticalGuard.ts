// Salvaguarda de teste múltiplo pro Jarvis — "auto-evolução segura".
//
// Achado 2026-08-23 (SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md,
// seção 5.2): reanálise a cada 6h "multiplica testes ao longo do tempo" — o
// Jarvis vai achar ajuste por acaso com frequência crescente se o número de
// testes já feitos (K) não acumular desde a criação do sistema. Isto NÃO é
// machine learning (sem peso/treino) — é correção clássica de teste de
// hipótese repetido (Šidák), aplicada ao motor de regras que já existe.
//
// Uso: cada regra estatística do Jarvis (ex: win rate vs breakeven) chama
// `incrementAndGetTestCount` uma vez por avaliação (dispare ou não a regra —
// o próprio ato de checar já conta como um teste), calcula o p-value do
// efeito observado, corrige o alpha pelo K acumulado via `sidakCorrectedAlpha`,
// e só deixa autoaplicar (`evaluateGuardrails`) se passar no limiar corrigido.

// ────────────────────────────────────────────────────────────────────────
// Teste binomial exato — usado pra "win rate observado vs breakeven"
// ────────────────────────────────────────────────────────────────────────

function logFactorial(n: number): number {
  let sum = 0;
  for (let i = 2; i <= n; i++) sum += Math.log(i);
  return sum;
}

function logBinomialCoefficient(n: number, k: number): number {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

function binomialPMF(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logBinomialCoefficient(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/**
 * p-value bicaudal exato: probabilidade de observar um resultado tão ou
 * mais extremo que `wins` de `n` tentativas, sob H0 de taxa real = p0.
 * Soma todos os k cuja probabilidade sob H0 é <= a probabilidade do
 * resultado observado (definição padrão de p-value bicaudal exato pra
 * distribuição discreta, evita a assimetria de "dobrar o unicaudal").
 */
export function binomialTestPValue(wins: number, n: number, p0: number): number {
  if (n <= 0) return 1;
  const observedProb = binomialPMF(wins, n, p0);
  let pValue = 0;
  for (let k = 0; k <= n; k++) {
    const prob = binomialPMF(k, n, p0);
    if (prob <= observedProb * (1 + 1e-9)) pValue += prob;
  }
  return Math.min(1, pValue);
}

// ────────────────────────────────────────────────────────────────────────
// Correção de Šidák
// ────────────────────────────────────────────────────────────────────────

/**
 * Alpha corrigido pra manter a taxa de erro familywise ~alphaBase depois de
 * `k` testes acumulados (mais conservador a cada teste novo — o mesmo
 * espírito do DSR: reanálise repetida sem correção "acha" edge por acaso).
 * k<=1 devolve alphaBase sem correção (primeiro teste da história).
 */
export function sidakCorrectedAlpha(alphaBase: number, k: number): number {
  if (k <= 1) return alphaBase;
  return 1 - Math.pow(1 - alphaBase, 1 / k);
}

// ────────────────────────────────────────────────────────────────────────
// Contador global de testes (persistido, nunca reseta)
// ────────────────────────────────────────────────────────────────────────

/**
 * Incrementa e lê o contador global de testes de hipótese já feitos pelo
 * Jarvis desde a criação do sistema. Falha FECHADA de propósito (diferente
 * do padrão fail-open do resto do projeto): se não conseguir ler/gravar o
 * contador, devolve null — quem chama deve tratar null como "não autoaplicar
 * esta decisão agora" (a decisão vira observação/PENDING, não trava o motor
 * de trading, só impede o Jarvis de autoajustar sem saber quantos testes já
 * fez).
 */
// deno-lint-ignore no-explicit-any
export async function incrementAndGetTestCount(sb: any): Promise<number | null> {
  try {
    const { data: row, error: readError } = await sb
      .from('jarvis_dsr_state')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (readError) {
      console.error('[jarvis] Falha ao ler jarvis_dsr_state:', readError);
      return null;
    }

    const now = new Date().toISOString();
    const newCount = (row?.tests_since_inception ?? 0) + 1;

    const { error: writeError } = await sb
      .from('jarvis_dsr_state')
      .update({
        tests_since_inception: newCount,
        first_test_at: row?.first_test_at ?? now,
        last_test_at: now,
        updated_at: now,
      })
      .eq('id', true);
    if (writeError) {
      console.error('[jarvis] Falha ao gravar jarvis_dsr_state:', writeError);
      return null;
    }

    return newCount;
  } catch (err) {
    console.error('[jarvis] Erro não tratado em incrementAndGetTestCount:', err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Mann-Whitney U (aproximação normal) — usado pra "confidence AUC vs 0.5"
// ────────────────────────────────────────────────────────────────────────

function erf(x: number): number {
  // Aproximação de Abramowitz & Stegun 7.1.26, erro máx ~1.5e-7.
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * p-value bicaudal de "AUC observada difere de 0.5 (acaso)" via
 * aproximação normal do U de Mann-Whitney (sem correção de empate — ok pra
 * uso de triagem do Jarvis, não é o teste final da pesquisa formal).
 * `nPos`/`nNeg` = nº de trades vencedores/perdedores com confidence
 * preenchido (mesma base usada pra calcular a AUC em computeMetrics).
 */
export function mannWhitneyPValue(auc: number, nPos: number, nNeg: number): number {
  if (nPos <= 0 || nNeg <= 0) return 1;
  const u = auc * nPos * nNeg;
  const meanU = (nPos * nNeg) / 2;
  const varU = (nPos * nNeg * (nPos + nNeg + 1)) / 12;
  if (varU <= 0) return 1;
  const z = (u - meanU) / Math.sqrt(varU);
  return Math.min(1, 2 * (1 - normalCDF(Math.abs(z))));
}
