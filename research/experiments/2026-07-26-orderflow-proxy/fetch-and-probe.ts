/**
 * Trilho 2 (AI_BRAIN_SPEC.md seção 13) — Etapa 0, ANTES de gastar dinheiro em
 * provedor pago de order book (Tardis.dev / CoinAPI Flat Files).
 *
 * Objetivo desta etapa: validar barato e reversível se existe QUALQUER sinal
 * preditivo em desequilíbrio de fluxo de ordens, usando dado 100% grátis
 * (aggTrades público da Binance), antes de comprar assinatura de order book
 * real. Isto NÃO é o teste final da spec — é um probe de viabilidade.
 *
 * Importante (limitação declarada, não escondida): aggTrades NÃO é order
 * book. É a sequência de trades executados, cada um já marcado como
 * comprador-agressor ou vendedor-agressor (campo `m`: isBuyerMaker). Não
 * existe profundidade de book nem ordens que não viraram trade. O proxy
 * calculado aqui — CVD (Cumulative Volume Delta) e desequilíbrio de fluxo —
 * é uma aproximação de PRESSÃO DE EXECUÇÃO, não de desequilíbrio de LIVRO.
 * Se este proxy não mostrar nenhum sinal, não prova que book real também não
 * teria (book captura intenção não executada, que este dado não vê) — mas
 * SE este proxy mostrar sinal, já justifica investir em dado real melhor.
 *
 * Método:
 * 1. Baixa aggTrades históricos da Binance (REST público, paginado por
 *    fromId, sem custo, sem chave de API) para os últimos N dias.
 * 2. Agrega em barras de M minutos, calculando por barra:
 *    - CVD da barra: soma(volume comprador-agressor) - soma(volume vendedor-agressor)
 *    - imbalance normalizado: CVD da barra / volume total da barra, em [-1, 1]
 * 3. Mede Information Coefficient (correlação de Spearman) entre o
 *    imbalance da barra t e o retorno da barra t+1 (t+2, t+3...) — SEM abrir
 *    posição, sem custo, sem look-ahead (imbalance de t só usa trades com
 *    timestamp <= fechamento de t).
 * 4. Reporta IC por horizonte e por ativo, dividido em 6 subjanelas
 *    cronológicas de 10 dias cada (60 dias no total). Critério de corte
 *    desta etapa v2 (revisado depois de a v1 ter mostrado sinal só
 *    tecnicamente acima do limiar, mas SEM consistência de direção entre
 *    horizontes — o mesmo padrão de falso-positivo já visto na seção 11.10
 *    do AI_BRAIN_SPEC.md, DSR 85% que virou 39% só de aumentar a amostra):
 *
 *    a) Significância estatística com correção de Bonferroni: p-valor do IC
 *       (aproximação normal, z = IC*sqrt(n-1)) precisa passar
 *       alpha=0.05 / nº de testes (4 ativos x 4 horizontes = 16 testes).
 *    b) Consistência de sinal: o IC precisa ter o MESMO sinal em pelo menos
 *       5 das 6 subjanelas de 10 dias (não só no agregado do período
 *       inteiro) — um IC agregado "significativo" que oscila de sinal
 *       subjanela a subjanela é ruído com aparência de sinal, não é
 *       promovido aqui.
 *
 *    Só conta como "vida" (justifica gastar em dado pago) uma combinação
 *    ativo x horizonte que passe (a) E (b) simultaneamente. Isto ainda NÃO
 *    é o teste final da spec (DSR + Sortino + bootstrap com order book
 *    real) — é só uma triagem mais rigorosa que a v1.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-26-orderflow-proxy/fetch-and-probe.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/orderflow-probe.mjs && node /tmp/orderflow-probe.mjs
 */

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
const BAR_MINUTES = 5; // curtíssimo prazo, coerente com o escopo do Trilho 2 (1m-15m)
const SUBWINDOW_DAYS = 10;
const NUM_SUBWINDOWS = 6; // 60 dias no total, dividido em 6 blocos cronológicos
const IC_HORIZONS = [1, 2, 3, 6]; // em barras de BAR_MINUTES à frente
const BONFERRONI_ALPHA = 0.05 / (SYMBOLS.length * IC_HORIZONS.length); // 16 testes

interface AggTrade {
  price: number;
  qty: number;
  time: number; // ms
  isBuyerMaker: boolean; // true = vendedor foi o agressor (trade bateu no bid)
}

interface Bar {
  openTime: number;
  closeTime: number;
  close: number;
  volume: number;
  cvd: number; // volume comprador-agressor - volume vendedor-agressor
  imbalance: number; // cvd / volume, em [-1, 1]
}

// ---------------------------------------------------------------------------
// 1. Coleta de aggTrades histórico (público, grátis, paginado por fromId)
// ---------------------------------------------------------------------------

async function fetchAggTradesWindow(symbol: string, startTime: number, endTime: number): Promise<AggTrade[]> {
  const out: AggTrade[] = [];
  let cursor = startTime;
  // Binance limita 1000 trades por chamada e 1h de janela por chamada nesse endpoint;
  // avançamos por startTime/endTime em blocos de 1h até cobrir o período pedido.
  while (cursor < endTime) {
    const windowEnd = Math.min(cursor + 60 * 60 * 1000, endTime);
    const url = `https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&startTime=${cursor}&endTime=${windowEnd}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Binance aggTrades falhou pra ${symbol}: HTTP ${res.status} ${await res.text()}`);
    }
    const raw: any[] = await res.json();
    for (const t of raw) {
      out.push({ price: +t.p, qty: +t.q, time: t.T, isBuyerMaker: t.m });
    }
    cursor = windowEnd;
    // respeita rate limit — chamada espaçada, mesma disciplina já documentada
    // no CLAUDE.md sobre não rajar a conta compartilhada (aqui é API pública
    // sem chave, mas o princípio de não abusar do endpoint se mantém).
    await new Promise(r => setTimeout(r, 150));
  }
  return out;
}

/** Baixa aggTrades pra cada subjanela cronológica separadamente, mais antiga primeiro. */
async function fetchAggTradesSubwindows(symbol: string, subwindowDays: number, numSubwindows: number): Promise<AggTrade[][]> {
  const now = Date.now();
  const subwindowMs = subwindowDays * 24 * 60 * 60 * 1000;
  const out: AggTrade[][] = [];
  for (let w = numSubwindows - 1; w >= 0; w--) {
    const start = now - (w + 1) * subwindowMs;
    const end = now - w * subwindowMs;
    console.log(`  baixando aggTrades de ${symbol} — subjanela ${numSubwindows - w}/${numSubwindows} (${new Date(start).toISOString()} → ${new Date(end).toISOString()})`);
    const trades = await fetchAggTradesWindow(symbol, start, end);
    console.log(`    ${trades.length} trades`);
    out.push(trades);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Agregação em barras de M minutos com CVD/imbalance
// ---------------------------------------------------------------------------

function buildBars(trades: AggTrade[], barMinutes: number): Bar[] {
  if (trades.length === 0) return [];
  const barMs = barMinutes * 60 * 1000;
  const bars = new Map<number, { volume: number; cvd: number; lastPrice: number }>();

  for (const t of trades) {
    const bucket = Math.floor(t.time / barMs) * barMs;
    const acc = bars.get(bucket) ?? { volume: 0, cvd: 0, lastPrice: t.price };
    acc.volume += t.qty;
    // isBuyerMaker = true significa que o COMPRADOR era o maker (ordem parada)
    // e o AGRESSOR foi o vendedor -> trade é pressão vendedora.
    acc.cvd += t.isBuyerMaker ? -t.qty : t.qty;
    acc.lastPrice = t.price;
    bars.set(bucket, acc);
  }

  return Array.from(bars.entries())
    .sort(([a], [b]) => a - b)
    .map(([openTime, acc]) => ({
      openTime,
      closeTime: openTime + barMs,
      close: acc.lastPrice,
      volume: acc.volume,
      cvd: acc.cvd,
      imbalance: acc.volume > 0 ? acc.cvd / acc.volume : 0,
    }));
}

// ---------------------------------------------------------------------------
// 3. Information Coefficient (Spearman) entre imbalance(t) e retorno(t+h)
// ---------------------------------------------------------------------------

function rank(values: number[]): number[] {
  const idx = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array(values.length);
  idx.forEach((originalIndex, rankPos) => { ranks[originalIndex] = rankPos; });
  return ranks;
}

function spearmanIC(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 10) return NaN;
  const rx = rank(x);
  const ry = rank(y);
  const meanRx = (n - 1) / 2;
  const meanRy = (n - 1) / 2;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanRx;
    const dy = ry[i] - meanRy;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? NaN : num / den;
}

function forwardReturns(bars: Bar[], horizon: number): number[] {
  const out = new Array(bars.length).fill(NaN);
  for (let i = 0; i < bars.length - horizon; i++) {
    out[i] = (bars[i + horizon].close - bars[i].close) / bars[i].close;
  }
  return out;
}

function icForHorizon(bars: Bar[], horizon: number): { ic: number; n: number } {
  const fwd = forwardReturns(bars, horizon);
  const imb: number[] = [];
  const ret: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (!Number.isNaN(fwd[i])) {
      imb.push(bars[i].imbalance);
      ret.push(fwd[i]);
    }
  }
  return { ic: spearmanIC(imb, ret), n: imb.length };
}

// Aproximação normal padrão pra Phi(z) (função erro de Abramowitz & Stegun 7.1.26).
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** p-valor bicaudal do IC de Spearman via aproximação normal, z = IC*sqrt(n-1). */
function spearmanPValue(ic: number, n: number): number {
  if (Number.isNaN(ic) || n < 10) return NaN;
  const z = ic * Math.sqrt(n - 1);
  return 2 * (1 - normalCdf(Math.abs(z)));
}

// ---------------------------------------------------------------------------
// 4. Runner
// ---------------------------------------------------------------------------

interface Result {
  symbol: string;
  horizon: number;
  icAggregate: number; // IC no período inteiro (60d) concatenado
  nAggregate: number;
  pValue: number;
  subwindowIcs: number[]; // 1 IC por subjanela de 10d
  sameSignCount: number; // quantas das 6 subjanelas concordam em sinal com icAggregate
  significant: boolean; // passa Bonferroni
  consistent: boolean; // >=5 de 6 subjanelas com mesmo sinal
  passes: boolean; // significant && consistent
}

async function main() {
  console.log('='.repeat(78));
  console.log('Trilho 2 — Etapa 0 (v2): probe de sinal em proxy de fluxo, com correção');
  console.log(`Barras de ${BAR_MINUTES}min, ${NUM_SUBWINDOWS}x${SUBWINDOW_DAYS}d = ${NUM_SUBWINDOWS * SUBWINDOW_DAYS}d de histórico, ${SYMBOLS.length} ativos`);
  console.log(`Bonferroni alpha corrigido: ${BONFERRONI_ALPHA.toFixed(5)} (${SYMBOLS.length * IC_HORIZONS.length} testes)`);
  console.log('='.repeat(78));

  const results: Result[] = [];

  for (const symbol of SYMBOLS) {
    const tradesBySubwindow = await fetchAggTradesSubwindows(symbol, SUBWINDOW_DAYS, NUM_SUBWINDOWS);
    const barsBySubwindow = tradesBySubwindow.map(trades => buildBars(trades, BAR_MINUTES));
    const allBars = barsBySubwindow.flat();
    console.log(`  ${symbol}: ${allBars.length} barras de ${BAR_MINUTES}min no total`);

    for (const h of IC_HORIZONS) {
      const { ic: icAggregate, n: nAggregate } = icForHorizon(allBars, h);
      const pValue = spearmanPValue(icAggregate, nAggregate);
      const subwindowIcs = barsBySubwindow.map(bars => icForHorizon(bars, h).ic);
      const sameSignCount = subwindowIcs.filter(ic => !Number.isNaN(ic) && Math.sign(ic) === Math.sign(icAggregate)).length;
      const significant = !Number.isNaN(pValue) && pValue < BONFERRONI_ALPHA;
      const consistent = sameSignCount >= 5;
      results.push({
        symbol, horizon: h, icAggregate, nAggregate, pValue,
        subwindowIcs, sameSignCount, significant, consistent,
        passes: significant && consistent,
      });
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log('IC agregado (60d) x consistência de sinal entre as 6 subjanelas de 10d');
  console.log('-'.repeat(100));
  console.log(
    'ativo'.padEnd(10) + 'horiz'.padEnd(8) + 'IC(60d)'.padEnd(10) + 'p-valor'.padEnd(10) +
    'sig?'.padEnd(7) + 'mesmo sinal'.padEnd(13) + 'consist?'.padEnd(10) + 'PASSA'
  );
  for (const r of results) {
    console.log(
      r.symbol.padEnd(10) +
      `+${r.horizon}`.padEnd(8) +
      r.icAggregate.toFixed(4).padEnd(10) +
      (Number.isNaN(r.pValue) ? 'NaN' : r.pValue.toFixed(4)).padEnd(10) +
      (r.significant ? 'sim' : 'não').padEnd(7) +
      `${r.sameSignCount}/${NUM_SUBWINDOWS}`.padEnd(13) +
      (r.consistent ? 'sim' : 'não').padEnd(10) +
      (r.passes ? 'SIM' : 'não')
    );
  }

  console.log('\nDetalhe por subjanela (IC de cada bloco de 10d, mesma ordem cronológica):');
  for (const r of results) {
    console.log(`  ${r.symbol} +${r.horizon}: [${r.subwindowIcs.map(ic => ic.toFixed(3)).join(', ')}]`);
  }

  const passing = results.filter(r => r.passes);
  const symbolsPassing = new Set(passing.map(r => r.symbol));

  console.log('\n' + '='.repeat(78));
  console.log('Critério de corte v2: significativo (Bonferroni) E consistente (>=5/6 subjanelas)');
  console.log(`Combinações ativo x horizonte que passam: ${passing.length}/${results.length}`);
  console.log(`Ativos com pelo menos 1 combinação aprovada: ${[...symbolsPassing].join(', ') || 'nenhum'}`);
  if (symbolsPassing.size >= 2) {
    console.log('=> Sinal sobrevive à correção estatística E é consistente ao longo do tempo. Justifica avançar pra dado real de order book (Tardis.dev / CoinAPI) e o teste rigoroso completo da spec (DSR + Sortino + bootstrap).');
  } else {
    console.log('=> Proxy NÃO mostra sinal que sobreviva a correção estatística + consistência temporal. Não gastar em dado pago com base nisto. Revisar hipótese do Trilho 2 antes de investir mais tempo/dinheiro nesta linha, ou aceitar que fluxo de execução (proxy) não tem edge detectável nesta janela.');
  }
  console.log('='.repeat(78));
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
