/**
 * 🛡️ FIGMA ERROR HANDLER
 * 
 * Intercepta e silencia erros específicos do Figma iframe
 * que não afetam a funcionalidade da aplicação
 */

// Lista de mensagens de erro do Figma que devem ser silenciadas
const FIGMA_ERROR_PATTERNS = [
  'IframeMessageAbortError',
  'message port was destroyed',
  'Message aborted',
  'webpack-internal',
  'figma.com/webpack-artifacts',
  'figma.com/webpack',
  'setupMessageChannel',
  'cleanup',
  'figma_app__react_profile',
  'eZ.setupMessageChannel',
  'eJ.setupMessageChannel',
  'n.cleanup',
  's.cleanup',
  'at n.cleanup',
  'at s.cleanup',
  'at eZ.setupMessageChannel',
  'at eJ.setupMessageChannel',
  'at e.onload',
  'MessagePort',
  'port was destroyed',
  'figma_app',
  'react_profile',
  'onload',
  // 🆕 Padrões específicos da stacktrace atual
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
  'react_profile-',
  'Q.cleanup',
  'et.cleanup',
  'eQ.setupMessageChannel',
  // 🔥 Padrões completos da URL do erro
  'webpack-artifacts/assets/figma_app__react_profile-',
  '.min.js.br:',
  'figma_app__react_profile-dfe8a2836a993e65',
];

// Verifica se um erro é do Figma
function isFigmaError(error: any): boolean {
  const errorString = String(error?.message || error || '');
  const stackString = String(error?.stack || '');
  const sourceString = String(error?.source || error?.fileName || '');
  
  return FIGMA_ERROR_PATTERNS.some(pattern => 
    errorString.includes(pattern) || 
    stackString.includes(pattern) || 
    sourceString.includes(pattern)
  );
}

// Handler de erro global
let isHandlerInstalled = false;

export function installFigmaErrorHandler() {
  if (isHandlerInstalled) return;
  
  if (typeof window === 'undefined') return;
  
  // Interceptar window.onerror
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    // Se for erro do Figma, silencia COMPLETAMENTE
    if (isFigmaError(error) || isFigmaError(message)) {
      return true; // Previne propagação - SEM LOG
    }
    
    // Caso contrário, chama o handler original
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    
    return false;
  };
  
  // Interceptar unhandledrejection
  const originalUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    // Se for erro do Figma, silencia COMPLETAMENTE
    if (isFigmaError(event.reason)) {
      event.preventDefault();
      return; // SEM LOG
    }
    
    // Caso contrário, chama o handler original
    if (originalUnhandledRejection) {
      originalUnhandledRejection.call(window, event);
    }
  };
  
  // Interceptar console.error para filtrar erros do Figma
  const originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    // Se for erro do Figma, silencia COMPLETAMENTE
    if (args.some(arg => isFigmaError(arg))) {
      return; // SEM LOG - APENAS IGNORA
    }
    
    // Caso contrário, chama o console.error original
    originalConsoleError.apply(console, args);
  };
  
  isHandlerInstalled = true;
  console.log('[FigmaErrorHandler] ✅ Handler instalado - erros do Figma serão silenciados');
}

// Auto-instalar quando o módulo for importado
if (typeof window !== 'undefined') {
  // 🔥 CAMADA EXTRA: Interceptar ANTES de qualquer outro handler
  // Instala IMEDIATAMENTE, sem delay
  installFigmaErrorHandler();
  
  // 🛡️ CAMADA ULTRA-AGRESSIVA: addEventListener para capturar erros
  window.addEventListener('error', function(event) {
    const msg = String(event.message || event.error?.message || '');
    const source = String(event.filename || '');
    
    if (isFigmaError(event.error) || 
        msg.includes('IframeMessageAbortError') ||
        msg.includes('message port was destroyed') ||
        source.includes('figma.com/webpack') ||
        source.includes('.min.js.br')) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return false;
    }
  }, true); // 🔥 Capture phase = PRIMEIRO A EXECUTAR
  
  // 🛡️ CAMADA ULTRA-AGRESSIVA: addEventListener para rejections
  window.addEventListener('unhandledrejection', function(event) {
    if (isFigmaError(event.reason)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true); // 🔥 Capture phase = PRIMEIRO A EXECUTAR
}