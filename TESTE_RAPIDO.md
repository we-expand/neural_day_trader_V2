# 🧪 GUIA DE TESTE - VERSÃO MÁXIMA RESTAURADA

## 🎯 TESTE RÁPIDO (3 MINUTOS)

### 1. Verificar Console
Abra o DevTools (F12) e verifique o console:

✅ **Logs Esperados:**
```
[APP] 🚀 Neural Day Trader Platform v3.2 - FULL VERSION WITH IFRAME PROTECTION
[AUTH] 🚀 AuthProvider montado
[Market Data] 🚀 Context inicializado com segurança
[APP] ✅ Aplicação pronta após delay de segurança
```

❌ **NÃO deve aparecer:**
```
IframeMessageAbortError: Message aborted: message port was destroyed
```

### 2. Testar Landing Page
- ✅ Landing page deve carregar normalmente
- ✅ Botão de login deve aparecer
- ✅ Animações devem funcionar
- ✅ Trocar idioma (PT/EN/ES) deve funcionar

### 3. Fazer Login
1. Clicar em "Entrar" ou "Login"
2. Usar email de teste: `trader@neural.com`
3. Dashboard deve carregar

✅ **Resultado esperado:**
- Sidebar aparece à esquerda
- Header no topo
- Dashboard com gráficos carrega
- MarketTicker animado no rodapé

### 4. Navegar Entre Módulos
Clicar em cada item do sidebar e verificar se carrega:

- ✅ **Dashboard**: Gráficos e estatísticas
- ✅ **Gráficos**: Chart view completa
- ✅ **Fundos**: Wallet/carteira
- ✅ **AI Trader**: Módulo de trading automático
- ✅ **Inovação**: Liquidity Prediction (IA Preditiva)
- ✅ **Performance**: Métricas e análises
- ✅ **Loja**: Marketplace
- ✅ **Parceiros**: Partners
- ✅ **Configurações**: Settings
- ✅ **Sistema**: System info

### 5. Testar Debug Tools
- ✅ Abrir DebugToolbar (canto inferior direito ou hotkey)
- ✅ Testar SystemHealthCheck: `Ctrl+Shift+H`
- ✅ Verificar status de todos os sistemas

---

## 🏥 SYSTEM HEALTH CHECK

### Como usar:
1. Pressione `Ctrl+Shift+H` ou clique no ícone inferior esquerdo
2. Painel de health check abre
3. Verificar status de cada sistema:

✅ **Todos devem estar OK (verde):**
- Auth Context
- Market Data Context
- Session Storage
- Browser Environment
- Console Errors

### Se algo estiver vermelho (erro):
- Clicar em "Refresh" para recarregar checks
- Se persistir, clicar em "Reload App"
- Verificar console para mais detalhes

---

## 🔍 TESTES AVANÇADOS

### Teste de Hot Reload
1. Abrir qualquer arquivo `.tsx`
2. Fazer uma alteração simples (adicionar espaço, comentário)
3. Salvar
4. Aguardar hot reload (2-3 segundos)
5. ✅ Aplicação deve recarregar SEM erro de iframe

### Teste de Navegação Rápida
1. Clicar rapidamente entre diferentes módulos
2. Dashboard → Gráficos → AI Trader → Dashboard
3. ✅ Deve navegar sem travamentos ou erros

### Teste de Contexts
Abrir console e executar:
```javascript
// Verificar se contexts estão disponíveis
console.log('Auth Context:', window.__AUTH_CONTEXT__)
console.log('Market Data:', window.__MARKET_DATA__)
```

---

## 🐛 TROUBLESHOOTING

### Se aparecer erro de iframe:
1. ✅ Verificar se todos os delays estão ativos (App.tsx, AuthContext, MarketDataContext)
2. ✅ Aumentar delays (100ms → 200ms, 150ms → 300ms)
3. ✅ Desabilitar auto-refresh no MarketDataContext (já está desabilitado)
4. ✅ Verificar se StrictMode está desabilitado (main.tsx)

### Se algum módulo não carregar:
1. ✅ Verificar console para erros específicos
2. ✅ Tentar recarregar página (F5)
3. ✅ Limpar cache do browser (Ctrl+Shift+Delete)
4. ✅ Verificar se todos os imports estão corretos

### Se login não funcionar:
1. ✅ Verificar sessionStorage (DevTools → Application → Session Storage)
2. ✅ Procurar por chave `apex_mock_user`
3. ✅ Verificar console para logs de [AUTH]

---

## ✅ CHECKLIST FINAL

Antes de considerar que tudo está funcionando:

- [ ] Sem "IframeMessageAbortError" no console
- [ ] Landing page carrega normalmente
- [ ] Login funciona (mock ou real)
- [ ] Dashboard carrega com todos os componentes
- [ ] Navegação entre módulos funciona
- [ ] Sidebar e Header aparecem corretamente
- [ ] MarketTicker animado no rodapé
- [ ] Neural Assistant (Luna) abre/fecha
- [ ] Debug tools funcionam
- [ ] SystemHealthCheck mostra tudo OK
- [ ] Hot reload funciona sem erros

---

## 🎉 PRÓXIMOS PASSOS

### Se tudo estiver funcionando:
1. Testar com dados reais do MT5
2. Conectar Supabase real
3. Testar AI Trader Voice
4. Ativar auto-refresh do MarketData (opcional)

### Otimizações futuras:
- Reduzir delays gradualmente (testar estabilidade)
- Implementar lazy loading para módulos pesados
- Adicionar mais error boundaries específicos
- Implementar retry logic para conexões

---

**Versão**: 3.2
**Status**: ✅ Pronto para teste completo
**Documentação**: `/IFRAME_FIX_COMPLETE.md`
