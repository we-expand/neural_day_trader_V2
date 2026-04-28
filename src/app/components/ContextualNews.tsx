/**
 * 📰 CONTEXTUAL NEWS COMPONENT
 * 
 * Exibe notícias contextualizadas ao ativo selecionado no Dashboard
 * - Filtra por ativo em tempo real
 * - Mostra grau de importância
 * - Integração com Text-to-Speech
 * - Análise de sentimento visual
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Newspaper, TrendingUp, TrendingDown, AlertCircle, 
  Volume2, X, ExternalLink, Clock, Tag, 
  ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { intelligentCrawler, NewsArticle } from '@/app/services/intelligentCrawler';

interface ContextualNewsProps {
  selectedAsset: string; // BTC, ETH, SPX, etc.
  language?: 'pt' | 'en' | 'es';
}

export const ContextualNews: React.FC<ContextualNewsProps> = ({ 
  selectedAsset,
  language = 'pt'
}) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Atualizar artigos quando o ativo mudar
  useEffect(() => {
    const fetchArticles = () => {
      const filtered = intelligentCrawler.getArticlesByAsset(selectedAsset, 10);
      setArticles(filtered);
    };

    fetchArticles();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchArticles, 30000);
    
    return () => clearInterval(interval);
  }, [selectedAsset]);

  // Text-to-Speech
  const speakArticle = (article: NewsArticle) => {
    if ('speechSynthesis' in window) {
      // Parar qualquer fala anterior
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance();
      utterance.text = `${article.title}. ${article.summary}`;
      utterance.lang = article.language === 'pt' ? 'pt-BR' : article.language === 'es' ? 'es-ES' : 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Cor baseada no nível de importância
  const getImportanceColor = (level: NewsArticle['importanceLevel']) => {
    switch (level) {
      case 'critical': return 'text-red-400 border-red-500/50 bg-red-900/20';
      case 'high': return 'text-orange-400 border-orange-500/50 bg-orange-900/20';
      case 'medium': return 'text-yellow-400 border-yellow-500/50 bg-yellow-900/20';
      case 'low': return 'text-slate-400 border-slate-500/50 bg-slate-900/20';
    }
  };

  // Ícone de sentimento
  const getSentimentIcon = (sentiment: NewsArticle['sentiment']) => {
    switch (sentiment) {
      case 'bullish': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'bearish': return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'neutral': return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  if (articles.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Newspaper className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">
            Notícias - {selectedAsset}
          </h3>
        </div>
        <div className="text-center py-8">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">
            Aguardando notícias sobre {selectedAsset}...
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Nosso crawler está buscando conteúdo relevante 24/7
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Newspaper className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-lg font-bold text-white">
              Notícias - {selectedAsset}
            </h3>
            <p className="text-xs text-slate-500">
              {articles.length} artigo{articles.length !== 1 ? 's' : ''} relevante{articles.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Stats rápidos */}
          <div className="flex gap-2">
            {['critical', 'high', 'medium'].map(level => {
              const count = articles.filter(a => a.importanceLevel === level).length;
              if (count === 0) return null;
              return (
                <span 
                  key={level}
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    level === 'critical' ? 'bg-red-900/30 text-red-400' :
                    level === 'high' ? 'bg-orange-900/30 text-orange-400' :
                    'bg-yellow-900/30 text-yellow-400'
                  }`}
                >
                  {count}
                </span>
              );
            })}
          </div>
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Articles List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
              {articles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-xl border transition-all hover:shadow-lg cursor-pointer ${
                    getImportanceColor(article.importanceLevel)
                  }`}
                  onClick={() => setSelectedArticle(article)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-1 leading-tight">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{article.source}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{article.readTime || 3} min</span>
                        <span>•</span>
                        <span>{new Date(article.publishedAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-3">
                      {getSentimentIcon(article.sentiment)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakArticle(article);
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <Volume2 className={`w-4 h-4 ${isSpeaking ? 'text-cyan-400' : 'text-slate-400'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {article.summary.substring(0, 150)}...
                  </p>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {/* Importância */}
                    <span className="px-2 py-0.5 bg-black/30 rounded text-[10px] font-bold uppercase">
                      {article.importanceLevel}
                    </span>
                    
                    {/* Sentimento Score */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      article.sentimentScore > 0 ? 'bg-emerald-900/30 text-emerald-400' :
                      article.sentimentScore < 0 ? 'bg-red-900/30 text-red-400' :
                      'bg-slate-900/30 text-slate-400'
                    }`}>
                      {article.sentiment} {article.sentimentScore > 0 ? '+' : ''}{article.sentimentScore.toFixed(0)}
                    </span>
                    
                    {/* Relevância */}
                    <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-[10px] font-bold">
                      {article.relevanceScore}% relevância
                    </span>

                    {/* Ativos relacionados */}
                    {article.relatedAssets.slice(0, 3).map(asset => (
                      <span key={asset} className="px-2 py-0.5 bg-cyan-900/30 text-cyan-400 rounded text-[10px] font-mono">
                        {asset}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Article Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedArticle(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-black text-white mb-3">
                      {selectedArticle.title}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span className="font-bold">{selectedArticle.source}</span>
                      <span>•</span>
                      <span>{new Date(selectedArticle.publishedAt).toLocaleDateString('pt-BR')}</span>
                      <span>•</span>
                      <span>{selectedArticle.readTime} min de leitura</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    selectedArticle.importanceLevel === 'critical' ? 'bg-red-900/30 text-red-400' :
                    selectedArticle.importanceLevel === 'high' ? 'bg-orange-900/30 text-orange-400' :
                    selectedArticle.importanceLevel === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-slate-900/30 text-slate-400'
                  }`}>
                    {selectedArticle.importanceLevel.toUpperCase()}
                  </span>
                  
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    selectedArticle.sentiment === 'bullish' ? 'bg-emerald-900/30 text-emerald-400' :
                    selectedArticle.sentiment === 'bearish' ? 'bg-red-900/30 text-red-400' :
                    'bg-slate-900/30 text-slate-400'
                  }`}>
                    {getSentimentIcon(selectedArticle.sentiment)}
                    {selectedArticle.sentiment} ({selectedArticle.sentimentScore > 0 ? '+' : ''}{selectedArticle.sentimentScore.toFixed(0)})
                  </span>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                <p className="text-slate-300 leading-relaxed mb-6">
                  {selectedArticle.summary}
                </p>
                
                <div className="prose prose-invert max-w-none">
                  <p className="text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {selectedArticle.fullContent}
                  </p>
                </div>

                {/* Keywords */}
                {selectedArticle.keywords.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-500 uppercase font-bold">Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedArticle.keywords.map(keyword => (
                        <span key={keyword} className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-700 flex items-center justify-between">
                <div className="flex gap-3">
                  <button
                    onClick={() => speakArticle(selectedArticle)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    Ouvir Notícia
                  </button>
                  
                  {isSpeaking && (
                    <button
                      onClick={stopSpeaking}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
                    >
                      Parar
                    </button>
                  )}
                </div>

                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                  Ler Original
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
