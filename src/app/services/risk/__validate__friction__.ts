/**
 * Validação determinística dos controles de fricção (2026-08-25).
 *
 * O que estas asserções protegem: as três funções aqui só REDUZEM exposição.
 * Uma regressão que as fizesse aumentar notional, liberar um símbolo em
 * cooldown, ou afrouxar o gate de custo passaria despercebida em produção por
 * dias (o efeito é estatístico, não um crash) — exatamente a classe de bug que
 * este gate existe pra pegar antes do commit.
 *
 * Roda dentro de `npm run validate`.
 */
import {
  clampToLeverageCap,
  isSymbolInCooldown,
  buildLastCloseBySymbol,
  MAX_NOTIONAL_LEVERAGE,
  SYMBOL_COOLDOWN_MS,
  BREAKEVEN_TRIGGER_R,
} from './TradeFrictionControls';
import {
  evaluateCostViability,
  expectedRealizedMovementPercent,
  TARGET_REALIZATION_FACTOR,
} from './CostViabilityGate';

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

// ── Teto de alavancagem ────────────────────────────────────────────────────

{
  // O caso real que motivou o gate: XAUUSD com notional US$2.791 numa conta de
  // US$100 (28,1x) — deve ser cortado pro teto.
  const r = clampToLeverageCap(2791, 100, 3);
  assertTrue('ouro a 28x numa conta de $100 é cortado pro teto de 3x ($300)', r.clamped && r.notionalUsd === 300);
  assertTrue('alavancagem original é reportada pra log/telemetria', Math.abs(r.leverageBefore - 27.91) < 0.01);
}

{
  // Cripto na faixa medida (1,4-1,6x) passa intocada — o gate não pode punir
  // quem já está dentro do teto.
  const r = clampToLeverageCap(141, 100, 3);
  assertTrue('notional dentro do teto passa sem alteração', !r.clamped && r.notionalUsd === 141);
}

{
  const r = clampToLeverageCap(300, 100, 3);
  assertTrue('notional exatamente no teto não é cortado (limite inclusivo)', !r.clamped && r.notionalUsd === 300);
}

{
  // Nunca aumenta: é a invariante compartilhada com todos os outros gates de
  // sizing (teto de lotes 2026-08-17, margem 2026-08-19, lote mínimo 2026-08-20).
  for (const [notional, balance] of [[50, 100], [1, 100], [299.99, 100], [10000, 100]]) {
    const r = clampToLeverageCap(notional, balance, 3);
    assertTrue(`nunca aumenta notional (entrada $${notional}, saldo $${balance})`, r.notionalUsd <= notional);
  }
}

{
  // Saldo desconhecido/zerado não pode virar corte fabricado nem divisão por
  // zero — devolve intacto e deixa o defeito visível pra camada de cima.
  const r = clampToLeverageCap(500, 0, 3);
  assertTrue('saldo zero devolve notional intacto, sem corte inventado', !r.clamped && r.notionalUsd === 500);
  const neg = clampToLeverageCap(500, -10, 3);
  assertTrue('saldo negativo devolve notional intacto', !neg.clamped && neg.notionalUsd === 500);
}

assertTrue('teto padrão é 3x (calibração 2026-08-25)', MAX_NOTIONAL_LEVERAGE === 3);

// ── Cooldown por símbolo ───────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

{
  // O caso literal medido: ETHUSD fechou 02:49 e reabriu 02:49.
  const map = { ETHUSD: NOW - 30_000 };
  const r = isSymbolInCooldown('ETHUSD', map, NOW);
  assertTrue('reentrada 30s após fechamento é bloqueada', r.blocked);
  assertTrue('reporta tempo restante > 0', r.remainingMs > 0);
  assertTrue('reason menciona o símbolo', r.reason.includes('ETHUSD'));
}

{
  const map = { SOLUSD: NOW - (SYMBOL_COOLDOWN_MS + 1) };
  assertTrue('após o cooldown expirar, símbolo é liberado', !isSymbolInCooldown('SOLUSD', map, NOW).blocked);
}

{
  const map = { SOLUSD: NOW - SYMBOL_COOLDOWN_MS };
  assertTrue('exatamente no fim do cooldown já libera', !isSymbolInCooldown('SOLUSD', map, NOW).blocked);
}

{
  assertTrue('símbolo sem fechamento anterior nunca está em cooldown', !isSymbolInCooldown('BTCUSD', {}, NOW).blocked);
}

{
  // Relógio dessincronizado entre browser e servidor não pode congelar um
  // símbolo pra sempre.
  const map = { XAUUSD: NOW + 60_000 };
  assertTrue('timestamp no futuro não vira cooldown eterno', !isSymbolInCooldown('XAUUSD', map, NOW).blocked);
}

{
  // O gate antigo (ASSET_ANTI_REPEAT) deixava passar SOL → ETH → SOL. Este não.
  const map = new Map<string, number>([['SOLUSD', NOW - 60_000], ['ETHUSD', NOW - 60_000]]);
  assertTrue('alternar entre dois símbolos NÃO escapa do cooldown (falha do ANTI_REPEAT)',
    isSymbolInCooldown('SOLUSD', map, NOW).blocked && isSymbolInCooldown('ETHUSD', map, NOW).blocked);
}

{
  // Aceita Map e Record — os dois drivers passam estruturas diferentes.
  const asMap = new Map<string, number>([['ETHUSD', NOW - 60_000]]);
  const asRecord = { ETHUSD: NOW - 60_000 };
  assertTrue('Map e Record produzem o mesmo veredito',
    isSymbolInCooldown('ETHUSD', asMap, NOW).blocked === isSymbolInCooldown('ETHUSD', asRecord, NOW).blocked);
}

// ── Mapa de último fechamento ──────────────────────────────────────────────

{
  const history = [
    { symbol: 'ETHUSD', closedAt: NOW - 300_000 },
    { symbol: 'ETHUSD', closedAt: NOW - 60_000 },   // mais recente
    { symbol: 'SOLUSD', closedAt: NOW - 900_000 },
    { symbol: 'BTCUSD' },                            // ainda aberto, sem closedAt
  ];
  const map = buildLastCloseBySymbol(history);
  assertTrue('mantém o fechamento MAIS RECENTE por símbolo', map.get('ETHUSD') === NOW - 60_000);
  assertTrue('símbolo com um só fechamento é preservado', map.get('SOLUSD') === NOW - 900_000);
  assertTrue('trade sem closedAt (ainda aberto) é ignorado', !map.has('BTCUSD'));
}

{
  // Ordem do histórico não pode mudar o resultado — o runner carrega por
  // exit_time, o cliente acumula em ordem de fechamento.
  const asc = buildLastCloseBySymbol([
    { symbol: 'ETHUSD', closedAt: NOW - 300_000 },
    { symbol: 'ETHUSD', closedAt: NOW - 60_000 },
  ]);
  const desc = buildLastCloseBySymbol([
    { symbol: 'ETHUSD', closedAt: NOW - 60_000 },
    { symbol: 'ETHUSD', closedAt: NOW - 300_000 },
  ]);
  assertTrue('resultado independe da ordem do histórico', asc.get('ETHUSD') === desc.get('ETHUSD'));
}

// ── Fator de realização no gate de custo ───────────────────────────────────

{
  assertTrue('fator de realização é o valor medido (0,40, n=220)', TARGET_REALIZATION_FACTOR === 0.40);
  assertTrue('movimento capturável = 40% do alvo', Math.abs(expectedRealizedMovementPercent(1.0) - 0.40) < 1e-9);
}

{
  // O aperto tem que ser real: um caso que passava medindo contra o alvo cheio
  // deve reprovar medindo contra o capturado. Custo 0,06% / alvo 1,0% = 6,0%
  // (VIAVEL, ≤7%); contra 0,40% capturado = 15,0% (INVIAVEL, >12%).
  const contraAlvo = evaluateCostViability(0.06, 1.0);
  const contraCapturado = evaluateCostViability(0.06, expectedRealizedMovementPercent(1.0));
  assertTrue('setup marginal era aprovado medindo contra o alvo cheio', contraAlvo.approved);
  assertTrue('mesmo setup é REPROVADO medindo contra o movimento capturado', !contraCapturado.approved);
  assertTrue('a razão custo/movimento fica exatamente 2,5x maior',
    Math.abs(contraCapturado.costAsPercentOfMovement / contraAlvo.costAsPercentOfMovement - 2.5) < 1e-9);
}

{
  // Cripto folgado continua passando — o aperto não pode fechar o motor inteiro.
  // Custo 0,0291% (CRYPTO round-trip real) contra alvo de 3% → 0,97% do
  // capturado, bem dentro de VIAVEL.
  const r = evaluateCostViability(0.0291, expectedRealizedMovementPercent(3.0));
  assertTrue('cripto com alvo largo segue VIAVEL após o aperto', r.approved && r.classification === 'VIAVEL');
}

// ── Breakeven ──────────────────────────────────────────────────────────────

{
  assertTrue('gatilho de breakeven é 1,5R', BREAKEVEN_TRIGGER_R === 1.5);
  assertTrue('gatilho é mais frouxo que o antigo +1R (menos saídas em zero)', BREAKEVEN_TRIGGER_R > 1);

  // Replica a aritmética dos dois motores (positionManager.ts e useApexLogic.ts)
  // pra travar o comportamento: LONG entrando em 100 com stop em 98 (risco 2).
  const entry = 100;
  const originalRisk = 2;
  const triggersAt = (price: number) => (price - entry) >= originalRisk * BREAKEVEN_TRIGGER_R;
  assertTrue('não trava breakeven em +1R (preço 102) — era aqui que travava antes', !triggersAt(102));
  assertTrue('trava breakeven em +1,5R (preço 103)', triggersAt(103));
  assertTrue('trava breakeven acima de +1,5R (preço 105)', triggersAt(105));
}

console.log(`\n${passed} asserções passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
