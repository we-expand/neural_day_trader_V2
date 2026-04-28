# 🚀 **COMANDOS PRONTOS - COPIE E COLE**

## 📋 **1. VERIFICAR SE MIGRATION FOI RODADA**

### **Supabase → SQL Editor → Cole isso:**

```sql
-- Contar tabelas AI criadas
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables
WHERE table_name LIKE 'ai_%';

-- Resultado esperado: 5
```

---

## 📋 **2. LISTAR TODAS AS TABELAS AI**

```sql
SELECT table_name 
FROM information_schema.tables
WHERE table_name LIKE 'ai_%'
ORDER BY table_name;

-- Resultado esperado:
-- ai_backtests
-- ai_decisions
-- ai_portfolio_snapshots
-- ai_sessions
-- ai_trades
```

---

## 📋 **3. VERIFICAR RLS ATIVADO**

```sql
SELECT 
  tablename,
  rowsecurity as rls_ativado
FROM pg_tables
WHERE tablename LIKE 'ai_%'
ORDER BY tablename;

-- Resultado esperado: Todas com TRUE
```

---

## 📋 **4. CONTAR REGISTROS (SEU USUÁRIO)**

```sql
-- Substitua SEU_USER_ID pelo seu UUID
SELECT 
  (SELECT COUNT(*) FROM ai_sessions WHERE user_id = 'SEU_USER_ID') as minhas_sessoes,
  (SELECT COUNT(*) FROM ai_trades WHERE user_id = 'SEU_USER_ID') as meus_trades,
  (SELECT COUNT(*) FROM ai_portfolio_snapshots WHERE user_id = 'SEU_USER_ID') as meus_snapshots,
  (SELECT COUNT(*) FROM ai_decisions WHERE user_id = 'SEU_USER_ID') as minhas_decisoes;
```

---

## 📋 **5. VER ÚLTIMA SESSÃO**

```sql
-- Substitua SEU_USER_ID
SELECT 
  id,
  strategy_name,
  mode,
  symbols,
  initial_balance,
  final_balance,
  total_trades,
  win_rate,
  net_pnl,
  status,
  started_at,
  ended_at
FROM ai_sessions
WHERE user_id = 'SEU_USER_ID'
ORDER BY started_at DESC
LIMIT 1;
```

---

## 📋 **6. VER TRADES DA ÚLTIMA SESSÃO**

```sql
-- Substitua SESSION_ID (pega do query acima)
SELECT 
  symbol,
  side,
  entry_price,
  exit_price,
  quantity,
  net_pnl,
  status,
  entry_time,
  exit_time
FROM ai_trades
WHERE session_id = 'SESSION_ID_AQUI'
ORDER BY entry_time DESC;
```

---

## 📋 **7. VER EQUITY CURVE**

```sql
-- Substitua SESSION_ID
SELECT 
  timestamp,
  balance,
  equity,
  total_pnl,
  open_positions
FROM ai_portfolio_snapshots
WHERE session_id = 'SESSION_ID_AQUI'
ORDER BY timestamp ASC;
```

---

## 📋 **8. RESUMO GERAL DO SISTEMA**

```sql
SELECT 
  '📊 Total de Sessões' as metrica,
  COUNT(*)::TEXT as valor
FROM ai_sessions
UNION ALL
SELECT 
  '💰 Total de Trades' as metrica,
  COUNT(*)::TEXT as valor
FROM ai_trades
UNION ALL
SELECT 
  '📈 Total de Snapshots' as metrica,
  COUNT(*)::TEXT as valor
FROM ai_portfolio_snapshots
UNION ALL
SELECT 
  '🤖 Total de Decisões' as metrica,
  COUNT(*)::TEXT as valor
FROM ai_decisions
UNION ALL
SELECT 
  '✅ Sessões Completas' as metrica,
  COUNT(*)::TEXT as valor
FROM ai_sessions
WHERE status = 'COMPLETED'
UNION ALL
SELECT 
  '⚡ Sessões Ativas' as metrica,
  COUNT(*)::TEXT as valor
FROM ai_sessions
WHERE status = 'RUNNING';
```

---

## 📋 **9. CRIAR SESSÃO DE TESTE MANUALMENTE**

```sql
-- ⚠️ Substitua SEU_USER_ID

INSERT INTO ai_sessions (
  user_id,
  strategy_name,
  mode,
  symbols,
  timeframe,
  initial_balance,
  initial_equity,
  status
) VALUES (
  'SEU_USER_ID',
  'TESTE_MANUAL',
  'DEMO',
  ARRAY['BTCUSD'],
  '1h',
  10000,
  10000,
  'RUNNING'
) RETURNING id, strategy_name, started_at;

-- Copie o ID retornado para usar nos próximos comandos
```

---

## 📋 **10. CRIAR TRADE DE TESTE**

```sql
-- ⚠️ Substitua SESSION_ID e USER_ID

INSERT INTO ai_trades (
  session_id,
  user_id,
  symbol,
  type,
  side,
  entry_price,
  quantity,
  stop_loss,
  take_profit,
  ai_confidence,
  ai_reasoning,
  entry_time,
  status,
  commission
) VALUES (
  'SESSION_ID_DO_INSERT_ANTERIOR',
  'SEU_USER_ID',
  'BTCUSD',
  'BUY',
  'LONG',
  50000,
  0.1,
  49000,
  52000,
  85,
  'Teste manual de persistência',
  NOW(),
  'OPEN',
  0
) RETURNING id, symbol, entry_price;
```

---

## 📋 **11. FECHAR TRADE DE TESTE**

```sql
-- ⚠️ Substitua TRADE_ID

UPDATE ai_trades
SET 
  exit_price = 51500,
  exit_time = NOW(),
  pnl = 150,
  pnl_percentage = 3,
  commission = 2,
  net_pnl = 148,
  status = 'CLOSED',
  exit_reason = 'TP'
WHERE id = 'TRADE_ID_DO_INSERT_ANTERIOR'
RETURNING id, symbol, net_pnl, status;
```

---

## 📋 **12. CRIAR SNAPSHOT DE TESTE**

```sql
-- ⚠️ Substitua SESSION_ID e USER_ID

INSERT INTO ai_portfolio_snapshots (
  session_id,
  user_id,
  balance,
  equity,
  margin,
  open_positions,
  total_pnl,
  timestamp
) VALUES (
  'SESSION_ID_DO_INSERT_ANTERIOR',
  'SEU_USER_ID',
  10148,
  10148,
  0,
  0,
  148,
  NOW()
) RETURNING id, timestamp, equity;
```

---

## 📋 **13. FINALIZAR SESSÃO DE TESTE**

```sql
-- ⚠️ Substitua SESSION_ID

UPDATE ai_sessions
SET 
  final_balance = 10148,
  final_equity = 10148,
  ended_at = NOW(),
  status = 'COMPLETED'
WHERE id = 'SESSION_ID_DO_INSERT_ANTERIOR'
RETURNING id, strategy_name, net_pnl, status;
```

---

## 📋 **14. RECALCULAR MÉTRICAS**

```sql
-- ⚠️ Substitua SESSION_ID

SELECT calculate_session_metrics('SESSION_ID_AQUI');

-- Ver resultado:
SELECT 
  total_trades,
  winning_trades,
  losing_trades,
  win_rate,
  net_pnl,
  avg_win,
  avg_loss
FROM ai_sessions
WHERE id = 'SESSION_ID_AQUI';
```

---

## 📋 **15. PERFORMANCE POR SÍMBOLO**

```sql
SELECT 
  symbol,
  COUNT(*) as total_trades,
  COUNT(*) FILTER (WHERE net_pnl > 0) as winning,
  ROUND((COUNT(*) FILTER (WHERE net_pnl > 0)::DECIMAL / COUNT(*)) * 100, 2) as win_rate,
  ROUND(SUM(net_pnl)::NUMERIC, 2) as total_pnl,
  ROUND(AVG(net_pnl)::NUMERIC, 2) as avg_pnl
FROM ai_trades
WHERE status = 'CLOSED'
GROUP BY symbol
ORDER BY total_pnl DESC;
```

---

## 📋 **16. PERFORMANCE POR ESTRATÉGIA**

```sql
SELECT 
  strategy_name,
  COUNT(*) as total_sessoes,
  ROUND(AVG(win_rate)::NUMERIC, 2) as avg_win_rate,
  ROUND(SUM(net_pnl)::NUMERIC, 2) as total_pnl,
  ROUND(AVG(total_trades)::NUMERIC, 0) as avg_trades_per_session
FROM ai_sessions
WHERE status = 'COMPLETED'
GROUP BY strategy_name
ORDER BY total_pnl DESC;
```

---

## 📋 **17. TOP 10 MELHORES TRADES**

```sql
SELECT 
  symbol,
  side,
  entry_price,
  exit_price,
  net_pnl,
  entry_time
FROM ai_trades
WHERE status = 'CLOSED'
ORDER BY net_pnl DESC
LIMIT 10;
```

---

## 📋 **18. TOP 10 PIORES TRADES**

```sql
SELECT 
  symbol,
  side,
  entry_price,
  exit_price,
  net_pnl,
  entry_time
FROM ai_trades
WHERE status = 'CLOSED'
ORDER BY net_pnl ASC
LIMIT 10;
```

---

## 📋 **19. VERIFICAR INTEGRIDADE**

```sql
-- Sessões órfãs (sem trades)
SELECT 
  'Sessões sem trades' as tipo,
  COUNT(*) as total
FROM ai_sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM ai_trades t WHERE t.session_id = s.id
);

-- Trades órfãos (sem sessão)
SELECT 
  'Trades sem sessão' as tipo,
  COUNT(*) as total
FROM ai_trades t
WHERE NOT EXISTS (
  SELECT 1 FROM ai_sessions s WHERE s.id = t.session_id
);

-- Resultado esperado: 0 para ambos
```

---

## 📋 **20. LIMPAR DADOS DE TESTE**

```sql
-- ⚠️ CUIDADO: Isso deleta dados!

-- Deletar apenas sessões de teste
DELETE FROM ai_sessions 
WHERE strategy_name LIKE '%TEST%' 
   OR strategy_name LIKE '%TESTE%';

-- Deletar sessões antigas (mais de 90 dias)
DELETE FROM ai_sessions 
WHERE started_at < NOW() - INTERVAL '90 days';

-- Retornar quantos foram deletados
SELECT COUNT(*) as deletados FROM ai_sessions WHERE FALSE;
```

---

## 📋 **21. EXPORTAR DADOS (JSON)**

```sql
-- Exportar sessão completa com trades
SELECT json_build_object(
  'session', (
    SELECT row_to_json(s.*) 
    FROM ai_sessions s 
    WHERE s.id = 'SESSION_ID_AQUI'
  ),
  'trades', (
    SELECT json_agg(row_to_json(t.*)) 
    FROM ai_trades t 
    WHERE t.session_id = 'SESSION_ID_AQUI'
  ),
  'snapshots', (
    SELECT json_agg(row_to_json(p.*)) 
    FROM ai_portfolio_snapshots p 
    WHERE p.session_id = 'SESSION_ID_AQUI'
  )
) as session_export;

-- Copie o resultado JSON
```

---

## 📋 **22. BUSCAR SEU USER_ID**

```sql
-- Se você não sabe seu user_id:
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'SEU_EMAIL@EXEMPLO.COM';

-- Copie o UUID retornado
```

---

## 📋 **23. MONITORAR TAMANHO DAS TABELAS**

```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) as tamanho
FROM pg_tables
WHERE tablename LIKE 'ai_%'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;
```

---

## 📋 **24. VERIFICAR ÍNDICES**

```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename LIKE 'ai_%'
ORDER BY tablename, indexname;

-- Deve mostrar vários índices (idx_ai_sessions_user_id, etc)
```

---

## 🎯 **FLUXO COMPLETO DE TESTE:**

```sql
-- 1. Verificar se tabelas existem
SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'ai_%';
-- Esperado: 5

-- 2. Buscar seu user_id
SELECT id FROM auth.users WHERE email = 'SEU_EMAIL';
-- Copie o UUID

-- 3. Criar sessão de teste
INSERT INTO ai_sessions (user_id, strategy_name, mode, symbols, timeframe, initial_balance, initial_equity)
VALUES ('UUID_COPIADO', 'TESTE', 'DEMO', ARRAY['BTCUSD'], '1h', 10000, 10000)
RETURNING id;
-- Copie o session_id

-- 4. Criar trade
INSERT INTO ai_trades (session_id, user_id, symbol, type, side, entry_price, quantity, ai_confidence, ai_reasoning, entry_time, status, commission)
VALUES ('SESSION_ID_COPIADO', 'UUID_COPIADO', 'BTCUSD', 'BUY', 'LONG', 50000, 0.1, 85, 'Teste', NOW(), 'OPEN', 0)
RETURNING id;
-- Copie o trade_id

-- 5. Fechar trade
UPDATE ai_trades 
SET exit_price = 51500, exit_time = NOW(), pnl = 150, net_pnl = 148, status = 'CLOSED', exit_reason = 'TP'
WHERE id = 'TRADE_ID_COPIADO'
RETURNING net_pnl;

-- 6. Finalizar sessão
UPDATE ai_sessions 
SET final_balance = 10148, final_equity = 10148, ended_at = NOW(), status = 'COMPLETED'
WHERE id = 'SESSION_ID_COPIADO'
RETURNING net_pnl;

-- 7. Ver resultado
SELECT * FROM ai_sessions WHERE id = 'SESSION_ID_COPIADO';

-- ✅ Se tudo funcionou, sistema está OK!
```

---

**💡 Dica:** Salve este arquivo e use como referência rápida!
