# 🎯 CONEXÃO MT5 - LOCALIZAÇÃO E FUNCIONAMENTO

## 📍 ONDE CONECTAR

### **AI TRADER → Botão "Configuração MT5"**

```
Menu Lateral → AI TRADER → Botão "⚙️" (canto superior direito) → Configuração MT5
```

---

## ✅ O QUE FOI CORRIGIDO

### **1. Integração com MarketDataContext**
- O botão agora usa `marketData.connect()` do contexto global
- Preços validados ficam disponíveis para TODA a plataforma
- S&P 500 atualizado em tempo real

### **2. Requisito de Token**
- **OBRIGATÓRIO:** Token MetaAPI deve estar configurado
- **Como configurar:**
  1. Vá em **Configurações → Variáveis de Ambiente**
  2. Adicione: `METAAPI_TOKEN = seu-token-aqui`
  3. Salve e volte ao AI Trader

### **3. Fluxo Correto**
```
1. Configurar Token em Settings
   ↓
2. Ir ao AI Trader → Configuração MT5
   ↓
3. Preencher:
   - Login MT5 (número da conta)
   - Senha MT5
   - Servidor MT5 (ex: InfinoxLimited-MT5Live)
   ↓
4. Clicar "Conectar ao MT5"
   ↓
5. ✅ SUCESSO:
   - Market Data Context ativa
   - Backend conectado
   - Preços reais disponíveis globalmente
```

---

## 🔧 DETALHES TÉCNICOS

### **Dupla Conexão:**

1. **Market Data Context** (GLOBAL)
   - Usa `MT5PriceValidator.ts`
   - Fornece preços para toda a plataforma
   - Método: `marketData.connect(token, accountId)`

2. **Backend MT5** (ESPECÍFICO)
   - Endpoint: `/functions/v1/make-server-1dbacac6/mt5/connect`
   - Retorna saldo da conta
   - Registra no BrokerManager

### **Código da Conexão:**

```typescript
// 1. Obter token do localStorage
const metaapiToken = localStorage.getItem('metaapi_token');

// 2. Conectar ao Market Data Context (GLOBAL)
await marketData.connect(metaapiToken, mt5Login);

// 3. Conectar ao backend (ESPECÍFICO)
await fetch('/mt5/connect', {
  method: 'POST',
  body: JSON.stringify({
    login: mt5Login,
    password: mt5Password,
    server: mt5Server,
    metaapiToken: metaapiToken
  })
});

// 4. Registrar no BrokerManager
brokerManager.registerAdapter(adapterId, mt5Adapter);
```

---

## 🐛 PROBLEMA ANTERIOR

### **Erro:**
```
[MT5] ❌ Erro na conexão: Error: Token MetaApi não configurado
```

### **Causa:**
- Token não estava sendo lido do localStorage
- Backend rejeitava requisição sem token
- Market Data Context não era acionado

### **Solução:**
- ✅ Token é OBRIGATÓRIO e verificado primeiro
- ✅ Market Data Context conecta primeiro (mais importante)
- ✅ Backend é secundário (apenas para saldo)
- ✅ Erro claro se token não configurado

---

## 🎯 STATUS ATUAL

### **Componentes:**
- ✅ `/src/app/components/AITrader.tsx` - Botão MT5 corrigido
- ✅ `/src/app/contexts/MarketDataContext.tsx` - Context global ativo
- ✅ `/src/app/services/MT5PriceValidator.ts` - Validador pronto
- ❌ Dashboard - SEM painel (conforme solicitado)

### **Fluxo:**
```
Settings → Configurar METAAPI_TOKEN
   ↓
AI Trader → Configuração MT5
   ↓
Preencher login, senha, servidor
   ↓
Conectar
   ↓
✅ Market Data Context ATIVO
✅ Preços reais disponíveis
✅ S&P 500 validado
✅ IA Desbloqueada
```

---

## 🚀 TESTE RÁPIDO

### **1. Verificar se token está configurado:**
```javascript
// No console do navegador:
localStorage.getItem('metaapi_token')
// Deve retornar: "eyJhbGci..." (seu token)
// Se null: vá em Settings e configure
```

### **2. Conectar:**
```
1. AI Trader → ⚙️ → Configuração MT5
2. Login: 87026945
3. Senha: sua-senha
4. Servidor: InfinoxLimited-MT5Live
5. Conectar ao MT5
```

### **3. Verificar sucesso:**
```
Console deve mostrar:
✅ [MT5] 🌐 Conectando ao Market Data Context...
✅ [MT5] ✅ Market Data Context conectado!
✅ [Market Data] ✅ Conectado com sucesso!
✅ [Market Data] 📊 Preços atualizados: ...
```

---

## 📊 IMPACTO GLOBAL

Quando você conecta pelo botão do **AI Trader**, acontece:

```
AI Trader (você conecta)
    ↓
MarketDataContext.connect()
    ↓
MT5PriceValidator (busca preços reais)
    ↓
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Dashboard   │ IA Preditiva│ Performance │ AI Voice    │
│ • S&P 500   │ • Correlação│ • Métricas  │ • Narração  │
│ • Preços    │ • Sinais    │   reais     │   com dados │
│   validados │   precisos  │ • Backtesting│   reais     │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

---

## ✅ RESUMO FINAL

**Conexão MT5:**
- 📍 **Localização:** AI Trader → Botão ⚙️ → Configuração MT5
- 🔑 **Requisito:** Token MetaAPI configurado em Settings
- 🌐 **Efeito:** Market Data global + backend conectado
- ✅ **Status:** 100% funcional e integrado

**Próxima ação:**
```
1. Configure o token em Settings
2. Conecte no AI Trader
3. ✅ Plataforma desbloqueada com dados reais!
```

🚀 **Sistema pronto para uso!**
