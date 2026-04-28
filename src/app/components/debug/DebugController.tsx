/**
 * 🎛️ DEBUG CONTROLLER
 * 
 * Controla a visibilidade dos painéis de debug
 * - Toggle ON/OFF individual
 * - Atalho de teclado (Ctrl+Shift+D)
 * - Persistência no localStorage
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface DebugState {
  binanceComparison: boolean;
  unifiedMarketTester: boolean;
  masterEnabled: boolean;
}

interface DebugContextType {
  debugState: DebugState;
  toggleBinanceComparison: () => void;
  toggleUnifiedMarketTester: () => void;
  toggleMasterDebug: () => void;
  hideAll: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const useDebug = () => {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within DebugProvider');
  }
  return context;
};

interface DebugProviderProps {
  children: React.ReactNode;
}

export const DebugProvider: React.FC<DebugProviderProps> = ({ children }) => {
  const [debugState, setDebugState] = useState<DebugState>(() => {
    // Carregar do localStorage
    const saved = localStorage.getItem('neural_debug_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse debug state:', e);
      }
    }
    // 🔥 DEBUG DESABILITADO POR PADRÃO EM PRODUÇÃO
    return {
      binanceComparison: false,
      unifiedMarketTester: false,
      masterEnabled: false
    };
  });

  // Salvar no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('neural_debug_state', JSON.stringify(debugState));
  }, [debugState]);

  // Atalho de teclado: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugState(prev => ({
          ...prev,
          masterEnabled: !prev.masterEnabled
        }));
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  const toggleBinanceComparison = () => {
    setDebugState(prev => ({
      ...prev,
      binanceComparison: !prev.binanceComparison
    }));
  };

  const toggleUnifiedMarketTester = () => {
    setDebugState(prev => ({
      ...prev,
      unifiedMarketTester: !prev.unifiedMarketTester
    }));
  };

  const toggleMasterDebug = () => {
    setDebugState(prev => ({
      ...prev,
      masterEnabled: !prev.masterEnabled
    }));
  };

  const hideAll = () => {
    setDebugState({
      binanceComparison: false,
      unifiedMarketTester: false,
      masterEnabled: false
    });
  };

  return (
    <DebugContext.Provider
      value={{
        debugState,
        toggleBinanceComparison,
        toggleUnifiedMarketTester,
        toggleMasterDebug,
        hideAll
      }}
    >
      {children}
    </DebugContext.Provider>
  );
};
