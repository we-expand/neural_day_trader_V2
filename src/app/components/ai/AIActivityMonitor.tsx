import React, { useEffect, useRef, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Clock, XCircle, AlertCircle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';

// 🔴 2026-09-07 (Cleber: "esta janela só mostra 'Aguardando' e nada mais",
// "o usuário gosta de saber tudo que está acontecendo com a IA"). Causa
// raiz: este componente inteiro era um hack que "sequestrava" console.log
// do navegador procurando por strings como "[AI LOOP]"/"[TRADING]"/
// "[DECISÃO FINAL]"/"[QUALIDADE]"/"[COOLDOWN]"/"[ANTI-HEDGING]" -- todas do
// motor MECÂNICO antigo, que rodava dentro do próprio navegador. Esse motor
// foi desligado definitivamente em 2026-08-31 (ver CLAUDE.md); o motor
// único hoje é o LLM Brain (`llm-active-brain/`), um processo Node headless
// rodando no servidor -- nunca escreve uma linha sequer no console do
// navegador de ninguém. Resultado: nenhuma dessas strings jamais apareceu
// de novo, o painel ficou preso em "Aguardando..." pra sempre, mesmo com a
// IA operando de verdade -- mesma classe de bug (e mesmo fix) já aplicado
// ao painel "Logs do Sistema" (AITrader.tsx) em 2026-09-06/07: ler
// `ai_brain_activity_log` (gravado ciclo a ciclo pelo próprio
// llm-active-brain) em vez de inventar uma fonte que não existe mais.
// Mantido o visual original (cards por tipo de evento, ação atual,
// indicador "Analisando"), só trocada a fonte de dado por uma real.

interface ActivityRow {
  id: string;
  type: string;
  symbol: string | null;
  message: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

interface AIActivity {
  id: string;
  timestamp: Date;
  kind: 'entry' | 'skip' | 'blocked' | 'info';
  symbol?: string;
  action: string;
  reason?: string;
  confidence?: number;
  side?: 'LONG' | 'SHORT';
}

/** Traduz uma linha real de `ai_brain_activity_log` pro cartão de atividade -- nunca fabrica dado, só reformata o que o motor realmente gravou. */
function toActivity(row: ActivityRow): AIActivity | null {
  const detail = row.detail as { name?: string; input?: Record<string, unknown>; result?: unknown } | null;

  if (row.type === 'decision' && detail?.name === 'open_position') {
    const input = detail.input as { symbol?: string; side?: 'LONG' | 'SHORT'; confidence?: number } | undefined;
    const result = detail.result as { error?: string } | undefined;
    if (result?.error) {
      return {
        id: row.id,
        timestamp: new Date(row.created_at),
        kind: 'blocked',
        symbol: input?.symbol ?? row.symbol ?? undefined,
        action: 'Entrada bloqueada',
        reason: result.error,
      };
    }
    return {
      id: row.id,
      timestamp: new Date(row.created_at),
      kind: 'entry',
      symbol: input?.symbol ?? row.symbol ?? undefined,
      side: input?.side,
      confidence: input?.confidence,
      action: `${input?.side === 'SHORT' ? 'VENDA' : 'COMPRA'} ${input?.symbol ?? row.symbol ?? ''}`.trim(),
    };
  }

  if (row.type === 'decision' && detail?.name === 'close_position') {
    return {
      id: row.id,
      timestamp: new Date(row.created_at),
      kind: 'info',
      symbol: row.symbol ?? undefined,
      action: `Fechou posição${row.symbol ? ` em ${row.symbol}` : ''}`,
    };
  }

  if (row.type === 'error') {
    return {
      id: row.id,
      timestamp: new Date(row.created_at),
      kind: 'blocked',
      symbol: row.symbol ?? undefined,
      action: 'Erro no ciclo',
      reason: row.message,
    };
  }

  if (row.type === 'tool_call' && row.symbol && /fora da cesta|obsoleta|spread/i.test(row.message)) {
    return {
      id: row.id,
      timestamp: new Date(row.created_at),
      kind: 'skip',
      symbol: row.symbol,
      action: 'Ativo ignorado',
      reason: row.message,
    };
  }

  // Cotações comuns (tool_call sem alerta) e "thinking" viram só a "Ação
  // Atual" no topo, não poluem o feed com um card por consulta -- útil
  // fica no feed é decisão/bloqueio/erro real, não cada get_mt5_quote.
  return null;
}

function currentActionFor(row: ActivityRow): string {
  if (row.type === 'cycle_start') return `🔄 ${row.message}`;
  if (row.type === 'thinking') return `⏳ ${row.message}`;
  if (row.type === 'thought') return `🧠 Refletindo sobre a cesta...`;
  if (row.type === 'tool_call' && row.symbol) return `📊 Consultando ${row.symbol}...`;
  if (row.type === 'tool_call') return `🔍 ${row.message}`;
  if (row.type === 'decision') return `✅ ${row.message}`;
  if (row.type === 'error') return `⚠️ ${row.message}`;
  return row.message;
}

export function AIActivityMonitor() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<AIActivity[]>([]);
  const [currentAction, setCurrentAction] = useState<string>('Aguardando...');
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const [nextEtaSeconds, setNextEtaSeconds] = useState<number | null>(null);
  const lastCycleGapMsRef = useRef<number>(40_000); // fallback: intervalo padrão do LLM Brain entre ciclos (index.ts)
  const subscribedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const applyRow = (row: ActivityRow) => {
      setCurrentAction(currentActionFor(row));
      const now = new Date(row.created_at);
      setLastEventAt((prev) => {
        if (prev) lastCycleGapMsRef.current = Math.max(5_000, now.getTime() - prev.getTime());
        return now;
      });
      const activity = toActivity(row);
      if (activity) setActivities((prev) => [activity, ...prev.slice(0, 19)]);
    };

    const setupForSession = async (sessionId: string) => {
      if (cancelled || sessionId === subscribedSessionIdRef.current) return;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      subscribedSessionIdRef.current = sessionId;

      try {
        const { data, error } = await supabase
          .from('ai_brain_activity_log')
          .select('id, type, symbol, message, detail, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(30);
        if (error) throw error;
        if (!cancelled && data && data.length > 0) {
          applyRow(data[0] as ActivityRow);
          [...data].reverse().forEach((row) => {
            const activity = toActivity(row as ActivityRow);
            if (activity) setActivities((prev) => [activity, ...prev].slice(0, 20));
          });
        }
      } catch (e) {
        console.warn('[AIActivityMonitor] Falha ao buscar histórico inicial (não bloqueia a tela):', e);
      }

      if (cancelled || sessionId !== subscribedSessionIdRef.current) return;
      channel = supabase
        .channel(`ai-activity-monitor-${sessionId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ai_brain_activity_log', filter: `session_id=eq.${sessionId}` },
          (payload) => {
            if (cancelled) return;
            applyRow(payload.new as ActivityRow);
          }
        )
        .subscribe();
    };

    // Mesma trava de fonte-única já usada em useApexLogic.ts (reconcile /
    // painel de logs): a sessão real é sempre a RUNNING/STOPPED mais recente
    // de strategy_name='LLM_ACTIVE_BRAIN_MT5', nunca a mais recente de
    // QUALQUER estratégia (evita mascarar com sessão órfã, ver
    // AITradingPersistenceService.ts:getActiveSession).
    const checkAndSync = async () => {
      if (cancelled) return;
      try {
        const { data: activeSessionRow } = await supabase
          .from('ai_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('strategy_name', 'LLM_ACTIVE_BRAIN_MT5')
          .in('status', ['RUNNING', 'STOPPED'])
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeSessionRow?.id) await setupForSession(activeSessionRow.id);
      } catch (err) {
        console.warn('[AIActivityMonitor] Falha ao checar sessão ativa (não bloqueia):', err);
      }
    };

    checkAndSync();
    const syncInterval = setInterval(checkAndSync, 5_000);

    return () => {
      cancelled = true;
      clearInterval(syncInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ETA real do "Próxima: Ns" -- baseado no intervalo REAL entre os 2
  // últimos eventos observados desta sessão (aproxima a cadência real de
  // ciclo do LLM Brain, ~40s padrão), nunca um número fabricado fixo.
  useEffect(() => {
    if (!lastEventAt) return;
    const tick = () => {
      const elapsedMs = Date.now() - lastEventAt.getTime();
      const remainingMs = lastCycleGapMsRef.current - elapsedMs;
      setNextEtaSeconds(remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastEventAt]);

  // "Analisando" pisca vivo quando o último evento real chegou há pouco
  // tempo (< 8s) -- reflete atividade de verdade, não uma animação
  // decorativa desconectada do que está acontecendo.
  const isAnalyzing = lastEventAt !== null && Date.now() - lastEventAt.getTime() < 8_000;

  return (
    <div className="border border-white/10 rounded-xl bg-gradient-to-br from-purple-950/20 to-black p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Atividade da IA
        </h3>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs text-purple-400">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Ao vivo
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {nextEtaSeconds !== null ? `Próxima: ~${nextEtaSeconds}s` : 'Aguardando ciclo'}
            </div>
          )}
        </div>
      </div>

      {/* Current Action */}
      <div className="mb-4 p-3 rounded-lg bg-black/40 border border-purple-500/20">
        <div className="text-xs text-slate-400 mb-1">Ação Atual</div>
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          {isAnalyzing && <Zap className="w-4 h-4 text-purple-400 animate-pulse" />}
          {currentAction}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nenhuma decisão/bloqueio registrado ainda nesta sessão...
              <br />
              A cesta está sendo consultada -- acompanhe em "Ação Atual" acima.
            </div>
          ) : (
            activities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-3 rounded-lg border ${
                  activity.kind === 'entry'
                    ? 'bg-emerald-950/30 border-emerald-500/30'
                    : activity.kind === 'skip'
                    ? 'bg-yellow-950/20 border-yellow-500/20'
                    : activity.kind === 'blocked'
                    ? 'bg-red-950/20 border-red-500/20'
                    : 'bg-slate-950/30 border-slate-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {activity.kind === 'entry' && (
                        <>
                          {activity.side === 'LONG' ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                          <span className="text-xs font-semibold text-emerald-400">
                            {activity.action}
                          </span>
                        </>
                      )}

                      {activity.kind === 'skip' && (
                        <>
                          <XCircle className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs font-semibold text-yellow-400">
                            {activity.symbol || 'Setup Rejeitado'}
                          </span>
                        </>
                      )}

                      {activity.kind === 'blocked' && (
                        <>
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          <span className="text-xs font-semibold text-red-400">
                            {activity.action}
                          </span>
                        </>
                      )}

                      {activity.kind === 'info' && (
                        <span className="text-xs font-semibold text-slate-300">
                          {activity.action}
                        </span>
                      )}
                    </div>

                    {activity.reason && (
                      <div className="text-xs text-slate-400 ml-5 break-words">
                        {activity.reason}
                      </div>
                    )}

                    {activity.confidence !== undefined && (
                      <div className="text-xs text-slate-500 ml-5">
                        Confiança: {activity.confidence}%
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 shrink-0">
                    {activity.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
