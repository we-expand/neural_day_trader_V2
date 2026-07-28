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
import { ALL_ASSETS, Asset } from '@/app/config/assetDatabase';
import { useSupabaseRealtimeTurbo, TURBO_CONFIGS } from '@/app/hooks/useSupabaseRealtimeTurbo'; // 🔥 TURBO MODE
import { toast } from 'sonner';
import { generateHourlyVoiceAnalysis, generateQuickVoiceAnalysis, HourlyAnalysisData } from '@/app/utils/hourlyVoiceAnalysis'; // 🔥 ANÁLISE DE VOZ
import { MarketScoreEngine, describeMicrostructure, type MarketScoreResult } from '@/app/services/MarketScoreEngine';
import { backtestDataService, resolveBinanceTicker, type Timeframe } from '@/app/services/BacktestDataService';
import { InfinoxAssetsBrowser } from '@/app/components/dashboard/InfinoxAssetsBrowser';

// 🔥 USAR TODOS OS 300+ ATIVOS DO BANCO DE DADOS
const ASSETS = ALL_ASSETS;

// ✅ 2026-07-28: '1w' removido — o MarketScoreEngine/Timeframe do motor só
// suporta 6 timeframes reais ('1m'|'5m'|'15m'|'1h'|'4h'|'1d'). Manter '1w'
// aqui deixava o seletor oferecer uma opção que nunca teria Score real.
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '1 minuto', '5m': '5 minutos', '15m': '15 minutos',
  '1h': '1 hora', '4h': '4 horas', '1d': '1 dia',
};

const MS_PER_BAR: Record<Timeframe, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

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
// ⚠️ NOTA DE ESCOPO (2026-07-28): a Matriz de Correlação acima e o painel
// "Força Relativa" mais abaixo neste arquivo também usam `Math.random()` e
// NÃO foram tocados nesta tarefa — a tarefa 4 pedida cobriu explicitamente
// Timeframe, seletor de ativos, painel de previsão, mapa de liquidez e feed
// neural, mas não esses dois painéis. Ficam como código fabricado conhecido,
// fora do escopo desta mudança — reportado explicitamente, não escondido.

const aiLogs: { id: number; time: string; type: 'info' | 'warning' | 'success'; msg: string }[] = [];

export const LiquidityPrediction = () => {
  const { selectedAsset, setSelectedAsset } = useTradingContext();
  
  const [logs, setLogs] = useState(aiLogs);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [showInfo, setShowInfo] = useState(false);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false); // ✅ agora controla o InfinoxAssetsBrowser (modo single)
  const [realPrices, setRealPrices] = useState<Record<string, number>>({});
  const [aiEnabled, setAiEnabled] = useState(true); // 🔥 Toggle AI ON/OFF
  const [showHourlyPanel, setShowHourlyPanel] = useState(false); // 🔥 NOVO: Toggle painel horário
  const { speak } = useSpeechAlert({ rate: 0.95, volume: 1.0 });
  const [isNarrating, setIsNarrating] = useState(false); // 🔥 Voice narration state

  // 🎯 Score real (MarketScoreEngine) — fonte única pro painel de previsão e narração por voz.
  const [scoreResult, setScoreResult] = useState<MarketScoreResult | null>(null);

  // Ticker Binance resolvido pro ativo selecionado (null = não é cripto negociada na Binance).
  const [binanceTicker, setBinanceTicker] = useState<string | null>(null);

  // Mapa de liquidez real (order book Binance) — só cripto resolvível.
  const [depthData, setDepthData] = useState<{ price: number; liquidity: number; side: 'bid' | 'ask' }[] | null>(null);
  const [depthLoading, setDepthLoading] = useState(false);
  const [depthError, setDepthError] = useState<string | null>(null);

  // Pivô real (swing high/low) pro bloco de Resistência/Suporte.
  const [pivotLevels, setPivotLevels] = useState<{ resistance: number; support: number } | null>(null);
  const [pivotLoading, setPivotLoading] = useState(false);
  const [pivotError, setPivotError] = useState<string | null>(null);

  const currentAsset = ASSETS.find(a => a.symbol === selectedAsset);

  const formatPivot = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: v >= 100 ? 2 : 6 });

  // ✅ Resolve se o ativo selecionado é cripto negociada na Binance (público, sem auth) — mesmo
  // critério real usado em `realPrices` (linha ~92) e no MarketScoreEngine (resolveBinanceTicker).
  useEffect(() => {
    let cancelled = false;
    resolveBinanceTicker(selectedAsset).then(ticker => {
      if (!cancelled) setBinanceTicker(ticker);
    }).catch(() => {
      if (!cancelled) setBinanceTicker(null);
    });
    return () => { cancelled = true; };
  }, [selectedAsset]);

  // 🎯 Score real do MarketScoreEngine — recalcula ao trocar ativo/timeframe, com
  // cancelamento pra evitar race condition (mesmo padrão de MarketScoreBoard.tsx:612).
  useEffect(() => {
    let cancelled = false;
    const computeScore = async () => {
      try {
        const result = await MarketScoreEngine.compute(selectedAsset, timeframe);
        if (!cancelled) setScoreResult(result);
      } catch (e: any) {
        if (!cancelled) setScoreResult(MarketScoreEngine.unavailable(selectedAsset, timeframe, timeframe, e?.message));
      }
    };
    computeScore();
    const interval = setInterval(computeScore, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedAsset, timeframe]);

  // 📐 Pivô real (swing high/low das últimas N barras do timeframe selecionado) — mesma
  // fonte de candle real do motor (backtestDataService), sem margem arbitrária fixa.
  useEffect(() => {
    let cancelled = false;
    const loadPivot = async () => {
      setPivotLoading(true);
      setPivotError(null);
      try {
        const N = 20; // janela do swing — mesma escala usada pelo MarketScoreEngine (FIB_SWING_LOOKBACK)
        const end = Date.now();
        const start = end - N * MS_PER_BAR[timeframe] * 3; // folga pra ativos com gaps de calendário (fds/pausa)
        const res = await backtestDataService.fetchHistoricalData(selectedAsset, new Date(start), new Date(end), timeframe);
        if (cancelled) return;
        const candles = res.candles.slice(-N);
        if (candles.length < 5) {
          setPivotLevels(null);
          setPivotError('Candles insuficientes para calcular pivô real.');
          return;
        }
        // Pivô clássico de swing: resistência = máxima das últimas N barras,
        // suporte = mínima das últimas N barras (candle real, sem margem % arbitrária).
        const resistance = Math.max(...candles.map(c => c.high));
        const support = Math.min(...candles.map(c => c.low));
        setPivotLevels({ resistance, support });
      } catch (e: any) {
        if (!cancelled) {
          setPivotLevels(null);
          setPivotError(e?.message || 'Falha ao buscar candles reais para o pivô.');
        }
      } finally {
        if (!cancelled) setPivotLoading(false);
      }
    };
    loadPivot();
    return () => { cancelled = true; };
  }, [selectedAsset, timeframe]);

  // 🌊 Mapa de liquidez real (order book Binance) — só cripto resolvível na Binance.
  useEffect(() => {
    let cancelled = false;
    if (!binanceTicker) {
      setDepthData(null);
      setDepthError(`Mapa de liquidez em tempo real disponível apenas para pares cripto negociados na Binance — ${selectedAsset} não é um desses pares.`);
      setDepthLoading(false);
      return;
    }
    const loadDepth = async () => {
      setDepthLoading(true);
      setDepthError(null);
      try {
        const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${binanceTicker}&limit=100`);
        if (!res.ok) throw new Error(`Binance depth HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const bids = (data.bids || []).map((b: [string, string]) => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }))
          .sort((a: any, b: any) => b.price - a.price);
        const asks = (data.asks || []).map((a: [string, string]) => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }))
          .sort((a: any, b: any) => a.price - b.price);
        let cum = 0;
        const bidPoints = bids.map((b: any) => { cum += b.qty; return { price: b.price, liquidity: cum, side: 'bid' as const }; }).reverse();
        cum = 0;
        const askPoints = asks.map((a: any) => { cum += a.qty; return { price: a.price, liquidity: cum, side: 'ask' as const }; });
        setDepthData([...bidPoints, ...askPoints]);
      } catch (e: any) {
        if (!cancelled) {
          setDepthData(null);
          setDepthError(`Falha ao buscar order book real da Binance (${e?.message || 'erro de rede'}).`);
        }
      } finally {
        if (!cancelled) setDepthLoading(false);
      }
    };
    loadDepth();
    const interval = setInterval(loadDepth, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [binanceTicker, selectedAsset]);

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

  // 🔥 CORREÇÃO: Cache do Vite
  const currentCorrelations = generateCorrelations(selectedAsset); // 🔥 CORRELAÇÕES DINÂMICAS

  // ✅ 2026-07-28: removidos os ~17 templates de alerta gerados com `Math.random()`
  // (baleia, spoofing, iceberg, RSI fabricado, cluster de stops etc — nenhum
  // desses eventos era real, era texto sorteado com cara de análise). Mantidos:
  // (1) alertas reais de horário de mercado (abertura NYSE/Londres/Ásia por
  // relógio real, inalterados); (2) contagem regressiva real até a próxima
  // virada de candle do timeframe selecionado, SEM o teste sempre-verdadeiro
  // disfarçado (`currentPrice >= whalePrice`, onde `whalePrice=Math.floor(currentPrice)`
  // — comparava o preço com ele mesmo arredondado, sempre "verdadeiro"); (3)
  // trade grande real via Binance aggTrades (só cripto, evento já ocorrido,
  // não previsão); (4) pressão de book real via `describeMicrostructure`
  // (só cripto, quando `scoreResult.microstructure` está disponível).
  useEffect(() => {
    if (!aiEnabled) return;

    setLogs([
      { id: Date.now(), time: new Date().toLocaleTimeString(), type: 'info', msg: `Iniciando varredura neural para ${selectedAsset}...` },
    ]);

    const interval = setInterval(() => {
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      const currentHour = now.getHours();

      const barMinutes = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15
        : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : 1440;
      const minutesUntilCandle = barMinutes - (currentMinute % barMinutes || barMinutes);
      const secondsUntilCandle = 60 - currentSecond;
      const totalSecondsUntilCandle = Math.max(0, (minutesUntilCandle - 1) * 60 + secondsUntilCandle);
      const minutesDisplay = Math.floor(totalSecondsUntilCandle / 60);
      const secondsDisplay = totalSecondsUntilCandle % 60;

      const marketAlerts: string[] = [];

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

      if (isWeekday && currentHour >= 9 && currentHour < 13 && currentMinute < 5) {
        marketAlerts.push(`⏰ SOBREPOSIÇÃO LONDRES-NY EM ANDAMENTO! MAIOR LIQUIDEZ do dia. SUGESTÃO: Melhor momento para scalping e day trading. Spreads menores + movimentos fortes.`);
      }

      if (isWeekend) {
        console.log(`[LiquidityPrediction] 🔴 FIM DE SEMANA detectado. Alertas de bolsa desativados.`);
      }

      const candidates: { msg: string; type: 'info' | 'warning' | 'success' }[] = [
        ...(totalSecondsUntilCandle <= 480 ? [{
          msg: `⏰ VIRADA DE CANDLE ${selectedAsset} (${timeframe}) em ${minutesDisplay}min ${secondsDisplay}s.`,
          type: 'info' as const,
        }] : []),
        ...marketAlerts.map(msg => ({ msg, type: 'info' as const })),
      ];

      if (scoreResult?.microstructure) {
        const microTxt = describeMicrostructure(scoreResult.microstructure);
        if (microTxt) {
          candidates.push({ msg: `📖 ${microTxt}`, type: 'info' as const });
        }
      }

      if (candidates.length === 0) return;
      const selectedTemplate = candidates[Math.floor(Math.random() * candidates.length)];

      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: selectedTemplate.type,
        msg: selectedTemplate.msg,
      };

      setLogs(prev => [newLog, ...prev].slice(0, 12));

      if (selectedTemplate.msg.includes('VIRADA DE CANDLE') && totalSecondsUntilCandle <= 120) {
        speak(`Atenção! Candle ${selectedAsset} vira em ${minutesDisplay} minutos.`, 'normal');
      } else if (selectedTemplate.msg.includes('ABERTURA NYSE')) {
        speak(`Abertura da bolsa de Nova York em ${30 - currentMinute} minutos. Prepare-se para alta volatilidade.`, 'normal');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedAsset, timeframe, speak, aiEnabled, scoreResult]);

  // 💰 Trade grande real (Binance aggTrades) — só cripto resolvível na Binance.
  // Reporte de evento FACTUAL já ocorrido (não é previsão). Limiar de
  // "grande": ≥ US$ 250.000 por trade agregado — escolha arbitrária do
  // desenvolvedor (documentada, não calibrada estatisticamente) pensada pra
  // filtrar ruído de varejo sem exigir volume tão alto que o alerta nunca
  // dispare fora de BTC/ETH; ajustar se o Cleber quiser um piso diferente.
  const BIG_TRADE_USD_THRESHOLD = 250_000;
  const seenAggTradeIds = React.useRef<Set<number>>(new Set());
  useEffect(() => {
    seenAggTradeIds.current = new Set();
    if (!aiEnabled || !binanceTicker) return;

    let cancelled = false;
    const pollBigTrades = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${binanceTicker}&limit=50`);
        if (!res.ok) throw new Error(`Binance aggTrades HTTP ${res.status}`);
        const trades = await res.json();
        if (cancelled || !Array.isArray(trades)) return;

        for (const t of trades) {
          const aggId = t.a as number;
          if (seenAggTradeIds.current.has(aggId)) continue;
          seenAggTradeIds.current.add(aggId);

          const price = parseFloat(t.p);
          const qty = parseFloat(t.q);
          const valueUSD = price * qty;
          if (valueUSD < BIG_TRADE_USD_THRESHOLD) continue;

          const isBuyerMaker = t.m as boolean; // true = o comprador era o maker (agressor vendeu)
          const side = isBuyerMaker ? 'VENDA' : 'COMPRA';
          const newLog = {
            id: Date.now() + aggId,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: (isBuyerMaker ? 'warning' : 'success') as 'warning' | 'success',
            msg: `💰 TRADE GRANDE (real): ${side} de ${qty.toFixed(4)} ${binanceTicker} (~$${valueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}) executada na Binance.`,
          };
          setLogs(prev => [newLog, ...prev].slice(0, 12));
        }

        // limita o Set pra não crescer sem fim numa sessão longa
        if (seenAggTradeIds.current.size > 500) {
          seenAggTradeIds.current = new Set(Array.from(seenAggTradeIds.current).slice(-200));
        }
      } catch (e) {
        console.warn('[LiquidityPrediction] Falha ao buscar aggTrades reais da Binance:', e);
      }
    };

    pollBigTrades();
    const interval = setInterval(pollBigTrades, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [binanceTicker, aiEnabled]);

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
         {/* 🔥 SELETOR DE ATIVOS — reaproveita o InfinoxAssetsBrowser (modo single) em
             vez de um dropdown de busca/grid próprio redundante. */}
         <div className="relative z-[100]">
           <button
             onClick={() => setAssetMenuOpen(true)}
             className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-800 hover:border-indigo-500/50 transition-colors min-w-[200px] justify-between"
           >
             <div className="flex items-center gap-2">
               {currentAsset && <span className="text-lg">{currentAsset.icon || '💹'}</span>}
               <div className="text-left">
                 <div className="font-bold text-white text-sm">{selectedAsset}</div>
                 {currentAsset && <div className="text-[10px] text-neutral-500">{currentAsset.name}</div>}
               </div>
             </div>
             <ChevronDown className="w-4 h-4 text-neutral-500" />
           </button>

           <InfinoxAssetsBrowser
             isOpen={assetMenuOpen}
             onClose={() => setAssetMenuOpen(false)}
             selectedAsset={selectedAsset}
             onSelectAsset={(symbol) => {
               setSelectedAsset(symbol);
               setAssetMenuOpen(false);
             }}
           />
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
           {/* 🎯 PAINEL DE PREVISÃO — dados reais do MarketScoreEngine + pivô real (candle),
               3 estados (real/stale/unavailable), mesmo padrão de MarketScoreBoard.tsx:717,755. */}
           <AnimatePresence>
             {showHourlyPanel && (() => {
               const hasRealScore = !!(scoreResult && (scoreResult.provenance === 'real' || scoreResult.provenance === 'stale'));
               const isTrulyUnavailable = !!(scoreResult && scoreResult.provenance === 'unavailable');
               const bias = !scoreResult ? null
                 : scoreResult.classification === 'COMPRADOR' && scoreResult.regime === 'TENDENCIA' ? 'Viés de Alta'
                 : scoreResult.classification === 'VENDEDOR' && scoreResult.regime === 'TENDENCIA' ? 'Viés de Baixa'
                 : 'Sem Direção Clara';
               const biasColor = bias === 'Viés de Alta' ? 'text-emerald-400' : bias === 'Viés de Baixa' ? 'text-rose-400' : 'text-blue-400';

               return (
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
                       Previsão Próxima {TIMEFRAME_LABELS[timeframe]}
                       {scoreResult?.provenance === 'stale' && (
                         <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
                           dado desatualizado
                         </span>
                       )}
                     </h3>

                     {isTrulyUnavailable ? (
                       <p className="text-sm text-neutral-400">{scoreResult!.insight}</p>
                     ) : (
                       <>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                             <div className="text-xs text-neutral-400 mb-1">Preço Atual</div>
                             <div className="text-2xl font-bold text-white">${(realPrices[selectedAsset] || 0).toLocaleString()}</div>
                           </div>

                           <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                             <div className="text-xs text-neutral-400 mb-1">Leitura</div>
                             <div className={`text-xl font-bold ${biasColor}`}>{hasRealScore ? bias : '—'}</div>
                           </div>

                           <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                             <div className="text-xs text-neutral-400 mb-1">Confiança</div>
                             <div className="text-2xl font-bold text-blue-400">{hasRealScore ? `${scoreResult!.confidence}%` : '—'}</div>
                           </div>
                         </div>

                         <div className="space-y-2 text-sm text-neutral-300">
                           <p>
                             <strong className="text-blue-400">NÍVEIS (pivô real):</strong>{' '}
                             {pivotLoading ? 'calculando…' : pivotLevels
                               ? `Resistência em $${formatPivot(pivotLevels.resistance)} | Suporte em $${formatPivot(pivotLevels.support)}`
                               : pivotError || 'indisponível'}
                           </p>
                           {hasRealScore && <p className="text-neutral-400">{scoreResult!.insight}</p>}
                         </div>
                       </>
                     )}
                   </div>
                 </motion.div>
               );
             })()}
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
               {!binanceTicker ? (
                 <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-8">
                   <WifiOff className="w-8 h-8 text-neutral-600" />
                   <p className="text-sm text-neutral-400 max-w-md">
                     Mapa de liquidez em tempo real disponível apenas para pares cripto negociados na Binance — <strong className="text-neutral-300">{selectedAsset}</strong> não é um desses pares.
                   </p>
                 </div>
               ) : depthLoading && !depthData ? (
                 <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                   Carregando order book real da Binance ({binanceTicker})...
                 </div>
               ) : depthError && !depthData ? (
                 <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-8">
                   <AlertTriangle className="w-8 h-8 text-red-400" />
                   <p className="text-sm text-red-300 max-w-md">{depthError}</p>
                 </div>
               ) : depthData && depthData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={depthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorBid" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5}/>
                         <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                       </linearGradient>
                       <linearGradient id="colorAsk" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5}/>
                         <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
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
                       tickFormatter={(val) => `${val.toFixed(2)}`}
                       width={50}
                     />
                     <Tooltip
                       contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                       itemStyle={{ color: '#fff', fontSize: '12px' }}
                       labelStyle={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}
                       labelFormatter={(label) => `Preço: $${Number(label).toLocaleString()}`}
                     />
                     <Area
                       type="stepAfter"
                       dataKey={(d: any) => d.side === 'bid' ? d.liquidity : null}
                       stroke="#22c55e"
                       strokeWidth={2}
                       fillOpacity={1}
                       fill="url(#colorBid)"
                       name="Liquidez real (bids)"
                       isAnimationActive={false}
                     />
                     <Area
                       type="stepAfter"
                       dataKey={(d: any) => d.side === 'ask' ? d.liquidity : null}
                       stroke="#ef4444"
                       strokeWidth={2}
                       fillOpacity={1}
                       fill="url(#colorAsk)"
                       name="Liquidez real (asks)"
                       isAnimationActive={false}
                     />
                   </AreaChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                   Sem profundidade de book disponível no momento.
                 </div>
               )}
             </div>

             {binanceTicker && depthData && depthData.length > 0 && (
               <div className="absolute top-4 right-4 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                 <Wifi className="w-3 h-3" />
                 BOOK REAL — {binanceTicker}
               </div>
             )}
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
                   Previsão Próxima {TIMEFRAME_LABELS[timeframe]}
                 </h4>
                 {scoreResult?.provenance === 'stale' && (
                   <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                     desatualizado
                   </span>
                 )}
               </div>

               {(() => {
                 const hasRealScore = !!(scoreResult && (scoreResult.provenance === 'real' || scoreResult.provenance === 'stale'));
                 const isTrulyUnavailable = !!(scoreResult && scoreResult.provenance === 'unavailable');
                 const bias = !scoreResult ? null
                   : scoreResult.classification === 'COMPRADOR' && scoreResult.regime === 'TENDENCIA' ? 'Viés de Alta'
                   : scoreResult.classification === 'VENDEDOR' && scoreResult.regime === 'TENDENCIA' ? 'Viés de Baixa'
                   : 'Sem Direção Clara';
                 const biasColor = bias === 'Viés de Alta' ? 'text-emerald-400' : bias === 'Viés de Baixa' ? 'text-rose-400' : 'text-blue-400';
                 const biasDot = bias === 'Viés de Alta' ? 'bg-emerald-400' : bias === 'Viés de Baixa' ? 'bg-rose-400' : 'bg-blue-400';

                 if (isTrulyUnavailable) {
                   return <p className="text-xs text-neutral-400 py-2">{scoreResult!.insight}</p>;
                 }

                 return (
                   <div className="space-y-2">
                     <div className="flex items-start gap-2 text-xs">
                       <div className={`w-1.5 h-1.5 rounded-full ${biasDot} mt-1.5 animate-pulse`} />
                       <div>
                         <span className={`font-bold ${biasColor}`}>{hasRealScore ? bias?.toUpperCase() : 'CALCULANDO...'}</span>
                         <span className="text-neutral-400"> - Confiança: </span>
                         <span className="text-white font-mono">{hasRealScore ? `${scoreResult!.confidence}%` : '—'}</span>
                       </div>
                     </div>

                     <div className="pl-3.5 space-y-1 text-[11px] text-neutral-400">
                       <div>
                         <span className="text-neutral-500">Resistência (pivô real):</span>
                         <span className="text-red-400 font-mono ml-1">
                           {pivotLoading ? 'calculando…' : pivotLevels ? `$${formatPivot(pivotLevels.resistance)}` : (pivotError || 'indisponível')}
                         </span>
                       </div>
                       <div>
                         <span className="text-neutral-500">Suporte (pivô real):</span>
                         <span className="text-emerald-400 font-mono ml-1">
                           {pivotLoading ? 'calculando…' : pivotLevels ? `$${formatPivot(pivotLevels.support)}` : (pivotError || 'indisponível')}
                         </span>
                       </div>
                     </div>

                     {hasRealScore && (
                       <p className="pt-2 mt-2 border-t border-amber-500/20 text-[11px] text-neutral-300 leading-relaxed">
                         {scoreResult!.insight}
                       </p>
                     )}

                     <div className="flex items-center gap-2 pt-2">
                       <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                         <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${hasRealScore ? scoreResult!.confidence : 0}%` }} />
                       </div>
                       <span className="text-[10px] text-neutral-500 font-mono">{hasRealScore ? `${scoreResult!.confidence}%` : '—'} conf.</span>
                     </div>
                   </div>
                 );
               })()}

               {/* 🔥 BOTÃO PARA EXPANDIR ANÁLISE COMPLETA + VOZ */}
               <div className="mt-3 pt-3 border-t border-amber-500/20">
                 <button
                   onClick={async () => {
                     const opening = !showHourlyPanel;
                     setShowHourlyPanel(opening);
                     if (opening && !isNarrating) {
                       const currentPrice = realPrices[selectedAsset] || 0;
                       const atr = scoreResult?.indicators.atr;
                       const volatility = atr && currentPrice > 0 ? Math.min(atr / currentPrice, 0.1) : 0.01;
                       const trend: 'bullish' | 'bearish' | 'sideways' =
                         scoreResult?.classification === 'COMPRADOR' ? 'bullish' :
                         scoreResult?.classification === 'VENDEDOR' ? 'bearish' : 'sideways';
                       const strength = scoreResult ? scoreResult.confidence / 100 : 0;
                       const analysisData: HourlyAnalysisData = {
                         symbol: selectedAsset,
                         currentPrice,
                         trend,
                         strength,
                         volatility,
                         rsi: scoreResult?.indicators.rsi ?? null,
                         provenance: scoreResult?.provenance || 'unavailable',
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
                   {isNarrating ? '🎙️ Narrando análise...' : `Análise | Próxima ${TIMEFRAME_LABELS[timeframe]}`}
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
                   const currentPrice = realPrices[selectedAsset] || 0;
                   const atr = scoreResult?.indicators.atr;
                   const volatility = atr && currentPrice > 0 ? Math.min(atr / currentPrice, 0.1) : 0.01;
                   const trend: 'bullish' | 'bearish' | 'sideways' =
                     scoreResult?.classification === 'COMPRADOR' ? 'bullish' :
                     scoreResult?.classification === 'VENDEDOR' ? 'bearish' : 'sideways';
                   const strength = scoreResult ? scoreResult.confidence / 100 : 0;

                   const analysisData: HourlyAnalysisData = {
                     symbol: selectedAsset,
                     currentPrice,
                     trend,
                     strength,
                     volatility,
                     rsi: scoreResult?.indicators.rsi ?? null,
                     provenance: scoreResult?.provenance || 'unavailable',
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
                 🎤 Análise Completa por Voz ({TIMEFRAME_LABELS[timeframe]})
               </button>
               <p className="text-[10px] text-center text-neutral-500 mt-2">
                 A IA narrará análise detalhada com dados reais do Market Score Engine
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