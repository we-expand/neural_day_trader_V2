import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { init, dispose, getSupportedOverlays, registerOverlay, registerYAxis, registerXAxis, registerIndicator, getSupportedIndicators, OverlayMode } from 'klinecharts';
import type { KLineData, OverlayTemplate, AxisTemplate, AxisTick } from 'klinecharts';

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

// 🆕 `registeredName` é o nome único que a klinecharts usa pra identificar a instância
// (chave de `IndicatorStore.addInstance`/`removeInstance`/`overrideIndicator`, sempre
// por `ins.name === name` dentro do MESMO painel -- ver node_modules/klinecharts/dist/
// index.esm.js:4181). `displayName` é só o texto mostrado na legenda ("MA(20): ").
// Registrar VARIANTES do mesmo motor sob nomes diferentes (MA, MA__2, MA__3...) é o que
// permite ter N instâncias de MA de verdade sobrepostas no MESMO painel de preço, cada
// uma com sua própria linha na legenda (e seu próprio ⚙/✕) -- sem isso só dava pra ter
// UMA instância por painel, e "N cliques = N médias" virava "N cliques = N linhas
// dentro da MESMA instância", sem gear individual por média (achado do Cleber: as
// médias apareciam no gráfico mas só existia uma engrenagem pra todas juntas).
const registerMovingAverageIndicator = (registeredName: string, displayName: string, defaultMethod: MAMethod) => {
  registerIndicator<number>({
    name: registeredName,
    shortName: displayName,
    series: 'price' as any,
    precision: 2,
    calcParams: [20],
    shouldOhlc: true,
    // 🆕 calcParams agora é uma LISTA de períodos (ex: [20, 50, 200]) -- cada um vira
    // uma linha própria, chave `ma{i}`. `figures` estático não dá conta de um número
    // variável de linhas; `regenerateFigures` é o mecanismo que a própria klinecharts
    // usa pra indicadores desse tipo (MACD/BOLL), chamado toda vez que calcParams muda.
    figures: [{ key: 'ma0', title: `${displayName}: `, type: 'line' }],
    regenerateFigures: (calcParams: any[]) => {
      const periods = (calcParams as number[]).length > 0 ? (calcParams as number[]) : [20];
      return periods.map((period, i) => ({ key: `ma${i}`, title: `${displayName}(${period}): `, type: 'line' }));
    },
    calc: (dataList, indicator) => {
      const periods = ((indicator.calcParams as number[]).length > 0 ? (indicator.calcParams as number[]) : [20]);
      const ext: Partial<MAExtendData> = (indicator.extendData as MAExtendData) || {};
      const method = ext.method ?? defaultMethod;
      const appliedPrice = ext.appliedPrice ?? 'CLOSE';
      const shift = ext.shift ?? 0;
      const values = dataList.map(bar => getAppliedPriceValue(bar, appliedPrice));
      // Deslocar (shift): positivo empurra a linha pra frente no tempo (mostra o valor
      // calculado N barras atrás na posição atual), negativo puxa pra trás -- mesmo
      // comportamento do campo "Deslocar" no MT5. Mesmo shift vale pras N linhas.
      const perPeriodValues = periods.map(period => computeMovingAverageSeries(values, period, method));
      return dataList.map((_, i) => {
        const srcIndex = i - shift;
        const point: Record<string, number | undefined> = {};
        perPeriodValues.forEach((maValues, lineIndex) => {
          point[`ma${lineIndex}`] = srcIndex >= 0 && srcIndex < maValues.length ? maValues[srcIndex] : undefined;
        });
        return point as any;
      });
    }
  });
};

// Nº máximo de instâncias simultâneas do mesmo tipo de média que dá pra empilhar no
// gráfico clicando repetido no card -- cada uma precisa de um `name` registrado próprio
// (ver comentário acima), então o teto é o nº de variantes registradas abaixo.
export const MA_MAX_INSTANCES = 6;
// registeredName -> { baseName, variantIndex } pra `isMovingAverageIndicator`/lookups
// conseguirem reconhecer tanto o nome base ('MA') quanto as variantes ('MA__2') como
// médias móveis de verdade.
const MA_VARIANT_KLINECHARTS_NAME = (baseKlinechartsName: string, variantIndex: number): string =>
  variantIndex === 0 ? baseKlinechartsName : `${baseKlinechartsName}__${variantIndex + 1}`;

// 🆕 Indicadores customizados reais (WMA/ATR/Donchian/Pivot Points não existem nos
// built-ins do klinecharts — antes o app tentava criá-los mesmo assim, o que falhava
// silenciosamente (createIndicator loga um warning e retorna null, sem desenhar nada),
// deixando o toggle marcado como "ativo" na UI sem nenhum efeito real no gráfico.
(
  [
    ['MA', 'SIMPLE'],
    ['SMA', 'SIMPLE'],
    ['EMA', 'EXPONENTIAL'],
    ['WMA', 'LINEAR_WEIGHTED']
  ] as Array<[string, MAMethod]>
).forEach(([baseName, method]) => {
  for (let variantIndex = 0; variantIndex < MA_MAX_INSTANCES; variantIndex++) {
    registerMovingAverageIndicator(MA_VARIANT_KLINECHARTS_NAME(baseName, variantIndex), baseName, method);
  }
});

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

// Estocástico Lento (Slow Stochastic) — não existe built-in no klinecharts, só
// KDJ (var. chinesa: RSV suavizado por recursão exponencial tipo Wilder, com
// uma 3ª linha J). São visualmente parecidos mas numericamente diferentes —
// Estocástico Lento clássico é: %K rápido (RSV) suavizado por MÉDIA MÓVEL
// SIMPLES de `smoothK` períodos (isso É o "%K lento"), %D = SMA de `smoothD`
// períodos sobre esse %K lento. Padrão 14/3/3, igual MT5/TradingView.
if (!isIndicatorRegistered('STOCH_SLOW')) {
  registerIndicator<number>({
    name: 'STOCH_SLOW',
    shortName: 'STOCH LENTO',
    series: 'normal' as any,
    precision: 2,
    calcParams: [14, 3, 3],
    shouldOhlc: false,
    // 🔧 FIX: sem range fixo o painel auto-escalava pro range real de %K/%D no
    // recorte visível (podendo mostrar algo como "10 a 70"), em vez da escala
    // padrão 0-100 com sobrecompra/sobrevenda em 80/20 (padrão MT5/TradingView).
    minValue: 0,
    maxValue: 100,
    figures: [
      { key: 'k', title: '%K: ', type: 'line' },
      { key: 'd', title: '%D: ', type: 'line' },
      {
        key: 'upper',
        title: '',
        type: 'line',
        styles: (_data, _indicator, defaultStyles) => ({
          ...(defaultStyles as any).lines?.[0],
          color: '#888888',
          style: 'dashed' as any,
          size: 1
        })
      },
      {
        key: 'lower',
        title: '',
        type: 'line',
        styles: (_data, _indicator, defaultStyles) => ({
          ...(defaultStyles as any).lines?.[0],
          color: '#888888',
          style: 'dashed' as any,
          size: 1
        })
      }
    ],
    calc: (dataList, indicator) => {
      const [period, smoothK, smoothD] = indicator.calcParams as number[];
      const fastK: Array<number | undefined> = dataList.map((_, i) => {
        if (i < period - 1) return undefined;
        const window = dataList.slice(i - period + 1, i + 1);
        const highestHigh = Math.max(...window.map(d => d.high));
        const lowestLow = Math.min(...window.map(d => d.low));
        const range = highestHigh - lowestLow;
        return range === 0 ? 50 : ((dataList[i].close - lowestLow) / range) * 100;
      });
      const sma = (values: Array<number | undefined>, smaPeriod: number): Array<number | undefined> => {
        return values.map((_, i) => {
          if (i < smaPeriod - 1) return undefined;
          const window = values.slice(i - smaPeriod + 1, i + 1);
          if (window.some(v => v === undefined)) return undefined;
          return (window as number[]).reduce((a, b) => a + b, 0) / smaPeriod;
        });
      };
      const slowK = sma(fastK, smoothK);
      const slowD = sma(slowK, smoothD);
      // Linhas de referência fixas de sobrecompra (80) e sobrevenda (20) —
      // padrão do Estocástico clássico, não 70/10.
      return dataList.map((_, i) => ({ k: slowK[i], d: slowD[i], upper: 80, lower: 20 } as any));
    }
  });
}

// Contador de Candles — indicador custom que escreve o número de cada vela LOGO ACIMA
// dela, sobre o próprio gráfico de preço -- não é uma linha/barra num painel separado, é
// texto por cima de cada candle. Contagem na ordem cronológica (1 = vela mais antiga da
// abertura do dia, crescendo até a vela atual) -- pedido explícito do Cleber, direção
// oposta da 1ª versão (que contava a partir da mais recente pra trás).
// 🐛 FIX: a contagem por índice global (`i + 1` sobre o `kLineDataList` inteiro) não
// reiniciava ao virar o dia -- BTCUSD (e qualquer ativo) começando um novo dia de
// candles continuava contando a partir do total acumulado do histórico carregado, nunca
// voltando pra 1. Contagem agora reseta a cada mudança de dia de calendário (comparando
// `new Date(bar.timestamp).toDateString()` entre velas consecutivas) -- calculado uma vez
// em `calc()` (só roda quando os dados mudam) e guardado em `indicator.result`, lido
// depois dentro de `draw()` (que roda todo frame) em vez de recalcular ali.
// 🐛 2 tentativas anteriores falharam por limitações reais da klinecharts (não bug de
// digitação):
// 1ª) figure `type: 'bar'/'line'` sem `attrs()` -- nunca desenhava nada (indicador
//     ativo, sem erro, mas invisível).
// 2ª) figure `type: 'text'` COM `attrs()` -- ainda invisível. Causa raiz: o motor padrão
//     de desenho de figura de indicador (`eachFigures` em index.esm.js:962) só sabe
//     posicionar 'circle'/'bar'/'line' (switch sem case pra 'text' → `defaultFigureStyles`
//     fica undefined → `attrs()`/`styles()` NUNCA são chamados, confirmado com log que
//     nunca disparou). 'text' não é um tipo de figura suportado no caminho de desenho
//     automático de indicador, só em overlays.
// ✅ Fix: usar o callback `draw` do indicador (IndicatorImp.draw, chamado em
// IndicatorView.drawImp, index.esm.js:7894) -- dá acesso direto ao `ctx` do canvas e ao
// `xAxis`/`yAxis` já resolvidos, sem depender do sistema de `figures`. Desenhamos o
// número de cada vela manualmente com `ctx.fillText`, só nas velas do `visibleRange`
// (evita desenhar fora da tela). Retornar `true` sinaliza "já cobri o desenho, não
// precisa rodar o caminho padrão de figures" (que de qualquer forma é vazio aqui).
if (!isIndicatorRegistered('CANDLE_COUNTER')) {
  registerIndicator<number>({
    name: 'CANDLE_COUNTER',
    shortName: 'CANDLES',
    series: 'price' as any,
    precision: 0,
    calcParams: [],
    shouldOhlc: false,
    figures: [],
    calc: (dataList) => {
      let dayKey: string | null = null;
      let count = 0;
      return dataList.map((bar) => {
        const key = new Date(bar.timestamp).toDateString();
        if (key !== dayKey) {
          dayKey = key;
          count = 0;
        }
        count += 1;
        return { label: count } as any;
      });
    },
    draw: (ctx: any) => {
      const { ctx: canvas, kLineDataList, indicator, visibleRange, xAxis, yAxis } = ctx;
      const { from, to } = visibleRange;
      const result = indicator?.result ?? [];
      canvas.save();
      canvas.fillStyle = '#f59e0b';
      canvas.font = 'bold 10px sans-serif';
      canvas.textAlign = 'center';
      canvas.textBaseline = 'bottom';
      for (let i = from; i < to; i++) {
        const bar = kLineDataList[i];
        if (!bar) continue;
        const label = result[i]?.label;
        if (typeof label !== 'number') continue;
        const x = xAxis.convertToPixel(i);
        const y = yAxis.convertToPixel(bar.high) - 6;
        canvas.fillText(String(label), x, y);
      }
      canvas.restore();
      return true;
    }
  } as any);
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
  ChevronUp,
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
  Minimize,
  Grid3x3,
  Star
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
import { useFavoriteChartSetup, readCachedFavoriteChartSetup } from '@/app/hooks/useFavoriteChartSetup';
import { useChartSessionState, readCachedChartSessionState } from '@/app/hooks/useChartSessionState';
import { useChartTemplates, type ChartTemplateConfig } from '@/app/hooks/useChartTemplates';
import { useAuth } from '@/app/contexts/AuthContext';
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
import { analyzeSmc, type SmcZone, type Candle } from '@/app/services/smc';
import { OrderTicket } from '@/app/components/trading/OrderTicket';
import type { TradeVisual, PendingOrderVisual } from '@/app/hooks/useApexLogic';

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

// 🎯 CUSTOM OVERLAY: linha de posição (entrada/SL/TP/pendente) com etiqueta
// no CORPO do gráfico, não no eixo Y. O overlay nativo 'horizontalStraightLine'
// não desenha nenhuma figura de texto (só a linha) — o campo `text` passado
// pra ele era descartado silenciosamente. 'simpleTag' desenha texto, mas só
// dentro da faixa estreita do eixo de preço, truncando qualquer rótulo longo
// (ex: "SL 2440.00 · −$24.68 · 26.14 pts"). Este overlay usa a largura cheia
// do painel pra caber o rótulo completo.
const PositionLabelLineOverlay: OverlayTemplate = {
  name: 'positionLabelLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding, overlay }: any) => {
    const y = coordinates[0].y;
    const label = typeof overlay.extendData === 'function' ? overlay.extendData(overlay) : (overlay.extendData ?? '');
    return [
      { type: 'line', attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] } },
      {
        type: 'text',
        ignoreEvent: true,
        // Alinhado à esquerda, com respiro depois da barra de ferramentas de
        // desenho (que fica sobreposta na borda esquerda do canvas).
        attrs: { x: 56, y: y - 4, text: label, align: 'left', baseline: 'bottom' },
      },
    ];
  },
};

try {
  registerOverlay(PositionLabelLineOverlay);
} catch (e) {
  console.warn('[ChartView] ⚠️ Overlay de linha de posição já registrado ou erro:', e);
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
    const rect = {
      type: 'rect',
      attrs: {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y)
      },
      styles: { style: 'stroke_fill', color, borderColor, borderSize: 1 }
    };
    // 🆕 2026-08-24: rótulo opcional (usado pelas zonas de Order Block do
    // S/R do gráfico, ver renderSrOverlays) — string livre em extendData,
    // desenhada no canto superior-esquerdo da caixa. Retrocompatível: sem
    // extendData (uso normal como ferramenta de desenho manual), comportamento
    // idêntico ao original (só o retângulo).
    if (typeof overlay.extendData === 'string' && overlay.extendData) {
      return [
        rect,
        {
          type: 'text',
          attrs: { x: Math.min(a.x, b.x) + 4, y: Math.min(a.y, b.y) + 2, align: 'left', baseline: 'top', text: overlay.extendData },
          styles: { color: '#ffffff', size: 10, backgroundColor: borderColor, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }
        }
      ];
    }
    return rect;
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

// 📝 Anotação de Texto real: overlay nativo de 1 ponto, ancorado a preço/tempo (não um
// <div> HTML em pixel fixo). Antes ('text'/'anchored-text') criava um card HTML solto
// (`chartTexts` state) posicionado em pixel cru da tela -- não acompanhava zoom/pan do
// candle (ficava "flutuando" no lugar errado assim que o gráfico rolava) e não tinha
// edição depois de criado (só apagar com duplo-clique e recriar do zero). Este overlay
// usa `dataIndex`/`value` como os demais desenhos -- se move com o candle certo, sobrevive
// a snapshot/restauração de timeframe (ver `userDrawingsSnapshotRef`) e é editável de novo
// clicando nele (mesmo padrão de clique-pra-editar do `InfoLineOverlay` acima).
const TextAnnotationOverlay: OverlayTemplate = {
  name: 'textAnnotation',
  totalStep: 2, // 🔧 totalStep = pontos + 1 (1 ponto -> 2)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }: any) => {
    if (coordinates.length < 1) return [];
    const { x, y } = coordinates[0];
    const text = typeof overlay.extendData === 'string' ? overlay.extendData : '';
    if (!text) {
      return [{
        type: 'text',
        ignoreEvent: true,
        attrs: { x, y: y - 4, align: 'left', baseline: 'bottom', text: 'clique para escrever' },
        styles: { color: 'rgba(148,163,184,0.7)', size: 10, backgroundColor: 'transparent' }
      }];
    }
    return [{
      type: 'text',
      attrs: { x, y: y - 4, align: 'left', baseline: 'bottom', text },
      styles: {
        color: '#ffffff', size: 13, backgroundColor: 'rgba(30,41,59,0.92)',
        paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4
      }
    }];
  }
};

const CUSTOM_DRAWING_OVERLAYS: OverlayTemplate[] = [
  InfoLineOverlay,
  TextAnnotationOverlay,
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
  | 'zoom_in'
  | 'zoom_out'
  | 'magnet'
  | 'lock'
  | 'hide'
  | 'remove';

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
    id: 'stoch_slow',
    name: 'Estocástico Lento (Slow Stochastic)',
    description: '%K suavizado por SMA + %D — diferente do KDJ acima (que usa suavização exponencial e tem uma 3ª linha J)',
    category: 'momentum',
    klinechartsName: 'STOCH_SLOW',
    defaultParams: [14, 3, 3],
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

  // ===== OUTROS =====
  {
    id: 'candle_counter',
    name: 'Contador de Candles',
    description: 'Numera as velas do dia atual, reinicia a cada novo dia',
    category: 'volume',
    klinechartsName: 'CANDLE_COUNTER',
    defaultParams: [],
    // 🆕 Sempre overlay (número escrito em cima do candle, no gráfico de preço) -- não
    // faz sentido num painel separado, já que o texto é posicionado via yAxis do preço
    // (ver attrs() no registerIndicator lá em cima). "Painel abaixo" continua clicável
    // na UI (todo indicador tem os 2 botões) mas não vai desenhar nada de útil ali.
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

export function ChartView({
  initialAction,
  onInitialActionConsumed,
}: {
  /** Abre uma tela específica já ao montar — usado pelo botão "Criar personalizada" da tela de IA. */
  initialAction?: 'open-strategy-builder';
  onInitialActionConsumed?: () => void;
} = {}) {
  // 🔥 NOVO: Sincronizar com contexto global
  const { selectedAsset, setSelectedAsset, activeOrders, pendingOrders, checkPendingOrderTriggers, cancelManualPendingOrder, updateManualPendingOrderPrice } = useTradingContext();
  const { user } = useAuth();

  // ❌ REMOVIDO: useMarketData() - agora usamos apenas os candles do gráfico

  const VALID_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '1D', '1W', '1M'];
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    // 🆕 Lido de forma SÍNCRONA (cache local) pra já nascer com o timeframe certo,
    // sem precisar de um 2º dispose()+init() do chart via setState assíncrono
    // depois do mount. Estado de sessão (sobrevive a trocar de seção do app,
    // ver useChartSessionState.ts) tem prioridade sobre o setup favorito --
    // é o que o usuário estava vendo há segundos, mais recente que o favorito.
    const sessionCached = readCachedChartSessionState(user?.id);
    const favoriteCached = readCachedFavoriteChartSetup(user?.id);
    const tf = (sessionCached?.timeframe ?? favoriteCached?.timeframe) as Timeframe | undefined;
    return tf && VALID_TIMEFRAMES.includes(tf) ? tf : '1H';
  });
  const [currentPrice, setCurrentPrice] = useState<number | null>(null); // 🔥 Null até carregar dados reais
  // Ref sempre atualizada — os handlers de arraste dos overlays de ordem
  // pendente são criados dentro de renderPositionOverlays (só reexecuta
  // quando activeOrders/pendingOrders/selectedSymbol mudam), então fechariam
  // sobre um currentPrice desatualizado se lessem o state direto.
  const currentPriceRef = useRef<number | null>(null);
  useEffect(() => {
    currentPriceRef.current = currentPrice;
  }, [currentPrice]);
  // 🐛 FIX 2026-09-02 (achado do Cleber: "linhas de posição às vezes aparecem
  // às vezes não", confirmado com print mostrando UKOUSD com posição real
  // aberta e sem nenhuma linha nem alerta na tela): o `fetchData`/setInterval
  // de refresh de dados (mais abaixo, dependências `[timeframe,
  // selectedSymbol]`) fecha sobre `activeOrders`/`pendingOrders` do render em
  // que foi criado e nunca é recriado quando essas mudam — só quando
  // timeframe/símbolo trocam. A cada tick desse interval,
  // `renderPositionOverlays` era chamado com esse `activeOrders` CONGELADO
  // (podia ser `[]` de antes de qualquer posição existir), apagando as linhas
  // desenhadas certas pelo outro efeito (reativo de verdade, mais abaixo) —
  // dependendo de qual dos dois rodou por último, a linha aparecia ou sumia.
  // Refs sempre atualizadas resolvem: o fetch periódico lê o valor real mais
  // recente em vez do congelado no fechamento.
  const activeOrdersRef = useRef<TradeVisual[]>(activeOrders);
  useEffect(() => {
    activeOrdersRef.current = activeOrders;
  }, [activeOrders]);
  const pendingOrdersRef = useRef<PendingOrderVisual[]>(pendingOrders);
  useEffect(() => {
    pendingOrdersRef.current = pendingOrders;
  }, [pendingOrders]);
  const [displayedPrice, setDisplayedPrice] = useState<number | null>(null); // Preço exibido (throttled para UI)
  // 🆕 Watchdog de preço "desatualizado" -- ver comentário completo no callback de
  // subscribeToSymbol mais abaixo. Sem isso, uma falha silenciosa no pipeline de preço
  // (conta MetaAPI compartilhada sob rate-limit, etc.) trava o preço/% na tela pra
  // sempre sem NENHUM sinal visual, e o usuário só descobre comparando com outra fonte.
  const lastPriceTickAtRef = useRef(Date.now());
  const [isPriceStale, setIsPriceStale] = useState(false);
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
  const [orderBlockZones, setOrderBlockZones] = useState<SmcZone[]>([]);
  const [tradingSignal, setTradingSignal] = useState<TradingSignal>({
    type: 'NEUTRAL',
    strength: 0,
    reasons: [],
    rsi: 50,
    trend: 'sideways'
  });
  const [chartData, setChartData] = useState<KLineData[]>([]);
  const chartDataRef = useRef<KLineData[]>([]); // 🆕 Ref para evitar loop infinito no useEffect
  // 🔴 FIX 2026-08-27 (achado do Cleber, com vídeo: cronômetro de candle
  // saltando ~10min em <2s reais). Causa raiz: o cronômetro (efeito "Candle
  // countdown" abaixo) lia `chartDataRef.current[last].timestamp` direto —
  // mas esse ref é escrito tanto pelo fetch REAL (linha ~5703, dado confiável
  // do servidor) quanto pelo tick local de "virada de vela" sintética (linha
  // ~5997, um CHUTE de que passou exatamente 1 intervalo desde a última vela,
  // usado só pra não esperar até 30s pelo refresh do servidor). Quando o
  // fetch real seguinte trazia a vela verdadeira com um timestamp diferente
  // do chute local (broker não necessariamente alinhado ao múltiplo exato de
  // UTC assumido), o cronômetro saltava de forma descontínua e confusa.
  // Corrigido: âncora separada, escrita SÓ pelo fetch real — o cronômetro
  // nunca mais fabrica progresso a partir do chute local (mesma disciplina
  // de "nunca fabricar dado" já documentada em CLAUDE.md pra preço/indicador).
  const lastRealCandleTimestampRef = useRef<number | null>(null);
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
  // 🐛 FIX: ao entrar/sair do fullscreen nativo, o navegador leva alguns frames (às
  // vezes com animação própria) até o layout terminar de se estabilizar de verdade.
  // O ResizeObserver do canvas podia disparar ANTES desse reflow final acabar,
  // deixando o gráfico (e a boleta, ancorada com `right` relativo ao mesmo container)
  // medido com a largura antiga -- como o `<main>` que envolve a tela tem
  // `overflow-auto`, isso não cortava nada, virava SCROLL horizontal escondendo a
  // boleta e a régua de preço fora da área visível (bug relatado: "a barra de preço e
  // a boleta desapareceram" ao restaurar da tela cheia). Força um resize explícito
  // depois que o navegador com certeza já terminou a transição -- 2 `requestAnimationFrame`
  // encadeados garantem que rodamos depois do próximo ciclo completo de layout+paint.
  const forceLayoutResettleAfterFullscreenChange = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          chartInstanceRef.current?.resize();
        } catch (_) {
          // silencioso -- mesma tolerância do resto dos resizes no arquivo
        }
        window.dispatchEvent(new Event('resize'));
      });
    });
  };
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMaximized(!!document.fullscreenElement);
      forceLayoutResettleAfterFullscreenChange();
    };
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
      // modo CSS (cobre só o app, não o browser inteiro). Esse caminho não dispara
      // 'fullscreenchange' nenhum (não é fullscreen nativo), então precisa do mesmo
      // resize forçado aqui manualmente.
      console.warn('[ChartView] Fullscreen API indisponível, usando modo CSS:', err);
      setIsMaximized((prev) => !prev);
      forceLayoutResettleAfterFullscreenChange();
    }
  };
  const [showBacktestReplay, setShowBacktestReplay] = useState(false); // 🆕 Controle do Backtest/Replay
  const [showBacktestConfig, setShowBacktestConfig] = useState(false); // 🆕 Modal de configuração do Backtest
  const [showStrategyBuilder, setShowStrategyBuilder] = useState(false); // 🆕 Construtor de estratégias

  // Entrada vinda de fora (ex: botão "Criar personalizada" na tela de IA) — abre
  // o construtor direto, sem passar pela tela de config de backtest.
  useEffect(() => {
    if (initialAction === 'open-strategy-builder') {
      setShowStrategyBuilder(true);
      onInitialActionConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);
  const [isReplayMode, setIsReplayMode] = useState(false); // 🆕 Flag para modo replay (efeito visual)
  
  // 🎯 BACKTEST LIVE PROGRESS (motor real: estratégia + candles históricos reais)
  const backtestProgress = useBacktestLiveProgress(10000);
  const { strategies, saveStrategy, deleteStrategy, error: strategiesError } = useStrategies();
  const { showSrOverlay, showSrOverlayRef, setShowSrOverlay } = useChartPreferences(selectedSymbol);
  // 🆕 Setup favorito do gráfico (indicadores + parâmetros, grade, S/R) — salvo
  // via "Salvar configuração atual como favorita" no menu de botão direito,
  // aplicado automaticamente na 1ª carga do gráfico (ver useEffect de init mais abaixo).
  const { favoriteSetup, saveFavoriteSetup } = useFavoriteChartSetup();
  const favoriteSetupAppliedRef = useRef(false);
  // 🆕 Estado "ao vivo" do gráfico (sessionStorage) — ver useChartSessionState.ts.
  // `sessionStateAppliedRef` segue o mesmo padrão do favorito: aplica só na 1ª
  // carga da montagem, nunca de novo a cada refresh de 30s.
  const { readSessionState, saveSessionState } = useChartSessionState();
  const sessionStateAppliedRef = useRef(false);
  const initialRestoreDoneRef = useRef(false);
  // 🆕 Templates nomeados (CRUD completo — salvar/carregar/remover, menu "Templates"
  // do botão direito). `pendingTemplateApplyRef` existe porque "Carregar" pode exigir
  // trocar o timeframe primeiro (dispose()+init() do chart) -- nesse caso os
  // indicadores/posição só podem ser aplicados DEPOIS que o chart novo recarregar os
  // dados, então o template fica "pendente" até o próximo fetchData rodar.
  const { templates, saveTemplate, deleteTemplate } = useChartTemplates();
  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const pendingTemplateApplyRef = useRef<ChartTemplateConfig | null>(null);
  // 🐛 FIX (relatado pelo Cleber): trocar de timeframe depois de carregar um template
  // nomeado fazia o template "desaparecer" -- o chart é dispose()+init() na troca de
  // timeframe (mesmo caminho de "Carregar" que já precisa de pendingTemplateApplyRef),
  // mas nada guardava QUAL template estava ativo pra reaplicar os indicadores depois.
  // `activeTemplateConfigRef` guarda o último template carregado via "Carregar"; o
  // clique manual no seletor de timeframe usa ele pra popular pendingTemplateApplyRef
  // de novo (com o timeframe novo), reaproveitando o mesmo mecanismo de reaplicação.
  const activeTemplateConfigRef = useRef<ChartTemplateConfig | null>(null);
  // 🆕 Toggle de grade de fundo (guias horizontais/verticais) — persistido localmente
  // (preferência de exibição, não precisa ser por usuário+ativo no Supabase como o S/R).
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('chart_grid_visible');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
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
  // 🆕 Instâncias EXTRAS de um indicador (2ª, 3ª... clicada de novo no card já ativo),
  // além da 1ª rastreada em `indicatorPaneIdRef` -- a klinecharts recusa 2 instâncias do
  // MESMO nome no MESMO painel ("Duplicate indicators"), então cada clique extra cria um
  // painel novo só pra ela. Ver `addGenericIndicatorInstance`. Limitação conhecida: essas
  // instâncias extras não são salvas em Setup Favorito/Template (só a 1ª é) -- ficam só
  // na sessão atual do gráfico.
  const genericIndicatorExtraPaneIdsRef = useRef<Record<string, string[]>>({});
  // 🆕 Instâncias reais de MÉDIA MÓVEL por indicador base (ex: 'ma' -> [instância 1,
  // instância 2, ...]) -- cada uma é registrada na klinecharts sob um `name` PRÓPRIO
  // (ver MA_VARIANT_KLINECHARTS_NAME/registerMovingAverageIndicator), então cada uma
  // ganha sua própria linha/gear/✕ na legenda nativa do gráfico, em vez de todas
  // dividirem uma engrenagem só (achado do Cleber: médias apareciam mas só existia 1
  // engrenagem pra todas). A 1ª instância (variantIndex 0) usa `instanceId ===
  // indicator.id` -- mantém compatibilidade com todo código antigo que já lia/gravava
  // por `indicator.id` (templates, indicatorPaneIdRef, activeIndicators).
  const maInstancesRef = useRef<Record<string, Array<{ instanceId: string; klinechartsName: string; paneId: string }>>>({});
  const findMAInstance = (baseId: string, instanceId: string) =>
    (maInstancesRef.current[baseId] ?? []).find(inst => inst.instanceId === instanceId);
  // 🆕 Altura (em px) do painel de cada indicador que está em painel próprio (RSI/MACD/
  // Estocástico/etc, não sobreposto no preço) -- a klinecharts já permite arrastar a
  // divisória entre painéis pra redimensionar (dragEnabled é true por padrão na lib),
  // mas o usuário pediu um controle explícito também. `PANE_DEFAULT_HEIGHT` é o valor
  // que a própria klinecharts usa quando nenhuma altura é passada em `createIndicator`.
  const PANE_DEFAULT_HEIGHT = 100;
  const PANE_MIN_HEIGHT = 60;
  const PANE_MAX_HEIGHT = 400;
  const PANE_HEIGHT_STEP = 30;
  const [indicatorPaneHeightById, setIndicatorPaneHeightById] = useState<Record<string, number>>({});
  const adjustIndicatorPaneHeight = (indicator: IndicatorConfig, delta: number) => {
    const chart = chartInstanceRef.current;
    const paneId = indicatorPaneIdRef.current[indicator.id];
    if (!chart || !paneId) return;
    const current = indicatorPaneHeightById[indicator.id] ?? PANE_DEFAULT_HEIGHT;
    const next = Math.min(PANE_MAX_HEIGHT, Math.max(PANE_MIN_HEIGHT, current + delta));
    try {
      chart.setPaneOptions({ id: paneId, height: next });
      setIndicatorPaneHeightById(prev => ({ ...prev, [indicator.id]: next }));
    } catch (error) {
      console.error('[ChartView] ❌ Erro ajustando altura do painel:', error);
    }
  };
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
  // 🆕 Modo Magnético: liga/desliga o encaixe automático de NOVOS desenhos no OHLC do
  // candle mais próximo (klinecharts nativo via `mode: OverlayMode.WeakMagnet` na
  // criação do overlay) -- antes o botão só mostrava um toast "em desenvolvimento".
  const [magnetActive, setMagnetActive] = useState(false);
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
  // 🔧 FIX: o overlay 'emojiMarker' era criado SEM points (totalStep:1), esperando o próximo
  // clique pra se posicionar — mas o EmojiPicker é um <div> `position:fixed` flutuando visualmente
  // POR CIMA do canvas do gráfico (mesma área de tela). Confirmado ao vivo: o marcador nascia
  // grudado onde o EMOJI foi escolhido no picker (canto esquerdo), não onde o usuário clicava
  // de fato no candle — o clique de escolher o emoji contava como o "clique de posicionamento".
  // Fix: mesmo padrão já usado no modo Texto (`isAddingText`/`textPosition`) — guarda o emoji
  // escolhido, espera de verdade o PRÓXIMO clique dentro do container do chart (`onClick` do
  // `chartContainerRef`, que já ignora cliques na picker por ela ficar fora dessa árvore/mesmo
  // fechada nesse momento) e só then cria o overlay já com `points` explícitos convertidos de
  // pixel pra dado real via `chart.convertFromPixel`.
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);

  // 🆕 Editor de texto da "Linha com Informações" — clique na linha abre este input
  const [infoLineEditor, setInfoLineEditor] = useState<{ overlayId: string; x: number; y: number } | null>(null);
  const [infoLineText, setInfoLineText] = useState('');
  const infoLineCancelledRef = useRef(false); // 🛡️ evita o onBlur salvar de novo depois do Esc já ter cancelado
  const infoLineInputRef = useRef<HTMLInputElement>(null);
  const infoLineTextRef = useRef(''); // espelha infoLineText p/ o listener de clique-fora ler o valor mais recente

  // 🔧 FIX: Anotação de Texto (botão "T" da toolbar) era um <div> HTML solto em pixel cru
  // da tela (`chartTexts`/`textPosition` antigos) — não acompanhava zoom/pan do candle e não
  // dava pra editar depois de criado, só apagar com duplo-clique. Agora usa o overlay nativo
  // `textAnnotation` (registrado acima, mesmo mecanismo do `infoLine`): clique no gráfico cria
  // o ponto ancorado a preço/tempo, este editor abre na hora pra digitar, e clicar de novo no
  // texto já criado reabre o mesmo editor pra corrigir — edição de verdade, não só apagar.
  const [textAnnotationEditor, setTextAnnotationEditor] = useState<{ overlayId: string; x: number; y: number } | null>(null);
  const [textAnnotationText, setTextAnnotationText] = useState('');
  const textAnnotationCancelledRef = useRef(false);
  const textAnnotationInputRef = useRef<HTMLInputElement>(null);
  const textAnnotationTextRef = useRef('');

  useEffect(() => {
    if (!textAnnotationEditor) return;
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (textAnnotationInputRef.current && !textAnnotationInputRef.current.contains(event.target as Node)) {
        const trimmed = textAnnotationTextRef.current.trim();
        try {
          if (trimmed) {
            chartInstanceRef.current?.overrideOverlay({
              id: textAnnotationEditor.overlayId,
              extendData: trimmed
            });
          } else {
            // Texto vazio ao clicar fora -- descarta o marcador em vez de deixar um
            // "clique para escrever" fantasma perdido no gráfico.
            chartInstanceRef.current?.removeOverlay(textAnnotationEditor.overlayId);
            userDrawingOverlayIdsRef.current = userDrawingOverlayIdsRef.current.filter(id => id !== textAnnotationEditor.overlayId);
          }
        } catch (err) {
          console.error('[ChartView] ❌ Error saving text annotation (click outside):', err);
        }
        textAnnotationCancelledRef.current = true;
        setTextAnnotationEditor(null);
        setTextAnnotationText('');
        setIsAddingText(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside, true);
  }, [textAnnotationEditor]);

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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartIdRef = useRef<string>('chart-' + Math.random().toString(36).substring(7));
  const chartInstanceRef = useRef<any>(null);
  // 🆕 Toggle de grade de fundo: reage sem recriar o gráfico inteiro (init já usa
  // showGridOverlay como valor inicial; este efeito cobre a mudança em tempo real
  // e persiste a preferência).
  useEffect(() => {
    try {
      localStorage.setItem('chart_grid_visible', String(showGridOverlay));
    } catch {
      // localStorage indisponível (modo privado, etc.) — só não persiste entre sessões.
    }
    const chart = chartInstanceRef.current;
    if (!chart) return;
    chart.setStyles({
      grid: {
        show: showGridOverlay,
        horizontal: { show: showGridOverlay },
        vertical: { show: showGridOverlay },
      },
    });
  }, [showGridOverlay]);
  const assetListRef = useRef<HTMLDivElement>(null); // 🆕 Ref para o asset list
  const isInitialLoadRef = useRef<boolean>(true); // 🆕 Rastrear se é primeira carga (para evitar auto-scroll infinito)
  const srOverlayIdsRef = useRef<string[]>([]); // 🆕 Ids dos overlays de Suporte/Resistência ativos no gráfico
  const positionOverlayIdsRef = useRef<string[]>([]); // 🆕 Ids das linhas de posição aberta (entrada/SL/TP) desenhadas no gráfico
  // 🔧 FIX: troca de timeframe/símbolo faz dispose()+init() do chart (mesmo padrão documentado
  // acima pros overlays de posição) — mas os desenhos do usuário (trendline, fibonacci, shapes,
  // texto ancorado, emoji...) nunca tinham um mecanismo de captura/restauração equivalente.
  // Confirmado ao vivo: desenhar uma linha de tendência e trocar de timeframe (ex: 5m→1H) apaga
  // o desenho pra sempre, sem nenhum aviso. `userDrawingOverlayIdsRef` rastreia os ids criados
  // pela toolbar (único jeito de enumerar depois, já que a klinecharts não expõe getOverlays()
  // em lote — só getOverlayById por id conhecido); `userDrawingsSnapshotRef` guarda uma cópia
  // serializável (name/points/styles/extendData/lock/visible) tirada logo antes do dispose(),
  // recriada com createOverlay() depois que o chart novo termina de carregar o dataset.
  const userDrawingOverlayIdsRef = useRef<string[]>([]);
  const userDrawingsSnapshotRef = useRef<Array<{ name: string; points: any; styles: any; extendData: any; lock: boolean; visible: boolean }>>([]);
  // 🔧 FIX: a "DrawingContextToolbar" (menu de Mover/Estilo/Travar/Apagar) abria
  // automaticamente no PRIMEIRO clique em cima de um desenho -- inclusive o clique que
  // TERMINA de desenhar a linha (2º clique de uma Linha de Tendência, por exemplo) -- e
  // ficava fixa no topo-centro do gráfico até o usuário clicar num espaço vazio ou apagar
  // o desenho. Cleber reportou que isso atrapalha o trade (fica em cima do painel de
  // compra/venda). Novo comportamento: 1º clique num desenho só SELECIONA (linha fica
  // levemente mais grossa, um sinal visual discreto de "isto está acionado"); só um 2º
  // clique NO MESMO desenho já selecionado abre o menu, perto de onde foi clicado (não
  // mais fixo no topo-centro, que ficava em cima do painel BTCUSD/SELL/BUY). `selectedDrawingIdRef`
  // existe porque o `onClick` de cada overlay é capturado no momento da CRIAÇÃO (a
  // klinecharts não recria o callback a cada render) -- comparar contra o state
  // `selectedDrawing` ali dentro leria sempre o valor "congelado" de quando o desenho foi
  // criado, nunca o estado real depois de cliques seguintes; um ref sempre lê o valor atual.
  const selectedDrawingIdRef = useRef<string | null>(null);
  const originalOverlayStylesRef = useRef<Record<string, any>>({});
  // Espelha `showContextToolbar` pro onClick do overlay (capturado na criação, closure
  // congelada) sempre ler o valor real -- mesmo motivo do `selectedDrawingIdRef` acima.
  const showContextToolbarRef = useRef(false);

  const applyDrawingSelectionHighlight = (id: string) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    try {
      const ov = chart.getOverlayById(id);
      if (!ov) return;
      const styles = ov.styles || {};
      originalOverlayStylesRef.current[id] = styles;
      const bump = (obj: any, key: string, delta: number) => (obj ? { ...obj, [key]: (obj[key] ?? 2) + delta } : obj);
      chart.overrideOverlay({
        id,
        styles: {
          ...styles,
          line: bump(styles.line, 'size', 2),
          rect: bump(styles.rect, 'borderSize', 2),
          circle: bump(styles.circle, 'borderSize', 2),
          polygon: bump(styles.polygon, 'borderSize', 2)
        }
      });
    } catch (e) {
      console.warn('[ChartView] ⚠️ Falha ao destacar desenho selecionado:', e);
    }
  };

  const clearDrawingSelectionHighlight = (id: string | null) => {
    if (!id) return;
    const chart = chartInstanceRef.current;
    const original = originalOverlayStylesRef.current[id];
    delete originalOverlayStylesRef.current[id];
    if (!chart || !original) return;
    try {
      chart.overrideOverlay({ id, styles: original });
    } catch (e) {
      // Desenho pode já ter sido apagado (ex: pelo botão "Apagar") -- nada a restaurar.
    }
  };
  useEffect(() => {
    showContextToolbarRef.current = showContextToolbar;
  }, [showContextToolbar]);
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
    { id: 'zoom_in' as DrawingTool, icon: ZoomIn, label: 'Aproximar (Zoom +)', shortcut: 'Alt + Z' },
    { id: 'zoom_out' as DrawingTool, icon: ZoomOut, label: 'Afastar (Zoom −)', shortcut: 'Alt + X' },
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
  // ✅ 2026-07-23: achado real — este painel buscava os ~271 ativos do
  // catálogo inteiro A CADA 5s o tempo TODO que a tela do Gráfico estivesse
  // montada (deps vazias, sem gate nenhum), mesmo com o modal "Pesquisa de
  // Símbolo" (showAssetList) fechado — os dados só são exibidos DENTRO desse
  // modal (filteredAssets/liveAssets só aparecem lá). Uma única aba esquecida
  // aberta na tela do Gráfico (mesmo sem ninguém interagindo) gerava
  // dezenas de chamadas por segundo à conta MetaAPI compartilhada
  // indefinidamente — causa raiz real de rate-limit (429) persistente por
  // dias, sem relação com volume de usuário algum (achado investigando por
  // que o problema persistia "há 3 dias sem uso"). Agora só busca/faz
  // polling enquanto o modal está de fato aberto.
  useEffect(() => {
    if (!showAssetList) return;

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
  }, [showAssetList]); // ✅ 2026-07-23: só roda enquanto o modal de busca está aberto

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

  // 🆕 EFFECT: Gerenciar cursor dot no modo ponto
  // 🔧 FIX: estava desligado de propósito ("DESABILITADO para evitar IframeMessageAbortError")
  // — mas o cursor já é escondido (`cursor: none`) por handleCrosshairModeChange assim que
  // o modo Ponto é selecionado, então sem este efeito o usuário ficava sem NENHUM cursor
  // visível (nem seta, nem bolinha). Confirmado ao vivo: hover no gráfico em modo Ponto não
  // mostrava nada. Reativado — não usa nenhum `setState`/postMessage, só manipulação direta
  // do DOM via listener nativo, então não é a causa plausível do IframeMessageAbortError
  // citado (esse erro é de comunicação entre iframes/postMessage, não de mousemove local).
  useEffect(() => {
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
  }, [crosshairMode]);

  // 🆕 Ícones de editar ("⚙") e fechar ("✕") que aparecem na legenda do indicador, direto
  // no gráfico — clicáveis (via ActionType.OnTooltipIconClick da própria klinecharts) pra
  // editar parâmetros ou remover o indicador sem precisar abrir o modal de Indicadores
  // Técnicos nem depender do box flutuante em HTML (removido -- ver comentário onde ele
  // era renderizado antes, virava um "box flutuante" duplicado do lado direito do gráfico).
  const INDICATOR_SETTINGS_ICON = {
    id: 'settings',
    position: 'right',
    color: '#76808F',
    activeColor: '#3B82F6',
    size: 13,
    fontFamily: 'Arial',
    icon: '⚙',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingLeft: 6,
    paddingRight: 2,
    paddingTop: 2,
    paddingBottom: 2,
    marginLeft: 6,
    marginRight: 2,
    marginTop: 6,
    marginBottom: 0
  };
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
    marginLeft: 2,
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
  // 🆕 Cada MA agora suporta VÁRIAS linhas (períodos) na mesma instância -- é o jeito
  // nativo que o klinecharts suporta (calcParams é uma lista, uma linha por item; ver
  // registerMovingAverageIndicator acima). Tentar criar uma 2ª instância do mesmo
  // indicador no mesmo painel é rejeitado pela própria lib ("Duplicate indicators"),
  // então "adicionar outra média móvel" tem que ser "adicionar outra linha" aqui.
  interface MALineSettings {
    period: number;
    color: string;
    lineStyle: 'solid' | 'dashed';
    lineWidth: number;
  }
  interface MAUISettings {
    shift: number;
    method: MAMethod;
    appliedPrice: AppliedPrice;
    lines: MALineSettings[];
  }
  const MA_LINE_COLOR_PALETTE = ['#f97316', '#3b82f6', '#a855f7', '#22c55e', '#eab308', '#ec4899', '#14b8a6', '#ef4444'];
  const MA_DEFAULT_METHOD: Record<string, MAMethod> = { ma: 'SIMPLE', sma: 'SIMPLE', ema: 'EXPONENTIAL', wma: 'LINEAR_WEIGHTED' };
  const isMovingAverageIndicator = (indicator: IndicatorConfig): boolean => indicator.id in MA_DEFAULT_METHOD;

  const [indicatorMASettings, setIndicatorMASettings] = useState<Record<string, MAUISettings>>({});
  // 🐛 FIX: `indicatorMASettings` é state do React (assíncrono) -- clicar várias vezes
  // seguidas no banner de uma média (mesmo tick, antes do re-render) fazia cada clique
  // ler o MESMO `indicatorMASettings` desatualizado e calcular a MESMA linha nova
  // (mesmo período/cor), sobrescrevendo o resultado do clique anterior no gráfico em vez
  // de empilhar. `indicatorMASettingsRef` é atualizada de forma síncrona em todo clique
  // (ver `addMALineDirect`), então cada clique dentro da mesma rajada enxerga o resultado
  // real do clique imediatamente anterior. O `state` continua existindo só pra re-render
  // da UI (badges, editor); a ref é a fonte de verdade pra lógica.
  const indicatorMASettingsRef = useRef<Record<string, MAUISettings>>({});
  useEffect(() => {
    indicatorMASettingsRef.current = indicatorMASettings;
  }, [indicatorMASettings]);
  // 🆕 `instanceId` default = `indicator.id` -- mantém todo caller antigo (que só
  // conhece o indicador base, nunca uma instância extra) funcionando sem mudança.
  const getMASettings = (indicator: IndicatorConfig, instanceId: string = indicator.id): MAUISettings =>
    indicatorMASettingsRef.current[instanceId] ?? {
      shift: 0,
      method: MA_DEFAULT_METHOD[indicator.id] ?? 'SIMPLE',
      appliedPrice: 'CLOSE',
      lines: [{ period: indicator.defaultParams?.[0] ?? 20, color: MA_LINE_COLOR_PALETTE[0], lineStyle: 'solid', lineWidth: 1 }]
    };

  // Constrói o `config` que o klinecharts espera (calcParams/extendData/styles) a
  // partir de um MAUISettings -- usado na criação (createIndicatorInstance), na edição
  // (applyMASettingsToChart) e na aplicação de templates (applyChartTemplateConfig).
  const buildMAChartConfig = (klinechartsName: string, settings: MAUISettings) => ({
    name: klinechartsName,
    calcParams: settings.lines.map(l => l.period),
    extendData: { method: settings.method, appliedPrice: settings.appliedPrice, shift: settings.shift },
    // ⚠️ dashedValue é obrigatório aqui -- a própria klinecharts acessa
    // `styles.dashedValue[0]/[1]` sem nenhum fallback ao mesclar segmentos consecutivos
    // da linha antes de desenhar (ver eachChildren/mergeLines em IndicatorView.drawImp,
    // node_modules/klinecharts/dist/index.esm.js:8027) -- sem essa chave o acesso lança
    // TypeError e a linha inteira do indicador nunca chega a ser desenhada (só o rótulo
    // aparece, que vem de um caminho separado). [4,4] é só usado quando style='dashed'.
    // `styles.lines[i]` mapeia por ÍNDICE pra `figures[i]` (mesma ordem/tamanho) --
    // confirmado lendo eachFigures() em node_modules/klinecharts/dist/index.esm.js:970-997.
    styles: {
      lines: settings.lines.map(l => ({ color: l.color, style: l.lineStyle, size: l.lineWidth, dashedValue: [4, 4] }))
    }
  });

  const applyMASettingsToChart = (chart: any, indicator: IndicatorConfig, settings: MAUISettings, instanceId: string = indicator.id) => {
    // 🆕 Instância extra (variantIndex > 0) tem `name`/`paneId` PRÓPRIOS, rastreados em
    // `maInstancesRef` -- não dá pra assumir `indicator.klinechartsName`/
    // `indicatorPaneIdRef` (esses só valem pra 1ª instância, ver `addMALineDirect`).
    const instance = findMAInstance(indicator.id, instanceId);
    const paneId = instance?.paneId ?? indicatorPaneIdRef.current[indicator.id];
    const klinechartsName = instance?.klinechartsName ?? indicator.klinechartsName;
    if (!chart || !paneId) return;
    chart.overrideIndicator(buildMAChartConfig(klinechartsName, settings), paneId);
  };

  const [maEditor, setMaEditor] = useState<{ indicator: IndicatorConfig; instanceId: string; settings: MAUISettings } | null>(null);

  // 🆕 `addLine`: usado quando o clique veio do banner/card do indicador JÁ ATIVO no
  // modal "Indicadores" -- pedido explícito do Cleber: clicar ali deve INSERIR outra
  // média direto (uma linha nova, período = última+10), não só abrir o editor mostrando
  // a linha existente sem tocar nela. Sem isso, editar o período da linha já existente e
  // clicar Salvar SUBSTITUÍA a média (ex: 20 -> 200) em vez de adicionar uma 2ª -- o
  // usuário via a média antiga "sumir" do gráfico, porque ela realmente tinha sido
  // editada, não duplicada. A engrenagem do menu de botão direito continua abrindo só
  // pra editar (addLine=false), sem surpresa pra quem clica ali de propósito pra ajustar
  // a linha existente. `instanceId` identifica QUAL das N instâncias desse indicador
  // está sendo editada -- default = a 1ª (`indicator.id`), mas o gear nativo da legenda
  // do gráfico (ver `onTooltipIconClick`) passa a instância exata clicada.
  const openMAEditor = (indicator: IndicatorConfig, addLine: boolean = false, instanceId: string = indicator.id) => {
    const current = getMASettings(indicator, instanceId);
    let lines = current.lines.map(l => ({ ...l }));
    if (addLine) {
      const nextColor = MA_LINE_COLOR_PALETTE[lines.length % MA_LINE_COLOR_PALETTE.length];
      const lastPeriod = lines[lines.length - 1]?.period ?? 20;
      lines = [...lines, { period: lastPeriod + 10, color: nextColor, lineStyle: 'solid', lineWidth: 1 }];
    }
    setMaEditor({ indicator, instanceId, settings: { ...current, lines } });
  };

  const addMAEditorLine = () => {
    if (!maEditor) return;
    const nextColor = MA_LINE_COLOR_PALETTE[maEditor.settings.lines.length % MA_LINE_COLOR_PALETTE.length];
    const lastPeriod = maEditor.settings.lines[maEditor.settings.lines.length - 1]?.period ?? 20;
    setMaEditor({
      ...maEditor,
      settings: {
        ...maEditor.settings,
        lines: [...maEditor.settings.lines, { period: lastPeriod + 10, color: nextColor, lineStyle: 'solid', lineWidth: 1 }]
      }
    });
  };

  const removeMAEditorLine = (index: number) => {
    if (!maEditor || maEditor.settings.lines.length <= 1) return; // sempre pelo menos 1 linha
    setMaEditor({ ...maEditor, settings: { ...maEditor.settings, lines: maEditor.settings.lines.filter((_, i) => i !== index) } });
  };

  const updateMAEditorLine = (index: number, patch: Partial<MALineSettings>) => {
    if (!maEditor) return;
    setMaEditor({
      ...maEditor,
      settings: { ...maEditor.settings, lines: maEditor.settings.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }
    });
  };

  const saveMAEditor = () => {
    if (!maEditor) return;
    const { indicator, instanceId, settings } = maEditor;
    if (settings.lines.length === 0) {
      toast.error('Adicione ao menos uma linha');
      return;
    }
    if (settings.lines.some(l => !Number.isFinite(l.period) || l.period <= 0)) {
      toast.error('Todo período precisa ser um número válido maior que zero');
      return;
    }
    if (!Number.isFinite(settings.shift)) {
      toast.error('Deslocar precisa ser um número válido');
      return;
    }
    indicatorMASettingsRef.current = { ...indicatorMASettingsRef.current, [instanceId]: settings };
    setIndicatorMASettings(prev => ({ ...prev, [instanceId]: settings }));
    const chart = chartInstanceRef.current;
    const isActive = instanceId === indicator.id ? activeIndicators.has(indicator.id) : !!findMAInstance(indicator.id, instanceId);
    if (chart && isActive) {
      try {
        applyMASettingsToChart(chart, indicator, settings, instanceId);
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

    // 🆕 Remove também qualquer instância extra criada por cliques repetidos no card
    // (ver `addGenericIndicatorInstance`) -- lixeira sempre desliga TUDO daquele indicador.
    const extraPaneIds = genericIndicatorExtraPaneIdsRef.current[indicator.id];
    if (extraPaneIds) {
      extraPaneIds.forEach(extraPaneId => {
        try { chart.removeIndicator(extraPaneId, indicator.klinechartsName); } catch (_) {}
      });
      delete genericIndicatorExtraPaneIdsRef.current[indicator.id];
    }

    // 🆕 Remove também TODAS as instâncias extras de média móvel (2ª, 3ª... clicadas em
    // "Adicionar outra média") -- cada uma tem `name` registrado próprio (MA__2, MA__3...),
    // então precisa do `removeIndicator(paneId, klinechartsName)` de CADA uma, não só do
    // nome base. A 1ª instância (variantIndex 0) já foi removida acima via
    // `indicator.klinechartsName` -- filtra pra não tentar de novo.
    const maInstances = maInstancesRef.current[indicator.id];
    if (maInstances) {
      const removedInstanceIds = maInstances.map(inst => inst.instanceId);
      maInstances.forEach(inst => {
        if (inst.instanceId === indicator.id) return;
        try { chart.removeIndicator(inst.paneId, inst.klinechartsName); } catch (_) {}
      });
      delete maInstancesRef.current[indicator.id];
      removedInstanceIds.forEach(id => { delete indicatorMASettingsRef.current[id]; });
      setIndicatorMASettings(prev => {
        const next = { ...prev };
        removedInstanceIds.forEach(id => { delete next[id]; });
        return next;
      });
    }
    delete indicatorMASettingsRef.current[indicator.id];
  };

  const createIndicatorInstance = (chart: any, indicator: IndicatorConfig, placement: 'overlay' | 'pane') => {
    const config: any = {
      name: indicator.klinechartsName,
      id: indicator.id
      // ✅ Ícone de excluir (✕) vem do estilo global setado em chart.setStyles() no init
      // (styles.tooltip.icons por instância é ignorado pela klinecharts — ver comentário lá)
    };
    if (isMovingAverageIndicator(indicator)) {
      // 🆕 Médias móveis (MA/EMA/SMA/WMA) carregam Método/Aplicar a/Deslocar/Estilo (e todas
      // as linhas/períodos já configurados) já na criação — ver registerMovingAverageIndicator.
      // 🐛 FIX (bug real relatado pelo Cleber, achado com dado do Supabase: template salvo
      // com "EMA + 2 simples" voltava só com 1 simples): `getMASettings` SÓ COMPUTA um
      // default na hora, nunca escreve em `indicatorMASettings`/`indicatorMASettingsRef` --
      // isso só acontecia em `addMALineDirect` (2ª instância em diante, via "Adicionar
      // outra média"). A 1ª instância de uma MA, criada por este caminho (toggle normal do
      // indicador, `toggleIndicator`/`changeIndicatorPlacement`), nunca ganhava uma chave
      // no estado -- `captureCurrentChartConfig` serializava `indicatorMASettings` sem essa
      // chave, e template/favorito salvo perdia essa instância inteira ao recarregar
      // (confirmado direto no banco: template salvo tinha só "ema"/"ma__2", sem "ma").
      // Fix: grava a settings computada no estado igual `addMALineDirect` já faz.
      const initialSettings = getMASettings(indicator);
      indicatorMASettingsRef.current = { ...indicatorMASettingsRef.current, [indicator.id]: initialSettings };
      setIndicatorMASettings(prev => ({ ...prev, [indicator.id]: initialSettings }));
      Object.assign(config, buildMAChartConfig(indicator.klinechartsName, initialSettings));
    } else {
      const params = getIndicatorParams(indicator);
      if (params.length > 0) {
        config.calcParams = params;
      }
    }
    let resolvedPaneId: string;
    if (placement === 'pane') {
      resolvedPaneId = `pane_${indicator.id}`;
      chart.createIndicator(config, false, { id: resolvedPaneId });
    } else {
      // paneOptions.id precisa apontar pro pane existente (candle_pane) -- sem isso,
      // createIndicator faz getDrawPaneById('') = null e cai no ramo de criar um pane NOVO
      // (ver ChartImp.prototype.createIndicator em node_modules/klinecharts/dist/index.esm.js)
      resolvedPaneId = 'candle_pane';
      chart.createIndicator(config, true, { id: resolvedPaneId });
    }
    indicatorPaneIdRef.current[indicator.id] = resolvedPaneId;
    if (isMovingAverageIndicator(indicator)) {
      // 🆕 Registra esta como a instância 0 (variantIndex 0, `name` = klinechartsName
      // base) em `maInstancesRef` -- sem isso, um clique subsequente em "Adicionar outra
      // média" não saberia que já existe 1 instância e tentaria criar OUTRA sob o
      // mesmo `name` base, batendo em "Duplicate indicators" na klinecharts.
      maInstancesRef.current = {
        ...maInstancesRef.current,
        [indicator.id]: [{ instanceId: indicator.id, klinechartsName: indicator.klinechartsName, paneId: resolvedPaneId }]
      };
    }
  };

  // 🆕 Clique no card/banner de uma média móvel (MA/EMA/SMA/WMA) no modal "Indicadores"
  // -- pedido do Cleber: N cliques têm que inserir N médias DISTINTAS DE VERDADE no
  // gráfico, cada uma com sua PRÓPRIA engrenagem/✕ na legenda nativa (achado do Cleber:
  // a versão anterior empilhava tudo numa instância só -- N linhas dentro de UMA
  // engrenagem, não N engrenagens). Cada clique cria uma instância nova, registrada sob
  // um `name` variante próprio (MA, MA__2, MA__3... -- ver MA_VARIANT_KLINECHARTS_NAME),
  // sempre no MESMO painel (overlay no preço ou painel próprio, conforme o indicador),
  // porque `name`s diferentes não colidem na trava "Duplicate indicators" da klinecharts
  // mesmo estando no mesmo painel. 1º clique usa o período default do indicador (ex.
  // 20); cada clique seguinte usa período do anterior + 10, cor nova da paleta.
  const addMALineDirect = (indicator: IndicatorConfig) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    // 🐛 FIX histórico: `wasActive`/contagem de instância tinha que vir de algo síncrono.
    // `activeIndicators` é state do React -- numa rajada de cliques no mesmo tick, cada
    // clique enxergava o state de ANTES do clique anterior ser aplicado. `maInstancesRef`
    // é uma ref, atualizada de forma síncrona a cada clique -- fonte de verdade correta.
    const existing = maInstancesRef.current[indicator.id] ?? [];
    if (existing.length >= MA_MAX_INSTANCES) {
      toast.error(`Máximo de ${MA_MAX_INSTANCES} instâncias de ${indicator.name.split(' - ')[0]} no gráfico`);
      return;
    }
    const variantIndex = existing.length;
    const instanceId = variantIndex === 0 ? indicator.id : `${indicator.id}__${variantIndex + 1}`;
    const variantKlinechartsName = MA_VARIANT_KLINECHARTS_NAME(indicator.klinechartsName, variantIndex);
    const nextColor = MA_LINE_COLOR_PALETTE[variantIndex % MA_LINE_COLOR_PALETTE.length];
    const lastInstance = existing[existing.length - 1];
    const lastPeriod = lastInstance
      ? indicatorMASettingsRef.current[lastInstance.instanceId]?.lines.slice(-1)[0]?.period
      : undefined;
    const newPeriod = lastPeriod !== undefined ? lastPeriod + 10 : (indicator.defaultParams?.[0] ?? 20);
    const settings: MAUISettings = {
      shift: 0,
      method: MA_DEFAULT_METHOD[indicator.id] ?? 'SIMPLE',
      appliedPrice: 'CLOSE',
      lines: [{ period: newPeriod, color: nextColor, lineStyle: 'solid', lineWidth: 1 }]
    };
    // Atualiza a ref de forma SÍNCRONA (fonte de verdade pro próximo clique da rajada);
    // o `setState` continua disparado só pra re-renderizar UI (badge, editor).
    indicatorMASettingsRef.current = { ...indicatorMASettingsRef.current, [instanceId]: settings };
    setIndicatorMASettings(prev => ({ ...prev, [instanceId]: settings }));
    try {
      const placement = getIndicatorPlacement(indicator);
      const config: any = { name: variantKlinechartsName, id: instanceId, ...buildMAChartConfig(variantKlinechartsName, settings) };
      let paneId: string;
      if (placement === 'pane') {
        paneId = variantIndex === 0 ? `pane_${indicator.id}` : `pane_${indicator.id}_extra_${variantIndex + 1}`;
        chart.createIndicator(config, false, { id: paneId });
      } else {
        paneId = 'candle_pane';
        chart.createIndicator(config, true, { id: paneId });
      }
      maInstancesRef.current = {
        ...maInstancesRef.current,
        [indicator.id]: [...existing, { instanceId, klinechartsName: variantKlinechartsName, paneId }]
      };
      if (variantIndex === 0) {
        indicatorPaneIdRef.current[indicator.id] = paneId;
        setActiveIndicators(prev => new Set(prev).add(indicator.id));
      }
    } catch (error) {
      console.error('[ChartView] ❌ Erro adicionando instância de média móvel:', indicator.id, error);
    }
  };

  // 🆕 Remove UMA instância específica de média móvel (✕ da legenda nativa de uma
  // variante, ex: MA__2) sem mexer nas outras instâncias do mesmo indicador. Se for a
  // ÚLTIMA instância restante, desliga o indicador por completo (`activeIndicators`).
  const removeMAInstance = (indicator: IndicatorConfig, instanceId: string) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    const instances = maInstancesRef.current[indicator.id] ?? [];
    const target = instances.find(inst => inst.instanceId === instanceId);
    if (!target) return;
    try { chart.removeIndicator(target.paneId, target.klinechartsName); } catch (_) {}
    const remaining = instances.filter(inst => inst.instanceId !== instanceId);
    maInstancesRef.current = { ...maInstancesRef.current, [indicator.id]: remaining };
    delete indicatorMASettingsRef.current[instanceId];
    setIndicatorMASettings(prev => {
      const next = { ...prev };
      delete next[instanceId];
      return next;
    });
    if (remaining.length === 0) {
      delete indicatorPaneIdRef.current[indicator.id];
      delete maInstancesRef.current[indicator.id];
      setActiveIndicators(prev => {
        const next = new Set(prev);
        next.delete(indicator.id);
        return next;
      });
    }
  };

  // 🆕 Clique no card/banner de um indicador QUALQUER (RSI, MACD, ADX, etc, tudo que não
  // é média móvel) já ativo -- mesmo pedido acima, mas indicadores comuns não têm o truque
  // de "várias linhas" (só existe pra MA/EMA/SMA/WMA). A única forma de ter uma 2ª
  // instância do mesmo indicador visível ao mesmo tempo, respeitando o limite real da
  // klinecharts ("Duplicate indicators" pra 2 instâncias do mesmo nome no MESMO painel),
  // é cada clique extra criar um painel novo só pra ela. Sempre "painel abaixo" mesmo pra
  // indicador que normalmente fica sobreposto no preço -- overlay de verdade exige o
  // truque de linhas, que só existe pra médias móveis.
  const addGenericIndicatorInstance = (indicator: IndicatorConfig) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    // 🐛 FIX: mesma causa raiz de `addMALineDirect` -- `activeIndicators.has(...)` é
    // state assíncrono, então cliques em rajada no mesmo tick todos viam `wasActive =
    // false` e todos tentavam `createIndicatorInstance` pro mesmo nome/painel, batendo
    // no "Duplicate indicators" da klinecharts a partir do 2º. `indicatorPaneIdRef` é
    // ref, atualizada de forma síncrona -- fonte de verdade correta.
    const wasActive = indicatorPaneIdRef.current[indicator.id] !== undefined;
    try {
      if (!wasActive) {
        createIndicatorInstance(chart, indicator, getIndicatorPlacement(indicator));
        setActiveIndicators(prev => new Set(prev).add(indicator.id));
        return;
      }
      const params = getIndicatorParams(indicator);
      const config: any = { name: indicator.klinechartsName, id: indicator.id };
      if (params.length > 0) config.calcParams = params;
      const extraIds = genericIndicatorExtraPaneIdsRef.current[indicator.id] ?? [];
      const newPaneId = `pane_${indicator.id}_extra_${extraIds.length + 2}`;
      chart.createIndicator(config, false, { id: newPaneId });
      genericIndicatorExtraPaneIdsRef.current[indicator.id] = [...extraIds, newPaneId];
    } catch (error) {
      console.error('[ChartView] ❌ Erro adicionando instância extra do indicador:', indicator.id, error);
    }
  };

  // 🆕 POSIÇÃO de scroll horizontal do gráfico, guardada como ÂNCORA
  // (candle + coordenada X em pixels onde ele está na tela). Ver o comentário
  // longo em ChartTemplateConfig (useChartTemplates.ts): a klinecharts guarda o
  // scroll em `_lastBarRightSideDiffBarCount`, que não é público, e reconstruir
  // esse valor a partir de `getVisibleRange()` erra meia barra por vez porque a
  // lib arredonda (`realTo = round(diff + total + 0.5)`) — medido no browser:
  // a posição escorregava 1 barra a CADA restauração, e como o refresh de 30s
  // restaura, o gráfico ia andando sozinho. Ancorar em pixel é exato.
  const readChartScrollPosition = (chart: any): { anchorTimestamp: number; anchorX: number } | null => {
    if (!chart) return null;
    try {
      const dataList = chart.getDataList();
      const range = chart.getVisibleRange();
      const total = dataList?.length ?? 0;
      if (!range || total === 0) return null;
      // Candle encostado na borda direita da janela visível — é o que o usuário
      // percebe como "onde eu deixei o gráfico".
      const anchorIndex = Math.max(0, Math.min(Math.round(range.realTo), total) - 1);
      const anchor = dataList[anchorIndex];
      if (!anchor?.timestamp) return null;
      const px = chart.convertToPixel({ timestamp: anchor.timestamp }, { paneId: 'candle_pane' });
      const x = Array.isArray(px) ? px[0]?.x : px?.x;
      if (typeof x !== 'number' || !isFinite(x)) return null;
      return { anchorTimestamp: anchor.timestamp, anchorX: x };
    } catch (_) {
      return null;
    }
  };

  // Contraparte de `readChartScrollPosition`: rola o quanto for preciso pra que o
  // candle-âncora volte à MESMA coordenada X. Duração 0 — restaurar posição não
  // é animação. Aplicar sempre DEPOIS do barSpace (o zoom muda quantos pixels
  // vale cada barra, logo muda o X do mesmo candle).
  const applyChartScrollPosition = (chart: any, anchorTimestamp: number, anchorX: number) => {
    if (!chart) return;
    try {
      // 🐛 FIX (bug real relatado pelo Cleber: gráfico abrindo com só a última vela
      // visível, resto da tela em branco): o estado de sessão salva `anchorTimestamp`
      // sem o SÍMBOLO — ao trocar de ativo (ou reabrir a página com sessão de outro
      // símbolo salva), este timestamp antigo é reaplicado sobre o dataset novo. Se
      // ele cai fora do range de candles carregado agora, `convertToPixel` extrapola
      // pra um pixel fora da tela e `scrollByDistance` empurra o viewport inteiro pra
      // longe dos dados reais. Guarda: só restaura se o timestamp existir de fato
      // dentro do range carregado; fora disso, mantém a posição já definida por
      // scrollToRealTime() em vez de arriscar um scroll absurdo.
      const dataList = chart.getDataList();
      const first = dataList?.[0]?.timestamp;
      const last = dataList?.[dataList.length - 1]?.timestamp;
      if (typeof first !== 'number' || typeof last !== 'number' || anchorTimestamp < first || anchorTimestamp > last) {
        console.warn('[ChartView] ⚠️ Âncora de scroll fora do range carregado, ignorando restauração de posição');
        return;
      }
      const px = chart.convertToPixel({ timestamp: anchorTimestamp }, { paneId: 'candle_pane' });
      const x = Array.isArray(px) ? px[0]?.x : px?.x;
      if (typeof x !== 'number' || !isFinite(x)) return;
      const distance = anchorX - x;
      if (Math.abs(distance) > 0.01) chart.scrollByDistance(distance, 0);
    } catch (error) {
      console.warn('[ChartView] ⚠️ Não foi possível restaurar a posição de scroll:', error);
    }
  };

  // 🆕 Captura o setup atual do gráfico (indicadores + parâmetros, grade, S/R,
  // timeframe, zoom/scroll) — usado tanto por "Salvar como favorita" quanto por
  // "Templates › Salvar". barSpace/offsetRightDistance são os únicos dois valores
  // que a klinecharts expõe pra reproduzir zoom+posição exatamente (ver setOffsetRightDistance
  // no fix do gráfico "voltando pra posição inicial").
  const captureCurrentChartConfig = (): ChartTemplateConfig => {
    const chart = chartInstanceRef.current;
    let barSpace: number | null = null;
    let offsetRightDistance: number | null = null;
    if (chart) {
      try { barSpace = chart.getBarSpace(); } catch (_) {}
      try { offsetRightDistance = chart.getOffsetRightDistance(); } catch (_) {}
    }
    const viewport = readChartScrollPosition(chart);
    return {
      anchorTimestamp: viewport?.anchorTimestamp ?? null,
      anchorX: viewport?.anchorX ?? null,
      timeframe,
      indicatorIds: Array.from(activeIndicators),
      indicatorParamsById,
      indicatorPlacement,
      indicatorMASettings,
      showGridOverlay,
      showSrOverlay,
      barSpace,
      offsetRightDistance
    };
  };

  // 🆕 Autosave do estado de sessão (sessionStorage) a cada mudança de indicador/
  // timeframe/grade/S/R — é o que faz o gráfico sobreviver a trocar de seção do
  // app sem exigir nenhuma ação manual do usuário (ver useChartSessionState.ts).
  // Roda depois da 1ª restauração da sessão/favorito (refs acima), senão o efeito
  // reescreveria a sessão com o estado em branco ANTES do useEffect de init aplicar
  // o que tinha sido salvo.
  // 🐛 FIX (bug real relatado pelo Cleber: trocar de TIMEFRAME "perdia" o setup,
  // não obedecendo ao que tinha acabado de ser salvo/adicionado): este save era
  // DEBOUNCED (300ms via setTimeout), pensado só pra não gravar a cada tecla. Só
  // que trocar de timeframe RECRIA o chart (dispose+init, ver efeito de init logo
  // abaixo) e relê este MESMO sessionStorage pra restaurar os indicadores -- se a
  // troca de timeframe acontecesse a menos de 300ms de ter adicionado/editado um
  // indicador (comum, é só um clique), a leitura pegava o snapshot ANTIGO (sem a
  // mudança) e reconstruía o gráfico em cima dele, descartando a mudança recente
  // de vez -- mesma causa raiz do bug já corrigido de "some ao trocar de seção"
  // (aquele cobria só o desmonte real do componente; troca de timeframe não
  // desmonta, só reinicializa o chart dentro do mesmo componente montado, então
  // aquele fix não alcançava este caso). `sessionStorage.setItem` é síncrono e
  // barato (poucos KB) -- não há motivo real pra debounce aqui. Fix: grava na
  // hora, sem timer, eliminando a janela de corrida por completo.
  useEffect(() => {
    if (!initialRestoreDoneRef.current) return;
    saveSessionState(user?.id, captureCurrentChartConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndicators, indicatorParamsById, indicatorPlacement, indicatorMASettings, timeframe, showGridOverlay, showSrOverlay, user?.id]);

  // 🐛 FIX (bug real relatado pelo Cleber: média móvel recém-adicionada "sumia" ao
  // trocar de seção do app -- ex: Gráfico -> Dashboard -> Gráfico -- e voltar): o
  // autosave acima é DEBOUNCED (300ms) de propósito, pra não gravar no sessionStorage
  // a cada tecla/clique. Mas `ChartView` é DESMONTADO a cada troca de seção (SPA, ver
  // comentário em useChartSessionState.ts) -- o cleanup do efeito de autosave só fazia
  // `clearTimeout`, cancelando o save pendente sem nunca escrevê-lo. Se o usuário
  // trocasse de seção em menos de 300ms depois de adicionar/editar um indicador
  // (comum -- é só um clique), o sessionStorage ficava com o estado de ANTES dessa
  // última mudança, e ela "sumia" ao voltar. Fix: efeito separado, com cleanup que só
  // roda no DESMONTE de verdade (deps `[]`), gravando de forma síncrona e imediata
  // (sem debounce) o estado mais recente via ref -- garante que a última mudança
  // sempre sobrevive à troca de seção, mesmo que tenha acontecido um instante antes.
  const captureCurrentChartConfigRef = useRef(captureCurrentChartConfig);
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    captureCurrentChartConfigRef.current = captureCurrentChartConfig;
    userIdRef.current = user?.id;
  });

  // 🆕 Persistência do VIEWPORT (zoom + scroll horizontal). O autosave de sessão acima
  // só dispara quando muda indicador/timeframe/grade/S-R — dar zoom não mexe em nenhum
  // desses, então o zoom só era gravado no desmonte do componente. Isso bastava pra
  // troca de seção, mas não pra recarregar a página nem pra qualquer caminho que não
  // passe pelo cleanup. Aqui o zoom/scroll é gravado assim que o usuário para de
  // mexer (debounce curto — onZoom/onScroll disparam a cada frame do gesto).
  const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistChartViewportRef = useRef<() => void>(() => {});
  useEffect(() => {
    persistChartViewportRef.current = () => {
      if (!initialRestoreDoneRef.current) return;
      if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
      viewportSaveTimerRef.current = setTimeout(() => {
        saveSessionState(userIdRef.current, captureCurrentChartConfigRef.current());
      }, 250);
    };
  });
  useEffect(() => {
    return () => {
      // 🐛 Um save de viewport agendado (debounce de 250ms) que dispare DEPOIS do
      // desmonte leria um chart já `dispose()`ado e sobrescreveria com lixo o
      // snapshot bom gravado logo abaixo. Cancela antes de gravar o definitivo.
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = null;
      }
      if (initialRestoreDoneRef.current) {
        saveSessionState(userIdRef.current, captureCurrentChartConfigRef.current());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🆕 Remove todos os indicadores ativos do chart (mas não mexe no state React --
  // quem chama é responsável por atualizar activeIndicators/etc depois). Usado antes
  // de aplicar um template pra não deixar instância órfã de um indicador que o
  // template não usa.
  const clearAllChartIndicators = (chart: any) => {
    activeIndicators.forEach(id => {
      const indicator = INDICATORS.find(ind => ind.id === id);
      if (indicator) {
        try { removeIndicatorInstance(chart, indicator); } catch (_) {}
      }
    });
    // 🐛 FIX: `removeIndicatorInstance` já limpa `maInstancesRef.current[id]` pra cada
    // indicador conhecido, mas se sobrar qualquer resíduo (ex: indicador removido do
    // catálogo desde então) as próximas instâncias de MA recriadas por
    // `applyChartTemplateConfig` herdariam instâncias fantasma. Zera tudo aqui.
    maInstancesRef.current = {};
  };

  // 🆕 Aplica um ChartTemplateConfig salvo diretamente no chart (via API do klinecharts,
  // nunca via getIndicatorParams/getMASettings -- que leem state React, assíncrono
  // demais pra estar pronto na mesma passada). Usado tanto na 1ª carga (setup favorito)
  // quanto sob demanda ("Templates › Carregar", com ou sem troca de timeframe).
  const applyChartTemplateConfig = (chart: any, templateConfig: ChartTemplateConfig) => {
    const appliedIds: string[] = [];
    // 🐛 FIX: precisa ser o valor MIGRADO (com `.lines`), não o `templateConfig.indicatorMASettings`
    // bruto salvo -- ver comentário abaixo, no loop, sobre o bug real que isso causava.
    const migratedMASettings: Record<string, MAUISettings> = {};
    templateConfig.indicatorIds.forEach(id => {
      const indicatorConfig = INDICATORS.find(ind => ind.id === id);
      if (!indicatorConfig) return; // indicador removido/renomeado desde o save
      const placement = templateConfig.indicatorPlacement[id] ?? (indicatorConfig.isPaneIndicator ? 'pane' : 'overlay');
      if (isMovingAverageIndicator(indicatorConfig)) {
        // 🐛 FIX (bug real relatado pelo Cleber: 2 médias móveis iguais salvas em
        // template, só 1 sobrevivia): `templateConfig.indicatorIds` só tem UMA entrada
        // por TIPO de indicador ("ma"), nunca uma por instância ("ma__2") -- só
        // `indicatorMASettings` guarda todas as instâncias (ver `addMALineDirect`, que
        // grava cada instância extra sob a chave `${id}__${n}`). Antes este loop lia
        // só `templateConfig.indicatorMASettings[id]` (a 1ª instância) e recriava um
        // único indicador -- as extras ficavam salvas no banco mas nunca eram lidas.
        // Fix: descobre TODAS as chaves de `indicatorMASettings` que pertencem a este
        // indicador (a própria `id`, ou `${id}__N`) e recria uma instância por chave,
        // igual ao fluxo de "Adicionar outra média" (`addMALineDirect`).
        const instanceIds = Object.keys(templateConfig.indicatorMASettings)
          .filter(key => key === id || key.startsWith(`${id}__`));
        if (instanceIds.length === 0) instanceIds.push(id);

        let created = false;
        instanceIds.forEach((instanceId, variantIndex) => {
          const raw = (templateConfig.indicatorMASettings[instanceId] as any) ?? getMASettings(indicatorConfig);
          // Templates salvos antes do suporte a múltiplas linhas guardavam {period, color,
          // lineStyle, lineWidth} direto no objeto -- migra pro formato novo {lines: [...]}
          // na hora de carregar, sem quebrar template antigo.
          const settings: MAUISettings = Array.isArray(raw?.lines)
            ? raw
            : { shift: raw.shift ?? 0, method: raw.method ?? 'SIMPLE', appliedPrice: raw.appliedPrice ?? 'CLOSE', lines: [{ period: raw.period ?? 20, color: raw.color ?? '#f97316', lineStyle: raw.lineStyle ?? 'solid', lineWidth: raw.lineWidth ?? 1 }] };
          // 🐛 FIX (achado real, relatado pelo Cleber): `setIndicatorMASettings` usava
          // `templateConfig.indicatorMASettings` DIRETO (o `raw` de cima, não migrado) --
          // pra um setup favorito salvo em formato antigo, o GRÁFICO desenhava com o
          // `settings` migrado (período correto, ex. 20) mas o estado React que alimenta
          // o editor ficava com o objeto bruto sem `.lines`. Guarda aqui o MESMO `settings`
          // migrado que foi de fato desenhado, pra estado e gráfico nunca mais divergirem.
          migratedMASettings[instanceId] = settings;

          const variantKlinechartsName = MA_VARIANT_KLINECHARTS_NAME(indicatorConfig.klinechartsName, variantIndex);
          const config: any = { name: variantKlinechartsName, id: instanceId, ...buildMAChartConfig(variantKlinechartsName, settings) };
          try {
            let paneId: string;
            if (placement === 'pane') {
              paneId = variantIndex === 0 ? `pane_${id}` : `pane_${id}_extra_${variantIndex + 1}`;
              chart.createIndicator(config, false, { id: paneId });
            } else {
              paneId = 'candle_pane';
              chart.createIndicator(config, true, { id: paneId });
            }
            if (variantIndex === 0) indicatorPaneIdRef.current[id] = paneId;
            maInstancesRef.current[id] = [...(maInstancesRef.current[id] ?? []), { instanceId, klinechartsName: variantKlinechartsName, paneId }];
            created = true;
          } catch (error) {
            console.error('[ChartView] ❌ Erro aplicando instância de média móvel do template:', instanceId, error);
          }
        });
        if (created) appliedIds.push(id);
      } else {
        const config: any = { name: indicatorConfig.klinechartsName, id: indicatorConfig.id };
        const params = templateConfig.indicatorParamsById[id] ?? indicatorConfig.defaultParams ?? [];
        if (params.length > 0) config.calcParams = params;
        try {
          if (placement === 'pane') {
            chart.createIndicator(config, false, { id: `pane_${indicatorConfig.id}` });
            indicatorPaneIdRef.current[indicatorConfig.id] = `pane_${indicatorConfig.id}`;
          } else {
            chart.createIndicator(config, true, { id: 'candle_pane' });
            indicatorPaneIdRef.current[indicatorConfig.id] = 'candle_pane';
          }
          appliedIds.push(id);
        } catch (error) {
          console.error('[ChartView] ❌ Erro aplicando indicador do template:', indicatorConfig.id, error);
        }
      }
    });

    setActiveIndicators(new Set(appliedIds));
    setIndicatorParamsById(templateConfig.indicatorParamsById);
    setIndicatorPlacement(templateConfig.indicatorPlacement);
    setIndicatorMASettings(migratedMASettings);
    setShowGridOverlay(templateConfig.showGridOverlay);
    if (templateConfig.showSrOverlay !== showSrOverlay) {
      setShowSrOverlay(templateConfig.showSrOverlay);
    }

    // Posição/zoom em tela por último -- criar indicador em painel próprio pode
    // redimensionar o pane principal e desfazer o offset se aplicado antes.
    try {
      // 🐛 FIX: barSpace/offsetRightDistance são valores em PIXELS, salvos crus na
      // sessão em que o template foi criado -- não são portáveis pra outra sessão
      // com largura de janela e/ou quantidade de candles carregados diferente.
      // Restaurar sem limite podia deixar candles enormes (barSpace grande) e/ou
      // uma folga de scroll enorme (offsetRightDistance grande), sobrando margem
      // em branco nas duas laterais em vez de preencher a tela -- exatamente o
      // sintoma relatado ("indicadores no meio da tela"). Trava os dois valores a
      // um range que sempre preenche o container atual.
      const containerWidth = chartContainerRef.current?.clientWidth ?? 0;
      const candleCount = chart.getDataList().length;

      if (templateConfig.barSpace !== null && templateConfig.barSpace !== undefined) {
        let barSpaceToApply = templateConfig.barSpace;
        if (containerWidth > 0 && candleCount > 0) {
          // 🐛 FIX (2026-08-20): o piso original era 60 candles visíveis -- mas o
          // barSpace máximo que a própria klinecharts permite já resulta em bem
          // menos que 60 candles cabendo na tela em qualquer largura razoável de
          // container. Ou seja, esse piso brigava com zoom legítimo: todo template
          // salvo com o usuário zoomado além de ~60 candles era desfeito ao
          // carregar, obrigando reajustar o zoom manualmente toda vez (bug
          // relatado pelo Cleber). Piso reduzido pra só proteger o caso
          // degenerado (poucos candles visíveis a ponto de não dar pra ler nada),
          // não pra limitar zoom de verdade.
          const minVisibleCandles = Math.min(candleCount, 5);
          const maxBarSpaceToFill = containerWidth / minVisibleCandles;
          barSpaceToApply = Math.min(barSpaceToApply, maxBarSpaceToFill);
        }
        chart.setBarSpace(barSpaceToApply);
      }
      // ⚠️ ORDEM IMPORTA: `setOffsetRightDistance` recalcula internamente a posição
      // de scroll (`_lastBarRightSideDiffBarCount = offset / barSpace`), ou seja
      // devolve o gráfico pro tempo real. Por isso ele vem ANTES da restauração da
      // posição real, e só existe pra manter a folga configurada de templates
      // antigos (salvos antes da âncora de posição existir).
      if (templateConfig.offsetRightDistance !== null && templateConfig.offsetRightDistance !== undefined) {
        // Folga à direita do último candle nunca maior que ~15% da largura do
        // container -- um offset gigante herdado de outra sessão empurra os
        // candles reais pra longe da borda direita, deixando a mesma margem em
        // branco indevida.
        const maxOffset = containerWidth > 0 ? containerWidth * 0.15 : templateConfig.offsetRightDistance;
        chart.setOffsetRightDistance(Math.min(templateConfig.offsetRightDistance, maxOffset));
      }

      // 🆕 Posição real onde o usuário deixou o gráfico (ver readChartScrollPosition).
      if (templateConfig.anchorTimestamp && typeof templateConfig.anchorX === 'number') {
        applyChartScrollPosition(chart, templateConfig.anchorTimestamp, templateConfig.anchorX);
      }
    } catch (error) {
      console.warn('[ChartView] ⚠️ Não foi possível restaurar zoom/posição do template:', error);
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
  // nunca deixa duas instâncias do mesmo indicador na tela ao mesmo tempo. Se o
  // indicador AINDA NÃO estiver ativo, os botões "No gráfico"/"Painel abaixo" também
  // servem pra ligá-lo ali mesmo (antes só reposicionava um indicador já ligado —
  // clicar em "No gráfico" num indicador desligado não fazia nada, bug real: o usuário
  // clicava achando que estava adicionando o indicador e ele nunca aparecia no gráfico).
  const changeIndicatorPlacement = (indicator: IndicatorConfig, placement: 'overlay' | 'pane') => {
    setIndicatorPlacement(prev => ({ ...prev, [indicator.id]: placement }));
    const chart = chartInstanceRef.current;
    if (!chart) return;
    try {
      if (!activeIndicators.has(indicator.id)) {
        createIndicatorInstance(chart, indicator, placement);
        setActiveIndicators(prev => new Set(prev).add(indicator.id));
        return;
      }
      // ⚠️ Limitação conhecida (mesmo padrão já aceito pras instâncias extras de
      // indicador genérico, ver `genericIndicatorExtraPaneIdsRef`): reposicionar remove
      // TODAS as instâncias de média móvel desse indicador (`removeIndicatorInstance`
      // limpa `maInstancesRef` inteiro), mas `createIndicatorInstance` só recria a 1ª.
      // Instâncias extras (2ª, 3ª... de "Adicionar outra média") não sobrevivem a uma
      // troca de "No gráfico"/"Painel abaixo" -- caso raro, não tratado por ora.
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

  // Mesmo padrão acima, agora pro ícone de editar (⚙) — abre o editor de MA ou o
  // genérico conforme o tipo do indicador clicado.
  const openMAEditorRef = useRef(openMAEditor);
  useEffect(() => {
    openMAEditorRef.current = openMAEditor;
  });
  const openIndicatorEditorRef = useRef(openIndicatorEditor);
  useEffect(() => {
    openIndicatorEditorRef.current = openIndicatorEditor;
  });
  const removeMAInstanceRef = useRef(removeMAInstance);
  useEffect(() => {
    removeMAInstanceRef.current = removeMAInstance;
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
        // 🆕 Modo Magnético (ver toggle no DrawingToolbar) -- weak_magnet faz os pontos
        // do desenho encaixarem no OHLC do candle mais próximo em vez de ficarem soltos
        // em qualquer coordenada crua do mouse. Suporte nativo da klinecharts.
        mode: magnetActive ? OverlayMode.WeakMagnet : OverlayMode.Normal,
        onClick: (event: any) => {
          if (overlayType === 'infoLine') {
            const existingText = typeof event.overlay?.extendData === 'string' ? event.overlay.extendData : '';
            setInfoLineText(existingText);
            infoLineTextRef.current = existingText;
            setInfoLineEditor({ overlayId: event.overlay.id, x: event.x ?? 0, y: event.y ?? 0 });
          } else {
            const clickedId = event.overlay.id;
            // 🔧 FIX: 1º clique só seleciona + destaca (linha fica levemente mais grossa);
            // só um 2º clique NO MESMO desenho já selecionado abre o menu -- ver comentário
            // completo na declaração de `selectedDrawingIdRef` acima. Isso também resolve o
            // menu abrindo sozinho no clique que TERMINA de desenhar (esse clique final é o
            // "1º clique" deste desenho, então agora só seleciona).
            if (selectedDrawingIdRef.current && selectedDrawingIdRef.current !== clickedId) {
              clearDrawingSelectionHighlight(selectedDrawingIdRef.current);
            }
            if (selectedDrawingIdRef.current === clickedId && showContextToolbarRef.current) {
              // Já selecionado e com o menu aberto -- clicar de novo FECHA o menu (mesmo
              // gesto abre/fecha), mantendo o destaque de "selecionado".
              setShowContextToolbar(false);
            } else if (selectedDrawingIdRef.current === clickedId) {
              // Já selecionado, menu fechado -- este clique é o "acionar" pedido pelo Cleber:
              // abre o menu perto de onde o usuário clicou (não mais fixo no topo-centro,
              // que ficava em cima do painel de compra/venda).
              const chartRect = chartContainerRef.current?.getBoundingClientRect();
              if (chartRect) {
                const TOOLBAR_WIDTH = 420;
                const TOOLBAR_HEIGHT = 56;
                // 🔧 event.x/event.y da klinecharts são relativos ao CONTAINER do gráfico
                // (mesma convenção já usada pelo infoLineEditor/textAnnotationEditor, ambos
                // `position:absolute` DENTRO do container) -- mas este menu usa
                // `position:fixed` (coordenada de viewport), então precisa somar
                // chartRect.left/top pra converter, senão abre fora do lugar.
                const rawX = chartRect.left + (event.x ?? chartRect.width / 2) + 12;
                const rawY = chartRect.top + (event.y ?? 50) - TOOLBAR_HEIGHT - 12;
                setContextToolbarPosition({
                  x: Math.min(Math.max(rawX, chartRect.left + 8), chartRect.right - TOOLBAR_WIDTH - 8),
                  y: Math.min(Math.max(rawY, chartRect.top + 8), chartRect.bottom - TOOLBAR_HEIGHT - 8)
                });
              }
              setShowContextToolbar(true);
            } else {
              // Seleciona um desenho novo (ou troca de um pra outro) -- só destaca, o menu
              // fica oculto por padrão (comportamento pedido: "via de regra ela fica oculta").
              selectedDrawingIdRef.current = clickedId;
              applyDrawingSelectionHighlight(clickedId);
              setSelectedDrawing({
                id: clickedId,
                type: event.overlay.name,
                isLocked: !!event.overlay.lock,
                isHidden: event.overlay.visible === false
              });
              setShowContextToolbar(false);
            }
          }
          return true;
        }
      });
      
      if (overlayId) {
        console.log('[ChartView] ✅ Overlay created with ID:', overlayId);
        userDrawingOverlayIdsRef.current.push(overlayId); // 🔧 FIX: rastreia pra sobreviver a troca de timeframe/símbolo

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

  // 🆕 Emoji escolhido no picker → próximo clique DE VERDADE no gráfico ancora o emoji ali
  // 🔧 FIX: antes criava o overlay na hora (sem `points`), contando com o próprio clique de
  // escolher o emoji no picker pra completar o desenho — como o picker fica visualmente por
  // cima do canvas, o marcador nascia grudado onde o emoji foi escolhido, não onde o usuário
  // realmente clicava depois. Agora só guarda o emoji pendente; a criação real acontece no
  // onClick do container do chart (ver `pendingEmoji` mais abaixo), com `points` explícitos.
  const handleEmojiSelect = (emoji: string) => {
    if (!chartInstanceRef.current) {
      toast.error('Aguarde o carregamento do gráfico');
      return;
    }
    setPendingEmoji(emoji);
    toast.success(`${emoji} selecionado`, {
      description: 'Clique no gráfico para posicionar',
      duration: 2500
    });
  };

  // 🆕 CONTEXT TOOLBAR HANDLERS
  const handleDrawingDelete = () => {
    if (!chartInstanceRef.current || !selectedDrawing) return;

    try {
      chartInstanceRef.current.removeOverlay(selectedDrawing.id);
      userDrawingOverlayIdsRef.current = userDrawingOverlayIdsRef.current.filter(id => id !== selectedDrawing.id); // 🔧 FIX: mantém o rastreamento coerente
      delete originalOverlayStylesRef.current[selectedDrawing.id]; // apagado -- nada a restaurar depois
      if (selectedDrawingIdRef.current === selectedDrawing.id) selectedDrawingIdRef.current = null;
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
      const dupId = chart.createOverlay({
        name: original.name,
        groupId: USER_DRAWINGS_GROUP,
        points: shiftedPoints,
        styles: original.styles,
        extendData: original.extendData
      });
      if (dupId) {
        userDrawingOverlayIdsRef.current.push(dupId as string); // 🔧 FIX: rastreia pra sobreviver a troca de timeframe/símbolo
      }
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
      userDrawingOverlayIdsRef.current = []; // 🔧 FIX: limpa o rastreamento junto — senão a próxima troca de timeframe "ressuscitava" desenhos apagados
      userDrawingsSnapshotRef.current = [];

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
  const TIMEFRAME_INTERVALS_MS: Record<Timeframe, number> = {
    '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
    '1H': 3600000, '2H': 7200000, '4H': 14400000,
    '1D': 86400000, '1W': 604800000, '1M': 2592000000,
  };

  useEffect(() => {
    const updateCountdown = () => {
      const interval = TIMEFRAME_INTERVALS_MS[timeframe];

      // Ancora o cronômetro no timestamp real do último candle recebido do
      // servidor (Binance/MetaAPI), não em Date.now() % interval — o boundary
      // assumido em UTC puro diverge do fechamento real quando o candle vem
      // de um servidor MT5 em outro fuso.
      //
      // 🔴 FIX 2026-08-27: antes lia `chartDataRef.current[last].timestamp`,
      // que também é escrito pelo "chute" de virada de vela local (não é dado
      // do servidor, ver comentário na declaração de `lastRealCandleTimestampRef`)
      // — as duas fontes discordando entre si é o que causava o cronômetro
      // saltar minutos de forma descontínua. Agora só a âncora confirmada por
      // fetch real é usada.
      const anchor = lastRealCandleTimestampRef.current;
      if (anchor === null) {
        setCandleCountdown(interval);
        return;
      }

      const elapsedSinceOpen = Date.now() - anchor;
      if (elapsedSinceOpen >= interval) {
        // Já deveria ter virado, mas o próximo candle real ainda não chegou
        // (fetch periódico/streaming) — nunca fabricar o próximo boundary por
        // adivinhação: trava em 00:00 até a âncora real confirmar a virada,
        // em vez de contar pra frente sobre um período que ainda não existe.
        setCandleCountdown(0);
        return;
      }
      setCandleCountdown(interval - elapsedSinceOpen);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeframe, chartData]);

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

  // 🆕 2026-08-24: Suporte/Resistência do gráfico virou o motor de Order
  // Block (Smart Money Concepts) — pesquisa do Cleber testou a lógica do
  // indicador de terceiro "Order Block Finder" (MT5) como estratégia de
  // ENTRADA e não achou edge estatístico (ver
  // research/experiments/2026-08-24-order-block-fade/verdict.md), mas o
  // padrão visual em si (zona onde já houve reação de preço antes) é
  // exatamente o que o Cleber queria ver desenhado no gráfico, como
  // referência — não como sinal de trade. Substitui o clustering de preço
  // antigo (`detectLiquidityZones`, heurística sem base em price action
  // real) pelo motor SMC já existente e testado (`src/app/services/smc`).
  const detectOrderBlockZones = (data: Candle[], symbol: string, tf: string): SmcZone[] => {
    if (data.length < 20) return [];
    return analyzeSmc(data, symbol, tf).orderBlocks.filter((z) => !z.mitigated);
  };

  // Quanto estender a caixa do Order Block adiante do último candle
  // carregado, em ms — 20 barras do timeframe atual, mesmo efeito visual do
  // indicador original (a zona "flutua" à frente do preço).
  const timeframeToMs = (tf: string): number => {
    const match = /^(\d+)([mHDW])$/.exec(tf) || /^(\d+)([mhdw])$/i.exec(tf);
    if (!match) return 15 * 60_000; // fallback: 15min
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const unitMs = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 604_800_000;
    return n * unitMs;
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
      const zones = analysis.orderBlocks.filter((z) => !z.mitigated);
      macroSrZonesRef.current.set(symbol, { zones, fetchedAt: Date.now() });
      return zones;
    } catch (err) {
      if (!(err instanceof BacktestDataUnavailableError)) {
        console.warn('[ChartView] ⚠️ Falha ao buscar estrutura macro (SMC 1D) pro S/R:', err);
      }
      return cached?.zones ?? [];
    }
  };

  // Combina os order blocks da janela curta (candles carregados no gráfico)
  // com os order blocks macro (SMC 1D, ~5 anos) — mantém as zonas como
  // RETÂNGULOS (não colapsa num preço médio como a versão antiga fazia),
  // já que é exatamente essa forma que o Cleber pediu pra replicar. Descarta
  // duplicata (zonas de fontes diferentes cujo range se sobrepõe) e mantém a
  // de maior força; corta pro teto de zonas visíveis pra não poluir o gráfico.
  const MAX_ORDER_BLOCK_ZONES = 10;
  const combineOrderBlockZones = (intradayZones: SmcZone[], macroZones: SmcZone[]): SmcZone[] => {
    const combined = [...intradayZones, ...macroZones].sort((a, b) => b.strength - a.strength);
    const deduped: SmcZone[] = [];
    combined.forEach((zone) => {
      const isDuplicate = deduped.some(
        (existing) => zone.priceLow <= existing.priceHigh && zone.priceHigh >= existing.priceLow
      );
      if (!isDuplicate) deduped.push(zone);
    });
    return deduped.slice(0, MAX_ORDER_BLOCK_ZONES);
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

  // 🆕 2026-08-24: Desenha (ou limpa) as zonas de Order Block (Smart Money
  // Concepts) direto no gráfico — substitui as linhas finas de S/R antigas
  // por RETÂNGULOS que replicam o "Order Block Finder" (indicador MT5 de
  // terceiro que o Cleber pediu pra trazer pro produto, ver
  // research/experiments/2026-08-24-order-block-fade/hypothesis.md). É
  // exibição de referência visual, não sinal de entrada — o backtest da
  // mesma sessão não achou edge estatístico usando essa zona como gatilho
  // de trade (verdict.md do mesmo experimento).
  //
  // Zona bearish (order_block_bearish, formada antes de rompimento de
  // baixa) fica acima do preço subsequente = resistência/supply → azul,
  // mesma leitura do indicador original. Zona bullish (order_block_bullish,
  // formada antes de rompimento de alta) fica abaixo = suporte/demand →
  // verde. Cada zona se estende do candle de origem até `extendMs` à frente
  // do último candle carregado (mesmo efeito visual do indicador: a caixa
  // "flutua" adiante no tempo).
  //
  // Sempre limpa os overlays anteriores antes de criar os novos — evita
  // vazamento de zona de um ativo pro outro e permite ligar/desligar via
  // recriação (klinecharts nesta versão não tem flag nativa de visibilidade).
  const MAX_SR_OVERLAYS = 6;
  const renderSrOverlays = (zones: SmcZone[], visible: boolean, lastCandleTimestamp: number, extendMs: number) => {
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

    // Prioriza as zonas mais FORTES (já vem ordenado/deduplicado por
    // combineOrderBlockZones) — corta pro teto de zonas visíveis.
    const selected = zones.slice(0, MAX_SR_OVERLAYS);
    const zoneEndTime = lastCandleTimestamp + extendMs;

    selected.forEach((zone) => {
      const isResistance = zone.type === 'order_block_bearish'; // formado antes de rompimento de baixa = fica acima = resistência
      const overlayId = `ob_${zone.id}`;
      const color = isResistance ? 'rgba(59,130,246,0.18)' : 'rgba(34,197,94,0.18)';
      const borderColor = isResistance ? '#3b82f6' : '#22c55e';
      const label = `${isResistance ? 'R' : 'S'} OB ${((zone.priceHigh + zone.priceLow) / 2).toFixed(2)}`;

      try {
        chart.createOverlay({
          name: 'rectShape',
          id: overlayId,
          lock: true,
          points: [
            { timestamp: zone.startTime, value: zone.priceHigh },
            { timestamp: Math.max(zoneEndTime, zone.startTime + extendMs), value: zone.priceLow }
          ],
          styles: { rect: { color, borderColor } },
          extendData: label
        });
        srOverlayIdsRef.current.push(overlayId);
      } catch (e) {
        console.warn('[ChartView] ⚠️ Não foi possível desenhar zona de Order Block:', e);
      }

      // 🆕 Linha horizontal clássica de S/R, na borda da zona voltada pro preço
      // (resistência: base do retângulo; suporte: topo) — o Cleber pediu de
      // volta além do retângulo, que sozinho não deixa claro qual preço exato
      // é o nível de reação.
      const lineId = `ob_line_${zone.id}`;
      const lineLevel = isResistance ? zone.priceLow : zone.priceHigh;
      try {
        chart.createOverlay({
          name: 'horizontalStraightLine',
          id: lineId,
          lock: true,
          points: [{ value: lineLevel }],
          styles: { line: { color: borderColor, style: 'dashed', size: 1 } },
          extendData: label
        });
        srOverlayIdsRef.current.push(lineId);
      } catch (e) {
        console.warn('[ChartView] ⚠️ Não foi possível desenhar linha de S/R:', e);
      }
    });
  };

  // 🆕 Desenha as posições abertas (DEMO ou LIVE, incluindo as abertas pela
  // boleta manual) direto no gráfico — linha de entrada + SL/TP, mesmo padrão
  // visual/técnico de renderSrOverlays (horizontalStraightLine, groupId
  // próprio pra limpar sem afetar desenho do usuário). Só desenha posições do
  // símbolo selecionado — trocar de ativo limpa as linhas do ativo anterior.
  const renderPositionOverlays = (orders: TradeVisual[], symbol: string, pending: PendingOrderVisual[] = []) => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    const symbolOrders = orders.filter((o) => o.symbol === symbol);

    // 🔴 2026-08-28/29: antes disto removia TODAS as overlays de posição e
    // recriava do zero a cada render — mesmo quando só o P&L ao vivo (tick de
    // preço, ~1s) mudava e nada da posição em si (entrada/SL/TP) tinha
    // mudado. O gráfico observa `activeOrders` por referência e essa troca
    // acontece a cada tick, então as linhas piscavam (remove+recria)
    // continuamente. Agora só remove/recria o que realmente saiu (posição
    // fechada) ou entrou (posição nova); pra ordens que continuam abertas,
    // atualiza a overlay existente no lugar via overrideOverlay (mesmo
    // padrão já usado no resto do arquivo pra desenhos do usuário).
    const currentIds = new Set(symbolOrders.map((o) => o.id));
    // 🔴 2026-08-31: a regex só reconhecia prefixos `position_(entry|sl|tp)_`
    // — ids de ordem PENDENTE (`pending_${id}`, criados no bloco abaixo) não
    // batiam, então `orderId` ficava igual ao id inteiro (`pending_123`), que
    // nunca está em `currentIds` (que só tem ids de posição aberta). Resultado:
    // toda linha de ordem pendente era marcada "não existe mais" e
    // removida+recriada A CADA render (a cada tick de P&L, ~1s) — o piscar
    // intermitente reportado pelo Cleber. Ordens pendentes têm seu próprio
    // ciclo de vida (criadas 1x, sem override — ver bloco `pending.forEach`
    // abaixo), então não pertencem a esta checagem: ignora ids `pending_*` aqui.
    const idsToRemove = positionOverlayIdsRef.current.filter((id) => {
      if (id.startsWith('pending_')) return false;
      const orderId = id.replace(/^position_(entry|sl|tp)_/, '');
      return !currentIds.has(orderId);
    });
    idsToRemove.forEach((id) => {
      try {
        chart.removeOverlay(id);
      } catch (e) {
        // overlay pode já ter sido removido (troca de ativo, dispose) — ignora
      }
    });
    positionOverlayIdsRef.current = positionOverlayIdsRef.current.filter((id) => !idsToRemove.includes(id));

    symbolOrders.forEach((order) => {
      const isLong = order.side === 'LONG';
      const entryId = `position_entry_${order.id}`;
      const slId = `position_sl_${order.id}`;
      const tpId = `position_tp_${order.id}`;
      const entryExists = positionOverlayIdsRef.current.includes(entryId);
      const slExists = positionOverlayIdsRef.current.includes(slId);
      const tpExists = positionOverlayIdsRef.current.includes(tpId);

      // Unidades da posição (mesma conta usada no PNL LOOP de useApexLogic.ts
      // pra P&L ao vivo): amount é o valor em dólar da posição, amount/preço
      // dá as "unidades" que convertem distância de preço em dólar.
      const units = order.amount / order.price;
      const hasSl = order.sl > 0;
      const hasTp = order.tp > 0;
      const riskPts = hasSl ? Math.abs(order.price - order.sl) : 0;
      const rewardPts = hasTp ? Math.abs(order.tp - order.price) : 0;
      const riskUsd = riskPts * units;
      const rewardUsd = rewardPts * units;
      const rr = hasSl && hasTp && riskPts > 0 ? rewardPts / riskPts : null;

      try {
        // P&L ao vivo na própria linha da posição — reflete o preço atual do
        // tick (order.currentPrice, atualizado a cada ciclo do PNL LOOP em
        // useApexLogic.ts) e o P&L em dólar já calculado lá (currentProfit).
        // Pontos = distância favorável ao lado da posição (positivo quando o
        // preço se move a favor, negativo contra), não a diferença bruta.
        const livePrice = order.currentPrice ?? order.price;
        const pointsFavorable = isLong ? livePrice - order.price : order.price - livePrice;
        const pnl = order.currentProfit ?? 0;
        const pnlSign = pnl >= 0 ? '+' : '';
        const pointsSign = pointsFavorable >= 0 ? '+' : '';
        const liveStats = ` · ${pnlSign}$${pnl.toFixed(2)} (${pointsSign}${pointsFavorable.toFixed(2)} pts)`;
        const rrLabel = rr != null ? ` · R:R 1:${rr.toFixed(1)}` : '';
        const entryExtendData = `${isLong ? '▲ COMPRA' : '▼ VENDA'} ${order.price.toFixed(2)}${rrLabel}${order.reasoning === 'Ordem manual do usuário' ? ' · MANUAL' : ''}${liveStats}`;

        // 🔴 2026-08-29: atualiza a overlay existente no lugar (preço +
        // texto de P&L ao vivo) em vez de remove+recria — é isto que
        // elimina o piscar a cada tick, já que o `points`/`extendData` mudam
        // sem a linha sumir do gráfico entre um frame e outro.
        if (entryExists) {
          chart.overrideOverlay({ id: entryId, points: [{ value: order.price }], extendData: entryExtendData });
        } else {
          chart.createOverlay({
            name: 'positionLabelLine',
            id: entryId,
            points: [{ value: order.price }],
            styles: {
              line: { color: isLong ? '#22c55e' : '#ef4444', style: 'solid', size: 1.5 },
              text: {
                color: '#ffffff',
                backgroundColor: isLong ? 'rgba(34,197,94,0.92)' : 'rgba(239,68,68,0.92)',
                borderColor: isLong ? '#16a34a' : '#dc2626',
                borderSize: 1,
                borderRadius: 3,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                size: 11,
                weight: 'bold',
              },
            },
            extendData: entryExtendData,
          });
          positionOverlayIdsRef.current.push(entryId);
        }
      } catch (e) {
        console.warn('[ChartView] ⚠️ Não foi possível desenhar linha de entrada da posição:', e);
      }

      if (hasSl) {
        try {
          const slExtendData = `⛔ Stop ${order.sl.toFixed(2)}  ·  −$${riskUsd.toFixed(2)}  ·  ${riskPts.toFixed(2)} pts`;
          if (slExists) {
            chart.overrideOverlay({ id: slId, points: [{ value: order.sl }], extendData: slExtendData });
          } else {
            chart.createOverlay({
              name: 'positionLabelLine',
              id: slId,
              points: [{ value: order.sl }],
              styles: {
                line: { color: '#ef4444', style: 'dashed', size: 1 },
                text: {
                  color: '#ffffff',
                  backgroundColor: 'rgba(239,68,68,0.85)',
                  borderColor: '#dc2626',
                  borderSize: 1,
                  borderRadius: 3,
                  paddingLeft: 5,
                  paddingRight: 5,
                  paddingTop: 2,
                  paddingBottom: 2,
                  size: 10,
                },
              },
              // Custo em dólar sempre negativo (é o que se perde se o stop for
              // atingido) + distância em pontos, pra visualizar risco real sem
              // precisar calcular de cabeça.
              extendData: slExtendData,
            });
            positionOverlayIdsRef.current.push(slId);
          }
        } catch (e) {
          // silencioso — mesma tolerância do resto dos overlays de sistema
        }
      } else if (slExists) {
        try { chart.removeOverlay(slId); } catch (e) { /* ignora */ }
        positionOverlayIdsRef.current = positionOverlayIdsRef.current.filter((id) => id !== slId);
      }

      if (hasTp) {
        try {
          const tpExtendData = `🎯 Alvo ${order.tp.toFixed(2)}  ·  +$${rewardUsd.toFixed(2)}  ·  ${rewardPts.toFixed(2)} pts`;
          if (tpExists) {
            chart.overrideOverlay({ id: tpId, points: [{ value: order.tp }], extendData: tpExtendData });
          } else {
            chart.createOverlay({
              name: 'positionLabelLine',
              id: tpId,
              points: [{ value: order.tp }],
              styles: {
                line: { color: '#22c55e', style: 'dashed', size: 1 },
                text: {
                  color: '#ffffff',
                  backgroundColor: 'rgba(34,197,94,0.85)',
                  borderColor: '#16a34a',
                  borderSize: 1,
                  borderRadius: 3,
                  paddingLeft: 5,
                  paddingRight: 5,
                  paddingTop: 2,
                  paddingBottom: 2,
                  size: 10,
                },
              },
              // Ganho potencial em dólar (sempre positivo, é o alvo) + pontos.
              extendData: tpExtendData,
            });
            positionOverlayIdsRef.current.push(tpId);
          }
        } catch (e) {
          // silencioso — mesma tolerância do resto dos overlays de sistema
        }
      } else if (tpExists) {
        try { chart.removeOverlay(tpId); } catch (e) { /* ignora */ }
        positionOverlayIdsRef.current = positionOverlayIdsRef.current.filter((id) => id !== tpId);
      }
    });

    // Linhas tracejadas (cor neutra) pra ordem pendente ainda não disparada.
    // Arrastável (reposiciona o gatilho) e cancelável com clique direito —
    // sem isso a ordem só podia ser criada e esperada até disparar, sem
    // nenhuma forma de ajustar ou desistir dela depois de postada.
    // 🔴 2026-08-31: remove só as pendentes que saíram de verdade (cancelada/
    // disparada) — antes este bloco recriava TODAS incondicionalmente a cada
    // render (mesmo padrão de piscar do fix acima, só que sempre, não só
    // quando havia posição aberta em paralelo).
    const pendingSymbolOrders = pending.filter((o) => o.symbol === symbol);
    const currentPendingIds = new Set(pendingSymbolOrders.map((o) => `pending_${o.id}`));
    const pendingIdsToRemove = positionOverlayIdsRef.current.filter(
      (id) => id.startsWith('pending_') && !currentPendingIds.has(id)
    );
    pendingIdsToRemove.forEach((id) => {
      try { chart.removeOverlay(id); } catch (e) { /* ignora */ }
    });
    positionOverlayIdsRef.current = positionOverlayIdsRef.current.filter((id) => !pendingIdsToRemove.includes(id));

    pendingSymbolOrders.forEach((order) => {
      const isBuy = order.side === 'LONG';
      const pendingId = `pending_${order.id}`;
      if (positionOverlayIdsRef.current.includes(pendingId)) {
        try {
          chart.overrideOverlay({ id: pendingId, points: [{ value: order.triggerPrice }] });
        } catch (e) {
          // silencioso — mesma tolerância do resto dos overlays de sistema
        }
        return;
      }
      try {
        chart.createOverlay({
          name: 'positionLabelLine',
          id: pendingId,
          points: [{ value: order.triggerPrice }],
          styles: {
            line: { color: '#94a3b8', style: 'dashed', size: 1 },
            text: { color: '#0f172a', backgroundColor: 'rgba(148,163,184,0.9)', size: 10 },
          },
          extendData: `${order.orderType} ${isBuy ? 'COMPRA' : 'VENDA'} ${order.triggerPrice.toFixed(2)}  ·  arraste pra mover · clique direito pra cancelar`,
          onPressedMoveEnd: (event) => {
            const newPrice = event.overlay?.points?.[0]?.value;
            const price = currentPriceRef.current;
            if (typeof newPrice !== 'number' || price == null) return false;
            const result = updateManualPendingOrderPrice(order.id, newPrice, price);
            if (!result.success) {
              toast.error(result.error ?? 'Não foi possível mover a ordem');
              // Overlay já foi redesenhado no valor errado pelo próprio klinecharts —
              // força a re-renderização no valor antigo (a única fonte de verdade
              // continua sendo o pendingOrders do TradingContext).
              renderPositionOverlays(activeOrders, selectedSymbol, pendingOrders);
            }
            return false;
          },
          onRightClick: () => {
            cancelManualPendingOrder(order.id);
            toast.success('Ordem pendente cancelada');
            return true;
          },
        });
        positionOverlayIdsRef.current.push(pendingId);
      } catch (e) {
        // silencioso — mesma tolerância do resto dos overlays de sistema
      }
    });
  };

  // Redesenha as linhas de posição sempre que uma posição/ordem pendente
  // abre/fecha ou o usuário troca de ativo — inclui as abertas pela boleta
  // manual, já que todas passam pelo mesmo TradingContext.
  useEffect(() => {
    renderPositionOverlays(activeOrders, selectedSymbol, pendingOrders);
  }, [activeOrders, pendingOrders, selectedSymbol]);

  // Verifica a cada tick de preço se alguma ordem pendente (limit/stop) do
  // ativo selecionado cruzou o gatilho — único lugar do app que tem o preço
  // ao vivo do símbolo atual, por isso o watcher mora aqui, não no hook.
  useEffect(() => {
    if (currentPrice != null) {
      checkPendingOrderTriggers(selectedSymbol, currentPrice);
    }
  }, [currentPrice, selectedSymbol, checkPendingOrderTriggers]);

  // 🆕 Re-desenha (ou limpa) as linhas de S/R só quando o toggle muda — as
  // zonas em si já são desenhadas no momento em que são calculadas (dentro do
  // efeito de fetch de candles, via showSrOverlayRef pra sempre ler o valor
  // mais recente sem precisar recriar o gráfico inteiro a cada toggle).
  useEffect(() => {
    const lastCandle = chartDataRef.current[chartDataRef.current.length - 1];
    if (!lastCandle) return;
    const extendMs = timeframeToMs(timeframe) * 20;
    renderSrOverlays(orderBlockZones, showSrOverlay, lastCandle.timestamp, extendMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orderBlockZones intencionalmente fora: já é redesenhado no momento do cálculo
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

    // 🔄 RESET da flag de primeira carga quando símbolo/timeframe mudam.
    //
    // 🐛 BUG REAL encontrado nesta sessão: este reset ficava depois de um
    // `return () => {...}` (cleanup) incondicional dentro do `try` mais abaixo
    // -- ou seja, no caminho feliz (sem exceção), esse `return` já encerra a
    // função do efeito antes do código chegar aqui. Resultado: depois da
    // primeira carga bem-sucedida, `isInitialLoadRef.current` virava `false`
    // (linha que marca "primeira carga concluída") e NUNCA MAIS voltava a
    // `true` em nenhuma troca de símbolo/timeframe seguinte -- o código de
    // scroll (`chart.scrollToRealTime()`) então pulava pra sempre em toda
    // troca subsequente ("Skipping auto-scroll - não é primeira carga",
    // confirmado no console), mesmo com um chart NOVO (dispose+init) sendo
    // recriado do zero a cada troca. Sem nenhum scroll aplicado, o chart novo
    // ficava com o zoom/posição padrão da lib pra um dataset recém-criado --
    // que, com milhares de candles carregados (fix da régua de 5 anos),
    // aparecia como um único candle gigante ocupando a tela inteira. Fix:
    // reset movido pra ANTES do `return` -- roda sempre, de verdade, a cada
    // troca de símbolo/timeframe, antes até de `fetchData()` ser chamado.
    isInitialLoadRef.current = true;
    // 🐛 BUG REAL irmão do acima (mesma causa, achado em 2026-08-20): troca de
    // símbolo/timeframe recria o chart do zero (dispose()+init()), então ele
    // nasce sem nenhum indicador. `sessionStateAppliedRef`/`favoriteSetupAppliedRef`
    // são guardas "aplica só 1x" que nunca resetavam depois da 1ª carga —
    // então na 1ª troca de ativo dentro da mesma sessão, o bloco de restauração
    // (mais abaixo) via a guarda já `true` e pulava a reaplicação: indicadores
    // (ex: MACD) somem ao trocar de ativo e nunca mais voltam sozinhos, nem
    // trocando de novo. Reset aqui, no mesmo ponto que já reseta
    // `isInitialLoadRef` por este exato motivo — roda a cada troca de
    // símbolo/timeframe, antes de `fetchData()`.
    sessionStateAppliedRef.current = false;
    favoriteSetupAppliedRef.current = false;
    // 🛡️ Limpa o buffer de candles da carga anterior — sem isso, o tick de streaming
    // que chega ANTES do histórico novo carregar via um candle velho (de outro
    // símbolo/timeframe) no ref, passava na checagem length > 0 e aplicava
    // chart.updateData num gráfico vazio → um único candle gigante na tela até o
    // applyNewData do fetch substituir tudo ("gráfico buga e depois volta").
    chartDataRef.current = [];
    lastRealCandleTimestampRef.current = null; // 🔴 FIX cronômetro: âncora também reseta na troca de símbolo/timeframe
    console.log('[ChartView] 🔄 Flag isInitialLoad resetada (novo símbolo/timeframe)');

    // 🎯 Eixo de PREÇO com mais marcações — versão anterior nunca funcionava:
    // (a) usava `coord: 0` fixo achando que a klinecharts recalculava a posição
    //     (não recalcula — o coord retornado por createTicks é usado direto pra
    //     desenhar, então todo tick "denso" era desenhado empilhado em y=0);
    // (b) `chart.setPaneOptions({axisOptions:{name:'dense-ticks'}})` era chamado
    //     SEM `id` — `_setPaneOptions` da lib descarta a chamada inteira quando
    //     `options.id` não é string (visto lendo node_modules/klinecharts/dist/
    //     index.esm.js), então o eixo denso nunca era de fato ativado.
    // Fix: deriva o mapeamento linear valor→pixel a partir de 2 ticks que a
    // própria klinecharts já calculou certo (extremos de defaultTicks), gera
    // ~1 marcação a cada 28px (era só ~8 no total, o range/8.0 fixo da lib) e
    // ativa o eixo custom no pane certo (candle_pane) via setPaneOptions({id}).
    try {
      registerYAxis({
        name: 'dense-ticks',
        createTicks: (params) => {
          const { bounding, defaultTicks } = params;
          if (defaultTicks.length < 2) return defaultTicks;

          const first = defaultTicks[0];
          const last = defaultTicks[defaultTicks.length - 1];
          const firstValue = Number(first.value);
          const lastValue = Number(last.value);
          if (!isFinite(firstValue) || !isFinite(lastValue) || firstValue === lastValue) {
            return defaultTicks;
          }

          const coordAt = (value: number) =>
            first.coord + ((value - firstValue) / (lastValue - firstValue)) * (last.coord - first.coord);
          const valueAt = (coord: number) =>
            firstValue + ((coord - first.coord) / (last.coord - first.coord)) * (lastValue - firstValue);

          // mesma quantidade de casas decimais que a klinecharts já escolheu
          const decimals = (first.text.split('.')[1] || '').length;

          // 🎯 A klinecharts sempre deixa uma margem própria entre o `defaultTicks[0]`/
          // `[last]` e a borda REAL do painel (bounding.height) -- é essa margem
          // interna da lib (não o gap.top/bottom do pane, já reduzido a 1.5%) que
          // fazia a régua de preço "não chegar" nas pontas, mesmo com mais ticks
          // interpolados entre os 2 extremos antigos. Fix: extrapola o valor de
          // preço nas bordas de verdade (coord 0 e bounding.height, com 6px de
          // respiro pra não cortar o texto do 1º/último tick) e gera a régua densa
          // a partir DESSAS bordas, não mais dos 2 ticks default (que já vinham
          // encolhidos).
          const edgeMargin = 6;
          const topValue = valueAt(edgeMargin);
          const bottomValue = valueAt(bounding.height - edgeMargin);

          const targetCount = Math.max(defaultTicks.length, Math.floor(bounding.height / 28));
          const step = (bottomValue - topValue) / (targetCount - 1);
          if (!isFinite(step) || step === 0) return defaultTicks;

          const ticks: AxisTick[] = [];
          for (let i = 0; i < targetCount; i++) {
            const value = topValue + step * i;
            ticks.push({ coord: coordAt(value), value, text: value.toFixed(decimals) });
          }
          return ticks;
        }
      });

      // 🎯 Eixo de TEMPO com mais marcações — mesma técnica, aplicada ao eixo X
      registerXAxis({
        name: 'dense-ticks',
        createTicks: (params) => {
          const { bounding, defaultTicks } = params;
          if (defaultTicks.length < 2) return defaultTicks;

          const first = defaultTicks[0];
          const last = defaultTicks[defaultTicks.length - 1];
          const firstValue = Number(first.value);
          const lastValue = Number(last.value);
          if (!isFinite(firstValue) || !isFinite(lastValue) || firstValue === lastValue) {
            return defaultTicks;
          }

          const coordAt = (value: number) =>
            first.coord + ((value - firstValue) / (lastValue - firstValue)) * (last.coord - first.coord);
          const valueAt = (coord: number) =>
            firstValue + ((coord - first.coord) / (last.coord - first.coord)) * (lastValue - firstValue);

          // 🎯 Mesma margem embutida da klinecharts já corrigida no eixo Y: o
          // `defaultTicks[last]` para antes do candle mais recente (penúltimo
          // candle exibido em tela), deixando o trecho final da régua de tempo
          // sem marcação nenhuma.
          //
          // IMPORTANTE: a régua de tempo não é decorativa -- o horário exibido
          // na borda direita tem que ser o horário REAL do candle em formação
          // agora (relógio do usuário), não uma extrapolação por slope médio.
          // Extrapolar usando o delta de tempo entre os 2 ticks default mais
          // distantes (`first`/`last`) é impreciso quando há gaps reais no
          // tempo (fim de semana, pausa de pregão) entre eles -- o slope médio
          // do range inteiro não bate com o slope local perto da borda "agora".
          // offsetRight:0 (configurado no chart) garante que o último candle
          // real sempre encosta na borda direita do painel -- por isso usamos
          // o timestamp REAL do último candle carregado (chartDataRef, sempre
          // atualizado a cada tick do candle em formação) como referência da
          // borda, em vez de extrapolar. Só cai na extrapolação por slope se,
          // por algum motivo, não houver candle carregado ainda.
          const edgeMargin = 6;
          const lastRealCandle = chartDataRef.current[chartDataRef.current.length - 1];
          const lastRealTimestamp = lastRealCandle ? Number(lastRealCandle.timestamp) : NaN;
          const rightValue = isFinite(lastRealTimestamp) && lastRealTimestamp > firstValue
            ? lastRealTimestamp
            : valueAt(bounding.width - edgeMargin);

          // rótulo de data ocupa mais espaço horizontal que o de preço —
          // espaçamento mínimo maior (~90px em vez de 28px)
          const targetCount = Math.max(defaultTicks.length, Math.floor(bounding.width / 90));
          const step = (rightValue - firstValue) / (targetCount - 1);
          if (!isFinite(step) || step === 0) return defaultTicks;

          const useShortTime = step < 20 * 60 * 60 * 1000; // <20h entre marcações: mostra hora, não só data
          const pad = (n: number) => String(n).padStart(2, '0');

          const ticks: AxisTick[] = [];
          for (let i = 0; i < targetCount; i++) {
            const value = firstValue + step * i;
            const d = new Date(value);
            const text = useShortTime
              ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
              : `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            ticks.push({ coord: coordAt(value), value, text });
          }
          return ticks;
        }
      });

      console.log('[ChartView] ✅ Eixos densos (preço + tempo) registrados');
    } catch (e) {
      console.log('[ChartView] ℹ️ Registro de eixo denso:', e);
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

      // 🔴 FIX 2026-08-28: dispose()+init() acima recria o chart do zero — todo
      // overlay desenhado nele (inclusive as linhas de entrada/SL/TP de
      // posição aberta) é destruído junto. Mas `positionOverlayIdsRef` não era
      // limpo aqui, então na próxima chamada de renderPositionOverlays() o
      // código achava que a linha "já existe" (entryExists/slExists/tpExists
      // true, baseado no ref antigo) e só chamava overrideOverlay() — que não
      // faz nada num id que não existe mais no chart novo. Resultado: a linha
      // simplesmente sumia e nunca mais voltava, mesmo com a posição
      // continuando aberta de verdade. Limpar o ref aqui força o próximo
      // render a recriar do zero (createOverlay) em vez de tentar atualizar
      // um overlay fantasma.
      positionOverlayIdsRef.current = [];

      // 🎯 Ativa os eixos densos — `id` é obrigatório (sem ele, setPaneOptions
      // não faz NADA, ver comentário acima de onde o eixo é registrado).
      chart.setPaneOptions({
        id: 'candle_pane',
        axisOptions: { name: 'dense-ticks' },
        // 🎯 default da klinecharts é gap.top:0.2/gap.bottom:0.1 (20%/10% da
        // amplitude de preço reservados como espaço vazio acima/abaixo dos
        // candles antes do primeiro/último grid) — reduzido ao mínimo (1.5%)
        // pra o gráfico ocupar quase toda a altura do painel, sem espaço morto
        // em cima nem embaixo (não dá pra zerar de vez: sem NENHUMA folga o
        // pavio mais alto/baixo encosta exatamente na borda do painel).
        gap: { top: 0.015, bottom: 0.015 },
      });
      chart.setPaneOptions({
        id: 'x_axis_pane',
        axisOptions: { name: 'dense-ticks' }
      });
      console.log('[ChartView] ✅ Eixos densos (preço + tempo) ativados');

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
        // (config completa de `indicator` fica só na chave abaixo, perto de `separator` --
        // ter duas chaves `indicator:` neste mesmo objeto literal é um erro silencioso em
        // JS: a segunda sobrescreve a primeira por completo, perdendo `tooltip.icons` sem
        // nenhum aviso em runtime; só apareceu porque o build denunciou "Duplicate key").
        grid: {
          show: showGridOverlay,
          horizontal: {
            show: showGridOverlay,
            size: 1,
            color: '#2a2a2a',
            style: 'solid',
          },
          vertical: {
            show: showGridOverlay,
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
            show: true,
            size: 1,
            color: '#4a4a4a',
          },
          // 🎯 tickText.size aqui controla o espaçamento MÍNIMO entre marcações
          // tanto do eixo de tempo quanto (particularidade interna da klinecharts,
          // AxisImp.optimalTicks usa xAxis.tickText.size como referência de altura
          // mesmo pro eixo Y) do eixo de preço. Subido de volta pra 11 (Cleber achou
          // 8 pequeno demais pra ler) — ainda menor que o default 12 da lib, então
          // continua cabendo mais marcações que o padrão original.
          tickText: {
            size: 11,
            marginStart: 4,
            marginEnd: 4,
          },
        },
        yAxis: {
          show: true,
          size: 85,
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
            size: 11,
            family: 'Arial, sans-serif',
            weight: 'normal',
            color: '#9ca3af', // 🎯 Cinza (era branco #e0e0e0) -- só a fonte, fundo continua preto
            marginStart: 4,
            marginEnd: 4,
          },
        },
        // ✅ Ícone de excluir (✕) na legenda de TODO indicador — precisa ser setado aqui
        // (estilo global), não no config de criação de cada indicador: a klinecharts só lê
        // chart.getStyles().indicator.tooltip.icons para desenhar/registrar clique dos ícones
        // da legenda, ignorando por completo qualquer `styles.tooltip.icons` passado por
        // instância em createIndicator() (confirmado lendo IndicatorTooltipView.drawIndicatorTooltip
        // em node_modules/klinecharts/dist/index.esm.js — por isso o ícone nunca aparecia/clicava).
        indicator: {
          tooltip: {
            icons: [INDICATOR_SETTINGS_ICON, INDICATOR_CLOSE_ICON],
            // ⚠️ marginTop igual ao marginTop dos ícones (6, ver INDICATOR_SETTINGS_ICON/
            // INDICATOR_CLOSE_ICON) -- a klinecharts desenha o texto e cada ícone em
            // `y: coordinate.y + marginTop` de forma independente (mesmo baseline "y" de
            // topo, sem centralização automática entre os dois); com marginTop diferente
            // (o default do texto é 4, o dos ícones é 6) o texto laranja ficava ~2px acima
            // dos ícones ⚙/✕. Descer o texto pra bater com o marginTop dos ícones alinha
            // os dois na mesma linha de base.
            text: {
              marginTop: 6,
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

      // Fechar toolbar e desselecionar (removendo o destaque) ao clicar no gráfico fora de
      // qualquer overlay
      chart.subscribeAction('onClick', (data: any) => {
        if (!data?.overlay) {
          clearDrawingSelectionHighlight(selectedDrawingIdRef.current);
          selectedDrawingIdRef.current = null;
          setShowContextToolbar(false);
          setSelectedDrawing(null);
        }
      });
      
      // 🆕 Detectar scroll manual do usuário (desabilita auto-scroll permanentemente)
      chart.subscribeAction('onScroll', () => {
        if (!isInitialLoadRef.current) {
          console.log('[ChartView] 🖱️ Usuário scrollou manualmente - auto-scroll desabilitado');
        }
        persistChartViewportRef.current();
      });
      
      // 🆕 Detectar zoom do usuário
      chart.subscribeAction('onZoom', () => {
        console.log('[ChartView] 🔍 Usuário deu zoom');
        persistChartViewportRef.current();
      });

      // 🆕 Ícones "⚙"/"✕" na legenda do indicador (ver INDICATOR_SETTINGS_ICON/
      // INDICATOR_CLOSE_ICON) — clicar edita parâmetros ou remove o indicador direto no
      // gráfico, sem precisar abrir o modal de Indicadores nem o antigo box flutuante.
      // data = { paneId, indicatorName (nome real na klinecharts, ex: 'RSI'), iconId }.
      chart.subscribeAction('onTooltipIconClick', (data: any) => {
        // 🆕 Primeiro tenta achar como INSTÂNCIA de média móvel (`name` variante, ex:
        // MA__2) -- cada instância tem sua própria linha na legenda com seu próprio
        // ⚙/✕ (ver `addMALineDirect`/`maInstancesRef`), então precisa resolver qual
        // instância exata foi clicada antes de cair no fallback abaixo (que só conhece
        // a 1ª instância de cada indicador, via `indicatorPaneIdRef`).
        for (const ind of INDICATORS) {
          if (!isMovingAverageIndicator(ind)) continue;
          const instances = maInstancesRef.current[ind.id] ?? [];
          const found = instances.find(inst => inst.klinechartsName === data?.indicatorName && inst.paneId === data?.paneId);
          if (!found) continue;
          if (data.iconId === 'remove') {
            removeMAInstanceRef.current(ind, found.instanceId);
          } else if (data.iconId === 'settings') {
            openMAEditorRef.current(ind, false, found.instanceId);
          }
          return;
        }
        const matched = INDICATORS.find(
          (ind) => ind.klinechartsName === data?.indicatorName && indicatorPaneIdRef.current[ind.id] === data?.paneId
        );
        if (!matched) return;
        if (data.iconId === 'remove') {
          toggleIndicatorRef.current(matched);
        } else if (data.iconId === 'settings') {
          if (isMovingAverageIndicator(matched)) {
            openMAEditorRef.current(matched);
          } else if ((matched.defaultParams?.length ?? 0) > 0) {
            openIndicatorEditorRef.current(matched);
          }
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
            
            // 🔥 FIX 2026-08-20: em timeframes onde o carimbo de tempo das velas
            // não alinha com resetTime (ex: 1D/1W da Binance começam à 00:00 UTC,
            // não 06:00 UTC), `find(c => c.timestamp >= resetTime)` nunca casava
            // e caía em `candles[0].open` — a vela MAIS ANTIGA de todo o
            // histórico carregado (até ~5 anos), fazendo a variação "de hoje"
            // exibir na verdade a variação desde uma data muito mais antiga
            // (achado real: ETH mostrando ~18% "hoje" que era variação de dias/
            // semanas). Fix: se não houver vela após o reset, usar o close da
            // última vela ANTES do reset (a mais próxima do instante real),
            // nunca a mais antiga do array inteiro.
            const firstCandleAfterReset = candles.find(c => c.timestamp >= resetTime);
            let openPriceFromCandles: number;
            if (firstCandleAfterReset) {
              openPriceFromCandles = firstCandleAfterReset.open;
            } else {
              const lastCandleBeforeReset = [...candles].reverse().find(c => c.timestamp <= resetTime);
              openPriceFromCandles = lastCandleBeforeReset ? lastCandleBeforeReset.close : lastCandle.open;
            }

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

          // 🐛 FIX (bug real relatado pelo Cleber: "não persiste a posição que foi
          // deixada no gráfico"): `applyNewData` reseta o viewport internamente
          // (ChartStore.clear() + resetOffsetRightDistance()) a cada refresh de 30s.
          // A tentativa anterior de contornar isso salvava/restaurava
          // `offsetRightDistance` -- que NÃO é a posição do usuário, e cuja
          // reescrita recalcula `_lastBarRightSideDiffBarCount = offset / barSpace`.
          // Ou seja: o "fix" fazia exatamente o oposto do pretendido, forçando o
          // gráfico de volta ao tempo real toda vez, a cada 30 segundos, por mais
          // que o usuário tivesse rolado pro passado. Agora salvamos a posição real
          // (candle na borda direita + folga em barras) e o zoom, e restauramos os
          // dois depois que o dado novo entra.
          let savedScroll: { anchorTimestamp: number; anchorX: number } | null = null;
          let savedBarSpace: number | null = null;
          if (!isInitialLoadRef.current) {
            savedScroll = readChartScrollPosition(chart);
            try { savedBarSpace = chart.getBarSpace(); } catch (_) {}
          }

          chart.applyNewData(candles);
          console.log('[ChartView] ✅ chart.applyNewData completed!');

          if (savedBarSpace !== null && savedBarSpace > 0) {
            try { chart.setBarSpace(savedBarSpace); } catch (_) {}
          }
          if (savedScroll) {
            applyChartScrollPosition(chart, savedScroll.anchorTimestamp, savedScroll.anchorX);
            console.log('[ChartView] 🔧 Zoom e posição do usuário restaurados após refresh');
          }
          
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

          // Marca que a restauração inicial (sessão ou favorito, com ou sem dado salvo)
          // já rodou -- é o gate que libera o autosave de sessão logo abaixo, pra não
          // sobrescrever um estado salvo com o gráfico ainda em branco ANTES deste
          // bloco aplicar o que tinha sido restaurado.
          initialRestoreDoneRef.current = true;

          // 🔧 FIX: recria os desenhos do usuário capturados no snapshot antes do dispose()
          // (ver cleanup do effect, onde `userDrawingsSnapshotRef` é preenchido). Sem isso,
          // trendline/fibonacci/shapes/texto/emoji desenhados manualmente somem pra sempre
          // a cada troca de timeframe/símbolo — bug real confirmado ao vivo. `points` usa
          // `dataIndex`, que é relativo ao dataset carregado (mesmo símbolo+intervalo de
          // candles reais, já reaplicado acima por `applyNewData`), então a posição visual
          // é preservada corretamente.
          if (userDrawingsSnapshotRef.current.length > 0) {
            const restored: string[] = [];
            userDrawingsSnapshotRef.current.forEach(saved => {
              try {
                const newId = chart.createOverlay({
                  name: saved.name,
                  groupId: USER_DRAWINGS_GROUP,
                  points: saved.points,
                  styles: saved.styles,
                  extendData: saved.extendData,
                  lock: saved.lock,
                  visible: saved.visible
                });
                if (newId) restored.push(newId as string);
              } catch (e) {
                console.warn('[ChartView] ⚠️ Falha ao restaurar desenho do usuário:', saved.name, e);
              }
            });
            userDrawingOverlayIdsRef.current = restored;
            console.log('[ChartView] 🔄', restored.length, 'desenho(s) do usuário restaurado(s) após troca de timeframe/símbolo');
          }

          // 🆕 Restaura o estado "ao vivo" da sessão (indicadores/timeframe de segundos
          // atrás, antes do usuário trocar de seção do app) — tem prioridade sobre o
          // setup favorito, por ser mais recente. Uma única vez por montagem, mesma
          // regra do setup favorito logo abaixo (nunca repete a cada refresh de 30s).
          const sessionState = readSessionState(user?.id);
          if (sessionState && !sessionStateAppliedRef.current) {
            sessionStateAppliedRef.current = true;
            favoriteSetupAppliedRef.current = true; // não aplica os dois — sessão vence
            try {
              // 🐛 FIX (relatado pelo Cleber): o zoom não "segurava" ao trocar de seção
              // nem ao carregar template — este caminho descartava de propósito
              // barSpace/offsetRightDistance do estado de sessão, devolvendo o gráfico
              // pro zoom padrão da lib mesmo tendo o valor salvo em mãos. O estado de
              // sessão é justamente "como o gráfico estava segundos atrás", então o
              // viewport faz parte dele (diferente do setup favorito logo abaixo, que
              // é preferência genérica e continua sem posição fixa).
              //
              // 🐛 FIX 2026-09-02 (achado do Cleber: gráfico abre mostrando candles de
              // dias atrás em vez do preço atual, toda vez que entra na página ou troca
              // de seção e volta): `anchorTimestamp`/`anchorX` guardam a posição EXATA
              // de scroll de quando o usuário parou de olhar — se em algum momento ele
              // rolou pro passado (pra olhar um padrão) e não voltou pro tempo real
              // antes de trocar de seção, essa posição no passado ficava presa pra
              // sempre, reaplicada em toda montagem futura. Decisão do Cleber: o
              // gráfico deve sempre abrir no preço atual por padrão — indicadores/
              // timeframe/zoom (barSpace) continuam sendo restaurados, só a âncora de
              // scroll não.
              //
              // 🐛 FIX 2026-09-02 (2ª parte, achado nesta sessão): nular só
              // `anchorTimestamp`/`anchorX` não bastava — `offsetRightDistance`
              // TAMBÉM guarda posição de scroll, não só margem visual (ver comentário
              // grande em `applyChartTemplateConfig`, onde ele recalcula
              // `_lastBarRightSideDiffBarCount = offset / barSpace` internamente).
              // Uma sessão salva de quando o usuário tinha rolado pro passado carrega
              // um `offsetRightDistance` que reflete aquela posição antiga — aplicá-lo
              // aqui reintroduzia o EXATO mesmo bug (candles de dias atrás) por uma
              // porta que o fix acima não fechou, sobrescrevendo o scrollToRealTime()
              // que já tinha rodado logo acima. `barSpace` (zoom) sozinho não move a
              // posição, então continua restaurado — só a dupla que afeta posição
              // (anchor + offset) é nulada, igual ao setup favorito já faz mais abaixo.
              applyChartTemplateConfig(chart, { ...sessionState, anchorTimestamp: null, anchorX: null, offsetRightDistance: null });
              console.log('[ChartView] 🔄 Estado de sessão restaurado:', sessionState.indicatorIds, 'barSpace:', sessionState.barSpace);
            } catch (error) {
              console.error('[ChartView] ❌ Erro restaurando estado de sessão:', error);
            }
          } else if (favoriteSetup && !favoriteSetupAppliedRef.current) {
            // 🆕 Aplica o setup favorito do usuário (indicadores + parâmetros, grade, S/R)
            // uma única vez por montagem do componente — não repete a cada refresh de 30s
            // nem a cada troca de símbolo/timeframe (favoriteSetupAppliedRef nunca reseta).
            // Construído direto do objeto salvo (nunca via getIndicatorParams/getMASettings,
            // que leem o state React — assíncrono demais pra estar pronto aqui).
            favoriteSetupAppliedRef.current = true;
            try {
              // Setup favorito não guarda barSpace/offsetRightDistance (é "como eu gosto
              // de ver qualquer gráfico", não uma posição fixa) — undefined preserva o
              // scroll automático já feito acima (scrollToRealTime).
              applyChartTemplateConfig(chart, { ...favoriteSetup, barSpace: null, offsetRightDistance: null, anchorTimestamp: null, anchorX: null });
              console.log('[ChartView] ⭐ Setup favorito aplicado:', favoriteSetup.indicatorIds);
            } catch (error) {
              console.error('[ChartView] ❌ Erro aplicando setup favorito:', error);
            }
          }

          // 🆕 Template carregado via menu "Templates" que exigiu troca de timeframe
          // primeiro (dispose()+init() do chart) — só dá pra aplicar indicadores/posição
          // DEPOIS que os dados do timeframe novo chegarem, por isso fica "pendente" até
          // este ponto do próximo fetchData.
          if (pendingTemplateApplyRef.current) {
            const templateToApply = pendingTemplateApplyRef.current;
            pendingTemplateApplyRef.current = null;
            try {
              // 🐛 FIX 2026-09-02: mesma decisão do estado de sessão acima — nunca
              // restaura a âncora de scroll salva no template, só indicadores/zoom.
              applyChartTemplateConfig(chart, { ...templateToApply, anchorTimestamp: null, anchorX: null });
              console.log('[ChartView] 📐 Template pendente aplicado após troca de timeframe');
            } catch (error) {
              console.error('[ChartView] ❌ Erro aplicando template pendente:', error);
            }
          }

          // 🎯 Configurar precisão de preço para exibição correta na régua
          chart.setPriceVolumePrecision(2, 0); // 2 casas decimais para preço, 0 para volume
          console.log('[ChartView] 🎯 Precision set to 2 decimal places');
          
          // ✅ Sobrescrever formatação de números do eixo Y (remover separador de milhares)
          chart.setStyles({
            yAxis: {
              tickText: {
                size: 11,
                marginStart: 4,
                marginEnd: 4,
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
          // 🔴 FIX cronômetro: âncora do countdown só avança com dado REAL do servidor.
          lastRealCandleTimestampRef.current = lastCandle.timestamp;
          
          // Detecta zonas de Order Block (SMC) na janela curta carregada no gráfico
          const zones = detectOrderBlockZones(candles, selectedSymbol, timeframe);
          const extendMs = timeframeToMs(timeframe) * 20;
          setOrderBlockZones(zones);
          renderSrOverlays(zones, showSrOverlayRef.current, lastCandle.timestamp, extendMs);
          console.log('[ChartView] 🎯 Detected', zones.length, 'order block zones');

          // 🐛 FIX: troca de timeframe/ativo dispara dispose()+init() do chart
          // (linhas acima) — um chart novo não tem overlay nenhum, e o
          // useEffect que desenha posição/ordem pendente só reage a mudança
          // de activeOrders/pendingOrders/selectedSymbol, nunca de timeframe.
          // Resultado: trocar o timeframe com uma posição aberta fazia a
          // linha sumir do gráfico até a próxima mudança em activeOrders. O
          // S/R acima já não tinha esse problema por já redesenhar aqui —
          // mesma correção, mesmo ponto (chart pronto, dados já aplicados).
          // 🐛 2026-09-02: usa os refs (sempre atualizados), não o
          // `activeOrders`/`pendingOrders` fechados no momento em que este
          // fetchData foi criado (ver comentário grande em activeOrdersRef).
          renderPositionOverlays(activeOrdersRef.current, selectedSymbol, pendingOrdersRef.current);

          // 🆕 Busca a estrutura de longo prazo (SMC, 1D/~5 anos) em paralelo e, quando
          // chegar, re-desenha o S/R combinando com a janela curta acima — sem isso as
          // linhas nunca refletiam níveis reais mais distantes no tempo (ex: uma máxima
          // histórica) mesmo quando esses níveis são os mais próximos do preço atual.
          const macroSymbolAtFetch = selectedSymbol;
          fetchMacroSrZones(macroSymbolAtFetch).then((macroZones) => {
            if (macroSymbolAtFetch !== selectedSymbol) return; // ativo já trocou, descarta
            if (macroZones.length === 0) return;
            const merged = combineOrderBlockZones(zones, macroZones);
            setOrderBlockZones(merged);
            renderSrOverlays(merged, showSrOverlayRef.current, lastCandle.timestamp, extendMs);
            console.log('[ChartView] 🎯 Order Blocks combinados com estrutura macro (SMC):', merged.length, 'zonas');
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
        // 🔧 FIX: captura os desenhos do usuário ANTES do dispose() (troca de símbolo/
        // timeframe roda este cleanup antes de recriar o chart do zero) — sem isso,
        // trendline/fibonacci/shapes/texto ancorado/emoji desenhados pelo usuário eram
        // destruídos pra sempre a cada troca, sem nenhum aviso (confirmado ao vivo:
        // desenhar uma linha e trocar de timeframe apagava a linha). Restauração real
        // acontece depois que o chart novo termina de aplicar o dataset (ver bloco perto
        // de `sessionStateAppliedRef.current = true`).
        try {
          if (chartInstanceRef.current) {
            const snapshot = userDrawingOverlayIdsRef.current
              .map(id => chartInstanceRef.current.getOverlayById(id))
              .filter(Boolean)
              .map((o: any) => ({
                name: o.name,
                points: o.points,
                styles: o.styles,
                extendData: o.extendData,
                lock: !!o.lock,
                visible: o.visible !== false
              }));
            userDrawingsSnapshotRef.current = snapshot;
            console.log('[ChartView] 📸 Snapshot de', snapshot.length, 'desenho(s) do usuário antes do dispose');
          }
        } catch (e) {
          console.warn('[ChartView] ⚠️ Falha ao capturar snapshot de desenhos do usuário:', e);
        }
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
    // Intervalo padrão de 2s (ver watchdog abaixo, calibrado em cima desse valor).
    // ✅ 2026-08-31: BTCUSD cota direto da Binance em `/mt5-prices` (não mais
    // via conta MetaAPI compartilhada, ver server/index.ts) — sem o motivo
    // original de manter o intervalo largo (proteger aquela conta), então usa
    // um polling mais curto (1,5s) só pra ele, reduzindo a defasagem visível
    // contra a página ao vivo da Binance (Cleber reportou preço/% "muito
    // errados" mesmo com a rota já correta — BTC se move rápido o bastante
    // pra 2s de defasagem parecer "errado" a olho nu comparando com uma
    // aba da Binance sempre atualizando). Resto dos símbolos mantém os 2s de
    // sempre.
    const priceIntervalMs = selectedSymbol === 'BTCUSD' ? 1500 : 2000;
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
      // 🆕 FIX: preço/% travados SEM nenhum sinal visual -- getRealMarketData cai
      // silenciosamente pro último valor real em cache quando a conta MetaAPI
      // compartilhada falha/tranca (rate-limit 429/504, etc), e o polling continua
      // "funcionando" (sem erro) reaplicando o MESMO valor indefinidamente. Marca
      // quando o tick chegou de verdade pra alimentar o watchdog de "desatualizado" logo abaixo.
      lastPriceTickAtRef.current = Date.now();
      setIsPriceStale(false);

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

        // 🛡️ GUARDA: se o preço novo desviar mais de 10% do candle existente,
        // esse candle não pertence a este ativo/período (resíduo de troca de
        // símbolo/timeframe que escapou do reset) — em vez de esticar high/low
        // a partir de um open/low completamente desconectado (gerava um candle
        // gigante indo do preço antigo até o novo, ex: open~1900 + close~65000
        // no BTCUSD), reinicia o candle inteiro no preço atual.
        const deviatesTooMuch = lastCandle.close > 0 &&
          Math.abs(newPrice - lastCandle.close) / lastCandle.close > 0.10;

        // 🕐 Detecta virada de candle localmente a partir do MESMO timestamp
        // que alimenta o cronômetro (lastCandle.timestamp), em vez de esperar
        // o refresh de 30s trazer o candle novo do servidor — sem isso, o
        // candle "velho" seguia sendo esticado por até 30s depois do
        // cronômetro chegar a zero, ficando visualmente fora de sincronia.
        const intervalMs = TIMEFRAME_INTERVALS_MS[timeframe];
        const candleTurnedOver = !deviatesTooMuch &&
          Date.now() - lastCandle.timestamp >= intervalMs;

        const updatedCandle = (deviatesTooMuch || candleTurnedOver)
          ? {
              ...lastCandle,
              timestamp: candleTurnedOver
                ? lastCandle.timestamp + intervalMs
                : lastCandle.timestamp,
              open: newPrice, high: newPrice, low: newPrice, close: newPrice
            }
          : {
              ...lastCandle,
              close: newPrice,
              high: Math.max(lastCandle.high, newPrice),
              low: Math.min(lastCandle.low, newPrice)
            };

        if (deviatesTooMuch) {
          console.warn('[ChartView] ⚠️ Candle com desvio >10% detectado (provável resíduo de troca de ativo/timeframe) — candle reiniciado no preço atual em vez de esticado.', {
            symbol: selectedSymbol,
            oldClose: lastCandle.close,
            newPrice
          });
        }

        try {
          const updatedData = [...chartDataRef.current];
          if (candleTurnedOver) {
            // Novo candle: acrescenta ao array em vez de sobrescrever o último.
            updatedData.push(updatedCandle);
          } else {
            updatedData[updatedData.length - 1] = updatedCandle;
          }
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
    }, priceIntervalMs);

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

  // 🆕 Watchdog de "preço desatualizado" -- o polling de 2s acima nunca para de rodar
  // mesmo quando toda tentativa falha (getRealMarketData cai pro último valor real em
  // cache, sem erro nenhum pra quem está olhando a tela). Se nenhum tick de verdade
  // chegou nos últimos 15s (7x o intervalo normal — folga generosa pra latência de rede),
  // assume que o pipeline está travado/degradado e sinaliza na UI, em vez de deixar o
  // preço/% congelados parecendo normais pra sempre.
  useEffect(() => {
    lastPriceTickAtRef.current = Date.now();
    setIsPriceStale(false);
    const STALE_THRESHOLD_MS = 15000;
    const watchdog = setInterval(() => {
      setIsPriceStale(Date.now() - lastPriceTickAtRef.current > STALE_THRESHOLD_MS);
    }, 3000);
    return () => clearInterval(watchdog);
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
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1.5">
                  Preço Atual
                  {/* 🆕 Sinal visual de dado travado -- ver watchdog no useEffect logo
                      acima da animação suave. Sem isso o usuário só descobria comparando
                      com outra fonte (foi exatamente o que aconteceu: preço/% congelados
                      sem nenhum aviso na tela). */}
                  {isPriceStale && (
                    <span
                      className="flex items-center gap-1 text-amber-400 normal-case tracking-normal"
                      title="Sem atualização de preço nos últimos segundos — pode estar desatualizado (falha temporária na fonte de dados)"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      desatualizado
                    </span>
                  )}
                </div>
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
                  onClick={() => {
                    // Se há um template nomeado ativo, reaplica ele (com o timeframe novo)
                    // depois da troca -- sem isso o template "sumia" ao trocar de timeframe
                    // manualmente, porque a troca faz dispose()+init() do chart.
                    if (activeTemplateConfigRef.current) {
                      pendingTemplateApplyRef.current = { ...activeTemplateConfigRef.current, timeframe: tf };
                    }
                    setTimeframe(tf);
                  }}
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
              } else if (tool === 'zoom_in' || tool === 'zoom_out') {
                // 🆕 Zoom In e Zoom Out (antes só existia "Zoom", que só aproximava).
                // `zoomAtCoordinate` com escala <1 afasta, >1 aproxima; sem coordenada
                // a própria klinecharts usa o centro da área visível.
                try {
                  chartInstanceRef.current?.zoomAtCoordinate(tool === 'zoom_in' ? 1.25 : 0.8, undefined, 200);
                  persistChartViewportRef.current();
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
            onMagnetToggle={setMagnetActive}
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
                // 🔧 FIX: MODO TEXTO agora cria o overlay nativo `textAnnotation` (ancorado a
                // preço/tempo, mesmo mecanismo do emoji/demais desenhos) em vez do <div> HTML
                // solto em pixel de tela de antes -- ver comentário completo na declaração de
                // `textAnnotationEditor`. O editor abre na hora, no mesmo lugar do clique.
                if (isAddingText && chartInstanceRef.current) {
                  try {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const point = chartInstanceRef.current.convertFromPixel(
                      [{ x, y }],
                      { paneId: 'candle_pane' }
                    );
                    const resolved = Array.isArray(point) ? point[0] : point;
                    const overlayId = chartInstanceRef.current.createOverlay({
                      name: 'textAnnotation',
                      groupId: USER_DRAWINGS_GROUP,
                      points: [{ dataIndex: resolved?.dataIndex, value: resolved?.value }],
                      extendData: '',
                      onClick: (event: any) => {
                        const existingText = typeof event.overlay?.extendData === 'string' ? event.overlay.extendData : '';
                        setTextAnnotationText(existingText);
                        textAnnotationTextRef.current = existingText;
                        setTextAnnotationEditor({ overlayId: event.overlay.id, x: event.x ?? 0, y: event.y ?? 0 });
                        return true;
                      }
                    });
                    if (overlayId) {
                      userDrawingOverlayIdsRef.current.push(overlayId);
                      setTextAnnotationText('');
                      textAnnotationTextRef.current = '';
                      setTextAnnotationEditor({ overlayId, x, y });
                    }
                  } catch (err) {
                    console.error('[ChartView] ❌ Error placing text annotation:', err);
                    toast.error('Erro ao criar anotação de texto');
                  } finally {
                    setIsAddingText(false);
                  }
                }

                // 🔧 FIX: emoji pendente (ver `handleEmojiSelect`) só vira overlay real AQUI —
                // no primeiro clique de verdade dentro do container do gráfico, nunca no clique
                // do picker. Converte pixel→dado real via `convertFromPixel` (mesma API já usada
                // em outros pontos do arquivo) pra o marcador nascer exatamente sob o cursor.
                if (pendingEmoji && chartInstanceRef.current) {
                  try {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const point = chartInstanceRef.current.convertFromPixel(
                      [{ x, y }],
                      { paneId: 'candle_pane' }
                    );
                    const resolved = Array.isArray(point) ? point[0] : point;
                    const emojiOverlayId = chartInstanceRef.current.createOverlay({
                      name: 'emojiMarker',
                      groupId: USER_DRAWINGS_GROUP,
                      points: [{ dataIndex: resolved?.dataIndex, value: resolved?.value }],
                      extendData: pendingEmoji
                    });
                    if (emojiOverlayId) {
                      userDrawingOverlayIdsRef.current.push(emojiOverlayId); // 🔧 FIX: rastreia pra sobreviver a troca de timeframe/símbolo
                    }
                  } catch (err) {
                    console.error('[ChartView] ❌ Error placing emoji marker:', err);
                    toast.error('Erro ao posicionar marcador');
                  } finally {
                    setPendingEmoji(null);
                  }
                }
              }}
            >

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

            {/* 📝 EDITOR DA ANOTAÇÃO DE TEXTO — abre ao criar uma nova ou ao clicar numa já
                existente (overlay `textAnnotation`, ancorado a preço/tempo, ver comentário
                completo na declaração de `textAnnotationEditor` acima). Mesmo padrão de
                salvar-ao-sair do editor de "Linha com Informações" logo acima. */}
            {textAnnotationEditor && (
              <div
                className="absolute z-[80]"
                style={{ left: textAnnotationEditor.x, top: textAnnotationEditor.y }}
              >
                <input
                  ref={textAnnotationInputRef}
                  type="text"
                  value={textAnnotationText}
                  onChange={(e) => {
                    setTextAnnotationText(e.target.value);
                    textAnnotationTextRef.current = e.target.value;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      textAnnotationCancelledRef.current = true;
                      const trimmed = textAnnotationText.trim();
                      try {
                        if (trimmed) {
                          chartInstanceRef.current?.overrideOverlay({
                            id: textAnnotationEditor.overlayId,
                            extendData: trimmed
                          });
                          toast.success('Anotação salva');
                        } else {
                          chartInstanceRef.current?.removeOverlay(textAnnotationEditor.overlayId);
                          userDrawingOverlayIdsRef.current = userDrawingOverlayIdsRef.current.filter(id => id !== textAnnotationEditor.overlayId);
                        }
                      } catch (err) {
                        console.error('[ChartView] ❌ Error saving text annotation:', err);
                        toast.error('Erro ao salvar anotação');
                      }
                      setTextAnnotationEditor(null);
                      setTextAnnotationText('');
                    } else if (e.key === 'Escape') {
                      textAnnotationCancelledRef.current = true;
                      // Esc numa anotação recém-criada e ainda vazia descarta o marcador
                      // fantasma; numa já existente, só fecha sem alterar o texto salvo.
                      if (!textAnnotationText.trim()) {
                        try {
                          chartInstanceRef.current?.removeOverlay(textAnnotationEditor.overlayId);
                          userDrawingOverlayIdsRef.current = userDrawingOverlayIdsRef.current.filter(id => id !== textAnnotationEditor.overlayId);
                        } catch (err) {
                          console.error('[ChartView] ❌ Error discarding empty text annotation:', err);
                        }
                      }
                      setTextAnnotationEditor(null);
                      setTextAnnotationText('');
                    }
                  }}
                  onBlur={() => {
                    if (textAnnotationCancelledRef.current) {
                      textAnnotationCancelledRef.current = false;
                      return;
                    }
                    const trimmed = textAnnotationText.trim();
                    try {
                      if (trimmed) {
                        chartInstanceRef.current?.overrideOverlay({
                          id: textAnnotationEditor.overlayId,
                          extendData: trimmed
                        });
                      } else {
                        chartInstanceRef.current?.removeOverlay(textAnnotationEditor.overlayId);
                        userDrawingOverlayIdsRef.current = userDrawingOverlayIdsRef.current.filter(id => id !== textAnnotationEditor.overlayId);
                      }
                    } catch (err) {
                      console.error('[ChartView] ❌ Error saving text annotation on blur:', err);
                    }
                    setTextAnnotationEditor(null);
                    setTextAnnotationText('');
                  }}
                  autoFocus
                  placeholder="Digite o texto..."
                  className="px-2 py-1 bg-gray-800 border border-blue-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px]"
                />
              </div>
            )}

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

            {/* ❌ Removido o box flutuante em HTML que replicava editar/remover por
                indicador no canto direito do gráfico — duplicava os ícones "⚙"/"✕" que a
                própria klinecharts já desenha na legenda de cada indicador (canvas nativo,
                clique tratado em onTooltipIconClick, ver efeito de criação do chart). Editar
                e remover agora só existem ali e no menu de botão direito ("Indicadores
                ativos"), sem o box duplicado do lado direito. */}

            {/* 🆕 Popover de edição de parâmetros do indicador (engrenagem do chip ou
                menu de botão direito) */}
            {indicatorEditor && (
              <div
                // ⚠️ z-[95] -- precisa ficar ACIMA do modal "Indicadores" (z-[90], onde a
                // engrenagem que abre este popover normalmente é clicada) e do modal de
                // busca de ativo (z-[90]/[100]). Em z-[56] original o popover abria de
                // verdade (estado React setado, log confirmando) mas renderizava ESCONDIDO
                // atrás do backdrop do modal -- clique na engrenagem "não fazia nada" na
                // prática, mesmo funcionando por baixo. Mesmo bug em maEditor abaixo.
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[95] bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl p-3 w-56"
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
                diálogo "Moving Average" do MT5, mais suporte a VÁRIAS linhas/períodos na
                mesma instância (ex: MA(20) + MA(50) + MA(200) juntas) — o klinecharts não
                permite duas instâncias do mesmo indicador no mesmo painel, então "adicionar
                outra média móvel" aqui é "adicionar outra linha" na instância existente. */}
            {maEditor && (
              <div
                // ⚠️ z-[95] -- mesmo motivo do indicatorEditor acima (ver comentário lá):
                // precisa ficar acima do modal "Indicadores" (z-[90]) que normalmente abre
                // este popover pela engrenagem do chip.
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[95] bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl p-3 w-80 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs font-semibold text-white mb-3">
                  {maEditor.indicator.name.split(' - ')[0]} — Parâmetros
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
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
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

                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] text-gray-400 uppercase">Linhas ({maEditor.settings.lines.length})</label>
                    <button
                      onClick={addMAEditorLine}
                      className="text-[10px] px-2 py-1 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 transition-colors font-medium"
                    >
                      + Adicionar linha
                    </button>
                  </div>
                  <div className="space-y-2">
                    {maEditor.settings.lines.map((line, index) => (
                      <div key={index} className="flex items-center gap-1.5 bg-black/40 border border-gray-700 rounded p-1.5">
                        <input
                          type="number"
                          min={1}
                          value={line.period}
                          onChange={(e) => updateMAEditorLine(index, { period: Number(e.target.value) })}
                          title="Período"
                          className="w-14 bg-black border border-gray-700 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="color"
                          value={line.color}
                          onChange={(e) => updateMAEditorLine(index, { color: e.target.value })}
                          className="w-7 h-7 shrink-0 bg-black border border-gray-700 rounded cursor-pointer"
                          title="Cor da linha"
                        />
                        <select
                          value={line.lineStyle}
                          onChange={(e) => updateMAEditorLine(index, { lineStyle: e.target.value as 'solid' | 'dashed' })}
                          className="flex-1 min-w-0 bg-black border border-gray-700 rounded px-1 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="solid">Sólida</option>
                          <option value="dashed">Tracejada</option>
                        </select>
                        <select
                          value={line.lineWidth}
                          onChange={(e) => updateMAEditorLine(index, { lineWidth: Number(e.target.value) })}
                          className="w-12 shrink-0 bg-black border border-gray-700 rounded px-1 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value={1}>1px</option>
                          <option value={2}>2px</option>
                          <option value={3}>3px</option>
                          <option value={4}>4px</option>
                        </select>
                        <button
                          onClick={() => removeMAEditorLine(index)}
                          disabled={maEditor.settings.lines.length <= 1}
                          title={maEditor.settings.lines.length <= 1 ? 'Precisa de ao menos 1 linha' : 'Remover esta linha'}
                          className="shrink-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded p-1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
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

            {/* Boleta de ordem manual — flutuante DENTRO do gráfico, estilo one-click
                trading de terminal profissional (MT5/cTrader). Ancorada no canto
                superior DIREITO (não no esquerdo — ali colide com a legenda nativa
                de OHLCV da klinecharts e com o flyout da barra de desenho, que ficam
                no canto superior esquerdo). 2px do topo, 2px à ESQUERDA da régua de
                preços do eixo Y (não da borda do gráfico) — a klinecharts não expõe
                a largura exata do eixo (varia com a quantidade de dígitos do preço),
                então usa a mesma largura aproximada (80px) já calibrada no badge do
                candle countdown logo abaixo ("colado na linha do preço"), +2px de
                respiro. Recolhida por padrão (barra compacta SELL/BUY); expande pra
                ficha completa por dentro do próprio componente. */}
            {/* z-[220] deliberadamente acima de TUDO no gráfico (inclusive do modo
                tela cheia, z-[200] — ver isMaximized acima) + pointer-events-auto
                explícito: nenhum log novo de diagnóstico apareceu no console ao
                clicar, o que só acontece se o clique nunca chega no botão —
                suspeita forte de alguma camada do gráfico (canvas de crosshair/
                desenho, gerenciada fora do React pela klinecharts) capturando o
                clique por cima. Isto elimina essa hipótese de vez. */}
            <div className="absolute top-[17px] right-[99px] z-[220] flex flex-col items-end gap-2">
              <div className="pointer-events-auto">
                <OrderTicket symbol={selectedSymbol} currentPrice={currentPrice} />
              </div>

              {/* 🔥 CANDLE COUNTDOWN -- contador regressivo de quanto falta pro candle
                  atual do timeframe selecionado fechar e o próximo começar. Vive no
                  mesmo wrapper flex da boleta (não mais em offset fixo tipo top-[142px])
                  de propósito: com posições abertas em outros ativos a boleta cresce
                  (banners de aviso empilhados no topo), e um offset fixo fazia esse
                  contador ficar escondido atrás da boleta mais alta -- some visualmente
                  mesmo estando no DOM. Com flex-col ele sempre fica colado embaixo da
                  altura real da boleta, recolhida ou expandida. */}
              <div className="pointer-events-none inline-flex flex-col bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                  <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                    {timeframe}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-white tabular-nums tracking-tight">
                    {formatCountdown(candleCountdown)}
                  </span>
                </div>
                <div className="h-0.5 bg-white/5">
                  <div
                    className="h-full bg-blue-500 transition-[width] duration-1000 ease-linear"
                    style={{
                      width: `${100 - (candleCountdown / TIMEFRAME_INTERVALS_MS[timeframe]) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
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
                  {INDICATORS.filter(ind => activeIndicators.has(ind.id)).map(indicator => {
                    return (
                    <div
                      key={indicator.id}
                      className="flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs"
                    >
                      {/* 🆕 Clicar no próprio nome insere OUTRA instância direto no gráfico, sem
                          abrir modal nenhum -- pedido explícito do Cleber: N cliques = N
                          indicadores distintos, configuração fica pro clique direito no gráfico
                          depois, se precisar. MA/EMA/SMA/WMA vira nova linha na mesma instância
                          (sobreposta no preço); os demais ganham painel próprio a cada clique
                          extra (ver addMALineDirect/addGenericIndicatorInstance). */}
                      <button
                        onClick={() => (isMovingAverageIndicator(indicator) ? addMALineDirect(indicator) : addGenericIndicatorInstance(indicator))}
                        title={isMovingAverageIndicator(indicator) ? 'Adicionar outra média' : 'Adicionar outra instância'}
                        className="text-blue-400 font-medium text-left flex-1 hover:text-blue-300 cursor-pointer"
                      >
                        {indicator.name.split(' - ')[0]}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleIndicator(indicator)}
                          title="Remover indicador"
                          className="text-red-400 hover:text-red-300 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
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
                      {/* 🆕 Clicar no card sempre INSERE uma instância nova direto no gráfico,
                          sem abrir modal -- pedido explícito do Cleber: N cliques = N
                          indicadores distintos (1º clique liga, cada clique seguinte soma mais
                          um). Configuração fica pro clique direito no gráfico depois, se
                          precisar. Desligar tudo é só pela lixeira. */}
                      <button
                        onClick={() => (isMovingAverageIndicator(indicator) ? addMALineDirect(indicator) : addGenericIndicatorInstance(indicator))}
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
      {contextMenu && (() => {
        // 🐛 FIX: o menu tem altura variável (cresce com indicadores ativos, Templates
        // expandido, etc.) e antes sempre abria a partir do ponto do clique pra BAIXO --
        // se o clique fosse na metade de baixo da tela, o menu "nascia" cortado, sem
        // scroll nem reposicionamento, literalmente sumindo no rodapé da página. Agora:
        // se o clique foi na metade de baixo, o menu abre pra CIMA a partir do ponto
        // clicado; se ainda assim não couber tudo, o próprio menu ganha scroll interno
        // (nunca mais fica invisível, na pior das hipóteses rola dentro dele mesmo).
        const openUpward = contextMenu.y > window.innerHeight / 2;
        const left = Math.min(contextMenu.x, window.innerWidth - 380);
        const menuStyle: React.CSSProperties = openUpward
          ? { left, bottom: window.innerHeight - contextMenu.y, maxHeight: contextMenu.y - 8 }
          : { left, top: contextMenu.y, maxHeight: window.innerHeight - contextMenu.y - 8 };
        return (
        <div
          className="fixed bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-2xl py-2 z-[100] min-w-[360px] overflow-y-auto"
          style={menuStyle}
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

          {/* Guias de fundo / Grade (toggle) */}
          <button
            onClick={() => {
              setShowGridOverlay(!showGridOverlay);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3"
          >
            <Grid3x3 className="w-4 h-4 text-gray-400" />
            <span>Guias de Fundo</span>
            {showGridOverlay && <span className="ml-auto text-green-400">✓</span>}
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
          
          {/* 🆕 Templates — CRUD completo (salvar/carregar/remover), inclui zoom+scroll
              (barSpace/offsetRightDistance) além de indicadores/grade/S/R/timeframe. */}
          <button
            onClick={(e) => {
              // 🐛 FIX: sem isso, o clique subia até o listener global em `document`
              // que fecha o menu de contexto inteiro em QUALQUER clique fora dele (ver
              // handleClick perto do fim do arquivo) -- o próprio botão "Templates"
              // contava como "clique fora", então o menu inteiro sumia antes mesmo do
              // painel expandir. Sintoma relatado: "clico em Templates e o botão some".
              e.stopPropagation();
              setTemplatesExpanded(prev => !prev);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center justify-between"
          >
            <span>Templates{templates.length > 0 ? ` (${templates.length})` : ''}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${templatesExpanded ? '' : 'rotate-[-90deg]'}`} />
          </button>

          {templatesExpanded && (
            <div className="px-3 py-2 space-y-2 bg-black/20">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Nome do novo template"
                  className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user?.id) {
                      toast.error('Faça login para salvar templates');
                      return;
                    }
                    const name = newTemplateName.trim();
                    if (!name) {
                      toast.error('Dê um nome ao template');
                      return;
                    }
                    const ok = await saveTemplate(name, captureCurrentChartConfig());
                    if (ok) {
                      toast.success(`Template "${name}" salvo`);
                      setNewTemplateName('');
                    } else {
                      toast.error('Falha ao salvar o template');
                    }
                  }}
                  className="shrink-0 px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  Salvar
                </button>
              </div>

              {templates.length === 0 ? (
                <p className="text-[10px] text-gray-500 px-1">Nenhum template salvo ainda.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className="w-full px-2 py-1.5 rounded flex items-center justify-between text-xs text-white hover:bg-gray-700/50 transition-colors group"
                    >
                      <button
                        onClick={() => {
                          const chart = chartInstanceRef.current;
                          if (!chart) return;
                          activeTemplateConfigRef.current = template.config;
                          if (template.config.timeframe !== timeframe && VALID_TIMEFRAMES.includes(template.config.timeframe as Timeframe)) {
                            pendingTemplateApplyRef.current = template.config;
                            setTimeframe(template.config.timeframe as Timeframe);
                          } else {
                            clearAllChartIndicators(chart);
                            // 🐛 FIX 2026-09-02: template carregado nunca restaura a âncora de
                            // scroll salva — só indicadores/zoom. Gráfico sempre abre no preço atual.
                            applyChartTemplateConfig(chart, { ...template.config, anchorTimestamp: null, anchorX: null });
                          }
                          setContextMenu(null);
                          toast.success(`Template "${template.name}" carregado`);
                        }}
                        className="flex-1 min-w-0 text-left truncate"
                        title="Carregar este template"
                      >
                        {template.name}
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await deleteTemplate(template.id);
                          if (ok) {
                            toast.success(`Template "${template.name}" removido`);
                          } else {
                            toast.error('Falha ao remover o template');
                          }
                        }}
                        title="Remover template"
                        className="shrink-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="h-px bg-gray-700 my-2"></div>
          
          {/* 🆕 Indicadores ativos — Editar parâmetros / Remover, individualmente */}
          {activeIndicators.size > 0 && (
            <>
              <div className="px-4 py-1 text-[11px] uppercase tracking-wide text-gray-500">Indicadores ativos</div>
              {INDICATORS.filter(ind => activeIndicators.has(ind.id)).map(indicator => (
                <div key={indicator.id} className="w-full px-4 py-1.5 flex items-center justify-between text-sm text-white">
                  <span className="truncate">{indicator.name.split(' - ')[0]}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 🆕 Aumentar/diminuir altura do painel -- só faz sentido pra indicador
                        em painel próprio (RSI/MACD/Estocástico embaixo), não sobreposto no preço. */}
                    {getIndicatorPlacement(indicator) === 'pane' && (
                      <>
                        <button
                          onClick={() => adjustIndicatorPaneHeight(indicator, -PANE_HEIGHT_STEP)}
                          title="Diminuir altura do painel"
                          className="text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded p-1 transition-colors"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => adjustIndicatorPaneHeight(indicator, PANE_HEIGHT_STEP)}
                          title="Aumentar altura do painel"
                          className="text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded p-1 transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {(indicator.defaultParams?.length ?? 0) > 0 && (
                      <button
                        onClick={() => {
                          if (isMovingAverageIndicator(indicator)) {
                            // 🐛 FIX (bug real relatado pelo Cleber: cor escolhida numa MA
                            // recém-inserida não aplicava): este botão fica na lista
                            // "Indicadores ativos", que mostra só 1 linha por TIPO de
                            // indicador -- sem `instanceId`, `openMAEditor` sempre editava
                            // a 1ª instância (default do parâmetro = `indicator.id`), nunca
                            // a que o usuário acabou de adicionar via "Adicionar outra
                            // média". A engrenagem direto na legenda do gráfico já resolve a
                            // instância certa (`onTooltipIconClick`); aqui, sem essa
                            // informação, o melhor default é a ÚLTIMA instância criada --
                            // é a que o usuário psicologicamente "acabou de mexer".
                            const instances = maInstancesRef.current[indicator.id];
                            const lastInstanceId = instances?.[instances.length - 1]?.instanceId;
                            openMAEditor(indicator, false, lastInstanceId);
                          } else {
                            openIndicatorEditor(indicator);
                          }
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

          {/* 🆕 Salvar setup favorito — indicadores + parâmetros, grade, S/R. Reaplicado
              automaticamente na próxima vez que o gráfico for montado (ver useEffect de
              init + useFavoriteChartSetup.ts). Não inclui símbolo/ativo selecionado de
              propósito — o favorito é "como eu gosto de ver qualquer gráfico", não uma
              posição fixa em um ativo específico. */}
          <button
            onClick={() => {
              if (!user?.id) {
                toast.error('Faça login para salvar sua configuração favorita');
                setContextMenu(null);
                return;
              }
              saveFavoriteSetup(captureCurrentChartConfig());
              toast.success('Configuração atual salva como favorita — será aplicada automaticamente da próxima vez');
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3"
          >
            <Star className="w-4 h-4 text-yellow-400" />
            <span>Salvar configuração atual como favorita</span>
          </button>

          <div className="h-px bg-gray-700 my-2"></div>

          {/* Configurações */}
          <button className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center gap-3">
            <Settings className="w-4 h-4 text-gray-400" />
            <span>Configurações...</span>
          </button>
        </div>
        );
      })()}

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
        // 🔧 FIX: fechar o menu (X) só esconde o painel -- o desenho continua selecionado/
        // destacado (linha um pouco mais grossa), então o usuário pode reabrir o menu com
        // outro clique nele sem precisar selecionar de novo do zero. Clicar em espaço vazio
        // do gráfico (ver `chart.subscribeAction('onClick', ...)` acima) é o gesto que
        // desseleciona de verdade e remove o destaque.
        onClose={() => setShowContextToolbar(false)}
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
        defaultAsset={selectedSymbol}
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
            initialCapital: config.initialCapital,
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
            // Escolhido explicitamente pelo usuário no builder (campo "Sinal de
            // Entrada") — nunca deixar undefined aqui, senão StrategyEvaluator
            // cai no fallback de inferência por operador, que inverte sinal em
            // qualquer estratégia de reversão (ver comentário em types/strategy.ts).
            entrySignal: strategy.entrySignal,
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