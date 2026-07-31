/**
 * Validação determinística do Tail Risk Guard (Bloco E do cérebro cognitivo,
 * `research/AI_COGNITIVE_SPEC.md`) — reação mecânica a choque de volatilidade
 * observado, nunca previsão.
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__tailrisk__.ts --bundle --platform=node --outfile=/tmp/validate-tailrisk.js && node /tmp/validate-tailrisk.js
 */
import { evaluateTailRisk } from './TailRiskGuard';

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

// ─── Sem dado nenhum -> nunca fabrica veredito ──────────────────────────────
{
  const r = evaluateTailRisk({ atrExpansionRatio: null, vix: null, openExposurePercent: 10 });
  assertTrue('atrExpansionRatio=null e vix=null -> action=NONE, multiplicador=1 (não fabrica veredito)', r.action === 'NONE' && r.newPositionSizeMultiplier === 1);
  assertTrue('sem dado nenhum -> triggeredBy=NONE', r.triggeredBy === 'NONE');
}

// ─── Só ATR (VIX indisponível) -> continua funcionando, degrada com honestidade ─
{
  const r = evaluateTailRisk({ atrExpansionRatio: 3.0, vix: undefined, openExposurePercent: 5 });
  assertTrue('só ATR disponível -> ainda classifica normalmente por ATR', r.action === 'BLOCK_NEW_ENTRIES');
  assertTrue('só ATR disponível -> triggeredBy=ATR', r.triggeredBy === 'ATR');
}

// ─── Só VIX (ATR indisponível) -> funciona pela leitura de mercado sozinha ──
{
  const r = evaluateTailRisk({ atrExpansionRatio: null, vix: 45, openExposurePercent: 5 });
  assertTrue('só VIX disponível, VIX=45 (pânico) -> EMERGENCY_CLOSE mesmo sem ATR', r.action === 'EMERGENCY_CLOSE');
  assertTrue('só VIX disponível -> triggeredBy=VIX', r.triggeredBy === 'VIX');
}

// ─── VIX sozinho, cada faixa da convenção CBOE ──────────────────────────────
{
  assertTrue('VIX=15 (normal) -> NONE', evaluateTailRisk({ atrExpansionRatio: null, vix: 15, openExposurePercent: 0 }).action === 'NONE');
  assertTrue('VIX=20 (limiar de cautela) -> REDUCE_SIZE', evaluateTailRisk({ atrExpansionRatio: null, vix: 20, openExposurePercent: 0 }).action === 'REDUCE_SIZE');
  assertTrue('VIX=30 (limiar de bloqueio) -> BLOCK_NEW_ENTRIES', evaluateTailRisk({ atrExpansionRatio: null, vix: 30, openExposurePercent: 0 }).action === 'BLOCK_NEW_ENTRIES');
  assertTrue('VIX=40 (limiar de pânico) -> EMERGENCY_CLOSE', evaluateTailRisk({ atrExpansionRatio: null, vix: 40, openExposurePercent: 0 }).action === 'EMERGENCY_CLOSE');
}

// ─── Combinação: sempre vence a leitura MAIS SEVERA entre ATR e VIX ────────
{
  // ATR calmo (NONE), VIX em pânico -> VIX manda, mesmo o ativo específico parecendo tranquilo.
  const r1 = evaluateTailRisk({ atrExpansionRatio: 1.0, vix: 42, openExposurePercent: 20 });
  assertTrue('ATR calmo + VIX em pânico -> vence VIX (EMERGENCY_CLOSE), não o ATR (NONE)', r1.action === 'EMERGENCY_CLOSE');
  assertTrue('vitória do VIX é auditável em triggeredBy', r1.triggeredBy === 'VIX');

  // ATR em choque extremo, VIX calmo (choque muito localizado, ex: notícia de um ativo só) -> ATR manda.
  const r2 = evaluateTailRisk({ atrExpansionRatio: 5.0, vix: 14, openExposurePercent: 20 });
  assertTrue('ATR em choque extremo + VIX calmo -> vence ATR (EMERGENCY_CLOSE), não o VIX (NONE)', r2.action === 'EMERGENCY_CLOSE');
  assertTrue('vitória do ATR é auditável em triggeredBy', r2.triggeredBy === 'ATR');

  // Ambos no mesmo nível de severidade -> triggeredBy=BOTH, sem esconder que os dois concordam.
  const r3 = evaluateTailRisk({ atrExpansionRatio: 2.6, vix: 31, openExposurePercent: 20 });
  assertTrue('ATR e VIX concordam no mesmo nível (BLOCK_NEW_ENTRIES) -> triggeredBy=BOTH', r3.triggeredBy === 'BOTH' && r3.action === 'BLOCK_NEW_ENTRIES');

  // Nunca "dilui" — a leitura mais branda nunca reduz a severidade da mais grave.
  const r4 = evaluateTailRisk({ atrExpansionRatio: 0.5, vix: 41, openExposurePercent: 0 });
  assertTrue('ATR muito calmo NÃO suaviza VIX em pânico — nunca dilui a leitura mais severa', r4.action === 'EMERGENCY_CLOSE');
}

// ─── Volatilidade normal -> NONE, multiplicador=1 ───────────────────────────
{
  const r = evaluateTailRisk({ atrExpansionRatio: 1.0, openExposurePercent: 5 });
  assertTrue('expansão 1.0x (normal) -> action=NONE', r.action === 'NONE');
  assertTrue('expansão normal -> multiplicador=1 (sem redução)', r.newPositionSizeMultiplier === 1);
}

{
  const r = evaluateTailRisk({ atrExpansionRatio: 1.49, openExposurePercent: 5 });
  assertTrue('expansão 1.49x (logo abaixo do limiar de redução) -> ainda NONE', r.action === 'NONE');
}

// ─── Zona de redução de tamanho ──────────────────────────────────────────────
{
  const r = evaluateTailRisk({ atrExpansionRatio: 1.5, openExposurePercent: 5 });
  assertTrue('expansão exatamente no limiar de redução (1.5x) -> action=REDUCE_SIZE', r.action === 'REDUCE_SIZE');
  assertTrue('no limiar de redução -> multiplicador começa em 1 (sem corte ainda)', r.newPositionSizeMultiplier === 1);
}

{
  const rMid = evaluateTailRisk({ atrExpansionRatio: 2.0, openExposurePercent: 5 });
  assertTrue('expansão 2.0x (meio da zona de redução) -> multiplicador entre 0.25 e 1', rMid.newPositionSizeMultiplier > 0.25 && rMid.newPositionSizeMultiplier < 1);

  const rNearBlock = evaluateTailRisk({ atrExpansionRatio: 2.49, openExposurePercent: 5 });
  assertTrue('multiplicador monotonicamente decrescente com mais expansão (2.49x < 2.0x)', rNearBlock.newPositionSizeMultiplier < rMid.newPositionSizeMultiplier);
  assertTrue('multiplicador nunca abaixo do piso 0.25 dentro da zona de redução', rNearBlock.newPositionSizeMultiplier >= 0.25);
}

// ─── Bloqueio de entradas novas (acima do limiar do Bloco B) ────────────────
{
  const r = evaluateTailRisk({ atrExpansionRatio: 2.5, openExposurePercent: 5 });
  assertTrue('expansão exatamente no limiar de bloqueio (2.5x) -> action=BLOCK_NEW_ENTRIES', r.action === 'BLOCK_NEW_ENTRIES');
  assertTrue('bloqueio -> multiplicador=0 (nenhuma posição nova)', r.newPositionSizeMultiplier === 0);
}

{
  const r = evaluateTailRisk({ atrExpansionRatio: 3.9, openExposurePercent: 5 });
  assertTrue('expansão 3.9x (abaixo do limiar de emergência) -> ainda BLOCK_NEW_ENTRIES, não EMERGENCY', r.action === 'BLOCK_NEW_ENTRIES');
}

// ─── Emergência: choque extremo -> fechar posições existentes ──────────────
{
  const r = evaluateTailRisk({ atrExpansionRatio: 4.0, openExposurePercent: 30 });
  assertTrue('expansão exatamente no limiar de emergência (4.0x) -> action=EMERGENCY_CLOSE', r.action === 'EMERGENCY_CLOSE');
  assertTrue('emergência -> multiplicador=0', r.newPositionSizeMultiplier === 0);
  assertTrue('emergência -> reasoning menciona exposição aberta quando > 0', r.reasoning.includes('30.0%'));
}

{
  const r = evaluateTailRisk({ atrExpansionRatio: 10, openExposurePercent: 0 });
  assertTrue('expansão extrema (10x) -> ainda EMERGENCY_CLOSE (nunca "mais que emergência")', r.action === 'EMERGENCY_CLOSE');
  assertTrue('sem posição aberta -> reasoning declara isso, não fabrica número de exposição', r.reasoning.includes('Sem posição aberta'));
}

// ─── Monotonicidade geral: mais expansão nunca resulta em ação menos severa ─
{
  const severityRank: Record<string, number> = { NONE: 0, REDUCE_SIZE: 1, BLOCK_NEW_ENTRIES: 2, EMERGENCY_CLOSE: 3 };
  const ratios = [0.5, 1.0, 1.5, 1.8, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0];
  let prevSeverity = -1;
  let monotonic = true;
  for (const ratio of ratios) {
    const r = evaluateTailRisk({ atrExpansionRatio: ratio, openExposurePercent: 5 });
    const sev = severityRank[r.action];
    if (sev < prevSeverity) monotonic = false;
    prevSeverity = sev;
  }
  assertTrue('severidade da ação nunca diminui com mais expansão de ATR (monotonicidade)', monotonic);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
