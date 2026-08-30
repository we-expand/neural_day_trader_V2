import { getClosedTradesForMemory, type Mt5ClosedTradeForMemory } from "./neuralBridge.js";

/**
 * Memória de trades (2026-08-30, handoff "Parte B" em CLAUDE.md/
 * SESSAO_2026-08-29_CANDLE_REAL_E_PRICE_ACTION.md). NÃO é ML/fine-tuning --
 * nenhum peso muda. É injeção de contexto: o modelo passa a ler, a cada
 * ciclo, um resumo de fato real (últimos trades fechados desta sessão) já
 * gravado no banco, em vez de decidir "no vácuo" sem lembrar do que já
 * tentou. Efeito NÃO validado -- validar exigiria comparar taxa de
 * reentrada em símbolo+lado perdedor com/sem o bloco ao longo de dias,
 * amostra que ainda não existe. Registrar como pendência, não como ganho.
 */

const CACHE_TTL_MS = 60_000; // ciclo é de 10s -- sem cache, 6x mais query que necessário
let cache: { block: string; fetchedAt: number } | null = null;

interface SymbolSideStats {
  symbol: string;
  side: "LONG" | "SHORT";
  n: number;
  wins: number;
  losses: number;
  pnlSum: number;
  /** Sequência de derrotas consecutivas MAIS RECENTE (trades já vêm ordenados por exit_time desc). */
  currentLossStreak: number;
}

function aggregate(trades: Mt5ClosedTradeForMemory[]): SymbolSideStats[] {
  const byKey = new Map<string, SymbolSideStats>();
  for (const t of trades) {
    const key = `${t.symbol}|${t.side}`;
    let stats = byKey.get(key);
    if (!stats) {
      stats = { symbol: t.symbol, side: t.side, n: 0, wins: 0, losses: 0, pnlSum: 0, currentLossStreak: 0 };
      byKey.set(key, stats);
    }
    const pnl = t.pnl ?? 0;
    const isWin = pnl > 0;
    stats.n++;
    stats.pnlSum += pnl;
    if (isWin) stats.wins++;
    else stats.losses++;
    // trades chegam mais-recente-primeiro: streak só cresce enquanto ainda
    // não apareceu nenhuma vitória pra esta combinação symbol+lado.
    if (!isWin && stats.wins === 0) stats.currentLossStreak++;
  }
  return Array.from(byKey.values());
}

// Teto duro de ~1600 caracteres (~350 tokens): o ciclo tem até 25 iterações,
// cada uma reenvia o userMessage inteiro -- sem teto isso vira 5M+
// tokens/hora (achado do Agente 1). Corta linhas menos relevantes (menor
// |pnlSum|) primeiro se estourar.
const MAX_BLOCK_CHARS = 1600;

function formatBlock(stats: SymbolSideStats[]): string {
  if (stats.length === 0) return "";
  const sorted = [...stats].sort((a, b) => Math.abs(b.pnlSum) - Math.abs(a.pnlSum));
  const lines: string[] = [];
  for (const s of sorted) {
    const winRate = s.n > 0 ? ((s.wins / s.n) * 100).toFixed(0) : "0";
    const streakNote = s.currentLossStreak >= 2 ? ` -- ${s.currentLossStreak}x SEGUIDAS PERDENDO agora` : "";
    lines.push(
      `${s.symbol} ${s.side}: ${s.n} trades, ${s.wins}W/${s.losses}L (${winRate}%), PnL $${s.pnlSum.toFixed(2)}${streakNote}`
    );
  }
  let body = lines.join("\n");
  while (body.length > MAX_BLOCK_CHARS && lines.length > 1) {
    lines.pop();
    body = lines.join("\n");
  }
  return (
    `MEMORIA DE TRADES (fato real, ultimos ${sorted.reduce((n, s) => n + s.n, 0)} fechados desta sessao, ` +
    `agregado por simbolo+lado -- NAO e garantia estatistica, e registro pra nao repetir erro):\n${body}`
  );
}

/** Devolve o bloco de memória (com cache de 60s) ou string vazia se não houver trade fechado / falhar. */
export async function getTradeMemoryBlock(): Promise<string> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.block;
  const trades = await getClosedTradesForMemory(30);
  const block = formatBlock(aggregate(trades));
  cache = { block, fetchedAt: Date.now() };
  return block;
}
