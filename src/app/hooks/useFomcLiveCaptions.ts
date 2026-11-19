import { useEffect, useRef, useState } from 'react';
import { projectId } from '/utils/supabase/info';

/**
 * Legenda ao vivo do discurso do Fed (StreamText/CART real + tradução) —
 * extraído de NeuralEventCenter.tsx em 2026-09-16 pra ser reaproveitado
 * também pelo mini player docado (FedMiniPlayer.tsx), sem duplicar a
 * lógica de polling/cursor. Ver supabase/functions/fomc-captions/index.ts
 * pra fonte real e limitações conhecidas.
 *
 * Cursor persiste em sessionStorage por dia — só a 1ª vez que QUALQUER
 * consumidor (mini ou tela cheia) fica ativo no dia busca a transcrição
 * completa desde o início ("na íntegra", pedido do Cleber); daí em diante
 * continua de onde parou, mesmo trocando entre mini e tela cheia.
 */

const CAPTIONS_POLL_INTERVAL_MS = 3000;
const MAX_SENTENCE_CHARS = 280;

export interface CaptionLine {
  id: number;
  original: string;
  translated: string;
}

function getCaptionsStorageKey(): string {
  return `neural_fomc_captions_cursor_${new Date().toISOString().slice(0, 10)}`;
}

export function useFomcLiveCaptions(active: boolean) {
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [isLive, setIsLive] = useState<boolean | null>(null); // null = ainda não checou
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const cursorRef = useRef<string>('-1');
  const lineIdRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    setIsLive(null);
    setErrorNote(null);
    try {
      cursorRef.current = sessionStorage.getItem(getCaptionsStorageKey()) || '-1';
    } catch {
      cursorRef.current = '-1';
    }
    let cancelled = false;

    async function poll() {
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/fomc-captions?cursor=${encodeURIComponent(cursorRef.current)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;

        if (data.error) {
          setErrorNote(data.error);
          return;
        }

        setIsLive(!!data.live);
        cursorRef.current = data.cursor ?? cursorRef.current;
        try {
          sessionStorage.setItem(getCaptionsStorageKey(), cursorRef.current);
        } catch {
          // sessionStorage indisponível -- sem persistência entre reaberturas, sem quebrar a legenda ao vivo
        }

        if (data.translatedText || data.originalText) {
          const source = data.translatedText || data.originalText;
          const sentences = (source.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [source])
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((s: string) => (s.length > MAX_SENTENCE_CHARS ? `…${s.slice(-MAX_SENTENCE_CHARS)}` : s));
          const originalTail = data.originalText && data.originalText.length > MAX_SENTENCE_CHARS
            ? `…${data.originalText.slice(-MAX_SENTENCE_CHARS)}`
            : data.originalText;
          setLines((prev) => {
            const next = [...prev];
            sentences.forEach((sentence: string, i: number) => {
              lineIdRef.current += 1;
              next.push({
                id: lineIdRef.current,
                translated: data.translatedText ? sentence : '',
                original: data.translatedText ? (i === sentences.length - 1 ? originalTail : '') : sentence,
              });
            });
            return next.slice(-6);
          });
        }
      } catch (err: any) {
        if (!cancelled) setErrorNote(err?.message ?? 'Falha ao buscar legenda.');
      }
    }

    poll();
    const interval = setInterval(poll, CAPTIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active]);

  return { lines, isLive, errorNote };
}
