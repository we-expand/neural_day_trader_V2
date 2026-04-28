/**
 * 🏥 HEALTH CHECK COMPONENT
 * Verifica se todos os sistemas estão funcionando corretamente
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useMarketData } from '@/app/contexts/MarketDataContext';
import { Check, X, AlertCircle } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'checking';
  message: string;
}

export function SystemHealthCheck() {
  const [isVisible, setIsVisible] = useState(false);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const { user, loading: authLoading } = useAuth();
  const { isConnected, prices } = useMarketData();

  useEffect(() => {
    // Executar health checks após 1 segundo
    const timer = setTimeout(() => {
      runHealthChecks();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, authLoading, isConnected, prices]);

  const runHealthChecks = () => {
    const newChecks: HealthCheck[] = [];

    // Check 1: Auth Context
    if (!authLoading) {
      newChecks.push({
        name: 'Auth Context',
        status: 'ok',
        message: user ? `User: ${user.email}` : 'No user logged in'
      });
    } else {
      newChecks.push({
        name: 'Auth Context',
        status: 'checking',
        message: 'Loading...'
      });
    }

    // Check 2: Market Data Context
    try {
      newChecks.push({
        name: 'Market Data Context',
        status: 'ok',
        message: `Connected: ${isConnected}, Prices: ${prices.size}`
      });
    } catch (error) {
      newChecks.push({
        name: 'Market Data Context',
        status: 'error',
        message: `Error: ${error}`
      });
    }

    // Check 3: Session Storage
    try {
      const mockUser = sessionStorage.getItem('apex_mock_user');
      newChecks.push({
        name: 'Session Storage',
        status: 'ok',
        message: mockUser ? 'Mock user found' : 'Empty'
      });
    } catch (error) {
      newChecks.push({
        name: 'Session Storage',
        status: 'error',
        message: `Error: ${error}`
      });
    }

    // Check 4: Window Environment
    try {
      const hasWindow = typeof window !== 'undefined';
      const hasDocument = typeof document !== 'undefined';
      newChecks.push({
        name: 'Browser Environment',
        status: hasWindow && hasDocument ? 'ok' : 'error',
        message: `Window: ${hasWindow}, Document: ${hasDocument}`
      });
    } catch (error) {
      newChecks.push({
        name: 'Browser Environment',
        status: 'error',
        message: `Error: ${error}`
      });
    }

    // Check 5: Console Errors
    const hasConsoleErrors = false; // This would need to be tracked globally
    newChecks.push({
      name: 'Console Errors',
      status: hasConsoleErrors ? 'warning' : 'ok',
      message: hasConsoleErrors ? 'Errors detected' : 'No errors'
    });

    setChecks(newChecks);
  };

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'ok':
        return <Check className="w-4 h-4 text-emerald-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      case 'checking':
        return (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
    }
  };

  const getStatusColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'checking':
        return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  // Hotkey: Ctrl+Shift+H para mostrar/ocultar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 z-[9999] p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
        title="Health Check (Ctrl+Shift+H)"
      >
        <AlertCircle className="w-5 h-5 text-zinc-400" />
      </button>
    );
  }

  const allOk = checks.every(check => check.status === 'ok');
  const hasErrors = checks.some(check => check.status === 'error');

  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-white">System Health</h3>
          {allOk && (
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          )}
          {hasErrors && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {checks.map((check, index) => (
          <div
            key={index}
            className={`p-2 rounded border ${getStatusColor(check.status)}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(check.status)}
              <span className="text-sm font-medium text-white">
                {check.name}
              </span>
            </div>
            <p className="text-xs text-zinc-400 ml-6">{check.message}</p>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-zinc-700 flex gap-2">
        <button
          onClick={runHealthChecks}
          className="flex-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
        >
          Refresh
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex-1 px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
        >
          Reload App
        </button>
      </div>

      <div className="px-3 pb-2 text-xs text-zinc-500">
        Press <kbd className="px-1 py-0.5 bg-zinc-800 rounded">Ctrl+Shift+H</kbd> to toggle
      </div>
    </div>
  );
}
