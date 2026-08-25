import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';

export interface ChartTemplateConfig {
  timeframe: string;
  indicatorIds: string[];
  indicatorParamsById: Record<string, number[]>;
  indicatorPlacement: Record<string, 'overlay' | 'pane'>;
  indicatorMASettings: Record<string, unknown>;
  showGridOverlay: boolean;
  showSrOverlay: boolean;
  // 🆕 Posicionamento em tela (zoom + scroll) — klinecharts: barSpace controla o
  // zoom (largura de cada candle em px), offsetRightDistance controla o
  // scroll horizontal. Sem os dois, "carregar" um template sempre reaplicava
  // só os indicadores e devolvia o gráfico pra posição default, ignorando
  // onde o usuário tinha deixado a visão no momento de salvar.
  barSpace: number | null;
  offsetRightDistance: number | null;
  // 🆕 POSIÇÃO REAL de scroll horizontal. `offsetRightDistance` acima NÃO é
  // posição: na klinecharts é a folga fixa configurada à direita do último
  // candle, e reescrevê-la (`setOffsetRightDistance`) recalcula
  // `_lastBarRightSideDiffBarCount = offset / barSpace`, ou seja EMPURRA o
  // gráfico de volta pro tempo real. Salvar/restaurar aquilo achando que era
  // "onde o usuário deixou o gráfico" era a razão de a posição nunca segurar.
  //
  // A posição de verdade é guardada como uma ÂNCORA: um candle (por timestamp,
  // não por índice — o dataset cresce a cada refresh) e a coordenada X em
  // pixels onde ele estava na tela. Restaurar = colocar o mesmo candle no mesmo
  // X. Medido no browser contra a klinecharts 9.8.10 (ver histórico da sessão):
  // reconstruir a posição a partir de `visibleRange` em vez de pixels erra meia
  // barra por vez (a lib arredonda `realTo = round(diff + total + 0.5)`), o que
  // com o refresh de 30s vira uma deriva contínua — o gráfico "anda sozinho".
  // Opcionais: templates salvos antes disso não têm.
  anchorTimestamp?: number | null;
  anchorX?: number | null;
}

export interface ChartTemplate {
  id: string;
  name: string;
  config: ChartTemplateConfig;
  updatedAt: string;
}

const localStorageKey = (userId: string) => `chart_templates_${userId}`;

/**
 * Templates NOMEADOS do gráfico (indicadores + parâmetros, grade, S/R,
 * timeframe) — CRUD completo (salvar/carregar/remover), acionado pelo menu
 * "Templates" do botão direito. Diferente de useFavoriteChartSetup.ts (um
 * único setup, aplicado automaticamente ao montar) -- aqui são vários
 * templates nomeados, aplicados só quando o usuário clica em "Carregar".
 * Mesmo padrão de fonte de verdade (Supabase) + cache local (leitura
 * instantânea, sempre resincronizado) do resto do módulo de preferências.
 */
export function useChartTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ChartTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const readCache = useCallback((): ChartTemplate[] => {
    if (!user?.id) return [];
    try {
      const cached = localStorage.getItem(localStorageKey(user.id));
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }, [user?.id]);

  const writeCache = useCallback(
    (list: ChartTemplate[]) => {
      if (!user?.id) return;
      try {
        localStorage.setItem(localStorageKey(user.id), JSON.stringify(list));
      } catch (_) {}
    },
    [user?.id]
  );

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chart_templates')
        .select('id, name, config, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        const list: ChartTemplate[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          config: row.config,
          updatedAt: row.updated_at
        }));
        setTemplates(list);
        writeCache(list);
      }
    } catch (err) {
      console.warn('[useChartTemplates] ⚠️ Falha ao carregar templates do Supabase, usando cache local', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, writeCache]);

  useEffect(() => {
    if (!user?.id) {
      setTemplates([]);
      return;
    }
    setTemplates(readCache());
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveTemplate = useCallback(
    async (name: string, config: ChartTemplateConfig): Promise<boolean> => {
      if (!user?.id) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;

      try {
        const { data, error } = await supabase
          .from('chart_templates')
          .upsert(
            { user_id: user.id, name: trimmed, config, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,name' }
          )
          .select('id, name, config, updated_at')
          .single();

        if (error || !data) {
          console.warn('[useChartTemplates] ⚠️ Falha ao salvar template', error);
          return false;
        }

        setTemplates(prev => {
          const withoutOld = prev.filter(t => t.name !== trimmed);
          const next = [{ id: data.id, name: data.name, config: data.config, updatedAt: data.updated_at }, ...withoutOld];
          writeCache(next);
          return next;
        });
        return true;
      } catch (err) {
        console.warn('[useChartTemplates] ⚠️ Erro salvando template', err);
        return false;
      }
    },
    [user?.id, writeCache]
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user?.id) return false;
      // Otimista — some da lista já na hora, mesmo padrão do resto do módulo.
      setTemplates(prev => {
        const next = prev.filter(t => t.id !== id);
        writeCache(next);
        return next;
      });

      const { error } = await supabase.from('chart_templates').delete().eq('id', id).eq('user_id', user.id);
      if (error) {
        console.warn('[useChartTemplates] ⚠️ Falha ao remover template, restaurando lista', error);
        await refresh(); // desfaz a remoção otimista se o Supabase recusar
        return false;
      }
      return true;
    },
    [user?.id, writeCache, refresh]
  );

  return { templates, saveTemplate, deleteTemplate, loading };
}
