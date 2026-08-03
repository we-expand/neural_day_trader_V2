/**
 * Re-medição da "confirmação executável" da seção 14.3 do AI_BRAIN_SPEC.md com o
 * custo de cripto CFD corrigido (2026-08-02).
 *
 * POR QUE ISTO EXISTE
 * O teste executável de 2026-07-30 (rompimento Donchian 20/10 em BTCUSDT,
 * contrato 0,01 BTC) rodou com `CostModel.ts` cobrando 0,26% de round-trip —
 * medido depois como ~18x o custo real de cripto CFD (0,0291%, ver
 * `research/CostModel.ts` e `2026-08-02-viability-gates/verdict.md` seção 1).
 * Os prejuízos registrados (15m pooled -US$1.447,73; 1h pooled -US$73,55) são,
 * em magnitude, da mesma ordem do excesso de custo cobrado — ou seja, o SINAL do
 * resultado é indeterminado sem re-medir.
 *
 * COMO ISTO MEDE, EM VEZ DE ESTIMAR
 * Não há re-execução nem chamada de rede. O `output.json` daquele experimento
 * guardou cada trade individual com `entryPrice` e `grossProfitPercent` — o
 * retorno BRUTO, antes de qualquer custo. Basta reaplicar o custo novo sobre o
 * mesmo conjunto de trades:
 *
 *     netProfitPercent = grossProfitPercent − custoRoundTripPercent
 *     profitUsd        = netProfitPercent/100 × entryPrice × 0,01 BTC
 *
 * Os trades, entradas e saídas são EXATAMENTE os mesmos — a regra de entrada não
 * depende do custo, então o conjunto de trades não muda. Muda só o desconto.
 *
 * TRAVA DE FIDELIDADE
 * Antes de reportar o número novo, o script reproduz o resultado ANTIGO a partir
 * do bruto com o custo antigo e compara contra o que está gravado no
 * `output.json`. Se não bater, a reconstrução está errada e o script aborta —
 * nunca reporta o número novo sem provar que o método reproduz o velho.
 *
 * Rodar:
 *   npx esbuild research/experiments/2026-08-02-cost-correction-remeasure/remeasure.ts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/remeasure.mjs && node /tmp/remeasure.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';
import { CRYPTO_CFD_ROUND_TRIP_COST_PERCENT } from '../../CostModel';

/**
 * Raiz do repo, achada subindo do cwd até o `package.json`. Não dá pra usar
 * `import.meta.url`: o esbuild empacota este arquivo pra /tmp, então ele
 * apontaria pro bundle. E depender do cwd ser a raiz é armadilha silenciosa —
 * aqui, se não achar, o script para com mensagem clara em vez de ENOENT cru.
 */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`raiz do repo não encontrada a partir de ${process.cwd()} — rode de dentro do projeto`);
}

const ROOT = findRepoRoot();
const HERE = join(ROOT, 'research', 'experiments', '2026-08-02-cost-correction-remeasure');
const SOURCE = join(ROOT, 'research', 'experiments', '2026-07-30-breakout-donchian-executable', 'output.json');

/** Custo que o experimento original aplicou (COST_TABLE.CRYPTO antes da correção). */
const LEGACY_ROUND_TRIP_PERCENT = 0.26;

interface RawTrade {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  grossProfitPercent: number;
  netProfitPercent: number;
  profitUsd: number;
}

interface Stats {
  n: number;
  winRate: number;
  totalUsd: number;
  maxDrawdownUsd: number;
  sharpe: number;
  dsr: number;
}

function reprice(trades: RawTrade[], roundTripPercent: number, contractBtc: number) {
  return trades.map(t => {
    const netProfitPercent = t.grossProfitPercent - roundTripPercent;
    return { ...t, netProfitPercent, profitUsd: (netProfitPercent / 100) * t.entryPrice * contractBtc };
  });
}

function maxDrawdownUsd(trades: { profitUsd: number }[]): number {
  let cum = 0, peak = 0, maxDd = 0;
  for (const t of trades) {
    cum += t.profitUsd;
    peak = Math.max(peak, cum);
    maxDd = Math.min(maxDd, cum - peak);
  }
  return maxDd;
}

/** Mesmas fórmulas do backtest original (`summarize`), para os números serem comparáveis. */
function summarize(trades: { profitUsd: number; netProfitPercent: number }[]): Stats {
  if (!trades.length) return { n: 0, winRate: 0, totalUsd: 0, maxDrawdownUsd: 0, sharpe: 0, dsr: 0 };
  const wins = trades.filter(t => t.profitUsd > 0);
  const returns = trades.map(t => t.netProfitPercent);
  const sh = sharpeRatio(returns);
  return {
    n: trades.length,
    winRate: wins.length / trades.length,
    totalUsd: trades.reduce((a, t) => a + t.profitUsd, 0),
    maxDrawdownUsd: maxDrawdownUsd(trades),
    sharpe: sh,
    dsr: deflatedSharpeRatio(sh, expectedMaxSharpeUnderNull(0, 1), returns.length),
  };
}

function usd(v: number): string { return `${v >= 0 ? '+' : ''}US$${v.toFixed(2)}`; }

const source = JSON.parse(readFileSync(SOURCE, 'utf8'));
const contractBtc: number = source.contractSizeBtc;
const newCost = CRYPTO_CFD_ROUND_TRIP_COST_PERCENT;

console.log('\n═══ Re-medição da seção 14.3 com o custo corrigido ═══\n');
console.log(`fonte            : ${SOURCE.replace(/.*research\//, 'research/')}`);
console.log(`gerado em        : ${source.generatedAt}`);
console.log(`contrato         : ${contractBtc} BTC`);
console.log(`custo antigo     : ${LEGACY_ROUND_TRIP_PERCENT.toFixed(4)}% round-trip (CostModel.ts pré-correção)`);
console.log(`custo corrigido  : ${newCost.toFixed(4)}% round-trip (spread Pepperstone medido + provisão de slippage)`);
console.log(`razão            : ${(LEGACY_ROUND_TRIP_PERCENT / newCost).toFixed(2)}x\n`);

const report: Record<string, unknown>[] = [];
let fidelityFailures = 0;

for (const block of source.perInterval as { interval: string; nHoldout: number; results: Record<string, Stats>; trades: RawTrade[] }[]) {
  const trades = block.trades;

  // ── Trava de fidelidade: reproduzir o resultado GRAVADO a partir do bruto ──
  const rebuiltLegacy = reprice(trades, LEGACY_ROUND_TRIP_PERCENT, contractBtc);
  const legacyPooled = summarize(rebuiltLegacy);
  const storedPooled = block.results.POOLED;
  const deltaUsd = Math.abs(legacyPooled.totalUsd - storedPooled.totalUsd);
  const deltaSharpe = Math.abs(legacyPooled.sharpe - storedPooled.sharpe);
  const faithful = deltaUsd < 0.01 && deltaSharpe < 1e-6;
  if (!faithful) fidelityFailures++;

  console.log(`── ${block.interval} ${'─'.repeat(64)}`);
  console.log(
    `  trava de fidelidade: reconstruído ${usd(legacyPooled.totalUsd)} vs. gravado ${usd(storedPooled.totalUsd)} ` +
    `(Δ US$${deltaUsd.toFixed(4)}, ΔSharpe ${deltaSharpe.toExponential(1)}) ${faithful ? '✅' : '❌ NÃO BATE'}`,
  );
  if (!faithful) {
    console.log('  ↑ reconstrução não reproduz o original — número novo NÃO reportado para este bloco.\n');
    continue;
  }

  const repriced = reprice(trades, newCost, contractBtc);
  const groups: [string, typeof repriced][] = [
    ['LONG', repriced.filter(t => t.side === 'LONG')],
    ['SHORT', repriced.filter(t => t.side === 'SHORT')],
    ['POOLED', repriced],
  ];

  console.log('\n  grupo    n      winRate   total (0,26%)   total (0,0291%)    Sharpe      DSR');
  console.log('  ' + '-'.repeat(76));
  for (const [label, g] of groups) {
    const antes = block.results[label];
    const depois = summarize(g);
    console.log(
      `  ${label.padEnd(8)} ${String(depois.n).padEnd(6)} ${(depois.winRate * 100).toFixed(1).padStart(5)}%   ` +
      `${usd(antes.totalUsd).padStart(13)}   ${usd(depois.totalUsd).padStart(14)}   ` +
      `${depois.sharpe.toFixed(3).padStart(7)}   ${(depois.dsr * 100).toFixed(1).padStart(6)}%`,
    );
    report.push({
      interval: block.interval, group: label, n: depois.n,
      antes: { totalUsd: antes.totalUsd, sharpe: antes.sharpe, dsr: antes.dsr },
      depois: { totalUsd: depois.totalUsd, sharpe: depois.sharpe, dsr: depois.dsr, winRate: depois.winRate },
    });
  }
  console.log('');
}

// ───────────────────────────────────────────────────────────────────────────
// PODER ESTATÍSTICO das amostras que a seção 14 usa como evidência
//
// Mesma fórmula do Gate 2 de `2026-08-02-viability-gates/scripts/gates.mjs`:
// n ≈ (z_α + z_β)²/k², com k = 0,0338 (âncora empírica, BTCUSD n=202.075) e o
// desconto de independência N_eff/N = 0,259 medido na cesta cripto (Gate 3).
// Reimplementado aqui em vez de importado porque aquele script é .mjs sem exports
// — as constantes vêm de lá e estão citadas, não inventadas.
// ───────────────────────────────────────────────────────────────────────────
const K_EMPIRICAL = 0.0338;
const N_EFF_RATIO = 0.259;

function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}

/** z para α=5% (unilateral) e para poder 80% — valores de tabela, não estimados. */
const Z_ALPHA = 1.6448536269514722;
const Z_BETA = 0.8416212335729143;

console.log('── Poder estatístico das amostras da seção 14 ' + '─'.repeat(35));
console.log(`  alvo: detectar k = ${K_EMPIRICAL} (Sharpe bruto por trade) com α=5%, poder 80%`);
console.log(`  n independente necessário: ${Math.round(((Z_ALPHA + Z_BETA) ** 2) / K_EMPIRICAL ** 2)} trades`);
console.log(`  desconto de independência medido na cesta cripto: N_eff/N = ${N_EFF_RATIO}\n`);
console.log('  amostra                             n      N_eff    poder');
console.log('  ' + '-'.repeat(58));

const powerRows: { label: string; n: number; nEff: number; power: number }[] = [];
for (const [label, n] of [
  ['diagnóstico MFE/MAE 15m (14.1)', 4058],
  ['diagnóstico MFE/MAE 1h (14.1)', 973],
  ['executável 15m pooled (14.3)', 615],
  ['executável 1h pooled (14.3)', 133],
  ['executável 1h SHORT (14.3)', 70],
] as [string, number][]) {
  const nEff = n * N_EFF_RATIO;
  const power = normCdf(K_EMPIRICAL * Math.sqrt(nEff) - Z_ALPHA);
  powerRows.push({ label, n, nEff, power });
  console.log(
    `  ${label.padEnd(33)} ${String(n).padStart(5)} ${Math.round(nEff).toString().padStart(8)}   ` +
    `${(power * 100).toFixed(1).padStart(5)}%  ❌`,
  );
}
console.log('\n  Nenhuma amostra da seção 14 tinha poder para decidir sobre um edge do');
console.log('  tamanho do único já medido no projeto. Isso NÃO afeta 14.2 (parada');
console.log('  opcional é teorema, não medição) — afeta as tabelas empíricas.\n');

if (fidelityFailures > 0) {
  console.error(`\n❌ ${fidelityFailures} bloco(s) falharam a trava de fidelidade — resultado não confiável.\n`);
  process.exit(1);
}

writeFileSync(
  join(HERE, 'results.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'research/experiments/2026-07-30-breakout-donchian-executable/output.json',
    legacyRoundTripPercent: LEGACY_ROUND_TRIP_PERCENT,
    correctedRoundTripPercent: newCost,
    rows: report,
    power: { kEmpirical: K_EMPIRICAL, nEffRatio: N_EFF_RATIO, rows: powerRows },
  }, null, 2) + '\n',
);
console.log('results.json escrito.\n');
