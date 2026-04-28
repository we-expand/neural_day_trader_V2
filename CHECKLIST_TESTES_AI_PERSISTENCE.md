# ✅ **CHECKLIST DE TESTES - AI PERSISTENCE**

## 🎯 **OBJETIVO:**
Validar que o sistema de persistência está funcionando 100%

---

## 📋 **TESTES RÁPIDOS (5 minutos)**

### **✅ TESTE 1: Verificar Database**

**Supabase Dashboard → Table Editor**

- [ ] Existe tabela `ai_sessions`?
- [ ] Existe tabela `ai_trades`?
- [ ] Existe tabela `ai_portfolio_snapshots`?
- [ ] Existe tabela `ai_decisions`?
- [ ] Existe tabela `ai_backtests`?

**Se SIM para todas = ✅ Database OK!**

---

### **✅ TESTE 2: RLS (Segurança)**

**Supabase Dashboard → SQL Editor**

Cole e execute:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'ai_%';
```

**Resultado esperado:**
```
ai_sessions           | true
ai_trades            | true
ai_portfolio_snapshots | true
ai_decisions         | true
ai_backtests         | true
```

- [ ] Todos com `rowsecurity = true`?

**Se SIM = ✅ Segurança OK!**

---

### **✅ TESTE 3: Componente Debug**

**No seu App.tsx:**

```typescript
import { AIPersistenceDebugger } from '@/app/components/debug/AIPersistenceDebugger';

// Adicione uma rota temporária:
{currentView === 'debug-ai' && <AIPersistenceDebugger />}
```

**No Sidebar (temporário):**
```typescript
{
  id: 'debug-ai',
  label: 'Debug AI',
  icon: Bug,
}
```

**Depois:**
1. [ ] Acesse a view "Debug AI"
2. [ ] Faça login
3. [ ] Clique em "Executar Todos os Testes"
4. [ ] Aguarde ~5 segundos

**Resultado esperado:**
```
✅ 1. Criar Sessão
✅ 2. Salvar Trade
✅ 3. Fechar Trade
✅ 4. Snapshot Portfolio
✅ 5. Salvar Decisão
✅ 6. Buscar Sessões
✅ 7. Buscar Trades
✅ 8. Equity Curve

🎉 Todos os testes passaram!
```

- [ ] Todos os 8 testes passaram?

**Se SIM = ✅ Sistema 100% funcional!**

---

### **✅ TESTE 4: Verificar Dados no Supabase**

**Após rodar o teste acima:**

**Supabase → Table Editor → ai_sessions**

- [ ] Existe pelo menos 1 sessão com `strategy_name = "DEBUG_TEST_STRATEGY"`?
- [ ] Status está `COMPLETED`?
- [ ] `total_trades = 1`?

**Supabase → Table Editor → ai_trades**

- [ ] Existe pelo menos 1 trade?
- [ ] Status está `CLOSED`?
- [ ] `net_pnl = 148`?

**Supabase → Table Editor → ai_portfolio_snapshots**

- [ ] Existe pelo menos 1 snapshot?
- [ ] `equity = 10148`?

**Se SIM para todas = ✅ Dados persistindo corretamente!**

---

## 🔥 **TESTE REAL (10 minutos)**

Agora vamos testar com o AI Trader de verdade!

### **PASSO 1: Integrar com AI Trader**

**No componente do AI Trader:**

```typescript
import { useAIPersistence } from '@/app/hooks/useAIPersistence';

// Dentro do componente:
const aiPersistence = useAIPersistence({
  enabled: true,
  autoSnapshot: true,
  snapshotInterval: 60000, // 1 minuto
});

// Quando ATIVAR AI:
const handleActivate = async () => {
  // ... código existente ...
  
  // ✅ ADICIONAR:
  const sessionId = await aiPersistence.startSession({
    strategyName: 'Minha Estratégia',
    symbols: [selectedSymbol],
    timeframe: timeframe,
    initialBalance: portfolio.balance,
    initialEquity: portfolio.equity,
    config: aiConfig,
  });
  
  console.log('✅ Sessão criada:', sessionId);
};

// Quando DESATIVAR AI:
const handleDeactivate = async () => {
  // ... código existente ...
  
  // ✅ ADICIONAR:
  await aiPersistence.endSession(
    portfolio.balance,
    portfolio.equity
  );
  
  console.log('✅ Sessão finalizada');
};
```

---

### **PASSO 2: Ativar AI por 2 minutos**

1. [ ] Ative o AI Trader
2. [ ] Abra o Console (F12)
3. [ ] Procure por: `✅ Sessão criada: [UUID]`
4. [ ] Copie o UUID da sessão

**Se apareceu = ✅ Sessão criada!**

---

### **PASSO 3: Aguardar trades**

- [ ] Aguarde AI executar pelo menos 1 trade
- [ ] Procure no console: `[AI Persistence Hook] ✅ Trade salvo: [UUID]`

**Se apareceu = ✅ Trade sendo salvo!**

---

### **PASSO 4: Verificar no Supabase**

**Supabase → SQL Editor:**

```sql
-- Buscar sua sessão (substitua USER_ID)
SELECT * FROM ai_sessions 
WHERE user_id = 'SEU_USER_ID_AQUI'
ORDER BY started_at DESC 
LIMIT 1;
```

- [ ] Sessão aparece?
- [ ] Status = `RUNNING`?
- [ ] `initial_balance` está correto?

```sql
-- Buscar trades da sessão (substitua SESSION_ID)
SELECT * FROM ai_trades 
WHERE session_id = 'SESSION_ID_COPIADO_ANTES'
ORDER BY entry_time DESC;
```

- [ ] Trades aparecem?
- [ ] Dados estão corretos (symbol, price, etc)?

**Se SIM = ✅ Dados persistindo em tempo real!**

---

### **PASSO 5: Aguardar 2 minutos (snapshots)**

- [ ] Aguarde 2 minutos com AI ativo
- [ ] Verifique snapshots:

```sql
-- Buscar snapshots (substitua SESSION_ID)
SELECT timestamp, balance, equity, total_pnl 
FROM ai_portfolio_snapshots 
WHERE session_id = 'SESSION_ID_COPIADO_ANTES'
ORDER BY timestamp ASC;
```

- [ ] Existe pelo menos 2 snapshots?
- [ ] Timestamps espaçados de ~1 minuto?

**Se SIM = ✅ Auto-snapshot funcionando!**

---

### **PASSO 6: Desativar AI**

1. [ ] Clique em "Parar AI"
2. [ ] Procure no console: `✅ Sessão finalizada`
3. [ ] Verifique no Supabase:

```sql
SELECT status, ended_at, final_balance, total_trades, win_rate, net_pnl
FROM ai_sessions 
WHERE id = 'SESSION_ID_COPIADO_ANTES';
```

- [ ] Status mudou para `COMPLETED`?
- [ ] `ended_at` está preenchido?
- [ ] Métricas calculadas (total_trades, win_rate, etc)?

**Se SIM = ✅ Finalização funcionando!**

---

### **PASSO 7: Dashboard de Histórico**

**Adicione o dashboard ao App:**

```typescript
import { AISessionHistory } from '@/app/components/ai/AISessionHistory';

{currentView === 'ai-history' && <AISessionHistory />}
```

1. [ ] Acesse a view "Histórico AI"
2. [ ] Sua sessão aparece na lista?
3. [ ] KPIs estão corretos (P&L, Win Rate, etc)?
4. [ ] Equity curve renderiza (se houver snapshots)?
5. [ ] Trades aparecem na lista?

**Se SIM = ✅ Dashboard funcionando!**

---

## 🎯 **TESTE COMPLETO (30 minutos)**

Agora o teste definitivo!

### **Cenário: Deixar AI rodando por 30 minutos**

1. [ ] Ative AI Trader
2. [ ] Aguarde 30 minutos (pode fazer outras coisas)
3. [ ] Desative AI Trader
4. [ ] Acesse "Histórico AI"

**Verificar:**
- [ ] Sessão tem duração de ~30 minutos?
- [ ] Múltiplos trades registrados?
- [ ] Equity curve tem vários pontos?
- [ ] Métricas fazem sentido?
- [ ] Gráfico mostra evolução?

**Se SIM para todas = ✅ SISTEMA 100% FUNCIONAL!**

---

## 🔄 **TESTE DE PERSISTÊNCIA (Crítico)**

### **Cenário: Recarregar página**

1. [ ] Ative AI Trader
2. [ ] Aguarde 1-2 minutos
3. [ ] Copie o Session ID do console
4. [ ] **RECARREGUE A PÁGINA (F5)**
5. [ ] Acesse "Histórico AI"
6. [ ] Procure a sessão pelo ID

**Perguntas:**
- [ ] Sessão ainda existe no histórico?
- [ ] Trades foram salvos?
- [ ] Snapshots persistiram?
- [ ] Dados estão intactos?

**Se SIM = ✅ PERSISTÊNCIA FUNCIONANDO!**

**Isso prova que não perde mais dados ao recarregar! 🎉**

---

## 🐛 **TROUBLESHOOTING**

### **❌ Teste 1-2 falhou (Tabelas não existem)**

**Solução:**
1. Acesse Supabase → SQL Editor
2. Cole o conteúdo de `/supabase-migrations/001_ai_trading_persistence.sql`
3. Execute
4. Rode os testes novamente

---

### **❌ Teste 3 falhou (Component Debug)**

**Possíveis causas:**

**Erro: "auth.uid() is null"**
- Você não está logado
- Solução: Faça login e tente novamente

**Erro: "relation ai_sessions does not exist"**
- Migration não foi rodada
- Solução: Execute a migration SQL

**Erro: "RLS policy violation"**
- RLS configurado incorretamente
- Solução: Verifique policies no Supabase

---

### **❌ Teste Real falhou (Integração)**

**Sessão não cria:**
```typescript
// Verifique se user.id existe:
console.log('User ID:', user?.id);

// Verifique se hook está habilitado:
const aiPersistence = useAIPersistence({
  enabled: true, // ← Deve ser true
  autoSnapshot: true,
});
```

**Trades não salvam:**
```typescript
// Verifique se sessionId existe:
console.log('Session ID:', aiPersistence.currentSessionId);

// Certifique-se de chamar onTradeOpen:
await aiPersistence.onTradeOpen(trade);
```

**Snapshots não aparecem:**
- Aguarde pelo menos 2 minutos
- Verifique se `autoSnapshot: true`
- Check no console se não há erros

---

## 📊 **RESULTADO ESPERADO**

### **✅ Todos os testes passaram:**

```
✅ Database criado
✅ RLS configurado
✅ Testes automatizados OK
✅ Integração com AI Trader OK
✅ Persistência funcionando
✅ Dashboard renderizando
✅ Dados sobrevivem ao F5
✅ Equity curve completa
✅ Métricas calculadas
✅ Sistema 100% funcional
```

**PARABÉNS! 🎉 Sistema de persistência está funcionando perfeitamente!**

---

## 📈 **PRÓXIMOS PASSOS**

Agora que está funcionando:

1. [ ] Remover componente de debug (opcional)
2. [ ] Testar com diferentes estratégias
3. [ ] Comparar performance entre sessões
4. [ ] Analisar decisões da AI
5. [ ] Implementar features avançadas:
   - Export CSV/PDF
   - Machine Learning training
   - A/B testing de estratégias
   - Otimização automática de parâmetros

---

## 🎓 **CRITÉRIOS DE SUCESSO**

**Mínimo Viável:**
- ✅ Sessões persistem no banco
- ✅ Trades são salvos
- ✅ Dashboard mostra histórico

**Completo:**
- ✅ Auto-snapshot funciona
- ✅ Métricas calculadas automaticamente
- ✅ Equity curve renderiza
- ✅ RLS funcionando (segurança)
- ✅ Performance otimizada (índices)

**Profissional:**
- ✅ Dados sobrevivem ao refresh
- ✅ Múltiplas sessões comparáveis
- ✅ Decisões da AI logadas
- ✅ Dashboard bonito e responsivo
- ✅ Export de dados possível

---

**Tempo estimado de testes:**
- ⚡ Rápido: 5 minutos
- 🔥 Real: 10 minutos
- 🎯 Completo: 30 minutos

**Pronto para testar! 🚀**
