// Detector de "IA ligada mas travada" — 2026-08-17.
//
// POR QUE EXISTE: até hoje, quando uma configuração do usuário bloqueava
// 100% das entradas (exemplo real medido: multiplicador de ATR alto demais
// encolhendo o tamanho da posição pra sempre abaixo do mínimo executável),
// o único jeito de descobrir era abrir o Supabase e ler `ai_decisions` — algo
// que nenhum usuário de verdade vai fazer. Resultado real: 10 dias com a IA
// "ligada" e zero entrada, sem nenhum aviso. Isso não é sobre este bug
// específico: é uma classe inteira de falha — qualquer combinação futura de
// configs que bloqueie tudo silenciosamente cai no mesmo buraco.
//
// Este hook não tenta prever CADA combinação ruim possível (impossível de
// enumerar). Em vez disso, olha o sintoma universal de todas elas: um único
// motivo de veto dominando o funil por tempo suficiente, com volume
// suficiente pra não ser ruído de amostra pequena.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';
import { FUNNEL_STAGE_LABELS, type FunnelStage } from '@/app/services/telemetry/FunnelTelemetry';

/** Abaixo desse número de avaliações, a amostra é pequena demais pra apontar dedo pra uma causa. */
const MIN_EVALUATIONS_FOR_VERDICT = 30;
/** Fração do funil que um único estágio precisa dominar pra virar alerta. */
const DOMINANCE_THRESHOLD = 0.7;
/** Janela de tempo olhada pra trás — recente o bastante pra refletir a config atual. */
const LOOKBACK_MS = 20 * 60 * 1000;
const POLL_INTERVAL_MS = 60 * 1000;

export interface AIStuckVerdict {
  stuck: boolean;
  dominantStage: FunnelStage | null;
  dominantLabel: string | null;
  dominantShare: number;
  totalEvaluations: number;
  suggestion: string | null;
}

/**
 * Sugestão de ação por estágio — só pros estágios que fazem sentido como
 * "problema de configuração do usuário, ele pode agir agora". Estágios que
 * são estado de mercado (ex: CANDLES_FETCH_FAILED por rate-limit da
 * corretora) não têm ação do usuário — o texto explica isso em vez de sugerir
 * uma mudança que não resolveria nada.
 */
const STUCK_SUGGESTIONS: Partial<Record<FunnelStage, string>> = {
  MIN_TRADE_SIZE:
    'O tamanho de posição calculado está ficando abaixo do mínimo executável ($10). ' +
    'Aumente o capital alocado, aumente o risco por trade, ou (se "Modo de Cálculo" estiver em ' +
    '"Ajustado por ATR") reduza o Multiplicador ATR para perto de 1,5x.',
  MARKET_MODE_MISMATCH:
    'O regime de mercado medido não está batendo com o "Fluxo de Operação" escolhido ' +
    '(A Favor/Contra). Considere deixar mais flexível ou aguardar o mercado definir uma direção clara.',
  COST_GATE:
    'O custo estimado da operação está consumindo demais o movimento típico deste ativo/timeframe. ' +
    'Considere um timeframe maior ou revisar os ativos selecionados no Universo de Ativos.',
  STRATEGY_CONFIDENCE_LOW:
    'A confiança da estratégia está ficando abaixo do mínimo exigido pelo Perfil de Risco. ' +
    'Considere um perfil mais agressivo ou trocar de estratégia.',
  CANDLES_FETCH_FAILED:
    'A corretora (MetaAPI) está limitando ou falhando nas requisições de histórico no momento — ' +
    'isso é externo à sua configuração e tende a se resolver sozinho. Se persistir por muito tempo, ' +
    'avise o suporte.',
  DATA_NOT_REAL:
    'Sem preço real disponível da corretora para os ativos selecionados neste momento — ' +
    'externo à sua configuração, deve se resolver quando o dado voltar.',
  ASSET_MAX_DISTINCT:
    'O teto de "Ativos Simultâneos" já foi atingido pelas posições abertas. Aumente o teto ou ' +
    'aguarde alguma posição fechar.',
  TICK_NO_ASSETS_CONFIGURED:
    'Nenhum ativo selecionado em "Universo de Ativos" — selecione ao menos um.',
};

/**
 * Busca a sessão `RUNNING` mais recente do usuário e, se houver, consulta
 * `ai_funnel_snapshots` a cada minuto pra detectar dominância de um único
 * motivo de veto. Client-side de propósito e lendo o BANCO como fonte de
 * verdade (não estado do React) — a sessão pode ter sido criada/reiniciada
 * por qualquer driver (navegador ou runner de servidor); depender de um
 * `sessionId` passado via Context arriscaria mostrar o banner sobre uma
 * sessão errada ou desatualizada, exatamente a classe de confusão
 * driver-duplo encontrada nesta mesma sessão de trabalho (2026-08-17).
 */
export function useAIStuckDetector(): AIStuckVerdict {
  const { user } = useAuth();
  const [verdict, setVerdict] = useState<AIStuckVerdict>({
    stuck: false,
    dominantStage: null,
    dominantLabel: null,
    dominantShare: 0,
    totalEvaluations: 0,
    suggestion: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setVerdict(v => (v.stuck ? { ...v, stuck: false } : v));
      return;
    }

    let cancelled = false;

    const check = async () => {
      const { data: session, error: sessionError } = await supabase
        .from('ai_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'RUNNING')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (sessionError || !session) {
        setVerdict(v => (v.stuck ? { ...v, stuck: false } : v));
        return;
      }

      const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
      const { data, error } = await supabase
        .from('ai_funnel_snapshots')
        .select('stage_counts')
        .eq('session_id', session.id)
        .gte('created_at', since);

      if (cancelled || error || !data) return;

      const totals: Record<string, number> = {};
      for (const row of data) {
        const counts = (row as { stage_counts?: Record<string, number> }).stage_counts ?? {};
        for (const [stage, n] of Object.entries(counts)) {
          if (stage.startsWith('TICK_')) continue; // saídas de tick não têm denominador comparável
          totals[stage] = (totals[stage] ?? 0) + n;
        }
      }

      const totalEvaluations = Object.values(totals).reduce((s, n) => s + n, 0);
      if (totalEvaluations < MIN_EVALUATIONS_FOR_VERDICT) {
        setVerdict({ stuck: false, dominantStage: null, dominantLabel: null, dominantShare: 0, totalEvaluations, suggestion: null });
        return;
      }

      const entryExecuted = totals['ENTRY_EXECUTED'] ?? 0;
      if (entryExecuted > 0) {
        // Já entrou pelo menos uma vez na janela — não é "travado", é operando.
        setVerdict({ stuck: false, dominantStage: null, dominantLabel: null, dominantShare: 0, totalEvaluations, suggestion: null });
        return;
      }

      let dominantStage: FunnelStage | null = null;
      let dominantCount = 0;
      for (const [stage, n] of Object.entries(totals)) {
        if (n > dominantCount) {
          dominantStage = stage as FunnelStage;
          dominantCount = n;
        }
      }

      const dominantShare = dominantStage ? dominantCount / totalEvaluations : 0;
      const stuck = dominantStage !== null && dominantShare >= DOMINANCE_THRESHOLD;

      setVerdict({
        stuck,
        dominantStage: stuck ? dominantStage : null,
        dominantLabel: stuck && dominantStage ? (FUNNEL_STAGE_LABELS[dominantStage] ?? dominantStage) : null,
        dominantShare,
        totalEvaluations,
        suggestion: stuck && dominantStage ? (STUCK_SUGGESTIONS[dominantStage] ?? null) : null,
      });
    };

    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id]);

  return verdict;
}
