/**
 * Testa a hipótese do Cleber (2026-08-28): quando RSI mostra exaustão CONTRA
 * a direção do setup (SHORT com RSI<=35 sobrevendido, LONG com RSI>=65
 * sobrecomprado), em vez de VETAR a entrada, operar do lado OPOSTO.
 *
 * Metodologia: mesmos 34 trades reais de produção que caíram nessa zona
 * (14 dias, BTC/ETH/SOL), candle real de 5m (mesmo cache do sweep de
 * contenção), sem look-ahead. Para cada trade, simula a versão INVERTIDA
 * (lado oposto, mesma distância de risco espelhada a partir da entrada,
 * mesmo R:R do trade original) e compara contra o resultado REAL gravado.
 *
 * Precedente já registrado neste projeto (mesma disciplina anti-edge-sem-dado
 * do CLAUDE.md): "stop-and-reverse" (reverter DEPOIS do stop bater) foi
 * testado e REJEITADO com folga em research/experiments/2026-08-26-dynamic-
 * exit-tp-ceiling/verdict.md (Adendo 7): -$9,65 líquido, 84 trades piores
 * contra 15 melhores. Este teste é DIFERENTE (inverte NA ENTRADA, por RSI,
 * não depois do stop) — testado aqui como hipótese própria, não presumido.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const trades = JSON.parse(readFileSync(join(DATA_DIR, 'exhaustion_trades.json'), 'utf8'));
const candlesBySymbol = {
  BTCUSD: JSON.parse(readFileSync(join(DATA_DIR, 'BTCUSD_5m.json'), 'utf8')),
  ETHUSD: JSON.parse(readFileSync(join(DATA_DIR, 'ETHUSD_5m.json'), 'utf8')),
  SOLUSD: JSON.parse(readFileSync(join(DATA_DIR, 'SOLUSD_5m.json'), 'utf8')),
};
const BAR_MS = 5 * 60_000;
const MAX_HOLD_HOURS_CUTOFF = 30;

function findEntryIndex(candles, entryTimeMs) {
  for (let i = 0; i < candles.length; i++) if (candles[i].time + BAR_MS > entryTimeMs) return i;
  return -1;
}

function grossPnl(entryPrice, exitPrice, side, quantity) {
  const units = quantity / entryPrice;
  return side === 'LONG' ? (exitPrice - entryPrice) * units : (entryPrice - exitPrice) * units;
}

/** Simula SEM trailing/breakeven — só SL/TP fixos espelhados, candle real, sem look-ahead. */
function replay(entryTimeMs, candles, side, entryPrice, sl, tp) {
  const entryIdx = findEntryIndex(candles, entryTimeMs);
  if (entryIdx === -1) return { skipped: 'sem_candle_entrada' };
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;

  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'estourou_cutoff' };
    const hitSl = side === 'LONG' ? c.low <= sl : c.high >= sl;
    const hitTp = tp > 0 && (side === 'LONG' ? c.high >= tp : c.low <= tp);
    if (hitSl || hitTp) {
      // SL primeiro em ambiguidade — convenção conservadora do projeto
      return { exitPrice: hitSl ? sl : tp, reason: hitSl ? 'SL' : 'TP' };
    }
  }
  return { skipped: 'candles_acabaram' };
}

const rows = [];
for (const t of trades) {
  const candles = candlesBySymbol[t.symbol];
  const entry = parseFloat(t.entry_price);
  const sl = parseFloat(t.stop_loss);
  const tp = parseFloat(t.take_profit);
  const qty = parseFloat(t.quantity);
  const commission = parseFloat(t.commission) || 0;
  const rsi = parseFloat(t.rsi);
  const entryTimeMs = Date.parse(t.entry_time);

  const originalRisk = Math.abs(entry - sl);
  const originalTargetDist = Math.abs(tp - entry);
  const flippedSide = t.side === 'LONG' ? 'SHORT' : 'LONG';
  // Espelha a MESMA distância de risco/alvo a partir do mesmo preço de entrada,
  // só invertendo o lado — mesma convenção do experimento de stop-and-reverse já feito.
  const flippedSl = flippedSide === 'LONG' ? entry - originalRisk : entry + originalRisk;
  const flippedTp = flippedSide === 'LONG' ? entry + originalTargetDist : entry - originalTargetDist;

  const flipResult = replay(entryTimeMs, candles, flippedSide, entry, flippedSl, flippedTp);
  const realNet = parseFloat(t.net);

  let flipNet = null;
  if (!flipResult.skipped) {
    const gp = grossPnl(entry, flipResult.exitPrice, flippedSide, qty);
    flipNet = gp - commission; // mesmo custo estimado do trade original (mesmo notional)
  }

  rows.push({
    id: t.id, symbol: t.symbol, originalSide: t.side, rsi, entry_time: t.entry_time,
    realNet, realReason: t.exit_reason,
    flipNet, flipReason: flipResult.reason ?? null, flipSkipped: flipResult.skipped ?? null,
  });
}

writeFileSync(join(RESULTS_DIR, 'exhaustion_flip_detail.json'), JSON.stringify(rows, null, 2));

const paired = rows.filter(r => r.flipNet !== null);
const realSum = paired.reduce((s, r) => s + r.realNet, 0);
const flipSum = paired.reduce((s, r) => s + r.flipNet, 0);
const flipBetter = paired.filter(r => r.flipNet > r.realNet).length;
const flipWorse = paired.filter(r => r.flipNet < r.realNet).length;
const realWins = paired.filter(r => r.realNet > 0).length;
const flipWins = paired.filter(r => r.flipNet > 0).length;

// Combinado: e se a regra fosse "opera SEMPRE o lado invertido quando RSI mostra
// exaustão" (nunca o original)? É o número que decide se vale mudar produção.
const combinedIfAlwaysFlip = flipSum;

const summary = {
  total_trades_exaustao: rows.length,
  pares_validos_com_candle: paired.length,
  original_direcao: { netSum: +realSum.toFixed(4), wins: realWins, winRate: +(realWins/paired.length*100).toFixed(1) },
  direcao_invertida: { netSum: +flipSum.toFixed(4), wins: flipWins, winRate: +(flipWins/paired.length*100).toFixed(1) },
  delta_flip_menos_original: +(flipSum - realSum).toFixed(4),
  trades_em_que_flip_seria_melhor: flipBetter,
  trades_em_que_flip_seria_pior: flipWorse,
  trades_iguais: paired.length - flipBetter - flipWorse,
  se_sempre_operasse_invertido: +combinedIfAlwaysFlip.toFixed(4),
};
writeFileSync(join(RESULTS_DIR, 'exhaustion_flip_summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
