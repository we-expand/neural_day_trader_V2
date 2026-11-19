// ENSAIO da mesa de operações: roda os 14 agentes de verdade (dados reais de
// mercado + LLM real) sobre uma proposta HIPOTÉTICA, e imprime o debate.
// NÃO abre posição, NÃO grava em ai_trades, NÃO escreve no painel da IA.
// Grava só em ledger/desk_dry_runs.jsonl.
//
// Uso:  npx tsx scripts/desk-dry-run.ts BTCUSD LONG
//       npx tsx scripts/desk-dry-run.ts NAS100 SHORT --llm-only
import { runTradingDesk } from "../src/desk.js";
import { getQuote } from "../src/mt5Broker.js";
import { getAtrPercent } from "../src/atr.js";
import { config } from "../src/config.js";

const symbol = (process.argv[2] ?? "BTCUSD").toUpperCase();
const side = (process.argv[3] ?? "LONG").toUpperCase() === "SHORT" ? "SHORT" : "LONG";
const llmOnly = process.argv.includes("--llm-only");

const quote = await getQuote(symbol);
if (!quote) {
  console.error(`Sem cotação real para ${symbol} -- ensaio abortado (nada é inventado).`);
  process.exit(1);
}
if (quote.stale) console.warn(`AVISO: cotação de ${symbol} está obsoleta (${quote.tickAgeSeconds}s). Mercado provavelmente fechado.`);

const atrPct = await getAtrPercent(symbol, "5m");
// Mesma conta do motor: stop = 2x ATR (ou o valor de reserva), alvo = teto de scalp.
const stopPct = atrPct != null ? atrPct * config.mt5StopAtrMultiplier : config.mt5StopFallbackPct;
const takeProfitPct = config.mt5ScalpTargetMaxPct / 100;
const balance = 100; // conta HIPOTÉTICA só para o ensaio
const riskUsd = 3;
const amountUsd = riskUsd / stopPct;

console.log(`\nENSAIO: ${symbol} ${side} a ${side === "LONG" ? quote.ask : quote.bid} | stop ${(stopPct * 100).toFixed(3)}% | alvo ${(takeProfitPct * 100).toFixed(3)}% | conta hipotética de $${balance}\n`);

const result = await runTradingDesk({
  sessionId: "ensaio",
  userId: "ensaio",
  cycle: 0,
  symbol,
  side,
  setupType: null,
  operatorReasoning: "(ensaio: proposta hipotética, sem tese do operador)",
  operatorConfidence: null,
  entryPrice: side === "LONG" ? quote.ask : quote.bid,
  stopPct,
  takeProfitPct,
  amountUsd,
  riskUsd,
  balance,
  lots: 0.01,
  spreadPct: Number.isFinite(quote.spreadPct) ? quote.spreadPct : null,
  dayChangePct: Number.isFinite(quote.changePercent) ? quote.changePercent : null,
  llmOnly,
  basketBreadth: [],
  dryRun: true,
  riskFacts: {
    entriesLast24h: 0,
    todayPnlUsd: 0,
    todayLossPctOfBalance: 0,
    dailyLossLimitPct: null,
    openPositions: [],
    correlatedGroup: [symbol],
    correlatedSameSideExposureUsd: 0,
    recentTradesThisSymbol: [],
    maxRiskPctPerTrade: config.mt5MaxRiskPctPerTrade,
    rewardCappedByRisk: false,
    targetNotes: [`alvo limitado pelo teto de scalp de ${config.mt5ScalpTargetMaxPct}% do preco`],
  },
});

console.log(`\n=== RESULTADO DO ENSAIO ===`);
console.log(`Decisão: ${result.decision}${result.sizeFactor < 1 ? " (metade)" : ""} | convicção: ${result.conviction ?? "n/d"}`);
console.log(`Motivo: ${result.reason}`);
console.log(`Tempo: ${(result.durationMs / 1000).toFixed(1)}s | chamadas de LLM: ${result.llmCalls} | agentes sem resposta: ${result.failedAgents.join(", ") || "nenhum"}`);
if (result.error) console.log(`Falha: ${result.error}`);
process.exit(0);
