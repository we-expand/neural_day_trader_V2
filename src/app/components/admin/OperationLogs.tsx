import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollText, Download, RefreshCw, CheckCircle2, XCircle, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { aiPersistence, AITrade, AIDecision, AISession } from '@/app/services/AITradingPersistenceService';

type Tab = 'trades' | 'decisions';

function toUtcDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDateKey(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => {
      const s = cell === null || cell === undefined ? '' : String(cell);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const VETO_LABELS: Record<string, string> = {
  CONTEXT_SCORE_OPPOSITE: 'Market Score contrário',
  CONTEXT_SCORE_LATERAL: 'Market Score lateral (confiança insuficiente)',
  CONTEXT_CONFIDENCE: 'Confiança combinada abaixo do mínimo',
  CONTEXT_GATE: 'Context Gate / Proteção de Cauda',
  CONFIG_DIRECTION: 'Direção travada pelo usuário',
  COST_GATE: 'Custo inviabiliza a operação',
  COST_GATE_NO_DATA: 'ATR indisponível (sem dado de custo)',
  RISK_GATE: 'Gate de risco (perda diária / drawdown)',
  KILL_SWITCH: 'Kill-switch acionado',
  COOLDOWN: 'Cooldown pós-perdas ativo',
  MAX_TRADES_PER_DAY: 'Limite diário de trades atingido',
  REVENGE_PATTERN: 'Padrão de revenge trading detectado',
};

export function OperationLogs() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('trades');
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<AITrade[]>([]);
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const startIso = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      const endIso = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      const [t, d, s] = await Promise.all([
        aiPersistence.getUserTrades(user.id, { startDate: startIso, endDate: endIso }),
        aiPersistence.getUserDecisions(user.id, { startDate: startIso, endDate: endIso }),
        aiPersistence.getUserSessions(user.id, 200),
      ]);
      setTrades(t);
      setDecisions(d);
      setSessions(s);
    } finally {
      setLoading(false);
    }
  }, [user?.id, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const sessionModeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sessions) if (s.id) map[s.id] = s.mode;
    return map;
  }, [sessions]);

  const symbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => set.add(t.symbol));
    decisions.forEach((d) => set.add(d.symbol));
    return Array.from(set).sort();
  }, [trades, decisions]);

  const filteredTrades = useMemo(() => trades.filter((t) => {
    if (symbolFilter !== 'ALL' && t.symbol !== symbolFilter) return false;
    if (modeFilter !== 'ALL' && sessionModeById[t.session_id] !== modeFilter) return false;
    return true;
  }), [trades, symbolFilter, modeFilter, sessionModeById]);

  const filteredDecisions = useMemo(() => decisions.filter((d) => {
    if (symbolFilter !== 'ALL' && d.symbol !== symbolFilter) return false;
    if (modeFilter !== 'ALL' && sessionModeById[d.session_id] !== modeFilter) return false;
    return true;
  }), [decisions, symbolFilter, modeFilter, sessionModeById]);

  const stats = useMemo(() => {
    const closed = filteredTrades.filter((t) => t.status === 'CLOSED');
    const wins = closed.filter((t) => Number(t.net_pnl ?? t.pnl ?? 0) > 0);
    const losses = closed.filter((t) => Number(t.net_pnl ?? t.pnl ?? 0) < 0);
    const grossProfit = wins.reduce((sum, t) => sum + Number(t.net_pnl ?? t.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + Number(t.net_pnl ?? t.pnl ?? 0), 0));
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
    const netPnl = closed.reduce((sum, t) => sum + Number(t.net_pnl ?? t.pnl ?? 0), 0);
    const approved = filteredDecisions.filter((d) => d.action_taken).length;
    const vetoed = filteredDecisions.filter((d) => !d.action_taken).length;
    return { closedCount: closed.length, winCount: wins.length, lossCount: losses.length, winRate, profitFactor, netPnl, approved, vetoed, totalDecisions: filteredDecisions.length };
  }, [filteredTrades, filteredDecisions]);

  const vetoBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDecisions.filter((d) => !d.action_taken && d.veto_stage).forEach((d) => {
      counts[d.veto_stage!] = (counts[d.veto_stage!] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredDecisions]);

  const tradesByDay = useMemo(() => {
    const map: Record<string, AITrade[]> = {};
    filteredTrades.forEach((t) => {
      const key = toUtcDateKey(t.entry_time);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTrades]);

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const exportTradesCsv = () => {
    const header = ['Data', 'Hora', 'Sessão (modo)', 'Símbolo', 'Tipo', 'Lado', 'Preço Entrada', 'Preço Saída', 'Quantidade', 'Stop Loss', 'Take Profit', 'PnL', 'PnL líquido', 'Comissão', 'Confiança IA (%)', 'Motivo saída', 'Duração (s)', 'Status', 'Raciocínio IA'];
    const rows = filteredTrades.map((t) => [
      toUtcDateKey(t.entry_time), formatTime(t.entry_time), sessionModeById[t.session_id] || '',
      t.symbol, t.type, t.side, t.entry_price, t.exit_price ?? '', t.quantity, t.stop_loss ?? '', t.take_profit ?? '',
      t.pnl ?? '', t.net_pnl ?? '', t.commission ?? '', t.ai_confidence ?? '', t.exit_reason ?? '', t.duration_seconds ?? '', t.status, t.ai_reasoning ?? '',
    ]);
    downloadCsv(`neural-day-trader_trades_${startDate}_a_${endDate}.csv`, [header, ...rows]);
  };

  const exportDecisionsCsv = () => {
    const header = ['Data', 'Hora', 'Sessão (modo)', 'Símbolo', 'Decisão', 'Confiança (%)', 'Score de Mercado', 'Executado?', 'Etapa de veto', 'Raciocínio'];
    const rows = filteredDecisions.map((d) => [
      toUtcDateKey(d.timestamp), formatTime(d.timestamp), sessionModeById[d.session_id] || '',
      d.symbol, d.decision, d.confidence ?? '', d.market_score ?? '', d.action_taken ? 'SIM' : 'NÃO', d.veto_stage ? (VETO_LABELS[d.veto_stage] || d.veto_stage) : '', d.reasoning,
    ]);
    downloadCsv(`neural-day-trader_decisoes_${startDate}_a_${endDate}.csv`, [header, ...rows]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      <div className="flex items-center gap-3 mb-2">
        <ScrollText className="w-7 h-7 text-emerald-400" />
        <h1 className="text-2xl font-bold">Logs de Operações — Auditoria</h1>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Registro completo e evidenciável de tudo que a IA decidiu — operações executadas e também as que foram recusadas, com o motivo. Base para prestar contas de acurácia e comportamento a qualquer momento.
      </p>

      {/* Filtros */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> De</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Até</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Símbolo</label>
          <select value={symbolFilter} onChange={(e) => setSymbolFilter(e.target.value)} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="ALL">Todos</option>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Modo</label>
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="ALL">Todos</option>
            <option value="DEMO">DEMO</option>
            <option value="LIVE">LIVE</option>
            <option value="BACKTEST">BACKTEST</option>
          </select>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg px-4 py-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Taxa de acerto</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.winRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">{stats.winCount}W / {stats.lossCount}L de {stats.closedCount} fechados</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">PnL líquido (período)</p>
          <p className={`text-2xl font-bold ${stats.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.netPnl.toFixed(4)}</p>
          <p className="text-xs text-slate-500 mt-1">Profit factor: {isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Decisões aprovadas</p>
          <p className="text-2xl font-bold text-white">{stats.approved}</p>
          <p className="text-xs text-slate-500 mt-1">de {stats.totalDecisions} avaliadas</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Decisões vetadas</p>
          <p className="text-2xl font-bold text-amber-400">{stats.vetoed}</p>
          <p className="text-xs text-slate-500 mt-1">disciplina de execução em ação</p>
        </div>
      </div>

      {vetoBreakdown.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Motivos de veto no período</p>
          <div className="flex flex-wrap gap-2">
            {vetoBreakdown.map(([stage, count]) => (
              <span key={stage} className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full px-3 py-1">
                {VETO_LABELS[stage] || stage}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-white/10">
        <button onClick={() => setTab('trades')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'trades' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}>
          Trades executados ({filteredTrades.length})
        </button>
        <button onClick={() => setTab('decisions')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'decisions' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}>
          Funil completo de decisões ({filteredDecisions.length})
        </button>
        <div className="flex-1" />
        <button onClick={tab === 'trades' ? exportTradesCsv : exportDecisionsCsv} className="flex items-center gap-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg px-3 py-2 mb-1">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm">Carregando...</p>}

      {!loading && tab === 'trades' && (
        <div className="space-y-3">
          {tradesByDay.length === 0 && <p className="text-slate-500 text-sm">Nenhum trade no período selecionado.</p>}
          {tradesByDay.map(([day, dayTrades]) => {
            const expanded = expandedDays.has(day);
            const dayNetPnl = dayTrades.reduce((sum, t) => sum + Number(t.net_pnl ?? t.pnl ?? 0), 0);
            return (
              <div key={day} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => toggleDay(day)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5">
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-medium">{formatDateKey(day)}</span>
                    <span className="text-xs text-slate-500">{dayTrades.length} operações</span>
                  </div>
                  <span className={`text-sm font-semibold ${dayNetPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{dayNetPnl.toFixed(4)}</span>
                </button>
                {expanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-t border-white/10">
                          <th className="text-left px-4 py-2">Hora</th>
                          <th className="text-left px-4 py-2">Símbolo</th>
                          <th className="text-left px-4 py-2">Lado</th>
                          <th className="text-right px-4 py-2">Entrada</th>
                          <th className="text-right px-4 py-2">Saída</th>
                          <th className="text-right px-4 py-2">Qtd</th>
                          <th className="text-right px-4 py-2">PnL líquido</th>
                          <th className="text-right px-4 py-2">Confiança</th>
                          <th className="text-left px-4 py-2">Motivo saída</th>
                          <th className="text-left px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayTrades.map((t) => (
                          <tr key={t.id} className="border-t border-white/5 hover:bg-white/5" title={t.ai_reasoning}>
                            <td className="px-4 py-2">{formatTime(t.entry_time)}</td>
                            <td className="px-4 py-2 font-medium">{t.symbol}</td>
                            <td className="px-4 py-2">{t.side}</td>
                            <td className="px-4 py-2 text-right">{t.entry_price}</td>
                            <td className="px-4 py-2 text-right">{t.exit_price ?? '—'}</td>
                            <td className="px-4 py-2 text-right">{t.quantity}</td>
                            <td className={`px-4 py-2 text-right font-medium ${Number(t.net_pnl ?? t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(t.net_pnl ?? t.pnl ?? 0)?.toString()}</td>
                            <td className="px-4 py-2 text-right">{t.ai_confidence}%</td>
                            <td className="px-4 py-2">{t.exit_reason ?? '—'}</td>
                            <td className="px-4 py-2">{t.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'decisions' && (
        <div className="overflow-x-auto bg-white/5 border border-white/10 rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left px-4 py-2">Data / Hora</th>
                <th className="text-left px-4 py-2">Símbolo</th>
                <th className="text-left px-4 py-2">Decisão</th>
                <th className="text-right px-4 py-2">Confiança</th>
                <th className="text-center px-4 py-2">Executado?</th>
                <th className="text-left px-4 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredDecisions.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500 px-4 py-6">Nenhuma decisão registrada no período selecionado.</td></tr>
              )}
              {filteredDecisions.map((d) => (
                <tr key={d.id} className="border-t border-white/5 hover:bg-white/5 align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{toUtcDateKey(d.timestamp)} {formatTime(d.timestamp)}</td>
                  <td className="px-4 py-2 font-medium">{d.symbol}</td>
                  <td className="px-4 py-2">{d.decision}</td>
                  <td className="px-4 py-2 text-right">{d.confidence}%</td>
                  <td className="px-4 py-2 text-center">
                    {d.action_taken
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                      : <XCircle className="w-4 h-4 text-amber-400 inline" />}
                    {!d.action_taken && d.veto_stage && (
                      <div className="text-[10px] text-amber-400 mt-0.5">{VETO_LABELS[d.veto_stage] || d.veto_stage}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-400 max-w-xl">{d.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
