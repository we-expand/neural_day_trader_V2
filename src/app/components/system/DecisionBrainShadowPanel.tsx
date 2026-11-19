import { useCallback, useEffect, useRef, useState } from 'react';
import { BrainCircuit, ChevronDown, ChevronUp, Eye, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase, isSupabaseActive } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';

/**
 * Painel de OBSERVAÇÃO do cérebro de decisão analítico (modo sombra,
 * 2026-08-28). Existe pra dar visibilidade interativa do que o cérebro
 * está raciocinando em tempo real — NUNCA dá a ele autoridade sobre trade
 * real. Essa é uma decisão de produto explícita (ver
 * research/experiments/2026-08-28-decision-brain-shadow-mode/hypothesis.md):
 * a Fase 1 (acumular amostra pra frente, n≥100) e a Fase 2 (avaliação
 * estatística) precisam terminar antes de cogitar ligar de verdade — este
 * painel é só leitura sobre `ai_decision_brain_shadow`, não escreve nada.
 */

type BrainAction = 'PROCEED' | 'SKIP' | 'FLIP';
type HypotheticalOutcome = 'WIN' | 'LOSS' | 'TIMEOUT' | 'NO_DATA' | null;

interface ShadowDecisionRow {
  id: string;
  created_at: string;
  symbol: string;
  mechanical_action: 'PROCEED' | 'REJECT';
  mechanical_side: 'LONG' | 'SHORT' | null;
  brain_action: BrainAction;
  brain_side: 'LONG' | 'SHORT' | null;
  brain_confidence: number | null;
  brain_reasoning: string;
  brain_provider: string;
  brain_error: string | null;
  hypothetical_outcome: HypotheticalOutcome;
  hypothetical_r_multiple: number | null;
}

const POLL_INTERVAL_MS = 20_000;
const ROW_LIMIT = 30;

const ACTION_BADGE: Record<BrainAction, string> = {
  PROCEED: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  SKIP: 'bg-zinc-700/40 text-zinc-300 border border-zinc-600/40',
  FLIP: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const OUTCOME_BADGE: Record<string, string> = {
  WIN: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  LOSS: 'bg-red-500/15 text-red-300 border border-red-500/30',
  TIMEOUT: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  NO_DATA: 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/40',
  PENDENTE: 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40',
};

function agreesWithMechanical(row: ShadowDecisionRow): 'concorda' | 'discorda' | 'n/a' {
  if (row.mechanical_action === 'REJECT') {
    return row.brain_action === 'SKIP' ? 'concorda' : 'discorda';
  }
  if (row.brain_action === 'PROCEED') return 'concorda';
  return 'discorda'; // SKIP ou FLIP num candidato que o mecânico teria aberto
}

export function DecisionBrainShadowPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ShadowDecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseActive || !user?.id) {
      setLoading(false);
      return;
    }
    const { data, error: fetchError } = await supabase
      .from('ai_decision_brain_shadow')
      .select(
        'id, created_at, symbol, mechanical_action, mechanical_side, brain_action, brain_side, brain_confidence, brain_reasoning, brain_provider, brain_error, hypothetical_outcome, hypothetical_r_multiple'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setRows((data ?? []) as ShadowDecisionRow[]);
    }
    setLastUpdate(new Date());
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  const agreeCount = rows.filter(r => agreesWithMechanical(r) === 'concorda').length;
  const disagreeCount = rows.length - agreeCount;
  const evaluatedCount = rows.filter(r => r.hypothetical_outcome && r.hypothetical_outcome !== 'NO_DATA').length;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/30">
            <BrainCircuit className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Cérebro Analítico — Modo Sombra</h3>
            <p className="text-slate-400 text-sm">
              {lastUpdate ? `Última atualização: ${lastUpdate.toLocaleTimeString('pt-BR')}` : 'Carregando...'}
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-2 rounded-lg font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 text-slate-300 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="flex items-start gap-3 bg-amber-950/20 border border-amber-800/40 rounded-lg p-3 mb-5">
        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-200/90 text-sm">
          <span className="font-semibold">Somente observação.</span> Este cérebro nunca decide trade real —
          ele registra o que faria, em paralelo ao motor mecânico, pra acumular amostra estatística antes de
          qualquer decisão de ligá-lo de verdade (ver <span className="font-mono text-xs">hypothesis.md</span>,
          Fases 1-3).
        </p>
      </div>

      {!isSupabaseActive || !user?.id ? (
        <p className="text-slate-500 text-sm py-6 text-center">Sem sessão autenticada para carregar o histórico.</p>
      ) : error ? (
        <p className="text-red-400 text-sm py-6 text-center">Falha ao carregar: {error}</p>
      ) : loading && rows.length === 0 ? (
        <div className="text-center py-8">
          <Eye className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">Carregando decisões recentes...</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm py-6 text-center">
          Nenhuma decisão registrada ainda — aparece aqui assim que o motor (ai-runner) avaliar o primeiro
          candidato com uma sessão ativa.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
              <p className="text-emerald-400 text-xs font-semibold uppercase mb-1">Concorda c/ mecânico</p>
              <p className="text-white text-2xl font-bold">{agreeCount}</p>
            </div>
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
              <p className="text-amber-400 text-xs font-semibold uppercase mb-1">Discorda (SKIP/FLIP)</p>
              <p className="text-white text-2xl font-bold">{disagreeCount}</p>
            </div>
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
              <p className="text-blue-400 text-xs font-semibold uppercase mb-1">Já com resultado real</p>
              <p className="text-white text-2xl font-bold">{evaluatedCount}/{rows.length}</p>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map(row => {
              const outcomeLabel: string = row.hypothetical_outcome ?? 'PENDENTE';
              const isExpanded = expandedId === row.id;
              return (
                <div key={row.id} className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-slate-400 text-xs">
                        {new Date(row.created_at).toLocaleTimeString('pt-BR')}
                      </span>
                      <span className="text-white font-bold">{row.symbol}</span>
                      <span className="text-slate-500 text-xs">
                        mecânico: {row.mechanical_action === 'REJECT' ? 'REJECT' : row.mechanical_side}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ACTION_BADGE[row.brain_action]}`}>
                        cérebro: {row.brain_action}
                        {/* Lado só é decisão de fato em PROCEED/FLIP — em SKIP o
                            cérebro não escolheu lado nenhum, `brain_side` aqui é
                            o lado do candidato que ele recusou, não do próprio SKIP. */}
                        {row.brain_side && row.brain_action !== 'SKIP' ? ` ${row.brain_side}` : ''}
                      </span>
                      {row.brain_confidence !== null && (
                        <span className="text-slate-400 text-xs">conf. {Math.round(row.brain_confidence)}%</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${OUTCOME_BADGE[outcomeLabel] ?? OUTCOME_BADGE.PENDENTE}`}>
                        {outcomeLabel}
                        {row.hypothetical_r_multiple !== null ? ` (${row.hypothetical_r_multiple > 0 ? '+' : ''}${row.hypothetical_r_multiple.toFixed(1)}R)` : ''}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 text-sm text-slate-300 leading-relaxed">
                      {row.brain_error ? (
                        <p className="text-red-400">Chamada ao LLM falhou: {row.brain_error}</p>
                      ) : (
                        <p>{row.brain_reasoning}</p>
                      )}
                      <p className="text-slate-500 text-xs mt-2">provedor: {row.brain_provider}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
