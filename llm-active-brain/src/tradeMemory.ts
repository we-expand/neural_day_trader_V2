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
 *
 * 🔴 2026-09-22 (Passo 2 do conselho "CONSELHO_2026-09-22_UPGRADE_LLM_
 * TRADER.md"): achado real do diagnóstico -- `ai_reasoning` de cada trade
 * fechado já era buscado do banco (getClosedTradesForMemory) e DESCARTADO
 * aqui, `aggregate()` só somava PnL. O motivo de cada perda estava pago
 * (mesma query) e nunca chegava no prompt. Agora o bloco também traz, para
 * os trades mais relevantes (maior |pnl| absoluto, teto de 5), a TESE que
 * a IA escreveu ao lado do resultado real -- "você disse X, deu $Y" em vez
 * de só um agregado numérico. Ainda não é revisão pós-trade estruturada
 * (comparar tese vs. o que o preço fez de fato) nem few-shot escolhido por
 * dado -- é o primeiro degrau: parar de jogar fora um dado que já está
 * pago. Mesma disciplina do bloco acima: sem validação estatística de
 * efeito ainda.
 */

const CACHE_TTL_MS = 60_000; // ciclo é de 10s -- sem cache, 6x mais query que necessário
// 🔴 2026-08-31 (Fase 2 multi-tenant): era `let cache` global -- corretor
// só quando havia 1 sessão. Agora por `sessionId`, senão a memória de trades
// de uma sessão vazaria pra outra.
const cacheBySession = new Map<string, { block: string; fetchedAt: number }>();

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
// Teto separado pra secao de teses reais (Passo 2) -- mesmo motivo do teto
// acima, orcamento proprio pra nao competir com o agregado por espaco.
const MAX_REASONING_BLOCK_CHARS = 1200;
const MAX_REASONING_TRADES = 5;
const MAX_REASONING_CHARS_PER_TRADE = 220;

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

/**
 * Passo 2 (2026-09-22): teses reais ao lado do resultado, para os trades
 * mais relevantes (maior |pnl| absoluto entre os `limit` mais recentes --
 * não é "os N mais recentes", é "os N que mais pesaram", pra não desperdiçar
 * o orçamento de caracteres com trades de PnL perto de zero, que ensinam
 * pouco). `ai_reasoning` pode conter a tese de ENTRADA concatenada com a de
 * SAÍDA (formato "entrada || SAIDA: saida", ver closeMt5Position em
 * neuralBridge.ts) -- truncado por trade, não reescrito/resumido: é o texto
 * real que a IA escreveu, nunca fabricado.
 */
function formatReasoningBlock(trades: Mt5ClosedTradeForMemory[]): string {
  const withReasoning = trades.filter((t) => t.ai_reasoning && t.ai_reasoning.trim().length > 0);
  if (withReasoning.length === 0) return "";
  const sorted = [...withReasoning].sort((a, b) => Math.abs(b.pnl ?? 0) - Math.abs(a.pnl ?? 0));
  const picked = sorted.slice(0, MAX_REASONING_TRADES);
  const lines: string[] = [];
  for (const t of picked) {
    const pnl = t.pnl ?? 0;
    const pnlLabel = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    let reasoning = (t.ai_reasoning ?? "").trim().replace(/\s+/g, " ");
    if (reasoning.length > MAX_REASONING_CHARS_PER_TRADE) {
      reasoning = reasoning.slice(0, MAX_REASONING_CHARS_PER_TRADE) + "...";
    }
    lines.push(`${t.symbol} ${t.side} (${pnlLabel}, saiu por ${t.exit_reason ?? "?"}): "${reasoning}"`);
  }
  let body = lines.join("\n");
  while (body.length > MAX_REASONING_BLOCK_CHARS && lines.length > 1) {
    lines.pop();
    body = lines.join("\n");
  }
  return (
    `\n\nTESES REAIS DOS TRADES MAIS RELEVANTES (o que voce escreveu vs o resultado real -- ` +
    `NUNCA repita um raciocinio que ja deu errado do mesmo jeito, sem um fator NOVO real que ` +
    `justifique a diferenca):\n${body}`
  );
}

/** Devolve o bloco de memória (com cache de 60s) ou string vazia se não houver trade fechado / falhar. */
export async function getTradeMemoryBlock(sessionId: string): Promise<string> {
  const cache = cacheBySession.get(sessionId);
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.block;
  const trades = await getClosedTradesForMemory(sessionId, 30);
  const block = formatBlock(aggregate(trades)) + formatReasoningBlock(trades);
  cacheBySession.set(sessionId, { block, fetchedAt: Date.now() });
  return block;
}
