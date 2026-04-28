/**
 * ⚡ LAZY COMPONENTS - Componentes com Lazy Loading
 * 
 * Carrega componentes pesados apenas quando necessário
 * Reduz drasticamente o bundle inicial
 */

import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// LOADING COMPONENT
// ═══════════════════════════════════════════════════════════

export function ComponentLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Carregando módulo...</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LAZY LOADED COMPONENTS
// ═══════════════════════════════════════════════════════════

// 🚀 HEAVY COMPONENTS (carrega sob demanda)
export const LazyChartView = lazy(() => 
  import('@/app/components/ChartView').then(m => ({ default: m.ChartView }))
);

export const LazyAITrader = lazy(() => 
  import('@/app/components/AITrader').then(m => ({ default: m.AITrader }))
);

export const LazyLiquidityPrediction = lazy(() => 
  import('@/app/components/innovation/LiquidityPrediction').then(m => ({ default: m.LiquidityPrediction }))
);

export const LazyStrategyDashboard = lazy(() => 
  import('@/app/components/strategy/StrategyDashboard').then(m => ({ default: m.StrategyDashboard }))
);

export const LazyNeuralLab = lazy(() => 
  import('@/app/components/NeuralLab').then(m => ({ default: m.NeuralLab }))
);

export const LazyMarketplace = lazy(() => 
  import('@/app/components/Marketplace').then(m => ({ default: m.Marketplace }))
);

export const LazyAdminDashboard = lazy(() => 
  import('@/app/components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard }))
);

export const LazyCompetitiveAnalysis = lazy(() => 
  import('@/app/components/CompetitiveAnalysis').then(m => ({ default: m.CompetitiveAnalysis }))
);

export const LazyQuantumAnalysis = lazy(() => 
  import('@/app/components/quantum/QuantumAnalysis').then(m => ({ default: m.QuantumAnalysis }))
);

export const LazyAITraderVoice = lazy(() => 
  import('@/app/components/modules/AITraderVoice').then(m => ({ default: m.AITraderVoice }))
);

// 🎯 BACKTEST COMPONENTS
export const LazyAIvsTraderMode = lazy(() => 
  import('@/app/components/backtest/AIvsTraderMode').then(m => ({ default: m.AIvsTraderMode }))
);

export const LazyBacktestDecisionsPanel = lazy(() => 
  import('@/app/components/backtest/BacktestDecisionsPanel').then(m => ({ default: m.BacktestDecisionsPanel }))
);

// ═══════════════════════════════════════════════════════════
// WRAPPER HELPER
// ═══════════════════════════════════════════════════════════

export function withLazyLoading<P extends object>(
  Component: React.LazyExoticComponent<React.ComponentType<P>>
) {
  return function LazyWrapper(props: P) {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
