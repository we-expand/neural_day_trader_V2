import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTradingContext } from '../../contexts/TradingContext';
import { useMarketContext } from '../../contexts/MarketContext';
import { useMarketScanner } from '../../hooks/useMarketScanner'; 
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
import { calculateCryptoDailyChange } from '@/app/utils/cryptoDailyChange'; // ✅ NOVO: BTC Reset 22:00h PT
import { getAssetBySymbol } from '@/app/config/assetDatabase';
import { floorToLotStep } from '@/app/modules/tradeConfirmationStage/lotSizeConversion';
import { getRealMarketData, getLastKnownRealPrice, subscribeToRealtimePrice } from '@/app/services/RealMarketDataService'; // ✅ 2026-07-12: fonte única de preço/variação pra todas as classes de ativo — ver CLAUDE.md sobre fragmentação (MetaApiService/UnifiedMarketDataService descontinuados no Dashboard). subscribeToRealtimePrice: streaming-relay (2026-07-14)
import { useAnimatedNumber } from '@/app/hooks/useAnimatedNumber';
import { formatPrice as formatPriceByAsset } from '@/app/utils/priceFormatter';
import { MiniEquityChart } from './MiniEquityChart'; // ✅ NOVO: Mini Equity Chart
import { BtcPriceDebug } from '../debug/BtcPriceDebug'; // 🐛 DEBUG: BTC Price Debug
import { getBinancePureValues } from '@/app/utils/binanceValidator'; // 🔥 VALORES PUROS: Sem transformações
import { binanceWebSocket } from '@/app/services/BinanceWebSocketService'; // 🔥 NOVO: Para debug de conexão
import { debugLog, DEBUG_CONFIG } from '@/app/config/debug'; // 🔥 Sistema de debug otimizado
import { MarketScoreEngine, type MarketScoreResult } from '@/app/services/MarketScoreEngine'; // 🎯 2026-07-17: Score real (fatores ortogonais multi-timeframe) — substitui a fórmula "50 + variação%×10"

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
 
// ✅ CORRIGIDO 2026-07-08 (2ª parte): a 1ª correção usava `useState(selectedAsset)`,
// mas o `Dashboard`/`MarketScoreBoard` DESMONTA e REMONTA toda vez que o usuário
// troca de tela em `App.tsx` (`switch (currentView)` renderiza o componente do
// zero). Resultado: ao voltar pro Dashboard depois de trocar o ativo no Gráfico
// (que ainda escreve no `selectedAsset` global), o `useState` reinicializava a
// partir do valor global já mudado — parecia que o Gráfico "replicava" pro
// Dashboard, mesmo com o Dashboard não escrevendo mais no global. Fix: guardar
// o último ativo escolhido no Dashboard numa variável de módulo (sobrevive a
// remontagens, dura a sessão do navegador), em vez de reler o contexto global
// toda vez que o componente monta.
let lastDashboardSymbol: string | null = null;

// ✅ 2026-07-10 (incidente): as 3 fontes de preço de cripto via Binance direto
// (API própria/Vercel, corsproxy.io, allorigins.win) estão TODAS mortas em
// produção — não é bug de intervalo, é infraestrutura externa bloqueada (ver
// BinancePollingService.ts). BTCUSD é confirmado disponível como CFD próprio
// na Infinox (auditoria `brokerRegistry.ts`) e o pipeline `/mt5-prices`
// (MetaAPI) está comprovadamente saudável — por isso BTCUSD sai do balde
// "cripto via Binance" e passa a usar o mesmo caminho MetaApi/MT5 que
// forex/índices já usam. ETH/SOL continuam em Binance (CFD não confirmado na
// corretora) até serem auditados também.
function isBinanceCryptoSymbol(symbol: string): boolean {
  const normalized = symbol.toUpperCase().replace('/', '').replace(' ', '');
  if (normalized === 'BTCUSD' || normalized === 'BTCUSDT') return false;

  // ✅ 2026-07-13: antes só reconhecia BTC/ETH/SOL (substring) ou sufixo
  // USDT — XRP, ADA, BNB, DOGE, AVAX, DOT, POL (símbolo "XXXUSD" no app,
  // sem "USDT") nunca batiam, então caíam por engano no loop de animação
  // feito pra Forex/Índices (interpola a partir do preço do ativo anterior)
  // em vez de mostrar o valor exato da API como cripto deveria — trocar de
  // um ativo caro (ex: índice ~25000) pra uma cripto barata (ex: XRP ~$1)
  // podia aparecer instável/errado por alguns ciclos de animação.
  const asset = getAssetBySymbol(normalized);
  if (asset) return asset.category === 'CRYPTO';

  return normalized.endsWith('USDT') || ['BTC', 'ETH', 'SOL'].some(c => normalized.includes(c));
}

// 🆕 P&L de posição atualiza a cada 1s (loop em useApexLogic.ts) sem nenhuma
// suavização — o número saltava direto de um valor pro outro ("duro"). Interpola
// visualmente via useAnimatedNumber, sem mexer no pipeline de dados. Componente
// separado porque é usado dentro de um `.map()` (hooks não podem ser chamados
// direto dentro do callback do map).
function AnimatedOrderPnl({ value, className }: { value: number; className: string }) {
  const animated = useAnimatedNumber(value);
  return <div className={className}>{animated >= 0 ? '+' : ''}{animated.toFixed(2)}</div>;
}

export const MarketScoreBoard = ({ onNavigate }: { onNavigate?: (view: string) => void } = {}) => {
  const { portfolio, activeOrders, config, syncWallet, status, toggleAI, selectedAsset, setSelectedAsset, closeManualPosition, setDashboardActiveSymbol, setDashboardScoreResult, equityHistory, isSafeMode, safeModeReason, disableSafeMode } = useTradingContext();
  const { marketState } = useMarketContext();
  const scanner = useMarketScanner();

  const [activeSymbol, setActiveSymbolState] = useState(
    lastDashboardSymbol || selectedAsset || 'BTCUSD'
  );
  const setActiveSymbol = (symbol: string) => {
    lastDashboardSymbol = symbol;
    setActiveSymbolState(symbol);
  };

  // Publica o ativo real do Dashboard no contexto pra widgets irmãos (ex:
  // RiskThermometer) acompanharem a troca — antes só existia como state local
  // deste componente, então nenhum outro widget sabia o que estava selecionado.
  useEffect(() => {
    setDashboardActiveSymbol(activeSymbol);
  }, [activeSymbol, setDashboardActiveSymbol]);

  const [timeframe, setTimeframe] = useState<'1m'|'5m'|'15m'|'1h'|'1d'>('15m');
  const [candleTimeLeft, setCandleTimeLeft] = useState('00:00');
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
          } else if (timeframe === '1d') {
              const secondsSinceMidnightUTC = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
              diffSec = 86400 - secondsSinceMidnightUTC;
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
  // ✅ 2026-07-16: Cleber pediu — mercado fechado precisa (1) mostrar o
  // último preço negociado (não zero) e (2) avisar claramente que está
  // fechado. O preço já é sempre o último real conhecido (targetPriceRef
  // nunca zera por conta própria). O que faltava: `marketStatus` só olhava
  // `isRealData` — um tick de ontem/da última sessão (mercado fechado agora)
  // ainda tem `isRealData: true` (preço genuíno, só desatualizado), então o
  // badge mostrava "OPEN" errado. Agora combina com a IDADE do tick (mesma
  // filosofia já estabelecida: nunca usar relógio fixo pra decidir SE busca
  // dado, mas aqui é só pra rotular status — a fonte de verdade continua
  // sendo a resposta real da corretora, só que agora com o timestamp dela).
  const [lastTradeTimeLabel, setLastTradeTimeLabel] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'MetaApi' | 'Binance' | 'Fallback'>('Fallback'); // ✅ NOVO: Track data source
  const [wsUpdateCounter, setWsUpdateCounter] = useState(0); // 🔥 NOVO: Contador de updates WebSocket (para forçar re-render)

  // 🎯 2026-07-17: Market Score REAL (motor de fatores ortogonais, MarketScoreEngine).
  // Recalculado ao trocar de ativo/timeframe e a cada 15s; o cache por barra do
  // BacktestDataService dedupe as chamadas de rede dentro da mesma barra.
  const [scoreResult, setScoreResult] = useState<MarketScoreResult | null>(null);

  // Refs for smooth animation
  const simTrendRef = useRef(2.5);
  const simCycleRef = useRef(0);
  const targetTrendRef = useRef(2.5);
  const targetPriceRef = useRef(0); // 🔥 Inicializar com 0
  const targetChangeRef = useRef(0); // ✅ NOVO: Ref para variação absoluta

  // ✅ CORRIGIDO 2026-07-10: targetPriceRef/targetChangeRef/targetTrendRef são
  // ÚNICOS (não têm chave por símbolo) e são escritos por 3 mecanismos
  // diferentes (fetchData polling MetaAPI, fetchData polling cripto, WebSocket
  // cripto) — sem trava, uma resposta atrasada ou de um símbolo antigo (ex:
  // BTC ainda com polling ativo) sobrescreve o preço do símbolo atualmente
  // selecionado. Baixar o intervalo de cripto de 120s pra 1.5s tornou essa
  // corrida praticamente constante. `activeSymbolRef` sempre reflete o símbolo
  // REALMENTE selecionado agora; cada escrita nos refs acima deve checar
  // contra ele antes de aplicar.
  const activeSymbolRef = useRef(activeSymbol);
  useEffect(() => {
    activeSymbolRef.current = activeSymbol;
  }, [activeSymbol]);

  // 🎬 ANIMAÇÃO FLUIDA: só o preço se interpola visualmente até o alvo —
  // variação ($) e % são sempre lidos direto do ref (ver displayChange/displayTrend).
  const [animatedPrice, setAnimatedPrice] = useState(0);

  // ✅ CORRIGIDO 2026-07-10 (2ª parte): a trava contra corrida acima impede que
  // uma resposta ATRASADA sobrescreva o ativo atual, mas não existia nenhum
  // RESET dos refs ao trocar de ativo — se a busca de preço do ativo novo
  // demorar ou falhar (fontes de cripto mortas, MetaAPI lenta), a tela
  // continuava mostrando o valor do ativo ANTERIOR (ex: BTC) porque nada o
  // apagava. Sintoma relatado: "todos os ativos aparecem congelados com o
  // mesmo preço do BTC". Fix: zera os refs/estados de preço imediatamente ao
  // trocar de ativo, antes de qualquer fetch novo — o ativo novo começa em
  // "carregando" (0) em vez de herdar visualmente o valor de outro símbolo.
  // ✅ 2026-07-11: Cleber reportou troca de ativo "demorando ~4s" — a causa
  // era zerar sempre aqui e esperar o round-trip de rede (MetaAPI/corretora
  // pode levar vários segundos sob carga da conta compartilhada) antes de
  // mostrar qualquer número. Agora, se esse símbolo já teve um preço REAL
  // nesta sessão (`getLastKnownRealPrice`, ver RealMarketDataService.ts),
  // a tela mostra esse valor imediatamente — troca percebida como instantânea
  // pra ativos já vistos — e o fetch novo abaixo ainda roda e atualiza assim
  // que responder. Só zera (mostra "carregando") na primeira vez que esse
  // símbolo é selecionado nesta sessão.
  useEffect(() => {
    const known = getLastKnownRealPrice(activeSymbol);
    targetPriceRef.current = known?.price ?? 0;
    targetChangeRef.current = known?.change ?? 0;
    targetTrendRef.current = known?.changePercent ?? 0;
    setAnimatedPrice(known?.price ?? 0);
  }, [activeSymbol]);

  // ✅ 2026-07-14: STREAMING (push) — assina o `streaming-relay` (ver
  // RealMarketDataService.ts, subscribeToRealtimePrice) pro ativo selecionado.
  // Substitui a espera do próximo ciclo de polling (até 2s + fila de lotes da
  // conta MetaAPI compartilhada, que já causou atraso de 20s+ documentado no
  // CLAUDE.md) por atualização assim que a corretora manda o tick. O polling
  // abaixo (fetchData/setInterval) continua ativo como rede de segurança —
  // cobre o período antes do streaming-relay entregar o primeiro tick e
  // símbolos fora do catálogo assinado pelo relay.
  //
  // ⚠️ CORRIGIDO 2026-07-14 (2ª parte): só o PREÇO vem do streaming aqui —
  // `change`/`changePercent` NÃO são escritos por este listener. Cleber
  // reportou (com print) o % oscilando entre dois valores plausíveis mas
  // diferentes (ex: +0,50% → -0,12%) com o preço praticamente parado — causa
  // raiz: o `streaming-relay` calcula sua própria variação diária (seed de
  // candle D1 simplificado) e o polling antigo calcula a variação com toda a
  // validação já existente no backend (referência ≤4 dias, magnitude ≤15%,
  // ver supabase/functions/server/index.ts) — os dois métodos divergem um
  // pouco e, escrevendo no mesmo ref, brigavam a cada tick/polling.
  // `change`/`changePercent` continuam vindo SÓ do polling (fetchData
  // abaixo), que já é a fonte validada; o streaming só acelera o preço.
  useEffect(() => {
    const unsubscribe = subscribeToRealtimePrice(activeSymbol, (data) => {
      if (activeSymbolRef.current !== activeSymbol) return;
      targetPriceRef.current = data.price;
      setDataSource('MetaApi');
      setWsUpdateCounter((c) => c + 1);
    });
    return unsubscribe;
  }, [activeSymbol]);

  // 🔥 CRYPTO: Usar valores DIRETOS das refs (SEM animação - ZERO latência!)
  const isCryptoSymbol = isBinanceCryptoSymbol(activeSymbol);

  // ✅ CORRIGIDO 2026-07-11 (3ª parte): variação ($) e % NUNCA mais passam por
  // interpolação própria (animatedChange/animatedTrend) — só o preço é
  // suavizado visualmente. Variação/% vêm direto do ref no instante em que
  // fetchData/WebSocket escreve, sempre os TRÊS valores da MESMA resposta —
  // antes, cada um interpolava a um ritmo próprio (lerp independente),
  // causando dois sintomas juntos: (1) "demora uma eternidade pra entrar" —
  // ao trocar de ativo nunca visto, change/trend começavam do zero e subiam
  // aos poucos até o valor real em vez de aparecer junto com o preço; (2)
  // oscilação visual — preço, variação e % convergindo em velocidades
  // diferentes pareciam "descombinar" entre si por um instante a cada
  // atualização. Preço continua animado (não desincroniza contra si mesmo).
  const displayPrice = isCryptoSymbol ? targetPriceRef.current : animatedPrice;
  const displayTrend = targetTrendRef.current;
  const displayChange = targetChangeRef.current;
  
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
      // ✅ Só o preço é interpolado (efeito visual). Variação/% são lidos
      // direto do ref em `displayChange`/`displayTrend` — ver comentário ali.
      setAnimatedPrice(prev => {
        const diff = targetPriceRef.current - prev;
        return Math.abs(diff) < 0.01 ? targetPriceRef.current : prev + diff * ANIMATION_SPEED;
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
    // ✅ CORRIGIDO 2026-07-08: trava contra corrida de requisições — sem isso,
    // se DUAS chamadas de fetchData ficarem em voo ao mesmo tempo pro mesmo
    // ativo (ver motivo abaixo, no array de dependências), a que demorar mais
    // pra responder "ganha" e sobrescreve o preço certo com um valor pior
    // (inclusive zero, se aquela chamada específica falhar) — mesmo que ela
    // tenha sido disparada por engano e o usuário já esteja vendo o preço
    // certo. `requestId` garante que só a ÚLTIMA chamada iniciada aplica seu
    // resultado.
    let isStale = false;
    let isFetching = false; // ✅ 2026-07-11: evita empilhar fetch do mesmo símbolo (ver updateInterval abaixo)

    const fetchData = async () => {
        isFetching = true;
        try {

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
        
        if (isStale) return; // resposta de uma chamada antiga — ignorar

        // ✅ CORRIGIDO 2026-07-10 (4ª parte): o relógio estático (`isMarketOpen`)
        // trata TODOS os índices/forex/commodities com o mesmo horário único —
        // na prática, ativos diferentes abrem/fecham em momentos diferentes de
        // verdade na corretora (confirmado pelo Cleber: "existem ativos
        // fechados e ativos abertos" ao mesmo tempo). Usar o relógio pra
        // DECIDIR se busca dado ou não (como era antes) causava dois bugs:
        // ou pulava a busca de ativos que na verdade estavam abertos, ou
        // buscava só uma vez ativos que na verdade estavam fechados. Agora
        // SEMPRE busca o dado ao vivo pra qualquer ativo — o status
        // aberto/fechado exibido na tela passa a vir da RESPOSTA REAL da
        // corretora (fonte 'metaapi'/'binance'/'yahoo' = mercado respondendo
        // de verdade = aberto; fonte 'fallback'/'generated'/'default' =
        // corretora não tem cotação agora = fechado), por símbolo — não mais
        // de um relógio genérico que assume o mesmo horário pra tudo.
        // `marketInfo`/`statusMessage` continuam servindo só pra dar uma
        // estimativa amigável de "abre às/fecha às" (já no fuso do usuário,
        // ver formatInUserTimezone em marketHours.ts), nunca pra pular a busca.

        let isRealData = false;

        // ✅ 2026-07-12: fonte ÚNICA de preço/variação pra qualquer classe de
        // ativo (antes: MetaApiService pra forex/índices/commodities e
        // UnifiedMarketDataService — com gerador de preço fake próprio — pra
        // cripto, dois caminhos com bugs independentes; corrigir um ativo
        // nunca corrigia o outro). getRealMarketData já roteia cripto vs
        // MT5/broker internamente e nunca retorna preço inventado (ver
        // getFallbackOrLastKnown em RealMarketDataService.ts).
        try {
            const marketData = await getRealMarketData(activeSymbol);
            if (isStale || activeSymbolRef.current !== activeSymbol) return; // resposta de uma chamada antiga — ignorar

            console.log(`[MarketScoreBoard] 📊 Dados recebidos:`, {
                symbol: marketData.symbol,
                price: marketData.price,
                change: marketData.change,
                changePercent: marketData.changePercent,
                source: marketData.source,
                isRealData: marketData.isRealData
            });

            targetPriceRef.current = marketData.price;
            targetChangeRef.current = marketData.change ?? 0;

            let realTrend = marketData.changePercent ?? 0;
            // Limitar range para evitar scores extremos
            if (realTrend > 10) realTrend = 10;
            if (realTrend < -10) realTrend = -10;
            if (isNaN(realTrend)) realTrend = 0;

            targetTrendRef.current = realTrend;
            isRealData = marketData.isRealData;

            // ✅ 2026-07-16: idade do tick decide o status exibido — um preço
            // real mas com timestamp velho (>10min) significa que a corretora
            // não está mais atualizando esse ativo agora (mercado fechado),
            // mesmo que o preço em si seja genuíno (último negociado).
            //
            // ✅ 2026-07-17: tick desatualizado NÃO é sempre igual a "mercado
            // fechado" — pode ser só falha transitória de dado (ex: HTTP 429
            // da conta MetaAPI compartilhada, problema crônico documentado à
            // exaustão neste projeto). Achado com WHEUSD (Trigo, CFD near-24/5
            // como ouro/petróleo): mercado genuinamente aberto (sexta ~15h
            // local, dentro do horário), mas rate-limit impedia atualização —
            // o app rotulava "MERCADO FECHADO" com confiança, o que é falso.
            // Corrigido: só declara CLOSED com confiança quando (a) o tick é
            // fresco e a corretora disse explicitamente que não é dado real,
            // OU (b) o tick está velho E o calendário CFD real também diz que
            // deveria estar fechado agora. Tick velho + calendário aberto =
            // problema de DADO, não de mercado — mantém o último status real
            // conhecido em vez de mentir "fechado".
            // ✅ 2026-07-17: achado ao vivo com UKOUSD — quando o símbolo NUNCA
            // teve preço real nesta sessão (primeira seleção) e a busca falha
            // (ex: HTTP 429 da conta compartilhada, confirmado acontecendo),
            // `getFallbackOrLastKnown` retorna `timestamp: Date.now()` (FRESCO,
            // porque não há cache nenhum pra reaproveitar) junto com
            // `isRealData: false` — a checagem de "tick velho" abaixo nunca
            // detectava isso como stale (timestamp é literalmente agora), caía
            // direto no ramo `!isRealData` e declarava CLOSED com confiança,
            // ignorando o calendário — mesmo com o mercado genuinamente aberto
            // (sexta 21h50 UTC, fecha só às 22h00). "Nunca tive dado real
            // ainda" é uma 3ª categoria, diferente de "tinha dado, ficou
            // velho" — nesse caso o calendário é sempre a fonte de verdade,
            // nunca declara fechado só por falta momentânea de dado.
            const neverHadRealDataYet = !isRealData && marketData.source === 'generated';
            const STALE_TICK_MS = 10 * 60 * 1000;
            const tickAgeMs = marketData.timestamp ? Date.now() - marketData.timestamp : Infinity;
            const isTickStale = tickAgeMs > STALE_TICK_MS;
            const calendarSaysOpen = isMarketOpen(activeSymbol).isOpen;
            const shouldShowClosed = neverHadRealDataYet
                ? !calendarSaysOpen
                : isTickStale
                ? !calendarSaysOpen
                : !isRealData;
            setMarketStatus(shouldShowClosed ? 'CLOSED' : 'OPEN');
            setLastTradeTimeLabel(
                marketData.timestamp
                    ? new Date(marketData.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : null
            );
            setDataSource(marketData.source);

            console.log(`[MarketScoreBoard] ${isRealData ? '✅' : '⚠️'} ${activeSymbol}: $${marketData.price} (${realTrend > 0 ? '+' : ''}${realTrend.toFixed(2)}%) [${marketData.source}]`);
        } catch (e: any) {
            console.error('[MarketScoreBoard] ❌ Error:', e.message);
        }

        // ✅ 2026-07-17: removido o cálculo de `marketSignal` (fórmula legada
        // `50+variação%×10` + texto sorteado de listas `bulls[]`/`bears[]`,
        // incluindo o fantasma "Correção agressiva em andamento.") — estava
        // 100% morto pra renderização (nada mais lê `marketSignal` na tela,
        // confirmado por busca), mas continuava rodando/computando à toa a
        // cada ciclo. Fonte única de verdade pro veredito agora é só
        // `scoreResult` (motor real) → `marketClassification`, ver mais
        // abaixo neste arquivo.
        if (isStale) return; // resposta de uma chamada antiga — ignorar
        } finally {
            isFetching = false;
        }
    };

    // 🔥 Fetch inicial
    fetchData();

    // 📊 Polling para atualização periódica — preço "vivo" a pedido do Cleber.
    // ✅ 2026-07-11: 5s fixo fazia o preço parecer "estático" entre uma
    // atualização e outra (a variação real de um ciclo pro outro costuma ser
    // pequena — ex: $64144.33 -> $64144.32 -- e só aparecia a cada 5s
    // completos). Baixar o intervalo fixo pra menos de 5s SEM proteção
    // empilharia chamadas concorrentes pro mesmo símbolo sempre que a
    // resposta da conta MetaAPI compartilhada demorar mais que o intervalo
    // (documentado 3-8s em sessões anteriores) — mesma causa raiz do
    // incidente de sobrecarga de 2026-07-08/10. Fix: `isFetchingRef` pula o
    // próximo tick se o anterior ainda não respondeu, então o intervalo abaixo
    // é só um MÁXIMO de espera — na prática atualiza assim que a resposta
    // anterior chega, nunca mais rápido que a rede real permite, nunca dois
    // fetches do mesmo símbolo em voo ao mesmo tempo.
    const updateInterval = 2000;

    console.log(`[MarketScoreBoard] ⚡ Intervalo de atualização: ${updateInterval}ms (máximo — adapta à latência real)`);

    const interval = setInterval(() => {
      if (isFetching) return; // resposta anterior ainda em voo — não empilhar
      fetchData();
    }, updateInterval);
    return () => {
      isStale = true; // marca essa "geração" do efeito como obsoleta
      clearInterval(interval);
    };
    // ✅ CORRIGIDO 2026-07-08: removido `scanner?.bestAsset`/`scanner?.insight`
    // das dependências — causa raiz do "entra e alguns segundos depois zera
    // pra qualquer ativo". `useMarketScanner` é 100% simulado (Math.random(),
    // com delay artificial de 1,5s de "varredura"); quando esse delay
    // terminava, `bestAsset`/`insight` mudavam e disparavam uma SEGUNDA
    // chamada de fetchData ainda com a PRIMEIRA em voo — se a segunda demorar
    // mais (rede) e falhar, ela sobrescrevia o preço certo com zero, mesmo
    // sem nenhuma mudança real de ativo. A leitura de `scanner.bestAsset`/
    // `scanner.score`/`scanner.insight` dentro do fetchData continua usando o
    // valor mais recente via closure — só não precisa mais RE-DISPARAR o
    // fetch inteiro sempre que o scanner (que nem busca preço real) mudar.
  }, [activeSymbol, timeframe]);

  // 🎯 2026-07-17: Motor de Score REAL. Recalcula ao trocar de ativo/timeframe
  // e a cada 15s (indicadores mudam devagar; o preço ao vivo continua vindo do
  // streaming/polling acima, independente disto). Usa candles reais multi-TF.
  useEffect(() => {
    let cancelled = false;

    const computeScore = async () => {
      try {
        // MarketScoreEngine.compute() já trata falha de rede/dado internamente
        // e sempre resolve (nunca lança) — retorna provenance:'unavailable' em
        // vez de travar a Promise. O catch aqui é só rede de segurança extra.
        const result = await MarketScoreEngine.compute(activeSymbol, timeframe);
        if (!cancelled) {
          setScoreResult(result);
          setDashboardScoreResult(result); // publica pro RiskThermometer (e outros widgets irmãos) — nunca recalcular por conta própria, dobraria carga na conta MetaAPI compartilhada
        }
      } catch (e: any) {
        console.warn('[MarketScoreBoard] Falha ao calcular Score real:', e?.message);
        // ✅ 2026-07-17: antes só logava e deixava `scoreResult` como estava —
        // se a 1ª chamada da sessão falhasse, ficava `null` pra sempre e a UI
        // travava em "Calculando..." mudo, sem nunca avisar o usuário. Agora
        // sempre emite um estado explícito 'unavailable' (nunca inventa dado).
        if (!cancelled) {
          const fallback = MarketScoreEngine.unavailable(activeSymbol, timeframe, timeframe, e?.message);
          setScoreResult(fallback);
          setDashboardScoreResult(fallback);
        }
      }
    };

    computeScore();
    const scoreInterval = setInterval(computeScore, 15000);
    return () => {
      cancelled = true;
      clearInterval(scoreInterval);
    };
  }, [activeSymbol, timeframe]);

  // ✅ 2026-07-12: removido o efeito de WebSocket separado que assinava
  // `UnifiedMarketDataService.subscribeToRealtimeData` — era uma SEGUNDA fonte
  // de dado pra cripto, concorrente com o polling de `getRealMarketData`
  // acima, que sobrescrevia os refs com valores vindos do serviço que ainda
  // tinha um gerador de preço fake ($100 fixo + Math.random()) embutido. O
  // polling de 2s via getRealMarketData (fonte única, já sem fallback
  // inventado) agora cobre cripto também.

  // Animation Loop - 🔥 DESATIVADO PARA CRYPTO (valores exatos)
  useEffect(() => {
    // 🔥 SE FOR CRYPTO, NÃO ANIMAR (usar valores exatos da API)
    const isCrypto = isBinanceCryptoSymbol(activeSymbol);
    
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
  // 🎯 2026-07-17: Score REAL do MarketScoreEngine (fatores ortogonais multi-TF)
  // é a ÚNICA fonte de verdade pro gauge/classificação assim que existe um
  // resultado pra este ativo — mesmo 'unavailable' (score:50/LATERAL, "não
  // sei") é mais honesto que a fórmula legada de variação%×10, que gerava um
  // segundo sistema de classificação paralelo e podia discordar do motor real
  // na mesma tela (achado ao vivo: WHEUSD mostrando "TENDÊNCIA DE ALTA" +
  // score 61 da fórmula antiga ENQUANTO o motor real dizia "sem dados"). A
  // fórmula antiga só roda no vácuo de ~1s antes do 1º cálculo real chegar.
  const hasScoreData = !!(scoreResult && scoreResult.symbol === activeSymbol);
  // `hasRealScore` = tem NÚMERO real pra mostrar (score real OU última leitura
  // real conhecida, marcada 'stale') — usado pelos campos que não têm um valor
  // neutro sensato (confiança, fatores, indicadores). 'unavailable' sem cache
  // nenhuma ainda mostra "—" nesses campos, mas o score/classificação em si já
  // usa o resultado do motor (conservador: 50/LATERAL) via `hasScoreData`.
  const hasRealScore = hasScoreData && (scoreResult!.provenance === 'real' || scoreResult!.provenance === 'stale');
  // ✅ 2026-07-17: achado ao vivo — ao entrar no Dashboard, o número aparecia
  // "alta fortíssima" (ex: 88) por ~1s e depois SUMIA/caía. Causa: antes do
  // 1º resultado do MarketScoreEngine chegar (leva ~1-3s, busca candle real
  // pela rede), `targetScore` caía nessa fórmula legada de uma linha
  // (`50+variação%×10`) — que reage cru à variação % do dia, sem nenhum dos
  // fatores/amortecimentos do motor real. Numa variação grande (ex: +3,8%),
  // isso dava um número bem mais dramático que o score real calculado
  // (chega ~1s depois e sobrescreve) — o "flash" era literalmente essa
  // fórmula fantasma antiga que já devia estar extinta (mesma família do bug
  // "duas fontes discordando" corrigido hoje em outros lugares desta tela).
  // Fix: enquanto não há resultado do motor, mostra neutro (50/carregando)
  // em vez de inventar um número dramático que vai ser trocado.
  const targetScore = hasScoreData ? scoreResult!.score : 50;
  const smoothScore = marketStatus === 'CLOSED' ? 50 : targetScore;
  let score = Math.min(Math.max(Math.round(smoothScore), 1), 99);

  if (!Number.isFinite(score)) score = 50;

  // ✅ 2026-07-17: ANTES esse rótulo vinha de `getMarketClassification(displayTrend)`
  // — uma leitura baseada SÓ na variação % bruta do dia, totalmente
  // desconectada do motor de fatores múltiplos (Tendência/Momentum/Estrutura/
  // Volume/Regime). Causa raiz real do bug reportado: SPX500 mostrando
  // "CORREÇÃO" mesmo com o mercado subindo forte intradia — a variação%-do-dia
  // sozinha não captura isso, e o motor real (que sim analisa isso direito)
  // nem era consultado por esse rótulo. Unificado: agora deriva do MESMO
  // `score` que já é o resultado do MarketScoreEngine (ou 50/LATERAL honesto
  // se ainda indisponível) — nunca mais duas classificações discordando na
  // mesma tela.
  // ✅ 2026-07-17: `unavailable` (motor sem NENHUM dado real, nem cache de
  // sessão anterior) renderizava como "LATERAL/RANGE" — indistinguível de um
  // veredito real de mercado parado. Achado ao vivo: S&P em queda forte
  // ("derretendo") mostrando "LATERAL/RANGE" porque o motor não conseguiu
  // candle real (símbolo/rate-limit/qualquer falha) e caiu no fallback
  // 50/LATERAL honesto — mas a UI não comunicava que era "sem dado", parecia
  // um "mercado neutro" real. Vale pra QUALQUER ativo, não só o S&P. Fix:
  // `unavailable` sem cache nenhuma vira um rótulo explícito "SEM DADOS",
  // nunca mais confundível com uma leitura real de lateralização.
  const isTrulyUnavailable = hasScoreData && scoreResult!.provenance === 'unavailable';
  // ✅ 2026-07-17: FONTE ÚNICA DE VERDADE pro veredito exibido na tela — até
  // aqui, 5 pedaços DIFERENTES deste arquivo calculavam "é alta/baixa/lateral"
  // cada um com seu próprio corte (WHEUSD, badge de mercado fechado, "sem
  // dados" disfarçado de lateral, o rótulo grande vs. o parágrafo de detalhe
  // baseado em ADX cru...), todos corrigidos hoje um a um — sintoma de que a
  // tela foi remendada em muitas sessões, nunca teve um único lugar decidindo
  // o veredito. Daqui pra frente, TODO texto/rótulo/badge de direção nesta
  // tela deve ler `marketClassification` — nunca recalcular score>X/<Y de
  // novo em outro lugar. Um objeto, todas as variantes de apresentação
  // (rótulo longo, curto, emoji, badge) já prontas.
  const marketClassification = isTrulyUnavailable
    ? { label: 'SEM DADOS', shortLabel: 'SEM DADOS', badge: 'SEM DADOS', emoji: '⚪', color: 'text-slate-400', bgColor: 'bg-slate-600', badgeClass: 'bg-slate-500/20 text-slate-400' }
    : score > 75 ? { label: 'ALTA FORTE', shortLabel: 'TENDÊNCIA DE ALTA', badge: 'ALTA', emoji: '🟢', color: 'text-emerald-400', bgColor: 'bg-emerald-500', badgeClass: 'bg-emerald-500/20 text-emerald-400' }
    : score > 60 ? { label: 'TENDÊNCIA DE ALTA', shortLabel: 'TENDÊNCIA DE ALTA', badge: 'ALTA', emoji: '🟢', color: 'text-emerald-400', bgColor: 'bg-emerald-500', badgeClass: 'bg-emerald-500/20 text-emerald-400' }
    : score < 25 ? { label: 'CORREÇÃO FORTE', shortLabel: 'TENDÊNCIA DE BAIXA', badge: 'BAIXA', emoji: '🔴', color: 'text-rose-400', bgColor: 'bg-rose-500', badgeClass: 'bg-rose-500/20 text-rose-400' }
    : score < 40 ? { label: 'TENDÊNCIA DE BAIXA', shortLabel: 'TENDÊNCIA DE BAIXA', badge: 'BAIXA', emoji: '🔴', color: 'text-rose-400', bgColor: 'bg-rose-500', badgeClass: 'bg-rose-500/20 text-rose-400' }
    : { label: 'LATERAL/RANGE', shortLabel: 'CONSOLIDAÇÃO LATERAL', badge: 'NEUTRO', emoji: '🟡', color: 'text-blue-400', bgColor: 'bg-blue-500', badgeClass: 'bg-yellow-500/20 text-yellow-400' };

  const entry = displayPrice; // 🔥 USAR displayPrice (direto da ref para crypto)
  const stopLoss = marketStatus === 'CLOSED' ? 0 : (score > 50 ? entry * 0.995 : entry * 1.005);
  const target1 = marketStatus === 'CLOSED' ? 0 : (score > 50 ? entry * 1.01 : entry * 0.99);
  const target2 = marketStatus === 'CLOSED' ? 0 : (score > 50 ? entry * 1.02 : entry * 0.98);

  const formatPrice = (p: number) => {
      if (!Number.isFinite(p)) return "0000.00";

      // ✅ 2026-07-11: precisão por ativo de novo (Cleber pediu de volta —
      // "AUDCAD 0.9838 | XAUUSD 4119.72").
      // ✅ 2026-07-16: 4 dígitos antes do ponto pra todo ativo (mesma regra
      // central de priceFormatter.ts) — sem separador de milhar, que
      // conflitava visualmente com o zero-padding (ex: "0,043.92").
      return formatPriceByAsset(p, activeSymbol);
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
  const animatedActivePnL = useAnimatedNumber(activePnL);
  const profitAi = (portfolio?.equity || 0) - (config.initialBalance || 100);

  // ✅ 2026-07-20: "Risco da Conta" usava só o P&L flutuante das posições
  // ABERTAS agora (activePnL) — zerava sempre que não havia posição aberta,
  // ignorando o drawdown real acumulado da conta e o limite de fato
  // configurado (aiConfig.maxDrawdown, o mesmo usado pelo Health Check
  // Guardian em useApexLogic.ts). Passa a usar portfolio.currentDrawdown
  // (pico real de drawdown desde o início da sessão, persistido) contra o
  // limite real configurado, e reflete o Safe Mode quando ativo.
  const maxDrawdownLimit = config.maxDrawdown && config.maxDrawdown > 0 ? config.maxDrawdown : 15;
  const realDrawdownPercent = portfolio?.currentDrawdown || 0;
  const riskPercent = Math.min(realDrawdownPercent, maxDrawdownLimit);
  const riskRatio = maxDrawdownLimit > 0 ? riskPercent / maxDrawdownLimit : 0;

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

                <div
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20"
                    title={scanner?.bestAsset ? `Melhor ativo real (cripto): ${scanner.bestAsset.symbol} — score ${scanner.bestAsset.score.toFixed(0)}, ${scanner.bestAsset.classification}` : undefined}
                >
                     <div className={`w-1.5 h-1.5 rounded-full ${scanner?.isScanning ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400'}`} />
                     <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                        {scanner?.isScanning
                          ? 'SCANNING...'
                          : scanner?.bestAsset
                          ? `MELHOR: ${scanner.bestAsset.symbol} (${scanner.bestAsset.score.toFixed(0)})`
                          : 'AI LOCKED'}
                     </span>
                </div>

                {/* ✅ REMOVIDOS: Badge de Fonte de Dados (📊 DATA/FALLBACK/REAL-TIME) e os botões DADOS, AJUSTAR, CONECTAR e OFFLINE - Causavam confusão no Dashboard */}

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
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                {marketStatus === 'CLOSED' ? 'Preço Atual (fechado)' : 'Preço Atual'}
                            </span>
                        </div>

                        {/* ✅ FORMATO CORRETO: Preço atual em destaque + % hoje embaixo */}
                        <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-3xl font-bold font-mono tracking-tight leading-none ${marketStatus === 'CLOSED' ? 'text-slate-300' : (displayTrend >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                                {formatPrice(displayPrice)}
                            </span>
                            {/* 🔥 EXIBIR: Variação absoluta ($) + Percentual (%) */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold font-mono ${marketStatus === 'CLOSED' ? 'text-slate-400' : (displayChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                                    {displayChange > 0 ? '+' : ''}{formatPrice(displayChange || 0)}
                                </span>
                                <span className={`text-xs font-medium ${marketStatus === 'CLOSED' ? 'text-slate-400/80' : (displayTrend >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80')}`}>
                                    ({displayTrend > 0 ? '+' : ''}{(displayTrend || 0).toFixed(2)}% hoje)
                                </span>
                            </div>
                            {/* ✅ 2026-07-16: aviso explícito de mercado fechado + horário do
                                último negócio — pedido do Cleber, pra nunca parecer que 0000
                                ou um preço "vivo" quando na verdade é o fechamento anterior. */}
                            {marketStatus === 'CLOSED' && (
                                <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wide">
                                        🔒 Mercado Fechado{lastTradeTimeLabel ? ` — último negócio ${lastTradeTimeLabel}` : ''}
                                    </span>
                                </div>
                            )}
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
                    {['1m','5m','15m','1h','1d'].map(tf => (
                        <button 
                            key={tf} 
                            onClick={() => setTimeframe(tf as '1m'|'5m'|'15m'|'1h'|'1d')}
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
                        {(riskPercent || 0).toFixed(2)}% / {maxDrawdownLimit.toFixed(2)}%
                    </div>
                </div>

                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/5 mb-2 relative">
                    <div
                        className={`h-full transition-all duration-500 ${riskRatio > 0.8 ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 'bg-blue-600 shadow-[0_0_10px_#2563eb]'}`}
                        style={{ width: `${Math.min(riskRatio, 1) * 100}%` }}
                    />
                </div>

                <div className="text-2xl font-bold tracking-tight text-white font-mono">
                    {/* 🆕 FIX: Safe Mode é config da IA — nunca pode aparecer/interferir no
                        Modo Livre (IA desligada, usuário operando só pela boleta manual).
                        `status === 'running'` reflete `isActive` do motor (só true com a IA
                        ligada); belt-and-suspenders junto do fix em useApexLogic.ts que já
                        impede o Safe Mode de ativar OU permanecer ativo com a IA desligada. */}
                    {isSafeMode && status === 'running' ? (
                        <div className="flex items-center gap-2">
                            <span className="text-rose-400" title={safeModeReason || undefined}>SAFE MODE</span>
                            {/* disableSafeMode já existia no motor mas nunca tinha botão — a
                                única saída antes disso era resetar a conta inteira (perder o
                                saldo). Sai do Safe Mode sem mexer no saldo; se a causa raiz
                                (drawdown, perda diária etc.) continuar valendo, o Health Check
                                Guardian dispara de novo sozinho no próximo ciclo. */}
                            <button
                                onClick={() => disableSafeMode()}
                                className="text-[9px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-white transition-colors font-bold uppercase tracking-wider"
                                title="Sair do Safe Mode sem resetar a conta"
                            >
                                Sair
                            </button>
                        </div>
                    ) : riskRatio > 0.8 ? (
                        <span className="text-rose-400">RISCO ALTO</span>
                    ) : riskRatio > 0.5 ? (
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
                    <MiniEquityChart data={equityHistory.map(p => p.equity)} />
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
                                {/* 2026-08-17: FIX DE BUG — somava `order.amount` (exposição em USD)
                                    e rotulava o resultado como "lotes total". Mesma classe de erro do
                                    comentário logo abaixo (linha ~1128): dólar não é lote. Corrigido pra
                                    somar a MESMA conversão usada por posição (nocional / (lotSize × preço)). */}
                                {activeOrders.length} {activeOrders.length === 1 ? 'posição ativa' : 'posições ativas'} • {activeOrders.reduce((sum, order) => {
                                    const asset = getAssetBySymbol(order.symbol);
                                    const rawLots = asset && order.price > 0 ? order.amount / (asset.lotSize * order.price) : 0;
                                    // Arredonda pro lote real mínimo do ativo antes de somar — ver
                                    // comentário em lotSizeConversion.ts (2026-08-20): nocional/preço puro
                                    // pode cair abaixo do que qualquer corretora aceitaria (ex: 0.0021 de
                                    // BTC com mínimo real 0.01), então não deve ser exibido como se fosse
                                    // o lote de verdade.
                                    const floored = rawLots > 0 ? floorToLotStep(order.symbol, rawLots) : null;
                                    return sum + (floored && !floored.error ? floored.volume : 0);
                                }, 0).toFixed(2)} lotes total
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">P&L Total</div>
                            <div className={`text-lg font-bold font-mono ${activePnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatPnL(animatedActivePnL)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {activeOrders.map((order) => {
                        const pnl = order.currentProfit || 0;
                        const pnlPercent = order.price > 0 ? ((order.currentPrice! - order.price) / order.price * 100) * (order.side === 'LONG' ? 1 : -1) : 0;
                        // order.amount é o capital/exposição em USD alocado à posição
                        // (TradeVisual.amount, ver comentário em lotSizeConversion.ts),
                        // nunca uma contagem de lotes — antes essa contagem exibia esse
                        // valor em dólar como se fosse "lotes" e ainda multiplicava por
                        // preço de novo pro "Volume", inflando o número em milhões.
                        const asset = getAssetBySymbol(order.symbol);
                        const rawLots = asset && order.price > 0 ? order.amount / (asset.lotSize * order.price) : null;
                        // Arredonda pro lote real mínimo do ativo (ver lotSizeConversion.ts,
                        // 2026-08-20) — nunca exibe fração abaixo do que a corretora aceitaria.
                        const flooredLotCheck = rawLots !== null && rawLots > 0 ? floorToLotStep(order.symbol, rawLots) : null;
                        const estimatedLots = flooredLotCheck && !flooredLotCheck.error ? flooredLotCheck.volume : null;

                        return (
                            <div
                                key={order.id}
                                onClick={() => {
                                    setSelectedAsset(order.symbol);
                                    onNavigate?.('chart');
                                }}
                                className="bg-black/40 border border-white/10 rounded-lg p-3 hover:border-blue-500/50 transition-all group cursor-pointer"
                                title={`Ver ${order.symbol} no gráfico`}
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

                                    <div className="flex items-start gap-1.5">
                                        {/* ✅ P&L + Percentual Destacado */}
                                        <div className="flex flex-col items-end gap-0.5">
                                            <AnimatedOrderPnl value={pnl} className={`text-sm font-black font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                                            <div className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                pnlPercent >= 0
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-rose-500/20 text-rose-400'
                                            }`}>
                                                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                            </div>
                                        </div>

                                        {/* Fechar posição direto do banner — não precisa entrar no gráfico
                                            pra fechar. stopPropagation pra não disparar a navegação do card. */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const closePrice = order.currentPrice || order.price;
                                                closeManualPosition(order.id, closePrice);
                                                toast.success('Posição fechada', {
                                                    description: `${order.symbol} @ ${closePrice.toFixed(order.symbol.includes('JPY') ? 2 : 5)}`,
                                                });
                                            }}
                                            className="p-1 rounded bg-black/40 border border-white/10 text-neutral-500 hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-colors shrink-0"
                                            title="Fechar posição"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
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
                                        <span className="text-white font-mono font-bold">{estimatedLots !== null ? `${estimatedLots.toFixed(4)} lotes` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-neutral-500">Exposição:</span>
                                        <span className="text-neutral-300 font-mono">${order.amount.toFixed(2)}</span>
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
                            {/* ✅ 2026-07-17: nunca mais cai no `marketSignal?.insight` (texto sorteado de uma lista fixa, sem relação com o mercado real — causa do "Correção agressiva em andamento" fantasma) */}
                            {(hasScoreData ? scoreResult!.insight : null) || "Analisando fluxo de ordens..."}
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
                                {/* ✅ 2026-07-17: lê de `marketClassification` (fonte única) — antes
                                    recalculava score>60/<40 de novo aqui, duplicado */}
                                <h3 className={`text-base font-bold tracking-tight ${marketStatus === 'CLOSED' ? 'text-slate-500' : 'text-white'}`}>
                                    {marketStatus === 'CLOSED' ? "AGUARDANDO ABERTURA" : `${marketClassification.emoji} ${marketClassification.shortLabel}`}
                                </h3>
                                <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${marketClassification.badgeClass}`}>
                                    {marketClassification.badge}
                                </div>
                            </div>
                            
                            {/* Insight Detalhado */}
                            <div className="bg-black/30 border border-white/5 rounded-lg p-[17px]">
                                <div className="flex items-start gap-2">
                                    <Activity className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <p className="text-[12px] text-white leading-relaxed font-medium">
                                            {/* ✅ 2026-07-17: idem — sempre o insight real do motor, nunca mais o sorteio da lista fixa */}
                                            {(hasScoreData ? scoreResult!.insight : null) || "Analisando estrutura de mercado..."}
                                        </p>
                                        <p className="text-[11.5px] text-slate-400 leading-relaxed">
                                            {/* 🎯 2026-07-17: texto REAL derivado dos fatores do MarketScoreEngine (nunca mais alega "book de ordens"/"fluxo institucional" que não temos fonte real pra medir) */}
                                            {/* ✅ 2026-07-17: achado ao vivo — este parágrafo decidia o texto só
                                                por `scoreResult.regime` (ADX<18=LATERAL), TOTALMENTE independente
                                                da classificação/score já corrigidos hoje (thresholds 60/40). Um
                                                ativo em alta real mas gradual (ADX ainda baixo, indicador
                                                atrasado — mesmo padrão documentado com S&P e petróleo hoje)
                                                tinha score/rótulo dizendo "TENDÊNCIA DE ALTA" enquanto ESTE
                                                parágrafo, ignorando o score, sempre dizia "mercado lateralizado"
                                                — a mesma classe de contradição na mesma tela, só que numa 3ª
                                                fonte que ainda não tinha sido tocada. Fix: usa `classification`
                                                (já alinhado ao mesmo threshold do rótulo), não mais `regime` cru. */}
                                            {/* ✅ 2026-07-24: achado ao vivo pelo Cleber — este parágrafo tinha
                                                sua PRÓPRIA frase hardcoded pro caso LATERAL ("Osciladores
                                                interpretados como reversão à média..."), ignorando por completo
                                                o `insight` recalibrado do motor (que agora cita o movimento
                                                líquido recente via `netMove`, ex: "-1,40% mas sem estrutura
                                                confirmada"). Por isso a calibração de hoje não aparecia na tela
                                                pra nenhum ativo classificado LATERAL — 4ª fonte de texto
                                                dessincronizada do motor real, mesma classe de bug já corrigida
                                                várias vezes neste arquivo (ver histórico). Fix: LATERAL agora
                                                deriva de `scoreResult!.insight` (sempre o texto real e
                                                atualizado do motor) + a zona de consolidação como complemento,
                                                em vez de reconstruir a frase do zero. */}
                                            {hasRealScore ? (
                                                scoreResult!.classification === 'COMPRADOR'
                                                    ? `Pressão compradora${scoreResult!.regime === 'TENDENCIA' ? ` — tendência confirmada (ADX ${scoreResult!.indicators.adx?.toFixed(0) ?? '—'})` : ''}. Momentum ${scoreResult!.factors.momentum > 0 ? 'positivo' : 'negativo'}. Volume ${scoreResult!.indicators.volumeRatio != null && scoreResult!.indicators.volumeRatio > 1.2 ? 'acima da média, confirmando o movimento' : 'dentro da média'}.`
                                                    : scoreResult!.classification === 'VENDEDOR'
                                                    ? `Pressão vendedora${scoreResult!.regime === 'TENDENCIA' ? ` — tendência confirmada (ADX ${scoreResult!.indicators.adx?.toFixed(0) ?? '—'})` : ''}. Momentum ${scoreResult!.factors.momentum > 0 ? 'positivo' : 'negativo'}. Volume ${scoreResult!.indicators.volumeRatio != null && scoreResult!.indicators.volumeRatio > 1.2 ? 'acima da média, confirmando o movimento' : 'dentro da média'}.`
                                                    : `${scoreResult!.insight} Zona de consolidação entre ${formatPrice(stopLoss)} e ${formatPrice(target1)}.`
                                            ) : scoreResult?.provenance === 'unavailable' ? (
                                                // ✅ 2026-07-17: distingue "ainda carregando" de "falhou e o motivo é X" — nunca mais fica mudo
                                                scoreResult.insight
                                            ) : (
                                                `Calculando fatores técnicos reais (tendência, momentum, estrutura, volume)...`
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Métricas Principais - 3 Colunas */}
                        {/* 🎯 2026-07-17: valores REAIS do MarketScoreEngine — Confiança já era % de convergência dos fatores; Fluxo agora reflete o fator volume/OBV real; Volatilidade agora é ATR%/regime real (ADX+Bollinger), não mais |variação do dia| */}
                        <div className="grid grid-cols-3 gap-2">
                             <div className="bg-black/20 rounded p-2 border border-white/5">
                                 <span className="text-[9px] font-bold text-neutral-500 uppercase block mb-1">Confiança IA</span>
                                 <span className="text-lg font-bold text-purple-300">{hasRealScore ? scoreResult!.confidence : 0}%</span>
                             </div>
                             <div className="bg-black/20 rounded p-2 border border-white/5">
                                 <span className="text-[9px] font-bold text-neutral-500 uppercase block mb-1">Fluxo (Volume/OBV)</span>
                                 <span className={`text-sm font-bold ${
                                    !hasRealScore ? 'text-neutral-500' : scoreResult!.factors.volume > 0.15 ? 'text-emerald-400' : scoreResult!.factors.volume < -0.15 ? 'text-rose-400' : 'text-neutral-400'
                                 }`}>
                                    {!hasRealScore ? '—' : scoreResult!.factors.volume > 0.15 ? 'Acumul.' : scoreResult!.factors.volume < -0.15 ? 'Distrib.' : 'Neutro'}
                                 </span>
                             </div>
                             <div className="bg-black/20 rounded p-2 border border-white/5">
                                 <span className="text-[9px] font-bold text-neutral-500 uppercase block mb-1">Volatilidade</span>
                                 <span className={`text-sm font-bold ${
                                    !hasRealScore ? 'text-neutral-500'
                                    : (scoreResult!.indicators.atr != null && displayPrice > 0 && (scoreResult!.indicators.atr / displayPrice) * 100 > 1.5) ? 'text-orange-400' : 'text-blue-400'
                                 }`}>
                                    {!hasRealScore || scoreResult!.indicators.atr == null || displayPrice <= 0 ? '—' : (() => {
                                        const atrPct = (scoreResult!.indicators.atr! / displayPrice) * 100;
                                        return atrPct > 1.5 ? 'Alta' : atrPct > 0.5 ? 'Média' : 'Baixa';
                                    })()}
                                 </span>
                             </div>
                        </div>
                        
                        {/* Níveis de Operação */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Níveis Técnicos</span>
                                <span className="text-[8px] text-slate-500">{scoreResult?.regime ? `Regime: ${scoreResult.regime}` : 'Analisando...'}</span>
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
                                {/* 🎯 2026-07-17: valores REAIS do MarketScoreEngine (candles multi-TF), não mais derivados do próprio score */}
                                <div className="flex justify-between">
                                    <span className="text-slate-400">RSI (14):</span>
                                    <span className={`font-bold ${
                                        scoreResult?.indicators.rsi != null
                                            ? (scoreResult.indicators.rsi > 70 ? 'text-red-400' : scoreResult.indicators.rsi < 30 ? 'text-emerald-400' : 'text-white')
                                            : 'text-slate-500'
                                    }`}>
                                        {scoreResult?.indicators.rsi != null ? scoreResult.indicators.rsi.toFixed(1) : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">MACD:</span>
                                    <span className={`font-bold ${
                                        scoreResult?.indicators.macdHistogram != null
                                            ? (scoreResult.indicators.macdHistogram >= 0 ? 'text-emerald-400' : 'text-rose-400')
                                            : 'text-slate-500'
                                    }`}>
                                        {scoreResult?.indicators.macdHistogram != null ? (scoreResult.indicators.macdHistogram >= 0 ? 'ALTA' : 'BAIXA') : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Estocástico:</span>
                                    <span className={`font-bold ${
                                        scoreResult?.indicators.stochK != null
                                            ? (scoreResult.indicators.stochK > 80 ? 'text-red-400' : scoreResult.indicators.stochK < 20 ? 'text-emerald-400' : 'text-white')
                                            : 'text-slate-500'
                                    }`}>
                                        {scoreResult?.indicators.stochK != null ? scoreResult.indicators.stochK.toFixed(0) : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Médias (9/20/200):</span>
                                    <span className={`font-bold ${
                                        scoreResult ? (scoreResult.factors.trend > 0.1 ? 'text-emerald-400' : scoreResult.factors.trend < -0.1 ? 'text-rose-400' : 'text-white') : 'text-slate-500'
                                    }`}>
                                        {scoreResult ? (scoreResult.factors.trend > 0.1 ? 'Alta' : scoreResult.factors.trend < -0.1 ? 'Baixa' : 'Neutro') : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Volume:</span>
                                    <span className="font-bold text-yellow-400">
                                        {scoreResult?.indicators.volumeRatio != null ? (scoreResult.indicators.volumeRatio > 1.3 ? 'Alto' : scoreResult.indicators.volumeRatio < 0.7 ? 'Baixo' : 'Normal') : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Confiança:</span>
                                    <span className={`font-bold ${
                                        scoreResult ? (scoreResult.confidence >= 65 ? 'text-emerald-400' : scoreResult.confidence >= 40 ? 'text-yellow-400' : 'text-rose-400') : 'text-slate-500'
                                    }`}>
                                        {scoreResult ? `${scoreResult.confidence}%` : '—'}
                                    </span>
                                </div>
                                {/* 🎯 2026-07-18: Book real (Binance, order book) — SÓ cripto, só quando
                                    a busca teve sucesso. Nunca renderiza "—" pra ativo sem book (forex/
                                    índice/commodity): esse dado estruturalmente não existe pra eles
                                    (Infinox/MetaAPI confirmado sem DOM, testado ao vivo em 2026-07-18)
                                    — melhor ausente do que fingir indisponibilidade transitória. Fora da
                                    fórmula ponderada do score (ver MarketScoreEngine.ts), só contexto. */}
                                {scoreResult?.microstructure && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Book (Binance):</span>
                                        <span className={`font-bold ${
                                            scoreResult.microstructure.imbalance.imbalance > 15 ? 'text-emerald-400'
                                            : scoreResult.microstructure.imbalance.imbalance < -15 ? 'text-rose-400'
                                            : 'text-white'
                                        }`}>
                                            {scoreResult.microstructure.imbalance.imbalance > 0 ? '+' : ''}
                                            {scoreResult.microstructure.imbalance.imbalance.toFixed(0)}%
                                        </span>
                                    </div>
                                )}
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
                                    {/* 🆕 FIX 2026-08-17: esse card mostrava "SETUP VALIDADO - ENTRADA
                                        RECOMENDADA" com preço/stop/R:R fabricados aqui mesmo (linhas
                                        785-787, ±0.5%/1% do preço atual) — sem NENHUMA relação com o
                                        motor real (runTradingCycle + evaluateStrategyAt), que é quem de
                                        fato decide entrada e passa por 6 gates (custo, contexto/regime,
                                        correlação, cooldown, limite diário, tamanho mínimo). Achado ao
                                        vivo: usuário via "entrada recomendada" aqui e a IA nunca abria
                                        nada, porque são dois sistemas desconectados — o texto prometia
                                        uma ação que esse painel não tem poder de causar. Copy corrigida
                                        pra descrever leitura de mercado (o que o Market Score de fato é),
                                        não recomendação de entrada. */}
                                    <p className="text-[10px] font-bold text-white uppercase">
                                        {score > 60 ? '📊 VIÉS DE ALTA — LEITURA DE MERCADO' :
                                         score < 40 ? '⚠ VIÉS DE BAIXA — PRESSÃO VENDEDORA' :
                                         '⏸ MERCADO INDECISO'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        {score > 60 ? `Viés técnico de alta (score ${score}/100). Não é uma ordem de entrada — a decisão real do AI Trader depende da estratégia ativa e dos gates de risco configurados na sua sessão.` :
                                         score < 40 ? `Mercado sob pressão vendedora (score ${score}/100). Aguardar estabilização acima de ${formatPrice(target1)} antes de considerar operar.` :
                                         `Mercado sem direção clara. Aguardar rompimento de ${formatPrice(target1)} (alta) ou ${formatPrice(stopLoss)} (baixa).`}
                                    </p>
                                </div>
                            </div>
                        </div>
                     </div>
                 </Card>
            </div>

            {/* COL 3: ANÁLISE POR FONTE - EXPANDIDO 25% */}
            <div className="col-span-1 lg:col-span-5 h-full flex flex-col min-h-[400px]">
                {/* Usar displayPrice (preço atual) e displayTrend (% de mudança diária) */}
                <NexusQuantumAdvisor
                  activeSymbol={activeSymbol}
                  scoreResult={scoreResult}
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
          setActiveSymbol(symbol); // Só o Dashboard muda — não afeta o Gráfico
          setIsAssetsBrowserOpen(false);
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