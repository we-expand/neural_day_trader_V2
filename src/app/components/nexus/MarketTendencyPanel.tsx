import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Newspaper,
  MessageSquare,
  Target,
  BookOpen,
  Zap,
  Building2,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
} from 'lucide-react';
import { marketTendencyEngine, MarketTendency, MarketDataInput } from '@/app/services/MarketTendencyEngine';

interface MarketTendencyPanelProps {
  symbol: string;
  currentPrice: number;
  timeframe?: string;
  volume?: number;
}

export const MarketTendencyPanel = React.memo(function MarketTendencyPanel({ 
  symbol, 
  currentPrice, 
  timeframe = '1h',
  volume = 1000000 
}: MarketTendencyPanelProps) {
  const [tendency, setTendency] = useState<MarketTendency | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false); // 🔥 DESATIVADO POR PADRÃO
  
  // Ref para evitar múltiplas chamadas simultâneas
  const isCalculatingRef = useRef(false);

  // 🔥 Memoizar função de cálculo
  const calculateTendency = useCallback(async () => {
    // Evitar chamadas simultâneas
    if (isCalculatingRef.current) return;
    
    isCalculatingRef.current = true;
    setLoading(true);
    
    try {
      const input: MarketDataInput = {
        symbol,
        timeframe,
        price: currentPrice,
        volume,
        timestamp: new Date(),
      };

      const result = await marketTendencyEngine.calculateTendency(input);
      setTendency(result);
    } catch (error) {
      console.error('[TENDENCY PANEL] Erro ao calcular tendência:', error);
    } finally {
      setLoading(false);
      isCalculatingRef.current = false;
    }
  }, [symbol, timeframe, currentPrice, volume]);

  // 🔥 Calcular APENAS na montagem (remover currentPrice das deps)
  useEffect(() => {
    calculateTendency();
  }, [symbol]); // Só recalcula quando símbolo muda

  // 🔥 Auto-refresh MAIS LENTO (60 segundos) e opcional
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      calculateTendency();
    }, 60000); // 60 segundos ao invés de 30

    return () => clearInterval(interval);
  }, [autoRefresh, calculateTendency]);

  if (loading || !tendency) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a] rounded-xl border border-white/10 p-8">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Analisando todas as fontes de mercado...</p>
        </div>
      </div>
    );
  }

  const directionConfig = {
    STRONG_BULLISH: {
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      textColor: 'text-green-400',
      label: 'FORTE ALTA',
    },
    BULLISH: {
      icon: TrendingUp,
      color: 'from-green-500/70 to-emerald-600/70',
      bgColor: 'bg-green-500/5',
      borderColor: 'border-green-500/20',
      textColor: 'text-green-300',
      label: 'ALTA',
    },
    NEUTRAL: {
      icon: Minus,
      color: 'from-slate-500 to-slate-600',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      textColor: 'text-slate-400',
      label: 'NEUTRO',
    },
    BEARISH: {
      icon: TrendingDown,
      color: 'from-red-500/70 to-rose-600/70',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/20',
      textColor: 'text-red-300',
      label: 'BAIXA',
    },
    STRONG_BEARISH: {
      icon: TrendingDown,
      color: 'from-red-500 to-rose-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      textColor: 'text-red-400',
      label: 'FORTE BAIXA',
    },
  };

  const actionConfig = {
    STRONG_BUY: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'COMPRA FORTE' },
    BUY: { color: 'text-green-300', bg: 'bg-green-500/10', label: 'COMPRA' },
    HOLD: { color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'AGUARDAR' },
    SELL: { color: 'text-red-300', bg: 'bg-red-500/10', label: 'VENDA' },
    STRONG_SELL: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'VENDA FORTE' },
  };

  const config = directionConfig[tendency.direction];
  const Icon = config.icon;

  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
      {/* HEADER - TENDÊNCIA GERAL */}
      <div className={`relative px-6 py-5 bg-gradient-to-br ${config.bgColor} border-b ${config.borderColor}`}>
        <div className="flex items-center justify-between">
          {/* Tendência + Score */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${config.color}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                  {config.label}
                </h3>
                <span className={`text-2xl font-bold ${config.textColor}`}>
                  {tendency.score > 0 ? '+' : ''}{tendency.score.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Confiança: {tendency.confidence.toFixed(0)}%</span>
                <span>•</span>
                <span>{symbol}</span>
                <span>•</span>
                <span>{timeframe}</span>
              </div>
            </div>
          </div>

          {/* Recomendação */}
          <div className={`px-4 py-2 rounded-lg ${actionConfig[tendency.recommendation.action].bg} border border-white/10`}>
            <div className={`text-xs font-bold ${actionConfig[tendency.recommendation.action].color} uppercase tracking-wider`}>
              {actionConfig[tendency.recommendation.action].label}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Risco: {tendency.recommendation.riskLevel}
            </div>
          </div>

          {/* Auto-Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg transition-all ${
              autoRefresh 
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400' 
                : 'bg-white/5 border border-white/10 text-slate-400'
            }`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Barra de Score Visual */}
        <div className="mt-4">
          <div className="relative h-3 bg-black/30 rounded-full overflow-hidden">
            {/* Fundo gradiente */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-slate-600 to-green-500 opacity-30" />
            
            {/* Indicador de posição */}
            <motion.div
              initial={{ left: '50%' }}
              animate={{ left: `${((tendency.score + 100) / 200) * 100}%` }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
            />

            {/* Marcadores */}
            <div className="absolute inset-0 flex items-center justify-between px-0.5">
              <div className="w-0.5 h-full bg-white/20" />
              <div className="w-0.5 h-full bg-white/40" />
              <div className="w-0.5 h-full bg-white/20" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
            <span>-100</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>

        {/* Reasoning */}
        <div className="mt-4 space-y-1">
          {tendency.recommendation.reasoning.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <CheckCircle className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BREAKDOWN DAS FONTES */}
      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Análise Detalhada por Fonte
          </h4>
          <button
            onClick={calculateTendency}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Recalcular
          </button>
        </div>

        {/* SOURCE CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <SourceCard
            icon={Activity}
            title="Pressão de Mercado"
            score={tendency.sources.pressure.score}
            confidence={tendency.sources.pressure.confidence}
            weight={tendency.weights.pressure}
            color="purple"
            isExpanded={expandedSource === 'pressure'}
            onToggle={() => setExpandedSource(expandedSource === 'pressure' ? null : 'pressure')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Pressão de Compra:</span>
                <span className="text-green-400 font-bold">{tendency.sources.pressure.buyPressure.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pressão de Venda:</span>
                <span className="text-red-400 font-bold">{tendency.sources.pressure.sellPressure.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ratio Buy/Sell:</span>
                <span className="text-white font-mono">{tendency.sources.pressure.volumeRatio.toFixed(2)}x</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pressão Líquida:</span>
                  <span className={`font-bold ${tendency.sources.pressure.netPressure > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tendency.sources.pressure.netPressure > 0 ? '+' : ''}{tendency.sources.pressure.netPressure.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </SourceCard>

          <SourceCard
            icon={Target}
            title="Fibonacci"
            score={tendency.sources.fibonacci.score}
            confidence={tendency.sources.fibonacci.confidence}
            weight={tendency.weights.fibonacci}
            color="cyan"
            isExpanded={expandedSource === 'fibonacci'}
            onToggle={() => setExpandedSource(expandedSource === 'fibonacci' ? null : 'fibonacci')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Nível Atual:</span>
                <span className="text-cyan-400 font-bold">{tendency.sources.fibonacci.currentLevel.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Suporte Próximo:</span>
                <span className="text-green-400 font-mono">${tendency.sources.fibonacci.nearestSupport.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Resistência Próxima:</span>
                <span className="text-red-400 font-mono">${tendency.sources.fibonacci.nearestResistance.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bias:</span>
                  <span className={`font-bold uppercase ${
                    tendency.sources.fibonacci.bias === 'bullish' ? 'text-green-400' :
                    tendency.sources.fibonacci.bias === 'bearish' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {tendency.sources.fibonacci.bias}
                  </span>
                </div>
              </div>
            </div>
          </SourceCard>

          <SourceCard
            icon={BarChart3}
            title="Médias Móveis"
            score={tendency.sources.movingAverages.score}
            confidence={tendency.sources.movingAverages.confidence}
            weight={tendency.weights.movingAverages}
            color="blue"
            isExpanded={expandedSource === 'ma'}
            onToggle={() => setExpandedSource(expandedSource === 'ma' ? null : 'ma')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">MA20:</span>
                <span className="text-white font-mono">${tendency.sources.movingAverages.ma20.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MA50:</span>
                <span className="text-white font-mono">${tendency.sources.movingAverages.ma50.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MA200:</span>
                <span className="text-white font-mono">${tendency.sources.movingAverages.ma200.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Alinhamento:</span>
                  <span className={`font-bold uppercase ${
                    tendency.sources.movingAverages.alignment === 'bullish' ? 'text-green-400' :
                    tendency.sources.movingAverages.alignment === 'bearish' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {tendency.sources.movingAverages.alignment}
                  </span>
                </div>
                {tendency.sources.movingAverages.crossovers.goldenCross && (
                  <div className="text-green-400 font-bold mt-1">⭐ Golden Cross!</div>
                )}
                {tendency.sources.movingAverages.crossovers.deathCross && (
                  <div className="text-red-400 font-bold mt-1">⚠️ Death Cross!</div>
                )}
              </div>
            </div>
          </SourceCard>

          <SourceCard
            icon={Newspaper}
            title="Notícias"
            score={tendency.sources.news.sentimentScore}
            confidence={tendency.sources.news.confidence}
            weight={tendency.weights.news}
            color="orange"
            isExpanded={expandedSource === 'news'}
            onToggle={() => setExpandedSource(expandedSource === 'news' ? null : 'news')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total de Artigos:</span>
                <span className="text-white font-bold">{tendency.sources.news.totalArticles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Positivas:</span>
                <span className="text-green-400 font-bold">{tendency.sources.news.positiveCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Negativas:</span>
                <span className="text-red-400 font-bold">{tendency.sources.news.negativeCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Neutras:</span>
                <span className="text-slate-400 font-bold">{tendency.sources.news.neutralCount}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Urgência:</span>
                  <span className={`font-bold uppercase px-2 py-0.5 rounded ${
                    tendency.sources.news.urgency === 'high' ? 'bg-red-500/20 text-red-400' :
                    tendency.sources.news.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {tendency.sources.news.urgency}
                  </span>
                </div>
              </div>
            </div>
          </SourceCard>

          <SourceCard
            icon={MessageSquare}
            title="Redes Sociais"
            score={tendency.sources.socialMedia.overallSentiment}
            confidence={tendency.sources.socialMedia.confidence}
            weight={tendency.weights.socialMedia}
            color="pink"
            isExpanded={expandedSource === 'social'}
            onToggle={() => setExpandedSource(expandedSource === 'social' ? null : 'social')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Twitter:</span>
                <span className={`font-bold ${tendency.sources.socialMedia.twitterSentiment > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tendency.sources.socialMedia.twitterSentiment > 0 ? '+' : ''}{tendency.sources.socialMedia.twitterSentiment.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reddit:</span>
                <span className={`font-bold ${tendency.sources.socialMedia.redditSentiment > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tendency.sources.socialMedia.redditSentiment > 0 ? '+' : ''}{tendency.sources.socialMedia.redditSentiment.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Telegram:</span>
                <span className={`font-bold ${tendency.sources.socialMedia.telegramSentiment > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tendency.sources.socialMedia.telegramSentiment > 0 ? '+' : ''}{tendency.sources.socialMedia.telegramSentiment.toFixed(1)}
                </span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume Menções:</span>
                  <span className="text-white font-bold">{tendency.sources.socialMedia.volume.toFixed(0)}</span>
                </div>
                {tendency.sources.socialMedia.trending && (
                  <div className="text-pink-400 font-bold mt-1">🔥 Trending!</div>
                )}
              </div>
            </div>
          </SourceCard>

          <SourceCard
            icon={Zap}
            title="Indicadores Técnicos"
            score={tendency.sources.technicalIndicators.overallScore}
            confidence={tendency.sources.technicalIndicators.confidence}
            weight={tendency.weights.technicalIndicators}
            color="yellow"
            isExpanded={expandedSource === 'tech'}
            onToggle={() => setExpandedSource(expandedSource === 'tech' ? null : 'tech')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">RSI:</span>
                <span className={`font-bold ${
                  tendency.sources.technicalIndicators.rsi < 30 ? 'text-green-400' :
                  tendency.sources.technicalIndicators.rsi > 70 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {tendency.sources.technicalIndicators.rsi.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MACD:</span>
                <span className={`font-bold ${tendency.sources.technicalIndicators.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tendency.sources.technicalIndicators.macd.histogram.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stochastic:</span>
                <span className="text-white font-bold">{tendency.sources.technicalIndicators.stochastic.toFixed(1)}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bollinger:</span>
                  <span className={`font-bold uppercase px-2 py-0.5 rounded ${
                    tendency.sources.technicalIndicators.bollingerBands.position === 'overbought' ? 'bg-red-500/20 text-red-400' :
                    tendency.sources.technicalIndicators.bollingerBands.position === 'oversold' ? 'bg-green-500/20 text-green-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {tendency.sources.technicalIndicators.bollingerBands.position}
                  </span>
                </div>
              </div>
            </div>
          </SourceCard>

          <SourceCard
            icon={BookOpen}
            title="Order Book"
            score={tendency.sources.orderBook.score}
            confidence={tendency.sources.orderBook.confidence}
            weight={tendency.weights.orderBook}
            color="indigo"
            isExpanded={expandedSource === 'orderbook'}
            onToggle={() => setExpandedSource(expandedSource === 'orderbook' ? null : 'orderbook')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Bid/Ask Ratio:</span>
                <span className="text-white font-mono">{tendency.sources.orderBook.bidAskRatio.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Imbalance:</span>
                <span className={`font-bold ${tendency.sources.orderBook.depthImbalance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tendency.sources.orderBook.depthImbalance > 0 ? '+' : ''}{tendency.sources.orderBook.depthImbalance.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bid Walls:</span>
                <span className="text-green-400 font-bold">{tendency.sources.orderBook.largeOrders.bidWalls.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ask Walls:</span>
                <span className="text-red-400 font-bold">{tendency.sources.orderBook.largeOrders.askWalls.length}</span>
              </div>
              {tendency.sources.orderBook.spoofingDetected && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-red-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Spoofing Detectado!
                  </div>
                </div>
              )}
            </div>
          </SourceCard>

          <SourceCard
            icon={Activity}
            title="Volume Profile"
            score={tendency.sources.volumeProfile.score}
            confidence={tendency.sources.volumeProfile.confidence}
            weight={tendency.weights.volumeProfile}
            color="teal"
            isExpanded={expandedSource === 'volume'}
            onToggle={() => setExpandedSource(expandedSource === 'volume' ? null : 'volume')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">POC:</span>
                <span className="text-cyan-400 font-mono">${tendency.sources.volumeProfile.poc.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Value Area High:</span>
                <span className="text-white font-mono">${tendency.sources.volumeProfile.valueAreaHigh.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Value Area Low:</span>
                <span className="text-white font-mono">${tendency.sources.volumeProfile.valueAreaLow.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Posição vs POC:</span>
                  <span className="text-white font-bold uppercase">{tendency.sources.volumeProfile.positionVsPOC}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Volume Trend:</span>
                  <span className={`font-bold uppercase ${
                    tendency.sources.volumeProfile.volumeTrend === 'increasing' ? 'text-green-400' :
                    tendency.sources.volumeProfile.volumeTrend === 'decreasing' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {tendency.sources.volumeProfile.volumeTrend}
                  </span>
                </div>
              </div>
            </div>
          </SourceCard>

          <SourceCard
            icon={Building2}
            title="Fluxo Institucional"
            score={tendency.sources.institutionalFlow.score}
            confidence={tendency.sources.institutionalFlow.confidence}
            weight={tendency.weights.institutionalFlow}
            color="emerald"
            isExpanded={expandedSource === 'institutional'}
            onToggle={() => setExpandedSource(expandedSource === 'institutional' ? null : 'institutional')}
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Fluxo Líquido:</span>
                <span className={`font-bold ${tendency.sources.institutionalFlow.netFlow > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tendency.sources.institutionalFlow.netFlow > 0 ? '+' : ''}{tendency.sources.institutionalFlow.netFlow.toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transações Grandes:</span>
                <span className="text-white font-bold">{tendency.sources.institutionalFlow.largeTransactions}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">Smart Money:</span>
                  <span className={`font-bold uppercase px-2 py-0.5 rounded ${
                    tendency.sources.institutionalFlow.smartMoneyBias === 'accumulating' ? 'bg-green-500/20 text-green-400' :
                    tendency.sources.institutionalFlow.smartMoneyBias === 'distributing' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {tendency.sources.institutionalFlow.smartMoneyBias}
                  </span>
                </div>
              </div>
            </div>
          </SourceCard>
        </div>
      </div>
    </div>
  );
});

// ============================================
// SOURCE CARD COMPONENT
// ============================================

interface SourceCardProps {
  icon: React.ElementType;
  title: string;
  score: number;
  confidence: number;
  weight: number;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SourceCard({ 
  icon: Icon, 
  title, 
  score, 
  confidence, 
  weight, 
  color, 
  isExpanded, 
  onToggle,
  children 
}: SourceCardProps) {
  const colorClasses = {
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/30 text-purple-400',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/30 text-cyan-400',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/30 text-blue-400',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/30 text-orange-400',
    pink: 'from-pink-500/10 to-pink-500/5 border-pink-500/30 text-pink-400',
    yellow: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/30 text-yellow-400',
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/30 text-indigo-400',
    teal: 'from-teal-500/10 to-teal-500/5 border-teal-500/30 text-teal-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
  };

  const classes = colorClasses[color as keyof typeof colorClasses] || colorClasses.cyan;

  return (
    <div className={`rounded-lg border bg-gradient-to-br ${classes.split('text-')[0]} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${classes.split('border-')[0].split('to-')[0].replace('from-', 'text-').replace('/10', '')}`} />
          <div className="text-left">
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="text-xs text-slate-400">Peso: {weight}%</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-sm font-bold ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {score > 0 ? '+' : ''}{score.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">{confidence.toFixed(0)}% conf.</div>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/10">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}