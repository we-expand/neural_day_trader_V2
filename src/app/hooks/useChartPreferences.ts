import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';

interface ChartPreferencesRow {
  user_id: string;
  symbol: string;
  show_sr_overlay: boolean;
}

/**
 * Preferência "mostrar/ocultar Suporte/Resistência no gráfico", persistida por
 * usuário+ativo no Supabase (tabela chart_preferences, migration 008).
 * Nunca trava a UI: se o Supabase falhar (RLS, tabela ainda não migrada,
 * usuário deslogado), cai num default local (true) sem quebrar nada — mesmo
 * padrão gracioso já usado em useStrategies.ts.
 */
export function useChartPreferences(symbol: string) {
  const { user } = useAuth();
  const [showSrOverlay, setShowSrOverlayState] = useState(true);
  const [loading, setLoading] = useState(false);
  const showSrOverlayRef = useRef(true);

  useEffect(() => {
    showSrOverlayRef.current = showSrOverlay;
  }, [showSrOverlay]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !symbol) return;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('chart_preferences')
          .select('show_sr_overlay')
          .eq('user_id', user.id)
          .eq('symbol', symbol)
          .maybeSingle();

        if (!cancelled && !error && data) {
          setShowSrOverlayState((data as ChartPreferencesRow).show_sr_overlay);
        }
      } catch (err) {
        console.warn('[useChartPreferences] ⚠️ Falha ao carregar preferência, usando default local', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, symbol]);

  const setShowSrOverlay = useCallback(
    (value: boolean) => {
      setShowSrOverlayState(value); // atualização otimista — UI nunca espera o Supabase

      if (!user?.id || !symbol) return;

      supabase
        .from('chart_preferences')
        .upsert(
          {
            user_id: user.id,
            symbol,
            show_sr_overlay: value,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,symbol' }
        )
        .then(({ error }) => {
          if (error) {
            console.warn('[useChartPreferences] ⚠️ Falha ao persistir preferência (mantendo estado local)', error);
          }
        });
    },
    [user?.id, symbol]
  );

  return { showSrOverlay, showSrOverlayRef, setShowSrOverlay, loading };
}
