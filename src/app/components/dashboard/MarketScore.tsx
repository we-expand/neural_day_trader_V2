import React, { useEffect, useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertCircle, 
  DollarSign, 
  Percent, 
  Target, 
  BarChart3, 
  Eye,
  Bot,
  Zap,
  Lock,
  Layers,
  ChevronDown,
  Shield,
  ArrowRight
} from 'lucide-react';
import { useMarketData } from '@/hooks/useMarketData'; // ✅ HOOK CORRETO
import { ModernScoreGauge } from './ModernScoreGauge';
import { useTradingContext } from '../../contexts/TradingContext';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/app/components/ui/command';
import SignalDebugger from '@/app/utils/signalDebugger'; // ✅ NOVO: Debug de sinais
import { supabase } from '@/lib/supabaseClient';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const ASSET_CATEGORIES = {
  FOREX: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD'],
  'INDICES': ['SP500', 'NASDAQ100', 'DOW30', 'DAX40', 'FTSE100', 'NIKKEI225'],
  COMMODITIES: ['GOLD', 'SILVER', 'CRUDE OIL', 'NATURAL GAS'],
  CRIPTO: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD']
};

export default function MarketScore() {
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  
  // ✅ USANDO O HOOK CORRETO QUE RETORNA marketScore
  const { marketScore, loading } = useMarketData(selectedAsset, timeframe);
  const { addSale, balance } = useFinanceStore();
  const { portfolio, riskProfile, setRiskProfile, config } = useTradingContext();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 🎯 NOVO: Calcular lucro REAL da AI baseado em trades salvos
  const [aiProfit, setAiProfit] = useState(0);
  const [aiProfitLoading, setAiProfitLoading] = useState(true);
  
  useEffect(() => {
    // Buscar lucro real da AI do Supabase (trades executados pela IA)
    const fetchAIProfit = async () => {
      setAiProfitLoading(true);
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
          console.log('[AI PROFIT] ⚠️ Usuário não autenticado, lucro = $0.00');
          setAiProfit(0);
          setAiProfitLoading(false);
          return;
        }

        console.log('[AI PROFIT] 🔍 Buscando trades da AI para user:', user.user.id);

        // Buscar trades fechados da AI
        const { data: trades, error } = await supabase
          .from('ai_trades')
          .select('pnl')
          .eq('user_id', user.user.id)
          .eq('status', 'CLOSED');

        if (error) {
          console.error('[AI PROFIT] ❌ Erro ao buscar trades da AI:', error);
          console.log('[AI PROFIT] 💡 Tabela ai_trades pode não existir. Lucro = $0.00');
          setAiProfit(0);
          setAiProfitLoading(false);
          return;
        }

        console.log('[AI PROFIT] ✅ Trades encontrados:', trades?.length || 0);

        // Somar PnL de todos os trades
        const totalProfit = trades?.reduce((sum, trade) => sum + (trade.pnl || 0), 0) || 0;
        console.log('[AI PROFIT] 💰 Lucro total calculado:', totalProfit);
        setAiProfit(totalProfit);
      } catch (err) {
        console.error('[AI PROFIT] ❌ Erro ao calcular lucro AI:', err);
        setAiProfit(0);
      } finally {
        setAiProfitLoading(false);
      }
    };

    fetchAIProfit();
  }, [portfolio?.equity]); // Recalcular quando equity mudar
  
  // ✅ DESESTRUTURANDO DO marketScore
  const { score, components, execution, volatility, orderFlow, technicalAnalysis, marketPhase, insight } = marketScore;
  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  const isLive = config?.executionMode === 'LIVE';

  // Helper to safely get indicators
  const getIndicator = (name: string) => technicalAnalysis.indicators.find(i => i.name.includes(name));
  const rsi = getIndicator('RSI');
  const fib = getIndicator('Fibonacci');
  const vol = getIndicator('Volumetria');
  const obv = getIndicator('OBV');
  
  // ✅ NOVO: Capturar snapshot de sinais para debug
  useEffect(() => {
    if (!loading && score > 0) {
      SignalDebugger.capture({
        component: 'MarketScore',
        timestamp: Date.now(),
        symbol: selectedAsset,
        timeframe,
        signals: {
          rsi: rsi ? { value: parseFloat(rsi.value), signal: rsi.signal } : undefined,
          fibonacci: fib ? { value: fib.value, signal: fib.signal } : undefined,
          volumetria: vol ? { value: vol.value, signal: vol.signal } : undefined,
          obv: obv ? { value: obv.value, signal: obv.signal } : undefined
        },
        score,
        classification: marketScore.classification,
        marketPhase
      });
    }
  }, [score, selectedAsset, timeframe, loading]);

  // Translations
  const PHASE_TRANSLATIONS: Record<string, string> = {
      'EXPANSION': 'EXPANSÃO',
      'RETRACTION': 'RETRAÇÃO',
      'CONSOLIDATION': 'CONSOLIDAÇÃO',
      'ACCUMULATION': 'ACUMULAÇÃO',
      'DISTRIBUTION': 'DISTRIBUIÇÃO'
  };

  const SIGNAL_COLORS = {
      'BUY': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      'SELL': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      'NEUTRAL': 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  };

  const handleUnlock = () => {
    setIsProcessing(true);
    setTimeout(() => {
        setIsProcessing(false);
        addSale("Alpha Insight Unlock", 29.99);
        toast.success("Alpha Insight Desbloqueado");
    }, 1500);
  };

  return (
    <div className="w-full bg-[#020202] text-white p-6 font-sans rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Background Noise */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 relative z-10">
           {/* Title Section */}
           <div>
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10B981]" />
                 <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">Neural Day Trader</span>
              </div>
              <div className="flex items-center gap-4">
                 <h1 className="text-4xl font-bold tracking-tighter text-white">
                    MARKET <span className="text-slate-600">SCORE</span>
                 </h1>
                 <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isLive ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 text-black'}`}>
                    {isLive ? 'V2.1 LIVE (REAL)' : 'V2.1 SIMULATION'}
                 </span>
              </div>
           </div>
           
           {/* Controls */}
           <div className="flex flex-wrap items-center gap-4 bg-[#080808] p-1.5 rounded-xl border border-white/5">
              {/* Asset Selector */}
              <Popover open={isAssetSelectorOpen} onOpenChange={setIsAssetSelectorOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-3 bg-[#111] hover:bg-[#151515] border border-white/5 hover:border-white/10 px-4 py-2 rounded-lg text-sm font-bold transition-all min-w-[140px] justify-between text-emerald-400">
                     <span className="tracking-wider truncate">{selectedAsset}</span>
                     <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0 bg-[#0A0A0A] border border-white/10 shadow-2xl rounded-xl" side="bottom" align="end">
                  <Command className="bg-transparent text-slate-200">
                    <CommandInput placeholder="Buscar ativo..." className="h-9 border-b border-white/10 bg-transparent text-xs" />
                    <CommandList className="max-h-[300px] custom-scrollbar p-1">
                      {Object.entries(ASSET_CATEGORIES).map(([category, assets]) => (
                         <CommandGroup key={category} heading={category} className="text-slate-500 font-bold">
                            {assets.map((asset) => (
                               <CommandItem key={asset} value={asset} onSelect={() => { setSelectedAsset(asset); setIsAssetSelectorOpen(false); }} className="cursor-pointer flex justify-between rounded-md aria-selected:bg-white/5">
                                  <span className="text-xs font-bold text-slate-300">{asset}</span>
                                  {selectedAsset === asset && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                               </CommandItem>
                            ))}
                         </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              <div className="w-px h-6 bg-white/5 mx-2" />
              
              {/* Risk Selector */}
              <div className="flex gap-1">
                 <button onClick={() => setRiskProfile('INSTITUTIONAL')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${riskProfile === 'INSTITUTIONAL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}>ALPHA STRATEGIC</button>
                 <button onClick={() => setRiskProfile('DEGEN')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${riskProfile === 'DEGEN' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'}`}>QUANTUM VELOCITY</button>
              </div>

              <div className="w-px h-6 bg-white/5 mx-2" />
              
              {/* Timeframes */}
              <div className="flex gap-1">
                 {timeframes.map(tf => (
                    <button 
                        key={tf} 
                        onClick={() => setTimeframe(tf)}
                        className={`w-9 h-8 rounded-lg text-[10px] font-bold transition-all ${timeframe === tf ? 'bg-white/10 text-white shadow' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                        {tf}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* SUMMARY CARDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 relative z-10">
            {/* Card 1: Patrimônio Líquido */}
            <div className="bg-[#080808] border border-white/5 rounded-2xl p-5 flex flex-col justify-between group hover:border-emerald-500/20 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Activity className="w-5 h-5" />
                    </div>
                    <span className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Live Equity</span>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Patrimônio Líquido</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-white tracking-tight">${portfolio?.equity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '---'}</span>
                        <span className="text-[10px] font-bold text-slate-600">USD</span>
                    </div>
                </div>
            </div>

            {/* Card 2: Resultado */}
            <div className="bg-[#080808] border border-white/5 rounded-2xl p-5 flex flex-col justify-between group hover:border-white/10 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-10 h-10 rounded-xl border bg-opacity-10 flex items-center justify-center ${(portfolio ? (portfolio.equity - (portfolio.initialBalance || portfolio.equity)) : 0) >= 0 ? 'bg-emerald-500 border-emerald-500/10 text-emerald-400' : 'bg-rose-500 border-rose-500/10 text-rose-400'}`}>
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Resultado Global</span>
                    <span className={`text-3xl font-bold tracking-tight ${(portfolio ? (portfolio.equity - (portfolio.initialBalance || portfolio.equity)) : 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(portfolio ? (portfolio.equity - (portfolio.initialBalance || portfolio.equity)) : 0) >= 0 ? '+' : ''}
                        ${(portfolio ? (portfolio.equity - (portfolio.initialBalance || portfolio.equity)) : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Card 3: Lucro AI */}
            <div className="bg-[#080808] border border-white/5 rounded-2xl p-5 flex flex-col justify-between group hover:border-purple-500/20 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/10 flex items-center justify-center text-purple-400">
                        <Bot className="w-5 h-5" />
                    </div>
                    <span className="px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-400 uppercase tracking-wider">AI Agent</span>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Lucro AI Trader</span>
                    <span className={`text-3xl font-bold tracking-tight ${aiProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {aiProfit >= 0 ? '+' : ''}${Math.abs(aiProfit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
           {/* Left Column (Gauge & Vital Stats) */}
           <div className="lg:col-span-4 bg-[#050505] border border-white/5 rounded-3xl relative overflow-hidden flex flex-col items-center justify-between p-6 shadow-inner min-h-[500px]">
              {/* Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30 pointer-events-none" />
              <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#050505] opacity-80 pointer-events-none" />
              
              {/* TOP: Market Pressure Bar - Mais estreita e alta */}
              <div className="w-3/4 mx-auto relative z-10 mb-6">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2.5">
                      <span className="text-emerald-500">Pressão Compra</span>
                      <span className="text-rose-500">Pressão Venda</span>
                  </div>
                  <div className="h-5 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                      <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-700" style={{ width: `${orderFlow.buyPressure}%` }} />
                      <div className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] transition-all duration-700" style={{ width: `${orderFlow.sellPressure}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono mt-2 text-slate-500">
                      <span>{orderFlow.buyPressure}%</span>
                      <span>{orderFlow.sellPressure}%</span>
                  </div>
              </div>

              {/* CENTER: Gauge */}
              <div className="relative w-full h-64 flex items-center justify-center z-10">
                 <ModernScoreGauge score={score} marketStatus="OPEN" />
              </div>

              {/* BOTTOM: Phase Badge (Centered/Prominent) */}
              <div className="w-full relative z-10 mt-8 flex justify-center">
                  <div className="px-6 py-2.5 rounded-full border border-emerald-500/30 bg-[#080808] flex items-center gap-2 shadow-lg shadow-emerald-500/5 hover:scale-105 transition-all cursor-default">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">{PHASE_TRANSLATIONS[marketPhase]}</span>
                  </div>
              </div>
           </div>

           {/* Right Column (Widgets) */}
           <div className="lg:col-span-8 flex flex-col gap-5">
              
              {/* Row 1: Insight */}
              <div className="bg-[#080808] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                 {/* Decor */}
                 <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-60" />
                 <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 blur-[80px] rounded-full pointer-events-none" />

                 <div className="flex flex-col h-full justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-4 h-4 text-purple-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neural Insight</span>
                        </div>
                        <p className="text-sm text-slate-200 font-medium leading-relaxed max-w-3xl">
                            {insight}
                        </p>
                    </div>

                    <div className="flex items-end justify-between gap-8 border-t border-white/5 pt-4">
                        <div className="flex-1 max-w-md">
                            <div className="flex justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sentimento de Rede</span>
                                <span className="text-[10px] font-bold text-white">{components.sentiment}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full" style={{ width: `${components.sentiment}%` }} />
                            </div>
                        </div>
                        <button 
                            onClick={handleUnlock}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs font-bold text-purple-300 uppercase tracking-wider hover:bg-purple-500/20 transition-all"
                        >
                            {isProcessing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-3 h-3" />}
                            Desbloquear Alpha
                        </button>
                    </div>
                 </div>
              </div>

              {/* Row 2: Volatility & Flow */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 {/* Volatility */}
                 <div className="bg-[#080808] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volatilidade</span>
                        </div>
                        <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${volatility.status === 'EXTREME' || volatility.status === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {volatility.status === 'LOW' ? 'BAIXA' : volatility.status === 'NORMAL' ? 'NORMAL' : 'ALTA'}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-3xl font-bold text-white tracking-tight">{volatility.vix.toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Index Point</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${volatility.vix > 20 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min((volatility.vix/40)*100, 100)}%` }} 
                        />
                    </div>
                 </div>

                 {/* Flow */}
                 <div className="bg-[#080808] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fluxo</span>
                        </div>
                        <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${orderFlow.imbalance === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {orderFlow.imbalance === 'BULLISH' ? 'COMPRADOR' : orderFlow.imbalance === 'BEARISH' ? 'VENDEDOR' : 'NEUTRO'}
                        </span>
                    </div>
                    
                    <div className="flex justify-between items-end mb-2 text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-emerald-500">Compra {orderFlow.buyPressure}%</span>
                        <span className="text-rose-500">{orderFlow.sellPressure}% Venda</span>
                    </div>
                    
                    <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-1">
                        <div className="bg-emerald-500 h-full rounded-l-full transition-all duration-500" style={{ width: `${orderFlow.buyPressure}%` }} />
                        <div className="bg-rose-500 h-full rounded-r-full transition-all duration-500" style={{ width: `${orderFlow.sellPressure}%` }} />
                    </div>
                 </div>
              </div>

              {/* Row 3: Technical Indicators */}
              <div className="bg-[#080808] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                      <BarChart3 className="w-4 h-4 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Indicadores Técnicos</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* RSI */}
                      <div className="bg-[#050505] border border-white/5 rounded-xl p-4 flex flex-col items-center text-center">
                          <span className="text-[9px] font-bold text-slate-500 uppercase mb-2">RSI (14)</span>
                          <span className="text-xl font-bold text-white mb-2">{parseFloat(rsi?.value || "50").toFixed(1)}</span>
                          <span className={`text-[9px] font-bold px-3 py-1 rounded w-full border ${SIGNAL_COLORS[rsi?.signal || 'NEUTRAL']}`}>
                              {rsi?.signal === 'BUY' ? 'COMPRA' : rsi?.signal === 'SELL' ? 'VENDA' : 'NEUTRO'}
                          </span>
                      </div>
                      {/* Fibonacci */}
                      <div className="bg-[#050505] border border-white/5 rounded-xl p-4 flex flex-col items-center text-center">
                          <span className="text-[9px] font-bold text-slate-500 uppercase mb-2">Fibonacci</span>
                          <span className="text-sm font-bold text-white mb-3 mt-1 truncate w-full">{fib?.value || '---'}</span>
                          <span className={`text-[9px] font-bold px-3 py-1 rounded w-full border ${SIGNAL_COLORS[fib?.signal || 'NEUTRAL']}`}>
                              {fib?.signal === 'BUY' ? 'COMPRA' : fib?.signal === 'SELL' ? 'VENDA' : 'NEUTRO'}
                          </span>
                      </div>
                      {/* Volumetria */}
                      <div className="bg-[#050505] border border-white/5 rounded-xl p-4 flex flex-col items-center text-center">
                          <span className="text-[9px] font-bold text-slate-500 uppercase mb-2">Volumetria</span>
                          <span className="text-sm font-bold text-white mb-3 mt-1 truncate w-full">{vol?.value || '---'}</span>
                          <span className={`text-[9px] font-bold px-3 py-1 rounded w-full border ${SIGNAL_COLORS[vol?.signal || 'NEUTRAL']}`}>
                              {vol?.signal === 'BUY' ? 'COMPRA' : vol?.signal === 'SELL' ? 'VENDA' : 'NEUTRO'}
                          </span>
                      </div>
                      {/* OBV */}
                      <div className="bg-[#050505] border border-white/5 rounded-xl p-4 flex flex-col items-center text-center">
                          <span className="text-[9px] font-bold text-slate-500 uppercase mb-2">OBV</span>
                          <span className="text-sm font-bold text-white mb-3 mt-1 truncate w-full">{obv?.value || '---'}</span>
                          <span className={`text-[9px] font-bold px-3 py-1 rounded w-full border ${SIGNAL_COLORS[obv?.signal || 'NEUTRAL']}`}>
                              {obv?.signal === 'BUY' ? 'COMPRA' : obv?.signal === 'SELL' ? 'VENDA' : 'NEUTRO'}
                          </span>
                      </div>
                  </div>
              </div>

              {/* Row 4: Execution */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Entry */}
                  <div className="bg-[#080808] border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-white/20" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" /> Entrada
                      </span>
                      <span className="text-2xl font-mono font-bold text-white tracking-tight">
                          {execution.suggestedEntry > 0 ? execution.suggestedEntry.toFixed(4) : '---'}
                      </span>
                  </div>
                  
                  {/* SL */}
                  <div className="bg-[#080808] border border-rose-500/20 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500" />
                      <span className="text-[9px] font-bold text-rose-500/70 uppercase mb-2 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Stop Loss
                      </span>
                      <span className="text-2xl font-mono font-bold text-rose-500">
                          {execution.stopLoss > 0 ? execution.stopLoss.toFixed(4) : '---'}
                      </span>
                  </div>

                  {/* TP 1 */}
                  <div className="bg-[#080808] border border-emerald-500/20 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />
                      <span className="text-[9px] font-bold text-emerald-500/70 uppercase mb-2 flex items-center gap-1">
                          <Target className="w-3 h-3" /> Alvo 1
                      </span>
                      <span className="text-2xl font-mono font-bold text-emerald-400">
                          {execution.takeProfitTarget1 > 0 ? execution.takeProfitTarget1.toFixed(4) : '---'}
                      </span>
                  </div>

                   {/* TP 2 */}
                   <div className="bg-[#080808] border border-emerald-500/20 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />
                      <span className="text-[9px] font-bold text-emerald-500/70 uppercase mb-2 flex items-center gap-1">
                          <Target className="w-3 h-3" /> Alvo 2
                      </span>
                      <span className="text-2xl font-mono font-bold text-emerald-400">
                          {execution.takeProfitTarget2 > 0 ? execution.takeProfitTarget2.toFixed(4) : '---'}
                      </span>
                  </div>
              </div>

           </div>
        </div>
    </div>
  );
}