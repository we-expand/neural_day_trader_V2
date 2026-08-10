import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';

export interface FavoriteChartSetup {
  timeframe: string;
  indicatorIds: string[];
  indicatorParamsById: Record<string, number[]>;
  indicatorPlacement: Record<string, 'overlay' | 'pane'>;
  indicatorMASettings: Record<string, unknown>;
  showGridOverlay: boolean;
  showSrOverlay: boolean;
  savedAt: string;
}

const localStorageKey = (userId: string) => `chart_favorite_setup_${userId}`;

/**
 * Setup favorito do gráfico (indicadores + parâmetros, grade, S/R), salvo pelo
 * usuário via "Salvar configuração atual como favorita" no menu de botão
 * direito. Lido de localStorage de forma SÍNCRONA no mount (chave por
 * user_id) pra poder aplicar o timeframe salvo antes mesmo do primeiro
 * useState do gráfico rodar -- sem isso, restaurar o timeframe via setState
 * assíncrono dispararia um segundo dispose()+init() do chart logo depois do
 * primeiro, derrubando os indicadores que acabaram de ser recriados. O
 * Supabase é a fonte de verdade entre dispositivos; localStorage é só cache
 * de leitura rápida, sempre resincronizado após qualquer load/save bem-sucedido.
 */
export function useFavoriteChartSetup() {
  const { user } = useAuth();
  const [favoriteSetup, setFavoriteSetup] = useState<FavoriteChartSetup | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    try {
      const cached = localStorage.getItem(localStorageKey(user.id));
      if (cached) setFavoriteSetup(JSON.parse(cached));
    } catch (err) {
      console.warn('[useFavoriteChartSetup] ⚠️ Falha ao ler cache local', err);
    }

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('chart_favorite_setup')
          .select('config')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!cancelled && !error && data?.config) {
          const config = data.config as FavoriteChartSetup;
          setFavoriteSetup(config);
          try {
            localStorage.setItem(localStorageKey(user.id), JSON.stringify(config));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('[useFavoriteChartSetup] ⚠️ Falha ao carregar setup favorito do Supabase, usando cache local', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const saveFavoriteSetup = useCallback(
    (config: Omit<FavoriteChartSetup, 'savedAt'>) => {
      if (!user?.id) return;
      const full: FavoriteChartSetup = { ...config, savedAt: new Date().toISOString() };

      setFavoriteSetup(full); // atualização otimista, mesma linha do useChartPreferences
      try {
        localStorage.setItem(localStorageKey(user.id), JSON.stringify(full));
      } catch (_) {}

      supabase
        .from('chart_favorite_setup')
        .upsert(
          { user_id: user.id, config: full, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) {
            console.warn('[useFavoriteChartSetup] ⚠️ Falha ao persistir setup favorito (mantendo cache local)', error);
          }
        });
    },
    [user?.id]
  );

  return { favoriteSetup, saveFavoriteSetup, loading };
}

/** Leitura síncrona do cache local, pra inicializar state (ex: timeframe) antes do 1º render. */
export function readCachedFavoriteChartSetup(userId: string | undefined): FavoriteChartSetup | null {
  if (!userId) return null;
  try {
    const cached = localStorage.getItem(localStorageKey(userId));
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}
