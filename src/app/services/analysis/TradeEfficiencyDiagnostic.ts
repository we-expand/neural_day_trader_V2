/**
 * Diagnóstico de eficiência de saída — Componente 5 do cérebro de execução
 * (decisão (B), `research/AI_BRAIN_SPEC.md` seção 14.5, `CLAUDE.md` pendência
 * #5). Análise RETROSPECTIVA dos trades já fechados do próprio usuário: mede
 * quanto do movimento favorável disponível (MFE) foi de fato capturado no
 * resultado realizado, e quanto de movimento adverso (MAE) a posição tolerou
 * antes de sair. Zero previsão — não estima nada sobre o próximo trade, só
 * descreve o que já aconteceu, com o mesmo cálculo de excursão do motor de
 * backtest (`BacktestEngine.ts`, high/low de cada candle real entre entrada e
 * saída, nunca só o preço de saída).
 *
 * Fonte de candle: `backtestDataService` (`BacktestDataService.ts`), a mesma
 * fonte real já usada por Replay/Backtest — lança erro explícito quando não
 * há dado real disponível, nunca preenche com valor fabricado (convenção do
 * projeto, `CLAUDE.md`).
 */
import { backtestDataService, type CandleData, type Timeframe } from '../BacktestDataService';

export interface ClosedTradeInput {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: number; // ms
  exitTime: number; // ms
  /** Resultado realizado do trade, em % do preço de entrada, já com o sinal do lado aplicado (positivo = lucro). */
  realizedPercent: number;
}

export interface TradeEfficiencyResult {
  tradeId: string;
  symbol: string;
  mfePercent: number;
  maePercent: number;
  realizedPercent: number;
  /** realizedPercent / mfePercent — quanto do movimento favorável disponível foi capturado. null quando mfePercent é 0 (preço nunca foi favorável). */
  exitEfficiency: number | null;
  /** % do MFE devolvido antes da saída ((mfePercent - realizedPercent) / mfePercent * 100). null quando mfePercent é 0. */
  gaveBackPercent: number | null;
}

export interface FailedTradeDiagnostic {
  tradeId: string;
  symbol: string;
  error: string;
}

export interface TradeEfficiencyReport {
  perTrade: TradeEfficiencyResult[];
  failedTrades: FailedTradeDiagnostic[];
  /** Média de exitEfficiency só entre trades com mfePercent > 0 (amostra reportada em sampleSizeWithMovement). null se nenhum trade teve MFE > 0. */
  averageExitEfficiency: number | null;
  averageGaveBackPercent: number | null;
  sampleSize: number;
  sampleSizeWithMovement: number;
}

/**
 * Excursão favorável/adversa máxima observada nos candles reais entre entrada
 * e saída, em % do preço de entrada (sempre >= 0). Mesma fórmula usada em
 * `BacktestEngine.ts` (barra a barra, high/low — não só o fechamento).
 */
export function computeMfeMaeFromCandles(
  candles: CandleData[],
  side: 'LONG' | 'SHORT',
  entryPrice: number,
): { mfePercent: number; maePercent: number } {
  if (entryPrice <= 0) {
    throw new Error('computeMfeMaeFromCandles: entryPrice precisa ser positivo');
  }

  let mfePercent = 0;
  let maePercent = 0;
  for (const candle of candles) {
    const favorable = side === 'LONG'
      ? (candle.high - entryPrice) / entryPrice * 100
      : (entryPrice - candle.low) / entryPrice * 100;
    const adverse = side === 'LONG'
      ? (entryPrice - candle.low) / entryPrice * 100
      : (candle.high - entryPrice) / entryPrice * 100;
    mfePercent = Math.max(mfePercent, favorable);
    maePercent = Math.max(maePercent, adverse);
  }
  return { mfePercent, maePercent };
}

/**
 * Compara o resultado realizado contra o MFE medido. Função pura — não busca
 * dado, só interpreta números já calculados.
 */
export function diagnoseTradeEfficiency(
  mfePercent: number,
  realizedPercent: number,
): { exitEfficiency: number | null; gaveBackPercent: number | null } {
  if (mfePercent <= 0) {
    return { exitEfficiency: null, gaveBackPercent: null };
  }
  return {
    exitEfficiency: realizedPercent / mfePercent,
    gaveBackPercent: ((mfePercent - realizedPercent) / mfePercent) * 100,
  };
}

/**
 * Timeframe de candle usado pra reconstruir a excursão do trade, escolhido só
 * pelo tamanho da janela (evita pedir milhões de candles de 1m pra um trade
 * de vários dias) — não é uma escolha de sinal, é limite prático de payload.
 */
export function pickDiagnosticTimeframe(entryTime: number, exitTime: number): Timeframe {
  const hours = (exitTime - entryTime) / 3_600_000;
  if (hours <= 6) return '1m';
  if (hours <= 48) return '5m';
  if (hours <= 24 * 14) return '1h';
  return '4h';
}

/**
 * Reconstrói MFE/MAE de um único trade fechado buscando candle real da janela
 * entrada→saída. Lança erro (nunca retorna dado fabricado) quando o trade tem
 * timestamps inválidos ou quando `backtestDataService` não tem fonte real pro
 * símbolo/janela.
 */
export async function diagnoseClosedTrade(trade: ClosedTradeInput): Promise<TradeEfficiencyResult> {
  if (trade.exitTime <= trade.entryTime) {
    throw new Error(`trade ${trade.id}: exitTime <= entryTime — não é possível medir excursão real`);
  }

  const timeframe = pickDiagnosticTimeframe(trade.entryTime, trade.exitTime);
  const { candles } = await backtestDataService.fetchHistoricalData(
    trade.symbol,
    new Date(trade.entryTime),
    new Date(trade.exitTime),
    timeframe,
  );

  const { mfePercent, maePercent } = computeMfeMaeFromCandles(candles, trade.side, trade.entryPrice);
  const { exitEfficiency, gaveBackPercent } = diagnoseTradeEfficiency(mfePercent, trade.realizedPercent);

  return {
    tradeId: trade.id,
    symbol: trade.symbol,
    mfePercent,
    maePercent,
    realizedPercent: trade.realizedPercent,
    exitEfficiency,
    gaveBackPercent,
  };
}

/**
 * Diagnostica um lote de trades fechados do usuário. Chamadas SEQUENCIAIS de
 * propósito (mesma razão do `CLAUDE.md`/experimentos deste projeto: fontes de
 * candle real — Binance pública e /mt5-candles-history via conta MetaAPI
 * compartilhada — já sofreram rate-limit sob rajada). Falha de um trade nunca
 * derruba o lote inteiro: entra em `failedTrades` com o motivo, o resto segue.
 */
export async function diagnoseClosedTrades(trades: ClosedTradeInput[]): Promise<TradeEfficiencyReport> {
  const perTrade: TradeEfficiencyResult[] = [];
  const failedTrades: FailedTradeDiagnostic[] = [];

  for (const trade of trades) {
    try {
      perTrade.push(await diagnoseClosedTrade(trade));
    } catch (err) {
      failedTrades.push({
        tradeId: trade.id,
        symbol: trade.symbol,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const withMovement = perTrade.filter(t => t.exitEfficiency !== null);
  const averageExitEfficiency = withMovement.length > 0
    ? withMovement.reduce((sum, t) => sum + (t.exitEfficiency as number), 0) / withMovement.length
    : null;
  const averageGaveBackPercent = withMovement.length > 0
    ? withMovement.reduce((sum, t) => sum + (t.gaveBackPercent as number), 0) / withMovement.length
    : null;

  return {
    perTrade,
    failedTrades,
    averageExitEfficiency,
    averageGaveBackPercent,
    sampleSize: perTrade.length,
    sampleSizeWithMovement: withMovement.length,
  };
}
