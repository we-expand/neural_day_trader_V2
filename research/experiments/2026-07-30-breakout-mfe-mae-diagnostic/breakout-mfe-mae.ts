/**
 * Diagnóstico BARATO (sem custo de transação, sem TP/SL, sem sizing) pedido
 * pelo Cleber em 2026-07-30: antes de desenhar uma estratégia completa em
 * torno da hipótese "rompimento de topo/fundo tem payoff assimétrico
 * (MFE >> MAE)", medir diretamente se essa assimetria aparece nos dados —
 * sem gastar ciclo em execução/custo se a premissa nem se sustentar.
 *
 * Sinal: rompimento de Donchian(20) — reaproveita `calculateDonchian` já
 * existente e o mesmo período (20) já usado no preset "Rompimento de Canal"
 * (`presetStrategies.ts`), para não introduzir parâmetro novo por
 * conveniência. Fechamento acima da máxima de 20 períodos anteriores = sinal
 * de topo (LONG); fechamento abaixo da mínima de 20 períodos = sinal de
 * fundo (SHORT). Ambos os lados habilitados (mesma disciplina dos testes
 * anteriores desta pasta de pesquisa).
 *
 * Saída/janela de medição: reusa a MESMA regra de saída do preset 1
 * (Donchian(10) oposto — rompimento da mínima de 10 períodos fecha um LONG,
 * rompimento da máxima de 10 períodos fecha um SHORT) em vez de inventar um
 * horizonte fixo arbitrário — é a regra já aprovada/documentada no produto
 * para esse arquétipo.
 *
 * O que É medido: MFE (excursão favorável máxima) e MAE (excursão adversa
 * máxima) em % do preço de entrada, durante a janela de holding, SEM custo
 * de transação e SEM aplicar TP/SL algum — pergunta pura: "dado que rompeu,
 * o movimento subsequente tende a ser maior a favor do que contra?"
 *
 * O que NÃO é medido aqui (de propósito, é diagnóstico, não backtest):
 * retorno líquido, Sharpe, DSR, win rate de estratégia executável. Isso só
 * vale a pena calcular se a assimetria aparecer aqui primeiro.
 *
 * EXTENSÃO (2026-07-30, pedida pelo Cleber depois da 1ª rodada): a 1ª rodada
 * (BTCUSDT sozinho, 6 meses) deu n=35 em 1h — pequeno demais pra confiar,
 * mesma lição da seção 11.10→11.11 do AI_BRAIN_SPEC.md (resultado promissor
 * com n pequeno reverteu ao crescer a amostra). Esta versão poola a MESMA
 * cesta cripto já usada na seção 11.13 (BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT,
 * XRPUSDT, ADAUSDT, DOGEUSDT — não escolhida agora, já era a cesta padrão do
 * projeto) e estende o calendário de 6 meses pra 24 meses. Zero mudança de
 * parâmetro do sinal/saída (continua Donchian 20/10).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-30-breakout-mfe-mae-diagnostic/breakout-mfe-mae.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/breakout-mfe-mae.mjs && node /tmp/breakout-mfe-mae.mjs
 */
import { writeFileSync } from 'fs';
import { Candle, calculateDonchian } from '../../../src/app/services/indicators/TechnicalIndicators';
import { splitWithEmbargo } from '../../DataSplit';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
const INTERVALS = ['15m', '1h'] as const;
const MONTHS_BACK = 24;
const ENTRY_PERIOD = 20; // mesmo período do preset "Rompimento de Canal (Donchian)"
const EXIT_PERIOD = 10; // mesmo período de saída do mesmo preset
const WARMUP_BARS = 60; // > ENTRY_PERIOD com folga, mesma ordem de grandeza usada nos outros scripts pra este período
const NUM_WINDOWS = 3;

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 5000;
const INTER_PAGE_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBinancePaginated(symbol: string, interval: string, sinceTime: number): Promise<Candle[]> {
  const all: Candle[] = [];
  let endTime = Date.now();
  for (;;) {
    let attempt = 0;
    let page: Candle[] = [];
    for (;;) {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime}`);
      if (res.ok) {
        const raw: any[] = await res.json();
        if (raw.length === 0) return all;
        page = raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
        break;
      }
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.log(`  [429 Binance, tentativa ${attempt + 1}/${MAX_RETRIES} — esperando ${backoff / 1000}s]`);
        await sleep(backoff);
        attempt++;
        continue;
      }
      throw new Error(`Sem dado real de ${symbol} ${interval}: HTTP ${res.status}. Sem fallback simulado por desenho.`);
    }
    all.unshift(...page);
    endTime = page[0].time - 1;
    if (page[0].time <= sinceTime) return all.filter(c => c.time >= sinceTime);
    await sleep(INTER_PAGE_DELAY_MS);
  }
}

type Side = 'LONG' | 'SHORT';

interface DiagnosticTrade {
  side: Side;
  entryIndex: number;
  exitIndex: number;
  holdingBars: number;
  mfePercent: number;
  maePercent: number;
  grossReturnPercent: number; // preço de saída vs entrada, SEM custo — só referência
}

function runDiagnostic(candles: Candle[], warmupBars: number): DiagnosticTrade[] {
  const entryChannel = calculateDonchian(candles, ENTRY_PERIOD);
  const exitChannel = calculateDonchian(candles, EXIT_PERIOD);

  const trades: DiagnosticTrade[] = [];
  let open: { side: Side; entryIndex: number; entryPrice: number; mfe: number; mae: number } | null = null;

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];

    if (open) {
      const favorable = open.side === 'LONG'
        ? (candle.high - open.entryPrice) / open.entryPrice * 100
        : (open.entryPrice - candle.low) / open.entryPrice * 100;
      const adverse = open.side === 'LONG'
        ? (open.entryPrice - candle.low) / open.entryPrice * 100
        : (candle.high - open.entryPrice) / open.entryPrice * 100;
      open.mfe = Math.max(open.mfe, favorable);
      open.mae = Math.max(open.mae, adverse);

      const exitLower = exitChannel.lower[i];
      const exitUpper = exitChannel.upper[i];
      const hitExit = open.side === 'LONG'
        ? (exitLower !== null && candle.close < exitLower)
        : (exitUpper !== null && candle.close > exitUpper);

      if (hitExit) {
        const grossReturnPercent = open.side === 'LONG'
          ? (candle.close - open.entryPrice) / open.entryPrice * 100
          : (open.entryPrice - candle.close) / open.entryPrice * 100;
        trades.push({
          side: open.side, entryIndex: open.entryIndex, exitIndex: i,
          holdingBars: i - open.entryIndex, mfePercent: open.mfe, maePercent: open.mae, grossReturnPercent,
        });
        open = null;
      }
      continue;
    }

    const upper = entryChannel.upper[i];
    const lower = entryChannel.lower[i];
    if (upper === null || lower === null) continue;

    if (candle.close > upper) {
      open = { side: 'LONG', entryIndex: i, entryPrice: candle.close, mfe: 0, mae: 0 };
    } else if (candle.close < lower) {
      open = { side: 'SHORT', entryIndex: i, entryPrice: candle.close, mfe: 0, mae: 0 };
    }
  }

  return trades.filter(t => t.entryIndex >= warmupBars);
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

function reportGroup(label: string, trades: DiagnosticTrade[]): any {
  if (trades.length === 0) {
    console.log(`${label.padEnd(24)} n=0 — sem sinal`);
    return { n: 0 };
  }
  const mfeValues = trades.map(t => t.mfePercent);
  const maeValues = trades.map(t => t.maePercent);
  const ratios = trades.map(t => (t.maePercent > 0 ? t.mfePercent / t.maePercent : t.mfePercent > 0 ? Infinity : 1)).filter(Number.isFinite);
  const wins = trades.filter(t => t.grossReturnPercent > 0).length;

  const meanMfe = mean(mfeValues);
  const meanMae = mean(maeValues);
  const medianRatio = median(ratios);
  const meanHolding = mean(trades.map(t => t.holdingBars));

  console.log(`${label.padEnd(24)} n=${String(trades.length).padEnd(5)} MFE médio=${meanMfe.toFixed(3)}%  MAE médio=${meanMae.toFixed(3)}%  razão MFE/MAE mediana=${Number.isFinite(medianRatio) ? medianRatio.toFixed(3) : 'n/d'}  winRate(bruto,sem custo)=${((wins / trades.length) * 100).toFixed(1)}%  holding médio=${meanHolding.toFixed(1)} barras`);

  return { n: trades.length, meanMfe, meanMae, medianMfeMaeRatio: medianRatio, winRateGross: (wins / trades.length) * 100, meanHoldingBars: meanHolding };
}

async function runForIntervalPooled(interval: string) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(`${interval} pooled (${SYMBOLS.join(', ')}) — rompimento Donchian(${ENTRY_PERIOD}), saída Donchian(${EXIT_PERIOD}) oposto`);
  console.log('='.repeat(78));

  const sinceTime = Date.now() - MONTHS_BACK * 30 * 86_400_000;
  const perSymbolTrades: Record<string, DiagnosticTrade[]> = {};
  let allTrades: DiagnosticTrade[] = [];

  for (const symbol of SYMBOLS) {
    const candles = await fetchBinancePaginated(symbol, interval, sinceTime);
    const windows = splitWithEmbargo(candles, NUM_WINDOWS, 0.7, WARMUP_BARS);
    const holdoutTrades = windows.flatMap(w => runDiagnostic(w.holdout, w.warmupBars));
    perSymbolTrades[symbol] = holdoutTrades;
    allTrades = allTrades.concat(holdoutTrades);
    console.log(`  ${symbol}: ${candles.length} candles, n_holdout=${holdoutTrades.length}`);
    await sleep(300);
  }

  console.log('');
  const results: Record<string, any> = {};
  results.LONG = reportGroup('LONG (pooled)', allTrades.filter(t => t.side === 'LONG'));
  results.SHORT = reportGroup('SHORT (pooled)', allTrades.filter(t => t.side === 'SHORT'));
  results.POOLED = reportGroup('POOLED (todos)', allTrades);

  console.log('\n  Por instrumento (pooled LONG+SHORT):');
  const perSymbol: Record<string, any> = {};
  for (const symbol of SYMBOLS) {
    perSymbol[symbol] = reportGroup(`  ${symbol}`, perSymbolTrades[symbol]);
  }

  return { interval, nHoldoutTotal: allTrades.length, results, perSymbol, trades: allTrades };
}

async function main() {
  console.log(`Diagnóstico MFE/MAE (EXTENDIDO) — rompimento de topo/fundo (Donchian), SEM custo, SEM TP/SL fixo.`);
  console.log(`Cesta: ${SYMBOLS.join(', ')} | ${MONTHS_BACK} meses | Pergunta única: o movimento subsequente ao rompimento é sistematicamente maior a favor (MFE) do que contra (MAE)?`);

  const allResults = [];
  for (const interval of INTERVALS) {
    const r = await runForIntervalPooled(interval);
    allResults.push(r);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('LEITURA: razão MFE/MAE mediana > 1 em ambos os lados e ambos os timeframes é');
  console.log('condição NECESSÁRIA (não suficiente) pra hipótese de payoff assimétrico se sustentar.');
  console.log('Se ficar perto de 1 ou abaixo, a ideia de "romper gera corrida de preço favorável"');
  console.log('não aparece nestes dados — mesmo antes de custo, sizing ou execução real.');
  console.log('='.repeat(70));

  const outPath = `${process.cwd()}/research/experiments/2026-07-30-breakout-mfe-mae-diagnostic/output.json`;
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(), symbols: SYMBOLS, entryPeriod: ENTRY_PERIOD, exitPeriod: EXIT_PERIOD, monthsBack: MONTHS_BACK,
    perInterval: allResults,
  }, null, 2));
  console.log(`\nOutput bruto salvo em ${outPath}`);
}

main().catch(err => {
  console.error('Erro no diagnóstico MFE/MAE de rompimento:', err);
  process.exit(1);
});
