import { useState, useEffect, useRef, useCallback } from 'react';

import { toast as toastOriginal } from 'sonner';
import { ApexLogicCore } from '../../lib/modules/ApexLogicCore';
import { getSpread, applySpread } from '@/config/spreads'; // 🎯 Funções de Spread (sem hook)
import { calculateRealisticPnL, calculatePnLWithLeverage, getContractSpec, getContractInfo } from '@/config/contractSpecs'; // 💰 Especificações de Contrato
import { analyzeMarketStructure, makeSmartTradingDecision } from '@/app/services/KeyLevelsEngine'; // 🎯 KEY LEVELS ENGINE

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
import { ApexScoreEngine } from '../services/ApexScoreEngine'; // Added Import
import { getLiquiditySignal } from '../logic/liquiditySignals'; // Shared Liquidity Logic
import { logMT5AccountInfo, extractBalance } from '../utils/mt5Debug'; // MT5 Debug
import { wrapMT5Connection } from '../utils/mt5ConnectionWrapper'; // MT5 Wrapper

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
  riskProfile: RiskProfileType; // NEW: Risk Guardian Integration
  
  // 🆕 PROPRIEDADES FALTANTES (usadas pelo AITrader.tsx)
  activeAssets: string[]; // ✅ Lista de ativos selecionados (Infinox válidos)
  maxAssets: number; // 🆕 AUMENTADO DE 3 PARA 6 - Máximo de ativos simultâneos diferentes
  timeframe: string; // Timeframe operacional (1m, 5m, 15m, 1H, 4H)
  newsFilter: boolean; // Filtro de notícias econômicas
  dailyLossLimit: number; // Limite de perda diária (%)
  metaApiToken?: string; // 🔑 Token do MetaApi para integração MT5
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
};

export function useApexLogic(initialMarketContext?: MarketContext) {
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

  // === VIX CACHE CONFIG ===
  // 🔥 CORREÇÃO CRÍTICA: useRef DEPOIS de useState (Rules of Hooks)
  const cachedVIXRef = useRef(0);
  const lastVIXFetchRef = useRef(0);
  const VIX_CACHE_DURATION = 60000; // 60 segundos de cache

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
  const pnlLoopRef = useRef({ realizedPnL: 0, totalUnrealizedPnL: 0, totalExposure: 0 });
  const pnlLogsRef = useRef<string[]>([]);

  // === APEX LOGIC CORE ===
  const apexLogicCoreRef = useRef(new ApexLogicCore());

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
        assetExposureRef.current = parsed.assetExposure || {};
        lastAssetClassRef.current = parsed.lastAssetClass || null;
        cycleIntervalRef.current = parsed.cycleInterval || 60000;
      }
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
  }, []);

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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    isActive, isPaused, activeOrders, portfolio, recentLogs, orderHistory,
    houseStats, performanceMetrics, healthStatus, aiConfig, mt5Credentials,
    executionMode, isConnectedToMT5, mt5AccountId, isSafeMode, safeModeReason,
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
      totalProfit,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0,
      sharpeRatio: 0, // Simplified
      maxDrawdown: portfolio.currentDrawdown,
      avgHoldTime: avgHoldTime / 1000 / 60, // minutes
      bestTrade,
      worstTrade,
    });
  }, [orderHistory, portfolio.currentDrawdown]);

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

    const tradingInterval = setInterval(() => {
      console.log(`[AI LOOP] 🔄 Verificando oportunidades... (Posições: ${activeOrders.length}/${aiConfig.maxPositions})`);
      
      // Check if we can trade
      if (activeOrders.length >= aiConfig.maxPositions) {
        console.log(`[AI LOOP] ⏸️ Máximo de posições atingido (${aiConfig.maxPositions})`);
        return; // Max positions reached
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

      // Weighted random selection
      const rand = Math.random();
      let selectedAssets: string[];
      let tierName = '';
      
      if (rand < 0.70) {
        selectedAssets = tier1Assets; // 70% chance - BTC & S&P
        tierName = 'TIER 1 (Alta Volatilidade)';
      } else if (rand < 0.95) {
        selectedAssets = tier2Assets; // 25% chance - ETH, NAS, Gold
        tierName = 'TIER 2 (Média Volatilidade)';
      } else {
        selectedAssets = tier3Assets; // 5% chance - Forex & Dow
        tierName = 'TIER 3 (Baixa Volatilidade)';
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
          if (!priceData) {
            const { fetchRealPrice } = await import('@/app/utils/realPriceProvider');
            priceData = await fetchRealPrice(selectedSymbol);
            console.log(`[REST API] 📡 ${selectedSymbol}: Preço obtido via REST (latência ~500ms)`);
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
          
          // ✅ SCORE DE CONFIANÇA BASEADO EM DADOS REAIS
          let confidenceScore = 50;
          
          // Adicionar confiança baseado em volatilidade
          const absChange = Math.abs(priceChangePercent);
          if (absChange > 3) confidenceScore += 30; // 🆕 AUMENTADO: Alta volatilidade = MUITO mais confiança
          else if (absChange > 1.5) confidenceScore += 20; // 🆕 AUMENTADO
          else if (absChange > 0.8) confidenceScore += 10; // 🆕 NOVO TIER
          else if (absChange < 0.5) confidenceScore -= 10; // 🆕 REDUZIDO PENALIDADE (era -15)
          
          // Adicionar confiança baseado em volume
          if (volume24h > 100000) confidenceScore += 15;
          else if (volume24h > 50000) confidenceScore += 10; // 🆕 NOVO TIER
          else if (volume24h < 10000) confidenceScore -= 10;
          
          // 🆕 BOOST: Se VIX > 20, adicionar confiança extra
          if (globalVolatility) {
            confidenceScore += 10;
            console.log(`[BOOST] 🔥 +10% confiança (VIX Alto!)`);
          }
          
          // ✅ FILTRO DE QUALIDADE: Apenas trades com confiança razoável
          const MIN_CONFIDENCE = 45; // 🚀 REDUZIDO DE 60% PARA 45% - Muito mais oportunidades!
          
          if (confidenceScore < MIN_CONFIDENCE) {
            console.log(`[QUALIDADE] ❌ Setup rejeitado: ${selectedSymbol} - Score ${confidenceScore}% (mínimo ${MIN_CONFIDENCE}%)`);
            
            // 🔔 Notificar usuário sobre setup rejeitado (apenas 1 a cada 3 para não poluir)
            if (Math.random() < 0.33) {
              toastOriginal.info('⏭️ Setup Rejeitado', {
                description: `${selectedSymbol} - Confiança muito baixa (${confidenceScore}%)`,
                duration: 2000
              });
            }
            return;
          }
          
          console.log(`[QUALIDADE] ✅ Setup aprovado: ${selectedSymbol} - Score ${confidenceScore}% (volatilidade: ${absChange.toFixed(2)}%)`);
          
          // 🆕 ESTRATÉGIA PROFISSIONAL - MÚLTIPLAS CONFIRMAÇÕES
          // Em vez de seguir cegamente o momentum, vamos usar uma estratégia inteligente
          
          // 1. DETECÇÃO DE TENDÊNCIA COM RSI SIMULADO
          const rsiValue = 50 + (priceChangePercent * 5); // RSI aproximado baseado em variação
          const isOverbought = rsiValue > 70; // Zona de sobrecompra
          const isOversold = rsiValue < 30; // Zona de sobrevenda
          
          // 2. MOMENTUM E FORÇA DA TENDÊNCIA
          const strongUptrend = priceChangePercent > 2 && !isOverbought; // Forte alta sem sobrecompra
          const strongDowntrend = priceChangePercent < -2 && !isOversold; // Forte baixa sem sobrevenda
          
          // 3. REVERSÃO MEAN REVERSION (contra-tendência em extremos)
          const bullishReversal = isOversold && priceChangePercent > -1; // RSI baixo + começa a subir
          const bearishReversal = isOverbought && priceChangePercent < 1; // RSI alto + começa a cair
          
          // 4. DECISÃO INTELIGENTE
          let side: 'LONG' | 'SHORT';
          let strategyName: string;
          
          // ✅ PRIORIDADE 1: REVERSÃO EM EXTREMOS (Alta probabilidade)
          if (bullishReversal) {
            side = 'LONG';
            strategyName = 'REVERSÃO DE SOBREVENDA';
            confidenceScore += 15; // Boost de confiança
            console.log(`[ESTRATÉGIA] 🎯 REVERSÃO BULLISH detectada! RSI: ${rsiValue.toFixed(0)} (Oversold)`);
          } else if (bearishReversal) {
            side = 'SHORT';
            strategyName = 'REVERSÃO DE SOBRECOMPRA';
            confidenceScore += 15;
            console.log(`[ESTRATÉGIA] 🎯 REVERSÃO BEARISH detectada! RSI: ${rsiValue.toFixed(0)} (Overbought)`);
          }
          // ✅ PRIORIDADE 2: TENDÊNCIA FORTE COM CONFIRMAÇÃO
          else if (strongUptrend) {
            side = 'LONG';
            strategyName = 'TREND FOLLOWING ALTA';
            confidenceScore += 10;
            console.log(`[ESTRATÉGIA] 📈 TENDÊNCIA DE ALTA forte! Variação: +${priceChangePercent.toFixed(2)}%`);
          } else if (strongDowntrend) {
            side = 'SHORT';
            strategyName = 'TREND FOLLOWING BAIXA';
            confidenceScore += 10;
            console.log(`[ESTRATÉGIA] 📉 TENDÊNCIA DE BAIXA forte! Variaão: ${priceChangePercent.toFixed(2)}%`);
          }
          // ⚠️ PRIORIDADE 3: MOMENTUM SIMPLES (apenas se não temos melhor setup)
          else {
            // Se não há setup claro, seguir direção do movimento mas com cautela
            if (Math.abs(priceChangePercent) < 0.15) {
              // Mercado muito lateral - SKIP (reduzido de 0.5% para 0.15%)
              console.log(`[ESTRATÉGIA] ⏸️ Mercado muito lateral (${priceChangePercent.toFixed(2)}%) - AGUARDANDO SETUP MELHOR`);
              return;
            }
            side = priceChangePercent > 0 ? 'LONG' : 'SHORT';
            strategyName = 'MOMENTUM CONSERVADOR';
            confidenceScore -= 10; // Penalidade por setup menos confiável
            console.log(`[ESTRATÉGIA] ⚠️ Usando momentum conservador (setup secundário)`);
          }
          
          // VALIDAÇÃO FINAL DE CONFIANÇA
          if (confidenceScore < MIN_CONFIDENCE) {
            console.log(`[SEGURANÇA] ❌ Confiança caiu abaixo do mínimo após análise: ${confidenceScore}% < ${MIN_CONFIDENCE}%`);
            return;
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
          
          // 🎯 CONVERTER PONTOS EM PREÇO (Baseado no ativo)
          // Para índices e ações: 1 ponto = $1
          // Para Forex: 1 ponto = 0.0001 (pip)
          // Para Crypto: 1 ponto = $1
          // Para Ouro: 1 ponto = $0.10
          
          let pointValue = 1.0; // Padrão: 1 ponto = $1
          
          // FOREX: 1 ponto = 1 pip = 0.0001
          if (selectedSymbol.includes('EUR') || selectedSymbol.includes('GBP') || 
              selectedSymbol.includes('USD') || selectedSymbol.includes('JPY') ||
              selectedSymbol.includes('AUD') || selectedSymbol.includes('CAD') ||
              selectedSymbol.includes('CHF') || selectedSymbol.includes('NZD')) {
            pointValue = 0.0001; // 1 pip
          }
          
          // OURO (XAU): 1 ponto = $0.10
          if (selectedSymbol.includes('XAU') || selectedSymbol.includes('GOLD')) {
            pointValue = 0.1;
          }
          
          // ÍNDICES E CRYPTO: 1 ponto = $1 (já é o padrão)
          
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
          const tradeCapital = allocatedCapital * riskPercentage;
          
          // Garantir valor mínimo para evitar P&L zerado
          const minTradeCapital = 10; // Mínimo $10 por trade
          const finalTradeCapital = Math.max(tradeCapital, minTradeCapital);
          
          console.log(`[POSITION SIZING] 💰 ${selectedSymbol}:`, {
            currentBalance: `$${currentBalance.toFixed(2)}`,
            allocatedCapital: `$${allocatedCapital.toFixed(2)}`,
            riskPerTrade: `${aiConfig.riskPerTrade}%`,
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

          // Atualizar último timestamp de trade
          lastTradeTimestampRef.current = Date.now();
          
          // ✅ ATUALIZAR ÚLTIMO ATIVO NEGOCIADO (Anti-repetição)
          lastTradedSymbolRef.current = selectedSymbol;
          console.log(`[ANTI-REPETIÇÃO] 📌 Último ativo registrado: ${selectedSymbol}`);
          
          setActiveOrders(prev => [...prev, newTrade]);
          addLog(`✅ ENTRADA ${side}: ${selectedSymbol} @ $${currentPrice.toFixed(2)} - Alvo: ${targetPointsValue}pts (Confiança: ${confidenceScore}%)`);
          
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
        if (activeOrders.length === 0) return;

        // Reset refs
        pnlLoopRef.current = { realizedPnL: 0, totalUnrealizedPnL: 0, totalExposure: 0 };
        pnlLogsRef.current = [];

        // Update prices and calculate P&L
        setActiveOrders(prevOrders => {
            const nextActiveOrders: TradeVisual[] = [];
            const logsToAdd: string[] = [];
            let realizedPnL = 0;
            let totalUnrealizedPnL = 0;
            let totalExposure = 0;

            prevOrders.forEach(order => {
                // 🆕 CORREÇÃO CRÍTICA: Movimento de preço MUITO MAIS REALISTA
                // Em vez de ±0.5% por segundo (muito volátil), usar movimentos micro
                
                // Determinar volatilidade baseada no ativo
                let baseVolatility = 0.0001; // 0.01% por segundo (padrão)
                
                if (order.symbol.includes('BTC') || order.symbol.includes('ETH')) {
                  baseVolatility = 0.0002; // Crypto: 0.02% por segundo
                } else if (order.symbol.includes('US500') || order.symbol.includes('NAS100')) {
                  baseVolatility = 0.00015; // Índices: 0.015% por segundo
                } else if (order.symbol.includes('EUR') || order.symbol.includes('GBP')) {
                  baseVolatility = 0.00005; // Forex: 0.005% por segundo (muito menor!)
                } else if (order.symbol.includes('XAU') || order.symbol.includes('GOLD')) {
                  baseVolatility = 0.0001; // Ouro: 0.01% por segundo
                }
                
                // Movimento aleatório: -volatilidade a +volatilidade
                const priceChange = (Math.random() - 0.5) * 2 * baseVolatility;
                
                const currentPrice = order.currentPrice || order.price;
                const nextPrice = currentPrice * (1 + priceChange);
                
                // ✅ LOG DE DEBUG (apenas para primeira iteração)
                if (!order.hasTakenPartial) {
                  const distanceToTP = Math.abs(order.tp - currentPrice);
                  const distanceToSL = Math.abs(currentPrice - order.sl);
                  console.log(`[PNL LOOP] ${order.symbol} ${order.side}: Preço $${currentPrice.toFixed(2)} | TP: $${order.tp.toFixed(2)} (${distanceToTP.toFixed(2)} de distância) | SL: $${order.sl.toFixed(2)} (${distanceToSL.toFixed(2)} de distância)`);
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
                const hitSL = order.side === 'LONG' ? nextPrice <= order.sl : nextPrice >= order.sl;

                if (hitTP) {
                    realizedPnL += pnl;
                    logsToAdd.push(`🎯 ALVO ATINGIDO: ${order.symbol} +$${pnl.toFixed(2)}`);
                    // Close position
                    setOrderHistory(prev => [...prev, { ...order, currentPrice: nextPrice, currentProfit: pnl, closedAt: Date.now() }]);
                } else if (hitSL) {
                    realizedPnL += pnl;
                    logsToAdd.push(`🛡️ STOP ATINGIDO: ${order.symbol} ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
                    // Close position
                    setOrderHistory(prev => [...prev, { ...order, currentPrice: nextPrice, currentProfit: pnl, closedAt: Date.now() }]);
                } else {
                    // Keep position open WITH UPDATED PROFIT
                    nextActiveOrders.push({
                        ...order,
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
           const drawdown = newEquity < newBalance ? ((newBalance - newEquity) / newBalance) * 100 : 0;

           return {
              ...prev,
              balance: newBalance,
              equity: newEquity,
              currentDrawdown: Math.max(drawdown, prev.currentDrawdown),
              openPositionsValue: totalExposure,
           };
        });
    }, 1000); // Update every 1 second

    return () => clearInterval(pnlInterval);
  }, [activeOrders.length]);

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

      // 🔥 BUSCAR SALDO REAL DO METAAPI
      const result = await wrapMT5Connection(async () => {
        try {
          console.log('[useApexLogic] 🌐 Buscando saldo real do MetaAPI...');
          
          // Importar e usar MetaAPI Direct Client
          const { getMetaAPIClient } = await import('../services/MetaAPIDirectClient');
          const client = getMetaAPIClient(credentials.token);
          
          // Conectar à conta
          const connected = await client.connect(credentials.login);
          if (!connected) {
            throw new Error('Falha ao conectar ao MetaAPI');
          }
          
          // Buscar informações da conta
          const accountInfo = await client.getAccountInfo();
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
      });

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