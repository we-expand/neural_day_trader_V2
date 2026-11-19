/**
 * Diagnóstico: quantos trades reais chegaram a ficar no lucro (preço andou
 * a favor) e depois inverteram e fecharam no prejuízo (ou no zero)?
 * E, desses, quantos JÁ deveriam ter sido protegidos pelo breakeven atual
 * (+1.5R, positionManager.ts) e não foram vs. quantos nunca chegaram no
 * gatilho atual (protegidos só com breakeven mais sensível)?
 *
 * Usa o EXIT_TIME REAL gravado (não simula fechamento) — só mede a máxima
 * excursão favorável (MFE) real entre entrada e saída real, candle a candle,
 * sem look-ahead (só olha candles até o exit_time gravado).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const BREAKEVEN_TRIGGER_R = 1.5;

const trades = JSON.parse(readFileSync(join(DATA_DIR, 'real_trades.json'), 'utf8'));
const candlesBySymbol = {
  BTCUSD: JSON.parse(readFileSync(join(DATA_DIR, 'BTCUSD_15m.json'), 'utf8')),
  ETHUSD: JSON.parse(readFileSync(join(DATA_DIR, 'ETHUSD_15m.json'), 'utf8')),
  SOLUSD: JSON.parse(readFileSync(join(DATA_DIR, 'SOLUSD_15m.json'), 'utf8')),
};

function findIndexAtOrAfter(candles, timeMs) {
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time + 15 * 60_000 > timeMs) return i;
  }
  return -1;
}

const rows = [];
for (const trade of trades) {
  const candles = candlesBySymbol[trade.symbol];
  const entryTimeMs = Date.parse(trade.entry_time);
  const exitTimeMs = Date.parse(trade.exit_time);
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalRisk = Math.abs(entryPrice - originalSl);
  const realNetPnl = parseFloat(trade.net_pnl);
  const side = trade.side;

  const startIdx = findIndexAtOrAfter(candles, entryTimeMs);
  if (startIdx === -1 || !(originalRisk > 0)) {
    rows.push({ id: trade.id, symbol: trade.symbol, skipped: 'sem_candle_ou_sem_risco' });
    continue;
  }

  let mfePrice = entryPrice; // melhor preço a favor observado
  let sawCandle = false;
  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > exitTimeMs) break;
    sawCandle = true;
    if (side === 'LONG') mfePrice = Math.max(mfePrice, c.high);
    else mfePrice = Math.min(mfePrice, c.low);
  }
  if (!sawCandle) {
    rows.push({ id: trade.id, symbol: trade.symbol, skipped: 'sem_candle_na_janela_real' });
    continue;
  }

  const mfeAbs = side === 'LONG' ? mfePrice - entryPrice : entryPrice - mfePrice;
  const mfeR = mfeAbs / originalRisk;

  rows.push({
    id: trade.id,
    symbol: trade.symbol,
    side,
    entry_time: trade.entry_time,
    exit_time: trade.exit_time,
    real_net_pnl: realNetPnl,
    mfe_R: mfeR,
    chegou_a_ganhar: mfeR > 0.05, // margem pra ruído de candle
    fechou_perdendo_ou_zero: realNetPnl <= 0,
    reverteu_de_ganho_pra_perda: mfeR > 0.05 && realNetPnl <= 0,
    deveria_ter_sido_protegido_pelo_breakeven_atual: mfeR >= BREAKEVEN_TRIGGER_R && realNetPnl <= 0,
  });
}

writeFileSync(join(RESULTS_DIR, 'reversal_detail.json'), JSON.stringify(rows, null, 2));

const valid = rows.filter(r => !r.skipped);
const reverted = valid.filter(r => r.reverteu_de_ganho_pra_perda);
const shouldHaveBeenProtected = valid.filter(r => r.deveria_ter_sido_protegido_pelo_breakeven_atual);
const revertedBelowTrigger = reverted.filter(r => r.mfe_R < BREAKEVEN_TRIGGER_R);

const bucket = (lo, hi) => reverted.filter(r => r.mfe_R >= lo && r.mfe_R < hi).length;

const summary = {
  total_trades_input: rows.length,
  skipped: rows.length - valid.length,
  trades_validos: valid.length,
  reverteram_de_ganho_pra_perda_ou_zero: reverted.length,
  pct_do_total: valid.length ? reverted.length / valid.length : null,
  soma_pnl_real_dos_que_reverteram: reverted.reduce((s, r) => s + r.real_net_pnl, 0),
  ja_deveriam_ter_sido_protegidos_pelo_breakeven_1_5R_mas_nao_foram: shouldHaveBeenProtected.length,
  detalhe_desses_casos: shouldHaveBeenProtected.map(r => ({ id: r.id, symbol: r.symbol, mfe_R: r.mfe_R, real_net_pnl: r.real_net_pnl })),
  reverteram_mas_nunca_bateram_1_5R_de_gatilho: revertedBelowTrigger.length,
  distribuicao_mfe_R_dos_que_reverteram: {
    'entre_0_e_0.5R': bucket(0, 0.5),
    'entre_0.5_e_1R': bucket(0.5, 1),
    'entre_1_e_1.5R': bucket(1, 1.5),
    'acima_de_1.5R': reverted.filter(r => r.mfe_R >= 1.5).length,
  },
};

writeFileSync(join(RESULTS_DIR, 'reversal_summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
