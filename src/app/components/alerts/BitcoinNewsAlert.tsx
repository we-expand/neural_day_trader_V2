import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Newspaper, ExternalLink, RefreshCcw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface NewsItem {
  id: string;
  title: string;
  body: string;
  url: string;
  imageUrl: string;
  source: string;
  publishedAt: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  categories: string[];
}

interface MarketAlert {
  alert: boolean;
  symbol: string;
  priceChange: number;
  direction: 'up' | 'down';
  marketData: {
    lastPrice: string;
    high24h: string;
    low24h: string;
    volume: string;
  };
  sentiment: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  reasons: string[];
  news: Array<{
    title: string;
    url: string;
    source: string;
    publishedAt: number;
  }>;
  timestamp: number;
}

export function BitcoinNewsAlert() {
  const [alert, setAlert] = useState<MarketAlert | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6`;

  const fetchMarketAlert = async () => {
    try {
      setLoading(true);
      
      // Buscar alerta de mercado
      const alertResponse = await fetch(
        `${API_BASE}/crypto-market-alert?symbol=BTC`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (alertResponse.ok) {
        const alertData = await alertResponse.json();
        if (alertData.alert) {
          setAlert(alertData);
          setIsDismissed(false);
        } else {
          setAlert(null);
        }
      }

      // Buscar notícias de Bitcoin
      const newsResponse = await fetch(
        `${API_BASE}/crypto-news?query=BTC&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        setNews(newsData.news || []);
      }

      setLastUpdate(Date.now());
      setLoading(false);
      
    } catch (error) {
      console.error('[BitcoinNewsAlert] Erro ao buscar dados:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketAlert();

    const interval = setInterval(() => {
      fetchMarketAlert();
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  if (isDismissed || (!alert && news.length === 0)) {
    return null;
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours}h atrás`;
    if (minutes > 0) return `${minutes}m atrás`;
    return 'Agora';
  };

  const getSentimentColor = (sentiment: 'bullish' | 'bearish' | 'neutral') => {
    switch (sentiment) {
      case 'bullish': return 'text-green-400';
      case 'bearish': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getSentimentIcon = (sentiment: 'bullish' | 'bearish' | 'neutral') => {
    switch (sentiment) {
      case 'bullish': return <TrendingUp className="w-3 h-3" />;
      case 'bearish': return <TrendingDown className="w-3 h-3" />;
      default: return <Newspaper className="w-3 h-3" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 z-50 w-[420px] max-h-[600px] flex flex-col"
      >
        {alert && (
          <div className={`mb-2 rounded-lg border ${
            alert.direction === 'down' 
              ? 'bg-red-950/40 border-red-500/30' 
              : 'bg-green-950/40 border-green-500/30'
          } backdrop-blur-xl shadow-2xl`}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {alert.direction === 'down' ? (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  )}
                  <div>
                    <h3 className="font-bold text-white">
                      Bitcoin {alert.direction === 'down' ? 'Caindo' : 'Subindo'}{' '}
                      <span className={alert.direction === 'down' ? 'text-red-400' : 'text-green-400'}>
                        {Math.abs(alert.priceChange).toFixed(2)}%
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      ${parseFloat(alert.marketData.lastPrice).toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {alert.reasons.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-slate-300 mb-2">Possíveis razões:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {alert.reasons.map((reason, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-[10px] bg-black/30 border border-white/10 rounded text-slate-300 capitalize"
                      >
                        {reason.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-slate-400">Bullish: {alert.sentiment.bullish}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-slate-400">Bearish: {alert.sentiment.bearish}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-500 rounded-full" />
                  <span className="text-slate-400">Neutral: {alert.sentiment.neutral}</span>
                </div>
              </div>

              {alert.news.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs font-bold text-slate-300 mb-2">Notícias relacionadas:</p>
                  <div className="space-y-2">
                    {alert.news.slice(0, 2).map((item, idx) => (
                      <a
                        key={idx}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 bg-black/30 hover:bg-black/50 border border-white/10 rounded transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-slate-300 line-clamp-2 group-hover:text-white transition-colors">
                            {item.title}
                          </p>
                          <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {item.source} • {formatTimestamp(item.publishedAt)}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-[#1a1a1a]/95 border border-white/10 rounded-lg backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-orange-400" />
              <h3 className="font-bold text-white text-sm">Bitcoin News</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchMarketAlert}
                disabled={loading}
                className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                title="Atualizar"
              >
                <RefreshCcw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {loading && news.length === 0 ? (
                    <div className="p-8 text-center">
                      <RefreshCcw className="w-8 h-8 text-slate-600 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-slate-400">Carregando notícias...</p>
                    </div>
                  ) : news.length === 0 ? (
                    <div className="p-8 text-center">
                      <Newspaper className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">Nenhuma notícia disponível</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {news.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 hover:bg-white/5 transition-colors group"
                        >
                          <div className="flex gap-3">
                            {item.imageUrl && (
                              <div className="w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-black/30">
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="text-xs font-medium text-white line-clamp-2 group-hover:text-orange-400 transition-colors">
                                  {item.title}
                                </h4>
                                <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                              </div>
                              
                              <p className="text-[10px] text-slate-400 line-clamp-2 mb-2">
                                {item.body}
                              </p>

                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500">
                                  {item.source} • {formatTimestamp(item.publishedAt)}
                                </span>
                                <div className={`flex items-center gap-1 ${getSentimentColor(item.sentiment)}`}>
                                  {getSentimentIcon(item.sentiment)}
                                  <span className="text-[10px] capitalize">{item.sentiment}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-2 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500">
              Última atualização: {formatTimestamp(lastUpdate)}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
