import { useCallback } from 'react';
import type { ChartTemplateConfig } from '@/app/hooks/useChartTemplates';

const sessionStorageKey = (userId: string) => `chart_session_state_${userId}`;

/**
 * Estado "ao vivo" do gráfico (indicadores, timeframe, grade, S/R) — diferente
 * do setup favorito (ação manual "Salvar como favorita") e do Template nomeado
 * (ação manual "Templates › Salvar"): este aqui grava sozinho a cada mudança,
 * sem o usuário pedir, só pra sobreviver a navegar pra outra seção do app e
 * voltar. `ChartView` é desmontado/remontado a cada troca de seção (SPA), e
 * antes desta mudança só o setup favorito sobrevivia a isso — carregar um
 * Template nomeado ou simplesmente adicionar um indicador se perdia ao trocar
 * de seção (bug relatado pelo Cleber em 2026-08-20, com print mostrando MACD
 * + Stoch Lento sumindo e timeframe voltando pro padrão 1H ao voltar pro
 * Gráfico). `sessionStorage` (não `localStorage`) é a escolha certa aqui: some
 * sozinho quando o usuário fecha a aba/navegador -- exatamente o "persistir
 * até fechar a plataforma" pedido, sem precisar de lógica de expiração manual.
 */
export function useChartSessionState() {
  const readSessionState = useCallback((userId: string | undefined): ChartTemplateConfig | null => {
    if (!userId) return null;
    try {
      const cached = sessionStorage.getItem(sessionStorageKey(userId));
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, []);

  const saveSessionState = useCallback((userId: string | undefined, config: ChartTemplateConfig) => {
    if (!userId) return;
    try {
      sessionStorage.setItem(sessionStorageKey(userId), JSON.stringify(config));
    } catch (_) {
      // sessionStorage indisponível (modo privado, quota) -- degrada pro comportamento
      // anterior (perde estado ao trocar de seção), não é erro fatal.
    }
  }, []);

  return { readSessionState, saveSessionState };
}

/** Leitura síncrona, pra inicializar state (ex: timeframe) antes do 1º render. */
export function readCachedChartSessionState(userId: string | undefined): ChartTemplateConfig | null {
  if (!userId) return null;
  try {
    const cached = sessionStorage.getItem(sessionStorageKey(userId));
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}
