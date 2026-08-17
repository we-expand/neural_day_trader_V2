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
import { evaluateStrategyAt } from '@/app/services/strategy/StrategyEvaluator.ts';
import { calculateRSI, calculateATR } from '@/app/services/indicators/TechnicalIndicators.ts';
import type { Candle } from '@/app/services/indicators/TechnicalIndicators.ts';
import { backtestDataService } from '@/app/services/BacktestDataService.ts';
import { MarketScoreEngine, type MarketRegime } from '@/app/services/MarketScoreEngine.ts';
import type { Timeframe as ScoreTimeframe } from '@/app/services/BacktestDataService.ts';
import { getPointValue } from '@/app/services/strategy/TradeSizing.ts';
import { symbolMappingService } from '@/app/services/SymbolMappingService.ts';
import { getAssetBySymbol } from '@/app/config/assetDatabase.ts';
import { evaluateCostViability } from '@/app/services/risk/CostViabilityGate.ts';
import { forceCloseAllLivePositions } from '@/app/services/risk/LiveEmergencyClose.ts';
import { detectRevengePattern } from '@/app/services/risk/RevengeTradingDetector.ts';
import { evaluateContextGate } from '@/app/services/risk/ContextGate.ts';
import { evaluateTailRisk } from '@/app/services/risk/TailRiskGuard.ts';
import { estimateCostPercent, type AssetClass as CostAssetClass } from '../../../../research/CostModel.ts';
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

  // 🎯 TIER 1 (70%): Cripto + Índices — historicamente mais líquidos/voláteis
  // 🔸 TIER 2 (25%): Metais preciosos + Forex Major Pairs
  // 🔹 TIER 3 (5%): resto do que foi selecionado
  const allowedTier1: string[] = [];
  const allowedTier2: string[] = [];
  const allowedTier3: string[] = [];
  for (const symbol of userAssets) {
    const asset = getAssetBySymbol(symbol);
    if (!asset) {
      console.warn(`[AI LOOP] ⚠️ Ativo "${symbol}" selecionado mas não encontrado no catálogo (assetDatabase.ts) — ignorado neste ciclo`);
      continue;
    }
    if (asset.category === 'CRYPTO' || asset.category === 'INDICES') {
      allowedTier1.push(symbol);
    } else if (asset.category === 'COMMODITIES' && asset.subCategory === 'Precious Metals') {
      allowedTier2.push(symbol);
    } else if (asset.category === 'FOREX' && asset.subCategory === 'Major Pairs') {
      allowedTier2.push(symbol);
    } else {
      allowedTier3.push(symbol);
    }
  }

  if (allowedTier1.length === 0 && allowedTier2.length === 0 && allowedTier3.length === 0) {
    console.log(`[AI LOOP] 🚫 Nenhum ativo selecionado pelo usuário foi reconhecido no catálogo (config: ${userAssets.join(', ')}) - pulando ciclo`);
    funnelTelemetry.recordStage('TICK_NO_ASSET_IN_CATALOG', undefined, userAssets.join(', '));
    return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
  }

  const ASSETS_PER_TICK = Math.min(3, allowedTier1.length + allowedTier2.length + allowedTier3.length);
  const pickedThisTick = new Set<string>();

  for (let __assetBatchIdx = 0; __assetBatchIdx < ASSETS_PER_TICK; __assetBatchIdx++) {
    const rand = Math.random();
    let selectedAssets: string[];
    let tierName = '';

    const tier1Left = allowedTier1.filter(s => !pickedThisTick.has(s));
    const tier2Left = allowedTier2.filter(s => !pickedThisTick.has(s));
    const tier3Left = allowedTier3.filter(s => !pickedThisTick.has(s));

    if (tier1Left.length === 0 && tier2Left.length === 0 && tier3Left.length === 0) {
      break; // já analisou todos os ativos disponíveis do usuário neste tick
    }

    if (rand < 0.70 && tier1Left.length > 0) {
      selectedAssets = tier1Left; // 70% chance - Cripto/Índices
      tierName = 'TIER 1 (Cripto/Índices - Alta Volatilidade)';
    } else if (rand < 0.95 && tier2Left.length > 0) {
      selectedAssets = tier2Left; // 25% chance - Metais/Forex Major
      tierName = 'TIER 2 (Metais/Forex Major - Média Volatilidade)';
    } else if (tier3Left.length > 0) {
      selectedAssets = tier3Left; // 5% chance - demais ativos selecionados
      tierName = 'TIER 3 (Demais ativos selecionados - Baixa Volatilidade)';
    } else {
      selectedAssets = tier1Left.length > 0 ? tier1Left : tier2Left.length > 0 ? tier2Left : tier3Left;
      tierName = 'FALLBACK (restrito à config do usuário)';
    }

    const selectedSymbol = selectedAssets[Math.floor(Math.random() * selectedAssets.length)];
    pickedThisTick.add(selectedSymbol);

    // 🚫 ANTI-REPETIÇÃO: NÃO pode fazer 2 trades seguidos no mesmo ativo
    if (nextLastTradedSymbol === selectedSymbol) {
      console.log(`[ANTI-REPETIÇÃO] ❌ Bloqueado: Último trade foi em ${selectedSymbol}. Aguardando outro ativo...`);
      funnelTelemetry.recordEvaluation();
      funnelTelemetry.recordStage('ASSET_ANTI_REPEAT', selectedSymbol);
      continue;
    }

    // 🛡️ ANTI-HEDGING CHECK
    const existingPositionOnAsset = activeOrders.find(order => order.symbol === selectedSymbol);
    if (existingPositionOnAsset) {
      console.log(`[ANTI-HEDGING] ⚠️ Bloqueado: Já existe posição ${existingPositionOnAsset.side} em ${selectedSymbol}`);
      funnelTelemetry.recordEvaluation();
      funnelTelemetry.recordStage('ASSET_ALREADY_OPEN', selectedSymbol);
      continue;
    }

    // 🎯 CHECK: número de ativos diferentes simultâneos
    const uniqueAssets = new Set(activeOrders.map(order => order.symbol));
    if (uniqueAssets.size >= aiConfig.maxAssets) {
      console.log(`[ASSET LIMIT] ⚠️ Bloqueado: Máximo de ${aiConfig.maxAssets} ativos diferentes atingido`);
      funnelTelemetry.recordEvaluation();
      funnelTelemetry.recordStage('ASSET_MAX_DISTINCT', selectedSymbol);
      continue;
    }

    const result = await analyzeAsset(selectedSymbol, tierName, state, deps);
    for (const e of result.effects) effects.push(e);
    if (result.tradeOpened) {
      nextLastTradeTimestamp = result.tradeOpened.timestamp;
      nextLastTradedSymbol = selectedSymbol;
    }
    if (result.nextLastStaleDataWarningAt !== undefined) {
      nextLastStaleDataWarningAt = result.nextLastStaleDataWarningAt;
    }
    if (result.nextCooldownUntil !== undefined) {
      nextCooldownUntil = result.nextCooldownUntil;
    }
  }

  return { effects, nextLastTradeTimestamp, nextLastTradedSymbol, nextCooldownUntil, nextLastStaleDataWarningAt };
}

interface AssetAnalysisResult {
  effects: TradingCycleEffect[];
  tradeOpened?: { timestamp: number };
  nextLastStaleDataWarningAt?: number;
  nextCooldownUntil?: number;
}

/** Analisa um único ativo — corpo do IIFE assíncrono original, agora testável isoladamente. */
async function analyzeAsset(
  selectedSymbol: string,
  tierName: string,
  state: TradingCycleState,
  deps: TradingCycleDeps,
): Promise<AssetAnalysisResult> {
  const { aiConfig, portfolio, orderHistory, activeOrders } = state;
  const effects: TradingCycleEffect[] = [];
  let nextLastStaleDataWarningAt = state.lastStaleDataWarningAt;
  let nextCooldownUntil = state.cooldownUntil;

  try {
    console.log(`[TRADING] 🔍 Analisando ${selectedSymbol} (buscando dados reais)...`);
    funnelTelemetry.recordEvaluation();

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

    const activeStrategy = deps.strategies.find(s => s.id === aiConfig.activeStrategyId);
    if (!activeStrategy) {
      console.log(`[ESTRATÉGIA] 🚫 Nenhuma estratégia ativa selecionada - pulando ciclo`);
      funnelTelemetry.recordStage('NO_ACTIVE_STRATEGY', selectedSymbol);
      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }

    const opTimeframe = normalizeAiTimeframe(aiConfig.timeframe);
    const barMs: Record<ScoreTimeframe, number> = {
      '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
    };
    const bufferKey = `${selectedSymbol}_${opTimeframe}`;

    let bufferEntry = deps.candleBuffer.get(bufferKey);
    if (!bufferEntry || Date.now() - bufferEntry.fetchedAt > 60_000) {
      try {
        const REQUIRED_BARS = 100;
        // ✅ 2026-08-10: uma janela de calendário igual a exatamente 100 barras
        // (25h pra 15m) fazia índices/ouro (GER40, SPX500, XAUUSD — fecham fora
        // do pregão, ao contrário de FX/cripto) caírem sistematicamente abaixo
        // do piso de 30 candles reais sempre que parte da janela caía em
        // horário de mercado fechado — achado via ai_funnel_snapshots.symbol_stage_counts
        // (CANDLES_INSUFFICIENT concentrado nesses 3 ativos). Pede uma janela de
        // calendário 4x mais larga (folga pra fins de semana/gaps de sessão) e
        // recorta pras últimas REQUIRED_BARS candles reais recebidas — nunca
        // inventa dado, só evita descartar o ciclo por causa da janela curta.
        // ✅ 2026-08-16: em timeframes curtos (1m) o ×4 sozinho dava só ~6h40
        // de janela — curto demais pra cobrir o horário fechado de GER40/XAUUSD,
        // que voltou a derrubar CANDLES_FETCH_FAILED nesses ativos. Piso mínimo
        // de 48h de janela, independente do timeframe, garante folga pra
        // qualquer fechamento de pregão sem afetar timeframes longos (que já
        // ficavam bem acima disso).
        const MIN_WINDOW_MS = 48 * 60 * 60 * 1000;
        const end = new Date();
        const windowMs = Math.max(REQUIRED_BARS * 4 * barMs[opTimeframe], MIN_WINDOW_MS);
        const start = new Date(end.getTime() - windowMs);
        const history = await backtestDataService.fetchHistoricalData(selectedSymbol, start, end, opTimeframe);
        const candles = history.candles.slice(-REQUIRED_BARS);
        bufferEntry = { candles, fetchedAt: Date.now() };
        deps.candleBuffer.set(bufferKey, bufferEntry);
      } catch (error) {
        console.warn(`[ESTRATÉGIA] ⚠️ Sem candles reais pra ${selectedSymbol} (${opTimeframe}) agora, pulando ciclo`, error);
        funnelTelemetry.recordStage('CANDLES_FETCH_FAILED', selectedSymbol, `${opTimeframe}: ${error instanceof Error ? error.message : String(error)}`);
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
      }
    }

    const candles = bufferEntry.candles;
    if (candles.length < 30) {
      console.log(`[ESTRATÉGIA] ⏸️ Histórico insuficiente de ${selectedSymbol} (${candles.length} candles) - pulando ciclo`);
      funnelTelemetry.recordStage('CANDLES_INSUFFICIENT', selectedSymbol, `${candles.length} candles`);
      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }

    const strategySignal = evaluateStrategyAt(activeStrategy, candles, candles.length - 1);
    if (!strategySignal.signal) {
      console.log(`[ESTRATÉGIA] ⏸️ "${activeStrategy.name}" sem sinal em ${selectedSymbol} agora`);
      funnelTelemetry.recordStage('NO_SIGNAL', selectedSymbol, strategySignal.reasons[0] ?? activeStrategy.name);
      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }

    const side: 'LONG' | 'SHORT' = strategySignal.signal === 'BUY' ? 'LONG' : 'SHORT';
    const strategyName = activeStrategy.name;
    let confidenceScore = strategySignal.confidence;
    const rsiSeries = calculateRSI(candles, 14);
    const rsiValue = rsiSeries[rsiSeries.length - 1] ?? 50;

    if (confidenceScore < MIN_CONFIDENCE) {
      console.log(`[SEGURANÇA] ❌ Confiança caiu abaixo do mínimo após análise: ${confidenceScore}% < ${MIN_CONFIDENCE}%`);
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
            symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: strategySignal.confidence,
            reasoning: reason, marketScore: scoreResult.score, technicalSignals: { classification: scoreResult.classification, timeframe: opTimeframe },
            actionTaken: false, vetoStage: 'CONTEXT_SCORE_OPPOSITE',
          });
          return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
        }
        if (scoreResult.classification === 'LATERAL') {
          const requiredConfidence = MIN_CONFIDENCE + LATERAL_CONFIDENCE_PENALTY;
          if (strategySignal.confidence < requiredConfidence) {
            const reason = `Setup ${side} descartado: Market Score (${opTimeframe}) está LATERAL (zona de baixo edge conhecida) e a estratégia só tem ${strategySignal.confidence}% de confiança (exige ${requiredConfidence}% nesse regime)`;
            console.log(`[SCORE] 🚫 ${reason}`);
            await deps.persistence.saveDecision({
              symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: strategySignal.confidence,
              reasoning: reason, marketScore: scoreResult.score, technicalSignals: { classification: scoreResult.classification, timeframe: opTimeframe, requiredConfidence },
              actionTaken: false, vetoStage: 'CONTEXT_SCORE_LATERAL',
            });
            return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
          }
          console.log(`[SCORE] 🟡 Market Score (${opTimeframe}) LATERAL — estratégia com confiança suficiente (${strategySignal.confidence}% ≥ ${requiredConfidence}%) pra operar mesmo sem confirmação`);
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

    // 🔒 RESPEITAR CONFIG DO USUÁRIO: direção
    if (aiConfig.direction !== 'AUTO' && side !== aiConfig.direction) {
      console.log(`[CONFIG] 🚫 Setup ${side} descartado: direção travada em "${aiConfig.direction}" pelo usuário`);
      funnelTelemetry.recordStage('CONFIG_DIRECTION', selectedSymbol, `setup ${side}, travado em ${aiConfig.direction}`);
      return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
    }

    // 🔒 RESPEITAR CONFIG DO USUÁRIO: marketMode (TREND/RANGE/COUNTER/SCALP)
    if ((aiConfig.marketMode === 'TREND' || aiConfig.marketMode === 'RANGE') && computedRegime !== null) {
      const wantsTrend = aiConfig.marketMode === 'TREND';
      const regimeMatches = wantsTrend
        ? computedRegime === 'TENDENCIA'
        : computedRegime === 'LATERAL';
      if (!regimeMatches) {
        const reason = `Setup ${side} descartado: modo "${aiConfig.marketMode}" exige regime ${wantsTrend ? 'TENDENCIA' : 'LATERAL'}, mas o Market Score (${opTimeframe}) mede ${computedRegime} agora`;
        console.log(`[MARKET MODE] 🚫 ${reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: reason, technicalSignals: { regime: computedRegime, marketMode: aiConfig.marketMode },
          actionTaken: false, vetoStage: 'MARKET_MODE_REGIME_MISMATCH',
        });
        return { effects, nextLastStaleDataWarningAt, nextCooldownUntil };
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
      const movementPercentForCostGate = (atrValueForCostGate / currentPrice) * 100;

      const symbolType = symbolMappingService.findMapping(selectedSymbol)?.type;
      const assetClassForCostGate: CostAssetClass =
        symbolType === 'crypto' ? 'CRYPTO' :
        symbolType === 'commodity' ? 'COMMODITY' :
        symbolType === 'index' ? 'INDEX' :
        symbolType === 'stock' ? 'STOCK' :
        'FOREX_MAJOR';
      if (!symbolType) {
        console.log(`[CUSTO] ⚠️ ${selectedSymbol} sem mapeamento em SymbolMappingService — usando FOREX_MAJOR como aproximação conservadora pro custo`);
      }

      const pointValueForCostGate = getPointValue(selectedSymbol);
      const costPercentForCostGate = estimateCostPercent(assetClassForCostGate, currentPrice, pointValueForCostGate) * 2 * 100;

      const costGateResult = evaluateCostViability(costPercentForCostGate, movementPercentForCostGate);
      if (!costGateResult.approved) {
        const reason = `Setup ${side} descartado em ${selectedSymbol}: ${costGateResult.reason} (custo ${costPercentForCostGate.toFixed(3)}% vs. ATR ${movementPercentForCostGate.toFixed(3)}%, classe ${assetClassForCostGate})`;
        console.log(`[CUSTO] 🚫 ${reason}`);
        await deps.persistence.saveDecision({
          symbol: selectedSymbol, decision: side === 'LONG' ? 'BUY' : 'SELL', confidence: confidenceScore,
          reasoning: reason, actionTaken: false, vetoStage: 'COST_GATE',
          riskAssessment: { costPercent: costPercentForCostGate, movementPercent: movementPercentForCostGate, assetClass: assetClassForCostGate },
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
      dailyStartBalance: portfolio.dayAnchorEquity || portfolio.initialBalance || 100,
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

    // 🆕 SISTEMA DE PONTOS BASEADO EM targetPoints
    let targetPointsValue = 400;
    let stopLossPointsValue = 120;

    if (aiConfig.targetPoints === 'POUCOS') {
      targetPointsValue = 150; stopLossPointsValue = 50;
    } else if (aiConfig.targetPoints === 'MÉDIO') {
      targetPointsValue = 400; stopLossPointsValue = 120;
    } else if (aiConfig.targetPoints === 'MUITOS') {
      targetPointsValue = 1500; stopLossPointsValue = 300;
    } else if (aiConfig.targetPoints === 'CURTO') {
      targetPointsValue = 80; stopLossPointsValue = 35;
    } else if (aiConfig.targetPoints === 'LONGO') {
      targetPointsValue = 800; stopLossPointsValue = 200;
    }

    if (aiConfig.marketMode === 'SCALP') {
      targetPointsValue = Math.min(targetPointsValue, 80);
      stopLossPointsValue = Math.min(stopLossPointsValue, 35);
    }

    const pointValue = getPointValue(selectedSymbol);
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
    let tradeCapital = allocatedCapital * riskPercentage * riskAdjustment.sizeMultiplier;

    if (aiConfig.positionSizingMode === 'ATR') {
      const atrSeries = calculateATR(candles, 14);
      const atrValue = atrSeries[atrSeries.length - 1];
      if (atrValue && atrValue > 0) {
        const atrDistance = atrValue * aiConfig.atrMultiplier;
        const riskCapital = allocatedCapital * riskPercentage * riskAdjustment.sizeMultiplier;
        tradeCapital = slDistance > 0 ? riskCapital * (slDistance / atrDistance) : riskCapital;
        console.log(`[POSITION SIZING] 📐 ATR mode: ATR=${atrValue.toFixed(5)} x${aiConfig.atrMultiplier} = ${atrDistance.toFixed(5)} | capital ajustado: $${tradeCapital.toFixed(2)}`);
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

    // 2026-08-16: FIX DE BUG — antes, nocional abaixo de $10 era empurrado pra
    // cima (`Math.max(tradeCapital, minTradeCapital)`), inflando o risco real
    // muito além de `aiConfig.riskPerTrade` em contas pequenas (medido em
    // research/experiments/2026-08-16-portfolio-amplitude/results/floor_check_by_profile.md:
    // 24% dos sinais numa conta de $50 com risco 0,5%/trade acionavam o piso).
    // Mesmo fix aplicado em TradeSizing.calculatePositionSize (usado pelo
    // Backtest) — aqui é a cópia usada pelo motor ao vivo. Corrigido: pula o
    // trade em vez de forçar tamanho maior que o risco configurado.
    const minTradeCapital = 10;
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
      reasoning: `${strategyName} | ${tierName} - ${aiConfig.targetPoints} pts (${targetPointsValue}p) - R/R 1:${riskRewardRatio.toFixed(1)} - ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
      indicators: {
        rsi: Math.round(rsiValue),
        macd: side === 'LONG' ? 'BULLISH' : 'BEARISH',
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
