import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Ponte pro Neural Day Trader (2026-08-28): espelha cada ordem real de
 * Binance executada por este agente (place_market_order em tools.ts) como
 * um trade virtual isolado em ai_trades/ai_sessions daquele projeto.
 *
 * Por que existe: o Cleber quer testar se este agente (validado neste repo,
 * dentro do ambiente/volatilidade da Binance) funciona como "cérebro" do
 * Neural Day Trader, rodando em paralelo ao motor mecânico existente, sem
 * misturar dado. Este módulo NUNCA influencia a decisão do agente (só
 * observa o resultado já executado) e nunca derruba o loop se falhar --
 * mesma filosofia de robustez do resto deste projeto (ver agent.ts).
 *
 * Isolamento: uma única ai_sessions própria (criada na primeira chamada,
 * reusada depois via cache em memória do processo), tag is_test_data=true
 * em cada ai_trades (convenção já usada no Neural Day Trader pra separar
 * dado de teste/experimento de trade real de produção -- ver
 * 20260827_label_test_data_ai_trades.sql naquele repo).
 */

const TEST_DATA_REASON =
  "Experimento 'cérebro autônomo' (repo autonomous_money, agente LLM full " +
  "tool-calling validado contra Binance testnet) rodando isolado em " +
  "paralelo ao motor mecânico, ver CONTEXT.md do repo autonomous_money.";

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (client) return client;
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseServiceRoleKey) {
    throw new Error(
      "NEURAL_SUPABASE_URL/NEURAL_SUPABASE_SERVICE_ROLE_KEY ausentes no .env " +
        "(necessarios com NEURAL_BRIDGE_ENABLED=true)."
    );
  }
  client = createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);
  return client;
}

let sessionIdPromise: Promise<string> | null = null;

async function getOrCreateSession(): Promise<string> {
  if (sessionIdPromise) return sessionIdPromise;
  sessionIdPromise = (async () => {
    if (!config.neuralUserId) {
      throw new Error("NEURAL_USER_ID ausente no .env (necessario com NEURAL_BRIDGE_ENABLED=true).");
    }
    const sb = getClient();

    // Reusa a sessao RUNNING mais recente marcada com esta strategy_name,
    // se existir (permite reiniciar o processo sem abrir sessao nova toda
    // hora). Caso contrario, cria uma.
    const { data: existing, error: findError } = await sb
      .from("ai_sessions")
      .select("id")
      .eq("user_id", config.neuralUserId)
      .eq("strategy_name", "LLM_ACTIVE_BRAIN_AUTONOMOUS_MONEY")
      .eq("status", "RUNNING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (existing?.id) return existing.id as string;

    const { data: created, error: createError } = await sb
      .from("ai_sessions")
      .insert({
        user_id: config.neuralUserId,
        strategy_name: "LLM_ACTIVE_BRAIN_AUTONOMOUS_MONEY",
        mode: "DEMO",
        symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"],
        initial_balance: 50,
        initial_equity: 50,
        status: "RUNNING",
        config: {
          source: "autonomous_money agent (full tool-calling LLM, sem gate mecanico)",
          binance_testnet: config.binanceTestnet,
          llm_provider: config.llmProvider,
          llm_model: config.llmModel,
        },
      })
      .select("id")
      .single();
    if (createError) throw createError;
    return created.id as string;
  })();
  return sessionIdPromise;
}

interface MirrorBuyParams {
  symbol: string;
  priceUsd: number;
  notionalUsd: number;
  reasoning: string;
}

interface MirrorSellParams {
  symbol: string;
  priceUsd: number;
  notionalUsd: number;
  reasoning: string;
}

/**
 * `ai_trades.quantity` NÃO é a quantidade bruta do ativo (ex: 0.002 ETH) --
 * é a exposição em dólares da posição (`amountUsd`), mesma convenção que
 * `calculateEngineConsistentPnL` (useApexLogic.ts) e o motor mecânico usam
 * pra todo símbolo (`pnl = (exit-entry) * (amountUsd/entry)`). Gravar a
 * quantidade bruta do ativo aqui faria o PnL exibido na plataforma ficar
 * ~1000x menor que o real pra cripto (achado do Cleber via vídeo, 2026-08-28:
 * posições ETHUSDT mostrando -2% de variação mas "-$0.00" de PnL).
 */

/** Abre um trade virtual OPEN (espelha uma compra real). Nunca lanca. */
export async function mirrorBuy(params: MirrorBuyParams): Promise<void> {
  if (!config.neuralBridgeEnabled) return;
  try {
    const sessionId = await getOrCreateSession();
    const sb = getClient();
    const { error } = await sb.from("ai_trades").insert({
      session_id: sessionId,
      user_id: config.neuralUserId,
      symbol: params.symbol,
      type: "BUY",
      side: "LONG",
      entry_price: params.priceUsd,
      quantity: params.notionalUsd,
      ai_reasoning: params.reasoning,
      entry_time: new Date().toISOString(),
      status: "OPEN",
      commission: 0,
      is_test_data: true,
      test_data_reason: TEST_DATA_REASON,
    });
    if (error) console.error("[neuralBridge] falha ao espelhar BUY:", error.message);
  } catch (err) {
    console.error("[neuralBridge] falha ao espelhar BUY:", err instanceof Error ? err.message : err);
  }
}

/**
 * Fecha trade(s) OPEN do simbolo em FIFO ate cobrir a exposicao em dolares
 * vendida (espelha uma venda real -- Binance ja impede vender mais do que o
 * agente tem em caixa, entao nao ha caso de "vender mais do que abriu" aqui).
 * Nunca lanca.
 */
export async function mirrorSell(params: MirrorSellParams): Promise<void> {
  if (!config.neuralBridgeEnabled) return;
  try {
    const sessionId = await getOrCreateSession();
    const sb = getClient();

    const { data: openTrades, error: fetchError } = await sb
      .from("ai_trades")
      .select("id, entry_price, quantity")
      .eq("session_id", sessionId)
      .eq("symbol", params.symbol)
      .eq("status", "OPEN")
      .order("entry_time", { ascending: true });
    if (fetchError) throw fetchError;

    let remaining = params.notionalUsd;
    const nowIso = new Date().toISOString();
    for (const trade of openTrades ?? []) {
      if (remaining <= 0) break;
      const lotQty = Number(trade.quantity);
      const closeQty = Math.min(lotQty, remaining);
      const entryPrice = Number(trade.entry_price);
      const pnl = (params.priceUsd - entryPrice) * (closeQty / entryPrice);
      const pnlPercentage = ((params.priceUsd - entryPrice) / entryPrice) * 100;

      if (closeQty >= lotQty) {
        // Fecha o lote inteiro.
        const { error } = await sb
          .from("ai_trades")
          .update({
            status: "CLOSED",
            exit_price: params.priceUsd,
            exit_time: nowIso,
            exit_reason: "AI_SIGNAL",
            pnl,
            pnl_percentage: pnlPercentage,
            net_pnl: pnl,
            ai_reasoning: `${params.reasoning} (fechamento)`,
          })
          .eq("id", trade.id);
        if (error) console.error("[neuralBridge] falha ao fechar lote (SELL):", error.message);
      } else {
        // Venda parcial do lote: fecha a fatia vendida como um trade
        // proprio (mesma quantidade original nao pode ser dividida em
        // ai_trades sem outra linha), e reduz a quantidade do lote restante.
        const { error: insertError } = await sb.from("ai_trades").insert({
          session_id: sessionId,
          user_id: config.neuralUserId,
          symbol: params.symbol,
          type: "SELL",
          side: "LONG",
          entry_price: trade.entry_price,
          exit_price: params.priceUsd,
          quantity: closeQty,
          entry_time: nowIso,
          exit_time: nowIso,
          status: "CLOSED",
          exit_reason: "AI_SIGNAL",
          pnl,
          pnl_percentage: pnlPercentage,
          net_pnl: pnl,
          commission: 0,
          ai_reasoning: `${params.reasoning} (fechamento parcial de lote aberto anteriormente)`,
          is_test_data: true,
          test_data_reason: TEST_DATA_REASON,
        });
        if (insertError) console.error("[neuralBridge] falha ao registrar SELL parcial:", insertError.message);

        const { error: updateError } = await sb
          .from("ai_trades")
          .update({ quantity: lotQty - closeQty })
          .eq("id", trade.id);
        if (updateError) console.error("[neuralBridge] falha ao reduzir lote (SELL parcial):", updateError.message);
      }

      remaining -= closeQty;
    }

    if (remaining > 0) {
      console.error(
        `[neuralBridge] SELL de $${params.notionalUsd} ${params.symbol} excedeu o total em lotes OPEN espelhados ` +
          `(sobrou $${remaining} sem lote pra fechar) -- provavel dessincronia entre o saldo real da Binance e o espelho local.`
      );
    }
  } catch (err) {
    console.error("[neuralBridge] falha ao espelhar SELL:", err instanceof Error ? err.message : err);
  }
}
