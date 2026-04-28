import React, { createContext, useContext, useState, useCallback } from 'react';

interface AssistantContextData {
  positions: any[];
  marketData: any;
  recentAlerts: any[];
  userProfile: {
    name?: string;
    riskProfile?: 'conservador' | 'moderado' | 'agressivo';
  };
}

interface AssistantContextValue {
  context: AssistantContextData;
  updateContext: (updates: Partial<AssistantContextData>) => void;
  isAssistantOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
}

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [context, setContext] = useState<AssistantContextData>({
    positions: [],
    marketData: null,
    recentAlerts: [],
    userProfile: {}
  });

  const updateContext = useCallback((updates: Partial<AssistantContextData>) => {
    setContext(prev => ({ ...prev, ...updates }));
  }, []);

  const openAssistant = useCallback(() => {
    setIsAssistantOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsAssistantOpen(false);
  }, []);

  const toggleAssistant = useCallback(() => {
    setIsAssistantOpen(prev => !prev);
  }, []);

  return (
    <AssistantContext.Provider
      value={{
        context,
        updateContext,
        isAssistantOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within AssistantProvider');
  }
  return context;
}
