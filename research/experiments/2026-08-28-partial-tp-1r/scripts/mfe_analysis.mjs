/**
 * MFE (Máxima Excursão Favorável) real por trade — candle 5m Binance.
 * Pergunta: das operações que fecharam em prejuízo/breakeven, quantas
 * chegaram a ter lucro flutuante significativo antes de reverter?
 * Sem look-ahead: só usa candles entre entry_time e exit_time reais.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const trades = JSON.parse(readFileSync(join(DATA_DIR, 'trades2.json'), 'utf8'));
const candlesBySymbol = {
  BTCUSD: JSON.parse(readFileSync(join(DATA_DIR, 'BTCUSD_5m.json'), 'utf8')),
  ETHUSD: JSON.parse(readFileSync(join(DATA_DIR, 'ETHUSD_5m.json'), 'utf8')),
  SOLUSD: JSON.parse(readFileSync(join(DATA_DIR, 'SOLUSD_5m.json'), 'utf8')),
};

function findIdxAtOrAfter(candles, ts) {
  for (let i = 0; i < candles.length; i++) if (candles[i].time + 5 * 60_000 >= ts) return i;
  return -1;
}
function findIdxAtOrBefore(candles, ts) {
  let idx = -1;
  for (let i = 0; i < candles.length; i++) { if (candles[i].time <= ts) idx = i; else break; }
  return idx;
}

const rows = [];
let skipped = 0;
for (const t of trades) {
  const candles = candlesBySymbol[t.symbol];
  if (!candles) { skipped++; continue; }

  const entryTs = Date.parse(t.entry_time);
  const exitTs = Date.parse(t.exit_time);
  if (!t.exit_time || !(exitTs > entryTs)) { skipped++; continue; }

  const startIdx = findIdxAtOrAfter(candles, entryTs);
  const endIdx = findIdxAtOrBefore(candles, exitTs);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) { skipped++; continue; }

  const entry = parseFloat(t.entry_price);
  const sl = parseFloat(t.stop_loss);
  const originalRisk = Math.abs(entry - sl);
  const qty = parseFloat(t.quantity);
  const side = t.side;

  let bestFavorable = 0; // em preço
  for (let i = startIdx; i <= endIdx; i++) {
    const c = candles[i];
    const fav = side === 'LONG' ? c.high - entry : entry - c.low;
    if (fav > bestFavorable) bestFavorable = fav;
  }

  const mfeR = originalRisk > 0 ? bestFavorable / originalRisk : null;
  const mfeDollar = bestFavorable * (qty / entry);
  const netPnl = parseFloat(t.net);

  rows.push({
    id: t.id, symbol: t.symbol, side, entry_time: t.entry_time,
    netPnl, exit_reason: t.exit_reason,
    mfeR, mfeDollar,
    hadMeaningfulProfit: mfeDollar > 0.05, // limiar acima de ruído/spread
    gaveItAllBack: mfeDollar > 0.05 && netPnl <= 0.02,
  });
}

writeFileSync(join(RESULTS_DIR, 'mfe_detail.json'), JSON.stringify(rows, null, 2));

const n = rows.length;
const hadProfit = rows.filter(r => r.hadMeaningfulProfit);
const gaveBack = rows.filter(r => r.gaveItAllBack);
const closedLossOrFlat = rows.filter(r => r.netPnl <= 0.02);

const summary = {
  total_trades_com_candle: n,
  skipped_sem_candle_ou_dado: skipped,
  trades_que_tiveram_lucro_flutuante_relevante: hadProfit.length,
  pct_do_total_que_teve_lucro_flutuante: (hadProfit.length / n * 100).toFixed(1) + '%',
  trades_que_fecharam_prejuizo_ou_flat: closedLossOrFlat.length,
  trades_que_tiveram_lucro_E_devolveram_tudo: gaveBack.length,
  pct_dos_que_tiveram_lucro_que_devolveram_tudo: (gaveBack.length / hadProfit.length * 100).toFixed(1) + '%',
  pct_do_TOTAL_de_trades_que_e_ganhou_e_devolveu: (gaveBack.length / n * 100).toFixed(1) + '%',
  mfe_medio_R_de_quem_devolveu: (gaveBack.reduce((s,r)=>s+(r.mfeR||0),0)/gaveBack.length).toFixed(2),
  soma_dolar_perdido_por_devolver: gaveBack.reduce((s,r)=> s + (r.mfeDollar - Math.max(r.netPnl,0)), 0).toFixed(2),
};
writeFileSync(join(RESULTS_DIR, 'mfe_summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
