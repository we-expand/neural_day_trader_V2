import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  Globe,
  X,
  Activity,
  Signal,
  Languages,
} from 'lucide-react';
import { projectId } from '/utils/supabase/info';

interface NeuralEventCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Vídeo oficial do Fed (federalreserve.gov/live-broadcast.htm) — Brightcove,
 * account/video id confirmados inspecionando o player real da página
 * (2026-09-16), não são suposição. Embed público padrão do Brightcove,
 * mesmo vídeo que o site do Fed mostra.
 */
const FED_BRIGHTCOVE_ACCOUNT = '66043936001';
const FED_BRIGHTCOVE_VIDEO_ID = '6376885161112';
const FED_VIDEO_EMBED_URL = `https://players.brightcove.net/${FED_BRIGHTCOVE_ACCOUNT}/default_default/index.html?videoId=${FED_BRIGHTCOVE_VIDEO_ID}`;

const CAPTIONS_POLL_INTERVAL_MS = 3000;

interface CaptionLine {
  id: number;
  original: string;
  translated: string;
}

export function NeuralEventCenter({ isOpen, onClose }: NeuralEventCenterProps) {
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [isLive, setIsLive] = useState<boolean | null>(null); // null = ainda não checou
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const cursorRef = useRef<string>('-1');
  const lineIdRef = useRef(0);

  // Polling real da legenda oficial do Fed (StreamText/CART) + tradução —
  // ver supabase/functions/fomc-captions/index.ts pra fonte e limitações.
  useEffect(() => {
    if (!isOpen) return;
    setLines([]);
    setIsLive(null);
    setErrorNote(null);
    cursorRef.current = '-1';
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

        if (data.originalText) {
          lineIdRef.current += 1;
          setLines((prev) => [
            ...prev,
            { id: lineIdRef.current, original: data.originalText, translated: data.translatedText || '' },
          ].slice(-6));
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
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] relative"
      >
        {/* HEADER */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#050505]">
          <div className="flex items-center gap-4">
            {isLive && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-xs font-bold text-red-500 tracking-wider">AO VIVO AGORA</span>
              </div>
            )}
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              FED — FOMC PRESS CONFERENCE
            </h2>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* MAIN STAGE */}
        <div className="flex-1 flex overflow-hidden">
          {/* VIDEO FEED — vídeo real do federalreserve.gov, embed público do Brightcove */}
          <div className="flex-1 bg-black relative flex flex-col">
            <div className="relative w-full h-full">
              <iframe
                title="Federal Reserve Live"
                width="100%"
                height="100%"
                src={FED_VIDEO_EMBED_URL}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                loading="lazy"
              />

              <div className="absolute top-6 left-6 flex gap-2">
                <div className="px-3 py-1 bg-black/60 backdrop-blur border border-white/10 rounded text-[10px] font-mono text-white flex items-center gap-2">
                  <Signal className="w-3 h-3" /> federalreserve.gov (fonte oficial)
                </div>
              </div>

              {/* LEGENDA — original (inglês, fonte real: CART do próprio Fed) + tradução */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center pb-6 px-10">
                <div className="max-w-4xl w-full bg-black/70 backdrop-blur-md border border-white/10 rounded-xl p-6 min-h-[100px] flex flex-col items-center text-center gap-1">
                  {isLive === false && (
                    <p className="text-xs text-slate-500">Aguardando o início da transmissão…</p>
                  )}
                  {errorNote && (
                    <p className="text-xs text-amber-500">{errorNote}</p>
                  )}
                  <AnimatePresence mode="popLayout">
                    {lines.slice(-2).map((line, i, arr) => (
                      <motion.div
                        key={line.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full"
                      >
                        <p className={`text-lg font-medium tracking-wide ${i === arr.length - 1 ? 'text-white font-bold' : 'text-slate-500 blur-[0.5px]'}`}>
                          {line.translated || line.original}
                        </p>
                        {line.translated && (
                          <p className="text-[11px] text-slate-500 mt-1">{line.original}</p>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="w-80 bg-[#0a0a0a] border-l border-white/10 flex flex-col z-20">
            <div className="p-5 border-b border-white/10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Globe className="w-3 h-3" /> Tradução em Tempo Real
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                Legenda oficial do Fed (estenografia ao vivo) traduzida automaticamente
                para português. Dado real, sem fabricação — se a tradução falhar, o
                texto original em inglês é mostrado sozinho.
              </p>
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-white/10 border-blue-500/50 text-white">
                <Languages className="w-4 h-4" />
                <span className="text-xs font-bold">PT-BR</span>
              </div>
            </div>

            <div className="p-5 mt-auto">
              <div className="border border-white/10 bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                  <Mic className="w-4 h-4" /> Dublagem por voz
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Ainda não implementada nesta versão — só legenda traduzida em texto
                  por enquanto (decisão de escopo pelo prazo do evento de hoje).
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
