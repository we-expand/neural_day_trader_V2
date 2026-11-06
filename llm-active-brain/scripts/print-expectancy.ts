import { createClient } from "@supabase/supabase-js";
import { config } from "../src/config.js";
import {
  computeExpectancy,
  MIN_SAMPLE_EXPECTANCY,
  type TradeOutcome,
} from "../../src/app/services/risk/ExpectancyEngine.ts";

/**
 * Wiring real do ExpectancyEngine (2026-09-18, pedido do Cleber na sessão
 * "evoluir a taxa de acerto para 70%") — item 3 do plano de calibração.
 *
 * Por que existe: `ExpectancyEngine.ts` (expectância em R, IC de Wilson,
 * payoff) estava escrito e testado desde antes, mas não era importado por
 * nada além do próprio validador — a plataforma mostrava taxa de acerto sem
 * dizer se é edge ou ruído de amostra pequena. Este script fecha esse
 * buraco: lê `ai_trades` de verdade (LLM Brain, `strategy_name =
 * 'LLM_ACTIVE_BRAIN_MT5'`) e chama o MESMO motor de expectância já
 * validado, sem reimplementar a fórmula.
 *
 * R-multiple de cada trade = net_pnl / risco em $ na abertura, onde o risco
 * em $ é `|entry_price - stop_loss| * quantity / entry_price` — a MESMA
 * fórmula de PnL já usada no motor ao vivo (`neuralBridge.ts`, PnL =
 * `(price - entry_price) * (quantity / entry_price)`; risco é a mesma
 * conta com a distância até o stop no lugar da distância até o preço de
 * saída). `quantity` em `ai_trades` é exposição em USD (notional), NÃO
 * lotes nem unidades do ativo — usar `quantity` como lote aqui já produziu
 * um número absurdo (risco médio de $73 mil) na primeira tentativa desta
 * sessão, mesma classe de bug de escala já catalogada no projeto (ver
 * CLAUDE.md, pointValue/XBNUSD). Conferido contra a fórmula real antes de
 * escrever este script — não é suposição.
 *
 * Nota de unidade: `pnlPercent`/`riskedPercent` do `TradeOutcome` aqui vão
 * em dólares, não em % de capital — o `expectancyR` (a razão entre os
 * dois) é o mesmo de qualquer forma, mas `expectancyPercent` (que a
 * função também devolve, escalado pelo `riskedPercent` médio) NÃO é uma
 * % de capital real neste script, é só a mesma razão em $ — marcado
 * explicitamente na saída pra não ser lido como % de conta por engano.
 *
 * Trades sem `entry_price`/`stop_loss`/`quantity` válidos (ou distância de
 * stop zero) são EXCLUÍDOS, não zerados — reportados à parte, nunca
 * fabricados como R=0.
 *
 * Uso:
 *   npx tsx scripts/print-expectancy.ts
 *   npx tsx scripts/print-expectancy.ts --since=2026-09-01
 *   npx tsx scripts/print-expectancy.ts --symbol=BTCUSD
 *   npx tsx scripts/print-expectancy.ts --by-symbol
 */

interface ClosedTradeRow {
  id: string;
  symbol: string;
  net_pnl: number | null;
  entry_price: number | null;
  stop_loss: number | null;
  quantity: number | null;
  exit_time: string | null;
}

function getClient() {
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseServiceRoleKey) {
    throw new Error(
      "NEURAL_SUPABASE_URL/NEURAL_SUPABASE_SERVICE_ROLE_KEY ausentes no .env."
    );
  }
  return createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);
}

function parseArgs(argv: string[]) {
  const out: { since?: string; symbol?: string; bySymbol: boolean } = { bySymbol: false };
  for (const arg of argv) {
    if (arg === "--by-symbol") out.bySymbol = true;
    else if (arg.startsWith("--since=")) out.since = arg.slice("--since=".length);
    else if (arg.startsWith("--symbol=")) out.symbol = arg.slice("--symbol=".length).toUpperCase();
  }
  return out;
}

/** Converte uma linha crua em TradeOutcome, ou null se faltar dado real pra medir o risco. */
function toOutcome(row: ClosedTradeRow): TradeOutcome | null {
  const { net_pnl, entry_price, stop_loss, quantity } = row;
  if (net_pnl == null || entry_price == null || stop_loss == null || quantity == null) return null;
  if (entry_price <= 0 || quantity <= 0) return null;
  const stopDistance = Math.abs(entry_price - stop_loss);
  if (stopDistance <= 0) return null;
  const riskedUsd = (stopDistance * quantity) / entry_price;
  if (riskedUsd <= 0) return null;
  return { pnlPercent: net_pnl, riskedPercent: riskedUsd };
}

function printResult(label: string, rows: ClosedTradeRow[]) {
  const outcomes: TradeOutcome[] = [];
  let excluded = 0;
  for (const row of rows) {
    const outcome = toOutcome(row);
    if (outcome) outcomes.push(outcome);
    else excluded++;
  }

  console.log(`\n=== ${label} ===`);
  console.log(`trades fechados: ${rows.length} | com stop/quantity/entry válidos: ${outcomes.length} | excluídos (sem dado pra medir risco): ${excluded}`);

  if (outcomes.length === 0) {
    console.log("Sem trades com risco medível — nada a reportar (não fabricado).");
    return;
  }

  const r = computeExpectancy(outcomes);
  console.log(`amostra: ${r.sampleSize} (${r.conclusive ? "conclusiva, ≥" + MIN_SAMPLE_EXPECTANCY : "AINDA NÃO conclusiva, < " + MIN_SAMPLE_EXPECTANCY})`);
  console.log(`taxa de acerto: ${r.winRate.toFixed(1)}% (IC95% Wilson: [${r.winRateCI95.lower.toFixed(1)}%, ${r.winRateCI95.upper.toFixed(1)}%])`);
  console.log(`R médio ganho: +${r.avgWinR.toFixed(2)}R | R médio perdido: -${r.avgLossR.toFixed(2)}R | payoff: ${r.payoffRatio.toFixed(2)}x`);
  console.log(`expectância: ${r.expectancyR >= 0 ? "+" : ""}${r.expectancyR.toFixed(3)}R por trade (${r.expectancyPercent >= 0 ? "+" : ""}${r.expectancyPercent.toFixed(3)}, MESMA unidade de risco em $, não é % de conta)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sb = getClient();

  let query = sb
    .from("ai_trades")
    .select("id, symbol, net_pnl, entry_price, stop_loss, quantity, exit_time, ai_sessions!inner(strategy_name)")
    .eq("status", "CLOSED")
    .eq("ai_sessions.strategy_name", "LLM_ACTIVE_BRAIN_MT5");

  if (args.since) query = query.gte("exit_time", args.since);
  if (args.symbol) query = query.eq("symbol", args.symbol);

  const { data, error } = await query;
  if (error) {
    console.error("Falha ao consultar ai_trades:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as unknown as ClosedTradeRow[];
  if (rows.length === 0) {
    console.log("Nenhum trade fechado encontrado com esses filtros.");
    return;
  }

  const label = `LLM_ACTIVE_BRAIN_MT5${args.since ? ` desde ${args.since}` : ""}${args.symbol ? ` — ${args.symbol}` : ""}`;
  printResult(label, rows);

  if (args.bySymbol) {
    const bySymbol = new Map<string, ClosedTradeRow[]>();
    for (const row of rows) {
      const list = bySymbol.get(row.symbol) ?? [];
      list.push(row);
      bySymbol.set(row.symbol, list);
    }
    for (const [symbol, symbolRows] of [...bySymbol.entries()].sort((a, b) => b[1].length - a[1].length)) {
      printResult(symbol, symbolRows);
    }
  }
}

main().catch((err) => {
  console.error("Erro:", err instanceof Error ? err.message : err);
  process.exit(1);
});
