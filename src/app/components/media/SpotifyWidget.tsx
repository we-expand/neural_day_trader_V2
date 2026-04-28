import React, { useState } from 'react';
import { Music, X, Disc, ListMusic, ExternalLink, Minimize2, Maximize2, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Curated Playlists for Trading
const PLAYLISTS = [
  { id: '37i9dQZF1DX0SM0LYsmbMT', name: 'Synthwave Drive', genre: 'Cyberpunk', color: 'from-purple-500 to-pink-500' },
  { id: '37i9dQZF1DWWY64wDtewQt', name: 'Phonk Drift', genre: 'Aggressive', color: 'from-red-500 to-orange-500' },
  { id: '37i9dQZF1DWZtZ8vUCzXqi', name: 'Lo-Fi Beats', genre: 'Focus', color: 'from-emerald-500 to-teal-500' },
  { id: '37i9dQZF1DX69qIt66WWbd', name: 'Deep House', genre: 'Lounge', color: 'from-blue-500 to-indigo-500' },
  { id: '37i9dQZF1DX8Uebhn9wzrS', name: 'Chill Lofi Study', genre: 'Relax', color: 'from-slate-500 to-zinc-500' },
];

export function SpotifyWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState(PLAYLISTS[0]);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Floating Trigger Button (Bottom Right, above chat/toaster) */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleOpen}
          className="fixed bottom-24 right-6 z-40 w-12 h-12 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-[0_0_20px_rgba(29,185,84,0.4)] border border-white/20 hover:bg-[#1ed760] transition-colors"
          title="Spotify Trading Radio"
        >
          <Music className="w-6 h-6" />
        </motion.button>
      )}

      {/* Main Widget Container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : 'auto',
              width: isMinimized ? '300px' : '380px'
            }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-40 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5 cursor-move">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse"></div>
                <span className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-1">
                  <span className="text-[#1DB954]">Spotify</span> Connect
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowPlaylistSelector(!showPlaylistSelector)}
                  className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${showPlaylistSelector ? 'text-[#1DB954]' : 'text-zinc-400'}`}
                  title="Trocar Estação"
                >
                  <ListMusic className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={toggleOpen}
                  className="p-1.5 rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Playlist Selector Overlay */}
            <AnimatePresence>
              {showPlaylistSelector && !isMinimized && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-black/80 border-b border-white/10 overflow-hidden"
                >
                  <div className="p-2 grid grid-cols-1 gap-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {PLAYLISTS.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => {
                          setActivePlaylist(playlist);
                          setShowPlaylistSelector(false);
                          toast.success(`Estação: ${playlist.name}`);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg text-left transition-all group ${
                          activePlaylist.id === playlist.id 
                            ? 'bg-white/10 border border-white/10' 
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded bg-gradient-to-br ${playlist.color} flex items-center justify-center`}>
                             <Disc className={`w-4 h-4 text-white ${activePlaylist.id === playlist.id ? 'animate-spin-slow' : ''}`} />
                          </div>
                          <div>
                            <div className={`text-xs font-bold ${activePlaylist.id === playlist.id ? 'text-[#1DB954]' : 'text-zinc-300'}`}>
                              {playlist.name}
                            </div>
                            <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{playlist.genre}</div>
                          </div>
                        </div>
                        {activePlaylist.id === playlist.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] shadow-[0_0_5px_#1DB954]"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Embed Player */}
            <div className={`relative bg-black transition-all duration-300 ${isMinimized ? 'h-[80px]' : 'h-[352px]'}`}>
              <iframe
                style={{ borderRadius: '0px' }}
                src={`https://open.spotify.com/embed/playlist/${activePlaylist.id}?utm_source=generator&theme=0`}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen={false}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                title="Spotify Player"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                className="w-full"
              ></iframe>
              
              {/* Overlay for minimizing interaction issues if needed, or styling */}
            </div>

            {/* Footer Status */}
            {!isMinimized && (
              <div className="px-3 py-2 bg-[#09090b] border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  {activePlaylist.genre} Station
                </span>
                <span className="text-zinc-600">Secure Connection</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}