import { useState, useEffect, useRef, useCallback } from 'react';

import { toast as toastOriginal } from 'sonner';
import { getSpread, applySpread } from '@/config/spreads'; // 🎯 Funções de Spread (sem hook)
import { calculateRealisticPnL, calculatePnLWithLeverage, getContractSpec, getContractInfo } from '@/config/contractSpecs'; // 💰 Especificações de Contrato
import { calculateRoundTripCost } from '@/app/services/risk/ExecutionCost.ts'; // 💸 Custo de execução real (spread+slippage) — fonte única, mesma do ai-runner
import { Strategy as StrategyDef } from '@/app/types/strategy';
import { PRESET_STRATEGIES } from '@/app/data/presetStrategies';
import { calculateATR } from '@/app/services/indicators/TechnicalIndicators';
import { type PyramidingConfig, DEFAULT_PYRAMIDING_CONFIG } from '@/app/components/trading/PyramidingConfigPanel';
import { getPointValue } from '@/app/services/strategy/TradeSizing';
import { getAssetBySymbol } from '@/app/config/assetDatabase';
import { floorToLotStep } from '@/app/modules/tradeConfirmationStage/lotSizeConversion';
import { DEFAULT_ACTIVE_ASSETS } from '@/app/config/defaultBasket';
import { forceCloseAllLivePositions } from '@/app/services/risk/LiveEmergencyClose';
import { evaluateContextGate } from '@/app/services/risk/ContextGate';
import { evaluateCostViability } from '@/app/services/risk/CostViabilityGate';
import { BREAKEVEN_TRIGGER_R } from '@/app/services/risk/TradeFrictionControls';
import { resolveCostAssetClass } from '@/app/services/risk/CostAssetClass';
import { estimateCostPercent } from '../../../research/CostModel';
import type { TradeVisual, PortfolioState, AIConfig } from '@/app/types/tradingState';
import { aiPersistence } from '@/app/services/AITradingPersistenceService';

// === 🔇 DEBUG CONFIG: All logs DISABLED (set to `true` to enable) ===
const DEBUG_LOGS = {
    assetSelection: false,   // 🎯 Pool selection
    antiHedging: false,      // 🛡️ Anti-hedging checks & reversals
    pnlLoop: false,          // 🔄 PNL calculations - ✅ DESATIVADO para evitar spam
    scoreEngine: false,      // 📈 Score calculations
    direction: false,        // 🧠 Direction decisions
    mutex: false,            // 🔒 Mutex operations (lock/unlock)
    apiCalls: false,         // 🔍 API calls
    execution: false         // 🔍 Trade execution (debug mode)
};

// Debug logger - Only logs if category is enabled
function debugLog(category: keyof typeof DEBUG_LOGS, emoji: string, message: string, data?: any) {
    if (DEBUG_LOGS[category]) {
        if (data !== undefined) {
            console.warn(`${emoji} ${message}`, data);
        } else {
            console.warn(`${emoji} ${message}`);
        }
    }
}

// Toast wrapper: Silencia erros de trading para não poluir UI
const toast = {
  success: toastOriginal.success,
  warning: toastOriginal.warning,
  info: toastOriginal.info,
  error: (msg: string, options?: any) => {
    // Silencia erros de trading (já estão nos logs)
    if (msg.includes('Stop Loss') || msg.includes('Falha Real') || msg.includes('MT5') || msg.includes('credenciais')) {
      console.log(`[TOAST SILENCIADO] ${msg}`);
      return;
    }
    toastOriginal.error(msg, options);
  }
};
import { RiskProfileType } from '../../lib/modules/NeuralRiskGuardian';
import { useAuth } from '../contexts/AuthContext'; // Fase 2: usuário logado p/ persistência
import { useAIPersistence } from './useAIPersistence'; // Fase 2: persiste sessão DEMO no Supabase
import { funnelTelemetry } from '../services/telemetry/FunnelTelemetry'; // Fase 0 do redesenho do cérebro: instrumentação do funil de decisão
import { runTradingCycle, type TradingCycleEffect } from '../services/strategy/runTradingCycle'; // Passo 2 do plano do runner (2026-08-07): módulo puro do ciclo, "um motor, dois drivers"
import { fetchJarvisSizeMultiplier } from '../services/strategy/jarvisSizeMultiplier';
import { supabase } from '@/lib/supabaseClient'; // Realtime de ai_trades (reconciliação de posições, 2026-08-20)

// 🔒 RESPEITAR CONFIG DO USUÁRIO: riskProfile. Antes esse campo era salvo mas nunca
// lido - qualquer perfil escolhido (conservador/agressivo/institucional) tinha o
// mesmo tamanho de posição e mesma barra de confiança mínima. Cobre tanto os valores
// oficiais de RiskProfileType (NeuralRiskGuardian.ts) quanto os legados já em uso na
// UI (EQUILIBRADO/DEGEN, ver MarketScore.tsx e o default de INITIAL_STATE), pra não
// quebrar configs já salvas no localStorage de quem já usa o app.
/** Rótulos de perfil de risco de versões antigas, ainda presentes no localStorage. */
export type LegacyRiskProfile = 'EQUILIBRADO' | 'DEGEN';

// RISK_PROFILE_ADJUSTMENTS, CORRELATION_GROUPS e demais constantes/funções só
// usadas pelo ciclo de trading moraram aqui até 2026-08-07 — extraídas pra
// src/app/services/strategy/runTradingCycle.ts (passo 2 do plano do runner,
// "um motor, dois drivers"). Não duplicar de volta aqui.

// Ordem pendente DEMO (limit/stop) — virtual, monitorada localmente pelo
// preço da tela; dispara chamando openManualPosition quando o gatilho é
// cruzado. Sem stop-limit no lado DEMO (o LIVE tem via BrokerClient direto,
// que fala com a MetaAPI de verdade — aqui a gente só tem o preço da tela
// pra decidir, não faz sentido simular uma segunda perna de preço-limite
// sem dado real de profundidade).
export interface PendingOrderVisual {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  orderType: 'LIMIT' | 'STOP';
  volume: number;
  triggerPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
}

// TradeVisual/PortfolioState movidos pra src/app/types/tradingState.ts em
// 2026-08-07 (passo 3 do plano do runner) — o motor (`runTradingCycle.ts`)
// precisava desses tipos sem puxar React pro grafo de módulos sob Deno.
// Re-exportados aqui pra não quebrar quem já importa deste arquivo.
export type { TradeVisual, PortfolioState } from '@/app/types/tradingState';

/**
 * Re-ancora o drawdown quando o capital muda por um salto que NÃO é resultado de
 * trade (conexão com a corretora, reset manual de saldo, troca de conta).
 * Sem isso, sair do saldo default de $100 pra uma conta real de $10.000 deixaria
 * o high-water mark defasado; e o caminho inverso (conta menor que o pico antigo)
 * dispararia um drawdown falso de dezenas de por cento no primeiro tick, jogando
 * a IA em Safe Mode sem nenhuma perda ter acontecido.
 */
function reanchorDrawdown(equity: number): Pick<
  PortfolioState,
  'currentDrawdown' | 'maxDrawdownReached' | 'peakEquity' | 'dayAnchorEquity' | 'dayAnchorBalance' | 'dayAnchorUtcDay'
> {
  return {
    currentDrawdown: 0,
    maxDrawdownReached: 0,
    peakEquity: equity,
    dayAnchorEquity: equity,
    dayAnchorBalance: equity,
    dayAnchorUtcDay: 0, // força re-ancoragem do dia no próximo tick
  };
}

// Ponto real de equity ao longo do tempo, pra alimentar a Curva de Equity —
// nunca dado mockado. Amostrado a cada 10s a partir do portfolio real
// (mesmo valor que os cards de patrimônio mostram), com semente inicial a
// partir dos snapshots já persistidos no Supabase quando disponíveis.
export interface EquityPoint {
  t: number; // epoch ms
  equity: number;
}

const STORAGE_KEY = 'apex_logic_state_v15_FIXED';
// 🔴 FIX 2026-08-21 (Cleber: depois de "Reset", Curva de Equity do Dashboard
// ainda mostrava o mergulho/plateau da sessão anterior): `endSession` no
// Supabase é assíncrono e não é aguardado por `resetLogic` — se o usuário
// recarregar a página no meio dessa janela (comum logo após confirmar o
// Reset), a hidratação (linha ~711) ainda encontra a sessão antiga como
// RUNNING e restaura a curva de equity real dela inteira, sépia do reset.
// Este marcador (com timestamp e o id da sessão que estava sendo encerrada)
// deixa a hidratação detectar esse caso e ignorar a sessão "RUNNING" fantasma
// em vez de restaurar dado obsoleto.
const LAST_RESET_MARKER_KEY = 'apex_last_reset_marker_v1';
const RESET_MARKER_STALE_MS = 30_000;

export interface MetaApiCredentials {
  login: string;
  server: string;
  password?: string;
  // initialBalance removed, we calculate it automatically
}

// AIConfig movido pra src/app/types/tradingState.ts em 2026-08-07 (passo 3
// do plano do runner) — mesmo motivo de TradeVisual/PortfolioState acima:
// precisa ser importável pelo motor sob Deno sem puxar React. `riskProfile`
// no tipo movido usa a união literal de RiskProfileType inline (em vez de
// importar de NeuralRiskGuardian.ts) só pra não introduzir mais uma aresta
// no grafo — o conjunto de valores é idêntico, checado no `select:` do
// gate de validação (`npm run validate`).
export type { AIConfig } from '@/app/types/tradingState';

export interface MarketContext {
  prices: Record<string, number>;
  mt5Offset: number; // Delta if we're using MT5 prices
}

export interface HouseStats {
  totalRevenue: number;
  totalVolume: number;
  totalTrades: number;
  totalWins: number;
  grossProfit: number;
  grossLoss: number;
}

interface PerformanceMetrics {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldTime: number;
  bestTrade: number;
  worstTrade: number;
}

export interface ApexLogicState {
  isActive: boolean;
  isPaused: boolean;
  activeOrders: TradeVisual[];
  portfolio: PortfolioState;
  recentLogs: string[];
  orderHistory: TradeVisual[];
  marketContext: MarketContext | null;
  houseStats: HouseStats;
  performanceMetrics: PerformanceMetrics;
  healthStatus: {
    isHealthy: boolean;
    lastCheckTimestamp: number;
    issues: string[];
  };
  aiConfig: AIConfig;
  mt5Credentials: MetaApiCredentials | null;
  executionMode: 'DEMO' | 'LIVE';
  // Control Variables
  cycleInterval: number; // ms
  isRunningCycle: boolean;
  isWaitingNewCandle: boolean;
  lastTradeTimestamp: number;
  isConnectedToMT5: boolean;
  mt5AccountId: string | null;
  lastMT5SyncTime: number;
  failedMT5Attempts: number;
  
  // Asset Diversification Tracking
  assetExposure: Record<string, number>; // { 'EURUSD': 100, 'BTCUSD': 200 }
  lastAssetClass: string | null; // Last asset class traded (to enforce rotation)
  
  // New: Safe Mode for emergencies
  isSafeMode: boolean;
  safeModeReason: string | null;
  
  // Candle Counter Control
  candlesSinceLastTrade: number;  // Count of candles since last trade
  maxCandlesBeforeForceEntry: number; // Max candles to wait (user configurable)

  // Curva de equity real (amostras reais do portfolio, não mock)
  equityHistory: EquityPoint[];
}

const INITIAL_STATE: ApexLogicState = {
  isActive: false,
  isPaused: false,
  activeOrders: [],
  orderHistory: [],
  recentLogs: [],
  marketContext: null,
  portfolio: {
    balance: 100,
    equity: 100,
    maxDrawdownLimit: 15,
    currentDrawdown: 0,
    openPositionsValue: 0,
    initialBalance: 100,
    peakEquity: 100,
    dayAnchorEquity: 100,
    dayAnchorBalance: 100,
    dayAnchorUtcDay: 0,
  },
  houseStats: {
    totalRevenue: 0,
    totalVolume: 0,
    totalTrades: 0,
    totalWins: 0,
    grossProfit: 0,
    grossLoss: 0,
  },
  performanceMetrics: {
    totalPnL: 0,
    winRate: 0,
    totalTrades: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    avgHoldTime: 0,
    bestTrade: 0,
    worstTrade: 0,
  },
  healthStatus: {
    isHealthy: true,
    lastCheckTimestamp: Date.now(),
    issues: [],
  },
  aiConfig: {
    direction: 'AUTO',
    marketMode: 'TREND',
    targetPoints: 'MÉDIO',
    stopLossMode: 'DINAMICO',
    allocatedCapital: 100,
    maxContracts: 3,
    maxPositions: 5,
    maxDrawdown: 15,
    // 🔴 2026-08-26: Aumentado de 2% → 4% (Kelly fracionário adequado pra 65% win rate)
    // Com 65% de taxa de acerto e R:R 1:2.5, Kelly Fracionário = 12.75%.
    // 4% é 31% do Kelly pleno — agressivo mas seguro.
    riskPerTrade: 4,
    minWinRate: 55,
    riskProfile: 'EQUILIBRADO',
    
    // 🆕 PROPRIEDADES FALTANTES (usadas pelo AITrader.tsx)
    // 2026-08-20: default de `activeAssets` volta a ser uma cesta enxuta (9,
    // ver DEFAULT_ACTIVE_ASSETS em config/defaultBasket.ts) — o painel de
    // configuração estava abrindo com os 39 ativos da cesta de RANKING
    // inteira pré-marcados como ativos, sem o usuário ter escolhido isso.
    // O universo de ranking amplo (DEFAULT_ANALYSIS_BASKET) continua
    // disponível no seletor pra quem quiser ampliar manualmente.
    activeAssets: DEFAULT_ACTIVE_ASSETS,
    maxAssets: 6, // Máximo de ativos com posição ABERTA ao mesmo tempo (não limita a análise)
    timeframe: '15m', // Timeframe operacional (1m, 5m, 15m, 1H, 4H)
    newsFilter: true, // Filtro de notícias econômicas
    dailyLossLimit: 5, // Limite de perda diária (%)
    metaApiToken: '', // 🔑 Token do MetaApi para integração MT5
    activeStrategyId: '2', // Padrão: "Cruzamento de Médias com Filtro de Regime" (tendência, ADX-gated), mesma estratégia disponível no Backtest
    // 60 = um bloco de entrada perfeito somado a um cruzamento de até ~8
    // candles atrás ainda passa. 100 reproduz o comportamento binário antigo
    // (só o candle exato do cruzamento). Ver doc do campo em tradingState.ts.
    // 🔴 2026-08-26: Reduzido de 60 → 45 pra aceitar mais candidatos
    // Filtragem de qualidade agora acontece nos gates (MIN_CONFIDENCE + Tiering)
    // em vez de rejeitar tudo no ranking (signalScoreFloor era muro demais)
    signalScoreFloor: 45,

    // Gerenciamento de Risco — defaults conservadores (modelo FTMO/Topstep)
    drawdownAnchor: 'DAILY_CLOSE',
    cooldownEnabled: true,
    consecutiveLossesTrigger: 3,
    cooldownMinutes: 60,
    maxTradesPerDay: 0, // 0 = sem limite
    positionSizingMode: 'ATR', // ✅ Padrão: position sizing por volatilidade real
    // 🔴 2026-08-26: Aumentado de 1.5 → 2.0 (stop dinâmico com mais espaço)
    // Stop = 2.0×ATR em vez de 1.5×ATR reduz "fakes" (ruído) que fecha no SL.
    // Alvo permanece 2.5× o stop = 5.0×ATR (captura movimento real melhor).
    atrMultiplier: 2.0,
    correlationGuardEnabled: false, // TODO: Implementar correlação real em Fase 2
    correlationThreshold: 0.7,
    killSwitchThreshold: 0, // 0 = desativado por padrão; pode ser setado pelo usuário (ex: 10% de perda)
    aggressiveModeEnabled: false, // opt-in explícito — padrão é o cooldown normal (5s), risco assumido só se o usuário ligar
    atrTrailingPeriod: 14,
    atrTrailingMultiplier: 2.0,
    pyramiding: DEFAULT_PYRAMIDING_CONFIG,
  },
  mt5Credentials: null,
  executionMode: 'DEMO',
  cycleInterval: 60000, // 60s default
  isRunningCycle: false,
  isWaitingNewCandle: false,
  lastTradeTimestamp: 0,
  isConnectedToMT5: false,
  mt5AccountId: null,
  lastMT5SyncTime: 0,
  failedMT5Attempts: 0,
  assetExposure: {},
  lastAssetClass: null,
  isSafeMode: false,
  safeModeReason: null,
  candlesSinceLastTrade: 0,
  maxCandlesBeforeForceEntry: 5, // Default: force entry after 5 candles
  equityHistory: [],
};

export function useApexLogic(
  initialMarketContext?: MarketContext,
  strategies: StrategyDef[] = PRESET_STRATEGIES,
  // Ponto de extensão aditivo pra Fase 6 (ponte decisão→execução, ver
  // research/AI_BRAIN_SPEC.md seção 9.1): invocado com a decisão de entrada
  // assim que ela é computada, ANTES de qualquer efeito colateral (estado
  // local, persistência DEMO, toast). Não decide nada e não é aguardado
  // (fire-and-forget) — o motor não reaproveita nem espera resposta do
  // consumidor. Existe só pra permitir um módulo isolado (estágios 1-2 da
  // ponte) observar a decisão sem duplicar a lógica de sinal/indicador.
  onLiveDecision?: (decision: TradeVisual) => void
) {
  const onLiveDecisionRef = useRef(onLiveDecision);
  // Instância do WebSocket de cripto já conectada (ver `connectWebSocket` no
  // loop de trading abaixo) — exposta aqui pra `runTradingCycle` poder ler
  // preço em tempo real via `deps.getWsPrice` sem precisar reconectar.
  const wsManagerRef = useRef<ReturnType<typeof import('../services/BinanceWebSocketManager').getBinanceWebSocketManager> | null>(null);
  useEffect(() => { onLiveDecisionRef.current = onLiveDecision; }, [onLiveDecision]);

  // Ref pra sempre ler a lista de estratégias mais atual dentro do setInterval sem recriar o loop
  const strategiesRef = useRef<StrategyDef[]>(strategies);
  useEffect(() => { strategiesRef.current = strategies; }, [strategies]);

  // Buffer de candles reais por ativo, usado pelo evaluateStrategyAt (indicadores
  // precisam de histórico, não só do preço tick a tick). Renovado a cada 60s por
  // símbolo pra não bater a API a cada ciclo de 5s.
  const candleBufferRef = useRef<Map<string, { candles: import('../services/indicators/TechnicalIndicators').Candle[]; fetchedAt: number }>>(new Map());

  // 🆕 2026-08-04: ATR real e recente (< 5min) pro símbolo, buscando no MESMO
  // cache de candles do ciclo de análise (sem chamada de rede extra). Usado
  // pelo trailing DINAMICO e pelo Pyramiding (entryDistanceType 'atr'). Sem
  // candle fresco pro símbolo, retorna null — nunca fabrica um ATR.
  const getFreshAtr = (symbol: string, period: number): number | null => {
    for (const [bufKey, bufEntry] of candleBufferRef.current) {
      if (bufKey.startsWith(`${symbol}_`) && Date.now() - bufEntry.fetchedAt < 5 * 60_000) {
        const atrSeries = calculateATR(bufEntry.candles, period);
        const lastAtr = atrSeries[atrSeries.length - 1];
        return lastAtr && lastAtr > 0 ? lastAtr : null;
      }
    }
    return null;
  };

  // Busca candles frescos (< 5min) do MESMO cache usado por getFreshAtr —
  // sem chamada de rede extra, sem candle fresco retorna null.
  const getFreshCandles = (symbol: string) => {
    for (const [bufKey, bufEntry] of candleBufferRef.current) {
      if (bufKey.startsWith(`${symbol}_`) && Date.now() - bufEntry.fetchedAt < 5 * 60_000) return bufEntry.candles;
    }
    return null;
  };

  // 🆕 2026-08-19: gate de risco real do Pyramiding — substitui o antigo
  // "AI Risk Analysis" (opt-in, nunca implementado, inventaria critério de
  // "momentum"/"divergência" que não existia em lugar nenhum do projeto).
  // Em vez de inventar um critério novo, roda os MESMOS 3 gates reais que
  // toda entrada normal do motor já passa (`runTradingCycle.ts`) — sem
  // opt-in, sempre que o Pyramiding estiver ligado: um único botão, "liga o
  // sistema" já inclui a proteção.
  const evaluatePyramidLayerRiskGate = (symbol: string, side: 'LONG' | 'SHORT', currentPrice: number, targetPrice: number | undefined): { approved: boolean; reason: string } => {
    // 1. Mesmo limite de drawdown que o RiskManager usa pra qualquer entrada nova.
    if (portfolioRef.current.currentDrawdown >= configRef.current.maxDrawdown) {
      return { approved: false, reason: `drawdown atual (${portfolioRef.current.currentDrawdown.toFixed(1)}%) já no limite configurado (${configRef.current.maxDrawdown}%)` };
    }

    // 2. ContextGate — mesmo gate de regime de mercado usado em toda entrada nova.
    const candles = getFreshCandles(symbol);
    if (candles) {
      const ctx = evaluateContextGate(candles, side);
      if (!ctx.podeOperar) return { approved: false, reason: `ContextGate: ${ctx.motivo}` };
    }
    // Sem candle fresco: não bloqueia por isso (mesmo comportamento de
    // "sem dado suficiente, não fabrica veto" já usado pro resto do gate) —
    // mas os outros 2 checks continuam valendo.

    // 3. CostViabilityGate — mesma fórmula exata de runTradingCycle.ts
    // (custo round-trip vs. distância até o alvo).
    if (targetPrice && targetPrice > 0 && currentPrice > 0) {
      const pointValue = getPointValue(symbol);
      const { assetClass } = resolveCostAssetClass(symbol);
      const costPercent = estimateCostPercent(assetClass, currentPrice, pointValue) * 2 * 100;
      const movementPercent = (Math.abs(targetPrice - currentPrice) / currentPrice) * 100;
      const viability = evaluateCostViability(costPercent, movementPercent);
      if (!viability.approved) return { approved: false, reason: `CostViabilityGate: ${viability.reason}` };
    }

    return { approved: true, reason: 'ok' };
  };

  // Gerenciamento de Risco: timestamp (ms) até quando novas entradas ficam bloqueadas por cooldown
  const cooldownUntilRef = useRef<number>(0);
  // === STATE MANAGEMENT ===
  const [isActive, setIsActive] = useState(INITIAL_STATE.isActive);
  const [isPaused, setIsPaused] = useState(INITIAL_STATE.isPaused);
  const [activeOrders, setActiveOrders] = useState<TradeVisual[]>(INITIAL_STATE.activeOrders);
  const [pendingOrders, setPendingOrders] = useState<PendingOrderVisual[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioState>(INITIAL_STATE.portfolio);
  const [recentLogs, setRecentLogs] = useState<string[]>(INITIAL_STATE.recentLogs);
  const [orderHistory, setOrderHistory] = useState<TradeVisual[]>(INITIAL_STATE.orderHistory);
  const [houseStats, setHouseStats] = useState<HouseStats>(INITIAL_STATE.houseStats);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>(INITIAL_STATE.performanceMetrics);
  const [healthStatus, setHealthStatus] = useState(INITIAL_STATE.healthStatus);
  const [aiConfig, setAIConfig] = useState<AIConfig>(INITIAL_STATE.aiConfig);
  const [mt5Credentials, setMT5Credentials] = useState<MetaApiCredentials | null>(INITIAL_STATE.mt5Credentials);
  
  // 🔥 PERSISTÊNCIA CRÍTICA: executionMode DEVE ser salvo no localStorage
  const [executionMode, setExecutionMode] = useState<'DEMO' | 'LIVE'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neural_execution_mode');
      return (saved as 'DEMO' | 'LIVE') || 'DEMO';
    }
    return 'DEMO';
  });
  
  const [isConnectedToMT5, setIsConnectedToMT5] = useState(INITIAL_STATE.isConnectedToMT5);
  const [mt5AccountId, setMT5AccountId] = useState<string | null>(INITIAL_STATE.mt5AccountId);
  const [isSafeMode, setIsSafeMode] = useState(INITIAL_STATE.isSafeMode);
  const [safeModeReason, setSafeModeReason] = useState<string | null>(INITIAL_STATE.safeModeReason);
  const [candlesSinceLastTrade, setCandlesSinceLastTrade] = useState(INITIAL_STATE.candlesSinceLastTrade);
  const [maxCandlesBeforeForceEntry, setMaxCandlesBeforeForceEntry] = useState(INITIAL_STATE.maxCandlesBeforeForceEntry);
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>(INITIAL_STATE.equityHistory);
  // Timestamp da última reconciliação bem-sucedida com o Supabase (Realtime
  // ou fallback de polling) — exposto pra UI sinalizar dado potencialmente
  // desatualizado, em vez de deixar a tela congelada sem aviso.
  const [lastPositionSyncAt, setLastPositionSyncAt] = useState<number | null>(null);
  const lastEquitySampleAtRef = useRef<number>(0);
  const EQUITY_SAMPLE_INTERVAL_MS = 3000; // amostra real a cada 3s (mais granularidade pra curva do Dashboard)
  const MAX_EQUITY_POINTS = 600; // ~30min de janela (mantida, só com mais pontos por minuto)

  // === VIX CACHE CONFIG ===
  // 🔥 CORREÇÃO CRÍTICA: useRef DEPOIS de useState (Rules of Hooks)
  const cachedVIXRef = useRef(0);
  const lastVIXFetchRef = useRef(0);
  const VIX_CACHE_DURATION = 60000; // 60 segundos de cache

  // === NEWS FILTER CACHE CONFIG (aiConfig.newsFilter) ===
  const cachedNewsEventsRef = useRef<Array<{ time: number; impact: string; currency: string }>>([]);
  const lastNewsFetchRef = useRef(0);
  const NEWS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache

  // === JARVIS SIZE MULTIPLIER CACHE ===
  // Ver src/app/services/strategy/jarvisSizeMultiplier.ts — fecha o loop entre
  // as decisões ACTIVE do Jarvis (supabase/functions/jarvis/) e o sizing real.
  const cachedJarvisMultiplierRef = useRef(1);
  const lastJarvisMultiplierFetchRef = useRef(0);
  const JARVIS_MULTIPLIER_CACHE_DURATION = 60000; // 60s — mesmo horizonte do VIX, decisão muda a cada 6h

  // 🔴 2026-08-25: refs para debounce de persistência de config
  const updateAIConfigTimeoutRef = useRef<number>(0);
  const updateAIConfigDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === REFS FOR REAL-TIME ACCESS ===
  const configRef = useRef<AIConfig & { executionMode: 'DEMO' | 'LIVE' }>({
    ...INITIAL_STATE.aiConfig,
    executionMode: INITIAL_STATE.executionMode,
  });
  const portfolioRef = useRef<PortfolioState>(INITIAL_STATE.portfolio);
  const marketRef = useRef<MarketContext | null>(initialMarketContext || INITIAL_STATE.marketContext);
  const mt5CredentialsRef = useRef<MetaApiCredentials | null>(INITIAL_STATE.mt5Credentials);
  const mt5AccountIdRef = useRef<string | null>(INITIAL_STATE.mt5AccountId);
  const lastMT5SyncRef = useRef(INITIAL_STATE.lastMT5SyncTime);
  const failedMT5AttemptsRef = useRef(INITIAL_STATE.failedMT5Attempts);
  const assetExposureRef = useRef<Record<string, number>>(INITIAL_STATE.assetExposure);
  const lastAssetClassRef = useRef<string | null>(INITIAL_STATE.lastAssetClass);
  const isSafeModeRef = useRef(INITIAL_STATE.isSafeMode);
  const isActiveRef = useRef(INITIAL_STATE.isActive);
  const candleCounterRef = useRef(INITIAL_STATE.candlesSinceLastTrade);
  const maxCandlesRef = useRef(INITIAL_STATE.maxCandlesBeforeForceEntry);
  const isRunningCycleRef = useRef(false);
  const isWaitingNewCandleRef = useRef(false);
  const lastTradeTimestampRef = useRef(0);
  const lastTradedSymbolRef = useRef<string | null>(null); // ✅ NOVO: Anti-repetição de ativo
  const cycleIntervalRef = useRef(INITIAL_STATE.cycleInterval);

  // === REFS FOR PNL LOOP ===
  const activeOrdersRef = useRef<TradeVisual[]>([]);
  const pendingOrdersRef = useRef<PendingOrderVisual[]>([]);
  const orderHistoryRef = useRef<TradeVisual[]>([]); // 🔒 leitura pro Health Check Guardian (dailyLossLimit/minWinRate)
  // 🔒 FIX 2026-08-03 (achado do Cleber: Safe Mode disparado com $95,28 na conta):
  // desde que `orderHistory` passou a hidratar trades fechados de TODAS as
  // sessões do dia via Supabase (fix do histórico, mesmo dia), o gate de
  // `dailyLossLimit` abaixo (que soma P&L de tudo fechado desde o início do
  // dia UTC) passou a somar também trades de sessões ANTERIORES já resetadas
  // pelo usuário — incluindo, neste caso real, um trade de SPX500 com P&L
  // corrompido (-$950 registrado por um bug de contract spec já corrigido
  // depois no mesmo dia) que nunca deveria pesar contra a sessão atual.
  // `resetLogic()` é uma ação explícita de "começar do zero" — o relógio do
  // limite de perda DIÁRIA deve reiniciar junto, não continuar somando
  // perdas de tentativas anteriores já descartadas pelo próprio usuário.
  const sessionStartedAtRef = useRef<number>(Date.now());
  const pnlLoopRef = useRef({ realizedPnL: 0, totalUnrealizedPnL: 0, totalExposure: 0 });
  const pnlLogsRef = useRef<string[]>([]);
  // `pnl` aqui é BRUTO e `costUsd` é o custo de execução round-trip; a
  // persistência grava os dois separados (`pnl` / `commission` / `net_pnl`),
  // seguindo a convenção do schema de `ai_sessions`. Ver ExecutionCost.ts.
  const closedForPersistenceRef = useRef<Array<{ id: string; exitPrice: number; pnl: number; costUsd: number; reason: 'TP' | 'SL' }>>([]);
  const hasHydratedFromSupabaseRef = useRef(false);

  // Preço sem dado real (`isRealData: false` — a conta MetaAPI de plataforma
  // compartilhada engasgou/retornou SIMULATED e nem havia último preço real em
  // cache) não deve virar entrada de trade nem ficar invisível ao usuário —
  // avisa no máximo 1x a cada 60s (evita flood do loop de análise).
  const lastStaleDataWarningAtRef = useRef(0);

  // === FASE 2: PERSISTÊNCIA DEMO NO SUPABASE ===
  const { user } = useAuth();
  // Falha de persistência é silenciosa por natureza (fire-and-forget, não trava o
  // loop de trading) — sem isso, um insert rejeitado (rede caiu, RLS etc.) some
  // sem o usuário nunca saber que a sessão/trade não foi salvo. Avisa 1x por
  // sessão (evita flood do loop de 1s) e reseta ao iniciar uma sessão nova.
  const persistenceErrorNotifiedRef = useRef(false);
  // 🆕 2026-08-21 (pedido do Cleber): "Parar IA" não fecha mais posições
  // abertas à força — só impede ABRIR posição nova (a sessão sai de RUNNING,
  // e em DEMO o servidor só abre entrada pra sessão RUNNING, ver guarda em
  // ~linha 1372). As posições que já estavam abertas continuam sendo
  // monitoradas por TP/SL pelo watchdog do `ai-runner`
  // (supabase/functions/ai-runner/index.ts, "posição OPEN cuja sessão não
  // está mais RUNNING") até fecharem naturalmente. Esse ref guarda o
  // intervalo que fica de olho nessas posições remanescentes depois do
  // Stop, já que a sessão é encerrada (endSession) e o polling normal de
  // reconciliação (linha ~964) só roda com `isActive=true`.
  const drainWatcherRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopDrainWatcher = useCallback(() => {
    if (drainWatcherRef.current) {
      clearInterval(drainWatcherRef.current);
      drainWatcherRef.current = null;
    }
  }, []);
  useEffect(() => stopDrainWatcher, [stopDrainWatcher]);
  const handlePersistenceError = useCallback((context: string, error: unknown) => {
    console.error(`[FASE 2] ❌ Falha de persistência (${context}):`, error);
    if (!persistenceErrorNotifiedRef.current) {
      persistenceErrorNotifiedRef.current = true;
      toast.warning('Falha ao salvar dados da sessão DEMO no servidor', {
        description: 'A negociação continua normalmente, mas o histórico desta sessão pode ficar incompleto.',
        duration: 8000,
      });
    }
  }, []);
  const persistence = useAIPersistence({
    enabled: executionMode === 'DEMO',
    autoSnapshot: false,
    onPersistenceError: handlePersistenceError,
  });
  // Ref sempre atualizado p/ ser lido dentro de intervals/callbacks sem precisar
  // adicionar `persistence` (objeto novo a cada render) nas dependências dos efeitos.
  const persistenceRef = useRef(persistence);
  // `addLog` só é declarado bem mais abaixo (precisa de `setRecentLogs`) —
  // esta ref existe pra que o efeito de reconciliação (logo depois da
  // hidratação, ainda mais acima de `addLog` no corpo da função) consiga
  // chamá-lo sem sofrer erro de "usado antes de declarado". Sincronizada
  // pelo próprio `addLog` assim que ele existe (ver comentário lá).
  const addLogRef = useRef<(message: string) => void>(() => {});
  useEffect(() => {
    persistenceRef.current = persistence;
  });

  // === MUTEX LOCK (Prevent Race Conditions) ===
  const mutexRef = useRef(false);

  // 🔥 PERFORMANCE FIX: Log de inicialização (EXECUTA APENAS UMA VEZ)
  // Movido para DEPOIS de todos os refs para respeitar Rules of Hooks
  useEffect(() => {
    console.log('🚀 [USE APEX LOGIC] Hook inicializado - 21 JAN 2026', {
      timestamp: new Date().toISOString(),
      features: [
        '✅ Anti-repetição de ativos (lastTradedSymbolRef)',
        '✅ Refs otimizados (Rules of Hooks)',
        '✅ SPX500 com API Real integrada',
        '🔥 PERFORMANCE FIX: Logs de render removidos'
      ]
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array vazio = executa apenas na montagem

  // 🔥 PERSISTÊNCIA: Salvar executionMode no localStorage sempre que mudar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('neural_execution_mode', executionMode);
      console.log(`[useApexLogic] 💾 Modo de execução salvo: ${executionMode}`);
      
      // 🔥 DESCONECTAR MT5 APENAS AO MUDAR PARA DEMO
      if (executionMode === 'DEMO' && isConnectedToMT5) {
        console.log('[useApexLogic] 🔌 Desconectando MT5 (modo alterado para DEMO)');
        setIsConnectedToMT5(false);
        setMT5AccountId(null);
        mt5AccountIdRef.current = null;
        toast.info('Desconectado do MT5 (modo DEMO ativado)');
      }
    }
  }, [executionMode, isConnectedToMT5]);

  // Update Refs Automatically
  useEffect(() => {
    configRef.current = { ...aiConfig, executionMode };
  }, [aiConfig, executionMode]);

  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);
  
  // Update marketRef when initialMarketContext changes
  useEffect(() => {
    if (initialMarketContext) {
      marketRef.current = initialMarketContext;
    }
  }, [initialMarketContext]);

  useEffect(() => {
    mt5CredentialsRef.current = mt5Credentials;
  }, [mt5Credentials]);

  useEffect(() => {
    mt5AccountIdRef.current = mt5AccountId;
  }, [mt5AccountId]);

  useEffect(() => {
    isSafeModeRef.current = isSafeMode;
  }, [isSafeMode]);

  // 🆕 FIX: config da IA (dailyLossLimit/maxDrawdown/minWinRate) nunca pode
  // interferir na operação manual do usuário ("Modo Livre" = IA desligada,
  // só boleta). Antes, o Health Check Guardian abaixo rodava e podia ativar
  // o Safe Mode mesmo com `isActive=false`, deixando o banner "SAFE MODE"
  // pipocando no Dashboard sem nenhuma IA rodando de fato. Ver uso deste ref
  // logo no início do interval do Health Check Guardian.
  useEffect(() => {
    isActiveRef.current = isActive;
    // Some da UI e libera o próximo `startLogic()` assim que a IA para —
    // "Sair do Safe Mode" nunca deveria ser necessário no Modo Livre.
    if (!isActive && isSafeModeRef.current) {
      setIsSafeMode(false);
      setSafeModeReason(null);
    }
  }, [isActive]);

  useEffect(() => {
    activeOrdersRef.current = activeOrders;
  }, [activeOrders]);

  useEffect(() => {
    pendingOrdersRef.current = pendingOrders;
  }, [pendingOrders]);

  useEffect(() => {
    orderHistoryRef.current = orderHistory;
  }, [orderHistory]);

  useEffect(() => {
    candleCounterRef.current = candlesSinceLastTrade;
  }, [candlesSinceLastTrade]);

  useEffect(() => {
    maxCandlesRef.current = maxCandlesBeforeForceEntry;
  }, [maxCandlesBeforeForceEntry]);

  // === PERSISTENCE ===
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: ApexLogicState = JSON.parse(saved);
        setIsActive(false); // Always start inactive
        setIsPaused(parsed.isPaused || false);
        setActiveOrders(parsed.activeOrders || []);
        setPortfolio(parsed.portfolio || INITIAL_STATE.portfolio);
        setOrderHistory(parsed.orderHistory || []);
        setHouseStats(parsed.houseStats || INITIAL_STATE.houseStats);
        setPerformanceMetrics(parsed.performanceMetrics || INITIAL_STATE.performanceMetrics);
        setHealthStatus(parsed.healthStatus || INITIAL_STATE.healthStatus);
        
        // ✅ MIGRAÇÃO: Merge aiConfig com valores padrão para propriedades novas
        const mergedAIConfig = {
          ...INITIAL_STATE.aiConfig,
          ...(parsed.aiConfig || {}),
        };
        setAIConfig(mergedAIConfig);
        
        setMT5Credentials(parsed.mt5Credentials || null);
        setExecutionMode(parsed.executionMode || 'DEMO');
        
        // 🔥 PERSISTÊNCIA DE CONEXÃO MT5: Restaurar estado de conexão
        setIsConnectedToMT5(parsed.isConnectedToMT5 || false);
        setMT5AccountId(parsed.mt5AccountId || null);
        
        // 🔥 Log de restauração de conexão
        if (parsed.isConnectedToMT5 && parsed.mt5AccountId) {
          console.log(`✅ [PERSISTÊNCIA] Conexão MT5 restaurada: Account ${parsed.mt5AccountId}`);
        }
        
        setIsSafeMode(parsed.isSafeMode || false);
        setSafeModeReason(parsed.safeModeReason || null);
        setCandlesSinceLastTrade(parsed.candlesSinceLastTrade || 0);
        setMaxCandlesBeforeForceEntry(parsed.maxCandlesBeforeForceEntry || 5);
        setEquityHistory(Array.isArray(parsed.equityHistory) ? parsed.equityHistory : []);
        assetExposureRef.current = parsed.assetExposure || {};
        lastAssetClassRef.current = parsed.lastAssetClass || null;
        cycleIntervalRef.current = parsed.cycleInterval || 60000;
      }
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
  }, []);

  // === FASE 2: HIDRATAÇÃO A PARTIR DO SUPABASE (fonte de verdade, sobrepõe o localStorage) ===
  // localStorage acima é só um cache rápido pro primeiro paint; assim que o usuário loga,
  // busca a sessão DEMO ativa no Supabase (se existir) e usa ela como estado real.
  useEffect(() => {
    if (!user?.id || hasHydratedFromSupabaseRef.current || executionMode !== 'DEMO') return;
    hasHydratedFromSupabaseRef.current = true;

    (async () => {
      // 🔴 FIX 2026-08-03 (achado do Cleber: "histórico só mostra as últimas
      // 3 ordens"): `orderHistory` nunca era hidratado do Supabase — só
      // acumulava trades fechados durante a aba/sessão de navegador atual
      // (mais o cache de localStorage). Trades fechados de sessões
      // anteriores existiam no banco (`ai_trades`) mas nunca apareciam na
      // tela de Performance. Roda independente de haver sessão ATIVA agora
      // (por isso fica fora do `if (!restored?.session) return` abaixo).
      try {
        const closedTrades = await persistenceRef.current.getUserTradeHistory();
        const closedOnly = closedTrades.filter(t => t.status === 'CLOSED');
        if (closedOnly.length > 0) {
          setOrderHistory(closedOnly.map((t): TradeVisual => ({
            id: t.id!,
            symbol: t.symbol,
            side: t.side,
            amount: t.quantity,
            price: t.entry_price,
            currentPrice: t.exit_price ?? t.entry_price,
            currentProfit: t.net_pnl ?? t.pnl ?? 0,
            closedAt: t.exit_time ? new Date(t.exit_time).getTime() : undefined,
            tp: t.take_profit ?? t.entry_price,
            sl: t.stop_loss ?? t.entry_price,
            originalSl: t.stop_loss ?? t.entry_price,
            leverage: 1.5, // não persistido em ai_trades; único valor usado hoje pelo motor
            ai_confidence: t.ai_confidence ?? 50,
            timestamp: new Date(t.entry_time).getTime(),
            reasoning: t.ai_reasoning || '',
            indicators: t.indicators_snapshot || { rsi: 50, macd: 'NEUTRAL', trend: 'NEUTRAL' },
          })));
          console.log(`[useApexLogic] ☁️ Histórico de trades restaurado do Supabase: ${closedOnly.length} trades fechados`);
        }
      } catch (e) {
        console.warn('[useApexLogic] Falha ao restaurar histórico de trades do Supabase (mantendo localStorage):', e);
      }

      try {
        let restored = await persistenceRef.current.restoreActiveSession();

        // 🔴 Ver nota em LAST_RESET_MARKER_KEY: se um Reset acabou de rodar
        // (marcador recente, mesma sessão ou sem id registrado) e o Supabase
        // ainda devolve essa sessão como RUNNING, é a janela de corrida do
        // `endSession` assíncrono ainda não confirmado — não é uma sessão
        // legítima. Ignora o dado (equity/posições antigos) e reforça o
        // encerramento em vez de restaurar.
        try {
          const rawMarker = localStorage.getItem(LAST_RESET_MARKER_KEY);
          if (rawMarker && restored?.session) {
            const marker = JSON.parse(rawMarker) as { t: number; sessionId: string | null };
            const isFresh = Date.now() - marker.t < RESET_MARKER_STALE_MS;
            const sameSession = !marker.sessionId || marker.sessionId === restored.session.id;
            if (isFresh && sameSession) {
              console.warn('[useApexLogic] ⚠️ Sessão RUNNING encontrada logo após Reset — descartando como resíduo de corrida e reforçando endSession.');
              persistenceRef.current.endSession(INITIAL_STATE.portfolio.balance, INITIAL_STATE.portfolio.equity);
              restored = null;
            }
          }
          if (!restored?.session) localStorage.removeItem(LAST_RESET_MARKER_KEY);
        } catch { /* ignore */ }

        if (!restored?.session) {
          // 🔴 FIX 2026-08-21 (achado do Cleber: "as posições ainda estão no
          // Dash mesmo após Hard Refresh" depois de um Reset feito em OUTRO
          // navegador/aba): sem sessão RUNNING no Supabase, este bloco nunca
          // tocava `activeOrders` — deixando o navegador confiar pra sempre
          // no cache de `localStorage` (hidratado sem checar nada, logo
          // acima), mesmo quando o Supabase (fonte de verdade em DEMO, ver
          // nota "CLIENTE PERDE AUTORIDADE" mais abaixo) diz que não há
          // posição legítima aberta. Em DEMO, sem sessão RUNNING não pode
          // haver posição real — qualquer coisa em `activeOrders` nesse
          // ponto é resíduo de cache de uma sessão já encerrada/pausada
          // alhures.
          setActiveOrders([]);
          // Mesmo raciocínio pra Curva de Equity (achado 2026-08-21, mesma
          // sessão): sem sessão RUNNING, qualquer `equityHistory` em memória
          // é resíduo de cache local de uma sessão já encerrada — inclusive
          // de um Reset feito em outro navegador/aba, que nunca teve como
          // limpar o `localStorage` daqui.
          setEquityHistory([]);
          // 🆕 FIX 2026-08-20 (achado do Cleber: "desliguei a IA e ela voltou
          // pro zero, preciso ver evolução real de capital ao longo do
          // tempo"): sem sessão RUNNING pra restaurar, o portfolio ficava no
          // INITIAL_STATE ($100 fixo) até o próximo "Iniciar AI" — que por
          // sua vez usa `portfolioRef.current.balance` como saldo inicial da
          // sessão nova (useApexLogic.ts, startLogic), descartando o
          // resultado real da sessão anterior. Continuidade de capital entre
          // sessões DEMO é decisão de produto explícita: cada sessão deve
          // herdar o saldo final da última encerrada, não recomeçar do zero.
          try {
            const lastCompleted = await persistenceRef.current.getLastCompletedSession('DEMO');
            if (lastCompleted?.final_balance != null) {
              setPortfolio(prev => ({
                ...prev,
                balance: lastCompleted.final_balance!,
                equity: lastCompleted.final_equity ?? lastCompleted.final_balance!,
                peakEquity: Math.max(prev.peakEquity ?? 0, lastCompleted.final_equity ?? lastCompleted.final_balance!),
                dayAnchorEquity: lastCompleted.final_equity ?? lastCompleted.final_balance!,
                dayAnchorBalance: lastCompleted.final_balance!,
                dayAnchorUtcDay: 0,
              }));
              console.log(`[useApexLogic] ☁️ Capital herdado da última sessão encerrada: $${lastCompleted.final_balance}`);
            }
          } catch (e) {
            console.warn('[useApexLogic] Falha ao herdar capital da última sessão encerrada:', e);
          }
          return;
        }

        const { session, openTrades, lastSnapshot } = restored;

        // 🔴 FIX 2026-08-07 (achado do Cleber: "liguei a IA, fechei o app,
        // voltei e estava desligada"): `restoreActiveSession()` só existe se
        // já filtrou `status='RUNNING'` no Supabase (getActiveSession, em
        // AITradingPersistenceService.ts), mas até aqui essa hidratação só
        // repopulava portfolio/trades — nunca ligava o toggle visual. O
        // motor real (runner server-side) continuava rodando a sessão o
        // tempo todo; só a tela mentia que estava desligada. `setIsActive`
        // de mais acima (localStorage, "Always start inactive") é
        // sobrescrito aqui de propósito porque o Supabase é a fonte de
        // verdade, não o cache local.
        setIsActive(true);

        // Sessão restaurada (não uma nova) — o "início" pro gate de perda
        // diária é quando ELA começou, não agora (senão um reload no meio
        // do dia resetaria o relógio indevidamente).
        if (session.created_at) {
          sessionStartedAtRef.current = new Date(session.created_at).getTime();
        }

        if (openTrades.length > 0) {
          setActiveOrders(openTrades.map((t): TradeVisual => ({
            id: t.id!, // id do banco vira o id local (onTradeClose cai no fallback e usa o mesmo id)
            symbol: t.symbol,
            side: t.side,
            amount: t.quantity,
            price: t.entry_price,
            currentPrice: t.entry_price,
            tp: t.take_profit ?? t.entry_price,
            sl: t.stop_loss ?? t.entry_price,
            originalSl: t.stop_loss ?? t.entry_price,
            leverage: 1.5, // não persistido em ai_trades; único valor usado hoje pelo motor
            ai_confidence: t.ai_confidence ?? 50,
            timestamp: new Date(t.entry_time).getTime(),
            reasoning: t.ai_reasoning || '',
            indicators: t.indicators_snapshot || { rsi: 50, macd: 'NEUTRAL', trend: 'NEUTRAL' },
          })));
        }

        if (lastSnapshot) {
          setPortfolio(prev => ({
            ...prev,
            balance: lastSnapshot.balance,
            equity: lastSnapshot.equity,
            currentDrawdown: lastSnapshot.drawdown || 0,
            maxDrawdownReached: Math.max(prev.maxDrawdownReached ?? 0, lastSnapshot.drawdown || 0),
            // Re-semeia as âncoras de drawdown a partir do equity restaurado.
            // Sem isso, depois de um reload o peak/âncora diária ficariam no
            // valor default (100) e o drawdown sairia absurdo no primeiro tick.
            peakEquity: Math.max(prev.peakEquity ?? lastSnapshot.equity, lastSnapshot.equity),
            dayAnchorEquity: lastSnapshot.equity,
            dayAnchorBalance: lastSnapshot.balance,
            dayAnchorUtcDay: 0, // força re-ancoragem no próximo tick do dia corrente
          }));
        }

        // Curva de equity real: reconstrói a partir dos snapshots já
        // persistidos desta sessão (nunca mock) — dá continuidade depois de
        // um reload, em vez de a curva "zerar" e mostrar 1 ponto só.
        try {
          // O hook useAIPersistence expõe esses snapshots como getEquityCurve()
          // (que internamente chama aiPersistence.getSessionSnapshots). Chamar
          // getSessionSnapshots aqui dava undefined em runtime — o TypeError caía
          // no catch abaixo e a curva de equity nunca reconstruía após um reload.
          const sessionSnapshots = await persistenceRef.current.getEquityCurve(session.id);
          if (sessionSnapshots.length > 0) {
            setEquityHistory(
              sessionSnapshots
                .map(s => ({ t: new Date(s.timestamp).getTime(), equity: s.equity }))
                .slice(-MAX_EQUITY_POINTS)
            );
          }
        } catch (e) {
          console.warn('[useApexLogic] Falha ao restaurar curva de equity real:', e);
        }

        if (!lastSnapshot && session.initial_balance) {
          setPortfolio(prev => ({
            ...prev,
            balance: session.initial_balance!,
            equity: session.initial_equity ?? session.initial_balance!,
          }));
        }

        console.log(`[useApexLogic] ☁️ Sessão DEMO restaurada do Supabase: ${session.id} (${openTrades.length} posições abertas)`);
      } catch (e) {
        console.warn('[useApexLogic] Falha ao restaurar sessão DEMO do Supabase (mantendo localStorage):', e);
      }
    })();
  }, [user, executionMode]);

  // === POLLING DE RECONCILIAÇÃO DEMO (2026-08-17) ===
  // Desde o fix do "motor duplo" (2026-08-17, ver histórico), o navegador não
  // abre mais posição por conta própria em modo DEMO — só o runner de
  // servidor decide. Isso deixou uma ponta solta: o efeito de hidratação
  // acima só roda UMA VEZ por montagem (`hasHydratedFromSupabaseRef`), sem
  // assinatura em tempo real pra `ai_trades`. Resultado: a tela congela no
  // que existia no instante do primeiro carregamento — o runner pode abrir
  // (e fechar) posições reais no banco e a UI nunca mostra, porque nada a
  // avisa. Achado ao vivo: 2 entradas reais confirmadas em `ai_trades`
  // (status OPEN) que não apareciam na tela. Corrigido com o jeito mais
  // simples e seguro: enquanto a IA está ativa em modo DEMO, repuxa as
  // posições abertas da sessão do Supabase (fonte de verdade) periodicamente
  // e substitui `activeOrders` — seguro porque em DEMO o navegador nunca mais
  // escreve posição própria, então não há risco de pisar em estado local que
  // o servidor não conhece.
  //
  // 2026-08-17 (mesmo dia, achado logo depois do fix acima): o painel "Logs
  // do Sistema" da tela (`AITrader.tsx`, lê `recentLogs`) só recebe linha via
  // `addLog()`, chamado de dentro do efeito `LOG` do `runTradingCycle` — que
  // só roda quando o ciclo executa NO NAVEGADOR. Com o motor duplo desligado,
  // esse painel fica preso em "Nenhuma atividade ainda..." pra sempre em
  // DEMO, mesmo com a IA operando de verdade no servidor (achado ao vivo: 2
  // posições reais abertas, painel vazio). O painel "Terminal"
  // (`LiveLogTerminal.tsx`) não tem esse problema porque deriva log de
  // `activeOrders` mudando — mesma fonte que este polling já atualiza.
  // Reaproveitado aqui: loga quando este polling detecta um `id` de posição
  // que não existia no estado anterior.
  // 2026-08-20: o polling fixo de 15s (ver histórico do bloco de comentário
  // acima) tinha uma falha real observada — quando `isActive` estava false
  // no momento em que o servidor fechou uma posição, a reconciliação nem
  // rodava, e a tela ficou mostrando uma posição já fechada por bem mais que
  // 15s. Trocado por Supabase Realtime (`postgres_changes` em `ai_trades`,
  // filtrado por `session_id` via RLS) — reconcilia assim que o servidor
  // grava a mudança, não em ciclos fixos. Polling mantido como fallback
  // (agora 30s, só rede de segurança) caso a subscription caia e não
  // reconecte. Requer `ai_trades` na publication `supabase_realtime` —
  // ver supabase/migrations/20260820_add_ai_trades_to_realtime.sql.
  useEffect(() => {
    if (!isActive || executionMode !== 'DEMO') return;

    const POLL_MS = 30_000;
    let cancelled = false;

    const reconcile = async () => {
      const sessionId = persistenceRef.current.getSessionId();
      if (!sessionId) return;
      try {
        const trades = await persistenceRef.current.getSessionTrades(sessionId);
        if (cancelled) return;
        const open = trades.filter(t => t.status === 'OPEN');
        setActiveOrders(prev => {
          // Preserva `currentPrice`/`currentProfit` já calculados localmente
          // pro tick de PnL (linha ~1235) — só sincroniza QUAIS posições
          // existem e seus dados de abertura, não sobrescreve o preço ao vivo.
          const prevById = new Map(prev.map(o => [o.id, o]));
          for (const t of open) {
            if (!prevById.has(t.id!)) {
              addLogRef.current(`✅ ENTRADA ${t.side}: ${t.symbol} @ $${t.entry_price.toFixed(2)} (aberta pelo servidor)`);
            }
          }
          return open.map((t): TradeVisual => {
            const existing = prevById.get(t.id!);
            return {
              id: t.id!,
              symbol: t.symbol,
              side: t.side,
              amount: t.quantity,
              price: t.entry_price,
              currentPrice: existing?.currentPrice ?? t.entry_price,
              currentProfit: existing?.currentProfit,
              tp: t.take_profit ?? t.entry_price,
              sl: t.stop_loss ?? t.entry_price,
              originalSl: existing?.originalSl ?? t.stop_loss ?? t.entry_price,
              leverage: 1.5,
              ai_confidence: t.ai_confidence ?? 50,
              timestamp: new Date(t.entry_time).getTime(),
              reasoning: t.ai_reasoning || '',
              indicators: t.indicators_snapshot || { rsi: 50, macd: 'NEUTRAL', trend: 'NEUTRAL' },
            };
          });
        });
      } catch (e) {
        console.warn('[useApexLogic] Falha ao reconciliar posições abertas do Supabase:', e);
      }

      // 🆕 2026-08-18: junto com a perda de autoridade de fechamento do
      // cliente (ver PNL LOOP acima), o balance também precisa vir do
      // servidor agora — sem isto o Dashboard ficaria travado no valor de
      // quando a IA foi ligada, já que o cliente parou de recalcular balance
      // a partir de fechamento próprio. `getEquityCurve` reaproveita o mesmo
      // endpoint já usado pra reconstruir a curva de equity no mount
      // (`getSessionSnapshots`); pega só o snapshot mais recente.
      try {
        const snapshots = await persistenceRef.current.getEquityCurve(sessionId);
        if (cancelled || snapshots.length === 0) return;
        const latest = snapshots[snapshots.length - 1];
        setPortfolio(prev => {
          if (prev.balance === latest.balance && prev.equity === latest.equity) return prev;
          return {
            ...prev,
            balance: latest.balance,
            // Equity fica só de referência aqui — o PNL LOOP recalcula equity
            // real (balance + não-realizado ao vivo) no próximo tick usando o
            // balance recém-sincronizado.
            equity: latest.equity,
            currentDrawdown: latest.drawdown || 0,
          };
        });
      } catch (e) {
        console.warn('[useApexLogic] Falha ao reconciliar balance do Supabase:', e);
      }

      if (!cancelled) setLastPositionSyncAt(Date.now());
    };

    reconcile();
    const interval = setInterval(reconcile, POLL_MS);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const sessionId = persistenceRef.current.getSessionId();
      if (!sessionId || cancelled) return;
      channel = supabase
        .channel(`ai-trades-sync-${sessionId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ai_trades', filter: `session_id=eq.${sessionId}` },
          () => { if (!cancelled) reconcile(); }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[useApexLogic] Realtime de ai_trades falhou, seguindo só com polling de fallback:', status);
          }
        });
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [isActive, executionMode]);

  // 🔒 TÓPICO 7 (hardening): sincroniza os thresholds de risco com o servidor
  // (KV store, ver /server/risk-config) sempre que o usuário logado mudar
  // esses valores no aiConfig. A rota /broker/execute usa exclusivamente essa
  // config server-side — nunca confia em thresholds vindos do client no body
  // da requisição — então sem essa sincronização a Edge Function ficaria
  // presa nos defaults conservadores, ignorando a config real do usuário.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { error } = await supabase.functions.invoke('server/risk-config', {
          method: 'POST',
          body: {
            maxDailyLossPercent: aiConfig.dailyLossLimit,
            maxDrawdownPercent: aiConfig.maxDrawdown,
            maxPositionSizePercent: aiConfig.riskPerTrade,
            killSwitchThreshold: aiConfig.killSwitchThreshold || 0,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        console.log('[useApexLogic] 🔒 Config de risco sincronizada com o servidor');
      } catch (e) {
        if (!cancelled) {
          console.warn('[useApexLogic] ⚠️ Falha ao sincronizar config de risco com o servidor (enforcement server-side usará valor anterior ou default conservador):', e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, aiConfig.dailyLossLimit, aiConfig.maxDrawdown, aiConfig.riskPerTrade, aiConfig.killSwitchThreshold]);

  useEffect(() => {
    const state: ApexLogicState = {
      isActive,
      isPaused,
      activeOrders,
      portfolio,
      recentLogs,
      orderHistory,
      marketContext: marketRef.current,
      houseStats,
      performanceMetrics,
      healthStatus,
      aiConfig,
      mt5Credentials,
      executionMode,
      cycleInterval: cycleIntervalRef.current,
      isRunningCycle: isRunningCycleRef.current,
      isWaitingNewCandle: isWaitingNewCandleRef.current,
      lastTradeTimestamp: lastTradeTimestampRef.current,
      isConnectedToMT5,
      mt5AccountId,
      lastMT5SyncTime: lastMT5SyncRef.current,
      failedMT5Attempts: failedMT5AttemptsRef.current,
      assetExposure: assetExposureRef.current,
      lastAssetClass: lastAssetClassRef.current,
      isSafeMode,
      safeModeReason,
      candlesSinceLastTrade,
      maxCandlesBeforeForceEntry,
      equityHistory,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    isActive, isPaused, activeOrders, portfolio, recentLogs, orderHistory,
    houseStats, performanceMetrics, healthStatus, aiConfig, mt5Credentials,
    executionMode, isConnectedToMT5, mt5AccountId, isSafeMode, safeModeReason, equityHistory,
    candlesSinceLastTrade, maxCandlesBeforeForceEntry
  ]);

  // === METRICS CALCULATION ===
  useEffect(() => {
    if (orderHistory.length === 0) return;

    const closedTrades = orderHistory.filter(t => t.closedAt);
    const wins = closedTrades.filter(t => (t.currentProfit || 0) > 0).length;
    const losses = closedTrades.filter(t => (t.currentProfit || 0) < 0).length;
    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    const totalProfit = closedTrades.reduce((acc, t) => acc + (t.currentProfit || 0), 0);
    const totalWins = closedTrades
      .filter(t => (t.currentProfit || 0) > 0)
      .reduce((acc, t) => acc + (t.currentProfit || 0), 0);
    const totalLosses = Math.abs(
      closedTrades
        .filter(t => (t.currentProfit || 0) < 0)
        .reduce((acc, t) => acc + (t.currentProfit || 0), 0)
    );
    const avgWin = wins > 0 ? totalWins / wins : 0;
    const avgLoss = losses > 0 ? totalLosses / losses : 0;

    const avgHoldTime = closedTrades.reduce((acc, t) => {
      if (t.closedAt && t.timestamp) {
        return acc + (t.closedAt - t.timestamp);
      }
      return acc;
    }, 0) / (closedTrades.length || 1);

    const bestTrade = Math.max(...closedTrades.map(t => t.currentProfit || 0), 0);
    const worstTrade = Math.min(...closedTrades.map(t => t.currentProfit || 0), 0);

    setPerformanceMetrics({
      totalTrades: closedTrades.length,
      winRate,
      // A interface PerformanceMetrics declara totalPnL/avgWin/avgLoss, mas este
      // objeto escrevia 'totalProfit' (campo inexistente) e simplesmente não
      // passava avgWin/avgLoss — que já eram calculados logo acima e descartados.
      // Os três campos ficavam undefined em runtime para quem lesse a métrica.
      totalPnL: totalProfit,
      avgWin,
      avgLoss,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0,
      sharpeRatio: 0, // Simplified
      // Métrica histórica: o PIOR drawdown já atingido, não o drawdown do momento
      // (currentDrawdown agora recupera quando a conta recupera, por design).
      maxDrawdown: portfolio.maxDrawdownReached ?? portfolio.currentDrawdown,
      avgHoldTime: avgHoldTime / 1000 / 60, // minutes
      bestTrade,
      worstTrade,
    });
  }, [orderHistory, portfolio.maxDrawdownReached]);

  // === LOG HELPER (MUST BE BEFORE ANY useEffect THAT USES IT) ===
  const addLog = useCallback((message: string) => {
    setRecentLogs((prev) => [message, ...prev].slice(0, 50));
  }, []);
  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

  // === HEALTH CHECK (Every 5 seconds) ===
  useEffect(() => {
    const interval = setInterval(() => {
      // 🆕 FIX: config de risco da IA (dailyLossLimit/maxDrawdown/minWinRate)
      // NUNCA pode interferir no Modo Livre (usuário operando manual, sem a IA
      // ligada). Antes este check rodava incondicionalmente a cada 5s e podia
      // ativar o Safe Mode mesmo sem nenhuma IA rodando — a boleta manual já
      // nunca era bloqueada de fato (ver openManualPosition), mas o Safe Mode
      // disparava e ficava mostrado no Dashboard mesmo assim, dando a
      // impressão errada de que a operação livre estava sob restrição da IA.
      if (!isActiveRef.current) {
        setHealthStatus({ isHealthy: true, lastCheckTimestamp: Date.now(), issues: [] });
        return;
      }

      // 🔒 2026-08-18: em modo DEMO quem decide abrir/fechar posição é o
      // `ai-runner` no servidor (via pg_cron), não este loop do navegador —
      // ver o comentário do "SAFE MODE GUARDIAN" mais abaixo. Um Safe Mode
      // disparado aqui só pausa o `isActive` local e mostra o banner: não
      // pausa o motor real, que segue tickando e abrindo posição normalmente
      // (confirmado ao vivo em 2026-08-18: trade novo aberto pelo servidor
      // enquanto o banner "SAFE MODE ATIVADO" já estava na tela). Resultado
      // líquido era só assustar o usuário em fase de teste/demonstração, sem
      // nenhuma proteção de verdade por trás — decisão do Cleber: não avaliar
      // Safe Mode em DEMO. Em LIVE isso permanece ativo (dinheiro real,
      // execução real fica sob controle deste mesmo navegador).
      if (configRef.current.executionMode === 'DEMO') {
        setHealthStatus({ isHealthy: true, lastCheckTimestamp: Date.now(), issues: [] });
        return;
      }

      const issues: string[] = [];

      // Check Balance
      if (portfolioRef.current.balance <= 0) {
        issues.push('Balance zerado ou negativo');
        console.log('[HEALTH CHECK] ⚠️ Balance zerado:', portfolioRef.current.balance);
      }

      // Check Drawdown
      if (portfolioRef.current.currentDrawdown > configRef.current.maxDrawdown) {
        issues.push(`Drawdown excedido: ${portfolioRef.current.currentDrawdown.toFixed(2)}%`);
        console.log('[HEALTH CHECK] ⚠️ Drawdown excedido:', portfolioRef.current.currentDrawdown);
      }

      // Check MT5 Connection (ONLY if LIVE mode - DEMO não precisa)
      if (configRef.current.executionMode === 'LIVE' && !isConnectedToMT5) {
        issues.push('Desconectado do MT5');
        console.log('[SAFE MODE] ⚠️ MT5 desconectado em modo LIVE');
      }

      // 🔒 RESPEITAR CONFIG DO USUÁRIO: dailyLossLimit (%). Antes esse campo era
      // salvo mas nunca lido - a IA podia perder além do limite diário sem parar
      // (só existia o maxDrawdown, que é acumulado desde o início, não resetado por dia).
      const nowDate = new Date();
      const startOfUtcDay = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
      // FIX 2026-08-03: `orderHistory` agora hidrata trades fechados de TODAS
      // as sessões do dia (fix do histórico no Supabase, mesmo dia) — sem o
      // corte por `sessionStartedAtRef`, um reset explícito de conta
      // (`resetLogic`) não reiniciava o relógio da perda diária, e P&L de
      // tentativas já descartadas pelo próprio usuário (inclusive dado
      // histórico corrompido de bugs já corrigidos) continuava pesando
      // contra a sessão atual. Ver `sessionStartedAtRef` pra detalhe.
      const dailyGateCutoff = Math.max(startOfUtcDay, sessionStartedAtRef.current);
      const closedToday = orderHistoryRef.current.filter(t => t.closedAt && t.closedAt >= dailyGateCutoff);
      const dailyPnL = closedToday.reduce((acc, t) => acc + (t.currentProfit || 0), 0);
      const dailyBase = portfolioRef.current.initialBalance || configRef.current.allocatedCapital || 100;
      const dailyLossPercent = dailyPnL < 0 ? (Math.abs(dailyPnL) / dailyBase) * 100 : 0;

      if (dailyLossPercent > configRef.current.dailyLossLimit) {
        issues.push(`Limite de perda diária excedido: -${dailyLossPercent.toFixed(2)}% (limite ${configRef.current.dailyLossLimit}%)`);
        console.log('[HEALTH CHECK] ⚠️ Limite de perda diária excedido:', dailyLossPercent.toFixed(2), '%');
      }

      // 🔒 RESPEITAR CONFIG DO USUÁRIO: minWinRate (%). Antes esse campo era salvo
      // mas nunca lido - a IA continuava abrindo posições mesmo com taxa de acerto
      // consistentemente abaixo do mínimo que o usuário definiu como aceitável.
      // Só avalia com uma amostra mínima de trades fechados, pra não pausar a IA
      // logo nos primeiros trades por puro acaso estatístico.
      // 🔴 FIX 2026-08-04: usava `orderHistoryRef.current` inteiro (todo o
      // histórico hidratado do Supabase, de qualquer sessão passada) em vez
      // de `closedToday`/`dailyGateCutoff` como o gate de perda diária logo
      // acima. Resultado: uma conta com >=10 trades perdedores de testes
      // antigos ficava permanentemente em Safe Mode — a IA era desligada em
      // até 5s a cada tentativa de ligar, sem nunca conseguir gerar trade
      // novo pra recalcular a taxa (deadlock). Agora usa a mesma janela
      // (reseta com `resetLogic`/virada de dia UTC), igual ao gate de perda.
      const MIN_SAMPLE_FOR_WIN_RATE_CHECK = 10;
      const winRateSample = closedToday;
      if (winRateSample.length >= MIN_SAMPLE_FOR_WIN_RATE_CHECK) {
        const wins = winRateSample.filter(t => (t.currentProfit || 0) > 0).length;
        const currentWinRate = (wins / winRateSample.length) * 100;
        if (currentWinRate < configRef.current.minWinRate) {
          issues.push(`Taxa de acerto abaixo do mínimo: ${currentWinRate.toFixed(1)}% (mínimo ${configRef.current.minWinRate}%)`);
          console.log('[HEALTH CHECK] ⚠️ Taxa de acerto abaixo do mínimo:', currentWinRate.toFixed(1), '%');
        }
      }

      setHealthStatus({
        isHealthy: issues.length === 0,
        lastCheckTimestamp: Date.now(),
        issues,
      });

      // Auto Safe Mode
      if (issues.length > 0 && !isSafeModeRef.current) {
        setIsSafeMode(true);
        setSafeModeReason(issues.join(', '));
        setIsActive(false);
        toast.error(`🚨 SAFE MODE ATIVADO: ${issues.join(', ')}`);

        // 🔴 FIX 2026-07-31 (auditoria 2026-07-30): safe mode em modo LIVE
        // só bloqueava trade NOVO — posição já aberta na corretora ficava
        // sem gestão automática. Agora fecha de fato na MetaAPI.
        if (configRef.current.executionMode === 'LIVE') {
          forceCloseAllLivePositions().then((result) => {
            if (result.closed) {
              addLog(`🔴 SAFE MODE: posições LIVE fechadas na corretora (${result.attempts} tentativa(s))`);
            } else {
              addLog(`🚨 FALHA AO FECHAR POSIÇÕES LIVE: ${result.lastError || 'motivo desconhecido'} — intervenção manual necessária`);
              toastOriginal.error('🚨 FALHA AO FECHAR POSIÇÕES LIVE NA CORRETORA', {
                description: `Feche manualmente na corretora. Motivo: ${result.lastError || 'desconhecido'}`,
                duration: 0,
              });
            }
          });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnectedToMT5]);

  // === TELEMETRIA DE FUNIL: desligamento ===
  // Efeito PRÓPRIO, separado do loop de trading de propósito. O useEffect do
  // loop tem `activeOrders.length` nas dependências, então ele remonta a cada
  // abertura/fechamento de posição — parar a telemetria no cleanup dele
  // descarregaria janelas pela metade e picotaria o funil em fragmentos.
  // Aqui só reage ao que de fato significa "a IA parou".
  useEffect(() => {
    if (!isActive) funnelTelemetry.stop();
    return () => { funnelTelemetry.stop(); };
  }, [isActive]);

  // === SAFE MODE GUARDIAN (Check before ANY trade) ===
  useEffect(() => {
    console.log(`[TRADING] 📊 Status: isActive=${isActive}, isPaused=${isPaused}, isSafeMode=${isSafeMode}`);
    
    if (!isActive || isPaused) {
      console.log('[TRADING] ⏸️ AI está pausada ou inativa - não iniciando loop de trading');
      return;
    }

    // 🔒 2026-08-17: em modo DEMO, `useAIPersistence` (linha ~484) sempre cria/
    // reaproveita uma linha em `ai_sessions` — e É EXATAMENTE essa mesma linha
    // que o `pg_cron` entrega ao runner de servidor (`ai-runner`) a cada
    // minuto, independente da aba estar aberta. Rodar este loop TAMBÉM aqui
    // no navegador não é redundância inofensiva: os dois processos avaliavam
    // e decidiam sobre a MESMA sessão ao mesmo tempo, sem nenhuma exclusão
    // mútua — medido em produção, o mesmo candidato (ex: XAUUSD) sendo
    // reavaliado 3-5x em 18 segundos, o dobro de chamadas à MetaAPI
    // compartilhada, e risco real de duas entradas na mesma oportunidade (cada
    // processo só vê o `activeOrders` da SUA própria memória, não do outro).
    // Achado ao vivo em 2026-08-17 (sessão af1453a2), decisão do Cleber:
    // desligar a decisão local, deixar só o runner de servidor decidir. O
    // navegador continua mostrando o estado (portfolio/posições) via
    // hidratação do Supabase — só para de ABRIR posição por conta própria.
    // Em modo LIVE isso NÃO se aplica: a ponte de execução real ainda depende
    // de estágios opt-in específicos do navegador, fora de escopo desta
    // mudança — não mexer sem pedido explícito.
    if (executionMode === 'DEMO') {
      console.log('[TRADING] 🌐 Modo DEMO: decisão de entrada é do runner de servidor (ai-runner via pg_cron) — navegador não abre posição por conta própria.');
      return;
    }

    console.log('[TRADING] 🚀 Sistema de Trading AI ATIVADO - Procurando oportunidades...');

    // 🚀 OTIMIZAÇÃO #4: Conectar WebSocket para cryptos (TEMPO REAL!)
    const connectWebSocket = async () => {
      try {
        const { getBinanceWebSocketManager } = await import('@/app/services/BinanceWebSocketManager');
        const wsManager = getBinanceWebSocketManager();
        wsManagerRef.current = wsManager;

        // Conectar aos principais cryptos
        const cryptoSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'ADAUSDT'];
        wsManager.connect(cryptoSymbols);
        
        console.log('[WebSocket] 🔌 Conectando aos cryptos:', cryptoSymbols);
      } catch (error) {
        console.warn('[WebSocket] ⚠️ Erro ao conectar WebSocket (usando REST como fallback):', error);
      }
    };
    
    connectWebSocket();

    // 🚀 OTIMIZAÇÃO #2: Função para buscar VIX com cache (USANDO vixDataSources!)
    const fetchVIXCached = async () => {
      const now = Date.now();
      if (now - lastVIXFetchRef.current < VIX_CACHE_DURATION && cachedVIXRef.current > 0) {
        console.log(`[VIX CACHE] ✅ Usando VIX em cache: ${cachedVIXRef.current.toFixed(2)}`);
        return cachedVIXRef.current;
      }

      try {
        // ✅ USAR vixDataSources.ts ao invés de Yahoo Finance direto
        const { fetchVIXData } = await import('@/app/utils/vixDataSources');
        const vixData = await fetchVIXData();

        // 🔒 2026-08-21: `fetchVIXData` devolve um valor FABRICADO
        // (`dataQuality: 'FALLBACK'`, ~18.71 ± ruído aleatório) quando as 3
        // fontes reais falham — nunca alimentar isso no motor (TailRiskGuard
        // reagiria, ou deixaria de reagir, a um número inventado como se
        // fosse VIX real). Mantém o último valor REAL em cache em vez de
        // sobrescrever com a fabricação.
        if (vixData.dataQuality === 'FALLBACK') {
          console.warn('[VIX] ⚠️ Todas as fontes reais falharam — descartando fallback fabricado, mantendo último VIX real em cache');
          return cachedVIXRef.current;
        }

        cachedVIXRef.current = vixData.value;
        lastVIXFetchRef.current = now;
        console.log(`[VIX] 🔄 VIX atualizado: ${cachedVIXRef.current.toFixed(2)} (Fonte: ${vixData.source})`);
        return cachedVIXRef.current;
      } catch (error) {
        // 🔒 2026-08-21: sem fallback fabricado aqui também — `0` é o
        // contrato que o chamador (`state.cachedVIX > 0 ? ... : null`) já
        // trata como "sem VIX disponível", nunca um número inventado.
        console.warn('[VIX] ⚠️ Erro ao buscar VIX, usando último valor real em cache (sem fabricar)');
        return cachedVIXRef.current;
      }
    };

    // 🔒 RESPEITAR CONFIG DO USUÁRIO: newsFilter (pausar entradas perto de notícias
    // econômicas de alto impacto). Antes esse campo era salvo mas nunca lido.
    const fetchNewsCached = async () => {
      const now = Date.now();
      if (now - lastNewsFetchRef.current < NEWS_CACHE_DURATION) {
        return cachedNewsEventsRef.current;
      }
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data, error } = await supabase.functions.invoke('server/economic-calendar');
        if (error) throw error;
        const events = (data?.events || []).map((e: any) => ({
          time: new Date(e.time || e.event_time || e.Date || e.date).getTime(),
          impact: String(e.impact || e.importance || '').toLowerCase(),
          currency: String(e.currency || '').toUpperCase(),
        })).filter((e: any) => !isNaN(e.time));
        cachedNewsEventsRef.current = events;
        lastNewsFetchRef.current = now;
        if (events.length === 0) {
          console.log('[NEWS FILTER] ℹ️ Nenhum evento retornado pelo calendário econômico (ver limitação conhecida no código)');
        }
        return events;
      } catch (error) {
        console.warn('[NEWS FILTER] ⚠️ Erro ao buscar calendário econômico, seguindo sem filtro neste ciclo:', error);
        return cachedNewsEventsRef.current;
      }
    };

    // Aplica um efeito devolvido por `runTradingCycle` (módulo puro,
    // src/app/services/strategy/runTradingCycle.ts) no estado React deste
    // driver. O driver servidor (runner Deno, próximo passo) aplica os
    // mesmos efeitos de outro jeito (sem React) — é isso que torna o motor
    // reaproveitável nos dois lugares.
    const applyTradingCycleEffect = (effect: TradingCycleEffect) => {
      switch (effect.type) {
        case 'ADD_ORDER':
          setActiveOrders(prev => [...prev, effect.trade]);
          break;
        case 'CLOSE_ALL_ORDERS':
          setActiveOrders([]);
          break;
        case 'SET_ACTIVE':
          setIsActive(effect.value);
          break;
        case 'SET_SAFE_MODE':
          setIsSafeMode(effect.value);
          if (effect.reason !== undefined) setSafeModeReason(effect.reason);
          break;
        case 'LOG':
          addLog(effect.message);
          break;
        case 'TOAST_SUCCESS':
          toastOriginal.success(effect.title, { description: effect.description, duration: effect.duration });
          break;
        case 'TOAST_WARNING':
          toastOriginal.warning(effect.title, { description: effect.description, duration: effect.duration });
          break;
        case 'TOAST_ERROR':
          toastOriginal.error(effect.title, { description: effect.description, duration: effect.duration });
          break;
      }
    };

    const fetchJarvisMultiplierCached = async () => {
      const now = Date.now();
      if (now - lastJarvisMultiplierFetchRef.current < JARVIS_MULTIPLIER_CACHE_DURATION) {
        return cachedJarvisMultiplierRef.current;
      }
      lastJarvisMultiplierFetchRef.current = now;
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        cachedJarvisMultiplierRef.current = await fetchJarvisSizeMultiplier(supabase);
      } catch (error) {
        console.warn('[JARVIS] ⚠️ Erro ao buscar multiplicador de tamanho, seguindo neutro (1x) neste ciclo:', error);
      }
      return cachedJarvisMultiplierRef.current;
    };

    const tradingInterval = setInterval(() => {
      (async () => {
      const jarvisSizeMultiplier = await fetchJarvisMultiplierCached();
      runTradingCycle(
        {
          activeOrders,
          aiConfig: configRef.current,
          portfolio: portfolioRef.current,
          orderHistory: orderHistoryRef.current,
          lastTradeTimestamp: lastTradeTimestampRef.current,
          lastTradedSymbol: lastTradedSymbolRef.current,
          cooldownUntil: cooldownUntilRef.current,
          lastStaleDataWarningAt: lastStaleDataWarningAtRef.current,
          cachedNewsEvents: cachedNewsEventsRef.current,
          cachedVIX: cachedVIXRef.current,
        },
        {
          strategies: strategiesRef.current,
          executionMode: configRef.current.executionMode,
          telemetrySessionId: persistenceRef.current.getSessionId(),
          userId: user?.id,
          candleBuffer: candleBufferRef.current,
          persistence: persistenceRef.current,
          onLiveDecision: onLiveDecisionRef.current,
          fetchNewsCached,
          fetchVIXCached,
          getWsPrice: (symbol: string) => {
            const wsManager = wsManagerRef.current;
            if (!wsManager || !wsManager.isConnected()) return null;
            const wsPrice = wsManager.getPrice(symbol);
            if (!wsPrice) return null;
            return {
              price: wsPrice.price,
              changePercent24h: wsPrice.priceChangePercent,
              change24h: wsPrice.priceChange,
              volume: wsPrice.volume,
              timestamp: wsPrice.timestamp,
            };
          },
          applyEffect: applyTradingCycleEffect,
          jarvisSizeMultiplier,
        },
      ).then((result) => {
        lastTradeTimestampRef.current = result.nextLastTradeTimestamp;
        lastTradedSymbolRef.current = result.nextLastTradedSymbol;
        cooldownUntilRef.current = result.nextCooldownUntil;
        lastStaleDataWarningAtRef.current = result.nextLastStaleDataWarningAt;
        for (const effect of result.effects) applyTradingCycleEffect(effect);
      }).catch((error) => {
        console.error('[TRADING] ❌ Erro não tratado no ciclo de trading:', error);
      });
      })().catch((error) => {
        console.error('[TRADING] ❌ Erro não tratado ao buscar multiplicador do Jarvis:', error);
      });
    }, 5000); // 🚀 OTIMIZAÇÃO #3: REDUZIDO de 15s para 5s (200% mais rápido!) ⚡

    return () => {
      clearInterval(tradingInterval);
    };
  }, [isActive, isPaused, isSafeMode, executionMode, activeOrders.length, aiConfig.maxPositions, aiConfig.maxContracts, aiConfig.maxAssets, addLog]);

  // === UNREALIZED PNL LOOP (Price Updates & P&L Calculation) ===
  useEffect(() => {
    const pnlInterval = setInterval(() => {
        // Curva de equity real (Dashboard, "Curva de Equity"): amostra o
        // equity real do portfolio a cada 10s — nunca dado mockado/aleatório.
        // Independente do executionMode (funciona em DEMO e LIVE) e, crucial,
        // independente de haver posição aberta — antes esse bloco ficava
        // DEPOIS do early-return abaixo, então sem nenhuma posição ativa o
        // loop inteiro nunca rodava e o card do Dashboard ficava travado em
        // "coletando dados..." pra sempre, mesmo com a conta ligada.
        {
          const now = Date.now();
          if (now - lastEquitySampleAtRef.current >= EQUITY_SAMPLE_INTERVAL_MS) {
            lastEquitySampleAtRef.current = now;
            const realEquity = portfolioRef.current.equity;
            setEquityHistory(prev => {
              const last = prev[prev.length - 1];
              // Evita ponto duplicado se o equity não mudou nada
              if (last && last.equity === realEquity && now - last.t < EQUITY_SAMPLE_INTERVAL_MS * 2) {
                return prev;
              }
              const next = [...prev, { t: now, equity: realEquity }];
              return next.length > MAX_EQUITY_POINTS ? next.slice(-MAX_EQUITY_POINTS) : next;
            });
          }
        }

        if (activeOrdersRef.current.length === 0) return;

        (async () => {
        // 🆕 FASE 2 (parte 2): buscar preço REAL de mercado em vez de random walk.
        // ✅ CORRIGIDO 2026-07-08: antes fazia UMA chamada HTTP separada por
        // símbolo único (via `Promise.all` + `getRealMarketData` individual).
        // Esse loop roda a cada 5s em background em QUALQUER tela do app (mora
        // no `TradingContext`, que envolve o app inteiro) — com várias posições
        // em ativos diferentes, isso virava várias chamadas concorrentes a
        // `/mt5-prices` na mesma conta MetaAPI compartilhada, cada uma levando
        // 3-8s (confirmado em produção via aba Rede) — degradando a conta pra
        // TODAS as chamadas simultâneas, inclusive a do Dashboard pro ativo
        // selecionado (causa raiz de preço instável/zerado reportada 2026-07-08).
        // Agora usa `getBatchedMT5Data`, que agrupa todos os símbolos
        // não-cripto numa ÚNICA chamada a `/mt5-prices`.
        const { getBatchedMT5Data } = await import('@/app/services/RealMarketDataService');
        const uniqueSymbols = Array.from(new Set(activeOrdersRef.current.map(o => o.symbol)));
        const priceMap = new Map<string, number>();
        try {
          const batchResult = await getBatchedMT5Data(uniqueSymbols);
          for (const symbol of uniqueSymbols) {
            const data = batchResult[symbol];
            // 🔴 FIX 2026-08-18 (INCIDENTE EM PRODUÇÃO): preço 0/NaN da API era aceito
            // como cotação válida. Um `0` aqui é sempre falha de feed, nunca preço real —
            // e propagado adiante disparava o SL (`0 <= stopLoss` é sempre verdadeiro),
            // fechando a posição a preço ZERO. Aconteceu ao vivo: JP225 entrada 69026.31
            // fechada com exit_price=0 e PnL fabricado de -$2.464,72 numa conta de $82,
            // levando o Patrimônio exibido pra -$2.381,77. Preço inválido tem que ser
            // descartado na origem — sem cotação nova, mantém-se a anterior.
            if (data && Number.isFinite(data.price) && data.price > 0) {
              priceMap.set(symbol, data.price);
            } else if (data) {
              console.warn(`[PNL LOOP] ⚠️ Preço inválido descartado para ${symbol}:`, data.price);
            }
          }
        } catch (error) {
          console.warn(`[PNL LOOP] ⚠️ Falha ao buscar preços em lote, mantendo preços anteriores`, error);
        }

        // Reset refs
        pnlLoopRef.current = { realizedPnL: 0, totalUnrealizedPnL: 0, totalExposure: 0 };
        pnlLogsRef.current = [];
        closedForPersistenceRef.current = [];

        // Update prices and calculate P&L
        setActiveOrders(prevOrders => {
            const nextActiveOrders: TradeVisual[] = [];
            const logsToAdd: string[] = [];
            let realizedPnL = 0;
            let totalUnrealizedPnL = 0;
            let totalExposure = 0;

            prevOrders.forEach(order => {
                const currentPrice = order.currentPrice || order.price;
                // Se o fetch falhou pra esse símbolo, mantém o preço anterior (não simula movimento).
                // 2ª barreira do fix de 2026-08-18 (ver descarte na origem, acima): mesmo que um
                // preço inválido escape pro mapa, ele nunca pode virar preço de avaliação/fechamento.
                const fetchedPrice = priceMap.get(order.symbol);
                const nextPrice = (Number.isFinite(fetchedPrice) && (fetchedPrice as number) > 0)
                  ? (fetchedPrice as number)
                  : currentPrice;

                // 🔒 RESPEITAR CONFIG DO USUÁRIO: stopLossMode ('DINAMICO' | 'FIXO').
                // Antes, o SL era calculado uma vez na entrada e nunca se mexia -
                // "DINAMICO" e "FIXO" tinham exatamente o mesmo comportamento.
                // Agora, em modo DINAMICO, o SL "anda" a favor do trade (trailing stop):
                // preserva a mesma distância de risco original, mas só sobe (LONG) ou
                // só desce (SHORT) - nunca piora o stop em relação ao que já estava setado.
                //
                // 🔴 FIX 2026-08-03 (achado testando ordem manual real): a distância
                // original ERA recalculada a partir de `order.sl` — mas esse campo é
                // reescrito com o próprio `effectiveSl` a cada tick (linha ~2201 abaixo),
                // então a "distância original" encolhia a cada segundo em vez de ficar
                // fixa. Resultado: o SL efetivo acumulava o ganho não-realizado inteiro
                // A CADA TICK (não só o incremento desde o tick anterior), numa
                // progressão descontrolada que alcançava o preço atual em minutos —
                // fechando a posição sozinha mesmo sem o mercado nunca ter revertido.
                // Pior ainda para SL não definido (0): a "distância" de partida virava
                // o próprio preço de entrada, tornando a progressão ainda mais rápida.
                // Confirmado em produção: ordem BTCUSD manual sem SL definido
                // (stop_loss=0 no banco), aberta 15:27 e fechada sozinha 15:47 (20min,
                // preço subiu só 0,14%) com exit_reason='SL'.
                // Fix: ancorar a distância em `originalSl` — campo imutável, gravado
                // uma única vez na abertura da ordem, nunca reescrito pelo loop — e
                // pular o trailing inteiro quando não há SL real definido (0 = sem
                // stop, nunca deve gerar um "stop fantasma").
                let effectiveSl = order.sl;

                // 🆕 BREAKEVEN AUTOMÁTICO (2026-08-17). Independente de
                // stopLossMode (roda mesmo em FIXO, trailing DINAMICO abaixo pode
                // mover ainda mais a favor): quando o trade anda a favor
                // `BREAKEVEN_TRIGGER_R` vezes a distância do risco original, o
                // stop sobe pro preço de entrada. É o mecanismo que corta a perda
                // média pra ~0 a partir desse ponto sem precisar prever direção
                // melhor — puro gerenciamento de saída, não previsão. Ancorado em
                // `originalSl` (imutável, gravado uma vez na abertura) pelo mesmo
                // motivo do trailing abaixo: `order.sl` é reescrito a cada tick.
                //
                // 2026-08-25: gatilho passou de +1R para +1,5R. A constante é
                // compartilhada com o motor de servidor (positionManager.ts) de
                // propósito — divergência entre as duas cópias dessa lógica já
                // causou balance divergente em produção (2026-08-18).
                if (order.originalSl > 0) {
                  const originalRisk = Math.abs(order.price - order.originalSl);
                  if (originalRisk > 0) {
                    const favorableMove = order.side === 'LONG' ? nextPrice - order.price : order.price - nextPrice;
                    if (favorableMove >= originalRisk * BREAKEVEN_TRIGGER_R) {
                      effectiveSl = order.side === 'LONG'
                        ? Math.max(effectiveSl, order.price)
                        : Math.min(effectiveSl, order.price);
                    }
                  }
                }

                let trailMoved = false;
                if (configRef.current.stopLossMode === 'DINAMICO' && order.originalSl > 0) {
                  // 🆕 2026-08-04: distância de trailing real via ATR do próprio ativo
                  // (mesmo `calculateATR` do resto do motor), não mais fixa na distância
                  // de entrada — é o que o widget "ATR Trailing Stop" da UI sempre
                  // anunciou fazer, mas nunca fazia de fato (achado da auditoria de
                  // config: card com número hardcoded, ATRTrailingStopManager.tsx com
                  // mock data explícito). Busca no MESMO cache de candles (60s) já
                  // mantido pelo ciclo de análise — sem chamada de rede extra aqui. Só
                  // usa ATR real e recente (< 5min); sem candle fresco pro símbolo,
                  // cai pro fallback antigo (distância fixa da entrada) — nunca
                  // fabrica um ATR.
                  const freshAtr = getFreshAtr(order.symbol, configRef.current.atrTrailingPeriod);
                  const atrDistance = freshAtr !== null ? freshAtr * configRef.current.atrTrailingMultiplier : null;

                  const originalSlDistance = Math.abs(order.price - order.originalSl);
                  const trailDistance = atrDistance ?? originalSlDistance;
                  const trailedSl = order.side === 'LONG'
                    ? nextPrice - trailDistance
                    : nextPrice + trailDistance;

                  effectiveSl = order.side === 'LONG'
                    ? Math.max(effectiveSl, trailedSl)
                    : Math.min(effectiveSl, trailedSl);
                  trailMoved = effectiveSl !== order.sl;
                }

                // ✅ LOG DE DEBUG (apenas para primeira iteração)
                if (!order.hasTakenPartial) {
                  const distanceToTP = Math.abs(order.tp - currentPrice);
                  const distanceToSL = Math.abs(currentPrice - effectiveSl);
                  console.log(`[PNL LOOP] ${order.symbol} ${order.side}: Preço $${currentPrice.toFixed(2)} | TP: $${order.tp.toFixed(2)} (${distanceToTP.toFixed(2)} de distância) | SL: $${effectiveSl.toFixed(2)} (${distanceToSL.toFixed(2)} de distância)${configRef.current.stopLossMode === 'DINAMICO' && effectiveSl !== order.sl ? ' [trailing]' : ''}`);
                }

                // Calculate P&L
                const pnl = calculatePnLWithLeverage(
                    order.symbol,
                    order.price,
                    nextPrice,
                    order.side,
                    order.amount,
                    order.leverage
                );

                totalUnrealizedPnL += pnl;
                totalExposure += order.amount * nextPrice * order.leverage;

                // Check TP/SL — tp/sl igual a 0 significa "não definido" (ordem manual
                // sem alvo/stop), nunca um preço de gatilho real. Sem esse guard, uma
                // ordem LONG sem TP fechava sozinha no primeiro tick (nextPrice >= 0 é
                // sempre verdadeiro), e o mesmo pro SL de uma SHORT sem stop.
                //
                // 🔒 CLIENTE PERDE AUTORIDADE DE FECHAR TRADE EM DEMO (2026-08-18).
                // Achado: cliente e servidor (`ai-runner`) rodavam essa MESMA decisão
                // em paralelo, cada um com seu próprio feed de preço e seu próprio
                // `effectiveSl` (trailing/breakeven calculados independentemente,
                // nunca sincronizados) — e cada um gravava fechamento e balance por
                // conta própria. Reconciliação trade a trade confirmou 2 casos reais
                // de balance corrompido causados exatamente por essa duplicidade (ver
                // NEXT_SESSION.md). Em DEMO, `ai-runner` (`positionManager.ts`) é
                // agora a ÚNICA entidade que fecha posição e grava balance — reflete
                // pra cá via o polling de reconciliação (linha ~816 abaixo), que já
                // sincroniza `activeOrders` e agora também `portfolio`. Em LIVE isso
                // não muda nesta sessão (fora de escopo: a integração com
                // `/broker/execute` não foi auditada aqui).
                const clientHasCloseAuthority = configRef.current.executionMode !== 'DEMO';
                const hitTP = clientHasCloseAuthority && order.tp > 0 && (order.side === 'LONG' ? nextPrice >= order.tp : nextPrice <= order.tp);
                const hitSL = clientHasCloseAuthority && effectiveSl > 0 && (order.side === 'LONG' ? nextPrice <= effectiveSl : nextPrice >= effectiveSl);

                // 💸 Custo de execução (spread + slippage) — cobrado no FECHAMENTO,
                // round-trip, mesma fonte (`ExecutionCost.ts` → `CostModel.ts`) que o
                // `ai-runner` usa no servidor. Até 2026-08-23 este caminho gravava
                // `commission: 0`, e o PnL saía de preço médio nas duas pontas.
                // `pnl` (acima) segue BRUTO — é o que alimenta o não-realizado da UI;
                // `pnlNet` é o que move balance e vai pro banco como `net_pnl`.
                const { costUsd: closeCostUsd } = calculateRoundTripCost(order.symbol, order.amount, order.price);
                const pnlNet = pnl - closeCostUsd;

                if (hitTP) {
                    realizedPnL += pnlNet;
                    logsToAdd.push(`🎯 ALVO ATINGIDO: ${order.symbol} +$${pnlNet.toFixed(2)} (custo $${closeCostUsd.toFixed(4)})`);
                    // Close position
                    setOrderHistory(prev => [...prev, { ...order, sl: effectiveSl, currentPrice: nextPrice, currentProfit: pnlNet, closedAt: Date.now() }]);
                    closedForPersistenceRef.current.push({ id: order.id, exitPrice: nextPrice, pnl, costUsd: closeCostUsd, reason: 'TP' });
                } else if (hitSL) {
                    realizedPnL += pnlNet;
                    logsToAdd.push(`🛡️ STOP ATINGIDO: ${order.symbol} ${pnlNet >= 0 ? '+' : ''}$${pnlNet.toFixed(2)} (custo $${closeCostUsd.toFixed(4)})`);
                    // Close position
                    setOrderHistory(prev => [...prev, { ...order, sl: effectiveSl, currentPrice: nextPrice, currentProfit: pnlNet, closedAt: Date.now() }]);
                    closedForPersistenceRef.current.push({ id: order.id, exitPrice: nextPrice, pnl, costUsd: closeCostUsd, reason: 'SL' });
                } else {
                    // Keep position open WITH UPDATED PROFIT (e SL "andado" se DINAMICO)
                    nextActiveOrders.push({
                        ...order,
                        sl: effectiveSl,
                        currentPrice: nextPrice,
                        currentProfit: pnl, // ✅ CRITICAL: Update profit for UI display
                        trailMoves: trailMoved ? (order.trailMoves || 0) + 1 : order.trailMoves, // 🆕 contador real pro widget ATR Trailing Stop
                    });
                }
            });

            // Store in refs
            pnlLoopRef.current = { realizedPnL, totalUnrealizedPnL, totalExposure };
            pnlLogsRef.current = logsToAdd;

            return nextActiveOrders;
        });
        
        // Add logs after setState
        if (pnlLogsRef.current.length > 0) {
            setRecentLogs(prev => [...pnlLogsRef.current, ...prev].slice(0, 50));
        }

        // Update portfolio after setState
        setPortfolio(prev => {
           const { realizedPnL, totalUnrealizedPnL, totalExposure } = pnlLoopRef.current;
           const newBalance = prev.balance + realizedPnL;
           const newEquity = newBalance + totalUnrealizedPnL;

           // === DRAWDOWN REAL (peak-to-trough), respeitando aiConfig.drawdownAnchor ===
           // High-water mark do equity: sobe com novo topo, nunca desce.
           const peakEquity = Math.max(prev.peakEquity ?? newEquity, newEquity);

           // Âncora diária: equity registrado na primeira avaliação de cada dia UTC.
           const nowDate = new Date();
           const utcDay = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
           const isNewUtcDay = prev.dayAnchorUtcDay !== utcDay;
           const dayAnchorEquity = isNewUtcDay ? newEquity : (prev.dayAnchorEquity ?? newEquity);
           const dayAnchorBalance = isNewUtcDay ? newBalance : (prev.dayAnchorBalance ?? newBalance);

           // INTRADAY_PEAK mede a queda desde o maior equity já atingido (mais rígido).
           // DAILY_CLOSE mede a queda desde o equity de abertura do dia (padrão FTMO/
           // Topstep) e por isso zera a cada novo dia UTC — lucro do dia protege.
           const anchor = configRef.current.drawdownAnchor === 'INTRADAY_PEAK'
             ? peakEquity
             : dayAnchorEquity;
           const drawdown = anchor > 0 && newEquity < anchor
             ? ((anchor - newEquity) / anchor) * 100
             : 0;

           return {
              ...prev,
              balance: newBalance,
              equity: newEquity,
              currentDrawdown: drawdown,
              maxDrawdownReached: Math.max(prev.maxDrawdownReached ?? 0, drawdown),
              peakEquity,
              dayAnchorEquity,
              dayAnchorBalance,
              dayAnchorUtcDay: utcDay,
              openPositionsValue: totalExposure,
           };
        });

        // Fase 2: persiste fechamentos por TP/SL deste tick (fire-and-forget)
        if (configRef.current.executionMode === 'DEMO' && closedForPersistenceRef.current.length > 0) {
          closedForPersistenceRef.current.forEach(closed => {
            persistenceRef.current.onTradeClose(closed.id, closed.exitPrice, closed.pnl, closed.costUsd ?? 0, closed.reason);
          });
          closedForPersistenceRef.current = [];
        }

        // ❌ REMOVIDO 2026-08-18 (junto com a perda de autoridade de fechamento
        // acima): o cliente escrevia snapshot de portfólio aqui a cada 60s em
        // DEMO, usando `balance` calculado a partir do SEU PRÓPRIO
        // `realizedPnL` local. Com o fechamento de posição agora exclusivo do
        // `ai-runner`, esse `realizedPnL` fica sempre 0 no cliente — escrever
        // esse balance "congelado" por cima do que o servidor acabou de gravar
        // recriaria exatamente o bug que motivou a mudança (balance travado/
        // sobrescrito por um escritor que não sabe do fechamento real). O
        // `ai-runner` (`persistPortfolioSnapshot`) é agora o único escritor de
        // `ai_portfolio_snapshots` em DEMO; o cliente só lê (polling de
        // reconciliação, linha ~816 abaixo).
        })();
    }, 1000); // Update every 1 second

    return () => clearInterval(pnlInterval);
  }, []);

  // === START/STOP/PAUSE ===
  const startLogic = useCallback(() => {
    console.log('[START LOGIC] 🚀 Tentando iniciar AI...');
    console.log('[START LOGIC] Safe Mode:', isSafeModeRef.current);
    stopDrainWatcher(); // nova sessão vai assumir a reconciliação normal (linha ~964)

    if (isSafeModeRef.current) {
      toast.warning('Sistema em Safe Mode. Resolva os problemas antes de continuar.');
      return;
    }
    
    console.log('[START LOGIC] ✅ Iniciando sistema...');
    setIsActive(true);
    setIsPaused(false);
    addLog('🚀 Sistema APEX Iniciado');
    toast.success('AI Trading Iniciada', { description: 'Sistema rodando em modo automático' });

    // Fase 2: garante uma sessão DEMO no Supabase (reaproveita a restaurada no mount, se houver)
    if (configRef.current.executionMode === 'DEMO' && !persistenceRef.current.currentSessionId) {
      persistenceErrorNotifiedRef.current = false;
      sessionStartedAtRef.current = Date.now();
      persistenceRef.current.startSession({
        strategyName: 'Apex AI',
        symbols: configRef.current.activeAssets || [],
        timeframe: configRef.current.timeframe || '15m',
        initialBalance: portfolioRef.current.balance,
        initialEquity: portfolioRef.current.equity,
        config: configRef.current,
      });
    }
  }, [addLog, stopDrainWatcher]);

  const stopLogic = useCallback(() => {
    // 🆕 2026-08-21 (pedido do Cleber): não fecha mais posições abertas à
    // força ao parar a IA — isso cortava trades com R:R alto (ex: take-profit
    // 1:3) no preço de mercado do instante do Stop, antes de atingirem o
    // alvo, transformando o que seria "perde pouco, ganha muito" em "empata
    // sempre". Comportamento antigo (removido): fechava tudo local com
    // `exit_reason: 'MANUAL'` e recalculava PnL client-side. Agora: só para
    // de abrir posição NOVA (sessão sai de RUNNING; em DEMO o `ai-runner`
    // só abre entrada pra sessão RUNNING). As posições já abertas continuam
    // sendo monitoradas de verdade pelo watchdog do runner até bater
    // TP/SL/gate de risco — nada fica sem monitoramento, então a proteção
    // original ("não deixar posição órfã") continua valendo, só que via
    // servidor em vez de fechamento forçado no cliente.
    const pendingCount = activeOrders.length;
    if (pendingCount > 0) {
      addLog(`🛑 Sistema APEX Parado - ${pendingCount} posição(ões) aberta(s) seguem monitoradas pelo servidor até fechar por TP/SL. Nenhuma posição nova será aberta.`);
    } else {
      addLog('🛑 Sistema APEX Parado');
    }

    // 🆕 FIX 2026-08-17 (achado ao investigar "IA religada mas config antiga
    // continua rodando"): "Desligar AI" nunca encerrava a sessão no Supabase
    // — só zerava estado local (`setIsActive(false)`). A sessão ficava
    // RUNNING no banco pra sempre, e o runner server-side (`ai-runner` via
    // pg_cron) continuava operando com a config antiga indefinidamente,
    // mesmo com a tela mostrando "desligado". Pior: como `sessionIdRef`
    // também não era limpo, o próximo "Iniciar AI" via `startLogic` (guard
    // `!persistenceRef.current.currentSessionId`) nunca criava sessão nova —
    // só um reload de página resolvia (achado ao vivo nesta sessão,
    // precisou de intervenção manual direto no banco). `endSession` já
    // limpa `sessionIdRef.current` sozinho (useAIPersistence.ts:166), então
    // chamar aqui resolve os dois problemas de uma vez: sessão morre de
    // verdade no banco, e o próximo start cria uma sessão nova sem precisar
    // recarregar a página. Encerrar a sessão aqui é seguro mesmo com
    // posições OPEN: o watchdog do `ai-runner` busca posição `OPEN` por
    // `session_id` direto em `ai_trades`, independente do `status` da
    // sessão — só o handler principal (abre posição nova) olha `RUNNING`.
    const endedSessionId = configRef.current.executionMode === 'DEMO'
      ? persistenceRef.current.getSessionId()
      : null;
    if (configRef.current.executionMode === 'DEMO' && persistenceRef.current.currentSessionId) {
      persistenceRef.current.endSession(portfolioRef.current.balance, portfolioRef.current.equity);
    }

    // Continua de olho nas posições que ficaram pro watchdog fechar, já que
    // o polling normal de reconciliação (linha ~964) só roda com
    // `isActive=true` e a sessão que ele consultava acabou de ser encerrada.
    // Some da tela (activeOrders) só quando o servidor de fato marcar a
    // posição como fechada — nunca fabrica o fechamento aqui no cliente.
    stopDrainWatcher();
    if (pendingCount > 0 && endedSessionId) {
      drainWatcherRef.current = setInterval(async () => {
        try {
          const trades = await persistenceRef.current.getSessionTrades(endedSessionId);
          const stillOpen = new Set(trades.filter(t => t.status === 'OPEN').map(t => t.id));
          setActiveOrders(prev => {
            const remaining = prev.filter(o => stillOpen.has(o.id));
            if (remaining.length !== prev.length) {
              addLog(`✅ ${prev.length - remaining.length} posição(ões) fechada(s) pelo servidor após o Stop.`);
            }
            return remaining;
          });
          if (stillOpen.size === 0) stopDrainWatcher();
        } catch (e) {
          console.warn('[STOP LOGIC] Falha ao verificar posições remanescentes pós-Stop:', e);
        }
      }, 15_000);
    }

    setIsActive(false);
    setIsPaused(false);
  }, [activeOrders, addLog, stopDrainWatcher]);

  const pauseLogic = useCallback(() => {
    setIsPaused(true);
    addLog('⏸️ Sistema APEX Pausado');
  }, [addLog]);

  const resumeLogic = useCallback(() => {
    setIsPaused(false);
    addLog('▶️ Sistema APEX Retomado');
  }, [addLog]);

  // === RESET ===
  const resetLogic = useCallback(() => {
    // 🔴 Marca ANTES de disparar o endSession assíncrono — ver nota em
    // LAST_RESET_MARKER_KEY acima. Cobre o caso de reload no meio da janela
    // de rede em que a sessão ainda aparece RUNNING no Supabase.
    try {
      localStorage.setItem(LAST_RESET_MARKER_KEY, JSON.stringify({
        t: Date.now(),
        sessionId: persistenceRef.current.currentSessionId || null,
      }));
    } catch { /* ignore */ }

    // Fase 2: encerra a sessão DEMO no Supabase (próximo start cria uma nova, zerada)
    if (persistenceRef.current.currentSessionId) {
      persistenceRef.current.endSession(INITIAL_STATE.portfolio.balance, INITIAL_STATE.portfolio.equity);
    }
    // Reset explícito = "começar do zero" pra Performance também — sem isto,
    // trades fechados de semanas atrás (inclusive registros comprovadamente
    // contaminados por bugs já corrigidos no motor) reapareciam na tela
    // depois de qualquer reload, porque a hidratação busca TODO o histórico
    // do usuário, sem filtro de sessão. Não apaga nada no banco.
    if (configRef.current.executionMode === 'DEMO') {
      persistenceRef.current.recordHistoryReset();
    }
    // Reset explícito = "começar do zero" — reinicia o relógio do gate de
    // perda diária junto, senão perdas da tentativa descartada continuam
    // pesando contra a conta que acabou de voltar pra $100.
    sessionStartedAtRef.current = Date.now();

    setIsActive(false);
    setIsPaused(false);
    setActiveOrders([]);
    setOrderHistory([]); // ✅ Limpa histórico de trades
    // 🔴 FIX 2026-08-21 (achado do Cleber: "Curva de Equity" do Dashboard
    // continuava mostrando o mergulho da sessão anterior depois do Reset):
    // faltava aqui — `equityHistory` é state próprio, não faz parte de
    // `orderHistory`/`portfolio`, então sobrevivia ao reset intocado.
    setEquityHistory([]);
    setPortfolio(INITIAL_STATE.portfolio);
    setHouseStats(INITIAL_STATE.houseStats);
    setPerformanceMetrics(INITIAL_STATE.performanceMetrics);
    setRecentLogs([]);
    setIsSafeMode(false);
    setSafeModeReason(null);
    setCandlesSinceLastTrade(0);
    assetExposureRef.current = {};
    lastAssetClassRef.current = null;
    
    // ✅ CORREÇÃO CRÍTICA: Limpar localStorage para garantir que histórico não persista
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('✅ [RESET] localStorage limpo com sucesso');
    } catch (error) {
      console.error('❌ [RESET] Erro ao limpar localStorage:', error);
    }
    
    addLog('🔄 Sistema Resetado - Conta voltou para $100');
  }, [addLog]);

  // === FORCE CLOSE ALL ===
  const forceCloseAll = useCallback(() => {
    const closingOrders = activeOrders;
    let totalRealizedPnL = 0;

    const closedWithPnL = closingOrders.map(order => {
      const currentPrice = order.currentPrice || order.price;
      const tradePnL = calculatePnLWithLeverage(
        order.symbol,
        order.price,
        currentPrice,
        order.side,
        order.amount,
        order.leverage
      );
      // 💸 Fechamento manual também paga spread — ver ExecutionCost.ts.
      const { costUsd } = calculateRoundTripCost(order.symbol, order.amount, order.price);
      const tradePnLNet = tradePnL - costUsd;
      totalRealizedPnL += tradePnLNet;

      if (configRef.current.executionMode === 'DEMO') {
        persistenceRef.current.onTradeClose(order.id, currentPrice, tradePnL, costUsd, 'MANUAL');
      }

      return { ...order, currentPrice, currentProfit: tradePnLNet, closedAt: Date.now() };
    });

    setPortfolio(prev => ({
      ...prev,
      balance: prev.balance + totalRealizedPnL,
      equity: prev.balance + totalRealizedPnL,
      openPositionsValue: 0,
    }));

    setOrderHistory(prev => [...prev, ...closedWithPnL]);
    setActiveOrders([]);
    addLog(`🚨 Todas as posições foram fechadas. P&L Total: $${totalRealizedPnL.toFixed(2)}`);
  }, [activeOrders, addLog]);

  // === ORDEM MANUAL (boleta no gráfico) ===
  // Mesmo caminho de abertura DEMO que a IA usa (TradeVisual + setActiveOrders +
  // persistência), só que disparado pelo clique do usuário em vez do motor de
  // decisão. `volume` chega em lotes (padrão da boleta); convertido para o
  // `amount` em USD que o resto do motor espera — inverso exato de
  // `amountToLotSize` (src/app/modules/tradeConfirmationStage/lotSizeConversion.ts).
  const openManualPosition = useCallback((params: {
    symbol: string;
    side: 'LONG' | 'SHORT';
    volume: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    // Preenchidos só pelo Pyramiding ao adicionar um layer — pyramidGroupId
    // precisa ser o id de BANCO do trade raiz (resolvido via
    // resolveDbTradeId), nunca o id local do React.
    pyramidGroupId?: string;
    pyramidLayer?: number;
  }): { success: boolean; error?: string; tradeId?: string } => {
    console.error('🟢[useApexLogic] openManualPosition chamado', params);
    const asset = getAssetBySymbol(params.symbol);
    if (!asset) {
      console.warn('[useApexLogic] openManualPosition: ativo não encontrado em assetDatabase', params.symbol);
      return { success: false, error: `Ativo desconhecido: ${params.symbol}` };
    }
    if (!(params.volume > 0) || !(params.entryPrice > 0)) {
      return { success: false, error: 'Volume ou preço inválido' };
    }

    // Choke point único: toda ordem (manual, Pyramiding, Estágios 3/4) passa
    // por aqui — sem isto um layer de Pyramiding ou uma conversão $→lote a
    // montante podia abrir posição com fração de lote abaixo do mínimo real
    // do ativo (ex: 0.0021 lote de BTC com mínimo 0.01). Ver CLAUDE.md,
    // pendência "mínimo de contratos por ativo".
    const lotCheck = floorToLotStep(params.symbol, params.volume);
    if (lotCheck.error) {
      console.warn('[useApexLogic] openManualPosition: lote abaixo do mínimo', params.symbol, params.volume, lotCheck.error);
      return { success: false, error: lotCheck.error };
    }
    const volume = lotCheck.volume;

    const amountUsd = volume * asset.lotSize * params.entryPrice;

    if (configRef.current.executionMode === 'DEMO' && !persistenceRef.current.currentSessionId) {
      sessionStartedAtRef.current = Date.now();
      persistenceRef.current.startSession({
        strategyName: 'Ordem Manual',
        symbols: [params.symbol],
        timeframe: configRef.current.timeframe || '15m',
        initialBalance: portfolioRef.current.balance,
        initialEquity: portfolioRef.current.equity,
        config: configRef.current,
      });
    }

    const newTrade: TradeVisual = {
      id: `manual-${Date.now()}-${Math.random()}`,
      symbol: params.symbol,
      side: params.side,
      amount: amountUsd,
      price: params.entryPrice,
      currentPrice: params.entryPrice,
      tp: params.takeProfit ?? 0,
      sl: params.stopLoss ?? 0,
      originalSl: params.stopLoss ?? 0,
      leverage: asset.leverage || 1,
      ai_confidence: 100,
      timestamp: Date.now(),
      reasoning: 'Ordem manual do usuário',
      indicators: { rsi: 50, macd: 'NEUTRAL', trend: 'NEUTRAL' },
      pyramidGroupId: params.pyramidGroupId,
      pyramidLayer: params.pyramidLayer,
    };

    setActiveOrders(prev => {
      const next = [...prev, newTrade];
      console.error('🟢[useApexLogic] openManualPosition: setActiveOrders', { antes: prev.length, depois: next.length, newTrade });
      return next;
    });
    addLog(`✅ ORDEM MANUAL ${params.side}: ${params.symbol} @ $${params.entryPrice.toFixed(2)} — ${volume} lote(s)`);

    if (configRef.current.executionMode === 'DEMO') {
      persistenceRef.current.onTradeOpen({
        id: newTrade.id,
        symbol: newTrade.symbol,
        side: newTrade.side,
        amount: newTrade.amount,
        price: newTrade.price,
        tp: newTrade.tp,
        sl: newTrade.sl,
        leverage: newTrade.leverage,
        ai_confidence: newTrade.ai_confidence,
        timestamp: newTrade.timestamp,
        reasoning: newTrade.reasoning,
        indicators: newTrade.indicators,
        pyramidGroupId: newTrade.pyramidGroupId ?? null,
        pyramidLayer: newTrade.pyramidLayer ?? null,
      });
    }

    return { success: true, tradeId: newTrade.id };
  }, [addLog]);

  // === PYRAMIDING SYSTEM (núcleo real — ver comentário em aiConfig.pyramiding) ===
  // 🆕 2026-08-04: widget antes 100% decorativo (achado da auditoria de config
  // — card com números hardcoded, "Detalhes" abria modal vazio, zero lógica no
  // motor). Implementado aqui: maxLayers, scalingStrategy fixed/reduced/
  // exponential, entryDistanceType percent/pips/atr (ATR real via
  // `getFreshAtr`), break-even real, stop de emergência real. Opt-in
  // (`aiConfig.pyramiding.enabled`, default false) e só em modo DEMO nesta
  // primeira passada — LIVE fica pra quando isso passar pelo mesmo rigor da
  // ponte de execução (research/AI_BRAIN_SPEC.md 9.1). scalingStrategy
  // fibonacci/smart-ai e entryDistanceType ai-dynamic NÃO estão implementados
  // — o loop abaixo simplesmente não adiciona layer nesses casos, nunca
  // fabrica um número, e a UI (PyramidingConfigPanel.tsx) desabilita essas
  // opções pra não sugerir que funcionam.
  const pyramidStateRef = useRef<Map<string, { layers: number; lastLayerPrice: number; breakEvenApplied: boolean }>>(new Map());
  // Trailing stop do Pyramiding (2026-08-19) — chave é o id do order se
  // `trailingStopPerLayer`, senão a chave do grupo (`pyramidGroupId ?? id`
  // da raiz). Guarda o melhor preço já visto a favor do trade (high-water
  // mark), nunca o SL em si — o SL ratcheta a partir daqui + distância.
  const pyramidTrailingHwmRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isActive || isPaused || isSafeMode) return;

    const interval = setInterval(() => {
      const cfg = configRef.current.pyramiding;
      if (!cfg?.enabled || configRef.current.executionMode !== 'DEMO') return;

      const orders = activeOrdersRef.current;

      // Adição de novos layers — só a posição ORIGINAL de cada grupo (sem
      // pyramidGroupId) dispara, nunca um layer adicionando em cima de outro.
      for (const order of orders) {
        if (order.pyramidGroupId) continue; // já é um layer, não a raiz do grupo
        if (activeOrdersRef.current.length >= configRef.current.maxPositions) break;

        let state = pyramidStateRef.current.get(order.id);
        if (!state) {
          state = { layers: 1, lastLayerPrice: order.price, breakEvenApplied: false };
          pyramidStateRef.current.set(order.id, state);
        }
        if (state.layers >= cfg.maxLayers) continue;

        const currentPrice = order.currentPrice || order.price;
        const favorableMove = order.side === 'LONG' ? currentPrice - state.lastLayerPrice : state.lastLayerPrice - currentPrice;
        if (favorableMove <= 0) continue; // só empilha a favor do trade, nunca contra

        let requiredDistance: number | null = null;
        if (cfg.entryDistanceType === 'percent') {
          requiredDistance = state.lastLayerPrice * (cfg.entryDistance / 100);
        } else if (cfg.entryDistanceType === 'pips') {
          requiredDistance = cfg.entryDistance * getPointValue(order.symbol);
        } else if (cfg.entryDistanceType === 'atr') {
          const atr = getFreshAtr(order.symbol, configRef.current.atrTrailingPeriod);
          requiredDistance = atr !== null ? atr * cfg.atrMultiplier : null;
        }
        // entryDistanceType 'ai-dynamic' (não implementado) ou ATR indisponível: requiredDistance fica null, nunca adiciona.
        if (requiredDistance === null || requiredDistance <= 0 || favorableMove < requiredDistance) continue;

        let sizeMultiplierForLayer: number;
        if (cfg.scalingStrategy === 'fixed') {
          sizeMultiplierForLayer = 1;
        } else if (cfg.scalingStrategy === 'reduced' || cfg.scalingStrategy === 'exponential') {
          sizeMultiplierForLayer = Math.pow(cfg.sizeMultiplier, state.layers);
        } else {
          continue; // 'fibonacci' / 'smart-ai': não implementado nesta passada
        }

        const asset = getAssetBySymbol(order.symbol);
        if (!asset) continue;
        const originalVolumeLots = order.amount / (asset.lotSize * order.price);
        const newVolumeLots = originalVolumeLots * sizeMultiplierForLayer;
        const newAmountUsd = newVolumeLots * asset.lotSize * currentPrice;
        if (!(newVolumeLots > 0)) continue;
        // 🔒 Trava de segurança: nunca comprometer mais de 50% do saldo atual num único layer.
        if (newAmountUsd > portfolioRef.current.balance * 0.5) continue;

        const slDistance = order.originalSl > 0 ? Math.abs(order.price - order.originalSl) : 0;
        const tpDistance = order.tp > 0 ? Math.abs(order.tp - order.price) : 0;
        const newSl = slDistance > 0 ? (order.side === 'LONG' ? currentPrice - slDistance : currentPrice + slDistance) : undefined;
        const newTp = tpDistance > 0 ? (order.side === 'LONG' ? currentPrice + tpDistance : currentPrice - tpDistance) : undefined;

        // Gate de risco real — sempre ativo (Pyramiding ligado já inclui a
        // proteção, sem opt-in separado, ver comentário em
        // evaluatePyramidLayerRiskGate). Recusa o layer sem contar como
        // "tentativa consumida" — pode disparar de novo no próximo tick se
        // o cenário melhorar.
        const riskGate = evaluatePyramidLayerRiskGate(order.symbol, order.side, currentPrice, newTp);
        if (!riskGate.approved) {
          addLog(`🛑 PYRAMIDING: layer recusado em ${order.symbol} — ${riskGate.reason}`);
          continue;
        }

        const isFirstLayer = state.layers === 1;
        // pyramid_group_id precisa ser o id de BANCO da raiz, não o id local
        // do React — sem isto o FK gravado no banco fica errado (achado
        // 2026-08-19, ver migration 20260819_add_pyramid_group_columns.sql).
        const groupDbId = persistenceRef.current.resolveDbTradeId(order.id);
        const newLayerNumber = state.layers + 1;

        const result = openManualPosition({
          symbol: order.symbol,
          side: order.side,
          volume: newVolumeLots,
          entryPrice: currentPrice,
          stopLoss: newSl,
          takeProfit: newTp,
          pyramidGroupId: groupDbId,
          pyramidLayer: newLayerNumber,
        });

        if (result.success && result.tradeId) {
          if (isFirstLayer) persistenceRef.current.markPyramidRoot(order.id);
          state.layers += 1;
          state.lastLayerPrice = currentPrice;
          const layerNumber = state.layers;
          const groupId = order.id;
          const tradeId = result.tradeId;
          setActiveOrders(prev => prev.map(o => o.id === tradeId
            ? { ...o, pyramidGroupId: groupId, pyramidLayer: layerNumber, reasoning: `Pyramiding layer ${layerNumber}/${cfg.maxLayers} de ${order.symbol}` }
            : o));
          addLog(`📐 PYRAMIDING: layer ${layerNumber}/${cfg.maxLayers} adicionado em ${order.symbol} @ $${currentPrice.toFixed(2)}`);

          if (cfg.breakEvenEnabled && !state.breakEvenApplied && state.layers >= cfg.breakEvenAfterLayers) {
            state.breakEvenApplied = true;
            setActiveOrders(prev => prev.map(o => o.id === groupId
              ? { ...o, sl: o.price, originalSl: o.price }
              : o));
            // Persiste no banco — sem isto o ajuste só existia em memória e o
            // ai-runner (autoridade real de fechamento em DEMO desde 2026-08-18)
            // nunca via o novo SL, tornando este break-even um no-op silencioso.
            // Achado e corrigido 2026-08-19.
            persistenceRef.current.updateTradeStopLoss(groupId, order.price);
            addLog(`🛡️ PYRAMIDING: break-even aplicado em ${order.symbol} (${state.layers} layers)`);
          }
        }
      }

      // Trailing Stop do Pyramiding (núcleo real, 2026-08-19 — antes era
      // decorativo: config existia, motor nunca lia). Ratcheta o SL a favor
      // do trade conforme o preço avança, nunca solta de volta — mesma regra
      // do trailing normal (positionManager.ts/useApexLogic PNL loop), só que
      // com a distância/tipo PRÓPRIOS do Pyramiding (`trailingStopType`/
      // `trailingStopDistance`), não os do trailing de posição única.
      // `trailingStopPerLayer=true`: cada camada tem seu próprio high-water
      // mark e SL, ratchetados independentemente. `false`: uma única "melhor
      // marca" por grupo, e o mesmo SL calculado é aplicado a TODAS as
      // camadas do grupo (elas se protegem juntas).
      if (cfg.trailingStopEnabled) {
        const distanceFor = (symbol: string, refPrice: number): number | null => {
          if (cfg.trailingStopType === 'percent') return refPrice * (cfg.trailingStopDistance / 100);
          if (cfg.trailingStopType === 'pips') return cfg.trailingStopDistance * getPointValue(symbol);
          if (cfg.trailingStopType === 'atr') {
            const atr = getFreshAtr(symbol, configRef.current.atrTrailingPeriod);
            return atr !== null ? atr * cfg.trailingStopDistance : null;
          }
          return null;
        };

        const groupsForTrailing = new Map<string, TradeVisual[]>();
        for (const order of activeOrdersRef.current) {
          const key = order.pyramidGroupId ?? order.id;
          if (!groupsForTrailing.has(key)) groupsForTrailing.set(key, []);
          groupsForTrailing.get(key)!.push(order);
        }

        for (const [groupKey, group] of groupsForTrailing) {
          if (group.length < 2) continue; // sem layer adicionado, não é pyramid de fato — trailing normal já cobre isso

          if (cfg.trailingStopPerLayer) {
            for (const o of group) {
              const currentPrice = o.currentPrice || o.price;
              const distance = distanceFor(o.symbol, currentPrice);
              if (distance === null || distance <= 0) continue;
              const prevHwm = pyramidTrailingHwmRef.current.get(o.id) ?? o.price;
              const newHwm = o.side === 'LONG' ? Math.max(prevHwm, currentPrice) : Math.min(prevHwm, currentPrice);
              pyramidTrailingHwmRef.current.set(o.id, newHwm);
              const candidateSl = o.side === 'LONG' ? newHwm - distance : newHwm + distance;
              const ratchetedSl = o.sl > 0
                ? (o.side === 'LONG' ? Math.max(o.sl, candidateSl) : Math.min(o.sl, candidateSl))
                : candidateSl;
              if (ratchetedSl > 0 && ratchetedSl !== o.sl) {
                setActiveOrders(prev => prev.map(x => x.id === o.id ? { ...x, sl: ratchetedSl } : x));
                persistenceRef.current.updateTradeStopLoss(o.id, ratchetedSl);
              }
            }
          } else {
            const side = group[0].side;
            const symbol = group[0].symbol;
            const groupExtremePrice = group.reduce((best, o) => {
              const cp = o.currentPrice || o.price;
              return side === 'LONG' ? Math.max(best, cp) : Math.min(best, cp);
            }, group[0].currentPrice || group[0].price);
            const distance = distanceFor(symbol, groupExtremePrice);
            if (distance === null || distance <= 0) continue;
            const prevHwm = pyramidTrailingHwmRef.current.get(groupKey) ?? groupExtremePrice;
            const newHwm = side === 'LONG' ? Math.max(prevHwm, groupExtremePrice) : Math.min(prevHwm, groupExtremePrice);
            pyramidTrailingHwmRef.current.set(groupKey, newHwm);
            const candidateSl = side === 'LONG' ? newHwm - distance : newHwm + distance;
            for (const o of group) {
              const ratchetedSl = o.sl > 0
                ? (side === 'LONG' ? Math.max(o.sl, candidateSl) : Math.min(o.sl, candidateSl))
                : candidateSl;
              if (ratchetedSl > 0 && ratchetedSl !== o.sl) {
                setActiveOrders(prev => prev.map(x => x.id === o.id ? { ...x, sl: ratchetedSl } : x));
                persistenceRef.current.updateTradeStopLoss(o.id, ratchetedSl);
              }
            }
          }
        }
      }

      // Stop de emergência real por grupo — soma P&L não-realizado de todas as
      // camadas contra o capital comprometido nelas; se ultrapassar o limite,
      // move o SL de cada camada pro preço atual, deixando o loop de P&L
      // (já rodando) fechar de verdade no próximo tick pelo caminho normal de
      // SL — sem duplicar lógica de fechamento/persistência aqui.
      if (cfg.emergencyStopEnabled) {
        const groups = new Map<string, TradeVisual[]>();
        for (const order of activeOrdersRef.current) {
          const key = order.pyramidGroupId ?? order.id;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(order);
        }
        for (const [key, group] of groups) {
          if (group.length < 2) continue; // sem layers adicionados, não é pyramid de fato
          const totalAmount = group.reduce((s, o) => s + o.amount, 0);
          const totalPnl = group.reduce((s, o) => s + (o.currentProfit || 0), 0);
          const pnlPercent = totalAmount > 0 ? (totalPnl / totalAmount) * 100 : 0;
          if (pnlPercent <= -cfg.emergencyStopLossPercent) {
            setActiveOrders(prev => prev.map(o => (o.pyramidGroupId === key || o.id === key)
              ? { ...o, sl: o.currentPrice || o.price }
              : o));
            // Persiste no banco pra cada camada do grupo — mesma correção do
            // break-even acima: sem isto o ai-runner nunca via o SL movido pro
            // preço atual e o "emergency stop" não fechava nada de verdade.
            for (const o of group) {
              persistenceRef.current.updateTradeStopLoss(o.id, o.currentPrice || o.price);
            }
            addLog(`🚨 PYRAMIDING EMERGENCY STOP: grupo em ${group[0].symbol} a ${pnlPercent.toFixed(1)}% — fechando todas as camadas`);
            pyramidStateRef.current.delete(key);
            pyramidTrailingHwmRef.current.delete(key);
            for (const o of group) pyramidTrailingHwmRef.current.delete(o.id);
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, isSafeMode, addLog, openManualPosition]);

  // Ordem pendente DEMO (limit/stop) — validação de direção igual à que o
  // MetaAPI faria do lado real: limit de compra só abaixo do preço atual,
  // stop de compra só acima (e o espelho pro lado de venda).
  const openManualPendingOrder = useCallback((params: {
    symbol: string;
    side: 'LONG' | 'SHORT';
    orderType: 'LIMIT' | 'STOP';
    volume: number;
    triggerPrice: number;
    currentPrice: number;
    stopLoss?: number;
    takeProfit?: number;
  }): { success: boolean; error?: string; orderId?: string } => {
    const asset = getAssetBySymbol(params.symbol);
    if (!asset) {
      return { success: false, error: `Ativo desconhecido: ${params.symbol}` };
    }
    if (!(params.volume > 0) || !(params.triggerPrice > 0)) {
      return { success: false, error: 'Volume ou preço inválido' };
    }

    const isBuy = params.side === 'LONG';
    const aboveMarket = params.triggerPrice > params.currentPrice;
    // Limit compra abaixo / vende acima do mercado; Stop é o espelho disso.
    const validDirection = params.orderType === 'LIMIT'
      ? (isBuy ? !aboveMarket : aboveMarket)
      : (isBuy ? aboveMarket : !aboveMarket);
    if (!validDirection) {
      return {
        success: false,
        error: `${params.orderType === 'LIMIT' ? 'Limit' : 'Stop'} de ${isBuy ? 'compra' : 'venda'} precisa estar ${
          (params.orderType === 'LIMIT') === isBuy ? 'abaixo' : 'acima'
        } do preço atual`,
      };
    }

    const newOrder: PendingOrderVisual = {
      id: `pending-${Date.now()}-${Math.random()}`,
      symbol: params.symbol,
      side: params.side,
      orderType: params.orderType,
      volume: params.volume,
      triggerPrice: params.triggerPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      timestamp: Date.now(),
    };
    setPendingOrders(prev => [...prev, newOrder]);
    addLog(`🕓 ORDEM PENDENTE ${params.orderType} ${params.side}: ${params.symbol} @ $${params.triggerPrice.toFixed(2)} — ${params.volume} lote(s)`);
    return { success: true, orderId: newOrder.id };
  }, [addLog]);

  const cancelManualPendingOrder = useCallback((orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    addLog(`🗑️ Ordem pendente cancelada: ${orderId}`);
  }, [addLog]);

  // Chamado a cada tick de preço (ChartView, pro símbolo selecionado) — dispara
  // qualquer ordem pendente cujo gatilho o preço já cruzou. Preenche no preço
  // ATUAL da tela (não no preço de gatilho): não temos profundidade real pra
  // garantir fill exato, e simular "preenchido exatamente no limite" seria
  // otimismo não sustentado por dado nenhum.
  const checkPendingOrderTriggers = useCallback((symbol: string, price: number) => {
    const toFill = pendingOrdersRef.current.filter((o) => {
      if (o.symbol !== symbol) return false;
      const isBuy = o.side === 'LONG';
      if (o.orderType === 'LIMIT') {
        return isBuy ? price <= o.triggerPrice : price >= o.triggerPrice;
      }
      return isBuy ? price >= o.triggerPrice : price <= o.triggerPrice;
    });
    if (toFill.length === 0) return;

    setPendingOrders(prev => prev.filter(o => !toFill.some(f => f.id === o.id)));
    toFill.forEach((order) => {
      addLog(`⚡ ORDEM PENDENTE DISPAROU: ${order.symbol} ${order.orderType} ${order.side} @ $${price.toFixed(2)}`);
      openManualPosition({
        symbol: order.symbol,
        side: order.side,
        volume: order.volume,
        entryPrice: price,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
      });
    });
  }, [addLog, openManualPosition]);

  // Fechamento manual de uma posição DEMO específica (usada pela boleta/lista de posições).
  const closeManualPosition = useCallback((tradeId: string, currentPrice: number) => {
    const order = activeOrdersRef.current.find(o => o.id === tradeId);
    if (!order) return;

    const tradePnL = calculatePnLWithLeverage(
      order.symbol,
      order.price,
      currentPrice,
      order.side,
      order.amount,
      order.leverage
    );

    // 💸 Fechamento manual de posição única também paga spread — ver ExecutionCost.ts.
    const { costUsd } = calculateRoundTripCost(order.symbol, order.amount, order.price);
    const tradePnLNet = tradePnL - costUsd;

    if (configRef.current.executionMode === 'DEMO') {
      persistenceRef.current.onTradeClose(order.id, currentPrice, tradePnL, costUsd, 'MANUAL');
    }

    setPortfolio(prev => ({
      ...prev,
      balance: prev.balance + tradePnLNet,
      equity: prev.balance + tradePnL,
    }));
    setOrderHistory(prev => [...prev, { ...order, currentPrice, currentProfit: tradePnL, closedAt: Date.now() }]);
    setActiveOrders(prev => prev.filter(o => o.id !== tradeId));
    addLog(`✅ Posição manual fechada: ${order.symbol} — P&L: $${tradePnL.toFixed(2)}`);
  }, [addLog]);

  // === UPDATE AI CONFIG ===
  // 🔴 2026-08-25: agora persiste automaticamente a config no Supabase
  const updateAIConfig = useCallback((config: Partial<AIConfig>) => {
    setAIConfig(prev => {
      const newConfig = { ...prev, ...config };

      // Salvar a config na sessão (throttled com debounce via useRef)
      const sessionId = persistenceRef.current?.getSessionId?.();
      if (sessionId) {
        // Usar um ref para throttle: só salva se passou tempo mínimo desde último save
        const now = Date.now();
        if (!updateAIConfigTimeoutRef.current) {
          updateAIConfigTimeoutRef.current = now;
          aiPersistence.saveSessionConfig(sessionId, newConfig)
            .catch(err => console.error('[useApexLogic] Erro ao salvar config:', err));
        }
        // Schedular próximo save em 3 segundos (evita saturar Supabase)
        if (updateAIConfigDebounceRef.current) {
          clearTimeout(updateAIConfigDebounceRef.current);
        }
        updateAIConfigDebounceRef.current = setTimeout(() => {
          updateAIConfigTimeoutRef.current = 0;
          const latestSessionId = persistenceRef.current?.getSessionId?.();
          if (latestSessionId) {
            aiPersistence.saveSessionConfig(latestSessionId, newConfig)
              .catch(err => console.error('[useApexLogic] Erro ao salvar config (debounce):', err));
          }
        }, 3000);
      }

      return newConfig;
    });
  }, []);

  // === CONNECT TO MT5 ===
  const connectToMT5 = useCallback(async (credentials: MetaApiCredentials) => {
    try {
      addLog('🔌 Conectando ao MT5...');
      setMT5Credentials(credentials);
      mt5CredentialsRef.current = credentials;

      // 🔥 BUSCAR SALDO REAL VIA BACKEND (Fase 1: credenciais nunca mais no client)
      // NOTA: este bloco já foi envolvido em wrapMT5Connection(), um decorator de
      // debug da arquitetura ANTIGA (SDK MetaAPI rodando no client, extinta na
      // Fase 1). Ele fazia `connection.getAccountInformation.bind(connection)` —
      // recebendo uma função async no lugar do objeto de conexão da SDK, isso
      // lançava TypeError na primeira linha, SEMPRE. Resultado: connectToMT5()
      // nunca chegava a rodar o código de verdade, caía direto no catch externo
      // e reportava falha de conexão qualquer que fosse o estado real da conta.
      const result = await (async () => {
        try {
          console.log('[useApexLogic] 🌐 Buscando saldo real via backend...');

          const { getBrokerCredentialsStatus, getAccountInfo } = await import('../services/BrokerClient');

          const status = await getBrokerCredentialsStatus();
          if (!status.configured) {
            throw new Error('Nenhuma credencial MetaAPI configurada para este usuário (configure em Configurações)');
          }

          // Buscar informações da conta
          const accountInfo = await getAccountInfo();
          if (!accountInfo) {
            throw new Error('Não foi possível obter informações da conta');
          }

          console.log('[useApexLogic] ✅ Saldo real obtido:', accountInfo);
          
          return {
            success: true,
            accountId: credentials.login,
            balance: accountInfo.balance,
            equity: accountInfo.equity,
            currency: accountInfo.currency,
          };
        } catch (error: any) {
          console.error('[useApexLogic] ❌ Erro ao buscar saldo:', error);
          return {
            success: false,
            error: error.message || 'Erro ao conectar ao MT5'
          };
        }
      })();

      if (result.success) {
        setIsConnectedToMT5(true);
        setMT5AccountId(result.accountId || null);
        mt5AccountIdRef.current = result.accountId || null;
        lastMT5SyncRef.current = Date.now();
        failedMT5AttemptsRef.current = 0;

        // Set initial balance from MT5
        if (result.balance) {
          setPortfolio(prev => ({
            ...prev,
            balance: result.balance,
            equity: result.equity || result.balance,
            initialBalance: result.balance,
            ...reanchorDrawdown(result.equity || result.balance),
          }));
          
          addLog(`💰 Saldo carregado: ${result.currency || 'USD'} ${result.balance.toFixed(2)}`);
        }

        addLog('✅ Conectado ao MT5 com sucesso!');
        toast.success('Conectado ao MT5!');
      } else {
        throw new Error(result.error || 'Falha na conexão');
      }
    } catch (error: any) {
      addLog(`❌ Erro ao conectar: ${error.message}`);
      toast.error(`Erro ao conectar ao MT5: ${error.message}`);
      failedMT5AttemptsRef.current++;
    }
  }, [addLog]);

  // === DISCONNECT FROM MT5 ===
  const disconnectFromMT5 = useCallback(() => {
    setIsConnectedToMT5(false);
    setMT5AccountId(null);
    mt5AccountIdRef.current = null;
    setMT5Credentials(null);
    mt5CredentialsRef.current = null;
    addLog('🔌 Desconectado do MT5');
    toast.info('Desconectado do MT5');
  }, [addLog]);

  // === SAFE MODE CONTROL ===
  const disableSafeMode = useCallback(() => {
    setIsSafeMode(false);
    setSafeModeReason(null);
    addLog('🟢 Safe Mode Desativado');
  }, [addLog]);

  // === CANDLE COUNTER CONTROL ===
  const updateCandleCounter = useCallback((value: number) => {
    setCandlesSinceLastTrade(value);
  }, []);

  const updateMaxCandlesBeforeForceEntry = useCallback((value: number) => {
    setMaxCandlesBeforeForceEntry(value);
  }, []);

  // === UPDATE BALANCE (for MT5 sync) ===
  const updateBalance = useCallback((newBalance: number) => {
    console.log('[updateBalance] 🎯 CHAMADA RECEBIDA:', newBalance);
    console.log('[updateBalance] 📊 Portfolio ANTES:', {
      balance: portfolioRef.current?.balance,
      equity: portfolioRef.current?.equity,
      initialBalance: portfolioRef.current?.initialBalance
    });
    
    setPortfolio(prev => {
      const updated = {
        ...prev,
        balance: newBalance,
        equity: newBalance,
        initialBalance: newBalance,
        ...reanchorDrawdown(newBalance),
      };
      console.log('[updateBalance] ✅ Portfolio ATUALIZADO:', updated);
      return updated;
    });
    
    addLog(`💰 Saldo atualizado para $${newBalance.toFixed(2)}`);
  }, [addLog]);

  // === UPDATE PORTFOLIO (for MT5 sync with equity) ===
  const updatePortfolioFromMT5 = useCallback((data: { balance: number; equity: number }) => {
    console.log('[updatePortfolioFromMT5] 🎯 CHAMADA RECEBIDA:', data);
    console.log('[updatePortfolioFromMT5] 📊 Portfolio ANTES:', {
      balance: portfolioRef.current?.balance,
      equity: portfolioRef.current?.equity,
      initialBalance: portfolioRef.current?.initialBalance
    });
    
    setPortfolio(prev => {
      const updated = {
        ...prev,
        balance: data.balance,
        equity: data.equity,
        initialBalance: prev.initialBalance || data.balance, // Manter initialBalance original se existir
        // Sync recorrente (não é reset): NÃO re-ancora, só deixa o high-water mark
        // acompanhar um novo topo vindo da corretora. Se as âncoras ainda não
        // existem (primeiro sync), semeia com o equity real em vez do default.
        peakEquity: Math.max(prev.peakEquity ?? data.equity, data.equity),
        dayAnchorEquity: prev.dayAnchorEquity ?? data.equity,
        dayAnchorBalance: prev.dayAnchorBalance ?? data.balance,
      };
      console.log('[updatePortfolioFromMT5] ✅ Portfolio ATUALIZADO:', updated);
      return updated;
    });
    
    const floatingPnL = data.equity - data.balance;
    addLog(`💰 Portfolio MT5: Balance $${data.balance.toFixed(2)} | Equity $${data.equity.toFixed(2)} | PnL ${floatingPnL >= 0 ? '+' : ''}$${floatingPnL.toFixed(2)}`);
  }, [addLog]);

  // === SYNC POSITIONS FROM MT5 ===
  const syncPositionsFromMT5 = useCallback((positions: any[]) => {
    console.log('[syncPositionsFromMT5] 🎯 SINCRONIZANDO', positions.length, 'POSIÇÕES');
    
    const convertedOrders: TradeVisual[] = positions.map((pos: any) => {
      const side: 'LONG' | 'SHORT' = pos.type === 'POSITION_TYPE_BUY' ? 'LONG' : 'SHORT';
      const profit = pos.profit || 0;
      
      console.log('[syncPositionsFromMT5] 📍 Convertendo:', {
        symbol: pos.symbol,
        side,
        openPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        volume: pos.volume,
        profit
      });
      
      return {
        id: `mt5-${pos.id || Math.random()}`,
        symbol: pos.symbol,
        side,
        amount: pos.volume * 100, // Volume em lotes convertido para capital estimado
        price: pos.openPrice,
        currentPrice: pos.currentPrice,
        currentProfit: profit,
        tp: pos.takeProfit || (side === 'LONG' ? pos.openPrice * 1.02 : pos.openPrice * 0.98),
        sl: pos.stopLoss || (side === 'LONG' ? pos.openPrice * 0.98 : pos.openPrice * 1.02),
        originalSl: pos.stopLoss || (side === 'LONG' ? pos.openPrice * 0.98 : pos.openPrice * 1.02),
        leverage: pos.leverage || 1,
        ai_confidence: 75, // Posição já aberta
        timestamp: pos.time || Date.now(),
        reasoning: `MT5 Import - ${side} @ ${pos.openPrice}`,
        indicators: {
          rsi: 50,
          macd: side === 'LONG' ? 'BULLISH' : 'BEARISH',
          trend: side === 'LONG' ? 'BULLISH' : 'BEARISH',
        },
      };
    });
    
    setActiveOrders(convertedOrders);
    console.log('[syncPositionsFromMT5] ✅', convertedOrders.length, 'posições sincronizadas!');
    addLog(`📊 Sincronizado ${convertedOrders.length} posições do MT5`);
  }, [addLog]);

  return {
    // State
    isActive,
    isPaused,
    activeOrders,
    portfolio,
    recentLogs,
    orderHistory,
    houseStats,
    performanceMetrics,
    healthStatus,
    aiConfig,
    mt5Credentials,
    executionMode,
    isConnectedToMT5,
    mt5AccountId,
    isSafeMode,
    safeModeReason,
    candlesSinceLastTrade,
    maxCandlesBeforeForceEntry,
    equityHistory,
    lastPositionSyncAt,

    // Actions
    startLogic,
    stopLogic,
    pauseLogic,
    resumeLogic,
    resetLogic,
    forceCloseAll,
    openManualPosition,
    closeManualPosition,
    pendingOrders,
    openManualPendingOrder,
    cancelManualPendingOrder,
    checkPendingOrderTriggers,
    updateAIConfig,
    connectToMT5,
    disconnectFromMT5,
    disableSafeMode,
    updateCandleCounter,
    updateMaxCandlesBeforeForceEntry,
    updateBalance,
    updatePortfolioFromMT5,
    syncPositionsFromMT5,
    setExecutionMode,
  };
}