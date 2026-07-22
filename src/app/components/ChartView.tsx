import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { init, dispose, getSupportedOverlays, registerOverlay, registerYAxis, registerIndicator, getSupportedIndicators } from 'klinecharts';
import type { KLineData, OverlayTemplate, AxisTemplate } from 'klinecharts';

// getIndicatorClass() existe na tipagem (.d.ts) mas NÃO é exportada pelo bundle
// ESM real da lib (confirmado: build da Vercel falhou com "not exported by
// klinecharts/dist/index.esm.js" — tsc não pegou porque só checa o .d.ts).
// getSupportedIndicators() é a alternativa realmente exportada em runtime.
const isIndicatorRegistered = (name: string) => getSupportedIndicators().includes(name);

// 🆕 Médias móveis no padrão MT5/MetaTrader — Período, Deslocar (shift), Método
// (Simples/Exponencial/Suavizada/Ponderada Linear) e Aplicar a (Fechamento/Abertura/
// Máxima/Mínima/Mediana/Típico/Ponderado), pedido explícito do Cleber com print do
// diálogo real do MT5 anexado. 'MA'/'EMA'/'SMA' são indicadores BUILT-IN do klinecharts
// (cálculo fixo, sem essas opções) — registerIndicator() com o MESMO nome SUBSTITUI
// a definição built-in inteira (indicators[name] = ..., é só um objeto — ver
// registerIndicator() em index.esm.js), então as 4 passam a ser variantes do mesmo
// motor completo, cada uma só com um "Método" padrão diferente (mas trocável no editor).
export type MAMethod = 'SIMPLE' | 'EXPONENTIAL' | 'SMOOTHED' | 'LINEAR_WEIGHTED';
export type AppliedPrice = 'CLOSE' | 'OPEN' | 'HIGH' | 'LOW' | 'MEDIAN' | 'TYPICAL' | 'WEIGHTED';

const getAppliedPriceValue = (bar: KLineData, appliedPrice: AppliedPrice): number => {
  switch (appliedPrice) {
    case 'OPEN': return bar.open;
    case 'HIGH': return bar.high;
    case 'LOW': return bar.low;
    case 'MEDIAN': return (bar.high + bar.low) / 2;
    case 'TYPICAL': return (bar.high + bar.low + bar.close) / 3;
    case 'WEIGHTED': return (bar.high + bar.low + 2 * bar.close) / 4;
    case 'CLOSE':
    default: return bar.close;
  }
};

// Calcula a média móvel sobre uma série de preços já resolvida (applied price),
// pro método escolhido. Retorna undefined nos índices sem dado suficiente ainda.
const computeMovingAverageSeries = (values: number[], period: number, method: MAMethod): (number | undefined)[] => {
  const result: (number | undefined)[] = new Array(values.length).fill(undefined);
  if (period <= 0) return result;
  switch (method) {
    case 'SIMPLE': {
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= period) sum -= values[i - period];
        if (i >= period - 1) result[i] = sum / period;
      }
      break;
    }
    case 'LINEAR_WEIGHTED': {
      const weightTotal = (period * (period + 1)) / 2;
      for (let i = period - 1; i < values.length; i++) {
        let weightedSum = 0;
        for (let j = 0; j < period; j++) {
          weightedSum += values[i - j] * (period - j);
        }
        result[i] = weightedSum / weightTotal;
      }
      break;
    }
    case 'EXPONENTIAL': {
      const alpha = 2 / (period + 1);
      let prev: number | undefined;
      for (let i = 0; i < values.length; i++) {
        if (i < period - 1) continue;
        if (prev === undefined) {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) sum += values[j];
          prev = sum / period;
        } else {
          prev = values[i] * alpha + prev * (1 - alpha);
        }
        result[i] = prev;
      }
      break;
    }
    case 'SMOOTHED': {
      // SMMA/RMA (suavização de Wilder) — mesma lógica do ATR/RSI clássico
      let prev: number | undefined;
      for (let i = 0; i < values.length; i++) {
        if (i < period - 1) continue;
        if (prev === undefined) {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) sum += values[j];
          prev = sum / period;
        } else {
          prev = (prev * (period - 1) + values[i]) / period;
        }
        result[i] = prev;
      }
      break;
    }
  }
  return result;
};

interface MAExtendData {
  method: MAMethod;
  appliedPrice: AppliedPrice;
  shift: number;
}

const registerMovingAverageIndicator = (name: string, defaultMethod: MAMethod) => {
  registerIndicator<number>({
    name,
    shortName: name,
    series: 'price' as any,
    precision: 2,
    calcParams: [20],
    shouldOhlc: true,
    figures: [{ key: 'ma', title: `${name}: `, type: 'line' }],
    calc: (dataList, indicator) => {
      const period = ((indicator.calcParams as number[])[0]) || 20;
      const ext: Partial<MAExtendData> = (indicator.extendData as MAExtendData) || {};
      const method = ext.method ?? defaultMethod;
      const appliedPrice = ext.appliedPrice ?? 'CLOSE';
      const shift = ext.shift ?? 0;
      const values = dataList.map(bar => getAppliedPriceValue(bar, appliedPrice));
      const maValues = computeMovingAverageSeries(values, period, method);
      // Deslocar (shift): positivo empurra a linha pra frente no tempo (mostra o valor
      // calculado N barras atrás na posição atual), negativo puxa pra trás -- mesmo
      // comportamento do campo "Deslocar" no MT5.
      return dataList.map((_, i) => {
        const srcIndex = i - shift;
        const value = srcIndex >= 0 && srcIndex < maValues.length ? maValues[srcIndex] : undefined;
        return { ma: value } as any;
      });
    }
  });
};

// 🆕 Indicadores customizados reais (WMA/ATR/Donchian/Pivot Points não existem nos
// built-ins do klinecharts — antes o app tentava criá-los mesmo assim, o que falhava
// silenciosamente (createIndicator loga um warning e retorna null, sem desenhar nada),
// deixando o toggle marcado como "ativo" na UI sem nenhum efeito real no gráfico.
registerMovingAverageIndicator('MA', 'SIMPLE');
registerMovingAverageIndicator('SMA', 'SIMPLE');
registerMovingAverageIndicator('EMA', 'EXPONENTIAL');
registerMovingAverageIndicator('WMA', 'LINEAR_WEIGHTED');

if (!isIndicatorRegistered('ATR')) {
  registerIndicator<number>({
    name: 'ATR',
    shortName: 'ATR',
    series: 'normal' as any,
    precision: 4,
    calcParams: [14],
    shouldOhlc: false,
    figures: [{ key: 'atr', title: 'ATR: ', type: 'line' }],
    calc: (dataList, indicator) => {
      const period = (indicator.calcParams as number[])[0] || 14;
      const trueRanges: number[] = [];
      return dataList.map((bar, i) => {
        if (i === 0) {
          trueRanges.push(bar.high - bar.low);
          return { atr: undefined } as any;
        }
        const prevClose = dataList[i - 1].close;
        const tr = Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose));
        trueRanges.push(tr);
        if (i < period) return { atr: undefined } as any;
        const window = trueRanges.slice(i - period + 1, i + 1);
        const atr = window.reduce((a, b) => a + b, 0) / period;
        return { atr } as any;
      });
    }
  });
}

if (!isIndicatorRegistered('DC')) {
  registerIndicator<number>({
    name: 'DC',
    shortName: 'DC',
    series: 'price' as any,
    precision: 2,
    calcParams: [20],
    shouldOhlc: false,
    figures: [
      { key: 'upper', title: 'UPPER: ', type: 'line' },
      { key: 'middle', title: 'MIDDLE: ', type: 'line' },
      { key: 'lower', title: 'LOWER: ', type: 'line' }
    ],
    calc: (dataList, indicator) => {
      const period = (indicator.calcParams as number[])[0] || 20;
      return dataList.map((_, i) => {
        if (i < period - 1) return {} as any;
        const window = dataList.slice(i - period + 1, i + 1);
        const upper = Math.max(...window.map(d => d.high));
        const lower = Math.min(...window.map(d => d.low));
        return { upper, middle: (upper + lower) / 2, lower } as any;
      });
    }
  });
}

// Pivot Points clássico (Standard) — o slot antigo usava 'PVT' (Price and Volume
// Trend, um indicador completamente diferente) e chamava isso de "Pivot Points" na UI.
if (!isIndicatorRegistered('PIVOT_POINTS')) {
  registerIndicator<number>({
    name: 'PIVOT_POINTS',
    shortName: 'PIVOT',
    series: 'price' as any,
    precision: 2,
    calcParams: [],
    shouldOhlc: false,
    figures: [
      { key: 'r1', title: 'R1: ', type: 'line' },
      { key: 'pp', title: 'PP: ', type: 'line' },
      { key: 's1', title: 'S1: ', type: 'line' }
    ],
    calc: (dataList) => {
      return dataList.map((_, i) => {
        if (i === 0) return {} as any;
        const prev = dataList[i - 1];
        const pp = (prev.high + prev.low + prev.close) / 3;
        const r1 = 2 * pp - prev.low;
        const s1 = 2 * pp - prev.high;
        return { pp, r1, s1 } as any;
      });
    }
  });
}
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
  Maximize,
  Minimize
} from 'lucide-react';


import { DrawingToolbar } from '@/app/components/chart/DrawingToolbar';
import { DrawingContextToolbar } from '@/app/components/chart/DrawingContextToolbar';
import { BacktestReplayBar } from '@/app/components/backtest/BacktestReplayBar';
import { BacktestConfigModal } from '@/app/components/backtest/BacktestConfigModal';
import { StrategyBuilderPro } from '@/app/components/backtest/StrategyBuilderPro';
import { BacktestLiveProgress } from '@/app/components/backtest/BacktestLiveProgress';
import { BacktestResultsModal } from '@/app/components/backtest/BacktestResultsModal';
import { BacktestDecisionsPanel } from '@/app/components/backtest/BacktestDecisionsPanel';
import { BacktestErrorBoundary } from '@/app/components/backtest/BacktestErrorBoundary';
import { useBacktestLiveProgress } from '@/app/hooks/useBacktestLiveProgress';
import { useStrategies } from '@/app/hooks/useStrategies';
import { useChartPreferences } from '@/app/hooks/useChartPreferences';
import { Strategy as StrategyDef } from '@/app/types/strategy';
import { SmartScrollContainer } from '@/app/components/SmartScrollContainer';
import { type MarketAsset } from '@/app/data/market-assets';
import { fetchCandles } from '@/app/services/market-service';
import { getPrecisionForSymbol, padIntegerPart } from '@/app/utils/priceFormatter';
import { getRealMarketData, subscribeToSymbol, getBatchedMT5Data, type RealMarketData } from '@/app/services/RealMarketDataService';
import { debugLog, DEBUG_CONFIG } from '@/app/config/debug'; // 🔥 Sistema de debug otimizado
import { useTradingContext } from '@/app/contexts/TradingContext'; // 🔥 NOVO: Contexto global
import { toast } from 'sonner';
import { backtestDataService, BacktestDataUnavailableError } from '@/app/services/BacktestDataService';
import { analyzeSmc, type SmcZone } from '@/app/services/smc';

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
  totalStep: 4, // 🔧 FIX: totalStep = pontos + 1 na klinecharts (3 pontos A/B/C -> 4, era 3 e travava no 2º clique)
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

// 🎯 CUSTOM OVERLAY: Régua de Medição (2 cliques — mostra Δ preço, Δ %, nº de barras)
// Antes o botão "Medir" da toolbar era decorativo (callback vazio) — este overlay
// torna a ferramenta real, no mesmo padrão dos outros overlays customizados acima.
const MeasureRulerOverlay: OverlayTemplate = {
  name: 'measureRuler',
  totalStep: 3, // 🔧 FIX: totalStep = pontos + 1 (2 pontos -> 3)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const [pa, pb] = overlay.points ?? [];
    const figures: any[] = [];

    const priceDelta = pb?.value != null && pa?.value != null ? pb.value - pa.value : 0;
    const pricePct = pa?.value ? (priceDelta / pa.value) * 100 : 0;
    const bars =
      pb?.dataIndex != null && pa?.dataIndex != null ? Math.abs(pb.dataIndex - pa.dataIndex) : 0;
    const isUp = priceDelta >= 0;
    const color = isUp ? '#22c55e' : '#ef4444';

    // Área medida (retângulo translúcido)
    figures.push({
      type: 'rect',
      attrs: {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y)
      },
      styles: { style: 'fill', color: isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }
    });
    // Diagonal entre os dois pontos
    figures.push({
      type: 'line',
      attrs: { coordinates: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] },
      styles: { style: 'dashed', color, dashValue: [4, 4] }
    });
    // Caixa de resultado, acima/abaixo do 2º ponto conforme a direção
    const decimals = Math.abs(priceDelta) >= 1 ? 2 : 5;
    figures.push({
      type: 'text',
      attrs: {
        x: (a.x + b.x) / 2,
        y: isUp ? Math.min(a.y, b.y) - 10 : Math.max(a.y, b.y) + 10,
        align: 'center',
        baseline: isUp ? 'bottom' : 'top',
        text: `${isUp ? '▲' : '▼'} ${priceDelta.toFixed(decimals)} (${pricePct.toFixed(2)}%) · ${bars} barra${bars === 1 ? '' : 's'}`
      },
      styles: {
        color: '#ffffff',
        size: 12,
        backgroundColor: isUp ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)',
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 4
      }
    });
    return figures;
  }
};

try {
  registerOverlay(MeasureRulerOverlay);
  console.log('[ChartView] ✅ Measure Ruler overlay registrado');
} catch (e) {
  console.warn('[ChartView] ⚠️ Measure Ruler overlay já registrado ou erro:', e);
}

// 🎯 CUSTOM OVERLAY: Marcador de Emoji (1 clique — o emoji escolhido no picker fica
// ancorado no candle/preço clicado). O EmojiPicker já existia pronto no código
// (DrawingToolDropdown.tsx) mas nunca era renderizado — este overlay fecha o circuito.
const EmojiMarkerOverlay: OverlayTemplate = {
  name: 'emojiMarker',
  totalStep: 1,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length === 0) return [];
    const point = coordinates[0];
    return {
      type: 'text',
      attrs: {
        x: point.x,
        y: point.y,
        align: 'center',
        baseline: 'middle',
        text: typeof overlay.extendData === 'string' && overlay.extendData ? overlay.extendData : '📍'
      },
      styles: { size: 24, backgroundColor: 'transparent' }
    };
  }
};

try {
  registerOverlay(EmojiMarkerOverlay);
  console.log('[ChartView] ✅ Emoji Marker overlay registrado');
} catch (e) {
  console.warn('[ChartView] ⚠️ Emoji Marker overlay já registrado ou erro:', e);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 OVERLAYS CUSTOMIZADOS DE DESENHO — a klinecharts 9.8 só traz 15 overlays
// nativos (linhas/canais paralelos/fib retracement/anotações). O mapa antigo
// referenciava overlays que NÃO EXISTEM na lib ('rect', 'circle', 'triangle',
// 'fibonacciCircle', 'fibonacciSpiral', 'fibonacciSpeedResistanceFan') — toda
// forma geométrica, garfo, círculo/leque de Fibonacci caía no erro "Overlay não
// suportado". Os templates abaixo implementam essas ferramentas DE VERDADE.
// ─────────────────────────────────────────────────────────────────────────────

// Estende uma reta (definida por 2 pontos) até a borda direita do painel
const extendLineRight = (
  from: { x: number; y: number },
  through: { x: number; y: number },
  boundingWidth: number
): { x: number; y: number } => {
  const dx = through.x - from.x;
  if (dx === 0) return { x: through.x, y: through.y };
  const slope = (through.y - from.y) / dx;
  return { x: boundingWidth, y: through.y + slope * (boundingWidth - through.x) };
};

// 🍴 Andrews Pitchfork REAL (3 cliques: pivô A, depois B e C — mediana de A pelo
// ponto médio de BC + duas hastes paralelas passando por B e C)
const PitchforkOverlay: OverlayTemplate = {
  name: 'pitchforkLine',
  totalStep: 4, // 🔧 FIX: totalStep = pontos + 1 (3 pontos -> 4)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, bounding, overlay }: any) => {
    const color = overlay.styles?.line?.color || '#a855f7';
    if (coordinates.length < 2) return [];
    const [a, b, c] = coordinates;
    if (coordinates.length === 2) {
      return [{ type: 'line', attrs: { coordinates: [a, b] }, styles: { style: 'dashed', color, dashedValue: [4, 4] } }];
    }
    const mid = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const dx = mid.x - a.x;
    const dy = mid.y - a.y;
    // ponto final da mediana estendida até a borda direita
    const medianEnd = dx !== 0 ? extendLineRight(a, mid, bounding.width) : mid;
    // hastes paralelas à mediana, partindo de B e de C
    const tineEnd = (p: { x: number; y: number }) => {
      if (dx === 0) return p;
      const t = (bounding.width - p.x) / dx;
      return { x: bounding.width, y: p.y + dy * t };
    };
    return [
      { type: 'line', attrs: { coordinates: [b, c] }, styles: { style: 'dashed', color, dashedValue: [3, 3] } },
      { type: 'line', attrs: { coordinates: [a, medianEnd] }, styles: { style: 'solid', color } },
      { type: 'line', attrs: { coordinates: [b, tineEnd(b)] }, styles: { style: 'solid', color } },
      { type: 'line', attrs: { coordinates: [c, tineEnd(c)] }, styles: { style: 'solid', color } }
    ];
  }
};

// ▭ Retângulo real (2 cliques)
const RectShapeOverlay: OverlayTemplate = {
  name: 'rectShape',
  totalStep: 3, // 🔧 FIX: totalStep = pontos + 1 (2 pontos -> 3)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const color = overlay.styles?.rect?.color || 'rgba(59,130,246,0.15)';
    const borderColor = overlay.styles?.rect?.borderColor || '#3b82f6';
    return {
      type: 'rect',
      attrs: {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y)
      },
      styles: { style: 'stroke_fill', color, borderColor, borderSize: 1 }
    };
  }
};

// ◯ Círculo/Elipse real (2 cliques: centro + raio)
const CircleShapeOverlay: OverlayTemplate = {
  name: 'circleShape',
  totalStep: 3, // 🔧 FIX: totalStep = pontos + 1 (2 pontos -> 3)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const r = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    return {
      type: 'circle',
      attrs: { x: a.x, y: a.y, r },
      styles: {
        style: 'stroke_fill',
        color: overlay.styles?.circle?.color || 'rgba(59,130,246,0.12)',
        borderColor: overlay.styles?.circle?.borderColor || '#3b82f6',
        borderSize: 1
      }
    };
  }
};

// △ Triângulo real (3 cliques)
const TriangleShapeOverlay: OverlayTemplate = {
  name: 'triangleShape',
  totalStep: 4, // 🔧 FIX: totalStep = pontos + 1 (3 pontos -> 4)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length < 2) return [];
    if (coordinates.length === 2) {
      return [{ type: 'line', attrs: { coordinates }, styles: { style: 'dashed', color: '#3b82f6', dashedValue: [4, 4] } }];
    }
    return {
      type: 'polygon',
      attrs: { coordinates },
      styles: {
        style: 'stroke_fill',
        color: overlay.styles?.polygon?.color || 'rgba(59,130,246,0.12)',
        borderColor: overlay.styles?.polygon?.borderColor || '#3b82f6',
        borderSize: 1
      }
    };
  }
};

// 🌀 Círculos de Fibonacci reais (2 cliques — círculos concêntricos nos raios fib)
const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#f23645', '#ff9800', '#fbbf24', '#26a69a', '#3b82f6', '#a855f7'];
const FibCirclesOverlay: OverlayTemplate = {
  name: 'fibCircles',
  totalStep: 3, // 🔧 FIX: totalStep = pontos + 1 (2 pontos -> 3)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const baseR = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    return FIB_RATIOS.map((ratio, i) => ({
      type: 'circle',
      attrs: { x: a.x, y: a.y, r: baseR * ratio },
      styles: { style: 'stroke', borderColor: FIB_COLORS[i], borderSize: 1 }
    }));
  }
};

// 📐 Leque de Fibonacci real (2 cliques — raios saindo do 1º ponto pelas frações
// fib da distância vertical até o 2º ponto, estendidos até a borda direita)
const FibFanOverlay: OverlayTemplate = {
  name: 'fibFan',
  totalStep: 3, // 🔧 FIX: totalStep = pontos + 1 (2 pontos -> 3)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, bounding }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const figures: any[] = [];
    [0.382, 0.5, 0.618, 1].forEach((ratio, i) => {
      const target = { x: b.x, y: a.y + (b.y - a.y) * ratio };
      const end = extendLineRight(a, target, bounding.width);
      figures.push({
        type: 'line',
        attrs: { coordinates: [a, end] },
        styles: { style: ratio === 1 ? 'solid' : 'dashed', color: FIB_COLORS[i + 1], dashedValue: [4, 4] }
      });
      figures.push({
        type: 'text',
        attrs: { x: end.x - 4, y: end.y, align: 'right', baseline: 'bottom', text: `${(ratio * 100).toFixed(1)}%` },
        styles: { color: FIB_COLORS[i + 1], size: 10, backgroundColor: 'transparent' }
      });
    });
    return figures;
  }
};

// 🌈 Arcos de Fibonacci reais (2 cliques — semicírculos nos raios fib, abertos
// pro lado do 1º ponto, como no TradingView)
const FibArcsOverlay: OverlayTemplate = {
  name: 'fibArcs',
  totalStep: 3, // 🔧 FIX: totalStep = pontos + 1 (2 pontos -> 3)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const baseR = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    // arco abre pro lado de onde veio o movimento (acima se b está abaixo de a, e vice-versa)
    const opensUp = b.y >= a.y;
    return [0.382, 0.5, 0.618, 1].map((ratio, i) => ({
      type: 'arc',
      attrs: {
        x: b.x,
        y: b.y,
        r: baseR * ratio,
        startAngle: opensUp ? Math.PI : 0,
        endAngle: opensUp ? Math.PI * 2 : Math.PI
      },
      // 🔧 o overlay nativo 'arc' usa style/color/size (LineType), não borderColor/borderSize
      styles: { style: 'solid', color: FIB_COLORS[i + 1], size: 1 }
    }));
  }
};

// ⫽ Canal não-paralelo real (4 cliques — duas retas independentes estendidas à direita)
const NonParallelChannelOverlay: OverlayTemplate = {
  name: 'nonParallelChannel',
  totalStep: 5, // 🔧 FIX: totalStep = pontos + 1 (4 pontos -> 5)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, bounding, overlay }: any) => {
    const color = overlay.styles?.line?.color || '#3b82f6';
    const figures: any[] = [];
    if (coordinates.length >= 2) {
      const [a, b] = coordinates;
      figures.push({
        type: 'line',
        attrs: { coordinates: [a, extendLineRight(a, b, bounding.width)] },
        styles: { style: 'solid', color }
      });
    }
    if (coordinates.length >= 4) {
      const [, , c, d] = coordinates;
      figures.push({
        type: 'line',
        attrs: { coordinates: [c, extendLineRight(c, d, bounding.width)] },
        styles: { style: 'solid', color }
      });
    } else if (coordinates.length === 3) {
      figures.push({
        type: 'circle',
        attrs: { x: coordinates[2].x, y: coordinates[2].y, r: 3 },
        styles: { style: 'fill', color }
      });
    }
    return figures;
  }
};

// ℹ️ Linha com Informações real: desenha a reta normal e, depois de desenhada,
// um clique nela abre um input (wiring em ChartView, ver handleOverlayClick/
// infoLineEditor) pra digitar texto livre — que fica anexado à linha (guardado em
// overlay.extendData). Antes mapeava pra 'segment': só traçava a linha, sem
// nenhum jeito de anexar informação nela depois — exatamente o bug reportado.
const InfoLineOverlay: OverlayTemplate = {
  name: 'infoLine',
  totalStep: 3, // 🔧 FIX real do bug reportado: totalStep = pontos + 1 na klinecharts (2 pontos -> 3), não so o numero de pontos -- por isso travava depois do 1o clique e nunca chegava ao 2o
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const color = overlay.styles?.line?.color || '#3b82f6';
    const figures: any[] = [
      { type: 'line', attrs: { coordinates: [a, b] }, styles: { style: 'solid', color, size: 2 } }
    ];

    const infoText = typeof overlay.extendData === 'string' ? overlay.extendData : '';
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;

    if (infoText) {
      figures.push({
        type: 'text',
        attrs: { x: midX, y: midY - 12, align: 'center', baseline: 'bottom', text: infoText },
        styles: {
          color: '#ffffff',
          size: 12,
          backgroundColor: 'rgba(59,130,246,0.9)',
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: 4
        }
      });
    } else {
      // Dica sutil de que dá pra clicar na linha e escrever algo — some assim que houver texto
      figures.push({
        type: 'text',
        attrs: { x: midX, y: midY - 10, align: 'center', baseline: 'bottom', text: 'clique para escrever' },
        styles: { color: 'rgba(148,163,184,0.7)', size: 10, backgroundColor: 'transparent' }
      });
    }

    return figures;
  }
};

// 📐 Ângulo de Tendência real (2 cliques — mesma reta, com o ângulo grudado nela).
// Antes também caía em 'segment', sem mostrar ângulo nenhum.
const TrendAngleOverlay: OverlayTemplate = {
  name: 'trendAngleLine',
  totalStep: 3, // 🔧 FIX: totalStep = pontos + 1 (2 pontos -> 3)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const color = overlay.styles?.line?.color || '#f59e0b';
    const angleDeg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
    return [
      { type: 'line', attrs: { coordinates: [a, b] }, styles: { style: 'solid', color, size: 2 } },
      {
        type: 'text',
        attrs: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 10, align: 'center', baseline: 'bottom', text: `${angleDeg.toFixed(1)}°` },
        styles: { color: '#000000', size: 11, backgroundColor: 'rgba(245,158,11,0.9)', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }
      }
    ];
  }
};

const CUSTOM_DRAWING_OVERLAYS: OverlayTemplate[] = [
  InfoLineOverlay,
  TrendAngleOverlay,
  PitchforkOverlay,
  RectShapeOverlay,
  CircleShapeOverlay,
  TriangleShapeOverlay,
  FibCirclesOverlay,
  FibFanOverlay,
  FibArcsOverlay,
  NonParallelChannelOverlay
];
CUSTOM_DRAWING_OVERLAYS.forEach((tpl) => {
  try {
    registerOverlay(tpl);
  } catch (e) {
    console.warn(`[ChartView] ⚠️ Overlay ${tpl.name} já registrado ou erro:`, e);
  }
});
console.log('[ChartView] ✅ Overlays customizados de desenho registrados:', CUSTOM_DRAWING_OVERLAYS.map((t) => t.name).join(', '));

// Nomes de todos os overlays customizados (pra checagem de suporte no handler)
const CUSTOM_OVERLAY_NAMES = new Set([
  'pointMarker',
  'fibonacciExtension',
  'measureRuler',
  'emojiMarker',
  ...CUSTOM_DRAWING_OVERLAYS.map((t) => t.name)
]);

// 🆕 Grupo de overlays criados PELO USUÁRIO via toolbar de desenho — separa os desenhos
// do usuário dos overlays de sistema (linhas de S/R, sinais), permitindo travar/ocultar/
// apagar só os desenhos sem afetar o resto do gráfico.
const USER_DRAWINGS_GROUP = 'user_drawings';

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
    // ✅ 'MA' foi re-registrado do zero (ver registerMovingAverageIndicator no topo do
    // arquivo) como motor completo no padrão MT5: Período, Deslocar, Método (Simples/
    // Exponencial/Suavizada/Ponderada Linear) e Aplicar a (Fechamento/Abertura/Máxima/
    // Mínima/Mediana/Típico/Ponderado) -- editável no popover do chip ou no menu de
    // botão direito. Sempre 1 linha por instância (não sofre do bug de "várias de
    // uma vez"); usuário pode inserir a mesma média mais de uma vez com métodos/
    // períodos diferentes, igual no MT5.
    defaultParams: [20],
    isPaneIndicator: false
  },
  {
    id: 'ema',
    name: 'EMA - Média Móvel Exponencial',
    description: 'Exponential Moving Average',
    category: 'trend',
    klinechartsName: 'EMA',
    defaultParams: [20],
    isPaneIndicator: false
  },
  {
    id: 'sma',
    name: 'SMA - Média Móvel Simples',
    description: 'Simple Moving Average',
    category: 'trend',
    klinechartsName: 'SMA',
    defaultParams: [20],
    isPaneIndicator: false
  },
  {
    id: 'wma',
    name: 'WMA - Média Móvel Ponderada',
    description: 'Weighted Moving Average',
    category: 'trend',
    klinechartsName: 'WMA',
    defaultParams: [20],
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
    description: 'Pontos de Pivô (clássico, período anterior)',
    category: 'support_resistance',
    klinechartsName: 'PIVOT_POINTS',
    defaultParams: [],
    isPaneIndicator: false
  },
];
// Nota: "Fibonacci Retracement" foi removido desta lista — não é um indicador
// calculado sobre candle (não existe como built-in do klinecharts e não faz sentido
// registrar via calc()), é uma ferramenta de DESENHO com 2 pontos definidos pelo
// usuário. Já existe como overlay na toolbar de desenho do gráfico (Fibonacci).

// ✅ FUNÇÃO DE FORMATAÇÃO INTERNACIONAL (estilo TradingView/Binance)
function formatBrazilianPrice(price: number, decimals: number = 2): string {
  // Formatar com ponto decimal, SEM separador de milhares (padrão trading profissional)
  // ✅ 2026-07-16: 4 dígitos antes do ponto pra todo ativo (regra central,
  // ver priceFormatter.ts) — "pra parecerem vivos".
  return padIntegerPart(price.toFixed(decimals));
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
  const chartUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Debounce de updateData
  const [dataSource, setDataSource] = useState<'metaapi' | 'generated' | 'loading'>('loading');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showIndicators, setShowIndicators] = useState(false);
  // 🆕 Maximizar a tela do Gráfico — usa a Fullscreen API real do navegador (o gráfico
  // cobre o monitor inteiro, por cima do próprio browser, igual TradingView/YouTube),
  // com fallback pro modo "cobre só o app" (fixed inset-0) se o navegador negar/não
  // suportar (ex: dentro de um iframe sem allow="fullscreen").
  const chartRootRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  useEffect(() => {
    const handleFullscreenChange = () => setIsMaximized(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const toggleMaximize = async () => {
    try {
      if (!document.fullscreenElement) {
        await chartRootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (err) {
      // Navegador negou/não suporta (ex: iframe sem allow="fullscreen") — cai pro
      // modo CSS (cobre só o app, não o browser inteiro).
      console.warn('[ChartView] Fullscreen API indisponível, usando modo CSS:', err);
      setIsMaximized((prev) => !prev);
    }
  };
  const [showBacktestReplay, setShowBacktestReplay] = useState(false); // 🆕 Controle do Backtest/Replay
  const [showBacktestConfig, setShowBacktestConfig] = useState(false); // 🆕 Modal de configuração do Backtest
  const [showStrategyBuilder, setShowStrategyBuilder] = useState(false); // 🆕 Construtor de estratégias
  const [isReplayMode, setIsReplayMode] = useState(false); // 🆕 Flag para modo replay (efeito visual)
  
  // 🎯 BACKTEST LIVE PROGRESS (motor real: estratégia + candles históricos reais)
  const backtestProgress = useBacktestLiveProgress(10000);
  const { strategies, saveStrategy, deleteStrategy, error: strategiesError } = useStrategies();
  const { showSrOverlay, showSrOverlayRef, setShowSrOverlay } = useChartPreferences(selectedSymbol);
  const [showDecisionsPanel, setShowDecisionsPanel] = useState(false);
  const [lastBacktestRun, setLastBacktestRun] = useState<{ strategy: StrategyDef; timeframe: string; symbol: string } | null>(null);
  const [timeframeExpanded, setTimeframeExpanded] = useState(false);
  const [priceLinePosition, setPriceLinePosition] = useState<number | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set()); // 🆕 Indicadores ativos
  // 🆕 paneId real usado por cada indicador criado — removeIndicator(paneId, name) exige
  // o paneId exato de onde o indicador foi criado ('candle_pane' pra overlay, 'pane_<id>'
  // pra painel próprio); sem isso, removeIndicator(indicator.id) nunca casava com nada e
  // o "Remover" nunca tirava o desenho de verdade da tela (só mudava o estado da UI).
  const indicatorPaneIdRef = useRef<Record<string, string>>({});
  const [indicatorSearchTerm, setIndicatorSearchTerm] = useState(''); // 🆕 Busca de indicadores
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // 🆕 Filtro por categoria
  
  // 🧹 CLEANUP: Previne erro do Figma iframe ao desmontar
  useEffect(() => {
    return () => {
      setShowDecisionsPanel(false);
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

  // 🆕 Editor de texto da "Linha com Informações" — clique na linha abre este input
  const [infoLineEditor, setInfoLineEditor] = useState<{ overlayId: string; x: number; y: number } | null>(null);
  const [infoLineText, setInfoLineText] = useState('');
  const infoLineCancelledRef = useRef(false); // 🛡️ evita o onBlur salvar de novo depois do Esc já ter cancelado
  const infoLineInputRef = useRef<HTMLInputElement>(null);
  const infoLineTextRef = useRef(''); // espelha infoLineText p/ o listener de clique-fora ler o valor mais recente

  // 🔧 FIX: "só entra dando Enter" — clicar no canvas do gráfico (klinecharts previne o
  // comportamento padrão do mousedown pra permitir arrastar/desenhar), então o navegador
  // NUNCA dispara blur no input (blur-ao-clicar-fora depende desse padrão, que a lib
  // bloqueia). onBlur sozinho não é suficiente. Fix real: ouvir mousedown/pointerdown no
  // documento inteiro, na fase de CAPTURA (antes do canvas processar o evento e travar o
  // foco) — qualquer clique fora do input (canvas, sidebar, qualquer lugar da página)
  // salva e fecha o editor, sem depender do navegador mover o foco de verdade.
  useEffect(() => {
    if (!infoLineEditor) return;
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (infoLineInputRef.current && !infoLineInputRef.current.contains(event.target as Node)) {
        try {
          chartInstanceRef.current?.overrideOverlay({
            id: infoLineEditor.overlayId,
            extendData: infoLineTextRef.current
          });
        } catch (err) {
          console.error('[ChartView] ❌ Error saving info-line text (click outside):', err);
        }
        infoLineCancelledRef.current = true; // evita o onBlur, se disparar depois, salvar de novo
        setInfoLineEditor(null);
        setInfoLineText('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside, true);
  }, [infoLineEditor]);
  const [chartTexts, setChartTexts] = useState<Array<{ id: string; text: string; x: number; y: number }>>([]); // Textos no gráfico
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartIdRef = useRef<string>('chart-' + Math.random().toString(36).substring(7));
  const chartInstanceRef = useRef<any>(null);
  const assetListRef = useRef<HTMLDivElement>(null); // 🆕 Ref para o asset list
  const isInitialLoadRef = useRef<boolean>(true); // 🆕 Rastrear se é primeira carga (para evitar auto-scroll infinito)
  const srOverlayIdsRef = useRef<string[]>([]); // 🆕 Ids dos overlays de Suporte/Resistência ativos no gráfico
  // 🆕 Cache da estrutura de longo prazo (SMC, 1D/~5 anos) por símbolo — mesma ideia do
  // Detector de Liquidez do Dashboard: sem isso, S/R só enxerga a janela curta do gráfico
  // e nunca acha zona real acima/abaixo quando o preço está longe de qualquer extremo recente.
  const macroSrZonesRef = useRef<Map<string, { zones: SmcZone[]; fetchedAt: number }>>(new Map());

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
    // ✅ 2026-07-16: BTCEUR não existia no catálogo — confirmado real via
    // /mt5-prices (~€55.918).
    { symbol: 'BTCEUR', name: 'Bitcoin (EUR)', bid: 55918.91, ask: 55964.87, change: 0, changePercent: 0, category: 'Crypto' },
    // ✅ 2026-07-16: BTCBNB não existia no catálogo — real com o nome
    // 'BTCXBN' na Infinox (override em brokerRegistry.ts), ~288,65.
    { symbol: 'BTCBNB', name: 'Bitcoin (BNB)', bid: 288.65, ask: 289.24, change: 24.65, changePercent: 9.34, category: 'Crypto' },
    // ✅ 2026-07-16: mesmo padrão — BTCETH (real 'BTCXET') e BTCLTC (real
    // 'BTCXLC') não existiam no catálogo.
    { symbol: 'BTCETH', name: 'Bitcoin (ETH)', bid: 34.15, ask: 34.21, change: -1.02, changePercent: -2.91, category: 'Crypto' },
    { symbol: 'BTCLTC', name: 'Bitcoin (LTC)', bid: 1437.77, ask: 1439.81, change: -2.28, changePercent: -0.16, category: 'Crypto' },
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
    // ✅ 2026-07-16: genuinamente novos, não existiam em nenhum dos 2
    // catálogos — confirmados reais via /mt5-prices (ver assetDatabase.ts).
    { symbol: 'ZECUSD', name: 'Zcash', bid: 540.37, ask: 541.19, change: -35.26, changePercent: -6.13, category: 'Crypto' },
    { symbol: 'XTZUSD', name: 'Tezos', bid: 0.2202, ask: 0.2256, change: 0.0016, changePercent: 0.73, category: 'Crypto' },
    { symbol: 'CRVUSD', name: 'Curve DAO Token', bid: 0.214, ask: 0.223, change: 0.002, changePercent: 0.94, category: 'Crypto' },
    { symbol: 'NEOUSD', name: 'NEO', bid: 1.89, ask: 2.03, change: -0.02, changePercent: -1.05, category: 'Crypto' },
    { symbol: 'SUSHIUSD', name: 'SushiSwap', bid: 0.162, ask: 0.170, change: 0, changePercent: 0, category: 'Crypto' },
    { symbol: 'IOTAUSD', name: 'IOTA', bid: 0.0338, ask: 0.0386, change: 0, changePercent: 0, category: 'Crypto' },
    { symbol: 'ONEUSD', name: 'Harmony', bid: 0.00102, ask: 0.00121, change: -0.00003, changePercent: -2.86, category: 'Crypto' },
    { symbol: 'INCUSD', name: 'INC', bid: 0.0713, ask: 0.0751, change: 0.0018, changePercent: 2.59, category: 'Crypto' },
    // ✅ 2026-07-16: variantes "liquidação cripto" (sufixo .crp na Infinox,
    // ver override em brokerRegistry.ts) — confirmadas reais antes de
    // adicionar, mesmo lote do assetDatabase.ts.
    { symbol: 'BTCUSDCRP', name: 'Bitcoin (liquidação cripto)', bid: 64568, ask: 64579, change: 2394, changePercent: 3.85, category: 'Crypto' },
    { symbol: 'XETUSDCRP', name: 'Ethereum (liquidação cripto)', bid: 1913.7, ask: 1916.29, change: 0, changePercent: 0, category: 'Crypto' },
    // ✅ 2026-07-16: mesmo padrão — só o XETUSDCRP existia aqui, 'XETUSD'
    // normal confirmado real via /mt5-prices (~1871).
    { symbol: 'XETUSD', name: 'Ethereum (XET)', bid: 1871.7, ask: 1874.29, change: -49.66, changePercent: -2.58, category: 'Crypto' },
    // ✅ 2026-07-16: só o XBNUSDCRP existia aqui — 'XBNUSD' normal confirmado
    // real via /mt5-prices, contrato distinto do BNBUSD (~576 vs ~219).
    { symbol: 'XBNUSD', name: 'Binance Coin (XBN)', bid: 219.63, ask: 222.22, change: -7.29, changePercent: -3.21, category: 'Crypto' },
    { symbol: 'XBNUSDCRP', name: 'Binance Coin (liquidação cripto)', bid: 219.05, ask: 221.66, change: -14.88, changePercent: -6.36, category: 'Crypto' },
    // ✅ 2026-07-16: mesmo padrão — só o XLCUSDCRP existia, 'XLCUSD' normal
    // confirmado real via /mt5-prices (~43,92).
    { symbol: 'XLCUSD', name: 'Litecoin (XLC)', bid: 43.92, ask: 45.07, change: 1.25, changePercent: 2.93, category: 'Crypto' },
    { symbol: 'XLCUSDCRP', name: 'Litecoin (liquidação cripto)', bid: 44.47, ask: 45.62, change: 0, changePercent: 0, category: 'Crypto' },
    // ✅ 2026-07-16: XETEUR não existia aqui — mesmo padrão do BTCEUR (XET
    // cotado em Euro em vez de USD), confirmado real via /mt5-prices
    // (~€1.630,48).
    { symbol: 'XETEUR', name: 'Ethereum (XET/EUR)', bid: 1630.48, ask: 1635.79, change: 81.46, changePercent: 5.26, category: 'Crypto' },
    // ✅ 2026-07-16: XETXBN/XETXLC não existiam aqui — mesmo padrão do
    // XETEUR (Ethereum/XET cotado em outra cripto da Infinox), confirmados
    // reais via /mt5-prices.
    { symbol: 'XETXBN', name: 'Ethereum (XET/XBN)', bid: 8.3592, ask: 8.3943, change: 0, changePercent: 0, category: 'Crypto' },
    { symbol: 'XETXLC', name: 'Ethereum (XET/XLC)', bid: 41.4321, ask: 41.5547, change: 0, changePercent: 0, category: 'Crypto' },

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
    // ✅ 2026-07-16: confirmados reais na Infinox antes de adicionar, mesmo
    // lote do assetDatabase.ts.
    { symbol: 'USDBRL', name: 'US Dollar / Brazilian Real', bid: 5.42, ask: 5.43, change: 0, changePercent: 0, category: 'Forex' },
    { symbol: 'USDNGN', name: 'US Dollar / Nigerian Naira', bid: 755.74, ask: 757.74, change: 0, changePercent: 0, category: 'Forex' },
    { symbol: 'USDCHFEXC', name: 'US Dollar / Swiss Franc (horário estendido)', bid: 0.8048, ask: 0.80487, change: 0, changePercent: 0, category: 'Forex' },

    // COMMODITIES (10 ativos)
    { symbol: 'XAUUSD', name: 'Gold', bid: 2678, ask: 2679, change: 12, changePercent: 0.45, category: 'Commodities' },
    { symbol: 'XAUUSDCRP', name: 'Gold (liquidação cripto)', bid: 4046.65, ask: 4046.85, change: 0, changePercent: 0, category: 'Commodities' },
    // ✅ 2026-07-16: contrato distinto do XAUUSD, confirmado real (preço bem
    // diferente, ~130 vs ~4000).
    { symbol: 'GAUUSD', name: 'Gold (contrato alternativo)', bid: 129.94, ask: 130.15, change: 1.48, changePercent: 1.15, category: 'Commodities' },
    // ✅ 2026-07-16: pares de ouro em outras moedas, confirmados reais antes
    // de adicionar.
    { symbol: 'XAUAUD', name: 'Gold / Australian Dollar', bid: 5780.17, ask: 5780.78, change: -13.41, changePercent: -0.23, category: 'Commodities' },
    { symbol: 'XAUGBP', name: 'Gold / British Pound', bid: 2988.16, ask: 2988.76, change: 0, changePercent: 0, category: 'Commodities' },
    { symbol: 'XAUJPY', name: 'Gold / Japanese Yen', bid: 655106, ask: 655165, change: 0, changePercent: 0, category: 'Commodities' },
    { symbol: 'XAUCHF', name: 'Gold / Swiss Franc', bid: 3257.11, ask: 3257.69, change: 0, changePercent: 0, category: 'Commodities' },
    { symbol: 'XAGUSD', name: 'Silver', bid: 31.45, ask: 31.46, change: -0.34, changePercent: -1.07, category: 'Commodities' },
    { symbol: 'XPTUSD', name: 'Platinum', bid: 945.20, ask: 945.40, change: 8.5, changePercent: 0.91, category: 'Commodities' },
    { symbol: 'XPDUSD', name: 'Palladium', bid: 1034.50, ask: 1034.70, change: -12.3, changePercent: -1.18, category: 'Commodities' },
    // ✅ 2026-07-13: nomes corrigidos pros reais da Infinox (brokerRegistry.ts/
    // assetDatabase.ts) — a maioria aqui eram símbolos inventados (WTIUSD,
    // BRENTUSD, NGAS, CORN, COCOA...) que nunca existiram na corretora, então
    // nunca recebiam preço real e ficavam parados no valor fake do seed pra
    // sempre. Removidos os que não têm contrato equivalente confirmado na
    // Infinox (Copper, Corn, Soybean, Cocoa, Cotton, Lumber, Heating Oil,
    // RBOB, Lean Hogs, Live Cattle, Feeder Cattle, Orange Juice, Rice).
    { symbol: 'USOUSD', name: 'WTI Crude Oil', bid: 68.45, ask: 68.47, change: -0.89, changePercent: -1.28, category: 'Commodities' },
    { symbol: 'UKOUSD', name: 'Brent Crude Oil', bid: 72.34, ask: 72.36, change: -1.12, changePercent: -1.52, category: 'Commodities' },
    { symbol: 'XNGUSD', name: 'Natural Gas', bid: 3.234, ask: 3.236, change: 0.089, changePercent: 2.83, category: 'Commodities' },
    { symbol: 'WHEUSD', name: 'Wheat', bid: 578.75, ask: 579.00, change: -5.50, changePercent: -0.94, category: 'Commodities' },
    { symbol: 'SUGUSD', name: 'Sugar', bid: 19.45, ask: 19.47, change: -0.23, changePercent: -1.17, category: 'Commodities' },
    { symbol: 'COFUSD', name: 'Coffee', bid: 234.50, ask: 234.60, change: 4.30, changePercent: 1.87, category: 'Commodities' },

    // ÍNDICES (40 ativos)
    { symbol: 'US30', name: 'Dow Jones', bid: 43875, ask: 43877, change: 53, changePercent: 0.12, category: 'Índices' },
    { symbol: 'NAS100', name: 'NASDAQ 100', bid: 21345, ask: 21347, change: 75, changePercent: 0.35, category: 'Índices' },
    { symbol: 'SPX500', name: 'S&P 500', bid: 5932, ask: 5933, change: 11, changePercent: 0.18, category: 'Índices' },
    { symbol: 'US2000', name: 'Russell 2000', bid: 2234.50, ask: 2234.70, change: -8.30, changePercent: -0.37, category: 'Índices' },
    { symbol: 'VIX', name: 'Volatility Index', bid: 16.45, ask: 16.47, change: -1.23, changePercent: -6.96, category: 'Índices' },
    // ✅ 2026-07-16: era 'DXY', testado agora contra a corretora e dá HTTP
    // 404 (nunca existiu de verdade nesta conta) — nome real é 'USDX',
    // confirmado real via /mt5-prices.
    { symbol: 'USDX', name: 'US Dollar Index', bid: 100.314, ask: 100.414, change: 0.02, changePercent: 0.02, category: 'Índices' },
    { symbol: 'GER40', name: 'DAX 40', bid: 19234.50, ask: 19235.00, change: 45.20, changePercent: 0.24, category: 'Índices' },
    { symbol: 'UK100', name: 'FTSE 100', bid: 8456.30, ask: 8456.80, change: -12.40, changePercent: -0.15, category: 'Índices' },
    { symbol: 'FRA40', name: 'CAC 40', bid: 7823.40, ask: 7823.90, change: 23.10, changePercent: 0.30, category: 'Índices' },
    { symbol: 'EU50', name: 'Euro Stoxx 50', bid: 4945.60, ask: 4946.10, change: 18.50, changePercent: 0.38, category: 'Índices' },
    // ✅ 2026-07-16: era 'SPA35', inconsistente com o nome real da corretora
    // ('ESP35', ver SymbolMappingService.ts) usado em assetDatabase.ts — a
    // divergência impedia o pipeline de preço real de resolver o símbolo,
    // então o Dashboard ficava travado no valor estático abaixo (variação
    // nunca atualizava). Mesmo padrão do fix JP225/JPN225 desta sessão.
    { symbol: 'ESP35', name: 'IBEX 35', bid: 11678.20, ask: 11678.70, change: -34.50, changePercent: -0.29, category: 'Índices' },
    { symbol: 'ITA40', name: 'FTSE MIB', bid: 34567.80, ask: 34568.30, change: 78.20, changePercent: 0.23, category: 'Índices' },
    { symbol: 'NED25', name: 'AEX 25', bid: 923.45, ask: 923.50, change: -2.15, changePercent: -0.23, category: 'Índices' },
    { symbol: 'SUI20', name: 'SMI 20', bid: 12123.40, ask: 12123.90, change: 34.20, changePercent: 0.28, category: 'Índices' },
    // ✅ 2026-07-16: era 'JPN225' (nome real da corretora), inconsistente com
    // o nome unificado 'JP225' usado no resto do projeto (assetDatabase.ts,
    // brokerRegistry.ts já tem o override JP225->JPN225) — causava confusão
    // de busca (Cleber procurou "JPN225" no Navegador de Ativos, que lê do
    // assetDatabase.ts, e não achou porque lá é 'JP225').
    { symbol: 'JP225', name: 'Nikkei 225', bid: 38234.50, ask: 38235.00, change: 156.30, changePercent: 0.41, category: 'Índices' },
    { symbol: 'HK50', name: 'Hang Seng', bid: 19456.70, ask: 19457.20, change: -89.40, changePercent: -0.46, category: 'Índices' },
    { symbol: 'CHINA50', name: 'FTSE China A50', bid: 13234.20, ask: 13234.70, change: 45.80, changePercent: 0.35, category: 'Índices' },
    { symbol: 'AUS200', name: 'ASX 200', bid: 8123.40, ask: 8123.90, change: -23.50, changePercent: -0.29, category: 'Índices' },
    { symbol: 'INDIA50', name: 'Nifty 50', bid: 22345.60, ask: 22346.10, change: 78.90, changePercent: 0.35, category: 'Índices' },
    { symbol: 'SING', name: 'STI Singapore', bid: 3456.70, ask: 3456.80, change: -12.30, changePercent: -0.35, category: 'Índices' },
    { symbol: 'KOREA200', name: 'KOSPI 200', bid: 367.45, ask: 367.50, change: 2.15, changePercent: 0.59, category: 'Índices' },
    { symbol: 'TAIWAN', name: 'Taiwan Weighted', bid: 21234.50, ask: 21235.00, change: 89.20, changePercent: 0.42, category: 'Índices' },
    // ✅ 2026-07-16: era 'BRA', testado agora contra a corretora e dá HTTP 404
    // (nunca existiu de verdade) — nome real é 'BVSPX', confirmado via
    // /mt5-prices. Cleber reportou "BVSPX não existe no catálogo".
    { symbol: 'BVSPX', name: 'Ibovespa', bid: 175918.71, ask: 175923.87, change: 0, changePercent: 0, category: 'Índices' },
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

    // ============================================================================
    // ✅ 2026-07-20: PADRONIZAÇÃO com o catálogo do Dashboard (InfinoxAssetsBrowser)
    // ============================================================================
    // 262 ativos que existiam no Navegador de Ativos do Dashboard (derivado de
    // assetDatabase.ts + brokerRegistry.ts, auditado contra a API real) mas
    // faltavam aqui no seletor do Gráfico — a maioria ações europeias/UK (nunca
    // tinham categoria própria neste arquivo), mais alguns cruzamentos de forex
    // exóticos, cripto e commodities. Gerado por script comparando os dois
    // catálogos símbolo a símbolo (getInfinoxAssetsByCategory() vs este array).
    // Nome e categoria vieram do assetDatabase.ts; preço/variação começam em 0
    // e são preenchidos pelo updateLivePrices() já existente (getBatchedMT5Data),
    // mesmo padrão de todo ativo novo já adicionado neste arquivo.
  { symbol: '1COV.DE', name: 'Covestro AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AAL.L', name: 'Anglo American PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'AALB.AS', name: 'Aalberts NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ABDN.L', name: 'abrdn PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'ABF.L', name: 'Associated British Foods PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'ABN.AS', name: 'ABN AMRO Bank NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AC.PA', name: 'Accor SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ACA.PA', name: 'Credit Agricole SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ADPR.PA', name: 'ADPR', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ADS.DE', name: 'Adidas AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ADYEN.AS', name: 'Adyen NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AENA.MC', name: 'Aena SME SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AFX.DE', name: 'Carl Zeiss Meditec AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AGN.AS', name: 'Aegon NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AHT.L', name: 'Ashtead Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'AI.PA', name: 'Air Liquide SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AIR.PA', name: 'Airbus SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AKZA.AS', name: 'Akzo Nobel NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ALO.PA', name: 'Alstom SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ALV.DE', name: 'Allianz SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AMS.MC', name: 'Amadeus IT Group SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AMUN.PA', name: 'Amundi SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ANA.MC', name: 'Acciona SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ANTO.L', name: 'Antofagasta PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'ASM.AS', name: 'ASM International NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ASML.AS', name: 'ASML Holding NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ASRNL.AS', name: 'ASR Nederland NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ATO.PA', name: 'Atos SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'AUTO.L', name: 'Auto Trader Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'AV.L', name: 'Aviva PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'AZN.L', name: 'AstraZeneca PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BA.L', name: 'BAE Systems PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BARC.L', name: 'Barclays PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BAS.DE', name: 'BASF SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BATS.L', name: 'British American Tobacco PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BATUSD', name: 'Basic Attention Token', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Crypto' },
  { symbol: 'BAYN.DE', name: 'Bayer AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BBVA.MC', name: 'Banco Bilbao Vizcaya Argentaria SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BCHUSD', name: 'Bitcoin Cash', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Crypto' },
  { symbol: 'BDEV.L', name: 'Barratt Developments PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BEI.DE', name: 'Beiersdorf AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BKG.L', name: 'Berkeley Group Holdings PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BLND.L', name: 'British Land Company PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BMW.DE', name: 'Bayerische Motoren Werke AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BN.PA', name: 'Danone SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BNP.PA', name: 'BNP Paribas SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BNR.DE', name: 'Brenntag SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'BNZL.L', name: 'Bunzl PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BP.L', name: 'BP PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BRBY.L', name: 'Burberry Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'BT-A.L', name: 'BT Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'CA.PA', name: 'Carrefour SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'CABK.MC', name: 'CaixaBank SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'CAP.PA', name: 'Capgemini SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'CBK.DE', name: 'Commerzbank AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'CCH.L', name: 'Coca-Cola HBC AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'CDI.PA', name: 'Christian Dior SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'CL-OIL', name: 'Crude Oil WTI Futures', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Commodities' },
  { symbol: 'CLNX.MC', name: 'Cellnex Telecom SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'CNA.L', name: 'Centrica PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'COCUSD', name: 'Cocoa', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Commodities' },
  { symbol: 'CON.DE', name: 'Continental AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'CPG.L', name: 'Compass Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'CRDA.L', name: 'Croda International PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'CRH.L', name: 'CRH PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'CS.PA', name: 'AXA SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DAI.DE', name: 'Daimler AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DB1.DE', name: 'Deutsche Boerse AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DBK.DE', name: 'Deutsche Bank AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DCC.L', name: 'DCC PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'DG.PA', name: 'Vinci SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DGE.L', name: 'Diageo PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'DHER.DE', name: 'Delivery Hero SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DHL.DE', name: 'DHL Group AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DIM.PA', name: 'DIM', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DPW.DE', name: 'Deutsche Post AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DSY.PA', name: 'Dassault Systemes SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DTE.DE', name: 'Deutsche Telekom AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DWNI.DE', name: 'Deutsche Wohnen SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'DWS.DE', name: 'DWS Group GmbH & Co KGaA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ELE.MC', name: 'Endesa SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ENGI.PA', name: 'Engie SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ENT.L', name: 'Entain PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'EOAN.DE', name: 'E.ON SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'EURMXN', name: 'Euro vs Mexican Peso', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'EURNOK', name: 'Euro vs Norwegian Krone', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'EURSEK', name: 'Euro vs Swedish Krona', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'EURSGD', name: 'Euro vs Singapore Dollar', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'EURZAR', name: 'Euro vs South African Rand', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'EUSTX50', name: 'Euro Stoxx 50', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Índices' },
  { symbol: 'EXPN.L', name: 'Experian PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'EZJ.L', name: 'easyJet PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'FIE.DE', name: 'FIE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'FLTR.L', name: 'Flutter Entertainment PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'FME.DE', name: 'Fresenius Medical Care AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'FP.PA', name: 'TotalEnergies SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'FRA.DE', name: 'Fraport AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'FRAS.L', name: 'Frasers Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'FRE.DE', name: 'Fresenius SE & Co KGaA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'FRES.L', name: 'Fresnillo PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'G24.DE', name: 'Scout24 SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'GALP.LS', name: 'Galp Energia SGPS SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'GLE.PA', name: 'Societe Generale SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'GLEN.L', name: 'Glencore PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'GOLDFT', name: 'Gold Futures', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Commodities' },
  { symbol: 'GSK.L', name: 'GSK PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'HEI.DE', name: 'Heidelberg Materials AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'HEIA.AS', name: 'Heineken NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'HEN3.DE', name: 'Henkel AG & Co KGaA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'HIK.L', name: 'Hikma Pharmaceuticals PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'HLAG.DE', name: 'Hapag-Lloyd AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'HLMA.L', name: 'Halma PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'HNR1.DE', name: 'Hannover Rueck SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'HOT.DE', name: 'HOT', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'HSBA.L', name: 'HSBC Holdings PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'HSX.L', name: 'Hiscox Ltd', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'IAG.L', name: 'International Consolidated Airlines Group SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'IBE.MC', name: 'Iberdrola SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ICP.L', name: 'Intermediate Capital Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'IFX.DE', name: 'Infineon Technologies AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'IHG.L', name: 'InterContinental Hotels Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'III.L', name: '3i Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'IMB.L', name: 'Imperial Brands PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'IMCD.AS', name: 'IMCD NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'INF.L', name: 'Informa PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'INGA.AS', name: 'ING Groep NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ITRK.L', name: 'Intertek Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'ITV.L', name: 'ITV PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'ITX.MC', name: 'Industria de Diseno Textil SA (Inditex)', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'JD.L', name: 'JD Sports Fashion PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'JMAT.L', name: 'Johnson Matthey PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'KBX.DE', name: 'Knorr-Bremse AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'KER.PA', name: 'Kering SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'KGF.L', name: 'Kingfisher PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'KGX.DE', name: 'KION Group AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'KRN.DE', name: 'Krones AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'LAND.L', name: 'Land Securities Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'LEG.DE', name: 'LEG Immobilien SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'LGEN.L', name: 'Legal & General Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'LHA.DE', name: 'Deutsche Lufthansa AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'LIN.DE', name: 'Linde PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'LLOY.L', name: 'Lloyds Banking Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'LR.PA', name: 'Legrand SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'LSEG.L', name: 'London Stock Exchange Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'MAP.MC', name: 'Mapfre SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'MBG.DE', name: 'Mercedes-Benz Group AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'MC.PA', name: 'LVMH Moet Hennessy Louis Vuitton SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ML.PA', name: 'Michelin', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'MNDI.L', name: 'Mondi PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'MNG.L', name: 'M&G PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'MRCK.DE', name: 'Merck & Co Inc', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'MRK.DE', name: 'Merck KGaA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'MRO.L', name: 'Melrose Industries PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'MT.AS', name: 'ArcelorMittal SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'MTX.DE', name: 'MTU Aero Engines AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'MUV2.DE', name: 'Muenchener Rueckversicherungs-Gesellschaft AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'NEMD.DE', name: 'NEMD', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'NG.L', name: 'National Grid PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'NGRID.L', name: 'National Grid PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'NN.AS', name: 'NN Group NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'NWG.L', name: 'NatWest Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'NXT.L', name: 'Next PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'OCDO.L', name: 'Ocado Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'OR.PA', name: 'L\'Oreal SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'ORA.PA', name: 'Orange SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'PHIA.AS', name: 'Koninklijke Philips NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'PRU.L', name: 'Prudential PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'PRX.AS', name: 'Prosus NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'PSH.L', name: 'Pershing Square Holdings Ltd', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'PSN.L', name: 'Persimmon PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'PSON.L', name: 'Pearson PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'PUBP.PA', name: 'PUBP', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'PUM.DE', name: 'Puma SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'PURG.L', name: 'Purplebricks Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'RAA.DE', name: 'RAA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'RAND.AS', name: 'Randstad NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'RELX.L', name: 'RELX PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'REP.MC', name: 'Repsol SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'RI.PA', name: 'Pernod Ricard SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'RIO.L', name: 'Rio Tinto PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'RKT.L', name: 'Reckitt Benckiser Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'RMS.PA', name: 'Hermes International SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'RMV.L', name: 'Rightmove PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'RNO.PA', name: 'Renault SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'RR.L', name: 'Rolls-Royce Holdings PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'RRTL.DE', name: 'RTL Group SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'RS1.L', name: 'RS Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'RTO.L', name: 'Rentokil Initial PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'RWE.DE', name: 'RWE AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SAB.MC', name: 'Banco de Sabadell SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SAF.PA', name: 'Safran SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SAN.PA', name: 'Sanofi SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SANTANDER.MC', name: 'Banco Santander SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SAP.DE', name: 'SAP SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SBRY.L', name: 'J Sainsbury PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SDR.L', name: 'Schroders PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SGE.L', name: 'Sage Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SGO.PA', name: 'Compagnie de Saint-Gobain SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SGRO.L', name: 'Segro PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SHEL.L', name: 'Shell PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SHIBUSD', name: 'Shiba Inu', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Crypto' },
  { symbol: 'SHL.DE', name: 'Siemens Healthineers AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SIE.DE', name: 'Siemens AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SILVERFT', name: 'Silver Futures', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Commodities' },
  { symbol: 'SMDS.L', name: 'DS Smith PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SMIN.L', name: 'Smiths Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SMT.L', name: 'Scottish Mortgage Investment Trust PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SN.L', name: 'Smith & Nephew PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SON.LS', name: 'Sonae SGPS SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SPX.L', name: 'Spirax-Sarco Engineering PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SRT3.DE', name: 'Sartorius AG (ações preferenciais)', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SSE.L', name: 'SSE PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'STAN.L', name: 'Standard Chartered PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'STJ.L', name: 'St. James Place PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'STM.PA', name: 'STMicroelectronics NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SU.PA', name: 'Schneider Electric SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SVT.L', name: 'Severn Trent PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SW.PA', name: 'Sodexo SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'SWR.L', name: 'SWR', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'SY1.DE', name: 'Symrise AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'TCFP.PA', name: 'TCFP', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'TEF.MC', name: 'Telefonica SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'TEP.PA', name: 'Teleperformance SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'TLX.DE', name: 'Talanx AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'TRST.L', name: 'TRST', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'TSCO.L', name: 'Tesco PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'TW.L', name: 'Taylor Wimpey PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'UKOUSDFT', name: 'Brent Oil Futures', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Commodities' },
  { symbol: 'ULVR.L', name: 'Unilever PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'UNA.AS', name: 'Unilever NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'URW.PA', name: 'Unibail-Rodamco-Westfield SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'USDCNH', name: 'US Dollar vs Chinese Yuan Offshore', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDHKD', name: 'US Dollar vs Hong Kong Dollar', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDHUF', name: 'US Dollar vs Hungarian Forint', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDIDR', name: 'US Dollar vs Indonesian Rupiah', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDINR', name: 'US Dollar vs Indian Rupee', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDKRW', name: 'US Dollar vs South Korean Won', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDMXN', name: 'US Dollar vs Mexican Peso', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDNOK', name: 'US Dollar vs Norwegian Krone', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDRUB', name: 'US Dollar vs Russian Ruble', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDSEK', name: 'US Dollar vs Swedish Krona', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDSGD', name: 'US Dollar vs Singapore Dollar', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDTHB', name: 'US Dollar vs Thai Baht', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDTRY', name: 'US Dollar vs Turkish Lira', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDTWD', name: 'US Dollar vs Taiwan Dollar', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'USDZAR', name: 'US Dollar vs South African Rand', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Forex' },
  { symbol: 'UTDI.DE', name: 'United Internet AG', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'UU.L', name: 'United Utilities Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'VIE.PA', name: 'Veolia Environnement SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'VIS.MC', name: 'Viscofan SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'VIV.PA', name: 'Vivendi SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'VNA.DE', name: 'Vonovia SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'VOD.L', name: 'Vodafone Group PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'VOW.DE', name: 'Volkswagen AG (ações ordinárias)', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'VOW3.DE', name: 'Volkswagen AG (ações preferenciais)', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'VPK.AS', name: 'Koninklijke Vopak NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'WKL.AS', name: 'Wolters Kluwer NV', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'WLN.PA', name: 'Worldline SA', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  { symbol: 'WPP.L', name: 'WPP PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'WTB.L', name: 'Whitbread PLC', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks UK' },
  { symbol: 'XAUEUR', name: 'Gold vs Euro', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Commodities' },
  { symbol: 'ZAL.DE', name: 'Zalando SE', bid: 0, ask: 0, change: 0, changePercent: 0, category: 'Stocks EU' },
  ];

  // 🔥 NOVO: State para ativos com preços REAIS do MT5/APIs
  const [liveAssets, setLiveAssets] = useState<MarketAsset[]>(staticAssetsBase);

  // 🔥 NOVO: Buscar preços REAIS para os principais ativos ao carregar
  useEffect(() => {
    const updateLivePrices = async () => {
      console.log('[ChartView] 💰 Buscando preços REAIS para demonstrativo...');
      
      // ✅ 2026-07-13: buscar TODOS os símbolos, não só os primeiros 50 — o
      // array começa com ~40 cripto + 28 forex, então o limite antigo nunca
      // alcançava Índices/Commodities (ficavam parados no valor fake do seed
      // inicial pra sempre). getBatchedMT5Data já faz chunking interno (lotes
      // de 40, com pausa) contra a conta MetaAPI compartilhada, então é seguro
      // mandar a lista inteira de uma vez.
      const allSymbols = staticAssetsBase.map(a => a.symbol);

      // 🎯 Uma única chamada em lote (getBatchedMT5Data) em vez de N chamadas
      // individuais concorrentes — mesma proteção já aplicada ao loop de P&L
      // do AI Trading Engine (useApexLogic.ts) contra sobrecarga da conta
      // MetaAPI compartilhada.
      const batched: Record<string, RealMarketData> = await getBatchedMT5Data(allSymbols).catch((error) => {
        console.warn('[ChartView] ⚠️ Falha ao buscar preços em lote:', error);
        return {};
      });

      const updatedAssets = staticAssetsBase.map((asset) => {
        const data = batched[asset.symbol];

        if (data && data.isRealData && data.price > 0) {
          console.log(`[ChartView] ✅ Preço atualizado ${asset.symbol}:`, data.price);

          const spread = data.price * 0.0002; // 0.02% spread típico
          return {
            ...asset,
            bid: data.price,
            ask: data.price + spread,
            change: data.change ?? asset.change,
            changePercent: data.changePercent ?? asset.changePercent
          };
        }

        return asset; // Manter valor original se falhar
      });

      setLiveAssets(updatedAssets);
      console.log('[ChartView] ✅ Demonstrativo atualizado com preços REAIS');
    };
    
    // Buscar na primeira vez
    updateLivePrices();
    
    // ⚠️ REVERTIDO 2026-07-20: tinha reduzido de 5s pra 1s achando que ajudaria
    // a fluidez, mas esse painel busca TODOS os ~300 ativos do catálogo numa
    // única chamada em lote (getBatchedMT5Data) contra a conta MetaAPI
    // compartilhada — rodar isso 5x mais rápido sobrecarrega a conta e disputa
    // recursos com o carregamento do próprio Gráfico selecionado (achado real:
    // Cleber reportou Gráfico "demorando demais" e "achatado" logo depois desta
    // mudança). A fluidez do candle selecionado já vem do streaming de preço
    // (subscribeToSymbol, 2s) — não depende deste painel demonstrativo.
    const interval = setInterval(updateLivePrices, 5000);
    
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

  // 🆕 Ícone de fechar ("✕") que aparece na legenda do indicador, direto no gráfico —
  // clicável (via ActionType.OnTooltipIconClick da própria klinecharts) pra remover o
  // indicador sem precisar abrir o modal de Indicadores Técnicos.
  const INDICATOR_CLOSE_ICON = {
    id: 'remove',
    position: 'right',
    color: '#76808F',
    activeColor: '#F92855',
    size: 13,
    fontFamily: 'Arial',
    icon: '✕',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'rgba(247, 40, 85, 0.15)',
    paddingLeft: 6,
    paddingRight: 2,
    paddingTop: 2,
    paddingBottom: 2,
    marginLeft: 6,
    marginRight: 2,
    marginTop: 6,
    marginBottom: 0
  };

  // 🆕 Escolha do usuário de onde cada indicador é desenhado: 'overlay' (direto em cima
  // do preço, no gráfico principal) ou 'pane' (painel próprio, exclusivo, embaixo do
  // gráfico — como RSI/MACD normalmente precisam, já que a escala deles não tem nada
  // a ver com a escala de preço). Sem escolha explícita do usuário, cai no padrão de
  // cada indicador (`indicator.isPaneIndicator`) — osciladores nascem em painel próprio,
  // médias/bandas nascem sobre o preço.
  const [indicatorPlacement, setIndicatorPlacement] = useState<Record<string, 'overlay' | 'pane'>>({});
  const getIndicatorPlacement = (indicator: IndicatorConfig): 'overlay' | 'pane' =>
    indicatorPlacement[indicator.id] ?? (indicator.isPaneIndicator ? 'pane' : 'overlay');

  // 🆕 Parâmetros atuais de cada indicador ativo (período, etc.) — editáveis via
  // engrenagem no chip ou no menu de botão direito. Sem entrada aqui, usa defaultParams.
  const [indicatorParamsById, setIndicatorParamsById] = useState<Record<string, number[]>>({});
  const getIndicatorParams = (indicator: IndicatorConfig): number[] =>
    indicatorParamsById[indicator.id] ?? (indicator.defaultParams ?? []);

  // 🆕 Médias móveis (MA/EMA/SMA/WMA) têm um editor completo no padrão MT5 — Período,
  // Deslocar, Método, Aplicar a e Estilo (ver registerMovingAverageIndicator no topo
  // do arquivo). As demais continuam com o editor genérico (só período) acima.
  interface MAUISettings {
    period: number;
    shift: number;
    method: MAMethod;
    appliedPrice: AppliedPrice;
    color: string;
    lineStyle: 'solid' | 'dashed';
    lineWidth: number;
  }
  const MA_DEFAULT_METHOD: Record<string, MAMethod> = { ma: 'SIMPLE', sma: 'SIMPLE', ema: 'EXPONENTIAL', wma: 'LINEAR_WEIGHTED' };
  const isMovingAverageIndicator = (indicator: IndicatorConfig): boolean => indicator.id in MA_DEFAULT_METHOD;

  const [indicatorMASettings, setIndicatorMASettings] = useState<Record<string, MAUISettings>>({});
  const getMASettings = (indicator: IndicatorConfig): MAUISettings =>
    indicatorMASettings[indicator.id] ?? {
      period: indicator.defaultParams?.[0] ?? 20,
      shift: 0,
      method: MA_DEFAULT_METHOD[indicator.id] ?? 'SIMPLE',
      appliedPrice: 'CLOSE',
      color: '#f97316',
      lineStyle: 'solid',
      lineWidth: 1
    };

  const applyMASettingsToChart = (chart: any, indicator: IndicatorConfig, settings: MAUISettings) => {
    const paneId = indicatorPaneIdRef.current[indicator.id];
    if (!chart || !paneId) return;
    chart.overrideIndicator({
      name: indicator.klinechartsName,
      calcParams: [settings.period],
      extendData: { method: settings.method, appliedPrice: settings.appliedPrice, shift: settings.shift },
      styles: { lines: [{ color: settings.color, style: settings.lineStyle, size: settings.lineWidth }] }
    }, paneId);
  };

  const [maEditor, setMaEditor] = useState<{ indicator: IndicatorConfig; settings: MAUISettings } | null>(null);

  const openMAEditor = (indicator: IndicatorConfig) => {
    setMaEditor({ indicator, settings: { ...getMASettings(indicator) } });
  };

  const saveMAEditor = () => {
    if (!maEditor) return;
    const { indicator, settings } = maEditor;
    if (!Number.isFinite(settings.period) || settings.period <= 0) {
      toast.error('Período precisa ser um número válido maior que zero');
      return;
    }
    if (!Number.isFinite(settings.shift)) {
      toast.error('Deslocar precisa ser um número válido');
      return;
    }
    setIndicatorMASettings(prev => ({ ...prev, [indicator.id]: settings }));
    const chart = chartInstanceRef.current;
    if (chart && activeIndicators.has(indicator.id)) {
      try {
        applyMASettingsToChart(chart, indicator, settings);
      } catch (error) {
        console.error('[ChartView] ❌ Error updating moving average settings:', error);
      }
    }
    setMaEditor(null);
    toast.success(`${indicator.name.split(' - ')[0]} atualizada`);
  };

  // 🆕 Popover de edição de parâmetros, aberto pela engrenagem do chip ou pelo menu
  // de botão direito.
  const [indicatorEditor, setIndicatorEditor] = useState<{ indicator: IndicatorConfig; values: string[] } | null>(null);

  const openIndicatorEditor = (indicator: IndicatorConfig) => {
    const current = getIndicatorParams(indicator);
    setIndicatorEditor({ indicator, values: current.map(v => String(v)) });
  };

  const saveIndicatorEditor = () => {
    if (!indicatorEditor) return;
    const { indicator, values } = indicatorEditor;
    const parsed = values.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0);
    if (parsed.length !== values.length) {
      toast.error('Todos os parâmetros precisam ser números válidos maiores que zero');
      return;
    }
    setIndicatorParamsById(prev => ({ ...prev, [indicator.id]: parsed }));
    const chart = chartInstanceRef.current;
    const paneId = indicatorPaneIdRef.current[indicator.id];
    if (chart && paneId && activeIndicators.has(indicator.id)) {
      try {
        chart.overrideIndicator({ name: indicator.klinechartsName, calcParams: parsed }, paneId);
      } catch (error) {
        console.error('[ChartView] ❌ Error updating indicator params:', error);
      }
    }
    setIndicatorEditor(null);
    toast.success(`Parâmetros de ${indicator.name.split(' - ')[0]} atualizados`);
  };

  const removeIndicatorInstance = (chart: any, indicator: IndicatorConfig) => {
    const paneId = indicatorPaneIdRef.current[indicator.id] || (indicator.isPaneIndicator ? `pane_${indicator.id}` : 'candle_pane');
    // ⚠️ klinecharts não tem conceito de "id" de instância -- IndicatorStore.removeInstance
    // casa por `ins.name === name`, e `name` é sempre o klinechartsName (ex: 'MA'), nunca
    // o nosso id interno (ex: 'ma'). Passar indicator.id aqui nunca dava match (diferença
    // de maiúsculas) e o removeIndicator falhava silenciosamente -- o indicador "removido"
    // continuava desenhado no gráfico como órfão, mesmo com o estado React já limpo.
    chart.removeIndicator(paneId, indicator.klinechartsName);
    delete indicatorPaneIdRef.current[indicator.id];
  };

  const createIndicatorInstance = (chart: any, indicator: IndicatorConfig, placement: 'overlay' | 'pane') => {
    const config: any = {
      name: indicator.klinechartsName,
      id: indicator.id
      // ✅ Ícone de excluir (✕) vem do estilo global setado em chart.setStyles() no init
      // (styles.tooltip.icons por instância é ignorado pela klinecharts — ver comentário lá)
    };
    if (isMovingAverageIndicator(indicator)) {
      // 🆕 Médias móveis (MA/EMA/SMA/WMA) carregam Método/Aplicar a/Deslocar/Estilo já
      // na criação (não só via editor depois) — ver registerMovingAverageIndicator.
      const settings = getMASettings(indicator);
      config.calcParams = [settings.period];
      config.extendData = { method: settings.method, appliedPrice: settings.appliedPrice, shift: settings.shift };
      config.styles = { lines: [{ color: settings.color, style: settings.lineStyle, size: settings.lineWidth }] };
    } else {
      const params = getIndicatorParams(indicator);
      if (params.length > 0) {
        config.calcParams = params;
      }
    }
    if (placement === 'pane') {
      chart.createIndicator(config, false, { id: `pane_${indicator.id}` });
      indicatorPaneIdRef.current[indicator.id] = `pane_${indicator.id}`;
    } else {
      // paneOptions.id precisa apontar pro pane existente (candle_pane) -- sem isso,
      // createIndicator faz getDrawPaneById('') = null e cai no ramo de criar um pane NOVO
      // (ver ChartImp.prototype.createIndicator em node_modules/klinecharts/dist/index.esm.js)
      chart.createIndicator(config, true, { id: 'candle_pane' });
      indicatorPaneIdRef.current[indicator.id] = 'candle_pane';
    }
  };

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
        console.log('[ChartView] 🗑️ Removing indicator:', indicator.name);
        removeIndicatorInstance(chart, indicator);

        const newActiveIndicators = new Set(activeIndicators);
        newActiveIndicators.delete(indicator.id);
        setActiveIndicators(newActiveIndicators);

        console.log('[ChartView] ✅ Indicator removed successfully');
      } else {
        console.log('[ChartView] ➕ Adding indicator:', indicator.name, 'placement:', getIndicatorPlacement(indicator));
        createIndicatorInstance(chart, indicator, getIndicatorPlacement(indicator));

        const newActiveIndicators = new Set(activeIndicators);
        newActiveIndicators.add(indicator.id);
        setActiveIndicators(newActiveIndicators);

        console.log('[ChartView] ✅ Indicator added successfully');
      }
    } catch (error) {
      console.error('[ChartView] ❌ Error toggling indicator:', error);
    }
  };

  // 🆕 Muda onde o indicador é desenhado (gráfico principal vs painel próprio). Se o
  // indicador já estiver ativo, remove e recria na hora na nova posição escolhida —
  // nunca deixa duas instâncias do mesmo indicador na tela ao mesmo tempo.
  const changeIndicatorPlacement = (indicator: IndicatorConfig, placement: 'overlay' | 'pane') => {
    setIndicatorPlacement(prev => ({ ...prev, [indicator.id]: placement }));
    const chart = chartInstanceRef.current;
    if (!chart || !activeIndicators.has(indicator.id)) return;
    try {
      removeIndicatorInstance(chart, indicator);
      createIndicatorInstance(chart, indicator, placement);
    } catch (error) {
      console.error('[ChartView] ❌ Error changing indicator placement:', error);
    }
  };

  // Refs pra chamar a lógica de toggle/remoção a partir do listener de clique no ícone
  // (subscrito uma única vez, no efeito de criação do chart — precisa ver sempre o
  // estado/indicadores mais recentes, não os do momento em que o efeito rodou).
  const toggleIndicatorRef = useRef(toggleIndicator);
  useEffect(() => {
    toggleIndicatorRef.current = toggleIndicator;
  });

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
      // 🔧 FIX: caíam em 'segment' (só traça a linha, sem nenhuma informação) — agora
      // usam overlays customizados reais com Δ preço/%/barras/ângulo grudados na linha.
      'info-line': 'infoLine',
      'extended-line': 'straightLine',
      'trend-angle': 'trendAngleLine',
      'horizontal-line': 'horizontalStraightLine',
      'horizontal-ray': 'horizontalRayLine',
      'vertical-line': 'verticalStraightLine',
      'cross-line': 'straightLine',
      
      // Channels
      'parallel-channel': 'parallelStraightLine',
      'regression-trend': 'priceChannelLine',
      'flat-top-bottom': 'parallelStraightLine',
      'disjoint-channel': 'priceChannelLine',
      'non-parallel-channel': 'nonParallelChannel', // 🔧 FIX: id emitido pelo submenu nunca esteve mapeado

      // Pitchfork — garfo de Andrews REAL (overlay customizado: mediana + 2 hastes),
      // antes desenhava só um segmento reto
      'pitchfork': 'pitchforkLine',
      'schiff-pitchfork': 'pitchforkLine',
      'modified-schiff-pitchfork': 'pitchforkLine',
      'modified-schiff': 'pitchforkLine',
      'inside-pitchfork': 'pitchforkLine',
      
      // Fibonacci
      'fib-retracement': 'fibonacciLine',
      'fib-extension': 'fibonacciExtension', // Será tratado com fallback para fibonacciLine
      'fib-channel': 'fibonacciLine', // Usa fibonacciLine como base
      'fib-timezone': 'fibonacciLine',
      'fib-time': 'fibonacciLine',
      'fib-wedge': 'fibonacciLine',
      // 🔧 FIX: círculos/leques/arcos de Fibonacci apontavam pra overlays que NÃO EXISTEM
      // na klinecharts 9.8 ('fibonacciCircle'/'fibonacciSpiral'/'fibonacciSpeedResistanceFan')
      // — sempre caíam em "Overlay não suportado". Agora usam overlays customizados reais.
      'fib-circles': 'fibCircles',
      'fib-fan': 'fibFan',
      'fib-speed-fan': 'fibFan',
      'fib-speedfan': 'fibFan',
      'fib-speed-arcs': 'fibArcs',
      'fib-speedarcs': 'fibArcs',
      // 'fib-spiral' deliberadamente SEM mapeamento — espiral real ainda não implementada;
      // cai no aviso honesto "em desenvolvimento" em vez de erro ou desenho errado.
      
      // Shapes — overlays customizados reais (a klinecharts 9.8 não tem 'rect'/'circle'/
      // 'triangle' nativos como overlay de desenho; o mapa antigo apontava pra nomes que
      // não existem na lib, sempre caindo em "Overlay não suportado")
      'rectangle': 'rectShape',
      'rotated-rectangle': 'rectShape', // rotação real fica pra uma próxima iteração
      'ellipse': 'circleShape',
      'circle': 'circleShape',
      'triangle': 'triangleShape',
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
      
      // Measure — régua real (Δ preço/%/barras), overlay customizado registrado no topo
      'measure': 'measureRuler',
      'measurement': 'measureRuler'
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
      const isCustomOverlay = CUSTOM_OVERLAY_NAMES.has(overlayType);
      
      if (!supportedOverlays.includes(overlayType) && !isCustomOverlay) {
        console.warn('[ChartView] ⚠️ Overlay não suportado:', overlayType);
        
        toast.error('Overlay não suportado pela biblioteca', {
          description: `Tipo: ${overlayType}`,
          duration: 4000
        });
        return;
      }
      
      // Use the createOverlay method with proper overlay name
      // 🆕 groupId separa desenhos do usuário dos overlays de sistema (S/R, sinais) —
      // travar/ocultar/apagar da toolbar agora age SÓ neste grupo.
      // 🔧 FIX: chart.subscribeAction('onOverlayClick', ...) NUNCA funcionou — o ActionType
      // desta versão da klinecharts (ver enum: OnDataReady/OnZoom/OnScroll/...) nem tem esse
      // membro, então o clique num desenho não disparava nada (nem o editor da Linha com
      // Informações, nem a toolbar de contexto de Bloquear/Ocultar/Estilo/Duplicar/Copiar).
      // O jeito real de ouvir clique em overlay é o handler onClick por instância, atribuído
      // na própria criação (ver Overlay.onClick na tipagem da lib).
      const overlayId = chartInstanceRef.current.createOverlay({
        name: overlayType,
        groupId: USER_DRAWINGS_GROUP,
        onClick: (event: any) => {
          if (overlayType === 'infoLine') {
            const existingText = typeof event.overlay?.extendData === 'string' ? event.overlay.extendData : '';
            setInfoLineText(existingText);
            infoLineTextRef.current = existingText;
            setInfoLineEditor({ overlayId: event.overlay.id, x: event.x ?? 0, y: event.y ?? 0 });
          } else {
            setSelectedDrawing({
              id: event.overlay.id,
              type: event.overlay.name,
              isLocked: !!event.overlay.lock,
              isHidden: event.overlay.visible === false
            });
            const chartRect = chartContainerRef.current?.getBoundingClientRect();
            if (chartRect) {
              setContextToolbarPosition({
                x: chartRect.left + chartRect.width / 2 - 200,
                y: chartRect.top + 50
              });
            }
            setShowContextToolbar(true);
          }
          return true;
        }
      });
      
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

  // 🆕 Emoji escolhido no picker → próximo clique no gráfico ancora o emoji ali
  const handleEmojiSelect = (emoji: string) => {
    if (!chartInstanceRef.current) {
      toast.error('Aguarde o carregamento do gráfico');
      return;
    }
    try {
      chartInstanceRef.current.createOverlay({
        name: 'emojiMarker',
        groupId: USER_DRAWINGS_GROUP,
        extendData: emoji
      });
      toast.success(`${emoji} selecionado`, {
        description: 'Clique no gráfico para posicionar',
        duration: 2500
      });
    } catch (error) {
      console.error('[ChartView] ❌ Error creating emoji marker:', error);
      toast.error('Erro ao criar marcador');
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
    if (!chartInstanceRef.current || !selectedDrawing) return;

    const newLockState = !selectedDrawing.isLocked;
    try {
      // 🔧 FIX: antes só mudava estado local + toast — agora trava o overlay de verdade
      chartInstanceRef.current.overrideOverlay({ id: selectedDrawing.id, lock: newLockState });
      setSelectedDrawing({ ...selectedDrawing, isLocked: newLockState });
      toast.success(newLockState ? 'Desenho bloqueado' : 'Desenho desbloqueado');
    } catch (error) {
      console.error('[ChartView] ❌ Error locking drawing:', error);
      toast.error('Erro ao bloquear desenho');
    }
  };

  const handleDrawingStyleChange = (style: any) => {
    if (!chartInstanceRef.current || !selectedDrawing) return;

    try {
      // 🔧 FIX: antes era só console.log + toast falso de sucesso — agora aplica de verdade.
      // Payload vem da DrawingContextToolbar: { lineWidth } | { fontSize } | { lineStyle }
      const styles: any = {};
      if (typeof style.lineWidth === 'number') {
        styles.line = { ...(styles.line || {}), size: style.lineWidth };
      }
      if (style.lineStyle === 'solid' || style.lineStyle === 'dashed' || style.lineStyle === 'dotted') {
        styles.line = {
          ...(styles.line || {}),
          style: style.lineStyle === 'solid' ? 'solid' : 'dashed',
          dashedValue: style.lineStyle === 'dotted' ? [2, 4] : [4, 4]
        };
      }
      if (typeof style.fontSize === 'number') {
        styles.text = { ...(styles.text || {}), size: style.fontSize };
      }
      if (typeof style.color === 'string') {
        styles.line = { ...(styles.line || {}), color: style.color };
        styles.text = { ...(styles.text || {}), color: style.color };
      }
      if (Object.keys(styles).length === 0) {
        console.warn('[ChartView] ⚠️ Estilo não reconhecido:', style);
        return;
      }
      chartInstanceRef.current.overrideOverlay({ id: selectedDrawing.id, styles });
      console.log('[ChartView] 🎨 Drawing style applied:', styles);
    } catch (error) {
      console.error('[ChartView] ❌ Error updating style:', error);
      toast.error('Erro ao atualizar estilo');
    }
  };

  const handleDrawingDuplicate = () => {
    if (!chartInstanceRef.current || !selectedDrawing) return;

    try {
      // 🔧 FIX: antes era só console.log + toast falso — agora clona o overlay de verdade,
      // deslocado algumas barras pra direita pra não ficar exatamente em cima do original.
      const chart = chartInstanceRef.current;
      const original = chart.getOverlayById(selectedDrawing.id);
      if (!original) {
        toast.error('Desenho original não encontrado');
        return;
      }
      const shiftedPoints = (original.points ?? []).map((p: any) => ({
        dataIndex: typeof p.dataIndex === 'number' ? p.dataIndex + 5 : undefined,
        value: p.value
      }));
      chart.createOverlay({
        name: original.name,
        groupId: USER_DRAWINGS_GROUP,
        points: shiftedPoints,
        styles: original.styles,
        extendData: original.extendData
      });
      toast.success('Desenho duplicado');
    } catch (error) {
      console.error('[ChartView] ❌ Error duplicating drawing:', error);
      toast.error('Erro ao duplicar desenho');
    }
  };

  const handleDrawingCopy = () => {
    if (!chartInstanceRef.current || !selectedDrawing) return;

    try {
      // 🔧 FIX: antes era toast falso — agora copia os dados reais do desenho
      // (tipo + pontos preço/tempo) pro clipboard do sistema, como JSON.
      const original = chartInstanceRef.current.getOverlayById(selectedDrawing.id);
      if (!original) {
        toast.error('Desenho não encontrado');
        return;
      }
      const payload = JSON.stringify(
        { name: original.name, points: original.points, extendData: original.extendData },
        null,
        2
      );
      navigator.clipboard
        .writeText(payload)
        .then(() => toast.success('Desenho copiado', { description: 'Dados (tipo + pontos) no clipboard' }))
        .catch(() => toast.error('Clipboard indisponível neste navegador'));
    } catch (error) {
      console.error('[ChartView] ❌ Error copying drawing:', error);
      toast.error('Erro ao copiar desenho');
    }
  };

  const handleDrawingHideToggle = () => {
    if (!chartInstanceRef.current || !selectedDrawing) return;

    const newHiddenState = !selectedDrawing.isHidden;
    try {
      // 🔧 FIX: antes só mudava estado local + toast — agora oculta o overlay de verdade
      chartInstanceRef.current.overrideOverlay({ id: selectedDrawing.id, visible: !newHiddenState });
      setSelectedDrawing({ ...selectedDrawing, isHidden: newHiddenState });
      toast.success(newHiddenState ? 'Desenho oculto' : 'Desenho visível');
    } catch (error) {
      console.error('[ChartView] ❌ Error hiding drawing:', error);
      toast.error('Erro ao ocultar desenho');
    }
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

      // 🔧 FIX: remove SÓ os desenhos do usuário (groupId) — antes o removeOverlay()
      // sem argumento apagava também os overlays de sistema (linhas de S/R, sinais).
      chart.removeOverlay({ groupId: USER_DRAWINGS_GROUP });

      console.log('[ChartView] ✅ All user drawings removed successfully');
    } catch (error) {
      console.error('[ChartView] ❌ Error removing drawings:', error);
      toast.error('Erro ao remover desenhos');
    }
  };

  // 🆕 Travar/destravar TODOS os desenhos do usuário — antes o botão da toolbar só
  // alternava um estado local com toast, sem efeito real no gráfico.
  const handleToggleLockDrawings = (locked: boolean) => {
    if (!chartInstanceRef.current) return;
    try {
      chartInstanceRef.current.overrideOverlay({ groupId: USER_DRAWINGS_GROUP, lock: locked });
      console.log('[ChartView] 🔒 Desenhos do usuário', locked ? 'travados' : 'destravados');
    } catch (error) {
      console.error('[ChartView] ❌ Error locking drawings:', error);
    }
  };

  // 🆕 Ocultar/mostrar TODOS os desenhos do usuário — mesmo caso do lock acima.
  const handleToggleHideDrawings = (hidden: boolean) => {
    if (!chartInstanceRef.current) return;
    try {
      chartInstanceRef.current.overrideOverlay({ groupId: USER_DRAWINGS_GROUP, visible: !hidden });
      console.log('[ChartView] 👁️ Desenhos do usuário', hidden ? 'ocultos' : 'visíveis');
    } catch (error) {
      console.error('[ChartView] ❌ Error hiding drawings:', error);
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

  const MACRO_SR_WINDOW_DAYS = 1825; // ~5 anos, mesma janela do Detector de Liquidez do Dashboard
  const MACRO_SR_REFRESH_MS = 30 * 60 * 1000; // dado diário muda pouco — não precisa refazer a cada troca de candle

  // 🆕 Busca (com cache por símbolo) a estrutura de longo prazo via o mesmo motor SMC
  // (Order Blocks/FVG/Piscinas de Liquidez, 1D/~5 anos) usado no Detector de Liquidez do
  // Dashboard. Sem isso, o S/R do gráfico só via o que estava dentro da janela curta
  // carregada na tela — por isso as linhas nunca refletiam níveis reais mais distantes
  // no tempo, mesmo quando esses níveis são exatamente os mais próximos do preço atual.
  const fetchMacroSrZones = async (symbol: string): Promise<SmcZone[]> => {
    const cached = macroSrZonesRef.current.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < MACRO_SR_REFRESH_MS) {
      return cached.zones;
    }
    try {
      const end = new Date();
      const start = new Date(end.getTime() - MACRO_SR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const response = await backtestDataService.fetchHistoricalData(symbol, start, end, '1d');
      const candles = response.candles.map((c) => ({
        timestamp: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }));
      const analysis = analyzeSmc(candles, symbol, '1d');
      const zones = [...analysis.orderBlocks, ...analysis.fairValueGaps, ...analysis.liquidityPools].filter(
        (z) => !z.mitigated
      );
      macroSrZonesRef.current.set(symbol, { zones, fetchedAt: Date.now() });
      return zones;
    } catch (err) {
      if (!(err instanceof BacktestDataUnavailableError)) {
        console.warn('[ChartView] ⚠️ Falha ao buscar estrutura macro (SMC 1D) pro S/R:', err);
      }
      return cached?.zones ?? [];
    }
  };

  // 🆕 Combina as zonas de S/R detectadas na janela curta do gráfico com as zonas
  // macro (SMC, longo prazo) — sempre priorizando as mais PRÓXIMAS do preço atual em
  // cada lado (suporte abaixo / resistência acima), não as de maior força/volume, que é
  // o que fazia as linhas aparecerem longe demais do preço.
  const buildSrZonesWithMacro = (
    intradayZones: LiquidityZone[],
    macroZones: SmcZone[],
    currentPrice: number
  ): LiquidityZone[] => {
    const macroAsLiquidity: LiquidityZone[] = macroZones.map((z, i) => {
      const price = (z.priceLow + z.priceHigh) / 2;
      const isSupport = price < currentPrice;
      const distance = ((price - currentPrice) / currentPrice) * 100;
      let significance: LiquidityZone['significance'];
      if (z.strength >= 80) significance = 'critical';
      else if (z.strength >= 60) significance = 'strong';
      else if (z.strength >= 40) significance = 'moderate';
      else significance = 'weak';
      return {
        id: `macro-${z.id}-${i}`,
        price,
        strength: z.strength,
        type: isSupport ? 'support' : 'resistance',
        touches: 1,
        volume: 0,
        distance,
        significance
      };
    });

    const combined = [...intradayZones, ...macroAsLiquidity];

    // Descarta duplicatas (zonas de fontes diferentes representando o mesmo nível,
    // dentro de 0.15% de preço uma da outra) — mantém a de maior força.
    const deduped: LiquidityZone[] = [];
    combined
      .sort((a, b) => b.strength - a.strength)
      .forEach((zone) => {
        const isDuplicate = deduped.some(
          (existing) => Math.abs(existing.price - zone.price) / currentPrice < 0.0015
        );
        if (!isDuplicate) deduped.push(zone);
      });

    return deduped;
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

  // 🆕 Desenha (ou limpa) as linhas de Suporte/Resistência direto no gráfico.
  // Sempre limpa os overlays anteriores antes de criar os novos — evita
  // vazamento de linhas de um ativo pro outro e permite ligar/desligar via
  // recriação (klinecharts nesta versão não tem flag nativa de visibilidade).
  const MAX_SR_OVERLAYS = 6;
  const renderSrOverlays = (zones: LiquidityZone[], visible: boolean) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    srOverlayIdsRef.current.forEach((id) => {
      try {
        chart.removeOverlay(id);
      } catch (e) {
        // overlay pode já ter sido removido (troca de ativo, dispose) — ignora
      }
    });
    srOverlayIdsRef.current = [];

    if (!visible || zones.length === 0) return;

    // 🔥 FIX: prioriza as zonas mais PRÓXIMAS do preço atual (não as de maior força/volume)
    // — é isso que garante que as linhas desenhadas sejam projeções relevantes pro próximo
    // movimento, não níveis distantes que o preço só tocaria depois de um movimento grande.
    const supports = zones.filter((z) => z.type === 'support').sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, MAX_SR_OVERLAYS / 2);
    const resistances = zones.filter((z) => z.type === 'resistance').sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, MAX_SR_OVERLAYS / 2);
    const selected = [...supports, ...resistances];

    selected.forEach((zone) => {
      const isSupport = zone.type === 'support';
      const isSolid = zone.significance === 'critical' || zone.significance === 'strong';
      const overlayId = `sr_${zone.type}_${zone.price.toFixed(5)}`;

      try {
        chart.createOverlay({
          name: 'horizontalStraightLine',
          id: overlayId,
          points: [{ value: zone.price }],
          styles: {
            line: {
              color: isSupport ? '#22c55e' : '#ef4444',
              style: isSolid ? 'solid' : 'dashed',
              size: isSolid ? 2 : 1
            },
            text: {
              color: '#ffffff',
              backgroundColor: isSupport ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)',
              size: 11
            }
          },
          text: `${isSupport ? 'S' : 'R'} ${zone.price.toFixed(2)} · ${zone.touches}x`
        });
        srOverlayIdsRef.current.push(overlayId);
      } catch (e) {
        console.warn('[ChartView] ⚠️ Não foi possível desenhar linha de S/R:', e);
      }
    });
  };

  // 🆕 Re-desenha (ou limpa) as linhas de S/R só quando o toggle muda — as
  // zonas em si já são desenhadas no momento em que são calculadas (dentro do
  // efeito de fetch de candles, via showSrOverlayRef pra sempre ler o valor
  // mais recente sem precisar recriar o gráfico inteiro a cada toggle).
  useEffect(() => {
    renderSrOverlays(liquidityZones, showSrOverlay);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liquidityZones intencionalmente fora: já é redesenhado no momento do cálculo
  }, [showSrOverlay]);

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

      // 🔧 FIX: dispose() do klinecharts nem sempre remove os <div> internos de
      // cada painel do DOM antes do próximo init() reusar o MESMO container
      // (ex: remount do React em StrictMode, troca de aba ida-e-volta). Isso
      // deixava os widgets internos presos com display:none/0x0 mesmo com o
      // container pai medindo certo — canvas nunca ganhava dimensão real e o
      // gráfico ficava em branco pra sempre, mesmo depois de dados carregarem.
      // Limpar o container manualmente garante que o init() sempre monta os
      // painéis do zero.
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = '';
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
        // ✅ Ícone de excluir (✕) na legenda de TODO indicador — precisa ser setado aqui
        // (estilo global), não no config de criação de cada indicador: a klinecharts só lê
        // chart.getStyles().indicator.tooltip.icons para desenhar/registrar clique dos ícones
        // da legenda, ignorando por completo qualquer `styles.tooltip.icons` passado por
        // instância em createIndicator() (confirmado lendo IndicatorTooltipView.drawIndicatorTooltip
        // em node_modules/klinecharts/dist/index.esm.js — por isso o ícone nunca aparecia/clicava).
        indicator: {
          tooltip: {
            icons: [INDICATOR_CLOSE_ICON]
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

      // 🎯 Aplica o modo inicial de verdade (seta, por padrão) — antes só tratava o
      // caso 'point' (comentário desatualizado dizia que o estado inicial era 'point',
      // mas o default já é 'arrow' há tempos). Sem chamar handleCrosshairModeChange aqui,
      // o cursor do mouse ficava com a cruz padrão da própria klinecharts até o usuário
      // clicar manualmente em "Seta" no menu de Cruz.
      console.log('[ChartView] 🎯 Aplicando modo inicial:', crosshairMode);
      handleCrosshairModeChange(crosshairMode);

      // ❌ REMOVIDO: chart.subscribeAction('onOverlayClick', ...) — nunca funcionou
      // (ActionType desta versão da klinecharts não tem esse membro; ver o enum real:
      // OnDataReady/OnZoom/OnScroll/OnVisibleRangeChange/OnTooltipIconClick/
      // OnCrosshairChange/OnCandleBarClick/OnPaneDrag). O clique num desenho agora é
      // tratado pelo onClick por instância, atribuído na criação de cada overlay
      // (ver handleDrawingToolSelect).

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

      // 🆕 Ícone "✕" na legenda do indicador (ver INDICATOR_CLOSE_ICON) — clicar remove
      // o indicador direto no gráfico, sem precisar abrir o modal de Indicadores.
      // data = { paneId, indicatorName (nome real na klinecharts, ex: 'RSI'), iconId }.
      chart.subscribeAction('onTooltipIconClick', (data: any) => {
        if (data?.iconId !== 'remove') return;
        const matched = INDICATORS.find(
          (ind) => ind.klinechartsName === data.indicatorName && indicatorPaneIdRef.current[ind.id] === data.paneId
        );
        if (matched) {
          toggleIndicatorRef.current(matched);
        }
      });

      // 🛡️ Só limpar o overlay "bolinha preta misteriosa" residual na PRIMEIRA carga desta
      // troca de símbolo/timeframe — ver fix logo abaixo, dentro de fetchData.
      let didCleanMysteryOverlay = false;

      // Fetch real data
      const fetchData = async () => {
        console.log('[ChartView] 🔄 Fetching candles for', selectedSymbol, 'timeframe:', timeframe);

        try {
          // 🚀 PERF: candles e marketData (preço/variação do dia) vêm de fontes
          // independentes (candles pode ser Binance direto; marketData passa por
          // roteamento + Edge Function) — disparar em paralelo em vez de sequencial
          // corta o tempo de carregamento do gráfico quase pela metade (cada um
          // podia levar segundos sozinho, principalmente cold start de Edge Function).
          const marketDataPromise = getRealMarketData(selectedSymbol).catch(error => {
            console.warn('[ChartView] ⚠️ Erro ao buscar dados reais, usando candles:', error);
            return null;
          });
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
          // Já disparado em paralelo com fetchCandles acima — só aguarda aqui.
          console.log('[ChartView] ✅ CHECKPOINT 2: Awaiting market data fetch via RealMarketDataService');
          let marketData: RealMarketData | null = null;
          const routedData = await marketDataPromise;
          if (routedData && routedData.price > 0) {
            marketData = routedData;
            currentPriceFromTicker = marketData.price;
            console.log('[ChartView] 🎯 Dados obtidos via', marketData.source.toUpperCase() + ':', {
              price: marketData.price,
              change: marketData.change,
              changePercent: marketData.changePercent,
              source: marketData.source,
              isRealData: marketData.isRealData
            });
          }
          console.log('[ChartView] ✅ CHECKPOINT 3: marketData fetch complete');

          // 🔥 SE TEMOS DADOS DA API, USAR ELES (não calcular manualmente!)
          if (marketData && marketData.price > 0 && marketData.isRealData && typeof marketData.change === 'number' && typeof marketData.changePercent === 'number') {
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
              isRealData: marketData.isRealData
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
          
          // 🔧 FIX GRAVE: chart.removeOverlay() SEM argumento apaga TODOS os overlays —
          // esse código rodava a cada ciclo do auto-refresh de 30s (fetchData é chamado em
          // loop, ver setInterval logo abaixo), então TODO desenho do usuário (linhas,
          // textos anexados na Linha com Informações, formas, garfos...) sumia sozinho a
          // cada 30 segundos, mesmo sem o usuário tocar em nada. Agora só limpa a "bolinha
          // preta misteriosa" residual UMA VEZ, na primeira carga desta troca de
          // símbolo/timeframe — nunca mais nos refreshs automáticos seguintes.
          if (!didCleanMysteryOverlay) {
            chart.removeOverlay();
            didCleanMysteryOverlay = true;
            console.log('[ChartView] 🧹 Overlays cleared after data load (só na 1ª carga)');
          }
          
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
          renderSrOverlays(zones, showSrOverlayRef.current);
          console.log('[ChartView] 🎯 Detected', zones.length, 'liquidity zones');

          // 🆕 Busca a estrutura de longo prazo (SMC, 1D/~5 anos) em paralelo e, quando
          // chegar, re-desenha o S/R combinando com a janela curta acima — sem isso as
          // linhas nunca refletiam níveis reais mais distantes no tempo (ex: uma máxima
          // histórica) mesmo quando esses níveis são os mais próximos do preço atual.
          const macroSymbolAtFetch = selectedSymbol;
          fetchMacroSrZones(macroSymbolAtFetch).then((macroZones) => {
            if (macroSymbolAtFetch !== selectedSymbol) return; // ativo já trocou, descarta
            if (macroZones.length === 0) return;
            const merged = buildSrZonesWithMacro(zones, macroZones, currentPriceForZones);
            setLiquidityZones(merged);
            renderSrOverlays(merged, showSrOverlayRef.current);
            console.log('[ChartView] 🎯 S/R combinado com estrutura macro (SMC):', merged.length, 'zonas');
          });
          
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

      // 🔧 FIX: window 'resize' não dispara quando o CONTAINER muda de tamanho
      // por causa do layout flex (ex: painel lateral montando depois, fonte
      // carregando, troca de aba) — só quando a JANELA do navegador muda.
      // Isso deixava o canvas com width/height=0 permanentemente se o container
      // ainda estivesse em 0x0 no momento do resize() inicial. ResizeObserver
      // reage a qualquer mudança real de tamanho do container.
      let resizeObserver: ResizeObserver | null = null;
      if (chartContainerRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            handleResize();
          }
        });
        resizeObserver.observe(chartContainerRef.current);
      }

      return () => {
        console.log('[ChartView] 🧹 Cleaning up chart...');
        window.removeEventListener('resize', handleResize);
        resizeObserver?.disconnect();
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
    // 🛡️ Limpa o buffer de candles da carga anterior — sem isso, o tick de streaming
    // que chega ANTES do histórico novo carregar via um candle velho (de outro
    // símbolo/timeframe) no ref, passava na checagem length > 0 e aplicava
    // chart.updateData num gráfico vazio → um único candle gigante na tela até o
    // applyNewData do fetch substituir tudo ("gráfico buga e depois volta").
    chartDataRef.current = [];
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

  // 🚀 Streaming de preço (via pipeline único RealMarketDataService, com cache de 2s)
  // Estendido pra TODO ativo (antes só crypto) — forex/índices/commodities
  // ficavam sem nenhuma atualização suave, só o refetch completo de 30s
  // (applyNewData substituindo tudo de uma vez), causando o efeito de
  // "soquinho"/degrau em vez de animação fluida.
  useEffect(() => {
    console.log(`[ChartView] 📡 Iniciando polling de preço para ${selectedSymbol}`);

    // Subscribe ao preço em tempo real (mesmo pipeline real usado no resto do app)
    // Intervalo de 2s: getRealMarketData já cacheia por símbolo por 2s, então
    // isso não gera chamada de rede nova a cada tick — só reflete o cache mais
    // recente com mais frequência, suavizando a animação sem sobrecarregar a
    // conta MetaAPI compartilhada (é 1 único símbolo, não um lote).
    const unsubscribe = subscribeToSymbol(selectedSymbol, (marketData) => {
      // 🛡️ GUARDA: getFallbackOrLastKnown pode devolver isRealData:false com
      // price:0 (nunca teve dado real ainda, ou falha transitória) — sem essa
      // checagem, esse valor zerado era aplicado direto no candle (close=0,
      // low=0), gerando um pavio gigante até a base do gráfico. Ignora
      // silenciosamente esse tick e mantém o último valor real conhecido.
      if (!marketData.isRealData || !marketData.price || marketData.price <= 0) {
        console.warn('[ChartView] ⚠️ Tick sem dado real (price<=0 ou isRealData:false) — ignorado, mantendo último valor conhecido.');
        return;
      }

      const newPrice = marketData.price;
      const change = marketData.change || 0;
      const changePercent = marketData.changePercent || 0;

      // 🔥 LOG FORÇADO (não depende de DEBUG)
      console.log(`[🎯 CHARTVIEW] 🚨🚨🚨 CALLBACK EXECUTADO!`, {
        timestamp: new Date().toISOString(),
        symbol: selectedSymbol,
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
        '📥 RECEBIDO do RealMarketDataService': {
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
        '🔗 Comparar com': `https://api.binance.com/api/v3/ticker/24hr?symbol=${selectedSymbol.replace('USD', 'USDT')}`
      });
      
      // 🚀 Atualizar último candle do gráfico em tempo real COM DEBOUNCE
      // Debounce evita sobrecarregar o gráfico com muitas atualizações/segundo
      // 🛡️ isInitialLoadRef: enquanto o histórico do símbolo/timeframe atual ainda não
      // carregou, nunca aplicar tick no gráfico — updateData num gráfico vazio cria um
      // candle órfão gigante (o "bug que depois volta ao normal").
      if (chartInstanceRef.current && chartDataRef.current.length > 0 && !isInitialLoadRef.current) {
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
          chartDataRef.current = updatedData;

          // 🔥 DEBOUNCE: Agrupar atualizações para não sobrecarregar o gráfico
          // Se há uma atualização pendente, cancelar e agendar a nova
          if (chartUpdateTimeoutRef.current) {
            clearTimeout(chartUpdateTimeoutRef.current);
          }

          chartUpdateTimeoutRef.current = setTimeout(() => {
            try {
              // Usar updateData ao invés de applyNewData para preservar scroll
              chart.updateData(updatedCandle);
              console.log('[ChartView] 🔄 Candle atualizado (debounced - mantém scroll do usuário)');
            } catch (err) {
              console.error('[ChartView] ❌ ERROR updateData:', err);
            }
            chartUpdateTimeoutRef.current = null;
          }, 100); // Agrupa atualizações a cada 100ms
        } catch (err) {
          console.error('[ChartView] ❌ ERROR ao processar candle:', err);
        }
      }
    }, 2000);

    // Cleanup ao desmontar
    return () => {
      console.log(`[ChartView] 🔌 Desconectando polling: ${selectedSymbol}`);
      unsubscribe();
      if (chartUpdateTimeoutRef.current) {
        clearTimeout(chartUpdateTimeoutRef.current);
        chartUpdateTimeoutRef.current = null;
      }
    };
  }, [selectedSymbol]);

  // 🎯 SMOOTH ANIMATION: Animar preço com transição suave via requestAnimationFrame
  useEffect(() => {
    let animationFrameId: number | null = null;
    let animationStartTime = Date.now();
    const animationDuration = 300; // 300ms para transição suave
    const startPrice = displayedPrice;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - animationStartTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Interpolação linear: startPrice → currentPrice
      const interpolatedPrice = startPrice + (currentPrice - startPrice) * progress;
      setDisplayedPrice(interpolatedPrice);

      if (progress < 1) {
        // Continuar animando
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    // Iniciar animação quando currentPrice mudar
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
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
      <div
        ref={chartRootRef}
        className={`bg-black flex relative ${isMaximized ? 'fixed inset-0 z-[200] h-screen w-screen' : 'h-full w-full'}`}
      >
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
              {['Todos', 'Crypto', 'Forex', 'Stocks US', 'Stocks BR', 'Stocks UK', 'Stocks EU', 'Índices', 'Commodities'].map((category) => (
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
                    formatBrazilianPrice(displayedPrice, getPrecisionForSymbol(selectedSymbol, displayedPrice))
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
                    {/* ✅ 2026-07-20: NÃO usar formatBrazilianPrice/padIntegerPart aqui —
                        essa regra de "4 dígitos antes do ponto" foi pensada só pro preço
                        PRINCIPAL (fazer o número "parecer vivo"), aplicada por engano
                        também no valor de VARIAÇÃO (delta), que é naturalmente pequeno
                        (ex: 0.00246) — resultava em "-0000.00246", ilegível. */}
                    {isPositive ? '+' : '-'}{Math.abs(dailyChange).toFixed(getPrecisionForSymbol(selectedSymbol, displayedPrice ?? Math.abs(dailyChange)))}
                  </div>
                  <div className={`text-sm font-medium ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isPositive ? '+' : '-'}{Math.abs(dailyChangePercent || 0).toFixed(2)}% hoje
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

          {/* 🆕 Maximizar/Restaurar — canto direito do topo do gráfico (era um botão
              flutuante na borda da janela; movido pra dentro da barra de timeframes
              a pedido do Cleber, pra ficar sempre visível junto dos outros controles). */}
          <button
            onClick={toggleMaximize}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all bg-black text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700"
            title={isMaximized ? 'Sair da tela cheia (Esc)' : 'Maximizar em tela cheia'}
          >
            {isMaximized ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
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
              // 🔧 FIX: Medir e Zoom eram decorativos (este callback era só console.log)
              if (tool === 'measure') {
                handleDrawingToolSelect('measure');
              } else if (tool === 'zoom') {
                try {
                  chartInstanceRef.current?.zoomAtCoordinate(1.25, undefined, 200);
                } catch (e) {
                  console.warn('[ChartView] ⚠️ Zoom falhou:', e);
                }
              }
            }}
            onSubToolSelect={handleDrawingToolSelect}
            onCrosshairModeChange={handleCrosshairModeChange}
            onDataWindowToggle={handleDataWindowToggle}
            onDeleteAll={handleDeleteAllDrawings}
            onLockToggle={handleToggleLockDrawings}
            onHideToggle={handleToggleHideDrawings}
            onEmojiSelect={handleEmojiSelect}
            className="shrink-0"
          />

          {/* ✅ Wrapper NOVO, dedicado só ao chart+overlays React — a klinecharts manipula o
              DOM de dentro de #chartIdRef diretamente (fora do controle do React). Overlays
              React que entram/saem condicionalmente (como os chips de indicador abaixo) NÃO
              podem ser filhos desse mesmo div: React perde a referência de onde inserir/mover
              nós quando a klinecharts já reordenou os filhos por fora, gerando
              "NotFoundError: insertBefore ... not a child of this node" — que derruba a
              árvore inteira via ErrorBoundary (era a causa real do "pisca e reinicia" ao
              adicionar indicador). Os chips agora são um IRMÃO do container da klinecharts,
              nunca um filho dele. */}
          <div className="flex-1 relative">
            {/* Chart Container */}
            <div
              ref={chartContainerRef}
              id={chartIdRef.current}
              className="w-full h-full bg-black relative"
              style={{
                minHeight: '600px',
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

            {/* 📝 INPUT DE TEXTO DA LINHA COM INFORMAÇÕES — abre ao clicar numa infoLine */}
            {infoLineEditor && (
              <div
                className="absolute z-[80]"
                style={{ left: infoLineEditor.x, top: infoLineEditor.y }}
              >
                <input
                  ref={infoLineInputRef}
                  type="text"
                  value={infoLineText}
                  onChange={(e) => {
                    setInfoLineText(e.target.value);
                    infoLineTextRef.current = e.target.value;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // 🔧 FIX: Enter só fechava o editor (blur do input dispara em seguida) —
                      // sem marcar "já resolvido", o onBlur rodava de novo e sobrescrevia com
                      // uma extendData vazia (React ainda não tinha comitado o setInfoLineText('')
                      // do fechamento anterior), apagando o texto que acabou de ser salvo.
                      infoLineCancelledRef.current = true;
                      try {
                        chartInstanceRef.current?.overrideOverlay({
                          id: infoLineEditor.overlayId,
                          extendData: infoLineText
                        });
                        toast.success('Informação salva na linha');
                      } catch (err) {
                        console.error('[ChartView] ❌ Error saving info-line text:', err);
                        toast.error('Erro ao salvar informação');
                      }
                      setInfoLineEditor(null);
                      setInfoLineText('');
                    } else if (e.key === 'Escape') {
                      infoLineCancelledRef.current = true;
                      setInfoLineEditor(null);
                      setInfoLineText('');
                    }
                  }}
                  onBlur={() => {
                    // 🔧 FIX: antes o onBlur (clicar fora do input) SEMPRE descartava sem
                    // salvar — era isso que fazia o texto digitado sumir da linha. Agora,
                    // clicar fora salva o texto (mesmo comportamento de "confirmar ao sair
                    // do campo"); só Enter/Escape (que já tratam o save/cancelamento antes)
                    // pulam esse salvamento duplicado via infoLineCancelledRef.
                    if (infoLineCancelledRef.current) {
                      infoLineCancelledRef.current = false;
                      return;
                    }
                    try {
                      chartInstanceRef.current?.overrideOverlay({
                        id: infoLineEditor.overlayId,
                        extendData: infoLineText
                      });
                    } catch (err) {
                      console.error('[ChartView] ❌ Error saving info-line text on blur:', err);
                    }
                    setInfoLineEditor(null);
                    setInfoLineText('');
                  }}
                  autoFocus
                  placeholder="Digite a informação..."
                  className="px-2 py-1 rounded bg-gray-900 border border-blue-500 text-white text-xs outline-none min-w-[180px]"
                />
              </div>
            )}

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

            {/* ✅ Excluir indicador DIRETO no gráfico — chips reais em HTML (não depende do
                clique no ícone desenhado no canvas pela klinecharts, que tem hit-testing
                próprio e não é confiável nesse setup). Sempre visível, sempre clicável.
                IRMÃO do container da klinecharts (não filho) — ver comentário na abertura
                do wrapper acima explicando o bug de insertBefore que isso corrige. */}
            {activeIndicators.size > 0 && (
              <div className="absolute top-2 left-2 z-[55] flex flex-col gap-1 pointer-events-none">
                {INDICATORS.filter(ind => activeIndicators.has(ind.id)).map(indicator => (
                  <div
                    key={indicator.id}
                    className="pointer-events-auto flex items-center gap-1.5 bg-black/75 backdrop-blur-sm border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 shadow-lg"
                  >
                    <span className="font-medium">{indicator.name.split(' - ')[0]}</span>
                    {(indicator.defaultParams?.length ?? 0) > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          isMovingAverageIndicator(indicator) ? openMAEditor(indicator) : openIndicatorEditor(indicator);
                        }}
                        title="Editar parâmetros"
                        className="text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded p-0.5 transition-colors"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleIndicator(indicator);
                      }}
                      title="Remover indicador"
                      className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 🆕 Popover de edição de parâmetros do indicador (engrenagem do chip ou
                menu de botão direito) */}
            {indicatorEditor && (
              <div
                className="absolute top-10 left-2 z-[56] bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl p-3 w-56"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs font-semibold text-white mb-2">
                  {indicatorEditor.indicator.name.split(' - ')[0]} — Parâmetros
                </div>
                <div className="space-y-2">
                  {indicatorEditor.values.map((value, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-400 w-16 shrink-0">Período {idx + 1}</label>
                      <input
                        type="number"
                        min={1}
                        value={value}
                        onChange={(e) => {
                          const newValues = [...indicatorEditor.values];
                          newValues[idx] = e.target.value;
                          setIndicatorEditor({ ...indicatorEditor, values: newValues });
                        }}
                        className="flex-1 bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={saveIndicatorEditor}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setIndicatorEditor(null)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* 🆕 Popover completo de médias móveis (MA/EMA/SMA/WMA) — mesmos campos do
                diálogo "Moving Average" do MT5: Período, Deslocar, Método, Aplicar a,
                Estilo (cor/traço/espessura). */}
            {maEditor && (
              <div
                className="absolute top-10 left-2 z-[56] bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl p-3 w-72"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs font-semibold text-white mb-3">
                  {maEditor.indicator.name.split(' - ')[0]} — Parâmetros
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Período</label>
                    <input
                      type="number"
                      min={1}
                      value={maEditor.settings.period}
                      onChange={(e) => setMaEditor({ ...maEditor, settings: { ...maEditor.settings, period: Number(e.target.value) } })}
                      className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Deslocar</label>
                    <input
                      type="number"
                      value={maEditor.settings.shift}
                      onChange={(e) => setMaEditor({ ...maEditor, settings: { ...maEditor.settings, shift: Number(e.target.value) } })}
                      className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-[11px] text-gray-400 block mb-1">Método</label>
                  <select
                    value={maEditor.settings.method}
                    onChange={(e) => setMaEditor({ ...maEditor, settings: { ...maEditor.settings, method: e.target.value as MAMethod } })}
                    className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="SIMPLE">Simples</option>
                    <option value="EXPONENTIAL">Exponencial</option>
                    <option value="SMOOTHED">Suavizada</option>
                    <option value="LINEAR_WEIGHTED">Ponderada Linear</option>
                  </select>
                </div>
                <div className="mt-2">
                  <label className="text-[11px] text-gray-400 block mb-1">Aplicar a</label>
                  <select
                    value={maEditor.settings.appliedPrice}
                    onChange={(e) => setMaEditor({ ...maEditor, settings: { ...maEditor.settings, appliedPrice: e.target.value as AppliedPrice } })}
                    className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="CLOSE">Fechamento</option>
                    <option value="OPEN">Abertura</option>
                    <option value="HIGH">Máxima</option>
                    <option value="LOW">Mínima</option>
                    <option value="MEDIAN">Mediana (A+B)/2</option>
                    <option value="TYPICAL">Típico (A+B+F)/3</option>
                    <option value="WEIGHTED">Ponderado (A+B+2F)/4</option>
                  </select>
                </div>
                <div className="mt-2">
                  <label className="text-[11px] text-gray-400 block mb-1">Estilo</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={maEditor.settings.color}
                      onChange={(e) => setMaEditor({ ...maEditor, settings: { ...maEditor.settings, color: e.target.value } })}
                      className="w-8 h-7 bg-black border border-gray-700 rounded cursor-pointer"
                      title="Cor da linha"
                    />
                    <select
                      value={maEditor.settings.lineStyle}
                      onChange={(e) => setMaEditor({ ...maEditor, settings: { ...maEditor.settings, lineStyle: e.target.value as 'solid' | 'dashed' } })}
                      className="flex-1 bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="solid">Sólida</option>
                      <option value="dashed">Tracejada</option>
                    </select>
                    <select
                      value={maEditor.settings.lineWidth}
                      onChange={(e) => setMaEditor({ ...maEditor, settings: { ...maEditor.settings, lineWidth: Number(e.target.value) } })}
                      className="w-16 bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value={1}>1px</option>
                      <option value={2}>2px</option>
                      <option value={3}>3px</option>
                      <option value={4}>4px</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={saveMAEditor}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setMaEditor(null)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Indicators Modal — centralizado na tela, maior que a antiga sidebar de 320px */}
        {showIndicators && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-6"
          onClick={() => setShowIndicators(false)}
        >
          <div
            className="w-full max-w-3xl h-[80vh] max-h-[820px] bg-[#0a0a0a] border border-gray-800 rounded-xl flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-800 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Indicadores Técnicos</h3>
                <p className="text-xs text-gray-500 mt-1">{filteredIndicators.length} indicadores disponíveis</p>
              </div>
              <button
                onClick={() => setShowIndicators(false)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
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
              <div className="p-3 grid grid-cols-2 gap-2">
              {filteredIndicators.map((indicator) => {
                const isActive = activeIndicators.has(indicator.id);
                const placement = getIndicatorPlacement(indicator);

                return (
                  <div
                    key={indicator.id}
                    className={`relative w-full flex flex-col gap-2 p-3 rounded-lg transition-all group ${
                      isActive
                        ? 'bg-blue-500/20 border border-blue-500/40'
                        : 'bg-gray-900 hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => toggleIndicator(indicator)}
                        className="flex-1 flex flex-col items-start text-left min-w-0"
                      >
                        <span className={`text-sm font-medium ${isActive ? 'text-blue-300' : 'text-white'}`}>
                          {indicator.name}
                        </span>
                        <span className="text-xs text-gray-500 truncate w-full">{indicator.description}</span>
                      </button>
                      {isActive && (
                        <button
                          onClick={() => toggleIndicator(indicator)}
                          title="Excluir indicador"
                          className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* 🆕 Onde desenhar: no gráfico principal (sobre o preço) ou em painel próprio abaixo */}
                    <div className="flex items-center gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => changeIndicatorPlacement(indicator, 'overlay')}
                        title="Desenhar em cima do gráfico de preço"
                        className={`px-2 py-1 rounded transition-colors ${
                          placement === 'overlay'
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                            : 'bg-black/40 text-gray-500 hover:text-gray-300 border border-gray-700'
                        }`}
                      >
                        No gráfico
                      </button>
                      <button
                        onClick={() => changeIndicatorPlacement(indicator, 'pane')}
                        title="Desenhar em painel próprio, embaixo do gráfico"
                        className={`px-2 py-1 rounded transition-colors ${
                          placement === 'pane'
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                            : 'bg-black/40 text-gray-500 hover:text-gray-300 border border-gray-700'
                        }`}
                      >
                        Painel abaixo
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* No results */}
              {filteredIndicators.length === 0 && (
                <div className="col-span-2 text-center py-8">
                  <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Nenhum indicador encontrado</p>
                </div>
              )}
              </div>
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

          {/* Suporte/Resistência (toggle) */}
          <button
            onClick={() => {
              setShowSrOverlay(!showSrOverlay);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3"
          >
            <Target className="w-4 h-4 text-gray-400" />
            <span>Suporte/Resistência</span>
            {showSrOverlay && <span className="ml-auto text-green-400">✓</span>}
          </button>

          <div className="h-px bg-gray-700 my-2"></div>

          {/* Copiar preço */}
          <button 
            onClick={() => {
              if (currentPrice !== null) {
                navigator.clipboard.writeText(currentPrice.toFixed(2));
                toast.success('Preço copiado para área de transferência');
                setContextMenu(null);
              }
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors"
            disabled={currentPrice === null}
          >
            Copiar preço {currentPrice !== null ? currentPrice.toFixed(2) : '...'}
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
            <span>Adicionar alerta a {selectedSymbol} em {currentPrice !== null ? currentPrice.toFixed(2) : '...'}...</span>
            <span className="ml-auto text-xs text-gray-500">⌘ A</span>
          </button>
          
          {/* Comprar limite */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3" disabled={currentPrice === null}>
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span>Comprar 1 {selectedSymbol} @ {currentPrice !== null ? currentPrice.toFixed(2) : '...'} limite</span>
            <span className="ml-auto text-xs text-gray-500">⌘ ⇧ B</span>
          </button>
          
          {/* Vender stop */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3" disabled={currentPrice === null}>
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span>Vender 1 {selectedSymbol} @ {currentPrice !== null ? currentPrice.toFixed(2) : '...'} stop</span>
          </button>
          
          {/* Adicionar ordem */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3" disabled={currentPrice === null}>
            <Activity className="w-4 h-4 text-gray-400" />
            <span>Adicionar ordem em {selectedSymbol} a {currentPrice !== null ? currentPrice.toFixed(2) : '...'}...</span>
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
          
          {/* 🆕 Indicadores ativos — Editar parâmetros / Remover, individualmente */}
          {activeIndicators.size > 0 && (
            <>
              <div className="px-4 py-1 text-[11px] uppercase tracking-wide text-gray-500">Indicadores ativos</div>
              {INDICATORS.filter(ind => activeIndicators.has(ind.id)).map(indicator => (
                <div key={indicator.id} className="w-full px-4 py-1.5 flex items-center justify-between text-sm text-white">
                  <span className="truncate">{indicator.name.split(' - ')[0]}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {(indicator.defaultParams?.length ?? 0) > 0 && (
                      <button
                        onClick={() => {
                          isMovingAverageIndicator(indicator) ? openMAEditor(indicator) : openIndicatorEditor(indicator);
                          setContextMenu(null);
                        }}
                        title="Editar parâmetros"
                        className="text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded p-1 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        toggleIndicator(indicator);
                        setContextMenu(null);
                      }}
                      title="Remover indicador"
                      className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded p-1 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
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
                Remover todos ({activeIndicators.size})
              </button>
            </>
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

      {/* 🎬 BACKTEST / REPLAY BAR - Barra de controle no rodapé (cobre o catálogo inteiro de ativos) */}
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

      {/* ⚙️ BACKTEST CONFIG MODAL - Configuração de backtest real */}
      <BacktestConfigModal
        isOpen={showBacktestConfig}
        onClose={() => setShowBacktestConfig(false)}
        strategies={strategies}
        onStart={(config) => {
          const strategy = strategies.find(s => s.id === config.strategyId);
          if (!strategy) {
            toast.error('Selecione uma estratégia (pronta ou customizada) antes de iniciar o backtest.');
            return;
          }

          console.log('[ChartView] 🚀 Iniciando backtest real:', { config, strategy: strategy.name });
          setShowBacktestConfig(false);
          toast.success(`Backtest "${strategy.name}" iniciado — buscando dados históricos reais...`);

          const resolvedTimeframe = (config.timeframe === '30m' ? '15m' : config.timeframe) as any; // 30m não existe em BacktestDataService; cai pro timeframe real mais próximo suportado
          setLastBacktestRun({ strategy, timeframe: resolvedTimeframe, symbol: config.asset });
          backtestProgress.start({
            strategy,
            symbol: config.asset,
            startDate: new Date(config.startDate),
            endDate: new Date(config.endDate),
            timeframe: resolvedTimeframe,
            tradeDirection: config.tradeDirection,
            initialCapital: 10000,
          });
        }}
        onCreateStrategy={() => {
          setShowBacktestConfig(false);
          setShowStrategyBuilder(true);
        }}
        onDeleteStrategy={async (id) => {
          const ok = await deleteStrategy(id);
          if (ok) {
            toast.success('Estratégia apagada.');
          } else {
            toast.error('Não foi possível apagar a estratégia (faça login e tente de novo).');
          }
        }}
      />

      {backtestProgress.error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-red-950/95 border border-red-600 text-red-200 px-4 py-3 rounded-lg shadow-xl max-w-md text-sm">
          ⚠️ {backtestProgress.error}
        </div>
      )}

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

      {/* 🏁 BACKTEST RESULTS - Tela de resultado final, some antes disso não existia nenhuma */}
      <BacktestResultsModal
        isOpen={backtestProgress.isCompleted}
        onClose={backtestProgress.dismissResults}
        strategyName={lastBacktestRun?.strategy.name || 'Estratégia'}
        symbol={lastBacktestRun?.symbol || ''}
        timeframe={lastBacktestRun?.timeframe || ''}
        metrics={backtestProgress.metrics}
        trades={backtestProgress.allTrades}
        equityCurve={backtestProgress.equityCurve}
        onShowDecisions={() => setShowDecisionsPanel(true)}
        onRunAnother={() => {
          backtestProgress.dismissResults();
          setShowBacktestConfig(true);
        }}
      />

      {/* 🧠 STRATEGY BUILDER - Construtor de estratégias */}
      <StrategyBuilderPro
        isOpen={showStrategyBuilder}
        onClose={() => {
          // Voltar pra tela de estratégias salvas, não pro gráfico por baixo.
          setShowStrategyBuilder(false);
          setShowBacktestConfig(true);
        }}
        onSave={async (strategy) => {
          const unified: StrategyDef = {
            id: `draft-${strategy.id}`,
            name: strategy.name,
            description: strategy.description || '',
            isPreset: false,
            entryBlocks: strategy.entryBlocks as any,
            exitBlocks: strategy.exitBlocks as any,
            filterBlocks: strategy.filterBlocks as any,
            direction: 'AUTO',
            stopLoss: strategy.stopLoss,
            takeProfit: strategy.takeProfit,
            trailingStop: strategy.trailingStop,
            riskProfile: 'MODERATE',
            positionSizePercent: 2,
            timeframe: (strategy.timeframe as any) || '15m',
            maxConcurrentTrades: strategy.maxConcurrentTrades,
          };

          const saved = await saveStrategy(unified);
          if (saved) {
            // Só volta pra tela de estratégias salvas quando o salvamento deu certo de verdade —
            // se falhar, o usuário fica no builder pra não perder o que desenhou.
            setShowStrategyBuilder(false);
            setShowBacktestConfig(true);
            toast.success(`Estratégia "${strategy.name}" salva — já disponível no Backtest e na IA.`);
          } else {
            toast.error(
              strategiesError
                ? `Não foi possível salvar a estratégia: ${strategiesError}`
                : 'Não foi possível salvar a estratégia (faça login e tente de novo).'
            );
          }
        }}
      />

      {/* 📋 BACKTEST DECISIONS PANEL - Histórico de decisões da IA */}
      <BacktestErrorBoundary>
        <BacktestDecisionsPanel
          isOpen={showDecisionsPanel}
          onClose={() => setShowDecisionsPanel(false)}
          decisions={(backtestProgress.isCompleted ? backtestProgress.allTrades : backtestProgress.recentTrades).map(trade => ({
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
          verificationContext={lastBacktestRun}
        />
      </BacktestErrorBoundary>

    </div>
    </>
  );
}