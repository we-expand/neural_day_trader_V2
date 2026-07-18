/**
 * 🔍 CRYPTO ORDER BOOK ANALYZER — order book real, só cripto (2026-07-18)
 * ============================================================================
 * Substitui o painel "Order Book"/"Spoofing Detectado" do Nexus Quantum
 * Advisor (100% Math.random(), ver MarketTendencyEngine.ts) por análise REAL
 * de profundidade, usando o book público da Binance (`/api/v3/depth`).
 *
 * Por que só cripto: testado via MetaAPI/Infinox (2026-07-18) — EURUSD,
 * GBPUSD, USDJPY e BTCUSD (via corretora) devolvem 404 "order book not
 * found" no endpoint `current-book`. A Infinox roda esses instrumentos em
 * modo market-maker puro, sem feed de profundidade habilitado — não é uma
 * limitação de código, é a corretora não expor esse dado. Forex/índice/
 * commodity não têm (e não vão ter) um substituto de order book real —
 * usar um proxy de posicionamento (Myfxbook/COT) em vez disso.
 *
 * ⚠️ Sobre "spoofing": detecção forense de spoofing de verdade exige
 * rastrear ID de ordem (colocação → cancelamento pela mesma entidade), que
 * o feed público de profundidade não fornece. O que ESTA análise detecta é
 * uma heurística honesta e real: "ordem grande (outlier de volume) apareceu
 * perto do preço e sumiu do book antes do preço alcançá-la" — um padrão
 * consistente com spoofing, mas não uma prova. O `insight` gerado sempre
 * comunica isso como heurística, nunca como certeza.
 */

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  timestamp: number;
  midPrice: number;
  bids: DepthLevel[]; // ordenados do melhor preço (mais alto) pro pior
  asks: DepthLevel[]; // ordenados do melhor preço (mais baixo) pro pior
}

export interface DepthImbalanceResult {
  /** -100 (pressão de venda) … +100 (pressão de compra) */
  imbalance: number;
  bidVolume: number;
  askVolume: number;
  rangePercent: number;
  midPrice: number;
}

export interface LargeOrderEvent {
  side: 'bid' | 'ask';
  price: number;
  quantity: number;
  /** múltiplo da quantidade mediana do book no momento em que apareceu */
  outlierRatio: number;
  firstSeenAt: number;
  /** true quando a ordem sumiu sem o preço tê-la alcançado (heurística) */
  pulledBeforeFill: boolean;
  pulledAt: number | null;
}

export interface OrderBookAnalysisResult {
  symbol: string;
  provenance: 'real';
  fetchedAt: number;
  imbalance: DepthImbalanceResult;
  /** heurística — ver comentário de topo do arquivo */
  suspiciousLargeOrders: LargeOrderEvent[];
  insight: string;
}

const BINANCE_DEPTH_URL = 'https://api.binance.com/api/v3/depth';

export async function fetchOrderBookSnapshot(
  binanceSymbol: string,
  limit: 100 | 500 | 1000 = 100
): Promise<OrderBookSnapshot> {
  const res = await fetch(`${BINANCE_DEPTH_URL}?symbol=${binanceSymbol}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Binance depth HTTP ${res.status} para ${binanceSymbol}`);
  }
  const data = await res.json();
  const bids: DepthLevel[] = data.bids.map(([p, q]: [string, string]) => ({
    price: parseFloat(p),
    quantity: parseFloat(q),
  }));
  const asks: DepthLevel[] = data.asks.map(([p, q]: [string, string]) => ({
    price: parseFloat(p),
    quantity: parseFloat(q),
  }));
  const midPrice = bids.length && asks.length ? (bids[0].price + asks[0].price) / 2 : 0;

  return { symbol: binanceSymbol, timestamp: Date.now(), midPrice, bids, asks };
}

/**
 * Soma volume de compra/venda dentro de `rangePercent`% do preço médio e
 * devolve o desequilíbrio como -100..+100. Real: é soma direta do book,
 * nenhum valor inventado.
 */
export function computeDepthImbalance(
  snapshot: OrderBookSnapshot,
  rangePercent = 0.5
): DepthImbalanceResult {
  const { midPrice, bids, asks } = snapshot;
  const lowerBound = midPrice * (1 - rangePercent / 100);
  const upperBound = midPrice * (1 + rangePercent / 100);

  const bidVolume = bids
    .filter((l) => l.price >= lowerBound)
    .reduce((sum, l) => sum + l.quantity, 0);
  const askVolume = asks
    .filter((l) => l.price <= upperBound)
    .reduce((sum, l) => sum + l.quantity, 0);

  const total = bidVolume + askVolume;
  const imbalance = total > 0 ? ((bidVolume - askVolume) / total) * 100 : 0;

  return { imbalance, bidVolume, askVolume, rangePercent, midPrice };
}

/**
 * Rastreador com estado (por símbolo) — mantém o snapshot anterior em
 * memória e, a cada novo snapshot, detecta ordens-outlier que apareceram e
 * sumiram sem o preço tê-las alcançado. Precisa ser chamado repetidamente
 * (ex: a cada poucos segundos) pra gerar sinal — um snapshot único não é
 * suficiente pra detectar "ordem puxada".
 */
export class LargeOrderTracker {
  private lastSnapshot: OrderBookSnapshot | null = null;
  // Outlier visto 1x — ainda não confirmado (evita contar ruído de 1 tick).
  private pendingCandidates = new Map<string, DepthLevel & { side: 'bid' | 'ask'; firstSeenAt: number }>();
  // Outlier confirmado (visto em 2+ leituras consecutivas) — só a partir daqui rastreamos "sumiu".
  private trackedOrders = new Map<string, LargeOrderEvent>();
  private readonly outlierMultiplier: number;
  private readonly nearLevelsCount: number;
  private readonly requiredConfirmations: number;
  private readonly maxTrackedAgeMs: number;

  /**
   * @param outlierMultiplier quantas vezes a mediana LOCAL (só dos níveis
   *   próximos do melhor preço) uma ordem precisa ter pra virar candidata.
   * @param nearLevelsCount quantos níveis de cada lado (a partir do topo do
   *   book) entram no cálculo da mediana — comparar contra o book INTEIRO
   *   mistura níveis distantes (tipicamente bem menores) com os próximos do
   *   preço, inflando artificialmente o "outlier ratio" de qualquer ordem
   *   perto do topo. Restringir à vizinhança do preço corrige isso.
   * @param requiredConfirmations nº de leituras CONSECUTIVAS como outlier
   *   antes de virar candidata rastreada — descarta ruído de reposicionamento
   *   normal de market maker (ordem que aparece e some no mesmo tick).
   */
  constructor(
    outlierMultiplier = 8,
    nearLevelsCount = 15,
    requiredConfirmations = 2,
    maxTrackedAgeMs = 60_000
  ) {
    this.outlierMultiplier = outlierMultiplier;
    this.nearLevelsCount = nearLevelsCount;
    this.requiredConfirmations = requiredConfirmations;
    this.maxTrackedAgeMs = maxTrackedAgeMs;
  }

  private median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private levelKey(side: 'bid' | 'ask', price: number): string {
    return `${side}:${price}`;
  }

  ingest(snapshot: OrderBookSnapshot): LargeOrderEvent[] {
    const now = snapshot.timestamp;
    // Mediana LOCAL: só os N níveis mais próximos do topo de cada lado
    // (a API da Binance já devolve bids/asks ordenados do melhor preço pro
    // pior) — compara ordem com vizinhança real, não com a cauda do book.
    const nearBids = snapshot.bids.slice(0, this.nearLevelsCount);
    const nearAsks = snapshot.asks.slice(0, this.nearLevelsCount);
    const medianQty = this.median([...nearBids, ...nearAsks].map((l) => l.quantity));

    const currentLevels = new Map<string, DepthLevel & { side: 'bid' | 'ask' }>();
    for (const l of nearBids) currentLevels.set(this.levelKey('bid', l.price), { ...l, side: 'bid' });
    for (const l of nearAsks) currentLevels.set(this.levelKey('ask', l.price), { ...l, side: 'ask' });

    // 1) Candidatos: outlier visto agora. Só vira "tracked" na 2ª confirmação
    //    consecutiva — filtra o reposicionamento normal de 1 tick.
    if (medianQty > 0) {
      for (const [key, level] of currentLevels) {
        const ratio = level.quantity / medianQty;
        const isOutlier = ratio >= this.outlierMultiplier;
        const pending = this.pendingCandidates.get(key);

        if (isOutlier && !this.trackedOrders.has(key)) {
          if (pending) {
            // Visto de novo, ainda outlier -> confirma e promove.
            this.trackedOrders.set(key, {
              side: level.side,
              price: level.price,
              quantity: level.quantity,
              outlierRatio: ratio,
              firstSeenAt: pending.firstSeenAt,
              pulledBeforeFill: false,
              pulledAt: null,
            });
            this.pendingCandidates.delete(key);
          } else {
            this.pendingCandidates.set(key, { ...level, side: level.side, firstSeenAt: now });
          }
        } else if (!isOutlier && pending) {
          // Deixou de ser outlier antes de confirmar -> descarta candidatura.
          this.pendingCandidates.delete(key);
        }
      }
      // Candidatos que sumiram do book antes da 2ª confirmação: descarta (era ruído de 1 tick).
      for (const key of [...this.pendingCandidates.keys()]) {
        if (!currentLevels.has(key)) this.pendingCandidates.delete(key);
      }
    }

    // 2) Ordens CONFIRMADAS (2+ leituras): sumiram sem o preço alcançá-las?
    const events: LargeOrderEvent[] = [];
    for (const [key, tracked] of this.trackedOrders) {
      const stillThere = currentLevels.has(key);
      const priceReachedIt =
        tracked.side === 'bid'
          ? snapshot.midPrice <= tracked.price
          : snapshot.midPrice >= tracked.price;

      if (!stillThere && !priceReachedIt && !tracked.pulledBeforeFill) {
        tracked.pulledBeforeFill = true;
        tracked.pulledAt = now;
        events.push({ ...tracked });
      } else if (!stillThere && priceReachedIt) {
        // Sumiu porque o preço chegou lá (provável execução real, não spoof) — descarta.
        this.trackedOrders.delete(key);
      }

      if (now - tracked.firstSeenAt > this.maxTrackedAgeMs) {
        this.trackedOrders.delete(key);
      }
    }

    this.lastSnapshot = snapshot;
    return events;
  }
}

const trackers = new Map<string, LargeOrderTracker>();

function getTracker(symbol: string): LargeOrderTracker {
  if (!trackers.has(symbol)) trackers.set(symbol, new LargeOrderTracker());
  return trackers.get(symbol)!;
}

/**
 * Ponto de entrada único: busca um snapshot novo, atualiza o rastreador de
 * ordens grandes do símbolo (estado em memória do processo) e devolve a
 * análise consolidada. Chamar em polling (ex: a cada 3-5s) pra o rastreador
 * de ordens puxadas acumular sinal de verdade.
 */
export async function analyzeCryptoOrderBook(
  binanceSymbol: string,
  rangePercent = 0.5
): Promise<OrderBookAnalysisResult> {
  const snapshot = await fetchOrderBookSnapshot(binanceSymbol, 100);
  const imbalance = computeDepthImbalance(snapshot, rangePercent);
  const pulledEvents = getTracker(binanceSymbol).ingest(snapshot);

  const insightParts: string[] = [];
  if (Math.abs(imbalance.imbalance) >= 20) {
    insightParts.push(
      `Book com ${imbalance.imbalance > 0 ? 'pressão compradora' : 'pressão vendedora'} de ${Math.abs(imbalance.imbalance).toFixed(0)}% dentro de ±${rangePercent}% do preço.`
    );
  } else {
    insightParts.push('Book equilibrado entre compra e venda.');
  }
  if (pulledEvents.length > 0) {
    insightParts.push(
      `⚠️ Heurística: ${pulledEvents.length} ordem(ns) muito acima do volume típico do book (${pulledEvents.map((e) => `${e.outlierRatio.toFixed(1)}x`).join(', ')}) apareceu(ram) e sumiu(ram) antes do preço alcançá-la(s) — padrão consistente com ordem fantasma, não confirmado (feed público não identifica quem colocou/cancelou).`
    );
  }

  return {
    symbol: binanceSymbol,
    provenance: 'real',
    fetchedAt: snapshot.timestamp,
    imbalance,
    suspiciousLargeOrders: pulledEvents,
    insight: insightParts.join(' '),
  };
}
