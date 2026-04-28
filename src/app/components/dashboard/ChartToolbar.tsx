import React, { useState, useRef, useEffect } from 'react';
import { 
  Cpu, 
  MousePointer2, 
  Search, 
  Zap, 
  Activity, 
  Layers, 
  Crosshair, 
  Settings, 
  Grid,
  Maximize2,
  AlertCircle,
  Sparkles,
  Check,
  Save
} from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';
import { toast } from 'sonner';
import { SaveSetupModal } from '../settings/SaveSetupModal';

interface ChartToolbarProps {
  symbol: string;
  timeframe: string;
  setTimeframe: (tf: string) => void;
  isLoading: boolean;
  isCalibrated: boolean;
  onCalibrate: () => void;
  timeLeft: { minutes: number; seconds: number; progress: number };
  chartSettings: { crosshair: boolean; grid: boolean };
  setChartSettings: React.Dispatch<React.SetStateAction<{ crosshair: boolean; grid: boolean }>>;
  onOpenAssetSelector: () => void;
  onOpenEventCenter: () => void;
  onToggleIndicator: (indicator: string) => void;
  isMultiChart?: boolean;
  onToggleMultiChart?: () => void;
}

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];

// ✅ CORREÇÃO: Função que normaliza símbolos SEM adicionar sufixos incorretos
const formatSymbolDisplay = (sym: string) => {
  // Remove barras e normaliza
  let s = sym.replace('/', '').toUpperCase();
  
  // ✅ FOREX PAIRS: Retornar como está (EURUSD, não EURUSDT!)
  if (s.includes('EUR') || s.includes('GBP') || s.includes('USD') || s.includes('JPY') ||
      s.includes('AUD') || s.includes('CAD') || s.includes('CHF') || s.includes('NZD') ||
      s.includes('HUF') || s.includes('MXN') || s.includes('ZAR') || s.includes('TRY') ||
      s.includes('NOK') || s.includes('SGD') || s.includes('CNH') || s.includes('KRW')) {
    // Remover USDT se foi adicionado incorretamente
    return s.replace('USDT', '');
  }
  
  // ✅ METALS: XAUUSD, XAGUSD (sem mudanças)
  if (s.startsWith('XAU') || s.startsWith('XAG') || s.startsWith('XPT') || 
      s.startsWith('XPD') || s.startsWith('XCU')) {
    return s;
  }
  
  // ✅ INDICES: SPX500, NAS100 (sem mudanças)
  if (s.includes('SPX') || s.includes('NAS') || s.includes('US30') || 
      s.includes('GER40') || s.includes('UK100') || s.includes('JPN225') ||
      s.includes('VIX') || s.includes('USDX')) {
    return s;
  }
  
  // ✅ CRYPTO: Se já tem USDT, manter
  if (s.endsWith('USDT')) return s;
  
  // ✅ CRYPTO: Adicionar USDT apenas se for crypto puro (BTC, ETH, etc.)
  if (s.length <= 5 && !s.includes('USD')) {
    return `${s}USDT`;
  }
  
  return s;
};

export function ChartToolbar({
  symbol,
  timeframe,
  setTimeframe,
  isLoading,
  isCalibrated,
  onCalibrate,
  timeLeft,
  chartSettings,
  setChartSettings,
  onOpenAssetSelector,
  onOpenEventCenter,
  onToggleIndicator,
  isMultiChart,
  onToggleMultiChart
}: ChartToolbarProps) {
  const { status: aiStatus, assetSelectionMode, setAssetSelectionMode, config } = useTradingContext();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isSaveSetupOpen, setIsSaveSetupOpen] = useState(false);
  
  // Refs para detectar cliques fora
  const indicatorsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Track active indicators for checkmarks
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (indicatorsRef.current && !indicatorsRef.current.contains(event.target as Node)) {
        setIsIndicatorsOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    
    if (isIndicatorsOpen || isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isIndicatorsOpen, isSettingsOpen]);
  
  const handleIndicatorToggle = (indicator: string) => {
    const newSet = new Set(activeIndicators);
    if (newSet.has(indicator)) {
      newSet.delete(indicator);
    } else {
      newSet.add(indicator);
    }
    setActiveIndicators(newSet);
    onToggleIndicator(indicator);
  };

  return (
    <div className="h-12 border-b border-white/10 flex items-center px-4 justify-between bg-[#0a0a0a]">
      <div className="flex items-center gap-4">
        
        {/* MODE SELECTOR (AI vs MANUAL) */}
        <div className="flex flex-col gap-0.5">
          <div className="flex bg-white/5 rounded-md p-0.5 border border-white/5 mr-1">
            <button 
               onClick={() => {
                 setAssetSelectionMode('AI');
                 toast.success("Modo AUTO ativado", { 
                   description: `Scanner operando em ${config?.activeAssets?.length || 20} ativos configurados` 
                 });
               }}
               className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${assetSelectionMode === 'AI' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
               title={`AI escolhe automaticamente entre ${config?.activeAssets?.length || 20} ativos configurados`}
            >
               <Cpu className="w-3 h-3" />
               AUTO
            </button>
            <button 
               onClick={() => {
                 setAssetSelectionMode('MANUAL');
                 toast.warning("Modo MANUAL ativado", { 
                   description: "⚠️ Operação limitada ao ativo selecionado. Use AUTO para múltiplos ativos." 
                 });
               }}
               className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${assetSelectionMode === 'MANUAL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
               title="⚠️ Opera apenas 1 ativo (o selecionado). Use AUTO para operar múltiplos ativos."
            >
               <MousePointer2 className="w-3 h-3" />
               MANUAL
            </button>
          </div>
        </div>

        {/* ASSET SELECTOR */}
        <div 
          onClick={() => {
              if (assetSelectionMode === 'AI') {
                 setAssetSelectionMode('MANUAL');
                 toast.info("Modo MANUAL ativado para seleção de ativo.");
              }
              onOpenAssetSelector();
          }}
          className={`flex items-center gap-2 p-1 px-2 rounded transition-all group border border-transparent cursor-pointer hover:bg-white/5 hover:border-white/10 select-none ${assetSelectionMode === 'AI' ? 'opacity-80' : ''}`}
        >
          {assetSelectionMode === 'AI' ? <Zap className="w-4 h-4 text-purple-500 animate-pulse" /> : <Search className="w-4 h-4 text-slate-500 group-hover:text-white" />}
          <span className="font-bold text-white tracking-wider">{formatSymbolDisplay(symbol)}</span>
          {assetSelectionMode === 'MANUAL' && <span className="text-xs text-slate-500 group-hover:text-slate-300">▼</span>}
        </div>

        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* TIMEFRAMES */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide max-w-[300px]">
          {TIMEFRAMES.map(tf => (
             <button 
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`text-xs font-medium px-2 py-1 rounded hover:bg-white/10 transition-colors whitespace-nowrap ${timeframe === tf ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400'}`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/10 mx-2" />

        <div className="flex items-center gap-2 relative">
           {/* MULTI-CHART TOGGLE */}
           {onToggleMultiChart && (
               <button 
                   onClick={onToggleMultiChart}
                   className={`p-1.5 rounded transition-colors ${isMultiChart ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                   title="Modo Multi-Timeframe (Split View)"
               >
                   <Layers className="w-4 h-4" />
               </button>
           )}

           <button className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white" title="Velas"><Activity className="w-4 h-4" /></button>
           
           {/* INDICATORS MENU */}
           <div className="relative" ref={indicatorsRef}>
               <button 
                   onClick={() => setIsIndicatorsOpen(!isIndicatorsOpen)}
                   className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded text-xs text-slate-400 hover:text-white"
               >
                  <Layers className="w-3 h-3" />
                  <span>Indicadores</span>
               </button>

               {isIndicatorsOpen && (
                   <div className="absolute left-0 top-full mt-2 w-72 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl z-50 p-2 space-y-1 max-h-[600px] overflow-y-auto">
                       <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-10">
                           <span>Indicadores Técnicos</span>
                           {activeIndicators.size > 0 && (
                             <span className="text-purple-400">{activeIndicators.size} ativos</span>
                           )}
                       </div>
                       
                       {/* Momentum Indicators */}
                       <div className="text-[9px] text-slate-600 uppercase font-bold px-2 py-1">Momentum</div>
                       
                       <button 
                           onClick={() => handleIndicatorToggle('RSI')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>RSI (Relative Strength Index)</span>
                           {activeIndicators.has('RSI') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('MACD')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>MACD</span>
                           {activeIndicators.has('MACD') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('Stochastic')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Stochastic</span>
                           {activeIndicators.has('Stochastic') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('CCI')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>CCI (Commodity Channel Index)</span>
                           {activeIndicators.has('CCI') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('MFI')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>MFI (Money Flow Index)</span>
                           {activeIndicators.has('MFI') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('ROC')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>ROC (Rate of Change)</span>
                           {activeIndicators.has('ROC') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       {/* Trend Indicators */}
                       <div className="text-[9px] text-slate-600 uppercase font-bold px-2 py-1 mt-2">Tendência</div>
                       
                       <button 
                           onClick={() => handleIndicatorToggle('MA')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>MA (Moving Average)</span>
                           {activeIndicators.has('MA') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>
                       
                       <button 
                           onClick={() => handleIndicatorToggle('EMA')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>EMA (Exponential MA)</span>
                           {activeIndicators.has('EMA') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('BOLL')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Bollinger Bands</span>
                           {activeIndicators.has('BOLL') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('SAR')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Parabolic SAR</span>
                           {activeIndicators.has('SAR') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('Ichimoku')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Ichimoku Cloud</span>
                           {activeIndicators.has('Ichimoku') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('ADX')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>ADX (Average Directional Index)</span>
                           {activeIndicators.has('ADX') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       {/* Volume Indicators */}
                       <div className="text-[9px] text-slate-600 uppercase font-bold px-2 py-1 mt-2">Volume</div>

                       <button 
                           onClick={() => handleIndicatorToggle('VOL')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Volume</span>
                           {activeIndicators.has('VOL') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('VWAP')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>VWAP</span>
                           {activeIndicators.has('VWAP') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('OBV')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>OBV (On Balance Volume)</span>
                           {activeIndicators.has('OBV') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('A/D')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Accumulation/Distribution</span>
                           {activeIndicators.has('A/D') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       {/* Volatility Indicators */}
                       <div className="text-[9px] text-slate-600 uppercase font-bold px-2 py-1 mt-2">Volatilidade</div>

                       <button 
                           onClick={() => handleIndicatorToggle('ATR')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>ATR (Average True Range)</span>
                           {activeIndicators.has('ATR') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('Keltner')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Keltner Channels</span>
                           {activeIndicators.has('Keltner') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('Donchian')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Donchian Channels</span>
                           {activeIndicators.has('Donchian') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       {/* Support/Resistance */}
                       <div className="text-[9px] text-slate-600 uppercase font-bold px-2 py-1 mt-2">Suporte/Resistência</div>

                       <button 
                           onClick={() => handleIndicatorToggle('Pivot')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Pivot Points</span>
                           {activeIndicators.has('Pivot') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>

                       <button 
                           onClick={() => handleIndicatorToggle('Fibonacci')}
                           className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
                       >
                           <span>Fibonacci Retracement</span>
                           {activeIndicators.has('Fibonacci') && (
                             <Check className="w-4 h-4 text-emerald-400" />
                           )}
                       </button>
                       
                       {activeIndicators.size > 0 && (
                         <>
                           <div className="border-t border-white/5 my-2" />
                           <button
                             onClick={() => {
                               activeIndicators.forEach(ind => onToggleIndicator(ind));
                               setActiveIndicators(new Set());
                               toast.info('Todos os indicadores removidos');
                             }}
                             className="w-full px-2 py-2 rounded hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 transition-colors font-bold"
                           >
                             Remover Todos ({activeIndicators.size})
                           </button>
                         </>
                       )}
                   </div>
               )}
           </div>

           {isLoading && (
              <div className="ml-2 w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
           )}
        </div>
      </div>

      <div className="flex items-center gap-3">
         {/* STATUS INDICATORS */}
         {aiStatus === 'running' && (
           <>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full animate-pulse mr-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">ONLINE</span>
              </div>
              <button 
                  onClick={onOpenEventCenter}
                  className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full hover:bg-purple-500/20 hover:scale-105 transition-all cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.3)]"
              >
                  <Zap className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">SCORE: ABRIR</span>
              </button>
           </>
         )}

         {/* TRADE BUTTON */}
         <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors">
           Negociar
         </button>

          <button
            onClick={() => {
                const elem = document.documentElement;
                if (!document.fullscreenElement) {
                    elem.requestFullscreen().catch(err => {
                        toast.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                    });
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                }
            }}
            className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            title="Tela Cheia"
          >
             <Maximize2 className="w-4 h-4" />
          </button>
         
         {/* SETTINGS DROPDOWN */}
         <div className="relative" ref={settingsRef}>
              <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`p-2 hover:bg-white/10 rounded transition-colors ${isSettingsOpen ? 'bg-white/10 text-white' : 'text-slate-400'}`}
              >
                  <Settings className="w-4 h-4" />
              </button>
              
              {isSettingsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl z-50 p-2 space-y-1">
                      <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">
                          Configurações
                      </div>
                      
                      <button 
                          onClick={() => setChartSettings(s => ({ ...s, crosshair: !s.crosshair }))}
                          className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300"
                      >
                          <span className="flex items-center gap-2">
                              <Crosshair className="w-3 h-3" /> Cruz (Crosshair)
                          </span>
                          <div className={`w-8 h-4 rounded-full relative transition-colors ${chartSettings.crosshair ? 'bg-blue-600' : 'bg-white/10'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${chartSettings.crosshair ? 'left-4.5' : 'left-0.5'}`} />
                          </div>
                      </button>

                      <button 
                          onClick={() => setChartSettings(s => ({ ...s, grid: !s.grid }))}
                          className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/5 text-xs text-slate-300"
                      >
                          <span className="flex items-center gap-2">
                              <Grid className="w-3 h-3" /> Grade (Grid)
                          </span>
                           <div className={`w-8 h-4 rounded-full relative transition-colors ${chartSettings.grid ? 'bg-blue-600' : 'bg-white/10'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${chartSettings.grid ? 'left-4.5' : 'left-0.5'}`} />
                          </div>
                      </button>
                  </div>
              )}
         </div>
      </div>
    </div>
  );
}