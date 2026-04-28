/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - AI SESSION HISTORY                          ║
 * ║  Dashboard para visualizar histórico de sessões da AI            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  DollarSign,
  BarChart3,
  Target,
  AlertCircle,
  Calendar,
  ChevronRight,
  Play,
  Pause,
  CheckCircle,
} from 'lucide-react';
import { aiPersistence, AISession } from '@/app/services/AITradingPersistenceService';
import { useAuth } from '@/app/contexts/AuthContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function AISessionHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [selectedSession, setSelectedSession] = useState<AISession | null>(null);
  const [equityCurve, setEquityCurve] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar sessões
  useEffect(() => {
    if (user?.id) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await aiPersistence.getUserSessions(user.id, 50);
      setSessions(data);
      
      // Selecionar última sessão automaticamente
      if (data.length > 0) {
        selectSession(data[0]);
      }
    } catch (error) {
      console.error('[AI History] Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (session: AISession) => {
    setSelectedSession(session);
    
    // Carregar detalhes da sessão
    if (session.id) {
      const [snapshotsData, tradesData] = await Promise.all([
        aiPersistence.getSessionSnapshots(session.id),
        aiPersistence.getSessionTrades(session.id),
      ]);

      // Formatar equity curve para o gráfico
      const formattedCurve = snapshotsData.map((snap, idx) => ({
        time: new Date(snap.timestamp).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        equity: Number(snap.equity),
        balance: Number(snap.balance),
        index: idx,
      }));

      setEquityCurve(formattedCurve);
      setTrades(tradesData);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Play className="w-4 h-4 text-green-500 animate-pulse" />;
      case 'PAUSED':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'PAUSED':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'COMPLETED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'ERROR':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
        <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">Nenhuma sessão encontrada</h3>
        <p className="text-slate-400 mb-6">
          Ative o AI Trader para começar a registrar sessões
        </p>
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
          <Play className="w-4 h-4" />
          <span>Aguardando primeira sessão...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Histórico de Sessões</h2>
          <p className="text-slate-400">
            {sessions.length} sessão{sessions.length !== 1 ? 'ões' : ''} registrada{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Lista de Sessões */}
        <div className="col-span-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Suas Sessões
          </h3>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {sessions.map((session) => (
              <motion.button
                key={session.id}
                onClick={() => selectSession(session)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full p-4 rounded-xl border transition-all text-left ${
                  selectedSession?.id === session.id
                    ? 'bg-white/10 border-white/20'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(session.status || 'COMPLETED')}
                    <span className="font-semibold text-white text-sm">
                      {session.strategy_name}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <Calendar className="w-3 h-3" />
                  {new Date(session.started_at || '').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <div className={`px-2 py-1 rounded text-xs border ${getStatusColor(session.status || 'COMPLETED')}`}>
                    {session.status || 'COMPLETED'}
                  </div>

                  {session.net_pnl !== undefined && (
                    <div className={`flex items-center gap-1 text-sm font-bold ${
                      session.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {session.net_pnl >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      ${Math.abs(session.net_pnl).toFixed(2)}
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Detalhes da Sessão */}
        <div className="col-span-8 space-y-6">
          {selectedSession ? (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-4 gap-4">
                <KPICard
                  title="P&L Total"
                  value={`$${(selectedSession.net_pnl || 0).toFixed(2)}`}
                  change={selectedSession.net_pnl && selectedSession.net_pnl >= 0 ? '+' : ''}
                  icon={DollarSign}
                  color={selectedSession.net_pnl && selectedSession.net_pnl >= 0 ? 'green' : 'red'}
                />
                <KPICard
                  title="Win Rate"
                  value={`${(selectedSession.win_rate || 0).toFixed(1)}%`}
                  icon={Target}
                  color="blue"
                />
                <KPICard
                  title="Total Trades"
                  value={`${selectedSession.total_trades || 0}`}
                  icon={BarChart3}
                  color="purple"
                />
                <KPICard
                  title="Drawdown"
                  value={`${(selectedSession.max_drawdown || 0).toFixed(2)}%`}
                  icon={TrendingDown}
                  color="orange"
                />
              </div>

              {/* Equity Curve */}
              {equityCurve.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Equity Curve</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={equityCurve}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        stroke="#64748b"
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                        formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Equity']}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorEquity)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Lista de Trades */}
              {trades.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Trades ({trades.length})
                  </h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {trades.slice(0, 10).map((trade) => (
                      <div
                        key={trade.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`px-2 py-1 rounded text-xs font-bold ${
                            trade.side === 'LONG'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.side}
                          </div>
                          <span className="text-white font-medium">{trade.symbol}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(trade.entry_time).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-sm text-slate-400">
                            ${Number(trade.entry_price).toFixed(4)}
                          </div>
                          {trade.net_pnl !== null && (
                            <div className={`text-sm font-bold ${
                              trade.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {trade.net_pnl >= 0 ? '+' : ''}${Number(trade.net_pnl).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Selecione uma sessão para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ title, value, change, icon: Icon, color }: any) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-400 border-green-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium opacity-80">{title}</span>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {change && (
        <div className="text-xs opacity-60 mt-1">{change}</div>
      )}
    </div>
  );
}
