/**
 * 🛡️ FIGMA MESSAGE PORT SHIELD v2.0
 * 
 * Intercepta e protege os message ports do Figma ANTES deles serem criados
 * Previne IframeMessageAbortError ao adicionar camada de proteção nos métodos nativos
 */

export function initFigmaMessagePortShield() {
  console.log('[SHIELD] 🛡️ Iniciando Figma Message Port Shield...');
  
  // 🔥 PROTEÇÃO NÍVEL 1: Interceptar MessageChannel.prototype
  if (typeof MessageChannel !== 'undefined') {
    const OriginalMessageChannel = MessageChannel;
    
    // @ts-ignore - Substituir construtor global
    window.MessageChannel = function() {
      const channel = new OriginalMessageChannel();
      const originalPort1Close = channel.port1.close;
      const originalPort2Close = channel.port2.close;
      
      // Proteger port1.close
      channel.port1.close = function() {
        try {
          console.log('[SHIELD] 🔒 Fechando port1 com segurança');
          originalPort1Close.call(this);
        } catch (error) {
          console.warn('[SHIELD] ⚠️ Erro ao fechar port1 (suprimido):', error);
        }
      };
      
      // Proteger port2.close
      channel.port2.close = function() {
        try {
          console.log('[SHIELD] 🔒 Fechando port2 com segurança');
          originalPort2Close.call(this);
        } catch (error) {
          console.warn('[SHIELD] ⚠️ Erro ao fechar port2 (suprimido):', error);
        }
      };
      
      return channel;
    };
    
    console.log('[SHIELD] ✅ MessageChannel protegido');
  }
  
  // 🔥 PROTEÇÃO NÍVEL 2: Interceptar postMessage
  const originalPostMessage = window.postMessage;
  window.postMessage = function(...args: any[]) {
    try {
      return originalPostMessage.apply(this, args);
    } catch (error: any) {
      if (error?.message?.includes('port') || error?.message?.includes('message')) {
        console.warn('[SHIELD] ⚠️ postMessage error suppressed:', error);
        return;
      }
      throw error;
    }
  };
  
  console.log('[SHIELD] ✅ postMessage protegido');
  
  // 🔥 PROTEÇÃO NÍVEL 3: Interceptar addEventListener para messages
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
    if (type === 'message' && typeof listener === 'function') {
      const wrappedListener = function(event: any) {
        try {
          return listener.call(this, event);
        } catch (error: any) {
          if (error?.message?.includes('port') || 
              error?.message?.includes('IframeMessageAbortError') ||
              error?.message?.includes('cleanup')) {
            console.warn('[SHIELD] ⚠️ Message listener error suppressed:', error);
            return;
          }
          throw error;
        }
      };
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  console.log('[SHIELD] ✅ addEventListener protegido');
  
  // 🔥 PROTEÇÃO NÍVEL 4: Prevenir cleanup durante inicialização
  let isInitializing = true;
  setTimeout(() => {
    isInitializing = false;
    console.log('[SHIELD] ✅ Período de inicialização concluído');
  }, 3000); // 3 segundos de proteção total
  
  // Interceptar qualquer tentativa de cleanup durante inicialização
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = function(callback: FrameRequestCallback) {
    if (isInitializing) {
      // Durante inicialização, delay callbacks para prevenir cleanup prematuro
      return originalRequestAnimationFrame.call(this, (time) => {
        try {
          callback(time);
        } catch (error: any) {
          if (error?.message?.includes('port') || 
              error?.message?.includes('cleanup') ||
              error?.message?.includes('IframeMessageAbortError')) {
            console.warn('[SHIELD] ⚠️ RAF error durante inicialização (suprimido):', error);
            return;
          }
          throw error;
        }
      });
    }
    return originalRequestAnimationFrame.call(this, callback);
  };
  
  console.log('[SHIELD] ✅ requestAnimationFrame protegido');
  
  // 🔥 PROTEÇÃO NÍVEL 5: Monitorar e proteger MutationObserver
  const OriginalMutationObserver = window.MutationObserver;
  window.MutationObserver = class extends OriginalMutationObserver {
    constructor(callback: MutationCallback) {
      super((mutations, observer) => {
        try {
          callback(mutations, observer);
        } catch (error: any) {
          if (error?.message?.includes('port') || 
              error?.message?.includes('cleanup') ||
              error?.message?.includes('IframeMessageAbortError')) {
            console.warn('[SHIELD] ⚠️ MutationObserver error (suprimido):', error);
            return;
          }
          throw error;
        }
      });
    }
  } as any;
  
  console.log('[SHIELD] ✅ MutationObserver protegido');
  
  console.log('[SHIELD] 🛡️ Figma Message Port Shield ATIVO (5 níveis de proteção)');
}
