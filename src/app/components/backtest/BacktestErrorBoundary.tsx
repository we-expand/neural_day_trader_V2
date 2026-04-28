/**
 * 🛡️ BACKTEST ERROR BOUNDARY
 * 
 * Error boundary específico para componentes de backtest
 * Previne crashes do Figma iframe
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class BacktestErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log silencioso - não quebra o Figma
    console.warn('[BacktestErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[120] flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-orange-600/20 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">
              Erro no Módulo de Backtest
            </h3>
            
            <p className="text-sm text-slate-400 mb-6">
              Ocorreu um erro temporário. Você pode tentar novamente.
            </p>
            
            {this.state.error && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 mb-6 text-left">
                <div className="text-xs font-mono text-slate-500 break-all">
                  {this.state.error.message}
                </div>
              </div>
            )}
            
            <button
              onClick={this.handleReset}
              className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
