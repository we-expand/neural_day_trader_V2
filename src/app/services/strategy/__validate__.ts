/**
 * Validação determinística do motor de backtest (mecânica de execução, não
 * indicadores — isso está em `../indicators/__validate__.ts`). Cobre 3 dos
 * bugs corrigidos em 2026-07-30 (Fase 1 de `research/MASTER_PLAN.md`):
 * look-ahead no trailing stop, viés otimista no empate TP/SL, sizing que
 * ignora a distância do stop.
 *
 * Roda com: npx esbuild src/app/services/strategy/__validate__.ts --bundle --platform=node --outfile=/tmp/validate-strategy.js && node /tmp/validate-strategy.js
 */
import { runBacktest } from './BacktestEngine';
import { calculatePositionSize, getPointValue, calculateTpSl } from './TradeSizing';
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

function makeCandle(close: number, i: number, high?: number, low?: number, open?: number): Candle {
  return { time: i * 60_000, open: open ?? close, high: high ?? close, low: low ?? close, close, volume: 1000 };
}

function makeStrategy(overrides: Partial<Strategy>): Strategy {
  const alwaysTrueEntry: StrategyBlock = {
    id: 'e1', type: 'ENTRY', category: 'test', indicator: 'PRICE', operator: 'ABOVE', value: -999999,
    label: 'sempre verdadeiro (bloco de teste)', enabled: true,
  };
  return {
    id: 'test-strategy', name: 'Estratégia de teste', description: '', isPreset: false,
    entryBlocks: [alwaysTrueEntry], exitBlocks: [], filterBlocks: [],
    entrySignal: 'BUY', direction: 'AUTO',
    stopLoss: 5, takeProfit: 1000, stopLossMode: 'POINTS', takeProfitMode: 'POINTS',
    trailingStop: true, riskProfile: 'MODERATE', positionSizePercent: 1, timeframe: '1h', maxConcurrentTrades: 3,
    ...overrides,
  };
}

// ─── CASO 1: trailing stop não olha pro futuro ─────────────────────────────
// Regressão de bug real (2026-07-30): a versão anterior movia o trailing
// stop usando o CLOSE da barra `i` e testava contra o LOW/HIGH da MESMA
// barra `i` — usando informação (o fechamento de i) que só existe depois que
// a barra i inteira já aconteceu. Corrigido para usar o close de `i-1`.
//
// Cenário: entrada em i=60 (entryPrice=100, SL original=95, TP em 1000 —
// bem distante, pra não interferir neste teste). Barra 61: close=114 (forte
// alta), low=100. Barra 62: low=90.
//   Sob o BUG antigo: ao processar a barra 61, o trailing usaria close(61)=
//   114 pra mover o SL pra 109 (114-5), e testaria isso contra low(61)=100
//   NA MESMA barra — 100<=109 é verdadeiro, fechando o trade JÁ na barra 61
//   (candleIndex=61) usando informação da própria barra pra se auto-invalidar.
//   Sob a CORREÇÃO: ao processar a barra 61, o trailing usa close(60)=100
//   (SL permanece 95) — low(61)=100 não fura 95, sobrevive. Só ao processar
//   a barra 62 o trailing usa close(61)=114 (SL agora 109), testado contra
//   low(62)=90 — fecha em candleIndex=62, exitPrice=109.
{
  const flat = Array.from({ length: 61 }, (_, i) => makeCandle(100, i));
  const bar61 = makeCandle(114, 61, 116, 100, 100);
  const bar62 = makeCandle(105, 62, 110, 90, 105);
  const candles: Candle[] = [...flat, bar61, bar62];
  const res = runBacktest(candles, makeStrategy({}), 'TESTXX', 'long', 10000, 0);

  assertTrue('trailing stop NÃO fecha prematuramente na barra 61 (usaria close da própria barra)', res.trades.every(t => t.candleIndex !== 61));
  assertTrue('trailing stop fecha corretamente na barra 62, usando o close da barra ANTERIOR (109)', res.trades.length === 1 && res.trades[0].candleIndex === 62 && Math.abs(res.trades[0].exitPrice - 109) < 0.01);
}

// ─── CASO 2: empate TP/SL na mesma barra favorece o SL (pior caso) ─────────
// Regressão de bug real (2026-07-30): quando high>=TP E low<=SL na MESMA
// barra, a versão anterior sempre escolhia o TP (viés otimista — não há como
// saber pelo OHLC qual foi tocado primeiro). Corrigido pra priorizar o SL.
{
  const flat = Array.from({ length: 61 }, (_, i) => makeCandle(100, i));
  // entryPrice=100, SL=95, TP=105 (stopLoss=5, takeProfit=5, ambos POINTS) — barra 61 toca os dois.
  const tieBar = makeCandle(100, 61, 106, 94, 100);
  const candles: Candle[] = [...flat, tieBar];
  const res = runBacktest(candles, makeStrategy({ takeProfit: 5, trailingStop: false }), 'TESTXX', 'long', 10000, 0);

  assertTrue('empate TP/SL na mesma barra resolve a favor do SL (pior caso), não do TP', res.trades.length === 1 && Math.abs(res.trades[0].exitPrice - 95) < 0.01 && res.trades[0].result?.exitReason === 'Stop loss acionado');
}

// ─── CASO 3: sizing considera a distância do stop (fixed-fractional real) ──
// Regressão de bug real (2026-07-30): antes, `calculatePositionSize` sempre
// retornava `capital × risco% × multiplicador` como nocional, ignorando a
// distância do stop — dois trades com o mesmo risco% mas stops de tamanhos
// diferentes arriscavam quantias em dinheiro muito diferentes. Corrigido:
// com `stopDistancePercent` informado, o nocional é inversamente
// proporcional à distância do stop (mesmo risco em $ nos dois casos).
{
  const base = { currentBalance: 10_000, allocatedCapital: 10_000, riskPerTradePercent: 1, riskProfile: 'MODERATE' as const };
  const tight = calculatePositionSize({ ...base, stopDistancePercent: 0.01 }); // stop a 1% do preço
  const wide = calculatePositionSize({ ...base, stopDistancePercent: 0.02 }); // stop a 2% do preço (o dobro)

  assertTrue('sizing: stop 2x mais largo produz nocional 2x menor (mesmo risco em $ nos dois casos)', Math.abs(tight / wide - 2) < 0.001);

  const fallback = calculatePositionSize({ ...base }); // sem stopDistancePercent — comportamento antigo preservado
  assertTrue('sizing: fallback sem stopDistancePercent preserva o comportamento antigo (capital × risco% × multiplicador)', fallback !== null && Math.abs(fallback - 100) < 0.001);
}

// ─── CASO 3b: nocional abaixo do mínimo executável PULA o trade, nunca infla risco ──
// Regressão de bug real (2026-08-16): antes, `calculatePositionSize` empurrava
// qualquer nocional abaixo de $10 PRA CIMA (`Math.max(tradeCapital, 10)`) — isso
// inflava silenciosamente o risco efetivo muito além do `riskPerTradePercent`
// configurado em contas pequenas com stop largo (medido: 24% dos sinais numa
// conta de $50 com risco 0,5%/trade acionavam o piso). Corrigido: retorna
// `null` — quem chama deve pular o trade, nunca forçar tamanho maior.
{
  const smallAccount = { currentBalance: 50, allocatedCapital: 50, riskPerTradePercent: 0.5, riskProfile: 'MODERATE' as const };
  const wideStop = calculatePositionSize({ ...smallAccount, stopDistancePercent: 0.03 }); // stop a 3% — nocional teórico = 0.25/0.03 = $8.33, abaixo do piso de $10
  assertTrue('sizing: nocional abaixo do mínimo executável retorna null (pula o trade), não infla pra $10', wideStop === null);

  const narrowStop = calculatePositionSize({ ...smallAccount, stopDistancePercent: 0.005 }); // stop a 0,5% — nocional teórico = 0.25/0.005 = $50, acima do piso
  assertTrue('sizing: nocional acima do mínimo executável passa sem alteração', narrowStop !== null && Math.abs(narrowStop - 50) < 0.001);

  const smallFallback = calculatePositionSize({ currentBalance: 50, allocatedCapital: 50, riskPerTradePercent: 0.1, riskProfile: 'MODERATE' as const }); // sem stopDistancePercent: riskCapital = 50*0.001 = $0.05, abaixo do piso
  assertTrue('sizing: fallback também retorna null quando riskCapital fica abaixo do piso', smallFallback === null);
}

// ─── CASO 4: MFE/MAE medem a excursão real de preço, não o preço de saída ──
// Novo em 2026-07-30 (Fase 2 do MASTER_PLAN.md, pré-requisito pro teste de
// skew do §4.6): MFE/MAE devem refletir o high/low de CADA barra durante o
// trade, não o SL/TP em si. Reusa o cenário do CASO 1 (LONG, entryPrice=100):
// barra 61 (high=116, low=100) e barra 62 (high=110, low=90, fecha em 109).
{
  const flat = Array.from({ length: 61 }, (_, i) => makeCandle(100, i));
  const bar61 = makeCandle(114, 61, 116, 100, 100);
  const bar62 = makeCandle(105, 62, 110, 90, 105);
  const candles: Candle[] = [...flat, bar61, bar62];
  const res = runBacktest(candles, makeStrategy({}), 'TESTXX', 'long', 10000, 0);

  assertTrue('MFE captura o high da barra 61 (16% acima da entrada), não o high da barra de saída', res.trades.length === 1 && Math.abs(res.trades[0].mfePercent - 16) < 0.01);
  assertTrue('MAE captura o low da barra 62 (10% abaixo da entrada), independente do SL ter sido tocado antes nesse nível', res.trades.length === 1 && Math.abs(res.trades[0].maePercent - 10) < 0.01);
}

// ─── CASO 5: escala de pointValue por símbolo ────────────────────────────
// Novo em 2026-08-05. Este bug já voltou DUAS vezes: em 2026-07-24 pra
// BTCUSD/BTCUSDT (par cripto contém "USD" e batia na regra de forex, pip
// 0.0001, com preço em dólares cheios), e de novo agora pra a família de
// contratos "X**" da Infinox — XBNUSD (Binance Coin), XETUSD (Ethereum),
// XLCUSD (Litecoin) —, que a lista de prefixos de base não reconhecia. Com
// pointValue 10.000x menor que o correto, um alvo de 400 pontos em um ativo
// de US$64.000 vira US$0,04 de distância: o trade fecha no candle de entrada.
// Sem asserção, volta uma terceira vez.
{
  assertTrue('pointValue de BTCUSD = 1.0 (cripto, dólares cheios)', getPointValue('BTCUSD') === 1.0);
  assertTrue('pointValue de BTCUSDT = 1.0 (notação nativa de exchange, fora do catálogo)', getPointValue('BTCUSDT') === 1.0);
  assertTrue('pointValue de XBNUSD = 1.0 (Binance Coin, contrato da Infinox — regressão 2026-08-05)', getPointValue('XBNUSD') === 1.0);
  assertTrue('pointValue de XETUSD = 1.0 (Ethereum, contrato da Infinox)', getPointValue('XETUSD') === 1.0);
  assertTrue('pointValue de XLCUSD = 1.0 (Litecoin, contrato da Infinox)', getPointValue('XLCUSD') === 1.0);
  assertTrue('pointValue de EURUSD = 0.0001 (forex de verdade continua com pip)', getPointValue('EURUSD') === 0.0001);
  assertTrue('pointValue de XAUUSD = 0.1 (ouro)', getPointValue('XAUUSD') === 0.1);

  // O TP não pode ficar a centavos do preço de entrada num ativo de milhares
  // de dólares — é a forma como o bug aparece na prática.
  const tpSl = calculateTpSl('XBNUSD', 'LONG', 64000, 'MÉDIO', 'TREND');
  assertTrue('TP de XBNUSD a 400 pontos fica a US$400 da entrada, não a US$0,04', Math.abs(tpSl.tpDistance - 400) < 1e-9);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
