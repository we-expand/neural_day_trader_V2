import { useState, useEffect, useRef, useCallback } from 'react';

import { toast as toastOriginal } from 'sonner';
import { getSpread, applySpread } from '@/config/spreads'; // 🎯 Funções de Spread (sem hook)
import { calculateRealisticPnL, calculatePnLWithLeverage, getContractSpec, getContractInfo } from '@/config/contractSpecs'; // 💰 Especificações de Contrato
import { Strategy as StrategyDef } from '@/app/types/strategy';
import { PRESET_STRATEGIES } from '@/app/data/presetStrategies';
import { evaluateStrategyAt } from '@/app/services/strategy/StrategyEvaluator';
import { calculateRSI, calculateATR } from '@/app/services/indicators/TechnicalIndicators';
import { backtestDataService } from '@/app/services/BacktestDataService';
import { MarketScoreEngine } from '@/app/services/MarketScoreEngine';
import type { Timeframe as ScoreTimeframe } from '@/app/services/BacktestDataService';

/**
 * Normaliza o timeframe operacional escolhido na UI (aiConfig.timeframe, ex:
 * '1H'/'4H') pro tipo que o MarketScoreEngine/BacktestDataService esperam
 * (minúsculo). Sem isso, o Score seria calculado sempre no timeframe errado
 * (ou falharia silenciosamente) sempre que o usuário escolhesse 1H/4H.
 */
function normalizeAiTimeframe(tf: string | undefined): ScoreTimeframe {
  const valid: ScoreTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const lower = (tf || '5m').toLowerCase() as ScoreTimeframe;
  return valid.includes(lower) ? lower : '5m';
}

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
import { RiskManager, type RiskConfig, type DailyStats } from '../../lib/modules/RiskManager'; // Fase 1: validação de risco
import { useAuth } from '../contexts/AuthContext'; // Fase 2: usuário logado p/ persistência
import { useAIPersistence } from './useAIPersistence'; // Fase 2: persiste sessão DEMO no Supabase

// 🔒 RESPEITAR CONFIG DO USUÁRIO: riskProfile. Antes esse campo era salvo mas nunca
// lido - qualquer perfil escolhido (conservador/agressivo/institucional) tinha o
// mesmo tamanho de posição e mesma barra de confiança mínima. Cobre tanto os valores
// oficiais de RiskProfileType (NeuralRiskGuardian.ts) quanto os legados já em uso na
// UI (EQUILIBRADO/DEGEN, ver MarketScore.tsx e o default de INITIAL_STATE), pra não
// quebrar configs já salvas no localStorage de quem já usa o app.
/** Rótulos de perfil de risco de versões antigas, ainda presentes no localStorage. */
export type LegacyRiskProfile = 'EQUILIBRADO' | 'DEGEN';

const RISK_PROFILE_ADJUSTMENTS: Record<string, { confidenceAdjust: number; sizeMultiplier: number }> = {
  CONSERVATIVE: { confidenceAdjust: 15, sizeMultiplier: 0.7 },
  MODERATE: { confidenceAdjust: 0, sizeMultiplier: 1.0 },
  EQUILIBRADO: { confidenceAdjust: 0, sizeMultiplier: 1.0 }, // legado, equivalente a MODERATE
  AGGRESSIVE: { confidenceAdjust: -10, sizeMultiplier: 1.3 },
  DEGEN: { confidenceAdjust: -10, sizeMultiplier: 1.3 }, // legado, equivalente a AGGRESSIVE
  INSTITUTIONAL: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
  INSTITUTIONAL_SMC: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
};
const DEFAULT_RISK_ADJUSTMENT = { confidenceAdjust: 0, sizeMultiplier: 1.0 };

// Grupos de correlação estáticos (heurística, não é correlação de retornos calculada ao vivo —
// ver research/RISK_MODULE_SPEC.md seção 3.5 para o plano de evoluir isso pra correlação real).
const CORRELATION_GROUPS: Record<string, string> = {
  EURUSD: 'USD_MAJORS', GBPUSD: 'USD_MAJORS', AUDUSD: 'USD_MAJORS', NZDUSD: 'USD_MAJORS',
  USDJPY: 'USD_JPY_CHF', USDCHF: 'USD_JPY_CHF', USDCAD: 'USD_JPY_CHF',
  XAUUSD: 'METALS', XAGUSD: 'METALS', XPTUSD: 'METALS', XPDUSD: 'METALS',
  BTCUSD: 'CRYPTO_MAJOR', XBNUSD: 'CRYPTO_MAJOR', XETUSD: 'CRYPTO_MAJOR', XLCUSD: 'CRYPTO_MAJOR',
  SPX500: 'US_INDICES', NAS100: 'US_INDICES', US30: 'US_INDICES', US2000: 'US_INDICES',
  GER40: 'EU_INDICES', FRA40: 'EU_INDICES', UK100: 'EU_INDICES', ESP35: 'EU_INDICES',
};
function getCorrelationGroup(symbol: string): string | null {
  return CORRELATION_GROUPS[symbol] || null;
}

// Definition of types for visual state
export interface TradeVisual {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  price: number;
  currentPrice?: number;
  currentProfit?: number; // Added for Real PnL from MT5
  closedAt?: number; // Timestamp when the trade was closed
  tp: number;
  sl: number;
  leverage: number;
  ai_confidence: number;
  timestamp: number;
  reasoning: string; 
  hasTakenPartial?: boolean;
  indicators: {
    rsi: number;
    macd: string;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
}

export interface PortfolioState {
  balance: number;
  equity: number;
  maxDrawdownLimit: number;
  currentDrawdown: number;
  openPositionsValue: number;
  initialBalance?: number; // Added to track profit
  // Âncoras reais de drawdown. Antes o "drawdown" era calculado como
  // (balance - equity)/balance e acumulado com Math.max() sem nunca resetar —
  // media só o P&L não-realizado negativo das posições abertas (não é drawdown)
  // e, uma vez estourado o limite, travava o Safe Mode pra sempre mesmo com a
  // conta recuperada e em novo topo. Agora existem as duas âncoras reais que o
  // campo aiConfig.drawdownAnchor seleciona (padrão FTMO/Topstep):
  peakEquity?: number;        // high-water mark do equity (âncora INTRADAY_PEAK)
  dayAnchorEquity?: number;   // equity no início do dia UTC (âncora DAILY_CLOSE)
  dayAnchorUtcDay?: number;   // Date.UTC do dia a que dayAnchorEquity se refere
  maxDrawdownReached?: number; // pior drawdown já atingido (só métrica/histórico,
                               // NUNCA usado como gate — o gate usa currentDrawdown)
}

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
  'currentDrawdown' | 'maxDrawdownReached' | 'peakEquity' | 'dayAnchorEquity' | 'dayAnchorUtcDay'
> {
  return {
    currentDrawdown: 0,
    maxDrawdownReached: 0,
    peakEquity: equity,
    dayAnchorEquity: equity,
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

export interface MetaApiCredentials {
  login: string;
  server: string;
  password?: string;
  // initialBalance removed, we calculate it automatically
}

export interface AIConfig {
  direction: 'AUTO' | 'LONG' | 'SHORT';
  marketMode: 'TREND' | 'RANGE' | 'SCALP' | 'COUNTER';
  targetPoints: 'MÉDIO' | 'CURTO' | 'LONGO' | 'POUCOS' | 'MUITOS';
  stopLossMode: 'DINAMICO' | 'FIXO';
  allocatedCapital: number;
  maxContracts: number;
  maxPositions: number;
  maxDrawdown: number;
  riskPerTrade: number;
  minWinRate: number;
  // Inclui os rótulos legados ('EQUILIBRADO'/'DEGEN') porque eles EXISTEM de fato
  // no localStorage de usuários antigos e são tratados em RISK_PROFILE_ADJUSTMENTS.
  // Declarar só RiskProfileType deixava o tipo mentir sobre o valor real em uso
  // (o próprio default do projeto é 'EQUILIBRADO').
  riskProfile: RiskProfileType | LegacyRiskProfile;
  
  // 🆕 PROPRIEDADES FALTANTES (usadas pelo AITrader.tsx)
  activeAssets: string[]; // ✅ Lista de ativos selecionados (Infinox válidos)
  maxAssets: number; // 🆕 AUMENTADO DE 3 PARA 6 - Máximo de ativos simultâneos diferentes
  timeframe: string; // Timeframe operacional (1m, 5m, 15m, 1H, 4H)
  newsFilter: boolean; // Filtro de notícias econômicas
  dailyLossLimit: number; // Limite de perda diária (%)
  metaApiToken?: string; // 🔑 Token do MetaApi para integração MT5
  // 🆕 Estratégia ativa (pronta ou customizada) — o motor de decisão passa a
  // rodar exatamente essa estratégia via evaluateStrategyAt, a mesma função
  // usada pelo Backtest. null = nenhuma selecionada (ciclo é pulado).
  activeStrategyId: string | null;

  // 🆕 Módulo de Gerenciamento de Risco (research/RISK_MODULE_SPEC.md) — regras
  // adicionais, todas customizáveis pelo usuário na aba "Gerenciamento de Risco".
  drawdownAnchor: 'INTRADAY_PEAK' | 'DAILY_CLOSE'; // FTMO/Topstep ancoram no fechamento diário
  cooldownEnabled: boolean;
  consecutiveLossesTrigger: number; // ex: 3 perdas seguidas ativa o cooldown
  cooldownMinutes: number; // duração do bloqueio de novas entradas
  maxTradesPerDay: number; // 0 = sem limite
  positionSizingMode: 'FIXED' | 'ATR'; // FIXED = % linear (riskPerTrade); ATR = ajustado por volatilidade real
  atrMultiplier: number; // só usado quando positionSizingMode === 'ATR'
  correlationGuardEnabled: boolean;
  correlationThreshold: number; // 0-1, acima disso reduz o tamanho da nova posição
  killSwitchThreshold?: number; // % perda que ativa kill-switch automático (ex: 10.0)
}

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
    riskPerTrade: 2,
    minWinRate: 55,
    riskProfile: 'EQUILIBRADO',
    
    // 🆕 PROPRIEDADES FALTANTES (usadas pelo AITrader.tsx)
    activeAssets: ['EURUSD', 'XBNUSD'], // ✅ Lista de ativos selecionados (Infinox válidos)
    maxAssets: 6, // 🆕 AUMENTADO DE 3 PARA 6 - Máximo de ativos simultâneos diferentes
    timeframe: '15m', // Timeframe operacional (1m, 5m, 15m, 1H, 4H)
    newsFilter: true, // Filtro de notícias econômicas
    dailyLossLimit: 5, // Limite de perda diária (%)
    metaApiToken: '', // 🔑 Token do MetaApi para integração MT5
    activeStrategyId: '2', // Padrão: "Cruzamento de Médias com Filtro de Regime" (tendência, ADX-gated), mesma estratégia disponível no Backtest

    // Gerenciamento de Risco — defaults conservadores (modelo FTMO/Topstep)
    drawdownAnchor: 'DAILY_CLOSE',
    cooldownEnabled: true,
    consecutiveLossesTrigger: 3,
    cooldownMinutes: 60,
    maxTradesPerDay: 0, // 0 = sem limite
    positionSizingMode: 'ATR', // ✅ Padrão: position sizing por volatilidade real
    atrMultiplier: 1.5,
    correlationGuardEnabled: false, // TODO: Implementar correlação real em Fase 2
    correlationThreshold: 0.7,
    killSwitchThreshold: 0, // 0 = desativado por padrão; pode ser setado pelo usuário (ex: 10% de perda)
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
  useEffect(() => { onLiveDecisionRef.current = onLiveDecision; }, [onLiveDecision]);

  // Ref pra sempre ler a lista de estratégias mais atual dentro do setInterval sem recriar o loop
  const strategiesRef = useRef<StrategyDef[]>(strategies);
  useEffect(() => { strategiesRef.current = strategies; }, [strategies]);

  // Buffer de candles reais por ativo, usado pelo evaluateStrategyAt (indicadores
  // precisam de histórico, não só do preço tick a tick). Renovado a cada 60s por
  // símbolo pra não bater a API a cada ciclo de 5s.
  const candleBufferRef = useRef<Map<string, { candles: import('../services/indicators/TechnicalIndicators').Candle[]; fetchedAt: number }>>(new Map());
  // Gerenciamento de Risco: timestamp (ms) até quando novas entradas ficam bloqueadas por cooldown
  const cooldownUntilRef = useRef<number>(0);
  // === STATE MANAGEMENT ===
  const [isActive, setIsActive] = useState(INITIAL_STATE.isActive);
  const [isPaused, setIsPaused] = useState(INITIAL_STATE.isPaused);
  const [activeOrders, setActiveOrders] = useState<TradeVisual[]>(INITIAL_STATE.activeOrders);
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
  const lastEquitySampleAtRef = useRef<number>(0);
  const EQUITY_SAMPLE_INTERVAL_MS = 10000; // amostra real a cada 10s
  const MAX_EQUITY_POINTS = 180; // ~30min de janela

  // === VIX CACHE CONFIG ===
  // 🔥 CORREÇÃO CRÍTICA: useRef DEPOIS de useState (Rules of Hooks)
  const cachedVIXRef = useRef(0);
  const lastVIXFetchRef = useRef(0);
  const VIX_CACHE_DURATION = 60000; // 60 segundos de cache

  // === NEWS FILTER CACHE CONFIG (aiConfig.newsFilter) ===
  const cachedNewsEventsRef = useRef<Array<{ time: number; impact: string; currency: string }>>([]);
  const lastNewsFetchRef = useRef(0);
  const NEWS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache

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
  const candleCounterRef = useRef(INITIAL_STATE.candlesSinceLastTrade);
  const maxCandlesRef = useRef(INITIAL_STATE.maxCandlesBeforeForceEntry);
  const isRunningCycleRef = useRef(false);
  const isWaitingNewCandleRef = useRef(false);
  const lastTradeTimestampRef = useRef(0);
  const lastTradedSymbolRef = useRef<string | null>(null); // ✅ NOVO: Anti-repetição de ativo
  const cycleIntervalRef = useRef(INITIAL_STATE.cycleInterval);

  // === REFS FOR PNL LOOP ===
  const activeOrdersRef = useRef<TradeVisual[]>([]);
  const orderHistoryRef = useRef<TradeVisual[]>([]); // 🔒 leitura pro Health Check Guardian (dailyLossLimit/minWinRate)
  const pnlLoopRef = useRef({ realizedPnL: 0, totalUnrealizedPnL: 0, totalExposure: 0 });
  const pnlLogsRef = useRef<string[]>([]);
  const closedForPersistenceRef = useRef<Array<{ id: string; exitPrice: number; pnl: number; reason: 'TP' | 'SL' }>>([]);
  const lastSnapshotAtRef = useRef(0);
  const hasHydratedFromSupabaseRef = useRef(false);

  // === FASE 2: PERSISTÊNCIA DEMO NO SUPABASE ===
  const { user } = useAuth();
  const persistence = useAIPersistence({ enabled: executionMode === 'DEMO', autoSnapshot: false });
  // Ref sempre atualizado p/ ser lido dentro de intervals/callbacks sem precisar
  // adicionar `persistence` (objeto novo a cada render) nas dependências dos efeitos.
  const persistenceRef = useRef(persistence);
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

  useEffect(() => {
    activeOrdersRef.current = activeOrders;
  }, [activeOrders]);

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
      try {
        const restored = await persistenceRef.current.restoreActiveSession();
        if (!restored?.session) return;

        const { session, openTrades, lastSnapshot } = restored;

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

  // === HEALTH CHECK (Every 5 seconds) ===
  useEffect(() => {
    const interval = setInterval(() => {
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
      const closedToday = orderHistoryRef.current.filter(t => t.closedAt && t.closedAt >= startOfUtcDay);
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
      const MIN_SAMPLE_FOR_WIN_RATE_CHECK = 10;
      const allClosedTrades = orderHistoryRef.current.filter(t => t.closedAt);
      if (allClosedTrades.length >= MIN_SAMPLE_FOR_WIN_RATE_CHECK) {
        const wins = allClosedTrades.filter(t => (t.currentProfit || 0) > 0).length;
        const currentWinRate = (wins / allClosedTrades.length) * 100;
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
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnectedToMT5]);

  // === SAFE MODE GUARDIAN (Check before ANY trade) ===
  useEffect(() => {
    console.log(`[TRADING] 📊 Status: isActive=${isActive}, isPaused=${isPaused}, isSafeMode=${isSafeMode}`);
    
    if (!isActive || isPaused) {
      console.log('[TRADING] ⏸️ AI está pausada ou inativa - não iniciando loop de trading');
      return;
    }

    console.log('[TRADING] 🚀 Sistema de Trading AI ATIVADO - Procurando oportunidades...');

    // 🚀 OTIMIZAÇÃO #4: Conectar WebSocket para cryptos (TEMPO REAL!)
    const connectWebSocket = async () => {
      try {
        const { getBinanceWebSocketManager } = await import('@/app/services/BinanceWebSocketManager');
        const wsManager = getBinanceWebSocketManager();
        
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
        
        cachedVIXRef.current = vixData.value;
        lastVIXFetchRef.current = now;
        console.log(`[VIX] 🔄 VIX atualizado: ${cachedVIXRef.current.toFixed(2)} (Fonte: ${vixData.source})`);
        return cachedVIXRef.current;
      } catch (error) {
        console.warn('[VIX] ⚠️ Erro ao buscar VIX, usando último valor');
        return cachedVIXRef.current || 15; // Fallback
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

    const tradingInterval = setInterval(() => {
      console.log(`[AI LOOP] 🔄 Verificando oportunidades... (Posições: ${activeOrders.length}/${aiConfig.maxPositions})`);

      // Check if we can trade
      if (activeOrders.length >= aiConfig.maxPositions) {
        console.log(`[AI LOOP] ⏸️ Máximo de posições atingido (${aiConfig.maxPositions})`);
        return; // Max positions reached
      }

      // 🔒 Gate de notícias: pula o ciclo se houver evento de alto impacto na janela de ±15min.
      // O fetch é assíncrono (dispara em background e atualiza o cache), mas o gate em si
      // precisa ser síncrono pra realmente bloquear o ciclo - por isso lê o cache já
      // atualizado por uma chamada anterior, em vez de esperar o `.then()` (que só resolveria
      // depois que o resto do ciclo síncrono já teria rodado).
      if (aiConfig.newsFilter) {
        fetchNewsCached(); // fire-and-forget: mantém o cache atualizado pros próximos ciclos
        const NEWS_WINDOW_MS = 15 * 60 * 1000;
        const nowTs = Date.now();
        const highImpactNearby = cachedNewsEventsRef.current.some(e => e.impact === 'high' && Math.abs(e.time - nowTs) <= NEWS_WINDOW_MS);
        if (highImpactNearby) {
          console.log('[NEWS FILTER] 🚫 Evento de alto impacto próximo - pulando ciclo');
          return;
        }
      }

      // 🚀 ANÁLISE DE VOLATILIDADE GLOBAL (VIX + principais ativos)
      let globalVolatility = false;
      
      // Fetch VIX para detectar volatilidade do mercado
      fetchVIXCached().then(vix => {
        if (vix > 20) {
          console.log(`[VOLATILIDADE] 🔥 VIX ALTO: ${vix.toFixed(2)} - MODO AGRESSIVO ATIVADO!`);
          globalVolatility = true;
        }
      });

      // ✅ COOLDOWN: Tempo mínimo entre trades
      const timeSinceLastTrade = Date.now() - lastTradeTimestampRef.current;
      
      // 🚀 MODO OPORTUNISTA: Cooldown dinâmico baseado em volatilidade
      // - Alta volatilidade (VIX > 20 ou movimento > 3%): 2 segundos
      // - Volatilidade normal: 5 segundos (ULTRA RÁPIDO!)
      const COOLDOWN_AGGRESSIVE = 2 * 1000;   // 2s para alta volatilidade (REDUZIDO!)
      const COOLDOWN_NORMAL = 5 * 1000;       // 5s para volatilidade normal (MUITO MAIS RÁPIDO!)
      
      const COOLDOWN_MS = globalVolatility ? COOLDOWN_AGGRESSIVE : COOLDOWN_NORMAL;
      
      if (timeSinceLastTrade < COOLDOWN_MS && lastTradeTimestampRef.current > 0) {
        const remainingSeconds = Math.floor((COOLDOWN_MS - timeSinceLastTrade) / 1000);
        console.log(`[COOLDOWN] ⏳ Aguardando ${remainingSeconds}s antes do próximo trade`);
        return;
      }
      
      console.log(`[AI LOOP] ✅ Cooldown OK - Analisando mercado...`);

      // === ASSET SELECTION WITH PRIORITY SYSTEM ===
      // 🎯 TIER 1: High volatility, high profit assets (70% probability)
      const tier1Assets = ['BTCUSDT', 'SPX500']; // BTC & S&P500 (Nomenclatura Infinox)

      // 🔸 TIER 2: Medium volatility assets (25% probability)
      const tier2Assets = ['ETHUSDT', 'NAS100', 'XAUUSD'];

      // 🔹 TIER 3: Low volatility assets (5% probability)
      const tier3Assets = ['EURUSD', 'GBPUSD', 'US30'];

      // 🔒 RESPEITAR CONFIG DO USUÁRIO: symbols internos do motor (Binance/CFD) →
      // símbolos do catálogo que o usuário marca em "Universo de Ativos" (AssetUniverse.tsx,
      // nomenclatura Infinox). Sem esse mapa, os 3 tiers acima ignoravam completamente
      // aiConfig.activeAssets e o sorteio podia cair em Ouro/Forex/Índices mesmo com
      // o usuário tendo selecionado só criptomoedas.
      const TRADING_SYMBOL_TO_CATALOG: Record<string, string[]> = {
        BTCUSDT: ['BTCUSD', 'XBNUSD'],
        ETHUSDT: ['XETUSD'],
        SPX500: ['SPX500', 'SPX500R'],
        NAS100: ['NAS100', 'NAS100R'],
        XAUUSD: ['XAUUSD'],
        EURUSD: ['EURUSD'],
        GBPUSD: ['GBPUSD'],
        US30: ['US30'],
      };

      const userAssets = aiConfig.activeAssets || [];
      const isAllowedByUser = (symbol: string) =>
        (TRADING_SYMBOL_TO_CATALOG[symbol] || []).some(catalogSymbol => userAssets.includes(catalogSymbol));

      const allowedTier1 = tier1Assets.filter(isAllowedByUser);
      const allowedTier2 = tier2Assets.filter(isAllowedByUser);
      const allowedTier3 = tier3Assets.filter(isAllowedByUser);

      if (allowedTier1.length === 0 && allowedTier2.length === 0 && allowedTier3.length === 0) {
        console.log(`[AI LOOP] 🚫 Nenhum ativo selecionado pelo usuário está disponível no motor agora (config: ${userAssets.join(', ') || 'vazia'}) - pulando ciclo`);
        return;
      }

      // Weighted random selection (mesmos pesos de antes, só que restrito ao que o usuário permitiu)
      const rand = Math.random();
      let selectedAssets: string[];
      let tierName = '';

      if (rand < 0.70 && allowedTier1.length > 0) {
        selectedAssets = allowedTier1; // 70% chance - BTC & S&P
        tierName = 'TIER 1 (Alta Volatilidade)';
      } else if (rand < 0.95 && allowedTier2.length > 0) {
        selectedAssets = allowedTier2; // 25% chance - ETH, NAS, Gold
        tierName = 'TIER 2 (Média Volatilidade)';
      } else if (allowedTier3.length > 0) {
        selectedAssets = allowedTier3; // 5% chance - Forex & Dow
        tierName = 'TIER 3 (Baixa Volatilidade)';
      } else {
        // Tier sorteada ficou vazia após o filtro do usuário - cai pra qualquer tier não-vazia
        selectedAssets = allowedTier1.length > 0 ? allowedTier1 : allowedTier2.length > 0 ? allowedTier2 : allowedTier3;
        tierName = 'FALLBACK (restrito à config do usuário)';
      }

      const selectedSymbol = selectedAssets[Math.floor(Math.random() * selectedAssets.length)];
      
      // 🚫 ANTI-REPETIÇÃO: NÃO pode fazer 2 trades seguidos no mesmo ativo
      if (lastTradedSymbolRef.current === selectedSymbol) {
        console.log(`[ANTI-REPETIÇÃO] ❌ Bloqueado: Último trade foi em ${selectedSymbol}. Aguardando outro ativo...`);
        return;
      }
      
      // 🛡️ ANTI-HEDGING CHECK: Verificar se já existe posição neste ativo
      const existingPositionOnAsset = activeOrders.find(order => order.symbol === selectedSymbol);
      
      if (existingPositionOnAsset) {
        // Já existe posição neste ativo, NÃO abrir nova posição (previne hedging)
        console.log(`[ANTI-HEDGING] ⚠️ Bloqueado: Já existe posição ${existingPositionOnAsset.side} em ${selectedSymbol}`);
        return;
      }
      
      // 🎯 CHECK: Verificar número de ativos diferentes simultâneos
      const uniqueAssets = new Set(activeOrders.map(order => order.symbol));
      if (uniqueAssets.size >= aiConfig.maxAssets) {
        // Já atingiu o máximo de ativos diferentes
        console.log(`[ASSET LIMIT] ⚠️ Bloqueado: Máximo de ${aiConfig.maxAssets} ativos diferentes atingido`);
        return;
      }

      // ✅ ANÁLISE PROFISSIONAL DE MERCADO
      // 🚀 OTIMIZAÇÃO #4 & #5: WebSocket + Batch paralelo com fallback inteligente
      (async () => {
        try {
          console.log(`[TRADING] 🔍 Analisando ${selectedSymbol} (buscando dados reais)...`);
          
          let priceData = null;
          
          // 🚀 OTIMIZAÇÃO #4: Tentar WebSocket primeiro (TEMPO REAL - 100ms!)
          const isCrypto = /BTC|ETH|SOL|XRP|BNB|ADA|DOGE|POL|LINK|USDT/i.test(selectedSymbol); // POL = Polygon (rebrandado de MATIC)
          
          if (isCrypto) {
            try {
              const { getBinanceWebSocketManager } = await import('@/app/services/BinanceWebSocketManager');
              const wsManager = getBinanceWebSocketManager();
              
              // Verificar se temos preço em cache do WebSocket
              const wsPrice = wsManager.getPrice(selectedSymbol);
              
              if (wsPrice && wsManager.isConnected()) {
                // ✅ SUCESSO: Usar preço do WebSocket (INSTANTÂNEO!)
                priceData = {
                  price: wsPrice.price,
                  changePercent24h: wsPrice.priceChangePercent,
                  change24h: wsPrice.priceChange,
                  volume: wsPrice.volume,
                  source: 'WEBSOCKET' as any, // Tempo real!
                  timestamp: wsPrice.timestamp
                };
                console.log(`[WebSocket] ⚡ ${selectedSymbol}: Preço em tempo real obtido! (latência ~100ms)`);
              } else {
                console.log(`[WebSocket] ⚠️ Cache vazio ou desconectado, usando REST...`);
              }
            } catch (error) {
              console.warn('[WebSocket] ⚠️ Erro ao acessar WebSocket, usando REST...', error);
            }
          }
          
          // 🔄 FALLBACK: Se WebSocket falhou, usar REST API
          // 🔧 FIX: `fetchRealPrice` (singular) foi removido de realPriceProvider.ts
          // num refactor anterior (só sobrou `fetchRealPricesBatch`, desabilitado) e
          // nunca foi atualizado aqui — toda chamada disparava
          // "TypeError: fetchRealPrice is not a function", travando a análise pra
          // TODO símbolo sem preço em cache do WebSocket e bloqueando qualquer
          // entrada de trade. `getRealMarketData` é a função real usada com sucesso
          // em outros lugares do app (dashboard, BinanceWebSocketManager).
          if (!priceData) {
            const { getRealMarketData } = await import('@/app/services/RealMarketDataService');
            const marketData = await getRealMarketData(selectedSymbol);
            priceData = {
              price: marketData.price,
              changePercent24h: marketData.changePercent || 0,
              change24h: marketData.change || 0,
              volume: marketData.volume || 0,
              source: marketData.source as any,
              timestamp: marketData.timestamp
            };
            console.log(`[REST API] 📡 ${selectedSymbol}: Preço obtido via ${marketData.source} (${marketData.isRealData ? 'real' : 'fallback'})`);
          }
          
          if (!priceData) {
            throw new Error('Nenhum dado de preço disponível');
          }
          
          const currentPrice = priceData.price;
          const priceChangePercent = priceData.changePercent24h;
          const volume24h = priceData.volume || 50000; // Volume padrão se não disponível
          
          console.log(`[TRADING] ✅ ${selectedSymbol}:`, {
            price: currentPrice.toFixed(2),
            change: `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
            source: priceData.source
          });
          
          // 🔒 2026-07-24: o "score de confiança" antigo aqui era uma heurística
          // caseira (volatilidade%+volume+VIX), sem nenhuma relação com o Market
          // Score real/calibrado que o Dashboard usa (MarketScoreEngine.ts) — a
          // IA e o Dashboard liam dois "cérebros" diferentes e podiam discordar.
          // Removido o pré-filtro cego daqui; a confiança real (estratégia +
          // Score calibrado, no MESMO timeframe operado) é checada mais abaixo,
          // depois que a estratégia já sugeriu um lado — ver "GATE DO SCORE".
          const riskAdjustment = RISK_PROFILE_ADJUSTMENTS[aiConfig.riskProfile] || DEFAULT_RISK_ADJUSTMENT;
          const MIN_CONFIDENCE = 45 + riskAdjustment.confidenceAdjust; // 🚀 BASE REDUZIDA DE 60% PARA 45% - Muito mais oportunidades!

          // 🆕 ESTRATÉGIA REAL: mesma função (evaluateStrategyAt) e mesmos indicadores
          // reais (RSI/MACD/EMA/etc.) usados pelo Backtest — a IA ao vivo roda
          // exatamente a estratégia escolhida pelo usuário, não mais uma lógica
          // hardcoded própria. Antes disso existia RSI aproximado por
          // `50 + variação%×5` e uma cascata fixa reversão→tendência→momentum,
          // ignorando qualquer configuração de estratégia.
          const activeStrategy = strategiesRef.current.find(s => s.id === aiConfig.activeStrategyId);
          if (!activeStrategy) {
            console.log(`[ESTRATÉGIA] 🚫 Nenhuma estratégia ativa selecionada - pulando ciclo`);
            return;
          }

          // 🔒 2026-07-24: timeframe operacional deixa de ser fixo em 5m —
          // usa o que o próprio usuário escolheu na UI (aiConfig.timeframe,
          // já existia como campo selecionável mas era ignorado aqui). Isso
          // é o que torna o Score (chamado logo abaixo) e a estratégia
          // exclusivos do timeframe pedido, essencial pro modo Scalper (1m)
          // não operar em cima de candle de 5m.
          const opTimeframe = normalizeAiTimeframe(aiConfig.timeframe);
          const barMs: Record<ScoreTimeframe, number> = {
            '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
          };
          const bufferKey = `${selectedSymbol}_${opTimeframe}`;

          // Buffer de candles reais do ativo+timeframe (renovado a cada 60s)
          let bufferEntry = candleBufferRef.current.get(bufferKey);
          if (!bufferEntry || Date.now() - bufferEntry.fetchedAt > 60_000) {
            try {
              const end = new Date();
              const start = new Date(end.getTime() - 100 * barMs[opTimeframe]); // ~100 candles do TF operado
              const history = await backtestDataService.fetchHistoricalData(selectedSymbol, start, end, opTimeframe);
              bufferEntry = { candles: history.candles, fetchedAt: Date.now() };
              candleBufferRef.current.set(bufferKey, bufferEntry);
            } catch (error) {
              console.warn(`[ESTRATÉGIA] ⚠️ Sem candles reais pra ${selectedSymbol} (${opTimeframe}) agora, pulando ciclo`, error);
              return;
            }
          }

          const candles = bufferEntry.candles;
          if (candles.length < 30) {
            console.log(`[ESTRATÉGIA] ⏸️ Histórico insuficiente de ${selectedSymbol} (${candles.length} candles) - pulando ciclo`);
            return;
          }

          const strategySignal = evaluateStrategyAt(activeStrategy, candles, candles.length - 1);
          if (!strategySignal.signal) {
            console.log(`[ESTRATÉGIA] ⏸️ "${activeStrategy.name}" sem sinal em ${selectedSymbol} agora`);
            return;
          }

          const side: 'LONG' | 'SHORT' = strategySignal.signal === 'BUY' ? 'LONG' : 'SHORT';
          const strategyName = activeStrategy.name;
          let confidenceScore = strategySignal.confidence;
          const rsiSeries = calculateRSI(candles, 14);
          const rsiValue = rsiSeries[rsiSeries.length - 1] ?? 50; // RSI real do ativo, mesmo cálculo usado no evaluator

          // 🔒 marketMode continua influenciando o preset de TP/SL (ver seção de pontos abaixo);
          // a decisão de entrada em si agora vem 100% da estratégia escolhida.

          // VALIDAÇÃO FINAL DE CONFIANÇA
          if (confidenceScore < MIN_CONFIDENCE) {
            console.log(`[SEGURANÇA] ❌ Confiança caiu abaixo do mínimo após análise: ${confidenceScore}% < ${MIN_CONFIDENCE}%`);
            return;
          }

          // 🔒 GATE DO MARKET SCORE (2026-07-24) — o motor recalibrado do
          // Dashboard (MarketScoreEngine.ts, mesmo usado no card "Análise
          // Neural") passa a ser consultado aqui como CONFIRMAÇÃO/VETO do
          // sinal da estratégia, no MESMO timeframe operado (`opTimeframe`)
          // — nunca decide sozinho, nunca substitui o gatilho de entrada da
          // estratégia (`evaluateStrategyAt`, já validado via
          // MarketScoreValidator). Se o Score classificar o ativo pro lado
          // OPOSTO do que a estratégia sugeriu, o setup é descartado — é
          // exatamente o cenário que motivou este gate: a IA não deve
          // comprar quando o Score (mesmo motor que o usuário vê na tela)
          // está classificando o ativo como VENDEDOR, e vice-versa. Isso é
          // um passo intermediário — ainda não é o "cérebro definitivo" da
          // IA, só a conexão real entre os dois motores que hoje existiam
          // desconectados.
          //
          // ✅ 2026-07-24 (2ª rodada): LATERAL não veta (Score sem opinião
          // forte não é "contra" a estratégia) — mas achado real via
          // MarketScoreValidator: a faixa de score onde a maioria dos casos
          // LATERAL cai (35-50) tem retorno futuro historicamente fraco/
          // neutro pro BTC diário — ou seja, é uma zona de baixo edge
          // conhecida, não só "sem informação". Deixar a IA operar aí com o
          // MESMO limiar de confiança de sempre ignorava esse dado. Fix:
          // Score LATERAL exige uma barra de confiança EXTRA da estratégia
          // (nunca bloqueia por completo, só levanta a exigência) — a IA
          // continua podendo operar em regime lateral, mas só quando a
          // própria estratégia tem convicção forte o bastante pra compensar
          // a falta de confirmação do Score.
          const LATERAL_CONFIDENCE_PENALTY = 15;
          let scoreConfidence: number | null = null;
          try {
            const scoreResult = await MarketScoreEngine.compute(selectedSymbol, opTimeframe);
            if (scoreResult.provenance !== 'unavailable') {
              const expectedClassification = side === 'LONG' ? 'COMPRADOR' : 'VENDEDOR';
              const opposite = side === 'LONG' ? 'VENDEDOR' : 'COMPRADOR';
              if (scoreResult.classification === opposite) {
                console.log(`[SCORE] 🚫 Setup ${side} descartado: Market Score (${opTimeframe}) classifica ${selectedSymbol} como ${scoreResult.classification} (confiança ${scoreResult.confidence}%) — contradiz a estratégia`);
                return;
              }
              if (scoreResult.classification === 'LATERAL') {
                const requiredConfidence = MIN_CONFIDENCE + LATERAL_CONFIDENCE_PENALTY;
                if (strategySignal.confidence < requiredConfidence) {
                  console.log(`[SCORE] 🚫 Setup ${side} descartado: Market Score (${opTimeframe}) está LATERAL (zona de baixo edge conhecida) e a estratégia só tem ${strategySignal.confidence}% de confiança (exige ${requiredConfidence}% nesse regime)`);
                  return;
                }
                console.log(`[SCORE] 🟡 Market Score (${opTimeframe}) LATERAL — estratégia com confiança suficiente (${strategySignal.confidence}% ≥ ${requiredConfidence}%) pra operar mesmo sem confirmação`);
              }
              scoreConfidence = scoreResult.confidence;
              console.log(`[SCORE] ✅ Market Score (${opTimeframe}) confirma/não contradiz: ${scoreResult.classification} (confiança ${scoreResult.confidence}%)${scoreResult.classification === expectedClassification ? ' — concorda' : ' — neutro'}`);
            }
          } catch (error) {
            console.warn(`[SCORE] ⚠️ Falha ao consultar o Market Score pra ${selectedSymbol} (${opTimeframe}) — seguindo só com a confiança da estratégia`, error);
          }
          // Confiança final = a mais conservadora entre estratégia e Score (quando disponível).
          if (scoreConfidence !== null) {
            confidenceScore = Math.min(confidenceScore, scoreConfidence);
            if (confidenceScore < MIN_CONFIDENCE) {
              console.log(`[SEGURANÇA] ❌ Confiança combinada (estratégia+Score) abaixo do mínimo: ${confidenceScore}% < ${MIN_CONFIDENCE}%`);
              return;
            }
          }

          // 🔒 RESPEITAR CONFIG DO USUÁRIO: direção (aiConfig.direction = 'AUTO' | 'LONG' | 'SHORT')
          // Antes, o lado do trade vinha só da estratégia (RSI/momentum), ignorando
          // completamente essa config - se o usuário travasse "somente compra", o bot
          // podia vender do mesmo jeito. Em vez de forçar o lado (o que inventaria uma
          // entrada sem sinal real da estratégia), descartamos o setup quando ele não
          // bate com a direção permitida - mais seguro e ainda respeita 100% a config.
          if (aiConfig.direction !== 'AUTO' && side !== aiConfig.direction) {
            console.log(`[CONFIG] 🚫 Setup ${side} descartado: direção travada em "${aiConfig.direction}" pelo usuário`);
            return;
          }

          // 🔒 GATE DE RISCO (research/RISK_MODULE_SPEC.md) — checado de forma síncrona
          // logo antes de qualquer entrada, distinto do Health Check Guardian (que audita
          // o estado geral a cada 5s e só pausa tudo via Safe Mode). Aqui é um veto
          // pontual, por trade, sem desligar a IA.
          const now = Date.now();

          // === PHASE 1: Daily Loss Limit Check ===
          const riskConfig: RiskConfig = {
            maxDailyLossPercent: aiConfig.dailyLossLimit,
            maxDrawdownPercent: aiConfig.maxDrawdown,
            maxPositionSizePercent: aiConfig.riskPerTrade,
            kellyFraction: 0.25, // conservador por padrão
            cooldownEnabled: aiConfig.cooldownEnabled,
            cooldownMinutes: aiConfig.cooldownMinutes,
            maxTradesPerDay: aiConfig.maxTradesPerDay,
            killSwitchThreshold: aiConfig.killSwitchThreshold || 0,
          };

          // Calcular stats diários (trades fechados hoje, PnL realizado/não-realizado)
          const nowDate = new Date();
          const startOfUtcDay = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
          const tradesToday = orderHistoryRef.current.filter(t => t.closedAt && t.closedAt >= startOfUtcDay);
          const realizedPnL = tradesToday.reduce((sum, t) => sum + (t.currentProfit || 0), 0);
          const unrealizedPnL = activeOrdersRef.current.reduce((sum, o) => sum + (o.currentProfit || 0), 0);
          const largestLoss = Math.min(...tradesToday.map(t => t.currentProfit || 0));

          // Perdas consecutivas
          let consecutiveLosses = 0;
          for (const t of [...tradesToday].reverse()) {
            if ((t.currentProfit || 0) < 0) consecutiveLosses++;
            else break;
          }

          const dailyStats: DailyStats = {
            closedTradesCount: tradesToday.length,
            realizedPnL,
            unrealizedPnL,
            largestLoss,
            consecutiveLosses,
          };

          // Validar trade via RiskManager
          const riskManager = new RiskManager(riskConfig);
          const accountState = {
            balance: portfolioRef.current.balance,
            initialBalance: portfolioRef.current.initialBalance || 100,
            dailyStartBalance: portfolioRef.current.dayAnchorEquity || portfolioRef.current.initialBalance || 100,
            currentDrawdown: portfolioRef.current.currentDrawdown,
            openPositionsCount: activeOrdersRef.current.length,
          };

          // Propor tamanho de posição (% riskPerTrade do saldo atual)
          const proposedTradeSize = portfolioRef.current.balance * (aiConfig.riskPerTrade / 100);

          const riskCheck = riskManager.validateTrade(accountState, proposedTradeSize, dailyStats);

          // 🚨 TÓPICO 6: Kill-Switch (perda catastrófica)
          const killSwitchCheck = riskManager.shouldActivateKillSwitch(accountState);
          if (killSwitchCheck.triggered) {
            console.error(`[RISCO] 🚨 ${killSwitchCheck.reason}`);
            addLog(`🚨 KILL-SWITCH ATIVADO: ${killSwitchCheck.reason}`);

            // Fechar TODAS as posições abertas
            setActiveOrders([]);
            console.log('[KILL-SWITCH] 🔴 Fechadas todas as posições abertas');

            // Parar a IA imediatamente
            setIsActive(false);
            setIsSafeMode(true);
            setSafeModeReason(killSwitchCheck.reason || 'Kill-Switch ativado');
            console.log('[KILL-SWITCH] 🔴 IA PARADA — aguardando intervenção manual');

            // Notificar o usuário com urgência
            toastOriginal.error('🚨 KILL-SWITCH ATIVADO', {
              description: killSwitchCheck.reason || 'Perda catastrófica detectada. Todas as posições foram fechadas.',
              duration: 0 // persistente até o usuário descartar
            });

            return;
          }

          if (!riskCheck.approved) {
            console.log(`[RISCO] 🚫 ${riskCheck.reason}`);
            return;
          }

          // Cooldown pós-perdas consecutivas
          if (aiConfig.cooldownEnabled && now < cooldownUntilRef.current) {
            const remainingMin = Math.ceil((cooldownUntilRef.current - now) / 60_000);
            console.log(`[RISCO] 🧊 Cooldown ativo — ${remainingMin}min restantes (${aiConfig.consecutiveLossesTrigger} perdas seguidas)`);
            return;
          }
          if (aiConfig.cooldownEnabled) {
            const closedTrades = [...orderHistoryRef.current].filter(t => t.closedAt).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
            let consecutiveLosses = 0;
            for (const t of closedTrades) {
              if ((t.currentProfit || 0) < 0) consecutiveLosses++;
              else break;
            }
            if (consecutiveLosses >= aiConfig.consecutiveLossesTrigger) {
              cooldownUntilRef.current = now + aiConfig.cooldownMinutes * 60_000;
              console.log(`[RISCO] 🧊 Cooldown ATIVADO: ${consecutiveLosses} perdas seguidas — bloqueando novas entradas por ${aiConfig.cooldownMinutes}min`);
              addLog(`🧊 Pausa ativada: ${consecutiveLosses} perdas seguidas — pausa de ${aiConfig.cooldownMinutes}min`);
              return;
            }
          }

          // Limite rígido de trades/dia
          if (aiConfig.maxTradesPerDay > 0) {
            const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
            const tradesToday = orderHistoryRef.current.filter(t => (t.closedAt || t.timestamp) >= todayStart.getTime()).length + activeOrdersRef.current.length;
            if (tradesToday >= aiConfig.maxTradesPerDay) {
              console.log(`[RISCO] 🚫 Limite de trades/dia atingido: ${tradesToday}/${aiConfig.maxTradesPerDay}`);
              return;
            }
          }

          console.log(`[DECISÃO FINAL] ${side === 'LONG' ? '🟢 COMPRA' : '🔴 VENDA'} | Estratégia: ${strategyName} | Confiança: ${confidenceScore}%`);
          
          // ✅ DETERMINAR DIREÇÃO BASEADA EM ESTRATÉGIA INTELIGENTE (não mais simplesmente priceChangePercent > 0)
          
          // 🆕 SISTEMA DE PONTOS BASEADO EM targetPoints (NOVO!)
          // ✅ AJUSTADO: Valores MAIORES para manter posições por mais tempo
          // POUCOS: 150 pontos | MÉDIO: 400 pontos | MUITOS: 1500+ pontos
          let targetPointsValue = 400; // Padrão: MÉDIO (aumentado de 200 para 400)
          let stopLossPointsValue = 120; // SL padrão (aumentado de 50 para 120)
          
          if (aiConfig.targetPoints === 'POUCOS') {
            targetPointsValue = 150;  // ✅ Aumentado de 50 para 150
            stopLossPointsValue = 50; // ✅ Aumentado de 25 para 50
          } else if (aiConfig.targetPoints === 'MÉDIO') {
            targetPointsValue = 400;  // ✅ Aumentado de 200 para 400
            stopLossPointsValue = 120; // ✅ Aumentado de 50 para 120
          } else if (aiConfig.targetPoints === 'MUITOS') {
            targetPointsValue = 1500; // ✅ Aumentado de 1000 para 1500
            stopLossPointsValue = 300; // ✅ Aumentado de 100 para 300
          } else if (aiConfig.targetPoints === 'CURTO') {
            targetPointsValue = 80;   // ✅ Aumentado de 30 para 80
            stopLossPointsValue = 35; // ✅ Aumentado de 15 para 35
          } else if (aiConfig.targetPoints === 'LONGO') {
            targetPointsValue = 800;  // ✅ Aumentado de 500 para 800
            stopLossPointsValue = 200; // ✅ Aumentado de 80 para 200
          }

          // 🔒 RESPEITAR CONFIG DO USUÁRIO: marketMode === 'SCALP' implica trades curtos
          // por definição - trava o alvo/stop no teto do preset "CURTO" (80/35 pontos),
          // não importa o que o usuário tenha configurado em targetPoints. Só aperta
          // (Math.min), nunca alarga - respeita um targetPoints já mais curto que isso.
          if (aiConfig.marketMode === 'SCALP') {
            targetPointsValue = Math.min(targetPointsValue, 80);
            stopLossPointsValue = Math.min(stopLossPointsValue, 35);
          }

          // 🎯 CONVERTER PONTOS EM PREÇO (Baseado no ativo)
          // Para índices e ações: 1 ponto = $1
          // Para Forex: 1 ponto = 0.0001 (pip)
          // Para Crypto: 1 ponto = $1
          // Para Ouro: 1 ponto = $0.10
          
          let pointValue = 1.0; // Padrão: 1 ponto = $1

          // 🔒 2026-07-24: BUG REAL EM PRODUÇÃO — todo par cripto cotado em
          // dólar (BTCUSDT, BTCUSD, ETHUSD...) também contém a substring
          // "USD", batendo por engano na regra de forex abaixo (pointValue
          // 0.0001) antes desta checagem existir. Isso fazia um alvo de "400
          // pontos" em BTC virar 400*0.0001 = US$0,04 de distância — o TP
          // fechava o trade quase no candle de entrada. Checar cripto ANTES
          // do bloco forex resolve pra qualquer símbolo com base conhecida ou
          // sufixo USDT (mesmo fix aplicado em TradeSizing.getPointValue).
          const pointValueCryptoBases = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOT', 'LTC', 'DOGE', 'AVAX', 'MATIC', 'POL', 'BAT', 'LINK', 'UNI', 'XLM'];
          const upperSymbolForPointValue = selectedSymbol.toUpperCase();
          const isCryptoForPointValue = upperSymbolForPointValue.endsWith('USDT') || pointValueCryptoBases.some(base => upperSymbolForPointValue.startsWith(base));

          if (isCryptoForPointValue) {
            pointValue = 1.0; // preço já em dólares cheios
          } else if (selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ||
              selectedSymbol.includes('USD') || selectedSymbol.includes('JPY') ||
              selectedSymbol.includes('AUD') || selectedSymbol.includes('CAD') ||
              selectedSymbol.includes('CHF') || selectedSymbol.includes('NZD')) {
            pointValue = 0.0001; // 1 pip (FOREX)
          } else if (selectedSymbol.includes('XAU') || selectedSymbol.includes('GOLD')) {
            pointValue = 0.1; // OURO: 1 ponto = $0.10
          }
          // ÍNDICES: 1 ponto = $1 (já é o padrão)
          
          // Calcular TP e SL baseado em PONTOS
          const tpDistance = targetPointsValue * pointValue;
          const slDistance = stopLossPointsValue * pointValue;
          
          const tp = side === 'LONG' 
            ? currentPrice + tpDistance
            : currentPrice - tpDistance;
          
          const sl = side === 'LONG'
            ? currentPrice - slDistance
            : currentPrice + slDistance;
          
          // 🆕 CALCULAR RISCO/RETORNO
          const riskRewardRatio = targetPointsValue / stopLossPointsValue;
          
          console.log(`[TP/SL SETUP] 🎯 ${selectedSymbol}:`, {
            targetPoints: aiConfig.targetPoints,
            points: targetPointsValue,
            pointValue: pointValue,
            tpDistance: `$${tpDistance.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2)}`,
            slDistance: `$${slDistance.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2)}`,
            riskReward: `1:${riskRewardRatio.toFixed(1)}`,
            entry: currentPrice.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2),
            tp: tp.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2),
            sl: sl.toFixed(selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') ? 5 : 2)
          });
          
          // 💰 CALCULAR TAMANHO DA POSIÇÃO (Position Sizing)
          // Baseado no capital alocado e risco por trade
          const currentBalance = portfolioRef.current?.balance || 100;
          const allocatedCapital = Math.min(aiConfig.allocatedCapital, currentBalance);
          const riskPercentage = aiConfig.riskPerTrade / 100; // Ex: 2% = 0.02
          
          // Capital para este trade (% do capital alocado)
          // 🔒 Ajustado pelo riskProfile do usuário (mesmo sizeMultiplier usado na confiança acima)
          let tradeCapital = allocatedCapital * riskPercentage * riskAdjustment.sizeMultiplier;

          // 🆕 Position sizing por ATR (research/RISK_MODULE_SPEC.md, seção 3.2): em vez do
          // % linear fixo, ajusta o capital arriscado pela volatilidade real do ativo —
          // ativo mais volátil arrisca menos capital nominal pro mesmo % de risco.
          if (aiConfig.positionSizingMode === 'ATR') {
            const atrSeries = calculateATR(candles, 14);
            const atrValue = atrSeries[atrSeries.length - 1];
            if (atrValue && atrValue > 0) {
              const atrDistance = atrValue * aiConfig.atrMultiplier;
              const riskCapital = allocatedCapital * riskPercentage * riskAdjustment.sizeMultiplier;
              // Normaliza contra o SL fixo já calculado (slDistance em preço), mantendo o
              // mesmo capital de risco nominal mas escalando pelo tamanho real do stop em ATR
              tradeCapital = slDistance > 0 ? riskCapital * (slDistance / atrDistance) : riskCapital;
              console.log(`[POSITION SIZING] 📐 ATR mode: ATR=${atrValue.toFixed(5)} x${aiConfig.atrMultiplier} = ${atrDistance.toFixed(5)} | capital ajustado: $${tradeCapital.toFixed(2)}`);
            }
          }

          // 🆕 Alerta de correlação (research/RISK_MODULE_SPEC.md, seção 3.5): heurística por
          // grupo estático (não é correlação de retornos calculada ao vivo — ver TODO na spec)
          // reduz o tamanho pela metade se já existe posição aberta num ativo do mesmo grupo.
          if (aiConfig.correlationGuardEnabled) {
            const group = getCorrelationGroup(selectedSymbol);
            const hasCorrelatedOpen = group && activeOrdersRef.current.some(o => o.symbol !== selectedSymbol && getCorrelationGroup(o.symbol) === group);
            if (hasCorrelatedOpen) {
              tradeCapital *= (1 - aiConfig.correlationThreshold * 0.5);
              console.log(`[RISCO] 🔗 Correlação detectada (grupo "${group}") — tamanho reduzido para $${tradeCapital.toFixed(2)}`);
            }
          }

          // Garantir valor mínimo para evitar P&L zerado
          const minTradeCapital = 10; // Mínimo $10 por trade
          const finalTradeCapital = Math.max(tradeCapital, minTradeCapital);

          console.log(`[POSITION SIZING] 💰 ${selectedSymbol}:`, {
            currentBalance: `$${currentBalance.toFixed(2)}`,
            allocatedCapital: `$${allocatedCapital.toFixed(2)}`,
            riskPerTrade: `${aiConfig.riskPerTrade}%`,
            riskProfile: `${aiConfig.riskProfile} (x${riskAdjustment.sizeMultiplier})`,
            calculatedTradeCapital: `$${tradeCapital.toFixed(2)}`,
            finalTradeCapital: `$${finalTradeCapital.toFixed(2)}`,
            reason: tradeCapital < minTradeCapital ? `⬆️ Aumentado para mínimo de $${minTradeCapital}` : '✅ Valor adequado'
          });
          
          // ✅ CRIAR TRADE PROFISSIONAL
          const newTrade: TradeVisual = {
            id: `trade-${Date.now()}-${Math.random()}`,
            symbol: selectedSymbol,
            side,
            amount: finalTradeCapital, // ✅ CORREÇÃO: Usar capital calculado, não maxContracts!
            price: currentPrice,
            currentPrice: currentPrice,
            tp,
            sl,
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
          // Não altera nenhum comportamento abaixo (DEMO/LIVE seguem exatamente iguais).
          try {
            onLiveDecisionRef.current?.(newTrade);
          } catch (observerError) {
            console.error('[FASE 6] Erro no observador onLiveDecision (não afeta o motor):', observerError);
          }

          // Atualizar último timestamp de trade
          lastTradeTimestampRef.current = Date.now();
          
          // ✅ ATUALIZAR ÚLTIMO ATIVO NEGOCIADO (Anti-repetição)
          lastTradedSymbolRef.current = selectedSymbol;
          console.log(`[ANTI-REPETIÇÃO] 📌 Último ativo registrado: ${selectedSymbol}`);
          
          setActiveOrders(prev => [...prev, newTrade]);
          addLog(`✅ ENTRADA ${side}: ${selectedSymbol} @ $${currentPrice.toFixed(2)} - Alvo: ${targetPointsValue}pts (Confiança: ${confidenceScore}%)`);

          // Fase 2: persiste a abertura da posição (fire-and-forget, nunca bloqueia o loop)
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
            });
          }
          
          // 🔔 Toast de notificação para o usuário
          toastOriginal.success(`${side === 'LONG' ? '🟢' : '🔴'} ENTRADA ${side}`, {
            description: `${selectedSymbol} @ $${currentPrice.toFixed(2)} | Confiança: ${confidenceScore}% | ${strategyName}`,
            duration: 4000
          });
          
        } catch (error) {
          console.error('[TRADING] ❌ Erro crítico na análise:', error);
        }
      })();
    }, 5000); // 🚀 OTIMIZAÇÃO #3: REDUZIDO de 15s para 5s (200% mais rápido!) ⚡

    return () => {
      clearInterval(tradingInterval);
    };
  }, [isActive, isPaused, isSafeMode, activeOrders.length, aiConfig.maxPositions, aiConfig.maxContracts, aiConfig.maxAssets, addLog]);

  // === UNREALIZED PNL LOOP (Price Updates & P&L Calculation) ===
  useEffect(() => {
    const pnlInterval = setInterval(() => {
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
            if (data) priceMap.set(symbol, data.price);
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
                // Se o fetch falhou pra esse símbolo, mantém o preço anterior (não simula movimento)
                const nextPrice = priceMap.get(order.symbol) ?? currentPrice;

                // 🔒 RESPEITAR CONFIG DO USUÁRIO: stopLossMode ('DINAMICO' | 'FIXO').
                // Antes, o SL era calculado uma vez na entrada e nunca se mexia -
                // "DINAMICO" e "FIXO" tinham exatamente o mesmo comportamento.
                // Agora, em modo DINAMICO, o SL "anda" a favor do trade (trailing stop):
                // preserva a mesma distância de risco original, mas só sobe (LONG) ou
                // só desce (SHORT) - nunca piora o stop em relação ao que já estava setado.
                let effectiveSl = order.sl;
                if (configRef.current.stopLossMode === 'DINAMICO') {
                  const originalSlDistance = Math.abs(order.price - order.sl);
                  const trailedSl = order.side === 'LONG'
                    ? nextPrice - originalSlDistance
                    : nextPrice + originalSlDistance;

                  effectiveSl = order.side === 'LONG'
                    ? Math.max(order.sl, trailedSl)
                    : Math.min(order.sl, trailedSl);
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

                // Check TP/SL
                const hitTP = order.side === 'LONG' ? nextPrice >= order.tp : nextPrice <= order.tp;
                const hitSL = order.side === 'LONG' ? nextPrice <= effectiveSl : nextPrice >= effectiveSl;

                if (hitTP) {
                    realizedPnL += pnl;
                    logsToAdd.push(`🎯 ALVO ATINGIDO: ${order.symbol} +$${pnl.toFixed(2)}`);
                    // Close position
                    setOrderHistory(prev => [...prev, { ...order, sl: effectiveSl, currentPrice: nextPrice, currentProfit: pnl, closedAt: Date.now() }]);
                    closedForPersistenceRef.current.push({ id: order.id, exitPrice: nextPrice, pnl, reason: 'TP' });
                } else if (hitSL) {
                    realizedPnL += pnl;
                    logsToAdd.push(`🛡️ STOP ATINGIDO: ${order.symbol} ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
                    // Close position
                    setOrderHistory(prev => [...prev, { ...order, sl: effectiveSl, currentPrice: nextPrice, currentProfit: pnl, closedAt: Date.now() }]);
                    closedForPersistenceRef.current.push({ id: order.id, exitPrice: nextPrice, pnl, reason: 'SL' });
                } else {
                    // Keep position open WITH UPDATED PROFIT (e SL "andado" se DINAMICO)
                    nextActiveOrders.push({
                        ...order,
                        sl: effectiveSl,
                        currentPrice: nextPrice,
                        currentProfit: pnl, // ✅ CRITICAL: Update profit for UI display
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
              dayAnchorUtcDay: utcDay,
              openPositionsValue: totalExposure,
           };
        });

        // Fase 2: persiste fechamentos por TP/SL deste tick (fire-and-forget)
        if (configRef.current.executionMode === 'DEMO' && closedForPersistenceRef.current.length > 0) {
          closedForPersistenceRef.current.forEach(closed => {
            persistenceRef.current.onTradeClose(closed.id, closed.exitPrice, closed.pnl, 0, closed.reason);
          });
          closedForPersistenceRef.current = [];
        }

        // Fase 2: snapshot periódico do portfólio (throttle de 60s)
        if (configRef.current.executionMode === 'DEMO') {
          const now = Date.now();
          if (now - lastSnapshotAtRef.current > 60000) {
            lastSnapshotAtRef.current = now;
            const p = portfolioRef.current;
            persistenceRef.current.savePortfolioSnapshot({
              balance: p.balance,
              equity: p.equity,
              openPositionsValue: p.openPositionsValue,
              currentDrawdown: p.currentDrawdown,
            });
          }
        }

        // Curva de equity real (Dashboard, "Curva de Equity"): amostra o
        // equity real do portfolio a cada 10s — nunca dado mockado/aleatório.
        // Independente do executionMode (funciona em DEMO e LIVE).
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
        })();
    }, 1000); // Update every 1 second

    return () => clearInterval(pnlInterval);
  }, []);

  // === START/STOP/PAUSE ===
  const startLogic = useCallback(() => {
    console.log('[START LOGIC] 🚀 Tentando iniciar AI...');
    console.log('[START LOGIC] Safe Mode:', isSafeModeRef.current);
    
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
      persistenceRef.current.startSession({
        strategyName: 'Apex AI',
        symbols: configRef.current.activeAssets || [],
        timeframe: configRef.current.timeframe || '1m',
        initialBalance: portfolioRef.current.balance,
        initialEquity: portfolioRef.current.equity,
        config: configRef.current,
      });
    }
  }, [addLog]);

  const stopLogic = useCallback(() => {
    // 🚨 PROTEÇÃO CRÍTICA: Fechar TODAS as posições abertas antes de desligar
    if (activeOrders.length > 0) {
      console.warn('[STOP LOGIC] ⚠️ DESLIGANDO COM POSIÇÕES ABERTAS - FECHANDO TUDO!');
      
      const closingOrders = activeOrders;
      let totalRealizedPnL = 0;

      closingOrders.forEach(order => {
        const currentPrice = order.currentPrice || order.price;
        const tradePnL = calculatePnLWithLeverage(
          order.symbol,
          order.price,
          currentPrice,
          order.side,
          order.amount,
          order.leverage
        );
        totalRealizedPnL += tradePnL;

        console.log(`[FORCE CLOSE] 🚨 Fechando ${order.symbol} ${order.side}: P&L = $${tradePnL.toFixed(2)}`);

        if (configRef.current.executionMode === 'DEMO') {
          persistenceRef.current.onTradeClose(order.id, currentPrice, tradePnL, 0, 'MANUAL');
        }
      });

      setPortfolio(prev => ({
        ...prev,
        balance: prev.balance + totalRealizedPnL,
        equity: prev.balance + totalRealizedPnL,
        openPositionsValue: 0,
      }));

      setOrderHistory(prev => [...prev, ...closingOrders.map(o => ({ 
        ...o, 
        currentPrice: o.currentPrice || o.price,
        currentProfit: calculatePnLWithLeverage(
          o.symbol,
          o.price,
          o.currentPrice || o.price,
          o.side,
          o.amount,
          o.leverage
        ),
        closedAt: Date.now() 
      }))]);
      
      setActiveOrders([]);
      
      addLog(`🚨 Sistema APEX Parado - ${closingOrders.length} posições fechadas automaticamente. P&L Total: $${totalRealizedPnL.toFixed(2)}`);
      // ❌ REMOVIDO TOAST AMARELO - toast.warning(`${closingOrders.length} posições fechadas ao desligar AI!`);
    } else {
      addLog('🛑 Sistema APEX Parado');
    }
    
    setIsActive(false);
    setIsPaused(false);
  }, [activeOrders, addLog]);

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
    // Fase 2: encerra a sessão DEMO no Supabase (próximo start cria uma nova, zerada)
    if (persistenceRef.current.currentSessionId) {
      persistenceRef.current.endSession(INITIAL_STATE.portfolio.balance, INITIAL_STATE.portfolio.equity);
    }

    setIsActive(false);
    setIsPaused(false);
    setActiveOrders([]);
    setOrderHistory([]); // ✅ Limpa histórico de trades
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

    closingOrders.forEach(order => {
      const currentPrice = order.currentPrice || order.price;
      const tradePnL = calculatePnLWithLeverage(
        order.symbol,
        order.price,
        currentPrice,
        order.side,
        order.amount,
        order.leverage
      );
      totalRealizedPnL += tradePnL;

      if (configRef.current.executionMode === 'DEMO') {
        persistenceRef.current.onTradeClose(order.id, currentPrice, tradePnL, 0, 'MANUAL');
      }
    });

    setPortfolio(prev => ({
      ...prev,
      balance: prev.balance + totalRealizedPnL,
      equity: prev.balance + totalRealizedPnL,
      openPositionsValue: 0,
    }));

    setOrderHistory(prev => [...prev, ...closingOrders.map(o => ({ ...o, closedAt: Date.now() }))]);
    setActiveOrders([]);
    addLog(`🚨 Todas as posições foram fechadas. P&L Total: $${totalRealizedPnL.toFixed(2)}`);
  }, [activeOrders, addLog]);

  // === UPDATE AI CONFIG ===
  const updateAIConfig = useCallback((config: Partial<AIConfig>) => {
    setAIConfig(prev => ({ ...prev, ...config }));
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

    // Actions
    startLogic,
    stopLogic,
    pauseLogic,
    resumeLogic,
    resetLogic,
    forceCloseAll,
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