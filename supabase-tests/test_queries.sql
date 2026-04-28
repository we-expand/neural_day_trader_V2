-- ============================================================================
-- QUERIES DE TESTE - AI PERSISTENCE
-- Cole essas queries no Supabase SQL Editor para verificar os dados
-- ============================================================================

-- ============================================================================
-- TESTE 1: Verificar se as tabelas existem
-- ============================================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'ai_%'
ORDER BY table_name;

-- ✅ Resultado esperado: 5 tabelas (ai_sessions, ai_trades, ai_portfolio_snapshots, ai_decisions, ai_backtests)

-- ============================================================================
-- TESTE 2: Verificar RLS (Row Level Security)
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename LIKE 'ai_%'
ORDER BY tablename;

-- ✅ Resultado esperado: rowsecurity = true para todas as tabelas

-- ============================================================================
-- TESTE 3: Verificar políticas de RLS
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename LIKE 'ai_%'
ORDER BY tablename, policyname;

-- ✅ Resultado esperado: 11 políticas (SELECT, INSERT, UPDATE para cada tabela)

-- ============================================================================
-- TESTE 4: Verificar triggers
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table LIKE 'ai_%'
ORDER BY event_object_table, trigger_name;

-- ✅ Resultado esperado: 3 triggers (update_session_metrics_on_trade, update_updated_at)

-- ============================================================================
-- TESTE 5: Verificar funções criadas
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name IN (
  'calculate_session_metrics',
  'trigger_update_session_metrics',
  'update_updated_at_column'
)
ORDER BY routine_name;

-- ✅ Resultado esperado: 3 funções

-- ============================================================================
-- TESTE 6: Contar registros nas tabelas
-- ============================================================================
SELECT 
  'ai_sessions' as table_name,
  COUNT(*) as total_records
FROM ai_sessions
UNION ALL
SELECT 
  'ai_trades' as table_name,
  COUNT(*) as total_records
FROM ai_trades
UNION ALL
SELECT 
  'ai_portfolio_snapshots' as table_name,
  COUNT(*) as total_records
FROM ai_portfolio_snapshots
UNION ALL
SELECT 
  'ai_decisions' as table_name,
  COUNT(*) as total_records
FROM ai_decisions
UNION ALL
SELECT 
  'ai_backtests' as table_name,
  COUNT(*) as total_records
FROM ai_backtests
ORDER BY table_name;

-- ✅ Resultado esperado: Números (podem ser 0 se ainda não testou)

-- ============================================================================
-- TESTE 7: Buscar últimas sessões criadas
-- ============================================================================
SELECT 
  id,
  user_id,
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
ORDER BY started_at DESC
LIMIT 10;

-- ✅ Mostra últimas 10 sessões

-- ============================================================================
-- TESTE 8: Buscar trades recentes
-- ============================================================================
SELECT 
  t.id,
  t.session_id,
  s.strategy_name,
  t.symbol,
  t.side,
  t.entry_price,
  t.exit_price,
  t.net_pnl,
  t.status,
  t.entry_time,
  t.exit_time
FROM ai_trades t
LEFT JOIN ai_sessions s ON t.session_id = s.id
ORDER BY t.entry_time DESC
LIMIT 10;

-- ✅ Mostra últimos 10 trades

-- ============================================================================
-- TESTE 9: Equity curve de uma sessão específica
-- ============================================================================
-- Substitua 'SESSION_ID_AQUI' pelo ID real de uma sessão
SELECT 
  timestamp,
  balance,
  equity,
  total_pnl,
  open_positions,
  drawdown
FROM ai_portfolio_snapshots
WHERE session_id = 'SESSION_ID_AQUI'
ORDER BY timestamp ASC;

-- ✅ Mostra evolução do portfolio ao longo do tempo

-- ============================================================================
-- TESTE 10: Métricas de uma sessão
-- ============================================================================
SELECT 
  strategy_name,
  mode,
  total_trades,
  winning_trades,
  losing_trades,
  win_rate,
  total_pnl,
  net_pnl,
  max_drawdown,
  avg_win,
  avg_loss,
  largest_win,
  largest_loss,
  profit_factor,
  sharpe_ratio,
  EXTRACT(EPOCH FROM (ended_at - started_at))/3600 as duration_hours
FROM ai_sessions
WHERE status = 'COMPLETED'
ORDER BY started_at DESC
LIMIT 5;

-- ✅ Mostra métricas das últimas 5 sessões completas

-- ============================================================================
-- TESTE 11: Decisões da AI em uma sessão
-- ============================================================================
-- Substitua 'SESSION_ID_AQUI' pelo ID real de uma sessão
SELECT 
  timestamp,
  symbol,
  decision,
  confidence,
  reasoning,
  market_score,
  action_taken
FROM ai_decisions
WHERE session_id = 'SESSION_ID_AQUI'
ORDER BY timestamp DESC
LIMIT 20;

-- ✅ Mostra últimas 20 decisões da AI

-- ============================================================================
-- TESTE 12: Performance por símbolo
-- ============================================================================
SELECT 
  symbol,
  COUNT(*) as total_trades,
  COUNT(*) FILTER (WHERE net_pnl > 0) as winning_trades,
  ROUND((COUNT(*) FILTER (WHERE net_pnl > 0)::DECIMAL / COUNT(*)) * 100, 2) as win_rate,
  ROUND(SUM(net_pnl)::NUMERIC, 2) as total_pnl,
  ROUND(AVG(net_pnl)::NUMERIC, 2) as avg_pnl,
  ROUND(MAX(net_pnl)::NUMERIC, 2) as best_trade,
  ROUND(MIN(net_pnl)::NUMERIC, 2) as worst_trade
FROM ai_trades
WHERE status = 'CLOSED'
GROUP BY symbol
ORDER BY total_pnl DESC;

-- ✅ Mostra performance por ativo

-- ============================================================================
-- TESTE 13: Performance por estratégia
-- ============================================================================
SELECT 
  s.strategy_name,
  s.mode,
  COUNT(DISTINCT s.id) as total_sessions,
  COUNT(t.id) as total_trades,
  ROUND(AVG(s.win_rate)::NUMERIC, 2) as avg_win_rate,
  ROUND(SUM(s.net_pnl)::NUMERIC, 2) as total_net_pnl,
  ROUND(AVG(s.max_drawdown)::NUMERIC, 2) as avg_max_drawdown
FROM ai_sessions s
LEFT JOIN ai_trades t ON s.id = t.session_id
WHERE s.status = 'COMPLETED'
GROUP BY s.strategy_name, s.mode
ORDER BY total_net_pnl DESC;

-- ✅ Compara diferentes estratégias

-- ============================================================================
-- TESTE 14: Verificar integridade dos dados
-- ============================================================================
-- Sessões sem trades
SELECT 
  'Sessões sem trades' as issue,
  COUNT(*) as count
FROM ai_sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM ai_trades t WHERE t.session_id = s.id
);

-- Trades sem sessão (órfãos)
SELECT 
  'Trades órfãos' as issue,
  COUNT(*) as count
FROM ai_trades t
WHERE NOT EXISTS (
  SELECT 1 FROM ai_sessions s WHERE s.id = t.session_id
);

-- Trades abertos sem exit_time
SELECT 
  'Trades abertos sem exit_time' as issue,
  COUNT(*) as count
FROM ai_trades
WHERE status = 'OPEN' AND exit_time IS NOT NULL;

-- ✅ Todos devem retornar 0 ou valores baixos

-- ============================================================================
-- TESTE 15: Testar função de recálculo de métricas
-- ============================================================================
-- Substitua 'SESSION_ID_AQUI' pelo ID real de uma sessão
SELECT calculate_session_metrics('SESSION_ID_AQUI');

-- Verificar se as métricas foram atualizadas
SELECT 
  total_trades,
  winning_trades,
  losing_trades,
  win_rate,
  net_pnl,
  updated_at
FROM ai_sessions
WHERE id = 'SESSION_ID_AQUI';

-- ✅ Métricas devem ser recalculadas

-- ============================================================================
-- TESTE 16: Criar dados de teste manualmente (OPCIONAL)
-- ============================================================================
-- ⚠️ APENAS PARA TESTE - Substitua 'USER_ID_AQUI' pelo seu user_id real

-- Criar sessão de teste
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
  'USER_ID_AQUI',
  'TESTE_MANUAL',
  'DEMO',
  ARRAY['BTCUSD', 'ETHUSD'],
  '1h',
  10000,
  10000,
  'RUNNING'
) RETURNING id;

-- Copie o ID retornado e use nas próximas queries

-- Criar trade de teste
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
  'USER_ID_AQUI',
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
) RETURNING id;

-- Criar snapshot de teste
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
  'USER_ID_AQUI',
  10000,
  10000,
  0,
  1,
  0,
  NOW()
);

-- ✅ Se todos inserts funcionaram, RLS está OK!

-- ============================================================================
-- TESTE 17: Limpar dados de teste (OPCIONAL)
-- ============================================================================
-- ⚠️ CUIDADO: Isso vai deletar TODOS os dados de teste do seu usuário

-- DELETE FROM ai_sessions WHERE strategy_name LIKE '%TEST%' OR strategy_name LIKE '%TESTE%';
-- DELETE FROM ai_trades WHERE symbol = 'TEST';
-- DELETE FROM ai_portfolio_snapshots WHERE balance = 9999; -- Valor único para testes

-- ============================================================================
-- TESTE 18: Monitorar performance do banco
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE tablename LIKE 'ai_%'
ORDER BY size_bytes DESC;

-- ✅ Mostra tamanho das tabelas

-- ============================================================================
-- TESTE 19: Verificar índices
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename LIKE 'ai_%'
ORDER BY tablename, indexname;

-- ✅ Deve mostrar todos os índices criados

-- ============================================================================
-- RESUMO RÁPIDO
-- ============================================================================
SELECT 
  '✅ TABELAS' as categoria,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'ai_%') as total
UNION ALL
SELECT 
  '✅ SESSÕES' as categoria,
  COUNT(*)::TEXT as total
FROM ai_sessions
UNION ALL
SELECT 
  '✅ TRADES' as categoria,
  COUNT(*)::TEXT as total
FROM ai_trades
UNION ALL
SELECT 
  '✅ SNAPSHOTS' as categoria,
  COUNT(*)::TEXT as total
FROM ai_portfolio_snapshots
UNION ALL
SELECT 
  '✅ DECISÕES' as categoria,
  COUNT(*)::TEXT as total
FROM ai_decisions
UNION ALL
SELECT 
  '✅ BACKTESTS' as categoria,
  COUNT(*)::TEXT as total
FROM ai_backtests;

-- ✅ Mostra resumo geral do sistema
