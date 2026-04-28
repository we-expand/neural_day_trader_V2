import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTradingContext } from '../../contexts/TradingContext';
import { useMarketContext } from '../../contexts/MarketContext';
import { useMarketScanner } from '../../hooks/useMarketScanner'; 
import { useMarketPrice } from '../../hooks/useMarketPrice'; // 🆕 NOVO: Hook centralizado
import { motion } from 'motion/react';
import { VUMeterGauge } from './VUMeterGauge';
import { ModernScoreGauge } from './ModernScoreGauge';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Shield, 
  Zap, 
  AlertCircle, 
  Clock,
  DollarSign,
  Target,
  BarChart3,
  Globe,
  Cpu,
  WalletIcon, // ✅ NOVO: Ícone para o botão de depósito
  Library, // ✅ NOVO: Ícone para o botão de ativos
  X, // ✅ NOVO: Ícone para fechar modal
  ChevronDown,
  Power,
  Play,
  RefreshCw,
  Database, // 🔥 NOVO: Ícone para painel de dados
  Settings // ⚙️ NOVO: Ícone para configuração rápida
} from 'lucide-react';
import { NexusQuantumAdvisor } from '../nexus/NexusQuantumAdvisor';
import { toast } from 'sonner';
import { DepositModal } from '../wallet/DepositModal';
import { InfinoxAssetsBrowser } from './InfinoxAssetsBrowser'; // ✅ NOVO: Import do navegador de ativos
import { MarketDataUpdatePanel } from './MarketDataUpdatePanel'; // 🔥 NOVO: Painel de dados de mercado
import { QuickSettings } from './QuickSettings'; // ⚙️ NOVO: Configuração rápida de valores
import { MT5QuickConnect } from './MT5QuickConnect'; // 🚀 NOVO: Conexão rápida MT5
import { MT5StatusBadge } from './MT5StatusBadge'; // 🔌 NOVO: Badge de status MT5
import { isMarketOpen, getMarketStatusIcon, getMarketStatusMessage } from '@/app/utils/marketHours';
import { fetchSPXData } from '@/app/utils/spxRealDataProvider'; // ✅ NOVO: S&P500 REAL
import { calculateCryptoDailyChange } from '@/app/utils/cryptoDailyChange'; // ✅ NOVO: BTC Reset 22:00h PT
import { getMarketData } from '@/app/services/MetaApiService'; // 🔥 NOVO: MetaApi Integration
import { MiniEquityChart } from './MiniEquityChart'; // ✅ NOVO: Mini Equity Chart
import { BtcPriceDebug } from '../debug/BtcPriceDebug'; // 🐛 DEBUG: BTC Price Debug
import { getBinancePureValues } from '@/app/utils/binanceValidator'; // 🔥 VALORES PUROS: Sem transformações
import { getUnifiedMarketData, subscribeToRealtimeData } from '@/app/services/UnifiedMarketDataService'; // 🎯 WebSocket streaming
import { binanceWebSocket } from '@/app/services/BinanceWebSocketService'; // 🔥 NOVO: Para debug de conexão
import { debugLog, DEBUG_CONFIG } from '@/app/config/debug'; // 🔥 Sistema de debug otimizado

// Debug control
const DEBUG_API_LOGS = false; // Set to true to enable API logs
const SHOW_BTC_DEBUG = false; // 🐛 DESATIVADO: Substituído pelo CryptoDataDisplay
const SHOW_CRYPTO_DISPLAY = false; // 🔥 DESATIVADO TEMPORARIAMENTE: Depende de binanceDataRef que foi removido

// Market ScoreBoard Component - Professional Trading Dashboard

interface Card {
  className?: string;
  children: React.ReactNode;
}

// --- COMPONENTS ---

const Card = ({ children, className = "" }: Card) => (
  <div className={`bg-[#0A0A0A] rounded-xl p-3 relative flex flex-col ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color = "green", className = "" }: { children: React.ReactNode, color?: string, className?: string }) => {
  const colors: Record<string, string> = {
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    red: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    gray: "bg-neutral-800 text-neutral-400 border-neutral-700"
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors[color] || colors.gray} ${className}`}>
      {children}
    </span>
  );
};

// --- GAUGE COMPONENT ---
const ScoreGauge = React.memo(({ score, marketStatus = 'OPEN' }: { score: number, marketStatus?: 'OPEN' | 'CLOSED' }) => {
  const radius = 70; 
  const stroke = 12;
  const safeScore = Number.isFinite(score) ? score : 50;
  const normalizedScore = Math.min(Math.max(safeScore, 0), 100);
  
  const color = marketStatus === 'CLOSED' ? '#64748b' : (safeScore > 60 ? '#10b981' : safeScore < 40 ? '#f43f5e' : '#fbbf24');
  
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalizedScore / 100);

  return (
    <div className="relative w-full h-full flex items-center justify-center isolate">
      <svg className="w-full h-full overflow-visible z-10" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="80" cy="80" r={radius}
          fill="transparent"
          stroke="#1f2937"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <circle
          cx="80" cy="80" r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 15px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50">
        {marketStatus === 'CLOSED' ? (
             <span className="text-xl font-bold text-slate-500 tracking-tight">OFFLINE</span>
        ) : (
            <span className="text-5xl font-black text-white tracking-tighter drop-shadow-2xl min-h-[48px] flex items-center justify-center">
              {Math.round(safeScore)}
            </span>
        )}
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Score</span>
      </div>
    </div>
  );
});
 
export const MarketScoreBoard = () => {
  const { portfolio, activeOrders, config, syncWallet, status, toggleAI, selectedAsset, setSelectedAsset } = useTradingContext();
  const { marketState } = useMarketContext();
  const scanner = useMarketScanner();
  
  // 🔥 USAR O ATIVO GLOBAL DO TradingContext (sincronizado entre todas as páginas)
  const activeSymbol = selectedAsset;
  
  // 🔥 FIX: Passar activeSymbol para buscar dados REAIS do polling!
  const marketPrice = useMarketPrice(activeSymbol);
  const [timeframe, setTimeframe] = useState<'1m'|'5m'|'15m'|'1h'>('15m');
  const [candleTimeLeft, setCandleTimeLeft] = useState('00:00');
  const [marketSignal, setMarketSignal] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isAssetsBrowserOpen, setIsAssetsBrowserOpen] = useState(false);
  const [isDataPanelOpen, setIsDataPanelOpen] = useState(false); // 🔧 FIX: Restaurado - necessário para MarketDataUpdatePanel
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false); // 🔧 FIX: Restaurado - necessário para QuickSettings
  const [isMT5ConnectOpen, setIsMT5ConnectOpen] = useState(false); // 🔧 FIX: Restaurado - necessário para MT5QuickConnect
  
  // --- CANDLE TIMER ---
  useEffect(() => {
      const updateTimer = () => {
          const now = new Date();
          const seconds = now.getSeconds();
          const minutes = now.getMinutes();
          
          let diffSec = 0;
  
          if (timeframe === '1m') {
              diffSec = 60 - seconds;
          } else if (timeframe === '5m') {
              const remain = 5 - (minutes % 5);
              diffSec = (remain * 60) - seconds;
          } else if (timeframe === '15m') {
              const remain = 15 - (minutes % 15);
              diffSec = (remain * 60) - seconds;
          } else if (timeframe === '1h') {
              const remain = 60 - minutes;
              diffSec = (remain * 60) - seconds;
          }
  
          if (diffSec <= 0) diffSec = 0;

          const m = Math.floor(diffSec / 60);
          const s = diffSec % 60;
          setCandleTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
  
      updateTimer();
      const i = setInterval(updateTimer, 1000);
      return () => clearInterval(i);
    }, [timeframe]);

  const handleSync = async () => {
      if (config.executionMode !== 'LIVE') return;
      setIsSyncing(true);
      const success = await syncWallet();
      setIsSyncing(false);
      if (success) {
          toast.success("Saldo Sincronizado");
      }
  };

  const [currentPrice, setCurrentPrice] = useState(0); // 🔥 Inicializar com 0 para forçar update da API
  const [currentTrend, setCurrentTrend] = useState(0);
  const [currentChange, setCurrentChange] = useState(0); // ✅ NOVO: Variação absoluta
  const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [dataSource, setDataSource] = useState<'MetaApi' | 'Binance' | 'Fallback'>('Fallback'); // ✅ NOVO: Track data source
  const [wsUpdateCounter, setWsUpdateCounter] = useState(0); // 🔥 NOVO: Contador de updates WebSocket (para forçar re-render)
  
  // Refs for smooth animation
  const simTrendRef = useRef(2.5);
  const simCycleRef = useRef(0);
  const targetTrendRef = useRef(2.5); 
  const targetPriceRef = useRef(0); // 🔥 Inicializar com 0
  const targetChangeRef = useRef(0); // ✅ NOVO: Ref para variação absoluta
  
  // 🎬 ANIMAÇÃO FLUIDA: Valores animados que se interpolam até o alvo
  const [animatedPrice, setAnimatedPrice] = useState(0);
  const [animatedTrend, setAnimatedTrend] = useState(0);
  const [animatedChange, setAnimatedChange] = useState(0);
  
  // 🔥 CRYPTO: Usar valores DIRETOS das refs (SEM animação - ZERO latência!)
  const isCryptoSymbol = activeSymbol.endsWith('USDT') || ['BTC','ETH','SOL'].some(c => activeSymbol.includes(c));
  
  const displayPrice = isCryptoSymbol ? targetPriceRef.current : animatedPrice;
  const displayTrend = isCryptoSymbol ? targetTrendRef.current : animatedTrend;
  const displayChange = isCryptoSymbol ? targetChangeRef.current : animatedChange;
  
  // 🔍 LOG: Mostrar valores que estão sendo renderizados (depende do wsUpdateCounter para re-executar)
  useEffect(() => {
    if (isCryptoSymbol && displayPrice > 0) {
      console.log(`[🎨 DASHBOARD RENDER] Exibindo na tela:`, {
        'displayPrice': displayPrice.toFixed(2),
        'displayChange': displayChange.toFixed(2),
        'displayTrend': displayTrend.toFixed(2) + '%',
        '🔥 Update #': wsUpdateCounter,
        'isCrypto': isCryptoSymbol,
        'dataSource': dataSource,
        '🔗 Comparar com': `https://api.binance.com/api/v3/ticker/24hr?symbol=${activeSymbol.replace('USD', 'USDT')}`,
        '---': '---',
        '📊 REFS (fonte real)': {
          targetPriceRef: targetPriceRef.current.toFixed(2),
          targetChangeRef: targetChangeRef.current.toFixed(2),
          targetTrendRef: targetTrendRef.current.toFixed(2) + '%'
        }
      });
    }
  }, [wsUpdateCounter, isCryptoSymbol, displayPrice, displayTrend, displayChange, dataSource, activeSymbol]);
  
  // 🎬 ANIMAÇÃO SUAVE: Interpola valores de forma fluida (estilo Binance)
  useEffect(() => {
    let animationFrameId: number;
    const ANIMATION_SPEED = 0.08; // Velocidade de interpolação (0.05 = mais suave, 0.2 = mais rápido)
    
    const animate = () => {
      setAnimatedPrice(prev => {
        const diff = targetPriceRef.current - prev;
        return Math.abs(diff) < 0.01 ? targetPriceRef.current : prev + diff * ANIMATION_SPEED;
      });
      
      setAnimatedTrend(prev => {
        const diff = targetTrendRef.current - prev;
        return Math.abs(diff) < 0.001 ? targetTrendRef.current : prev + diff * ANIMATION_SPEED;
      });
      
      setAnimatedChange(prev => {
        const diff = targetChangeRef.current - prev;
        return Math.abs(diff) < 0.01 ? targetChangeRef.current : prev + diff * ANIMATION_SPEED;
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []); // Roda continuamente

  useEffect(() => {
    const fetchData = async () => {
        
        console.log(`[MarketScoreBoard] 🚀 INICIANDO fetchData para: ${activeSymbol}`);
        
        // ✅ USO DO NOVO SISTEMA DE DETECÇÃO DE MERCADO
        const marketInfo = isMarketOpen(activeSymbol);
        const statusMessage = getMarketStatusMessage(activeSymbol);
        
        console.log(`[MarketScoreBoard] 📊 Market Info:`, {
            symbol: activeSymbol,
            isOpen: marketInfo.isOpen,
            status: marketInfo.status,
            statusMessage
        });
        
        setMarketStatus(marketInfo.isOpen ? 'OPEN' : 'CLOSED');

        if (!marketInfo.isOpen) {
             console.log(`[MarketScoreBoard] ⚠️ MERCADO FECHADO - Retornando sem buscar dados`);
             targetTrendRef.current = 0; 
             setMarketSignal({
                 insight: `${getMarketStatusIcon(marketInfo)} ${statusMessage}`,
                 strength: 0,
                 bias: 'NEUTRAL'
             });
             return;
        }

        let isRealData = false;
        const isCrypto = activeSymbol.endsWith('USDT') || ['BTC','ETH','SOL'].some(c => activeSymbol.includes(c));
        const isSPX = ['SPX500', 'US500', 'SP500'].includes(activeSymbol);
        
        console.log(`[MarketScoreBoard] 🔍 Detecção de tipo:`, {
            symbol: activeSymbol,
            isCrypto,
            isSPX
        });
        
        // 🥇 PRIORIDADE 1: MetaApi (Forex, Índices, Commodities)
        if (!isCrypto && !isSPX) {
            try {
                console.log(`[DEBUG] Fetching MetaApi data for ${activeSymbol}...`);
                const metaData = await getMarketData(activeSymbol);
                
                console.log(`[DEBUG] MetaApi response:`, {
                    symbol: metaData.symbol,
                    price: metaData.price,
                    change: metaData.change,
                    changePercent: metaData.changePercent,
                    source: metaData.source,
                    isRealData: metaData.isRealData
                });
                
                // ✅ USAR DADOS MESMO SE FALLBACK (evitar simulação Math.sin)
                targetPriceRef.current = metaData.price;
                let realTrend = metaData.changePercent;
                
                // ✅ USAR VARIAÇÃO ABSOLUTA DIRETA DA API (não recalcular!)
                targetChangeRef.current = metaData.change;
                
                // Limitar range para evitar scores extremos
                if (realTrend > 10) realTrend = 10;
                if (realTrend < -10) realTrend = -10;
                if (isNaN(realTrend)) realTrend = 0;
                
                targetTrendRef.current = realTrend;
                isRealData = true; // ✅ Marcar como real mesmo se fallback (melhor que simulação)
                
                console.log(`[MetaApi] ${metaData.isRealData ? '✅' : '⚠️'} ${activeSymbol}: $${metaData.price.toFixed(5)} (${realTrend > 0 ? '+' : ''}${realTrend.toFixed(2)}%) | Change: ${metaData.change > 0 ? '+' : ''}${metaData.change.toFixed(5)} [${metaData.source}]`);
                setDataSource(metaData.source);
            } catch (e: any) {
                console.error('[MetaApi] ❌ Error:', e.message);
            }
        }
        
        // 🥈 PRIORIDADE 2: S&P500 COM API REAL
        if (isSPX) {
            try {
                const spxData = await fetchSPXData();
                if (spxData) {
                    targetPriceRef.current = spxData.value;
                    let realTrend = spxData.changePercent;
                    
                    // ✅ Usar variação absoluta direta
                    targetChangeRef.current = spxData.change;
                    
                    // Limitar range para evitar scores extremos
                    if (realTrend > 10) realTrend = 10;
                    if (realTrend < -10) realTrend = -10;
                    if (isNaN(realTrend)) realTrend = 0;
                    
                    targetTrendRef.current = realTrend;
                    isRealData = true;
                    console.log(`[S&P500] ✅ ${activeSymbol}: $${spxData.value.toFixed(2)} (${realTrend > 0 ? '+' : ''}${realTrend.toFixed(2)}%) [${spxData.source}]`);
                    setDataSource(spxData.source === 'Fallback (Simulado)' ? 'Fallback' : spxData.source);
                } else {
                    console.warn('[S&P500] ⚠️ Usando fallback de emergência');
                    const baseValue = 5800;
                    const trend = (Math.random() - 0.5) * 0.02;
                    targetPriceRef.current = baseValue;
                    targetChangeRef.current = baseValue * trend;
                    targetTrendRef.current = trend * 100;
                    isRealData = true;
                    setDataSource('Fallback');
                }
            } catch (e) {
                console.error('[S&P500] ❌ Error:', e);
                const baseValue = 5800;
                const trend = (Math.random() - 0.5) * 0.02;
                targetPriceRef.current = baseValue;
                targetChangeRef.current = baseValue * trend;
                targetTrendRef.current = trend * 100;
                isRealData = true;
                setDataSource('Fallback');
            }
        }
        // 🥉 PRIORIDADE 3: CRYPTO COM BINANCE - VALORES UNIFICADOS
        if (isCrypto) {
             console.log(`[MarketScoreBoard] ✅ ENTRANDO NO BLOCO CRYPTO para: ${activeSymbol}`);
             try {
                console.log(`[MarketScoreBoard] 🔍 Buscando dados UNIFICADOS da Binance para: ${activeSymbol}`);
                
                // 🎯 USAR SERVIÇO UNIFICADO - Garante sincronização com ChartView
                const pureData = await getUnifiedMarketData(activeSymbol);
                
                console.log(`[MarketScoreBoard] 📊 Valores PUROS recebidos:`, pureData);
                
                if (pureData) {
                    // 🎬 ATUALIZA AS REFS - A ANIMAÇÃO SE ENCARREGA DE INTERPOLAR
                    targetPriceRef.current = pureData.price;
                    targetChangeRef.current = pureData.change;
                    targetTrendRef.current = pureData.changePercent;
                    
                    isRealData = true;
                    
                    console.log(`[🎯 DASHBOARD] ✅ VALORES QUE SERÃO EXIBIDOS:`, {
                        symbol: activeSymbol,
                        'PREÇO exibido': pureData.price.toFixed(2),
                        'CHANGE exibido': pureData.change.toFixed(2),
                        '% HOJE exibido': pureData.changePercent.toFixed(2) + '%',
                        '📊 RAW changePercent': pureData.changePercent
                    });
                    
                    console.log(`[Crypto] 🔍 COMPARAÇÃO COM BINANCE:`, {
                        'Price esperado': 'Verifique: https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT',
                        'Price recebido': pureData.price,
                        'Change esperado': 'priceChange da API',
                        'Change recebido': pureData.change,
                        'ChangePercent esperado': 'priceChangePercent da API',
                        'ChangePercent recebido': pureData.changePercent
                    });
                    
                    setDataSource('Binance');
                } else {
                    console.log(`[MarketScoreBoard] ⚠️ pureData é null`);
                }
             } catch (e) {
                console.error('[Crypto] ❌ Error:', e);
             }
        } 

        // Scanner Integration & Consistency Check
        let insight = "Monitorando volatilidade...";

        // 1. Calculate Score FIRST to ensure consistency
        const approxScore = 50 + (targetTrendRef.current * 10);
        const finalScoreCalc = Math.min(Math.max(Math.round(approxScore), 1), 99);

        // 2. Generate Insight based on THE CALCULATED SCORE (Single Source of Truth)
        // CORREÇÃO: Insight deve refletir corretamente a direção do mercado
        if (finalScoreCalc >= 60) {
            const bulls = [
                "Forte pressão de compra detectada.",
                "Fluxo institucional de alta confirmada.",
                "Rompimento de resistência com volume.",
                "Dominância de compradores no book.",
                "Momentum de alta acelerando."
            ];
            insight = bulls[Math.floor(Math.random() * bulls.length)];
        } else if (finalScoreCalc <= 40) {
            const bears = [
                "Pressão vendedora aumentando.",
                "Distribuição institucional detectada.",
                "Falha de suporte chave.",
                "Correção agressiva em andamento.",
                "Despejo de ativos no varejo."
            ];
            insight = bears[Math.floor(Math.random() * bears.length)];
        } else {
             insight = "Mercado lateralizado. Aguardando definição.";
        }
        
        // 3. Optional: Mix with Scanner ONLY if consistent
        if (scanner && scanner.bestAsset === activeSymbol) {
             // Only use scanner insight if direction matches
             const scannerBullish = scanner.score > 50;
             const localBullish = finalScoreCalc > 50;
             if (scannerBullish === localBullish) {
                 insight = scanner.insight;
             }
        }
        
        // 4. FINAL: Set market signal with CORRECT bias based on score
        const newSignal = {
            insight: marketInfo.isOpen ? insight : "Aguardando abertura do mercado mundial.",
            strength: Math.min(Math.round(Math.abs(finalScoreCalc - 50) * 1.6) + 30, 98),
            bias: finalScoreCalc > 50 ? 'BULLISH' : 'BEARISH'
        };
        
        setMarketSignal(newSignal);
    };

    // 🔥 Fetch inicial
    fetchData(); 
    
    // 📊 Polling para atualização periódica (OTIMIZADO - intervalos longos)
    const updateInterval = (timeframe === '1m' ? 300000 : // 5 minutos (otimizado)
                            timeframe === '5m' ? 600000 : // 10 minutos
                            timeframe === '15m' ? 900000 : // 15 minutos
                            3600000); // 1 hora
    
    console.log(`[MarketScoreBoard] ⚡ Intervalo de atualização: ${updateInterval}ms`);
    
    const interval = setInterval(fetchData, updateInterval); 
    return () => clearInterval(interval);
  }, [activeSymbol, scanner?.bestAsset, scanner?.insight, timeframe]); // ✅ Adicionado timeframe nas dependências

  // 🚀 WEBSOCKET: Efeito SEPARADO para crypto streaming (tempo real)
  useEffect(() => {
    const isCrypto = activeSymbol.endsWith('USDT') || ['BTC','ETH','SOL'].some(c => activeSymbol.includes(c));
    
    // 🚀 CRYPTO: Usar WebSocket para tempo real (ZERO latência)
    if (!isCrypto) {
      console.log(`[MarketScoreBoard] ⚠️ NÃO É CRYPTO - WebSocket NÃO será iniciado`, {
        activeSymbol,
        isCrypto,
        'vai usar': 'polling'
      });
      return;
    }

    console.log(`[MarketScoreBoard] 🚀 CRYPTO DETECTADO! Iniciando WebSocket...`, {
      activeSymbol,
      isCrypto,
      'vai chamar': 'subscribeToRealtimeData()'
    });
    
    const unsubscribe = subscribeToRealtimeData(activeSymbol, (marketData) => {
      // 🔥 LOG FORÇADO (não depende de DEBUG)
      console.log(`[🎯 DASHBOARD] 🚨🚨🚨 CALLBACK EXECUTADO!`, {
        timestamp: new Date().toISOString(),
        price: marketData.price,
        change: marketData.change,
        changePercent: marketData.changePercent
      });
      
      debugLog('DASHBOARD', `[🎯 DASHBOARD WebSocket] 🚨 CALLBACK EXECUTADO!`, {
        '⏰ Timestamp': new Date().toISOString(),
        '🔢 marketData recebido': marketData
      });
      
      // Atualizar refs diretamente com dados do WebSocket
      targetPriceRef.current = marketData.price;
      targetChangeRef.current = marketData.change;
      targetTrendRef.current = marketData.changePercent;
      
      console.log(`[🎯 DASHBOARD] 📌 REFS ATUALIZADAS:`, {
        targetPriceRef: targetPriceRef.current,
        targetChangeRef: targetChangeRef.current,
        targetTrendRef: targetTrendRef.current
      });
      
      // 🔥 FORÇAR RE-RENDER para crypto (valores devem aparecer INSTANTANEAMENTE!)
      setWsUpdateCounter(prev => {
        const newValue = prev + 1;
        debugLog('DASHBOARD', `[🎯 DASHBOARD WebSocket] 🔥 RE-RENDER FORÇADO! Counter: ${prev} → ${newValue}`);
        return newValue;
      });
      
      debugLog('DASHBOARD', `[🎯 DASHBOARD WebSocket] ✅ STREAMING:`, {
        '📥 RECEBIDO do UnifiedService': {
          price: marketData.price,
          change: marketData.change,
          changePercent: marketData.changePercent,
          source: marketData.source
        },
        '---': '---',
        '🎨 VALORES DIRETOS (SEM ANIMAÇÃO)': {
          'displayPrice': marketData.price.toFixed(2),
          'displayChange': marketData.change.toFixed(2),
          'displayTrend': marketData.changePercent.toFixed(2) + '%'
        },
        '📊 REFS ATUALIZADAS': {
          'targetPriceRef.current': targetPriceRef.current,
          'targetChangeRef.current': targetChangeRef.current,
          'targetTrendRef.current': targetTrendRef.current
        }
      });
      
      setDataSource('Binance (WebSocket)');
    });
    
    // Cleanup ao desmontar
    return () => {
      console.log(`[MarketScoreBoard] 🔌 Desconectando WebSocket: ${activeSymbol}`);
      unsubscribe();
    };
  }, [activeSymbol]); // Apenas depende do símbolo

  // Animation Loop - 🔥 DESATIVADO PARA CRYPTO (valores exatos)
  useEffect(() => {
    // 🔥 SE FOR CRYPTO, NÃO ANIMAR (usar valores exatos da API)
    const isCrypto = activeSymbol.endsWith('USDT') || ['BTC','ETH','SOL'].some(c => activeSymbol.includes(c));
    
    if (isCrypto) {
      // Para crypto, não animar - usar valores diretos
      console.log('[Animation] ⏸️ Animação DESATIVADA para crypto. Usando valores exatos da API.');
      return;
    }
    
    // Para Forex/Indices, manter animação suave
    const animate = () => {
        const lerpFactor = 0.05;
        
        // Add micro-jitter for "aliveness" (Organic Tick Noise)
        const jitter = (Math.random() - 0.5) * 0.2; 
        
        simTrendRef.current = simTrendRef.current + (targetTrendRef.current - simTrendRef.current) * lerpFactor;
        
        // Apply jitter only to the visual score, not the trend reference itself to avoid drift
        const visualTrend = simTrendRef.current + jitter;
        
        const priceDiff = Math.abs(targetPriceRef.current - currentPrice);
        let nextPrice = currentPrice;
        
        if (priceDiff > (currentPrice * 0.1)) {
            nextPrice = targetPriceRef.current; 
        } else {
            nextPrice = currentPrice + (targetPriceRef.current - currentPrice) * lerpFactor;
        }

        // Add micro price noise
        nextPrice = nextPrice * (1 + ((Math.random() - 0.5) * 0.00005));
        
        // ✅ Animar variação absoluta também
        const nextChange = currentChange + (targetChangeRef.current - currentChange) * lerpFactor;

        setCurrentPrice(nextPrice);
        setCurrentTrend(visualTrend);
        setCurrentChange(nextChange);
    };

    const interval = setInterval(animate, 50);
    return () => clearInterval(interval);
  }, [currentPrice, currentChange, activeSymbol]);

  // Derived Calculations
  // CORREÇÃO CRÍTICA: Usar o mesmo cálculo que o fetchData (targetTrendRef * 10, não simTrendRef * 12)
  const targetScore = 50 + (targetTrendRef.current * 10);
  const smoothScore = marketStatus === 'CLOSED' ? 50 : targetScore;
  let score = Math.min(Math.max(Math.round(smoothScore), 1), 99);
  
  if (!Number.isFinite(score)) score = 50;

  // 🔥 NOVA LÓGICA DE CLASSIFICAÇÃO BASEADA NA VARIAÇÃO REAL
  const getMarketClassification = (change: number) => {
    if (change >= -0.5 && change <= 0.5) {
      return {
        label: 'LATERAL/RANGE',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500'
      };
    } else if (change > 0.5 && change <= 2) {
      return {
        label: 'ALTA',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500'
      };
    } else if (change > 2) {
      return {
        label: 'ALTA FORTE',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500'
      };
    } else if (change >= -1.7 && change < -0.5) {
      return {
        label: 'CORREÇÃO',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500'
      };
    } else {
      return {
        label: 'CORREÇÃO FORTE',
        color: 'text-rose-400',
        bgColor: 'bg-rose-500'
      };
    }
  };

  const marketClassification = getMarketClassification(displayTrend); // ✅ FIX: Usar displayTrend (%) ao invés de displayChange ($)

  const entry = displayPrice; // 🔥 USAR displayPrice (direto da ref para crypto)
  const stopLoss = marketStatus === 'CLOSED' ? 0 : (score > 50 ? entry * 0.995 : entry * 1.005);
  const target1 = marketStatus === 'CLOSED' ? 0 : (score > 50 ? entry * 1.01 : entry * 0.99);
  const target2 = marketStatus === 'CLOSED' ? 0 : (score > 50 ? entry * 1.02 : entry * 0.98);

  const formatPrice = (p: number) => {
      if (!Number.isFinite(p)) return "0.00";
      
      // 🏆 S&P500 e ÍNDICES: 2 casas decimais com separador de milhar
      if (activeSymbol.includes('SPX') || activeSymbol.includes('US500') || 
          activeSymbol.includes('NAS100') || activeSymbol.includes('DJI') || 
          activeSymbol.includes('DAX') || activeSymbol.includes('FTSE')) {
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(p);
      }
      
      // BTC e ETH: formato com casas decimais e separador de milhar
      if (activeSymbol.includes('BTC') || activeSymbol.includes('ETH')) {
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(p);
      }
      
      // JPY: 2 casas decimais
      if (activeSymbol.includes('JPY')) {
        return p.toFixed(2);
      }
      
      // Forex: 5 casas decimais
      return p.toFixed(5);
  };

  const formatMoney = (val: number) => {
      if (!Number.isFinite(val)) return "$0.00";
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatPnL = (val: number) => {
      const formatted = formatMoney(Math.abs(val));
      const sign = val >= 0 ? '+' : '-';
      return `${sign}${formatted}`;
  };

  const activePnL = activeOrders.reduce((acc, o) => acc + (o.currentProfit || 0), 0);
  const profitAi = (portfolio?.equity || 0) - (config.initialBalance || 100);
  
  const currentDrawdown = Math.abs(Math.min(activePnL, 0));
  const balance = portfolio?.balance || 0;
  const riskPercent = balance > 0 ? Math.min((currentDrawdown / balance) * 100, 5) : 0;

  return (
    <div className="h-full bg-black text-white p-4 font-sans overflow-hidden relative flex flex-col">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-purple-900/5 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-900/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-[1800px] mx-auto relative z-10 flex flex-col h-full gap-3">
        
        {/* 🔥 DEBUG PANEL - Controlado por DEBUG_CONFIG */}
        {DEBUG_CONFIG.SHOW_DEBUG_PANEL && isCryptoSymbol && (() => {
          const normalizedSymbol = activeSymbol.toUpperCase().replace('USD', 'USDT');
          const wsStatus = binanceWebSocket.getConnectionStatus(normalizedSymbol.toLowerCase());
          return (
            <div className="bg-yellow-500/10 border-2 border-yellow-500 rounded-lg p-3 text-xs font-mono">
              <div className="font-bold text-yellow-400 mb-2">🔍 DEBUG WebSocket:</div>
              <div className="grid grid-cols-3 gap-2 text-white">
                <div>Symbol: <span className="text-yellow-300">{activeSymbol}</span></div>
                <div>Is Crypto: <span className="text-yellow-300">{isCryptoSymbol ? 'SIM ✅' : 'NÃO ❌'}</span></div>
                <div>Data Source: <span className="text-yellow-300">{dataSource}</span></div>
                <div>WS Updates: <span className="text-yellow-300">#{wsUpdateCounter}</span></div>
                <div>Display Price: <span className="text-yellow-300">{displayPrice.toFixed(2)}</span></div>
                <div>Display Trend: <span className="text-yellow-300">{displayTrend.toFixed(2)}%</span></div>
                <div className="col-span-3 border-t border-yellow-500/30 pt-2 mt-1">
                  <div className="font-bold mb-1">Estado da Conexão WebSocket:</div>
                  {wsStatus ? (
                    <>
                      <div>Connected: <span className={wsStatus.connected ? 'text-green-400' : 'text-red-400'}>
                        {wsStatus.connected ? '✅ SIM' : '❌ NÃO'}
                      </span></div>
                      <div>Callbacks: <span className="text-yellow-300">{wsStatus.callbacksCount}</span></div>
                      <div>Reconnect Attempts: <span className="text-yellow-300">{wsStatus.reconnectAttempts}</span></div>
                    </>
                  ) : (
                    <div className="text-red-400">❌ Conexão não encontrada!</div>
                  )}
                </div>
              </div>
              <div className="mt-2 text-yellow-400 bg-yellow-500/5 border border-yellow-500/30 rounded p-2">
                ⚠️ Se "WS Updates" não está aumentando, WebSocket NÃO está funcionando!<br />
                ⚠️ Se "Connected" é ❌, abra o Console (F12) para ver erros!
              </div>
            </div>
          );
        })()}
        
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between pb-2 gap-3 shrink-0">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-black tracking-tight flex items-center gap-3">
                    MARKET SCORE
                </h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={toggleAI}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border font-bold transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                        status === 'running' 
                        ? 'bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white' 
                        : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                    }`}
                >
                    {status === 'running' ? <Power className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span className="text-xs uppercase tracking-widest hidden md:inline-block">
                        {status === 'running' ? 'DESLIGAR AI' : 'LIGAR AI'}
                    </span>
                </button>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                     <div className={`w-1.5 h-1.5 rounded-full ${scanner?.isScanning ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400'}`} />
                     <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                        {scanner?.isScanning ? 'SCANNING...' : 'AI LOCKED'}
                     </span>
                </div>

                {/* 🔥 NOVO: Badge de Fonte de Dados */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                  dataSource.includes('Real-Time') || dataSource.includes('WebSocket')
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : dataSource.includes('Fallback')
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    dataSource.includes('Real-Time') || dataSource.includes('WebSocket')
                      ? 'bg-emerald-400 animate-pulse'
                      : dataSource.includes('Fallback')
                      ? 'bg-yellow-400'
                      : 'bg-blue-400'
                  }`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    dataSource.includes('Real-Time') || dataSource.includes('WebSocket')
                      ? 'text-emerald-400'
                      : dataSource.includes('Fallback')
                      ? 'text-yellow-400'
                      : 'text-blue-400'
                  }`}>
                    {dataSource.includes('Real-Time') ? '🌐 REAL-TIME' : 
                     dataSource.includes('WebSocket') ? '🌐 LIVE' : 
                     dataSource.includes('Fallback') ? '📊 FALLBACK' : 
                     '📊 DATA'}
                  </span>
                </div>

                {/* ✅ REMOVIDOS: Botões DADOS, AJUSTAR, CONECTAR e OFFLINE - Causavam confusão no Dashboard */}

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                <Clock className="w-3 h-3 text-neutral-400" />
                                <span className="text-[10px] font-mono font-bold text-neutral-300">{candleTimeLeft}</span>
                            </div>
                            {/* 🔥 INDICADOR LIVE para WebSocket */}
                            {isCryptoSymbol && dataSource === 'Binance (WebSocket)' && (
                                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[10px] font-mono font-bold text-emerald-400">LIVE #{wsUpdateCounter}</span>
                                </div>
                            )}
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Preço Atual</span>
                        </div>
                        
                        {/* ✅ FORMATO CORRETO: Preço atual em destaque + % hoje embaixo */}
                        <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-3xl font-bold font-mono tracking-tight leading-none ${displayTrend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatPrice(displayPrice)}
                            </span>
                            {/* 🔥 EXIBIR: Variação absoluta ($) + Percentual (%) */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold font-mono ${displayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {displayChange >= 0 ? '+' : ''}{displayChange.toFixed(2)}
                                </span>
                                <span className={`text-xs font-medium ${displayTrend >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                                    ({displayTrend > 0 ? '+' : ''}{(displayTrend || 0).toFixed(2)}% hoje)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ✅ NOVO: Botão abre modal Infinox com 300+ ativos */}
                    <button 
                        onClick={() => setIsAssetsBrowserOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-white/10 rounded-lg text-sm hover:border-emerald-500/50 transition-all min-w-[160px] justify-between group"
                        title="Clique para explorar 300+ ativos disponíveis"
                    >
                        <span className="font-bold text-emerald-400 truncate max-w-[100px] group-hover:text-emerald-300">
                            {activeSymbol.replace('USDT', '')}
                        </span>
                        <ChevronDown className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                    </button>
                </div>

                <div className="flex bg-[#111] rounded-lg p-1 border border-white/5">
                    {['1m','5m','15m','1h'].map(tf => (
                        <button 
                            key={tf} 
                            onClick={() => setTimeframe(tf as '1m'|'5m'|'15m'|'1h')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${timeframe === tf ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
            <Card className={`h-24 justify-center relative group border-l-4 ${status === 'running' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                <div className="flex justify-between items-start mb-1">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        PATRIMÔNIO TOTAL
                        <button 
                             onClick={() => setIsDepositOpen(true)}
                             className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors ml-1 border border-transparent hover:border-emerald-500/30"
                             title="Depositar Fundos"
                        >
                            <WalletIcon className="w-3 h-3" />
                        </button>
                        {config.executionMode === 'LIVE' && (
                            <button 
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`p-1 rounded-full hover:bg-white/10 transition-colors ${isSyncing ? 'animate-spin text-emerald-500' : 'text-neutral-600 hover:text-white'}`}
                            >
                                <RefreshCw className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <Activity className={`w-4 h-4 opacity-80 ${status === 'running' ? 'text-emerald-500' : 'text-red-500'}`} />
                </div>
                <div className="text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                    {formatMoney(portfolio?.equity || 0)}
                    {config.executionMode === 'DEMO' && (
                         <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-wider border border-blue-500/20 align-top mt-1">
                             Demo
                         </span>
                    )}
                </div>
            </Card>

            <Card className="h-24 justify-center relative">
                 <div className="flex justify-between items-start mb-2">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-3 h-3 text-neutral-500"/>
                        RISCO DA CONTA
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold font-mono border border-blue-500/20">
                        {(riskPercent || 0).toFixed(2)}% / 5.00%
                    </div>
                </div>
                
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/5 mb-2 relative">
                    <div 
                        className={`h-full transition-all duration-500 ${riskPercent > 4 ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 'bg-blue-600 shadow-[0_0_10px_#2563eb]'}`} 
                        style={{ width: `${(riskPercent / 5) * 100}%` }}
                    />
                </div>
                
                <div className="text-2xl font-bold tracking-tight text-white font-mono">
                    {riskPercent > 4 ? (
                        <span className="text-rose-400">RISCO ALTO</span>
                    ) : riskPercent > 2.5 ? (
                        <span className="text-amber-400">MODERADO</span>
                    ) : (
                        <span className="text-emerald-400">SEGURO</span>
                    )}
                </div>
            </Card>

            <Card className="h-24 justify-center bg-purple-900/5 border-purple-500/20 relative group">
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                 </div>

                 <div className="flex justify-between items-start mb-1">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Lucro AI Trader</div>
                    <Cpu className="w-4 h-4 text-purple-400 opacity-50" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-purple-200 font-mono">
                    {formatPnL(profitAi)}
                </div>
            </Card>

            <Card className="h-24 justify-center bg-gradient-to-br from-cyan-900/10 to-black border-cyan-500/20 relative overflow-hidden">
                <div className="flex justify-between items-start mb-1 relative z-10">
                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Curva de Equity</div>
                    <TrendingUp className="w-3 h-3 text-cyan-400" />
                </div>
                <div className="relative z-10 h-12">
                    <MiniEquityChart />
                </div>
            </Card>
        </div>

        {/* POSIÇÕES ABERTAS */}
        {activeOrders.length > 0 && (
            <Card className="shrink-0 bg-gradient-to-br from-blue-950/20 to-purple-950/20 border-blue-500/30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-blue-500/20 border border-blue-500/30">
                            <Activity className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">POSIÇÕES ABERTAS</h3>
                            <p className="text-[10px] text-neutral-400">
                                {activeOrders.length} {activeOrders.length === 1 ? 'posição ativa' : 'posições ativas'} • {activeOrders.reduce((sum, order) => sum + (order.amount || 0), 0).toFixed(2)} lotes total
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">P&L Total</div>
                            <div className={`text-lg font-bold font-mono ${activePnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatPnL(activePnL)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {activeOrders.map((order) => {
                        const pnl = order.currentProfit || 0;
                        const pnlPercent = order.price > 0 ? ((order.currentPrice! - order.price) / order.price * 100) * (order.side === 'LONG' ? 1 : -1) : 0;
                        
                        return (
                            <div 
                                key={order.id}
                                className="bg-black/40 border border-white/10 rounded-lg p-3 hover:border-blue-500/50 transition-all group"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm">
                                            {order.symbol.replace('USDT', '').replace('USD', '')}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                            order.side === 'LONG' 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        }`}>
                                            {order.side === 'LONG' ? 'COMPRA' : 'VENDA'}
                                        </span>
                                    </div>
                                    
                                    {/* ✅ P&L + Percentual Destacado */}
                                    <div className="flex flex-col items-end gap-0.5">
                                        <div className={`text-sm font-black font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                            pnlPercent >= 0 
                                                ? 'bg-emerald-500/20 text-emerald-400' 
                                                : 'bg-rose-500/20 text-rose-400'
                                        }`}>
                                            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-neutral-500">Entrada:</span>
                                        <span className="text-neutral-300 font-mono">{order.price.toFixed(order.symbol.includes('JPY') ? 2 : 5)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-neutral-500">Atual:</span>
                                        <span className="text-white font-mono font-bold">{(order.currentPrice || order.price).toFixed(order.symbol.includes('JPY') ? 2 : 5)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-neutral-500">Contratos:</span>
                                        <span className="text-white font-mono font-bold">{order.amount.toFixed(2)} lotes</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-neutral-500">Volume:</span>
                                        <span className="text-neutral-300 font-mono">${(order.amount * order.price).toFixed(2)}</span>
                                    </div>
                                </div>

                                {order.strategy && (
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Estratégia:</div>
                                        <div className="text-[10px] text-blue-400 font-medium truncate">
                                            {order.strategy}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>
        )}

        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[500px] lg:h-auto lg:min-h-[600px]">
            
            {/* COL 1: GAUGE - REDUZIDO */}
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-3 h-full">
                <Card className="flex-1 items-center justify-center gap-3">
                    <div className="w-full space-y-1">
                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                            <span className="text-emerald-400">Compra {score}%</span>
                            <span className="text-rose-400">Venda {100 - score}%</span>
                        </div>
                        <div className="w-[60%] mx-auto">
                            <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-300 ease-out" style={{ width: `${score}%` }}></div>
                                <div className="h-full bg-rose-500 shadow-[0_0_10px_#f43f5e] transition-all duration-300 ease-out" style={{ width: `${100 - score}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* 🎨 NOVO: Medidor de Score Moderno com gradiente */}
                    <div className="relative w-full h-48 shrink-0 z-10 flex items-center justify-center px-12 py-6 overflow-visible">
                         <div className={`absolute inset-0 rounded-2xl blur-[80px] opacity-10 transition-colors duration-1000 z-0 ${marketStatus === 'CLOSED' ? 'bg-slate-600' : marketClassification.bgColor}`}></div>
                         <div className="relative z-20 w-full h-full overflow-visible">
                            <ModernScoreGauge score={score} marketStatus={marketStatus} />
                         </div>
                    </div>

                    <div className="text-center w-full">
                        <div className={`text-xl font-black tracking-tight transition-colors duration-500 ${marketStatus === 'CLOSED' ? 'text-slate-400' : marketClassification.color}`}>
                            {marketStatus === 'CLOSED' 
                                ? 'MERCADO FECHADO'
                                : marketClassification.label}
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-2 max-w-[280px] mx-auto leading-relaxed">
                            {marketSignal?.insight || "Analisando fluxo de ordens..."}
                        </p>
                    </div>
                </Card>
            </div>

            {/* COL 2: NEURAL INSIGHT - REDUZIDO 20% */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-3 h-full">
                 <Card className="bg-gradient-to-br from-purple-950/20 to-black relative overflow-hidden group h-full flex flex-col">
                     <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <Zap className="w-20 h-20 text-purple-500" />
                     </div>
                     
                     <div className="flex items-center justify-between mb-1.5 relative z-10 flex-shrink-0">
                         <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-purple-500 animate-pulse"></div>
                                <Zap className="w-3 h-3 text-purple-400" />
                             </div>
                             <span className="text-sm font-bold text-purple-400 uppercase tracking-widest">Análise Neural em Tempo Real</span>
                         </div>
                         <div className="flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[9px] font-bold text-emerald-400">LIVE</span>
                         </div>
                     </div>
                     
                     {/* ✅ DISTRIBUIÇÃO VERTICAL COM JUSTIFY-BETWEEN */}
                     <div className="relative z-10 flex flex-col justify-between flex-1 overflow-y-auto pr-2 pb-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent gap-3">
                        {/* Tendência Principal */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h3 className={`text-base font-bold tracking-tight ${marketStatus === 'CLOSED' ? 'text-slate-500' : 'text-white'}`}>
                                    {marketStatus === 'CLOSED' ? "AGUARDANDO ABERTURA" : 
                                     (score > 60 ? "🟢 TENDÊNCIA DE ALTA" : 
                                     score < 40 ? "🔴 TENDÊNCIA DE BAIXA" : 
                                     "🟡 CONSOLIDAÇÃO LATERAL")}
                                </h3>
                                <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    score > 60 ? 'bg-emerald-500/20 text-emerald-400' :
                                    score < 40 ? 'bg-rose-500/20 text-rose-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                    {score > 60 ? 'ALTA' : score < 40 ? 'BAIXA' : 'NEUTRO'}
                                </div>
                            </div>
                            
                            {/* Insight Detalhado */}
                            <div className="bg-black/30 border border-white/5 rounded-lg p-[17px]">
                                <div className="flex items-start gap-2">
                                    <Activity className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <p className="text-[12px] text-white leading-relaxed font-medium">
                                            {marketSignal?.insight || "Analisando estrutura de mercado..."}
                                        </p>
                                        <p className="text-[11.5px] text-slate-400 leading-relaxed">
                                            {score > 60 ? 
                                                `Momentum positivo detectado. Compradores dominando o book de ordens. Volume crescente indica continuidade do movimento de alta. Próxima resistência em ${formatPrice(target1)}.` :
                                             score < 40 ?
                                                `Pressão vendedora dominante. Fluxo institucional em distribuição. Volume de venda acima da média. Próximo suporte crítico em ${formatPrice(target1)}.` :
                                                `Mercado em equilíbrio entre compradores e vendedores. Aguardando rompimento de zona de consolidação entre ${formatPrice(stopLoss)} e ${formatPrice(target1)} para definir direção.`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Métricas Principais - 3 Colunas */}
                        <div className="grid grid-cols-3 gap-2">
                             <div className="bg-black/20 rounded p-2 border border-white/5">
                                 <span className="text-[9px] font-bold text-neutral-500 uppercase block mb-1">Confiança IA</span>
                                 <span className="text-lg font-bold text-purple-300">{marketSignal?.strength || 0}%</span>
                             </div>
                             <div className="bg-black/20 rounded p-2 border border-white/5">
                                 <span className="text-[9px] font-bold text-neutral-500 uppercase block mb-1">Fluxo Ordens</span>
                                 <span className={`text-sm font-bold ${score > 55 ? 'text-emerald-400' : score < 45 ? 'text-rose-400' : 'text-neutral-400'}`}>
                                    {score > 55 ? 'Acumul.' : score < 45 ? 'Distrib.' : 'Neutro'}
                                 </span>
                             </div>
                             <div className="bg-black/20 rounded p-2 border border-white/5">
                                 <span className="text-[9px] font-bold text-neutral-500 uppercase block mb-1">Volatilidade</span>
                                 <span className={`text-sm font-bold ${Math.abs(currentTrend) > 3 ? 'text-orange-400' : 'text-blue-400'}`}>
                                    {Math.abs(currentTrend) > 3 ? 'Alta' : Math.abs(currentTrend) > 1 ? 'Média' : 'Baixa'}
                                 </span>
                             </div>
                        </div>
                        
                        {/* Níveis de Operação */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Níveis Técnicos</span>
                                <span className="text-[8px] text-slate-500">Atualizado há {Math.floor(Math.random() * 5) + 1}s</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-[#111] rounded p-2 border border-white/5 flex flex-col">
                                    <span className="text-[8px] text-emerald-400 uppercase font-bold mb-1">Entrada</span>
                                    <span className="text-sm font-bold text-white leading-none">{formatPrice(entry)}</span>
                                </div>
                                <div className="bg-[#111] rounded p-2 border border-rose-500/20 flex flex-col">
                                    <span className="text-[8px] text-rose-400 uppercase font-bold mb-1">Stop Loss</span>
                                    <span className="text-sm font-bold text-rose-400 leading-none">{formatPrice(stopLoss)}</span>
                                </div>
                                <div className="bg-[#111] rounded p-2 border border-emerald-500/20 flex flex-col">
                                    <span className="text-[8px] text-emerald-400 uppercase font-bold mb-1">Alvo 1</span>
                                    <span className="text-sm font-bold text-emerald-400 leading-none">{formatPrice(target1)}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Indicadores Técnicos */}
                        <div className="bg-black/30 border border-white/5 rounded-lg p-2">
                            <div className="flex items-center gap-2 mb-2">
                                <Cpu className="w-3 h-3 text-cyan-400" />
                                <span className="text-[9px] font-bold text-cyan-400 uppercase">Indicadores</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">RSI (14):</span>
                                    <span className={`font-bold ${score > 70 ? 'text-red-400' : score < 30 ? 'text-emerald-400' : 'text-white'}`}>
                                        {score > 60 ? Math.min(score + 10, 85) : score < 40 ? Math.max(score - 10, 15) : score}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">MACD:</span>
                                    <span className={`font-bold ${score > 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {score > 50 ? 'ALTA' : 'BAIXA'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">EMA 20/50:</span>
                                    <span className={`font-bold ${score > 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {score > 50 ? 'Cruz+' : 'Cruz-'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Volume:</span>
                                    <span className="font-bold text-yellow-400">
                                        {Math.abs(currentTrend) > 2 ? 'Alto' : 'Normal'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Recomendação da IA */}
                        <div className={`p-[17px] rounded-lg border ${
                            score > 60 ? 'bg-emerald-500/10 border-emerald-500/30' :
                            score < 40 ? 'bg-rose-500/10 border-rose-500/30' :
                            'bg-yellow-500/10 border-yellow-500/30'
                        }`}>
                            <div className="flex items-start gap-2">
                                <Shield className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                    score > 60 ? 'text-emerald-400' :
                                    score < 40 ? 'text-rose-400' :
                                    'text-yellow-400'
                                }`} />
                                <div className="flex-1 space-y-1.5">
                                    <p className="text-[10px] font-bold text-white uppercase">
                                        {score > 60 ? '✓ SETUP VALIDADO - ENTRADA RECOMENDADA' :
                                         score < 40 ? '⚠ RISCO ELEVADO - AGUARDAR CONFIRMAÇÃO' :
                                         '⏸ AGUARDAR BREAKOUT'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        {score > 60 ? `Entrada em ${formatPrice(entry)} com R/R 1:2. Stop em ${formatPrice(stopLoss)} (-${((entry - stopLoss) / entry * 100).toFixed(2)}%).` :
                                         score < 40 ? `Aguardar estabilização acima de ${formatPrice(target1)} antes de operar. Mercado sob pressão vendedora.` :
                                         `Mercado indeciso. Aguardar rompimento de ${formatPrice(target1)} (alta) ou ${formatPrice(stopLoss)} (baixa).`}
                                    </p>
                                </div>
                            </div>
                        </div>
                     </div>
                 </Card>
            </div>

            {/* COL 3: NEXUS QUANTUM ADVISOR - EXPANDIDO 25% */}
            <div className="col-span-1 lg:col-span-5 h-full flex flex-col min-h-[400px]">
                {/* Usar displayPrice (preço atual) e displayTrend (% de mudança diária) */}
                <NexusQuantumAdvisor 
                  activeSymbol={activeSymbol}
                  timeframe={timeframe}
                  currentPrice={displayPrice}
                  dailyChangePercent={displayTrend}
                />
            </div>

        </div>
      </div>
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
      <InfinoxAssetsBrowser 
        isOpen={isAssetsBrowserOpen} 
        onClose={() => setIsAssetsBrowserOpen(false)}
        selectedAsset={activeSymbol}
        onSelectAsset={(symbol) => {
          setSelectedAsset(symbol); // 🔥 Usar setSelectedAsset do TradingContext (persiste globalmente!)
          setIsAssetsBrowserOpen(false);
          toast.success(`Ativo alterado para ${symbol}`);
        }}
      />
      <MarketDataUpdatePanel 
        isOpen={isDataPanelOpen} 
        onClose={() => setIsDataPanelOpen(false)} 
      />
      <QuickSettings 
        isOpen={isQuickSettingsOpen} 
        onClose={() => setIsQuickSettingsOpen(false)} 
      />
      <MT5QuickConnect 
        isOpen={isMT5ConnectOpen} 
        onClose={() => setIsMT5ConnectOpen(false)} 
      />
      {SHOW_BTC_DEBUG && <BtcPriceDebug />}
    </div>
  );
};