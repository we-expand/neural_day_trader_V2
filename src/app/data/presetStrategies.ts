import { Strategy, StrategyBlock } from '../types/strategy.ts';

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
      'Trend-following clássico: compra no rompimento da máxima de 20 períodos. Somente lado comprado (LONG-ONLY) — ' +
      'ver nota de escopo abaixo. Sai por trailing stop (rompimento da mínima de 10 períodos) ou stop em 2×ATR — ' +
      'nunca por alvo fixo. Desenho canônico de trend-following sistemático (Turtle Traders, que originalmente é ' +
      'simétrico long/short); só opera com ADX>22 confirmando tendência real.',
    regime: 'TREND',
    // 2026-07-30: CORREÇÃO DE DOCUMENTAÇÃO — a versão anterior desta
    // descrição alegava "vende no rompimento da mínima" como se fosse uma
    // entrada short simétrica (desenho real do Turtle Trader original). Não
    // é: o CROSS_BELOW DONCHIAN_LOWER(10) abaixo é um exitBlock (fecha a
    // posição comprada), nunca uma entrada de venda. Auditoria de 2026-07-30
    // confirmou que os 4 arquétipos de tendência (presets 1,2,4,5) são
    // long-only por implementação — `entrySignal: 'BUY'` só, nenhum bloco
    // de entrada short existe.
    //
    // DECISÃO DE ESCOPO (2026-07-30): não implementar a perna short agora.
    // Motivo: fazer isso corretamente exige que exitBlocks também se tornem
    // conscientes do lado da posição (hoje o exitBlock de saída é sempre o
    // mesmo, orientado pra fechar um LONG — usar essa mesma regra pra
    // fechar um SHORT introduziria uma classe nova de bug, silenciosa,
    // exatamente no momento em que ainda não se sabe se o lado comprado tem
    // edge real após as correções desta sessão). Ver research/MASTER_PLAN.md
    // §3.3 — decisão revisitável depois da Fase 2 (remedição dos arquétipos)
    // mostrar se o investimento de engenharia vale a pena.
    entrySignal: 'BUY',
    // Nominais só para exibição de R:R na UI (builder manual) — o motor de
    // backtest ignora estes dois valores porque stopLossMode/takeProfitMode
    // abaixo mandam usar ATR/trailing de verdade. 450 é uma estimativa
    // ilustrativa de alvo típico (não um limite real: TRAILING_ONLY nunca
    // fecha por preço fixo).
    stopLoss: 150,
    takeProfit: 450,
    stopLossMode: 'ATR',
    // 2026-07-24: 2×ATR (valor original) batia stop em 89-91% dos trades no
    // BTC 1h/4h real (~3 anos) — investigação com split treino/holdout
    // cronológico (research/experiments/2026-07-24-strategy-validation/investigate.ts)
    // mostrou que 4×ATR reduz a perda líquida de forma consistente e
    // validada fora de amostra (holdout -0,55%→-0,52%). Continua líquido
    // NEGATIVO mesmo com o ajuste — não é edge comprovado, é melhora real
    // porém insuficiente. Ver research/AI_BRAIN_SPEC.md seção 11.3/11.4.
    atrStopMultiplier: 4,
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
      'sem o filtro de ADX, cruzamento de médias sofre com whipsaw em mercado lateral. Somente lado comprado (LONG-ONLY, ' +
      'ver nota de escopo no preset 1). Stop em 2,5×ATR, trailing ativo.',
    regime: 'TREND',
    // 2026-07-30: long-only por desenho atual (só EMA20 cruza ACIMA da EMA50
    // como entrada) — sem perna short simétrica, mesma decisão de escopo do
    // preset 1 (ver comentário completo lá + research/MASTER_PLAN.md §3.3).
    entrySignal: 'BUY',
    stopLoss: 150,
    takeProfit: 450,
    stopLossMode: 'ATR',
    // 2026-07-24: mesmo achado do Arquétipo 1 — 2,5×ATR original batia stop
    // em 89% dos trades. 4,5×ATR reduz a perda líquida, validado fora de
    // amostra (holdout -0,28%→-0,14%). Ainda líquido NEGATIVO — ver nota
    // completa no Arquétipo 1 e research/AI_BRAIN_SPEC.md seção 11.3/11.4.
    atrStopMultiplier: 4.5,
    takeProfitMode: 'ATR',
    atrTakeProfitMultiplier: 6, // R:R ~1:1.3 no candle de entrada; trailing pode entregar mais
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
    // 2026-07-30: FIX DE BUG — antes da introdução de entrySignal, a direção
    // deste preset era INFERIDA por contagem de operador em
    // StrategyEvaluator.ts, e os dois entryBlocks abaixo (PRICE CROSS_BELOW
    // BB_LOWER, RSI BELOW 30) contavam como "bearish" pelo critério antigo —
    // o sistema classificava como sinal de VENDA, exatamente o oposto da
    // intenção declarada (comprar na sobrevenda, esperar reversão pra cima).
    // Toda medição anterior deste preset (seção 11.12 do AI_BRAIN_SPEC.md,
    // Sharpe pooled -0,311) mediu uma ANTI-reversão à média, não o arquétipo
    // real — precisa ser remedido com esta correção antes de qualquer nova
    // conclusão. Ver research/MASTER_PLAN.md §3.2.
    entrySignal: 'BUY',
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
      'Breakout com confirmação: preço fecha além da máxima de 20 períodos (Donchian) COM volume (OBV subindo) ' +
      'confirmando a força do movimento — reduz falso rompimento, que é o modo de falha mais comum de breakouts ingênuos ' +
      '(que operam só no toque do nível, sem confirmação). Somente lado comprado (LONG-ONLY, ver nota de escopo no ' +
      'preset 1). Stop em 1,5×ATR abaixo do nível rompido.',
    regime: 'BREAKOUT',
    // 2026-07-30: long-only por desenho atual (só rompimento de máxima +
    // OBV subindo como entrada) — sem perna short simétrica, mesma decisão
    // de escopo do preset 1 (ver comentário completo lá).
    entrySignal: 'BUY',
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
    // 2026-07-30: FIX DE BUG — o exitBlock `ATR FALLING` (removido) dispara
    // sempre que ATR(i) < ATR(i-1), condição satisfeita em ~44% das barras
    // de uma série sintética realista (medido: research/experiments/
    // 2026-07-30-engine-audit/). Holding period esperado por essa regra
    // sozinha: ~2,3 barras em qualquer timeframe — insuficiente pra um
    // rompimento de tendência se desenvolver, mas suficiente pra pagar custo
    // de transação repetidamente. "Contração de ATR" como sinal de exaustão
    // exigiria persistência (ex: várias barras seguidas, ou ATR abaixo da
    // própria média móvel) — não uma única flutuação bar-a-bar, que é ruído,
    // não sinal. Sem esse tipo de indicador derivado no modelo atual de
    // blocos, a saída correta e já bem definida é via TP/SL por ATR
    // (atrStopMultiplier/atrTakeProfitMultiplier abaixo, R:R 1:2) + trailing
    // stop (baseDefaults.trailingStop=true) — deixa o rompimento se
    // desenvolver até o stop/alvo real, em vez de um gatilho de saída que
    // reage a ruído de barra única. exitBlocks vazio é intencional aqui.
    exitBlocks: [],
    filterBlocks: [],
  },
];

PRESET_STRATEGIES.push({
  ...baseDefaults,
  id: '5',
  name: 'Momentum de Curto Prazo (Scalp)',
  description:
    'Rajada de momentum no timeframe de 1 minuto: MACD cruza acima de zero com RSI já em zona de tendência ' +
    '(50-70, não sobrecomprado) e ADX>18 confirmando micro-tendência. Stop 1×ATR, alvo 1,5×ATR — R:R modesto de ' +
    'propósito (scalp precisa de taxa de acerto alta, não de retorno grande por trade). ' +
    '⚠️ ATENÇÃO OPERACIONAL, diferente das outras 3 estratégias: scalping em CFD via corretora com latência de ' +
    'segundos (documentada nesta plataforma, não hipotética — a conta MetaAPI compartilhada historicamente responde ' +
    'em 3-9s por chamada) é estruturalmente mais arriscado que em execução de baixa latência. O spread cabe no ' +
    'orçamento (ver research/CostModel.ts), mas a latência de execução pode consumir o alvo antes da ordem sair. ' +
    'NÃO habilitar como padrão de produção sem antes: (1) medir a taxa de acerto REAL desta estratégia por ativo via ' +
    'MarketScoreValidator; (2) comparar contra o piso de breakEvenWinRate() (research/CostModel.ts) POR ATIVO; ' +
    '(3) confirmar latência de execução real via /broker/execute (só existe depois da Fase B/ponte de execução). ' +
    'Enquanto isso não acontecer, esta estratégia é um candidato, não uma recomendação.',
  regime: 'SCALP',
  // 2026-07-30: long-only por desenho atual (só MACD cruza ACIMA de zero
  // como entrada) — sem perna short simétrica, ver preset 1.
  entrySignal: 'BUY',
  stopLoss: 20,
  takeProfit: 30,
  stopLossMode: 'ATR',
  atrStopMultiplier: 1,
  takeProfitMode: 'ATR',
  atrTakeProfitMultiplier: 1.5,
  timeframe: '1m',
  maxConcurrentTrades: 1, // foco — scalp já opera em alta frequência, não acumula posições simultâneas
  entryBlocks: [
    block({ type: 'ENTRY', category: 'momentum', indicator: 'MACD', operator: 'CROSS_ABOVE', value: 0, label: 'MACD (histograma) cruza acima de zero (rajada de momentum começando)' }),
    block({ type: 'ENTRY', category: 'momentum', indicator: 'RSI', period: 14, operator: 'BETWEEN', value: 50, value2: 70, label: 'RSI entre 50-70 (momentum a favor, ainda não sobrecomprado)' }),
  ],
  exitBlocks: [
    block({ type: 'EXIT', category: 'momentum', indicator: 'MACD', operator: 'CROSS_BELOW', value: 0, label: 'MACD cruza abaixo de zero (rajada perdeu força)' }),
  ],
  filterBlocks: [
    block({ type: 'FILTER', category: 'trend', indicator: 'ADX', period: 14, operator: 'ABOVE', value: 18, label: 'ADX > 18 (micro-tendência real, mesmo em timeframe curto — evita operar ruído puro)' }),
  ],
});

export function getPresetStrategyById(id: string): Strategy | undefined {
  return PRESET_STRATEGIES.find(s => s.id === id);
}
