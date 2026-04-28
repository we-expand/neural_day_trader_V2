import React, { useState } from 'react';
import { Calendar, Newspaper } from 'lucide-react';
import { EconomicCalendar } from './EconomicCalendar';
import { NewsFeed } from './NewsFeed';

export function NewsAndAgenda() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'news'>('news'); // ✅ default: notícias

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full flex flex-col shadow-lg">
      {/* Header with Tabs - Compacto */}
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
              activeTab === 'agenda'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Agenda Econômica</span>
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
              activeTab === 'news'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Newspaper className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Notícias</span>
          </button>
        </div>
      </div>

      {/* Content - Compacto */}
      <div className="flex-1 p-2 min-h-0 overflow-hidden">
        {activeTab === 'agenda' ? <EconomicCalendar /> : <NewsFeed />}
      </div>
    </div>
  );
}