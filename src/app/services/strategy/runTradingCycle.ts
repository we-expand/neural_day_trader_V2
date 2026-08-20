// Módulo puro do ciclo de trading — extraído do `useEffect`/`setInterval` de
// `useApexLogic.ts` (ver NEXT_SESSION.md, passo 2 do plano do runner,
// 2026-08-07). Sem React, sem `setState`: devolve efeitos em vez de
// aplicá-los, pra ser importável tanto pelo hook (driver browser) quanto
// pelo runner Deno (driver servidor) — "um motor, dois drivers", nunca cópia
// (foi a cópia divergente de `pointValue`, corrigida em 2026-08-05, que
// motivou essa regra).
//
// Rede de proteção obrigatória antes/depois de qualquer mudança aqui:
// `npm run validate` verde + equivalência de `stage_counts` (telemetria de
// funil já existente) pro mesmo estado de entrada.

import type { Strategy as StrategyDef } from '@/app/types/strategy.ts';
import { evaluateStrategyScoreBothSides } from '@/app/services/strategy/StrategyEvaluator.ts';
import { ASSETS_REFRESHED_PER_TICK } from '@/app/config/defaultBasket.ts';
import { calculateRSI, calculateATR, calculateMACD } from '@/app/services/indicators/TechnicalIndicators.ts';
import type { Candle } from '@/app/services/indicators/TechnicalIndicators.ts';
import { backtestDataService } from '@/app/services/BacktestDataService.ts';
import { MarketScoreEngine, type MarketRegime } from '@/app/services/MarketScoreEngine.ts';
import type { Timeframe as ScoreTimeframe } from '@/app/services/BacktestDataService.ts';
import { getPointValue, clampToMarginAffordability, MAX_MARGIN_UTILIZATION_PERCENT } from '@/app/services/strategy/TradeSizing.ts';
import { resolveCostAssetClass } from '@/app/services/risk/CostAssetClass.ts';
import { getAssetBySymbol } from '@/app/config/assetDatabase.ts';
import { floorToLotStep } from '@/app/modules/tradeConfirmationStage/lotSizeConversion.ts';
import { evaluateCostViability } from '@/app/services/risk/CostViabilityGate.ts';
import { forceCloseAllLivePositions } from '@/app/services/risk/LiveEmergencyClose.ts';
import { detectRevengePattern } from '@/app/services/risk/RevengeTradingDetector.ts';
import { evaluateContextGate } from '@/app/services/risk/ContextGate.ts';
import { evaluateTailRisk } from '@/app/services/risk/TailRiskGuard.ts';
import { estimateCostPercent } from '../../../../research/CostModel.ts';
import { RiskManager, type RiskConfig, type DailyStats, evaluateCooldownGate, evaluateMaxTradesPerDayGate } from '../../../lib/modules/RiskManager.ts';
import { computeLiveCorrelationGuard } from '@/app/services/risk/LiveCorrelationGuard.ts';
import { funnelTelemetry } from '@/app/services/telemetry/FunnelTelemetry.ts';
// Tipos neutros de propósito (sem nenhum import) — ver comentário no topo de
// src/app/types/tradingState.ts. Import de @/app/hooks/useApexLogic aqui
// quebrava a costura Deno: mesmo sendo `import type`, o resolvedor de
// módulos ainda precisa carregar o grafo de useApexLogic.ts (react, sonner,
// motion/react via PyramidingConfigPanel), impedindo o runner de rodar.
import type { TradeVisual, AIConfig, PortfolioState } from '@/app/types/tradingState.ts';

/**
 * Normaliza o timeframe operacional escolhido na UI (aiConfig.timeframe, ex:
 * '1H'/'4H') pro tipo que o MarketScoreEngine/BacktestDataService esperam
 * (minúsculo). Sem isso, o Score seria calculado sempre no timeframe errado
 * (ou falharia silenciosamente) sempre que o usuário escolhesse 1H/4H.
 */
export function normalizeAiTimeframe(tf: string | undefined): ScoreTimeframe {
  const valid: ScoreTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const lower = (tf || '5m').toLowerCase() as ScoreTimeframe;
  return valid.includes(lower) ? lower : '5m';
}

// 🔒 RESPEITAR CONFIG DO USUÁRIO: riskProfile. Cobre tanto os valores
// oficiais de RiskProfileType (NeuralRiskGuardian.ts) quanto os legados já em
// uso na UI (EQUILIBRADO/DEGEN, ver MarketScore.tsx e o default de
// INITIAL_STATE), pra não quebrar configs já salvas no localStorage de quem
// já usa o app.
export const RISK_PROFILE_ADJUSTMENTS: Record<string, { confidenceAdjust: number; sizeMultiplier: number }> = {
  CONSERVATIVE: { confidenceAdjust: 15, sizeMultiplier: 0.7 },
  MODERATE: { confidenceAdjust: 0, sizeMultiplier: 1.0 },
  EQUILIBRADO: { confidenceAdjust: 0, sizeMultiplier: 1.0 }, // legado, equivalente a MODERATE
  AGGRESSIVE: { confidenceAdjust: -10, sizeMultiplier: 1.3 },
  DEGEN: { confidenceAdjust: -10, sizeMultiplier: 1.3 }, // legado, equivalente a AGGRESSIVE
  INSTITUTIONAL: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
  INSTITUTIONAL_SMC: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
};
export const DEFAULT_RISK_ADJUSTMENT = { confidenceAdjust: 0, sizeMultiplier: 1.0 };

// Grupos de correlação estáticos (heurística, não é correlação de retornos
// calculada ao vivo — ver research/RISK_MODULE_SPEC.md seção 3.5 para o
// plano de evoluir isso pra correlação real).
const CORRELATION_GROUPS: Record<string, string> = {
  EURUSD: 'USD_MAJORS', GBPUSD: 'USD_MAJORS', AUDUSD: 'USD_MAJORS', NZDUSD: 'USD_MAJORS',
  USDJPY: 'USD_JPY_CHF', USDCHF: 'USD_JPY_CHF', USDCAD: 'USD_JPY_CHF',
  XAUUSD: 'METALS', XAGUSD: 'METALS', XPTUSD: 'METALS', XPDUSD: 'METALS',
  BTCUSD: 'CRYPTO_MAJOR', XBNUSD: 'CRYPTO_MAJOR', XETUSD: 'CRYPTO_MAJOR', XLCUSD: 'CRYPTO_MAJOR',
  SPX500: 'US_INDICES', NAS100: 'US_INDICES', US30: 'US_INDICES', US2000: 'US_INDICES',
  GER40: 'EU_INDICES', FRA40: 'EU_INDICES', UK100: 'EU_INDICES', ESP35: 'EU_INDICES',
};
export function getCorrelationGroup(symbol: string): string | null {
  return CORRELATION_GROUPS[symbol] || null;
}

// === EFEITOS ===
// Tudo que dependeria de React (`setState`) ou é puramente apresentacional
// (toast) vira um efeito descrito aqui, pra quem chama aplicar. Persistência
// (`saveDecision`/`onTradeOpen`), telemetria de funil e chamadas de rede
// (preço, Market Score, candles, fechamento de emergência na corretora) são
// serviços já genéricos — chamados direto, iguais nos dois drivers.
export type TradingCycleEffect =
  | { type: 'ADD_ORDER'; trade: TradeVisual }
  | { type: 'CLOSE_ALL_ORDERS' }
  | { type: 'SET_ACTIVE'; value: boolean }
  | { type: 'SET_SAFE_MODE'; value: boolean; reason?: string }
  | { type: 'LOG'; message: string }
  | { type: 'TOAST_SUCCESS'; title: string; description?: string; duration?: number }
  | { type: 'TOAST_WARNING'; title: string; description?: string; duration?: number }
  | { type: 'TOAST_ERROR'; title: string; description?: string; duration?: number };

export interface TradingCycleState {
  activeOrders: TradeVisual[];
  aiConfig: AIConfig;
  portfolio: PortfolioState;
  orderHistory: TradeVisual[];
  lastTradeTimestamp: number;
  lastTradedSymbol: string | null;
  cooldownUntil: number;
  lastStaleDataWarningAt: number;
  cachedNewsEvents: Array<{ time: number; impact: string; currency: string }>;
  cachedVIX: number;
}

export interface TradingCyclePersistence {
  saveDecision: (decision: {
    symbol: string;
    decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
    confidence: number;
    reasoning: string;
    marketScore?: number;
    technicalSignals?: any;
    riskAssessment?: any;
    actionTaken: boolean;
    vetoStage?: string;
    tradeId?: string;
  }) => void | Promise<void>;
  onTradeOpen: (trade: {
    id: string; symbol: string; side: 'LONG' | 'SHORT'; amount: number; price: number;
    tp: number; sl: number; leverage: number; ai_confidence: number; timestamp: number;
    reasoning: string; indicators: TradeVisual['indicators'];
  }) => Promise<void>;
}

export interface TradingCycleDeps {
  strategies: StrategyDef[];
  executionMode: 'DEMO' | 'LIVE';
  telemetrySessionId: string | null;
  userId?: string;
  candleBuffer: Map<string, { candles: Candle[]; fetchedAt: number }>;
  persistence: TradingCyclePersistence;
  onLiveDecision?: (trade: TradeVisual) => void;
  fetchNewsCached: () => Promise<Array<{ time: number; impact: string; currency: string }>>;
  fetchVIXCached: () => Promise<number>;
  /**
   * Efeito disparado DEPOIS que a função já retornou (ex: resultado de
   * `forceCloseAllLivePositions()`, que o código original nunca aguardava —
   * era fire-and-forget via `.then()`). Sem isso o log/toast de confirmação
   * (ou falha) do fechamento na corretora se perderia na extração.
   */
  applyEffect: (effect: TradingCycleEffect) => void;
  /** Preço via WebSocket já conectado (browser), quando disponível — driver servidor simplesmente não fornece isso e cai direto pro REST. */
  getWsPrice?: (symbol: string) => { price: number; changePercent24h: number; change24h: number; volume: number; timestamp: number } | null;
}

export interface TradingCycleResult {
  effects: TradingCycleEffect[];
  nextLastTradeTimestamp: number;
  nextLastTradedSymbol: string | null;
  nextCooldownUntil: number;
  nextLastStaleDataWarningAt: number;
}

const NEWS_WINDOW_MS = 15 * 60 * 1000;

// Stop = 1,5×ATR(14) do timeframe operado; alvo = 2,5× o stop (R:R fixo).
// Ver bloco "STOP/ALVO DINÂMICO POR ATR" no histórico de 2026-08-17.
// Exportadas (não só `const` interna) porque a UI de configuração precisa da
// MESMA aritmética pra mostrar uma prévia de "esse tamanho de posição vai dar
// certo?" antes do usuário salvar — replicar esses números por fora já foi a
// causa de um bug real neste projeto (pointValue divergente, 2026-08-05).
export const STOP_ATR_MULTIPLIER = 1.5;
export const RISK_REWARD_MULTIPLE = 2.5;
/** Nocional mínimo executável — abaixo disso o motor pula o trade (ver `MIN_TRADE_SIZE` mais abaixo). */
export const MIN_EXECUTABLE_NOTIONAL_USD = 10;

/**
 * Distâncias de stop e alvo, em PONTOS, a partir do ATR.
 *
 * Fonte ÚNICA desse cálculo de propósito: o gate de custo (que precisa saber a
 * distância até o alvo pra medir viabilidade) e o cálculo final de TP/SL usam
 * exatamente esta função. Duas cópias da mesma aritmética divergindo já foi um
 * bug real neste projeto — a tabela de `pointValue` duplicada em
 * `useApexLogic`, corrigida em 2026-08-05.
 */
export function resolveAtrTargets(
  atrValue: number,
  pointValue: number,
  marketMode: AIConfig['marketMode'],
): { stopPoints: number; targetPoints: number } {
  let stopPoints = (atrValue * STOP_ATR_MULTIPLIER) / pointValue;
  let targetPoints = stopPoints * RISK_REWARD_MULTIPLE;
  if (marketMode === 'SCALP') {
    targetPoints = Math.min(targetPoints, 80);
    stopPoints = Math.min(stopPoints, 35);
  }
  return { stopPoints, targetPoints };
}

export async function runTradingCycle(
  state: TradingCycleState,
  deps: TradingCycleDeps,
): Promise<TradingCycleResult> {
  const { activeOrders, aiConfig } = state;
  const effects: TradingCycleEffect[] = [];
  let nextLastTradeTimestamp = state.lastTradeTimestamp;
  let nextLastTradedSymbol = state.lastTradedSymbol;
  let nextCooldownUntil = state.cooldownUntil;
  let nextLastStaleDataWarningAt = state.lastStaleDataWarningAt;

  console.log(`[AI LOOP] 🔄 Verificando oportunidades... (Posições: ${activeOrders.length}/${aiConfig.maxPositions})`);

  // 📊 Telemetria de funil (Fase 0, 2026-08-04): marca que o tick realmente
  // disparou. É esta contagem que distingue "IA parada porque a aba está em
  // segundo plano" de "IA rodando e sendo vetada" — em 2026-08-04 essa
  // pergunta ficou 4h40 sem resposta possível.
  if (deps.telemetrySessionId && deps.userId) {
    funnelTelemetry.start(deps.telemetrySessionId, deps.userId);
  }
  funnelTelemetry.recordTick();

  if (activeOrders.length >= aiConfig.maxPositions) {
    console.log(`[AI LOOP] ⏸️ Máximo de posições atingido (${aiConfig.maxPositions})`);
    funnelTelemetry.recordStage('TICK_MAX_POSITIONS');
    return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
  }

  // 🔒 Gate de notícias: pula o ciclo se houver evento de alto impacto na janela de ±15min.
  if (aiConfig.newsFilter) {
    deps.fetchNewsCached(); // fire-and-forget: mantém o cache do chamador atualizado pros próximos ciclos
    const nowTs = Date.now();
    const highImpactNearby = state.cachedNewsEvents.some(e => e.impact === 'high' && Math.abs(e.time - nowTs) <= NEWS_WINDOW_MS);
    if (highImpactNearby) {
      console.log('[NEWS FILTER] 🚫 Evento de alto impacto próximo - pulando ciclo');
      funnelTelemetry.recordStage('TICK_NEWS_BLACKOUT');
      return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
    }
  }

  // 🔄 Mantém o cache de VIX aquecido (fire-and-forget, respeita o próprio
  // throttle interno de 60s) — é dele que o Bloco E (TailRiskGuard) lê de
  // forma síncrona mais adiante no ciclo, via `state.cachedVIX`.
  deps.fetchVIXCached();

  // ✅ COOLDOWN: Tempo mínimo entre trades
  const timeSinceLastTrade = Date.now() - state.lastTradeTimestamp;
  const COOLDOWN_AGGRESSIVE = 2 * 1000;   // 2s — só com opt-in explícito do usuário
  const COOLDOWN_NORMAL = 5 * 1000;       // 5s — padrão
  const COOLDOWN_MS = aiConfig.aggressiveModeEnabled ? COOLDOWN_AGGRESSIVE : COOLDOWN_NORMAL;

  if (timeSinceLastTrade < COOLDOWN_MS && state.lastTradeTimestamp > 0) {
    const remainingSeconds = Math.floor((COOLDOWN_MS - timeSinceLastTrade) / 1000);
    console.log(`[COOLDOWN] ⏳ Aguardando ${remainingSeconds}s antes do próximo trade`);
    funnelTelemetry.recordStage('TICK_COOLDOWN');
    return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
  }

  console.log(`[AI LOOP] ✅ Cooldown OK - Analisando mercado...`);

  // === ASSET SELECTION WITH PRIORITY SYSTEM ===
  const userAssets = aiConfig.activeAssets || [];
  if (userAssets.length === 0) {
    console.log(`[AI LOOP] 🚫 Nenhum ativo selecionado em "Universo de Ativos" - pulando ciclo`);
    funnelTelemetry.recordStage('TICK_NO_ASSETS_CONFIGURED');
    return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
  }

  const universe: string[] = [];
  for (const symbol of userAssets) {
    if (!getAssetBySymbol(symbol)) {
      console.warn(`[AI LOOP] ⚠️ Ativo "${symbol}" selecionado mas não encontrado no catálogo (assetDatabase.ts) — ignorado neste ciclo`);
      continue;
    }
    universe.push(symbol);
  }

  if (universe.length === 0) {
    console.log(`[AI LOOP] 🚫 Nenhum ativo selecionado pelo usuário foi reconhecido no catálogo (config: ${userAssets.join(', ')}) - pulando ciclo`);
    funnelTelemetry.recordStage('TICK_NO_ASSET_IN_CATALOG', undefined, userAssets.join(', '));
    return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
  }

  const activeStrategy = deps.strategies.find(s => s.id === aiConfig.activeStrategyId);
  if (!activeStrategy) {
    console.log(`[ESTRATÉGIA] 🚫 Nenhuma estratégia ativa selecionada - pulando ciclo`);
    funnelTelemetry.recordStage('NO_ACTIVE_STRATEGY');
    return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
  }

  const opTimeframe = normalizeAiTimeframe(aiConfig.timeframe);

  // === FASE 1: REFRESH ESCALONADO DE CANDLES ===
  // Atualiza só um punhado de ativos por tick, os de cache mais velho primeiro
  // (round-robin natural). O ranking abaixo roda sobre a cesta INTEIRA que
  // tiver cache — separar "atualizar dado" de "decidir" é o que torna uma
  // cesta de dezenas de ativos compatível com o orçamento de chamadas da
  // conta MetaAPI compartilhada. Ver ASSETS_REFRESHED_PER_TICK.
  await refreshCandleBuffers(universe, opTimeframe, state, deps);

  // === FASE 2: RANKING ===
  // Pontua TODA a cesta com cache disponível e ordena por score. Substitui o
  // sorteio por tier (`Math.random()`) que existia até 2026-08-17 — a IA
  // agora escolhe o melhor candidato do momento, que é o comportamento
  // pedido desde o início do projeto.
  const ranked = rankCandidates(universe, activeStrategy, opTimeframe, aiConfig, state, deps);

  if (ranked.length === 0) {
    const best = bestScoreSeen;
    console.log(`[RANKING] ⏸️ Nenhum candidato acima do piso de score (${aiConfig.signalScoreFloor}) — melhor da cesta: ${best.symbol ?? 'n/d'} com ${best.score.toFixed(0)}`);
    funnelTelemetry.recordStage(
      'NO_SIGNAL',
      best.symbol ?? undefined,
      `melhor score ${best.score.toFixed(0)} < piso ${aiConfig.signalScoreFloor} (cesta de ${universe.length})`,
    );
    return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
  }

  console.log(`[RANKING] 🏆 ${ranked.length} candidato(s) acima do piso. Top: ${ranked.slice(0, 3).map(c => `${c.symbol} ${c.side} ${c.score.toFixed(0)}`).join(' | ')}`);

  // === FASE 3: EXECUÇÃO DO MELHOR ELEGÍVEL ===
  // Percorre o ranking em ordem até abrir UMA posição. Um candidato pode ser
  // recusado por regra de carteira (já tem posição no ativo, teto de ativos
  // distintos) ou pelos gates de risco — nesse caso tenta o próximo, em vez
  // de perder o ciclo inteiro como acontecia com o sorteio.
  const MAX_EXECUTION_ATTEMPTS = 5;
  let attempts = 0;

  for (const candidate of ranked) {
    if (attempts >= MAX_EXECUTION_ATTEMPTS) break;

    // 🚫 ANTI-REPETIÇÃO: NÃO pode fazer 2 trades seguidos no mesmo ativo
    if (nextLastTradedSymbol === candidate.symbol) {
      console.log(`[ANTI-REPETIÇÃO] ❌ Bloqueado: Último trade foi em ${candidate.symbol}. Tentando o próximo do ranking...`);
      funnelTelemetry.recordStage('ASSET_ANTI_REPEAT', candidate.symbol);
      continue;
    }

    // 🛡️ ANTI-HEDGING CHECK
    const existingPositionOnAsset = activeOrders.find(order => order.symbol === candidate.symbol);
    if (existingPositionOnAsset) {
      console.log(`[ANTI-HEDGING] ⚠️ Bloqueado: Já existe posição ${existingPositionOnAsset.side} em ${candidate.symbol}`);
      funnelTelemetry.recordStage('ASSET_ALREADY_OPEN', candidate.symbol);
      continue;
    }

    // 🎯 CHECK: número de ativos diferentes simultâneos
    const uniqueAssets = new Set(activeOrders.map(order => order.symbol));
    if (uniqueAssets.size >= aiConfig.maxAssets) {
      console.log(`[ASSET LIMIT] ⚠️ Bloqueado: Máximo de ${aiConfig.maxAssets} ativos diferentes atingido`);
      funnelTelemetry.recordStage('ASSET_MAX_DISTINCT', candidate.symbol);
      break; // limite de carteira, não do candidato — tentar outro não adianta
    }

    attempts++;
    const result = await analyzeAsset(candidate, activeStrategy, opTimeframe, state, deps);
    for (const e of result.effects) effects.push(e);
    if (result.nextLastStaleDataWarningAt !== undefined) {
      nextLastStaleDataWarningAt = result.nextLastStaleDataWarningAt;
    }
    if (result.nextCooldownUntil !== undefined) {
      nextCooldownUntil = result.nextCooldownUntil;
    }
    if (result.tradeOpened) {
      nextLastTradeTimestamp = result.tradeOpened.timestamp;
      nextLastTradedSymbol = candidate.symbol;
      break; // uma entrada por ciclo — o cooldown do topo cuida do ritmo
    }
  }

  return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
}

/** Melhor score visto no último `rankCandidates` — usado só pra telemetria de "por que não entrou". */
let bestScoreSeen: { symbol: string | null; score: number } = { symbol: null, score: 0 };

const BAR_MS: Record<ScoreTimeframe, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

/**
 * TTL do buffer de candles = duração de UMA barra do timeframe operado,
 * limitado a [60s, 1h].
 *
 * Antes era 60s fixo, o que em 15m significava refazer a mesma chamada 15x
 * por barra pra receber exatamente os mesmos candles fechados — desperdício
 * direto do orçamento de chamadas que hoje causa HTTP 429. Um candle FECHADO
 * só muda quando a barra vira; reler antes disso não traz informação nova.
 * O teto de 1h existe pra que 4h/1d não fiquem com dado velho demais caso o
 * processo rode por muitas horas seguidas.
 */
function candleTtlMs(tf: ScoreTimeframe): number {
  return Math.min(Math.max(BAR_MS[tf], 60_000), 3_600_000);
}

/**
 * Backoff por símbolo após falha de fetch (rate-limit ou instabilidade da
 * MetaAPI) — chave `${symbol}_${timeframe}`, valor = timestamp até quando
 * pular esse símbolo no refresh.
 *
 * 2026-08-17: antes, uma falha (HTTP 429/500/504) não gravava nada no
 * `candleBuffer` — o símbolo continuava com `fetchedAt=0` e voltava a ser o
 * primeiro candidato do próximo `refreshCandleBuffers`, todo tick. Medido em
 * produção: 5.942 chamadas de histórico em 35 minutos, boa parte reprovada
 * por 429 e retentada segundos depois, sem nenhuma espera — o padrão exato
 * que mantém um rate-limit sempre estourado. A MetaAPI já devolve
 * `retryAfterMs` quando é limite dela (não sempre — HTTP 429/500/504 "cru" da
 * corretora não vem com esse campo); quando disponível, respeita-se o valor
 * real; senão usa um piso fixo. Módulo-level (não por-invocação) de propósito:
 * se a instância do Edge Function ficar "quente" entre ticks do pg_cron, o
 * backoff sobrevive; se não ficar, o pior caso é voltar ao comportamento
 * anterior (sem persistência entre invocações) — nunca piora.
 */
const symbolBackoffUntil = new Map<string, number>();
const FAILURE_BACKOFF_DEFAULT_MS = 30_000;
const FAILURE_BACKOFF_MAX_MS = 5 * 60_000;

function parseRetryAfterMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/Retry after (\d+)ms/i);
  return match ? Number(match[1]) : null;
}

/**
 * Atualiza o buffer de candles de até `ASSETS_REFRESHED_PER_TICK` ativos por
 * tick, priorizando os de cache mais antigo (e pulando os em backoff por
 * falha recente). Falha de rede em um ativo não derruba o ciclo — só deixa
 * aquele ativo de fora do ranking deste tick.
 */
async function refreshCandleBuffers(
  universe: string[],
  opTimeframe: ScoreTimeframe,
  state: TradingCycleState,
  deps: TradingCycleDeps,
): Promise<void> {
  const now = Date.now();
  const ttl = candleTtlMs(opTimeframe);

  const stale = universe
    .map(symbol => {
      const bufferKey = `${symbol}_${opTimeframe}`;
      const entry = deps.candleBuffer.get(bufferKey);
      return { symbol, bufferKey, fetchedAt: entry?.fetchedAt ?? 0 };
    })
    .filter(x => now - x.fetchedAt > ttl)
    .filter(x => (symbolBackoffUntil.get(x.bufferKey) ?? 0) <= now)
    .sort((a, b) => a.fetchedAt - b.fetchedAt)
    .slice(0, ASSETS_REFRESHED_PER_TICK);

  if (stale.length === 0) return;

  for (const { symbol, bufferKey } of stale) {
    try {
      const REQUIRED_BARS = 100;
      // Janela de calendário larga (4x as barras necessárias, com piso de 48h)
      // porque índices/metais fecham fora do pregão — sem essa folga, parte da
      // janela cai em mercado fechado e o ativo some do ranking por falta de
      // candles. Achado de 2026-08-10/08-16 via symbol_stage_counts.
      const MIN_WINDOW_MS = 48 * 60 * 60 * 1000;
      const end = new Date();
      const windowMs = Math.max(REQUIRED_BARS * 4 * BAR_MS[opTimeframe], MIN_WINDOW_MS);
      const start = new Date(end.getTime() - windowMs);
      const history = await backtestDataService.fetchHistoricalData(symbol, start, end, opTimeframe);
      deps.candleBuffer.set(bufferKey, {
        candles: history.candles.slice(-REQUIRED_BARS),
        fetchedAt: Date.now(),
      });
      symbolBackoffUntil.delete(bufferKey);
    } catch (error) {
      const retryAfterMs = parseRetryAfterMs(error);
      const backoffMs = Math.min(retryAfterMs ?? FAILURE_BACKOFF_DEFAULT_MS, FAILURE_BACKOFF_MAX_MS);
      symbolBackoffUntil.set(bufferKey, Date.now() + backoffMs);
      console.warn(`[CANDLES] ⚠️ Sem candles reais pra ${symbol} (${opTimeframe}) agora — fica fora do ranking neste tick e em backoff por ${(backoffMs / 1000).toFixed(0)}s`, error);
      funnelTelemetry.recordStage('CANDLES_FETCH_FAILED', symbol, `${opTimeframe}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export interface RankedCandidate {
  symbol: string;
  side: 'LONG' | 'SHORT';
  score: number;
  candles: Candle[];
  reasons: string[];
}

/**
 * Pontua toda a cesta com cache disponível e devolve os candidatos acima do
 * piso, do maior score pro menor. Puro: nenhuma chamada de rede aqui — só lê
 * o buffer que a Fase 1 já atualizou.
 */
function rankCandidates(
  universe: string[],
  strategy: StrategyDef,
  opTimeframe: ScoreTimeframe,
  aiConfig: AIConfig,
  state: TradingCycleState,
  deps: TradingCycleDeps,
): RankedCandidate[] {
  const floor = aiConfig.signalScoreFloor ?? 60;
  const candidates: RankedCandidate[] = [];
  bestScoreSeen = { symbol: null, score: 0 };

  for (const symbol of universe) {
    const entry = deps.candleBuffer.get(`${symbol}_${opTimeframe}`);
    if (!entry) continue;

    const candles = entry.candles;
    if (candles.length < 30) {
      funnelTelemetry.recordStage('CANDLES_INSUFFICIENT', symbol, `${candles.length} candles`);
      continue;
    }

    funnelTelemetry.recordEvaluation();

    const scored = evaluateStrategyScoreBothSides(strategy, candles, candles.length - 1);

    if (scored.score > bestScoreSeen.score) {
      bestScoreSeen = { symbol, score: scored.score };
    }

    if (!scored.side || scored.score < floor) continue;

    // 🔒 RESPEITAR CONFIG DO USUÁRIO: direção travada na tela
    if (aiConfig.direction !== 'AUTO' && scored.side !== aiConfig.direction) {
      funnelTelemetry.recordStage('CONFIG_DIRECTION', symbol, `setup ${scored.side}, travado em ${aiConfig.direction}`);
      continue;
    }

    candidates.push({ symbol, side: scored.side, score: scored.score, candles, reasons: scored.reasons });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

interface AssetAnalysisResult {
  effects: TradingCycleEffect[];
  tradeOpened?: { timestamp: number };
  nextLastStaleDataWarningAt?: number;
  nextCooldownUntil?: number;
}

/**
 * Roda os gates de risco e, se todos aprovarem, abre a posição do candidato
 * escolhido pelo ranking.
 *
 * 2026-08-17: deixou de descobrir o sinal por conta própria — o score, o lado
 * e os candles chegam prontos de `rankCandidates`. Isso é o que permite buscar
 * PREÇO só do candidato que vai realmente ser avaliado pra execução, em vez de
 * um preço por ativo sorteado a cada tick (redução direta de chamadas à
 * corretora, que é a origem do HTTP 429).
 */
async function analyzeAsset(
  candidate: RankedCandidate,
  activeStrategy: StrategyDef,
  opTimeframe: ScoreTimeframe,
  state: TradingCycleState,
  deps: TradingCycleDeps,
): Promise<AssetAnalysisResult> {
  const { aiConfig, portfolio, orderHistory, activeOrders } = state;
  const selectedSymbol = candidate.symbol;
  const candles = candidate.candles;
  const side = candidate.side;
  const strategyName = activeStrategy.name;
  const effects: TradingCycleEffect[] = [];
  let nextLastStaleDataWarningAt = state.lastStaleDataWarningAt;
  let nextCooldownUntil = state.cooldownUntil;

  try {
    console.log(`[TRADING] 🔍 Avaliando candidato #1 ${selectedSymbol} ${side} (score ${candidate.score.toFixed(0)})...`);

    let priceData: { price: number; changePercent24h: number; change24h: number; volume: number; source: any; timestamp: number } | null = null;

    // 🚀 WebSocket primeiro (TEMPO REAL), REST como fallback
    const isCrypto = /BTC|ETH|SOL|XRP|BNB|ADA|DOGE|POL|LINK|USDT/i.test(selectedSymbol); // POL = Polygon (rebrandado de MATIC)
    if (isCrypto && deps.getWsPrice) {
      try {
        const wsPrice = deps.getWsPrice(selectedSymbol);
        if (wsPrice) {
          priceData = { ...wsPrice, source: 'WEBSOCKET' as any };
          console.log(`[WebSocket] ⚡ ${selectedSymbol}: Preço em tempo real obtido! (latência ~100ms)`);
        } else {
          console.log(`[WebSocket] ⚠️ Cache vazio ou desconectado, usando REST...`);
        }
      } catch (error) {
        console.warn('[WebSocket] ⚠️ Erro ao acessar WebSocket, usando REST...', error);
      }
    }

    if (!priceData) {
      const { getRealMarketData } = await import('@/app/services/RealMarketDataService.ts');
      const marketData = await getRealMarketData(selectedSymbol);
      priceData = {
        price: marketData.price,
        changePercent24h: marketData.changePercent || 0,
        change24h: marketData.change || 0,
        volume: marketData.volume || 0,
        source: marketData.source as any,
        timestamp: marketData.timestamp,
      };
      console.log(`[REST API] 📡 ${selectedSymbol}: Preço obtido via ${marketData.source} (${marketData.isRealData ? 'real' : 'fallback'})`);

      // 🔒 Nunca decide/abre trade (DEMO ou LIVE) em cima de dado que não é real.
      if (!marketData.isRealData) {
        console.warn(`[TRADING] ⚠️ ${selectedSymbol}: sem dado de mercado real neste ciclo, pulando análise de entrada.`);
        funnelTelemetry.recordStage('DATA_NOT_REAL', selectedSymbol, `fonte=${marketData.source}`);
        const now = Date.now();
        if (now - state.lastStaleDataWarningAt > 60000) {
          nextLastStaleDataWarningAt = now;
          effects.push({
            type: 'TOAST_WARNING',
            title: 'Dados de mercado indisponíveis no momento',
            description: `${selectedSymbol}: sem preço real da corretora agora. Novas entradas ficam pausadas até o dado voltar.`,
            duration: 8000,
          });
        }
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
    }

    if (!priceData) {
      throw new Error('Nenhum dado de preço disponível');
    }

    const currentPrice = priceData.price;
    const priceChangePercent = priceData.changePercent24h;

    console.log(`[TRADING] ✅ ${selectedSymbol}:`, {
      price: currentPrice.toFixed(2),
      change: `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
      source: priceData.source,
    });

    const riskAdjustment = RISK_PROFILE_ADJUSTMENTS[aiConfig.riskProfile] || DEFAULT_RISK_ADJUSTMENT;
    const MIN_CONFIDENCE = 45 + riskAdjustment.confidenceAdjust;

    // Confiança = score do ranking. NÃO é probabilidade calibrada de acerto —
    // é a média dos scores dos blocos de entrada, mesma natureza heurística da
    // confiança que `evaluateStrategyAt` já devolvia (50 + proporção de blocos
    // + nº de filtros). Trocar a fórmula por outra sem medição de acerto real
    // seria trocar uma heurística por outra fingindo precisão.
    let confidenceScore = Math.round(candidate.score);
    const rsiSeries = calculateRSI(candles, 14);
    const rsiValue = rsiSeries[rsiSeries.length - 1] ?? 50;

    if (confidenceScore < MIN_CONFIDENCE) {
      console.log(`[SEGURANÇA] ❌ Confiança abaixo do mínimo do perfil de risco: ${confidenceScore}% < ${MIN_CONFIDENCE}%`);
      funnelTelemetry.recordStage('STRATEGY_CONFIDENCE_LOW', selectedSymbol, `${confidenceScore}% < ${MIN_CONFIDENCE}%`);
      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }

    // 🔒 GATE DO MARKET SCORE — confirmação/veto do sinal da estratégia, nunca
    // decide sozinho. Ver comentário original em useApexLogic.ts (histórico
    // git) pro racional completo de cada ramo.
    const LATERAL_CONFIDENCE_PENALTY = 15;
    let scoreConfidence: number | null = null;
    let computedRegime: MarketRegime | null = null;
    try {
      const scoreResult = await MarketScoreEngine.compute(selectedSymbol, opTimeframe);
      if (scoreResult.provenance !== 'unavailable') {
        computedRegime = scoreResult.regime;
        const expectedClassification = side === 'LONG' ? 'COMPRADOR' : 'VENDEDOR';
        const opposite = side === 'LONG' ? 'VENDEDOR' : 'COMPRADOR';
        if (scoreResult.classification === opposite) {
          const reason = `Setup ${side} descartado: Market Score (${opTimeframe}) classifica ${selectedSymbol} como ${scoreResult.classification} (confiança ${scoreResult.confidence}%) — contradiz a estratégia`;
          console.log(`[SCORE] 🚫 ${reason}`);
          await deps.persistence.saveDecision({
            symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
            reasoning: reason, marketScore: scoreResult.score, technicalSignals: { classification: scoreResult.classification, timeframe: opTimeframe },
            actionTaken: false, vetoStage: 'CONTEXT_SCORE_OPPOSITE',
          });
          return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
        }
        if (scoreResult.classification === 'LATERAL') {
          const requiredConfidence = MIN_CONFIDENCE + LATERAL_CONFIDENCE_PENALTY;
          if (confidenceScore < requiredConfidence) {
            const reason = `Setup ${side} descartado: Market Score (${opTimeframe}) está LATERAL (zona de baixo edge conhecida) e a estratégia só tem ${confidenceScore}% de confiança (exige ${requiredConfidence}% nesse regime)`;
            console.log(`[SCORE] 🚫 ${reason}`);
            await deps.persistence.saveDecision({
              symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
              reasoning: reason, marketScore: scoreResult.score, technicalSignals: { classification: scoreResult.classification, timeframe: opTimeframe, requiredConfidence },
              actionTaken: false, vetoStage: 'CONTEXT_SCORE_LATERAL',
            });
            return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
          }
          console.log(`[SCORE] 🟡 Market Score (${opTimeframe}) LATERAL — estratégia com confiança suficiente (${confidenceScore}% ≥ ${requiredConfidence}%) pra operar mesmo sem confirmação`);
        }
        scoreConfidence = scoreResult.confidence;
        console.log(`[SCORE] ✅ Market Score (${opTimeframe}) confirma/não contradiz: ${scoreResult.classification} (confiança ${scoreResult.confidence}%)${scoreResult.classification === expectedClassification ? ' — concorda' : ' — neutro'}`);
      }
    } catch (error) {
      console.warn(`[SCORE] ⚠️ Falha ao consultar o Market Score pra ${selectedSymbol} (${opTimeframe}) — seguindo só com a confiança da estratégia`, error);
    }
    if (scoreConfidence !== null) {
      confidenceScore = Math.min(confidenceScore, scoreConfidence);
      if (confidenceScore < MIN_CONFIDENCE) {
        const reason = `Confiança combinada (estratégia+Score) abaixo do mínimo: ${confidenceScore}% < ${MIN_CONFIDENCE}%`;
        console.log(`[SEGURANÇA] ❌ ${reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: reason, actionTaken: false, vetoStage: 'CONTEXT_CONFIDENCE',
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
    }

    // A trava de direção do usuário (`aiConfig.direction`) já foi aplicada no
    // ranking — um candidato do lado errado nunca chega até aqui.

    // 🔒 RESPEITAR CONFIG DO USUÁRIO: marketMode (TREND/RANGE/COUNTER/SCALP)
    //
    // 2026-08-17: era bloqueio duro (AND binário) sempre que o regime medido
    // não batia exatamente com o modo travado — inclusive quando o Market
    // Score não tem opinião forte (`INDEFINIDO`, o caso mais comum). Com
    // `marketMode: 'TREND'` sendo o padrão de toda sessão nova, isso vetava
    // quase toda avaliação sempre que o mercado não estava em tendência
    // limpa (medido em produção: 2.526 vetos em 2 sessões de hoje, maior
    // bloqueio do dia). Convertido pro MESMO padrão que a checagem de
    // Market Score LATERAL alguns blocos acima já usa: regime que CONTRADIZ
    // exige confiança extra em vez de vetar sempre; regime `INDEFINIDO` (o
    // Score não sabe dizer) não é motivo pra descartar um sinal que a
    // estratégia já validou — deixa passar com a confiança que já tem.
    const REGIME_MISMATCH_CONFIDENCE_PENALTY = 15;
    if ((aiConfig.marketMode === 'TREND' || aiConfig.marketMode === 'RANGE') && computedRegime !== null) {
      const wantsTrend = aiConfig.marketMode === 'TREND';
      const desiredRegime = wantsTrend ? 'TENDENCIA' : 'LATERAL';
      const regimeMatches = computedRegime === desiredRegime;
      const regimeInconclusive = computedRegime === 'INDEFINIDO';
      if (!regimeMatches && !regimeInconclusive) {
        const requiredConfidence = MIN_CONFIDENCE + REGIME_MISMATCH_CONFIDENCE_PENALTY;
        if (confidenceScore < requiredConfidence) {
          const reason = `Setup ${side} descartado: modo "${aiConfig.marketMode}" prefere regime ${desiredRegime}, mas o Market Score (${opTimeframe}) mede ${computedRegime} agora, e a estratégia só tem ${confidenceScore}% de confiança (exige ${requiredConfidence}% contra o regime)`;
          console.log(`[MARKET MODE] 🚫 ${reason}`);
          await deps.persistence.saveDecision({
            symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
            reasoning: reason, technicalSignals: { regime: computedRegime, marketMode: aiConfig.marketMode, requiredConfidence },
            actionTaken: false, vetoStage: 'MARKET_MODE_REGIME_MISMATCH',
          });
          return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
        }
        console.log(`[MARKET MODE] 🟡 Regime (${computedRegime}) contradiz modo "${aiConfig.marketMode}" — estratégia com confiança suficiente (${confidenceScore}% ≥ ${requiredConfidence}%) pra operar mesmo assim`);
      } else if (regimeInconclusive) {
        console.log(`[MARKET MODE] 🟡 Regime INDEFINIDO (${opTimeframe}) — Market Score sem opinião forte, não bloqueia o sinal da estratégia`);
      }
    } else if (aiConfig.marketMode === 'COUNTER') {
      const COUNTER_RSI_OVERSOLD = 35;
      const COUNTER_RSI_OVERBOUGHT = 65;
      const isValidFade = side === 'LONG' ? rsiValue <= COUNTER_RSI_OVERSOLD : rsiValue >= COUNTER_RSI_OVERBOUGHT;
      if (!isValidFade) {
        const reason = `Setup ${side} descartado: modo "COUNTER" exige RSI(14) em extremo real (LONG<=${COUNTER_RSI_OVERSOLD} ou SHORT>=${COUNTER_RSI_OVERBOUGHT}), RSI atual ${rsiValue.toFixed(1)}`;
        console.log(`[MARKET MODE] 🚫 ${reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: reason, technicalSignals: { rsi: rsiValue, marketMode: aiConfig.marketMode },
          actionTaken: false, vetoStage: 'MARKET_MODE_COUNTER_NO_EXTREME',
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
    }

    // 🔒 GATE DE VIABILIDADE POR CUSTO
    {
      const atrSeriesForCostGate = calculateATR(candles, 14);
      const atrValueForCostGate = atrSeriesForCostGate[atrSeriesForCostGate.length - 1];
      if (!atrValueForCostGate || atrValueForCostGate <= 0) {
        const reason = `Setup ${side} descartado: ATR indisponível pra ${selectedSymbol} agora — sem dado real pra avaliar viabilidade de custo`;
        console.log(`[CUSTO] 🚫 ${reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: reason, actionTaken: false, vetoStage: 'COST_GATE_NO_DATA',
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
      // 🆕 2026-08-17: o denominador do gate passa a ser a DISTÂNCIA ATÉ O
      // ALVO do trade, não o ATR de uma única barra.
      //
      // Por que isso é correção e não afrouxamento: o gate pergunta "o custo
      // devora fração grande demais do movimento que preciso capturar?". O
      // movimento que este trade precisa capturar é o TP — hoje
      // `1,5×ATR × 2,5 = 3,75×ATR` (ver `resolveAtrTargets`), não 1×ATR. Usar
      // 1 barra como denominador media contra um movimento 3,75x menor que o
      // real e inflava a razão custo/movimento pelo mesmo fator, reprovando
      // trades cujo alvo comporta o custo com folga. A calibração de 14.3
      // usava "movimento típico da barra" porque naquele desenho não havia
      // alvo explícito em ATR; agora há, e o número certo é o alvo.
      // Os limiares (7%/12%) não mudam: eles mapeiam RAZÃO, e a razão agora
      // responde à pergunta certa.
      const targets = resolveAtrTargets(atrValueForCostGate, getPointValue(selectedSymbol), aiConfig.marketMode);
      const targetDistancePercent = (targets.targetPoints * getPointValue(selectedSymbol) / currentPrice) * 100;
      const movementPercentForCostGate = targetDistancePercent;
      const atrBarPercent = (atrValueForCostGate / currentPrice) * 100;

      const { assetClass: assetClassForCostGate, source: costClassSource } = resolveCostAssetClass(selectedSymbol);
      if (costClassSource === 'FALLBACK') {
        console.log(`[CUSTO] ⚠️ ${selectedSymbol} sem classe no catálogo nem no SymbolMappingService — usando FOREX_MAJOR como aproximação pro custo`);
      }

      const pointValueForCostGate = getPointValue(selectedSymbol);
      const costPercentForCostGate = estimateCostPercent(assetClassForCostGate, currentPrice, pointValueForCostGate) * 2 * 100;

      const costGateResult = evaluateCostViability(costPercentForCostGate, movementPercentForCostGate);
      if (!costGateResult.approved) {
        const reason = `Setup ${side} descartado em ${selectedSymbol}: ${costGateResult.reason} (custo ${costPercentForCostGate.toFixed(3)}% vs. alvo ${movementPercentForCostGate.toFixed(3)}%, classe ${assetClassForCostGate} via ${costClassSource})`;
        console.log(`[CUSTO] 🚫 ${reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: reason, actionTaken: false, vetoStage: 'COST_GATE',
          riskAssessment: {
            costPercent: costPercentForCostGate,
            movementPercent: movementPercentForCostGate,
            atrBarPercent,
            assetClass: assetClassForCostGate,
            costClassSource,
          },
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
      console.log(`[CUSTO] ✅ Gate de custo aprova ${selectedSymbol}: ${costGateResult.reason}`);
    }

    // 🔒 CONTEXT GATE + TAIL RISK GUARD
    {
      const contextResult = evaluateContextGate(candles, side);
      if (!contextResult.podeOperar) {
        console.log(`[CONTEXTO] 🚫 Setup ${side} descartado em ${selectedSymbol}: ${contextResult.motivo}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: contextResult.motivo, actionTaken: false, vetoStage: 'CONTEXT_GATE',
          technicalSignals: { regime: contextResult.classification, structureBias: contextResult.structureBias, adx: contextResult.adx, atrExpansionRatio: contextResult.atrExpansionRatio },
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
      console.log(`[CONTEXTO] ✅ Context Gate aprova ${selectedSymbol}: ${contextResult.motivo}`);

      const openExposurePercent = portfolio.balance > 0
        ? (activeOrders.reduce((sum, o) => sum + o.amount, 0) / portfolio.balance) * 100
        : 0;
      const currentVix = state.cachedVIX > 0 ? state.cachedVIX : null;
      const tailRisk = evaluateTailRisk({ atrExpansionRatio: contextResult.atrExpansionRatio, vix: currentVix, openExposurePercent });

      if (tailRisk.action === 'EMERGENCY_CLOSE' || tailRisk.action === 'BLOCK_NEW_ENTRIES') {
        console.log(`[CAUDA] 🚨 [${tailRisk.action}, gatilho: ${tailRisk.triggeredBy}] ${tailRisk.reasoning}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: tailRisk.reasoning, actionTaken: false, vetoStage: 'CONTEXT_GATE',
          riskAssessment: { tailRiskAction: tailRisk.action, triggeredBy: tailRisk.triggeredBy, atrExpansionRatio: contextResult.atrExpansionRatio, vix: currentVix, openExposurePercent },
        });
        if (tailRisk.action === 'EMERGENCY_CLOSE') {
          effects.push({ type: 'LOG', message: `🚨 Proteção de cauda: ${tailRisk.reasoning}` });
          effects.push({ type: 'TOAST_ERROR', title: '🚨 Choque de volatilidade detectado', description: tailRisk.reasoning, duration: 10000 });
          if (deps.executionMode === 'LIVE' && activeOrders.length > 0) {
            forceCloseAllLivePositions().then((result) => {
              if (result.closed) {
                deps.applyEffect({ type: 'LOG', message: `🔴 Proteção de cauda: posições LIVE fechadas na corretora (${result.attempts} tentativa(s))` });
              } else {
                deps.applyEffect({ type: 'LOG', message: `🚨 FALHA AO FECHAR POSIÇÕES LIVE (proteção de cauda): ${result.lastError || 'motivo desconhecido'} — intervenção manual necessária` });
                deps.applyEffect({ type: 'TOAST_ERROR', title: '🚨 FALHA AO FECHAR POSIÇÕES LIVE NA CORRETORA', description: `Feche manualmente na corretora. Motivo: ${result.lastError || 'desconhecido'}`, duration: 0 });
              }
            });
          }
        }
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
      if (tailRisk.action === 'REDUCE_SIZE') {
        console.log(`[CAUDA] 🟡 ${tailRisk.reasoning} (multiplicador sugerido ${tailRisk.newPositionSizeMultiplier}x — ainda não aplicado ao sizing)`);
      }
    }

    // 🔒 GATE DE RISCO
    const now = Date.now();
    const riskConfig: RiskConfig = {
      maxDailyLossPercent: aiConfig.dailyLossLimit,
      maxDrawdownPercent: aiConfig.maxDrawdown,
      maxPositionSizePercent: aiConfig.riskPerTrade,
      kellyFraction: 0.25,
      cooldownEnabled: aiConfig.cooldownEnabled,
      cooldownMinutes: aiConfig.cooldownMinutes,
      maxTradesPerDay: aiConfig.maxTradesPerDay,
      killSwitchThreshold: aiConfig.killSwitchThreshold || 0,
    };

    const nowDate = new Date();
    const startOfUtcDay = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
    const tradesToday = orderHistory.filter(t => t.closedAt && t.closedAt >= startOfUtcDay);
    const realizedPnL = tradesToday.reduce((sum, t) => sum + (t.currentProfit || 0), 0);
    const unrealizedPnL = activeOrders.reduce((sum, o) => sum + (o.currentProfit || 0), 0);
    const largestLoss = Math.min(...tradesToday.map(t => t.currentProfit || 0));

    let consecutiveLosses = 0;
    for (const t of [...tradesToday].reverse()) {
      if ((t.currentProfit || 0) < 0) consecutiveLosses++;
      else break;
    }

    const dailyStats: DailyStats = { closedTradesCount: tradesToday.length, realizedPnL, unrealizedPnL, largestLoss, consecutiveLosses };

    const riskManager = new RiskManager(riskConfig);
    const accountState = {
      balance: portfolio.balance,
      initialBalance: portfolio.initialBalance || 100,
      // Precisa ser âncora de BALANCE (realizado), nunca dayAnchorEquity — dayAnchorEquity
      // inclui P&L não-realizado de posições abertas e comparado contra account.balance
      // (realizado puro) no RiskManager, produz "perda diária" falsa sempre que há
      // posição aberta lucrativa (bug confirmado em produção 2026-08-17/18).
      dailyStartBalance: portfolio.dayAnchorBalance || portfolio.initialBalance || 100,
      currentDrawdown: portfolio.currentDrawdown,
      openPositionsCount: activeOrders.length,
    };

    const proposedTradeSize = portfolio.balance * (aiConfig.riskPerTrade / 100);
    const riskCheck = riskManager.validateTrade(accountState, proposedTradeSize, dailyStats);

    // 🚨 Kill-Switch (perda catastrófica)
    const killSwitchCheck = riskManager.shouldActivateKillSwitch(accountState);
    if (killSwitchCheck.triggered) {
      console.error(`[RISCO] 🚨 ${killSwitchCheck.reason}`);
      effects.push({ type: 'LOG', message: `🚨 KILL-SWITCH ATIVADO: ${killSwitchCheck.reason}` });
      await deps.persistence.saveDecision({
        symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
        reasoning: killSwitchCheck.reason || 'Kill-switch ativado', actionTaken: false, vetoStage: 'KILL_SWITCH',
        riskAssessment: { accountState, dailyStats },
      });

      effects.push({ type: 'CLOSE_ALL_ORDERS' });
      console.log('[KILL-SWITCH] 🔴 Fechadas todas as posições abertas (local)');

      effects.push({ type: 'SET_ACTIVE', value: false });
      effects.push({ type: 'SET_SAFE_MODE', value: true, reason: killSwitchCheck.reason || 'Kill-Switch ativado' });
      console.log('[KILL-SWITCH] 🔴 IA PARADA — aguardando intervenção manual');

      effects.push({
        type: 'TOAST_ERROR',
        title: '🚨 KILL-SWITCH ATIVADO',
        description: killSwitchCheck.reason || 'Perda catastrófica detectada. Todas as posições foram fechadas.',
        duration: 0,
      });

      if (deps.executionMode === 'LIVE') {
        forceCloseAllLivePositions().then((result) => {
          if (result.closed) {
            deps.applyEffect({ type: 'LOG', message: `🔴 KILL-SWITCH: posições LIVE fechadas na corretora (${result.attempts} tentativa(s))` });
          } else {
            deps.applyEffect({ type: 'LOG', message: `🚨 FALHA AO FECHAR POSIÇÕES LIVE: ${result.lastError || 'motivo desconhecido'} — intervenção manual necessária` });
            deps.applyEffect({ type: 'TOAST_ERROR', title: '🚨 FALHA AO FECHAR POSIÇÕES LIVE NA CORRETORA', description: `Feche manualmente na corretora. Motivo: ${result.lastError || 'desconhecido'}`, duration: 0 });
          }
        });
      }

      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }

    if (!riskCheck.approved) {
      console.log(`[RISCO] 🚫 ${riskCheck.reason}`);
      await deps.persistence.saveDecision({
        symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
        reasoning: riskCheck.reason || 'Risk gate recusou', actionTaken: false, vetoStage: 'RISK_GATE',
        riskAssessment: { accountState, dailyStats, proposedTradeSize },
      });
      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }

    // Cooldown pós-perdas consecutivas
    {
      const closedTradesDesc = [...orderHistory].filter(t => t.closedAt).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
      let consecutiveLossesForCooldown = 0;
      for (const t of closedTradesDesc) {
        if ((t.currentProfit || 0) < 0) consecutiveLossesForCooldown++;
        else break;
      }

      const cooldownResult = evaluateCooldownGate(consecutiveLossesForCooldown, now, state.cooldownUntil, {
        cooldownEnabled: aiConfig.cooldownEnabled,
        consecutiveLossesTrigger: aiConfig.consecutiveLossesTrigger,
        cooldownMinutes: aiConfig.cooldownMinutes,
      });

      if (cooldownResult.blocked) {
        if (cooldownResult.newCooldownUntil) {
          nextCooldownUntil = cooldownResult.newCooldownUntil;
          effects.push({ type: 'LOG', message: `🧊 Pausa ativada: ${consecutiveLossesForCooldown} perdas seguidas — pausa de ${aiConfig.cooldownMinutes}min` });
        }
        console.log(`[RISCO] 🧊 ${cooldownResult.reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: cooldownResult.reason || 'Cooldown ativo', actionTaken: false, vetoStage: 'COOLDOWN',
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
    }

    // 🔒 DETECTOR DE REVENGE TRADING
    {
      const revengeCheck = detectRevengePattern(
        orderHistory.map(t => ({ amount: t.amount, currentProfit: t.currentProfit, closedAt: t.closedAt, timestamp: t.timestamp })),
        { sizePercent: proposedTradeSize, timestamp: now },
      );
      if (revengeCheck.flagged) {
        console.log(`[REVENGE] ⚠️ [${revengeCheck.severity}] ${revengeCheck.reasoning}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: revengeCheck.reasoning, actionTaken: revengeCheck.severity !== 'FORCE_COOLDOWN', vetoStage: 'REVENGE_PATTERN',
          riskAssessment: { signals: revengeCheck.signals, severity: revengeCheck.severity, baselineSampleSize: revengeCheck.baselineSampleSize },
        });
        if (revengeCheck.severity === 'FORCE_COOLDOWN') {
          nextCooldownUntil = now + aiConfig.cooldownMinutes * 60_000;
          effects.push({ type: 'LOG', message: `🚨 Padrão de revenge trading detectado (${revengeCheck.signals.join(', ')}) — pausa forçada de ${aiConfig.cooldownMinutes}min` });
          effects.push({ type: 'TOAST_ERROR', title: '🚨 Padrão de revenge trading detectado', description: revengeCheck.reasoning, duration: 10000 });
          return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
        }
        effects.push({ type: 'TOAST_WARNING', title: `⚠️ Possível revenge trading (${revengeCheck.severity})`, description: revengeCheck.reasoning, duration: 6000 });
      }
    }

    // Limite rígido de trades/dia
    {
      const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
      const tradesTodayCount = orderHistory.filter(t => (t.closedAt || t.timestamp) >= todayStart.getTime()).length + activeOrders.length;
      const maxTradesResult = evaluateMaxTradesPerDayGate(tradesTodayCount, aiConfig.maxTradesPerDay);
      if (maxTradesResult.blocked) {
        console.log(`[RISCO] 🚫 ${maxTradesResult.reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: maxTradesResult.reason || 'Limite de trades/dia atingido', actionTaken: false, vetoStage: 'MAX_TRADES_PER_DAY',
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
    }

    console.log(`[DECISÃO FINAL] ${side === 'LONG' ? '🟢 COMPRA' : '🔴 VENDA'} | Estratégia: ${strategyName} | Confiança: ${confidenceScore}%`);

    // 🆕 STOP/ALVO DINÂMICO POR ATR (2026-08-17, substitui o sistema de
    // pontos fixos por targetPoints). Pontos fixos (ex.: 120pts) tratavam
    // mercado calmo e agitado do mesmo jeito: em mercado calmo sobra folga
    // (perda maior que o necessário quando erra); em mercado agitado o
    // preço passa do stop por ruído normal, não porque a tese errou — isso
    // corta taxa de acerto sem motivo real. Stop = k × ATR(14) do timeframe
    // operado (mesmo indicador já usado pelo gate de custo acima, candles
    // idênticos — determinístico, não é chamada nova de rede). Alvo é um
    // múltiplo fixo do stop (R:R constante entre ativos e regimes), não
    // mais o dropdown "Poucos/Médio/Muitos": ver NEXT_SESSION.md item 3 —
    // mudar TP/SL não muda o EV sem edge direcional (parada opcional), só
    // muda a forma da distribuição; aqui a forma é escolhida deliberadamente
    // (perde pouco, ganha mais) via R:R > 1, não por promessa de mais lucro.
    const pointValue = getPointValue(selectedSymbol);
    const atrSeriesForStop = calculateATR(candles, 14);
    const atrValueForStop = atrSeriesForStop[atrSeriesForStop.length - 1];

    let targetPointsValue: number;
    let stopLossPointsValue: number;

    if (atrValueForStop && atrValueForStop > 0) {
      // Mesma função que o gate de custo usou pra medir viabilidade — nunca
      // recalcular essa aritmética por fora (ver `resolveAtrTargets`).
      const resolved = resolveAtrTargets(atrValueForStop, pointValue, aiConfig.marketMode);
      stopLossPointsValue = resolved.stopPoints;
      targetPointsValue = resolved.targetPoints;
    } else {
      // Fallback defensivo — na prática inalcançável: o gate de custo acima
      // já bloqueia o trade quando ATR não está disponível pros mesmos
      // candles. Mantido só por segurança, nunca deve disparar em produção.
      console.log(`[TP/SL SETUP] ⚠️ ATR indisponível pra ${selectedSymbol} no cálculo de stop — usando fallback de pontos fixos (não deveria acontecer, gate de custo já validou ATR)`);
      targetPointsValue = 400; stopLossPointsValue = 120;
      if (aiConfig.marketMode === 'SCALP') {
        targetPointsValue = Math.min(targetPointsValue, 80);
        stopLossPointsValue = Math.min(stopLossPointsValue, 35);
      }
    }

    const tpDistance = targetPointsValue * pointValue;
    const slDistance = stopLossPointsValue * pointValue;

    const tp = side === 'LONG' ? currentPrice + tpDistance : currentPrice - tpDistance;
    const sl = side === 'LONG' ? currentPrice - slDistance : currentPrice + slDistance;
    const riskRewardRatio = targetPointsValue / stopLossPointsValue;

    console.log(`[TP/SL SETUP] 🎯 ${selectedSymbol}:`, {
      targetPoints: aiConfig.targetPoints, points: targetPointsValue, pointValue,
      tpDistance: `$${tpDistance.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2)}`,
      slDistance: `$${slDistance.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2)}`,
      riskReward: `1:${riskRewardRatio.toFixed(1)}`,
      entry: currentPrice.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2),
      tp: tp.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2),
      sl: sl.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2),
    });

    // 💰 POSITION SIZING
    const currentBalance = portfolio.balance || 100;
    const allocatedCapital = Math.min(aiConfig.allocatedCapital, currentBalance);
    const riskPercentage = aiConfig.riskPerTrade / 100;
    const fixedRiskCapital = allocatedCapital * riskPercentage * riskAdjustment.sizeMultiplier;
    // 2026-08-16: FIX DE BUG — modo FIXED usava riskCapital diretamente como
    // nocional, ignorando a distância do stop (mesma classe de bug já
    // corrigida em TradeSizing.calculatePositionSize, usada pelo Backtest,
    // em 2026-07-30 — nunca replicada aqui no motor ao vivo). Dois trades com
    // o mesmo riskPerTrade% mas stops de tamanhos diferentes arriscavam
    // quantias em dinheiro muito diferentes. Corrigido: nocional = risco em $
    // / distância do stop em % (fixed-fractional de verdade — Van Tharp).
    const stopDistancePercent = currentPrice > 0 ? slDistance / currentPrice : 0;
    let tradeCapital = stopDistancePercent > 0 ? fixedRiskCapital / stopDistancePercent : fixedRiskCapital;

    // 2026-08-17: FIX DE BUG ESTRUTURAL — a fórmula anterior
    // (`fixedRiskCapital * (slDistance / atrDistance)`) reescalava o risco em
    // dólar por uma RAZÃO ADIMENSIONAL entre duas distâncias em ATR — nunca
    // dividia pelo preço do ativo. Resultado: o nocional calculado ficava
    // sempre na mesma ordem de grandeza do próprio `fixedRiskCapital` (poucos
    // dólares numa conta de $100), pra QUALQUER ativo, QUALQUER
    // `atrMultiplier` razoável — sempre abaixo do piso de $10
    // (`MIN_EXECUTABLE_NOTIONAL_USD`). Era a causa raiz confirmada de sessões
    // inteiras (horas, dias) sem nenhuma entrada, porque "Ajustado por ATR" é
    // o modo padrão de toda sessão nova (`useApexLogic.ts`). Baixar o
    // multiplicador de 4,0x pra 1,5x (2026-08-16) só trocou "sempre $0,56"
    // por "sempre ~$1,50" — mitigou a magnitude sem corrigir a fórmula.
    // Corrigido pra usar o MESMO fixed-fractional (Van Tharp) do modo FIXED
    // acima: nocional = risco em $ / distância do stop em % do preço — só que
    // aqui a "distância do stop" pro tamanho da posição é a escolhida pelo
    // usuário (`atrMultiplier × ATR`), não o stop fixo de 1,5×ATR realmente
    // colocado na corretora (`STOP_ATR_MULTIPLIER`, ver `resolveAtrTargets`).
    if (aiConfig.positionSizingMode === 'ATR') {
      const atrSeries = calculateATR(candles, 14);
      const atrValue = atrSeries[atrSeries.length - 1];
      if (atrValue && atrValue > 0) {
        const atrDistance = atrValue * aiConfig.atrMultiplier;
        const atrDistancePercent = currentPrice > 0 ? atrDistance / currentPrice : 0;
        tradeCapital = atrDistancePercent > 0 ? fixedRiskCapital / atrDistancePercent : fixedRiskCapital;
        console.log(`[POSITION SIZING] 📐 ATR mode: ATR=${atrValue.toFixed(5)} x${aiConfig.atrMultiplier} = ${atrDistance.toFixed(5)} (${(atrDistancePercent * 100).toFixed(3)}% do preço) | capital ajustado: $${tradeCapital.toFixed(2)}`);
      }
    }

    // 🆕 Guard de correlação
    if (aiConfig.correlationGuardEnabled) {
      const priceHistoryBySymbol: Record<string, number[]> = {};
      const relevantSymbols = new Set([selectedSymbol, ...activeOrders.map(o => o.symbol)]);
      for (const sym of relevantSymbols) {
        const entry = deps.candleBuffer.get(`${sym}_${opTimeframe}`);
        if (entry) priceHistoryBySymbol[sym] = entry.candles.map(c => c.close);
      }

      const liveGuard = computeLiveCorrelationGuard(
        selectedSymbol,
        activeOrders.map(o => ({ symbol: o.symbol })),
        priceHistoryBySymbol,
        { thresholdAbs: aiConfig.correlationThreshold, minBars: 30 },
      );

      if (liveGuard.insufficientData.length > 0) {
        const group = getCorrelationGroup(selectedSymbol);
        const hasCorrelatedOpen = group && activeOrders.some(o => o.symbol !== selectedSymbol && getCorrelationGroup(o.symbol) === group);
        if (hasCorrelatedOpen) {
          tradeCapital *= (1 - aiConfig.correlationThreshold * 0.5);
          console.log(`[RISCO] 🔗 Correlação real indisponível para [${liveGuard.insufficientData.join(', ')}] — fallback heurístico por grupo ("${group}"), tamanho reduzido para $${tradeCapital.toFixed(2)}`);
        }
      } else if (liveGuard.blocked) {
        console.log(`[RISCO] 🚫 ${liveGuard.reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: liveGuard.reason || 'Correlação real acima do limiar', actionTaken: false, vetoStage: 'CORRELATION_GUARD',
          riskAssessment: { pairwiseCorrelations: liveGuard.pairwiseCorrelations },
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
    }

    // 2026-08-17: FIX DE BUG — `aiConfig.maxContracts` ("Lotes Máximos por
    // Trade" na tela) nunca era lido aqui. O cálculo de sizing acima (risco%
    // ou ATR) não tem noção de "lote" nenhuma — devolve só um nocional em
    // dólar — então nada impedia esse nocional de corresponder a uma
    // contagem de lotes muito maior que o teto configurado pelo usuário.
    // Achado ao vivo: Solana entrou com ~20 lotes calculados com o config em
    // 0,8 lote máximo — o motor simplesmente não sabia desse limite. Pra
    // ativos caros (índices) o nocional natural já cai num range pequeno de
    // lotes, mascarando o problema; pra ativos baratos e voláteis (cripto
    // alt-coin) o mesmo nocional em dólar vira muito mais "lotes". Fix:
    // reconverte nocional → lotes (mesma fórmula da UI, `MarketScoreBoard.tsx`:
    // nocional / (lotSize do catálogo × preço)) e reduz o nocional se exceder
    // o teto — nunca aumenta (só clipa pra baixo).
    if (aiConfig.maxContracts > 0) {
      const assetForLotCap = getAssetBySymbol(selectedSymbol);
      const lotSize = assetForLotCap?.lotSize || 1;
      const estimatedLots = currentPrice > 0 ? tradeCapital / (lotSize * currentPrice) : 0;
      if (estimatedLots > aiConfig.maxContracts) {
        const cappedCapital = aiConfig.maxContracts * lotSize * currentPrice;
        console.log(`[POSITION SIZING] ✂️ ${selectedSymbol}: ${estimatedLots.toFixed(4)} lotes calculados > teto de ${aiConfig.maxContracts} — nocional reduzido de $${tradeCapital.toFixed(2)} para $${cappedCapital.toFixed(2)}`);
        tradeCapital = cappedCapital;
      }
    }

    // 2026-08-19: GATE DE MARGEM — `leverage` do catálogo nunca entrava no
    // cálculo de tamanho (lotSizeConversion.ts dizia explicitamente "leverage
    // é informativo de UI"). Dois ativos com o MESMO nocional podem exigir
    // margens muito diferentes (catálogo: FOREX_MAJOR 500-1000x vs CRYPTO
    // 5x) — sem isso, o motor podia calcular um nocional que a conta não tem
    // margem livre pra sustentar. Fórmula padrão de mercado (margem =
    // nocional / leverage), pesquisa 2026-08-19 (Alpari/Pepperstone/
    // BlackBull/XTB) — ver SESSAO_2026-08-19_LIMPEZA_POSICOES_ZUMBIS.md.
    // Nunca aumenta o nocional, só reduz (mesma filosofia do teto acima).
    const assetForMargin = getAssetBySymbol(selectedSymbol);
    if (assetForMargin) {
      const marginCheck = clampToMarginAffordability(tradeCapital, assetForMargin.leverage, currentBalance);
      if (marginCheck.clamped) {
        console.log(`[POSITION SIZING] 🏦 ${selectedSymbol}: margem exigida excederia ${(MAX_MARGIN_UTILIZATION_PERCENT * 100).toFixed(0)}% do balance ($${(currentBalance * MAX_MARGIN_UTILIZATION_PERCENT).toFixed(2)}) — nocional reduzido de $${tradeCapital.toFixed(2)} para $${marginCheck.notionalUsd.toFixed(2)} (margem exigida: $${marginCheck.requiredMargin.toFixed(2)}, leverage ${assetForMargin.leverage}x)`);
        tradeCapital = marginCheck.notionalUsd;
      }
    }

    // 2026-08-20: GATE DE LOTE MÍNIMO — nenhum dos gates acima (teto de
    // "Lotes Máximos", margem) impedia o nocional de corresponder a uma
    // FRAÇÃO de lote abaixo do mínimo do ativo (ex: BTC com mínimo real de
    // 0,01 lote virando 0,0021 lote — posição que nenhuma corretora aceitaria
    // de verdade). `openManualPosition` (useApexLogic.ts) já floora/rejeita
    // pra ordens manuais/Pyramiding, mas o motor autônomo cria `TradeVisual`
    // direto, sem passar por lá — mesma classe de gap que o gate de margem
    // (2026-08-19) e o teto de lotes (2026-08-17) já corrigiram para outras
    // dimensões de sizing. Arredonda pra BAIXO (mesma filosofia dos gates
    // acima: nunca aumenta o nocional) e pula o trade se o nocional não
    // alcançar nem 1 lote mínimo.
    if (currentPrice > 0) {
      const assetForMinLot = getAssetBySymbol(selectedSymbol);
      const lotSizeForMinLot = assetForMinLot?.lotSize || 1;
      const rawLots = tradeCapital / (lotSizeForMinLot * currentPrice);
      const lotCheck = floorToLotStep(selectedSymbol, rawLots);
      if (lotCheck.error) {
        const reason = `Nocional calculado ($${tradeCapital.toFixed(2)}) equivale a menos que o lote mínimo de ${selectedSymbol} — pulando trade em vez de abrir posição abaixo do mínimo real do ativo.`;
        console.log(`[POSITION SIZING] ⏭️ ${selectedSymbol}: ${reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: reason, actionTaken: false, vetoStage: 'MIN_TRADE_SIZE',
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
      const flooredCapital = lotCheck.volume * lotSizeForMinLot * currentPrice;
      if (flooredCapital < tradeCapital) {
        console.log(`[POSITION SIZING] 📏 ${selectedSymbol}: nocional ajustado de $${tradeCapital.toFixed(2)} para $${flooredCapital.toFixed(2)} (arredondado pro múltiplo de lote mínimo ${assetForMinLot?.minLot ?? '?'})`);
        tradeCapital = flooredCapital;
      }
    }

    // 2026-08-16: FIX DE BUG — antes, nocional abaixo de $10 era empurrado pra
    // cima (`Math.max(tradeCapital, minTradeCapital)`), inflando o risco real
    // muito além de `aiConfig.riskPerTrade` em contas pequenas (medido em
    // research/experiments/2026-08-16-portfolio-amplitude/results/floor_check_by_profile.md:
    // 24% dos sinais numa conta de $50 com risco 0,5%/trade acionavam o piso).
    // Mesmo fix aplicado em TradeSizing.calculatePositionSize (usado pelo
    // Backtest) — aqui é a cópia usada pelo motor ao vivo. Corrigido: pula o
    // trade em vez de forçar tamanho maior que o risco configurado.
    const minTradeCapital = MIN_EXECUTABLE_NOTIONAL_USD;
    if (tradeCapital < minTradeCapital) {
      const reason = `Nocional calculado ($${tradeCapital.toFixed(2)}) abaixo do mínimo executável ($${minTradeCapital}) — pulando trade em vez de inflar risco além de ${aiConfig.riskPerTrade}% configurado.`;
      console.log(`[POSITION SIZING] ⏭️ ${selectedSymbol}: ${reason}`);
      await deps.persistence.saveDecision({
        symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
        reasoning: reason, actionTaken: false, vetoStage: 'MIN_TRADE_SIZE',
      });
      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }
    const finalTradeCapital = tradeCapital;

    console.log(`[POSITION SIZING] 💰 ${selectedSymbol}:`, {
      currentBalance: `$${currentBalance.toFixed(2)}`,
      allocatedCapital: `$${allocatedCapital.toFixed(2)}`,
      riskPerTrade: `${aiConfig.riskPerTrade}%`,
      riskProfile: `${aiConfig.riskProfile} (x${riskAdjustment.sizeMultiplier})`,
      finalTradeCapital: `$${finalTradeCapital.toFixed(2)}`,
    });

    const newTrade: TradeVisual = {
      id: `trade-${Date.now()}-${Math.random()}`,
      symbol: selectedSymbol,
      side,
      amount: finalTradeCapital,
      price: currentPrice,
      currentPrice,
      tp,
      sl,
      originalSl: sl,
      leverage: 1.5,
      ai_confidence: Math.min(confidenceScore, 95),
      timestamp: Date.now(),
      reasoning: `${strategyName} | ranking: score ${candidate.score.toFixed(0)} (piso ${aiConfig.signalScoreFloor}) - ${targetPointsValue.toFixed(0)}p - R/R 1:${riskRewardRatio.toFixed(1)} - ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
      indicators: {
        rsi: Math.round(rsiValue),
        // 2026-08-20: era `side === 'LONG' ? 'BULLISH' : 'BEARISH'` — rótulo
        // cosmético que só espelhava o lado da entrada já decidida, não uma
        // leitura real do indicador (achado numa investigação de dois stops
        // "infantis" em BTC/SOL: o snapshot dizia "MACD: BULLISH" na entrada
        // mesmo com o histograma real já minguando rumo à reversão). Agora
        // deriva de linha MACD vs linha de sinal do candle mais recente.
        macd: (() => {
          const m = calculateMACD(candles);
          const lastMacd = m.macd[m.macd.length - 1];
          const lastSignal = m.signal[m.signal.length - 1];
          if (lastMacd === null || lastSignal === null) return 'NEUTRAL';
          return lastMacd > lastSignal ? 'BULLISH' : 'BEARISH';
        })(),
        trend: side === 'LONG' ? 'BULLISH' : 'BEARISH',
      },
    };

    // 🔔 Fase 6 (ponte decisão→execução) — observador aditivo, fire-and-forget.
    try {
      deps.onLiveDecision?.(newTrade);
    } catch (observerError) {
      console.error('[FASE 6] Erro no observador onLiveDecision (não afeta o motor):', observerError);
    }

    effects.push({ type: 'ADD_ORDER', trade: newTrade });
    effects.push({ type: 'LOG', message: `✅ ENTRADA ${side}: ${selectedSymbol} @ $${currentPrice.toFixed(2)} - Alvo: ${targetPointsValue}pts (Confiança: ${confidenceScore}%)` });

    // Fase 2: persiste a abertura da posição (fire-and-forget, nunca bloqueia o loop)
    if (deps.executionMode === 'DEMO') {
      deps.persistence.onTradeOpen({
        id: newTrade.id, symbol: newTrade.symbol, side: newTrade.side, amount: newTrade.amount,
        price: newTrade.price, tp: newTrade.tp, sl: newTrade.sl, leverage: newTrade.leverage,
        ai_confidence: newTrade.ai_confidence, timestamp: newTrade.timestamp, reasoning: newTrade.reasoning,
        indicators: newTrade.indicators,
      }).then(() => {
        deps.persistence.saveDecision({
          symbol: newTrade.symbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: newTrade.reasoning, technicalSignals: newTrade.indicators,
          actionTaken: true, tradeId: newTrade.id,
        });
      });
    }

    // 📊 Único terminal de SUCESSO do funil.
    funnelTelemetry.recordStage('ENTRY_EXECUTED', selectedSymbol, `${side} @ ${currentPrice} | ${strategyName}`);

    effects.push({
      type: 'TOAST_SUCCESS',
      title: `${side === 'LONG' ? '🟢' : '🔴'} ENTRADA ${side}`,
      description: `${selectedSymbol} @ $${currentPrice.toFixed(2)} | Confiança: ${confidenceScore}% | ${strategyName}`,
      duration: 4000,
    });

    return { effects, tradeOpened: { timestamp: newTrade.timestamp }, nextLastStaleDataWarningAt, nextCooldownUntil };
  } catch (error) {
    console.error('[TRADING] ❌ Erro crítico na análise:', error);
    funnelTelemetry.recordStage('ANALYSIS_ERROR', selectedSymbol, error instanceof Error ? error.message : String(error));
    return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
  }
}
