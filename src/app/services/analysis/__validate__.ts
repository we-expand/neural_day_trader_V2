/**
 * Validação determinística do diagnóstico de eficiência de saída (Componente
 * 5 do cérebro de execução, `CLAUDE.md` pendência #5). Cobre só a parte pura
 * (cálculo de MFE/MAE a partir de candle sintético + interpretação do
 * resultado) — a busca de candle real via `backtestDataService` depende de
 * rede e não entra neste gate (mesma lógica do resto da suíte `npm run validate`).
 *
 * Roda com: npx esbuild src/app/services/analysis/__validate__.ts --bundle --platform=node --format=esm --outfile=/tmp/validate-analysis.mjs && node /tmp/validate-analysis.mjs
 */
import { computeMfeMaeFromCandles, diagnoseTradeEfficiency, pickDiagnosticTimeframe } from './TradeEfficiencyDiagnostic';
import type { CandleData } from '../BacktestDataService';

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

function makeCandle(time: number, high: number, low: number): CandleData {
  return { time, open: (high + low) / 2, high, low, close: (high + low) / 2, volume: 0 };
}

// ─── CASO 1: MFE/MAE em LONG — pega o high mais alto e o low mais baixo, não o candle de saída ──
{
  const entryPrice = 100;
  const candles: CandleData[] = [
    makeCandle(0, 102, 99),
    makeCandle(1, 116, 100), // maior high da série -> MFE 16%
    makeCandle(2, 110, 90),  // menor low da série -> MAE 10%
    makeCandle(3, 108, 95),
  ];
  const { mfePercent, maePercent } = computeMfeMaeFromCandles(candles, 'LONG', entryPrice);
  assertTrue('LONG: MFE captura o maior high de toda a janela (16%)', Math.abs(mfePercent - 16) < 0.001);
  assertTrue('LONG: MAE captura o menor low de toda a janela (10%)', Math.abs(maePercent - 10) < 0.001);
}

// ─── CASO 2: MFE/MAE em SHORT — favorável é queda de preço, adverso é alta ──
{
  const entryPrice = 100;
  const candles: CandleData[] = [
    makeCandle(0, 105, 98),
    makeCandle(1, 112, 80), // menor low -> maior queda -> MFE 20% pro SHORT
    makeCandle(2, 118, 90), // maior high -> MAE 18% pro SHORT
  ];
  const { mfePercent, maePercent } = computeMfeMaeFromCandles(candles, 'SHORT', entryPrice);
  assertTrue('SHORT: MFE captura a maior queda (low=80 -> 20%)', Math.abs(mfePercent - 20) < 0.001);
  assertTrue('SHORT: MAE captura a maior alta (high=118 -> 18%)', Math.abs(maePercent - 18) < 0.001);
}

// ─── CASO 3: entryPrice inválido lança erro em vez de dividir por zero silenciosamente ──
{
  let threw = false;
  try { computeMfeMaeFromCandles([makeCandle(0, 10, 5)], 'LONG', 0); } catch { threw = true; }
  assertTrue('entryPrice <= 0 lança erro explícito', threw);
}

// ─── CASO 4: interpretação de eficiência — captura total, parcial e devolução completa ──
{
  const perfect = diagnoseTradeEfficiency(10, 10);
  assertTrue('capturou 100% do MFE -> exitEfficiency = 1', perfect.exitEfficiency === 1 && Math.abs((perfect.gaveBackPercent as number) - 0) < 0.001);

  const half = diagnoseTradeEfficiency(10, 5);
  assertTrue('capturou metade do MFE -> exitEfficiency = 0.5, devolveu 50%', half.exitEfficiency === 0.5 && Math.abs((half.gaveBackPercent as number) - 50) < 0.001);

  const gaveItAllBack = diagnoseTradeEfficiency(10, -2);
  assertTrue('chegou a ter MFE positivo mas saiu no prejuízo -> exitEfficiency negativo, devolveu >100%', (gaveItAllBack.exitEfficiency as number) < 0 && (gaveItAllBack.gaveBackPercent as number) > 100);

  const neverFavorable = diagnoseTradeEfficiency(0, -3);
  assertTrue('MFE zero (preço nunca foi favorável) -> exitEfficiency e gaveBackPercent são null, nunca Infinity/NaN', neverFavorable.exitEfficiency === null && neverFavorable.gaveBackPercent === null);
}

// ─── CASO 5: escolha de timeframe é só limite de payload, cresce com a duração do trade ──
{
  const hour = 3_600_000;
  assertTrue('trade de 2h -> 1m (janela curta, granularidade fina cabe)', pickDiagnosticTimeframe(0, 2 * hour) === '1m');
  assertTrue('trade de 24h -> 5m', pickDiagnosticTimeframe(0, 24 * hour) === '5m');
  assertTrue('trade de 5 dias -> 1h', pickDiagnosticTimeframe(0, 5 * 24 * hour) === '1h');
  assertTrue('trade de 30 dias -> 4h (janela longa, evita payload enorme de 1m)', pickDiagnosticTimeframe(0, 30 * 24 * hour) === '4h');
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
