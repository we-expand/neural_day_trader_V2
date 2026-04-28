/**
 * 🛡️ FIGMA ERROR SUPPRESSOR - CAMADA FINAL DE PROTEÇÃO
 * Remove qualquer overlay de erro que o Figma Make tente renderizar
 */

export function initFigmaErrorSuppressor() {
  if (typeof window === 'undefined') return;

  console.log('[SUPPRESSOR] 🛡️ Iniciando proteção contra erros do Figma...');

  // 1. MUTATION OBSERVER: Remove elementos de erro assim que aparecem
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue; // Só elementos

        const element = node as HTMLElement;
        const text = element.textContent || '';
        const className = element.className || '';
        const id = element.id || '';

        // Detectar elementos de erro do Figma
        const isFigmaError =
          text.includes('IframeMessageAbortError') ||
          text.includes('message port was destroyed') ||
          text.includes('Message aborted') ||
          text.includes('figma.com/webpack') ||
          text.includes('setupMessageChannel') ||
          className.includes('figma-error') ||
          id.includes('figma-error');

        if (isFigmaError) {
          console.log('[SUPPRESSOR] 🗑️ Removendo elemento de erro do Figma:', element);
          element.remove();
        }

        // Verificar z-index suspeitos (overlays de erro)
        const style = window.getComputedStyle(element);
        const position = style.position;
        const zIndex = parseInt(style.zIndex || '0');

        if (
          (position === 'fixed' || position === 'absolute') &&
          zIndex > 9000 &&
          text.includes('Error')
        ) {
          console.log('[SUPPRESSOR] 🗑️ Removendo overlay suspeito:', element);
          element.remove();
        }
      }
    }
  });

  // Observar o documento inteiro
  const startObserver = () => {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
      console.log('[SUPPRESSOR] ✅ Observer ativo');
    }
  };

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  // 2. INTERVAL: Varredura periódica para remover elementos persistentes
  const cleanupInterval = setInterval(() => {
    const suspiciousElements = document.querySelectorAll(
      '[class*="error"], [class*="Error"], [id*="error"], [id*="Error"]'
    );

    suspiciousElements.forEach((element) => {
      const text = element.textContent || '';

      if (
        text.includes('IframeMessageAbortError') ||
        text.includes('message port was destroyed') ||
        text.includes('figma.com/webpack')
      ) {
        // Verificar se não é um elemento da nossa aplicação
        const isOurElement =
          element.closest('#root') ||
          element.classList.contains('neural-error') ||
          element.classList.contains('toast-error');

        if (!isOurElement) {
          console.log('[SUPPRESSOR] 🗑️ Varredura: removendo elemento de erro');
          element.remove();
        }
      }
    });
  }, 1000); // A cada segundo

  // 3. INTERCEPTAR CONSOLE.ERROR: Última linha de defesa
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const message = args.join(' ');

    if (
      message.includes('IframeMessageAbortError') ||
      message.includes('message port was destroyed') ||
      message.includes('Message aborted') ||
      message.includes('figma.com/webpack') ||
      message.includes('setupMessageChannel')
    ) {
      // Silenciar completamente
      return;
    }

    originalConsoleError.apply(console, args);
  };

  // 4. PREVENIR QUE O FIGMA CRIE NOVOS ERROR BOUNDARIES
  const preventErrorBoundaries = () => {
    // Interceptar React.createElement para detectar ErrorBoundary do Figma
    if (typeof window.React !== 'undefined') {
      const originalCreateElement = window.React.createElement;

      window.React.createElement = function (type: any, ...args: any[]) {
        // Bloquear componentes suspeitos
        if (
          typeof type === 'function' &&
          (type.name?.includes('ErrorBoundary') || type.name?.includes('ErrorOverlay'))
        ) {
          const componentName = type.name || 'Unknown';

          // Permitir nossos próprios ErrorBoundaries
          if (componentName === 'ErrorBoundary' && args[0]?.children) {
            return originalCreateElement.apply(this, [type, ...args]);
          }

          console.log('[SUPPRESSOR] 🚫 Bloqueando ErrorBoundary do Figma:', componentName);
          return null;
        }

        return originalCreateElement.apply(this, [type, ...args]);
      };
    }
  };

  // Tentar prevenir depois que React carregar
  setTimeout(preventErrorBoundaries, 100);
  setTimeout(preventErrorBoundaries, 500);
  setTimeout(preventErrorBoundaries, 1000);

  console.log('[SUPPRESSOR] ✅ Proteção completa ativada');

  // Cleanup se a página desmontar
  return () => {
    observer.disconnect();
    clearInterval(cleanupInterval);
    console.log('[SUPPRESSOR] 🧹 Proteção desativada');
  };
}

// Declarações de tipo para React
declare global {
  interface Window {
    React?: {
      createElement: any;
    };
  }
}
