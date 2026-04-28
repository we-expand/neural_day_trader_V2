import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext';
import { MarketProvider } from '@/app/contexts/MarketContext';
import { ApexTradingProvider } from '@/app/contexts/TradingContext';
import { AssistantProvider, useAssistant } from '@/app/contexts/AssistantContext';
import { DebugProvider } from '@/app/components/debug/DebugController';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { Sidebar } from '@/app/components/Sidebar';
import { Header } from '@/app/components/layout/Header';
import { Dashboard } from '@/app/components/Dashboard';
import { Funds } from '@/app/components/Funds';
import { Assets } from '@/app/components/Assets';
import { ChartView } from '@/app/components/ChartView';
import { AITrader } from '@/app/components/AITrader';
import { Performance } from '@/app/components/Performance';
import { Settings } from '@/app/components/Settings';
import { LiquidityPrediction } from '@/app/components/innovation/LiquidityPrediction';
import { StrategyDashboard } from '@/app/components/strategy/StrategyDashboard';
import { Partners } from '@/app/components/Partners';
import { PropChallenge } from '@/app/components/PropChallenge';
import { AdminDashboard } from '@/app/components/admin/AdminDashboard';
import { NeuralLab } from '@/app/components/NeuralLab';
import { Marketplace } from '@/app/components/Marketplace';
import { UserProfile } from '@/app/components/UserProfile';
import PyramidingExample from '@/app/components/examples/InfinoxExamples';
import { CompetitiveAnalysis } from '@/app/components/CompetitiveAnalysis';
import { LandingPage } from '@/app/components/landing/LandingPage';
import { AuthOverlay } from '@/app/components/auth/AuthOverlay';
import { MarketTicker } from '@/app/components/MarketTicker';
import { FloatingAssistantButton } from '@/app/components/FloatingAssistantButton';
import { NeuralAssistant } from '@/app/components/NeuralAssistant';
import { QuantumAnalysis } from '@/app/components/quantum/QuantumAnalysis';
import { UnifiedDataTester } from '@/app/components/debug/UnifiedDataTester';
import { BinanceDirectComparison } from '@/app/components/debug/BinanceDirectComparison';
import { DebugToolbar } from '@/app/components/debug/DebugToolbar';
import { AIPredictiveAnalysis } from '@/app/components/AIPredictiveAnalysis';
import { checkAdminPermissions } from '@/app/config/adminConfig';

type Language = 'en' | 'pt' | 'es';

type View = 'dashboard' | 'funds' | 'assets' | 'chart' | 'ai-trader' | 'performance' | 'settings' | 'dev-lab' | 'innovation' | 'strategy' | 'store' | 'partners' | 'prop-challenge' | 'admin' | 'profile' | 'pyramiding' | 'competitive-analysis' | 'quantum-analysis' | 'ai-predictive';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [language, setLanguage] = useState<Language>('pt');
  const { user, signOut, mockLogin, loading } = useAuth();
  const { fullName } = useUserProfile();
  const { isAssistantOpen, toggleAssistant, closeAssistant } = useAssistant();

  // 🔥 WRAPPER para setCurrentView com LOGS AGRESSIVOS
  const handleViewChange = (newView: View) => {
    setCurrentView(newView);
  };

  // Update document title with user name
  useEffect(() => {
    if (fullName && fullName !== 'Usuário') {
      document.title = fullName;
    } else {
      document.title = 'Neural Day Trader';
    }
  }, [fullName]);

  // Log de diagnóstico
  React.useEffect(() => {
    console.log('[APP] 🚀 AppContent montado');
    console.log('[APP] 👤 User:', user ? `${String(user.email || 'no-email')} (${String(user.id || 'no-id')})` : 'Não autenticado');
    console.log('[APP] ⏳ Loading:', loading);
    console.log('[APP] 📍 View atual:', currentView);
  }, []);

  React.useEffect(() => {
    console.log('[APP] 🔄 Navegação:', currentView);
  }, [currentView]);

  React.useEffect(() => {
    console.log('[APP] 👤 User mudou:', user ? String(user.email || 'no-email') : 'null');
    console.log('[APP] ⏳ Loading mudou:', loading);
  }, [user, loading]);

  const handleLogout = async () => {
    try {
      await signOut();
      // Reset landing page states on logout
      setShowLanding(true);
      setShowLogin(false);
      console.log('[APP] Logout realizado com sucesso');
    } catch (error) {
      console.error('[APP] Erro ao fazer logout:', error);
    }
  };

  const renderContent = () => {
    console.log('[APP] 🎯 Renderizando:', currentView);
    
    // ✅ GARANTIR QUE SEMPRE TEMOS UMA VIEW VÁLIDA
    if (!currentView) {
      console.warn('[APP] ⚠️ currentView está null/undefined, forçando dashboard');
      setCurrentView('dashboard');
      return <Dashboard />;
    }
    
    try {
      switch (currentView) {
        case 'dashboard':
          console.log('[APP] ✅ Renderizando Dashboard (REAL)');
          return <Dashboard />;
        case 'funds':
          console.log('[APP] ✅ Renderizando Funds (REAL)');
          return <Funds />;
        case 'assets':
          console.log('[APP] ✅ Renderizando Assets (REAL)');
          return <Assets />;
        case 'chart':
          console.log('[APP] ✅ Renderizando ChartView (REAL)');
          return (
            <ErrorBoundary>
              <ChartView />
            </ErrorBoundary>
          );
        case 'ai-trader':
          console.log('[APP] ✅ Renderizando AITrader (REAL)');
          return <AITrader />;
        case 'performance':
          console.log('[APP] ✅ Renderizando Performance (REAL)');
          return <Performance />;
        case 'settings':
          console.log('[APP] ✅ Renderizando Settings (COMPONENTE LIMPO)');
          return <Settings />;
        case 'innovation':
          console.log('[APP] ✅ Renderizando LiquidityPrediction (REAL)');
          return <LiquidityPrediction />;
        case 'strategy':
          console.log('[APP] ✅ Renderizando StrategyDashboard (REAL)');
          return <StrategyDashboard />;
        case 'partners':
          console.log('[APP] ✅ Renderizando Partners (REAL)');
          return <Partners />;
        case 'prop-challenge':
          console.log('[APP] ✅ Renderizando PropChallenge (REAL)');
          return <PropChallenge />;
        case 'admin':
          console.log('[APP] ✅ Renderizando AdminDashboard (REAL)');
          return <AdminDashboard onExit={() => setCurrentView('dashboard')} />;
        case 'dev-lab':
          console.log('[APP] ✅ Renderizando NeuralLab (REAL)');
          return <NeuralLab />;
        case 'store':
          console.log('[APP] ✅ Renderizando Marketplace (REAL)');
          return <Marketplace />;
        case 'profile':
          console.log('[APP] ✅ Renderizando UserProfile (REAL)');
          return <UserProfile />;
        case 'pyramiding':
          console.log('[APP] ✅ Renderizando PyramidingExample (REAL)');
          return <PyramidingExample />;
        case 'competitive-analysis':
          console.log('[APP] ✅ Renderizando CompetitiveAnalysis (REAL)');
          return <CompetitiveAnalysis />;
        case 'quantum-analysis':
          console.log('[APP] ✅ Renderizando QuantumAnalysis (REAL)');
          return <QuantumAnalysis />;
        default:
          console.log('[APP] ⚠️ View desconhecida, redirecionando para Dashboard');
          return <Dashboard />;
      }
    } catch (error) {
      console.error('[APP] ❌ ERRO ao renderizar view:', currentView, error);
      return (
        <div className="p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Erro ao carregar módulo</h2>
            <p className="text-slate-400 mb-4">Ocorreu um erro ao carregar {currentView}</p>
            <button 
              onClick={() => setCurrentView('dashboard')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="bg-black text-white">
      {/* Landing Page ou Login/App */}
      {!user ? (
        <>
          {showLanding && !showLogin ? (
            <div className="w-full h-screen overflow-y-auto">
              <LandingPage 
                onLoginClick={() => {
                  setShowLanding(false);
                  setShowLogin(true);
                }}
                lang={language}
                setLang={setLanguage}
              />
            </div>
          ) : (
            <div className="flex h-screen overflow-hidden">
              <AuthOverlay
                onAuthenticated={(userData) => {
                  if (userData?.email && typeof mockLogin === 'function') {
                    mockLogin(userData.email, userData.name);
                  }
                }}
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex h-screen overflow-hidden">
          
          <Sidebar currentView={currentView} onViewChange={handleViewChange} isAdmin={checkAdminPermissions(user)} onLogout={handleLogout} />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header 
              currentView={currentView}
              isAdmin={checkAdminPermissions(user)}
              onLogout={handleLogout}
              user={user}
            />
            
            <main className="flex-1 overflow-auto">
              {renderContent()}
            </main>

            <footer className="shrink-0">
              {/* Copyright - Perfeitamente centralizado */}
              <div className="h-12 border-t border-slate-700/50 flex items-center justify-center">
                <p className="text-xs text-slate-600 text-center w-full">© 2026 Neural Day Trader</p>
              </div>
              
              {/* Market Ticker - Faixa de ativos com scroll automático */}
              <MarketTicker />
            </footer>
          </div>

          {/* 🌙 NEURAL ASSISTANT - Luna (Botão flutuante + Modal) */}
          <FloatingAssistantButton 
            isOpen={isAssistantOpen} 
            onClick={toggleAssistant} 
          />
          <NeuralAssistant 
            isOpen={isAssistantOpen} 
            onClose={closeAssistant} 
          />

          {/* 🚀 UNIFIED DATA TESTER - Teste das novas APIs */}
          <UnifiedDataTester />
          
          {/* 🔍 BINANCE DIRECT COMPARISON - Comparação Direta */}
          <BinanceDirectComparison />

          {/* 🎛️ DEBUG TOOLBAR - Controle dos painéis de debug */}
          <DebugToolbar />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MarketProvider>
          <ApexTradingProvider>
            <AssistantProvider>
              <DebugProvider>
                <AppContent />
                <Toaster position="top-right" />
              </DebugProvider>
            </AssistantProvider>
          </ApexTradingProvider>
        </MarketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
