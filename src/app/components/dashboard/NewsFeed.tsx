import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Newspaper, ExternalLink, TrendingUp, TrendingDown, RefreshCcw,
  Zap, AlertTriangle, Bot, Globe, Wifi, WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSpeechAlert } from '@/app/hooks/useSpeechAlert';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface NewsItem {
  id: string;
  title: string;
  titleOriginal: string;
  source: string;
  category: 'crypto' | 'macro' | 'forex';
  url: string;
  timestamp: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  isCritical: boolean;
}

const UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos, conforme pedido
const MAX_ITEMS = 15;

// Detecta o idioma do usuário (navigator.language, ex: "pt-BR" → "pt",
// "en-US" → "en") pra pedir a tradução da manchete no idioma certo.
function detectUserLang(): string {
  const lang = (navigator.language || 'pt-BR').split('-')[0].toLowerCase();
  return lang || 'pt';
}

function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const pos = ['sobe', 'alta', 'rally', 'bull', 'lucro', 'surge', 'gain', 'up', 'soar', 'record', 'growth', 'rise', 'approv', 'expand', 'máxima', 'positiv', 'dispara', 'recorde'];
  const neg = ['cai', 'baixa', 'drop', 'bear', 'perda', 'crash', 'plunge', 'collapse', 'down', 'fall', 'loss', 'ban', 'crisis', 'fear', 'mínima', 'negativ', 'bloquei', 'despenca', 'recua'];
  const posCount = pos.filter(w => lower.includes(w)).length;
  const negCount = neg.filter(w => lower.includes(w)).length;
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

function detectCritical(text: string): boolean {
  const lower = text.toLowerCase();
  return ['crash', 'panic', 'collapse', 'plunge', 'breaking', 'urgent', 'alert', 'colapsa', 'despenca', 'alerta', 'urgente'].some(k => lower.includes(k));
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

const API_URL = `https://${projectId}.supabase.co/functions/v1/server/news/aggregate`;

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextUpdateInSec, setNextUpdateInSec] = useState(UPDATE_INTERVAL_MS / 1000);
  const [isOnline, setIsOnline] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [criticalPopup, setCriticalPopup] = useState<NewsItem | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'crypto' | 'macro' | 'forex'>('all');
  const alertedIdsRef = useRef(new Set<string>());
  const { speak } = useSpeechAlert({ rate: 0.95, volume: 1.0 });
  const userLang = useRef(detectUserLang()).current;

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}?lang=${userLang}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();

      if (data.error && (!data.items || data.items.length === 0)) {
        throw new Error(data.error);
      }

      const fresh: NewsItem[] = (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        titleOriginal: item.titleOriginal,
        source: item.source,
        category: item.category,
        url: item.url,
        timestamp: item.timestamp,
        sentiment: analyzeSentiment(item.titleOriginal || item.title),
        isCritical: detectCritical(item.titleOriginal || item.title),
      }));

      // Mescla com o que já está na tela (não zera a lista a cada ciclo) —
      // "atualizado de 10 em 10 minutos para novas" significa acrescentar o
      // que é novo, não recomeçar do zero.
      setNews(prev => {
        const merged = [...fresh, ...prev].filter((item, idx, arr) =>
          arr.findIndex(x => x.id === item.id) === idx
        );
        return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ITEMS);
      });

      setIsOnline(true);
      setLoadError(null);
      setIsLoading(false);
      setLastUpdated(new Date());
      setNextUpdateInSec(UPDATE_INTERVAL_MS / 1000);

      const critical = fresh.find(n => n.isCritical && !alertedIdsRef.current.has(n.id));
      if (critical) {
        alertedIdsRef.current.add(critical.id);
        setCriticalPopup(critical);
        setTimeout(() => setCriticalPopup(null), 8000);
        speak(`Notícia crítica! ${critical.title}`, 'high');
      }
    } catch (e: any) {
      console.warn('[NewsFeed] Falha ao buscar notícias reais:', e.message);
      setIsOnline(false);
      setLoadError(e.message || 'Falha ao carregar notícias');
      setIsLoading(false);
      // Sem fallback fabricado — mantém a última leitura real na tela
      // (se houver) em vez de inventar manchetes atribuídas a veículos reais.
    }
  }, [speak, userLang]);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNews]);

  useEffect(() => {
    const t = setInterval(() => setNextUpdateInSec(p => (p <= 1 ? UPDATE_INTERVAL_MS / 1000 : p - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredNews = news.filter(item => filterMode === 'all' || item.category === filterMode);

  const sentimentColor = (s: string) =>
    s === 'positive' ? 'bg-emerald-500' : s === 'negative' ? 'bg-rose-500' : 'bg-slate-600';

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#050505] border border-white/5 rounded-xl h-full flex flex-col relative overflow-hidden">

      <AnimatePresence>
        {criticalPopup && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-2 left-2 right-2 z-50 bg-gradient-to-r from-red-900/90 to-red-800/90 border border-red-500/60 rounded-xl p-3 shadow-2xl backdrop-blur"
            onClick={() => setCriticalPopup(null)}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-300 animate-pulse shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-200 uppercase tracking-wider mb-0.5">🚨 Notícia Crítica</p>
                <p className="text-xs text-red-100 leading-relaxed">{criticalPopup.title}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#080808] shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Notícias Financeiras — Cripto / Macro / Forex
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
            <RefreshCcw className="w-3 h-3" />
            {formatCountdown(nextUpdateInSec)}
          </span>
          {isOnline
            ? <Wifi className="w-3 h-3 text-emerald-400" />
            : <WifiOff className="w-3 h-3 text-amber-400" />
          }
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5 shrink-0">
        {(['all', 'crypto', 'macro', 'forex'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterMode(f)}
            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
              filterMode === f
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'crypto' ? 'Crypto' : f === 'macro' ? 'Macro' : 'Forex'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-[9px] text-slate-600">
          <Globe className="w-2.5 h-2.5" />
          <span>{userLang.toUpperCase()}</span>
        </div>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 bg-white/5 rounded w-full" />
                <div className="h-3 bg-white/5 rounded w-3/4" />
                <div className="h-2 bg-white/5 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-slate-600 px-4 text-center">
            <Bot className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">
              {loadError ? 'Não foi possível carregar notícias reais no momento.' : 'Nenhuma notícia encontrada nesta categoria.'}
            </p>
            {loadError && (
              <button
                onClick={() => { setIsLoading(true); fetchNews(); }}
                className="mt-3 text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <RefreshCcw className="w-3 h-3" /> Tentar novamente
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredNews.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
                className={`border-b border-white/5 p-3 hover:bg-white/[0.02] transition-colors cursor-pointer group relative ${
                  item.isCritical ? 'bg-red-950/10' : ''
                }`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${sentimentColor(item.sentiment)}`} />

                <div className="flex items-start gap-2">
                  {item.isCritical && (
                    <Zap className="w-3 h-3 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                  )}
                  <p className={`text-xs leading-relaxed flex-1 ${
                    item.isCritical ? 'text-red-100' : 'text-slate-300 group-hover:text-white'
                  }`}>
                    {item.title}
                  </p>
                  {item.sentiment === 'positive' && (
                    <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {item.sentiment === 'negative' && (
                    <TrendingDown className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1.5 pl-0">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{item.source}</span>
                  <span className="text-[9px] text-slate-700">•</span>
                  <span className="text-[9px] font-mono text-slate-500">{formatTimeAgo(item.timestamp)}</span>
                  <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1 rounded uppercase">
                    {item.category}
                  </span>
                  {item.url && (
                    <ExternalLink className="w-2.5 h-2.5 text-slate-600 group-hover:text-slate-400 ml-auto transition-colors" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/5 bg-[#080808] shrink-0 flex items-center justify-between">
        <span className="text-[9px] text-slate-600">
          {filteredNews.length} notícias {lastUpdated && `• atualizado ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
        </span>
        <button
          onClick={() => { setIsLoading(true); fetchNews(); }}
          className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-white transition-colors"
        >
          <RefreshCcw className="w-2.5 h-2.5" />
          Atualizar
        </button>
      </div>
    </div>
  );
}
