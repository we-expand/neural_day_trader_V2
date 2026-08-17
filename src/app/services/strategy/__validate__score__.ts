/**
 * Validação determinística do score contínuo por bloco (item 1 do redesenho
 * do cérebro, 2026-08-16 — ver NEXT_SESSION.md e
 * SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md). `scoreBlock`/
 * `evaluateStrategyScoreAt` ainda não estão ligados em nenhum caminho de
 * execução — este arquivo cobre só a mecânica do score em si, com séries
 * sintéticas de resultado conhecido de antemão.
 *
 * Roda com: npx esbuild src/app/services/strategy/__validate__score__.ts --bundle --platform=node --outfile=/tmp/validate-score.js && node /tmp/validate-score.js
 */
import { IndicatorCache, scoreBlock, evaluateStrategyScoreAt } from './StrategyEvaluator';
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

// ─── CASO 1: ABOVE/BELOW/BETWEEN/RISING/FALLING são booleanos por natureza (100/0) ──
// scoreBlock exige i>=2 (mesmo guard de evaluateBlock, precisa de histórico mínimo).
{
  const candles = [makeCandle(90, 0), makeCandle(90, 1), makeCandle(110, 2)];
  const cache = new IndicatorCache(candles);

  assertTrue('ABOVE: score 100 quando curr > value', scoreBlock(makeBlock({ operator: 'ABOVE', value: 100 }), cache, 2) === 100);
  assertTrue('ABOVE: score 0 quando curr <= value', scoreBlock(makeBlock({ operator: 'ABOVE', value: 100 }), cache, 1) === 0);
  assertTrue('BETWEEN: score 100 dentro da faixa', scoreBlock(makeBlock({ operator: 'BETWEEN', value: 100, value2: 120 }), cache, 2) === 100);
  assertTrue('BETWEEN: score 0 fora da faixa', scoreBlock(makeBlock({ operator: 'BETWEEN', value: 100, value2: 120 }), cache, 1) === 0);
  assertTrue('RISING: score 100 quando curr > prev', scoreBlock(makeBlock({ operator: 'RISING' }), cache, 2) === 100);
  assertTrue('FALLING: score 0 quando curr > prev (não está caindo)', scoreBlock(makeBlock({ operator: 'FALLING' }), cache, 2) === 0);

  const belowCandles = [makeCandle(110, 0), makeCandle(110, 1), makeCandle(90, 2)];
  const belowCache = new IndicatorCache(belowCandles);
  assertTrue('BELOW: score 100 quando curr < value', scoreBlock(makeBlock({ operator: 'BELOW', value: 100 }), belowCache, 2) === 100);
}

// ─── CASO 2: bloco desabilitado não pesa contra (mesmo comportamento de evaluateBlock) ──
{
  const candles = [makeCandle(90, 0), makeCandle(90, 1), makeCandle(90, 2)];
  const cache = new IndicatorCache(candles);
  assertTrue('bloco desabilitado sempre pontua 100', scoreBlock(makeBlock({ operator: 'ABOVE', value: 999, enabled: false }), cache, 2) === 100);
}

// ─── CASO 3: CROSS_ABOVE ganha gradação por recência, decai 10pt/candle, janela de 10 candles ──
// Preço fica em 90 (abaixo de 100) do candle 0 ao 9, cruza pra 105 no candle 10 e permanece lá.
// Cruzamento exato: só no candle 10 (crossedAbove olha prevA<=prevB && currA>currB).
{
  const flat = Array.from({ length: 10 }, (_, i) => makeCandle(90, i));
  const afterCross = Array.from({ length: 20 }, (_, k) => makeCandle(105, 10 + k));
  const candles = [...flat, ...afterCross];
  const cache = new IndicatorCache(candles);
  const block = makeBlock({ operator: 'CROSS_ABOVE', value: 100 });

  assertTrue('CROSS_ABOVE: score 100 no candle exato do cruzamento (i=10)', scoreBlock(block, cache, 10) === 100);
  assertTrue('CROSS_ABOVE: score 70 três candles depois do cruzamento (i=13)', scoreBlock(block, cache, 13) === 70);
  assertTrue('CROSS_ABOVE: score 0 fora da janela de 10 candles (i=25)', scoreBlock(block, cache, 25) === 0);
  assertTrue('CROSS_ABOVE: score 0 antes do cruzamento nunca ter acontecido (i=5)', scoreBlock(block, cache, 5) === 0);
}

// ─── CASO 4: agregação — média simples dos scores dos entryBlocks (pesos iguais, decisão 2026-08-16) ──
{
  const candles = [makeCandle(90, 0), makeCandle(90, 1), makeCandle(110, 2)];
  const strategy: Strategy = {
    id: 'test-strategy', name: 'teste', description: '', isPreset: false,
    entryBlocks: [
      makeBlock({ id: 'e1', operator: 'ABOVE', value: 100 }), // score 100 no candle 2
      makeBlock({ id: 'e2', operator: 'BELOW', value: 100 }), // score 0 no candle 2
    ],
    exitBlocks: [], filterBlocks: [],
    entrySignal: 'BUY', direction: 'AUTO',
    stopLoss: 5, takeProfit: 10, stopLossMode: 'POINTS', takeProfitMode: 'POINTS',
    trailingStop: false, riskProfile: 'MODERATE', positionSizePercent: 1, timeframe: '1h', maxConcurrentTrades: 3,
  };
  const result = evaluateStrategyScoreAt(strategy, candles, 2);
  assertTrue('agregação: média simples de 100 e 0 dá 50', result.score === 50);
  assertTrue('agregação: signal declarado explicitamente é respeitado', result.signal === 'BUY');
  assertTrue('agregação: blockScores reporta os 2 blocos', result.blockScores.length === 2);
}

// ─── CASO 5: filterBlocks continuam gate binário rígido — score cai pra 0 se o filtro falha ──
{
  const candles = [makeCandle(90, 0), makeCandle(90, 1), makeCandle(110, 2)];
  const strategy: Strategy = {
    id: 'test-strategy', name: 'teste', description: '', isPreset: false,
    entryBlocks: [makeBlock({ id: 'e1', operator: 'ABOVE', value: 100 })],
    exitBlocks: [],
    filterBlocks: [makeBlock({ id: 'f1', operator: 'ABOVE', value: 999999, label: 'filtro impossível' })],
    entrySignal: 'BUY', direction: 'AUTO',
    stopLoss: 5, takeProfit: 10, stopLossMode: 'POINTS', takeProfitMode: 'POINTS',
    trailingStop: false, riskProfile: 'MODERATE', positionSizePercent: 1, timeframe: '1h', maxConcurrentTrades: 3,
  };
  const result = evaluateStrategyScoreAt(strategy, candles, 2);
  assertTrue('filtro reprovado: score 0 e signal null (gate binário preservado)', result.score === 0 && result.signal === null);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
