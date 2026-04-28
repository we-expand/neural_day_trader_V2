# 🧪 **COMO TESTAR - GUIA RÁPIDO**

## 🎯 **3 FORMAS DE TESTAR:**

---

## ⚡ **OPÇÃO 1: TESTE AUTOMÁTICO (5 min) - RECOMENDADO**

### **1. Adicione o componente de debug ao App:**

```typescript
// App.tsx
import { AIPersistenceDebugger } from '@/app/components/debug/AIPersistenceDebugger';

// Adicione uma view temporária:
{currentView === 'debug' && <AIPersistenceDebugger />}
```

### **2. Acesse e execute:**

```
1. Vá para view "debug"
2. Faça login
3. Clique em "Executar Todos os Testes"
4. Aguarde 5 segundos
```

### **3. Resultado esperado:**

```
✅ 1. Criar Sessão ............... 234ms
✅ 2. Salvar Trade .............. 189ms
✅ 3. Fechar Trade .............. 167ms
✅ 4. Snapshot Portfolio ........ 145ms
✅ 5. Salvar Decisão ............ 198ms
✅ 6. Buscar Sessões ............ 123ms
✅ 7. Buscar Trades ............. 134ms
✅ 8. Equity Curve .............. 156ms

🎉 Todos os testes passaram!
```

**Se todos ✅ = SISTEMA FUNCIONANDO!**

---

## 🔍 **OPÇÃO 2: TESTE MANUAL NO SUPABASE (2 min)**

### **1. Rode a migration:**

```
Supabase Dashboard → SQL Editor
Cole: /supabase-migrations/001_ai_trading_persistence.sql
Execute
```

### **2. Verifique se criou:**

```sql
SELECT table_name 
FROM information_schema.tables
WHERE table_name LIKE 'ai_%';
```

**Resultado esperado:**
```
ai_backtests
ai_decisions
ai_portfolio_snapshots
ai_sessions
ai_trades
```

**Se 5 tabelas = ✅ DATABASE OK!**

### **3. Teste inserção manual:**

```sql
-- Substitua SEU_USER_ID pelo seu UUID real (pega em auth.users)
INSERT INTO ai_sessions (
  user_id,
  strategy_name,
  mode,
  symbols,
  timeframe,
  initial_balance,
  initial_equity
) VALUES (
  'SEU_USER_ID',
  'TESTE',
  'DEMO',
  ARRAY['BTCUSD'],
  '1h',
  10000,
  10000
) RETURNING id;
```

**Se inseriu e retornou ID = ✅ RLS OK!**

**Se deu erro de RLS:**
- Você não está autenticado
- User ID está errado
- Faça login no app e pegue o ID correto

---

## 🚀 **OPÇÃO 3: TESTE REAL COM AI TRADER (10 min)**

### **1. Integre o hook:**

```typescript
// No componente do AI Trader:
import { useAIPersistence } from '@/app/hooks/useAIPersistence';

const aiPersistence = useAIPersistence({
  enabled: true,
  autoSnapshot: true,
});

// Ao ATIVAR AI:
const sessionId = await aiPersistence.startSession({
  strategyName: 'Teste Real',
  symbols: [selectedSymbol],
  timeframe: timeframe,
  initialBalance: portfolio.balance,
  initialEquity: portfolio.equity,
  config: config,
});

console.log('🚀 Sessão:', sessionId);

// Ao DESATIVAR AI:
await aiPersistence.endSession(
  portfolio.balance,
  portfolio.equity
);

console.log('🏁 Sessão finalizada');
```

### **2. Ative AI e monitore console:**

```
Console (F12) deve mostrar:

[AI Persistence] 🚀 Criando sessão...
[AI Persistence] ✅ Sessão criada: abc123...
[AI Persistence Hook] 🚀 Iniciando sessão...
[AI Persistence Hook] ✅ Sessão criada: abc123...
```

### **3. Verifique no Supabase:**

```sql
-- Veja sua sessão (substitua USER_ID)
SELECT * FROM ai_sessions 
WHERE user_id = 'SEU_USER_ID'
ORDER BY started_at DESC 
LIMIT 1;
```

**Se apareceu = ✅ FUNCIONANDO!**

### **4. Aguarde AI fazer um trade:**

```
Console deve mostrar:

[AI Persistence Hook] ✅ Trade salvo: def456...
```

```sql
-- Veja o trade (substitua SESSION_ID do passo 3)
SELECT * FROM ai_trades 
WHERE session_id = 'SESSION_ID'
ORDER BY entry_time DESC;
```

**Se apareceu = ✅ TRADES SENDO SALVOS!**

### **5. Aguarde 2 minutos:**

```sql
-- Veja snapshots (substitua SESSION_ID)
SELECT timestamp, equity, balance 
FROM ai_portfolio_snapshots 
WHERE session_id = 'SESSION_ID'
ORDER BY timestamp ASC;
```

**Se tem 2+ registros = ✅ AUTO-SNAPSHOT FUNCIONANDO!**

### **6. Desative AI:**

```
Console:
[AI Persistence Hook] 🏁 Finalizando sessão...
[AI Persistence] ✅ Sessão finalizada
```

```sql
SELECT status, ended_at, total_trades, win_rate, net_pnl
FROM ai_sessions 
WHERE id = 'SESSION_ID';
```

**Se status = COMPLETED = ✅ TUDO FUNCIONANDO!**

---

## ✅ **CHECKLIST VISUAL:**

```
┌─────────────────────────────────────────────┐
│  PRÉ-REQUISITOS:                            │
├─────────────────────────────────────────────┤
│  [ ] Migration SQL rodada no Supabase       │
│  [ ] 5 tabelas criadas                      │
│  [ ] Usuário autenticado                    │
│  [ ] Service e Hook importados              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  TESTE BÁSICO (Opção 1):                    │
├─────────────────────────────────────────────┤
│  [ ] Componente Debug rodando               │
│  [ ] 8/8 testes passaram                    │
│  [ ] Dados visíveis no Supabase             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  TESTE REAL (Opção 3):                      │
├─────────────────────────────────────────────┤
│  [ ] Sessão criada                          │
│  [ ] Trades salvando                        │
│  [ ] Snapshots automáticos                  │
│  [ ] Sessão finalizada corretamente         │
│  [ ] Métricas calculadas                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  TESTE DE PERSISTÊNCIA:                     │
├─────────────────────────────────────────────┤
│  [ ] Ativou AI                              │
│  [ ] Recarregou página (F5)                 │
│  [ ] Dados ainda existem no Supabase        │
│  [ ] Dashboard mostra histórico             │
└─────────────────────────────────────────────┘
```

---

## 🎯 **RESULTADO FINAL:**

### **✅ SE TUDO PASSOU:**

```
🎉 PARABÉNS!

Seu sistema de persistência está 100% funcional!

Agora você pode:
✅ Deixar AI rodando por DIAS
✅ Recarregar página sem perder dados
✅ Ver histórico completo
✅ Analisar performance
✅ Comparar estratégias
✅ Treinar modelos de ML
```

### **❌ SE ALGO FALHOU:**

**Erro: "relation ai_sessions does not exist"**
→ Rode a migration SQL

**Erro: "RLS policy violation"**
→ Faça login no app

**Erro: "Cannot read property 'id'"**
→ Verifique se user está autenticado

**Erro: "Session não cria"**
→ Verifique console.log para ver erro específico

---

## 🔧 **DEBUG RÁPIDO:**

### **Ver logs no console:**

```typescript
// Ative logs no serviço:
// AITradingPersistenceService.ts já tem console.log

// Procure por:
[AI Persistence] 🚀 Criando sessão...
[AI Persistence] ✅ Sessão criada: abc123
[AI Persistence] ✅ Trade salvo: def456
[AI Persistence] ✅ Sessão finalizada
```

### **Ver dados no Supabase:**

```sql
-- Resumo rápido:
SELECT 
  (SELECT COUNT(*) FROM ai_sessions) as sessions,
  (SELECT COUNT(*) FROM ai_trades) as trades,
  (SELECT COUNT(*) FROM ai_portfolio_snapshots) as snapshots,
  (SELECT COUNT(*) FROM ai_decisions) as decisions;
```

### **Limpar dados de teste:**

```sql
-- CUIDADO: Deleta tudo!
DELETE FROM ai_sessions WHERE strategy_name LIKE '%TEST%';
```

---

## 📚 **DOCUMENTAÇÃO COMPLETA:**

- 📖 **Checklist Detalhado:** `/CHECKLIST_TESTES_AI_PERSISTENCE.md`
- 🗄️ **Queries SQL:** `/supabase-tests/test_queries.sql`
- 🚀 **Guia de Implementação:** `/GUIA_IMPLEMENTACAO_AI_PERSISTENCE.md`

---

## ⏱️ **TEMPO ESTIMADO:**

- ⚡ **Opção 1 (Automático):** 5 minutos
- 🔍 **Opção 2 (Manual):** 2 minutos
- 🚀 **Opção 3 (Real):** 10 minutos

---

**Escolha uma opção e comece a testar! 🧪**

**Dica:** Comece pela **Opção 1** (mais rápido e completo)
