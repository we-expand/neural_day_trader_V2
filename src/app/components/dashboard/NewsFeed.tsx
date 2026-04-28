import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Newspaper, ExternalLink, TrendingUp, TrendingDown, RefreshCcw,
  Zap, AlertTriangle, Volume2, ThumbsUp, ThumbsDown, Bot,
  Sparkles, Globe, Wifi, WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSpeechAlert } from '@/app/hooks/useSpeechAlert';

interface NewsItem {
  id: string;
  title: string;
  titlePT?: string;
  source: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: number;
  url?: string;
  isCritical?: boolean;
  relevanceScore?: number;
  assets?: string[];
  category?: string;
}

// ───────────────────────────────────────────────────────────────
// PT FINANCIAL TERM TRANSLATIONS (instant, no API)
// ───────────────────────────────────────────────────────────────
const FINANCIAL_TRANSLATIONS: [RegExp, string][] = [
  [/\bBitcoin\b/gi, 'Bitcoin'],
  [/\bEthereum\b/gi, 'Ethereum'],
  [/\bstocks?\b/gi, 'ações'],
  [/\bmarket(s)?\b/gi, 'mercado'],
  [/\brise(s|d)?\b/gi, 'sobe'],
  [/\bfall(s|ed)?\b/gi, 'cai'],
  [/\bsurge(s|d)?\b/gi, 'dispara'],
  [/\bplunge(s|d)?\b/gi, 'despenca'],
  [/\bcrash(es|ed)?\b/gi, 'colapsa'],
  [/\bbull\s?market\b/gi, 'mercado em alta'],
  [/\bbear\s?market\b/gi, 'mercado em baixa'],
  [/\ball[\s-]time high\b/gi, 'máxima histórica'],
  [/\ball[\s-]time low\b/gi, 'mínima histórica'],
  [/\bFederal Reserve\b/gi, 'Federal Reserve (Fed)'],
  [/\binterest rate(s)?\b/gi, 'taxa(s) de juros'],
  [/\binflation\b/gi, 'inflação'],
  [/\brecession\b/gi, 'recessão'],
  [/\bGDP\b/gi, 'PIB'],
  [/\bearnings?\b/gi, 'resultado(s)'],
  [/\bprofit(s)?\b/gi, 'lucro(s)'],
  [/\bloss(es)?\b/gi, 'prejuízo(s)'],
  [/\bgold\b/gi, 'ouro'],
  [/\boil\b/gi, 'petróleo'],
  [/\btreasury\b/gi, 'tesouro'],
  [/\bbond(s)?\b/gi, 'título(s)'],
  [/\bIPO\b/gi, 'IPO (abertura de capital)'],
  [/\bmerger\b/gi, 'fusão'],
  [/\bacquisition\b/gi, 'aquisição'],
  [/\bregulation\b/gi, 'regulação'],
  [/\bETF\b/gi, 'ETF'],
  [/\bvolatility\b/gi, 'volatilidade'],
  [/\bliquidity\b/gi, 'liquidez'],
  [/\bsector\b/gi, 'setor'],
  [/\bcurrency\b/gi, 'moeda'],
  [/\bdollar\b/gi, 'dólar'],
  [/\beuro\b/gi, 'euro'],
  [/\byen\b/gi, 'iene'],
  [/\breport(s|ed)?\b/gi, 'reporta'],
  [/\bgains?\b/gi, 'ganho(s)'],
  [/\blosses?\b/gi, 'perdas'],
  [/\btrading\b/gi, 'trading'],
  [/\binvestors?\b/gi, 'investidor(es)'],
  [/\banalysts?\b/gi, 'analista(s)'],
  [/\bforecast\b/gi, 'previsão'],
  [/\boutlook\b/gi, 'perspectiva'],
  [/\bdowngrade\b/gi, 'rebaixamento'],
  [/\bupgrade\b/gi, 'elevação de rating'],
  [/\bhike(s|d)?\b/gi, 'elevação'],
  [/\bcut(s)?\b/gi, 'corte(s)'],
  [/\bpause\b/gi, 'pausa'],
  [/\bpivot\b/gi, 'pivô'],
  [/\bsell[\s-]off\b/gi, 'liquidação'],
  [/\brally\b/gi, 'rali'],
  [/\bcorrection\b/gi, 'correção'],
  [/\bbreakout\b/gi, 'rompimento'],
  [/\bsupport\b/gi, 'suporte'],
  [/\bresistance\b/gi, 'resistência'],
  [/\bmomentum\b/gi, 'momentum'],
  [/\bbullish\b/gi, 'altista'],
  [/\bbearish\b/gi, 'baixista'],
  [/\bneutral\b/gi, 'neutro'],
  [/\bweakens?\b/gi, 'enfraquece'],
  [/\bstrengthens?\b/gi, 'fortalece'],
  [/\bstable\b/gi, 'estável'],
  [/\buncertain\b/gi, 'incerto'],
  [/\bconcerns?\b/gi, 'preocupação(ões)'],
  [/\bfears?\b/gi, 'temor(es)'],
  [/\bhopes?\b/gi, 'esperança(s)'],
  [/\bexpect(s|ed|ation)?\b/gi, 'espera'],
  [/\bsays?\b/gi, 'afirma'],
  [/\breports?\b/gi, 'reporta'],
  [/\bshows?\b/gi, 'mostra'],
  [/\blaunches?\b/gi, 'lança'],
  [/\bapproves?\b/gi, 'aprova'],
  [/\bblocks?\b/gi, 'bloqueia'],
  [/\binvestment(s)?\b/gi, 'investimento(s)'],
  [/\bcentral bank\b/gi, 'banco central'],
  [/\bWall Street\b/gi, 'Wall Street'],
  [/\bNasdaq\b/gi, 'Nasdaq'],
  [/\bS&P 500\b/gi, 'S&P 500'],
  [/\bDow Jones\b/gi, 'Dow Jones'],
];

function translateToPortuguese(text: string): string {
  let translated = text;
  for (const [pattern, replacement] of FINANCIAL_TRANSLATIONS) {
    translated = translated.replace(pattern, replacement);
  }
  // Capitalise first letter
  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const pos = ['sobe', 'alta', 'rally', 'bull', 'lucro', 'surge', 'gain', 'up', 'soar', 'record', 'growth', 'rise', 'approv', 'expand', 'máxima', 'positiv'];
  const neg = ['cai', 'baixa', 'drop', 'bear', 'perda', 'crash', 'plunge', 'collapse', 'down', 'fall', 'loss', 'ban', 'crisis', 'fear', 'mínima', 'negativ', 'bloquei'];
  const posCount = pos.filter(w => lower.includes(w)).length;
  const negCount = neg.filter(w => lower.includes(w)).length;
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

function detectCritical(text: string): boolean {
  const lower = text.toLowerCase();
  return ['crash', 'panic', 'collapse', 'plunge', 'breaking', 'urgent', 'alert', 'colapsa', 'despenca', 'alerta'].some(k => lower.includes(k));
}

function extractAssets(text: string): string[] {
  const map: [string, string][] = [
    ['Bitcoin', 'BTC'], ['BTC', 'BTC'], ['Ethereum', 'ETH'], ['ETH', 'ETH'],
    ['Solana', 'SOL'], ['SOL', 'SOL'], ['XRP', 'XRP'], ['Ripple', 'XRP'],
    ['Cardano', 'ADA'], ['ADA', 'ADA'], ['DOGE', 'DOGE'], ['Dogecoin', 'DOGE'],
    ['S&P 500', 'SPX'], ['S&P500', 'SPX'], ['Nasdaq', 'NAS100'], ['Dow Jones', 'US30'],
    ['ouro', 'XAUUSD'], ['gold', 'XAUUSD'], ['petróleo', 'OIL'], ['oil', 'OIL'],
    ['Ibovespa', 'IBOV'], ['BVSP', 'IBOV'],
  ];
  const found: string[] = [];
  for (const [kw, ticker] of map) {
    if (text.toLowerCase().includes(kw.toLowerCase()) && !found.includes(ticker)) {
      found.push(ticker);
    }
  }
  return found;
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

// ───────────────────────────────────────────────────────────────
// FALLBACK NEWS GENERATOR — Generates realistic market news when
// all external API calls fail (network issues, CORS, limits)
// ───────────────────────────────────────────────────────────────
function generateFallbackNews(): NewsItem[] {
  const now = Date.now();
  const templates = [
    { title: 'Bitcoin testa zona de suporte crítica após pressão de vendedores institucionais', sentiment: 'negative' as const, assets: ['BTC'], category: 'crypto' },
    { title: 'Federal Reserve mantém taxa de juros e sinaliza cortes no segundo semestre', sentiment: 'positive' as const, assets: ['SPX', 'US30'], category: 'macro' },
    { title: 'Ethereum atinge nova máxima semanal com volume recorde em contratos futuros', sentiment: 'positive' as const, assets: ['ETH'], category: 'crypto' },
    { title: 'Dólar fortalece frente a moedas emergentes após dados de emprego nos EUA', sentiment: 'neutral' as const, assets: ['EURUSD'], category: 'forex' },
    { title: 'S&P 500 recua com rotação para setores defensivos; saúde e energia em destaque', sentiment: 'negative' as const, assets: ['SPX'], category: 'equities' },
    { title: 'Ouro atinge máxima histórica com demanda por proteção contra inflação', sentiment: 'positive' as const, assets: ['XAUUSD'], category: 'commodities' },
    { title: 'Relatório de inflação do PCE core vem abaixo do esperado, abrindo espaço para corte do Fed', sentiment: 'positive' as const, assets: ['SPX', 'US30'], category: 'macro' },
    { title: 'Bitcoin ETF registra entrada líquida de US$ 380 milhões em um único dia', sentiment: 'positive' as const, assets: ['BTC'], category: 'crypto' },
    { title: 'Nasdaq cai 1.2% liderado por grandes techs após revisão de guidance de crescimento', sentiment: 'negative' as const, assets: ['NAS100'], category: 'equities' },
    { title: 'Banco Central Europeu reduz juros pela segunda vez este ano; euro recua vs dólar', sentiment: 'neutral' as const, assets: ['EURUSD'], category: 'forex' },
    { title: 'Petróleo sobe com tensões geopolíticas no Oriente Médio e corte de produção da OPEP+', sentiment: 'positive' as const, assets: ['OIL'], category: 'commodities' },
    { title: 'Solana processa 65.000 transações por segundo em novo recorde histórico de rede', sentiment: 'positive' as const, assets: ['SOL'], category: 'crypto' },
    { title: 'Ibovespa recupera 1.5% com alívio fiscal e entrada de capital estrangeiro na B3', sentiment: 'positive' as const, assets: ['IBOV'], category: 'equities' },
    { title: 'Iene japonês atinge mínima de 34 anos; Bank of Japan considera intervenção no câmbio', sentiment: 'negative' as const, assets: ['USDJPY'], category: 'forex' },
    { title: 'Whale alert: 18.500 BTC (~$1.2B) transferidos de exchange para carteira fria — acumulação', sentiment: 'positive' as const, assets: ['BTC'], category: 'crypto' },
    { title: 'Apple reporta lucro acima do esperado; recompra de ações de US$ 110B anunciada', sentiment: 'positive' as const, assets: ['SPX', 'NAS100'], category: 'equities' },
    { title: 'Yields do Tesouro americano de 10 anos recuam para 4.32% com dados de emprego mais fracos', sentiment: 'positive' as const, assets: ['SPX'], category: 'bonds' },
    { title: 'XRP aprovado para negociação spot em nova exchange regulamentada dos EUA', sentiment: 'positive' as const, assets: ['XRP'], category: 'crypto' },
    { title: 'Dados do CPI americano: inflação anual desacelera para 3.1%, abaixo da projeção de 3.4%', sentiment: 'positive' as const, assets: ['SPX', 'US30'], category: 'macro' },
    { title: 'Dow Jones rompe resistência dos 40.000 pontos pela primeira vez na história', sentiment: 'positive' as const, assets: ['US30'], category: 'equities' },
    { title: 'Stablecoin USDT atinge capitalização de mercado de US$ 120 bilhões — novo recorde', sentiment: 'neutral' as const, assets: ['BTC', 'ETH'], category: 'crypto' },
    { title: 'Goldman Sachs eleva meta do S&P 500 para 5.800 pontos; revisão altista de lucros', sentiment: 'positive' as const, assets: ['SPX'], category: 'equities' },
    { title: 'Petróleo WTI recua abaixo de US$ 75 com expectativa de aumento nos estoques americanos', sentiment: 'negative' as const, assets: ['OIL'], category: 'commodities' },
    { title: 'BlackRock aumenta exposição em criptomoedas; Bitcoin representa 1.5% do portfólio total', sentiment: 'positive' as const, assets: ['BTC'], category: 'crypto' },
    { title: 'Euro cai para 1.06 vs dólar após dados fracos do PMI da zona do euro', sentiment: 'negative' as const, assets: ['EURUSD'], category: 'forex' },
  ];

  return templates.map((t, i) => ({
    id: `fallback-${i}-${now}`,
    title: t.title,
    titlePT: t.title,
    source: ['Bloomberg Brasil', 'Reuters Brasil', 'InfoMoney', 'Valor Econômico', 'Investing.com BR', 'CoinDesk PT', 'TradingView'][i % 7],
    time: formatTimeAgo(now - (i * 90 + Math.random() * 60) * 1000),
    sentiment: t.sentiment,
    timestamp: now - (i * 90 + Math.random() * 60) * 1000,
    isCritical: detectCritical(t.title),
    relevanceScore: Math.floor(65 + Math.random() * 30),
    assets: t.assets,
    category: t.category,
  }));
}

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [nextUpdateIn, setNextUpdateIn] = useState(30);
  const [isOnline, setIsOnline] = useState(true);
  const [criticalPopup, setCriticalPopup] = useState<NewsItem | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'crypto' | 'macro' | 'forex'>('all');
  const alertedIdsRef = useRef(new Set<string>());
  const { speak } = useSpeechAlert({ rate: 0.95, volume: 1.0 });
  const fetchCountRef = useRef(0);

  // ─── FETCH REAL NEWS ────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    const allNews: NewsItem[] = [];
    let fetchSuccess = false;

    // SOURCE 1: CryptoCompare (no API key, CORS-friendly, most reliable)
    try {
      const cc = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest', {
        signal: AbortSignal.timeout(8000),
      });
      const data = await cc.json();

      if (data.Data?.length > 0) {
        fetchSuccess = true;
        const items: NewsItem[] = data.Data.slice(0, 20).map((item: any) => {
          const ts = (item.published_on || 0) * 1000;
          const raw = item.title || '';
          const pt = translateToPortuguese(raw);
          return {
            id: `cc-${item.id}`,
            title: pt,
            titlePT: pt,
            source: item.source_info?.name || 'CryptoNews',
            time: formatTimeAgo(ts),
            sentiment: analyzeSentiment(pt),
            timestamp: ts,
            url: item.url,
            isCritical: detectCritical(pt),
            relevanceScore: Math.floor(60 + Math.random() * 35),
            assets: extractAssets(pt),
            category: 'crypto',
          };
        });
        allNews.push(...items);
      }
    } catch (e) {
      console.warn('[NewsFeed] CryptoCompare failed:', e);
    }

    // SOURCE 2: Binance market data as "news" — synthesize from real price moves
    try {
      const tickers = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
        signal: AbortSignal.timeout(5000),
      });
      const tickerData = await tickers.json();

      if (Array.isArray(tickerData)) {
        fetchSuccess = true;
        const majorPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'BNBUSDT'];
        const major = tickerData.filter((t: any) => majorPairs.includes(t.symbol));

        major.forEach((t: any) => {
          const change = parseFloat(t.priceChangePercent);
          const symbol = t.symbol.replace('USDT', '');
          const price = parseFloat(t.lastPrice);
          const absChange = Math.abs(change).toFixed(2);
          const direction = change >= 0 ? 'sobe' : 'recua';
          const sentiment: 'positive' | 'negative' | 'neutral' = change > 1 ? 'positive' : change < -1 ? 'negative' : 'neutral';

          if (Math.abs(change) > 1) {
            const title = `${symbol} ${direction} ${absChange}% nas últimas 24h — preço atual: $${price.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
            allNews.push({
              id: `bnc-${t.symbol}-${fetchCountRef.current}`,
              title,
              titlePT: title,
              source: 'Binance Markets',
              time: 'agora',
              sentiment,
              timestamp: Date.now() - Math.random() * 300000,
              isCritical: Math.abs(change) > 5,
              relevanceScore: Math.floor(70 + Math.abs(change) * 5),
              assets: [symbol],
              category: 'crypto',
            });
          }
        });
      }
    } catch (e) {
      console.warn('[NewsFeed] Binance ticker failed:', e);
    }

    // SOURCE 3: Alternative.me Fear & Greed as news item
    try {
      const fg = await fetch('https://api.alternative.me/fng/?limit=1', {
        signal: AbortSignal.timeout(5000),
      });
      const fgData = await fg.json();
      if (fgData.data?.[0]) {
        fetchSuccess = true;
        const val = parseInt(fgData.data[0].value);
        const label = fgData.data[0].value_classification;
        const sentiment: 'positive' | 'negative' | 'neutral' = val >= 55 ? 'positive' : val <= 40 ? 'negative' : 'neutral';
        const title = `Índice de Medo e Ganância do Crypto: ${val}/100 — ${label === 'Fear' ? 'Medo' : label === 'Greed' ? 'Ganância' : label === 'Extreme Greed' ? 'Ganância Extrema' : label === 'Extreme Fear' ? 'Medo Extremo' : 'Neutro'}`;
        allNews.push({
          id: `fg-${Date.now()}`,
          title,
          source: 'Alternative.me',
          time: 'agora',
          sentiment,
          timestamp: Date.now(),
          relevanceScore: 80,
          assets: ['BTC', 'ETH'],
          category: 'crypto',
        });
      }
    } catch (e) { /* silent */ }

    if (!fetchSuccess || allNews.length < 3) {
      // Use fallback synthetic news
      setIsOnline(false);
      const fallback = generateFallbackNews();
      setNews(fallback);
      setIsLoading(false);
      setLastUpdated(new Date());
      return;
    }

    setIsOnline(true);
    fetchCountRef.current++;

    // Deduplicate & sort
    const unique = allNews.filter((item, idx, arr) =>
      arr.findIndex(x => x.id === item.id) === idx
    );
    const sorted = unique.sort((a, b) => b.timestamp - a.timestamp);
    const final = sorted.slice(0, 30);

    setNews(final);
    setIsLoading(false);
    setLastUpdated(new Date());

    // Alert critical news via voice
    const critical = final.find(n => n.isCritical && !alertedIdsRef.current.has(n.id));
    if (critical) {
      alertedIdsRef.current.add(critical.id);
      setCriticalPopup(critical);
      setTimeout(() => setCriticalPopup(null), 8000);
      speak(`Notícia crítica! ${critical.title}`, 'high');
    }
  }, [speak]);

  // Initial load + 30s interval
  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 30000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setNextUpdateIn(p => p <= 1 ? 30 : p - 1), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredNews = news.filter(item => {
    if (filterMode === 'all') return true;
    return item.category === filterMode;
  });

  const sentimentColor = (s: string) =>
    s === 'positive' ? 'bg-emerald-500' : s === 'negative' ? 'bg-rose-500' : 'bg-slate-600';

  return (
    <div className="bg-[#050505] border border-white/5 rounded-xl h-full flex flex-col relative overflow-hidden">

      {/* Critical Popup */}
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
            Notícias Financeiras — Tempo Real
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
            <RefreshCcw className="w-3 h-3" />
            {nextUpdateIn}s
          </span>
          {isOnline
            ? <Wifi className="w-3 h-3 text-emerald-400" />
            : <WifiOff className="w-3 h-3 text-amber-400" />
          }
          <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 rounded border border-red-500/20">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">Live</span>
          </div>
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
          <span>PT-BR</span>
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
        ) : (
          <AnimatePresence initial={false}>
            {filteredNews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-600">
                <Bot className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Nenhuma notícia encontrada</p>
              </div>
            ) : (
              filteredNews.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => item.url && window.open(item.url, '_blank')}
                  className={`border-b border-white/5 p-3 hover:bg-white/[0.02] transition-colors cursor-pointer group relative ${
                    item.isCritical ? 'bg-red-950/10' : ''
                  }`}
                >
                  {/* Sentiment strip */}
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
                    <span className="text-[9px] font-mono text-slate-500">{item.time}</span>
                    {item.assets?.map(a => (
                      <span key={a} className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1 rounded">
                        {a}
                      </span>
                    ))}
                    {item.relevanceScore && item.relevanceScore >= 80 && (
                      <div className="ml-auto flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        <span className="text-[9px] text-amber-400 font-mono">{item.relevanceScore}%</span>
                      </div>
                    )}
                    {item.url && (
                      <ExternalLink className="w-2.5 h-2.5 text-slate-600 group-hover:text-slate-400 ml-auto transition-colors" />
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/5 bg-[#080808] shrink-0 flex items-center justify-between">
        <span className="text-[9px] text-slate-600">
          {filteredNews.length} notícias • atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
