export type IndicatorType =
  | 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BB' | 'BB_UPPER' | 'BB_LOWER' | 'STOCH' | 'ADX' | 'ATR'
  | 'VWAP' | 'OBV' | 'CCI' | 'WILLIAMS' | 'SAR' | 'PRICE'
  | 'DONCHIAN_UPPER' | 'DONCHIAN_LOWER';

export type OperatorType =
  | 'CROSS_ABOVE' | 'CROSS_BELOW' | 'ABOVE' | 'BELOW'
  | 'BETWEEN' | 'RISING' | 'FALLING';

export type BlockKind = 'ENTRY' | 'EXIT' | 'FILTER';

export interface StrategyBlock {
  id: string;
  type: BlockKind;
  category: string;
  indicator: IndicatorType;
  period?: number;
  /** Segundo indicador para comparações indicador-vs-indicador (ex: EMA9 CROSS_ABOVE EMA21) */
  compareIndicator?: IndicatorType;
  comparePeriod?: number;
  operator: OperatorType;
  value?: number;
  value2?: number;
  label: string;
  description?: string;
  enabled: boolean;
}

export type RiskProfileType =
  | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'INSTITUTIONAL' | 'INSTITUTIONAL_SMC'
  | 'EQUILIBRADO' | 'DEGEN';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * Regime de mercado a que a estratégia é destinada — não é decorativo: um
 * sistema de reversão à média (RANGE) opera mal em tendência forte e vice-versa
 * (ver research/AI_BRAIN_SPEC.md e a pesquisa que motivou o redesenho das
 * estratégias-preset em 2026-07-24). Combinado com um FILTER de ADX no bloco da
 * própria estratégia, que é o gate real; este campo é a declaração honesta pro
 * usuário/UI de para que regime a estratégia foi desenhada.
 */
export type StrategyRegime = 'TREND' | 'RANGE' | 'BREAKOUT' | 'SCALP';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  isPreset: boolean;
  entryBlocks: StrategyBlock[];
  exitBlocks: StrategyBlock[];
  filterBlocks: StrategyBlock[];
  /**
   * Sinal que a satisfação de TODOS os entryBlocks (AND lógico) representa.
   * Declarado explicitamente por quem desenha a estratégia — nunca inferido.
   *
   * 2026-07-30: substitui a inferência por contagem de operador
   * (CROSS_BELOW/BELOW/FALLING = "bearish") que existia antes em
   * StrategyEvaluator.ts. Bug real encontrado por auditoria: a Reversão à
   * Média (preset 3) tem entryBlocks com `PRICE CROSS_BELOW BB_LOWER` +
   * `RSI BELOW 30` — ambos "bearish" pelo critério antigo, então o sistema
   * classificava como sinal de VENDA, quando a intenção declarada é o
   * oposto (comprar na sobrevenda, esperar reversão para cima). A inferência
   * por operador não tem como saber a intenção — só a contagem de sinais
   * "menor que"/"abaixo de", que numa estratégia de reversão aponta pro lado
   * errado por desenho.
   *
   * Opcional para retrocompatibilidade com estratégias customizadas
   * (`StrategyBuilderPro.tsx`) criadas antes deste campo existir — nesse
   * caso o motor cai de volta pra inferência antiga (ver
   * StrategyEvaluator.evaluateStrategyAt), que continua sendo uma
   * aproximação sujeita ao mesmo tipo de erro. Todo preset do catálogo
   * (`presetStrategies.ts`) declara este campo explicitamente.
   */
  entrySignal?: 'BUY' | 'SELL';
  /**
   * Blocos de entrada da perna VENDIDA — espelho direcional de `entryBlocks`.
   * Quando presentes, a estratégia deixa de ser long-only: o motor avalia os
   * dois lados e opera o de maior score (ver `evaluateStrategyScoreBothSides`).
   *
   * 2026-08-17: os 5 presets eram LONG-ONLY por uma decisão de escopo de
   * 2026-07-30, cujo motivo declarado era que `exitBlocks` não são conscientes
   * do lado da posição — usar a mesma regra de saída pra fechar um SHORT
   * introduziria bug silencioso. Esse motivo vale para o BACKTEST, único
   * caminho que chama `evaluateExitAt` (BacktestEngine.ts:140). O motor AO
   * VIVO (`runTradingCycle.ts`) nunca consulta `exitBlocks`: sai por TP/SL
   * dimensionado em ATR + trailing/breakeven. Por isso a perna short é segura
   * no live e continua ignorada pelo backtest enquanto os exitBlocks não
   * ganharem consciência de lado — assimetria deliberada e documentada, não
   * esquecimento.
   */
  shortEntryBlocks?: StrategyBlock[];
  direction: 'AUTO' | 'LONG' | 'SHORT';
  /** Regime de mercado pretendido — ver StrategyRegime. Opcional para retrocompatibilidade
   *  com estratégias customizadas salvas antes deste campo existir. */
  regime?: StrategyRegime;
  /** SL/TP nominais em pontos — sempre presentes (usados pelo builder manual e
   *  como referência de R:R na UI). Quando stopLossMode/takeProfitMode = 'ATR',
   *  o motor de backtest ignora estes valores e calcula a distância real a
   *  partir do ATR do candle na entrada — ver TradeSizing.resolveTpSl. */
  stopLoss: number;
  takeProfit: number;
  /** Modo de cálculo do stop-loss. 'ATR' multiplica o ATR(14) no candle de
   *  entrada por `atrStopMultiplier` — dimensiona o risco pela volatilidade
   *  real do ativo/momento em vez de um número fixo de pontos igual para
   *  EURUSD e para um índice. Ausente/'POINTS' preserva o comportamento
   *  antigo (builder manual). */
  stopLossMode?: 'POINTS' | 'ATR';
  atrStopMultiplier?: number;
  /** Modo do take-profit. 'ATR' funciona como o stop; 'TRAILING_ONLY' significa
   *  que a estratégia NUNCA fecha por alvo fixo — só por trailing stop (trailingStop
   *  precisa estar true) ou por regra de saída (exitBlocks). Isso é deliberado
   *  para trend-following: deixar o lucro correr em vez de cortar cedo (ver spec). */
  takeProfitMode?: 'POINTS' | 'ATR' | 'TRAILING_ONLY';
  atrTakeProfitMultiplier?: number;
  trailingStop: boolean;
  riskProfile: RiskProfileType;
  positionSizePercent: number;
  timeframe: Timeframe;
  maxConcurrentTrades: number;
  createdBy?: string | null;
  updatedAt?: string;
}

export interface StrategySignal {
  signal: 'BUY' | 'SELL' | null;
  confidence: number;
  reasons: string[];
}
