/**
 * 🕷️ CRAWLER MONITOR - ADMIN PANEL
 * 
 * Painel de monitoramento do Intelligent Crawler
 * - Mostra o crawler buscando notícias AO VIVO
 * - Análise de IA em tempo real
 * - Logs detalhados de tudo que acontece
 * - Estatísticas visuais
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, Newspaper, Sparkles, TrendingUp, TrendingDown, 
  Activity, Zap, AlertCircle, CheckCircle, Clock,
  Play, Pause, RefreshCw, Eye, Volume2, BarChart3
} from 'lucide-react';

// Simulação de fonte RSS (vamos buscar de verdade!)
interface RSSFeed {
  name: string;
  url: string;
  status: 'idle' | 'fetching' | 'parsing' | 'analyzing' | 'complete' | 'error';
  itemsFound: number;
  timeMs: number;
}

interface LiveArticle {
  id: string;
  title: string;
  source: string;
  timestamp: Date;
  
  // AI Analysis
  relatedAssets: string[];
  relevanceScore: number;
  importanceLevel: 'low' | 'medium' | 'high' | 'critical';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  
  // Status
  status: 'fetching' | 'analyzing' | 'complete';
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  icon?: React.ReactNode;
}

export const CrawlerMonitor: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [articles, setArticles] = useState<LiveArticle[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    totalFetched: 0,
    totalAnalyzed: 0,
    avgRelevance: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    bullishCount: 0,
    bearishCount: 0,
    neutralCount: 0,
  });
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>('BTC');

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Adicionar log
  const addLog = (type: LogEntry['type'], message: string, icon?: React.ReactNode) => {
    const log: LogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      message,
      icon
    };
    setLogs(prev => [...prev, log].slice(-50)); // Manter últimos 50
  };

  // Análise de IA (simplificada para demo)
  const analyzeWithAI = (title: string, source: string): Partial<LiveArticle> => {
    const titleLower = title.toLowerCase();
    
    // Detectar ativos
    const relatedAssets: string[] = [];
    if (titleLower.match(/bitcoin|btc/)) relatedAssets.push('BTC');
    if (titleLower.match(/ethereum|eth/)) relatedAssets.push('ETH');
    if (titleLower.match(/solana|sol/)) relatedAssets.push('SOL');
    if (titleLower.match(/xrp|ripple/)) relatedAssets.push('XRP');
    if (titleLower.match(/s&p|spx|sp500/)) relatedAssets.push('SPX');
    if (titleLower.match(/nasdaq/)) relatedAssets.push('NAS100');
    if (titleLower.match(/dow|djia/)) relatedAssets.push('US30');
    
    // Calcular relevância
    let relevanceScore = 50;
    relevanceScore += relatedAssets.length * 15;
    if (titleLower.match(/breaking|urgent|alert/)) relevanceScore += 20;
    if (titleLower.match(/crash|surge|record|ath/)) relevanceScore += 15;
    relevanceScore = Math.min(100, relevanceScore);
    
    // Importância
    let importanceLevel: LiveArticle['importanceLevel'] = 'low';
    if (relevanceScore >= 80) importanceLevel = 'critical';
    else if (relevanceScore >= 65) importanceLevel = 'high';
    else if (relevanceScore >= 45) importanceLevel = 'medium';
    
    // Sentimento
    const bullishWords = ['rally', 'surge', 'pump', 'moon', 'ath', 'breakout', 'gain', 'bullish', 'up'];
    const bearishWords = ['crash', 'dump', 'bear', 'fall', 'drop', 'plunge', 'decline', 'bearish', 'down'];
    
    let bullishCount = 0;
    let bearishCount = 0;
    
    bullishWords.forEach(word => {
      if (titleLower.includes(word)) bullishCount++;
    });
    
    bearishWords.forEach(word => {
      if (titleLower.includes(word)) bearishCount++;
    });
    
    let sentiment: LiveArticle['sentiment'] = 'neutral';
    let sentimentScore = 0;
    
    if (bullishCount > bearishCount) {
      sentiment = 'bullish';
      sentimentScore = Math.min(100, (bullishCount / (bullishCount + bearishCount)) * 100);
    } else if (bearishCount > bullishCount) {
      sentiment = 'bearish';
      sentimentScore = -Math.min(100, (bearishCount / (bullishCount + bearishCount)) * 100);
    }
    
    return {
      relatedAssets,
      relevanceScore,
      importanceLevel,
      sentiment,
      sentimentScore
    };
  };

  // Buscar de uma fonte RSS REAL
  const fetchFromRSS = async (feed: RSSFeed) => {
    const startTime = Date.now();
    
    try {
      addLog('info', `🌐 Conectando em ${feed.name}...`, <Newspaper className="w-4 h-4" />);
      
      setFeeds(prev => prev.map(f => 
        f.url === feed.url ? { ...f, status: 'fetching' } : f
      ));
      
      // Usar um proxy CORS para buscar RSS
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const response = await fetch(proxyUrl + encodeURIComponent(feed.url), {
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const xmlText = await response.text();
      
      setFeeds(prev => prev.map(f => 
        f.url === feed.url ? { ...f, status: 'parsing' } : f
      ));
      
      addLog('success', `✅ Feed recebido de ${feed.name}`, <CheckCircle className="w-4 h-4" />);
      
      // Parse XML simples
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const items = xmlDoc.querySelectorAll('item, entry');
      
      addLog('info', `📰 ${items.length} artigos encontrados em ${feed.name}`, <Eye className="w-4 h-4" />);
      
      setFeeds(prev => prev.map(f => 
        f.url === feed.url ? { ...f, status: 'analyzing', itemsFound: items.length } : f
      ));
      
      // Processar artigos
      const newArticles: LiveArticle[] = [];
      
      items.forEach((item, index) => {
        if (index >= 10) return; // Limitar a 10 por feed
        
        const titleEl = item.querySelector('title');
        const linkEl = item.querySelector('link');
        const pubDateEl = item.querySelector('pubDate, published');
        
        if (!titleEl) return;
        
        const title = titleEl.textContent || '';
        const url = linkEl?.textContent || linkEl?.getAttribute('href') || '';
        const pubDate = pubDateEl?.textContent || '';
        
        addLog('info', `🤖 Analisando: "${title.substring(0, 50)}..."`, <Bot className="w-4 h-4" />);
        
        // Análise com IA
        const analysis = analyzeWithAI(title, feed.name);
        
        const article: LiveArticle = {
          id: `${feed.name}-${index}-${Date.now()}`,
          title,
          source: feed.name,
          timestamp: pubDate ? new Date(pubDate) : new Date(),
          status: 'complete',
          ...analysis as any
        };
        
        newArticles.push(article);
        
        // Log da análise
        const assetsStr = article.relatedAssets.length > 0 
          ? article.relatedAssets.join(', ') 
          : 'nenhum';
        
        addLog(
          article.importanceLevel === 'critical' ? 'warning' : 'success',
          `✨ ${article.importanceLevel.toUpperCase()} | ${article.sentiment.toUpperCase()} ${article.sentimentScore > 0 ? '+' : ''}${article.sentimentScore.toFixed(0)} | Ativos: ${assetsStr}`,
          <Sparkles className="w-4 h-4" />
        );
      });
      
      setArticles(prev => [...newArticles, ...prev].slice(0, 50)); // Manter últimos 50
      
      const timeMs = Date.now() - startTime;
      
      setFeeds(prev => prev.map(f => 
        f.url === feed.url ? { ...f, status: 'complete', timeMs } : f
      ));
      
      addLog('success', `✅ ${feed.name} concluído em ${timeMs}ms`, <CheckCircle className="w-4 h-4" />);
      
      // Atualizar stats
      setStats(prev => {
        const allArticles = [...newArticles, ...articles];
        return {
          totalFetched: prev.totalFetched + items.length,
          totalAnalyzed: prev.totalAnalyzed + newArticles.length,
          avgRelevance: allArticles.reduce((sum, a) => sum + a.relevanceScore, 0) / allArticles.length,
          criticalCount: allArticles.filter(a => a.importanceLevel === 'critical').length,
          highCount: allArticles.filter(a => a.importanceLevel === 'high').length,
          mediumCount: allArticles.filter(a => a.importanceLevel === 'medium').length,
          lowCount: allArticles.filter(a => a.importanceLevel === 'low').length,
          bullishCount: allArticles.filter(a => a.sentiment === 'bullish').length,
          bearishCount: allArticles.filter(a => a.sentiment === 'bearish').length,
          neutralCount: allArticles.filter(a => a.sentiment === 'neutral').length,
        };
      });
      
    } catch (error) {
      const timeMs = Date.now() - startTime;
      setFeeds(prev => prev.map(f => 
        f.url === feed.url ? { ...f, status: 'error', timeMs } : f
      ));
      addLog('error', `❌ Erro em ${feed.name}: ${error}`, <AlertCircle className="w-4 h-4" />);
    }
  };

  // Iniciar crawler
  const startCrawler = async () => {
    setIsRunning(true);
    setArticles([]);
    setLogs([]);
    
    addLog('info', '🚀 Iniciando Intelligent Crawler...', <Play className="w-4 h-4" />);
    
    // Feeds REAIS para testar
    const testFeeds: RSSFeed[] = [
      { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', status: 'idle', itemsFound: 0, timeMs: 0 },
      { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', status: 'idle', itemsFound: 0, timeMs: 0 },
      { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss/full/', status: 'idle', itemsFound: 0, timeMs: 0 },
    ];
    
    setFeeds(testFeeds);
    
    addLog('success', `📡 ${testFeeds.length} fontes RSS configuradas`, <CheckCircle className="w-4 h-4" />);
    
    // Buscar sequencialmente (para visualizar melhor)
    for (const feed of testFeeds) {
      await fetchFromRSS(feed);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa de 1s entre feeds
    }
    
    addLog('success', '🎉 Crawler concluído! Todas as fontes processadas.', <CheckCircle className="w-4 h-4" />);
    setIsRunning(false);
  };

  // Filtrar artigos por ativo
  const filteredArticles = selectedAsset === 'ALL' 
    ? articles 
    : articles.filter(a => a.relatedAssets.includes(selectedAsset));

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">
                🕷️ Intelligent Crawler - Monitor
              </h1>
              <p className="text-slate-300 mt-1">
                Veja o crawler buscando notícias e analisando com IA em tempo real
              </p>
            </div>
          </div>
          
          <button
            onClick={startCrawler}
            disabled={isRunning}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-3 transition-colors text-lg"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin" />
                Rodando...
              </>
            ) : (
              <>
                <Play className="w-6 h-6" />
                Iniciar Crawler
              </>
            )}
          </button>
        </div>

        {/* Stats */}
        {stats.totalAnalyzed > 0 && (
          <div className="grid grid-cols-6 gap-4 mt-6">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-3xl font-black text-white">{stats.totalAnalyzed}</div>
              <div className="text-xs text-slate-300 uppercase mt-1">Analisados</div>
            </div>
            <div className="bg-emerald-500/20 rounded-lg p-3">
              <div className="text-3xl font-black text-emerald-400">{stats.criticalCount}</div>
              <div className="text-xs text-slate-300 uppercase mt-1">Critical</div>
            </div>
            <div className="bg-orange-500/20 rounded-lg p-3">
              <div className="text-3xl font-black text-orange-400">{stats.highCount}</div>
              <div className="text-xs text-slate-300 uppercase mt-1">High</div>
            </div>
            <div className="bg-cyan-500/20 rounded-lg p-3">
              <div className="text-3xl font-black text-cyan-400">{Math.round(stats.avgRelevance)}%</div>
              <div className="text-xs text-slate-300 uppercase mt-1">Relevância Média</div>
            </div>
            <div className="bg-green-500/20 rounded-lg p-3">
              <div className="text-3xl font-black text-green-400">{stats.bullishCount}</div>
              <div className="text-xs text-slate-300 uppercase mt-1">Bullish</div>
            </div>
            <div className="bg-red-500/20 rounded-lg p-3">
              <div className="text-3xl font-black text-red-400">{stats.bearishCount}</div>
              <div className="text-xs text-slate-300 uppercase mt-1">Bearish</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-6 overflow-hidden">
        
        {/* Left: RSS Feeds Status */}
        <div className="col-span-3 bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-y-auto">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Fontes RSS
          </h3>
          
          <div className="space-y-3">
            {feeds.map(feed => (
              <div
                key={feed.url}
                className={`p-3 rounded-lg border transition-all ${
                  feed.status === 'complete' ? 'bg-emerald-900/20 border-emerald-500/30' :
                  feed.status === 'error' ? 'bg-red-900/20 border-red-500/30' :
                  feed.status === 'idle' ? 'bg-slate-800 border-slate-700' :
                  'bg-cyan-900/20 border-cyan-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{feed.name}</span>
                  {feed.status === 'fetching' && <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />}
                  {feed.status === 'parsing' && <Eye className="w-4 h-4 text-cyan-400 animate-pulse" />}
                  {feed.status === 'analyzing' && <Bot className="w-4 h-4 text-purple-400 animate-bounce" />}
                  {feed.status === 'complete' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {feed.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                </div>
                
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Status: <span className="font-bold text-white">{feed.status}</span></div>
                  {feed.itemsFound > 0 && <div>Artigos: <span className="font-bold text-white">{feed.itemsFound}</span></div>}
                  {feed.timeMs > 0 && <div>Tempo: <span className="font-bold text-white">{feed.timeMs}ms</span></div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Logs em Tempo Real */}
        <div className="col-span-5 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Logs em Tempo Real
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs bg-black">
            <AnimatePresence>
              {logs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-2 rounded flex items-start gap-2 ${
                    log.type === 'success' ? 'bg-emerald-900/20 text-emerald-300' :
                    log.type === 'error' ? 'bg-red-900/20 text-red-300' :
                    log.type === 'warning' ? 'bg-yellow-900/20 text-yellow-300' :
                    'bg-slate-800 text-slate-300'
                  }`}
                >
                  {log.icon}
                  <span className="text-slate-500">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                  <span className="flex-1">{log.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Right: Artigos Analisados */}
        <div className="col-span-4 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
              <Newspaper className="w-5 h-5 text-purple-400" />
              Artigos Analisados
            </h3>
            
            {/* Filtro de Ativos */}
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'BTC', 'ETH', 'SOL', 'XRP', 'SPX'].map(asset => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    selectedAsset === asset
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence>
              {filteredArticles.map(article => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-3 rounded-xl border ${
                    article.importanceLevel === 'critical' ? 'bg-red-900/20 border-red-500/30' :
                    article.importanceLevel === 'high' ? 'bg-orange-900/20 border-orange-500/30' :
                    article.importanceLevel === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30' :
                    'bg-slate-800 border-slate-700'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white mb-2 leading-tight">
                    {article.title}
                  </h4>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <span>{article.source}</span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{article.timestamp.toLocaleTimeString()}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      article.importanceLevel === 'critical' ? 'bg-red-500/20 text-red-300' :
                      article.importanceLevel === 'high' ? 'bg-orange-500/20 text-orange-300' :
                      article.importanceLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {article.importanceLevel.toUpperCase()}
                    </span>
                    
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                      article.sentiment === 'bullish' ? 'bg-emerald-500/20 text-emerald-300' :
                      article.sentiment === 'bearish' ? 'bg-red-500/20 text-red-300' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {article.sentiment === 'bullish' ? <TrendingUp className="w-3 h-3" /> : 
                       article.sentiment === 'bearish' ? <TrendingDown className="w-3 h-3" /> : null}
                      {article.sentiment.toUpperCase()} {article.sentimentScore > 0 ? '+' : ''}{article.sentimentScore.toFixed(0)}
                    </span>
                    
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
                      {article.relevanceScore.toFixed(0)}% relevância
                    </span>
                    
                    {article.relatedAssets.map(asset => (
                      <span key={asset} className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300">
                        {asset}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
