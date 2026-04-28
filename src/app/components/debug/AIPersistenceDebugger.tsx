/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  AI PERSISTENCE DEBUGGER                                          ║
 * ║  Componente para testar e validar o sistema de persistência      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { aiPersistence } from '@/app/services/AITradingPersistenceService';
import { useAuth } from '@/app/contexts/AuthContext';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
  data?: any;
}

export function AIPersistenceDebugger() {
  const { user } = useAuth();
  const [tests, setTests] = useState<TestResult[]>([
    { name: '1. Criar Sessão', status: 'pending' },
    { name: '2. Salvar Trade', status: 'pending' },
    { name: '3. Fechar Trade', status: 'pending' },
    { name: '4. Snapshot Portfolio', status: 'pending' },
    { name: '5. Salvar Decisão', status: 'pending' },
    { name: '6. Buscar Sessões', status: 'pending' },
    { name: '7. Buscar Trades', status: 'pending' },
    { name: '8. Equity Curve', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);

  // Atualizar resultado de um teste
  const updateTest = (index: number, updates: Partial<TestResult>) => {
    setTests((prev) =>
      prev.map((test, i) => (i === index ? { ...test, ...updates } : test))
    );
  };

  // Executar todos os testes
  const runAllTests = async () => {
    if (!user?.id) {
      alert('Você precisa estar autenticado!');
      return;
    }

    setIsRunning(true);

    // Resetar testes
    setTests((prev) => prev.map((t) => ({ ...t, status: 'pending', message: undefined })));

    try {
      // ======================================================================
      // TESTE 1: Criar Sessão
      // ======================================================================
      updateTest(0, { status: 'running' });
      const startTime1 = Date.now();

      const session = await aiPersistence.createSession({
        user_id: user.id,
        strategy_name: 'DEBUG_TEST_STRATEGY',
        mode: 'DEMO',
        symbols: ['BTCUSD'],
        timeframe: '1h',
        initial_balance: 10000,
        initial_equity: 10000,
        config: { test: true },
      });

      if (session?.id) {
        setSessionId(session.id);
        updateTest(0, {
          status: 'success',
          message: `✅ Sessão criada: ${session.id.substring(0, 8)}...`,
          duration: Date.now() - startTime1,
          data: session,
        });
      } else {
        throw new Error('Falha ao criar sessão');
      }

      await sleep(500);

      // ======================================================================
      // TESTE 2: Salvar Trade
      // ======================================================================
      updateTest(1, { status: 'running' });
      const startTime2 = Date.now();

      const tradeData = {
        session_id: session.id!,
        user_id: user.id,
        symbol: 'BTCUSD',
        type: 'BUY' as const,
        side: 'LONG' as const,
        entry_price: 50000,
        quantity: 0.1,
        stop_loss: 49000,
        take_profit: 52000,
        ai_confidence: 85,
        ai_reasoning: 'Teste automatizado de persistência',
        indicators_snapshot: { rsi: 45, macd: 'BULLISH' },
        market_conditions: { volatility: 'MEDIUM' },
        entry_time: new Date().toISOString(),
        status: 'OPEN' as const,
        commission: 0,
      };

      const savedTradeId = await aiPersistence.saveTrade(tradeData);

      if (savedTradeId) {
        setTradeId(savedTradeId);
        updateTest(1, {
          status: 'success',
          message: `✅ Trade salvo: ${savedTradeId.substring(0, 8)}...`,
          duration: Date.now() - startTime2,
          data: tradeData,
        });
      } else {
        throw new Error('Falha ao salvar trade');
      }

      await sleep(500);

      // ======================================================================
      // TESTE 3: Fechar Trade
      // ======================================================================
      updateTest(2, { status: 'running' });
      const startTime3 = Date.now();

      const updated = await aiPersistence.updateTrade(savedTradeId, {
        exit_price: 51500,
        exit_time: new Date().toISOString(),
        pnl: 150,
        pnl_percentage: 3,
        net_pnl: 148,
        status: 'CLOSED',
        exit_reason: 'TP',
      });

      if (updated) {
        updateTest(2, {
          status: 'success',
          message: '✅ Trade fechado com sucesso',
          duration: Date.now() - startTime3,
        });
      } else {
        throw new Error('Falha ao fechar trade');
      }

      await sleep(500);

      // ======================================================================
      // TESTE 4: Snapshot Portfolio
      // ======================================================================
      updateTest(3, { status: 'running' });
      const startTime4 = Date.now();

      const snapshotSaved = await aiPersistence.saveSnapshot({
        session_id: session.id!,
        user_id: user.id,
        balance: 10148,
        equity: 10148,
        margin: 0,
        open_positions: 0,
        total_pnl: 148,
        drawdown: 0,
        timestamp: new Date().toISOString(),
      });

      if (snapshotSaved) {
        updateTest(3, {
          status: 'success',
          message: '✅ Snapshot salvo',
          duration: Date.now() - startTime4,
        });
      } else {
        throw new Error('Falha ao salvar snapshot');
      }

      await sleep(500);

      // ======================================================================
      // TESTE 5: Salvar Decisão
      // ======================================================================
      updateTest(4, { status: 'running' });
      const startTime5 = Date.now();

      const decisionId = await aiPersistence.saveDecision({
        session_id: session.id!,
        user_id: user.id,
        symbol: 'BTCUSD',
        timestamp: new Date().toISOString(),
        decision: 'BUY',
        confidence: 85,
        reasoning: 'Teste de decisão da AI',
        market_score: 7.5,
        technical_signals: { rsi: 45, macd: 'BULLISH' },
        risk_assessment: { risk_level: 'LOW' },
        action_taken: true,
        trade_id: savedTradeId,
      });

      if (decisionId) {
        updateTest(4, {
          status: 'success',
          message: `✅ Decisão salva: ${decisionId.substring(0, 8)}...`,
          duration: Date.now() - startTime5,
        });
      } else {
        throw new Error('Falha ao salvar decisão');
      }

      await sleep(500);

      // ======================================================================
      // TESTE 6: Buscar Sessões
      // ======================================================================
      updateTest(5, { status: 'running' });
      const startTime6 = Date.now();

      const sessions = await aiPersistence.getUserSessions(user.id, 10);

      if (sessions.length > 0) {
        updateTest(5, {
          status: 'success',
          message: `✅ ${sessions.length} sessão(ões) encontrada(s)`,
          duration: Date.now() - startTime6,
          data: sessions,
        });
      } else {
        throw new Error('Nenhuma sessão encontrada');
      }

      await sleep(500);

      // ======================================================================
      // TESTE 7: Buscar Trades
      // ======================================================================
      updateTest(6, { status: 'running' });
      const startTime7 = Date.now();

      const trades = await aiPersistence.getSessionTrades(session.id!);

      if (trades.length > 0) {
        updateTest(6, {
          status: 'success',
          message: `✅ ${trades.length} trade(s) encontrado(s)`,
          duration: Date.now() - startTime7,
          data: trades,
        });
      } else {
        throw new Error('Nenhum trade encontrado');
      }

      await sleep(500);

      // ======================================================================
      // TESTE 8: Equity Curve
      // ======================================================================
      updateTest(7, { status: 'running' });
      const startTime8 = Date.now();

      const snapshots = await aiPersistence.getSessionSnapshots(session.id!);

      if (snapshots.length > 0) {
        updateTest(7, {
          status: 'success',
          message: `✅ ${snapshots.length} snapshot(s) encontrado(s)`,
          duration: Date.now() - startTime8,
          data: snapshots,
        });
      } else {
        throw new Error('Nenhum snapshot encontrado');
      }

      // ======================================================================
      // FINALIZAR SESSÃO DE TESTE
      // ======================================================================
      await aiPersistence.endSession(session.id!, 10148, 10148);

      console.log('🎉 TODOS OS TESTES PASSARAM!');
    } catch (error: any) {
      console.error('❌ Erro nos testes:', error);
      // Marcar teste atual como erro
      const failedIndex = tests.findIndex((t) => t.status === 'running');
      if (failedIndex !== -1) {
        updateTest(failedIndex, {
          status: 'error',
          message: `❌ ${error.message}`,
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-slate-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-slate-500/10 border-slate-500/30';
      case 'running':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'success':
        return 'bg-green-500/10 border-green-500/30';
      case 'error':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-slate-500/10 border-slate-500/30';
    }
  };

  const allPassed = tests.every((t) => t.status === 'success');
  const anyFailed = tests.some((t) => t.status === 'error');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Database className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">AI Persistence Debugger</h2>
            <p className="text-slate-400">Teste completo do sistema de persistência</p>
          </div>
        </div>

        {/* Status */}
        {!user && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-medium">
                ⚠️ Você precisa estar autenticado para rodar os testes!
              </span>
            </div>
          </div>
        )}

        {allPassed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">
                🎉 Todos os testes passaram! O sistema está funcionando perfeitamente!
              </span>
            </div>
          </motion.div>
        )}

        {anyFailed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-medium">
                ❌ Alguns testes falharam. Verifique os detalhes abaixo.
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Botão de Executar */}
      <div className="flex justify-center">
        <motion.button
          onClick={runAllTests}
          disabled={isRunning || !user}
          whileHover={!isRunning ? { scale: 1.05 } : {}}
          whileTap={!isRunning ? { scale: 0.95 } : {}}
          className={`px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all ${
            isRunning
              ? 'bg-blue-500/20 text-blue-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/50'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-6 h-6 animate-spin" />
              Executando Testes...
            </>
          ) : (
            <>
              <Play className="w-6 h-6" />
              Executar Todos os Testes
            </>
          )}
        </motion.button>
      </div>

      {/* Lista de Testes */}
      <div className="space-y-3">
        {tests.map((test, index) => (
          <motion.div
            key={test.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-5 rounded-2xl border ${getStatusColor(test.status)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getStatusIcon(test.status)}
                <div>
                  <h3 className="font-bold text-white">{test.name}</h3>
                  {test.message && (
                    <p className="text-sm text-slate-400 mt-1">{test.message}</p>
                  )}
                </div>
              </div>

              {test.duration && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Zap className="w-4 h-4" />
                  {test.duration}ms
                </div>
              )}
            </div>

            {/* Mostrar dados do teste */}
            {test.data && test.status === 'success' && (
              <details className="mt-3">
                <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                  Ver dados
                </summary>
                <pre className="mt-2 p-3 bg-black/30 rounded-lg text-xs text-slate-300 overflow-auto max-h-40">
                  {JSON.stringify(test.data, null, 2)}
                </pre>
              </details>
            )}
          </motion.div>
        ))}
      </div>

      {/* IDs de Teste */}
      {sessionId && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">IDs Gerados</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-slate-400">Session ID:</span>
              <code className="text-purple-400 font-mono text-sm">{sessionId}</code>
            </div>
            {tradeId && (
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-slate-400">Trade ID:</span>
                <code className="text-purple-400 font-mono text-sm">{tradeId}</code>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-blue-400 mb-3">📋 Como Usar</h3>
        <ol className="space-y-2 text-slate-300">
          <li>1. Certifique-se de que a migration SQL foi executada no Supabase</li>
          <li>2. Faça login na plataforma</li>
          <li>3. Clique em "Executar Todos os Testes"</li>
          <li>4. Aguarde os resultados (leva ~5 segundos)</li>
          <li>5. Se todos passarem ✅ → Sistema funcionando!</li>
          <li>6. Se algum falhar ❌ → Veja a mensagem de erro</li>
        </ol>
      </div>
    </div>
  );
}
