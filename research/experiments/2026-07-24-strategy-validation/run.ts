/**
 * Fase 1 (research/AI_BRAIN_SPEC.md, seção 8) — mede as 5 estratégias-preset
 * redesenhadas contra candle REAL, com custo de transação real descontado
 * (research/CostModel.ts), reportando retorno BRUTO vs LÍQUIDO, amostra e
 * hit rate. Responde a pergunta que faltava desde o redesenho: "essas
 * estratégias sobrevivem ao custo real de operar, ou só parecem boas no
 * papel?"
 *
 * Dados: forex via a mesma rota que o produto usa (/mt5-candles-history,
 * autentica com anon key pública, sem precisar de login) — só 2 chamadas
 * (EURUSD 1h e 4h), espaçadas, pra não repetir o incidente de rate-limit já
 * documentado extensivamente no histórico do projeto (conta MetaAPI
 * compartilhada, máx. 5 requisições históricas concorrentes). Cripto via
 * Binance REST pública (sem chave, sem esse limite).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-24-strategy-validation/run.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/validate-strategies.mjs && node /tmp/validate-strategies.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy, Timeframe } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent, AssetClass, breakEvenWinRate, roundTripCostPoints } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';

const SUPABASE_URL = 'https://wyvdsxtcmizettljxtbg.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dmRzeHRjbWl6ZXR0bGp4dGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1ODkzOTYsImV4cCI6MjA4MjE2NTM5Nn0.tYX5fBwz0LKa8Umak1MB9SBp_sIQ4Df_31H6GyI9eo4';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchForexCandles(symbol: string, tf: '1H' | '4H', days: number): Promise<Candle[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/server/mt5-candles-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ symbol, timeframe: tf, startTime: start.toISOString(), endTime: end.toISOString() }),
  });
  const data: any = await res.json();
  if (!data.success) {
    console.log(`  ⚠️ ${symbol} ${tf}: ${data.message || 'sem dado'} — pulando (sem inventar candle)`);
    return [];
  }
  return data.candles.map((c: any) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}

async function fetchBinanceCandles(symbol: string, interval: string, limit = 1000): Promise<Candle[]> {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) {
    console.log(`  ⚠️ ${symbol} ${interval} (Binance): HTTP ${res.status} — pulando`);
    return [];
  }
  const raw: any[] = await res.json();
  return raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
}

/**
 * Versão paginada — Binance é API pública sem o limite de concorrência da
 * conta MetaAPI compartilhada (documentado extensivamente no histórico do
 * projeto), então dá pra buscar anos de histórico sem risco de rate-limit
 * pros outros usuários da plataforma. Anda pra trás a partir de agora em
 * blocos de 1000 candles (mesma técnica já usada em BacktestDataService.ts).
 */
async function fetchBinanceCandlesPaginated(symbol: string, interval: string, pages: number): Promise<Candle[]> {
  const all: Candle[] = [];
  let endTime = Date.now();
  for (let p = 0; p < pages; p++) {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime}`);
    if (!res.ok) break;
    const raw: any[] = await res.json();
    if (raw.length === 0) break;
    const page: Candle[] = raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
    all.unshift(...page);
    endTime = page[0].time - 1;
  }
  return all;
}

const TF_TO_BINANCE: Record<Timeframe, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
const TF_TO_MT5: Record<string, '1H' | '4H'> = { '1h': '1H', '4h': '4H' };

interface DatasetSpec {
  label: string;
  symbol: string; // símbolo usado no motor (getPointValue etc.)
  assetClass: AssetClass;
  candles: Candle[];
}

const MIN_SAMPLE = 15; // amostra mínima pra reportar hit rate sem soar conclusivo (piso formal de 100 é do MarketScoreValidator sobre score contínuo; aqui, com só 5 estratégias e poucos ativos testáveis neste ambiente, tratamos qualquer coisa abaixo de 15 como "inconclusivo" explícito, nunca escondido)

/**
 * Instrumentação pedida pelo Cleber (2026-07-24) depois da 1ª rodada: os 3
 * datasets com amostra grande (79-872 trades) deram hit rate 22-37% com
 * retorno quase zero mesmo BRUTO — matematicamente estranho pro R:R nominal
 * desenhado (1:2 a 1:3), a menos que a maioria dos trades não esteja fechando
 * no TP/SL cheio. Esta função agrupa os trades por MOTIVO real de saída
 * (`result.exitReason`, já gravado por BacktestEngine.runBacktest — não
 * precisou mudar o motor) pra confirmar ou derrubar essa hipótese com dado,
 * em vez de recalibrar parâmetro às cegas até o número "melhorar".
 */
function breakdownByExitReason(trades: ReturnType<typeof runBacktest>['trades']) {
  const groups = new Map<string, { count: number; wins: number; sumProfitPercent: number }>();
  for (const t of trades) {
    const reason = t.result?.exitReason ?? 'desconhecido';
    const g = groups.get(reason) ?? { count: 0, wins: 0, sumProfitPercent: 0 };
    g.count += 1;
    if (t.status === 'win') g.wins += 1;
    g.sumProfitPercent += t.profitPercent;
    groups.set(reason, g);
  }
  const total = trades.length;
  return [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([reason, g]) => ({
      reason,
      count: g.count,
      pctOfTotal: total > 0 ? (g.count / total) * 100 : 0,
      hitRate: g.count > 0 ? (g.wins / g.count) * 100 : 0,
      avgProfitPercent: g.count > 0 ? g.sumProfitPercent / g.count : 0,
    }));
}

async function main() {
  console.log('\n═══ Validação real das 5 estratégias-preset (custo descontado) ═══\n');

  const datasets: DatasetSpec[] = [];

  // Forex real — 2 chamadas só, espaçadas (rate-limit da conta MetaAPI
  // compartilhada já documentado extensivamente; não repetir o erro de rajada)
  console.log('Buscando EURUSD 1h (real, via backend do produto)...');
  const eurusd1h = await fetchForexCandles('EURUSD', '1H', 180);
  if (eurusd1h.length > 0) datasets.push({ label: 'EURUSD 1h', symbol: 'EURUSD', assetClass: 'FOREX_MAJOR', candles: eurusd1h });
  await sleep(15000);

  console.log('Buscando EURUSD 4h (real, via backend do produto)...');
  const eurusd4h = await fetchForexCandles('EURUSD', '4H', 365);
  if (eurusd4h.length > 0) datasets.push({ label: 'EURUSD 4h', symbol: 'EURUSD', assetClass: 'FOREX_MAJOR', candles: eurusd4h });

  // Cripto real — Binance pública, sem o mesmo limite de concorrência. 1m/15m
  // ficam numa única página (janela curta é aceitável — sinais frequentes
  // nesses TFs); 1h/4h ganham paginação real (~3 anos) pra dar poder
  // estatístico de verdade a pelo menos 2 dos 5 arquétipos nesta rodada.
  for (const tf of ['1m', '15m'] as const) {
    console.log(`Buscando BTCUSDT ${tf} (real, Binance)...`);
    const candles = await fetchBinanceCandles('BTCUSDT', tf, 1000);
    if (candles.length > 0) datasets.push({ label: `BTCUSDT ${tf}`, symbol: 'BTCUSDT', assetClass: 'CRYPTO', candles });
  }
  for (const [tf, pages] of [['1h', 27], ['4h', 7]] as const) {
    console.log(`Buscando BTCUSDT ${tf} paginado (~${pages * 1000} candles reais, Binance)...`);
    const candles = await fetchBinanceCandlesPaginated('BTCUSDT', tf, pages);
    if (candles.length > 0) datasets.push({ label: `BTCUSDT ${tf}`, symbol: 'BTCUSDT', assetClass: 'CRYPTO', candles });
  }

  console.log(`\n${datasets.length} datasets reais carregados (nenhum candle sintético): ${datasets.map(d => d.label).join(', ')}\n`);

  for (const strategy of PRESET_STRATEGIES) {
    console.log(`\n── ${strategy.name} (${strategy.regime ?? 'sem regime declarado'}, TF=${strategy.timeframe}) ──`);

    const matching = datasets.filter(d => {
      // BTCUSDT nos timeframes buscados casam por interval; forex casa por 1h/4h.
      const wantedInterval = TF_TO_BINANCE[strategy.timeframe];
      return d.label.endsWith(` ${wantedInterval}`) || (strategy.timeframe in TF_TO_MT5 && d.label.endsWith(TF_TO_MT5[strategy.timeframe]));
    });

    if (matching.length === 0) {
      console.log(`  ⚠️ Nenhum dataset real disponível no timeframe ${strategy.timeframe} nesta rodada — sem dado, sem teste (nunca inventa resultado).`);
      continue;
    }

    for (const ds of matching) {
      const pointValue = getPointValue(ds.symbol);
      const priceLevel = ds.candles[ds.candles.length - 1].close;
      const roundTripCostPct = estimateCostPercent(ds.assetClass, priceLevel, pointValue) * 2;

      const gross = runBacktest(ds.candles, strategy, ds.symbol, 'both', 10000, 0);
      const net = runBacktest(ds.candles, strategy, ds.symbol, 'both', 10000, roundTripCostPct);

      const n = net.trades.length;
      const wins = net.trades.filter(t => t.status === 'win').length;
      const winRate = n > 0 ? (wins / n) * 100 : 0;
      const grossReturnPct = ((gross.finalEquity - 10000) / 10000) * 100;
      const netReturnPct = ((net.finalEquity - 10000) / 10000) * 100;

      const pMin =
        ds.assetClass !== 'CRYPTO'
          ? breakEvenWinRate(strategy.takeProfit, strategy.stopLoss, roundTripCostPoints(ds.assetClass))
          : null; // cripto é % do notional, não pontos — breakEvenWinRate não se aplica direto aqui

      const sampleFlag = n < MIN_SAMPLE ? ' ⚠️ AMOSTRA PEQUENA — inconclusivo, não usar como veredito' : '';
      console.log(
        `  ${ds.label.padEnd(14)} trades=${n}  hit=${winRate.toFixed(1)}%  bruto=${grossReturnPct >= 0 ? '+' : ''}${grossReturnPct.toFixed(2)}%  líquido=${netReturnPct >= 0 ? '+' : ''}${netReturnPct.toFixed(2)}%  custo/trade≈${(roundTripCostPct * 100).toFixed(3)}%${pMin !== null ? `  p_min=${(pMin * 100).toFixed(1)}%` : ''}${sampleFlag}`
      );

      // Decomposição por motivo de saída — só vale a pena olhar com amostra
      // grande o bastante pra cada grupo não ser ruído dentro do ruído.
      if (n >= MIN_SAMPLE) {
        const breakdown = breakdownByExitReason(gross.trades); // bruto: mede se o R:R nominal se realiza, sem custo misturado
        for (const g of breakdown) {
          console.log(
            `      └─ ${g.reason.padEnd(38)} ${g.count.toString().padStart(4)} trades (${g.pctOfTotal.toFixed(0)}%)  hit=${g.hitRate.toFixed(1)}%  retorno médio/trade=${g.avgProfitPercent >= 0 ? '+' : ''}${g.avgProfitPercent.toFixed(3)}%`
          );
        }
      }
    }
  }

  console.log('\n═══ Fim. Nenhum número acima é sintético — todo candle veio de fonte real (backend do produto/MetaAPI para forex, Binance pública para cripto). ═══\n');
}

main().catch(err => {
  console.error('Erro na validação:', err);
  process.exit(1);
});
