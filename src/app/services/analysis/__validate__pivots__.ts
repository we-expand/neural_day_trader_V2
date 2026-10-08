// Validação dos pivôs clássicos do último pregão (2026-10-08). O teste principal é DADO REAL: as velas de 1H do
// UKOUSD de 06-07/10/2026 contra as 7 linhas lidas no print do MT5 do Cleber (Order Block Finder 3.08).
//   npx esbuild src/app/services/analysis/__validate__pivots__.ts --bundle --platform=node --outfile=/tmp/validate-pivots.js && node /tmp/validate-pivots.js

import {
  computeClassicPivots,
  lastCompletedSessionPivots,
  usDstActive,
  brokerServerOffsetHours,
  type PivotCandle,
} from './sessionPivots';

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const utc = (s: string) => Date.parse(s);

// [início UTC, O, H, L, C] -- ohlcv_data do UKOUSD (1H), do pregão anterior ao print.
const RAW: Array<[string, number, number, number, number]> = [
  ['2026-10-06T19:00:00Z', 105.112, 105.352, 105.047, 105.292],
  ['2026-10-06T20:00:00Z', 105.302, 105.602, 105.237, 105.462],
  ['2026-10-07T00:00:00Z', 105.239, 105.695, 105.109, 105.485],
  ['2026-10-07T01:00:00Z', 105.505, 105.889, 105.49, 105.64],
  ['2026-10-07T02:00:00Z', 105.645, 105.65, 105.424, 105.539],
  ['2026-10-07T03:00:00Z', 105.544, 105.839, 105.544, 105.734],
  ['2026-10-07T04:00:00Z', 105.719, 105.765, 105.425, 105.495],
  ['2026-10-07T05:00:00Z', 105.5, 105.759, 105.214, 105.434],
  ['2026-10-07T06:00:00Z', 105.439, 105.735, 105.349, 105.635],
  ['2026-10-07T07:00:00Z', 105.645, 105.794, 105.014, 105.054],
  ['2026-10-07T08:00:00Z', 105.064, 105.475, 104.914, 105.299],
  ['2026-10-07T09:00:00Z', 105.314, 106.145, 105.275, 105.9],
  ['2026-10-07T10:00:00Z', 105.905, 106.19, 105.734, 105.935],
  ['2026-10-07T11:00:00Z', 105.925, 106.43, 105.244, 105.439],
  ['2026-10-07T12:00:00Z', 105.414, 106.029, 105.304, 105.789],
  ['2026-10-07T13:00:00Z', 105.784, 106.68, 105.495, 106.015],
  ['2026-10-07T14:00:00Z', 106.005, 106.139, 105.425, 105.794],
  ['2026-10-07T15:00:00Z', 105.804, 106.09, 104.905, 105.039],
  ['2026-10-07T16:00:00Z', 105.044, 105.409, 104.519, 104.814],
  ['2026-10-07T17:00:00Z', 104.829, 104.895, 103.725, 104.095],
  ['2026-10-07T18:00:00Z', 104.1, 104.604, 104.09, 104.545],
  ['2026-10-07T19:00:00Z', 104.54, 105.339, 104.504, 105.035],
  ['2026-10-07T20:00:00Z', 105.04, 105.355, 104.905, 105.024],
];
const UKO: PivotCandle[] = RAW.map(([t, o, h, l, c]) => ({ timestamp: utc(t), open: o, high: h, low: l, close: c }));

console.log('\n[1] Fórmula clássica (valores conhecidos)');
{
  const p = computeClassicPivots(110, 90, 100);
  assert(near(p.pivot, 100, 1e-9), 'P = (110+90+100)/3 = 100');
  assert(near(p.r1, 110, 1e-9) && near(p.s1, 90, 1e-9), 'R1 = 2P-L = 110 e S1 = 2P-H = 90');
  assert(near(p.r2, 120, 1e-9) && near(p.s2, 80, 1e-9), 'R2 = P+(H-L) = 120 e S2 = P-(H-L) = 80');
  assert(near(p.r3, 130, 1e-9) && near(p.s3, 70, 1e-9), 'R3 = H+2(P-L) = 130 e S3 = L-2(H-P) = 70');
}

console.log('\n[2] UKOUSD real contra as 7 linhas do print do MT5 (tolerância 0,03 = leitura do print)');
{
  const now = utc('2026-10-08T03:35:00Z'); // hora do print
  const r = lastCompletedSessionPivots(UKO, 'UKOUSD', now);
  assert(r !== null, 'acha o pregão concluído');
  if (r) {
    assert(r.calibrated, 'UKOUSD está marcado como calibrado');
    assert(near(r.high, 106.68, 1e-9) && near(r.low, 103.725, 1e-9), 'máxima 106,68 e mínima 103,725 do pregão (06/10 19:00Z a 07/10 19:00Z)');
    assert(near(r.close, 104.545, 1e-9), 'fechamento do pregão = vela das 18:00Z (104,545), não a das 20:00Z');
    assert(near(r.pivots.pivot, 105.0, 0.03), `P ≈ 105,00 (calculado ${r.pivots.pivot.toFixed(3)})`);
    assert(near(r.pivots.r1, 106.24, 0.03), `R1 ≈ 106,24 = a resistência que o Cleber apontou (calculado ${r.pivots.r1.toFixed(3)})`);
    assert(near(r.pivots.r2, 107.94, 0.03), `R2 ≈ 107,94 (calculado ${r.pivots.r2.toFixed(3)})`);
    assert(near(r.pivots.r3, 109.19, 0.03), `R3 ≈ 109,19 (calculado ${r.pivots.r3.toFixed(3)})`);
    assert(near(r.pivots.s1, 103.3, 0.03), `S1 ≈ 103,30 (calculado ${r.pivots.s1.toFixed(3)})`);
    assert(near(r.pivots.s2, 102.05, 0.03), `S2 ≈ 102,05 (calculado ${r.pivots.s2.toFixed(3)})`);
    assert(near(r.pivots.s3, 100.35, 0.03), `S3 ≈ 100,35 (calculado ${r.pivots.s3.toFixed(3)})`);
  }
}

console.log('\n[3] A virada do pregão acompanha o horário: antes da virada de hoje, vale o pregão de ontem');
{
  const before = lastCompletedSessionPivots(UKO, 'UKOUSD', utc('2026-10-07T18:30:00Z'));
  // 07/10 18:30Z ainda é antes da virada das 19:00Z de 07/10: o último pregão concluído termina em 06/10 19:00Z -> poucas velas no dado de teste.
  assert(before === null, 'antes da virada, sem candles suficientes do pregão anterior no dado de teste, devolve null (nunca inventa nível)');
}

console.log('\n[4] Horário de verão do servidor do MT5');
{
  assert(usDstActive(utc('2026-10-08T00:00:00Z')) && brokerServerOffsetHours(utc('2026-10-08T00:00:00Z')) === 3, 'em outubro o servidor está em GMT+3');
  assert(!usDstActive(utc('2026-11-10T00:00:00Z')) && brokerServerOffsetHours(utc('2026-11-10T00:00:00Z')) === 2, 'em novembro (depois do 1º domingo) volta para GMT+2');
  assert(!usDstActive(utc('2026-03-05T00:00:00Z')), 'no começo de março ainda é GMT+2');
  assert(usDstActive(utc('2026-03-09T12:00:00Z')), 'depois do 2º domingo de março (08/03/2026) é GMT+3');
  // No inverno a virada de 22:00 do servidor cai às 20:00Z: uma vela das 19:30Z ainda pertence ao pregão anterior.
  const winter: PivotCandle[] = [];
  for (let h = 0; h < 72; h++) {
    const t = utc('2026-12-01T00:00:00Z') + h * 3600000;
    const px = 100 + (h % 24);
    winter.push({ timestamp: t, open: px, high: px + 1, low: px - 1, close: px + 0.5 });
  }
  const r = lastCompletedSessionPivots(winter, 'UKOUSD', utc('2026-12-03T10:00:00Z'));
  assert(r !== null && r.sessionEnd === utc('2026-12-02T20:00:00Z') && r.sessionStart === utc('2026-12-01T20:00:00Z'), 'em dezembro o pregão do UKOUSD vai de 20:00Z a 20:00Z');
}

console.log('\n[5] Ativo não calibrado e dados insuficientes');
{
  const r = lastCompletedSessionPivots(UKO, 'ZZZUSD', utc('2026-10-08T03:35:00Z'));
  assert(r !== null && r.calibrated === false, 'ativo sem calibração sai com calibrated=false (a IA não pode usar)');
  assert(lastCompletedSessionPivots(UKO.slice(0, 3), 'UKOUSD', utc('2026-10-08T03:35:00Z')) === null, 'menos de 6 candles no total -> null');
  assert(lastCompletedSessionPivots([], 'UKOUSD', utc('2026-10-08T03:35:00Z')) === null, 'sem candles -> null');
  const bad: PivotCandle[] = UKO.map((c, i) => (i === 5 ? { ...c, high: Number.NaN } : c));
  const rb = lastCompletedSessionPivots(bad, 'UKOUSD', utc('2026-10-08T03:35:00Z'));
  assert(rb !== null && Number.isFinite(rb.pivots.r1), 'vela com NaN é descartada, sem contaminar os níveis');
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
