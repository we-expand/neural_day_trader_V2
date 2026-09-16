import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

/**
 * 🔴 2026-09-16 (pedido direto do Cleber -- "o usuário precisa ser avisado
 * que às 3 da tarde terá divulgação da taxa de juros"): pop-up discreto no
 * canto do Dashboard, dado real (mesmo endpoint /economic-calendar já usado
 * em EconomicCalendar.tsx, nunca hardcoded), aparece quando há evento de
 * alto impacto (USD, importance>=3 -- cobre tanto a decisão de juros quanto
 * qualquer discurso do Fed/coletiva de imprensa que apareça no calendário
 * real, não é uma data fixa) dentro da janela de "vale a pena avisar" (3h
 * antes até 30min depois). Dispensável por evento (estado em memória --
 * fechar não volta a aparecer pro MESMO evento nesta sessão, mas reaparece
 * pra um evento novo, ex: decisão às 15h e coletiva às 15h30 no mesmo dia
 * contam como avisos separados). Redesenhado 2026-09-16 (pedido do Cleber:
 * "assim está grosseiro, apresente um pop-up delicado") -- era uma barra
 * full-width no topo, virou um card flutuante no canto.
 */
interface EconomicEvent {
  id: string;
  time: string;
  country: string;
  currency: string;
  importance: number;
  event: string;
}

const WARN_MINUTES_BEFORE = 180;
const WARN_MINUTES_AFTER = 30;
const POLL_INTERVAL_MS = 5 * 60_000;

export function HighImpactEventBanner() {
  const [event, setEvent] = useState<EconomicEvent | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/economic-calendar?t=${Date.now()}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      if (!res.ok) return;
      const data = await res.json();
      const events: EconomicEvent[] = Array.isArray(data?.events) ? data.events : Array.isArray(data) ? data : [];
      const now = Date.now();
      const candidate = events.find((e) => {
        if (e.currency !== 'USD' || e.importance < 3) return false;
        const eventTime = new Date(e.time).getTime();
        if (Number.isNaN(eventTime)) return false;
        const minutesFromNow = (eventTime - now) / 60_000;
        return minutesFromNow <= WARN_MINUTES_BEFORE && minutesFromNow >= -WARN_MINUTES_AFTER;
      });
      setEvent(candidate ?? null);
    } catch {
      // falha de rede/endpoint -- nao bloqueia a UI, so nao mostra o banner
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
    const interval = setInterval(fetchCalendar, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCalendar]);

  if (!event || dismissed.has(event.id)) return null;

  const eventTimeLocal = new Date(event.time).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  return (
    <div className="fixed bottom-5 right-5 z-[300] w-[min(360px,calc(100vw-2.5rem))] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#1a1206]/95 backdrop-blur border border-amber-500/30 shadow-lg shadow-black/40 text-amber-100">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <p className="text-xs leading-relaxed flex-1">
          Hoje às <strong>{eventTimeLocal}</strong> (horário de Brasília): <strong>{event.event}</strong> — evento de
          alto impacto (USD). Volatilidade elevada esperada; a IA opera com confluência reforçada nesse horário.
        </p>
        <button
          type="button"
          onClick={() => setDismissed((prev) => new Set(prev).add(event.id))}
          className="p-1 rounded hover:bg-white/10 text-amber-400 hover:text-white transition-colors shrink-0"
          aria-label="Dispensar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
