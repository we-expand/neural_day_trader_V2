// Tipos de estado do ciclo de trading — extraídos de `useApexLogic.ts` e
// `PyramidingConfigPanel.tsx` em 2026-08-07 (passo 3 do plano do runner,
// ver NEXT_SESSION.md).
//
// POR QUÊ: `runTradingCycle.ts` (motor puro, sem React — "um motor, dois
// drivers") precisava desses 3 tipos só como FORMATO de dado, mas os
// importava de `@/app/hooks/useApexLogic`, um arquivo React (importa
// `react`, `sonner`, `motion/react` via PyramidingConfigPanel). Sob Deno,
// resolver esse `import type` obriga a carregar o grafo de módulos inteiro
// de `useApexLogic.ts` — e ele não é portável. Isso só apareceu ao tentar
// rodar o runner de verdade (`deno check`), porque o teste de costura
// (seam_smoke_test.ts) nunca importou `runTradingCycle.ts`.
//
// Este arquivo não tem NENHUM import — nem de React, nem de outro módulo do
// projeto — de propósito: é o único jeito de garantir que nunca mais um tipo
// puro fique preso atrás de uma dependência de runtime.
//
// `useApexLogic.ts` e `PyramidingConfigPanel.tsx` agora re-exportam esses
// tipos daqui em vez de defini-los — sem duplicação, formato único.

export interface PyramidingConfig {
  // ========== CONFIGURAÇÕES PRINCIPAIS ==========
  enabled: boolean;
  maxLayers: number; // Máximo de entradas (ex: 5 = 1 inicial + 4 adds)

  // ========== ESTRATÉGIA DE SCALING ==========
  scalingStrategy: 'fixed' | 'reduced' | 'fibonacci' | 'exponential' | 'smart-ai';
  initialSize: number; // Tamanho inicial em contratos
  sizeMultiplier: number; // Multiplicador para cada layer (usado em algumas estratégias)

  // ========== DISTÂNCIA ENTRE ENTRADAS ==========
  entryDistanceType: 'pips' | 'percent' | 'atr' | 'ai-dynamic';
  entryDistance: number; // Distância mínima para próxima entrada
  atrMultiplier: number; // Se usar ATR, multiplicador (ex: 0.5 ATR)

  // ========== TRAILING STOP DINÂMICO ==========
  trailingStopEnabled: boolean;
  trailingStopType: 'pips' | 'percent' | 'atr';
  trailingStopDistance: number;
  trailingStopPerLayer: boolean; // Trailing stop independente por layer

  // ========== BREAK-EVEN & TAKE PROFIT ==========
  breakEvenEnabled: boolean;
  breakEvenAfterLayers: number; // Mover para break-even após X layers
  partialTakeProfitEnabled: boolean;
  partialTakeProfitPercent: number; // % de posição a fechar em cada TP
  partialTakeProfitLayers: number[]; // Em quais layers fechar parcial (ex: [2, 4])

  // ========== AI RISK MANAGEMENT ==========
  aiRiskAnalysisEnabled: boolean;
  maxRiskPercentPerLayer: number; // Risco máximo por layer (% da conta)
  stopAddingOnDivergence: boolean; // Parar se detectar divergência
  stopAddingOnHighVolatility: boolean; // Parar se volatilidade aumentar muito
  requiredMomentumScore: number; // Score mínimo de momentum para adicionar (0-100)

  // ========== STOP DE EMERGÊNCIA ==========
  emergencyStopEnabled: boolean;
  emergencyStopLossPercent: number; // Stop loss de emergência para posição total
  closeAllOnReversal: boolean; // Fechar tudo se detectar reversão forte
}

/** Rótulos de perfil de risco de versões antigas, ainda presentes no localStorage. */
export type LegacyRiskProfile = 'EQUILIBRADO' | 'DEGEN';

export interface TradeVisual {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  price: number;
  currentPrice?: number;
  currentProfit?: number; // Added for Real PnL from MT5
  closedAt?: number; // Timestamp when the trade was closed
  tp: number;
  sl: number;
  // Distância original de SL na entrada (nunca sobrescrita depois, ao contrário
  // de `sl`, que o loop de P&L reescreve a cada tick em modo DINAMICO). Ver
  // bug do SL Dinâmico fantasma (2026-08-03): usar `sl` para recalcular a
  // distância de trailing faz ela encolher a cada tick, e o "stop" persegue o
  // preço até fechar a posição sozinha mesmo sem reversão real de mercado.
  originalSl: number;
  // 🆕 2026-08-04: contador real de quantas vezes o trailing stop DINAMICO
  // avançou esta posição (widget "ATR Trailing Stop" — antes mostrava
  // números hardcoded). Só runtime/UI, não persistido no Supabase.
  trailMoves?: number;
  // 🆕 2026-08-04: pyramiding real (widget "Pyramiding System" — antes 100%
  // decorativo, sem lógica nenhuma no motor). `pyramidGroupId` = id da
  // posição ORIGINAL da pilha (undefined = trade normal, fora de pyramiding).
  // `pyramidLayer` = 1 pra posição original, 2+ pras entradas adicionadas.
  pyramidGroupId?: string;
  pyramidLayer?: number;
  leverage: number;
  ai_confidence: number;
  timestamp: number;
  reasoning: string;
  hasTakenPartial?: boolean;
  indicators: {
    rsi: number;
    macd: string;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    // 🆕 2026-08-24: regime de mercado medido na entrada (auditoria pedida
    // pelo Cleber depois de ver SOLUSD fechar 15/15 no stop num dia
    // lateralizado — antes esse dado só era gravado quando o gate VETAVA
    // o trade, nunca na entrada executada). Ver SESSAO_2026-08-24_REGIME_NA_ENTRADA.md.
    regime?: string | null;
    contextClassification?: string;
    structureBias?: string;
    adx?: number | null;
    atrExpansionRatio?: number | null;
  };
}

export interface PortfolioState {
  balance: number;
  equity: number;
  maxDrawdownLimit: number;
  currentDrawdown: number;
  openPositionsValue: number;
  initialBalance?: number; // Added to track profit
  // Âncoras reais de drawdown (padrão FTMO/Topstep, seleção via aiConfig.drawdownAnchor).
  peakEquity?: number;        // high-water mark do equity (âncora INTRADAY_PEAK)
  dayAnchorEquity?: number;   // equity no início do dia UTC (âncora DAILY_CLOSE)
  dayAnchorBalance?: number;  // balance (realizado) no início do dia UTC — âncora do Daily Loss Limit/Kill-Switch,
                               // NUNCA comparar dayAnchorEquity contra balance (mistura equity com realizado)
  dayAnchorUtcDay?: number;   // Date.UTC do dia a que dayAnchorEquity/dayAnchorBalance se referem
  maxDrawdownReached?: number; // pior drawdown já atingido (só métrica/histórico,
                               // NUNCA usado como gate — o gate usa currentDrawdown)
}

export interface AIConfig {
  direction: 'AUTO' | 'LONG' | 'SHORT';
  marketMode: 'TREND' | 'RANGE' | 'SCALP' | 'COUNTER';
  targetPoints: 'MÉDIO' | 'CURTO' | 'LONGO' | 'POUCOS' | 'MUITOS';
  stopLossMode: 'DINAMICO' | 'FIXO';
  allocatedCapital: number;
  maxContracts: number;
  maxPositions: number;
  maxDrawdown: number;
  riskPerTrade: number;
  minWinRate: number;
  // Inclui os rótulos legados ('EQUILIBRADO'/'DEGEN') porque eles EXISTEM de fato
  // no localStorage de usuários antigos e são tratados em RISK_PROFILE_ADJUSTMENTS.
  riskProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'INSTITUTIONAL' | 'INSTITUTIONAL_SMC' | LegacyRiskProfile;

  activeAssets: string[]; // Lista de ativos selecionados (Infinox válidos)
  maxAssets: number; // Máximo de ativos simultâneos diferentes
  timeframe: string; // Timeframe operacional (1m, 5m, 15m, 1H, 4H)
  newsFilter: boolean; // Filtro de notícias econômicas
  dailyLossLimit: number; // Limite de perda diária (%)
  metaApiToken?: string; // Token do MetaApi para integração MT5
  // Estratégia ativa (pronta ou customizada) — o motor de decisão passa a
  // rodar exatamente essa estratégia via evaluateStrategyAt, a mesma função
  // usada pelo Backtest. null = nenhuma selecionada (ciclo é pulado).
  activeStrategyId: string | null;

  /**
   * Piso do score contínuo de sinal (0-100) pra uma entrada ser considerada.
   *
   * 2026-08-17: substitui o AND binário de `evaluateStrategyAt`, que exigia
   * que TODOS os blocos batessem no MESMO candle. Como `CROSS_ABOVE`/
   * `CROSS_BELOW` são eventos de um candle só, isso tornava o motor cego pra
   * tendência já estabelecida (quanto mais firme o movimento, mais tempo
   * desde o cruzamento, menos sinal) — medido em produção: `NO_SIGNAL` em
   * 100% das avaliações da sessão de 2026-08-17, e 3 entradas em 11 dias na
   * sessão anterior. Com score graduado por recência (`scoreBlock`), um
   * cruzamento de N candles atrás ainda pontua, decaindo 10 pontos por
   * candle numa janela de 10.
   *
   * 100 reproduz exatamente o comportamento binário antigo (só o candle
   * exato do cruzamento pontua 100). Quanto menor, mais entradas — e mais
   * distante do gatilho original. NÃO é probabilidade calibrada de acerto:
   * é a média dos scores dos blocos de entrada, uma heurística de
   * proximidade do setup, igual à confiança que já existia antes.
   */
  signalScoreFloor: number;

  // Módulo de Gerenciamento de Risco (research/RISK_MODULE_SPEC.md).
  drawdownAnchor: 'INTRADAY_PEAK' | 'DAILY_CLOSE'; // FTMO/Topstep ancoram no fechamento diário
  cooldownEnabled: boolean;
  consecutiveLossesTrigger: number; // ex: 3 perdas seguidas ativa o cooldown
  cooldownMinutes: number; // duração do bloqueio de novas entradas
  maxTradesPerDay: number; // 0 = sem limite
  positionSizingMode: 'FIXED' | 'ATR'; // FIXED = % linear (riskPerTrade); ATR = ajustado por volatilidade real
  atrMultiplier: number; // só usado quando positionSizingMode === 'ATR'
  correlationGuardEnabled: boolean;
  correlationThreshold: number; // 0-1, acima disso reduz o tamanho da nova posição
  killSwitchThreshold?: number; // % perda que ativa kill-switch automático (ex: 10.0)

  // Distância de trailing real (ATR do próprio ativo/timeframe operado). Só
  // ativo quando stopLossMode === 'DINAMICO'.
  atrTrailingPeriod: number; // período do ATR pro trailing (padrão 14)
  atrTrailingMultiplier: number; // distância do stop = ATR × este multiplicador (padrão 2.0)

  pyramiding: PyramidingConfig;

  // Cooldown curto entre avaliações de trade (2s em vez do padrão 5s) é
  // OPT-IN explícito do usuário — nunca acionado automaticamente por VIX.
  aggressiveModeEnabled: boolean;
}
