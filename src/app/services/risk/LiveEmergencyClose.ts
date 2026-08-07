/**
 * Fecha posições LIVE reais na corretora quando o kill-switch ou o Health
 * Check dispara. Antes deste módulo, `setActiveOrders([])` só limpava estado
 * local (rastreamento DEMO) — uma posição LIVE já aberta na MetaAPI ficava
 * sem gestão automática até intervenção manual (achado da auditoria de
 * 2026-07-30, ver CLAUDE.md pendência #5).
 *
 * Não assume "fechado" só porque a chamada retornou success — confirma via
 * getPositions() depois, porque o retorno da Edge Function não garante
 * consistência imediata do lado da MetaAPI.
 */

import { closeAllPositions, getPositions } from '../BrokerClient.ts';

export interface EmergencyCloseResult {
  closed: boolean;
  attempts: number;
  lastError?: string;
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasOpenPositions(): Promise<boolean> {
  const positions = await getPositions();
  return positions.length > 0;
}

/**
 * Tenta fechar todas as posições LIVE com retry e backoff exponencial,
 * confirmando via getPositions() que realmente não sobrou nada aberto.
 * Retorna `closed: false` se esgotar as tentativas sem confirmação — o
 * chamador é responsável por alertar o usuário persistentemente, nunca
 * silenciar essa falha.
 */
export async function forceCloseAllLivePositions(): Promise<EmergencyCloseResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await closeAllPositions();
      if (!result.success) {
        lastError = result.error || 'closeAllPositions retornou success=false';
      } else {
        const stillOpen = await hasOpenPositions();
        if (!stillOpen) {
          return { closed: true, attempts: attempt };
        }
        lastError = 'closeAllPositions reportou sucesso mas getPositions ainda mostra posição aberta';
      }
    } catch (error: any) {
      lastError = error?.message || 'Erro desconhecido ao fechar posições LIVE';
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  return { closed: false, attempts: MAX_ATTEMPTS, lastError };
}
