import { RiskProfileType, Strategy } from '../../types/strategy.ts';
import { getAssetBySymbol } from '../../config/assetDatabase.ts';

/**
 * Extraído de useApexLogic.ts (mesmos valores/regras usados ao vivo) para ser
 * reutilizado tanto pela IA ao vivo quanto pelo motor de Backtest — garante que
 * os dois calculam TP/SL/tamanho de posição exatamente da mesma forma.
 */
export const RISK_PROFILE_ADJUSTMENTS: Record<string, { confidenceAdjust: number; sizeMultiplier: number }> = {
  CONSERVATIVE: { confidenceAdjust: 15, sizeMultiplier: 0.7 },
  MODERATE: { confidenceAdjust: 0, sizeMultiplier: 1.0 },
  EQUILIBRADO: { confidenceAdjust: 0, sizeMultiplier: 1.0 },
  AGGRESSIVE: { confidenceAdjust: -10, sizeMultiplier: 1.3 },
  DEGEN: { confidenceAdjust: -10, sizeMultiplier: 1.3 },
  INSTITUTIONAL: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
  INSTITUTIONAL_SMC: { confidenceAdjust: 10, sizeMultiplier: 0.85 },
};
export const DEFAULT_RISK_ADJUSTMENT = { confidenceAdjust: 0, sizeMultiplier: 1.0 };

export function getRiskAdjustment(riskProfile: RiskProfileType | string): { confidenceAdjust: number; sizeMultiplier: number } {
  return RISK_PROFILE_ADJUSTMENTS[riskProfile] || DEFAULT_RISK_ADJUSTMENT;
}

export type TargetPointsPreset = 'MÉDIO' | 'CURTO' | 'LONGO' | 'POUCOS' | 'MUITOS';

const TARGET_POINTS_TABLE: Record<TargetPointsPreset, { target: number; stop: number }> = {
  POUCOS: { target: 150, stop: 50 },
  MÉDIO: { target: 400, stop: 120 },
  MUITOS: { target: 1500, stop: 300 },
  CURTO: { target: 80, stop: 35 },
  LONGO: { target: 800, stop: 200 },
};

export interface TpSlResult {
  targetPointsValue: number;
  stopLossPointsValue: number;
  pointValue: number;
  tp: number;
  sl: number;
  tpDistance: number;
  slDistance: number;
  riskRewardRatio: number;
}

// Bases cripto conhecidas — checadas ANTES do bloco genérico "contém USD/EUR/
// GBP/etc" porque todo par cripto cotado em dólar (BTCUSDT, BTCUSD, ETHUSD...)
// também contém a substring "USD" e batia por engano na regra de forex (pip
// 0.0001), tratando um preço em dólares CHEIOS como se fosse cotação forex de
// 4-5 casas decimais. Achado testando resolveTpSl em modo POINTS (fallback)
// contra BTCUSDT: dava alvo de US$0,016 de distância — fecharia o trade no
// próprio candle de entrada, sempre.
//
// 🔒 2026-08-05: a lista de prefixos sozinha reintroduziu o MESMO bug para toda
// a família de contratos "X**" da Infinox — `XBNUSD` (Binance Coin), `XETUSD`
// (Ethereum), `XLCUSD` (Litecoin) não começam por nenhuma base da lista e
// contêm "USD", então caíam no branch forex e recebiam pointValue 0.0001 com
// preço em dólares cheios. Achado medindo a taxa base (pontos líquidos/trade de
// XBNUSD saíam na casa das centenas de milhares). Correção estrutural: o
// catálogo (`assetDatabase.ts`) já declara a categoria de cada símbolo — ele é a
// fonte de verdade, e a lista de prefixos vira só fallback para símbolos que não
// estão no catálogo (ex.: 'BTCUSDT', notação nativa de exchange).
const CRYPTO_BASES = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOT', 'LTC', 'DOGE', 'AVAX', 'MATIC', 'POL', 'BAT', 'LINK', 'UNI', 'XLM'];

function isCryptoSymbolForSizing(symbol: string): boolean {
  const s = symbol.toUpperCase();
  const catalogCategory = getAssetBySymbol(s)?.category;
  if (catalogCategory) return catalogCategory === 'CRYPTO';
  if (s.endsWith('USDT')) return true;
  return CRYPTO_BASES.some(base => s.startsWith(base));
}

/**
 * 🔒 2026-08-10: mesmo bug de família já corrigido pra cripto em 2026-08-05
 * (XBNUSD, XETUSD, XLCUSD), reaparecendo em qualquer instrumento catalogado
 * cujo símbolo contenha um código de moeda como substring sem ser forex de
 * verdade — não só UKOUSD (Brent Oil). Achado em UKOUSD (trade real 2026-08-10
 * 18:02 UTC, confiança 78%, stop de 0,0135% do preço fechado em ~80s por
 * ruído), mas a mesma heurística por nome também pegava errado XAG/XPT/XPD
 * (prata/platina/paládio — só ouro tinha exceção) e USDX (Índice do Dólar,
 * categoria INDICES, contém "USD" mas não é par forex).
 *
 * Fix estrutural: o heurístico de pip por substring de moeda só pode valer
 * pra CATEGORIA FOREX de verdade. Pra qualquer símbolo catalogado fora de
 * FOREX/CRYPTO, a categoria do catálogo é a única fonte de verdade — nunca o
 * nome. Símbolos fora do catálogo (ex.: notação nativa de exchange tipo
 * BTCUSDT, já coberta antes pelo check de cripto) caem no fallback por nome,
 * preservado por retrocompatibilidade.
 */
const NON_FOREX_POINT_VALUE_BY_SUBCATEGORY: Record<string, number> = {
  'Precious Metals': 0.1, // ouro/prata/platina/paládio, preço na casa das centenas/milhares
  Energy: 0.01,           // petróleo/gás, preço na casa das dezenas/centenas
  Agriculture: 0.01,
};

/** Mesma tabela de pip/ponto por classe de ativo usada em useApexLogic.ts. */
export function getPointValue(symbol: string): number {
  if (isCryptoSymbolForSizing(symbol)) return 1.0; // preço já em dólares cheios, "ponto" = US$1

  const asset = getAssetBySymbol(symbol.toUpperCase());
  if (asset && asset.category !== 'FOREX') {
    return NON_FOREX_POINT_VALUE_BY_SUBCATEGORY[asset.subCategory] ?? 1.0;
  }

  let pointValue = 1.0;
  if (
    symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('USD') ||
    symbol.includes('JPY') || symbol.includes('AUD') || symbol.includes('CAD') ||
    symbol.includes('CHF') || symbol.includes('NZD')
  ) {
    pointValue = 0.0001;
  }
  if (symbol.includes('XAU') || symbol.includes('GOLD')) {
    pointValue = 0.1;
  }
  return pointValue;
}

export function calculateTpSl(
  symbol: string,
  side: 'LONG' | 'SHORT',
  currentPrice: number,
  targetPoints: TargetPointsPreset,
  marketMode: 'TREND' | 'RANGE' | 'SCALP' | 'COUNTER'
): TpSlResult {
  const preset = TARGET_POINTS_TABLE[targetPoints] || TARGET_POINTS_TABLE['MÉDIO'];
  let targetPointsValue = preset.target;
  let stopLossPointsValue = preset.stop;

  if (marketMode === 'SCALP') {
    targetPointsValue = Math.min(targetPointsValue, 80);
    stopLossPointsValue = Math.min(stopLossPointsValue, 35);
  }

  const pointValue = getPointValue(symbol);
  const tpDistance = targetPointsValue * pointValue;
  const slDistance = stopLossPointsValue * pointValue;

  const tp = side === 'LONG' ? currentPrice + tpDistance : currentPrice - tpDistance;
  const sl = side === 'LONG' ? currentPrice - slDistance : currentPrice + slDistance;

  return {
    targetPointsValue,
    stopLossPointsValue,
    pointValue,
    tp,
    sl,
    tpDistance,
    slDistance,
    riskRewardRatio: targetPointsValue / stopLossPointsValue,
  };
}

export interface PositionSizeInput {
  currentBalance: number;
  allocatedCapital: number;
  riskPerTradePercent: number;
  riskProfile: RiskProfileType | string;
  /**
   * Distância do stop em % do preço de entrada (ex: 0,02 = stop a 2% do
   * preço). Quando fornecida, o sizing vira fixed-fractional DE VERDADE:
   * o nocional é dimensionado para que perder o stop perca exatamente
   * `capital × riskPerTradePercent%` — não um % fixo de capital independente
   * da distância do stop (ver aviso abaixo). Opcional, só usado pelo
   * BacktestEngine (motor ao vivo tem sizing próprio, fora de escopo).
   */
  stopDistancePercent?: number;
}

/**
 * Dimensiona o nocional da posição (tradeCapital) a partir do risco desejado.
 *
 * 2026-07-30: FIX DE BUG — sem `stopDistancePercent`, esta função sempre
 * calculou `capital × risco% × multiplicador` como o NOCIONAL da posição,
 * nunca considerando a distância do stop. Isso significa que dois trades com
 * o mesmo `positionSizePercent` mas stops de tamanhos diferentes (ex: 1×ATR
 * vs. 4×ATR, como os presets deste catálogo usam) arriscavam quantias em
 * dinheiro MUITO diferentes — o oposto do que "fixed-fractional 1%" deveria
 * garantir (Van Tharp: o risco em $ por trade é o que deveria ser constante,
 * não o nocional). O comentário antigo em `presetStrategies.ts` alegava que
 * isso já normalizava risco entre ativos — não normalizava.
 *
 * IMPORTANTE: este bug NÃO contamina nenhum Sharpe/DSR já medido nas seções
 * 11.x do AI_BRAIN_SPEC.md, porque os scripts de pesquisa usam
 * `profitPercent` (retorno % sobre o preço, independente do nocional), nunca
 * o `profit` em dinheiro. Afeta só o dinheiro real that fica exposto — que é
 * o que finalmente importa quando o produto opera com capital de verdade.
 *
 * Com `stopDistancePercent` fornecido: nocional = risco em $ / distância do
 * stop em %. Sem ele: comportamento antigo preservado (fallback), para não
 * quebrar nenhum chamador que ainda não tenha essa informação disponível.
 *
 * 2026-08-16: FIX DE BUG — `minTradeCapital` antes era um PISO que empurrava
 * o nocional pra cima (`Math.max(tradeCapital, minTradeCapital)`) sempre que
 * o cálculo fixed-fractional dava um nocional menor que $10. Isso silenciosamente
 * INFLAVA o risco real muito além do `riskPerTradePercent` configurado —
 * medido em `research/experiments/2026-08-16-portfolio-amplitude/results/floor_check_by_profile.md`:
 * numa conta de $50 com risco de 0,5%/trade e stop largo (comum em timeframes
 * maiores), 24% dos sinais tinham nocional calculado abaixo do piso, e o piso
 * fixo forçava risco efetivo várias vezes maior que o configurado — o oposto
 * do que um perfil "Conservador" deveria fazer. Corrigido: quando o nocional
 * fixed-fractional fica abaixo de `minTradeCapital` (limite prático de
 * execução, não meta de risco), a função retorna `null` — quem chama deve
 * PULAR o trade, nunca forçar o tamanho pra cima. Um trade pequeno demais pra
 * executar de forma economicamente significativa deve ser descartado, não
 * transformado num trade que arrisca mais do que o usuário configurou.
 */
export function calculatePositionSize({
  currentBalance,
  allocatedCapital,
  riskPerTradePercent,
  riskProfile,
  stopDistancePercent,
}: PositionSizeInput): number | null {
  const capital = Math.min(allocatedCapital, currentBalance);
  const riskPercentage = riskPerTradePercent / 100;
  const { sizeMultiplier } = getRiskAdjustment(riskProfile);
  const riskCapital = capital * riskPercentage * sizeMultiplier;
  const minTradeCapital = 10;

  if (stopDistancePercent !== undefined && stopDistancePercent > 0) {
    const tradeCapital = riskCapital / stopDistancePercent;
    return tradeCapital >= minTradeCapital ? tradeCapital : null;
  }

  // Fallback: comportamento antigo (nocional = risco% de capital, sem
  // considerar distância do stop) — preservado por retrocompatibilidade.
  return riskCapital >= minTradeCapital ? riskCapital : null;
}

export interface AtrTpSlResult {
  tp: number | null; // null = sem alvo fixo (TRAILING_ONLY — só fecha por trailing stop ou regra de saída)
  sl: number;
  slDistance: number;
  tpDistance: number | null;
}

/**
 * Resolve TP/SL de uma estratégia no momento da entrada, preferindo ATR
 * quando `stopLossMode`/`takeProfitMode` pedirem — dimensiona o risco pela
 * volatilidade real do ativo (ver Strategy.stopLossMode em types/strategy.ts).
 * Cai para pontos fixos (comportamento antigo) quando o modo não é 'ATR', ou
 * quando o ATR não pôde ser calculado ainda (candle insuficiente no warmup).
 */
export function resolveTpSl(
  strategy: Strategy,
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  pointValue: number,
  atrValueAtEntry: number | null
): AtrTpSlResult {
  const useAtrForSl = strategy.stopLossMode === 'ATR' && atrValueAtEntry !== null && atrValueAtEntry > 0;
  const slDistance = useAtrForSl
    ? atrValueAtEntry! * (strategy.atrStopMultiplier ?? 2)
    : strategy.stopLoss * pointValue;

  let tpDistance: number | null;
  if (strategy.takeProfitMode === 'TRAILING_ONLY') {
    tpDistance = null;
  } else if (strategy.takeProfitMode === 'ATR' && atrValueAtEntry !== null && atrValueAtEntry > 0) {
    tpDistance = atrValueAtEntry * (strategy.atrTakeProfitMultiplier ?? 4);
  } else {
    tpDistance = strategy.takeProfit * pointValue;
  }

  const sl = side === 'LONG' ? entryPrice - slDistance : entryPrice + slDistance;
  const tp = tpDistance === null ? null : side === 'LONG' ? entryPrice + tpDistance : entryPrice - tpDistance;

  return { tp, sl, slDistance, tpDistance };
}

/** Trailing stop dinâmico: mesma regra de useApexLogic.ts (só melhora o SL a favor do trade). */
export function trailStopLoss(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  originalSl: number,
  currentSl: number,
  nextPrice: number
): number {
  const originalSlDistance = Math.abs(entryPrice - originalSl);
  const trailedSl = side === 'LONG' ? nextPrice - originalSlDistance : nextPrice + originalSlDistance;
  return side === 'LONG' ? Math.max(currentSl, trailedSl) : Math.min(currentSl, trailedSl);
}
