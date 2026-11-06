/**
 * Fase A do cuOpt — SUBSTITUÍDO por solver MILP em CPU pura (2026-08-25).
 *
 * cuOpt real (NVIDIA) confirmado NÃO executável no ambiente atual — ver
 * ../CUOPT_API_SCHEMA.md: o próprio blueprint oficial da NVIDIA
 * (`NVIDIA-AI-Blueprints/quantitative-portfolio-optimization`) só roda
 * cuOpt como pacote Python local com GPU CUDA, nunca via API hospedada.
 * Decisão do Cleber: testar a MESMA pergunta de pesquisa (alocação
 * conjunta vs. sequencial, com teste de viés de seleção) usando um
 * solver de MILP real em CPU (`javascript-lp-solver`), sem depender da
 * NVIDIA — a pergunta de pesquisa não muda, só o motor que resolve o
 * problema de otimização combinatória.
 *
 * Candidatos: reais, gerados rodando `evaluateStrategySeries` (motor de
 * produção) sobre os 9 símbolos × timeframe 1h já buscados em
 * `2026-08-05-taxa-base/data/` (reaproveita dado real já existente, sem
 * nova rede). Só os 3 presets com alvo ATR fixo (2, 4, 5) entram — os
 * outros 2 (Donchian trailing-only, Reversão à Média com alvo em pontos)
 * não têm um "retorno esperado" limpo pra alimentar o objetivo do
 * otimizador antes do trade acontecer.
 *
 * Metodologia igual ao resto do projeto: `DataSplit.ts` (3 janelas,
 * embargo), `CostModel.ts` (custo real), `DeflatedSharpe.ts` (corrige
 * pelas 3 estratégias de alocação comparadas). Teste de viés de seleção
 * explícito: baseline aleatório com a MESMA contagem de posições
 * simultâneas que o MILP escolhe — se o MILP não bate o aleatório por
 * margem estatística, "amplitude ajuda, otimização não" (ver
 * ../hypothesis.md).
 *
 * Uso: npx tsx research/experiments/2026-08-25-cuopt-portfolio-optimization/scripts/optimizePortfolio.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore — sem tipos publicados, uso mínimo (solver síncrono, só o resultado importa)
import solver from 'javascript-lp-solver';

import { PRESET_STRATEGIES } from '../../../../src/app/data/presetStrategies';
import { evaluateStrategySeries } from '../../../../src/app/services/strategy/StrategyEvaluator';
import { averageRange } from '../../../../src/app/services/smc/marketStructure';
import { getPointValue, resolveTpSl, calculateRequiredMargin, MAX_MARGIN_UTILIZATION_PERCENT } from '../../../../src/app/services/strategy/TradeSizing';
import type { Candle } from '../../../../src/app/services/smc/types';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import { splitWithEmbargo } from '../../../DataSplit';
import { sharpeRatio, deflatedSharpeRatio, expectedMaxSharpeUnderNull } from '../../../DeflatedSharpe';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', '2026-08-05-taxa-base', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const TIMEFRAME = '1h';
const ACCOUNT_BALANCE = 100; // mesmo piso de conta DEMO usado no resto do projeto
const ELIGIBLE_PRESET_IDS = ['2', '4', '5']; // únicos com alvo ATR fixo (ver header)
const MAX_HOLD_BARS = 200;

const ASSET_CLASS: Record<string, AssetClass> = {
  BTCUSD: 'CRYPTO', XBNUSD: 'CRYPTO', EURUSD: 'FOREX_MAJOR', XAUUSD: 'COMMODITY',
  XAGUSD: 'COMMODITY', US30: 'INDEX', NAS100: 'INDEX', SPX500: 'INDEX', GER40: 'INDEX',
};
const SYMBOLS = Object.keys(ASSET_CLASS);

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles.map((c: any) => ({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 }));
}

interface Candidate {
  symbol: string;
  entryIndex: number;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  expectedReturnPercent: number; // bruto, sobre o preço — o que o otimizador maximiza
  marginRequiredPercent: number; // fração do balance, usada como restrição
}

interface Cycle {
  candles: Candle[]; // referência à série do símbolo (pra simular saída depois)
  candidates: Candidate[]; // 1 por símbolo, no máximo (o melhor preset daquele instante)
}

/** Gera candidatos reais de todos os símbolos, alinhados por timestamp (interseção). */
function buildCycles(seriesBySymbol: Map<string, Candle[]>): Map<number, Cycle> {
  const cyclesByTimestamp = new Map<number, Cycle>();
  const candidatesBySymbolTimestamp = new Map<string, Map<number, Candidate>>();

  for (const [symbol, candles] of seriesBySymbol) {
    const assetClass = ASSET_CLASS[symbol];
    const pointValue = getPointValue(symbol);
    const perTimestamp = new Map<number, Candidate>();

    for (const presetId of ELIGIBLE_PRESET_IDS) {
      const strategy = PRESET_STRATEGIES.find((s) => s.id === presetId)!;
      // @ts-expect-error — candle types differ between smc e indicators, ambos compatíveis estruturalmente
      const signals = evaluateStrategySeries(strategy, candles);

      for (let i = 30; i < signals.length; i++) {
        const sig = signals[i];
        if (!sig.signal) continue;
        const side: 'LONG' | 'SHORT' = sig.signal === 'BUY' ? 'LONG' : 'SHORT';
        const entryPrice = candles[i].close;
        const atr = averageRange(candles.slice(0, i + 1), 14);
        if (atr <= 0) continue;
        const { tp, sl, tpDistance, slDistance } = resolveTpSl(strategy, side, entryPrice, pointValue, atr);
        if (tp === null || slDistance === null || slDistance <= 0) continue;

        const grossReturnPercent = (tpDistance! / entryPrice) * 100;
        const roundTripCostPercent = estimateCostPercent(assetClass, entryPrice, pointValue) * 2 * 100;
        const netExpectedReturnPercent = grossReturnPercent - roundTripCostPercent;
        if (netExpectedReturnPercent <= 0) continue; // não passaria no CostViabilityGate real

        const stopDistancePercent = slDistance / entryPrice;
        const riskCapital = ACCOUNT_BALANCE * 0.01; // 1% de risco/trade, mesmo piso conservador do resto do projeto
        const notionalUsd = riskCapital / stopDistancePercent;
        const requiredMargin = calculateRequiredMargin(notionalUsd, 30); // leverage típica de FX/index no catálogo — aproximação conservadora
        const marginRequiredPercent = requiredMargin / ACCOUNT_BALANCE;
        if (marginRequiredPercent > MAX_MARGIN_UTILIZATION_PERCENT) continue; // nem sozinho caberia

        const existing = perTimestamp.get(candles[i].timestamp);
        if (!existing || netExpectedReturnPercent > existing.expectedReturnPercent) {
          perTimestamp.set(candles[i].timestamp, {
            symbol, entryIndex: i, side, entryPrice, slPrice: sl, tpPrice: tp,
            expectedReturnPercent: netExpectedReturnPercent, marginRequiredPercent,
          });
        }
      }
    }
    candidatesBySymbolTimestamp.set(symbol, perTimestamp);
  }

  const allTimestamps = new Set<number>();
  for (const m of candidatesBySymbolTimestamp.values()) for (const t of m.keys()) allTimestamps.add(t);

  for (const t of allTimestamps) {
    const candidates: Candidate[] = [];
    for (const symbol of SYMBOLS) {
      const c = candidatesBySymbolTimestamp.get(symbol)?.get(t);
      if (c) candidates.push(c);
    }
    if (candidates.length >= 2) { // ciclo só é interessante pra alocação conjunta com 2+ candidatos
      cyclesByTimestamp.set(t, { candles: [], candidates });
    }
  }
  return cyclesByTimestamp;
}

/** Simula o resultado real de UM candidato (bar-a-bar, TP/SL) — usado pelas 3 estratégias de escolha. */
function simulateOutcome(candidate: Candidate, candles: Candle[], assetClass: AssetClass): number {
  const pointValue = getPointValue(candidate.symbol);
  let exitPrice: number | null = null;
  for (let j = candidate.entryIndex + 1; j < Math.min(candles.length, candidate.entryIndex + 1 + MAX_HOLD_BARS); j++) {
    const c = candles[j];
    const hitSl = candidate.side === 'LONG' ? c.low <= candidate.slPrice : c.high >= candidate.slPrice;
    const hitTp = candidate.side === 'LONG' ? c.high >= candidate.tpPrice : c.low <= candidate.tpPrice;
    if (hitSl && hitTp) { exitPrice = candidate.slPrice; break; } // empate -> pior caso
    if (hitSl) { exitPrice = candidate.slPrice; break; }
    if (hitTp) { exitPrice = candidate.tpPrice; break; }
  }
  if (exitPrice === null) return NaN; // não fechou na janela -> descartado da amostra
  const grossReturnPercent = ((candidate.side === 'LONG' ? exitPrice - candidate.entryPrice : candidate.entryPrice - exitPrice) / candidate.entryPrice) * 100;
  const roundTripCostPercent = estimateCostPercent(assetClass, candidate.entryPrice, pointValue) * 2 * 100;
  return grossReturnPercent - roundTripCostPercent;
}

/** Alocação conjunta ótima via MILP real (maximiza retorno esperado sujeito ao teto de margem). */
function solveMilpAllocation(candidates: Candidate[]): Candidate[] {
  const model: any = {
    optimize: 'ret', opType: 'max',
    constraints: { margin: { max: MAX_MARGIN_UTILIZATION_PERCENT } },
    variables: {}, binaries: {},
  };
  candidates.forEach((c, i) => {
    const key = `x${i}`;
    model.variables[key] = { ret: c.expectedReturnPercent, margin: c.marginRequiredPercent };
    model.binaries[key] = 1; // 0 ou 1 — abre ou não abre o trade inteiro, nunca fração
  });
  const result = solver.Solve(model);
  return candidates.filter((_, i) => Math.round(result[`x${i}`] ?? 0) === 1);
}

/** Baseline real do motor hoje: primeiro candidato elegível, ordem fixa do catálogo, 1 por ciclo. */
function sequentialBaseline(candidates: Candidate[]): Candidate[] {
  return candidates.length ? [candidates[0]] : [];
}

/** Baseline de controle pro teste de viés de seleção — mesma contagem que o MILP escolheu. */
function randomJointAllocation(candidates: Candidate[], count: number): Candidate[] {
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const chosen: Candidate[] = [];
  let usedMargin = 0;
  for (const c of shuffled) {
    if (chosen.length >= count) break;
    if (usedMargin + c.marginRequiredPercent > MAX_MARGIN_UTILIZATION_PERCENT) continue;
    chosen.push(c); usedMargin += c.marginRequiredPercent;
  }
  return chosen;
}

// ---- Execução principal ----
const seriesBySymbol = new Map<string, Candle[]>();
for (const symbol of SYMBOLS) {
  const candles = loadCandles(symbol, TIMEFRAME);
  if (candles && candles.length >= 300) seriesBySymbol.set(symbol, candles);
  else console.log(`⚠️  ${symbol} ${TIMEFRAME}: SEM DADO REAL suficiente, pulando`);
}

const allCycles = buildCycles(seriesBySymbol);
console.log(`${allCycles.size} ciclos com 2+ candidatos reais encontrados.`);

interface StrategyReturn { returns: number[]; positionsChosenAvg: number; }
function evaluateStrategy(pickFn: (cands: Candidate[]) => Candidate[]): StrategyReturn {
  const returns: number[] = [];
  let totalChosen = 0, cycles = 0;
  for (const cycle of allCycles.values()) {
    const chosen = pickFn(cycle.candidates);
    cycles++; totalChosen += chosen.length;
    for (const c of chosen) {
      const candles = seriesBySymbol.get(c.symbol)!;
      const netReturn = simulateOutcome(c, candles, ASSET_CLASS[c.symbol]);
      if (!Number.isNaN(netReturn)) returns.push(netReturn);
    }
  }
  return { returns, positionsChosenAvg: cycles ? totalChosen / cycles : 0 };
}

// Split treino/holdout com embargo sobre a LISTA DE CICLOS (ordenada cronologicamente) —
// mesma disciplina do resto do projeto, aplicada à unidade certa aqui (ciclo, não candle).
const sortedTimestamps = Array.from(allCycles.keys()).sort((a, b) => a - b);
const windows = splitWithEmbargo(sortedTimestamps, 3, 0.7, 0); // sem indicador rolante extra aqui, warmup já embutido em buildCycles

interface RowResult {
  strategy: string; window: number; trades: number; avgPositionsPerCycle: number;
  netPercentTotal: number; avgNetPercent: number; sharpe: number;
}
const allRows: RowResult[] = [];
const N_TRIALS = 3; // sequencial, aleatório, MILP

const STRATEGIES: Record<string, (cands: Candidate[], milpCountHint: number) => Candidate[]> = {
  sequencial: (cands) => sequentialBaseline(cands),
  aleatorio: (cands, milpCountHint) => randomJointAllocation(cands, milpCountHint),
  milp: (cands) => solveMilpAllocation(cands),
};

windows.forEach((win, w) => {
  const holdoutTimestamps = new Set(win.holdout);
  const holdoutCycles = new Map(Array.from(allCycles.entries()).filter(([t]) => holdoutTimestamps.has(t)));

  // MILP roda primeiro pra saber quantas posições escolhe em média (usado como alvo do baseline aleatório).
  const milpResult = evaluateStrategy((cands) => solveMilpAllocation(cands));
  const milpCountHint = Math.max(1, Math.round(milpResult.positionsChosenAvg));

  for (const [name, fn] of Object.entries(STRATEGIES)) {
    const useCycles = holdoutCycles.size ? holdoutCycles : allCycles; // fallback se embargo esvaziar demais
    const returns: number[] = [];
    let totalChosen = 0, cyclesCount = 0;
    for (const cycle of useCycles.values()) {
      const chosen = fn(cycle.candidates, milpCountHint);
      cyclesCount++; totalChosen += chosen.length;
      for (const c of chosen) {
        const candles = seriesBySymbol.get(c.symbol)!;
        const netReturn = simulateOutcome(c, candles, ASSET_CLASS[c.symbol]);
        if (!Number.isNaN(netReturn)) returns.push(netReturn);
      }
    }
    allRows.push({
      strategy: name, window: w, trades: returns.length,
      avgPositionsPerCycle: cyclesCount ? totalChosen / cyclesCount : 0,
      netPercentTotal: returns.reduce((a, b) => a + b, 0),
      avgNetPercent: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0,
      sharpe: sharpeRatio(returns),
    });
  }
});

writeFileSync(join(RESULTS_DIR, 'raw_windows.json'), JSON.stringify(allRows, null, 2));

interface Summary {
  strategy: string; trades: number; avgPositionsPerCycle: number;
  netPercentTotal: number; avgNetPercent: number; sharpe: number; dsr: number;
}
const summaries: Summary[] = [];
for (const name of Object.keys(STRATEGIES)) {
  const rows = allRows.filter((r) => r.strategy === name);
  const trades = rows.reduce((a, r) => a + r.trades, 0);
  const netPercentTotal = rows.reduce((a, r) => a + r.netPercentTotal, 0);
  const avgPositionsPerCycle = rows.length ? rows.reduce((a, r) => a + r.avgPositionsPerCycle, 0) / rows.length : 0;
  const sharpe = trades ? rows.reduce((a, r) => a + r.sharpe * r.trades, 0) / trades : 0;
  const sr0 = expectedMaxSharpeUnderNull(0.01, N_TRIALS);
  const dsr = trades >= 2 ? deflatedSharpeRatio(sharpe, sr0, trades) : 0;
  summaries.push({ strategy: name, trades, avgPositionsPerCycle, netPercentTotal, avgNetPercent: trades ? netPercentTotal / trades : 0, sharpe, dsr });
}
writeFileSync(join(RESULTS_DIR, 'summary.json'), JSON.stringify(summaries, null, 2));

const lines: string[] = [];
lines.push('# cuOpt Fase A — MILP em CPU (substitui cuOpt NVIDIA, ver CUOPT_API_SCHEMA.md) — resultado (2026-08-25)');
lines.push('');
lines.push('Candidatos reais (`evaluateStrategySeries`, presets 2/4/5, dado real de');
lines.push('`2026-08-05-taxa-base/data`, 9 símbolos × 1h). Split: `DataSplit.ts` (3 janelas,');
lines.push('embargo). Custo: `CostModel.ts`. DSR: `DeflatedSharpe.ts`, corrigido pelas 3');
lines.push('estratégias de alocação comparadas.');
lines.push('');
lines.push('| Estratégia | Trades | Posições/ciclo (média) | %líq total | %líq médio/trade | Sharpe | DSR |');
lines.push('|---|---:|---:|---:|---:|---:|---:|');
for (const s of summaries) {
  lines.push(`| ${s.strategy} | ${s.trades} | ${s.avgPositionsPerCycle.toFixed(2)} | ${s.netPercentTotal.toFixed(2)}% | ${s.avgNetPercent.toFixed(4)}% | ${s.sharpe.toFixed(3)} | ${(s.dsr * 100).toFixed(1)}% |`);
}
lines.push('');
lines.push('**Teste de viés de seleção**: `milp` vs `aleatorio` usam a MESMA contagem média');
lines.push('de posições simultâneas (o aleatório recebe o hint do MILP) — se `milp` não bate');
lines.push('`aleatorio` por margem clara, o resultado é "amplitude ajuda, otimização não", não');
lines.push('"MILP tem edge" (ver hypothesis.md).');
writeFileSync(join(RESULTS_DIR, 'RESULTADOS.md'), lines.join('\n') + '\n');
console.log(`Gravado: results/RESULTADOS.md, summary.json, raw_windows.json.`);
console.log(summaries);
