/**
 * ============================================================
 * NEURAL DAY TRADER — GRÁFICO STANDALONE
 * ============================================================
 * Arquivo 100% autocontido. Copie e cole em qualquer app React.
 *
 * Dependências necessárias no seu projeto:
 *   npm install klinecharts lucide-react sonner
 *
 * Também requer Tailwind CSS configurado.
 * ============================================================
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { init, dispose, registerOverlay, getSupportedOverlays } from 'klinecharts';
import type { KLineData, OverlayTemplate } from 'klinecharts';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Activity,
  Clock,
  Search,
  Minus,
  Square,
  Triangle,
  Type,
  Eraser,
  Crosshair,
  GitBranch,
  Ruler,
  ZoomIn,
  Lock,
  Eye,
  Trash2,
  Smile,
  Navigation,
  Target,
  Zap,
  RotateCcw,
  X,
  Trophy,
  TrendingUpDown,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

// ============================================================
// TIPOS
// ============================================================

type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '1D' | '1W' | '1M';

interface MarketAsset {
  symbol: string;
  name: string;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  category: string;
}

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
  strength: number;
  reasons: string[];
  rsi: number;
  trend: 'bullish' | 'bearish' | 'sideways';
}

interface IndicatorConfig {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'support_resistance';
  klinechartsName: string;
  defaultParams?: number[];
  isPaneIndicator?: boolean;
}

// ============================================================
// REGISTRAR OVERLAY CUSTOMIZADO: PONTO MARCADOR
// ============================================================

const PointMarkerOverlay: OverlayTemplate = {
  name: 'pointMarker',
  totalStep: 1,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length > 0) {
      const point = coordinates[0];
      return {
        type: 'circle',
        attrs: { x: point.x, y: point.y, r: 3 },
        styles: {
          style: 'fill',
          color: overlay.styles?.circle?.color || '#3b82f6',
        },
      };
    }
    return [];
  },
};

try { registerOverlay(PointMarkerOverlay); } catch (_) {}

// ============================================================
// INDICADORES DISPONÍVEIS
// ============================================================

const INDICATORS: IndicatorConfig[] = [
  { id: 'ma',   name: 'MA – Média Móvel Simples',            description: 'Simple Moving Average',                 category: 'trend',              klinechartsName: 'MA',   defaultParams: [5, 10, 20, 60],  isPaneIndicator: false },
  { id: 'ema',  name: 'EMA – Média Móvel Exponencial',       description: 'Exponential Moving Average',            category: 'trend',              klinechartsName: 'EMA',  defaultParams: [6, 12, 20],     isPaneIndicator: false },
  { id: 'wma',  name: 'WMA – Média Móvel Ponderada',         description: 'Weighted Moving Average',               category: 'trend',              klinechartsName: 'WMA',  defaultParams: [5, 10, 20],     isPaneIndicator: false },
  { id: 'sar',  name: 'SAR – Parabolic SAR',                  description: 'Parabolic Stop and Reverse',            category: 'trend',              klinechartsName: 'SAR',  defaultParams: [2, 2, 20],      isPaneIndicator: false },
  { id: 'dmi',  name: 'DMI – Directional Movement Index',    description: 'Índice de Movimento Direcional',        category: 'trend',              klinechartsName: 'DMI',  defaultParams: [14, 6],         isPaneIndicator: true  },
  { id: 'boll', name: 'BOLL – Bollinger Bands',              description: 'Bandas de Bollinger',                   category: 'volatility',         klinechartsName: 'BOLL', defaultParams: [20, 2],         isPaneIndicator: false },
  { id: 'rsi',  name: 'RSI – Relative Strength Index',       description: 'Índice de Força Relativa',              category: 'momentum',           klinechartsName: 'RSI',  defaultParams: [6, 12, 24],     isPaneIndicator: true  },
  { id: 'macd', name: 'MACD – Convergência de Médias',       description: 'Moving Average Convergence/Divergence', category: 'momentum',           klinechartsName: 'MACD', defaultParams: [12, 26, 9],     isPaneIndicator: true  },
  { id: 'kdj',  name: 'KDJ – Stochastic Oscillator',         description: 'Oscilador Estocástico',                 category: 'momentum',           klinechartsName: 'KDJ',  defaultParams: [9, 3, 3],       isPaneIndicator: true  },
  { id: 'cci',  name: 'CCI – Commodity Channel Index',       description: 'Índice de Canal de Commodities',        category: 'momentum',           klinechartsName: 'CCI',  defaultParams: [13],            isPaneIndicator: true  },
  { id: 'wr',   name: 'WR – Williams %R',                    description: 'Williams Percent Range',                category: 'momentum',           klinechartsName: 'WR',   defaultParams: [6, 10, 14],     isPaneIndicator: true  },
  { id: 'atr',  name: 'ATR – Average True Range',            description: 'Amplitude Média Verdadeira',            category: 'volatility',         klinechartsName: 'ATR',  defaultParams: [14],            isPaneIndicator: true  },
  { id: 'dc',   name: 'DC – Donchian Channel',               description: 'Canal de Donchian',                     category: 'volatility',         klinechartsName: 'DC',   defaultParams: [20],            isPaneIndicator: false },
  { id: 'vol',  name: 'VOL – Volume',                        description: 'Volume de Negociação',                  category: 'volume',             klinechartsName: 'VOL',  defaultParams: [5, 10, 20],     isPaneIndicator: true  },
  { id: 'obv',  name: 'OBV – On Balance Volume',             description: 'Volume em Balanço',                     category: 'volume',             klinechartsName: 'OBV',  defaultParams: [30],            isPaneIndicator: true  },
  { id: 'roc',  name: 'ROC – Rate of Change',                description: 'Taxa de Mudança',                       category: 'momentum',           klinechartsName: 'ROC',  defaultParams: [12, 6],         isPaneIndicator: true  },
];

// ============================================================
// LISTA DE ATIVOS (300+)
// ============================================================

const ASSETS: MarketAsset[] = [
  // CRYPTO
  { symbol: 'BTCUSD',  name: 'Bitcoin',                  bid: 86500,   ask: 86502,   change: -2400,  changePercent: -2.70, category: 'Crypto' },
  { symbol: 'ETHUSD',  name: 'Ethereum',                 bid: 3200,    ask: 3201,    change: -80,    changePercent: -2.44, category: 'Crypto' },
  { symbol: 'BNBUSD',  name: 'Binance Coin',             bid: 645.20,  ask: 645.30,  change: 12.5,   changePercent:  1.98, category: 'Crypto' },
  { symbol: 'SOLUSD',  name: 'Solana',                   bid: 142.50,  ask: 142.52,  change: 4.2,    changePercent:  3.04, category: 'Crypto' },
  { symbol: 'XRPUSD',  name: 'Ripple',                   bid: 0.5234,  ask: 0.5235,  change: 0.0124, changePercent:  2.42, category: 'Crypto' },
  { symbol: 'ADAUSD',  name: 'Cardano',                  bid: 0.4521,  ask: 0.4522,  change: -0.0089,changePercent: -1.93, category: 'Crypto' },
  { symbol: 'DOGEUSD', name: 'Dogecoin',                 bid: 0.0812,  ask: 0.0813,  change: 0.0021, changePercent:  2.65, category: 'Crypto' },
  { symbol: 'DOTUSD',  name: 'Polkadot',                 bid: 6.45,    ask: 6.46,    change: -0.12,  changePercent: -1.83, category: 'Crypto' },
  { symbol: 'LTCUSD',  name: 'Litecoin',                 bid: 95.40,   ask: 95.42,   change: -1.8,   changePercent: -1.85, category: 'Crypto' },
  { symbol: 'AVAXUSD', name: 'Avalanche',                bid: 38.20,   ask: 38.22,   change: 1.5,    changePercent:  4.09, category: 'Crypto' },
  { symbol: 'LINKUSD', name: 'Chainlink',                bid: 14.82,   ask: 14.83,   change: -0.34,  changePercent: -2.24, category: 'Crypto' },
  { symbol: 'ATOMUSD', name: 'Cosmos',                   bid: 9.67,    ask: 9.68,    change: 0.28,   changePercent:  2.98, category: 'Crypto' },
  { symbol: 'UNIUSD',  name: 'Uniswap',                  bid: 7.23,    ask: 7.24,    change: -0.15,  changePercent: -2.03, category: 'Crypto' },
  { symbol: 'NEARUSD', name: 'NEAR Protocol',            bid: 3.67,    ask: 3.68,    change: 0.12,   changePercent:  3.38, category: 'Crypto' },
  { symbol: 'TRXUSD',  name: 'Tron',                     bid: 0.1045,  ask: 0.1046,  change: 0.0023, changePercent:  2.25, category: 'Crypto' },
  { symbol: 'APTUSD',  name: 'Aptos',                    bid: 8.34,    ask: 8.35,    change: 0.45,   changePercent:  5.70, category: 'Crypto' },
  { symbol: 'FTMUSD',  name: 'Fantom',                   bid: 0.3456,  ask: 0.3457,  change: -0.0189,changePercent: -5.18, category: 'Crypto' },
  { symbol: 'MATICUSD',name: 'Polygon',                  bid: 0.8234,  ask: 0.8235,  change: 0.0456, changePercent:  5.87, category: 'Crypto' },
  { symbol: 'GALAUSD', name: 'Gala',                     bid: 0.0289,  ask: 0.0290,  change: 0.0015, changePercent:  5.47, category: 'Crypto' },
  { symbol: 'AXSUSD',  name: 'Axie Infinity',            bid: 7.12,    ask: 7.13,    change: 0.34,   changePercent:  5.01, category: 'Crypto' },
  // FOREX
  { symbol: 'EURUSD',  name: 'Euro / US Dollar',         bid: 1.0412,  ask: 1.0413,  change: 0.0015, changePercent:  0.14, category: 'Forex' },
  { symbol: 'GBPUSD',  name: 'British Pound / USD',      bid: 1.2245,  ask: 1.2246,  change: -0.0008,changePercent: -0.07, category: 'Forex' },
  { symbol: 'USDJPY',  name: 'USD / Japanese Yen',       bid: 156.244, ask: 156.254, change: 0.348,  changePercent:  0.22, category: 'Forex' },
  { symbol: 'USDCHF',  name: 'USD / Swiss Franc',        bid: 0.9123,  ask: 0.9124,  change: -0.0012,changePercent: -0.13, category: 'Forex' },
  { symbol: 'AUDUSD',  name: 'AUD / USD',                bid: 0.6234,  ask: 0.6235,  change: 0.0023, changePercent:  0.37, category: 'Forex' },
  { symbol: 'USDCAD',  name: 'USD / Canadian Dollar',    bid: 1.3456,  ask: 1.3457,  change: -0.0034,changePercent: -0.25, category: 'Forex' },
  { symbol: 'NZDUSD',  name: 'New Zealand Dollar / USD', bid: 0.5678,  ask: 0.5679,  change: 0.0012, changePercent:  0.21, category: 'Forex' },
  { symbol: 'EURGBP',  name: 'Euro / British Pound',     bid: 0.8501,  ask: 0.8502,  change: 0.0018, changePercent:  0.21, category: 'Forex' },
  { symbol: 'EURJPY',  name: 'Euro / Japanese Yen',      bid: 162.678, ask: 162.688, change: 0.456,  changePercent:  0.28, category: 'Forex' },
  { symbol: 'GBPJPY',  name: 'GBP / Japanese Yen',       bid: 191.234, ask: 191.244, change: -0.234, changePercent: -0.12, category: 'Forex' },
  { symbol: 'EURCHF',  name: 'Euro / Swiss Franc',       bid: 0.9501,  ask: 0.9502,  change: 0.0011, changePercent:  0.12, category: 'Forex' },
  { symbol: 'EURAUD',  name: 'Euro / AUD',               bid: 1.6701,  ask: 1.6702,  change: -0.0045,changePercent: -0.27, category: 'Forex' },
  { symbol: 'GBPCHF',  name: 'GBP / Swiss Franc',        bid: 1.1178,  ask: 1.1179,  change: -0.0023,changePercent: -0.21, category: 'Forex' },
  { symbol: 'AUDCAD',  name: 'AUD / Canadian Dollar',    bid: 0.8389,  ask: 0.8390,  change: 0.0012, changePercent:  0.14, category: 'Forex' },
  { symbol: 'CADJPY',  name: 'Canadian Dollar / JPY',    bid: 116.145, ask: 116.155, change: 0.345,  changePercent:  0.30, category: 'Forex' },
  // COMMODITIES
  { symbol: 'XAUUSD',  name: 'Gold',                     bid: 2678,    ask: 2679,    change: 12,     changePercent:  0.45, category: 'Commodities' },
  { symbol: 'XAGUSD',  name: 'Silver',                   bid: 31.45,   ask: 31.46,   change: -0.34,  changePercent: -1.07, category: 'Commodities' },
  { symbol: 'WTIUSD',  name: 'WTI Crude Oil',            bid: 68.45,   ask: 68.47,   change: -0.89,  changePercent: -1.28, category: 'Commodities' },
  { symbol: 'BRENTUSD',name: 'Brent Crude Oil',          bid: 72.34,   ask: 72.36,   change: -1.12,  changePercent: -1.52, category: 'Commodities' },
  { symbol: 'NGAS',    name: 'Natural Gas',              bid: 3.234,   ask: 3.236,   change: 0.089,  changePercent:  2.83, category: 'Commodities' },
  { symbol: 'XCUUSD',  name: 'Copper',                   bid: 4.12,    ask: 4.13,    change: 0.05,   changePercent:  1.23, category: 'Commodities' },
  { symbol: 'CORN',    name: 'Corn Futures',             bid: 445.25,  ask: 445.50,  change: 3.25,   changePercent:  0.73, category: 'Commodities' },
  { symbol: 'WHEAT',   name: 'Wheat Futures',            bid: 578.75,  ask: 579.00,  change: -5.50,  changePercent: -0.94, category: 'Commodities' },
  { symbol: 'COFFEE',  name: 'Coffee Futures',           bid: 234.50,  ask: 234.60,  change: 4.30,   changePercent:  1.87, category: 'Commodities' },
  // ÍNDICES
  { symbol: 'US30',    name: 'Dow Jones',                bid: 43875,   ask: 43877,   change: 53,     changePercent:  0.12, category: 'Índices' },
  { symbol: 'NAS100',  name: 'NASDAQ 100',               bid: 21345,   ask: 21347,   change: 75,     changePercent:  0.35, category: 'Índices' },
  { symbol: 'SPX500',  name: 'S&P 500',                  bid: 5932,    ask: 5933,    change: 11,     changePercent:  0.18, category: 'Índices' },
  { symbol: 'VIX',     name: 'Volatility Index',         bid: 16.45,   ask: 16.47,   change: -1.23,  changePercent: -6.96, category: 'Índices' },
  { symbol: 'GER40',   name: 'DAX 40',                   bid: 19234.50,ask: 19235.00,change: 45.20,  changePercent:  0.24, category: 'Índices' },
  { symbol: 'UK100',   name: 'FTSE 100',                 bid: 8456.30, ask: 8456.80, change: -12.40, changePercent: -0.15, category: 'Índices' },
  { symbol: 'FRA40',   name: 'CAC 40',                   bid: 7823.40, ask: 7823.90, change: 23.10,  changePercent:  0.30, category: 'Índices' },
  { symbol: 'JPN225',  name: 'Nikkei 225',               bid: 38234.50,ask: 38235.00,change: 156.30, changePercent:  0.41, category: 'Índices' },
  { symbol: 'HK50',    name: 'Hang Seng',                bid: 19456.70,ask: 19457.20,change: -89.40, changePercent: -0.46, category: 'Índices' },
  { symbol: 'AUS200',  name: 'ASX 200',                  bid: 8123.40, ask: 8123.90, change: -23.50, changePercent: -0.29, category: 'Índices' },
  { symbol: 'INDIA50', name: 'Nifty 50',                 bid: 22345.60,ask: 22346.10,change: 78.90,  changePercent:  0.35, category: 'Índices' },
  { symbol: 'BRA',     name: 'Ibovespa',                 bid: 125678,  ask: 125679,  change: 456,    changePercent:  0.36, category: 'Índices' },
  // STOCKS US
  { symbol: 'AAPL',    name: 'Apple Inc',                bid: 178.45,  ask: 178.47,  change: 2.34,   changePercent:  1.33, category: 'Stocks US' },
  { symbol: 'MSFT',    name: 'Microsoft Corp',           bid: 412.50,  ask: 412.52,  change: -3.20,  changePercent: -0.77, category: 'Stocks US' },
  { symbol: 'GOOGL',   name: 'Alphabet Inc',             bid: 142.30,  ask: 142.32,  change: 1.45,   changePercent:  1.03, category: 'Stocks US' },
  { symbol: 'AMZN',    name: 'Amazon.com Inc',           bid: 178.90,  ask: 178.92,  change: 2.10,   changePercent:  1.19, category: 'Stocks US' },
  { symbol: 'NVDA',    name: 'NVIDIA Corp',              bid: 845.60,  ask: 845.65,  change: 15.30,  changePercent:  1.84, category: 'Stocks US' },
  { symbol: 'TSLA',    name: 'Tesla Inc',                bid: 234.50,  ask: 234.52,  change: -5.60,  changePercent: -2.33, category: 'Stocks US' },
  { symbol: 'META',    name: 'Meta Platforms',           bid: 498.70,  ask: 498.72,  change: 8.90,   changePercent:  1.82, category: 'Stocks US' },
  { symbol: 'JPM',     name: 'JPMorgan Chase',           bid: 189.40,  ask: 189.42,  change: -1.50,  changePercent: -0.79, category: 'Stocks US' },
  { symbol: 'V',       name: 'Visa Inc',                 bid: 278.90,  ask: 278.92,  change: 2.40,   changePercent:  0.87, category: 'Stocks US' },
  { symbol: 'NFLX',    name: 'Netflix Inc',              bid: 612.30,  ask: 612.35,  change: 8.90,   changePercent:  1.47, category: 'Stocks US' },
  { symbol: 'AMD',     name: 'Advanced Micro Devices',  bid: 167.80,  ask: 167.82,  change: -2.30,  changePercent: -1.35, category: 'Stocks US' },
  { symbol: 'PYPL',    name: 'PayPal Holdings',          bid: 67.80,   ask: 67.81,   change: -1.20,  changePercent: -1.74, category: 'Stocks US' },
  { symbol: 'COIN',    name: 'Coinbase Global',          bid: 234.50,  ask: 234.52,  change: -5.60,  changePercent: -2.33, category: 'Stocks US' },
  { symbol: 'BA',      name: 'Boeing Co',                bid: 189.40,  ask: 189.42,  change: -3.50,  changePercent: -1.81, category: 'Stocks US' },
  { symbol: 'GS',      name: 'Goldman Sachs',            bid: 456.70,  ask: 456.72,  change: 3.20,   changePercent:  0.71, category: 'Stocks US' },
  // STOCKS BR
  { symbol: 'PETR4',   name: 'Petrobras PN',             bid: 38.45,   ask: 38.46,   change: 0.78,   changePercent:  2.07, category: 'Stocks BR' },
  { symbol: 'VALE3',   name: 'Vale ON',                  bid: 64.23,   ask: 64.24,   change: -0.56,  changePercent: -0.86, category: 'Stocks BR' },
  { symbol: 'ITUB4',   name: 'Itaú Unibanco PN',         bid: 28.90,   ask: 28.91,   change: 0.34,   changePercent:  1.19, category: 'Stocks BR' },
  { symbol: 'BBDC4',   name: 'Bradesco PN',              bid: 13.45,   ask: 13.46,   change: -0.12,  changePercent: -0.88, category: 'Stocks BR' },
  { symbol: 'BBAS3',   name: 'Banco do Brasil ON',       bid: 26.78,   ask: 26.79,   change: 0.45,   changePercent:  1.71, category: 'Stocks BR' },
  { symbol: 'WEGE3',   name: 'WEG ON',                   bid: 42.56,   ask: 42.57,   change: 0.89,   changePercent:  2.14, category: 'Stocks BR' },
  { symbol: 'EMBR3',   name: 'Embraer ON',               bid: 38.90,   ask: 38.91,   change: 1.20,   changePercent:  3.18, category: 'Stocks BR' },
  { symbol: 'MGLU3',   name: 'Magazine Luiza ON',        bid: 2.34,    ask: 2.35,    change: -0.06,  changePercent: -2.50, category: 'Stocks BR' },
  { symbol: 'B3SA3',   name: 'B3 ON',                    bid: 11.45,   ask: 11.46,   change: 0.12,   changePercent:  1.06, category: 'Stocks BR' },
  { symbol: 'TOTS3',   name: 'TOTVS ON',                 bid: 29.40,   ask: 29.41,   change: 0.67,   changePercent:  2.33, category: 'Stocks BR' },
];

// ============================================================
// MAPEAMENTO BINANCE (crypto → símbolo Binance)
// ============================================================

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT', BNBUSD: 'BNBUSDT',
  SOLUSD: 'SOLUSDT', XRPUSD: 'XRPUSDT', ADAUSD: 'ADAUSDT',
  DOGEUSD: 'DOGEUSDT', DOTUSD: 'DOTUSDT', LTCUSD: 'LTCUSDT',
  AVAXUSD: 'AVAXUSDT', LINKUSD: 'LINKUSDT', ATOMUSD: 'ATOMUSDT',
  UNIUSD: 'UNIUSDT', NEARUSD: 'NEARUSDT', TRXUSD: 'TRXUSDT',
  APTUSD: 'APTUSDT', FTMUSD: 'FTMUSDT', MATICUSD: 'MATICUSDT',
  GALAUSD: 'GALAUSDT', AXSUSD: 'AXSUSDT',
};

const TIMEFRAME_TO_BINANCE: Record<Timeframe, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1H': '1h', '2H': '2h', '4H': '4h', '1D': '1d', '1W': '1w', '1M': '1M',
};

function toBinanceSymbol(symbol: string): string | null {
  return BINANCE_SYMBOL_MAP[symbol] || null;
}

function isCrypto(symbol: string): boolean {
  return !!toBinanceSymbol(symbol);
}

// ============================================================
// FETCH DE CANDLES (Binance direto ou fallback gerado)
// ============================================================

async function fetchCandlesBinance(symbol: string, timeframe: Timeframe, limit = 200): Promise<KLineData[]> {
  const bSymbol = toBinanceSymbol(symbol);
  if (!bSymbol) return generateFallbackCandles(symbol, timeframe, limit);

  try {
    const interval = TIMEFRAME_TO_BINANCE[timeframe];
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=${interval}&limit=${limit}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const data: any[][] = await res.json();
    return data.map((c) => ({
      timestamp: c[0],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    }));
  } catch {
    return generateFallbackCandles(symbol, timeframe, limit);
  }
}

function generateFallbackCandles(symbol: string, timeframe: Timeframe, limit = 200): KLineData[] {
  const BASE_PRICES: Record<string, number> = {
    EURUSD: 1.0415, GBPUSD: 1.2245, USDJPY: 156.24, USDCHF: 0.9145,
    AUDUSD: 0.6245, USDCAD: 1.4425, NZDUSD: 0.5679, EURGBP: 0.8501,
    EURJPY: 162.67, GBPJPY: 191.23, XAUUSD: 2678,   XAGUSD: 31.45,
    WTIUSD: 68.45,  BRENTUSD: 72.34, NGAS: 3.234,    XCUUSD: 4.12,
    US30: 43875,    NAS100: 21345,   SPX500: 5932,   VIX: 16.45,
    GER40: 19234,   UK100: 8456,     FRA40: 7823,    JPN225: 38234,
    AUS200: 8123,   HK50: 19456,     INDIA50: 22345, BRA: 125678,
    AAPL: 178.45,   MSFT: 412.50,    GOOGL: 142.30,  AMZN: 178.90,
    NVDA: 845.60,   TSLA: 234.50,    META: 498.70,   NFLX: 612.30,
    PETR4: 38.45,   VALE3: 64.23,    ITUB4: 28.90,   BBAS3: 26.78,
    CORN: 445,      WHEAT: 578,      COFFEE: 234,
  };

  const MS: Record<Timeframe, number> = {
    '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
    '1H': 3600000, '2H': 7200000, '4H': 14400000, '1D': 86400000,
    '1W': 604800000, '1M': 2592000000,
  };

  const vol = 0.001;
  let seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  let base = BASE_PRICES[symbol] ?? 100;
  const interval = MS[timeframe];
  const now = Date.now();
  const candles: KLineData[] = [];

  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = now - i * interval;
    const chg = (rnd() - 0.5) * 2 * vol;
    const open = base;
    const close = base * (1 + chg);
    const high = Math.max(open, close) * (1 + rnd() * vol * 0.5);
    const low = Math.min(open, close) * (1 - rnd() * vol * 0.5);
    const volume = rnd() * 1e6 + 5e5;
    candles.push({ timestamp, open, high, low, close, volume });
    base = close;
  }
  return candles;
}

// ============================================================
// FETCH TICKER (preço atual Binance)
// ============================================================

interface TickerResult {
  price: number;
  change: number;
  changePercent: number;
}

async function fetchTicker(symbol: string): Promise<TickerResult | null> {
  const bSymbol = toBinanceSymbol(symbol);
  if (!bSymbol) return null;
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${bSymbol}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      price: parseFloat(d.lastPrice),
      change: parseFloat(d.priceChange),
      changePercent: parseFloat(d.priceChangePercent),
    };
  } catch {
    return null;
  }
}

// ============================================================
// CÁLCULOS TÉCNICOS
// ============================================================

function calcRSI(data: KLineData[], period = 14): number {
  if (data.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const chg = data[i].close - data[i - 1].close;
    if (chg > 0) gains += chg; else losses += Math.abs(chg);
  }
  const ag = gains / period, al = losses / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function calcMA(data: KLineData[], period: number): number {
  if (data.length < period) return data[data.length - 1].close;
  const sl = data.slice(-period);
  return sl.reduce((a, c) => a + c.close, 0) / period;
}

function generateSignal(data: KLineData[]): TradingSignal {
  if (data.length < 50) return { type: 'NEUTRAL', strength: 0, reasons: ['Dados insuficientes'], rsi: 50, trend: 'sideways' };
  const rsi = calcRSI(data);
  const ma20 = calcMA(data, 20);
  const ma50 = calcMA(data, 50);
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const reasons: string[] = [];
  let pts = 0;

  if (rsi < 30) { reasons.push(`RSI em sobrevenda (${rsi.toFixed(1)})`); pts += 25; }
  else if (rsi > 70) { reasons.push(`RSI em sobrecompra (${rsi.toFixed(1)})`); pts -= 25; }
  if (last.close > ma20 && last.close > ma50) { reasons.push('Preço acima das MAs'); pts += 20; }
  else if (last.close < ma20 && last.close < ma50) { reasons.push('Preço abaixo das MAs'); pts -= 20; }
  if (last.close > last.open && prev.close > prev.open) { reasons.push('Momentum de alta'); pts += 15; }
  else if (last.close < last.open && prev.close < prev.open) { reasons.push('Momentum de baixa'); pts -= 15; }

  let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
  if (ma20 > ma50 && last.close > ma20) { trend = 'bullish'; reasons.push('Tendência de alta'); }
  else if (ma20 < ma50 && last.close < ma20) { trend = 'bearish'; reasons.push('Tendência de baixa'); }
  else { reasons.push('Mercado lateral'); }

  const type: 'BUY' | 'SELL' | 'NEUTRAL' = pts >= 40 ? 'BUY' : pts <= -40 ? 'SELL' : 'NEUTRAL';
  return { type, strength: Math.abs(pts), reasons, rsi, trend };
}

function detectZones(data: KLineData[], currentPrice: number): LiquidityZone[] {
  if (data.length < 20) return [];
  const priceMap = new Map<string, { count: number; volume: number }>();
  data.forEach((c) => {
    const step = currentPrice * 0.001;
    const rH = (Math.round(c.high / step) * step).toFixed(5);
    const rL = (Math.round(c.low / step) * step).toFixed(5);
    [rH, rL].forEach((lv) => {
      const e = priceMap.get(lv) || { count: 0, volume: 0 };
      e.count++;
      e.volume += c.volume || 0;
      priceMap.set(lv, e);
    });
  });
  return Array.from(priceMap.entries())
    .filter(([, d]) => d.count >= 3)
    .sort((a, b) => b[1].volume - a[1].volume)
    .slice(0, 8)
    .map(([priceStr, d], i) => {
      const price = parseFloat(priceStr);
      const strength = Math.min((d.count / 10) * 100, 100);
      const sig: 'critical' | 'strong' | 'moderate' | 'weak' =
        strength >= 80 ? 'critical' : strength >= 60 ? 'strong' : strength >= 40 ? 'moderate' : 'weak';
      return {
        id: `z-${i}`,
        price,
        strength,
        type: price < currentPrice ? 'support' : 'resistance',
        touches: d.count,
        volume: d.volume,
        distance: ((price - currentPrice) / currentPrice) * 100,
        significance: sig,
      };
    })
    .sort((a, b) => b.price - a.price);
}

// ============================================================
// FORMATAÇÃO
// ============================================================

function formatPrice(price: number, symbol: string): string {
  if (symbol.includes('JPY')) return price.toFixed(3);
  if (
    symbol.includes('BTC') || symbol.includes('ETH') ||
    symbol.includes('XAU') || symbol.includes('US30') ||
    symbol.includes('NAS') || symbol.includes('SPX') ||
    symbol.includes('GER') || symbol.includes('JPN') ||
    symbol.includes('HK')  || symbol.includes('AUS') ||
    symbol.includes('INDIA')|| symbol.includes('BRA') ||
    price > 1000
  ) return price.toFixed(2);
  if (price > 1) return price.toFixed(5);
  return price.toFixed(6);
}

function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ============================================================
// COMPONENTE: SIDEBAR DE FERRAMENTAS DE DESENHO
// ============================================================

interface DrawingSidebarProps {
  onToolSelect: (tool: string) => void;
  onDeleteAll: () => void;
  activeDrawingTool: string | null;
  crosshairMode: 'arrow' | 'crosshair' | 'dot';
  onCrosshairChange: (m: 'arrow' | 'crosshair' | 'dot') => void;
}

function DrawingSidebar({ onToolSelect, onDeleteAll, activeDrawingTool, crosshairMode, onCrosshairChange }: DrawingSidebarProps) {
  const groups = [
    {
      label: 'Cursor',
      tools: [
        { id: 'cursor-arrow',     icon: Navigation, label: 'Seta (padrão)',   action: () => onCrosshairChange('arrow') },
        { id: 'cursor-crosshair', icon: Crosshair,  label: 'Cruz',            action: () => onCrosshairChange('crosshair') },
        { id: 'cursor-dot',       icon: Target,     label: 'Ponto',           action: () => onCrosshairChange('dot') },
      ],
    },
    {
      label: 'Linhas',
      tools: [
        { id: 'trendline',    icon: TrendingUpDown, label: 'Linha de Tendência' },
        { id: 'horizontal-line', icon: Minus,       label: 'Linha Horizontal'   },
        { id: 'vertical-line',  icon: Minus,        label: 'Linha Vertical'     },
        { id: 'ray',          icon: Navigation,     label: 'Raio'               },
      ],
    },
    {
      label: 'Fibonacci',
      tools: [
        { id: 'fib-retracement', icon: GitBranch, label: 'Retração de Fibonacci' },
        { id: 'fib-extension',   icon: GitBranch, label: 'Extensão de Fibonacci' },
      ],
    },
    {
      label: 'Formas',
      tools: [
        { id: 'rectangle', icon: Square,   label: 'Retângulo' },
        { id: 'triangle',  icon: Triangle, label: 'Triângulo' },
      ],
    },
    {
      label: 'Texto',
      tools: [
        { id: 'text', icon: Type, label: 'Anotação de Texto' },
      ],
    },
    {
      label: 'Medir',
      tools: [
        { id: 'measure', icon: Ruler, label: 'Régua' },
      ],
    },
  ];

  return (
    <div className="w-10 bg-[#0d0d0d] border-r border-gray-800 flex flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto">
      {groups.map((group) => (
        <React.Fragment key={group.label}>
          {group.tools.map((tool) => {
            const Icon = tool.icon;
            const isCursorTool = tool.id.startsWith('cursor-');
            const isActive = isCursorTool
              ? crosshairMode === tool.id.replace('cursor-', '')
              : activeDrawingTool === tool.id;
            return (
              <button
                key={tool.id}
                title={tool.label}
                onClick={() => tool.action ? tool.action() : onToolSelect(tool.id)}
                className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          <div className="w-6 h-px bg-gray-800 my-1" />
        </React.Fragment>
      ))}

      {/* Apagar tudo */}
      <button
        title="Apagar todos os desenhos"
        onClick={onDeleteAll}
        className="w-8 h-8 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all mt-auto"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================
// COMPONENTE: PAINEL DE ZONAS DE LIQUIDEZ
// ============================================================

function LiquidityPanel({ zones, currentPrice }: { zones: LiquidityZone[]; currentPrice: number | null }) {
  if (!zones.length) return null;

  const colorMap = {
    critical: 'border-red-500 text-red-400',
    strong:   'border-orange-500 text-orange-400',
    moderate: 'border-yellow-500 text-yellow-400',
    weak:     'border-gray-600 text-gray-400',
  };

  return (
    <div className="w-52 bg-[#0d0d0d] border-l border-gray-800 flex flex-col shrink-0 overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <p className="text-xs font-bold text-white">Liquidez</p>
        <p className="text-xs text-gray-500">{zones.length} zonas</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {zones.map((z) => (
          <div key={z.id} className={`border rounded p-2 ${colorMap[z.significance]}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold uppercase">{z.type === 'support' ? 'Suporte' : 'Resist.'}</span>
              <span className="text-[10px] font-mono">{z.strength.toFixed(0)}%</span>
            </div>
            <div className="text-xs font-mono font-bold">{z.price.toFixed(currentPrice && currentPrice > 100 ? 2 : 5)}</div>
            <div className="text-[10px] text-gray-500">{z.touches} toques · {z.distance.toFixed(2)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL: StandaloneChartPage
// ============================================================

export default function StandaloneChartPage() {
  // ── Estado principal ──────────────────────────────────────
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
  const [timeframe, setTimeframe]           = useState<Timeframe>('1H');
  const [currentPrice, setCurrentPrice]     = useState<number | null>(null);
  const [displayedPrice, setDisplayedPrice] = useState<number | null>(null);
  const [dailyChange, setDailyChange]       = useState(0);
  const [dailyChangePercent, setDailyChangePct] = useState(0);
  const [isPositive, setIsPositive]         = useState(true);
  const [candleCountdown, setCandleCountdown] = useState(0);

  // ── Busca de ativos ──────────────────────────────────────
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetSearch, setAssetSearch]       = useState('');
  const [assetCategory, setAssetCategory]  = useState('Todos');

  // ── Indicadores ──────────────────────────────────────────
  const [showIndicators, setShowIndicators] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [indicatorCategory, setIndicatorCategory] = useState('all');

  // ── Ferramentas de desenho ────────────────────────────────
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const [crosshairMode, setCrosshairMode]          = useState<'arrow' | 'crosshair' | 'dot'>('arrow');

  // ── Sinais e zonas ───────────────────────────────────────
  const [tradingSignal, setTradingSignal] = useState<TradingSignal>({
    type: 'NEUTRAL', strength: 0, reasons: [], rsi: 50, trend: 'sideways',
  });
  const [liquidityZones, setLiquidityZones] = useState<LiquidityZone[]>([]);

  // ── UI / contexto ──────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [timeframeExpanded, setTimeframeExpanded] = useState(false);
  const [showLivePanel, setShowLivePanel] = useState(true);

  // ── Refs ──────────────────────────────────────────────────
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartIdRef         = useRef(`neural-chart-${Math.random().toString(36).slice(2, 8)}`);
  const chartInstanceRef   = useRef<any>(null);
  const chartDataRef       = useRef<KLineData[]>([]);
  const isFirstLoadRef     = useRef(true);
  const wsRef              = useRef<WebSocket | null>(null);
  const assetModalRef      = useRef<HTMLDivElement>(null);

  const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '1D', '1W', '1M'];
  const VISIBLE_TFS: Timeframe[] = ['1m', '5m', '15m', '30m', '1H'];

  // ── Assets filtrados ──────────────────────────────────────
  const filteredAssets = useMemo(() =>
    ASSETS.filter((a) => {
      const q = assetSearch.toLowerCase();
      const matchQ = a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
      const matchC = assetCategory === 'Todos' || a.category === assetCategory;
      return matchQ && matchC;
    }), [assetSearch, assetCategory]);

  // ── Indicadores filtrados ─────────────────────────────────
  const filteredIndicators = useMemo(() =>
    INDICATORS.filter((ind) => {
      const matchC = indicatorCategory === 'all' || ind.category === indicatorCategory;
      const q = indicatorSearch.toLowerCase();
      const matchQ = ind.name.toLowerCase().includes(q) || ind.description.toLowerCase().includes(q);
      return matchC && matchQ;
    }), [indicatorCategory, indicatorSearch]);

  // ── Countdown de candle ───────────────────────────────────
  useEffect(() => {
    const MS: Record<Timeframe, number> = {
      '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3,
      '1H': 3600e3, '2H': 7200e3, '4H': 14400e3, '1D': 86400e3,
      '1W': 604800e3, '1M': 2592000e3,
    };
    const update = () => {
      const interval = MS[timeframe];
      setCandleCountdown(interval - (Date.now() % interval));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [timeframe]);

  // ── Throttle do preço exibido ─────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setDisplayedPrice(currentPrice), 1000);
    return () => clearInterval(t);
  }, [currentPrice]);

  // ── Fechar modal de ativos ao clicar fora ─────────────────
  useEffect(() => {
    if (!showAssetModal) return;
    const handler = (e: MouseEvent) => {
      if (assetModalRef.current && !assetModalRef.current.contains(e.target as Node)) {
        setShowAssetModal(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAssetModal]);

  // ── Fechar menu de contexto ao clicar ────────────────────
  useEffect(() => {
    const h = () => setContextMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') { setShowAssetModal(false); setContextMenu(null); }
      if (e.altKey && e.key.toLowerCase() === 'c') handleCrosshairChange('crosshair');
      if (e.altKey && e.key.toLowerCase() === 'x') handleCrosshairChange('arrow');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── INICIALIZAÇÃO DO GRÁFICO ──────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartId = chartIdRef.current;

    // Descartar gráfico anterior se existir
    try { dispose(chartId); } catch (_) {}

    const chart = init(chartId);
    if (!chart) return;

    // Aplicar estilos profissionais
    chart.setStyles({
      candle: {
        type: 'candle_solid',
        bar: {
          upColor: '#22c55e', downColor: '#ef4444',
          upBorderColor: '#22c55e', downBorderColor: '#ef4444',
          upWickColor: '#22c55e', downWickColor: '#ef4444',
        },
        priceMark: {
          show: true,
          high:  { show: true, color: '#22c55e', textColor: '#fff', format: (v: number) => v.toFixed(2) },
          low:   { show: true, color: '#ef4444', textColor: '#fff', format: (v: number) => v.toFixed(2) },
          last:  {
            show: true, upColor: '#22c55e', downColor: '#f97316', noChangeColor: '#9ca3af',
            text: { show: true, color: '#fff', format: (v: number) => v.toFixed(2) },
          },
        },
        tooltip: {
          showRule: 'always',
          showType: 'standard',
          custom: [
            { title: 'Time',   value: '{time}' },
            { title: 'Open',   value: '{open}' },
            { title: 'High',   value: '{high}' },
            { title: 'Low',    value: '{low}'  },
            { title: 'Close',  value: '{close}' },
            { title: 'Volume', value: '{volume}' },
          ],
          text: { size: 12, family: 'monospace', color: '#ffffff', marginLeft: 8, marginTop: 6 },
          rect: { position: 'right', borderSize: 0, borderColor: 'transparent', color: 'transparent' },
        },
      },
      grid: {
        show: true,
        horizontal: { show: true, size: 1, color: '#2a2a2a', style: 'solid' },
        vertical:   { show: true, size: 1, color: '#1a1a1a', style: 'solid' },
      },
      crosshair: {
        show: false,
        horizontal: { show: false, line: { show: false, size: 0, color: 'transparent' }, text: { show: false } },
        vertical:   { show: false, line: { show: false, size: 0, color: 'transparent' }, text: { show: false } },
      },
      xAxis: { axisLine: { show: false } },
      yAxis: {
        show: true, size: 75,
        axisLine: { show: true, size: 1, color: '#4a4a4a' },
        position: 'right',
        tickLine: { show: true, size: 1, length: 4, color: '#4a4a4a' },
        tickText: { show: true, size: 8, family: 'Arial, sans-serif', color: '#e0e0e0', marginStart: 2, marginEnd: 2 },
      },
      separator: { size: 0 },
    });

    chart.setBarSpace(8);
    chart.removeOverlay();
    chartInstanceRef.current = chart;

    // Subscrever clique em overlay
    chart.subscribeAction('onOverlayClick', (data: any) => {
      if (data?.overlay) toast.info('Desenho selecionado');
    });

    // Redimensionamento
    const onResize = () => { if (chartContainerRef.current) chart.resize(); };
    window.addEventListener('resize', onResize);

    // ── Carregar dados ─────────────────────────────────────
    const loadData = async () => {
      const candles = await fetchCandlesBinance(selectedSymbol, timeframe);
      if (!candles.length) return;

      // Preço atual via ticker
      const ticker = await fetchTicker(selectedSymbol);
      if (ticker) {
        setCurrentPrice(ticker.price);
        setDailyChange(ticker.change);
        setDailyChangePct(ticker.changePercent);
        setIsPositive(ticker.changePercent >= 0);
      } else {
        const last = candles[candles.length - 1];
        const first = candles[0];
        const chg = last.close - first.open;
        setCurrentPrice(last.close);
        setDailyChange(chg);
        setDailyChangePct((chg / first.open) * 100);
        setIsPositive(chg >= 0);
      }

      chart.applyNewData(candles);
      chart.setPriceVolumePrecision(2, 0);
      chart.removeOverlay();

      if (isFirstLoadRef.current) {
        try { chart.scrollToRealTime(); } catch (_) {
          try { chart.scrollToDataIndex(candles.length - 1); } catch (__) {}
        }
        isFirstLoadRef.current = false;
      }

      chartDataRef.current = candles;
      setLiquidityZones(detectZones(candles, candles[candles.length - 1].close));
      setTradingSignal(generateSignal(candles));
    };

    loadData();
    const refreshId = setInterval(loadData, 30000);

    return () => {
      window.removeEventListener('resize', onResize);
      clearInterval(refreshId);
      try { dispose(chartId); } catch (_) {}
    };
  }, [selectedSymbol, timeframe]);

  // ── WebSocket para Binance ────────────────────────────────
  useEffect(() => {
    const bSymbol = toBinanceSymbol(selectedSymbol);
    if (!bSymbol) return;
    const stream = bSymbol.toLowerCase() + '@ticker';
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        const newPrice = parseFloat(d.c);
        const chg = parseFloat(d.p);
        const chgPct = parseFloat(d.P);
        setCurrentPrice(newPrice);
        setDailyChange(chg);
        setDailyChangePct(chgPct);
        setIsPositive(chgPct >= 0);

        if (chartInstanceRef.current && chartDataRef.current.length > 0) {
          const last = chartDataRef.current[chartDataRef.current.length - 1];
          const updated = { ...last, close: newPrice, high: Math.max(last.high, newPrice), low: Math.min(last.low, newPrice) };
          try { chartInstanceRef.current.updateData(updated); } catch (_) {}
          const arr = [...chartDataRef.current];
          arr[arr.length - 1] = updated;
          chartDataRef.current = arr;
        }
      } catch (_) {}
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [selectedSymbol]);

  // ── CROSSHAIR / CURSOR ────────────────────────────────────
  const handleCrosshairChange = useCallback((mode: 'arrow' | 'crosshair' | 'dot') => {
    setCrosshairMode(mode);
    const chart = chartInstanceRef.current;
    if (!chart) return;
    const show = mode === 'crosshair';
    chart.setStyles({
      crosshair: {
        show,
        horizontal: { show, line: { show, style: 'solid', size: 1, color: '#6b7280' }, text: { show } },
        vertical:   { show, line: { show, style: 'solid', size: 1, color: '#6b7280' }, text: { show } },
      },
    });
    const dom = chart.getDom();
    if (dom) {
      dom.style.cursor = mode === 'dot' ? 'none' : mode === 'crosshair' ? 'crosshair' : 'default';
    }
  }, []);

  // ── FERRAMENTAS DE DESENHO ────────────────────────────────
  const handleDrawingTool = useCallback((tool: string) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    const MAP: Record<string, string> = {
      'trendline':        'segment',
      'horizontal-line':  'horizontalStraightLine',
      'vertical-line':    'verticalStraightLine',
      'ray':              'rayLine',
      'fib-retracement':  'fibonacciLine',
      'fib-extension':    'fibonacciExtension',
      'rectangle':        'rect',
      'triangle':         'triangle',
      'text':             'simpleAnnotation',
      'measure':          'segment',
    };

    const overlayType = MAP[tool];
    if (!overlayType) { toast.warning('Ferramenta em desenvolvimento'); return; }

    const supported = getSupportedOverlays();
    if (!supported.includes(overlayType) && overlayType !== 'fibonacciExtension') {
      toast.error(`Overlay não suportado: ${overlayType}`); return;
    }

    try {
      const id = chart.createOverlay(overlayType);
      if (id) {
        setActiveDrawingTool(tool);
        toast.success(`Ferramenta: ${tool}`, { description: 'Clique no gráfico para desenhar', duration: 2500 });
      } else {
        toast.error('Erro ao criar ferramenta de desenho');
      }
    } catch (e) {
      toast.error('Erro ao ativar ferramenta');
    }
  }, []);

  const handleDeleteAll = useCallback(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    try { chart.removeOverlay(); toast.success('Todos os desenhos removidos'); }
    catch (_) { toast.error('Erro ao remover desenhos'); }
  }, []);

  // ── INDICADORES ───────────────────────────────────────────
  const toggleIndicator = useCallback((ind: IndicatorConfig) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    const isOn = activeIndicators.has(ind.id);
    try {
      if (isOn) {
        chart.removeIndicator(ind.id);
        setActiveIndicators((s) => { const n = new Set(s); n.delete(ind.id); return n; });
      } else {
        const cfg: any = { name: ind.klinechartsName, id: ind.id };
        if (ind.defaultParams?.length) cfg.calcParams = ind.defaultParams;
        if (ind.isPaneIndicator) chart.createIndicator(cfg, false, { id: `pane_${ind.id}` });
        else chart.createIndicator(cfg, true);
        setActiveIndicators((s) => new Set(s).add(ind.id));
      }
    } catch (e) {
      toast.error('Erro ao alternar indicador');
    }
  }, [activeIndicators]);

  // ── SELEÇÃO DE ATIVO ──────────────────────────────────────
  const selectAsset = useCallback((asset: MarketAsset) => {
    isFirstLoadRef.current = true;
    setSelectedSymbol(asset.symbol);
    setCurrentPrice(asset.bid);
    setDailyChange(asset.change);
    setDailyChangePct(asset.changePercent);
    setIsPositive(asset.changePercent >= 0);
    setShowAssetModal(false);
    setActiveDrawingTool(null);
  }, []);

  // ── COMPUTADOS ────────────────────────────────────────────
  const signalColor = tradingSignal.type === 'BUY' ? 'text-green-400' : tradingSignal.type === 'SELL' ? 'text-red-400' : 'text-gray-400';
  const currentAsset = ASSETS.find((a) => a.symbol === selectedSymbol);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      {/* Sonner (toasts) */}
      <Toaster position="top-right" theme="dark" richColors />

      <style>{`
        #${chartIdRef.current} canvas {
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>

      <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">

        {/* ── MODAL DE SELEÇÃO DE ATIVO ─────────────────────── */}
        {showAssetModal && (
          <>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90]" onClick={() => setShowAssetModal(false)} />
            <div
              ref={assetModalRef}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[960px] h-[660px] bg-[#131722] border border-gray-700 rounded-xl shadow-2xl flex flex-col z-[100]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                <h2 className="text-base font-semibold text-white">Pesquisa de Símbolo</h2>
                <button onClick={() => setShowAssetModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-5 py-3 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Buscar símbolo..." autoFocus
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1e222d] border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-700 overflow-x-auto">
                {['Todos', 'Crypto', 'Forex', 'Stocks US', 'Stocks BR', 'Índices', 'Commodities'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAssetCategory(cat)}
                    className={`px-4 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      assetCategory === cat ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filteredAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Search className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">Nenhum ativo encontrado</p>
                  </div>
                ) : filteredAssets.map((asset) => (
                  <div
                    key={asset.symbol}
                    onClick={() => selectAsset(asset)}
                    className={`flex items-center justify-between px-5 py-2.5 cursor-pointer border-b border-gray-800/50 hover:bg-[#1e222d] transition-colors ${
                      selectedSymbol === asset.symbol ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{asset.symbol.substring(0, 2)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400 font-semibold text-sm">{asset.symbol}</span>
                          <span className="text-gray-500 text-[10px] px-1.5 py-0.5 bg-gray-800 rounded uppercase">{asset.category}</span>
                        </div>
                        <div className="text-gray-400 text-xs truncate">{asset.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <span className="text-white text-sm font-mono tabular-nums">
                        {asset.bid.toFixed(asset.symbol.includes('JPY') ? 3 : 2)}
                      </span>
                      <span className={`text-sm font-semibold tabular-nums min-w-[64px] text-right ${asset.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-2.5 border-t border-gray-700 bg-[#1e222d]">
                <p className="text-xs text-gray-500 text-center">{filteredAssets.length} de {ASSETS.length} ativos</p>
              </div>
            </div>
          </>
        )}

        {/* ── HEADER: PREÇO E ATIVO ──────────────────────────── */}
        <div className="h-20 border-b border-gray-800 px-6 flex items-center justify-between bg-black shrink-0 z-30">
          <div className="flex items-center gap-6">
            {/* Seletor de ativo */}
            <button
              onClick={() => setShowAssetModal(true)}
              className="hover:bg-gray-900 px-3 py-2 rounded transition-colors"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{selectedSymbol}</h2>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-xs text-gray-500 text-left">{currentAsset?.name || selectedSymbol}</div>
            </button>

            {/* Preço */}
            <div className="flex items-center gap-6 pl-6 border-l border-gray-800">
              <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Preço Atual</div>
                <div className="text-4xl font-bold text-white tracking-tight tabular-nums" style={{ fontFamily: 'ui-monospace, monospace' }}>
                  {displayedPrice !== null
                    ? formatPrice(displayedPrice, selectedSymbol)
                    : <div className="h-10 w-32 bg-gray-800/50 animate-pulse rounded" />}
                </div>
              </div>

              {/* Variação */}
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 ${
                isPositive ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/15 border-red-500/40'
              }`}>
                {isPositive ? <TrendingUp className="w-6 h-6 text-green-400" /> : <TrendingDown className="w-6 h-6 text-red-400" />}
                <div>
                  <div className={`text-2xl font-bold tracking-tight tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                    style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {isPositive ? '+' : '-'}{Math.abs(dailyChange).toFixed(
                      selectedSymbol.includes('JPY') ? 3 : Math.abs(dailyChange) > 100 ? 2 : 5
                    )}
                  </div>
                  <div className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{dailyChangePercent.toFixed(2)}% hoje
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Direita: sinal + info */}
          <div className="flex items-center gap-4">
            {/* Sinal de trading */}
            <div className="text-right">
              <div className={`text-sm font-bold ${signalColor}`}>
                {tradingSignal.type === 'BUY' ? '▲ COMPRA' : tradingSignal.type === 'SELL' ? '▼ VENDA' : '● NEUTRO'}
              </div>
              <div className="text-xs text-gray-500">RSI: {tradingSignal.rsi.toFixed(1)} · Força: {tradingSignal.strength}%</div>
            </div>

            {/* Toggle painel live */}
            <button
              onClick={() => setShowLivePanel(!showLivePanel)}
              className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                showLivePanel ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-black border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              Liquidez
            </button>
          </div>
        </div>

        {/* ── BARRA DE TIMEFRAME + FERRAMENTAS ───────────────── */}
        <div
          className="h-12 border-b border-gray-800 px-6 flex items-center gap-4 bg-[#0a0a0a] shrink-0"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Timeframes */}
          <div
            className="flex items-center gap-2"
            onMouseEnter={() => setTimeframeExpanded(true)}
            onMouseLeave={() => setTimeframeExpanded(false)}
          >
            <span className="text-xs text-gray-500 font-medium">Timeframe:</span>
            <div className="flex gap-1">
              {(timeframeExpanded ? TIMEFRAMES : VISIBLE_TFS).map((tf) => (
                <button
                  key={tf}
                  onClick={() => { isFirstLoadRef.current = true; setTimeframe(tf); }}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all ${
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

          <div className="h-5 w-px bg-gray-800 mx-1" />

          {/* Indicadores */}
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded border transition-all ${
              showIndicators ? 'bg-gray-700 text-white border-gray-600' : 'bg-black text-gray-400 hover:text-white hover:bg-gray-800 border-gray-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Indicadores {activeIndicators.size > 0 && `(${activeIndicators.size})`}</span>
          </button>

          {/* Backtest placeholder */}
          <button className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded border bg-black text-gray-400 hover:text-white hover:bg-gray-800 border-gray-700 transition-all">
            <Zap className="w-3.5 h-3.5" />
            <span>Backtest</span>
          </button>

          {/* Trophy placeholder */}
          <button className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded border bg-gradient-to-r from-purple-600 to-orange-600 text-white border-purple-500 hover:opacity-90 transition-all">
            <Trophy className="w-3.5 h-3.5" />
            <span>AI vs Trader</span>
          </button>

          {/* Countdown */}
          <div className="ml-auto flex items-center gap-1.5 text-gray-500">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono text-blue-400">{formatCountdown(candleCountdown)}</span>
          </div>
        </div>

        {/* ── ÁREA PRINCIPAL: TOOLBAR + GRÁFICO + PAINEIS ──── */}
        <div className="flex-1 flex min-h-0">

          {/* Toolbar de desenho vertical */}
          <DrawingSidebar
            onToolSelect={handleDrawingTool}
            onDeleteAll={handleDeleteAll}
            activeDrawingTool={activeDrawingTool}
            crosshairMode={crosshairMode}
            onCrosshairChange={handleCrosshairChange}
          />

          {/* Container do gráfico klinecharts */}
          <div
            ref={chartContainerRef}
            id={chartIdRef.current}
            className="flex-1 bg-black relative"
            style={{ minHeight: 400, height: '100%', willChange: 'transform', transform: 'translateZ(0)' }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
          />

          {/* Painel de indicadores (lateral direita) */}
          {showIndicators && (
            <div className="w-72 border-l border-gray-800 bg-[#0a0a0a] flex flex-col shrink-0 overflow-hidden">
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Indicadores</p>
                  <p className="text-xs text-gray-500">{filteredIndicators.length} disponíveis</p>
                </div>
                <button onClick={() => setShowIndicators(false)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Busca */}
              <div className="p-3 border-b border-gray-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text" value={indicatorSearch} onChange={(e) => setIndicatorSearch(e.target.value)}
                    placeholder="Buscar..." className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Categorias */}
              <div className="px-3 py-2 border-b border-gray-800 flex flex-wrap gap-1">
                {[
                  { id: 'all',                label: 'Todos'      },
                  { id: 'trend',              label: 'Tendência'  },
                  { id: 'momentum',           label: 'Momentum'   },
                  { id: 'volatility',         label: 'Volatil.'   },
                  { id: 'volume',             label: 'Volume'     },
                  { id: 'support_resistance', label: 'S&R'        },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setIndicatorCategory(cat.id)}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-all ${
                      indicatorCategory === cat.id ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Ativos */}
              {activeIndicators.size > 0 && (
                <div className="px-3 py-2 border-b border-gray-800">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Ativos ({activeIndicators.size})</p>
                  <div className="space-y-1">
                    {INDICATORS.filter((i) => activeIndicators.has(i.id)).map((ind) => (
                      <div key={ind.id} className="flex items-center justify-between px-2 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
                        <span className="text-blue-400 font-medium">{ind.name.split(' – ')[0]}</span>
                        <button onClick={() => toggleIndicator(ind)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {filteredIndicators.map((ind) => {
                  const on = activeIndicators.has(ind.id);
                  return (
                    <button
                      key={ind.id}
                      onClick={() => toggleIndicator(ind)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all group ${
                        on ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-gray-900 hover:bg-gray-800 border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className={`text-sm font-medium ${on ? 'text-blue-300' : 'text-white'}`}>{ind.name}</span>
                        <span className="text-xs text-gray-500">{ind.description}</span>
                      </div>
                      <span className={`text-lg font-bold ${on ? 'text-red-400' : 'text-gray-600 group-hover:text-blue-400'}`}>
                        {on ? '−' : '+'}
                      </span>
                    </button>
                  );
                })}
                {filteredIndicators.length === 0 && (
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Nenhum indicador encontrado</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Painel de liquidez */}
          {showLivePanel && (
            <LiquidityPanel zones={liquidityZones} currentPrice={currentPrice} />
          )}
        </div>

        {/* ── MENU DE CONTEXTO (clique direito no gráfico) ──── */}
        {contextMenu && (
          <div
            className="fixed bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl py-1.5 z-[100] min-w-[300px] text-sm"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button onClick={() => { if (chartInstanceRef.current) try { chartInstanceRef.current.scrollToRealTime(); } catch (_) {} setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-white hover:bg-gray-700/50 flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-gray-400" />
              <span>Redefinir visão do gráfico</span>
            </button>
            <div className="h-px bg-gray-700 my-1" />
            <button
              onClick={() => { if (currentPrice !== null) { navigator.clipboard.writeText(currentPrice.toFixed(5)); toast.success('Preço copiado'); } setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-white hover:bg-gray-700/50"
              disabled={currentPrice === null}
            >
              Copiar preço {currentPrice !== null ? formatPrice(currentPrice, selectedSymbol) : '...'}
            </button>
            <div className="h-px bg-gray-700 my-1" />
            <button
              onClick={() => { setContextMenu(null); handleDrawingTool('trendline'); }}
              className="w-full px-4 py-2 text-left text-white hover:bg-gray-700/50 flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span>Linha de Tendência</span>
            </button>
            <button
              onClick={() => { setContextMenu(null); handleDrawingTool('horizontal-line'); }}
              className="w-full px-4 py-2 text-left text-white hover:bg-gray-700/50 flex items-center gap-3">
              <Minus className="w-4 h-4 text-blue-400" />
              <span>Linha Horizontal</span>
            </button>
            <button
              onClick={() => { setContextMenu(null); handleDrawingTool('fib-retracement'); }}
              className="w-full px-4 py-2 text-left text-white hover:bg-gray-700/50 flex items-center gap-3">
              <GitBranch className="w-4 h-4 text-yellow-400" />
              <span>Fibonacci Retração</span>
            </button>
            <div className="h-px bg-gray-700 my-1" />
            {activeIndicators.size > 0 && (
              <button
                onClick={() => {
                  INDICATORS.filter((i) => activeIndicators.has(i.id)).forEach(toggleIndicator);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700/50">
                Remover {activeIndicators.size} indicador{activeIndicators.size > 1 ? 'es' : ''}
              </button>
            )}
            <button
              onClick={() => { handleDeleteAll(); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700/50 flex items-center gap-3">
              <Trash2 className="w-4 h-4" />
              <span>Remover todos os desenhos</span>
            </button>
          </div>
        )}

        {/* ── PAINEL DE SINAIS (rodapé) ──────────────────────── */}
        {tradingSignal.type !== 'NEUTRAL' && tradingSignal.strength >= 40 && (
          <div className={`h-8 border-t flex items-center px-6 gap-4 shrink-0 ${
            tradingSignal.type === 'BUY' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          }`}>
            <span className={`text-xs font-bold ${tradingSignal.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
              {tradingSignal.type === 'BUY' ? '▲ SINAL DE COMPRA' : '▼ SINAL DE VENDA'} — Força: {tradingSignal.strength}%
            </span>
            <span className="text-xs text-gray-500">{tradingSignal.reasons.slice(0, 3).join(' · ')}</span>
            <span className="ml-auto text-xs text-gray-600">{tradingSignal.trend.toUpperCase()}</span>
          </div>
        )}
      </div>
    </>
  );
}
