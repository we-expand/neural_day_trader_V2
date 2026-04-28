import React, { Component, ErrorInfo, ReactNode } from 'react';
import { CacheBusterScreen } from './CacheBusterScreen';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
  canRecover: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;
  
  public state: State = {
    hasError: false,
    errorCount: 0,
    canRecover: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[ErrorBoundary] 🛡️ Error caught:', error);
    
    // 🛡️ SUPRESSÃO MÁXIMA: ERROS DO IFRAME DO FIGMA E OUTROS ERROS NÃO-CRÍTICOS
    const errorStr = String(error.message || error.name || error);
    const isFigmaError =
      error.name === 'IframeMessageAbortError' ||
      errorStr.includes('IframeMessageAbortError') ||
      errorStr.includes('message port was destroyed') ||
      errorStr.includes('Message aborted') ||
      errorStr.includes('figma_app__react_profile') ||
      errorStr.includes('webpack-artifacts') ||
      errorStr.includes('setupMessageChannel') ||
      errorStr.includes('cleanup');

    // 🛡️ SUPRESSÃO: Erro de removeChild (não crítico)
    const isRemoveChildError =
      errorStr.includes('removeChild') ||
      errorStr.includes('not a child of this node') ||
      error.name === 'NotFoundError';

    if (isFigmaError || isRemoveChildError) {
      // ✅ NÃO MOSTRAR ERRO - Apenas logar silenciosamente
      console.warn('[ErrorBoundary] ℹ️ Suprimindo erro não-crítico:', errorStr);
      // RETORNAR hasError: false = NÃO MOSTRAR NADA
      return { hasError: false };
    }
    
    // 🔥 DETECTAR SE É UM ERRO RECUPERÁVEL (URLSearchParams)
    const isURLSearchParamsError = error.message && error.message.includes('URLSearchParams');
    const canRecover = isURLSearchParamsError;
    
    // 🔥 DETECTAR ERRO DE CONTEXTO DESATUALIZADO (Cache Problem)
    if (error.message && (error.message.includes('deve ser usado dentro de') || error.message.includes('must be used within'))) {
      console.error('[ErrorBoundary] 🚨 ERRO DE CONTEXTO DETECTADO - PROBLEMA DE CACHE!');
      console.error('[ErrorBoundary] 📋 Contexto ausente:', error.message);
      console.error('[ErrorBoundary] 💡 SOLUÇÃO: Limpar cache do navegador e do Vite');
      console.error('[ErrorBoundary] 📝 Ver: SOLUCAO_ERRO_MAC_PROVIDER.md');
    }
    
    return { 
      hasError: true, 
      error,
      canRecover,
      errorCount: 0 // será atualizado em componentDidCatch
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 🚨 Component error details:', {
      error: error.message,
      errorName: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      // 🛡️ Diagnostics adicionais
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      timestamp: new Date().toISOString(),
      URLSearchParamsAvailable: typeof URLSearchParams !== 'undefined',
      URLAvailable: typeof URL !== 'undefined',
      globalThisAvailable: typeof globalThis !== 'undefined'
    });
    
    // 🛡️ PROTEÇÃO: Prevenir propagação de erros para o iframe do Figma
    try {
      // Tentar capturar mais informações sobre o erro
      if (error.name === 'ChunkLoadError') {
        console.warn('[ErrorBoundary] ⚠️ Chunk load error detected - might need page reload');
      }
      
      // 🔍 Detectar erro de URLSearchParams e tentar auto-recuperação
      if (error.message && error.message.includes('URLSearchParams')) {
        console.error('[ErrorBoundary] 🚨 ERRO CRÍTICO: URLSearchParams não disponível!', {
          globalURLSearchParams: typeof globalThis.URLSearchParams,
          windowURLSearchParams: typeof window?.URLSearchParams
        });
        
        // 🔥 TENTAR APLICAR POLYFILL NOVAMENTE
        this.applyEmergencyPolyfill();
        
        // 🔥 TENTAR AUTO-RECUPERAÇÃO após 2 segundos
        this.setState(prev => ({ 
          errorCount: prev.errorCount + 1,
          canRecover: prev.errorCount < 3 // Permitir até 3 tentativas
        }));
        
        if (this.state.errorCount < 3) {
          console.log('[ErrorBoundary] 🔄 Tentando auto-recuperação em 2 segundos...');
          this.retryTimeout = setTimeout(() => {
            this.setState({ hasError: false, error: undefined });
          }, 2000);
        }
      }
    } catch (e) {
      console.error('[ErrorBoundary] Error processing error:', e);
    }
  }
  
  private applyEmergencyPolyfill() {
    try {
      if (typeof URLSearchParams === 'undefined') {
        console.warn('[ErrorBoundary] 🚑 Aplicando polyfill de emergência');
        // @ts-ignore
        window.URLSearchParams = class {
          constructor(init) {
            this.params = new Map();
          }
          get(key) { return null; }
          set(key, value) {}
          toString() { return ''; }
        };
        // @ts-ignore
        globalThis.URLSearchParams = window.URLSearchParams;
      }
    } catch (e) {
      console.error('[ErrorBoundary] Falha ao aplicar polyfill de emergência:', e);
    }
  }
  
  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private handleRetry = () => {
    console.log('[ErrorBoundary] 🔄 Manual retry requested');
    this.setState({ 
      hasError: false, 
      error: undefined,
      errorCount: 0 
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 🔥 SE PODE RECUPERAR, mostrar mensagem de carregamento
      if (this.state.canRecover && this.state.errorCount < 3) {
        return (
          <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-[#2a2a2a] border border-amber-500/20 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4 animate-pulse">🔄</div>
              <h1 className="text-2xl font-bold text-amber-400 mb-4">Recuperando...</h1>
              <p className="text-slate-400 mb-6">
                Detectamos um problema e estamos tentando corrigir automaticamente.
              </p>
              <div className="text-sm text-slate-500 mb-4">
                Tentativa {this.state.errorCount + 1} de 3
              </div>
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors"
              >
                Tentar Agora
              </button>
            </div>
          </div>
        );
      }

      // 🔴 ERRO PERMANENTE - mostrar tela de erro completa
      return (
        <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-[#2a2a2a] border border-red-500/20 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-400 mb-4">Algo deu errado</h1>
            <p className="text-slate-400 mb-6">
              Ocorreu um erro inesperado na aplicação.
            </p>
            {this.state.error && (
              <>
                <pre className="text-left text-xs bg-black/50 p-4 rounded mb-4 overflow-auto max-h-32 text-red-300">
                  {this.state.error.toString()}
                </pre>
                
                {/* ✅ INSTRUÇÕES ESPECÍFICAS PARA ERRO DE CONTEXTO/CACHE */}
                {(this.state.error.message?.includes('deve ser usado dentro de') || 
                  this.state.error.message?.includes('must be used within')) && (
                  <div className="text-left bg-amber-900/20 border border-amber-500/30 p-4 rounded mb-4">
                    <p className="text-xs text-amber-300 font-bold mb-2">💡 Problema de Cache Detectado</p>
                    <p className="text-xs text-slate-300 mb-2">
                      Este erro ocorre quando código antigo fica em cache. Para corrigir:
                    </p>
                    <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                      <li>Pressione <kbd className="bg-black/50 px-1 rounded">Cmd+Shift+Delete</kbd> (Mac) ou <kbd className="bg-black/50 px-1 rounded">Ctrl+Shift+Delete</kbd></li>
                      <li>Limpe <strong>Cookies e Cache</strong></li>
                      <li>Execute: <code className="bg-black/50 px-1 rounded">rm -rf node_modules/.vite && npm run dev</code></li>
                      <li>Feche todas as abas e reabra</li>
                    </ol>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}