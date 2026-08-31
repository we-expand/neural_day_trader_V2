import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { getAtrPercent } from "./atr.js";

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

// 🔴 2026-08-31 (Fase 2 multi-tenant): era um singleton por-processo
// (`mt5SessionIdPromise`), atrelado a um único `config.neuralUserId` fixo em
// env -- só suportava 1 sessão por vez. Agora `sessionId` é resolvido uma vez
// por usuário (cache por `userId`, evita re-query a cada ciclo) e passado
// EXPLICITAMENTE por todo chamador -- nenhuma função abaixo lê mais um
// singleton global. Isolamento entre sessões passa a ser responsabilidade de
// quem chama (o loop principal em index.ts/agent.ts), não deste módulo.
const mt5SessionIdCacheByUser = new Map<string, Promise<string>>();

export async function getOrCreateMt5Session(userId: string, symbols: string[]): Promise<string> {
  const cached = mt5SessionIdCacheByUser.get(userId);
  if (cached) return cached;
  const promise = (async () => {
    const sb = getClient();

    // Mesma regra do trilho Binance acima: NUNCA status='RUNNING' aqui (ver
    // comentário grande em getOrCreateSession) -- ficaria visível pro
    // getActiveSession() do motor mecânico real no navegador. O motor
    // mecânico (ai-runner) continua ativo em produção (cron confirmado
    // 2026-08-31) -- não mudar este status sem decidir isso explicitamente
    // com o Cleber primeiro (ver item 3 do handoff da Fase 2).
    const { data: existing, error: findError } = await sb
      .from("ai_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("strategy_name", MT5_STRATEGY_NAME)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (existing?.id) return existing.id as string;

    const { data: created, error: createError } = await sb
      .from("ai_sessions")
      .insert({
        user_id: userId,
        strategy_name: MT5_STRATEGY_NAME,
        mode: "DEMO",
        symbols,
        initial_balance: 50,
        initial_equity: 50,
        status: "PAUSED",
        config: {
          source: "llm-active-brain (motor de IA principal, agente full tool-calling, cesta/preco/execucao MT5)",
          llm_provider: config.llmProvider,
          llm_model: config.llmModel,
        },
      })
      .select("id")
      .single();
    if (createError) throw createError;
    return created.id as string;
  })();
  mt5SessionIdCacheByUser.set(userId, promise);
  return promise;
}

export interface EligibleMt5Session {
  id: string;
  userId: string;
  symbols: string[];
}

/**
 * Lista todas as sessões do trilho MT5 elegíveis pro loop principal processar
 * neste ciclo (Fase 2 multi-tenant, 2026-08-31). Mesmo filtro
 * `strategy_name=LLM_ACTIVE_BRAIN_MT5` usado por `getOrCreateMt5Session`
 * acima; `status='PAUSED'` continua sendo o valor real gravado nessas sessões
 * (hack documentado ali pra ficar fora do alcance do motor mecânico antigo,
 * ainda ativo em produção -- não é "sessão pausada" no sentido usual).
 */
export async function listEligibleMt5Sessions(): Promise<EligibleMt5Session[]> {
  const sb = getClient();
  const { data, error } = await sb
    .from("ai_sessions")
    .select("id, user_id, symbols")
    .eq("strategy_name", MT5_STRATEGY_NAME)
    .eq("status", "PAUSED");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    symbols: (row.symbols ?? []) as string[],
  }));
}

export interface OpenMt5PositionParams {
  sessionId: string;
  userId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  amountUsd: number;
  // 🔴 2026-08-29: stop/alvo MECÂNICOS (preço absoluto, não %), calculados em
  // tools.ts na abertura e gravados aqui -- ver enforceMt5StopsAndTargets
  // abaixo, que os lê a cada ciclo e fecha por código, independente do LLM.
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
}

/** Abre uma posição virtual OPEN no trilho MT5. Retorna o id (pra poder fechar depois) ou null se falhar. Nunca lança. */
export async function openMt5Position(params: OpenMt5PositionParams): Promise<string | null> {
  if (!config.neuralBridgeEnabled) return null;
  try {
    const sb = getClient();
    const { data, error } = await sb
      .from("ai_trades")
      .insert({
        session_id: params.sessionId,
        user_id: params.userId,
        symbol: params.symbol,
        type: params.side === "LONG" ? "BUY" : "SELL",
        side: params.side,
        entry_price: params.entryPrice,
        quantity: params.amountUsd,
        stop_loss: params.stopLoss,
        take_profit: params.takeProfit,
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
  stop_loss: number | null;
  take_profit: number | null;
}

/**
 * Lista as posições OPEN do trilho MT5 (pro agente decidir o que fechar, e
 * pro teto de posições por símbolo em `open_position`).
 *
 * 🔴 2026-08-29 (achado de auditoria): esta função ANTES engolia qualquer
 * erro de rede/Supabase e devolvia `[]` -- indistinguível de "sem posição
 * aberta de verdade". Isso furava o teto de MAX_POSITIONS_PER_SYMBOL em
 * `open_position` (tools.ts): uma falha transitória fazia o teto contar
 * "0 abertas" mesmo com várias já abertas, e o agente empilhava mais
 * (confirmado ao vivo: 6 posições SHORT simultâneas em SOLUSD, teto era 3).
 * Mesmo padrão de bug já corrigido no `reconcile()` do motor mecânico em
 * 2026-08-28. Agora propaga o erro -- cada chamador decide como falhar
 * fechado (bloquear a ação) em vez de assumir "sem posição".
 */
export async function listMt5OpenPositions(sessionId: string): Promise<Mt5OpenPosition[]> {
  if (!config.neuralBridgeEnabled) return [];
  const sb = getClient();
  const { data, error } = await sb
    .from("ai_trades")
    .select("id, symbol, side, entry_price, quantity, entry_time, stop_loss, take_profit")
    .eq("session_id", sessionId)
    .eq("status", "OPEN")
    .order("entry_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Mt5OpenPosition[];
}

/**
 * 🔴 2026-08-31 (achado ao vivo, pedido do Cleber -- "quando perde, perde
 * pouco, quando ganha, ganha muito" / "não pode quebrar o caixa do
 * usuário"): saldo REAL da sessão (não constante hardcoded). Antes,
 * `open_position` dimensionava toda posição a partir de um notional FIXO
 * em dólar (mt5TargetNotionalUsd=$1200), sem NUNCA olhar o saldo real da
 * conta -- numa conta de $50 isso é 24x-36x de alavancagem implícita, e um
 * stop de 0,79% sobre $1200 já produziu uma perda real de -$16,05 num
 * único trade (quase 1/3 da conta). Esta função devolve
 * saldo_inicial + soma(net_pnl dos trades FECHADOS desta sessão) -- usado
 * agora por `open_position` (tools.ts) pra dimensionar cada posição como %
 * de risco do saldo REAL, não de um alvo fixo desconectado do caixa.
 * Deliberadamente NÃO inclui PnL flutuante de posições ainda abertas
 * (mais conservador -- não conta lucro não realizado como capital
 * disponível pra arriscar de novo).
 */
export async function getMt5AccountBalance(sessionId: string): Promise<number> {
  const sb = getClient();
  const [{ data: session, error: sessionError }, { data: trades, error: tradesError }] = await Promise.all([
    sb.from("ai_sessions").select("initial_balance").eq("id", sessionId).single(),
    sb.from("ai_trades").select("net_pnl").eq("session_id", sessionId).eq("status", "CLOSED"),
  ]);
  if (sessionError) throw sessionError;
  if (tradesError) throw tradesError;
  const initialBalance = Number(session?.initial_balance ?? 50);
  const realizedPnl = (trades ?? []).reduce((sum, t) => sum + (Number(t.net_pnl) || 0), 0);
  return initialBalance + realizedPnl;
}

export interface Mt5RecentClosedTrade {
  side: "LONG" | "SHORT";
  exit_time: string;
  exit_reason: string | null;
  net_pnl: number | null;
  pnl: number | null;
}

/**
 * Últimos `limit` trades FECHADOS de um símbolo (mais recente primeiro) --
 * usado pelo circuito de perda consecutiva em `open_position` (tools.ts,
 * 2026-08-29). Propaga erro de rede/Supabase em vez de engolir e devolver
 * `[]` -- mesmo motivo do fix em `listMt5OpenPositions` acima (uma falha
 * transitória virando "sem histórico" furaria o circuito de proteção, não só
 * o teto de posições).
 *
 * 🔴 2026-08-30 (achado real, sessão de monitoramento): o circuito só olhava
 * `exit_reason === "SL"` -- perda real fechada manualmente pelo LLM
 * (`AI_SIGNAL`) não contava pra streak. Aconteceu ao vivo: SOLUSD SHORT
 * perdeu 2x seguidas por decisão manual da própria IA (~-$6 e ~-$3, ambos
 * `AI_SIGNAL`), o cooldown nunca disparou porque nenhum dos dois foi `SL`, e
 * a 3ª reentrada no MESMO símbolo+lado bateu stop de verdade por -$7,12 --
 * maior perda da sessão até aqui. Passa `net_pnl`/`pnl` agora pra o circuito
 * (tools.ts) poder contar QUALQUER fechamento negativo como perda pra fins
 * de streak, não só stop mecânico.
 */
export async function getRecentClosedTrades(sessionId: string, symbol: string, limit = 5): Promise<Mt5RecentClosedTrade[]> {
  if (!config.neuralBridgeEnabled) return [];
  const sb = getClient();
  const { data, error } = await sb
    .from("ai_trades")
    .select("side, exit_time, exit_reason, net_pnl, pnl")
    .eq("session_id", sessionId)
    .eq("symbol", symbol)
    .eq("status", "CLOSED")
    .order("exit_time", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Mt5RecentClosedTrade[];
}

export interface Mt5ClosedTradeForMemory {
  symbol: string;
  side: "LONG" | "SHORT";
  pnl: number | null;
  pnl_percentage: number | null;
  exit_reason: string | null;
  exit_time: string;
  ai_reasoning: string | null;
}

/**
 * Últimos `limit` trades FECHADOS de TODA a sessão (qualquer símbolo), mais
 * recente primeiro -- fonte de dado pra `tradeMemory.ts` (2026-08-30,
 * handoff "Parte B" em CLAUDE.md). Dedicada em vez de expor o client cru
 * (recomendação do Agente 1): mantém a superfície de `neuralBridge.ts` como
 * único ponto de acesso ao Supabase. Propaga erro em vez de engolir --
 * mesmo motivo das outras funções deste arquivo: memória vazia por falha
 * transitória de rede é pior que abortar e o chamador decidir (aqui,
 * `tradeMemory.ts` decide cair pra "sem memória" via try/catch, não aqui).
 */
export async function getClosedTradesForMemory(sessionId: string, limit = 30): Promise<Mt5ClosedTradeForMemory[]> {
  if (!config.neuralBridgeEnabled) return [];
  const sb = getClient();
  const { data, error } = await sb
    .from("ai_trades")
    .select("symbol, side, pnl, pnl_percentage, exit_reason, exit_time, ai_reasoning")
    .eq("session_id", sessionId)
    .eq("status", "CLOSED")
    .order("exit_time", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Mt5ClosedTradeForMemory[];
}

/** Fecha uma posição OPEN do trilho MT5 pelo id, calculando PnL com a MESMA fórmula do motor mecânico. Nunca lança. */
export async function closeMt5Position(params: {
  tradeId: string;
  exitPrice: number;
  reasoning: string;
  exitReason?: "AI_SIGNAL" | "SL" | "TP";
}): Promise<boolean> {
  if (!config.neuralBridgeEnabled) return false;
  try {
    const sb = getClient();
    const { data: trade, error: fetchError } = await sb
      .from("ai_trades")
      .select("entry_price, side, quantity, ai_reasoning")
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
    // 🔴 2026-08-30 (achado do Agente 1, handoff em CLAUDE.md/SESSAO_2026-08-29
    // _CANDLE_REAL_E_PRICE_ACTION.md "Parte B"): o UPDATE abaixo sobrescrevia
    // ai_reasoning com só o motivo da SAIDA, apagando pra sempre o motivo da
    // ENTRADA -- a memoria de trades (tradeMemory.ts) depende de ler os dois.
    // .split idempotente: reprocessar o mesmo trade nao acumula "|| SAIDA:"
    // em cadeia.
    const entryReasoning = String(trade.ai_reasoning ?? "").split(" || SAIDA: ")[0];
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
        exit_reason: params.exitReason ?? "AI_SIGNAL",
        pnl,
        pnl_percentage: pnlPercentage,
        net_pnl: pnl,
        ai_reasoning: `${entryReasoning} || SAIDA: ${params.reasoning}`,
      })
      .eq("id", params.tradeId);
    if (updateError) throw updateError;
    return true;
  } catch (err) {
    console.error("[neuralBridge/mt5] falha ao fechar posição:", err instanceof Error ? err.message : err);
    return false;
  }
}

export interface StopEnforcementResult {
  tradeId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  reason: "SL" | "TP";
  entryPrice: number;
  exitPrice: number;
}

export interface BreakevenMoveResult {
  tradeId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  oldStopLoss: number;
}

export interface TrailMoveResult {
  tradeId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  oldStopLoss: number;
  newStopLoss: number;
}

/**
 * Atualiza o stop_loss de uma posição OPEN pra um novo preço (breakeven ou
 * trailing). Nunca lança -- falha silenciosa (o próximo ciclo tenta de novo)
 * é preferível a derrubar o enforcement inteiro por causa de 1 posição.
 */
async function updateStopLoss(tradeId: string, newStopLoss: number): Promise<boolean> {
  try {
    const sb = getClient();
    const { error } = await sb.from("ai_trades").update({ stop_loss: newStopLoss }).eq("id", tradeId).eq("status", "OPEN");
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[neuralBridge/mt5] falha ao atualizar stop_loss:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Trava MECÂNICA de stop/alvo -- roda a cada ciclo, ANTES do LLM decidir
 * qualquer coisa, independente do que o modelo escolher fazer naquele ciclo.
 *
 * Por que existe (2026-08-29, achado da auditoria pós-noite): a versão
 * anterior só tinha o stop/alvo como TEXTO no prompt (GENESIS_PROMPT_MT5) --
 * o LLM precisava lembrar de checar e decidir fechar a cada ciclo. Isso
 * falhou de forma confirmada: uma posição BTCUSD correu até -3.5%/-$5,96
 * antes do agente fechar (alvo declarado era -0.5%), e outra até -3.5%/
 * -$3,50 -- as duas juntas já cobrem quase todo o prejuízo líquido da noite
 * (-$8,40). Ver SESSAO_2026-08-29_AUDITORIA_LLM_BRAIN_E_MONITORAMENTO_NOTURNO.md.
 *
 * Agora o preço de stop/alvo é decidido e GRAVADO no trade na abertura
 * (tools.ts open_position), e esta função fecha sozinha por código assim
 * que o preço real (MESMO getQuote que o agente usa, nunca simulado) bate
 * o nível -- o LLM só fica sabendo depois, não precisa (nem consegue)
 * evitar ou atrasar o fechamento.
 */
export async function enforceMt5StopsAndTargets(
  sessionId: string,
  getQuote: (symbol: string) => Promise<{ price: number; bid: number; ask: number } | null>
): Promise<{ closed: StopEnforcementResult[]; breakevens: BreakevenMoveResult[]; trails: TrailMoveResult[] }> {
  const positions = await listMt5OpenPositions(sessionId);
  const closed: StopEnforcementResult[] = [];
  const breakevens: BreakevenMoveResult[] = [];
  const trails: TrailMoveResult[] = [];
  const quoteCache = new Map<string, { price: number; bid: number; ask: number } | null>();

  for (const pos of positions) {
    if (pos.stop_loss == null) continue; // posicao antiga, de antes deste fix -- sem trava

    if (!quoteCache.has(pos.symbol)) {
      quoteCache.set(pos.symbol, await getQuote(pos.symbol));
    }
    const quote = quoteCache.get(pos.symbol);
    if (!quote) continue; // sem preco real agora -- nao decide no escuro, tenta de novo no proximo ciclo

    // 🔴 2026-08-29 (pedido do Cleber, "as entradas nao estao contemplando o
    // spread" / "so comeca a computar lucro depois de pagar o spread"): o
    // preco que FECHARIA a posicao agora nao e o mid/last tick -- e o lado
    // oposto do book. Fechar um LONG e VENDER (recebe o bid); fechar um
    // SHORT e COMPRAR de volta (paga o ask). Usar isso pra TODA checagem de
    // stop/alvo/breakeven/trailing abaixo faz o spread aparecer sozinho no
    // PnL flutuante -- uma posicao recem-aberta ja mostra -spread ate o
    // preco andar o suficiente pra cobrir esse custo, igual corretora real.
    const price = pos.side === "LONG" ? quote.bid : quote.ask;
    // 🔴 2026-08-29 (mudança de filosofia, pedido do Cleber): take_profit
    // VOLTA a ser gatilho de saída mecânico. O motivo de ter sido desligado
    // antes (capava todo vencedor em 2R, anulando o trailing numa tendência
    // maior) não se aplica mais -- o alvo agora é CURTO por design
    // (mt5TakeProfitAtrMultiplier ~1.5x ATR, ainda mais curto em dia de baixo
    // volume, ver tools.ts open_position) e a estratégia deixou de ser
    // "deixar o vencedor correr indefinidamente" e passou a ser "giro": entra,
    // captura um alvo pequeno, recicla o capital pra próxima entrada, em vez
    // de prender capital numa posição só esperando uma tendência longa que um
    // dia de pouco volume não tem fôlego pra sustentar. Breakeven/trailing
    // (abaixo) continuam ativos -- protegem o caso de o preço não chegar no
    // alvo mas correr um pouco a favor antes de reverter.
    //
    // 🔴 2026-08-29 (achado GRAVE, mesma sessão): "SL"/"TP" abaixo -- NÃO
    // "STOP_LOSS"/"TAKE_PROFIT" como estava. `ai_trades_exit_reason_check`
    // (constraint real do banco) só aceita 'TP'|'SL'|'MANUAL'|'TIMEOUT'|
    // 'AI_SIGNAL' (mesma convenção do motor mecânico, ver
    // AITradingPersistenceService.ts). Com o valor errado, TODO update de
    // fechamento mecânico vinha FALHANDO silenciosamente desde que este
    // enforcement foi criado -- confirmado direto no banco: das 206 posições
    // fechadas no dia, 100% tinham exit_reason='AI_SIGNAL' (fechamento
    // manual do LLM), ZERO tinham o texto de fechamento mecânico. O stop-loss
    // "mecânico" nunca protegeu NADA o dia inteiro -- toda posição que
    // fechou, fechou porque o LLM decidiu fechar sozinho, não porque o preço
    // bateu um nível. Isso também quebrava silenciosamente o circuito de
    // perda consecutiva (tools.ts checa exit_reason==='SL', nunca disparava).
    let reason: "SL" | "TP" | null = null;
    if (pos.side === "LONG") {
      if (price <= pos.stop_loss) reason = "SL";
      else if (pos.take_profit != null && price >= pos.take_profit) reason = "TP";
    } else {
      if (price >= pos.stop_loss) reason = "SL";
      else if (pos.take_profit != null && price <= pos.take_profit) reason = "TP";
    }
    if (reason) {
      const ok = await closeMt5Position({
        tradeId: pos.id,
        exitPrice: price,
        exitReason: reason,
        reasoning:
          `Fechamento MECANICO automatico (${reason === "SL" ? "stop-loss" : "alvo (take-profit) curto"} atingido: ` +
          `nivel ${reason === "SL" ? pos.stop_loss : pos.take_profit}, preco real ${price}) -- ` +
          `nao depende de decisao do LLM neste ciclo.`,
      });
      if (ok) {
        closed.push({ tradeId: pos.id, symbol: pos.symbol, side: pos.side, reason, entryPrice: pos.entry_price, exitPrice: price });
      }
      continue; // posicao ja fechada -- nao faz sentido checar breakeven dela
    }

    if (pos.stop_loss == null) continue; // sem stop original gravado -- nada pra mover/trilhar
    const favorableMove = pos.side === "LONG" ? price - pos.entry_price : pos.entry_price - price;
    if (favorableMove <= 0) continue; // so mexe no stop quando a operacao esta correndo A FAVOR

    // 🔴 2026-08-29 (pedido do Cleber): breakeven MECANICO -- assim que o
    // preco andar a favor mt5BreakevenTriggerR vezes a distancia original do
    // stop, trava o pior caso em ~$0 movendo o stop pro preco de entrada.
    // So anda pra frente: nunca reaplica se o stop ja esta em (ou alem de)
    // breakeven -- a partir dali quem assume e o trailing continuo abaixo.
    const alreadyAtBreakeven = pos.side === "LONG" ? pos.stop_loss >= pos.entry_price : pos.stop_loss <= pos.entry_price;
    if (!alreadyAtBreakeven) {
      const stopDistance = Math.abs(pos.entry_price - pos.stop_loss);
      if (favorableMove >= stopDistance * config.mt5BreakevenTriggerR) {
        const ok = await updateStopLoss(pos.id, pos.entry_price);
        if (ok) {
          breakevens.push({ tradeId: pos.id, symbol: pos.symbol, side: pos.side, entryPrice: pos.entry_price, oldStopLoss: pos.stop_loss });
        }
      }
      continue; // so trilha (abaixo) a partir do ciclo em que ja estiver em breakeven -- evita usar stop_loss desatualizado no mesmo passo
    }

    // 🔴 2026-08-29 (pedido do Cleber): trailing CONTÍNUO -- uma vez em
    // breakeven, o stop continua subindo (LONG) / descendo (SHORT) atrás do
    // preço, sempre a uma distância ATR recalculada a cada ciclo (mesmo
    // espírito do stop de abertura em tools.ts). Só protege mais lucro, nunca
    // afrouxa -- só move se o novo nível for MAIS protetor que o atual.
    const trailPct = await getAtrPercent(pos.symbol);
    if (trailPct == null) continue; // sem ATR real agora -- mantem o stop onde esta, tenta de novo no proximo ciclo
    // 🔴 2026-08-30: multiplicador dedicado (mt5TrailAtrMultiplier), mais
    // apertado que o do stop de abertura (mt5StopAtrMultiplier) -- ver
    // comentario em config.ts. Usar o mesmo multiplicador do stop inicial
    // aqui criava uma faixa morta onde o preco corria a favor sem o stop
    // acompanhar nada.
    const trailDistancePct = trailPct * config.mt5TrailAtrMultiplier;
    const candidateStop = pos.side === "LONG" ? price * (1 - trailDistancePct) : price * (1 + trailDistancePct);
    const isMoreProtective = pos.side === "LONG" ? candidateStop > pos.stop_loss : candidateStop < pos.stop_loss;
    if (!isMoreProtective) continue;

    const ok = await updateStopLoss(pos.id, candidateStop);
    if (ok) {
      trails.push({ tradeId: pos.id, symbol: pos.symbol, side: pos.side, oldStopLoss: pos.stop_loss, newStopLoss: candidateStop });
    }
  }

  return { closed, breakevens, trails };
}
