/**
 * 2026-11-03 (pedido do Cleber + conselho): OPERACAO DA ABERTURA DE NOVA YORK.
 *
 * Todo dia util, com a IA ligada, o motor faz UMA entrada por simbolo no rompimento da faixa que se forma antes
 * da abertura do mercado a vista americano. Horario ancorado no fuso de NY (09:30 ET), nunca em BRT fixo: no
 * inverno americano a abertura e 11:30 BRT; no verao, 10:30 BRT. Medido (180 dias uteis de BTC + inverno
 * 2025/26): a meia hora da abertura e a de maior amplitude do dia (2,6x-3,0x a media); a direcao NAO tem
 * vantagem medida (seguir a 1a vela deu E[R] liquido de -0,07 a -0,19R em 1 ano). O que se testa aqui e a
 * GESTAO: risco fixo em US$, sem alvo curto, stop pela estrutura do 1H, reforco so com o stop no zero a zero.
 *
 * Mecanica (uma ordem so, no lado que romper):
 *  - faixa = maxima/minima das velas de 1m entre 08:30 e 09:25 ET (inclui o dado macro das 08:30 ET);
 *  - das 09:25 as 11:00 ET: preco acima da maxima + folga = compra; abaixo da minima - folga = venda;
 *  - stop no outro extremo da faixa (+ folga). Alvo de referencia 10R (na pratica "deixa correr"; quem tira e o
 *    stop que acompanha a estrutura do 1H, ver enforceMt5StopsAndTargets);
 *  - lote = risco fixo em US$ / (distancia do stop x valor do ponto): o resultado em dolar fica equivalente em
 *    qualquer ativo (indice mais barato por ponto carrega mais lote, sem tabela por simbolo);
 *  - nada rompeu ate 11:00 ET: o dia termina sem entrada.
 *
 * Criterio de parada (protocolo de rodadas de 10 do Cleber): a contagem comeca em MT5_NY_OPEN_START_ISO. Para
 * sozinho quando a soma liquida das entradas da abertura chega a -MT5_NY_OPEN_MAX_LOSS_USD, ou quando a rodada
 * de MT5_NY_OPEN_ROUND_SIZE entradas termina (dai a decisao de seguir e do Cleber: nova data de inicio).
 * Rollback: MT5_NY_OPEN_TRADE=false.
 */
import { config } from "./config.js";
import { getDeepCandles } from "./atr.js";
import { getQuote as getMt5Quote } from "./mt5Broker.js";
import { LOT_SIZE, MIN_LOTS } from "./assetBasket.js";
import {
  getSupabaseClient,
  getTrialAbortReason,
  listMt5OpenPositions,
  logBrainActivity,
  openMt5Position,
} from "./neuralBridge.js";
import { isLiveExecutionActive, executeLiveMarketOrder } from "./liveExecution.js";
import type { Mt5Session } from "./agent.js";

export const NY_OPEN_SETUP = "ABERTURA_NY";

const RANGE_START_MIN = 8 * 60 + 30; // 08:30 ET
const ARM_MIN = 9 * 60 + 25; // 09:25 ET
const EXPIRE_MIN = 11 * 60; // 11:00 ET
const TARGET_R = 10;

/** Dia (YYYY-MM-DD), minutos do dia e dia da semana no fuso de Nova York. */
export function nyClock(now: Date = new Date()): { day: string; minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")), weekday };
}

/** Converte "minuto do dia em NY" de hoje para epoch ms (usa o offset real de NY agora, cobre horario de verao). */
function nyMinuteToEpochMs(minutes: number, now: Date = new Date()): number {
  const { minutes: nowMin } = nyClock(now);
  const startOfMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  return startOfMinute - (nowMin - minutes) * 60_000;
}

type DayState = { done: boolean; range?: { high: number; low: number }; note?: string };
const stateByKey = new Map<string, DayState>(); // chave: sessao|simbolo|dia NY

function symbols(): string[] {
  return (process.env.MT5_NY_OPEN_SYMBOLS ?? "BTCUSD")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** Entradas da abertura (ja abertas ou fechadas) desta sessao, desde o inicio da rodada. Propaga erro. */
async function roundStats(sessionId: string): Promise<{ entries: number; netClosed: number; todayBySymbol: Set<string> }> {
  const startIso = config.mt5NyOpenStartIso;
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("ai_trades")
    .select("symbol, status, net_pnl, entry_time")
    .eq("session_id", sessionId)
    .eq("is_test_data", true)
    .gte("entry_time", startIso)
    .eq("indicators_snapshot->>setupType", NY_OPEN_SETUP);
  if (error) throw error;
  const today = nyClock().day;
  const todayBySymbol = new Set<string>();
  let netClosed = 0;
  for (const t of data ?? []) {
    if (t.status === "CLOSED") netClosed += Number(t.net_pnl) || 0;
    if (nyClock(new Date(t.entry_time)).day === today) todayBySymbol.add(String(t.symbol));
  }
  return { entries: (data ?? []).length, netClosed, todayBySymbol };
}

/** Chamado a cada poucos segundos pelo index.ts. Nunca lanca. */
export async function nyOpenTick(sessions: Mt5Session[]): Promise<void> {
  if (!config.mt5NyOpenTradeEnabled || !config.mt5TradingEnabled) return;
  const clock = nyClock();
  if (clock.weekday < 1 || clock.weekday > 5) return;
  if (clock.minutes < ARM_MIN || clock.minutes >= EXPIRE_MIN) return;

  for (const session of sessions) {
    if (session.status !== "RUNNING") continue;
    let stats: Awaited<ReturnType<typeof roundStats>> | null = null;
    for (const symbol of symbols()) {
      const key = `${session.sessionId}|${symbol}|${clock.day}`;
      const st = stateByKey.get(key) ?? { done: false };
      stateByKey.set(key, st);
      if (st.done) continue;
      try {
        stats ??= await roundStats(session.sessionId);
        if (stats.todayBySymbol.has(symbol)) {
          st.done = true; // ja entrou hoje (ex.: motor reiniciado depois da entrada)
          continue;
        }
        if (stats.netClosed <= -config.mt5NyOpenMaxLossUsd) {
          finish(st, session, symbol, `rodada PARADA: perda acumulada das entradas da abertura $${stats.netClosed.toFixed(2)} (limite -$${config.mt5NyOpenMaxLossUsd})`);
          continue;
        }
        if (stats.entries >= config.mt5NyOpenRoundSize) {
          finish(st, session, symbol, `rodada de ${config.mt5NyOpenRoundSize} entradas CONCLUIDA (liquido fechado $${stats.netClosed.toFixed(2)}) -- aguardando decisao do Cleber (nova MT5_NY_OPEN_START_ISO)`);
          continue;
        }
        const abort = await getTrialAbortReason(session.sessionId);
        if (abort) {
          finish(st, session, symbol, `bloqueada pelo aborto automatico do teste: ${abort}`);
          continue;
        }
        const open = await listMt5OpenPositions(session.sessionId);
        if (open.some((p) => p.symbol === symbol)) {
          finish(st, session, symbol, `ja existe posicao aberta em ${symbol} nesta sessao (1 por simbolo) -- sem entrada da abertura hoje`);
          continue;
        }

        if (!st.range) {
          const candles = await getDeepCandles(symbol, "1m", 300);
          if (!candles) continue; // sem vela real agora; tenta no proximo tick
          const fromMs = nyMinuteToEpochMs(RANGE_START_MIN);
          const toMs = nyMinuteToEpochMs(ARM_MIN);
          const win = candles.filter((c) => c.timestamp >= fromMs && c.timestamp < toMs);
          if (win.length < 40) {
            finish(st, session, symbol, `velas de 1m insuficientes para a faixa 08:30-09:25 ET (${win.length}) -- sem entrada hoje`);
            continue;
          }
          st.range = { high: Math.max(...win.map((c) => c.high)), low: Math.min(...win.map((c) => c.low)) };
          console.log(`[ABERTURA-NY] ${symbol} faixa 08:30-09:25 ET: ${st.range.low} - ${st.range.high} (armada ate 11:00 ET)`);
          logBrainActivity({
            sessionId: session.sessionId,
            userId: session.userId,
            cycle: 0,
            type: "thought",
            symbol,
            message: `Abertura de NY armada em ${symbol}: compra acima de ${st.range.high}, venda abaixo de ${st.range.low} (faixa 08:30-09:25 ET), ate 11:00 ET.`,
          });
        }

        const quote = await getMt5Quote(symbol);
        if (!quote || quote.stale || !(quote.bid > 0) || !(quote.ask > 0)) continue;
        const spreadPct = (quote.ask - quote.bid) / quote.bid;
        const buf = config.mt5NyOpenBreakBufferPct;
        const { high, low } = st.range;
        let side: "LONG" | "SHORT" | null = null;
        if (quote.ask > high * (1 + buf)) side = "LONG";
        else if (quote.bid < low * (1 - buf)) side = "SHORT";
        if (!side) continue;
        if (spreadPct > config.mt5NyOpenMaxSpreadPct) {
          console.log(`[ABERTURA-NY] ${symbol} rompeu ${side} mas spread ${(spreadPct * 100).toFixed(3)}% acima do teto -- espera`);
          continue;
        }

        const fill = side === "LONG" ? quote.ask : quote.bid;
        const stopBuf = config.mt5AsymStopBufferPct;
        const stopLoss = side === "LONG" ? low * (1 - stopBuf) : high * (1 + stopBuf);
        const stopDist = Math.abs(fill - stopLoss);
        const stopPct = stopDist / fill;
        if (stopPct > config.mt5AsymMaxStopPct) {
          finish(st, session, symbol, `faixa larga demais: stop a ${(stopPct * 100).toFixed(2)}% (limite ${(config.mt5AsymMaxStopPct * 100).toFixed(1)}%) -- sem entrada hoje`);
          continue;
        }
        const pointUsd = LOT_SIZE[symbol];
        if (!pointUsd) {
          finish(st, session, symbol, `${symbol} sem LOT_SIZE conhecido -- sem entrada`);
          continue;
        }
        const riskUsd = config.mt5NyOpenRiskUsd;
        let lots = Math.round(riskUsd / (stopDist * pointUsd) / MIN_LOTS) * MIN_LOTS;
        if (lots < MIN_LOTS) lots = MIN_LOTS;
        lots = Math.min(lots, config.mt5SafetyMaxLots);
        const realRisk = lots * pointUsd * stopDist;
        if (realRisk > riskUsd * 1.5) {
          finish(st, session, symbol, `lote minimo daria risco de $${realRisk.toFixed(2)} (> 1,5x $${riskUsd}) -- sem entrada`);
          continue;
        }
        const takeProfit = side === "LONG" ? fill + TARGET_R * stopDist : fill - TARGET_R * stopDist;

        st.done = true; // marca antes de enviar: nunca duas entradas no mesmo dia, mesmo se algo abaixo falhar
        let entryPrice = fill;
        let finalStop = stopLoss;
        let finalTp = takeProfit;
        let brokerPositionId: string | null = null;
        if (await isLiveExecutionActive(session.userId)) {
          const live = await executeLiveMarketOrder(session.userId, { side, symbol, volume: lots, stopLoss, takeProfit, comment: `NDT Abertura NY ${side}` });
          if (!live.success || !live.fillPrice || !live.brokerPositionId) {
            console.error(`[ABERTURA-NY] ${symbol} ${side}: execucao real falhou (${live.error}) -- sem entrada hoje`);
            continue;
          }
          entryPrice = live.fillPrice;
          brokerPositionId = live.brokerPositionId;
          // mantem os NIVEIS de preco (stop no extremo da faixa), recalcula so o alvo de referencia
          finalStop = stopLoss;
          finalTp = side === "LONG" ? entryPrice + TARGET_R * Math.abs(entryPrice - stopLoss) : entryPrice - TARGET_R * Math.abs(entryPrice - stopLoss);
        }
        const amountUsd = lots * pointUsd * entryPrice;
        const reasoning =
          `[${NY_OPEN_SETUP}] Rompimento ${side === "LONG" ? "da maxima" : "da minima"} da faixa pre-abertura de NY ` +
          `(08:30-09:25 ET: ${low} - ${high}). Entrada ${entryPrice}, stop ${finalStop.toFixed(2)} no outro extremo da faixa ` +
          `(${(stopPct * 100).toFixed(3)}%), risco $${realRisk.toFixed(2)}, ${lots.toFixed(2)} lote(s). Sem alvo curto: ` +
          `referencia ${TARGET_R}R; o stop vai ao zero a zero com reforco em +1R e depois segue a estrutura do 1H. ` +
          `Teste de gestao: a direcao da abertura nao tem vantagem medida.`;
        const tradeId = await openMt5Position({
          sessionId: session.sessionId,
          userId: session.userId,
          symbol,
          side,
          entryPrice,
          amountUsd,
          stopLoss: finalStop,
          takeProfit: finalTp,
          reasoning,
          confidence: 50,
          brokerPositionId,
          indicatorsSnapshot: {
            setupType: NY_OPEN_SETUP,
            nyOpenRangeHigh: high,
            nyOpenRangeLow: low,
            nyOpenRiskUsd: Number(realRisk.toFixed(2)),
            nyOpenLots: lots,
            spreadPct: Number((spreadPct * 100).toFixed(4)),
            rule: "abertura-ny-faixa-0830-0925-v1",
          },
        });
        if (!tradeId) {
          console.error(`[ABERTURA-NY] ${symbol} ${side}: falha ao gravar a posicao`);
          continue;
        }
        console.log(`[ABERTURA-NY] ✅ ${symbol} ${side} aberta: entrada ${entryPrice}, stop ${finalStop.toFixed(2)}, risco $${realRisk.toFixed(2)}, ${lots.toFixed(2)} lote(s)`);
        logBrainActivity({ sessionId: session.sessionId, userId: session.userId, cycle: 0, type: "decision", symbol, message: reasoning });
        stats = null; // recarrega na proxima volta
      } catch (err) {
        console.error(`[ABERTURA-NY] ${symbol}:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

function finish(st: DayState, session: Mt5Session, symbol: string, note: string): void {
  st.done = true;
  st.note = note;
  console.log(`[ABERTURA-NY] ${symbol}: ${note}`);
  logBrainActivity({ sessionId: session.sessionId, userId: session.userId, cycle: 0, type: "thought", symbol, message: `Abertura de NY (${symbol}): ${note}` });
}
