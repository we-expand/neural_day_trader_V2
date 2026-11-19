import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2, X, Mic } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

/**
 * 2026-09-23, pedido do Cleber: quando o presidente Trump discursa, o
 * usuário precisa ser avisado e ter o vídeo na tela, igual ao que já
 * existe pro Fed (FedMiniPlayer.tsx + auto-open em App.tsx).
 *
 * Detecção: SEMPRE via calendário econômico real (mesmo endpoint
 * /economic-calendar do HighImpactEventBanner) — evento USD cujo nome cita
 * "Trump" (ex: "Trump Speaks"). Nunca data fixa. Limite conhecido: fala
 * não agendada / que não entrou no calendário não dispara sozinha.
 *
 * Vídeo: canal oficial da Casa Branca no YouTube (channel id confirmado
 * na própria página do canal em 2026-09-23). `live_stream?channel=` toca a
 * transmissão ao vivo quando existe; fora do ar, o YouTube mostra o próprio
 * aviso de "sem transmissão" — por isso há link direto pro canal.
 */
interface Speaker {
  label: string;
  match: RegExp;
  channelId: string;
  source: string;
  channelUrl: string;
}

// Channel ids confirmados nas próprias páginas dos canais (2026-09-23).
// Fed/Powell NÃO entra aqui: já tem player próprio (FedMiniPlayer.tsx).
const SPEAKERS: Speaker[] = [
  { label: 'Trump', match: /trump/i, channelId: 'UCYxRlFDqcWM4y7FfpiAN3KQ', source: 'Casa Branca', channelUrl: 'https://www.youtube.com/@WhiteHouse/live' },
  { label: 'Lagarde (BCE)', match: /lagarde|ecb press conference/i, channelId: 'UCXB8fM4VyQubRu3UVGhd3wA', source: 'Banco Central Europeu', channelUrl: 'https://www.youtube.com/user/ecbeuro/live' },
  { label: 'Bailey (BoE)', match: /bailey|boe press conference/i, channelId: 'UCZ25rmSDSnjIWZxjd2-04Rg', source: 'Banco da Inglaterra', channelUrl: 'https://www.youtube.com/@bankofengland/live' },
];

const OPEN_MINUTES_BEFORE = 30;
const KEEP_MINUTES_AFTER = 90;
const POLL_INTERVAL_MS = 2 * 60_000;

interface CalendarEvent {
  id: string;
  time: string;
  currency: string;
  event: string;
}

function dismissKey(id: string) {
  return `neural_live_speech_dismissed_${id}`;
}

export function LiveSpeechPlayer() {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [full, setFull] = useState(false);
  const [watching, setWatching] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/economic-calendar?lang=en&t=${Date.now()}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      if (!res.ok) return;
      const data = await res.json();
      const events: CalendarEvent[] = Array.isArray(data?.events) ? data.events : Array.isArray(data) ? data : [];
      const now = Date.now();
      const found = events.find((e) => {
        if (!SPEAKERS.some((sp) => sp.match.test(e.event || ''))) return false;
        const t = new Date(e.time).getTime();
        if (Number.isNaN(t)) return false;
        const min = (t - now) / 60_000;
        return min <= OPEN_MINUTES_BEFORE && min >= -KEEP_MINUTES_AFTER;
      });
      setEvent((prev) => {
        if (found && prev?.id !== found.id) {
          let wasDismissed = false;
          try {
            wasDismissed = localStorage.getItem(dismissKey(found.id)) === 'true';
          } catch {
            // localStorage indisponível -- segue sem persistir a decisão
          }
          setDismissed(wasDismissed);
          setWatching(false);
        }
        return found ?? null;
      });
    } catch {
      // falha de rede/endpoint -- não bloqueia a UI
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [check]);

  if (!event || dismissed) return null;
  const speaker = SPEAKERS.find((sp) => sp.match.test(event.event))!;
  const embedUrl = `https://www.youtube.com/embed/live_stream?channel=${speaker.channelId}&autoplay=1`;

  const close = () => {
    setDismissed(true);
    setFull(false);
    try {
      localStorage.setItem(dismissKey(event.id), 'true');
    } catch {
      // só fecha nesta sessão
    }
  };

  const timeLocal = new Date(event.time).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const shell = full
    ? 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-6'
    : 'fixed bottom-5 left-5 z-[300] w-[min(320px,calc(100vw-2.5rem))]';
  const card = full
    ? 'w-full max-w-5xl rounded-2xl overflow-hidden bg-[#09090b] border border-white/10 shadow-2xl'
    : 'rounded-xl overflow-hidden bg-[#09090b] border border-white/10 shadow-2xl shadow-black/50';

  return (
    <div className={shell}>
      <div className={card}>
        <div className="flex items-center justify-between px-3 py-2 bg-[#050505] border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-white truncate">
              DISCURSO: {speaker.label} — {timeLocal} (Brasília)
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setFull((v) => !v)}
              title={full ? 'Minimizar' : 'Maximizar'}
              className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            >
              {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={close}
              title="Fechar"
              className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="relative w-full bg-black aspect-video">
          {watching ? (
            <iframe
              title={`${speaker.source} ao vivo`}
              className="w-full h-full"
              src={embedUrl}
              allow="autoplay; encrypted-media; fullscreen"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4">
              <p className="text-xs text-slate-300">Discurso ao vivo em breve — {speaker.source}</p>
              <button
                onClick={() => setWatching(true)}
                className="px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
              >
                ▶ Assistir agora
              </button>
            </div>
          )}
        </div>
        <div className="px-3 py-1.5 bg-black/80 border-t border-white/10 text-[10px] text-slate-400">
          Transmissão oficial: {speaker.source} (YouTube).{' '}
          <a href={speaker.channelUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
            Abrir no YouTube ↗
          </a>
        </div>
      </div>
    </div>
  );
}
