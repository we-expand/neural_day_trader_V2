import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface ModuleStatus {
  name: string;
  status: 'loading' | 'ok' | 'error' | 'warning';
  message?: string;
}

export function ModuleHealthCheck() {
  const [modules, setModules] = useState<ModuleStatus[]>([
    { name: 'Dashboard', status: 'loading' },
    { name: 'Carteira (Funds)', status: 'loading' },
    { name: 'Gráfico', status: 'loading' },
    { name: 'AI Trader', status: 'loading' },
    { name: 'Configurações', status: 'loading' },
    { name: 'Centro de Estratégia', status: 'loading' },
  ]);

  useEffect(() => {
    const checkModules = async () => {
      const results: ModuleStatus[] = [];

      // Dashboard
      try {
        const { Dashboard } = await import('../Dashboard');
        const { ModularDashboard } = await import('../dashboard/ModularDashboard');
        results.push({ name: 'Dashboard', status: 'ok', message: 'Carregado com sucesso' });
      } catch (error: any) {
        results.push({ name: 'Dashboard', status: 'error', message: error.message });
      }

      // Funds
      try {
        const { Funds } = await import('../Funds');
        results.push({ name: 'Carteira (Funds)', status: 'ok', message: 'Carregado com sucesso' });
      } catch (error: any) {
        results.push({ name: 'Carteira (Funds)', status: 'error', message: error.message });
      }

      // ChartView
      try {
        const { ChartView } = await import('../ChartView');
        results.push({ name: 'Gráfico', status: 'ok', message: 'Carregado com sucesso' });
      } catch (error: any) {
        results.push({ name: 'Gráfico', status: 'error', message: error.message });
      }

      // AITrader
      try {
        const { AITrader } = await import('../AITrader');
        results.push({ name: 'AI Trader', status: 'ok', message: 'Carregado com sucesso' });
      } catch (error: any) {
        results.push({ name: 'AI Trader', status: 'error', message: error.message });
      }

      // Settings
      try {
        const { Settings } = await import('../Settings');
        results.push({ name: 'Configurações', status: 'ok', message: 'Carregado com sucesso' });
      } catch (error: any) {
        results.push({ name: 'Configurações', status: 'error', message: error.message });
      }

      // StrategyDashboard
      try {
        const { StrategyDashboard } = await import('../strategy/StrategyDashboard');
        results.push({ name: 'Centro de Estratégia', status: 'ok', message: 'Carregado com sucesso' });
      } catch (error: any) {
        results.push({ name: 'Centro de Estratégia', status: 'error', message: error.message });
      }

      setModules(results);
    };

    checkModules();
  }, []);

  const getIcon = (status: ModuleStatus['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'ok':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: ModuleStatus['status']) => {
    switch (status) {
      case 'loading':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'ok':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 w-96 bg-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl p-4 z-50">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          🔍 Diagnóstico de Módulos
        </h3>
        <p className="text-xs text-slate-400 mt-1">Verificando componentes...</p>
      </div>

      <div className="space-y-2">
        {modules.map((module) => (
          <div
            key={module.name}
            className={`p-3 rounded-lg border ${getStatusColor(module.status)} transition-all`}
          >
            <div className="flex items-center gap-3">
              {getIcon(module.status)}
              <div className="flex-1">
                <div className="font-semibold text-sm text-white">{module.name}</div>
                {module.message && (
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    {module.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 text-center">
          {modules.filter(m => m.status === 'ok').length} de {modules.length} módulos OK
        </div>
      </div>
    </div>
  );
}
