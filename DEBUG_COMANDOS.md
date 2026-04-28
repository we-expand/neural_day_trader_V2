# 🛠️ COMANDOS ÚTEIS PARA DEBUG

## 🎹 ATALHOS DE TECLADO

| Atalho | Ação |
|--------|------|
| `Ctrl+Shift+H` | Abrir/Fechar SystemHealthCheck |
| `F12` | Abrir DevTools |
| `Ctrl+Shift+I` | Abrir DevTools |
| `Ctrl+Shift+J` | Console (Chrome) |
| `Ctrl+Shift+Delete` | Limpar cache |
| `F5` | Recarregar página |
| `Ctrl+F5` | Hard reload (ignora cache) |
| `Ctrl+Shift+R` | Hard reload (Firefox) |

---

## 💻 COMANDOS DO CONSOLE

### Verificar Status dos Contexts

```javascript
// Auth Context
console.log('Auth User:', sessionStorage.getItem('apex_mock_user'));

// Market Data Context
console.log('Prices:', window.__MARKET_DATA_PRICES__);

// Verificar se React está montado
console.log('React Root:', document.getElementById('root'));
```

### Forçar Reload Limpo

```javascript
// Limpar sessionStorage e recarregar
sessionStorage.clear();
localStorage.clear();
window.location.reload();
```

### Simular Login

```javascript
// Mock login rápido
const mockUser = {
  id: 'mock-user-123',
  email: 'trader@neural.com',
  user_metadata: { name: 'Trader Neural' }
};
sessionStorage.setItem('apex_mock_user', JSON.stringify(mockUser));
window.location.reload();
```

### Verificar Erros de Iframe

```javascript
// Monitorar erros em tempo real
window.addEventListener('error', (e) => {
  if (e.message.includes('iframe')) {
    console.error('🚨 IFRAME ERROR:', e.message);
  }
});
```

### Debug de Timing

```javascript
// Verificar quanto tempo leva para carregar
console.time('App Init');
// ... após app carregar
console.timeEnd('App Init');
```

---

## 🔍 INSPECIONAR ELEMENTOS

### Verificar se Componentes Estão Montados

```javascript
// Verificar se sidebar existe
console.log('Sidebar:', document.querySelector('[class*="sidebar"]'));

// Verificar se header existe
console.log('Header:', document.querySelector('header'));

// Verificar quantos módulos estão carregados
console.log('Modules:', document.querySelectorAll('[class*="module"]').length);
```

### Verificar Performance

```javascript
// Performance de renderização
console.log('Performance:', performance.getEntriesByType('navigation'));

// Timing de recursos
console.log('Resources:', performance.getEntriesByType('resource'));
```

---

## 📊 MONITORAMENTO AVANÇADO

### Capturar Todos os Logs de [APP]

```javascript
// Override console.log para capturar tudo
const logs = [];
const originalLog = console.log;
console.log = function(...args) {
  if (args[0] && args[0].includes('[APP]')) {
    logs.push(args);
  }
  originalLog.apply(console, args);
};

// Ver logs capturados
setTimeout(() => {
  console.table(logs);
}, 5000);
```

### Monitorar Mudanças de State

```javascript
// React DevTools - verificar re-renders
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('React DevTools:', 'Instalado');
} else {
  console.warn('React DevTools:', 'Não instalado');
}
```

---

## 🧪 TESTES DE ESTRESSE

### Teste de Navegação Rápida

```javascript
// Simular clicks rápidos no sidebar
const sidebarItems = document.querySelectorAll('[class*="sidebar"] button');
let i = 0;
const interval = setInterval(() => {
  if (sidebarItems[i]) {
    sidebarItems[i].click();
    i = (i + 1) % sidebarItems.length;
  } else {
    clearInterval(interval);
  }
}, 500); // Mudar de módulo a cada 500ms

// Parar após 10 segundos
setTimeout(() => clearInterval(interval), 10000);
```

### Teste de Memory Leak

```javascript
// Verificar uso de memória
if (performance.memory) {
  console.log('Memory:', {
    used: `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
    total: `${(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
    limit: `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
  });
}
```

---

## 🔧 CONFIGURAÇÕES DO BROWSER

### Chrome DevTools Settings

1. `F12` → Settings (⚙️)
2. Preferências recomendadas:
   - ✅ Disable cache (while DevTools is open)
   - ✅ Enable custom formatters
   - ✅ Show timestamps in console
   - ✅ Preserve log upon navigation

### Network Throttling (Testar em Conexão Lenta)

1. `F12` → Network tab
2. Throttling: "Slow 3G"
3. Recarregar página
4. Verificar se delays são suficientes

---

## 📱 TESTE EM DIFERENTES AMBIENTES

### Desktop Browsers

```bash
# Chrome
open -a "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome"

# Firefox
firefox -new-instance -profile /tmp/firefox

# Edge
start msedge --disable-web-security
```

### Mobile Simulation

1. `F12` → Device Mode (Ctrl+Shift+M)
2. Testar em:
   - iPhone 12 Pro
   - iPad Pro
   - Galaxy S21
   - Custom (responsivo)

---

## 🚨 TROUBLESHOOTING RÁPIDO

### Erro Persiste?

```javascript
// 1. Verificar delays
console.log('Main delay: 100ms (main.tsx)');
console.log('App delay: 150ms (App.tsx)');
console.log('Auth delay: 100ms (AuthContext)');
console.log('Market delay: 120ms (MarketDataContext)');

// 2. Aumentar delays se necessário
// Editar arquivos e aumentar valores

// 3. Desabilitar módulos pesados
// Comentar imports de módulos que não usa
```

### Hot Reload Quebrando?

```javascript
// Desabilitar hot reload temporariamente
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('Hot reload disabled for debugging');
  });
}
```

### Context Não Inicializando?

```javascript
// Verificar ordem de Providers
const providers = [
  'ErrorBoundary',
  'AuthProvider',
  'MarketProvider',
  'ApexTradingProvider',
  'MarketDataProvider',
  'AssistantProvider',
  'DebugProvider'
];
console.log('Provider order:', providers);
```

---

## 📋 CHECKLIST DE DEBUG

Quando algo não funcionar:

- [ ] Console limpo (sem erros)
- [ ] SessionStorage tem `apex_mock_user`
- [ ] Network tab sem falhas 404/500
- [ ] React DevTools mostra components montados
- [ ] SystemHealthCheck mostra tudo OK
- [ ] Delays estão ativos (verificar logs)
- [ ] StrictMode desabilitado (main.tsx)
- [ ] Cache limpo (Ctrl+Shift+Delete)

---

## 🎯 LOGS ESPERADOS (ORDEM CORRETA)

```
1. [MAIN] ✅ Neural Day Trader initialized successfully (with 100ms delay)
2. [APP] 🚀 Neural Day Trader Platform v3.2 - FULL VERSION WITH IFRAME PROTECTION
3. [AUTH] 🚀 AuthProvider montado
4. [AUTH] 🔍 Verificando sessionStorage
5. [Market Data] 🚀 Context inicializado com segurança
6. [APP] ✅ Aplicação pronta após delay de segurança
7. [AUTH] ✅ Recuperando user do sessionStorage (se logado)
8. [APP] 🚀 Starting Supabase price sync service... (se logado)
```

Se logs aparecerem nesta ordem, **está tudo funcionando perfeitamente!**

---

## 💡 DICAS PRO

1. **Use React DevTools**: Extensão essencial para debug
2. **Console Groups**: Use `console.group()` para organizar logs
3. **Performance Tab**: Verifique gargalos de renderização
4. **Network Tab**: Monitore requests e timing
5. **Memory Profiler**: Detecte memory leaks

---

**Última atualização**: 2026-03-01
**Versão**: 3.2
**Status**: ✅ Testado e Validado
