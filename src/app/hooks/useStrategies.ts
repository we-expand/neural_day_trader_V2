import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';
import { Strategy } from '@/app/types/strategy';
import { PRESET_STRATEGIES } from '@/app/data/presetStrategies';

interface StrategyRow {
  id: string;
  user_id: string | null;
  is_preset: boolean;
  name: string;
  description: string | null;
  definition: Partial<Strategy> | Record<string, never>;
  created_at: string;
  updated_at: string;
}

/**
 * `null` sinaliza "linha de preset órfã" — descartar, nunca expor. Acontece
 * quando o número/id de presets muda (ex: 2026-07-24, 6 presets viraram 4
 * pelo redesenho baseado em pesquisa) e uma linha antiga de seed no Supabase
 * (`is_preset:true`, `definition:{}`) não tem mais correspondência local. Sem
 * este descarte, a linha zumbi seria exposta com entryBlocks/stopLoss/etc
 * undefined — e `evaluateStrategyAt` quebra ao tentar `.filter()` em
 * undefined assim que o usuário (ou uma config antiga salva) selecionasse
 * esse id. Nunca uma migration de banco é necessária pra isso: o filtro é
 * puramente no client, e a linha zumbi fica inofensiva no banco.
 */
function rowToStrategy(row: StrategyRow): Strategy | null {
  // Presets: a definição completa (blocos reais) vive em PRESET_STRATEGIES no
  // front — a linha do banco existe só pra permitir referenciar o id com FK e
  // pra permitir sobrescrever no futuro sem migration. Se `definition` vier
  // vazio (seed), cai pro preset local com o mesmo id.
  if (row.is_preset) {
    const local = PRESET_STRATEGIES.find(s => s.id === row.id);
    const definitionIsEmpty = !row.definition || Object.keys(row.definition).length === 0;
    if (local && definitionIsEmpty) return local;
    if (!local && definitionIsEmpty) return null; // preset descontinuado — descarta
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    isPreset: row.is_preset,
    ...(row.definition as Strategy),
  };
}

export function useStrategies() {
  const { user } = useAuth();
  const [strategies, setStrategies] = useState<Strategy[]>(PRESET_STRATEGIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('strategies')
        .select('*')
        .order('is_preset', { ascending: false })
        .order('created_at', { ascending: true });

      if (dbError) throw dbError;

      const rows = (data ?? []) as StrategyRow[];
      const fromDb = rows.map(rowToStrategy).filter((s): s is Strategy => s !== null);

      // Garante que as 6 presets sempre aparecem, mesmo se a migration ainda
      // não rodou em produção (fallback gracioso, igual ao resto do app).
      const presetIds = new Set(fromDb.filter(s => s.isPreset).map(s => s.id));
      const missingPresets = PRESET_STRATEGIES.filter(s => !presetIds.has(s.id));

      setStrategies([...fromDb, ...missingPresets]);
    } catch (err) {
      console.warn('[useStrategies] ⚠️ Falha ao carregar do Supabase, usando presets locais', err);
      setError(err instanceof Error ? err.message : String(err));
      setStrategies(PRESET_STRATEGIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveStrategy = useCallback(async (strategy: Strategy): Promise<Strategy | null> => {
    if (!user?.id) {
      console.warn('[useStrategies] ⚠️ Usuário não autenticado, não é possível salvar');
      return null;
    }
    if (strategy.isPreset) {
      console.warn('[useStrategies] ⚠️ Estratégias prontas são somente leitura');
      return null;
    }

    const { id, name, description, isPreset, ...definition } = strategy;
    const isNew = !id || id.startsWith('draft-');

    const payload = {
      user_id: user.id,
      is_preset: false,
      name,
      description,
      definition,
      updated_at: new Date().toISOString(),
    };

    const query = isNew
      ? supabase.from('strategies').insert(payload).select().single()
      : supabase.from('strategies').update(payload).eq('id', id).eq('user_id', user.id).select().single();

    const { data, error: dbError } = await query;
    if (dbError) {
      console.error('[useStrategies] ❌ Erro ao salvar estratégia', dbError);
      setError(dbError.message);
      return null;
    }

    // saveStrategy sempre grava is_preset:false com definition preenchida —
    // rowToStrategy só retorna null pro caso de preset órfão (is_preset:true
    // + definition vazia), que nunca acontece aqui.
    const saved = rowToStrategy(data as StrategyRow)!;
    setStrategies(prev => {
      const withoutOld = prev.filter(s => s.id !== saved.id);
      return [...withoutOld, saved];
    });
    return saved;
  }, [user?.id]);

  const deleteStrategy = useCallback(async (strategyId: string): Promise<boolean> => {
    if (!user?.id) return false;
    const { error: dbError } = await supabase
      .from('strategies')
      .delete()
      .eq('id', strategyId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('[useStrategies] ❌ Erro ao apagar estratégia', dbError);
      setError(dbError.message);
      return false;
    }
    setStrategies(prev => prev.filter(s => s.id !== strategyId));
    return true;
  }, [user?.id]);

  return { strategies, loading, error, reload: load, saveStrategy, deleteStrategy };
}
