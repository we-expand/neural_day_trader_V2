/**
 * 🎯 MARKET SCORE ENGINE — Fase A (2026-07-17)
 * ============================================================================
 * Motor ÚNICO e REAL de cálculo do Market Score do Dashboard.
 *
 * Substitui a fórmula antiga de uma linha (`50 + variação%×10`) por uma
 * composição de FATORES ORTOGONAIS (que medem coisas diferentes), calculados
 * a partir de CANDLES REAIS multi-timeframe:
 *
 *   - Tendência   (40%) — alinhamento EMA9/SMA20/SMA200 + inclinação + ADX,
 *                         no TF do usuário E no TF-mãe (multi-timeframe).
 *   - Momentum    (25%) — RSI + Estocástico + MACD (MÉDIA, não soma, pra não
 *                         contar o mesmo eixo 3x — evita falsa confirmação).
 *   - Estrutura   (20%) — posição do preço no swing recente / níveis de Fibonacci.
 *   - Volume      (15%) — volume vs média + inclinação do OBV (confirmação de fluxo).
 *
 * O REGIME (tendência vs lateral, via ADX + largura de Bollinger) MODULA a
 * interpretação: em tendência, momentum acompanha; em mercado lateral, os
 * osciladores viram mean-reversion (RSI alto = espera correção, não compra).
 *
 * NADA é inventado: quando falta dado real (candles insuficientes, ativo sem
 * fonte), o resultado sai com `provenance` != 'real' e confiança reduzida —
 * nunca um número fabricado. Mesma filosofia anti-mock do resto do projeto.
 *
 * O score e a confiança são a base que a IA vai usar pra operar — por isso
 * cada componente é inspecionável (campo `factors`/`indicators`) e existe um
 * medidor de validação separado (MarketScoreValidator.ts) que prova, sobre
 * histórico real e sem look-ahead, se o score realmente prevê o movimento.
 */

import {
  backtestDataService,
  type Timeframe,
  type CandleData,
  BacktestDataUnavailableError,
} from './BacktestDataService';
import {
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateADX,
  calculateBollingerBands,
  calculateOBV,
  type Candle,
} from './indicators/TechnicalIndicators';

export type ScoreClassification = 'COMPRADOR' | 'VENDEDOR' | 'LATERAL';
export type MarketRegime = 'TENDENCIA' | 'LATERAL' | 'INDEFINIDO';
export type ScoreProvenance = 'real' | 'partial' | 'stale' | 'unavailable';

export interface MarketScoreFactors {
  /** -1 (baixa) … +1 (alta) */
  trend: number;
  momentum: number;
  structure: number;
  volume: number;
}

export interface MarketScoreIndicators {
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  ema9: number | null;
  sma20: number | null;
  sma200: number | null;
  macdHistogram: number | null;
  adx: number | null;
  atr: number | null;
  volumeRatio: number | null; // volume atual / média (1.0 = na média)
  fibPosition: number | null; // 0 (fundo do swing) … 1 (topo do swing)
  fibNearestLevel: number | null; // nível de Fib mais próximo (0.236, 0.382, ...)
}

export interface MarketScoreResult {
  score: number; // 1…99
  classification: ScoreClassification;
  confidence: number; // 0…100
  regime: MarketRegime;
  factors: MarketScoreFactors;
  indicators: MarketScoreIndicators;
  insight: string;
  provenance: ScoreProvenance;
  symbol: string;
  timeframe: Timeframe;
  parentTimeframe: Timeframe;
  timestamp: number;
}

// Pesos aprovados (Cleber, 2026-07-17). Somam 1.0.
const WEIGHTS = { trend: 0.4, momentum: 0.25, structure: 0.2, volume: 0.15 };

// TF-mãe usado pra ancorar a tendência maior (multi-timeframe).
const PARENT_TF: Record<Timeframe, Timeframe> = {
  '1m': '15m',
  '5m': '1h',
  '15m': '1h',
  '1h': '4h',
  '4h': '1d',
  '1d': '1d',
};

const MS_PER_BAR: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

// Quantas barras buscar: SMA200 precisa de 200 + folga.
const BARS_NEEDED = 240;
// ✅ 2026-07-17: 60 candles/dias era longo demais pra capturar o swing LOCAL
// (achado com UKOUSD: 60 dias incluía um pico de $114 de maio antes de um
// crash até $71 em julho — a alta atual até $88, um rompimento real de topo
// LOCAL, ficava escondida no meio de um range gigante e antigo). Testado
// com dado real: 20 dias captura o swing certo (fibPosition foi de 0.39 pra
// 0.99 no mesmo candle, batendo com "rompeu o topo e entrou em expansão").
const FIB_SWING_LOOKBACK = 20; // janela pra achar o swing recente (estrutura/Fibonacci)
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && Number.isFinite(arr[i] as number)) return arr[i];
  }
  return null;
}

/** Alinha o fim da janela na fronteira da barra atual — deixa o cacheKey do
 *  BacktestDataService estável DENTRO de uma barra (recalcular várias vezes na
 *  mesma barra vira cache hit, sem nova chamada de rede à conta compartilhada). */
function barFlooredNow(timeframe: Timeframe): number {
  const ms = MS_PER_BAR[timeframe];
  return Math.floor(Date.now() / ms) * ms;
}

async function fetchCandles(symbol: string, timeframe: Timeframe): Promise<CandleData[]> {
  const end = barFlooredNow(timeframe);
  // Ativos não-cripto têm gaps (fim de semana, pausa diária) — janela de
  // calendário precisa ser bem maior que barras×intervalo pra render candles suficientes.
  const gapFactor = 2.4;
  const start = end - BARS_NEEDED * MS_PER_BAR[timeframe] * gapFactor;
  const res = await backtestDataService.fetchHistoricalData(
    symbol,
    new Date(start),
    new Date(end),
    timeframe,
  );
  return res.candles;
}

// ---------------------------------------------------------------------------
// FATORES
// ---------------------------------------------------------------------------

/** Tendência de UM timeframe: alinhamento das médias + inclinação da SMA200,
 *  com a magnitude modulada pela força (ADX). Retorna -1…+1. */
function trendOfTimeframe(candles: Candle[]): { value: number; ema9: number | null; sma20: number | null; sma200: number | null; adx: number | null; atr: number | null } {
  const close = candles[candles.length - 1].close;
  const ema9 = lastNonNull(calculateEMA(candles, 9));
  const sma20 = lastNonNull(calculateSMA(candles, 20));
  const sma200arr = calculateSMA(candles, 200);
  const sma200 = lastNonNull(sma200arr);
  const adx = lastNonNull(calculateADX(candles, 14));
  const atr = lastNonNull(calculateATR(candles, 14));

  // Alinhamento: cada relação verdadeira soma +1, falsa -1. Faixa [-3, +3].
  let s = 0;
  let comparisons = 0;
  if (ema9 !== null) { s += close > ema9 ? 1 : -1; comparisons++; }
  if (ema9 !== null && sma20 !== null) { s += ema9 > sma20 ? 1 : -1; comparisons++; }
  if (sma20 !== null && sma200 !== null) { s += sma20 > sma200 ? 1 : -1; comparisons++; }
  const alignment = comparisons > 0 ? s / comparisons : 0; // -1…+1

  // Inclinação da SMA200 (direção estrutural), escala-livre via ATR.
  let slopeNorm = 0;
  if (sma200 !== null && atr && atr > 0) {
    const L = 10;
    const prevIdx = sma200arr.length - 1 - L;
    const prev = prevIdx >= 0 ? sma200arr[prevIdx] : null;
    if (prev !== null) {
      slopeNorm = clamp(((sma200 - prev) / (atr * L)) * 2, -1, 1);
    }
  }

  // Força da tendência: ADX<15 quase não conta, ADX>=50 conta cheio.
  const adxStrength = adx !== null ? clamp((adx - 15) / 35, 0, 1) : 0.4;

  const raw = clamp(0.7 * alignment + 0.3 * slopeNorm, -1, 1);
  const value = raw * (0.4 + 0.6 * adxStrength);
  return { value: clamp(value, -1, 1), ema9, sma20, sma200, adx, atr };
}

/**
 * Duração real do candle (mediana dos gaps entre timestamps), em ms — deixa
 * `momentumFactor` saber "que timeframe é esse" sem mudar a assinatura da
 * função (o resto do motor é timeframe-agnóstico por design).
 */
function inferBarDurationMs(candles: Candle[]): number {
  if (candles.length < 3) return 0;
  const sample = candles.slice(-30);
  const diffs: number[] = [];
  for (let i = 1; i < sample.length; i++) diffs.push(sample[i].time - sample[i - 1].time);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || 0;
}

/**
 * Momentum: MÉDIA de RSI, Estocástico e MACD (eixo único — média evita contar
 * 3x). -1…+1. Também retorna `shock`: o retorno do ÚLTIMO candle sozinho
 * (close vs close anterior, normalizado pelo ATR) — só tem PESO quando o
 * candle é longo (1D+).
 *
 * ✅ 2026-07-17: achado ao vivo — USOUSD subindo +3,6% NO DIA (candle diário
 * único) mostrava RSI(14)=49 (neutro), porque RSI/MACD são médias sobre 14+
 * candles e diluem um movimento concentrado num só. Um "choque" separado do
 * candle mais recente resolve isso — MAS validado com MarketScoreValidator
 * (walk-forward real) que aplicar esse choque em TODO timeframe (15m/1h)
 * piora a precisão geral (BTC 1h caiu de 59,5%→52%, 15m de 63%→56%): num
 * candle curto, um "choque" isolado é majoritariamente RUÍDO, não sinal — é
 * exatamente por isso que RSI/MACD são projetados pra suavizar. Em 1D+ é
 * diferente: cada candle já representa um dia inteiro de negociação real
 * (evento macro, notícia, sessão inteira), então o choque É informativo.
 * Fix: relevância do choque escala com a duração do candle — zero em
 * intraday curto (≤1h), cheia em diário+ (≥1d), rampa linear em 4h.
 */
function momentumFactor(candles: Candle[], atr: number | null): { value: number; shock: number; rsi: number | null; stochK: number | null; stochD: number | null; macdHist: number | null } {
  const rsi = lastNonNull(calculateRSI(candles, 14));
  const stoch = calculateStochastic(candles, 14, 3);
  const stochK = lastNonNull(stoch.k);
  const stochD = lastNonNull(stoch.d);
  const macd = calculateMACD(candles);
  const macdHist = lastNonNull(macd.histogram);

  const parts: number[] = [];
  if (rsi !== null) parts.push(clamp((rsi - 50) / 50, -1, 1));
  if (stochK !== null) parts.push(clamp((stochK - 50) / 50, -1, 1));
  if (macdHist !== null && atr && atr > 0) parts.push(clamp(macdHist / (atr * 0.6), -1, 1));

  const value = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;

  const barDurationMs = inferBarDurationMs(candles);
  const ONE_HOUR = 3_600_000, ONE_DAY = 86_400_000;
  const shockRelevance = clamp((barDurationMs - ONE_HOUR) / (ONE_DAY - ONE_HOUR), 0, 1);

  const prevClose = candles.length >= 2 ? candles[candles.length - 2].close : null;
  const lastClose = candles[candles.length - 1].close;
  let shock = 0;
  if (prevClose !== null && atr && atr > 0 && shockRelevance > 0) {
    shock = clamp(((lastClose - prevClose) / atr) / 0.8, -1, 1) * shockRelevance;
  }

  return { value: clamp(value, -1, 1), shock, rsi, stochK, stochD, macdHist };
}

/**
 * Estrutura / Fibonacci: posição do preço no swing recente. -1 (topo/caro) …
 * +1 (fundo/barato).
 *
 * ✅ 2026-07-17: achado ao vivo — UKOUSD (petróleo) rompeu o topo recente de
 * verdade (guerra, alta forte), mas o motor não reconhecia o rompimento
 * porque `candles.slice(-60)` pegava os últimos 60 CANDLES, não os últimos
 * 60 DIAS. A série tinha um buraco de 18 dias sem candle nenhum (rate-limit
 * crônico da conta MetaAPI compartilhada, documentado à exaustão neste
 * projeto) — a janela "esticava" silenciosamente até 4 meses atrás pra
 * completar 60 candles, pegando um pico velho e desconectado (119 vs preço
 * atual ~88) como se fosse o "topo recente". Fix: janela por TEMPO real
 * (mesma técnica de `inferBarDurationMs` já usada em momentumFactor), não
 * por contagem de candle — resiliente a buracos de dado.
 */
function structureFactor(candles: Candle[]): { value: number; fibPosition: number | null; fibNearestLevel: number | null } {
  const barDurationMs = inferBarDurationMs(candles);
  const windowMs = barDurationMs > 0 ? barDurationMs * FIB_SWING_LOOKBACK : Infinity;
  const cutoff = candles.length > 0 ? candles[candles.length - 1].time - windowMs : 0;
  const window = candles.filter(c => c.time >= cutoff);
  if (window.length < 10) return { value: 0, fibPosition: null, fibNearestLevel: null };

  const swingHigh = Math.max(...window.map(c => c.high));
  const swingLow = Math.min(...window.map(c => c.low));
  const range = swingHigh - swingLow;
  if (range <= 0) return { value: 0, fibPosition: null, fibNearestLevel: null };

  const price = candles[candles.length - 1].close;
  const pos = clamp((price - swingLow) / range, 0, 1); // 0 = fundo, 1 = topo

  // Barato (perto do fundo) = viés de compra (+); caro (perto do topo) = viés de venda (-).
  // A resolução de conflito com a tendência é feita no agregador (regime) e na confiança.
  const value = clamp((0.5 - pos) * 2, -1, 1);

  const fibNearestLevel = FIB_LEVELS.reduce((best, lvl) =>
    Math.abs(lvl - pos) < Math.abs(best - pos) ? lvl : best, FIB_LEVELS[0]);

  return { value, fibPosition: pos, fibNearestLevel };
}

/** Volume / Fluxo: inclinação do OBV (direção de acumulação) escalada pela força do volume. -1…+1. */
function volumeFactor(candles: Candle[]): { value: number; volumeRatio: number | null } {
  const vols = candles.map(c => c.volume);
  const last = vols[vols.length - 1];
  const recent = vols.slice(-20);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const volumeRatio = avg > 0 ? last / avg : null;

  const obv = calculateOBV(candles);
  const obvLast = lastNonNull(obv);
  const L = 10;
  const obvPrev = obv.length > L ? obv[obv.length - 1 - L] : null;

  let obvSlopeNorm = 0;
  if (obvLast !== null && obvPrev !== null) {
    const denom = Math.max(Math.abs(obvLast), Math.abs(obvPrev), 1);
    obvSlopeNorm = clamp((obvLast - obvPrev) / denom, -1, 1);
  }

  // Volume alto amplifica a confirmação; volume fraco encolhe.
  const volMultiplier = volumeRatio !== null ? clamp(volumeRatio / 1.5, 0.3, 1.2) : 0.6;
  const value = clamp(obvSlopeNorm * volMultiplier, -1, 1);
  return { value, volumeRatio };
}

function detectRegime(adx: number | null, bbWidth: number | null): MarketRegime {
  if (adx === null) return 'INDEFINIDO';
  if (adx > 25) return 'TENDENCIA';
  if (adx < 18) return 'LATERAL';
  return 'INDEFINIDO';
}

function buildInsight(
  classification: ScoreClassification,
  regime: MarketRegime,
  ind: MarketScoreIndicators,
): string {
  const regimeTxt = regime === 'TENDENCIA' ? 'mercado em tendência' : regime === 'LATERAL' ? 'mercado lateralizado' : 'regime indefinido';
  const rsiTxt = ind.rsi !== null ? `RSI ${ind.rsi.toFixed(0)}` : 'RSI n/d';
  const adxTxt = ind.adx !== null ? `ADX ${ind.adx.toFixed(0)}` : '';
  const fibTxt = ind.fibPosition !== null
    ? `preço em ${(ind.fibPosition * 100).toFixed(0)}% do range (Fib ${ind.fibNearestLevel})`
    : '';
  const parts = [adxTxt, rsiTxt, fibTxt].filter(Boolean).join(' · ');

  if (classification === 'COMPRADOR') {
    return `Pressão compradora em ${regimeTxt}. ${parts}. Volume ${ind.volumeRatio && ind.volumeRatio > 1.2 ? 'acima da média (confirma)' : 'moderado'}.`;
  }
  if (classification === 'VENDEDOR') {
    return `Pressão vendedora em ${regimeTxt}. ${parts}. Volume ${ind.volumeRatio && ind.volumeRatio > 1.2 ? 'acima da média (confirma)' : 'moderado'}.`;
  }
  return `Mercado sem direção definida (${regimeTxt}). ${parts}. Aguardando rompimento.`;
}

// ---------------------------------------------------------------------------
// AGREGAÇÃO PURA (testável isoladamente, sem rede) — usada também pelo validador.
// ---------------------------------------------------------------------------

export interface ScoreComputation {
  score: number;
  classification: ScoreClassification;
  confidence: number;
  regime: MarketRegime;
  factors: MarketScoreFactors;
  indicators: MarketScoreIndicators;
  insight: string;
  provenance: ScoreProvenance;
}

/**
 * Núcleo do cálculo a partir de candles já buscados (user TF + parent TF).
 * Separado de `compute` pra ser chamável pelo validador sem tocar a rede.
 */
export function computeScoreFromCandles(userCandles: Candle[], parentCandles: Candle[]): ScoreComputation {
  const t = trendOfTimeframe(userCandles);
  const parentTrend = parentCandles.length >= 30 ? trendOfTimeframe(parentCandles).value : t.value;
  const trend = clamp(0.6 * t.value + 0.4 * parentTrend, -1, 1);

  const m = momentumFactor(userCandles, t.atr);
  const s = structureFactor(userCandles);
  const v = volumeFactor(userCandles);

  const bb = calculateBollingerBands(userCandles, 20, 2);
  const bbUpper = lastNonNull(bb.upper);
  const bbLower = lastNonNull(bb.lower);
  const bbMiddle = lastNonNull(bb.middle);
  const bbWidth = bbUpper !== null && bbLower !== null && bbMiddle ? (bbUpper - bbLower) / bbMiddle : null;

  const regime = detectRegime(t.adx, bbWidth);

  // Regime modula a interpretação:
  //  - Tendência: momentum acompanha (RSI alto = força, NÃO venda).
  //  - Lateral: tendência pesa menos, osciladores amortecidos.
  //
  // ✅ 2026-07-17: a inversão de sinal em LATERAL (`-m.value*0.6`, tratando
  // RSI/momentum como mean-reversion) foi achada como a causa raiz do Score
  // ficando neutro/errado durante quedas reais e moderadas (ex: S&P caindo
  // ~1% no dia — real, mas sem ADX alto o bastante pra classificar TENDENCIA,
  // já que ADX é um indicador atrasado e não sobe rápido em declínios
  // graduais/"de rastejo"). Reproduzido com candle real do S&P: RSI 39,
  // alinhamento de médias 100% baixista (-1), MACD negativo — mas a inversão
  // transformava esse momentum claramente baixista num contribuinte
  // POSITIVO pro score, arrastando pra "LATERAL/RANGE" mesmo com o mercado
  // caindo de verdade. Validado com MarketScoreValidator (walk-forward, sem
  // look-ahead) ANTES desta mudança: SPX500 15m tinha ZERO edge real (42% de
  // acerto nas leituras de convicção, pior que cara-ou-coroa) e BTC também
  // tinha degradado (1h: 59%, era 70%+ em calibrações anteriores). A
  // inversão continua sendo uma hipótese razoável em mercado GENUINAMENTE de
  // range (osciladores realmente revertem lá), mas o corte de regime por
  // ADX<18 não distingue "lateral de verdade" de "tendência lenta que ainda
  // não fez o ADX subir" — nesses casos, inverter o sinal é sempre errado.
  // Trocado por amortecimento SEM inverter (mesmo tratamento de INDEFINIDO,
  // só mais amortecido) — mantém a direção real do momentum em vez de
  // apostar contra ela.
  // ✅ 2026-07-17: `m.shock` só é != 0 em timeframes 1D+ (ver momentumFactor)
  // — relaxa o amortecimento de LATERAL só quando o candle mais recente é
  // longo o bastante pra um choque nele ser sinal de verdade, não ruído.
  const regimeTrendScale = regime === 'LATERAL' ? Math.max(0.5, Math.abs(m.shock)) : 1.0;
  const oscillatorMomentumEff =
    regime === 'TENDENCIA' ? m.value
    : regime === 'LATERAL' ? m.value * 0.3
    : m.value * 0.4;
  const momentumEff = clamp(oscillatorMomentumEff + m.shock * 0.55, -1, 1);

  // ✅ 2026-07-17: mesmo problema do momentum, achado ao vivo com BTC em alta
  // forte — `structureFactor` lê "perto do topo do swing recente" como
  // caro/vender (mean-reversion), sempre. Isso é correto em mercado LATERAL
  // (onde Fibonacci/suporte-resistência são o sinal primário), mas em
  // TENDÊNCIA forte um swing de curto prazo se refaz a cada novo topo — "perto
  // do topo" é CONTINUAÇÃO, não exaustão. Sem amortecer aqui, a Estrutura
  // brigava contra Tendência+Momentum e arrastava o score pro neutro bem no
  // meio de uma alta real (score 49 com RSI 69 e ADX subindo). Mesma filosofia
  // de regime já aplicada ao momentum.
  // ✅ 2026-07-17: calibrado com o MarketScoreValidator (não é achismo) — 0.3
  // dampenava demais (deixava setups fracos passarem: BTC 1h caiu de 81%→59%
  // de acerto). 0.6 é o ponto de equilíbrio: recall bom (BTC não fica mais
  // preso em "lateral" durante tendência real) sem sacrificar precisão (BTC
  // 1h 70%/82 sinais, BTC 15m 76%/51 sinais — mais amostra que o 0.3 original
  // com qualidade similar ao balanceamento anterior).
  const structureEff =
    regime === 'TENDENCIA' ? s.value * 0.6
    : regime === 'LATERAL' ? s.value
    : s.value * 0.5;

  // Sem expansão artificial de faixa: a validação (2026-07-17) mostrou que
  // forçar o score aos extremos só deixa setups ambíguos entrarem nas faixas de
  // convicção e mata o sinal (a faixa de venda forte acertava ~84% justamente
  // por ser RARA — exigir alinhamento genuíno é o que a torna preditiva). O
  // score fica naturalmente concentrado no meio; a IA opera só nas leituras
  // extremas + alta confiança, que é onde o edge real está.
  const bruto =
    WEIGHTS.trend * trend * regimeTrendScale +
    WEIGHTS.momentum * momentumEff +
    WEIGHTS.structure * structureEff +
    WEIGHTS.volume * v.value;

  const score = clamp(Math.round(50 + bruto * 50), 1, 99);
  // ✅ 2026-07-17: thresholds alinhados com o rótulo visual do Dashboard
  // (MarketScoreBoard.tsx: score>60 = "TENDÊNCIA DE ALTA", score<40 =
  // "TENDÊNCIA DE BAIXA"). Antes eram 65/35 aqui — dois cortes diferentes
  // pro mesmo score, mesmo bug de "duas fontes discordando" já corrigido
  // hoje em outro lugar: rótulo grande dizia "TENDÊNCIA DE ALTA" (score 61,
  // >60) enquanto o texto do insight (gerado a partir de `classification`)
  // dizia "mercado sem direção definida (lateralizado)" (61 < 65) — as duas
  // frases contraditórias na MESMA tela, achado ao vivo com UKOUSD.
  const classification: ScoreClassification = score > 60 ? 'COMPRADOR' : score < 40 ? 'VENDEDOR' : 'LATERAL';

  // Confiança: concordância entre fatores + força da leitura + alinhamento multi-TF + clareza de regime.
  const netDir = Math.sign(bruto) || 1;
  const weighted: Array<[number, number]> = [
    [WEIGHTS.trend, trend * regimeTrendScale],
    [WEIGHTS.momentum, momentumEff],
    [WEIGHTS.structure, structureEff],
    [WEIGHTS.volume, v.value],
  ];
  const agreementScore = weighted.reduce((acc, [w, f]) => acc + w * (Math.sign(f) === netDir ? 1 : -1), 0); // -1…+1
  const multiTFAgree = Math.sign(t.value) === Math.sign(parentTrend) ? 1 : 0;
  const regimeAdj = regime === 'INDEFINIDO' ? -8 : 4;

  let confidence = 40;
  confidence += 30 * agreementScore;
  confidence += 20 * clamp(Math.abs(bruto) * 1.5, 0, 1);
  confidence += 10 * multiTFAgree;
  confidence += regimeAdj;

  const provenance: ScoreProvenance = t.sma200 === null ? 'partial' : 'real';
  if (provenance === 'partial') confidence = Math.min(confidence, 55);
  confidence = clamp(Math.round(confidence), 5, 98);

  const indicators: MarketScoreIndicators = {
    rsi: m.rsi,
    stochK: m.stochK,
    stochD: m.stochD,
    ema9: t.ema9,
    sma20: t.sma20,
    sma200: t.sma200,
    macdHistogram: m.macdHist,
    adx: t.adx,
    atr: t.atr,
    volumeRatio: v.volumeRatio,
    fibPosition: s.fibPosition,
    fibNearestLevel: s.fibNearestLevel,
  };

  return {
    score,
    classification,
    confidence,
    regime,
    factors: { trend, momentum: momentumEff, structure: structureEff, volume: v.value },
    indicators,
    insight: buildInsight(classification, regime, indicators),
    provenance,
  };
}

// ---------------------------------------------------------------------------
// API PÚBLICA (com rede)
// ---------------------------------------------------------------------------

// ✅ 2026-07-17: cache do último resultado REAL (provenance:'real') por
// símbolo+timeframe — sobrevive a falhas transitórias (ex: rate-limit HTTP
// 429 da conta MetaAPI compartilhada, problema crônico já documentado em
// dezenas de sessões deste projeto). Achado ao vivo: quando o motor falhava,
// a UI caía num sistema LEGADO paralelo (`marketSignal`/fórmula antiga em
// MarketScoreBoard.tsx) que sorteava texto aleatório ("Correção agressiva em
// andamento.") sem nenhuma relação com o mercado real — pior que mostrar nada.
// Agora: sucesso grava aqui; falha reaproveita a última leitura real
// conhecida (marcada 'stale', nunca inventa um número novo) em vez de cair
// nesse fallback paralelo.
const lastGoodResults = new Map<string, MarketScoreResult>();
function cacheKey(symbol: string, timeframe: Timeframe): string {
  return `${symbol}_${timeframe}`;
}

export class MarketScoreEngine {
  /**
   * Calcula o Market Score REAL do ativo no timeframe dado.
   * Busca candles reais (user TF + TF-mãe) e roda o núcleo de agregação.
   * Em falha, retorna a última leitura real conhecida (provenance 'stale')
   * se existir, ou 'unavailable' explícito na primeira tentativa da sessão.
   */
  static async compute(symbol: string, timeframe: Timeframe): Promise<MarketScoreResult> {
    const parentTimeframe = PARENT_TF[timeframe];
    const key = cacheKey(symbol, timeframe);

    try {
      const [userCandles, parentCandles] = await Promise.all([
        fetchCandles(symbol, timeframe),
        fetchCandles(symbol, parentTimeframe),
      ]);

      if (!userCandles || userCandles.length < 30) {
        return this.unavailableOrStale(symbol, timeframe, parentTimeframe);
      }

      const core = computeScoreFromCandles(userCandles, parentCandles || []);
      const result: MarketScoreResult = {
        ...core,
        symbol,
        timeframe,
        parentTimeframe,
        timestamp: Date.now(),
      };
      lastGoodResults.set(key, result);
      return result;
    } catch (e: any) {
      // ✅ 2026-07-17: antes só tratava `BacktestDataUnavailableError` e
      // relançava qualquer outro erro (ex: `TypeError: Failed to fetch` de um
      // CORS/bloqueio geográfico no navegador do usuário) — isso propagava pro
      // caller sem nunca resolver a Promise de forma tratável, e a UI ficava
      // travada em "Calculando..." pra sempre, sem avisar nada. Agora qualquer
      // falha de rede/dado vira um resultado explícito 'stale'/'unavailable'
      // (nunca finge dado real, mas também nunca trava mudo).
      return this.unavailableOrStale(symbol, timeframe, parentTimeframe, e?.message);
    }
  }

  /** Reaproveita a última leitura real conhecida (marcada 'stale') se existir; senão, 'unavailable' honesto. */
  private static unavailableOrStale(symbol: string, timeframe: Timeframe, parentTimeframe: Timeframe, reason?: string): MarketScoreResult {
    const cached = lastGoodResults.get(cacheKey(symbol, timeframe));
    if (cached) {
      const ageSec = Math.round((Date.now() - cached.timestamp) / 1000);
      return {
        ...cached,
        provenance: 'stale',
        insight: `${cached.insight} (última leitura real há ${ageSec}s — atualização momentaneamente indisponível${reason ? `: ${reason}` : ''}.)`,
      };
    }
    return this.unavailable(symbol, timeframe, parentTimeframe, reason);
  }

  static unavailable(symbol: string, timeframe: Timeframe, parentTimeframe: Timeframe, reason?: string): MarketScoreResult {
    return {
      score: 50,
      classification: 'LATERAL',
      confidence: 0,
      regime: 'INDEFINIDO',
      factors: { trend: 0, momentum: 0, structure: 0, volume: 0 },
      indicators: {
        rsi: null, stochK: null, stochD: null, ema9: null, sma20: null, sma200: null,
        macdHistogram: null, adx: null, atr: null, volumeRatio: null, fibPosition: null, fibNearestLevel: null,
      },
      insight: reason ? `Sem fonte de dados real disponível no momento (${reason}).` : 'Sem fonte de dados real disponível para este ativo neste momento.',
      provenance: 'unavailable',
      symbol,
      timeframe,
      parentTimeframe,
      timestamp: Date.now(),
    };
  }
}
