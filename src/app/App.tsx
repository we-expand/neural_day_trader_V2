import React, { useState, useCallback, useMemo, useEffect } from 'react';
import '@/app/config/figmaErrorHandler'; // 🛡️ Silencia erros do Figma iframe
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext';
import { MarketProvider } from '@/app/contexts/MarketContext';
import { MarketDataProvider } from '@/app/contexts/MarketDataContext'; // 🆕 Provider para MT5 Price Validator
import { ApexTradingProvider } from '@/app/contexts/TradingContext';
import { SimulatorProvider } from '@/app/contexts/SimulatorContext';
import { AssistantProvider, useAssistant } from '@/app/contexts/AssistantContext';
import { DebugProvider } from '@/app/components/debug/DebugController';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { useFavicon } from '@/app/hooks/useFavicon'; // 🆕 Hook para logo no browser
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
import { Marketplace } from '@/app/components/Marketplace';
import { UserProfile } from '@/app/components/UserProfile';
import PyramidingExample from '@/app/components/examples/InfinoxExamples';
import { CompetitiveAnalysis } from '@/app/components/CompetitiveAnalysis';
import { LandingPage } from '@/app/components/landing/LandingPage';
import { AuthOverlay } from '@/app/components/auth/AuthOverlay';
import { LocalAuthTest } from '@/app/components/auth/LocalAuthTest';
import { MarketTicker } from '@/app/components/MarketTicker';
import { FloatingAssistantButton } from '@/app/components/FloatingAssistantButton';
// import { LiveTradingTest } from '@/app/components/LiveTradingTest';
import { NeuralAssistant } from '@/app/components/NeuralAssistant';
import { QuantumAnalysis } from '@/app/components/quantum/QuantumAnalysis';
import { UnifiedDataTester } from '@/app/components/debug/UnifiedDataTester';
import { BinanceDirectComparison } from '@/app/components/debug/BinanceDirectComparison';
import { DebugToolbar } from '@/app/components/debug/DebugToolbar';
import { checkAdminPermissions } from '@/app/config/adminConfig';
import { ComplianceAnalysis } from '@/app/components/ComplianceAnalysis';
import { LaunchStrategy } from '@/app/components/LaunchStrategy';
import { TraderInsights } from '@/app/components/TraderInsights';
import { AITraderVoice } from '@/app/components/modules/AITraderVoice';
import { AITradingEngine } from '@/app/components/AITradingEngine';
import { Toaster } from 'sonner';

// 🚀 LAZY LOADING - Componentes pesados carregados sob demanda
const DevLab = React.lazy(() => import('@/app/components/DevLab'));

// 🔥 PROTEÇÃO ADICIONAL: Interceptar erros ANTES do Error Boundary do Figma
if (typeof window !== 'undefined') {
  // 🛡️ CAMADA 1: Suprimir console.error PRIMEIRO (antes de tudo)
  const originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    const msg = args.join(' ');
    const isFigmaError = 
      msg.includes('IframeMessageAbortError') ||
      msg.includes('message port was destroyed') ||
      msg.includes('Message aborted') ||
      msg.includes('figma_app__react_profile') ||
      msg.includes('webpack-artifacts') ||
      msg.includes('setupMessageChannel') ||
      msg.includes('cleanup') ||
      msg.includes('figma.com/webpack');
    
    if (isFigmaError) {
      // NÃO mostrar no console - apenas log silencioso
      return;
    }
    
    originalConsoleError.apply(console, args);
  };

  // 🛡️ CAMADA 2: window.onerror
  const originalErrorHandler = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    const msg = String(message || '');
    const srcMsg = String(source || '');
    const isFigmaError = 
      msg.includes('IframeMessageAbortError') ||
      msg.includes('message port was destroyed') ||
      msg.includes('Message aborted') ||
      msg.includes('figma_app__react_profile') ||
      msg.includes('webpack-artifacts') ||
      msg.includes('setupMessageChannel') ||
      msg.includes('cleanup') ||
      srcMsg.includes('figma.com/webpack') ||
      srcMsg.includes('figma_app__react_profile') ||
      srcMsg.includes('dfe8a2836a993e65.min.js.br') ||
      srcMsg.includes('.min.js.br');
    
    if (isFigmaError) {
      return true; // Prevenir propagação
    }
    
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };
  
  // 🛡️ CAMADA 3: unhandled rejections
  const originalRejectionHandler = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    const msg = String(event.reason?.message || event.reason || '');
    const isFigmaError = 
      msg.includes('IframeMessageAbortError') ||
      msg.includes('message port was destroyed') ||
      msg.includes('Message aborted') ||
      msg.includes('setupMessageChannel') ||
      msg.includes('cleanup');
    
    if (isFigmaError) {
      event.preventDefault();
      return;
    }
    
    if (originalRejectionHandler) {
      originalRejectionHandler.call(window, event);
    }
  };
}

// 🔥 REBUILD CACHE BUSTER - v3.5.0 - FIX: CACHE PERSISTENTE DO NAVEGADOR
// ✅ SOLUÇÃO DEFINITIVA: Detectar código antigo e FORÇAR reload automático
// ✅ Se detectar hooks antigos (useMarketState, useApexContext), recarregar automaticamente

// 🚨 DETECÇÃO AUTOMÁTICA DE CACHE ANTIGO
if (typeof window !== 'undefined') {
  const CACHE_VERSION = '4.5.0'; // 🆕 Versão atualizada
  const storedVersion = localStorage.getItem('app-cache-version');

  // Se a versão for diferente, limpar TUDO e atualizar versão
  // ✅ SEM window.location.reload() — previne loops de refresh no iframe do Figma
  if (storedVersion !== CACHE_VERSION) {
    console.log('%c═══════════════════════════════════════════════════════', 'color: #ef4444; font-weight: bold');
    console.log('%c🔥 NOVA VERSÃO DETECTADA (v' + CACHE_VERSION + ')! Limpando cache...', 'color: #ef4444; font-size: 16px; font-weight: bold');
    console.log('%c═══════════════════════════════════════════════════════', 'color: #ef4444; font-weight: bold');

    // Limpar localStorage (mas manter credenciais)
    const supabaseSession = localStorage.getItem('sb-bgarakvnuppzkugzptsr-auth-token');
    const emergencyOffline = localStorage.getItem('neural_emergency_offline');

    localStorage.clear();

    if (supabaseSession) {
      localStorage.setItem('sb-bgarakvnuppzkugzptsr-auth-token', supabaseSession);
    }
    if (emergencyOffline) {
      localStorage.setItem('neural_emergency_offline', emergencyOffline);
    }

    localStorage.setItem('app-cache-version', CACHE_VERSION);

    // Limpar sessionStorage
    sessionStorage.clear();

    console.log('[APP] ✅ Cache limpo silenciosamente — SEM reload automático para evitar loops no iframe');
  }

  console.log('%c═══════════════════════════════════════════════════════', 'color: #f59e0b; font-weight: bold');
  console.log('%c🔥 NEURAL DAY TRADER PLATFORM v' + CACHE_VERSION, 'color: #06b6d4; font-size: 16px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════════════════', 'color: #f59e0b; font-weight: bold');
  console.log('%c✅ Cache Buster Automático Ativo (sem reload)', 'color: #10b981; font-weight: bold');
  console.log('%c═══════════════════════════════════════════════════════', 'color: #f59e0b; font-weight: bold');
}

type Language = 'en' | 'pt' | 'es';

type View = 'dashboard' | 'wallet' | 'funds' | 'assets' | 'chart' | 'ai-trader' | 'ai-engine' | 'performance' | 'settings' | 'system' | 'ai-voice' | 'dev-lab' | 'innovation' | 'strategy' | 'store' | 'partners' | 'prop-challenge' | 'admin' | 'profile' | 'pyramiding' | 'competitive-analysis' | 'compliance-analysis' | 'launch-strategy' | 'trader-insights' | 'quantum-analysis' | 'social' | 'live-trading-test';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [language, setLanguage] = useState<Language>('pt');
  const { user, signOut, mockLogin, loading } = useAuth();
  const { fullName } = useUserProfile();
  const { isAssistantOpen, toggleAssistant, closeAssistant } = useAssistant();
  
  // 🆕 Configurar logo Trade Hub no browser
  useFavicon();

  // ✅ TITLE: always "Neural Day Trader" — never user's name, never "Trade Hub"
  useEffect(() => {
    document.title = 'Neural Day Trader';
  }, []);

  // ✅ STABLE handleViewChange — no currentView in deps (prevents cascade re-renders)
  const handleViewChange = useCallback((newView: View) => {
    setCurrentView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []); // ← empty deps = stable reference forever

  const isAdmin = useMemo(() => checkAdminPermissions(user), [user]);

  // ✅ STABLE handleLogout — ALL hooks MUST be declared before any early return (Rules of Hooks)
  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      setShowLanding(true);
      setShowLogin(false);
    } catch (error) {
      console.error('[APP] Erro ao fazer logout:', error);
    }
  }, [signOut]);

  const renderContent = useMemo(() => {
    if (!currentView) {
      return <Dashboard />;
    }
    
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'wallet':
      case 'funds':
        return <Funds />;
      case 'assets':
        return <Assets />;
      case 'chart':
        return (
          <ErrorBoundary>
            <ChartView />
          </ErrorBoundary>
        );
      case 'ai-trader':
        return (
          <ErrorBoundary>
            <AITrader onNavigate={handleViewChange} />
          </ErrorBoundary>
        );
      case 'ai-engine':
        return (
          <ErrorBoundary>
            <AITradingEngine />
          </ErrorBoundary>
        );
      case 'performance':
        return <Performance />;
      case 'settings':
      case 'system':
        return <Settings />;
      case 'ai-voice':
        return <AITraderVoice />;
      case 'innovation':
        return <LiquidityPrediction />;
      case 'strategy':
        return <StrategyDashboard />;
      case 'partners':
        return <Partners />;
      case 'prop-challenge':
        return <PropChallenge />;
      case 'admin':
        return <AdminDashboard onExit={() => setCurrentView('dashboard')} />;
      case 'dev-lab':
        return (
          <React.Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400 text-sm">Carregando DEV LAB...</p>
              </div>
            </div>
          }>
            <DevLab />
          </React.Suspense>
        );
      case 'store':
        return <Marketplace />;
      case 'profile':
        return <UserProfile />;
      case 'pyramiding':
        return <PyramidingExample />;
      case 'competitive-analysis':
        return <CompetitiveAnalysis />;
      case 'quantum-analysis':
        return <QuantumAnalysis />;
      case 'compliance-analysis':
        return <ComplianceAnalysis />;
      case 'launch-strategy':
        return <LaunchStrategy />;
      case 'trader-insights':
        return <TraderInsights />;
      // case 'live-trading-test':
      //   return <LiveTradingTest />;
      default:
        return <Dashboard />;
    }
  }, [currentView]);

  // ✅ LOADING GUARD — declared AFTER all hooks, BEFORE JSX return
  // Prevents LandingPage from flashing for ~200ms while auth reads sessionStorage
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-slate-500 text-xs tracking-widest uppercase">Autenticando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white">
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
          
          {/* 🔥 BANNER DE ALERTA DE CACHE - DESATIVADO */}
          {/* <CacheWarningBanner /> */}
          
          <Sidebar currentView={currentView} onViewChange={handleViewChange} isAdmin={isAdmin} onLogout={handleLogout} />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header 
              currentView={currentView}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              user={user}
            />
            
            <main className="flex-1 overflow-auto">
              {renderContent}
            </main>

            <footer className="shrink-0">
              <div className="h-12 border-t border-slate-700/50 flex items-center justify-center">
                <p className="text-xs text-slate-600 text-center w-full">© 2026 Neural Day Trader</p>
              </div>
              
              <MarketTicker />
            </footer>
          </div>

          <FloatingAssistantButton 
            isOpen={isAssistantOpen} 
            onClick={toggleAssistant} 
          />
          <NeuralAssistant 
            isOpen={isAssistantOpen} 
            onClose={closeAssistant} 
          />

          <UnifiedDataTester />
          {/* <BinanceDirectComparison /> */}
          <DebugToolbar />

          {/* 🧪 DEBUG: LocalAuth Test Component */}
          {process.env.NODE_ENV === 'development' && <LocalAuthTest />}
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
          <MarketDataProvider> {/* 🆕 MT5 Price Validator */}
            <ApexTradingProvider>
              <SimulatorProvider>
                <AssistantProvider>
                  <DebugProvider>
                    <AppContent />
                    <Toaster 
                      position="top-right" 
                      theme="dark"
                      toastOptions={{
                        style: {
                          background: '#18181b',
                          border: '1px solid #3f3f46',
                          color: '#f4f4f5',
                        },
                        className: 'sonner-toast-custom',
                      }}
                    />
                  </DebugProvider>
                </AssistantProvider>
              </SimulatorProvider>
            </ApexTradingProvider>
          </MarketDataProvider>
        </MarketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}