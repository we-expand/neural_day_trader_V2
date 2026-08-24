import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mic, MicOff, Volume2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseActive } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';
import { JarvisOrb, type JarvisOrbHealth } from './JarvisOrb';
import { useJarvisVoice } from './useJarvisVoice';
import { toast } from 'sonner';

interface JarvisHealthSnapshot {
  snapshot_time: string;
  trades_6h: number | null;
  win_rate_6h: number | null;
  avg_pnl_6h: number | null;
  max_drawdown_6h: number | null;
  confidence_auc: number | null;
  confidence_brier_score: number | null;
  price_guard_breaches_6h: number | null;
  cost_gate_rejections_6h: number | null;
  jarvis_recommendation: string | null;
}

interface JarvisDecision {
  id: string;
  created_at: string;
  decision_type: string;
  target: string;
  action: string;
  evidence: Record<string, unknown>;
  confidence_level: number | null;
  status: string;
  magnitude_pct: number | null;
}

function classifyHealth(snapshot: JarvisHealthSnapshot | null): JarvisOrbHealth {
  if (!snapshot) return 'normal';
  if (snapshot.jarvis_recommendation === 'PAUSE') return 'critical';
  if (snapshot.jarvis_recommendation === 'REDUCE_SIZE') return 'warning';
  if ((snapshot.win_rate_6h ?? 1) < 0.315) return 'critical';
  if ((snapshot.win_rate_6h ?? 1) < 0.35) return 'warning';
  return 'normal';
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

export function JarvisDashboard() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<JarvisHealthSnapshot | null>(null);
  const [decisions, setDecisions] = useState<JarvisDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseActive) {
      setError('Supabase não está configurado neste ambiente.');
      setLoading(false);
      return;
    }
    setError(null);
    const [snapRes, decRes] = await Promise.all([
      supabase
        .from('jarvis_health_snapshots')
        .select('*')
        .order('snapshot_time', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('jarvis_decisions')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false }),
    ]);

    if (snapRes.error) setError(snapRes.error.message);
    else setSnapshot(snapRes.data as JarvisHealthSnapshot | null);

    if (decRes.error) setError((prev) => prev ?? decRes.error.message);
    else setDecisions((decRes.data ?? []) as JarvisDecision[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const health = useMemo(() => classifyHealth(snapshot), [snapshot]);

  const handleReview = useCallback(async (decision: JarvisDecision, approve: boolean) => {
    if (!isSupabaseActive) return;
    setBusyId(decision.id);
    const { error: updateError } = await supabase
      .from('jarvis_decisions')
      .update({
        status: approve ? 'ACTIVE' : 'REJECTED',
        approved_by: user?.email ?? 'cleber',
        approved_at: new Date().toISOString(),
      })
      .eq('id', decision.id)
      .eq('status', 'PENDING'); // evita corrida com o próprio ciclo do Jarvis

    setBusyId(null);
    if (updateError) {
      toast.error(`Falha ao ${approve ? 'aprovar' : 'rejeitar'}: ${updateError.message}`);
      return;
    }
    toast.success(`Decisão ${approve ? 'aprovada' : 'rejeitada'}: ${decision.target} → ${decision.action}`);
    setDecisions((prev) => prev.filter((d) => d.id !== decision.id));
  }, [user]);

  const speakSummary = useCallback((speakFn: (text: string) => void) => {
    if (!snapshot) {
      speakFn('Ainda não há snapshot de saúde registrado pelo Jarvis.');
      return;
    }
    const parts = [
      `Nas últimas seis horas, ${snapshot.trades_6h ?? 0} trades`,
      `taxa de acerto de ${fmtPct(snapshot.win_rate_6h)}`,
      snapshot.jarvis_recommendation && snapshot.jarvis_recommendation !== 'NORMAL'
        ? `recomendação do Jarvis: ${snapshot.jarvis_recommendation}`
        : 'operação normal',
      decisions.length > 0
        ? `${decisions.length} decisão${decisions.length > 1 ? 'ões' : ''} pendente${decisions.length > 1 ? 's' : ''} de aprovação`
        : 'nenhuma decisão pendente',
    ];
    speakFn(parts.join('. ') + '.');
  }, [snapshot, decisions]);

  const handleVoiceCommand = useCallback((transcript: string) => {
    const normalized = transcript.toLowerCase();

    if (normalized.includes('status') || normalized.includes('resumo') || normalized.includes('saúde')) {
      speakSummary(voice.speak);
      return;
    }

    if (normalized.includes('aprova')) {
      const target = decisions[0];
      if (target) {
        handleReview(target, true);
        voice.speak(`Aprovando a decisão sobre ${target.target}.`);
      } else {
        voice.speak('Não há decisões pendentes pra aprovar.');
      }
      return;
    }

    if (normalized.includes('rejeita') || normalized.includes('nega')) {
      const target = decisions[0];
      if (target) {
        handleReview(target, false);
        voice.speak(`Rejeitando a decisão sobre ${target.target}.`);
      } else {
        voice.speak('Não há decisões pendentes pra rejeitar.');
      }
      return;
    }

    voice.speak('Não entendi. Você pode pedir "status", "aprovar" ou "rejeitar".');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions, handleReview, speakSummary]);

  const voice = useJarvisVoice({ onCommand: handleVoiceCommand });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Jarvis — Segundo Cérebro do Motor</h1>
          <p className="text-sm text-slate-400">
            Visualização em tempo real de `jarvis_health_snapshots` e decisões pendentes de aprovação.
          </p>
        </div>
        {(voice.isSttSupported || voice.isTtsSupported) && (
          <div className="flex items-center gap-2">
            {voice.isSttSupported ? (
              <button
                onClick={() => (voice.state === 'listening' ? voice.stopListening() : voice.startListening())}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  voice.state === 'listening'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20'
                }`}
              >
                {voice.state === 'listening' ? <MicOff size={16} /> : <Mic size={16} />}
                {voice.state === 'listening' ? 'Ouvindo...' : 'Falar com o Jarvis'}
              </button>
            ) : (
              <span className="text-xs text-slate-500">Reconhecimento de voz não suportado neste navegador</span>
            )}
            {voice.isTtsSupported && (
              <button
                onClick={() => speakSummary(voice.speak)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 border border-slate-700 hover:bg-slate-800"
                title="Narrar resumo de saúde"
              >
                <Volume2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden relative">
          <JarvisOrb status={voice.state === 'listening' ? 'listening' : voice.state === 'speaking' ? 'speaking' : voice.state === 'thinking' ? 'thinking' : 'idle'} health={health} />
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <span className={`text-xs px-2 py-1 rounded-full ${
              health === 'critical' ? 'bg-red-500/20 text-red-300' :
              health === 'warning' ? 'bg-amber-500/20 text-amber-300' :
              'bg-cyan-500/20 text-cyan-300'
            }`}>
              {health === 'critical' ? 'Crítico' : health === 'warning' ? 'Atenção' : 'Normal'}
            </span>
          </div>
          {voice.transcript && (
            <div className="absolute top-3 left-3 right-3 text-xs text-slate-400 bg-black/40 rounded px-2 py-1">
              "{voice.transcript}"
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-4">Último snapshot de saúde (6h)</h2>
            {loading ? (
              <p className="text-slate-500 text-sm">Carregando...</p>
            ) : error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : !snapshot ? (
              <p className="text-slate-500 text-sm">Nenhum snapshot registrado ainda.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Stat label="Trades" value={String(snapshot.trades_6h ?? 0)} />
                <Stat label="Win rate" value={fmtPct(snapshot.win_rate_6h)} />
                <Stat label="PnL médio" value={snapshot.avg_pnl_6h != null ? `$${snapshot.avg_pnl_6h.toFixed(2)}` : '—'} />
                <Stat label="Drawdown máx" value={snapshot.max_drawdown_6h != null ? `$${snapshot.max_drawdown_6h.toFixed(2)}` : '—'} />
                <Stat label="Confidence AUC" value={snapshot.confidence_auc != null ? snapshot.confidence_auc.toFixed(2) : '—'} />
                <Stat label="Brier score" value={snapshot.confidence_brier_score != null ? snapshot.confidence_brier_score.toFixed(3) : '—'} />
                <Stat label="Price guard breaches" value={String(snapshot.price_guard_breaches_6h ?? 0)} />
                <Stat label="Cost gate rejections" value={String(snapshot.cost_gate_rejections_6h ?? 0)} />
              </div>
            )}
            {snapshot?.jarvis_recommendation && snapshot.jarvis_recommendation !== 'NORMAL' && (
              <div className="mt-4 flex items-center gap-2 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <AlertTriangle size={16} />
                Recomendação do Jarvis: {snapshot.jarvis_recommendation}
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-4">
              Decisões pendentes de aprovação ({decisions.length})
            </h2>
            {decisions.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhuma decisão aguardando aprovação.</p>
            ) : (
              <div className="space-y-3">
                {decisions.map((d) => (
                  <div key={d.id} className="border border-slate-800 rounded-xl p-4 bg-slate-950/50">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-white text-sm font-medium">
                          {d.decision_type} — {d.target}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">Ação: {d.action}</p>
                        {d.magnitude_pct != null && (
                          <p className="text-slate-500 text-xs">Magnitude: {d.magnitude_pct}%</p>
                        )}
                        <p className="text-slate-500 text-xs mt-1">
                          Evidência: {JSON.stringify(d.evidence)}
                        </p>
                        <p className="text-slate-600 text-xs mt-1">
                          {new Date(d.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={busyId === d.id}
                          onClick={() => handleReview(d, true)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40"
                        >
                          <CheckCircle2 size={14} /> Aprovar
                        </button>
                        <button
                          disabled={busyId === d.id}
                          onClick={() => handleReview(d, false)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40"
                        >
                          <XCircle size={14} /> Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}
