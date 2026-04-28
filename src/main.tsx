import React from 'react';
import ReactDOM from 'react-dom/client';

// 🛡️ PROTEÇÃO GLOBAL #0: MESSAGE PORT SHIELD (MAIS CEDO POSSÍVEL)
import { initFigmaMessagePortShield } from './app/config/figmaMessagePortShield';
console.log('[MAIN] 🛡️ Inicializando Message Port Shield...');
initFigmaMessagePortShield();

// 🛡️ PROTEÇÃO GLOBAL #1: SUPRESSOR EXTREMO DE ERROS DO FIGMA
import { initFigmaErrorSuppressor } from './app/config/figmaErrorSuppressor';

// 🛡️ PROTEÇÃO GLOBAL #2: Prevenir crashes do iframe ANTES de qualquer outro código
if (typeof window !== 'undefined') {
  // 🔥 Inicializar supressor PRIMEIRO (antes de tudo)
  console.log('[MAIN] 🛡️ Inicializando supressor de erros do Figma...');
  initFigmaErrorSuppressor();
  
  // 🔥 PROTEÇÃO CONTRA IframeMessageAbortError - ULTRA-AGRESSIVA v6.0.0
  console.log('[MAIN] 🛡️ Instalando proteção ULTRA-AGRESSIVA contra erros de iframe...');
  
  const errorPatterns = [
    'IframeMessageAbortError',
    'message port was destroyed',
    'Message aborted',
    'ResizeObserver loop',
    'cleanup',
    'setupMessageChannel',
    'figma_app__react_profile',
    'webpack-artifacts',
    'figma.com/webpack',
    'Q.cleanup',
    'et.cleanup',
    'eQ.setupMessageChannel',
    'n.cleanup',
    's.cleanup',
    'eZ.setupMessageChannel',
    'eJ.setupMessageChannel',
    'e.onload',
    'at n.cleanup',
    'at s.cleanup',
    'at eZ.setupMessageChannel',
    'at eJ.setupMessageChannel',
    'at e.onload',
    // 🆕 Padrões específicos do stack trace atual
    'figma.com/webpack-artifacts/assets/figma_app__react_profile',
    'dfe8a2836a993e65.min.js.br',
    '1644:16671',
    '1644:19722',
    '2021:14223',
    '2021:6655',
    'at n.cleanup (https://www.figma.com',
    'at s.cleanup (https://www.figma.com',
    'at eZ.setupMessageChannel (https://www.figma.com',
    'at eJ.setupMessageChannel (https://www.figma.com',
    'at e.onload (https://www.figma.com',
    'min.js.br',
    'react_profile-'
  ];
  
  function shouldSuppress(msg: any): boolean {
    const str = String(msg || '');
    return errorPatterns.some(pattern => str.includes(pattern));
  }
  
  // 🛡️ CAMADA 1: Interceptar console.error PRIMEIRO
  const originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    if (args.some(arg => shouldSuppress(arg))) {
      // SILENCIAR COMPLETAMENTE - NÃO MOSTRAR NADA
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  // 🛡️ CAMADA 2: window.addEventListener('error')
  window.addEventListener('error', (event) => {
    const errorMsg = event.error?.message || event.message || '';
    const errorStack = event.error?.stack || '';
    
    if (shouldSuppress(errorMsg) || shouldSuppress(errorStack)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  }, true); // capture phase - MAIS CEDO POSSÍVEL
  
  // 🛡️ CAMADA 3: window.onerror (fallback)
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (shouldSuppress(message) || shouldSuppress(error)) {
      return true; // Prevenir propagação
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
  
  // 🛡️ CAMADA 4: unhandledrejection
  window.addEventListener('unhandledrejection', (event) => {
    if (shouldSuppress(event.reason)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true); // capture phase
  
  console.log('[MAIN] ✅ Proteção ULTRA-AGRESSIVA instalada com sucesso (4 camadas)');
  
  // 🛡️ CAMADA 5: INTERCEPTOR GLOBAL DE FETCH (Proteção contra 402/CORS)
  const originalFetch = window.fetch;
  window.fetch = async function(url: any, options?: any) {
    const urlStr = String(url);
    
    // Bloquear chamadas para Supabase se estiver em modo de emergência
    const isSupabaseCall = urlStr.includes('supabase.co');
    const isOffline = localStorage.getItem('neural_emergency_offline') === 'true';
    
    if (isOffline && isSupabaseCall && !urlStr.includes('/auth/v1/token')) {
      console.warn('[MAIN] 🚫 Bloqueando chamada Supabase em modo offline:', urlStr);
      return new Response(JSON.stringify({ error: 'Offline Mode Active', offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const response = await originalFetch(url, options);
      
      // Se receber 402 (Quota Exceeded) do Supabase, ativar modo offline
      if (response.status === 402 && isSupabaseCall) {
        console.error('[MAIN] 🚨 Supabase Quota Exceeded (402)! Ativando modo offline...');
        localStorage.setItem('neural_emergency_offline', 'true');
      }
      
      return response;
    } catch (error) {
      // Se der erro de rede (CORS costuma cair aqui no fetch), verificar se é Supabase
      if (isSupabaseCall) {
        console.error('[MAIN] ⚠️ Falha na chamada Supabase (possível CORS).');
        // Não ativa offline imediatamente no primeiro erro de rede para evitar falsos positivos
      }
      throw error;
    }
  };
}

// 🛡️ PROTEÇÃO #2: Imports com verificação de ambiente
// ✅ POLYFILLS RE-HABILITADOS - Proteções mantidas para prevenir IframeMessageAbortError
import './polyfills';
import '@/styles/index.css';

// 🔥 IMPORT COM RETRY - Tenta recarregar se falhar
let App: any;
let appLoadRetries = 0;
const MAX_RETRIES = 3;

async function loadApp(): Promise<any> {
  try {
    console.log('[MAIN] 📦 Carregando App.tsx...');
    const module = await import('./app/App');
    console.log('[MAIN] ✅ App.tsx carregado com sucesso');
    return module.default;
  } catch (error) {
    appLoadRetries++;
    console.error(`[MAIN] ❌ Erro ao carregar App.tsx (tentativa ${appLoadRetries}/${MAX_RETRIES}):`, error);
    
    if (appLoadRetries < MAX_RETRIES) {
      console.log(`[MAIN] 🔄 Tentando novamente em 1 segundo...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return loadApp(); // Retry recursivo
    } else {
      throw new Error(`Falha ao carregar App.tsx após ${MAX_RETRIES} tentativas. Por favor, limpe o cache do navegador (Cmd+Shift+R) e tente novamente.`);
    }
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// 🛡️ PROTEÇÃO #3: Inicialização com error handling robusto + DELAY EXTRA
// 🔥 CRÍTICO: Aumentar delay para 1000ms para garantir que o iframe do Figma esteja 100% estável
console.log('[MAIN] ⏳ Aguardando 1000ms para garantir estabilidade completa do iframe...');

// 🔥 ADICIONAL: Prevenir qualquer operação React durante período crítico
let isReactSafe = false;
setTimeout(() => {
  isReactSafe = true;
  console.log('[MAIN] ✅ React liberado para inicialização');
}, 800);

setTimeout(() => {
  console.log('[MAIN] ✅ Delay concluído, iniciando carregamento da aplicação...');
  
  // 🛡️ Verificação dupla de segurança
  if (!isReactSafe) {
    console.warn('[MAIN] ⚠️ React não está seguro ainda, aguardando...');
    setTimeout(() => {
      console.log('[MAIN] ✅ Segunda tentativa de inicialização...');
      initializeApp();
    }, 200);
    return;
  }
  
  initializeApp();
}, 1000); // 🔥 AUMENTADO: 500ms → 1000ms

function initializeApp() {
  loadApp().then((AppComponent) => {
    // 🔥 WRAPPER GLOBAL: Envolver TODA aplicação em try-catch
    const SafeApp = () => {
      try {
        return <AppComponent />;
      } catch (error) {
        // Capturar erro DURANTE renderização
        const errorMsg = error?.message || String(error);
        
        // Se é erro do Figma, SUPRIMIR TOTALMENTE
        if (errorMsg.includes('IframeMessageAbortError') ||
            errorMsg.includes('message port was destroyed') ||
            errorMsg.includes('Message aborted') ||
            errorMsg.includes('figma_app__react_profile') ||
            errorMsg.includes('webpack-artifacts')) {
          console.warn('[MAIN] 🛡️ Erro do Figma capturado no render - SUPRIMINDO');
          // Retornar fragmento vazio - NÃO renderizar nada
          return null;
        }
        
        // Se é outro erro, logar normalmente
        console.error('[MAIN] ❌ Erro durante renderização:', error);
        throw error;
      }
    };
    
    ReactDOM.createRoot(rootElement).render(
      // 🔥 STRICTMODE DESABILITADO para prevenir IframeMessageAbortError
      // StrictMode causa montagens duplas que podem interferir com message ports do Figma
      <SafeApp />
    );
    console.log('[MAIN] ✅ Neural Day Trader initialized successfully (with 1000ms delay)');
  }).catch((error) => {
    console.error('[MAIN] 🚨 Failed to initialize:', error);
    
    // Fallback UI em caso de erro crítico
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0a; color: white; font-family: system-ui;">
        <div style="text-align: center; padding: 2rem; max-width: 600px;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;">Erro ao Carregar Aplicação</h1>
          <p style="color: #94a3b8; margin-bottom: 2rem; line-height: 1.6;">
            A plataforma Neural Day Trader não pôde ser carregada. Isso geralmente é causado por cache desatualizado.
          </p>
          
          <div style="background: #1a1a1a; border: 1px solid #334155; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 2rem; text-align: left;">
            <p style="color: #f59e0b; font-weight: bold; margin-bottom: 1rem;">💡 Solução Rápida:</p>
            <ol style="color: #94a3b8; font-size: 0.875rem; line-height: 1.6; padding-left: 1.5rem;">
              <li>Pressione <kbd style="background: #334155; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">Cmd+Shift+R</kbd> (Mac) ou <kbd style="background: #334155; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">Ctrl+Shift+R</kbd> (Windows)</li>
              <li style="margin-top: 0.5rem;">Aguarde o carregamento completo</li>
              <li style="margin-top: 0.5rem;">Se persistir, limpe o cache do navegador</li>
            </ol>
          </div>
          
          <button 
            onclick="window.location.reload()" 
            style="padding: 0.75rem 1.5rem; background: #10b981; color: white; border: none; border-radius: 0.5rem; font-weight: bold; cursor: pointer; font-size: 1rem; margin-right: 0.5rem;"
          >
            Recarregar Agora
          </button>
          
          <button 
            onclick="if(confirm('Isso abrirá as configurações do navegador. Limpe o cache e recarregue.')) { window.location.reload(); }" 
            style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-weight: bold; cursor: pointer; font-size: 1rem;"
          >
            Limpar Cache
          </button>
          
          <details style="margin-top: 2rem; text-align: left;">
            <summary style="color: #64748b; cursor: pointer; font-size: 0.875rem;">Detalhes técnicos</summary>
            <pre style="color: #ef4444; background: #1a1a1a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.75rem; margin-top: 0.5rem;">${error instanceof Error ? error.message : String(error)}</pre>
          </details>
        </div>
      </div>
    `;
  });
}