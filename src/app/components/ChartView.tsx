import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { init, dispose, getSupportedOverlays, registerOverlay, registerYAxis } from 'klinecharts';
import type { KLineData, OverlayTemplate, AxisTemplate } from 'klinecharts';
import { 
  TrendingUp, 
  TrendingDown,
  ChevronDown,
  Settings,
  Activity,
  Clock,
  Search,
  MousePointer,
  TrendingUpDown,
  Minus,
  Square,
  Circle,
  Triangle,
  Type,
  Pencil,
  Eraser,
  Crosshair,
  GitBranch,
  Ruler,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  Smile,
  MessageSquare,
  Magnet as MagnetIcon,
  Navigation,
  Target,
  Zap,
  Move,
  RotateCcw,
  X,
  Trophy
} from 'lucide-react';

// 🚀 LAZY LOAD: LiquidityDetector carrega apenas quando necessário
const LiquidityDetector = lazy(() => import('@/app/components/LiquidityDetector').then(m => ({ default: m.LiquidityDetector })));

import { DrawingToolbar } from '@/app/components/chart/DrawingToolbar';
import { DrawingContextToolbar } from '@/app/components/chart/DrawingContextToolbar';
import { BacktestReplayBar } from '@/app/components/backtest/BacktestReplayBar';
import { BacktestConfigModal } from '@/app/components/backtest/BacktestConfigModal';
import { StrategyBuilderPro } from '@/app/components/backtest/StrategyBuilderPro';
import { BacktestLiveProgress } from '@/app/components/backtest/BacktestLiveProgress';
import { BacktestDecisionsPanel } from '@/app/components/backtest/BacktestDecisionsPanel';
import { AIvsTraderMode } from '@/app/components/backtest/AIvsTraderMode';
import { BacktestErrorBoundary } from '@/app/components/backtest/BacktestErrorBoundary';
import { useBacktestLiveProgress } from '@/app/hooks/useBacktestLiveProgress';
import { SmartScrollContainer } from '@/app/components/SmartScrollContainer';
import { type MarketAsset } from '@/app/data/market-assets';
import { fetchCandles, fetchQuote, calculateDailyChange } from '@/app/services/market-service';
import { getRealMarketData } from '@/app/services/RealMarketDataService';
import { dataSourceRouter } from '@/app/services/DataSourceRouter'; // 🎯 Roteamento inteligente de fontes
import { getUnifiedMarketData, subscribeToRealtimeData } from '@/app/services/UnifiedMarketDataService'; // 🎯 WebSocket streaming
import { debugLog, DEBUG_CONFIG } from '@/app/config/debug'; // 🔥 Sistema de debug otimizado
import { useTradingContext } from '@/app/contexts/TradingContext'; // 🔥 NOVO: Contexto global
import { toast } from 'sonner';

// 🎯 CUSTOM OVERLAY: Point Marker (Ponto 1x1)
const PointMarkerOverlay: OverlayTemplate = {
  name: 'pointMarker',
  totalStep: 1, // Apenas 1 clique necessário
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length > 0) {
      const point = coordinates[0];
      return {
        type: 'circle',
        attrs: {
          x: point.x,
          y: point.y,
          r: 3, // Raio de 3 pixels (visível mas pequeno)
        },
        styles: {
          style: 'fill',
          color: overlay.styles?.circle?.color || '#3b82f6',
        }
      };
    }
    return [];
  }
};

// Registrar o overlay customizado
try {
  registerOverlay(PointMarkerOverlay);
  console.log('[ChartView] ✅ Point Marker overlay registrado');
} catch (e) {
  console.warn('[ChartView] ⚠️ Overlay já registrado ou erro:', e);
}

// 🎯 CUSTOM OVERLAY: Fibonacci Extension (Extensão de Fibonacci com 3 pontos)
const FibonacciExtensionOverlay: OverlayTemplate = {
  name: 'fibonacciExtension',
  totalStep: 3, // 3 pontos necessários (A, B, C)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay, precision }: any) => {
    const figures: any[] = [];
    
    if (coordinates.length >= 2) {
      // Desenhar linha entre os pontos
      for (let i = 0; i < coordinates.length - 1; i++) {
        figures.push({
          type: 'line',
          attrs: {
            coordinates: [
              { x: coordinates[i].x, y: coordinates[i].y },
              { x: coordinates[i + 1].x, y: coordinates[i + 1].y }
            ]
          },
          styles: {
            style: 'solid',
            color: overlay.styles?.line?.color || '#2962FF'
          }
        });
      }
      
      // Se temos 3 pontos, calcular e desenhar níveis de extensão
      if (coordinates.length === 3) {
        const [pointA, pointB, pointC] = coordinates;
        const range = Math.abs(pointB.y - pointA.y);
        
        // Níveis de extensão Fibonacci: 0.618, 1.0, 1.618, 2.618
        const levels = [0.618, 1.0, 1.618, 2.618];
        const direction = pointB.y > pointA.y ? 1 : -1;
        
        levels.forEach((level, index) => {
          const y = pointC.y + (range * level * direction);
          const colors = ['#26a69a', '#2962FF', '#f23645', '#ff9800'];
          
          figures.push({
            type: 'line',
            attrs: {
              coordinates: [
                { x: pointC.x, y: y },
                { x: coordinates[coordinates.length - 1].x + 100, y: y }
              ]
            },
            styles: {
              style: 'dashed',
              color: colors[index] || '#808080',
              dashValue: [4, 4]
            }
          });
          
          // Label com o nível
          figures.push({
            type: 'text',
            attrs: {
              x: pointC.x + 10,
              y: y - 5,
              text: `${(level * 100).toFixed(1)}%`
            },
            styles: {
              color: colors[index] || '#808080',
              size: 12
            }
          });
        });
      }
    }
    
    return figures;
  }
};

// Registrar o overlay de Extensão de Fibonacci
try {
  registerOverlay(FibonacciExtensionOverlay);
  console.log('[ChartView] ✅ Fibonacci Extension overlay registrado');
} catch (e) {
  console.warn('[ChartView] ⚠️ Fibonacci Extension overlay já registrado ou erro:', e);
}

type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '1D' | '1W' | '1M';

type DrawingTool = 
  | 'crosshair'
  | 'trend'
  | 'fibonacci_gann'
  | 'forecast_measure'
  | 'shapes'
  | 'annotation'
  | 'icons'
  | 'measure'
  | 'zoom'
  | 'magnet'
  | 'lock'
  | 'hide'
  | 'remove';

interface LiquidityZone {
  id: string;
  price: number;
  strength: number;
  type: 'support' | 'resistance';
  touches: number;
  volume: number;
  distance: number;
  significance: 'critical' | 'strong' | 'moderate' | 'weak';
}

interface TradingSignal {
  type: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number; // 0-100
  reasons: string[];
  rsi: number;
  trend: 'bullish' | 'bearish' | 'sideways';
}

// 🆕 INDICATOR DEFINITIONS
interface IndicatorConfig {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'support_resistance';
  klinechartsName: string; // Nome do indicador no KLineCharts
  defaultParams?: any;
  isPaneIndicator?: boolean; // true = painel separado, false = overlay no gráfico principal
}

const INDICATORS: IndicatorConfig[] = [
  // ===== TENDÊNCIA (TREND) =====
  {
    id: 'ma',
    name: 'MA - Média Móvel Simples',
    description: 'Simple Moving Average',
    category: 'trend',
    klinechartsName: 'MA',
    defaultParams: [5, 10, 20, 60],
    isPaneIndicator: false
  },
  {
    id: 'ema',
    name: 'EMA - Média Móvel Exponencial',
    description: 'Exponential Moving Average',
    category: 'trend',
    klinechartsName: 'EMA',
    defaultParams: [6, 12, 20],
    isPaneIndicator: false
  },
  {
    id: 'sma',
    name: 'SMA - Média Móvel Simples',
    description: 'Simple Moving Average',
    category: 'trend',
    klinechartsName: 'SMA',
    defaultParams: [12, 26],
    isPaneIndicator: false
  },
  {
    id: 'wma',
    name: 'WMA - Média Móvel Ponderada',
    description: 'Weighted Moving Average',
    category: 'trend',
    klinechartsName: 'WMA',
    defaultParams: [5, 10, 20, 60],
    isPaneIndicator: false
  },
  {
    id: 'sar',
    name: 'SAR - Parabolic SAR',
    description: 'Parabolic Stop and Reverse',
    category: 'trend',
    klinechartsName: 'SAR',
    defaultParams: [2, 2, 20],
    isPaneIndicator: false
  },
  {
    id: 'dmi',
    name: 'DMI - Directional Movement Index',
    description: 'Índice de Movimento Direcional',
    category: 'trend',
    klinechartsName: 'DMI',
    defaultParams: [14, 6],
    isPaneIndicator: true
  },
  {
    id: 'adx',
    name: 'ADX - Average Directional Index',
    description: 'Força da Tendência',
    category: 'trend',
    klinechartsName: 'DMA',
    defaultParams: [10, 50, 10, 50],
    isPaneIndicator: false
  },
  
  // ===== MOMENTUM =====
  {
    id: 'rsi',
    name: 'RSI - Relative Strength Index',
    description: 'Índice de Força Relativa',
    category: 'momentum',
    klinechartsName: 'RSI',
    defaultParams: [6, 12, 24],
    isPaneIndicator: true
  },
  {
    id: 'macd',
    name: 'MACD - Moving Average Convergence Divergence',
    description: 'Convergência/Divergência de Médias',
    category: 'momentum',
    klinechartsName: 'MACD',
    defaultParams: [12, 26, 9],
    isPaneIndicator: true
  },
  {
    id: 'kdj',
    name: 'KDJ - Stochastic Oscillator',
    description: 'Oscilador Estocástico',
    category: 'momentum',
    klinechartsName: 'KDJ',
    defaultParams: [9, 3, 3],
    isPaneIndicator: true
  },
  {
    id: 'cci',
    name: 'CCI - Commodity Channel Index',
    description: 'Índice de Canal de Commodities',
    category: 'momentum',
    klinechartsName: 'CCI',
    defaultParams: [13],
    isPaneIndicator: true
  },
  {
    id: 'wr',
    name: 'WR - Williams %R',
    description: 'Williams Percent Range',
    category: 'momentum',
    klinechartsName: 'WR',
    defaultParams: [6, 10, 14],
    isPaneIndicator: true
  },
  {
    id: 'roc',
    name: 'ROC - Rate of Change',
    description: 'Taxa de Mudança',
    category: 'momentum',
    klinechartsName: 'ROC',
    defaultParams: [12, 6],
    isPaneIndicator: true
  },
  {
    id: 'mtm',
    name: 'MTM - Momentum',
    description: 'Momentum do Preço',
    category: 'momentum',
    klinechartsName: 'MTM',
    defaultParams: [12, 6],
    isPaneIndicator: true
  },
  
  // ===== VOLATILIDADE =====
  {
    id: 'boll',
    name: 'BOLL - Bollinger Bands',
    description: 'Bandas de Bollinger',
    category: 'volatility',
    klinechartsName: 'BOLL',
    defaultParams: [20, 2],
    isPaneIndicator: false
  },
  {
    id: 'atr',
    name: 'ATR - Average True Range',
    description: 'Amplitude Média Verdadeira',
    category: 'volatility',
    klinechartsName: 'ATR',
    defaultParams: [14],
    isPaneIndicator: true
  },
  {
    id: 'dc',
    name: 'DC - Donchian Channel',
    description: 'Canal de Donchian',
    category: 'volatility',
    klinechartsName: 'DC',
    defaultParams: [20],
    isPaneIndicator: false
  },
  
  // ===== VOLUME =====
  {
    id: 'vol',
    name: 'VOL - Volume',
    description: 'Volume de Negociação',
    category: 'volume',
    klinechartsName: 'VOL',
    defaultParams: [5, 10, 20],
    isPaneIndicator: true
  },
  {
    id: 'obv',
    name: 'OBV - On Balance Volume',
    description: 'Volume em Balanço',
    category: 'volume',
    klinechartsName: 'OBV',
    defaultParams: [30],
    isPaneIndicator: true
  },
  {
    id: 'vr',
    name: 'VR - Volume Ratio',
    description: 'Relação de Volume',
    category: 'volume',
    klinechartsName: 'VR',
    defaultParams: [26, 6],
    isPaneIndicator: true
  },
  
  // ===== SUPORTE & RESISTÊNCIA =====
  {
    id: 'pivot',
    name: 'Pivot Points',
    description: 'Pontos de Pivô',
    category: 'support_resistance',
    klinechartsName: 'PVT',
    defaultParams: [],
    isPaneIndicator: false
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci Retracement',
    description: 'Retração de Fibonacci',
    category: 'support_resistance',
    klinechartsName: 'FIBONACCIRETRACEMENT',
    defaultParams: [],
    isPaneIndicator: false
  },
];

// ✅ FUNÇÃO DE FORMATAÇÃO INTERNACIONAL (estilo TradingView/Binance)
function formatBrazilianPrice(price: number, decimals: number = 2): string {
  // Formatar com ponto decimal, SEM separador de milhares (padrão trading profissional)
  return price.toFixed(decimals);
}

export function ChartView() {
  // 🔥 NOVO: Sincronizar com contexto global
  const { selectedAsset, setSelectedAsset } = useTradingContext();
  
  // ❌ REMOVIDO: useMarketData() - agora usamos apenas os candles do gráfico
  
  const [timeframe, setTimeframe] = useState<Timeframe>('1H');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null); // 🔥 Null até carregar dados reais
  const [displayedPrice, setDisplayedPrice] = useState<number | null>(null); // Preço exibido (throttled para UI)
  const [openPrice, setOpenPrice] = useState<number | null>(null); // 🔥 Null até carregar dados reais
  const [dailyChange, setDailyChange] = useState(0);
  const [dailyChangePercent, setDailyChangePercent] = useState(0);
  const [isPositive, setIsPositive] = useState(true);
  const [candleCountdown, setCandleCountdown] = useState(0);
  const [showAssetList, setShowAssetList] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(selectedAsset || 'BTCUSD'); // 🔥 Inicializar com ativo global
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string>('Todos'); // 🆕 Filtro de categoria
  const [activeTool, setActiveTool] = useState<DrawingTool>('crosshair');
  const [liquidityZones, setLiquidityZones] = useState<LiquidityZone[]>([]);
  const [tradingSignal, setTradingSignal] = useState<TradingSignal>({
    type: 'NEUTRAL',
    strength: 0,
    reasons: [],
    rsi: 50,
    trend: 'sideways'
  });
  const [chartData, setChartData] = useState<KLineData[]>([]);
  const chartDataRef = useRef<KLineData[]>([]); // 🆕 Ref para evitar loop infinito no useEffect
  const [dataSource, setDataSource] = useState<'metaapi' | 'generated' | 'loading'>('loading');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showBacktestReplay, setShowBacktestReplay] = useState(false); // 🆕 Controle do Backtest/Replay
  const [showBacktestConfig, setShowBacktestConfig] = useState(false); // 🆕 Modal de configuração do Backtest
  const [showStrategyBuilder, setShowStrategyBuilder] = useState(false); // 🆕 Construtor de estratégias
  const [isReplayMode, setIsReplayMode] = useState(false); // 🆕 Flag para modo replay (efeito visual)
  
  // 🎯 BACKTEST LIVE PROGRESS
  const backtestProgress = useBacktestLiveProgress(10000);
  const [showDecisionsPanel, setShowDecisionsPanel] = useState(false);
  const [showAIvsTrader, setShowAIvsTrader] = useState(false);
  const [timeframeExpanded, setTimeframeExpanded] = useState(false);
  const [priceLinePosition, setPriceLinePosition] = useState<number | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set()); // 🆕 Indicadores ativos
  const [indicatorSearchTerm, setIndicatorSearchTerm] = useState(''); // 🆕 Busca de indicadores
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // 🆕 Filtro por categoria
  
  // 🧹 CLEANUP: Previne erro do Figma iframe ao desmontar
  useEffect(() => {
    return () => {
      setShowDecisionsPanel(false);
      setShowAIvsTrader(false);
      setShowBacktestReplay(false);
      setShowBacktestConfig(false);
      setShowStrategyBuilder(false);
    };
  }, []);
  const [crosshairMode, setCrosshairMode] = useState<'point' | 'arrow' | 'presentation' | 'eraser'>('arrow'); // 🆕 Modo da cruz - PADRÃO: SETA
  const [dataWindowEnabled, setDataWindowEnabled] = useState(true); // 🆕 Janela de dados com clique longo
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null); // 🆕 Ferramenta de desenho ativa
  const [showContextToolbar, setShowContextToolbar] = useState(false); // 🆕 Mostrar toolbar contextual
  const [contextToolbarPosition, setContextToolbarPosition] = useState({ x: 0, y: 0 }); // 🆕 Posição da toolbar
  const [selectedDrawing, setSelectedDrawing] = useState<any>(null); // 🆕 Desenho selecionado
  const [showPresentationBanner, setShowPresentationBanner] = useState(false); // 🆕 Banner do modo apresentação
  const [isCommandPressed, setIsCommandPressed] = useState(false); // 🆕 Detectar Command/Ctrl pressionado
  const [isDrawing, setIsDrawing] = useState(false); // 🆕 Estado de desenho ativo
  const [drawingPath, setDrawingPath] = useState<{ x: number; y: number }[]>([]); // 🆕 Caminho do desenho
  const canvasRef = useRef<HTMLCanvasElement>(null); // 🆕 Canvas para desenho livre
  
  // 🆕 TEXTO NO GRÁFICO - Estados para adicionar texto
  const [isAddingText, setIsAddingText] = useState(false); // Modo de adicionar texto
  const [textInput, setTextInput] = useState(''); // Texto sendo digitado
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null); // Posição do texto
  const [chartTexts, setChartTexts] = useState<Array<{ id: string; text: string; x: number; y: number }>>([]); // Textos no gráfico
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartIdRef = useRef<string>('chart-' + Math.random().toString(36).substring(7));
  const chartInstanceRef = useRef<any>(null);
  const assetListRef = useRef<HTMLDivElement>(null); // 🆕 Ref para o asset list
  const isInitialLoadRef = useRef<boolean>(true); // 🆕 Rastrear se é primeira carga (para evitar auto-scroll infinito)

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '1D', '1W', '1M'];
  const visibleTimeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1H'];

  // Drawing tools configuration - 13 categories
  const drawingTools = [
    { id: 'crosshair' as DrawingTool, icon: Crosshair, label: 'Cruz', shortcut: 'Alt + C' },
    { id: 'trend' as DrawingTool, icon: TrendingUpDown, label: 'Ferramenta de Tendência', shortcut: 'Alt + T' },
    { id: 'fibonacci_gann' as DrawingTool, icon: GitBranch, label: 'Fibonacci / GANN', shortcut: 'Alt + F' },
    { id: 'forecast_measure' as DrawingTool, icon: Ruler, label: 'Previsão e Medição', shortcut: 'Alt + P' },
    { id: 'shapes' as DrawingTool, icon: Square, label: 'Formas Geométricas', shortcut: 'Alt + S' },
    { id: 'annotation' as DrawingTool, icon: Type, label: 'Anotação', shortcut: 'Alt + A' },
    { id: 'icons' as DrawingTool, icon: Smile, label: 'Ícones', shortcut: 'Alt + I' },
    'separator',
    { id: 'measure' as DrawingTool, icon: Ruler, label: 'Medir', shortcut: 'Alt + M' },
    { id: 'zoom' as DrawingTool, icon: ZoomIn, label: 'Zoom', shortcut: 'Alt + Z' },
    'separator',
    { id: 'magnet' as DrawingTool, icon: MagnetIcon, label: 'Modo Magnético', shortcut: 'Alt + G' },
    { id: 'lock' as DrawingTool, icon: Lock, label: 'Travar Desenhos', shortcut: 'Alt + L' },
    { id: 'hide' as DrawingTool, icon: Eye, label: 'Ocultar Desenhos', shortcut: 'Alt + H' },
    'separator',
    { id: 'remove' as DrawingTool, icon: Trash2, label: 'Remover Objetos', shortcut: 'Delete' },
  ];

  // 📊 Lista de ativos disponíveis - 300+ ativos reais (valores iniciais, serão atualizados)
  const staticAssetsBase: MarketAsset[] = [
    // CRYPTO (30 ativos)
    { symbol: 'BTCUSD', name: 'Bitcoin', bid: 86500, ask: 86502, change: -2400, changePercent: -2.70, category: 'Crypto' },
    { symbol: 'ETHUSD', name: 'Ethereum', bid: 3200, ask: 3201, change: -80, changePercent: -2.44, category: 'Crypto' },
    { symbol: 'BNBUSD', name: 'Binance Coin', bid: 645.20, ask: 645.30, change: 12.5, changePercent: 1.98, category: 'Crypto' },
    { symbol: 'XRPUSD', name: 'Ripple', bid: 0.5234, ask: 0.5235, change: 0.0124, changePercent: 2.42, category: 'Crypto' },
    { symbol: 'ADAUSD', name: 'Cardano', bid: 0.4521, ask: 0.4522, change: -0.0089, changePercent: -1.93, category: 'Crypto' },
    { symbol: 'DOGEUSD', name: 'Dogecoin', bid: 0.0812, ask: 0.0813, change: 0.0021, changePercent: 2.65, category: 'Crypto' },
    { symbol: 'SOLUSD', name: 'Solana', bid: 142.50, ask: 142.52, change: 4.2, changePercent: 3.04, category: 'Crypto' },
    { symbol: 'DOTUSD', name: 'Polkadot', bid: 6.45, ask: 6.46, change: -0.12, changePercent: -1.83, category: 'Crypto' },
    { symbol: 'MATICUSD', name: 'Polygon', bid: 0.8234, ask: 0.8235, change: 0.0456, changePercent: 5.87, category: 'Crypto' },
    { symbol: 'LTCUSD', name: 'Litecoin', bid: 95.40, ask: 95.42, change: -1.8, changePercent: -1.85, category: 'Crypto' },
    { symbol: 'TRXUSD', name: 'Tron', bid: 0.1045, ask: 0.1046, change: 0.0023, changePercent: 2.25, category: 'Crypto' },
    { symbol: 'AVAXUSD', name: 'Avalanche', bid: 38.20, ask: 38.22, change: 1.5, changePercent: 4.09, category: 'Crypto' },
    { symbol: 'LINKUSD', name: 'Chainlink', bid: 14.82, ask: 14.83, change: -0.34, changePercent: -2.24, category: 'Crypto' },
    { symbol: 'ATOMUSD', name: 'Cosmos', bid: 9.67, ask: 9.68, change: 0.28, changePercent: 2.98, category: 'Crypto' },
    { symbol: 'UNIUSD', name: 'Uniswap', bid: 7.23, ask: 7.24, change: -0.15, changePercent: -2.03, category: 'Crypto' },
    { symbol: 'XLMUSD', name: 'Stellar', bid: 0.1123, ask: 0.1124, change: 0.0034, changePercent: 3.12, category: 'Crypto' },
    { symbol: 'ALGOUSD', name: 'Algorand', bid: 0.1834, ask: 0.1835, change: -0.0045, changePercent: -2.39, category: 'Crypto' },
    { symbol: 'VETUSD', name: 'VeChain', bid: 0.0289, ask: 0.0290, change: 0.0012, changePercent: 4.34, category: 'Crypto' },
    { symbol: 'ICPUSD', name: 'Internet Computer', bid: 12.45, ask: 12.46, change: 0.67, changePercent: 5.68, category: 'Crypto' },
    { symbol: 'FILUSD', name: 'Filecoin', bid: 5.89, ask: 5.90, change: -0.23, changePercent: -3.76, category: 'Crypto' },
    { symbol: 'APTUSD', name: 'Aptos', bid: 8.34, ask: 8.35, change: 0.45, changePercent: 5.70, category: 'Crypto' },
    { symbol: 'NEARUSD', name: 'NEAR Protocol', bid: 3.67, ask: 3.68, change: 0.12, changePercent: 3.38, category: 'Crypto' },
    { symbol: 'ETCUSD', name: 'Ethereum Classic', bid: 24.50, ask: 24.52, change: -0.89, changePercent: -3.51, category: 'Crypto' },
    { symbol: 'GRTUSD', name: 'The Graph', bid: 0.1567, ask: 0.1568, change: 0.0089, changePercent: 6.02, category: 'Crypto' },
    { symbol: 'SANDUSD', name: 'The Sandbox', bid: 0.4512, ask: 0.4513, change: -0.0234, changePercent: -4.93, category: 'Crypto' },
    { symbol: 'MANAUSD', name: 'Decentraland', bid: 0.4234, ask: 0.4235, change: 0.0178, changePercent: 4.39, category: 'Crypto' },
    { symbol: 'APEUSD', name: 'ApeCoin', bid: 1.89, ask: 1.90, change: -0.08, changePercent: -4.06, category: 'Crypto' },
    { symbol: 'AXSUSD', name: 'Axie Infinity', bid: 7.12, ask: 7.13, change: 0.34, changePercent: 5.01, category: 'Crypto' },
    { symbol: 'GALAUSD', name: 'Gala', bid: 0.0289, ask: 0.0290, change: 0.0015, changePercent: 5.47, category: 'Crypto' },
    { symbol: 'FTMUSD', name: 'Fantom', bid: 0.3456, ask: 0.3457, change: -0.0189, changePercent: -5.18, category: 'Crypto' },

    // FOREX MAJORS (28 pares principais)
    { symbol: 'EURUSD', name: 'Euro / US Dollar', bid: 1.0412, ask: 1.0413, change: 0.0015, changePercent: 0.14, category: 'Forex' },
    { symbol: 'GBPUSD', name: 'British Pound / US Dollar', bid: 1.2245, ask: 1.2246, change: -0.0008, changePercent: -0.07, category: 'Forex' },
    { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', bid: 156.244, ask: 156.254, change: 0.348, changePercent: 0.22, category: 'Forex' },
    { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', bid: 0.9123, ask: 0.9124, change: -0.0012, changePercent: -0.13, category: 'Forex' },
    { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', bid: 0.6234, ask: 0.6235, change: 0.0023, changePercent: 0.37, category: 'Forex' },
    { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', bid: 1.3456, ask: 1.3457, change: -0.0034, changePercent: -0.25, category: 'Forex' },
    { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', bid: 0.5678, ask: 0.5679, change: 0.0012, changePercent: 0.21, category: 'Forex' },
    { symbol: 'EURGBP', name: 'Euro / British Pound', bid: 0.8501, ask: 0.8502, change: 0.0018, changePercent: 0.21, category: 'Forex' },
    { symbol: 'EURJPY', name: 'Euro / Japanese Yen', bid: 162.678, ask: 162.688, change: 0.456, changePercent: 0.28, category: 'Forex' },
    { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', bid: 191.234, ask: 191.244, change: -0.234, changePercent: -0.12, category: 'Forex' },
    { symbol: 'EURCHF', name: 'Euro / Swiss Franc', bid: 0.9501, ask: 0.9502, change: 0.0011, changePercent: 0.12, category: 'Forex' },
    { symbol: 'EURAUD', name: 'Euro / Australian Dollar', bid: 1.6701, ask: 1.6702, change: -0.0045, changePercent: -0.27, category: 'Forex' },
    { symbol: 'EURCAD', name: 'Euro / Canadian Dollar', bid: 1.4012, ask: 1.4013, change: 0.0023, changePercent: 0.16, category: 'Forex' },
    { symbol: 'GBPCHF', name: 'British Pound / Swiss Franc', bid: 1.1178, ask: 1.1179, change: -0.0023, changePercent: -0.21, category: 'Forex' },
    { symbol: 'GBPAUD', name: 'British Pound / Australian Dollar', bid: 1.9645, ask: 1.9646, change: 0.0078, changePercent: 0.40, category: 'Forex' },
    { symbol: 'GBPCAD', name: 'British Pound / Canadian Dollar', bid: 1.6478, ask: 1.6479, change: -0.0056, changePercent: -0.34, category: 'Forex' },
    { symbol: 'AUDCAD', name: 'Australian Dollar / Canadian Dollar', bid: 0.8389, ask: 0.8390, change: 0.0012, changePercent: 0.14, category: 'Forex' },
    { symbol: 'AUDJPY', name: 'Australian Dollar / Japanese Yen', bid: 97.423, ask: 97.433, change: 0.234, changePercent: 0.24, category: 'Forex' },
    { symbol: 'AUDNZD', name: 'Australian Dollar / New Zealand Dollar', bid: 1.0978, ask: 1.0979, change: -0.0034, changePercent: -0.31, category: 'Forex' },
    { symbol: 'CADJPY', name: 'Canadian Dollar / Japanese Yen', bid: 116.145, ask: 116.155, change: 0.345, changePercent: 0.30, category: 'Forex' },
    { symbol: 'CHFJPY', name: 'Swiss Franc / Japanese Yen', bid: 171.234, ask: 171.244, change: -0.456, changePercent: -0.27, category: 'Forex' },
    { symbol: 'NZDJPY', name: 'New Zealand Dollar / Japanese Yen', bid: 88.734, ask: 88.744, change: 0.123, changePercent: 0.14, category: 'Forex' },
    { symbol: 'NZDCAD', name: 'New Zealand Dollar / Canadian Dollar', bid: 0.7634, ask: 0.7635, change: -0.0023, changePercent: -0.30, category: 'Forex' },
    { symbol: 'NZDCHF', name: 'New Zealand Dollar / Swiss Franc', bid: 0.5178, ask: 0.5179, change: 0.0012, changePercent: 0.23, category: 'Forex' },
    { symbol: 'AUDCHF', name: 'Australian Dollar / Swiss Franc', bid: 0.5689, ask: 0.5690, change: -0.0015, changePercent: -0.26, category: 'Forex' },
    { symbol: 'CADCHF', name: 'Canadian Dollar / Swiss Franc', bid: 0.6781, ask: 0.6782, change: 0.0009, changePercent: 0.13, category: 'Forex' },
    { symbol: 'EURNZD', name: 'Euro / New Zealand Dollar', bid: 1.8334, ask: 1.8335, change: 0.0045, changePercent: 0.25, category: 'Forex' },
    { symbol: 'GBPNZD', name: 'British Pound / New Zealand Dollar', bid: 2.1567, ask: 2.1568, change: -0.0078, changePercent: -0.36, category: 'Forex' },

    // COMMODITIES (25 ativos)
    { symbol: 'XAUUSD', name: 'Gold', bid: 2678, ask: 2679, change: 12, changePercent: 0.45, category: 'Commodities' },
    { symbol: 'XAGUSD', name: 'Silver', bid: 31.45, ask: 31.46, change: -0.34, changePercent: -1.07, category: 'Commodities' },
    { symbol: 'XPTUSD', name: 'Platinum', bid: 945.20, ask: 945.40, change: 8.5, changePercent: 0.91, category: 'Commodities' },
    { symbol: 'XPDUSD', name: 'Palladium', bid: 1034.50, ask: 1034.70, change: -12.3, changePercent: -1.18, category: 'Commodities' },
    { symbol: 'XCUUSD', name: 'Copper', bid: 4.12, ask: 4.13, change: 0.05, changePercent: 1.23, category: 'Commodities' },
    { symbol: 'WTIUSD', name: 'WTI Crude Oil', bid: 68.45, ask: 68.47, change: -0.89, changePercent: -1.28, category: 'Commodities' },
    { symbol: 'BRENTUSD', name: 'Brent Crude Oil', bid: 72.34, ask: 72.36, change: -1.12, changePercent: -1.52, category: 'Commodities' },
    { symbol: 'NGAS', name: 'Natural Gas', bid: 3.234, ask: 3.236, change: 0.089, changePercent: 2.83, category: 'Commodities' },
    { symbol: 'UKOIL', name: 'UK Brent Oil', bid: 72.56, ask: 72.58, change: -0.98, changePercent: -1.33, category: 'Commodities' },
    { symbol: 'USOIL', name: 'US Crude Oil', bid: 68.67, ask: 68.69, change: -0.76, changePercent: -1.10, category: 'Commodities' },
    { symbol: 'CORN', name: 'Corn Futures', bid: 445.25, ask: 445.50, change: 3.25, changePercent: 0.73, category: 'Commodities' },
    { symbol: 'WHEAT', name: 'Wheat Futures', bid: 578.75, ask: 579.00, change: -5.50, changePercent: -0.94, category: 'Commodities' },
    { symbol: 'SOYBEAN', name: 'Soybean Futures', bid: 1234.50, ask: 1234.75, change: 12.25, changePercent: 1.00, category: 'Commodities' },
    { symbol: 'SUGAR', name: 'Sugar Futures', bid: 19.45, ask: 19.47, change: -0.23, changePercent: -1.17, category: 'Commodities' },
    { symbol: 'COFFEE', name: 'Coffee Futures', bid: 234.50, ask: 234.60, change: 4.30, changePercent: 1.87, category: 'Commodities' },
    { symbol: 'COCOA', name: 'Cocoa Futures', bid: 8945.00, ask: 8950.00, change: -78.00, changePercent: -0.86, category: 'Commodities' },
    { symbol: 'COTTON', name: 'Cotton Futures', bid: 78.45, ask: 78.50, change: 1.12, changePercent: 1.45, category: 'Commodities' },
    { symbol: 'LUMBER', name: 'Lumber Futures', bid: 456.75, ask: 457.00, change: -8.50, changePercent: -1.83, category: 'Commodities' },
    { symbol: 'HEATING_OIL', name: 'Heating Oil', bid: 2.345, ask: 2.347, change: -0.034, changePercent: -1.43, category: 'Commodities' },
    { symbol: 'RBOB_GAS', name: 'RBOB Gasoline', bid: 2.012, ask: 2.014, change: -0.023, changePercent: -1.13, category: 'Commodities' },
    { symbol: 'LEAN_HOGS', name: 'Lean Hogs', bid: 89.45, ask: 89.50, change: 2.15, changePercent: 2.46, category: 'Commodities' },
    { symbol: 'LIVE_CATTLE', name: 'Live Cattle', bid: 178.50, ask: 178.60, change: -1.25, changePercent: -0.70, category: 'Commodities' },
    { symbol: 'FEEDER_CATTLE', name: 'Feeder Cattle', bid: 256.75, ask: 256.85, change: 3.50, changePercent: 1.38, category: 'Commodities' },
    { symbol: 'OJ', name: 'Orange Juice', bid: 345.60, ask: 345.80, change: -4.20, changePercent: -1.20, category: 'Commodities' },
    { symbol: 'RICE', name: 'Rice Futures', bid: 16.78, ask: 16.80, change: 0.34, changePercent: 2.07, category: 'Commodities' },

    // ÍNDICES (40 ativos)
    { symbol: 'US30', name: 'Dow Jones', bid: 43875, ask: 43877, change: 53, changePercent: 0.12, category: 'Índices' },
    { symbol: 'NAS100', name: 'NASDAQ 100', bid: 21345, ask: 21347, change: 75, changePercent: 0.35, category: 'Índices' },
    { symbol: 'SPX500', name: 'S&P 500', bid: 5932, ask: 5933, change: 11, changePercent: 0.18, category: 'Índices' },
    { symbol: 'US2000', name: 'Russell 2000', bid: 2234.50, ask: 2234.70, change: -8.30, changePercent: -0.37, category: 'Índices' },
    { symbol: 'VIX', name: 'Volatility Index', bid: 16.45, ask: 16.47, change: -1.23, changePercent: -6.96, category: 'Índices' },
    { symbol: 'DXY', name: 'US Dollar Index', bid: 107.234, ask: 107.244, change: 0.123, changePercent: 0.11, category: 'Índices' },
    { symbol: 'GER40', name: 'DAX 40', bid: 19234.50, ask: 19235.00, change: 45.20, changePercent: 0.24, category: 'Índices' },
    { symbol: 'UK100', name: 'FTSE 100', bid: 8456.30, ask: 8456.80, change: -12.40, changePercent: -0.15, category: 'Índices' },
    { symbol: 'FRA40', name: 'CAC 40', bid: 7823.40, ask: 7823.90, change: 23.10, changePercent: 0.30, category: 'Índices' },
    { symbol: 'EU50', name: 'Euro Stoxx 50', bid: 4945.60, ask: 4946.10, change: 18.50, changePercent: 0.38, category: 'Índices' },
    { symbol: 'SPA35', name: 'IBEX 35', bid: 11678.20, ask: 11678.70, change: -34.50, changePercent: -0.29, category: 'Índices' },
    { symbol: 'ITA40', name: 'FTSE MIB', bid: 34567.80, ask: 34568.30, change: 78.20, changePercent: 0.23, category: 'Índices' },
    { symbol: 'NED25', name: 'AEX 25', bid: 923.45, ask: 923.50, change: -2.15, changePercent: -0.23, category: 'Índices' },
    { symbol: 'SUI20', name: 'SMI 20', bid: 12123.40, ask: 12123.90, change: 34.20, changePercent: 0.28, category: 'Índices' },
    { symbol: 'JPN225', name: 'Nikkei 225', bid: 38234.50, ask: 38235.00, change: 156.30, changePercent: 0.41, category: 'Índices' },
    { symbol: 'HK50', name: 'Hang Seng', bid: 19456.70, ask: 19457.20, change: -89.40, changePercent: -0.46, category: 'Índices' },
    { symbol: 'CHINA50', name: 'FTSE China A50', bid: 13234.20, ask: 13234.70, change: 45.80, changePercent: 0.35, category: 'Índices' },
    { symbol: 'AUS200', name: 'ASX 200', bid: 8123.40, ask: 8123.90, change: -23.50, changePercent: -0.29, category: 'Índices' },
    { symbol: 'INDIA50', name: 'Nifty 50', bid: 22345.60, ask: 22346.10, change: 78.90, changePercent: 0.35, category: 'Índices' },
    { symbol: 'SING', name: 'STI Singapore', bid: 3456.70, ask: 3456.80, change: -12.30, changePercent: -0.35, category: 'Índices' },
    { symbol: 'KOREA200', name: 'KOSPI 200', bid: 367.45, ask: 367.50, change: 2.15, changePercent: 0.59, category: 'Índices' },
    { symbol: 'TAIWAN', name: 'Taiwan Weighted', bid: 21234.50, ask: 21235.00, change: 89.20, changePercent: 0.42, category: 'Índices' },
    { symbol: 'BRA', name: 'Ibovespa', bid: 125678.50, ask: 125679.00, change: 456.30, changePercent: 0.36, category: 'Índices' },
    { symbol: 'MEX', name: 'IPC Mexico', bid: 56234.70, ask: 56235.20, change: -123.40, changePercent: -0.22, category: 'Índices' },
    { symbol: 'ARG', name: 'Merval Argentina', bid: 1678456.00, ask: 1678500.00, change: 8934.00, changePercent: 0.53, category: 'Índices' },
    { symbol: 'SA40', name: 'South Africa 40', bid: 78234.50, ask: 78235.00, change: -234.20, changePercent: -0.30, category: 'Índices' },
    { symbol: 'EGYPT', name: 'EGX 30', bid: 29234.50, ask: 29235.00, change: 123.40, changePercent: 0.42, category: 'Índices' },
    { symbol: 'TURKEY', name: 'BIST 100', bid: 9234.50, ask: 9234.60, change: -45.20, changePercent: -0.49, category: 'Índices' },
    { symbol: 'RUSSIA', name: 'MOEX Russia', bid: 3456.70, ask: 3456.80, change: 12.30, changePercent: 0.36, category: 'Índices' },
    { symbol: 'POLAND', name: 'WIG20', bid: 2234.50, ask: 2234.60, change: -8.90, changePercent: -0.40, category: 'Índices' },
    { symbol: 'CZECH', name: 'PX Prague', bid: 1567.80, ask: 1567.90, change: 5.60, changePercent: 0.36, category: 'Índices' },
    { symbol: 'HUNGARY', name: 'BUX Hungary', bid: 67234.50, ask: 67235.00, change: 234.20, changePercent: 0.35, category: 'Índices' },
    { symbol: 'NORWAY', name: 'OBX Norway', bid: 1234.50, ask: 1234.60, change: -4.20, changePercent: -0.34, category: 'Índices' },
    { symbol: 'SWEDEN', name: 'OMX Stockholm 30', bid: 2567.80, ask: 2567.90, change: 12.30, changePercent: 0.48, category: 'Índices' },
    { symbol: 'DENMARK', name: 'OMX Copenhagen 25', bid: 2123.40, ask: 2123.50, change: -5.60, changePercent: -0.26, category: 'Índices' },
    { symbol: 'FINLAND', name: 'OMX Helsinki 25', bid: 11234.50, ask: 11234.60, change: 34.20, changePercent: 0.30, category: 'Índices' },
    { symbol: 'BELGIUM', name: 'BEL 20', bid: 4123.40, ask: 4123.50, change: -12.30, changePercent: -0.30, category: 'Índices' },
    { symbol: 'AUSTRIA', name: 'ATX Austria', bid: 3567.80, ask: 3567.90, change: 8.90, changePercent: 0.25, category: 'Índices' },
    { symbol: 'PORTUGAL', name: 'PSI 20', bid: 6234.50, ask: 6234.60, change: 23.40, changePercent: 0.38, category: 'Índices' },
    { symbol: 'GREECE', name: 'Athens General', bid: 1456.70, ask: 1456.80, change: -5.60, changePercent: -0.38, category: 'Índices' },

    // STOCKS US (100 ações principais)
    { symbol: 'AAPL', name: 'Apple Inc', bid: 178.45, ask: 178.47, change: 2.34, changePercent: 1.33, category: 'Stocks US' },
    { symbol: 'MSFT', name: 'Microsoft Corp', bid: 412.50, ask: 412.52, change: -3.20, changePercent: -0.77, category: 'Stocks US' },
    { symbol: 'GOOGL', name: 'Alphabet Inc', bid: 142.30, ask: 142.32, change: 1.45, changePercent: 1.03, category: 'Stocks US' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', bid: 178.90, ask: 178.92, change: 2.10, changePercent: 1.19, category: 'Stocks US' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', bid: 845.60, ask: 845.65, change: 15.30, changePercent: 1.84, category: 'Stocks US' },
    { symbol: 'TSLA', name: 'Tesla Inc', bid: 234.50, ask: 234.52, change: -5.60, changePercent: -2.33, category: 'Stocks US' },
    { symbol: 'META', name: 'Meta Platforms', bid: 498.70, ask: 498.72, change: 8.90, changePercent: 1.82, category: 'Stocks US' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', bid: 445.30, ask: 445.35, change: 1.20, changePercent: 0.27, category: 'Stocks US' },
    { symbol: 'V', name: 'Visa Inc', bid: 278.90, ask: 278.92, change: 2.40, changePercent: 0.87, category: 'Stocks US' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', bid: 156.80, ask: 156.82, change: -0.90, changePercent: -0.57, category: 'Stocks US' },
    { symbol: 'WMT', name: 'Walmart Inc', bid: 167.50, ask: 167.52, change: 1.30, changePercent: 0.78, category: 'Stocks US' },
    { symbol: 'JPM', name: 'JPMorgan Chase', bid: 189.40, ask: 189.42, change: -1.50, changePercent: -0.79, category: 'Stocks US' },
    { symbol: 'MA', name: 'Mastercard Inc', bid: 456.70, ask: 456.72, change: 3.20, changePercent: 0.71, category: 'Stocks US' },
    { symbol: 'PG', name: 'Procter & Gamble', bid: 167.80, ask: 167.82, change: 0.60, changePercent: 0.36, category: 'Stocks US' },
    { symbol: 'UNH', name: 'UnitedHealth Group', bid: 523.40, ask: 523.45, change: -4.20, changePercent: -0.80, category: 'Stocks US' },
    { symbol: 'HD', name: 'Home Depot', bid: 389.60, ask: 389.62, change: 2.80, changePercent: 0.72, category: 'Stocks US' },
    { symbol: 'DIS', name: 'Walt Disney Co', bid: 98.70, ask: 98.72, change: -1.20, changePercent: -1.20, category: 'Stocks US' },
    { symbol: 'BAC', name: 'Bank of America', bid: 34.56, ask: 34.57, change: -0.23, changePercent: -0.66, category: 'Stocks US' },
    { symbol: 'NFLX', name: 'Netflix Inc', bid: 612.30, ask: 612.35, change: 8.90, changePercent: 1.47, category: 'Stocks US' },
    { symbol: 'ADBE', name: 'Adobe Inc', bid: 567.80, ask: 567.85, change: -3.40, changePercent: -0.60, category: 'Stocks US' },
    { symbol: 'CRM', name: 'Salesforce Inc', bid: 289.40, ask: 289.42, change: 4.50, changePercent: 1.58, category: 'Stocks US' },
    { symbol: 'CSCO', name: 'Cisco Systems', bid: 52.30, ask: 52.31, change: 0.40, changePercent: 0.77, category: 'Stocks US' },
    { symbol: 'INTC', name: 'Intel Corp', bid: 45.60, ask: 45.61, change: -0.80, changePercent: -1.72, category: 'Stocks US' },
    { symbol: 'PEP', name: 'PepsiCo Inc', bid: 178.90, ask: 178.92, change: 1.20, changePercent: 0.68, category: 'Stocks US' },
    { symbol: 'KO', name: 'Coca-Cola Co', bid: 61.20, ask: 61.21, change: 0.30, changePercent: 0.49, category: 'Stocks US' },
    { symbol: 'NKE', name: 'Nike Inc', bid: 112.30, ask: 112.32, change: -1.50, changePercent: -1.32, category: 'Stocks US' },
    { symbol: 'MRK', name: 'Merck & Co', bid: 123.40, ask: 123.42, change: 0.90, changePercent: 0.73, category: 'Stocks US' },
    { symbol: 'ABT', name: 'Abbott Labs', bid: 112.50, ask: 112.52, change: -0.60, changePercent: -0.53, category: 'Stocks US' },
    { symbol: 'TMO', name: 'Thermo Fisher', bid: 567.80, ask: 567.85, change: 3.20, changePercent: 0.57, category: 'Stocks US' },
    { symbol: 'COST', name: 'Costco Wholesale', bid: 789.40, ask: 789.45, change: 5.60, changePercent: 0.71, category: 'Stocks US' },
    { symbol: 'AVGO', name: 'Broadcom Inc', bid: 1234.50, ask: 1234.60, change: 12.30, changePercent: 1.01, category: 'Stocks US' },
    { symbol: 'LLY', name: 'Eli Lilly', bid: 678.90, ask: 678.95, change: -8.40, changePercent: -1.22, category: 'Stocks US' },
    { symbol: 'ORCL', name: 'Oracle Corp', bid: 123.40, ask: 123.42, change: 1.80, changePercent: 1.48, category: 'Stocks US' },
    { symbol: 'ACN', name: 'Accenture PLC', bid: 356.70, ask: 356.72, change: 2.40, changePercent: 0.68, category: 'Stocks US' },
    { symbol: 'AMD', name: 'Advanced Micro', bid: 167.80, ask: 167.82, change: -2.30, changePercent: -1.35, category: 'Stocks US' },
    { symbol: 'TXN', name: 'Texas Instruments', bid: 189.40, ask: 189.42, change: 1.20, changePercent: 0.64, category: 'Stocks US' },
    { symbol: 'QCOM', name: 'Qualcomm Inc', bid: 178.50, ask: 178.52, change: -1.40, changePercent: -0.78, category: 'Stocks US' },
    { symbol: 'AMGN', name: 'Amgen Inc', bid: 289.30, ask: 289.32, change: 2.10, changePercent: 0.73, category: 'Stocks US' },
    { symbol: 'HON', name: 'Honeywell Intl', bid: 212.40, ask: 212.42, change: -0.80, changePercent: -0.38, category: 'Stocks US' },
    { symbol: 'IBM', name: 'IBM Corp', bid: 189.70, ask: 189.72, change: 1.50, changePercent: 0.80, category: 'Stocks US' },
    { symbol: 'GE', name: 'General Electric', bid: 167.80, ask: 167.82, change: 2.30, changePercent: 1.39, category: 'Stocks US' },
    { symbol: 'CAT', name: 'Caterpillar Inc', bid: 345.60, ask: 345.62, change: -2.40, changePercent: -0.69, category: 'Stocks US' },
    { symbol: 'BA', name: 'Boeing Co', bid: 189.40, ask: 189.42, change: -3.50, changePercent: -1.81, category: 'Stocks US' },
    { symbol: 'GS', name: 'Goldman Sachs', bid: 456.70, ask: 456.72, change: 3.20, changePercent: 0.71, category: 'Stocks US' },
    { symbol: 'AXP', name: 'American Express', bid: 234.50, ask: 234.52, change: 1.80, changePercent: 0.77, category: 'Stocks US' },
    { symbol: 'MMM', name: '3M Company', bid: 112.30, ask: 112.32, change: -0.90, changePercent: -0.79, category: 'Stocks US' },
    { symbol: 'CVX', name: 'Chevron Corp', bid: 156.70, ask: 156.72, change: -2.10, changePercent: -1.32, category: 'Stocks US' },
    { symbol: 'XOM', name: 'Exxon Mobil', bid: 112.40, ask: 112.42, change: -1.30, changePercent: -1.14, category: 'Stocks US' },
    { symbol: 'SLB', name: 'Schlumberger', bid: 56.70, ask: 56.71, change: 0.80, changePercent: 1.43, category: 'Stocks US' },
    { symbol: 'COP', name: 'ConocoPhillips', bid: 123.40, ask: 123.42, change: -0.90, changePercent: -0.72, category: 'Stocks US' },
    { symbol: 'T', name: 'AT&T Inc', bid: 17.89, ask: 17.90, change: -0.12, changePercent: -0.67, category: 'Stocks US' },
    { symbol: 'VZ', name: 'Verizon Comm', bid: 41.23, ask: 41.24, change: 0.23, changePercent: 0.56, category: 'Stocks US' },
    { symbol: 'CMCSA', name: 'Comcast Corp', bid: 43.56, ask: 43.57, change: -0.34, changePercent: -0.77, category: 'Stocks US' },
    { symbol: 'TMUS', name: 'T-Mobile US', bid: 178.40, ask: 178.42, change: 2.10, changePercent: 1.19, category: 'Stocks US' },
    { symbol: 'NEE', name: 'NextEra Energy', bid: 67.80, ask: 67.81, change: 0.50, changePercent: 0.74, category: 'Stocks US' },
    { symbol: 'DUK', name: 'Duke Energy', bid: 103.40, ask: 103.42, change: -0.30, changePercent: -0.29, category: 'Stocks US' },
    { symbol: 'SO', name: 'Southern Co', bid: 84.50, ask: 84.51, change: 0.40, changePercent: 0.48, category: 'Stocks US' },
    { symbol: 'D', name: 'Dominion Energy', bid: 56.70, ask: 56.71, change: -0.20, changePercent: -0.35, category: 'Stocks US' },
    { symbol: 'UPS', name: 'United Parcel', bid: 156.80, ask: 156.82, change: 1.20, changePercent: 0.77, category: 'Stocks US' },
    { symbol: 'FDX', name: 'FedEx Corp', bid: 267.80, ask: 267.82, change: -2.30, changePercent: -0.85, category: 'Stocks US' },
    { symbol: 'LOW', name: 'Lowes Companies', bid: 234.50, ask: 234.52, change: 1.80, changePercent: 0.77, category: 'Stocks US' },
    { symbol: 'TGT', name: 'Target Corp', bid: 145.60, ask: 145.62, change: -1.20, changePercent: -0.82, category: 'Stocks US' },
    { symbol: 'SBUX', name: 'Starbucks Corp', bid: 98.70, ask: 98.72, change: 0.90, changePercent: 0.92, category: 'Stocks US' },
    { symbol: 'MCD', name: 'McDonalds Corp', bid: 289.40, ask: 289.42, change: 2.10, changePercent: 0.73, category: 'Stocks US' },
    { symbol: 'CVS', name: 'CVS Health', bid: 78.40, ask: 78.41, change: -0.60, changePercent: -0.76, category: 'Stocks US' },
    { symbol: 'WBA', name: 'Walgreens Boots', bid: 23.45, ask: 23.46, change: -0.34, changePercent: -1.43, category: 'Stocks US' },
    { symbol: 'DHR', name: 'Danaher Corp', bid: 234.50, ask: 234.52, change: 1.80, changePercent: 0.77, category: 'Stocks US' },
    { symbol: 'BMY', name: 'Bristol-Myers', bid: 56.70, ask: 56.71, change: 0.40, changePercent: 0.71, category: 'Stocks US' },
    { symbol: 'GILD', name: 'Gilead Sciences', bid: 89.40, ask: 89.41, change: -0.50, changePercent: -0.56, category: 'Stocks US' },
    { symbol: 'MDT', name: 'Medtronic PLC', bid: 87.60, ask: 87.61, change: 0.60, changePercent: 0.69, category: 'Stocks US' },
    { symbol: 'CI', name: 'Cigna Corp', bid: 345.60, ask: 345.62, change: -2.30, changePercent: -0.66, category: 'Stocks US' },
    { symbol: 'ANTM', name: 'Anthem Inc', bid: 456.70, ask: 456.72, change: 3.20, changePercent: 0.71, category: 'Stocks US' },
    { symbol: 'SYK', name: 'Stryker Corp', bid: 334.50, ask: 334.52, change: 2.10, changePercent: 0.63, category: 'Stocks US' },
    { symbol: 'BDX', name: 'Becton Dickinson', bid: 245.60, ask: 245.62, change: -1.20, changePercent: -0.49, category: 'Stocks US' },
    { symbol: 'ISRG', name: 'Intuitive Surgical', bid: 456.70, ask: 456.72, change: 5.60, changePercent: 1.24, category: 'Stocks US' },
    { symbol: 'REGN', name: 'Regeneron Pharma', bid: 912.30, ask: 912.40, change: -8.40, changePercent: -0.91, category: 'Stocks US' },
    { symbol: 'VRTX', name: 'Vertex Pharma', bid: 423.50, ask: 423.55, change: 6.70, changePercent: 1.61, category: 'Stocks US' },
    { symbol: 'BIIB', name: 'Biogen Inc', bid: 234.50, ask: 234.52, change: -3.20, changePercent: -1.35, category: 'Stocks US' },
    { symbol: 'ZTS', name: 'Zoetis Inc', bid: 178.40, ask: 178.42, change: 1.20, changePercent: 0.68, category: 'Stocks US' },
    { symbol: 'IDXX', name: 'IDEXX Labs', bid: 523.40, ask: 523.45, change: 4.20, changePercent: 0.81, category: 'Stocks US' },
    { symbol: 'PM', name: 'Philip Morris', bid: 98.70, ask: 98.72, change: 0.50, changePercent: 0.51, category: 'Stocks US' },
    { symbol: 'MO', name: 'Altria Group', bid: 45.60, ask: 45.61, change: -0.20, changePercent: -0.44, category: 'Stocks US' },
    { symbol: 'CL', name: 'Colgate-Palmolive', bid: 89.40, ask: 89.41, change: 0.30, changePercent: 0.34, category: 'Stocks US' },
    { symbol: 'EL', name: 'Estee Lauder', bid: 156.70, ask: 156.72, change: -2.10, changePercent: -1.32, category: 'Stocks US' },
    { symbol: 'GIS', name: 'General Mills', bid: 67.80, ask: 67.81, change: 0.40, changePercent: 0.59, category: 'Stocks US' },
    { symbol: 'KHC', name: 'Kraft Heinz', bid: 34.56, ask: 34.57, change: -0.23, changePercent: -0.66, category: 'Stocks US' },
    { symbol: 'MDLZ', name: 'Mondelez Intl', bid: 72.30, ask: 72.31, change: 0.50, changePercent: 0.70, category: 'Stocks US' },
    { symbol: 'KMB', name: 'Kimberly-Clark', bid: 134.50, ask: 134.52, change: -0.30, changePercent: -0.22, category: 'Stocks US' },
    { symbol: 'CLX', name: 'Clorox Co', bid: 156.70, ask: 156.72, change: 1.20, changePercent: 0.77, category: 'Stocks US' },
    { symbol: 'SJM', name: 'JM Smucker', bid: 123.40, ask: 123.42, change: -0.60, changePercent: -0.48, category: 'Stocks US' },
    { symbol: 'HSY', name: 'Hershey Co', bid: 189.40, ask: 189.42, change: 1.50, changePercent: 0.80, category: 'Stocks US' },
    { symbol: 'K', name: 'Kellogg Co', bid: 67.80, ask: 67.81, change: 0.30, changePercent: 0.44, category: 'Stocks US' },
    { symbol: 'CAG', name: 'Conagra Brands', bid: 34.56, ask: 34.57, change: -0.12, changePercent: -0.35, category: 'Stocks US' },
    { symbol: 'CPB', name: 'Campbell Soup', bid: 45.60, ask: 45.61, change: 0.20, changePercent: 0.44, category: 'Stocks US' },
    { symbol: 'HRL', name: 'Hormel Foods', bid: 34.56, ask: 34.57, change: -0.08, changePercent: -0.23, category: 'Stocks US' },
    { symbol: 'PYPL', name: 'PayPal Holdings', bid: 67.80, ask: 67.81, change: -1.20, changePercent: -1.74, category: 'Stocks US' },
    { symbol: 'SQ', name: 'Block Inc', bid: 78.40, ask: 78.41, change: 2.10, changePercent: 2.75, category: 'Stocks US' },
    { symbol: 'COIN', name: 'Coinbase Global', bid: 234.50, ask: 234.52, change: -5.60, changePercent: -2.33, category: 'Stocks US' },

    // STOCKS BRAZIL (50 ações)
    { symbol: 'PETR4', name: 'Petrobras PN', bid: 38.45, ask: 38.46, change: 0.78, changePercent: 2.07, category: 'Stocks BR' },
    { symbol: 'VALE3', name: 'Vale ON', bid: 64.23, ask: 64.24, change: -0.56, changePercent: -0.86, category: 'Stocks BR' },
    { symbol: 'ITUB4', name: 'Itaú Unibanco PN', bid: 28.90, ask: 28.91, change: 0.34, changePercent: 1.19, category: 'Stocks BR' },
    { symbol: 'BBDC4', name: 'Bradesco PN', bid: 13.45, ask: 13.46, change: -0.12, changePercent: -0.88, category: 'Stocks BR' },
    { symbol: 'BBAS3', name: 'Banco do Brasil ON', bid: 26.78, ask: 26.79, change: 0.45, changePercent: 1.71, category: 'Stocks BR' },
    { symbol: 'ABEV3', name: 'Ambev ON', bid: 11.23, ask: 11.24, change: -0.08, changePercent: -0.71, category: 'Stocks BR' },
    { symbol: 'WEGE3', name: 'WEG ON', bid: 42.56, ask: 42.57, change: 0.89, changePercent: 2.14, category: 'Stocks BR' },
    { symbol: 'RENT3', name: 'Localiza ON', bid: 58.90, ask: 58.91, change: -1.20, changePercent: -2.00, category: 'Stocks BR' },
    { symbol: 'SUZB3', name: 'Suzano ON', bid: 54.30, ask: 54.31, change: 1.10, changePercent: 2.07, category: 'Stocks BR' },
    { symbol: 'JBSS3', name: 'JBS ON', bid: 32.45, ask: 32.46, change: -0.45, changePercent: -1.37, category: 'Stocks BR' },
    { symbol: 'RAIL3', name: 'Rumo ON', bid: 19.67, ask: 19.68, change: 0.34, changePercent: 1.76, category: 'Stocks BR' },
    { symbol: 'VIVT3', name: 'Vivo ON', bid: 45.80, ask: 45.81, change: -0.23, changePercent: -0.50, category: 'Stocks BR' },
    { symbol: 'ELET3', name: 'Eletrobras ON', bid: 39.20, ask: 39.21, change: 0.67, changePercent: 1.74, category: 'Stocks BR' },
    { symbol: 'EMBR3', name: 'Embraer ON', bid: 38.90, ask: 38.91, change: 1.20, changePercent: 3.18, category: 'Stocks BR' },
    { symbol: 'RADL3', name: 'Raia Drogasil ON', bid: 24.56, ask: 24.57, change: -0.34, changePercent: -1.37, category: 'Stocks BR' },
    { symbol: 'HAPV3', name: 'Hapvida ON', bid: 3.45, ask: 3.46, change: -0.08, changePercent: -2.27, category: 'Stocks BR' },
    { symbol: 'PRIO3', name: 'PRIO ON', bid: 48.70, ask: 48.71, change: 0.89, changePercent: 1.86, category: 'Stocks BR' },
    { symbol: 'CSAN3', name: 'Cosan ON', bid: 14.20, ask: 14.21, change: -0.23, changePercent: -1.59, category: 'Stocks BR' },
    { symbol: 'KLBN11', name: 'Klabin Units', bid: 23.45, ask: 23.46, change: 0.45, changePercent: 1.96, category: 'Stocks BR' },
    { symbol: 'GOAU4', name: 'Gerdau PN', bid: 10.89, ask: 10.90, change: -0.12, changePercent: -1.09, category: 'Stocks BR' },
    { symbol: 'CSNA3', name: 'CSN ON', bid: 13.67, ask: 13.68, change: 0.23, changePercent: 1.71, category: 'Stocks BR' },
    { symbol: 'USIM5', name: 'Usiminas PNA', bid: 7.89, ask: 7.90, change: -0.15, changePercent: -1.87, category: 'Stocks BR' },
    { symbol: 'GGBR4', name: 'Gerdau PN', bid: 20.34, ask: 20.35, change: 0.34, changePercent: 1.70, category: 'Stocks BR' },
    { symbol: 'CIEL3', name: 'Cielo ON', bid: 5.67, ask: 5.68, change: -0.08, changePercent: -1.39, category: 'Stocks BR' },
    { symbol: 'B3SA3', name: 'B3 ON', bid: 11.45, ask: 11.46, change: 0.12, changePercent: 1.06, category: 'Stocks BR' },
    { symbol: 'SANB11', name: 'Santander Units', bid: 25.60, ask: 25.61, change: -0.34, changePercent: -1.31, category: 'Stocks BR' },
    { symbol: 'BBSE3', name: 'BB Seguridade ON', bid: 32.10, ask: 32.11, change: 0.45, changePercent: 1.42, category: 'Stocks BR' },
    { symbol: 'LREN3', name: 'Lojas Renner ON', bid: 16.78, ask: 16.79, change: -0.23, changePercent: -1.35, category: 'Stocks BR' },
    { symbol: 'MGLU3', name: 'Magazine Luiza ON', bid: 2.34, ask: 2.35, change: -0.06, changePercent: -2.50, category: 'Stocks BR' },
    { symbol: 'PETZ3', name: 'Petz ON', bid: 5.12, ask: 5.13, change: -0.12, changePercent: -2.29, category: 'Stocks BR' },
    { symbol: 'SOMA3', name: 'Grupo Soma ON', bid: 8.90, ask: 8.91, change: 0.15, changePercent: 1.71, category: 'Stocks BR' },
    { symbol: 'VVAR3', name: 'Via ON', bid: 1.67, ask: 1.68, change: -0.04, changePercent: -2.34, category: 'Stocks BR' },
    { symbol: 'AMER3', name: 'Americanas ON', bid: 0.89, ask: 0.90, change: -0.02, changePercent: -2.20, category: 'Stocks BR' },
    { symbol: 'CRFB3', name: 'Carrefour Brasil ON', bid: 12.34, ask: 12.35, change: 0.23, changePercent: 1.90, category: 'Stocks BR' },
    { symbol: 'ASAI3', name: 'Assaí ON', bid: 14.56, ask: 14.57, change: -0.18, changePercent: -1.22, category: 'Stocks BR' },
    { symbol: 'PCAR3', name: 'GPA ON', bid: 3.45, ask: 3.46, change: -0.08, changePercent: -2.27, category: 'Stocks BR' },
    { symbol: 'BEEF3', name: 'Minerva ON', bid: 8.67, ask: 8.68, change: 0.12, changePercent: 1.40, category: 'Stocks BR' },
    { symbol: 'MRFG3', name: 'Marfrig ON', bid: 7.89, ask: 7.90, change: -0.11, changePercent: -1.38, category: 'Stocks BR' },
    { symbol: 'BRFS3', name: 'BRF ON', bid: 18.90, ask: 18.91, change: 0.34, changePercent: 1.83, category: 'Stocks BR' },
    { symbol: 'SLCE3', name: 'SLC Agrícola ON', bid: 15.67, ask: 15.68, change: -0.23, changePercent: -1.45, category: 'Stocks BR' },
    { symbol: 'ALPA4', name: 'Alpargatas PN', bid: 6.78, ask: 6.79, change: 0.12, changePercent: 1.80, category: 'Stocks BR' },
    { symbol: 'GUAR3', name: 'Guararapes ON', bid: 7.45, ask: 7.46, change: -0.09, changePercent: -1.19, category: 'Stocks BR' },
    { symbol: 'MULT3', name: 'Multiplan ON', bid: 24.30, ask: 24.31, change: 0.45, changePercent: 1.89, category: 'Stocks BR' },
    { symbol: 'IGTI11', name: 'Iguatemi Units', bid: 21.50, ask: 21.51, change: -0.34, changePercent: -1.56, category: 'Stocks BR' },
    { symbol: 'BRML3', name: 'BR Malls ON', bid: 9.12, ask: 9.13, change: 0.18, changePercent: 2.01, category: 'Stocks BR' },
    { symbol: 'LWSA3', name: 'Locaweb ON', bid: 4.56, ask: 4.57, change: -0.12, changePercent: -2.56, category: 'Stocks BR' },
    { symbol: 'TOTS3', name: 'TOTVS ON', bid: 29.40, ask: 29.41, change: 0.67, changePercent: 2.33, category: 'Stocks BR' },
    { symbol: 'POSI3', name: 'Positivo ON', bid: 3.45, ask: 3.46, change: -0.08, changePercent: -2.27, category: 'Stocks BR' },
    { symbol: 'QUAL3', name: 'Qualicorp ON', bid: 5.67, ask: 5.68, change: 0.12, changePercent: 2.16, category: 'Stocks BR' },
    { symbol: 'FLRY3', name: 'Fleury ON', bid: 13.20, ask: 13.21, change: -0.18, changePercent: -1.35, category: 'Stocks BR' },
  ];

  // 🔥 NOVO: State para ativos com preços REAIS do MT5/APIs
  const [liveAssets, setLiveAssets] = useState<MarketAsset[]>(staticAssetsBase);

  // 🔥 NOVO: Buscar preços REAIS para os principais ativos ao carregar
  useEffect(() => {
    const updateLivePrices = async () => {
      console.log('[ChartView] 💰 Buscando preços REAIS para demonstrativo...');
      
      // Principais símbolos para atualizar (primeiros 50)
      const prioritySymbols = staticAssetsBase.slice(0, 50).map(a => a.symbol);
      
      const updatedAssets = await Promise.all(
        staticAssetsBase.map(async (asset) => {
          // Só buscar preços dos prioritários (evitar rate limit)
          if (!prioritySymbols.includes(asset.symbol)) {
            return asset;
          }
          
          try {
            const data = await dataSourceRouter.getMarketData(asset.symbol);
            
            if (data && data.price > 0 && !data.fallbackUsed) {
              console.log(`[ChartView] ✅ Preço atualizado ${asset.symbol}:`, data.price);
              
              const spread = data.price * 0.0002; // 0.02% spread típico
              return {
                ...asset,
                bid: data.price,
                ask: data.price + spread,
                change: data.change,
                changePercent: data.changePercent
              };
            }
          } catch (error) {
            console.warn(`[ChartView] ⚠️ Falha ao buscar ${asset.symbol}:`, error);
          }
          
          return asset; // Manter valor original se falhar
        })
      );
      
      setLiveAssets(updatedAssets);
      console.log('[ChartView] ✅ Demonstrativo atualizado com preços REAIS');
    };
    
    // Buscar na primeira vez
    updateLivePrices();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(updateLivePrices, 30000);
    
    return () => clearInterval(interval);
  }, []); // Executar apenas uma vez ao montar

  const filteredAssets = liveAssets.filter(asset => {
    const matchesSearch = asset.symbol.toLowerCase().includes(assetSearch.toLowerCase()) ||
      asset.name.toLowerCase().includes(assetSearch.toLowerCase());
    const matchesCategory = assetCategoryFilter === 'Todos' || asset.category === assetCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 🔥 NOVO: Sincronizar selectedSymbol com o contexto global
  useEffect(() => {
    if (selectedAsset && selectedAsset !== selectedSymbol) {
      console.log('[ChartView] 🔄 Sincronizando ativo global:', selectedAsset);
      setSelectedSymbol(selectedAsset);
    }
  }, [selectedAsset]);

  // 🆕 EFFECT: Gerenciar cursor dot no modo ponto (DESABILITADO)
  useEffect(() => {
    // 🔥 DESABILITADO para evitar IframeMessageAbortError
    console.log('[ChartView] ⚠️ Cursor dot DESABILITADO');
    return;
    
    /* CÓDIGO ORIGINAL - COMENTADO
    if (crosshairMode !== 'point' || !chartContainerRef.current) return;

    console.log('[ChartView] 🔵 useEffect: Criando bolinha para modo ponto');
    const chartContainer = chartContainerRef.current;
    
    // Criar elemento dot com a nova classe otimizada
    const dot = document.createElement('div');
    dot.id = 'cursor-dot-indicator';
    dot.className = 'cursor-dot-indicator';
    document.body.appendChild(dot);
    console.log('[ChartView] 🔵 Bolinha criada e adicionada ao DOM');

    let isMouseInside = false;

    // Handler de movimento do mouse
    const handleMouseMove = (e: MouseEvent) => {
      isMouseInside = true;
      dot.style.display = 'block';
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    };

    // Handler de saída do mouse
    const handleMouseLeave = () => {
      isMouseInside = false;
      dot.style.display = 'none';
    };

    // Handler de mousedown (efeito de click)
    const handleMouseDown = () => {
      if (isMouseInside) {
        dot.classList.add('active');
      }
    };

    // Handler de mouseup (remover efeito)
    const handleMouseUp = () => {
      dot.classList.remove('active');
    };

    chartContainer.addEventListener('mousemove', handleMouseMove);
    chartContainer.addEventListener('mouseleave', handleMouseLeave);
    chartContainer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    console.log('[ChartView] 🔵 Event listeners adicionados para bolinha');

    // Cleanup
    return () => {
      console.log('[ChartView] 🔵 Limpando bolinha do modo ponto');
      chartContainer.removeEventListener('mousemove', handleMouseMove);
      chartContainer.removeEventListener('mouseleave', handleMouseLeave);
      chartContainer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      dot.remove();
    };
    */
  }, [crosshairMode]);

  // 🆕 FUNÇÃO PARA ADICIONAR/REMOVER INDICADOR
  const toggleIndicator = (indicator: IndicatorConfig) => {
    if (!chartInstanceRef.current) {
      console.error('[ChartView] ❌ Chart instance not ready');
      return;
    }

    const chart = chartInstanceRef.current;
    const isActive = activeIndicators.has(indicator.id);

    try {
      if (isActive) {
        // Remover indicador
        console.log('[ChartView] 🗑️ Removing indicator:', indicator.name);
        chart.removeIndicator(indicator.id);
        
        const newActiveIndicators = new Set(activeIndicators);
        newActiveIndicators.delete(indicator.id);
        setActiveIndicators(newActiveIndicators);
        
        console.log('[ChartView] ✅ Indicator removed successfully');
      } else {
        // Adicionar indicador
        console.log('[ChartView] ➕ Adding indicator:', indicator.name);
        
        const config: any = {
          name: indicator.klinechartsName,
          id: indicator.id
        };

        // Add parameters if available
        if (indicator.defaultParams && indicator.defaultParams.length > 0) {
          config.calcParams = indicator.defaultParams;
        }

        // Create indicator on main pane or new pane
        if (indicator.isPaneIndicator) {
          chart.createIndicator(config, false, { id: `pane_${indicator.id}` });
        } else {
          chart.createIndicator(config, true); // true = overlay on main pane
        }

        const newActiveIndicators = new Set(activeIndicators);
        newActiveIndicators.add(indicator.id);
        setActiveIndicators(newActiveIndicators);
        
        console.log('[ChartView] ✅ Indicator added successfully');
      }
    } catch (error) {
      console.error('[ChartView] ❌ Error toggling indicator:', error);
    }
  };

  // 🆕 FILTRAR INDICADORES POR CATEGORIA E BUSCA
  const filteredIndicators = INDICATORS.filter(indicator => {
    const matchesCategory = selectedCategory === 'all' || indicator.category === selectedCategory;
    const matchesSearch = indicator.name.toLowerCase().includes(indicatorSearchTerm.toLowerCase()) ||
                          indicator.description.toLowerCase().includes(indicatorSearchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // 🆕 CATEGORIAS
  const categories = [
    { id: 'all', label: 'Todos', icon: Activity },
    { id: 'trend', label: 'Tendência', icon: TrendingUp },
    { id: 'momentum', label: 'Momentum', icon: Zap },
    { id: 'volatility', label: 'Volatilidade', icon: Activity },
    { id: 'volume', label: 'Volume', icon: Activity },
    { id: 'support_resistance', label: 'S&R', icon: Target },
  ];

  // 🆕 HANDLE DRAWING TOOL SELECT
  const handleDrawingToolSelect = (tool: string) => {
    console.log('[ChartView] 🎨 Drawing tool selected:', tool);
    
    if (!chartInstanceRef.current) {
      console.warn('[ChartView] ⚠️ Chart not ready yet');
      toast.error('Aguarde o carregamento do gráfico');
      return;
    }

    setActiveDrawingTool(tool);
    
    // 🆕 Se selecionou ferramenta de texto, ativar modo de adicionar texto
    if (tool === 'text' || tool === 'anchored-text') {
      setIsAddingText(true);
      console.log('[ChartView] 📝 Modo de adicionar texto ativado');
      toast.info('Clique no gráfico para adicionar texto');
      return; // Não criar overlay ainda
    } else {
      setIsAddingText(false);
    }

    // Map tool names to KLineCharts overlay types
    const overlayTypeMap: Record<string, string> = {
      // Lines
      'trendline': 'segment',
      'ray': 'rayLine',
      'info-line': 'segment',
      'extended-line': 'straightLine',
      'trend-angle': 'segment',
      'horizontal-line': 'horizontalStraightLine',
      'horizontal-ray': 'horizontalRayLine',
      'vertical-line': 'verticalStraightLine',
      'cross-line': 'straightLine',
      
      // Channels
      'parallel-channel': 'parallelStraightLine',
      'regression-trend': 'priceChannelLine',
      'flat-top-bottom': 'parallelStraightLine',
      'disjoint-channel': 'priceChannelLine',
      
      // Pitchfork (usando segment por enquanto)
      'pitchfork': 'segment',
      'schiff-pitchfork': 'segment',
      'modified-schiff-pitchfork': 'segment',
      'inside-pitchfork': 'segment',
      
      // Fibonacci
      'fib-retracement': 'fibonacciLine',
      'fib-extension': 'fibonacciExtension', // Será tratado com fallback para fibonacciLine
      'fib-channel': 'fibonacciLine', // Usa fibonacciLine como base
      'fib-timezone': 'fibonacciLine',
      'fib-speedfan': 'fibonacciLine',
      'fib-time': 'fibonacciLine',
      'fib-circles': 'fibonacciCircle',
      'fib-spiral': 'fibonacciSpiral',
      'fib-speedarcs': 'fibonacciSpeedResistanceFan',
      'fib-wedge': 'fibonacciLine',
      'fib-fan': 'fibonacciSpeedResistanceFan',
      
      // Shapes
      'rectangle': 'rect',
      'ellipse': 'circle',
      'triangle': 'triangle',
      'arrow': 'simpleAnnotation',
      'path': 'segment',
      'brush': 'segment',
      
      // Point Marker (Cruz - Ponto)
      'point-marker': 'pointMarker',
      
      // Text
      'text': 'simpleAnnotation',
      'callout': 'simpleTag',
      'note': 'simpleAnnotation',
      'anchored-note': 'simpleTag',
      'arrow-marker': 'simpleAnnotation',
      'price-label': 'priceLine',
      'price-note': 'simpleTag',
      
      // Measure
      'measure': 'segment'
    };

    const overlayType = overlayTypeMap[tool];
    
    if (!overlayType) {
      console.warn('[ChartView] ⚠️ Unknown tool:', tool);
      toast.warning('Ferramenta em desenvolvimento');
      return;
    }

    try {
      // 🔍 Log overlays suportados para debug
      const supportedOverlays = getSupportedOverlays();
      console.log('[ChartView] 📋 Overlays disponíveis:', supportedOverlays);
      
      // Create overlay using KLineCharts API
      console.log('[ChartView] ✏️ Creating overlay:', overlayType);
      
      // Verificar se o overlay é suportado (incluindo overlays customizados)
      const isCustomOverlay = overlayType === 'pointMarker' || overlayType === 'fibonacciExtension';
      
      if (!supportedOverlays.includes(overlayType) && !isCustomOverlay) {
        console.warn('[ChartView] ⚠️ Overlay não suportado:', overlayType);
        
        toast.error('Overlay não suportado pela biblioteca', {
          description: `Tipo: ${overlayType}`,
          duration: 4000
        });
        return;
      }
      
      // Use the createOverlay method with proper overlay name
      const overlayId = chartInstanceRef.current.createOverlay(overlayType);
      
      if (overlayId) {
        console.log('[ChartView] ✅ Overlay created with ID:', overlayId);
        
        // Mensagens específicas para diferentes ferramentas
        if (tool === 'point-marker') {
          // Não mostrar toast aqui porque já mostramos quando ativou o modo ponto
          console.log('[ChartView] 🎯 Ponto criado');
        } else if (tool === 'fib-extension') {
          toast.success('Extensão de Fibonacci ativada', {
            description: 'Clique 3 pontos no gráfico: início, fim e ponto de extensão',
            duration: 3000
          });
        } else if (tool === 'fib-retracement') {
          toast.success('Retração de Fibonacci ativada', {
            description: 'Clique 2 pontos no gráfico para desenhar os níveis',
            duration: 3000
          });
        } else {
          toast.success(`Ferramenta ativada: ${tool}`, {
            description: 'Clique no gráfico para desenhar',
            duration: 3000
          });
        }
      } else {
        console.error('[ChartView] ❌ Failed to create overlay');
        toast.error('Erro ao criar overlay');
      }

    } catch (error) {
      console.error('[ChartView] ❌ Error creating overlay:', error);
      toast.error('Erro ao ativar ferramenta de desenho', {
        description: `Overlay type: ${overlayType}`,
        duration: 4000
      });
    }
  };

  // 🆕 HANDLE CROSSHAIR MODE CHANGE
  const handleCrosshairModeChange = (mode: 'crosshair' | 'point' | 'arrow' | 'presentation' | 'eraser') => {
    console.log('[ChartView] 🎯 ===== CROSSHAIR MODE CHANGE =====');
    console.log('[ChartView] 🎯 New mode:', mode);
    console.log('[ChartView] 🎯 Current mode:', crosshairMode);
    setCrosshairMode(mode);

    if (!chartInstanceRef.current) {
      console.warn('[ChartView] ⚠️ Chart not ready yet');
      return;
    }

    const chart = chartInstanceRef.current;

    try {
      switch (mode) {
        case 'crosshair':
          // 🎯 MODO CRUZ - Mostrar crosshair padrão (linhas cinzas horizontais/verticais)
          chart.setStyles({
            crosshair: {
              show: true,
              horizontal: {
                show: true,
                line: {
                  show: true,
                  style: 'solid',
                  size: 1,
                  color: '#6b7280', // Cinza
                }
              },
              vertical: {
                show: true,
                line: {
                  show: true,
                  style: 'solid',
                  size: 1,
                  color: '#6b7280', // Cinza
                }
              }
            }
          });
          
          // Garantir cursor normal e remover qualquer classe customizada
          const chartContainerCrosshair = chart.getDom();
          if (chartContainerCrosshair) {
            chartContainerCrosshair.style.cursor = '';  // Cursor padrão
            chartContainerCrosshair.classList.remove('cursor-dot');
            chartContainerCrosshair.classList.remove('cursor-default-mode'); // Remove modo seta
            
            // 🧹 Desconectar observer do modo ponto se existir
            if ((chartContainerCrosshair as any)._crosshairObserver) {
              (chartContainerCrosshair as any)._crosshairObserver.disconnect();
              delete (chartContainerCrosshair as any)._crosshairObserver;
            }
          }
          
          // 🚫 Remover classe CSS global do modo ponto (se existir)
          document.body.classList.remove('cursor-dot-mode');
          document.body.style.cursor = ''; // Limpar estilo inline do body
          
          // Desativa qualquer ferramenta de desenho
          setActiveDrawingTool(null);
          setActiveTool('crosshair');
          
          console.log('[ChartView] ✅ Modo Cruz ativado - Crosshair padrão (linhas cinzas)');
          toast.success('Modo: Cruz', {
            description: 'Crosshair padrão para visualizar preços e tempo',
            duration: 2000
          });
          break;

        case 'point':
          // 🎯 MODO PONTO - SOMENTE bolinha colada no cursor (SEM crosshair)
          console.log('[ChartView] 🔵 Ativando modo PONTO - removendo crosshair completamente');
          chart.setStyles({
            crosshair: {
              show: false, // Sem crosshair - DESABILITA TUDO
              horizontal: {
                show: false,
                line: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                },
                text: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                }
              },
              vertical: {
                show: false,
                line: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                },
                text: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                }
              }
            }
          });
          
          console.log('[ChartView] 🔵 Crosshair desabilitado, aplicando cursor bolinha');
          
          // Adicionar classe CSS especial para cursor como bolinha
          const chartContainer = chart.getDom();
          if (chartContainer) {
            chartContainer.style.cursor = 'none'; // Esconde cursor padrão
            chartContainer.classList.add('cursor-dot');
            chartContainer.classList.remove('cursor-default-mode'); // Remove modo seta
            
            // 🚫 FUNÇÃO AGRESSIVA PARA REMOVER TODOS OS ELEMENTOS DE CROSSHAIR
            const removeCrosshairElements = () => {
              // Remove ALL SVG lines (crosshair da biblioteca)
              const svgLines = chartContainer.querySelectorAll('svg line, line');
              svgLines.forEach((line: any) => {
                line.remove(); // REMOVE completamente ao invés de só esconder
              });
              
              // Remove paths com stroke (possíveis crosshairs)
              const svgPaths = chartContainer.querySelectorAll('svg path[stroke], path[stroke]');
              svgPaths.forEach((path: any) => {
                if (path.getAttribute('stroke') !== 'none') {
                  path.remove();
                }
              });
              
              console.log('[ChartView] 🚫 Removidos', svgLines.length, 'elementos SVG line');
            };
            
            // Remove imediatamente
            removeCrosshairElements();
            
            // Remove após delays (caso a biblioteca recrie)
            setTimeout(removeCrosshairElements, 100);
            setTimeout(removeCrosshairElements, 300);
            setTimeout(removeCrosshairElements, 500);
            
            console.log('[ChartView] 🔵 Cursor escondido e classe cursor-dot adicionada');
            
            // 🔁 CRIAR OBSERVER PARA REMOVER CROSSHAIR SE A BIBLIOTECA RECRIAR
            const observer = new MutationObserver(() => {
              removeCrosshairElements();
            });
            
            observer.observe(chartContainer, {
              childList: true,
              subtree: true,
              attributes: false // Não precisa observar atributos
            });
            
            // Armazenar observer para cleanup posterior
            (chartContainer as any)._crosshairObserver = observer;
            console.log('[ChartView] 👁️ Observer ativo - crosshair será removido automaticamente se recriado');
          }
          
          setActiveDrawingTool(null);
          setActiveTool('point');
          
          console.log('[ChartView] ✅ Modo Ponto ativado - SOMENTE bolinha (sem crosshair)');
          toast.success('Modo: Ponto', {
            description: 'Uma bolinha azul segue o cursor do mouse',
            duration: 2000
          });
          break;

        case 'arrow':
          // 🎯 MODO SETA - Zera tudo e deixa navegação totalmente livre COM CURSOR PADRÃO
          console.log('[ChartView] ➡️ Ativando modo SETA - removendo crosshair e restaurando cursor padrão');
          
          chart.setStyles({
            crosshair: {
              show: false, // Sem crosshair - DESABILITA TUDO
              horizontal: {
                show: false,
                line: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                },
                text: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                }
              },
              vertical: {
                show: false,
                line: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                },
                text: {
                  show: false,
                  size: 0,
                  color: 'transparent'
                }
              }
            }
          });
          
          // Garantir cursor normal e remover qualquer classe customizada
          const chartContainerArrow = chart.getDom();
          if (chartContainerArrow) {
            // 🚫 FUNÇÃO AGRESSIVA PARA REMOVER TODOS OS ELEMENTOS DE CROSSHAIR
            const removeCrosshairElements = () => {
              // Remove ALL SVG lines (crosshair da biblioteca)
              const svgLines = chartContainerArrow.querySelectorAll('svg line, line');
              svgLines.forEach((line: any) => {
                line.remove(); // REMOVE completamente
              });
              
              // Remove paths com stroke (possíveis crosshairs)
              const svgPaths = chartContainerArrow.querySelectorAll('svg path[stroke], path[stroke]');
              svgPaths.forEach((path: any) => {
                if (path.getAttribute('stroke') !== 'none') {
                  path.remove();
                }
              });
              
              console.log('[ChartView] 🚫 Removidos', svgLines.length, 'elementos crosshair no modo Seta');
            };
            
            // Remove imediatamente
            removeCrosshairElements();
            
            // Remove após delays (caso a biblioteca recrie)
            setTimeout(removeCrosshairElements, 100);
            setTimeout(removeCrosshairElements, 300);
            setTimeout(removeCrosshairElements, 500);
            
            // 🎯 FORÇAR cursor padrão (seta tradicional)
            chartContainerArrow.style.cursor = 'default'; // Cursor padrão (setinha)
            chartContainerArrow.classList.remove('cursor-dot');
            chartContainerArrow.classList.add('cursor-default-mode'); // Classe especial para modo seta
            
            console.log('[ChartView] ➡️ Cursor forçado para DEFAULT (seta tradicional)');
            
            // 🧹 Desconectar observer do modo ponto se existir
            if ((chartContainerArrow as any)._crosshairObserver) {
              (chartContainerArrow as any)._crosshairObserver.disconnect();
              delete (chartContainerArrow as any)._crosshairObserver;
            }
          }
          
          // 🚫 Remover classe CSS global do modo ponto (se existir)
          document.body.classList.remove('cursor-dot-mode');
          // 🎯 Garantir que o body também tenha cursor padrão
          document.body.style.cursor = 'default';
          console.log('[ChartView] ➡️ Body e container com cursor DEFAULT');
          
          // Zera tudo - Desativa todas as ferramentas
          setActiveDrawingTool(null);
          setActiveTool(null);
          setCrosshairMode('arrow');
          
          console.log('[ChartView] ✅ Modo Seta ativado - Cursor SETA TRADICIONAL restaurado');
          // Toast removido
          break;

        case 'presentation':
          // 🎯 MODO APRESENTAÇÃO - Desenho livre no gráfico com cursor customizado
          chart.setStyles({
            crosshair: {
              show: false // Sem crosshair no modo apresentação
            }
          });
          
          // Aplicar cursor de caneta customizado
          const chartContainerPresentation = chart.getDom();
          if (chartContainerPresentation) {
            chartContainerPresentation.classList.add('cursor-pen-drawing'); // Cursor de desenho customizado
            chartContainerPresentation.classList.remove('cursor-dot');
            chartContainerPresentation.classList.remove('cursor-default-mode');
            
            // 🧹 Desconectar observer do modo ponto se existir
            if ((chartContainerPresentation as any)._crosshairObserver) {
              (chartContainerPresentation as any)._crosshairObserver.disconnect();
              delete (chartContainerPresentation as any)._crosshairObserver;
            }
          }
          
          // 🚫 Remover classe CSS global do modo ponto (se existir)
          document.body.classList.remove('cursor-dot-mode');
          document.body.style.cursor = ''; // Limpar estilo inline do body
          
          // Ativar modo de desenho livre (permite desenhar livremente)
          setActiveTool('presentation');
          
          // 🎯 Mostrar banner informativo do modo apresentação
          setShowPresentationBanner(true);
          
          toast.success('Modo: Apresentação', {
            description: 'Segure Command/Ctrl para desenhar livremente',
            duration: 3000
          });
          break;

        case 'eraser':
          // 🎯 MODO BORRACHA - Apagar desenhos com cursor customizado
          chart.setStyles({
            crosshair: {
              show: false // Crosshair oculto no modo borracha
            }
          });
          
          // Aplicar cursor de borracha customizado
          const chartContainerEraser = chart.getDom();
          if (chartContainerEraser) {
            chartContainerEraser.classList.add('cursor-eraser'); // Cursor de borracha customizado
            chartContainerEraser.classList.remove('cursor-dot');
            chartContainerEraser.classList.remove('cursor-default-mode');
            chartContainerEraser.classList.remove('cursor-pen-drawing');
            
            // 🧹 Desconectar observer do modo ponto se existir
            if ((chartContainerEraser as any)._crosshairObserver) {
              (chartContainerEraser as any)._crosshairObserver.disconnect();
              delete (chartContainerEraser as any)._crosshairObserver;
            }
          }
          
          // 🚫 Remover classe CSS global do modo ponto (se existir)
          document.body.classList.remove('cursor-dot-mode');
          document.body.style.cursor = ''; // Limpar estilo inline do body
          
          setActiveTool('eraser');
          
          toast.success('Modo: Borracha', {
            description: 'Clique nos desenhos para apagá-los',
            duration: 3000
          });
          break;
      }
    } catch (error) {
      console.error('[ChartView] ❌ Error changing crosshair mode:', error);
      toast.error('Erro ao alterar modo da cruz');
    }
  };

  // 🆕 HANDLE DATA WINDOW TOGGLE
  const handleDataWindowToggle = (enabled: boolean) => {
    console.log('[ChartView] 📊 Data window enabled:', enabled);
    setDataWindowEnabled(enabled);

    if (!chartInstanceRef.current) {
      console.warn('[ChartView] ⚠️ Chart not ready yet');
      return;
    }

    const chart = chartInstanceRef.current;

    try {
      // O KLineCharts mostra o tooltip automaticamente
      // Aqui podemos ajustar o comportamento do tooltip
      chart.setStyles({
        candle: {
          tooltip: {
            showRule: enabled ? 'always' : 'follow_cross', // 'follow_cross' = só mostra ao passar mouse
            showType: 'standard'
          }
        }
      });

      toast.success(enabled 
        ? 'Janela de dados: Ativada' 
        : 'Janela de dados: Desativada'
      );
    } catch (error) {
      console.error('[ChartView] ❌ Error toggling data window:', error);
    }
  };

  // 🆕 CONTEXT TOOLBAR HANDLERS
  const handleDrawingDelete = () => {
    if (!chartInstanceRef.current || !selectedDrawing) return;

    try {
      chartInstanceRef.current.removeOverlay(selectedDrawing.id);
      setShowContextToolbar(false);
      setSelectedDrawing(null);
      toast.success('Desenho removido');
    } catch (error) {
      console.error('[ChartView] ❌ Error removing drawing:', error);
      toast.error('Erro ao remover desenho');
    }
  };

  const handleDrawingLockToggle = () => {
    if (!selectedDrawing) return;
    
    const newLockState = !selectedDrawing.isLocked;
    setSelectedDrawing({ ...selectedDrawing, isLocked: newLockState });
    toast.success(newLockState ? 'Desenho bloqueado' : 'Desenho desbloqueado');
  };

  const handleDrawingStyleChange = (style: any) => {
    if (!chartInstanceRef.current || !selectedDrawing) return;
    
    try {
      // Atualizar estilo do overlay
      console.log('[ChartView] 🎨 Updating drawing style:', style);
      toast.success('Estilo atualizado');
    } catch (error) {
      console.error('[ChartView] ❌ Error updating style:', error);
      toast.error('Erro ao atualizar estilo');
    }
  };

  const handleDrawingDuplicate = () => {
    if (!chartInstanceRef.current || !selectedDrawing) return;
    
    try {
      // Duplicar overlay
      console.log('[ChartView] 📋 Duplicating drawing');
      toast.success('Desenho duplicado');
    } catch (error) {
      console.error('[ChartView] ❌ Error duplicating drawing:', error);
      toast.error('Erro ao duplicar desenho');
    }
  };

  const handleDrawingCopy = () => {
    if (!selectedDrawing) return;
    
    try {
      // Copiar para clipboard
      console.log('[ChartView] 📋 Copying drawing');
      toast.success('Desenho copiado');
    } catch (error) {
      console.error('[ChartView] ❌ Error copying drawing:', error);
      toast.error('Erro ao copiar desenho');
    }
  };

  const handleDrawingHideToggle = () => {
    if (!selectedDrawing) return;
    
    const newHiddenState = !selectedDrawing.isHidden;
    setSelectedDrawing({ ...selectedDrawing, isHidden: newHiddenState });
    toast.success(newHiddenState ? 'Desenho oculto' : 'Desenho visível');
  };

  // 🆕 HANDLE DELETE ALL DRAWINGS
  const handleDeleteAllDrawings = () => {
    console.log('[ChartView] 🗑️ Deleting all drawings');

    if (!chartInstanceRef.current) {
      console.warn('[ChartView] ⚠️ Chart not ready yet');
      toast.error('Aguarde o carregamento do gráfico');
      return;
    }

    try {
      const chart = chartInstanceRef.current;
      
      // Remove todos os overlays (desenhos) do gráfico
      chart.removeOverlay();
      
      console.log('[ChartView] ✅ All drawings removed successfully');
    } catch (error) {
      console.error('[ChartView] ❌ Error removing drawings:', error);
      toast.error('Erro ao remover desenhos');
    }
  };

  // Candle countdown
  useEffect(() => {
    const intervals: Record<Timeframe, number> = {
      '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
      '1H': 3600000, '2H': 7200000, '4H': 14400000,
      '1D': 86400000, '1W': 604800000, '1M': 2592000000,
    };

    const updateCountdown = () => {
      const now = Date.now();
      const interval = intervals[timeframe];
      const elapsed = now % interval;
      setCandleCountdown(interval - elapsed);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeframe]);

  const formatCountdown = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Calculate RSI (Relative Strength Index)
  const calculateRSI = (data: KLineData[], period: number = 14): number => {
    if (data.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // Calculate Moving Average
  const calculateMA = (data: KLineData[], period: number): number => {
    if (data.length < period) return data[data.length - 1].close;
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
    return sum / period;
  };

  // Detect Liquidity Zones from real price action
  const detectLiquidityZones = (data: KLineData[], priceAtCalculation: number): LiquidityZone[] => { // 🔥 FIX: Receber price como parâmetro para evitar loop
    if (data.length < 20) return [];
    
    const zones: LiquidityZone[] = [];
    const priceMap = new Map<string, { count: number; volume: number; prices: number[] }>();
    
    // Group prices by rounded levels
    data.forEach((candle) => {
      const roundedHigh = (Math.round(candle.high / (priceAtCalculation * 0.001)) * (priceAtCalculation * 0.001)).toFixed(5);
      const roundedLow = (Math.round(candle.low / (priceAtCalculation * 0.001)) * (priceAtCalculation * 0.001)).toFixed(5);
      
      [roundedHigh, roundedLow].forEach(level => {
        if (!priceMap.has(level)) {
          priceMap.set(level, { count: 0, volume: 0, prices: [] });
        }
        const entry = priceMap.get(level)!;
        entry.count++;
        entry.volume += candle.volume || 0;
        entry.prices.push(candle.high, candle.low);
      });
    });
    
    // Convert to zones and filter significant ones
    const sortedEntries = Array.from(priceMap.entries())
      .filter(([_, data]) => data.count >= 3)
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, 8);
    
    sortedEntries.forEach(([priceStr, data], index) => {
      const price = parseFloat(priceStr);
      const distance = ((price - priceAtCalculation) / priceAtCalculation) * 100;
      const isSupport = price < priceAtCalculation;
      const strength = Math.min((data.count / 10) * 100, 100);
      
      let significance: 'critical' | 'strong' | 'moderate' | 'weak';
      if (strength >= 80) significance = 'critical';
      else if (strength >= 60) significance = 'strong';
      else if (strength >= 40) significance = 'moderate';
      else significance = 'weak';
      
      zones.push({
        id: `zone-${index}`,
        price,
        strength,
        type: isSupport ? 'support' : 'resistance',
        touches: data.count,
        volume: data.volume,
        distance,
        significance
      });
    });
    
    return zones.sort((a, b) => b.price - a.price);
  };

  // Generate Trading Signal based on technical analysis
  const generateTradingSignal = (data: KLineData[]): TradingSignal => {
    if (data.length < 50) {
      return {
        type: 'NEUTRAL',
        strength: 0,
        reasons: ['Dados insuficientes para análise'],
        rsi: 50,
        trend: 'sideways'
      };
    }
    
    const rsi = calculateRSI(data);
    const ma20 = calculateMA(data, 20);
    const ma50 = calculateMA(data, 50);
    const lastCandle = data[data.length - 1];
    const prevCandle = data[data.length - 2];
    
    const reasons: string[] = [];
    let signalPoints = 0;
    
    // RSI Analysis
    if (rsi < 30) {
      reasons.push(`RSI em sobrevenda (${rsi.toFixed(1)})`);
      signalPoints += 25;
    } else if (rsi > 70) {
      reasons.push(`RSI em sobrecompra (${rsi.toFixed(1)})`);
      signalPoints -= 25;
    }
    
    // Moving Average Cross
    if (lastCandle.close > ma20 && lastCandle.close > ma50) {
      reasons.push('Preço acima das médias móveis');
      signalPoints += 20;
    } else if (lastCandle.close < ma20 && lastCandle.close < ma50) {
      reasons.push('Preço abaixo das médias móveis');
      signalPoints -= 20;
    }
    
    // Momentum
    if (lastCandle.close > lastCandle.open && prevCandle.close > prevCandle.open) {
      reasons.push('Momentum de alta (2 candles verdes)');
      signalPoints += 15;
    } else if (lastCandle.close < lastCandle.open && prevCandle.close < prevCandle.open) {
      reasons.push('Momentum de baixa (2 candles vermelhos)');
      signalPoints -= 15;
    }
    
    // Volume
    const avgVolume = data.slice(-20).reduce((sum, c) => sum + (c.volume || 0), 0) / 20;
    if (lastCandle.volume && lastCandle.volume > avgVolume * 1.5) {
      if (lastCandle.close > lastCandle.open) {
        reasons.push('Volume alto em candle de alta');
        signalPoints += 15;
      } else {
        reasons.push('Volume alto em candle de baixa');
        signalPoints -= 15;
      }
    }
    
    // Trend Detection
    let trend: 'bullish' | 'bearish' | 'sideways';
    if (ma20 > ma50 && lastCandle.close > ma20) {
      trend = 'bullish';
      reasons.push('Tendência de alta confirmada');
    } else if (ma20 < ma50 && lastCandle.close < ma20) {
      trend = 'bearish';
      reasons.push('Tendência de baixa confirmada');
    } else {
      trend = 'sideways';
      reasons.push('Mercado lateral');
    }
    
    // Determine signal type
    let type: 'BUY' | 'SELL' | 'NEUTRAL';
    if (signalPoints >= 40) type = 'BUY';
    else if (signalPoints <= -40) type = 'SELL';
    else type = 'NEUTRAL';
    
    const strength = Math.abs(signalPoints);
    
    return { type, strength, reasons, rsi, trend };
  };

  // ❌ REMOVIDO: useEffect que buscava preços de API externa
  // Agora os preços vêm diretamente dos candles carregados no gráfico (100% alinhado)

  // Initialize chart
  useEffect(() => {
    console.log('[ChartView] 🚀 Starting initialization...');
    
    if (!chartContainerRef.current) {
      console.error('[ChartView] ❌ Container ref is null');
      return;
    }

    console.log('[ChartView] ✅ Container found:', chartContainerRef.current);
    console.log('[ChartView] 📋 Chart ID:', chartIdRef.current);

    // 🎯 REGISTER CUSTOM Y-AXIS with MORE TICKS (tighter spacing)
    try {
      registerYAxis({
        name: 'dense-ticks',
        createTicks: (params) => {
          const { range, bounding, defaultTicks } = params;
          const { from, to } = range;
          const priceRange = to - from;
          
          // 🎯 Calculate MANY more ticks (aim for tick every 15-20 pixels)
          const targetTickCount = Math.floor(bounding.height / 18); // A tick every 18 pixels
          const ticks: any[] = [];
          
          if (targetTickCount > 0) {
            const step = priceRange / targetTickCount;
            
            for (let i = 0; i <= targetTickCount; i++) {
              const value = from + (step * i);
              ticks.push({
                coord: 0, // Will be calculated by library
                value: value,
                text: value.toFixed(2)
              });
            }
          }
          
          console.log(`[ChartView] 🎯 Generated ${ticks.length} Y-axis ticks (default was ${defaultTicks.length})`);
          return ticks.length > 0 ? ticks : defaultTicks;
        }
      });
      console.log('[ChartView] ✅ Custom dense Y-Axis registered');
    } catch (e) {
      console.log('[ChartView] ℹ️ Y-Axis registration:', e);
    }

    try {
      const chartId = chartIdRef.current;
      
      // Dispose any existing chart
      try {
        dispose(chartId);
        console.log('[ChartView] 🧹 Disposed existing chart');
      } catch (e) {
        console.log('[ChartView] ℹ️ No existing chart to dispose');
      }
      
      console.log('[ChartView] 📊 Calling init() with ID:', chartId);
      
      // ✅ CORREÇÃO: Garantir que estamos passando o ID correto
      const chart = init(chartId);

      if (!chart) {
        console.error('[ChartView] ❌ init() returned null or undefined');
        console.error('[ChartView] 🔍 Debugging - DOM element exists:', document.getElementById(chartId));
        return;
      }

      console.log('[ChartView] ✅ Chart object created successfully:', chart);

      // 🎯 Activate custom dense Y-axis
      chart.setPaneOptions({
        axisOptions: {
          name: 'dense-ticks'
        }
      });
      console.log('[ChartView] ✅ Dense Y-axis activated');

      // Apply styles after initialization
      console.log('[ChartView] 🎨 Applying styles...');
      chart.setStyles({
        candle: {
          type: 'candle_solid',
          bar: {
            upColor: '#22c55e',
            downColor: '#ef4444',  // 🔴 VERMELHO (revertido)
            upBorderColor: '#22c55e',
            downBorderColor: '#ef4444',  // 🔴 VERMELHO
            upWickColor: '#22c55e',
            downWickColor: '#ef4444',  // 🔴 VERMELHO
          },
          priceMark: {
            show: true,
            high: {
              show: true,
              color: '#22c55e',
              textColor: '#ffffff',
              // ✅ Formatação customizada sem separador de milhares
              format: (value: number) => value.toFixed(2)
            },
            low: {
              show: true,
              color: '#ef4444',
              textColor: '#ffffff',
              // ✅ Formatação customizada sem separador de milhares
              format: (value: number) => value.toFixed(2)
            },
            last: {
              show: true,
              upColor: '#22c55e',
              downColor: '#f97316',  // 🔥 LARANJA
              noChangeColor: '#9ca3af',
              text: {
                show: true,
                color: '#ffffff',
                // ✅ Formatação customizada sem separador de milhares
                format: (value: number) => value.toFixed(2)
              },
            },
          },
          tooltip: {
            showRule: 'always',
            showType: 'standard',
            custom: [
              { title: 'Time', value: '{time}' },
              { title: 'Open', value: '{open}' },
              { title: 'High', value: '{high}' },
              { title: 'Low', value: '{low}' },
              { title: 'Close', value: '{close}' },
              { title: 'Volume', value: '{volume}' }
            ],
            text: {
              size: 12,
              family: 'monospace',
              weight: 'normal',
              color: '#ffffff',
              marginLeft: 8,
              marginTop: 6,
              marginRight: 8,
              marginBottom: 0,
            },
            rect: {
              position: 'right',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
              offsetLeft: 0,
              offsetTop: 20,
              offsetRight: 0,
              offsetBottom: 0,
              borderRadius: 4,
              borderSize: 0,
              borderColor: 'transparent',
              color: 'transparent'
            }
          }
        },
        grid: {
          show: true,
          horizontal: {
            show: true,
            size: 1,
            color: '#2a2a2a',
            style: 'solid',
          },
          vertical: {
            show: true,
            size: 1,
            color: '#1a1a1a',
            style: 'solid',
          },
        },
        crosshair: {
          show: false, // Inicialmente desabilitado - controlado por handleCrosshairModeChange
          horizontal: {
            show: false,
            line: {
              show: false,
              style: 'solid',
              dashValue: [0, 0],
              size: 0,
              color: 'transparent',
            },
            text: {
              show: false,
              size: 0,
              color: 'transparent',
              backgroundColor: 'transparent',
              borderColor: 'transparent'
            }
          },
          vertical: {
            show: false,
            line: {
              show: false,
              style: 'solid',
              dashValue: [0, 0],
              size: 0,
              color: 'transparent',
            },
            text: {
              show: false,
              size: 0,
              color: 'transparent',
              backgroundColor: 'transparent',
              borderColor: 'transparent'
            }
          },
        },
        xAxis: {
          axisLine: {
            show: false,
          },
        },
        yAxis: {
          show: true,
          size: 75,
          axisLine: {
            show: true,
            size: 1,
            color: '#4a4a4a',
          },
          type: 'normal',
          position: 'right',
          inside: false,
          reverse: false,
          tickLine: {
            show: true,
            size: 1,
            length: 4,
            color: '#4a4a4a',
          },
          tickText: {
            show: true,
            size: 8,
            family: 'Arial, sans-serif',
            weight: 'normal',
            color: '#e0e0e0',
            marginStart: 2,
            marginEnd: 2,
          },
        },
        indicator: {
          tooltip: {
            text: {
              format: (value: number) => value.toFixed(2)
            }
          }
        },
        separator: {
          size: 0,
        },
      });

      console.log('[ChartView] ✅ Styles applied successfully');
      chartInstanceRef.current = chart;

      // 🧹 LIMPAR TODOS OS OVERLAYS (Remove bolinha preta misteriosa e qualquer overlay residual)
      chart.removeOverlay();
      console.log('[ChartView] 🧹 All overlays cleared');

      // 🎯 ZOOM E SCROLL SUAVE - Configurar barSpace inicial otimizado
      chart.setBarSpace(8); // Espaçamento padrão mais confort��vel

      // 🆕 Aplicar modo ponto inicial (j�� que o estado inicial é 'point')
      console.log('[ChartView] 🎯 Aplicando modo inicial:', crosshairMode);
      if (crosshairMode === 'point') {
        const chartContainer = chart.getDom();
        if (chartContainer) {
          chartContainer.style.cursor = 'none';
          chartContainer.classList.add('cursor-dot');
        }
      }

      // 🆕 Subscribe to overlay click events
      chart.subscribeAction('onOverlayClick', (data: any) => {
        console.log('[ChartView] 🎨 Overlay clicked:', data);
        
        if (data && data.overlay) {
          setSelectedDrawing({
            id: data.overlay.id,
            type: data.overlay.name,
            isLocked: false,
            isHidden: false
          });
          
          // Position toolbar near the click
          const chartRect = chartContainerRef.current?.getBoundingClientRect();
          if (chartRect) {
            setContextToolbarPosition({
              x: chartRect.left + chartRect.width / 2 - 200, // Centro horizontal menos metade da largura da toolbar
              y: chartRect.top + 50 // 50px do topo
            });
          }
          
          setShowContextToolbar(true);
          toast.info('Desenho selecionado - use a toolbar para editar');
        }
      });

      // Fechar toolbar ao clicar no gráfico (não em overlay)
      chart.subscribeAction('onClick', (data: any) => {
        if (!data?.overlay) {
          setShowContextToolbar(false);
          setSelectedDrawing(null);
        }
      });
      
      // 🆕 Detectar scroll manual do usuário (desabilita auto-scroll permanentemente)
      chart.subscribeAction('onScroll', () => {
        if (!isInitialLoadRef.current) {
          console.log('[ChartView] 🖱️ Usuário scrollou manualmente - auto-scroll desabilitado');
        }
      });
      
      // 🆕 Detectar zoom do usuário
      chart.subscribeAction('onZoom', () => {
        console.log('[ChartView] 🔍 Usuário deu zoom');
      });

      // Fetch real data
      const fetchData = async () => {
        console.log('[ChartView] 🔄 Fetching candles for', selectedSymbol, 'timeframe:', timeframe);
        
        try {
          const candles = await fetchCandles(selectedSymbol, timeframe);
          
          console.log('[ChartView] 📦 Received data:', {
            candles: candles?.length || 0,
            isArray: Array.isArray(candles),
            firstCandle: candles?.[0],
            lastCandle: candles?.[candles.length - 1]
          });
          
          // 🎯 DEBUG: Mostrar últimos 5 candles para verificar preços
          if (candles && candles.length > 5) {
            console.log('[ChartView] 🔍 Últimos 5 candles:', candles.slice(-5).map(c => ({
              time: new Date(c.timestamp).toISOString(),
              open: c.open.toFixed(2),
              high: c.high.toFixed(2),
              low: c.low.toFixed(2),
              close: c.close.toFixed(2),
            })));
          }
          
          if (!candles || candles.length === 0) {
            console.error('[ChartView] ❌ No candles received, chart will remain empty');
            setDataSource('loading');
            return;
          }

          console.log('[ChartView] ✅ CHECKPOINT 1: Candles received, count:', candles.length);
          console.log('[ChartView] 📈 Processing', candles.length, 'candles');
          console.log('[ChartView] 📅 Time range:', {
            first: new Date(candles[0].timestamp).toISOString(),
            last: new Date(candles[candles.length - 1].timestamp).toISOString(),
            now: new Date().toISOString()
          });
          
          // 🎯 BUSCAR PREÇO ATUAL DA BINANCE (ticker mais recente)
          let currentPriceFromTicker = 0;
          const lastCandle = candles[candles.length - 1];
          
          // 🎯 BUSCAR DADOS COM ROTEAMENTO INTELIGENTE (funciona para TODOS os ativos)
          console.log('[ChartView] ✅ CHECKPOINT 2: Starting market data fetch via DataSourceRouter');
          let marketData = null;
          try {
            console.log('[ChartView] 🔄 Fetching market data for:', selectedSymbol);
            const routedData = await dataSourceRouter.getMarketData(selectedSymbol);
            
            if (routedData && routedData.price > 0) {
              marketData = routedData;
              currentPriceFromTicker = marketData.price;
              console.log('[ChartView] 🎯 Dados obtidos via', marketData.source.toUpperCase() + ':', {
                price: marketData.price,
                change: marketData.change,
                changePercent: marketData.changePercent,
                source: marketData.source,
                quality: marketData.quality
              });
            }
          } catch (error) {
            console.warn('[ChartView] ⚠️ Erro ao buscar dados via router, usando candles:', error);
          }
          console.log('[ChartView] ✅ CHECKPOINT 3: marketData fetch complete');
          
          // 🔥 SE TEMOS DADOS DA API, USAR ELES (não calcular manualmente!)
          if (marketData && marketData.price > 0 && !marketData.fallbackUsed) {
            setCurrentPrice(marketData.price);
            const estimatedOpenPrice = marketData.price - marketData.change;
            setOpenPrice(estimatedOpenPrice);
            setDailyChange(marketData.change);
            setDailyChangePercent(marketData.changePercent);
            setIsPositive(marketData.changePercent >= 0);
            
            console.log(`[ChartView] ✅ Usando valores DIRETOS da ${marketData.source.toUpperCase()}:`, {
              price: marketData.price.toFixed(2),
              change: marketData.change.toFixed(2),
              changePercent: marketData.changePercent.toFixed(2) + '%',
              quality: marketData.quality
            });
          } else {
            // Fallback: calcular manualmente dos candles
            // 🔥 FIX: garantir que currentPriceFromTicker está definido
            const safeCurrentPrice = (currentPriceFromTicker && currentPriceFromTicker > 0) 
              ? currentPriceFromTicker 
              : lastCandle.close;
            
            // Calcular timestamp do reset (22:00 PT = 06:00 UTC)
            const now = new Date();
            const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes());
            
            let resetTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0);
            if (nowUTC < resetTime) {
              resetTime = resetTime - 86400000;
            }
            
            const firstCandleAfterReset = candles.find(c => c.timestamp >= resetTime);
            const openPriceFromCandles = firstCandleAfterReset ? firstCandleAfterReset.open : candles[0].open;
            
            const changeFromCandles = safeCurrentPrice - openPriceFromCandles;
            const changePercentFromCandles = (changeFromCandles / openPriceFromCandles) * 100;
            
            setCurrentPrice(safeCurrentPrice);
            setOpenPrice(openPriceFromCandles);
            setDailyChange(changeFromCandles);
            setDailyChangePercent(changePercentFromCandles);
            setIsPositive(changePercentFromCandles >= 0);
            
            console.log('[ChartView] ⚠️ Usando valores CALCULADOS dos candles (fallback)');
          }
          
          console.log('[ChartView] ✅ CHECKPOINT 4: Starting auto-scaling calculation');
          // 🎯 AUTO-SCALING: Calculate price range and add padding
          const prices = candles.flatMap(c => [c.high, c.low]);
          const maxPrice = Math.max(...prices);
          const minPrice = Math.min(...prices);
          const priceRange = maxPrice - minPrice;
          console.log('[ChartView] ✅ CHECKPOINT 5: Auto-scaling calculated');
          
          // Add 10% padding on each side for comfortable viewing
          const padding = priceRange * 0.10;
          const displayMin = minPrice - padding;
          const displayMax = maxPrice + padding;
          
          console.log('[ChartView] 📊 Auto-scaling:', {
            min: minPrice.toFixed(5),
            max: maxPrice.toFixed(5),
            range: priceRange.toFixed(5),
            rangePercent: ((priceRange / minPrice) * 100).toFixed(2) + '%',
            displayMin: displayMin.toFixed(5),
            displayMax: displayMax.toFixed(5)
          });
          
          console.log('[ChartView] 📊 Candles carregados - usando preços DOS CANDLES (100% alinhado)');
          
          console.log('[ChartView] 🔄 Applying data to chart...');
          // 🔥 FIX: Proteção completa contra erros em logs
          try {
            if (binanceData?.price && binanceData.price > 0) {
              console.log('[ChartView] 📊 Binance price:', binanceData.price.toFixed(2));
              if (binanceData.changePercent !== undefined && binanceData.changePercent !== null) {
                console.log('[ChartView] 📊 Change:', binanceData.changePercent.toFixed(2) + '%');
              }
            } else if (currentPriceFromTicker > 0) {
              console.log('[ChartView] 📊 Ticker price:', currentPriceFromTicker.toFixed(2));
            }
          } catch (logError) {
            console.warn('[ChartView] ⚠️ Error in logging, continuing...', logError);
          }
          
          console.log('[ChartView] 🎯 Calling chart.applyNewData with', candles.length, 'candles');
          
          // 🔍 DEBUG: Mostrar formato exato dos primeiros 3 candles
          console.log('[ChartView] 🔍 First 3 candles (exact format):', JSON.stringify(candles.slice(0, 3), null, 2));
          console.log('[ChartView] 🔍 Last candle (exact format):', JSON.stringify(candles[candles.length - 1], null, 2));
          
          chart.applyNewData(candles);
          console.log('[ChartView] ✅ chart.applyNewData completed!');
          
          // 🔍 DEBUG: Verificar se os dados foram aplicados
          try {
            const dataList = chart.getDataList();
            const dataCount = dataList?.length || 0;
            console.log('[ChartView] 🔍 Data COUNT in chart:', dataCount);
            if (dataCount > 0) {
              console.log('[ChartView] ✅ DATA IS STORED! First:', dataList[0], 'Last:', dataList[dataCount - 1]);
            } else {
              console.error('[ChartView] ❌❌❌ NO DATA IN CHART! applyNewData FAILED!');
            }
          } catch (err) {
            console.warn('[ChartView] ⚠️ Could not get data list:', err);
          }
          
          // 🚀 CRITICAL FIX: Force chart resize to ensure rendering
          try {
            chart.resize();
            console.log('[ChartView] 🔄 Chart resized to force rendering');
          } catch (e) {
            console.warn('[ChartView] ⚠️ Could not resize chart:', e);
          }
          
          // 🚀 CRITICAL FIX: Scroll to latest candles APENAS na primeira carga
          if (isInitialLoadRef.current) {
            try {
              chart.scrollToRealTime();
              console.log('[ChartView] 🚀 Scrolled to real-time position (PRIMEIRA CARGA)');
              isInitialLoadRef.current = false; // Marcar que primeira carga foi concluída
            } catch (e) {
              console.warn('[ChartView] ⚠️ scrollToRealTime not available, trying alternative...');
              try {
                // Alternativa: scroll para a última barra
                chart.scrollToDataIndex(candles.length - 1);
                console.log('[ChartView] 🚀 Scrolled to last candle (PRIMEIRA CARGA)');
                isInitialLoadRef.current = false;
              } catch (e2) {
                console.warn('[ChartView] ⚠️ Could not scroll chart, may need manual zoom');
              }
            }
          } else {
            console.log('[ChartView] ⏭️ Skipping auto-scroll - não é primeira carga (mantendo posição do usuário)');
          }
          
          // 🎯 Configurar precisão de preço para exibição correta na régua
          chart.setPriceVolumePrecision(2, 0); // 2 casas decimais para preço, 0 para volume
          console.log('[ChartView] 🎯 Precision set to 2 decimal places');
          
          // ✅ Sobrescrever formatação de números do eixo Y (remover separador de milhares)
          chart.setStyles({
            yAxis: {
              tickText: {
                size: 8,
                marginStart: 2,
                marginEnd: 2,
              }
            }
          });
          console.log('[ChartView] 📊 Y-axis number format customized (no thousands separator)');
          
          // 🧹 LIMPAR OVERLAYS NOVAMENTE após aplicar dados (garantir remoção de bolinha preta)
          chart.removeOverlay();
          console.log('[ChartView] 🧹 Overlays cleared after data load');
          
          console.log('[ChartView] ✅ Data applied successfully!');
          console.log('[ChartView] 🎉 Chart fully initialized and ready!');
          console.log('[ChartView] 📊 Chart should now display', candles.length, 'candles from', new Date(candles[0].timestamp).toLocaleString(), 'to', new Date(candles[candles.length - 1].timestamp).toLocaleString());
          
          // 🔍 DEBUG: Verificar estado do DOM e Canvas
          try {
            const dom = chart.getDom();
            if (dom) {
              const canvasElements = dom.querySelectorAll('canvas');
              console.log('[ChartView] 🔍 Canvas elements found:', canvasElements.length);
              
              // Log EXPLÍCITO de cada canvas
              canvasElements.forEach((canvas: HTMLCanvasElement, idx: number) => {
                const w = canvas.width;
                const h = canvas.height;
                const cw = canvas.clientWidth;
                const ch = canvas.clientHeight;
                const disp = canvas.style.display || 'default';
                const vis = canvas.style.visibility || 'visible';
                console.log(`[ChartView] 🔍 Canvas ${idx}: W=${w} H=${h} ClientW=${cw} ClientH=${ch} Display=${disp} Visibility=${vis}`);
              });
              
              // Verificação crítica do primeiro canvas (principal)
              if (canvasElements.length > 0) {
                const mainCanvas = canvasElements[0] as HTMLCanvasElement;
                if (mainCanvas.width === 0 || mainCanvas.height === 0) {
                  console.error('[ChartView] ❌❌❌ MAIN CANVAS HAS ZERO DIMENSIONS! Chart cannot render!');
                } else {
                  console.log('[ChartView] ✅ Main canvas has valid dimensions:', mainCanvas.width, 'x', mainCanvas.height);
                }
              }
            } else {
              console.error('[ChartView] ❌ chart.getDom() returned null!');
            }
          } catch (err) {
            console.error('[ChartView] ❌ Error checking DOM:', err);
          }
          
          setDataSource('metaapi');

          // Store chart data and analyze
          setChartData(candles);
          chartDataRef.current = candles; // 🔄 Sincronizar ref para uso no useEffect de atualização de preço
          
          // Detect liquidity zones - 🔥 FIX: Passar preço atual como parâmetro
          const currentPriceForZones = lastCandle.close;
          const zones = detectLiquidityZones(candles, currentPriceForZones);
          setLiquidityZones(zones);
          console.log('[ChartView] 🎯 Detected', zones.length, 'liquidity zones');
          
          // Generate trading signal
          const signal = generateTradingSignal(candles);
          setTradingSignal(signal);
          console.log('[ChartView] 📊 Trading Signal:', signal.type, 'Strength:', signal.strength);
          
          // 🆕 ADD TRADING SIGNALS AS OVERLAYS
          if (signal.type !== 'NEUTRAL' && signal.strength >= 50) {
            console.log('[ChartView] 🎯 Adding', signal.type, 'signal marker to chart');
            
            // Create overlay at the last candle position
            const lastCandleIndex = candles.length - 1;
            const signalPrice = lastCandle.close;
            
            try {
              // Create simple HTML overlay div for signal
              const overlayId = `signal-${Date.now()}`;
              chart.createOverlay({
                name: 'text',
                id: overlayId,
                points: [{
                  timestamp: lastCandle.timestamp,
                  value: signalPrice
                }],
                styles: {
                  text: {
                    color: signal.type === 'BUY' ? '#22c55e' : '#ef4444',
                    size: 14,
                    family: 'Arial',
                    weight: 'bold'
                  }
                },
                text: signal.type === 'BUY' ? '▲ COMPRA' : '▼ VENDA'
              });
              
              console.log('[ChartView] ✅ Signal marker added successfully');
            } catch (e) {
              console.warn('[ChartView] ⚠️ Could not add signal marker (overlay API may differ):', e);
            }
          }
        } catch (error) {
          console.error('[ChartView] ❌ CRITICAL ERROR fetching data:', error);
          console.error('[ChartView] 🔍 Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack trace',
            type: typeof error,
            name: error instanceof Error ? error.name : 'Unknown'
          });
          console.error('[ChartView] 🔍 This error is preventing the chart from loading!');
          setDataSource('loading');
        }
      };

      fetchData();
      
      // 🔄 AUTO-REFRESH: Atualizar candles a cada 30 segundos
      const refreshInterval = setInterval(() => {
        console.log('[ChartView] 🔄 Auto-refreshing candles...');
        fetchData();
      }, 30000); // 30 segundos

      // Handle resize
      const handleResize = () => {
        if (chart && chartContainerRef.current) {
          chart.resize();
          console.log('[ChartView] 📐 Chart resized');
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        console.log('[ChartView] 🧹 Cleaning up chart...');
        window.removeEventListener('resize', handleResize);
        clearInterval(refreshInterval); // 🔄 Limpar intervalo de refresh
        try {
          dispose(chartId);
        } catch (e) {
          console.log('[ChartView] ℹ️ Chart already disposed');
        }
      };
    } catch (error) {
      console.error('[ChartView] ❌ CRITICAL ERROR during initialization:', error);
      console.error('[ChartView] 📋 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
    
    // 🔄 RESET da flag de primeira carga quando símbolo/timeframe mudam
    isInitialLoadRef.current = true;
    console.log('[ChartView] 🔄 Flag isInitialLoad resetada (novo símbolo/timeframe)');
  }, [timeframe, selectedSymbol]); // Removed currentPrice and openPrice to avoid circular dependency

  // 🧹 MONITOR E LIMPAR OVERLAYS INDESEJADOS (Remove bolinha preta periodicamente)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const chart = chartInstanceRef.current;
      if (chart) {
        // Pegar todos os overlays
        const overlays = chart.getOverlayById();
        
        // Se não há overlays, não fazer nada (performance)
        if (!overlays || overlays.length === 0) {
          return;
        }
        
        // Log para debug (só se houver overlays)
        console.log('[ChartView] 🔍 Verificando overlays indesejados...');
        
        // Você pode adicionar lógica aqui para remover apenas overlays específicos
        // Por enquanto, como não estamos usando overlays permanentes, limpar todos
        // chart.removeOverlay(); // Descomentado após testes
      }
    }, 3000); // Verificar a cada 3 segundos

    return () => clearInterval(cleanupInterval);
  }, []);

  // 🚀 WEBSOCKET: Streaming em tempo real (ZERO latência)
  useEffect(() => {
    if (!selectedSymbol.includes('BTC') && !selectedSymbol.includes('ETH') && !selectedSymbol.includes('SOL')) {
      return; // Só usa WebSocket para crypto
    }

    // 🔥 FIX: Não adicionar 'T' se já termina com 'USDT'
    const apiSymbol = selectedSymbol.endsWith('USDT') 
      ? selectedSymbol 
      : selectedSymbol.replace('USD', 'USDT');
    
    console.log(`[ChartView] 📡 Iniciando WebSocket para ${selectedSymbol} → ${apiSymbol}`);
    
    // Subscribe ao stream em tempo real
    const unsubscribe = subscribeToRealtimeData(apiSymbol, (marketData) => {
      const newPrice = marketData.price;
      const change = marketData.change || 0;
      const changePercent = marketData.changePercent || 0;
      
      // 🔥 LOG FORÇADO (não depende de DEBUG)
      console.log(`[🎯 CHARTVIEW] 🚨🚨🚨 CALLBACK EXECUTADO!`, {
        timestamp: new Date().toISOString(),
        symbol: apiSymbol,
        price: newPrice,
        change: change,
        changePercent: changePercent
      });
      
      setCurrentPrice(newPrice);
      setDailyChange(change);
      setDailyChangePercent(changePercent);
      setIsPositive(changePercent >= 0);
      
      console.log(`[🎯 CHARTVIEW] 📌 ESTADOS ATUALIZADOS:`, {
        currentPrice: newPrice,
        dailyChange: change,
        dailyChangePercent: changePercent
      });
      
      debugLog('CHARTVIEW', '[🎯 CHART WebSocket] ✅ STREAMING:', {
        '📥 RECEBIDO do UnifiedService': {
          price: marketData.price,
          change: marketData.change,
          changePercent: marketData.changePercent,
          source: marketData.source
        },
        '---': '---',
        '🎨 VAI EXIBIR NA TELA': {
          'PREÇO': newPrice.toFixed(2),
          'CHANGE': change.toFixed(2),
          '% HOJE': changePercent.toFixed(2) + '%'
        },
        '🔗 Comparar com': `https://api.binance.com/api/v3/ticker/24hr?symbol=${apiSymbol}`
      });
      
      // 🚀 Atualizar último candle do gráfico em tempo real
      if (chartInstanceRef.current && chartDataRef.current.length > 0) {
        const chart = chartInstanceRef.current;
        const lastCandle = chartDataRef.current[chartDataRef.current.length - 1];
        
        // Atualizar o último candle com o novo preço
        const updatedCandle = {
          ...lastCandle,
          close: newPrice,
          high: Math.max(lastCandle.high, newPrice),
          low: Math.min(lastCandle.low, newPrice)
        };
        
        try {
          // Atualizar o array inteiro
          const updatedData = [...chartDataRef.current];
          updatedData[updatedData.length - 1] = updatedCandle;
          
          // 🔥 FIX: Usar updateData ao invés de applyNewData para NÃO resetar scroll
          // updateData preserva a posição do usuário, applyNewData reseta tudo
          chart.updateData(updatedCandle);
          console.log('[ChartView] 🔄 Último candle atualizado via WebSocket (sem reset de scroll)');
          
          // Atualizar a ref
          chartDataRef.current = updatedData;
        } catch (err) {
          console.error('[ChartView] ❌ ERROR updateData:', err);
        }
      }
    });

    // Cleanup ao desmontar
    return () => {
      console.log(`[ChartView] 🔌 Desconectando WebSocket: ${apiSymbol}`);
      unsubscribe();
    };
  }, [selectedSymbol]);

  // 🎯 THROTTLE: Atualizar preço EXIBIDO a cada 1 segundo (estilo Binance - não corre como louco)
  useEffect(() => {
    const throttleInterval = setInterval(() => {
      setDisplayedPrice(currentPrice);
    }, 1000); // Atualiza display a cada 1 segundo

    return () => clearInterval(throttleInterval);
  }, [currentPrice]);

  // ❌ BIBLIOTECA LIMITATION: KLineChart uses Canvas rendering (not SVG)
  // Y-axis tick intervals are calculated automatically based on visible price range
  // Cannot override to fixed 20-unit intervals - the library doesn't support:
  // • Custom tick generators (registerYAxis ignored)
  // • DOM manipulation (Canvas-based, not SVG)
  // • Interval control (setPriceVolumePrecision only affects decimal places)

  // Handle right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Check if click is inside chart container
      if (chartContainerRef.current && chartContainerRef.current.contains(e.target as Node)) {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }
    };

    const handleClick = () => setContextMenu(null);

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // 🆕 USEEFFECT: Criar bolinha customizada para modo PONTO (DESABILITADO)
  useEffect(() => {
    // 🔥 DESABILITADO para evitar IframeMessageAbortError
    console.log('[ChartView] ⚠️ Custom cursor DESABILITADO para prevenir conflitos');
    return;
    
    /* CÓDIGO ORIGINAL - COMENTADO
    console.log('[ChartView] 🔵 useEffect: Criando bolinha para modo ponto');
    console.log('[ChartView] 🔵 Modo atual:', crosshairMode);
    
    if (crosshairMode !== 'point') {
      console.log('[ChartView] ⚠️ Não é modo ponto, pulando');
      return;
    }
    }
    */

    /* Resto do código comentado
    // 🚫 ATIVAR classe CSS que esconde cursor em TODO o documento
    document.body.classList.add('cursor-dot-mode');
    console.log('[ChartView] 🚫 Classe cursor-dot-mode adicionada ao body');

    // Criar elemento da bolinha
    const dot = document.createElement('div');
    dot.id = 'custom-cursor-dot';
    dot.style.cssText = `
      position: fixed;
      width: 16px;
      height: 16px;
      background-color: #3b82f6;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
      display: none;
    `;
    document.body.appendChild(dot);
    console.log('[ChartView] 🔵 Bolinha criada e adicionada ao DOM');

    // Função para atualizar posição da bolinha
    const updateDotPosition = (e: MouseEvent) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      dot.style.display = 'block';
    };

    // Adicionar event listeners
    document.addEventListener('mousemove', updateDotPosition);
    console.log('[ChartView] 🔵 Event listeners adicionados para bolinha');

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', updateDotPosition);
      if (dot.parentNode) {
        dot.parentNode.removeChild(dot);
      }
      // Remover classe CSS e restaurar cursor padrão
      document.body.classList.remove('cursor-dot-mode');
      console.log('[ChartView] 🧹 Bolinha removida e cleanup completo');
    };
    */
  }, [crosshairMode]);

  // 🆕 Handle click outside asset list to close it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assetListRef.current && !assetListRef.current.contains(e.target as Node)) {
        // Check if the click is on the asset button itself
        const target = e.target as HTMLElement;
        const isAssetButton = target.closest('button')?.textContent?.includes(selectedSymbol);
        
        if (!isAssetButton) {
          setShowAssetList(false);
        }
      }
    };

    if (showAssetList) {
      // Add a small delay to avoid immediate closure when opening
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAssetList, selectedSymbol]);

  // 🆕 Auto-scroll para o ativo selecionado quando o modal abre
  useEffect(() => {
    console.log('[ChartView] 📜 Scroll effect triggered - showAssetList:', showAssetList, 'symbol:', selectedSymbol);
    
    if (showAssetList && assetListRef.current) {
      console.log('[ChartView] 📜 Modal aberto, buscando elemento...');
      
      // Aguardar um frame para garantir que o DOM foi renderizado
      setTimeout(() => {
        // Procurar o elemento do ativo selecionado
        const selectedElement = assetListRef.current?.querySelector(`[data-symbol="${selectedSymbol}"]`);
        
        console.log('[ChartView] 📜 Elemento encontrado:', selectedElement);
        
        if (selectedElement) {
          // Scroll suave até o elemento
          selectedElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          console.log(`[ChartView] ✅ Auto-scroll executado para ${selectedSymbol}`);
        } else {
          console.warn(`[ChartView] ⚠️ Elemento com data-symbol="${selectedSymbol}" não encontrado`);
          
          // Debug: mostrar todos os elementos com data-symbol
          const allElements = assetListRef.current?.querySelectorAll('[data-symbol]');
          console.log('[ChartView] 🔍 Elementos disponíveis:', Array.from(allElements || []).map(el => el.getAttribute('data-symbol')));
        }
      }, 100);
    }
  }, [showAssetList, selectedSymbol]);

  // 🆕 USEEFFECT: Detectar Command/Ctrl pressionado para modo apresentação
  useEffect(() => {
    if (activeTool !== 'presentation') {
      // Esconder banner quando sai do modo apresentação
      setShowPresentationBanner(false);
      return; // Só ativa no modo apresentação
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detecta Command (Mac) ou Ctrl (Windows/Linux)
      if (e.metaKey || e.ctrlKey) {
        setIsCommandPressed(true);
        console.log('[ChartView] ⌘ Command/Ctrl pressionado - desenho ativado');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Detecta soltura do Command (Mac) ou Ctrl (Windows/Linux)
      if (!e.metaKey && !e.ctrlKey) {
        setIsCommandPressed(false);
        setIsDrawing(false); // Para de desenhar
        console.log('[ChartView] ⌘ Command/Ctrl solto - desenho desativado');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool]);

  // 🎹 USEEFFECT: Atalhos de teclado para modos da Cruz
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Ignorar se o usuário está digitando em um input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Alt + C = Modo Cruz (Crosshair)
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCrosshairModeChange('crosshair');
        return;
      }

      // Alt + D = Modo Ponto (Dot)
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleCrosshairModeChange('point');
        return;
      }

      // Alt + X = Modo Seta (Arrow - padrão)
      if (e.altKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCrosshairModeChange('arrow');
        return;
      }

      // Alt + B = Modo Apresentação (Brush/Drawing)
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleCrosshairModeChange('presentation');
        return;
      }

      // Alt + E = Modo Borracha (Eraser)
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleCrosshairModeChange('eraser');
        return;
      }

      // ESC = Voltar ao modo padrão (Seta)
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCrosshairModeChange('arrow');
        return;
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);

    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [crosshairMode]); // Incluir crosshairMode como dependência

  // 🆕 USEEFFECT: Sistema de desenho livre no canvas (Modo Apresentação)
  useEffect(() => {
    if (activeTool !== 'presentation' || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    // Salvar estado anterior do canvas antes de redimensionar
    let imageData: ImageData | null = null;

    // Ajustar tamanho do canvas para cobrir todo o container
    const resizeCanvas = () => {
      const container = chartContainerRef.current;
      if (container) {
        // Salvar conteúdo atual
        if (canvas.width > 0 && canvas.height > 0) {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Restaurar conteúdo
        if (imageData) {
          ctx.putImageData(imageData, 0, 0);
        }
        
        // Reconfigurar estilo após resize
        setupBrush();
      }
    };

    // 🎨 BRUSH ESTILO PHOTOSHOP - Suave com antialiasing
    const setupBrush = () => {
      ctx.strokeStyle = '#3b82f6'; // Azul
      ctx.lineWidth = 8; // Brush confortável (aumentado de 4 para 8)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 3; // Blur suave para antialiasing
      ctx.shadowColor = '#3b82f6';
      ctx.globalAlpha = 0.85; // Leve transparência para suavidade
      ctx.globalCompositeOperation = 'source-over'; // Composição padrão
    };

    resizeCanvas();
    setupBrush();
    window.addEventListener('resize', resizeCanvas);

    let isDrawingActive = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (!isCommandPressed) return; // Só desenha se Command/Ctrl estiver pressionado
      
      isDrawingActive = true;
      const rect = canvas.getBoundingClientRect();
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
      
      // Desenhar ponto inicial (para marcas únicas ao clicar)
      ctx.beginPath();
      ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      
      console.log('[ChartView] 🖌️ Iniciando desenho');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingActive || !isCommandPressed) return;
      
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      // 🎨 DESENHO SUAVE - Interpolar pontos para linha contínua
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      
      lastX = currentX;
      lastY = currentY;
    };

    const handleMouseUp = () => {
      if (isDrawingActive) {
        isDrawingActive = false;
        console.log('[ChartView] 🖌️ Finalizando desenho - desenho PERMANECE no canvas');
      }
    };

    const handleMouseLeave = () => {
      if (isDrawingActive) {
        isDrawingActive = false;
        console.log('[ChartView] 🖌️ Mouse saiu do canvas - desenho PERMANECE');
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [activeTool, isCommandPressed]);

  // 🆕 USEEFFECT: Modo BORRACHA - Apagar desenhos do canvas
  useEffect(() => {
    if (activeTool !== 'eraser' || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    console.log('[ChartView] 🧹 Modo Borracha ativado');

    // Ajustar tamanho do canvas se necessário
    const container = chartContainerRef.current;
    if (container && (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight)) {
      // Salvar conteúdo atual antes de redimensionar
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      // Restaurar conteúdo
      ctx.putImageData(imageData, 0, 0);
    }

    // Função para apagar área ao redor do cursor
    const handleErase = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Apagar uma área circular (borracha de 20px de raio)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; // Restaurar
    };

    let isErasing = false;

    const handleMouseDown = (e: MouseEvent) => {
      isErasing = true;
      handleErase(e);
      console.log('[ChartView] 🧹 Apagando desenho');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isErasing) return;
      handleErase(e);
    };

    const handleMouseUp = () => {
      isErasing = false;
      console.log('[ChartView] 🧹 Parou de apagar');
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [activeTool]);

  return (
    <>
      <style>{`
        /* 🎯 ZOOM E SCROLL SUAVE - GPU Acceleration para KLineCharts */
        #${chartIdRef.current} canvas {
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        /* 🎬 ANIMAÇÃO DE REPLAY MODE */
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 1.5s ease-in-out;
        }
      `}</style>
      <div className="h-full w-full bg-black flex relative">
      {/* Asset List Modal - Flutuante Centralizado */}
      {showAssetList && (
        <>
          {/* Backdrop escuro */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            onClick={() => setShowAssetList(false)}
          />
          
          {/* Modal estilo TradingView */}
          <div ref={assetListRef} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[980px] h-[680px] border border-gray-700 bg-[#131722] flex flex-col rounded-lg shadow-2xl z-[100]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Pesquisa de Símbolo</h2>
              <button 
                onClick={() => setShowAssetList(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="px-5 py-3 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="Buscar símbolo..."
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 bg-[#1e222d] border border-gray-700 rounded text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700 overflow-x-auto">
              {['Todos', 'Crypto', 'Forex', 'Stocks US', 'Stocks BR', 'Índices', 'Commodities'].map((category) => (
                <button
                  key={category}
                  onClick={() => setAssetCategoryFilter(category)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    assetCategoryFilter === category
                      ? 'bg-white text-black'
                      : 'bg-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Results List */}
            <SmartScrollContainer className="flex-1 bg-[#131722]">
              {filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Search className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Nenhum ativo encontrado</p>
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <div
                    key={asset.symbol}
                    data-symbol={asset.symbol}
                    onClick={() => {
                      setSelectedSymbol(asset.symbol);
                      setSelectedAsset(asset.symbol); // 🔥 NOVO: Atualizar contexto global
                      setCurrentPrice(asset.bid);
                      setOpenPrice(asset.bid - asset.change);
                      setShowAssetList(false);
                    }}
                    className={`flex items-center justify-between px-5 py-3 cursor-pointer border-b border-gray-800/50 hover:bg-[#1e222d] transition-colors ${
                      selectedSymbol === asset.symbol ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    {/* Left: Symbol + Description */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{asset.symbol.substring(0, 2)}</span>
                      </div>
                      
                      {/* Symbol + Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400 font-semibold text-sm">{asset.symbol}</span>
                          <span className="text-gray-500 text-xs px-2 py-0.5 bg-gray-800 rounded uppercase">{asset.category}</span>
                        </div>
                        <div className="text-gray-400 text-xs truncate mt-0.5">{asset.name}</div>
                      </div>
                    </div>

                    {/* Right: Price + Change */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {/* Price */}
                      <div className="text-white text-sm font-mono tabular-nums">
                        {asset.bid.toFixed(asset.symbol.includes('JPY') ? 3 : 2)}
                      </div>
                      
                      {/* Change % */}
                      <div className={`text-sm font-semibold tabular-nums min-w-[70px] text-right ${
                        asset.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </SmartScrollContainer>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-700 bg-[#1e222d]">
              <p className="text-xs text-gray-500 text-center">
                Exibindo {filteredAssets.length} de {liveAssets.length} ativos disponíveis
              </p>
            </div>
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Price - ALWAYS VISIBLE */}
        <div className="h-20 border-b border-gray-800 px-6 flex items-center justify-between bg-black shrink-0 z-30">
          <div className="flex items-center gap-6">
            {/* Asset Info */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAssetList(!showAssetList)}
                className="hover:bg-gray-900 px-3 py-2 rounded transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{selectedSymbol}</h2>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-xs text-gray-500 text-left">
                  {liveAssets.find(a => a.symbol === selectedSymbol)?.name || 'Bitcoin'}
                </div>
              </button>
            </div>

            {/* Price Info - DIGITAL DISPLAY */}
            <div className="flex items-center gap-6 pl-6 border-l border-gray-800">
              {/* Current Price - ESTILO BINANCE */}
              <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Preço Atual</div>
                <div className="text-4xl font-bold text-white tracking-tight tabular-nums" style={{fontFamily: 'ui-monospace, monospace'}}>
                  {displayedPrice !== null ? (
                    selectedSymbol.includes('BTC') || selectedSymbol.includes('ETH') || selectedSymbol.includes('XAU') || selectedSymbol.includes('US30') || selectedSymbol.includes('NAS') || selectedSymbol.includes('SPX') 
                      ? formatBrazilianPrice(displayedPrice, 2) 
                      : formatBrazilianPrice(displayedPrice, selectedSymbol.includes('JPY') ? 3 : 5)
                  ) : (
                    <div className="h-12 w-32 bg-gray-800/50 animate-pulse rounded"></div>
                  )}
                </div>
              </div>
              
              {/* Change Display - Red Box with Icon */}
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 ${
                isPositive 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/15 border-red-500/40'
              }`}>
                {isPositive ? (
                  <TrendingUp className="w-6 h-6 text-green-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" />
                )}
                <div>
                  <div className={`text-2xl font-bold tracking-tight tabular-nums ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`} style={{fontFamily: 'ui-monospace, monospace'}}>
                    {isPositive ? '+' : '-'}{selectedSymbol.includes('BTC') || selectedSymbol.includes('ETH') || selectedSymbol.includes('XAU') || selectedSymbol.includes('US30') || selectedSymbol.includes('NAS') || selectedSymbol.includes('SPX')
                      ? formatBrazilianPrice(Math.abs(dailyChange), 2)
                      : formatBrazilianPrice(Math.abs(dailyChange), selectedSymbol.includes('JPY') ? 3 : 5)}
                  </div>
                  <div className={`text-sm font-medium ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isPositive ? '+' : '-'}{formatBrazilianPrice(Math.abs(dailyChangePercent || 0), 2)}% hoje
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Removed Settings and Indicators - moved to timeframe bar */}
          </div>
        </div>

        {/* Timeframes Bar */}
        <div 
          className="h-12 border-b border-gray-800 px-6 flex items-center gap-4 bg-[#0a0a0a]"
        >
          <div 
            className="flex items-center gap-2"
            onMouseEnter={() => setTimeframeExpanded(true)}
            onMouseLeave={() => setTimeframeExpanded(false)}
          >
            <span className="text-xs text-gray-500 font-medium">Timeframe:</span>
            <div className="flex gap-1">
              {(timeframeExpanded ? timeframes : visibleTimeframes).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
                    timeframe === tf 
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          
          {/* Separator */}
          <div className="h-6 w-[1px] bg-gray-800 mx-2"></div>
          
          {/* Indicators Button - Black/Gray Style */}
          <button 
            onClick={() => setShowIndicators(!showIndicators)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all ${
              showIndicators
                ? 'bg-gray-700 text-white border border-gray-600'
                : 'bg-black text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
            }`}
            title="Indicadores Técnicos"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Indicadores</span>
          </button>

          {/* 🆕 Backtest/Replay Button - Orange Style */}
          <button 
            onClick={() => setShowBacktestReplay(!showBacktestReplay)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all ${
              showBacktestReplay
                ? 'bg-orange-600 text-white border border-orange-500 shadow-lg shadow-orange-500/20'
                : 'bg-black text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
            }`}
            title="Backtest / Replay de Mercado"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>

          {/* 🆕 Backtest Button - Blue Style */}
          <button 
            onClick={() => setShowBacktestConfig(true)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all ${
              showBacktestConfig
                ? 'bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-black text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
            }`}
            title="Backtest de Estratégias"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Backtest</span>
          </button>

          {/* 🥊 AI vs TRADER Button - Purple/Gold Style */}
          <button 
            onClick={() => setShowAIvsTrader(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all bg-gradient-to-r from-purple-600 to-orange-600 text-white border border-purple-500 hover:from-purple-700 hover:to-orange-700 shadow-lg shadow-purple-500/20"
            title="AI vs Trader - Compare sua performance com a IA"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>AI vs Trader</span>
          </button>
        </div>

        {/* Chart Area with Countdown Overlay + Replay Mode Effect */}
        <div className={`flex-1 flex bg-black min-h-0 relative gap-0 transition-all duration-300 ${
          isReplayMode ? 'ring-2 ring-orange-500/50 animate-pulse-slow' : ''
        }`}>
          {/* ✅ PROFESSIONAL DRAWING TOOLBAR - Barra vertical esquerda */}
          <DrawingToolbar 
            onToolSelect={(tool) => {
              console.log('[ChartView] 🎨 Drawing tool category selected:', tool);
            }}
            onSubToolSelect={handleDrawingToolSelect}
            onCrosshairModeChange={handleCrosshairModeChange}
            onDataWindowToggle={handleDataWindowToggle}
            onDeleteAll={handleDeleteAllDrawings}
            className="shrink-0"
          />

          {/* Chart Container */}
          <div 
            ref={chartContainerRef} 
            id={chartIdRef.current}
            className="flex-1 bg-black relative"
            style={{ 
              minHeight: '600px',
              height: '100%',
              willChange: 'transform',
              transform: 'translateZ(0)',
              paddingLeft: '0px', // 🎯 Sem padding - deixamos o yAxis size controlar
            }}
            onClick={(e) => {
              // 🆕 MODO TEXTO: Clicar no gráfico abre input de texto
              if (isAddingText) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setTextPosition({ x, y });
                console.log('[ChartView] 📝 Posição do texto:', { x, y });
              }
            }}
          >


            {/* 🔥 CANDLE COUNTDOWN - COLADO NA LINHA DO PREÇO */}
            <div 
              className="absolute right-[80px] bg-blue-500/20 backdrop-blur-sm border border-blue-500/40 rounded px-2 py-0.5 z-[60] pointer-events-none flex items-center gap-1"
              style={{ 
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            >
              <Clock className="w-2.5 h-2.5 text-blue-400" />
              <span className="text-[10px] font-mono font-bold text-blue-400 tracking-tight">
                {formatCountdown(candleCountdown)}
              </span>
            </div>

            {/* 📝 INPUT DE TEXTO FLUTUANTE */}
            {textPosition && (
              <div
                className="absolute z-[80]"
                style={{
                  left: textPosition.x,
                  top: textPosition.y,
                }}
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textInput.trim()) {
                      // Adicionar texto ao gráfico
                      const newText = {
                        id: Date.now().toString(),
                        text: textInput,
                        x: textPosition.x,
                        y: textPosition.y
                      };
                      setChartTexts([...chartTexts, newText]);
                      setTextInput('');
                      setTextPosition(null);
                      setIsAddingText(false);
                      console.log('[ChartView] ✅ Texto adicionado:', newText);
                    } else if (e.key === 'Escape') {
                      // Cancelar
                      setTextInput('');
                      setTextPosition(null);
                      setIsAddingText(false);
                    }
                  }}
                  autoFocus
                  placeholder="Digite o texto..."
                  className="px-2 py-1 bg-gray-800 border border-blue-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px]"
                />
              </div>
            )}

            {/* 📝 TEXTOS NO GRÁFICO */}
            {chartTexts.map((txt) => (
              <div
                key={txt.id}
                className="absolute z-[60] text-white text-sm font-medium px-2 py-1 bg-black/50 border border-white/20 rounded pointer-events-auto cursor-move select-none"
                style={{
                  left: txt.x,
                  top: txt.y,
                }}
                draggable
                onDragEnd={(e) => {
                  const rect = chartContainerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const newX = e.clientX - rect.left;
                    const newY = e.clientY - rect.top;
                    setChartTexts(chartTexts.map(t => 
                      t.id === txt.id ? { ...t, x: newX, y: newY } : t
                    ));
                  }
                }}
                onDoubleClick={() => {
                  // Remover texto ao dar duplo clique
                  setChartTexts(chartTexts.filter(t => t.id !== txt.id));
                }}
              >
                {txt.text}
              </div>
            ))}

            {/* 🖌️ CANVAS DE DESENHO LIVRE (Modo Apresentação + Borracha) */}
            {(activeTool === 'presentation' || activeTool === 'eraser') && (
              <>
                <canvas
                  ref={canvasRef}
                  className={`absolute top-0 left-0 w-full h-full z-[65] ${
                    activeTool === 'presentation' 
                      ? (isCommandPressed ? 'pointer-events-auto cursor-pen-drawing' : 'pointer-events-none')
                      : 'pointer-events-auto'
                  }`}
                  style={{
                    cursor: activeTool === 'presentation'
                      ? (isCommandPressed ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'2\'%3E%3Cpath d=\'M12 19l7-7 3 3-7 7-3-3z\'/%3E%3Cpath d=\'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z\'/%3E%3Cpath d=\'M2 2l7.586 7.586\'/%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'2\'/%3E%3C/svg%3E") 4 20, crosshair' : 'default')
                      : 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ff4444\' stroke-width=\'2\'%3E%3Cpath d=\'M7 21h10\'/%3E%3Cpath d=\'M5.5 11.5L19 2l3 3-9.5 13.5-6.5-6.5z\'/%3E%3C/svg%3E") 4 20, crosshair'
                  }}
                />
                
                {/* 🎯 BANNER FLUTUANTE - MODO APRESENTAÇÃO */}
                {activeTool === 'presentation' && showPresentationBanner && !isCommandPressed && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[70] bg-blue-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-semibold">
                      Segure <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs font-mono">⌘</kbd> para desenhar
                    </span>
                    <button
                      onClick={() => setShowPresentationBanner(false)}
                      className="text-white/80 hover:text-white transition-colors"
                      aria-label="Fechar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Professional Liquidity Detector - LAZY LOADED ⚡ */}
          <Suspense fallback={
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
            </div>
          }>
            <LiquidityDetector zones={liquidityZones} currentPrice={currentPrice} />
          </Suspense>
        </div>

        {/* Indicators Sidebar */}
        {showIndicators && (
          <div className="w-80 border-l border-gray-800 bg-[#0a0a0a] flex flex-col shrink-0 h-full max-h-screen overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 shrink-0">
              <h3 className="text-sm font-bold text-white">Indicadores Técnicos</h3>
              <p className="text-xs text-gray-500 mt-1">{filteredIndicators.length} indicadores disponíveis</p>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-gray-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={indicatorSearchTerm}
                  onChange={(e) => setIndicatorSearchTerm(e.target.value)}
                  placeholder="Buscar indicador..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category Filters */}
            <div className="px-3 py-2 border-b border-gray-800 flex flex-wrap gap-1 shrink-0">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Indicators */}
            {activeIndicators.size > 0 && (
              <div className="px-3 py-2 border-b border-gray-800 shrink-0">
                <div className="text-xs font-medium text-gray-400 mb-2">ATIVOS ({activeIndicators.size})</div>
                <div className="space-y-1">
                  {INDICATORS.filter(ind => activeIndicators.has(ind.id)).map(indicator => (
                    <div
                      key={indicator.id}
                      className="flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs"
                    >
                      <span className="text-blue-400 font-medium">{indicator.name.split(' - ')[0]}</span>
                      <button
                        onClick={() => toggleIndicator(indicator)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Indicators List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-3 space-y-1">
              {filteredIndicators.map((indicator) => {
                const isActive = activeIndicators.has(indicator.id);
                
                return (
                  <button
                    key={indicator.id}
                    onClick={() => toggleIndicator(indicator)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all group ${
                      isActive
                        ? 'bg-blue-500/20 border border-blue-500/40'
                        : 'bg-gray-900 hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className={`text-sm font-medium ${isActive ? 'text-blue-300' : 'text-white'}`}>
                        {indicator.name}
                      </span>
                      <span className="text-xs text-gray-500">{indicator.description}</span>
                    </div>
                    <div className={`text-lg font-bold transition-colors ${
                      isActive ? 'text-red-400' : 'text-gray-600 group-hover:text-blue-400'
                    }`}>
                      {isActive ? '−' : '+'}
                    </div>
                  </button>
                );
              })}

              {/* No results */}
              {filteredIndicators.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Nenhum indicador encontrado</p>
                </div>
              )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-2xl py-2 z-[100] min-w-[360px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {/* Redefinir visão do gráfico */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3">
            <RotateCcw className="w-4 h-4 text-gray-400" />
            <span>Redefinir visão do gráfico</span>
            <span className="ml-auto text-xs text-gray-500">⌘ R</span>
          </button>
          
          <div className="h-px bg-gray-700 my-2"></div>
          
          {/* Copiar preço */}
          <button 
            onClick={() => {
              if (currentPrice !== null) {
                navigator.clipboard.writeText(currentPrice.toFixed(5));
                toast.success('Preço copiado para área de transferência');
                setContextMenu(null);
              }
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors"
            disabled={currentPrice === null}
          >
            Copiar preço {currentPrice !== null ? currentPrice.toFixed(selectedSymbol.includes('JPY') ? 3 : 5) : '...'}
          </button>
          
          {/* Colar */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3">
            <span>Colar</span>
            <span className="ml-auto text-xs text-gray-500">⌘ V</span>
          </button>
          
          <div className="h-px bg-gray-700 my-2"></div>
          
          {/* Adicionar alerta */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3" disabled={currentPrice === null}>
            <Clock className="w-4 h-4 text-gray-400" />
            <span>Adicionar alerta a {selectedSymbol} em {currentPrice !== null ? currentPrice.toFixed(5) : '...'}...</span>
            <span className="ml-auto text-xs text-gray-500">⌘ A</span>
          </button>
          
          {/* Comprar limite */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3" disabled={currentPrice === null}>
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span>Comprar 1 {selectedSymbol} @ {currentPrice !== null ? currentPrice.toFixed(5) : '...'} limite</span>
            <span className="ml-auto text-xs text-gray-500">⌘ ⇧ B</span>
          </button>
          
          {/* Vender stop */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3" disabled={currentPrice === null}>
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span>Vender 1 {selectedSymbol} @ {currentPrice !== null ? currentPrice.toFixed(5) : '...'} stop</span>
          </button>
          
          {/* Adicionar ordem */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3" disabled={currentPrice === null}>
            <Activity className="w-4 h-4 text-gray-400" />
            <span>Adicionar ordem em {selectedSymbol} a {currentPrice !== null ? currentPrice.toFixed(5) : '...'}...</span>
            <span className="ml-auto text-xs text-gray-500">⇧ T</span>
          </button>
          
          <div className="h-px bg-gray-700 my-2"></div>
          
          {/* Travar linha vertical */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors">
            Travar linha vertical de cursor no tempo
          </button>
          
          <div className="h-px bg-gray-700 my-2"></div>
          
          {/* Visualização da tabela */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors">
            Visualização da tabela
          </button>
          
          {/* Lista de objetos */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors">
            Lista de Objetos...
          </button>
          
          {/* Template do gráfico */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center justify-between">
            <span>Template do gráfico</span>
            <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg]" />
          </button>
          
          <div className="h-px bg-gray-700 my-2"></div>
          
          {/* Remover indicadores */}
          {activeIndicators.size > 0 && (
            <button 
              onClick={() => {
                activeIndicators.forEach(id => {
                  const indicator = INDICATORS.find(ind => ind.id === id);
                  if (indicator) toggleIndicator(indicator);
                });
                toast.success(`${activeIndicators.size} indicadores removidos`);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors"
            >
              Remover {activeIndicators.size} indicador{activeIndicators.size > 1 ? 'es' : ''}
            </button>
          )}
          
          <div className="h-px bg-gray-700 my-2"></div>
          
          {/* Configurações */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3">
            <Settings className="w-4 h-4 text-gray-400" />
            <span>Configurações...</span>
          </button>
        </div>
      )}

      {/* 🆕 DRAWING CONTEXT TOOLBAR - Aparece ao selecionar um desenho */}
      <DrawingContextToolbar
        visible={showContextToolbar}
        position={contextToolbarPosition}
        selectedDrawing={selectedDrawing}
        onMove={() => {
          toast.info('Modo mover ativado - arraste o desenho');
          setShowContextToolbar(false);
        }}
        onEdit={() => {
          toast.info('Modo editar ativado');
        }}
        onStyleChange={handleDrawingStyleChange}
        onLockToggle={handleDrawingLockToggle}
        onDelete={handleDrawingDelete}
        onDuplicate={handleDrawingDuplicate}
        onCopy={handleDrawingCopy}
        onHideToggle={handleDrawingHideToggle}
        onClose={() => {
          setShowContextToolbar(false);
          setSelectedDrawing(null);
        }}
      />

      {/* 🎬 BACKTEST / REPLAY BAR - Barra de controle no rodapé */}
      {showBacktestReplay && (
        <BacktestReplayBar
          onClose={() => {
            setShowBacktestReplay(false);
            setIsReplayMode(false);
          }}
          onCandleChange={(candle) => {
            // Ativar modo replay na primeira vez
            if (!isReplayMode) {
              setIsReplayMode(true);
              // Efeito de "piscada"
              setTimeout(() => setIsReplayMode(false), 1500);
              toast.success('🎬 Modo Replay ativado!');
            }
            console.log('[ChartView] 🎬 Replay candle:', candle);
          }}
        />
      )}

      {/* ⚙️ BACKTEST CONFIG MODAL - Configuração de backtest */}
      <BacktestConfigModal
        isOpen={showBacktestConfig}
        onClose={() => setShowBacktestConfig(false)}
        onStart={(config) => {
          console.log('[ChartView] 🚀 Iniciando backtest:', config);
          setShowBacktestConfig(false);
          toast.success('Backtest iniciado com sucesso!');
          // 🚀 Iniciar backtest com progresso ao vivo
          backtestProgress.start(1000, 50); // 1000 candles, 50ms por candle
        }}
        onCreateStrategy={() => {
          setShowBacktestConfig(false);
          setShowStrategyBuilder(true);
        }}
      />

      {/* 📊 BACKTEST LIVE PROGRESS - Visualização em tempo real */}
      {backtestProgress.isRunning && (
        <BacktestLiveProgress
          isRunning={backtestProgress.isRunning}
          progress={backtestProgress.progress}
          metrics={backtestProgress.metrics}
          recentTrades={backtestProgress.recentTrades}
          equityCurve={backtestProgress.equityCurve}
          onPause={backtestProgress.pause}
          onResume={backtestProgress.resume}
          onStop={backtestProgress.stop}
          onShowDecisions={() => setShowDecisionsPanel(true)}
        />
      )}

      {/* 🧠 STRATEGY BUILDER - Construtor de estratégias */}
      <StrategyBuilderPro
        isOpen={showStrategyBuilder}
        onClose={() => setShowStrategyBuilder(false)}
        onSave={(strategy) => {
          console.log('[ChartView] 💾 Estratégia salva:', strategy);
          setShowStrategyBuilder(false);
          toast.success(`Estratégia "${strategy.name}" salva com sucesso!`);
          // TODO: Salvar estratégia no Supabase
        }}
      />

      {/* 📋 BACKTEST DECISIONS PANEL - Histórico de decisões da IA */}
      <BacktestErrorBoundary>
        <BacktestDecisionsPanel
          isOpen={showDecisionsPanel}
          onClose={() => setShowDecisionsPanel(false)}
          decisions={backtestProgress.recentTrades.map(trade => ({
            ...trade,
            aiAnalysis: trade.aiAnalysis || {
              confidence: 0,
              mainReason: '',
              supportingFactors: [],
              indicators: [],
              marketContext: ''
            }
          }))}
          onJumpToCandle={(candleIndex) => {
            console.log('[ChartView] 📍 Navegando para candle:', candleIndex);
            toast.info(`Navegando para candle #${candleIndex}`);
          }}
        />
      </BacktestErrorBoundary>

      {/* 🥊 AI vs TRADER MODE - Competição */}
      <BacktestErrorBoundary>
        <AIvsTraderMode
          isOpen={showAIvsTrader}
          onClose={() => setShowAIvsTrader(false)}
          initialCapital={10000}
          symbol={selectedSymbol}
          timeframe={timeframe}
        />
      </BacktestErrorBoundary>
    </div>
    </>
  );
}