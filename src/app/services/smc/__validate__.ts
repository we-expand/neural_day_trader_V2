// Validação determinística do motor SMC contra séries de candle sintéticas com
// resultado conhecido de antemão. Rodar manualmente ANTES de qualquer wiring
// com dado real:
//   npx esbuild src/app/services/smc/__validate__.ts --bundle --platform=node --outfile=/tmp/validate-smc.js && node /tmp/validate-smc.js

import type { Candle } from './types';
import { detectSwingPoints, detectStructureEvents } from './marketStructure';
import { detectOrderBlocks } from './orderBlocks';
import { detectFairValueGaps } from './fairValueGaps';
import { detectLiquidityPools } from './liquidityPools';

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

function c(t: number, o: number, h: number, l: number, cl: number, v = 1000): Candle {
  return { timestamp: t, open: o, high: h, low: l, close: cl, volume: v };
}

// ─────────────────────────────────────────────────────────────────────────
// Teste 1+2: Order Block bullish, com e sem mitigação
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[1] Order Block bullish + mitigação');
{
  // t2 forma um swing high (103). t4 é a última vela baixista antes do
  // rompimento (base do OB, high=100/low=95). t5 rompe 103 com folga
  // (movimento forte) -> CHoCH bullish. t9 volta pra dentro de [95,100] -> mitigação.
  const candles: Candle[] = [
    c(1, 99.5, 100, 98, 99),
    c(2, 99, 103, 99, 102), // swing high (103)
    c(3, 100.5, 101, 97, 98),
    c(4, 99, 100, 95, 96), // vela baixista = base do OB (high=100, low=95)
    c(5, 97, 112, 95.5, 110), // perna impulsiva forte, rompe 103
    c(6, 110, 115, 109, 113),
    c(7, 113, 118, 112, 116),
    c(8, 116, 120, 114, 115),
    c(9, 97, 99, 94, 96) // fecha dentro de [95,100] -> mitigação
  ];

  const swings = detectSwingPoints(candles, 1);
  const events = detectStructureEvents(candles, swings);
  const obs = detectOrderBlocks(candles, events);

  const bullishObs = obs.filter((o) => o.type === 'order_block_bullish');
  assert(bullishObs.length >= 1, 'detecta ao menos 1 Order Block bullish');
  if (bullishObs.length >= 1) {
    const ob = bullishObs[0];
    assert(ob.priceHigh === 100 && ob.priceLow === 95, 'OB usa o high/low exato da vela base (100/95)');
    assert(ob.mitigated === true, 'OB fica mitigado quando o preço retorna à zona');
    assert(ob.mitigatedAt === 9, 'mitigatedAt aponta pro candle correto (timestamp 9)');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Teste 3: Fair Value Gap bullish
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[2] Fair Value Gap bullish');
{
  const candles: Candle[] = [
    c(1, 100, 101, 99, 100.5), // high = 101
    c(2, 105, 108, 104, 107), // vela de impulso
    c(3, 109, 111, 106, 110) // low = 106, e 101 < 106 -> gap bullish [101, 106]
  ];

  const fvgs = detectFairValueGaps(candles);
  const bullish = fvgs.filter((f) => f.type === 'fvg_bullish');
  assert(bullish.length === 1, 'detecta exatamente 1 FVG bullish');
  if (bullish.length === 1) {
    assert(bullish[0].priceLow === 101 && bullish[0].priceHigh === 106, 'FVG com range exato [101, 106]');
    assert(bullish[0].mitigated === false, 'FVG sem candle subsequente fica não-mitigado');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Teste 4: Fair Value Gap com preenchimento
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[3] Fair Value Gap — preenchimento (mitigação)');
{
  const candles: Candle[] = [
    c(1, 100, 101, 99, 100.5),
    c(2, 105, 108, 104, 107),
    c(3, 109, 111, 106, 110), // FVG [101, 106] criado aqui
    c(4, 110, 111, 103, 104) // low=103 sobrepõe o gap [101,106] -> preenchido
  ];

  const fvgs = detectFairValueGaps(candles);
  const bullish = fvgs.filter((f) => f.type === 'fvg_bullish');
  assert(bullish.length === 1 && bullish[0].mitigated === true, 'FVG marcado como preenchido quando o preço retorna');
  assert(bullish.length === 1 && bullish[0].mitigatedAt === 4, 'mitigatedAt aponta pro candle certo (timestamp 4)');
}

// ─────────────────────────────────────────────────────────────────────────
// Teste 5: Liquidity Pool — dois topos iguais + um outlier
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[4] Liquidity Pool (topos iguais, ignora outlier)');
{
  const candles: Candle[] = [
    c(1, 99, 100, 98, 99.5),
    c(2, 99, 110, 99, 105), // swing high candidato 1 (110)
    c(3, 105, 103, 97, 100),
    c(4, 100, 110.05, 101, 106), // swing high candidato 2 (~110, dentro da tolerância)
    c(5, 106, 104, 95, 100),
    c(6, 100, 130, 103, 120), // outlier bem distante (130)
    c(7, 120, 118, 108, 112),
    c(8, 112, 109, 105, 107) // depois do cluster
  ];

  const swings = detectSwingPoints(candles, 1);
  const pools = detectLiquidityPools(candles, swings, 0.001);
  const sellside = pools.filter((p) => p.type === 'liquidity_pool_sellside');

  assert(sellside.length >= 1, 'detecta ao menos 1 pool sellside (topos iguais)');
  const twoTouchPool = sellside.find((p) => p.touches === 2);
  assert(!!twoTouchPool, 'o pool de 2 toques existe (outlier de 130 não entrou no cluster)');
}

// ─────────────────────────────────────────────────────────────────────────
// Teste 6: CHoCH bearish após tendência de alta
// ─────────────────────────────────────────────────────────────────────────
console.log('\n[5] Estrutura de mercado — CHoCH bearish');
{
  // Swing low único e bem definido em t2 (99). Sequência sobe (com swing highs
  // em t3/t5/t7) sem nunca voltar perto de 99, até t9 romper com folga o fundo
  // original -> CHoCH bearish.
  const candles: Candle[] = [
    c(1, 99.5, 102, 100, 101),
    c(2, 99, 101, 99, 100), // swing low (99)
    c(3, 101, 106, 100.5, 105), // swing high (106)
    c(4, 103.5, 105, 103, 104),
    c(5, 104.5, 110, 104, 108), // swing high (110)
    c(6, 107.5, 109, 107, 108),
    c(7, 108.5, 113, 108, 112), // swing high (113)
    c(8, 110, 112, 90, 91) // fecha bem abaixo de 99 -> CHoCH bearish
  ];

  const swings = detectSwingPoints(candles, 1);
  const events = detectStructureEvents(candles, swings);
  const bearishChoch = events.find((e) => e.kind === 'CHoCH' && e.direction === 'bearish');

  assert(!!bearishChoch, 'detecta 1 CHoCH bearish quando o preço rompe a estrutura de fundos ascendentes');
}

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) {
  process.exit(1);
}
