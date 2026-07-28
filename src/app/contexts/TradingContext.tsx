import React, { createContext, useContext, ReactNode, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useApexLogic, TradeVisual, PortfolioState, AIConfig, HouseStats, EquityPoint } from '../hooks/useApexLogic';
import { useStrategies } from '../hooks/useStrategies';
import { RiskProfileType } from '../../lib/modules/NeuralRiskGuardian';
import { useMarketContext } from './MarketContext';
import { useLiveAlertStage, LiveAlertEvent } from '../modules/liveAlertStage/useLiveAlertStage';

interface TradingContextType {
  // State from useApexLogic
  isActive: boolean;
  isPaused: boolean;
  activeOrders: TradeVisual[];
  tradeHistory: TradeVisual[];
  portfolio: PortfolioState;
  recentLogs: string[];
  orderHistory: TradeVisual[];
  houseStats: HouseStats;
  performanceMetrics: any;
  healthStatus: any;
  aiConfig: AIConfig;
  mt5Credentials: any;
  executionMode: 'DEMO' | 'LIVE';
  isConnectedToMT5: boolean;
  mt5AccountId: string | null;
  isSafeMode: boolean;
  safeModeReason: string | null;
  candlesSinceLastTrade: number;
  maxCandlesBeforeForceEntry: number;
  equityHistory: EquityPoint[];

  // Actions from useApexLogic
  startLogic: () => void;
  stopLogic: () => void;
  pauseLogic: () => void;
  resumeLogic: () => void;
  resetLogic: () => void;
  forceCloseAll: () => void;
  updateAIConfig: (config: Partial<AIConfig>) => void;
  connectToMT5: (credentials: any) => Promise<void>;
  disconnectFromMT5: () => void;
  disableSafeMode: () => void;
  updateCandleCounter: (value: number) => void;
  updateMaxCandlesBeforeForceEntry: (value: number) => void;
  updateBalance: (balance: number) => void;
  updatePortfolioFromMT5: (data: { balance: number; equity: number }) => void;
  syncPositionsFromMT5: (positions: any[]) => void;
  setExecutionMode: React.Dispatch<React.SetStateAction<'DEMO' | 'LIVE'>>;
  switchToDemoMode: () => void;

  // Legacy compatibility (mapped to useApexLogic functions)
  status: 'idle' | 'running';
  toggleAI: () => void;
  config: AIConfig;
  setConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
  riskProfile: RiskProfileType;
  setRiskProfile: (profile: RiskProfileType) => void;
  assetSelectionMode: 'AI' | 'MANUAL';
  setAssetSelectionMode: (mode: 'AI' | 'MANUAL') => void;
  selectedAsset: string;
  setSelectedAsset: (asset: string) => void;
  // Ativo REALMENTE exibido no Dashboard agora (MarketScoreBoard.tsx tem seu
  // próprio estado local pra ficar independente do Gráfico — ver histórico do
  // projeto — então `selectedAsset` acima não reflete o que o usuário está
  // vendo no Dashboard). Widgets irmãos do Dashboard (ex: RiskThermometer)
  // devem ler ESTE campo, não `selectedAsset`, pra acompanhar a troca de ativo.
  dashboardActiveSymbol: string;
  setDashboardActiveSymbol: (asset: string) => void;
  // Score real já calculado pelo Dashboard pro ativo acima — widgets irmãos
  // (ex: RiskThermometer) devem LER isto, nunca recalcular por conta própria:
  // uma segunda chamada ao MarketScoreEngine pro mesmo símbolo/timeframe dobra
  // a carga na conta MetaAPI compartilhada (rate-limit documentado no projeto)
  // e pode falhar mesmo com o Dashboard principal funcionando normalmente.
  dashboardScoreResult: any | null;
  setDashboardScoreResult: (result: any | null) => void;
  syncWallet: () => Promise<boolean>;
  panicClose: () => Promise<void>;
  applyCommission: (percentage: number) => void;
  resetPortfolio: (balance: number) => void;
  closeHedgedPositions: () => void;

  // Fase 6, estágio 1 — LIVE + somente alerta (ver AI_BRAIN_SPEC.md seção 9.1)
  liveAlertStageEnabled: boolean;
  setLiveAlertStageEnabled: (next: boolean) => void;
  liveAlerts: LiveAlertEvent[];
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const ApexTradingProvider = ({ children }: { children: ReactNode }) => {
  // We need MarketContext to feed real prices into the Logic Engine
  // ⚠️ SAFETY: Durante hot reload, pode retornar valores padrão
  const marketContext = useMarketContext();
  
  // ✅ CORREÇÃO: Todos useState ANTES de custom hooks (Rules of Hooks)
  // Legacy state for compatibility
  const [assetSelectionMode, setAssetSelectionMode] = useState<'AI' | 'MANUAL'>('AI');

  // Espelha o estado local de ativo do MarketScoreBoard (Dashboard) — session-only,
  // sem localStorage (não precisa sobreviver a reload, só sincronizar irmãos vivos).
  const [dashboardActiveSymbol, setDashboardActiveSymbol] = useState<string>('BTCUSD');
  const [dashboardScoreResult, setDashboardScoreResult] = useState<any | null>(null);
  
  // 🔥 PERSISTÊNCIA GLOBAL: Ativo selecionado sincronizado entre todas as páginas
  const [selectedAsset, setSelectedAsset] = useState<string>(() => {
    // Carregar do localStorage ao inicializar
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedAsset');
      return saved || 'BTCUSDT'; // Default: BTC
    }
    return 'BTCUSDT';
  });
  
  // 🔥 Atualizar localStorage sempre que o ativo mudar
  const setSelectedAssetPersistent = useCallback((asset: string) => {
    setSelectedAsset(asset);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedAsset', asset);
      console.log(`[TradingContext] 💾 Ativo selecionado salvo: ${asset}`);
    }
  }, []);
  
  // 🆕 Estratégias reais (prontas + customizadas) — a IA ao vivo roda exatamente
  // a estratégia selecionada em aiConfig.activeStrategyId, mesma lógica do Backtest
  const { strategies } = useStrategies();

  // Fase 6, estágio 1 (ver research/AI_BRAIN_SPEC.md seção 9.1): o motor
  // (useApexLogic) invoca `onLiveDecision` assim que decide uma entrada — esse
  // wrapper indireto existe porque o hook do estágio 1 (useLiveAlertStage)
  // precisa de `logic.executionMode`, que só existe DEPOIS de useApexLogic ser
  // chamado. O ref resolve a dependência circular sem acoplar os dois hooks.
  const liveDecisionHandlerRef = useRef<(decision: TradeVisual) => void>(() => {});
  const forwardLiveDecision = useCallback((decision: TradeVisual) => {
    liveDecisionHandlerRef.current(decision);
  }, []);

  // Estágio 1 é opt-in, desligado por padrão — persiste localmente por ser
  // uma preferência de UI, não um dado sensível.
  const [liveAlertStageEnabled, setLiveAlertStageEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('neural_live_alert_stage_enabled') === 'true';
  });
  const setLiveAlertStageEnabledPersistent = useCallback((next: boolean) => {
    setLiveAlertStageEnabled(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('neural_live_alert_stage_enabled', String(next));
    }
  }, []);

  // Initialize the hook once here, so it persists across page navigations
  // ✅ SEMPRE chamar hooks na mesma ordem (Rules of Hooks)
  const logic = useApexLogic({
    prices: marketContext?.marketState?.prices || {}, // ✅ Fallback seguro
    mt5Offset: 0
  }, strategies, forwardLiveDecision);

  const liveAlertStage = useLiveAlertStage({
    executionMode: logic.executionMode,
    enabled: liveAlertStageEnabled,
  });
  useEffect(() => {
    liveDecisionHandlerRef.current = liveAlertStage.onLiveDecision;
  }, [liveAlertStage.onLiveDecision]);
  
  // Legacy functions mapped to new logic - memoized to prevent infinite loops
  const toggleAI = useCallback(() => {
    if (logic.isActive) {
      logic.stopLogic();
    } else {
      logic.startLogic();
    }
  }, [logic.isActive, logic.stopLogic, logic.startLogic]);
  
  const setConfig = useCallback((configOrUpdater: AIConfig | ((prev: AIConfig) => AIConfig)) => {
    if (typeof configOrUpdater === 'function') {
      const newConfig = configOrUpdater(logic.aiConfig);
      logic.updateAIConfig(newConfig);
    } else {
      logic.updateAIConfig(configOrUpdater);
    }
  }, [logic.aiConfig, logic.updateAIConfig]);
  
  const setRiskProfile = useCallback((profile: RiskProfileType) => {
    logic.updateAIConfig({ riskProfile: profile });
  }, [logic.updateAIConfig]);
  
  const syncWallet = useCallback(async () => {
    // Legacy function - no-op for now
    return true;
  }, []);

  // Único caminho pra voltar de LIVE pra DEMO (2026-07-27) — antes existia
  // duplicado em AITrader.tsx e em Header.tsx, com comportamento divergente
  // (o do Header não resetava saldo nem salvava 'neural_execution_mode').
  // Ir de DEMO pra LIVE não tem equivalente aqui de propósito: exige
  // credenciais reais, então só existe um caminho — o modal de conexão MT5
  // dentro do AI Trader.
  const switchToDemoMode = useCallback(() => {
    logic.setExecutionMode('DEMO');
    logic.resetLogic();
    if (typeof window !== 'undefined') {
      localStorage.setItem('neural_execution_mode', 'DEMO');
    }
    toast.info('🟢 Modo DEMO ativado', {
      description: 'Voltou para negociação simulada | Saldo resetado: $100'
    });
  }, [logic.setExecutionMode, logic.resetLogic]);
  
  const panicClose = useCallback(async () => {
    logic.forceCloseAll();
  }, [logic.forceCloseAll]);
  
  const applyCommission = useCallback((percentage: number) => {
    // Legacy function - no-op for now
  }, []);
  
  const resetPortfolio = useCallback((balance: number) => {
    logic.resetLogic();
  }, [logic.resetLogic]);
  
  const closeHedgedPositions = useCallback(() => {
    // Legacy function - no-op for now
  }, []);
  
  const value: TradingContextType = useMemo(() => ({
    // State from useApexLogic
    isActive: logic.isActive,
    isPaused: logic.isPaused,
    activeOrders: logic.activeOrders,
    orderHistory: logic.orderHistory,
    portfolio: logic.portfolio,
    recentLogs: logic.recentLogs,
    houseStats: logic.houseStats,
    performanceMetrics: logic.performanceMetrics,
    healthStatus: logic.healthStatus,
    aiConfig: logic.aiConfig,
    mt5Credentials: logic.mt5Credentials,
    executionMode: logic.executionMode,
    isConnectedToMT5: logic.isConnectedToMT5,
    mt5AccountId: logic.mt5AccountId,
    isSafeMode: logic.isSafeMode,
    safeModeReason: logic.safeModeReason,
    candlesSinceLastTrade: logic.candlesSinceLastTrade,
    maxCandlesBeforeForceEntry: logic.maxCandlesBeforeForceEntry,
    equityHistory: logic.equityHistory,

    // Actions from useApexLogic
    startLogic: logic.startLogic,
    stopLogic: logic.stopLogic,
    pauseLogic: logic.pauseLogic,
    resumeLogic: logic.resumeLogic,
    resetLogic: logic.resetLogic,
    forceCloseAll: logic.forceCloseAll,
    updateAIConfig: logic.updateAIConfig,
    connectToMT5: logic.connectToMT5,
    disconnectFromMT5: logic.disconnectFromMT5,
    disableSafeMode: logic.disableSafeMode,
    updateCandleCounter: logic.updateCandleCounter,
    updateMaxCandlesBeforeForceEntry: logic.updateMaxCandlesBeforeForceEntry,
    updateBalance: logic.updateBalance,
    updatePortfolioFromMT5: logic.updatePortfolioFromMT5,
    syncPositionsFromMT5: logic.syncPositionsFromMT5,
    setExecutionMode: logic.setExecutionMode,
    switchToDemoMode,

    // Legacy compatibility
    status: logic.isActive ? 'running' : 'idle',
    toggleAI,
    tradeHistory: logic.orderHistory,
    config: logic.aiConfig,
    setConfig,
    riskProfile: logic.aiConfig.riskProfile,
    setRiskProfile,
    assetSelectionMode,
    setAssetSelectionMode,
    selectedAsset,
    setSelectedAsset: setSelectedAssetPersistent,
    dashboardActiveSymbol,
    setDashboardActiveSymbol,
    dashboardScoreResult,
    setDashboardScoreResult,
    syncWallet,
    panicClose,
    applyCommission,
    resetPortfolio,
    closeHedgedPositions,
    liveAlertStageEnabled,
    setLiveAlertStageEnabled: setLiveAlertStageEnabledPersistent,
    liveAlerts: liveAlertStage.alerts,
  }), [
    logic.isActive,
    logic.isPaused,
    logic.activeOrders,
    logic.orderHistory,
    logic.portfolio,
    logic.recentLogs,
    logic.houseStats,
    logic.performanceMetrics,
    logic.healthStatus,
    logic.aiConfig,
    logic.mt5Credentials,
    logic.executionMode,
    logic.isConnectedToMT5,
    logic.mt5AccountId,
    logic.isSafeMode,
    logic.safeModeReason,
    logic.candlesSinceLastTrade,
    logic.maxCandlesBeforeForceEntry,
    logic.equityHistory,
    logic.startLogic,
    logic.stopLogic,
    logic.pauseLogic,
    logic.resumeLogic,
    logic.resetLogic,
    logic.forceCloseAll,
    logic.updateAIConfig,
    logic.connectToMT5,
    logic.disconnectFromMT5,
    logic.disableSafeMode,
    logic.updateCandleCounter,
    logic.updateMaxCandlesBeforeForceEntry,
    logic.updateBalance,
    logic.updatePortfolioFromMT5,
    logic.syncPositionsFromMT5,
    logic.setExecutionMode,
    switchToDemoMode,
    toggleAI,
    setConfig,
    setRiskProfile,
    assetSelectionMode,
    setAssetSelectionMode,
    selectedAsset,
    setSelectedAssetPersistent,
    dashboardActiveSymbol,
    dashboardScoreResult,
    syncWallet,
    panicClose,
    applyCommission,
    resetPortfolio,
    closeHedgedPositions,
    liveAlertStageEnabled,
    setLiveAlertStageEnabledPersistent,
    liveAlertStage.alerts,
  ]);

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};

export const useTradingContext = () => {
  const context = useContext(TradingContext);
  if (!context) {
    // 🔥 DETECTAR SE É ERRO DE CACHE ANTIGO
    const isOldCacheError = typeof window !== 'undefined' && 
      (window.location.href.includes('ai-trader') || 
       document.querySelector('[data-view="ai-trader"]'));
    
    if (isOldCacheError) {
      console.error(`
╔════════════════════════════════════════════════════════════╗
║  🔥 ERRO DE CACHE DETECTADO!                              ║
║                                                            ║
║  Seu navegador está usando código ANTIGO em cache.        ║
║                                                            ║
║  SOLUÇÃO:                                                  ║
║  Mac: Cmd + Shift + R                                     ║
║  Windows: Ctrl + Shift + R                                ║
║                                                            ║
║  Isso forçará o download da versão mais recente.          ║
╚════════════════════════════════════════════════════════════╝
      `);
    }
    
    throw new Error('useTradingContext must be used within an ApexTradingProvider');
  }
  return context;
};