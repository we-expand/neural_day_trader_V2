import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class SafeComponentWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.componentName}] ❌ Erro capturado:`, error);
    console.error(`[${this.props.componentName}] 📍 Stack:`, errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || null,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full flex items-center justify-center bg-black p-8">
          <div className="max-w-2xl w-full p-8 rounded-2xl border-2 border-red-500/20 bg-red-500/10">
            <div className="text-center space-y-6">
              <AlertTriangle className="w-16 h-16 text-red-400 mx-auto" />
              <h1 className="text-3xl font-bold text-red-400">
                Erro no módulo {this.props.componentName}
              </h1>
              <p className="text-lg text-red-300">
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
              
              {this.state.errorInfo && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-red-400 hover:text-red-300">
                    Ver detalhes técnicos
                  </summary>
                  <pre className="mt-2 p-4 bg-black/50 rounded text-xs text-red-300 overflow-auto max-h-48">
                    {this.state.errorInfo}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-4 justify-center pt-4">
                <button
                  onClick={this.handleReset}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-xl font-bold transition-all"
                >
                  Recarregar Página
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
