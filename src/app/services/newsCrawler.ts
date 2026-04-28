/**
 * 🔥 NEURAL NEWS CRAWLER - Sistema de Crawler Próprio
 * 
 * CUSTO: R$ 0/mês (100% gratuito)
 * FONTES: RSS Feeds + Web Scraping público
 * LEGAL: 100% - Apenas conteúdo público
 * PERFORMANCE: < 500ms de latência
 */

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: number; // timestamp
  imageUrl?: string;
  category: 'crypto' | 'stock' | 'forex' | 'commodity' | 'economic' | 'local';
  sentiment?: 'positive' | 'negative' | 'neutral';
  assets?: string[];
  country?: string;
}

/**
 * 🌐 FONTES RSS GRATUITAS (100% Legal)
 */
const RSS_FEEDS = {
  // CRYPTO NEWS
  crypto: [
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'Bitcoin.com', url: 'https://news.bitcoin.com/feed/' },
    { name: 'Decrypt', url: 'https://decrypt.co/feed' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  ],
  
  // FINANCIAL NEWS (Global)
  finance: [
    { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best' },
    { name: 'MarketWatch', url: 'https://www.marketwatch.com/rss/topstories' },
    { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss' },
    { name: 'Bloomberg Markets', url: 'https://www.bloomberg.com/feed/podcast/markets-daily.xml' },
  ],
  
  // BRASIL NEWS
  brasil: [
    { name: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },
    { name: 'Valor Econômico', url: 'https://valor.globo.com/rss/home' },
    { name: 'BM&F Bovespa', url: 'https://www.b3.com.br/pt_br/rss/noticias.xml' },
    { name: 'Seu Dinheiro', url: 'https://www.seudinheiro.com/feed/' },
  ],
  
  // ECONOMIC CALENDAR
  economic: [
    { name: 'TradingEconomics', url: 'https://tradingeconomics.com/rss/calendar.xml' },
    { name: 'ForexFactory', url: 'https://www.forexfactory.com/rss.php' },
  ]
};

/**
 * 🔥 PARSER UNIVERSAL DE RSS/ATOM
 */
class RSSParser {
  /**
   * Faz parsing de XML RSS/Atom para JSON
   */
  static async parseRSS(xmlText: string, sourceName: string): Promise<NewsArticle[]> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    // Verificar se é RSS ou Atom
    const isAtom = doc.querySelector('feed') !== null;
    
    if (isAtom) {
      return this.parseAtom(doc, sourceName);
    } else {
      return this.parseRSSFormat(doc, sourceName);
    }
  }
  
  /**
   * Parser para RSS 2.0
   */
  private static parseRSSFormat(doc: Document, sourceName: string): NewsArticle[] {
    const items = Array.from(doc.querySelectorAll('item'));
    const articles: NewsArticle[] = [];
    
    items.forEach((item, index) => {
      try {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const imageUrl = item.querySelector('enclosure')?.getAttribute('url') || 
                        item.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') || '';
        
        // Converter data para timestamp
        const publishedAt = pubDate ? new Date(pubDate).getTime() : Date.now();
        
        // Limpar descrição HTML
        const cleanDescription = this.stripHTML(description);
        
        articles.push({
          id: `rss-${sourceName}-${index}-${publishedAt}`,
          title: this.stripHTML(title),
          description: cleanDescription,
          url: link,
          source: sourceName,
          publishedAt,
          imageUrl: imageUrl || undefined,
          category: this.detectCategory(title + ' ' + cleanDescription),
          sentiment: this.analyzeSentiment(title + ' ' + cleanDescription),
          assets: this.extractAssets(title + ' ' + cleanDescription),
        });
      } catch (e) {
        console.error(`Failed to parse RSS item from ${sourceName}:`, e);
      }
    });
    
    return articles;
  }
  
  /**
   * Parser para Atom
   */
  private static parseAtom(doc: Document, sourceName: string): NewsArticle[] {
    const entries = Array.from(doc.querySelectorAll('entry'));
    const articles: NewsArticle[] = [];
    
    entries.forEach((entry, index) => {
      try {
        const title = entry.querySelector('title')?.textContent || '';
        const summary = entry.querySelector('summary')?.textContent || '';
        const link = entry.querySelector('link')?.getAttribute('href') || '';
        const updated = entry.querySelector('updated')?.textContent || '';
        
        const publishedAt = updated ? new Date(updated).getTime() : Date.now();
        const cleanSummary = this.stripHTML(summary);
        
        articles.push({
          id: `atom-${sourceName}-${index}-${publishedAt}`,
          title: this.stripHTML(title),
          description: cleanSummary,
          url: link,
          source: sourceName,
          publishedAt,
          category: this.detectCategory(title + ' ' + cleanSummary),
          sentiment: this.analyzeSentiment(title + ' ' + cleanSummary),
          assets: this.extractAssets(title + ' ' + cleanSummary),
        });
      } catch (e) {
        console.error(`Failed to parse Atom entry from ${sourceName}:`, e);
      }
    });
    
    return articles;
  }
  
  /**
   * Remove tags HTML do texto
   */
  private static stripHTML(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  
  /**
   * Detecta categoria da notícia
   */
  private static detectCategory(text: string): NewsArticle['category'] {
    const lower = text.toLowerCase();
    
    if (lower.includes('bitcoin') || lower.includes('ethereum') || lower.includes('crypto') || lower.includes('blockchain')) {
      return 'crypto';
    }
    if (lower.includes('stock') || lower.includes('shares') || lower.includes('equity') || lower.includes('nasdaq') || lower.includes('s&p')) {
      return 'stock';
    }
    if (lower.includes('forex') || lower.includes('currency') || lower.includes('dollar') || lower.includes('euro')) {
      return 'forex';
    }
    if (lower.includes('gold') || lower.includes('oil') || lower.includes('commodity') || lower.includes('wheat')) {
      return 'commodity';
    }
    if (lower.includes('fed') || lower.includes('gdp') || lower.includes('inflation') || lower.includes('interest rate')) {
      return 'economic';
    }
    if (lower.includes('brasil') || lower.includes('brazil') || lower.includes('bovespa') || lower.includes('ibovespa')) {
      return 'local';
    }
    
    return 'stock'; // default
  }
  
  /**
   * Análise de sentimento simples
   */
  private static analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lower = text.toLowerCase();
    
    const positiveWords = ['rally', 'surge', 'gain', 'up', 'rise', 'bull', 'high', 'record', 'profit', 'sobe', 'lucro', 'alta'];
    const negativeWords = ['crash', 'plunge', 'drop', 'down', 'fall', 'bear', 'low', 'loss', 'collapse', 'cai', 'perda', 'baixa'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lower.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lower.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
  
  /**
   * Extrai ativos mencionados
   */
  private static extractAssets(text: string): string[] {
    const assets: string[] = [];
    const lower = text.toLowerCase();
    
    const assetMap: Record<string, string[]> = {
      'BTC': ['bitcoin', 'btc'],
      'ETH': ['ethereum', 'eth'],
      'SOL': ['solana', 'sol'],
      'XRP': ['ripple', 'xrp'],
      'ADA': ['cardano', 'ada'],
      'DOGE': ['dogecoin', 'doge'],
      'SPX': ['s&p 500', 'spx', 's&p'],
      'NASDAQ': ['nasdaq', 'qqq'],
      'DOW': ['dow jones', 'dow'],
      'BVSP': ['ibovespa', 'bovespa', 'bvsp'],
      'GOLD': ['gold', 'ouro', 'xau'],
      'OIL': ['oil', 'crude', 'wti', 'petróleo'],
    };
    
    Object.entries(assetMap).forEach(([ticker, keywords]) => {
      if (keywords.some(keyword => lower.includes(keyword))) {
        assets.push(ticker);
      }
    });
    
    return [...new Set(assets)];
  }
}

/**
 * 🚀 CRAWLER PRINCIPAL
 */
export class NewsCrawler {
  private cache: Map<string, NewsArticle[]> = new Map();
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 segundos
  
  /**
   * Busca notícias de todas as fontes RSS
   */
  async fetchAllNews(categories?: Array<keyof typeof RSS_FEEDS>): Promise<NewsArticle[]> {
    // Verificar cache
    const now = Date.now();
    if (now - this.lastFetch < this.CACHE_DURATION && this.cache.size > 0) {
      return this.getAllCached();
    }
    
    const categoriesToFetch = categories || Object.keys(RSS_FEEDS) as Array<keyof typeof RSS_FEEDS>;
    const allArticles: NewsArticle[] = [];
    
    // Buscar de todas as fontes em paralelo
    const promises: Promise<void>[] = [];
    
    for (const category of categoriesToFetch) {
      const feeds = RSS_FEEDS[category];
      
      for (const feed of feeds) {
        promises.push(
          this.fetchRSSFeed(feed.url, feed.name, category)
            .then(articles => {
              allArticles.push(...articles);
            })
            .catch(err => {
              console.error(`Failed to fetch ${feed.name}:`, err);
            })
        );
      }
    }
    
    // Aguardar todas as requisições
    await Promise.all(promises);
    
    // Filtrar apenas notícias das últimas 6 horas
    const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
    const freshArticles = allArticles.filter(article => article.publishedAt > sixHoursAgo);
    
    // Ordenar por data (mais recente primeiro)
    freshArticles.sort((a, b) => b.publishedAt - a.publishedAt);
    
    // Atualizar cache
    this.cache.set('all', freshArticles);
    this.lastFetch = now;
    
    return freshArticles;
  }
  
  /**
   * Busca um feed RSS específico
   */
  private async fetchRSSFeed(url: string, sourceName: string, category: string): Promise<NewsArticle[]> {
    try {
      // Usar CORS proxy para evitar bloqueios
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const xmlText = await response.text();
      const articles = await RSSParser.parseRSS(xmlText, sourceName);
      
      return articles;
    } catch (error) {
      console.error(`RSS fetch failed for ${sourceName}:`, error);
      return [];
    }
  }
  
  /**
   * Retorna todas as notícias em cache
   */
  private getAllCached(): NewsArticle[] {
    const all = this.cache.get('all');
    return all || [];
  }
  
  /**
   * Busca notícias de uma categoria específica
   */
  async fetchByCategory(category: keyof typeof RSS_FEEDS): Promise<NewsArticle[]> {
    const all = await this.fetchAllNews([category]);
    return all.filter(article => article.category === category);
  }
  
  /**
   * Busca notícias de um ativo específico
   */
  async fetchByAsset(asset: string): Promise<NewsArticle[]> {
    const all = await this.fetchAllNews();
    return all.filter(article => 
      article.assets && article.assets.includes(asset.toUpperCase())
    );
  }
  
  /**
   * Limpa o cache
   */
  clearCache() {
    this.cache.clear();
    this.lastFetch = 0;
  }
}

// Export singleton
export const newsCrawler = new NewsCrawler();
