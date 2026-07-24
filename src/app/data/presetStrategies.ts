import { Strategy, StrategyBlock } from '../types/strategy';

let blockCounter = 0;
function block(partial: Omit<StrategyBlock, 'id' | 'enabled'>): StrategyBlock {
  blockCounter += 1;
  return { ...partial, id: `preset-block-${blockCounter}`, enabled: true };
}

const baseDefaults = {
  isPreset: true as const,
  direction: 'AUTO' as const,
  trailingStop: true,
  riskProfile: 'MODERATE' as const,
  // 1% de risco por trade — fixed fractional, não Kelly pleno. Van Tharp
  // recomenda 1-2% como padrão de mercado para trading de varejo; Kelly
  // cheio amplifica qualquer erro de estimativa de win rate em drawdown
  // extremo (mesmo princípio já adotado no gate de risco de useApexLogic.ts,
  // seção 7 de research/AI_BRAIN_SPEC.md). 2% fixo por trade, independente do
  // ativo, foi identificado como problema nas estratégias antigas — aqui o
  // tamanho real ainda depende do SL em ATR, então o risco monetário por
  // trade fica consistente entre EURUSD/índice/cripto (não mais "2% da conta"
  // com uma distância de stop arbitrária que varia o risco de fato).
  positionSizePercent: 1,
  timeframe: '1h' as const,
  maxConcurrentTrades: 3,
};

/**
 * REDESENHO 2026-07-24 — substitui as 6 estratégias decorativas herdadas do
 * Figma Make (SL/TP fixos em pontos iguais para qualquer ativo, sem filtro de
 * regime declarado, nomes sem lógica associada). Pesquisa completa e fontes
 * em research/AI_BRAIN_SPEC.md (seção de redesenho de estratégias, 2026-07-24).
 *
 * Resumo das fontes principais:
 * - Stop dimensionado por ATR (não pontos fixos): consenso na literatura de
 *   trading sistemático — reduz stop-out prematuro e normaliza risco entre
 *   ativos de volatilidade diferente.
 * - Trend-following por rompimento de canal (Donchian) + stop ATR + trailing
 *   sem alvo fixo: desenho canônico dos Turtle Traders (Dennis/Eckhardt,
 *   documentado por Curtis Faith — amplamente reportado, não verificado no
 *   texto primário nesta pesquisa); suporte de longo prazo em Hurst, Ooi,
 *   Pedersen — "A Century of Evidence on Trend-Following Investing" (AQR/SSRN,
 *   Journal of Portfolio Management 2017, https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2993026).
 * - Cruzamento de médias SEM filtro de regime falha em mercado lateral —
 *   filtro ADX>20-25 é prática recomendada para evitar isso.
 * - Mean-reversion (RSI extremo + Bollinger) funciona melhor em regime lateral,
 *   pior em tendência forte — ver Quantpedia (https://quantpedia.com/how-to-build-mean-reversion-strategies-in-currencies/).
 * - Breakout robusto exige confirmação (fechamento além do nível + volume/OBV
 *   acima da média), não só toque no nível — reduz falso rompimento.
 * - Position sizing fixed-fractional 1-2%, não lote fixo (Van Tharp).
 *
 * Cada estratégia declara `regime` explicitamente e usa um FILTER de ADX como
 * gate real de regime (nunca decorativo) — a lição #1 do diagnóstico da
 * pesquisa foi que aplicar a mesma lógica de indicador em qualquer regime é a
 * causa mais provável de as estratégias antigas não terem edge fora de amostra.
 */
export const PRESET_STRATEGIES: Strategy[] = [
  {
    ...baseDefaults,
    id: '1',
    name: 'Rompimento de Canal (Donchian)',
    description:
      'Trend-following clássico: compra no rompimento da máxima de 20 períodos, vende no rompimento da mínima. ' +
      'Stop em 2×ATR, sem alvo fixo — sai por trailing stop ou reversão do canal. Desenho canônico de trend-following ' +
      'sistemático (Turtle Traders); só opera com ADX>22 confirmando tendência real.',
    regime: 'TREND',
    // Nominais só para exibição de R:R na UI (builder manual) — o motor de
    // backtest ignora estes dois valores porque stopLossMode/takeProfitMode
    // abaixo mandam usar ATR/trailing de verdade. 450 é uma estimativa
    // ilustrativa de alvo típico (não um limite real: TRAILING_ONLY nunca
    // fecha por preço fixo).
    stopLoss: 150,
    takeProfit: 450,
    stopLossMode: 'ATR',
    atrStopMultiplier: 2,
    takeProfitMode: 'TRAILING_ONLY',
    timeframe: '4h',
    entryBlocks: [
      block({ type: 'ENTRY', category: 'trend', indicator: 'PRICE', operator: 'CROSS_ABOVE', compareIndicator: 'DONCHIAN_UPPER', comparePeriod: 20, label: 'Preço rompe a máxima dos últimos 20 candles (canal de Donchian)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'trend', indicator: 'PRICE', operator: 'CROSS_BELOW', compareIndicator: 'DONCHIAN_LOWER', comparePeriod: 10, label: 'Preço rompe a mínima dos últimos 10 candles (reversão do canal curto)' }),
    ],
    filterBlocks: [
      block({ type: 'FILTER', category: 'trend', indicator: 'ADX', period: 14, operator: 'ABOVE', value: 22, label: 'ADX > 22 (tendência real, evita operar em consolidação — sem isso o rompimento de canal sofre com falsos sinais em range)' }),
    ],
  },
  {
    ...baseDefaults,
    id: '2',
    name: 'Cruzamento de Médias com Filtro de Regime',
    description:
      'EMA20 cruza acima da EMA50 (mudança de tendência) com ADX confirmando regime de tendência e EMA50 inclinada a favor — ' +
      'sem o filtro de ADX, cruzamento de médias sofre com whipsaw em mercado lateral. Stop em 2,5×ATR, trailing ativo.',
    regime: 'TREND',
    stopLoss: 150,
    takeProfit: 450,
    stopLossMode: 'ATR',
    atrStopMultiplier: 2.5,
    takeProfitMode: 'ATR',
    atrTakeProfitMultiplier: 6, // R:R ~1:2.4 no candle de entrada; trailing pode entregar mais
    timeframe: '1h',
    entryBlocks: [
      block({ type: 'ENTRY', category: 'trend', indicator: 'EMA', period: 20, operator: 'CROSS_ABOVE', compareIndicator: 'EMA', comparePeriod: 50, label: 'EMA20 cruza acima da EMA50' }),
      block({ type: 'ENTRY', category: 'trend', indicator: 'EMA', period: 50, operator: 'RISING', label: 'EMA50 inclinada para cima (tendência de fundo a favor, não só cruzamento pontual)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'trend', indicator: 'EMA', period: 20, operator: 'CROSS_BELOW', compareIndicator: 'EMA', comparePeriod: 50, label: 'EMA20 cruza abaixo da EMA50' }),
    ],
    filterBlocks: [
      block({ type: 'FILTER', category: 'trend', indicator: 'ADX', period: 14, operator: 'ABOVE', value: 20, label: 'ADX > 20 (regime de tendência — filtro que faltava no desenho antigo, causa documentada de falha em lateralização)' }),
    ],
  },
  {
    ...baseDefaults,
    id: '3',
    name: 'Reversão à Média (RSI + Bollinger)',
    description:
      'Reversão à média em mercado LATERAL: entra quando o preço toca a banda de Bollinger em RSI extremo, sai no retorno ' +
      'à média (SMA20). ADX<22 confirma ausência de tendência — mean-reversion tende a underperformar em tendência forte, ' +
      'por isso o filtro trava a estratégia fora do regime para o qual foi desenhada.',
    regime: 'RANGE',
    stopLoss: 80,
    takeProfit: 160,
    stopLossMode: 'ATR',
    atrStopMultiplier: 1.5, // mean-reversion usa stop mais apertado que trend-following
    takeProfitMode: 'POINTS', // alvo é a média, não um múltiplo de ATR — mantém pontos como referência de saída via exitBlock
    timeframe: '15m',
    entryBlocks: [
      block({ type: 'ENTRY', category: 'volatility', indicator: 'PRICE', operator: 'CROSS_BELOW', compareIndicator: 'BB_LOWER', comparePeriod: 20, label: 'Preço toca/rompe a banda inferior de Bollinger' }),
      block({ type: 'ENTRY', category: 'momentum', indicator: 'RSI', period: 14, operator: 'BELOW', value: 30, label: 'RSI < 30 (sobrevenda)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'volatility', indicator: 'PRICE', operator: 'CROSS_ABOVE', compareIndicator: 'BB', comparePeriod: 20, label: 'Preço retorna à média móvel central (SMA20) — alvo natural de mean-reversion' }),
    ],
    filterBlocks: [
      block({ type: 'FILTER', category: 'trend', indicator: 'ADX', period: 14, operator: 'BELOW', value: 22, label: 'ADX < 22 (mercado lateral — reversão à média não é desenhada para tendência forte)' }),
    ],
  },
  {
    ...baseDefaults,
    id: '4',
    name: 'Rompimento Confirmado (Volume)',
    description:
      'Breakout com confirmação: preço fecha além da máxima/mínima de 20 períodos (Donchian) COM volume (OBV subindo) ' +
      'confirmando a força do movimento — reduz falso rompimento, que é o modo de falha mais comum de breakouts ingênuos ' +
      '(que operam só no toque do nível, sem confirmação). Stop em 1,5×ATR abaixo/acima do nível rompido.',
    regime: 'BREAKOUT',
    stopLoss: 100,
    takeProfit: 300,
    stopLossMode: 'ATR',
    atrStopMultiplier: 1.5,
    takeProfitMode: 'ATR',
    atrTakeProfitMultiplier: 3, // R:R 1:2, consistente com o mínimo recomendado para breakout
    timeframe: '1h',
    entryBlocks: [
      block({ type: 'ENTRY', category: 'trend', indicator: 'PRICE', operator: 'CROSS_ABOVE', compareIndicator: 'DONCHIAN_UPPER', comparePeriod: 20, label: 'Fechamento além da máxima dos últimos 20 candles (rompimento real, não só pavio)' }),
      block({ type: 'ENTRY', category: 'volume', indicator: 'OBV', operator: 'RISING', label: 'OBV em alta (confirma volume comprador no rompimento — sem isso é um falso rompimento comum)' }),
    ],
    exitBlocks: [
      block({ type: 'EXIT', category: 'volatility', indicator: 'ATR', period: 14, operator: 'FALLING', label: 'ATR em contração (perda de força do movimento — sinal de exaustão do rompimento)' }),
    ],
    filterBlocks: [],
  },
];

export function getPresetStrategyById(id: string): Strategy | undefined {
  return PRESET_STRATEGIES.find(s => s.id === id);
}
