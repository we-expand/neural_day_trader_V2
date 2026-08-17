/**
 * Validação determinística da avaliação de DUAS PERNAS
 * (`evaluateStrategyScoreBothSides`) — caminho que o motor ao vivo passou a
 * usar em 2026-08-17, quando os presets deixaram de ser long-only.
 *
 * Por que este arquivo existe: até 2026-08-17 o motor era estruturalmente
 * incapaz de vender (todo preset declarava só `entrySignal: 'BUY'`), o que
 * tornava metade do mercado inacessível. A regressão que mais importa aqui não
 * é aritmética — é alguém remover `shortEntryBlocks` de um preset sem perceber
 * e devolver a IA ao estado long-only silenciosamente. O CASO 6 trava isso.
 *
 * Roda com: npx esbuild src/app/services/strategy/__validate__bothsides__.ts --bundle --platform=node --outfile=/tmp/validate-bothsides.js && node /tmp/validate-bothsides.js
 */
import { evaluateStrategyScoreBothSides } from './StrategyEvaluator';
import { PRESET_STRATEGIES } from '../../data/presetStrategies';
import { Strategy, StrategyBlock } from '../../types/strategy';
import { Candle } from '../indicators/TechnicalIndicators';

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

function makeCandle(close: number, i: number): Candle {
  return { time: i * 60_000, open: close, high: close, low: close, close, volume: 1000 };
}

function makeBlock(overrides: Partial<StrategyBlock>): StrategyBlock {
  return {
    id: 'b1', type: 'ENTRY', category: 'test', indicator: 'PRICE', operator: 'ABOVE', value: 100,
    label: 'bloco de teste', enabled: true,
    ...overrides,
  };
}

function makeStrategy(overrides: Partial<Strategy>): Strategy {
  return {
    id: 'test-strategy', name: 'teste', description: '', isPreset: false,
    entryBlocks: [], exitBlocks: [], filterBlocks: [],
    entrySignal: 'BUY', direction: 'AUTO',
    stopLoss: 5, takeProfit: 10, stopLossMode: 'POINTS', takeProfitMode: 'POINTS',
    trailingStop: false, riskProfile: 'MODERATE', positionSizePercent: 1, timeframe: '1h', maxConcurrentTrades: 3,
    ...overrides,
  };
}

// Preço termina em 110: um bloco ABOVE 100 pontua 100, um BELOW 100 pontua 0.
const candles = [makeCandle(90, 0), makeCandle(90, 1), makeCandle(110, 2)];

// ─── CASO 1: perna LONG vence quando pontua mais ────────────────────────────
{
  const strategy = makeStrategy({
    entryBlocks: [makeBlock({ id: 'l1', operator: 'ABOVE', value: 100 })],   // 100
    shortEntryBlocks: [makeBlock({ id: 's1', operator: 'BELOW', value: 100 })], // 0
  });
  const r = evaluateStrategyScoreBothSides(strategy, candles, 2);
  assertTrue('LONG vence quando pontua mais', r.side === 'LONG');
  assertTrue('LONG vencedor devolve signal BUY', r.signal === 'BUY');
  assertTrue('score do vencedor é o da perna vencedora (100)', r.score === 100);
}

// ─── CASO 2: perna SHORT vence quando pontua mais ───────────────────────────
// Espelho exato do caso 1 — é a prova de que vender é alcançável de verdade.
{
  const strategy = makeStrategy({
    entryBlocks: [makeBlock({ id: 'l1', operator: 'BELOW', value: 100 })],    // 0
    shortEntryBlocks: [makeBlock({ id: 's1', operator: 'ABOVE', value: 100 })], // 100
  });
  const r = evaluateStrategyScoreBothSides(strategy, candles, 2);
  assertTrue('SHORT vence quando pontua mais', r.side === 'SHORT');
  assertTrue('SHORT vencedor devolve signal SELL', r.signal === 'SELL');
  assertTrue('score do vencedor é o da perna vendida (100)', r.score === 100);
}

// ─── CASO 3: empate não é escolha livre — é ausência de direção ─────────────
{
  const strategy = makeStrategy({
    entryBlocks: [makeBlock({ id: 'l1', operator: 'ABOVE', value: 100 })],     // 100
    shortEntryBlocks: [makeBlock({ id: 's1', operator: 'ABOVE', value: 100 })], // 100
  });
  const r = evaluateStrategyScoreBothSides(strategy, candles, 2);
  assertTrue('empate entre pernas -> side null (não sorteia lado)', r.side === null);
  assertTrue('empate -> signal null', r.signal === null);
}

// ─── CASO 4: sem shortEntryBlocks, comporta-se como long-only ──────────────
// Retrocompatibilidade com estratégias customizadas do StrategyBuilderPro.
{
  const strategy = makeStrategy({
    entryBlocks: [makeBlock({ id: 'l1', operator: 'ABOVE', value: 100 })],
  });
  const r = evaluateStrategyScoreBothSides(strategy, candles, 2);
  assertTrue('sem shortEntryBlocks -> só LONG é elegível', r.side === 'LONG');
}

// ─── CASO 5: trava `direction` da estratégia é respeitada nos dois sentidos ──
{
  const longLocked = makeStrategy({
    direction: 'LONG',
    entryBlocks: [makeBlock({ id: 'l1', operator: 'BELOW', value: 100 })],     // 0
    shortEntryBlocks: [makeBlock({ id: 's1', operator: 'ABOVE', value: 100 })], // 100 (melhor, mas travado)
  });
  const rLong = evaluateStrategyScoreBothSides(longLocked, candles, 2);
  assertTrue('direction=LONG nunca devolve SHORT, mesmo com score maior', rLong.side !== 'SHORT');

  const shortLocked = makeStrategy({
    direction: 'SHORT',
    entryBlocks: [makeBlock({ id: 'l1', operator: 'ABOVE', value: 100 })],      // 100 (melhor, mas travado)
    shortEntryBlocks: [makeBlock({ id: 's1', operator: 'BELOW', value: 100 })], // 0
  });
  const rShort = evaluateStrategyScoreBothSides(shortLocked, candles, 2);
  assertTrue('direction=SHORT nunca devolve LONG, mesmo com score maior', rShort.side !== 'LONG');

  // Filtro é gate binário para AMBAS as pernas — não vira "opere um pouco menos".
  const filtered = makeStrategy({
    entryBlocks: [makeBlock({ id: 'l1', operator: 'ABOVE', value: 100 })],
    shortEntryBlocks: [makeBlock({ id: 's1', operator: 'ABOVE', value: 100 })],
    filterBlocks: [makeBlock({ id: 'f1', operator: 'ABOVE', value: 999999, label: 'filtro impossível' })],
  });
  const rFiltered = evaluateStrategyScoreBothSides(filtered, candles, 2);
  assertTrue('filtro reprovado zera as duas pernas (gate binário preservado)', rFiltered.side === null && rFiltered.score === 0);
}

// ─── CASO 6: REGRESSÃO — todo preset do catálogo tem perna vendida ─────────
// Trava direta contra o retorno silencioso ao estado long-only de antes de
// 2026-08-17, que produziu 3 entradas em 11 dias em produção.
{
  for (const preset of PRESET_STRATEGIES) {
    const shorts = preset.shortEntryBlocks ?? [];
    assertTrue(`preset "${preset.name}" (id ${preset.id}) declara perna vendida`, shorts.length > 0);
  }
  assertTrue('catálogo de presets não encolheu (5 estratégias)', PRESET_STRATEGIES.length === 5);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
