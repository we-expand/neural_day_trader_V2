import React from 'react';
import { Maximize2, X, Radio } from 'lucide-react';
import { useFomcLiveCaptions } from '@/app/hooks/useFomcLiveCaptions';

/**
 * 2026-09-16, pedido explícito do Cleber ("quero que o vídeo fique dentro
 * do push... se eu quiser maximizar, eu maximizo. Se não, eu posso ficar só
 * ouvindo"): vídeo do Fed dockado dentro do próprio card de aviso (canto do
 * Dashboard), tocando com áudio, em vez de só um botão que abre uma janela
 * separada. Reaproveita o MESMO iframe/legenda do NeuralEventCenter (via
 * useFomcLiveCaptions) — nunca os dois montados ao mesmo tempo (App.tsx
 * garante isso), então nunca toca 2 áudios simultâneos nem dobra o custo de
 * tradução.
 */
const FED_BRIGHTCOVE_ACCOUNT = '66043936001';
const FED_BRIGHTCOVE_VIDEO_ID = '6376885161112';
// autoplay=true pede autoplay real de verdade pro player do Brightcove
// (2026-09-16, achado ao vivo: sem esse parâmetro o vídeo ficava parado na
// miniatura, o usuário tinha que clicar em Play — o próprio player exige o
// clique real, o atributo `allow="autoplay"` do iframe sozinho não basta).
const FED_VIDEO_EMBED_URL = `https://players.brightcove.net/${FED_BRIGHTCOVE_ACCOUNT}/default_default/index.html?videoId=${FED_BRIGHTCOVE_VIDEO_ID}&autoplay=true`;

interface FedMiniPlayerProps {
  onMaximize: () => void;
  onClose: () => void;
}

export function FedMiniPlayer({ onMaximize, onClose }: FedMiniPlayerProps) {
  const { lines, isLive } = useFomcLiveCaptions(true);
  const lastLine = lines[lines.length - 1];

  return (
    <div className="fixed bottom-5 right-5 z-[300] w-[min(320px,calc(100vw-2.5rem))] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-xl overflow-hidden bg-[#09090b] border border-white/10 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-3 py-2 bg-[#050505] border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            {isLive ? (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-500 tracking-wider">AO VIVO</span>
              </span>
            ) : (
              <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="text-[11px] font-semibold text-white truncate">FED — FOMC</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onMaximize}
              title="Maximizar"
              className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Fechar"
              className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="relative w-full bg-black aspect-video group">
          <iframe
            title="Federal Reserve Live (mini)"
            className="w-full h-full"
            src={FED_VIDEO_EMBED_URL}
            allow="autoplay; encrypted-media; fullscreen"
            loading="lazy"
          />
          {/* Ícone de maximizar sobreposto só no canto — não cobre o resto do
              vídeo, então o player continua clicável (play/pause/volume) de
              verdade, em vez de a área inteira virar um "link" pra outra tela. */}
          <button
            onClick={onMaximize}
            title="Maximizar"
            className="absolute bottom-1.5 right-1.5 p-1.5 rounded-md bg-black/70 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {lastLine && (
          <div className="px-3 py-2 bg-black/80 border-t border-white/10">
            <p className="text-[11px] text-white leading-snug line-clamp-2">
              {lastLine.translated || lastLine.original}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
