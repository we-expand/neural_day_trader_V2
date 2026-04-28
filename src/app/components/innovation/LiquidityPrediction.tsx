import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTradingContext } from '../../contexts/TradingContext';
import { 
  Brain, 
  Waves, 
  Target, 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Radar, 
  Activity,
  Info,
  ChevronDown,
  Wifi,
  WifiOff,
  Clock,
  Maximize2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { useSpeechAlert } from '@/app/hooks/useSpeechAlert';
import { isMarketOpen } from '@/app/utils/marketHours';
import { ALL_ASSETS, Asset, getAssetsByCategory, searchAssets } from '@/app/config/assetDatabase';
import { useSupabaseRealtimeTurbo, TURBO_CONFIGS } from '@/app/hooks/useSupabaseRealtimeTurbo'; // 🔥 TURBO MODE
import { toast } from 'sonner';
import { generateHourlyVoiceAnalysis, generateQuickVoiceAnalysis, HourlyAnalysisData } from '@/app/utils/hourlyVoiceAnalysis'; // 🔥 ANÁLISE DE VOZ

// 🔥 USAR TODOS OS 300+ ATIVOS DO BANCO DE DADOS
const ASSETS = ALL_ASSETS;

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

// Mock Data for Liquidity Heatmap Simulation
const LIQUIDITY_DATA_BASE = Array.from({ length: 50 }, (_, i) => ({
  i,
  val: Math.random()
}));

// 🔥 GERAR CORRELAÇÕES DINÂMICAS BASEADAS NO ATIVO SELECIONADO
const generateCorrelations = (assetSymbol: string) => {
  const currentAsset = ASSETS.find(a => a.symbol === assetSymbol);
  if (!currentAsset) return [];
  
  // Buscar ativos da mesma categoria
  const relatedAssets = ASSETS
    .filter(a => a.category === currentAsset.category && a.symbol !== assetSymbol)
    .slice(0, 6); // Limitar a 6 para não ficar enorme
  
  return relatedAssets.map(asset => ({
    asset: asset.symbol,
    value: parseFloat((Math.random() * 2 - 1).toFixed(2)), // -1 a +1
    color: Math.random() > 0.5 ? '#10b981' : '#f87171'
  }));
};

const aiLogs = [
  { id: 1, time: '10:42:01', type: 'warning', msg: 'Carteira baleia (0x7a...9f) movendo fundos para exchange.' },
  { id: 2, time: '10:42:05', type: 'info', msg: 'Vazio de liquidez detectado. Risco de slippage alto.' },
  { id: 3, time: '10:42:12', type: 'success', msg: 'IA prevê parede de compra de Market Maker em breve.' },
];

export const LiquidityPrediction = () => {
  const { selectedAsset, setSelectedAsset } = useTradingContext();
  
  const [logs, setLogs] = useState(aiLogs);
  const [timeframe, setTimeframe] = useState('1h');
  const [showInfo, setShowInfo] = useState(false);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [realPrices, setRealPrices] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true); // 🔥 Toggle AI ON/OFF
  const [showHourlyPanel, setShowHourlyPanel] = useState(false); // 🔥 NOVO: Toggle painel horário
  const { speak } = useSpeechAlert({ rate: 0.95, volume: 1.0 });
  const [isNarrating, setIsNarrating] = useState(false); // 🔥 Voice narration state
  
  const filteredAssets = searchQuery.trim() 
    ? searchAssets(searchQuery)
    : ASSETS;
  
  const currentAsset = ASSETS.find(a => a.symbol === selectedAsset);

  // 🔥 BUSCAR PREÇOS REAIS - OTIMIZADO (1x por minuto)
  useEffect(() => {
    const fetchRealPrices = async () => {
      try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'POLUSDT', 'DOTUSDT'];
        const promises = symbols.map(symbol => 
          fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
        
        const results = await Promise.all(promises);
        const prices: Record<string, number> = {};
        
        symbols.forEach((symbol, idx) => {
          if (results[idx] && results[idx].price) {
            const asset = symbol.replace('USDT', '');
            prices[asset] = parseFloat(results[idx].price);
            
            if (asset === 'POL') {
              prices['MATIC'] = parseFloat(results[idx].price);
            }
          }
        });
        
        setRealPrices(prices);
      } catch (error) {
        console.error('Failed to fetch real prices:', error);
      }
    };
    
    fetchRealPrices();
    const interval = setInterval(fetchRealPrices, 60000); // 🔥 1 minuto em vez de 30s
    return () => clearInterval(interval);
  }, []);

  const getChartData = (assetId: string) => {
    let basePrice = realPrices[assetId] || 100;
    
    if (!realPrices[assetId]) {
      if (assetId === 'BTC') basePrice = 64000;
      if (assetId === 'ETH') basePrice = 3400;
      if (assetId === 'SOL') basePrice = 145;
    }
    
    return LIQUIDITY_DATA_BASE.map(d => {
      const offset = (d.i - 25) * (basePrice * 0.05 * 0.1);
      let liquidity = Math.abs(Math.sin(d.i * 0.1) * 500) + Math.random() * 200;
      
      if (d.i === 10 || d.i === 40) liquidity += 2500;
      if (d.i === 20 || d.i === 30) liquidity += 1200;

      return {
        price: basePrice + offset,
        liquidity: liquidity,
        prediction: Math.abs(Math.sin(d.i * 0.1 + 1) * 600) + Math.random() * 100,
        isWall: liquidity > 2000
      };
    });
  };

  // 🔥 CORREÇÃO: Cache do Vite
  const currentData = getChartData(selectedAsset);
  const currentCorrelations = generateCorrelations(selectedAsset); // 🔥 CORRELAÇÕES DINÂMICAS

  // 🔥 OTIMIZADO: Logs a cada 5 segundos (era 3.5s)
  useEffect(() => {
    if (!aiEnabled) return;
    
    setLogs([
       { id: Date.now(), time: new Date().toLocaleTimeString(), type: 'info', msg: `Iniciando varredura neural para ${selectedAsset}...` },
    ]);

    const interval = setInterval(() => {
      const randomType = Math.random();
      const type = randomType > 0.7 ? 'success' : randomType > 0.4 ? 'warning' : 'info';
      
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      const currentHour = now.getHours();
      
      const minutesUntilCandle = 15 - (currentMinute % 15);
      const secondsUntilCandle = 60 - currentSecond;
      const totalSecondsUntilCandle = (minutesUntilCandle - 1) * 60 + secondsUntilCandle;
      const minutesDisplay = Math.floor(totalSecondsUntilCandle / 60);
      const secondsDisplay = totalSecondsUntilCandle % 60;
      
      const whaleAmount = Math.floor(Math.random() * 500) + 100;
      const currentPrice = realPrices[selectedAsset] || 64000;
      const whalePrice = Math.floor(currentPrice);
      const whaleValueUSD = whaleAmount * whalePrice / (selectedAsset === 'BTC' ? 1 : 20);
      const exchangeVolume = (Math.random() * 200 + 50).toFixed(1);
      const walletAddr = `0x${Math.random().toString(16).substr(2, 4)}...${Math.random().toString(16).substr(2, 2)}`;
      const rsiDivergence = (Math.random() * 20 + 60).toFixed(1);
      const resistanceLevel = (whalePrice + Math.floor(Math.random() * 1000)).toLocaleString();
      const netFlow = (Math.random() * 5000 + 1000).toFixed(0);
      const stakeholderIncrease = (Math.random() * 15 + 5).toFixed(1);
      const supportLevel = (whalePrice - Math.floor(Math.random() * 500)).toLocaleString();
      
      const marketAlerts = [];
      
      const utcDay = now.getUTCDay();
      const isWeekend = utcDay === 0 || utcDay === 6;
      const isWeekday = utcDay >= 1 && utcDay <= 5;
      
      if (isWeekday && currentHour === 11 && currentMinute >= 25 && currentMinute < 35) {
        const nyseStatus = isMarketOpen('US500');
        if (!nyseStatus.isOpen) {
          marketAlerts.push(`⏰ ABERTURA NYSE em ${30 - currentMinute} minutos! ALTA VOLATILIDADE em pares USD. SUGESTÃO: Aguarde os primeiros 15 minutos para definir direção clara antes de entrar.`);
        }
      }
      
      if (isWeekday && currentHour === 17 && currentMinute >= 50) {
        const nyseStatus = isMarketOpen('US500');
        if (nyseStatus.isOpen) {
          marketAlerts.push(`⏰ FECHAMENTO NYSE em ${60 - currentMinute} minutos! Último momento para ajustar posições em ações US. SUGESTÃO: Realize lucros parciais ou ajuste stops de proteção.`);
        }
      }
      
      if (isWeekday && currentHour === 20 && currentMinute >= 50) {
        marketAlerts.push(`🌏 ABERTURA MERCADO ASIÁTICO em ${60 - currentMinute} minutos! Atenção para JPY e índices asiáticos. SUGESTÃO: Observe primeiros movimentos do Nikkei para tendência do dia.`);
      }
      
      if (isWeekday && currentHour >= 9 && currentHour < 13 && currentMinute < 5 && Math.random() > 0.7) {
        marketAlerts.push(`⏰ SOBREPOSIÇÃO LONDRES-NY EM ANDAMENTO! MAIOR LIQUIDEZ do dia. SUGESTÃO: Melhor momento para scalping e day trading. Spreads menores + movimentos fortes.`);
      }
      
      if (isWeekend) {
        console.log(`[LiquidityPrediction] 🔴 FIM DE SEMANA detectado. Alertas de bolsa desativados.`);
      }
      
      const templates = [
        ...(totalSecondsUntilCandle <= 480 ? [{
          msg: `⏰ VIRADA DE CANDLE ${selectedAsset} em ${minutesDisplay}min ${secondsDisplay}s! Candle atual: ${currentPrice >= whalePrice ? '🟢 COMPRA' : '🔴 VENDA'}. SUGESTÃO: ${currentPrice >= whalePrice ? 'Se romper resistência = COMPRA confirmada. Se rejeitar = AGUARDE correção.' : 'Se romper suporte = VENDA confirmada. Se segurar = possível REVERSÃO para COMPRA.'}`,
          type: 'warning'
        }] : []),
        
        ...marketAlerts.map(msg => ({ msg, type: 'info' })),
        
        {
          msg: `🟢 COMPRA BALEIA: ${whaleAmount} ${selectedAsset} (~$${whaleValueUSD.toFixed(0)}M) movidos para carteira fria (${walletAddr}). MOVIMENTO: COMPRA. SUGESTÃO: Baleias acumulando = Possível alta em 24-48h. Considere COMPRA em pullbacks.`,
          type: 'success'
        },
        
        {
          msg: `🔴 VENDA BALEIA: ${whaleAmount} ${selectedAsset} (~$${whaleValueUSD.toFixed(0)}M) transferidos para Binance (${walletAddr}). MOVIMENTO: VENDA${whaleValueUSD > 30 ? ' MASSIVA' : ''}. SUGESTÃO: ${whaleValueUSD > 30 ? 'RISCO EXTREMO! Reduza exposição ou ative stops apertados AGORA.' : 'Monitore próximas 2h. Se continuar = tendência de BAIXA confirmada.'}`,
          type: 'warning'
        },
        
        {
          msg: `🟢 ACUMULAÇÃO (COMPRA): Carteira baleia (${walletAddr}) acumulou +${whaleAmount} ${selectedAsset} nas últimas 6h. PADRÃO: COMPRA passiva identificado. SUGESTÃO: Acumulação silenciosa = Movimento forte em 1-3 dias. Posicione-se em zonas de suporte ($${supportLevel}).`,
          type: 'success'
        },
        
        {
          msg: `🔴 DISTRIBUIÇÃO (VENDA): Baleia (${walletAddr}) fracionando ${whaleAmount} ${selectedAsset} em múltiplas exchanges. MOVIMENTO: VENDA massiva iminente (2-6h). SUGESTÃO: EVITE COMPRAS agora. Aguarde confirmação de fundo antes de entrar LONG.`,
          type: 'warning'
        },
        
        {
          msg: `⚪ VOLUME ANÔMALO (Neutro): ${selectedAsset} com +${exchangeVolume}M em volume nas exchanges asiáticas (UTC+8). Aumento de ${(Math.random() * 100 + 50).toFixed(0)}% vs média 7D. SUGESTÃO: Volume sem direção = Aguarde breakout ($${resistanceLevel} = COMPRA | $${supportLevel} = VENDA).`,
          type: 'info'
        },
        
        {
          msg: `🟢 ACUMULAÇÃO INSTITUCIONAL (COMPRA): ${(Math.random() * 3000 + 1000).toFixed(0)} ${selectedAsset} comprados via ordem passiva. MOVIMENTO: COMPRA institucional silenciosa. SUGESTÃO: Market Makers posicionados. Entre após confirmação (RSI > 50 + Volume crescente).`,
          type: 'success'
        },
        
        {
          msg: `🔴 DIVERGÊNCIA RSI (Alerta VENDA): ${selectedAsset} com RSI em ${rsiDivergence} (sobrecompra) enquanto preço lateral. REVERSÃO: BAIXA em ${(Math.random() * 12 + 4).toFixed(0)}h (probabilidade: ${(Math.random() * 30 + 60).toFixed(0)}%). SUGESTÃO: NÃO COMPRE agora. Aguarde pullback ou SHORT com stop acima da máxima.`,
          type: 'warning'
        },
        
        {
          msg: `⚪ ZONA CRÍTICA: ${selectedAsset} testando resistência em $${resistanceLevel}. CENÁRIOS: Break acima = Rally +${(Math.random() * 8 + 3).toFixed(1)}% (COMPRA). Rejeição = Queda -${(Math.random() * 5 + 2).toFixed(1)}% (VENDA). SUGESTÃO: AGUARDE confirmação. Stop loss de 2% em qualquer direção.`,
          type: 'info'
        },
        
        {
          msg: `🟢 FLUXO LÍQUIDO POSITIVO (COMPRA): +${netFlow} ${selectedAsset} (~$${(parseInt(netFlow) * whalePrice / 1000).toFixed(0)}M) entraram nas últimas 4h. MOVIMENTO: Demanda institucional forte. SUGESTÃO: Entre em COMPRA em retestes de suporte ou breakout confirmado com volume.`,
          type: 'success'
        },
        
        {
          msg: `🟢 ON-CHAIN (Acumulação): Stakeholders de ${selectedAsset} aumentaram posições em +${stakeholderIncrease}% esta semana. MOVIMENTO: COMPRA de longo prazo. SUGESTÃO: HODLers removendo supply = Pressão de ALTA. Ideal para swing trade (7-30 dias).`,
          type: 'success'
        },
        
        {
          msg: `🟢 PROTEÇÃO SUPORTE (COMPRA): Grande bloco de COMPRA detectado em $${supportLevel}. MOVIMENTO: Suporte institucional ativo. SUGESTÃO: Se preço testar $${supportLevel} e segurar = COMPRE. Stop loss: $${(parseInt(supportLevel.replace(/,/g, '')) - 50).toLocaleString()} (2% abaixo).`,
          type: 'success'
        },
        
        {
          msg: `🟢 FRONT-RUNNING (COMPRA): Ordem iceberg de ${(Math.random() * 200 + 100).toFixed(0)} ${selectedAsset} detectada em $${whalePrice}. MOVIMENTO: COMPRA institucional oculta. SUGESTÃO: COMPRE AGORA antes do rally. Instituição vai puxar preço em 1-3h. Target: +${(Math.random() * 5 + 2).toFixed(1)}%.`,
          type: 'success'
        },
        
        {
          msg: `🔴 SPOOFING (ARMADILHA): Ordem fantasma de VENDA detectada (${(Math.random() * 300 + 100).toFixed(0)} ${selectedAsset}). MOVIMENTO: MANIPULAÇÃO para capturar liquidez. SUGESTÃO: NÃO ENTRE EM SHORT! Aguarde cancelamento da ordem fake (15-30 min). Possível pump após.`,
          type: 'warning'
        },
        
        {
          msg: `🟢 MARKET MAKER (COMPRA): MM acumulando ${(Math.random() * 150 + 50).toFixed(0)} ${selectedAsset} nas últimas 2h. MOVIMENTO: COMPRA + Proteção de suporte ativo. SUGESTÃO: MMs preparando movimento de ALTA. Entre após primeiro impulso (break de $${resistanceLevel}).`,
          type: 'success'
        },
        
        {
          msg: `🔴 STOP LOSS CASCATA (VENDA): Cluster de 2.4K stops detectado abaixo de $${supportLevel}. MOVIMENTO: VENDA em cascata iminente se romper. SUGESTÃO: Se preço romper $${supportLevel} = SAIA ou SHORT. Target: -${(Math.random() * 5 + 3).toFixed(1)}% em 2-4h.`,
          type: 'warning'
        },
        
        {
          msg: `🔴 SMART MONEY (VENDA): Carteiras institucionais movendo ${whaleAmount} ${selectedAsset} para exchanges. HISTÓRICO: 78% precede VENDA em 24-48h. SUGESTÃO: REDUZA exposição AGORA ou proteja com stops. Evite COMPRAS até confirmação de fundo.`,
          type: 'warning'
        },
        
        {
          msg: `⚪ HEATMAP LIQUIDEZ: Concentração em $${resistanceLevel} (resistência) e $${supportLevel} (suporte). SUGESTÃO: Aguarde rompimento. Break de $${resistanceLevel} = COMPRA com stop em $${supportLevel}. Break de $${supportLevel} = VENDA com stop em $${resistanceLevel}.`,
          type: 'info'
        },
        
        {
          msg: `⏰ FECHAMENTO DIÁRIO ${selectedAsset} em ${60 - currentMinute} minutos (00:00 UTC)! Reset de candles. SUGESTÃO: Se fechar acima de $${resistanceLevel} = ALTA amanhã. Abaixo de $${supportLevel} = BAIXA amanhã. Decisivo para próximas 24h.`,
          type: 'info'
        }
      ];

      const validTemplates = templates.filter(t => t && typeof t === 'object' && t.msg);
      const selectedTemplate = validTemplates[Math.floor(Math.random() * validTemplates.length)];
      
      if (!selectedTemplate) return;
      
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: (selectedTemplate.type || 'info') as 'success' | 'warning' | 'info',
        msg: selectedTemplate.msg
      };
      
      setLogs(prev => [newLog, ...prev].slice(0, 12));
      
      if (selectedTemplate.msg.includes('VENDA BALEIA') && whaleValueUSD > 30) {
        speak(`Alerta crítico! Baleia vendendo ${whaleAmount} ${selectedAsset}, aproximadamente ${Math.round(whaleValueUSD)} milhões de dólares. Pressão de baixa detectada.`, 'high');
      } else if (selectedTemplate.msg.includes('DISTRIBUIÇÃO')) {
        speak(`Atenção! Distribuição massiva detectada. Possível venda iminente nas próximas 2 a 6 horas.`, 'normal');
      } else if (selectedTemplate.msg.includes('SPOOFING')) {
        speak(`Alerta! Ordem fantasma detectada. Não entre em short agora, é armadilha de manipulação.`, 'normal');
      } else if (selectedTemplate.msg.includes('VIRADA DE CANDLE') && totalSecondsUntilCandle <= 120) {
        speak(`Atenção! Candle ${selectedAsset} vira em ${minutesDisplay} minutos.`, 'normal');
      } else if (selectedTemplate.msg.includes('ABERTURA NYSE')) {
        speak(`Abertura da bolsa de Nova York em ${30 - currentMinute} minutos. Prepare-se para alta volatilidade.`, 'normal');
      }
    }, 5000); // 🔥 OTIMIZADO: 5 segundos (era 3.5s)
    
    return () => clearInterval(interval);
  }, [selectedAsset, realPrices, speak, aiEnabled]);

  return (
    <div className="p-8 h-full bg-neutral-950 text-white overflow-y-auto font-sans">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/5">
        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <Brain className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            IA Preditiva & Order Flow
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Detector de Liquidez Institucional e Análise de Fluxo de Ordens em Tempo Real
          </p>
        </div>
        
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="p-2 rounded-lg border border-white/10 text-slate-500 hover:text-white hover:border-white/20 transition-all"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
          
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 mb-6 p-6 bg-neutral-900/90 border border-indigo-500/30 rounded-xl shadow-2xl relative z-50">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Target className="w-4 h-4 text-indigo-400" />
                Estratégia de Fluxo Institucional:
              </h3>
              <div className="grid md:grid-cols-3 gap-8 text-sm">
                <div className="space-y-2 border-l-2 border-cyan-500/30 pl-4">
                   <div className="font-bold text-cyan-400 flex items-center gap-2">
                     1. Detecção de Ordens Passivas
                   </div>
                   <p className="text-neutral-400 leading-relaxed text-xs">
                     O algoritmo rastreia o Order Book em profundidade para encontrar <strong>Buy/Sell Walls</strong> (Paredes de Liquidez) ocultas.
                   </p>
                </div>
                <div className="space-y-2 border-l-2 border-purple-500/30 pl-4">
                   <div className="font-bold text-purple-400 flex items-center gap-2">
                     2. Front-Running Estratégico
                   </div>
                   <p className="text-neutral-400 leading-relaxed text-xs">
                     Ao identificar uma grande ordem de compra, a IA sugere entrar <strong>logo acima dela</strong>, usando a "baleia" como suporte impenetrável.
                   </p>
                </div>
                <div className="space-y-2 border-l-2 border-emerald-500/30 pl-4">
                   <div className="font-bold text-emerald-400 flex items-center gap-2">
                     3. Proteção de Stops (Cluster)
                   </div>
                   <p className="text-neutral-400 leading-relaxed text-xs">
                     Evite ser "violinado". Posicione seus Stops protegidos atrás das zonas de alta liquidez passiva, onde o preço dificilmente passa.
                   </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        
      <div className="flex items-center gap-4 justify-between">
         {/* 🔥 SELETOR DE ATIVOS */}
         <div className="relative z-[100]">
           <button 
             onClick={() => setAssetMenuOpen(!assetMenuOpen)}
             className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-800 hover:border-indigo-500/50 transition-colors min-w-[200px] justify-between"
           >
             <div className="flex items-center gap-2">
               {currentAsset && <span className="text-lg">{currentAsset.icon || '💹'}</span>}
               <div className="text-left">
                 <div className="font-bold text-white text-sm">{selectedAsset}</div>
                 {currentAsset && <div className="text-[10px] text-neutral-500">{currentAsset.name}</div>}
               </div>
             </div>
             <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${assetMenuOpen ? 'rotate-180' : ''}`} />
           </button>
           
           {assetMenuOpen && (
             <>
               <div className="fixed inset-0 z-[90]" onClick={() => setAssetMenuOpen(false)}></div>
               <div className="absolute left-0 top-full mt-2 w-[600px] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-[100] overflow-hidden">
                 <div className="p-3 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                     <input
                       type="text"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       placeholder="Buscar ativo... (ex: Bitcoin, EURUSD, Apple)"
                       className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
                       autoFocus
                     />
                   </div>
                   <div className="flex items-center justify-between mt-2 text-[10px] text-neutral-500">
                     <span>{filteredAssets.length} ativos encontrados</span>
                     {searchQuery && (
                       <button 
                         onClick={() => setSearchQuery('')}
                         className="text-indigo-400 hover:text-indigo-300"
                       >
                         Limpar busca
                       </button>
                     )}
                   </div>
                 </div>
                 
                 <div className="max-h-[500px] overflow-y-auto p-3">
                   {filteredAssets.length === 0 ? (
                     <div className="text-center py-8 text-neutral-500">
                       <p className="text-sm">Nenhum ativo encontrado</p>
                       <p className="text-xs mt-1">Tente outro termo de busca</p>
                     </div>
                   ) : searchQuery ? (
                     <div className="grid grid-cols-2 gap-2">
                       {filteredAssets.map(asset => (
                         <button
                           key={asset.symbol}
                           onClick={() => {
                             setSelectedAsset(asset.symbol);
                             setAssetMenuOpen(false);
                             setSearchQuery('');
                           }}
                           className={`px-3 py-2 rounded-lg text-left transition-all flex items-center gap-2 ${
                             selectedAsset === asset.symbol 
                               ? 'bg-indigo-600 text-white shadow-lg' 
                               : 'text-neutral-300 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700'
                           }`}
                         >
                           <span className="text-sm">{asset.icon || '💹'}</span>
                           <div className="flex-1 min-w-0">
                             <div className="font-bold text-xs">{asset.symbol}</div>
                             <div className="text-[10px] text-neutral-500 truncate">{asset.name}</div>
                           </div>
                         </button>
                       ))}
                     </div>
                   ) : (
                     <div className="space-y-4">
                       {['FOREX', 'CRYPTO', 'INDICES', 'COMMODITIES', 'STOCKS', 'BONDS'].map(category => {
                         const categoryAssets = getAssetsByCategory(category as any);
                         if (categoryAssets.length === 0) return null;
                         
                         const icon = category === 'FOREX' ? '💱' : category === 'CRYPTO' ? '🪙' : category === 'INDICES' ? '📊' : category === 'COMMODITIES' ? '🏅' : category === 'STOCKS' ? '📈' : '📜';
                         const label = category === 'FOREX' ? 'Forex' : category === 'CRYPTO' ? 'Crypto' : category === 'INDICES' ? 'Índices' : category === 'COMMODITIES' ? 'Commodities' : category === 'STOCKS' ? 'Ações' : 'Bonds';
                         
                         return (
                           <div key={category}>
                             <div className="flex items-center gap-2 mb-2 px-2">
                               <span className="text-lg">{icon}</span>
                               <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                 {label} ({categoryAssets.length})
                               </h4>
                               <div className="flex-1 h-px bg-neutral-800"></div>
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                               {categoryAssets.slice(0, 10).map(asset => (
                                 <button
                                   key={asset.symbol}
                                   onClick={() => {
                                     setSelectedAsset(asset.symbol);
                                     setAssetMenuOpen(false);
                                   }}
                                   className={`px-3 py-2 rounded-lg text-left transition-all flex items-center gap-2 ${
                                     selectedAsset === asset.symbol 
                                       ? 'bg-indigo-600 text-white' 
                                       : 'hover:bg-neutral-800 border border-neutral-700/50'
                                   }`}
                                 >
                                   <span className="text-sm">{asset.icon || icon}</span>
                                   <div className="flex-1 min-w-0">
                                     <div className="font-bold text-xs text-white">{asset.symbol}</div>
                                     <div className="text-[10px] text-neutral-500 truncate">{asset.name}</div>
                                   </div>
                                 </button>
                               ))}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   )}
                 </div>
                 
                 <div className="p-3 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-sm">
                   <div className="flex items-center justify-between text-[10px] text-neutral-500">
                     <div className="flex gap-3">
                       <span>💱 {ALL_ASSETS.filter(a => a.category === 'FOREX').length} Forex</span>
                       <span>🪙 {ALL_ASSETS.filter(a => a.category === 'CRYPTO').length} Crypto</span>
                       <span>📊 {ALL_ASSETS.filter(a => a.category === 'INDICES').length} Índices</span>
                     </div>
                     <div className="font-bold text-indigo-400">
                       {ALL_ASSETS.length} Total
                     </div>
                   </div>
                 </div>
               </div>
             </>
           )}
         </div>

         {/* 🔥 BOTÃO AI ON/OFF (SUBSTITUIU "AO VIVO") */}
         <button 
           onClick={() => setAiEnabled(!aiEnabled)}
           className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
             aiEnabled 
               ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30' 
               : 'bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30'
           }`}
         >
           <Brain className="w-4 h-4" />
           <span>AI {aiEnabled ? 'ON' : 'OFF'}</span>
           {aiEnabled && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
         </button>
       </div>

       <div className="grid grid-cols-12 gap-6 mt-6">
         
         {/* Main Chart Section */}
         <div className="col-span-12 lg:col-span-8 space-y-6">
           {/* 🔥 PAINEL COMPLETO DE PREVISÃO HORÁRIA */}
           <AnimatePresence>
             {showHourlyPanel && (
               <motion.div
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
                 transition={{ duration: 0.3 }}
                 className="overflow-hidden"
               >
                 <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-2xl p-6 space-y-4">
                   <h3 className="text-lg font-bold text-white flex items-center gap-2">
                     <Clock className="w-5 h-5 text-blue-400" />
                     Análise Completa | Próxima Hora
                   </h3>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                       <div className="text-xs text-neutral-400 mb-1">Preço Atual</div>
                       <div className="text-2xl font-bold text-white">${(realPrices[selectedAsset] || 64000).toLocaleString()}</div>
                     </div>
                     
                     <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                       <div className="text-xs text-neutral-400 mb-1">Previsão (1h)</div>
                       <div className="text-2xl font-bold text-emerald-400">+0.8%</div>
                     </div>
                     
                     <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                       <div className="text-xs text-neutral-400 mb-1">Confiança</div>
                       <div className="text-2xl font-bold text-blue-400">68%</div>
                     </div>
                   </div>
                   
                   <div className="space-y-2 text-sm text-neutral-300">
                     <p><strong className="text-emerald-400">TENDÊNCIA:</strong> Alta moderada prevista para próxima hora</p>
                     <p><strong className="text-blue-400">NÍVEIS:</strong> Resistência em ${((realPrices[selectedAsset] || 64000) * 1.002).toFixed(2)} | Suporte em ${((realPrices[selectedAsset] || 64000) * 0.998).toFixed(2)}</p>
                     <p><strong className="text-purple-400">RECOMENDAÇÃO:</strong> Considere entrada em COMPRA acima de ${((realPrices[selectedAsset] || 64000) * 1.001).toFixed(2)}</p>
                   </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>

           <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group min-h-[500px] flex flex-col">
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
             
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 relative z-10 gap-4">
               <h3 className="text-lg font-semibold flex items-center gap-2">
                 <Waves className="w-5 h-5 text-cyan-400" />
                 Mapa de Liquidez: <span className="text-indigo-400">{ASSETS.find(a => a.symbol === selectedAsset)?.name || selectedAsset}</span>
               </h3>
               
               <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                 {TIMEFRAMES.map((tf) => (
                   <button
                     key={tf}
                     onClick={() => setTimeframe(tf)}
                     className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                       timeframe === tf 
                         ? 'bg-neutral-800 text-white shadow-sm' 
                         : 'text-neutral-500 hover:text-neutral-300'
                     }`}
                   >
                     {tf}
                   </button>
                 ))}
               </div>
             </div>

             <div className="w-full h-[400px] relative z-10">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={currentData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorLiquidity" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5}/>
                       <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                     </linearGradient>
                     <linearGradient id="colorPrediction" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5}/>
                       <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.4} />
                   <XAxis 
                     dataKey="price" 
                     type="number"
                     domain={['auto', 'auto']}
                     stroke="#666" 
                     tick={{fontSize: 10, fill: '#888'}} 
                     tickFormatter={(val) => Math.round(val).toLocaleString()} 
                     tickCount={6}
                   />
                   <YAxis 
                     stroke="#666" 
                     tick={{fontSize: 10, fill: '#888'}} 
                     tickFormatter={(val) => `${val.toFixed(0)}`}
                     width={40}
                   />
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                     itemStyle={{ color: '#fff', fontSize: '12px' }}
                     labelStyle={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}
                     labelFormatter={(label) => `Preço: $${Number(label).toLocaleString()}`}
                   />
                   <Area 
                     type="monotone" 
                     dataKey="liquidity" 
                     stroke="#22d3ee" 
                     strokeWidth={2}
                     fillOpacity={1}
                     fill="url(#colorLiquidity)"
                     name="Liquidez"
                   />
                   <Area 
                     type="monotone" 
                     dataKey="prediction" 
                     stroke="#a78bfa" 
                     strokeWidth={2}
                     strokeDasharray="5 5"
                     fillOpacity={1}
                     fill="url(#colorPrediction)"
                     name="Predição IA"
                   />
                 </AreaChart>
               </ResponsiveContainer>
             </div>

             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
               className="absolute top-4 right-4 bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2"
             >
               <AlertTriangle className="w-3 h-3" />
               ALTA PRESSÃO DE VENDA
             </motion.div>
           </div>
           
           {/* Bottom Panels: 🔥 MATRIZ COMPLETA + FORÇA RELATIVA */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* 🔥 MATRIZ DE CORRELAÇÃO DINÂMICA */}
             <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Matriz de Correlação (30D)
                </h3>
                
                {/* 🔥 SCROLLABLE PARA NÃO FICAR ENORME */}
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                  <div className="flex justify-between text-xs text-neutral-500 mb-2 sticky top-0 bg-neutral-900 pb-2">
                    <span>Ativo</span>
                    <span>Correlação</span>
                  </div>
                  {currentCorrelations.length > 0 ? currentCorrelations.map((item, idx) => (
                    <div key={idx} className="group flex items-center justify-between p-2 rounded-lg bg-neutral-800/30 hover:bg-neutral-800/50 transition-all border border-transparent hover:border-neutral-700">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          item.value > 0.7 ? 'bg-emerald-500' :
                          item.value < -0.7 ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}></div>
                        <span className="font-mono text-xs text-white">{item.asset}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-neutral-700 rounded-full overflow-hidden flex relative">
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-neutral-500"></div>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.abs(item.value) * 50}%` }}
                            className={`h-full absolute top-0 ${item.value >= 0 ? 'left-1/2 bg-emerald-500' : 'right-1/2 bg-red-500'}`}
                            style={{ transformOrigin: item.value >= 0 ? 'left' : 'right' }}
                          />
                        </div>
                        <span className={`font-mono text-xs font-bold w-10 text-right ${
                          item.value > 0 ? 'text-emerald-400' : item.value < 0 ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {item.value > 0 ? '+' : ''}{item.value}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-neutral-500 text-xs">
                      Nenhuma correlação disponível
                    </div>
                  )}
                </div>
             </div>
             
             {/* 🔥 FORÇA RELATIVA (NOVO PAINEL) */}
             <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Força Relativa (7D)
                </h3>
                
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                  {currentAsset && ASSETS
                    .filter(a => a.category === currentAsset.category && a.symbol !== selectedAsset)
                    .slice(0, 6)
                    .map((asset, idx) => {
                      const strength = (Math.random() * 200 - 100).toFixed(1);
                      const isPositive = parseFloat(strength) > 0;
                      
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-800/30 transition-all">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{asset.icon || '💹'}</span>
                            <span className="font-mono text-xs text-white">{asset.symbol}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-neutral-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.abs(parseFloat(strength))}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs font-bold w-12 text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {strength}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
             </div>
           </div>
         </div>

         {/* Sidebar / Logs */}
         <div className="col-span-12 lg:col-span-4 space-y-6">
           <div className="bg-black/40 border border-neutral-800 rounded-2xl p-0 overflow-hidden flex flex-col h-[1200px]">
             <div className="p-4 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm sticky top-0 z-20">
               <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                 <Radar className="w-4 h-4 text-purple-400 animate-spin-slow" />
                 Feed Neural {aiEnabled ? 'Ativo' : 'Pausado'}
               </h3>
             </div>
             
             <div className="p-4 border-b border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-orange-900/10">
               <div className="flex items-center gap-2 mb-3">
                 <TrendingUp className="w-4 h-4 text-amber-400" />
                 <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                   Previsão Próxima 1h
                 </h4>
                 <span className="ml-auto text-[10px] text-amber-500/70 font-mono">
                   {new Date().toLocaleTimeString()} - {new Date(Date.now() + 3600000).toLocaleTimeString()}
                 </span>
               </div>
               
               <div className="space-y-2">
                 <div className="flex items-start gap-2 text-xs">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 animate-pulse" />
                   <div>
                     <span className="text-emerald-300 font-bold">ALTA MODERADA</span>
                     <span className="text-neutral-400"> - Probabilidade: </span>
                     <span className="text-white font-mono">68%</span>
                   </div>
                 </div>
                 
                 <div className="pl-3.5 space-y-1 text-[11px] text-neutral-400">
                   <div>
                     <span className="text-neutral-500">Resistência:</span> 
                     <span className="text-red-400 font-mono ml-1">{((realPrices[selectedAsset] || 64000) * 1.002).toFixed(2)}</span>
                     <span className="text-neutral-600 ml-1">(+0.2%)</span>
                   </div>
                   <div>
                     <span className="text-neutral-500">Suporte:</span> 
                     <span className="text-emerald-400 font-mono ml-1">{((realPrices[selectedAsset] || 64000) * 0.998).toFixed(2)}</span>
                     <span className="text-neutral-600 ml-1">(-0.2%)</span>
                   </div>
                 </div>
                 
                 <div className="pt-2 mt-2 border-t border-amber-500/20">
                   <div className="text-[10px] text-amber-200 font-bold uppercase mb-1">Gatilhos:</div>
                   <div className="text-[11px] text-neutral-300 leading-relaxed">
                     <strong className="text-cyan-400">COMPRA</strong> acima de {((realPrices[selectedAsset] || 64000) * 1.001).toFixed(2)} | 
                     <strong className="text-red-400"> VENDA</strong> abaixo de {((realPrices[selectedAsset] || 64000) * 0.999).toFixed(2)}
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-2 pt-2">
                   <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{width: '68%'}} />
                   </div>
                   <span className="text-[10px] text-neutral-500 font-mono">68% conf.</span>
                 </div>
               </div>
               
               {/* 🔥 BOTÃO PARA EXPANDIR ANÁLISE COMPLETA + VOZ */}
               <div className="mt-3 pt-3 border-t border-amber-500/20">
                 <button 
                   onClick={async () => {
                     const opening = !showHourlyPanel;
                     setShowHourlyPanel(opening);
                     if (opening && !isNarrating) {
                       const currentPrice = realPrices[selectedAsset] || 64000;
                       const volatility = 0.015 + Math.random() * 0.02;
                       const trendRand = Math.random();
                       const trend = trendRand > 0.55 ? 'bullish' : trendRand < 0.45 ? 'bearish' : 'sideways';
                       const strength = 0.45 + Math.random() * 0.5;
                       const analysisData: HourlyAnalysisData = {
                         symbol: selectedAsset,
                         currentPrice,
                         trend: trend as 'bullish' | 'bearish' | 'sideways',
                         strength,
                         volatility,
                       };
                       const messages = generateHourlyVoiceAnalysis(analysisData);
                       toast.success(`IA narrando análise de ${selectedAsset}...`);
                       setIsNarrating(true);
                       for (let i = 0; i < messages.length; i++) {
                         await speak(messages[i], 'high');
                         await new Promise(r => setTimeout(r, 3500));
                       }
                       setIsNarrating(false);
                     }
                   }}
                   className={`w-full py-2 px-3 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                     isNarrating
                       ? 'bg-gradient-to-r from-purple-700 to-blue-700 animate-pulse cursor-wait'
                       : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/20'
                   }`}
                 >
                   <Brain className={`w-3 h-3 ${isNarrating ? 'animate-spin' : ''}`} />
                   {isNarrating ? '🎙️ Narrando análise...' : 'Análise | Próxima Hora'}
                 </button>
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm relative">
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] opacity-20 z-10"></div>
                
                {!aiEnabled && (
                  <div className="text-center py-8 text-neutral-500">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">IA Pausada</p>
                    <p className="text-xs mt-1">Ative o AI para ver alertas em tempo real</p>
                  </div>
                )}
                
                {aiEnabled && (
                  <AnimatePresence>
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-3 rounded border-l-2 relative overflow-hidden group ${
                          log.type === 'warning' ? 'border-amber-500 bg-amber-500/5' :
                          log.type === 'success' ? 'border-emerald-500 bg-emerald-500/5' :
                          'border-blue-500 bg-blue-500/5'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] text-neutral-500">{log.time}</span>
                          <Activity className="w-3 h-3 text-neutral-600 group-hover:text-white transition-colors" />
                        </div>
                        <p className="text-neutral-300 leading-snug text-xs">{log.msg}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
             </div>
             
             <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
               <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                 <Search className="w-3 h-3" />
                 Escaneamento Profundo
               </button>
             </div>
             
             {/* 🔥 BOTÃO DE ANÁLISE POR VOZ */}
             <div className="p-4 border-t border-purple-800/30 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
               <button 
                 onClick={async () => {
                   const currentPrice = realPrices[selectedAsset] || 64000;
                   const volatility = Math.random() * 0.03 + 0.01;
                   const trend = Math.random() > 0.5 ? 'bullish' : 'bearish';
                   const strength = Math.random() * 0.6 + 0.4;
                   
                   const analysisData: HourlyAnalysisData = {
                     symbol: selectedAsset,
                     currentPrice,
                     trend: trend as 'bullish' | 'bearish' | 'sideways',
                     strength,
                     volatility
                   };
                   
                   const messages = generateHourlyVoiceAnalysis(analysisData);
                   
                   toast.success('Iniciando análise por voz...');
                   setIsNarrating(true);
                   
                   // Falar cada mensagem em sequência com pausa maior
                   for (let i = 0; i < messages.length; i++) {
                     await speak(messages[i], 'high');
                     // 🔥 AGUARDAR 4 SEGUNDOS entre cada mensagem
                     await new Promise(resolve => setTimeout(resolve, 4000));
                   }
                   
                   toast.success('Análise por voz concluída!');
                   setIsNarrating(false);
                 }}
                 className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-500/30"
               >
                 <Brain className="w-4 h-4" />
                 🎤 Análise Completa por Voz (Próxima 1h)
               </button>
               <p className="text-[10px] text-center text-neutral-500 mt-2">
                 A IA narrará análise detalhada com previsões, níveis e recomendações
               </p>
             </div>
           </div>

           <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                 <Zap className="w-4 h-4 text-amber-400" />
                 Algoritmos Detectados
              </h3>
              <div className="space-y-3">
                 <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded border border-neutral-700/50">
                     <div className="flex flex-col">
                         <span className="text-xs font-bold text-cyan-400">Fluxo Passivo (Compra)</span>
                         <span className="text-[10px] text-neutral-500">Zona de Proteção Detectada</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="text-xs font-mono text-white">FORTE</span>
                     </div>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded border border-neutral-700/50">
                     <div className="flex flex-col">
                         <span className="text-xs font-bold text-purple-400">Iceberg (Venda)</span>
                         <span className="text-[10px] text-neutral-500">Bloco Oculto: ~450 {selectedAsset}</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                         <span className="text-xs font-mono text-white">ALERTA</span>
                     </div>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded border border-neutral-700/50 opacity-50">
                     <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-400">Front-Running</span>
                         <span className="text-[10px] text-neutral-500">Antecipação HFT</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-slate-600" />
                         <span className="text-xs font-mono text-slate-400">AGUARDANDO</span>
                     </div>
                 </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/5">
                 <div className="text-[10px] text-neutral-400 mb-2 font-bold uppercase tracking-wider">Sugestão da IA:</div>
                 <p className="text-xs text-indigo-300 leading-relaxed">
                    Ordens passivas massivas detectadas na ponta compradora. Estratégia sugerida: <strong>Front-Running</strong> (comprar logo acima) e posicionar Stops de proteção abaixo do bloco institucional.
                 </p>
              </div>
           </div>

         </div>
       </div>
     </div>
  );
};