import React, { createContext, useContext, ReactNode, useState, useCallback, useMemo, useEffect } from 'react';
import { useApexLogic, TradeVisual, PortfolioState, AIConfig, HouseStats } from '../hooks/useApexLogic';
import { RiskProfileType } from '../../lib/modules/NeuralRiskGuardian';
import { useMarketContext } from './MarketContext';

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
  syncWallet: () => Promise<boolean>;
  panicClose: () => Promise<void>;
  applyCommission: (percentage: number) => void;
  resetPortfolio: (balance: number) => void;
  closeHedgedPositions: () => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const ApexTradingProvider = ({ children }: { children: ReactNode }) => {
  // We need MarketContext to feed real prices into the Logic Engine
  // ⚠️ SAFETY: Durante hot reload, pode retornar valores padrão
  const marketContext = useMarketContext();
  
  // ✅ CORREÇÃO: Todos useState ANTES de custom hooks (Rules of Hooks)
  // Legacy state for compatibility
  const [assetSelectionMode, setAssetSelectionMode] = useState<'AI' | 'MANUAL'>('AI');
  
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
  
  // Initialize the hook once here, so it persists across page navigations
  // ✅ SEMPRE chamar hooks na mesma ordem (Rules of Hooks)
  const logic = useApexLogic({
    prices: marketContext?.marketState?.prices || {}, // ✅ Fallback seguro
    mt5Offset: 0
  });
  
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
    syncWallet,
    panicClose,
    applyCommission,
    resetPortfolio,
    closeHedgedPositions,
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
    toggleAI,
    setConfig,
    setRiskProfile,
    assetSelectionMode,
    setAssetSelectionMode,
    selectedAsset,
    setSelectedAssetPersistent,
    syncWallet,
    panicClose,
    applyCommission,
    resetPortfolio,
    closeHedgedPositions,
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