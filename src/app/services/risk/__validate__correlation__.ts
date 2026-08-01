/**
 * Validação determinística do guard de correlação ao vivo (Componente 3 do
 * cérebro de execução, `research/RISK_MODULE_SPEC.md` seção 3.5). Cobre só a
 * parte pura (Pearson + decisão de bloqueio) — a busca de candle real
 * (`fetchRecentClosesForCorrelation`) depende de rede, mesma exceção do
 * resto da suíte (TradeEfficiencyDiagnostic).
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__correlation__.ts --bundle --platform=node --outfile=/tmp/validate-correlation.js && node /tmp/validate-correlation.js
 */
import { computeLogReturns, computePearsonCorrelation, computeLiveCorrelationGuard } from './LiveCorrelationGuard';

let passed = 0;
let failed = 0;

function assertTrue(label: string, condition: boolean) {
  if (!condition) {
    console.error(`❌ FALHOU: ${label}`);
    failed++;
  } else {
    console.log(`✅ OK: ${label}`);
    passed++;
  }
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

// ─── computeLogReturns ──────────────────────────────────────────────────────
{
  assertTrue('log-returns de série constante é tudo zero', computeLogReturns([100, 100, 100]).every(r => r === 0));
  assertTrue('log-returns tem N-1 pontos pra série de N closes', computeLogReturns([1, 2, 3, 4]).length === 3);
  assertTrue('log-returns de série vazia é vazia', computeLogReturns([]).length === 0);
}

// ─── computePearsonCorrelation ──────────────────────────────────────────────
{
  const identical = [0.01, -0.02, 0.03, -0.01, 0.02];
  const corrSelf = computePearsonCorrelation(identical, identical);
  assertTrue('correlação de uma série com ela mesma é 1', corrSelf !== null && approx(corrSelf, 1, 1e-9));

  const inverted = identical.map(v => -v);
  const corrInverted = computePearsonCorrelation(identical, inverted);
  assertTrue('correlação com a série invertida é -1', corrInverted !== null && approx(corrInverted, -1, 1e-9));

  assertTrue('séries de tamanhos diferentes -> null (não realinha silenciosamente)', computePearsonCorrelation([1, 2, 3], [1, 2]) === null);
  assertTrue('variância zero (série constante) -> null, nunca 0 fabricado', computePearsonCorrelation([0, 0, 0], [1, -1, 2]) === null);
}

// ─── computeLiveCorrelationGuard (função pura, dado sintético controlado) ──
{
  // Candidato e posição aberta com retornos idênticos -> correlação ~1, bloqueia
  const returnsHigh = Array.from({ length: 40 }, (_, i) => Math.sin(i / 3) * 0.01);
  const closesFromReturns = (returns: number[]): number[] => {
    const closes = [100];
    for (const r of returns) closes.push(closes[closes.length - 1] * Math.exp(r));
    return closes;
  };

  const history = {
    BTCUSDT: closesFromReturns(returnsHigh),
    ETHUSDT: closesFromReturns(returnsHigh), // mesmíssimos retornos -> correlação 1
  };

  const blockedResult = computeLiveCorrelationGuard('BTCUSDT', [{ symbol: 'ETHUSDT' }], history, { thresholdAbs: 0.7, minBars: 20 });
  assertTrue('correlação real alta entre candidato e posição aberta -> bloqueia', blockedResult.blocked === true);
  assertTrue('pairwiseCorrelations reporta o par calculado', typeof blockedResult.pairwiseCorrelations.ETHUSDT === 'number');
  assertTrue('correlação calculada é alta (> 0.9) para séries idênticas', blockedResult.pairwiseCorrelations.ETHUSDT > 0.9);

  // Sem posição aberta -> nunca bloqueia
  const noOpenResult = computeLiveCorrelationGuard('BTCUSDT', [], history, { thresholdAbs: 0.7, minBars: 20 });
  assertTrue('sem posição aberta -> não bloqueia', noOpenResult.blocked === false);

  // Histórico insuficiente -> recusa (não bloqueia, não aprova por engano — reporta insuficiência)
  const shortHistory = { BTCUSDT: [100, 101, 102], ETHUSDT: [50, 51, 52] };
  const insufficientResult = computeLiveCorrelationGuard('BTCUSDT', [{ symbol: 'ETHUSDT' }], shortHistory, { thresholdAbs: 0.7, minBars: 20 });
  assertTrue('histórico insuficiente -> não bloqueia (recusa calcular, não assume risco)', insufficientResult.blocked === false);
  assertTrue('histórico insuficiente -> reason explica a recusa', typeof insufficientResult.reason === 'string' && insufficientResult.reason.length > 0);
  assertTrue('histórico insuficiente -> símbolo aparece em insufficientData, nunca em pairwiseCorrelations', insufficientResult.insufficientData.includes('ETHUSDT') && insufficientResult.pairwiseCorrelations.ETHUSDT === undefined);

  // Correlação baixa (séries independentes/ruído) -> não bloqueia
  const returnsLow = Array.from({ length: 40 }, (_, i) => (i % 7 === 0 ? 0.02 : -0.005) * ((i * 37) % 5 === 0 ? -1 : 1));
  const historyLowCorr = {
    BTCUSDT: closesFromReturns(returnsHigh),
    XAUUSD: closesFromReturns(returnsLow),
  };
  const lowCorrResult = computeLiveCorrelationGuard('BTCUSDT', [{ symbol: 'XAUUSD' }], historyLowCorr, { thresholdAbs: 0.95, minBars: 20 });
  assertTrue('correlação abaixo do limiar -> não bloqueia', lowCorrResult.blocked === false);

  // O próprio candidato nunca entra como par contra si mesmo
  const selfResult = computeLiveCorrelationGuard('BTCUSDT', [{ symbol: 'BTCUSDT' }], history, { thresholdAbs: 0.7, minBars: 20 });
  assertTrue('posição aberta no mesmo símbolo do candidato é ignorada (não vira par consigo mesmo)', Object.keys(selfResult.pairwiseCorrelations).length === 0 && selfResult.insufficientData.length === 0);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
