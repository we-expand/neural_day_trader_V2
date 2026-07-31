/**
 * CONTEXT GATE — Bloco B do cérebro cognitivo (research/AI_COGNITIVE_SPEC.md).
 * ============================================================================
 * "Foco no contexto, não em sinais" (pedido do Cleber, item 1) — mas
 * construído sobre a base que sobreviveu à medição, não sobre a que falhou.
 *
 * ⚠️ Decisão explícita registrada em 2026-07-31: este gate NÃO usa o Market
 * Score (`MarketScoreEngine.ts`) como insumo. Medido em
 * `research/experiments/2026-07-31-marketscore-baseline/` e testado em
 * holdout em `research/experiments/2026-07-31-btc-holdout/`: hit rate
 * direcional pooled 46,12%, e a única combinação que parecia funcionar
 * (BTCUSDT) não sobreviveu fora de amostra — vazamento de calibração, não
 * edge. Usar esse score aqui repetiria o mesmo erro sob um nome novo.
 *
 * Em vez disso, usa três fontes cruas, cada uma já madura e testada no
 * projeto por outro motivo:
 * 1. **ADX** (`TechnicalIndicators.ts`) — força de tendência vs. lateralização,
 *    indicador cru, não a composição do Score.
 * 2. **BOS/CHoCH** (`smc/marketStructure.ts`) — estrutura de mercado
 *    determinística (topos/fundos + rompimento confirmado por fechamento).
 *    É o subconjunto MECÂNICO da metodologia de Al Brooks/Price Action que o
 *    Cleber pediu (2026-07-31): entra como CONTEXTO/VETO, nunca como gatilho
 *    de entrada — decisão explícita dele, registrada no `AI_COGNITIVE_SPEC.md`
 *    §6. Por isso este gate só pergunta "a estrutura CONTRADIZ o lado
 *    proposto?", nunca "a estrutura MANDA entrar?".
 * 3. **ATR relativo à própria distribuição recente** — não a tabela fixa da
 *    seção 14.3 (que não pode ser extrapolada pra outro ativo), mas a
 *    variação do próprio ATR do ativo/timeframe operado, mesma disciplina já
 *    usada pelo `CostViabilityGate` na integração ao vivo.
 *
 * Honestidade de método, seguindo a mesma convenção do
 * `EconomicCalendarGuard` (Grupo II do `AI_COGNITIVE_SPEC.md`, ainda não
 * implementado): este gate é HEURÍSTICA MECÂNICA, não sinal validado
 * estatisticamente (holdout + DSR). A meta declarada não é "prever
 * direção" — é "reduzir trade que contradiz a leitura de estrutura
 * corrente", uma métrica mais barata e mais honesta de medir depois (contar
 * quantos trades vetados teriam perdido), que ainda não foi medida aqui.
 *
 * Adicional, não substitutivo: este módulo é ligado em `useApexLogic.ts`
 * como um veto A MAIS, ao lado do veto existente baseado em Market Score
 * (que já está em produção). Decidir se o veto do Market Score deve ser
 * removido é uma decisão de produto separada, fora do escopo desta
 * implementação — ver `AI_COGNITIVE_SPEC.md` para o racional completo.
 */

import type { Candle as IndicatorCandle } from '@/app/services/indicators/TechnicalIndicators';
import { calculateADX, calculateATR } from '@/app/services/indicators/TechnicalIndicators';
import { detectSwingPoints, detectStructureEvents } from '@/app/services/smc/marketStructure';
import type { Candle as SmcCandle } from '@/app/services/smc/types';

export type RegimeClassification = 'TRENDING' | 'RANGING' | 'HIGH_VOLATILITY' | 'ILLIQUID_NO_DATA';
export type StructureBias = 'bullish' | 'bearish' | 'neutral';

export interface RegimeContext {
  classification: RegimeClassification;
  structureBias: StructureBias;
  /** Timestamp do último evento BOS/CHoCH que formou o `structureBias`, se houver. */
  structureBiasSince: number | null;
  adx: number | null;
  atrPercentOfPrice: number | null;
  /** ATR atual / mediana do ATR nas últimas `atrLookback` barras — expansão de volatilidade. */
  atrExpansionRatio: number | null;
  reasoning: string;
}

export interface ContextVetoResult extends RegimeContext {
  podeOperar: boolean;
  motivo: string;
}

const ADX_TRENDING_THRESHOLD = 20; // abaixo disso, mercado sem tendência definida (uso clássico do ADX)
const ADX_LOOKBACK = 14;
const ATR_LOOKBACK = 14;
const ATR_EXPANSION_LOOKBACK = 20; // janela pra medir a "distribuição recente" do próprio ATR
const HIGH_VOLATILITY_EXPANSION_RATIO = 2.0; // ATR atual >= 2x a mediana recente
const MIN_CANDLES_REQUIRED = Math.max(ADX_LOOKBACK, ATR_LOOKBACK, ATR_EXPANSION_LOOKBACK) + 10;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function toSmcCandles(candles: IndicatorCandle[]): SmcCandle[] {
  return candles.map(c => ({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}

/**
 * Classifica o regime corrente a partir de candles reais — nunca do Market
 * Score. Recusa-se a classificar (`ILLIQUID_NO_DATA`) quando não há candle
 * suficiente, em vez de fabricar um regime com dado insuficiente.
 */
export function classifyRegime(candles: IndicatorCandle[]): RegimeContext {
  if (candles.length < MIN_CANDLES_REQUIRED) {
    return {
      classification: 'ILLIQUID_NO_DATA', structureBias: 'neutral', structureBiasSince: null,
      adx: null, atrPercentOfPrice: null, atrExpansionRatio: null,
      reasoning: `Candles insuficientes (${candles.length} < ${MIN_CANDLES_REQUIRED}) para classificar regime com confiança — sem dado real suficiente, não fabricado.`,
    };
  }

  const adxSeries = calculateADX(candles, ADX_LOOKBACK);
  const adx = adxSeries[adxSeries.length - 1];

  const atrSeries = calculateATR(candles, ATR_LOOKBACK);
  const currentAtr = atrSeries[atrSeries.length - 1];
  const currentPrice = candles[candles.length - 1].close;
  const atrPercentOfPrice = currentAtr && currentPrice > 0 ? (currentAtr / currentPrice) * 100 : null;

  const recentAtrValues = atrSeries.slice(-ATR_EXPANSION_LOOKBACK).filter((v): v is number => v !== null);
  const atrBaseline = median(recentAtrValues);
  const atrExpansionRatio = currentAtr && atrBaseline > 0 ? Number((currentAtr / atrBaseline).toFixed(3)) : null;

  // Viés de estrutura: último evento BOS/CHoCH confirmado (Brooks-style
  // "always-in direction" — mecânico, sobre fechamento, nunca previsto).
  const smcCandles = toSmcCandles(candles);
  const swings = detectSwingPoints(smcCandles, 2);
  const events = detectStructureEvents(smcCandles, swings);
  const lastEvent = events.length ? events[events.length - 1] : null;
  const structureBias: StructureBias = lastEvent ? lastEvent.direction : 'neutral';
  const structureBiasSince = lastEvent ? lastEvent.time : null;

  let classification: RegimeClassification;
  const reasoningParts: string[] = [];

  if (atrExpansionRatio !== null && atrExpansionRatio >= HIGH_VOLATILITY_EXPANSION_RATIO) {
    classification = 'HIGH_VOLATILITY';
    reasoningParts.push(`ATR atual ${atrExpansionRatio}x a mediana das últimas ${ATR_EXPANSION_LOOKBACK} barras (limiar ${HIGH_VOLATILITY_EXPANSION_RATIO}x)`);
  } else if (adx !== null && adx < ADX_TRENDING_THRESHOLD) {
    classification = 'RANGING';
    reasoningParts.push(`ADX ${adx.toFixed(1)} < ${ADX_TRENDING_THRESHOLD} — sem tendência definida (uso clássico do indicador)`);
  } else {
    classification = 'TRENDING';
    reasoningParts.push(adx !== null ? `ADX ${adx.toFixed(1)} >= ${ADX_TRENDING_THRESHOLD}` : 'ADX indisponível, default TRENDING sem confirmação extra');
  }
  reasoningParts.push(`viés de estrutura (BOS/CHoCH): ${structureBias}${lastEvent ? ` desde ${new Date(lastEvent.time).toISOString()}` : ' (nenhum rompimento confirmado na janela)'}`);

  return {
    classification, structureBias, structureBiasSince,
    adx: adx !== null ? Number(adx.toFixed(2)) : null,
    atrPercentOfPrice: atrPercentOfPrice !== null ? Number(atrPercentOfPrice.toFixed(4)) : null,
    atrExpansionRatio,
    reasoning: reasoningParts.join('; '),
  };
}

/**
 * Veto de contexto: aprova ou recusa o LADO proposto (LONG/SHORT) contra o
 * regime corrente. Nunca decide entrar — só decide se HÁ razão estrutural
 * pra recusar. `RANGING` sem viés de estrutura claro e `ILLIQUID_NO_DATA`
 * recusam por padrão (conservador); `HIGH_VOLATILITY` recusa (a ação de
 * REAGIR à vol extrema — reduzir tamanho, fechar posição — é o Bloco E, não
 * este); estrutura contrária ao lado proposto sempre recusa.
 */
export function evaluateContextGate(candles: IndicatorCandle[], proposedSide: 'LONG' | 'SHORT'): ContextVetoResult {
  const regime = classifyRegime(candles);

  if (regime.classification === 'ILLIQUID_NO_DATA') {
    return { ...regime, podeOperar: false, motivo: regime.reasoning };
  }

  if (regime.classification === 'HIGH_VOLATILITY') {
    return { ...regime, podeOperar: false, motivo: `Regime HIGH_VOLATILITY — expansão de ATR fora do padrão recente. ${regime.reasoning}` };
  }

  const proposedBias: StructureBias = proposedSide === 'LONG' ? 'bullish' : 'bearish';
  const opposedBias: StructureBias = proposedSide === 'LONG' ? 'bearish' : 'bullish';
  if (regime.structureBias === opposedBias) {
    return { ...regime, podeOperar: false, motivo: `Estrutura de mercado (BOS/CHoCH) contradiz o lado ${proposedSide}: viés corrente é ${regime.structureBias}. ${regime.reasoning}` };
  }

  if (regime.classification === 'RANGING' && regime.structureBias === 'neutral') {
    return { ...regime, podeOperar: false, motivo: `Regime RANGING sem viés de estrutura definido — sem confirmação suficiente pra operar ${proposedSide}. ${regime.reasoning}` };
  }

  return { ...regime, podeOperar: true, motivo: `Contexto aprova ${proposedSide}: ${regime.reasoning}` };
}
