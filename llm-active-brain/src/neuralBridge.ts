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

    // Reusa a sessao mais recente marcada com esta strategy_name, se existir
    // (permite reiniciar o processo sem abrir sessao nova toda hora). Caso
    // contrario, cria uma.
    //
    // 🔴 NUNCA filtrar/criar com status='RUNNING' aqui (bug real, 2026-08-29,
    // achado do Cleber por captura de tela: "posicao aberta parada e com
    // valor de patrimonio do motor mecanico"). `AITradingPersistenceService.
    // getActiveSession()` -- usado pelo MOTOR MECANICO DE VERDADE no
    // navegador -- busca simplesmente "a sessao RUNNING mais recente do
    // usuario", SEM filtrar por strategy_name. Como esta sessao isolada e
    // criada depois da sessao do motor mecanico, ela virava "a sessao ativa"
    // do proprio motor real no navegador -- nao so exibicao, o motor mecanico
    // passava a operar em cima do estado desta sessao isolada. Usar
    // status='PAUSED' mantem esta sessao completamente fora do alcance de
    // getActiveSession() (que so olha RUNNING), sem impedir nada do que esta
    // ponte precisa fazer (ela sempre acessa por session_id direto, nunca
    // via "sessao ativa").
    const { data: existing, error: findError } = await sb
      .from("ai_sessions")
      .select("id")
      .eq("user_id", config.neuralUserId)
      .eq("strategy_name", "LLM_ACTIVE_BRAIN_AUTONOMOUS_MONEY")
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
        status: "PAUSED",
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

// ============================================================================
// TRILHO MT5 (2026-08-29) -- cesta/preço/execução do motor mecânico, sem
// Binance/cripto. Sessão própria e separada da do trilho Binance acima (não
// mistura os dois experimentos). Aqui a posição é aberta/fechada pelo ID
// direto (não FIFO por quantidade vendida) porque o agente decide LONG/SHORT
// explicitamente, igual ao motor mecânico -- não é "comprar/vender um saldo
// de ativo" como no trilho spot cripto.
// ============================================================================

const MT5_STRATEGY_NAME = "LLM_ACTIVE_BRAIN_MT5";
const MT5_TEST_DATA_REASON =
  "Cérebro LLM ativo (trilho MT5, sem Binance/cripto) operando a mesma cesta/preço/execução " +
  "do motor mecânico, em sessão isolada -- pedido do Cleber, 2026-08-29.";

let mt5SessionIdPromise: Promise<string> | null = null;

async function getOrCreateMt5Session(symbols: string[]): Promise<string> {
  if (mt5SessionIdPromise) return mt5SessionIdPromise;
  mt5SessionIdPromise = (async () => {
    if (!config.neuralUserId) {
      throw new Error("NEURAL_USER_ID ausente no .env (necessario com NEURAL_BRIDGE_ENABLED=true).");
    }
    const sb = getClient();

    // Mesma regra do trilho Binance acima: NUNCA status='RUNNING' aqui (ver
    // comentário grande em getOrCreateSession) -- ficaria visível pro
    // getActiveSession() do motor mecânico real no navegador.
    const { data: existing, error: findError } = await sb
      .from("ai_sessions")
      .select("id")
      .eq("user_id", config.neuralUserId)
      .eq("strategy_name", MT5_STRATEGY_NAME)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (existing?.id) return existing.id as string;

    const { data: created, error: createError } = await sb
      .from("ai_sessions")
      .insert({
        user_id: config.neuralUserId,
        strategy_name: MT5_STRATEGY_NAME,
        mode: "DEMO",
        symbols,
        initial_balance: 50,
        initial_equity: 50,
        status: "PAUSED",
        config: {
          source: "llm-active-brain (agente full tool-calling, sem gate mecanico, cesta/preco/execucao do motor mecanico)",
          llm_provider: config.llmProvider,
          llm_model: config.llmModel,
        },
      })
      .select("id")
      .single();
    if (createError) throw createError;
    return created.id as string;
  })();
  return mt5SessionIdPromise;
}

export interface OpenMt5PositionParams {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  amountUsd: number;
  reasoning: string;
  symbolsForNewSession: string[];
}

/** Abre uma posição virtual OPEN no trilho MT5. Retorna o id (pra poder fechar depois) ou null se falhar. Nunca lança. */
export async function openMt5Position(params: OpenMt5PositionParams): Promise<string | null> {
  if (!config.neuralBridgeEnabled) return null;
  try {
    const sessionId = await getOrCreateMt5Session(params.symbolsForNewSession);
    const sb = getClient();
    const { data, error } = await sb
      .from("ai_trades")
      .insert({
        session_id: sessionId,
        user_id: config.neuralUserId,
        symbol: params.symbol,
        type: params.side === "LONG" ? "BUY" : "SELL",
        side: params.side,
        entry_price: params.entryPrice,
        quantity: params.amountUsd,
        ai_reasoning: params.reasoning,
        entry_time: new Date().toISOString(),
        status: "OPEN",
        commission: 0,
        is_test_data: true,
        test_data_reason: MT5_TEST_DATA_REASON,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[neuralBridge/mt5] falha ao abrir posição:", error.message);
      return null;
    }
    return data.id as string;
  } catch (err) {
    console.error("[neuralBridge/mt5] falha ao abrir posição:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface Mt5OpenPosition {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry_price: number;
  quantity: number;
  entry_time: string;
}

/** Lista as posições OPEN do trilho MT5 (pro agente decidir o que fechar). Nunca lança -- [] em falha. */
export async function listMt5OpenPositions(): Promise<Mt5OpenPosition[]> {
  if (!config.neuralBridgeEnabled) return [];
  try {
    const sessionId = await getOrCreateMt5Session([]);
    const sb = getClient();
    const { data, error } = await sb
      .from("ai_trades")
      .select("id, symbol, side, entry_price, quantity, entry_time")
      .eq("session_id", sessionId)
      .eq("status", "OPEN")
      .order("entry_time", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Mt5OpenPosition[];
  } catch (err) {
    console.error("[neuralBridge/mt5] falha ao listar posições abertas:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Fecha uma posição OPEN do trilho MT5 pelo id, calculando PnL com a MESMA fórmula do motor mecânico. Nunca lança. */
export async function closeMt5Position(params: { tradeId: string; exitPrice: number; reasoning: string }): Promise<boolean> {
  if (!config.neuralBridgeEnabled) return false;
  try {
    const sb = getClient();
    const { data: trade, error: fetchError } = await sb
      .from("ai_trades")
      .select("entry_price, side, quantity")
      .eq("id", params.tradeId)
      .eq("status", "OPEN")
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!trade) {
      console.error(`[neuralBridge/mt5] tentativa de fechar posição inexistente/já fechada: ${params.tradeId}`);
      return false;
    }
    const entryPrice = Number(trade.entry_price);
    const amountUsd = Number(trade.quantity);
    const side = trade.side as "LONG" | "SHORT";
    const pnl =
      side === "LONG"
        ? (params.exitPrice - entryPrice) * (amountUsd / entryPrice)
        : (entryPrice - params.exitPrice) * (amountUsd / entryPrice);
    const pnlPercentage = ((params.exitPrice - entryPrice) / entryPrice) * 100 * (side === "LONG" ? 1 : -1);

    const { error: updateError } = await sb
      .from("ai_trades")
      .update({
        status: "CLOSED",
        exit_price: params.exitPrice,
        exit_time: new Date().toISOString(),
        exit_reason: "AI_SIGNAL",
        pnl,
        pnl_percentage: pnlPercentage,
        net_pnl: pnl,
        ai_reasoning: params.reasoning,
      })
      .eq("id", params.tradeId);
    if (updateError) throw updateError;
    return true;
  } catch (err) {
    console.error("[neuralBridge/mt5] falha ao fechar posição:", err instanceof Error ? err.message : err);
    return false;
  }
}
