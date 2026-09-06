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

    // 🔴 2026-08-31 (decisão definitiva do Cleber): motor mecânico (ai-runner)
    // DESATIVADO em produção (cron.job id=5 desativado via
    // cron.alter_job(active:=false)) -- LLM Brain agora é o único motor.
    // status='RUNNING' aqui É intencional a partir de agora: é o que faz
    // `getActiveSession()` (usado por todo o Dashboard/AI Trader/Gráfico via
    // useApexLogic.ts) enxergar esta sessão como "a sessão ativa do
    // usuário" e passar a exibir posição/patrimônio/histórico REAIS do LLM
    // Brain nos mesmos painéis que antes mostravam o motor mecânico -- sem
    // duplicar UI. Antes disto ser decidido (histórico: ver comentário
    // equivalente em getOrCreateSession, ainda status='PAUSED' lá por ser
    // outro trilho/estratégia, não migrado nesta mudança), rodar os dois
    // motores como RUNNING ao mesmo tempo teria sido perigoso -- não é mais
    // o caso porque o motor mecânico está desligado.
    // 🔴 2026-08-31 (achado ao vivo, mesma mudança): esta busca NÃO filtrava
    // por status -- reaproveitava a sessão mais recente mesmo se já
    // COMPLETED/encerrada (ex: pelo botão "Reinicialização Total"),
    // ressuscitando uma sessão zerada em vez de criar uma nova de verdade.
    // Confirmado ao vivo: sessão b38d5862 (COMPLETED) sendo reaproveitada
    // pelo fallback bootstrap de resolveMt5Sessions() logo depois de um
    // reset. Só reaproveita se ainda estiver RUNNING de verdade.
    // 🔴 2026-08-31 (mesmo achado do fix em listEligibleMt5Sessions): inclui
    // STOPPED aqui também -- sem isso, um cold-start do processo bem depois
    // de "Desligar IA" (sessão STOPPED, não RUNNING) não encontrava nada e
    // criava uma sessão nova do zero, mesmo achado de orfanização.
    const { data: existing, error: findError } = await sb
      .from("ai_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("strategy_name", MT5_STRATEGY_NAME)
      .in("status", ["RUNNING", "STOPPED"])
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
        // 🔴 2026-08-31 (decisão definitiva do Cleber): $50 era só o valor
        // usado durante o período de teste/isolamento do LLM Brain. Agora
        // que ele é o motor único e principal da plataforma, toda sessão
        // nova (inclusive a criada por este bootstrap) nasce no mesmo valor
        // aceito pela plataforma pro "Reinicialização Total" -- $100 (ver
        // AITradingPersistenceService.ts `resetLlmActiveBrainSession`).
        initial_balance: 100,
        initial_equity: 100,
        status: "RUNNING",
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

/**
 * 🔴 2026-08-31 (pedido do Cleber): reconecta ao LLM Brain só os campos do
 * Setup do AI Trader que têm equivalente real neste motor (o resto foi
 * removido da UX -- eram do motor mecânico antigo, sem equivalente num
 * agente que raciocina livremente por ciclo). Lê direto de `ai_user_config`
 * (mesma tabela que o Setup grava via `saveUserAIConfig`), cache de 60s por
 * usuário pra não bater no Supabase todo ciclo.
 *
 * `activeAssets` do Setup usa o catálogo unificado do app (ex: "BTCBNB"),
 * que difere do símbolo literal da Infinox pra 3 ativos desta cesta (ver
 * LLM_SYMBOL_TO_UNIFIED em LlmActiveBrainPanel.tsx) -- INVERSE_ALIAS
 * traduz de volta pro nome que este motor usa.
 */
export type TradingCadence = "CONSERVADORA" | "NORMAL" | "AGRESSIVA";
export type MarketFlow = "TREND" | "COUNTER";
export type TargetPoints = "POUCOS" | "MÉDIO" | "MUITOS";

// 🔴 2026-08-31 (pedido do Cleber, "tudo tem que funcionar igual a essa
// tela"): map id->nome dos 5 presets de PRESET_STRATEGIES
// (src/app/data/presetStrategies.ts) -- este processo Node/tsx não importa
// a árvore client-side (mesmo motivo do LOT_SIZE/ATR duplicados aqui), por
// isso o nome vem hardcoded. Só usado como DIRETIVA DE ESTILO no prompt do
// LLM (agent.ts), nunca como regra mecânica -- o motor de blocos
// (evaluateStrategyAt) que dava significado formal a essas estratégias no
// motor mecânico antigo não existe neste agente, que raciocina livre.
// Estratégia customizada (id fora deste mapa, UUID) não tem nome conhecido
// aqui -- cai em "sem diretiva", nunca inventa um nome.
export const STRATEGY_PRESET_NAMES: Record<string, string> = {
  "1": "Rompimento de Canal (Donchian)",
  "2": "Cruzamento de Médias com Filtro de Regime",
  "3": "Reversão à Média (RSI + Bollinger)",
  "4": "Rompimento Confirmado (Volume)",
  "5": "Momentum de Curto Prazo (Scalp)",
};

export interface UserTradingConfig {
  riskPerTradePct: number | null; // ex: 2 = 2% (já em %, não fração)
  allocatedCapitalUsd: number | null;
  dailyLossLimitPct: number | null; // ex: 5 = 5%
  direction: "AUTO" | "LONG" | "SHORT";
  activeAssets: string[] | null; // símbolos literais da Infinox, já traduzidos; null = sem filtro (usa cesta inteira)
  maxSimultaneousAssets: number | null; // teto de simbolos DISTINTOS com posicao aberta ao mesmo tempo; null = sem teto do usuario
  cadence: TradingCadence; // frequencia de avaliacao de entrada -- ver CADENCE_CYCLE_SKIP em index.ts
  timeframe: import("./atr.js").SupportedTimeframe; // timeframe operacional dos indicadores derivados de candle -- default "5m"
  targetPoints: TargetPoints | null; // Alvo de Lucro (Range) -- override do R:R (take-profit/stop), null = default do motor
  marketMode: MarketFlow | null; // Fluxo de Operação (A Favor/Contra) -- null = comportamento atual (guard de volume ja existente)
  strategyLabel: string | null; // nome da estrategia preset selecionada (STRATEGY_PRESET_NAMES), null = nenhuma/personalizada sem nome conhecido
  maxLotsPerTrade: number | null; // Lotes Maximos por Trade -- teto por posicao, null = usa mt5SafetyMaxLots global
  maxOpenPositionsTotal: number | null; // Maximo de Posicoes Abertas -- teto agregado de TODAS as posicoes da sessao, null = sem teto do usuario
}

// 🔴 2026-08-31: ETHUSD (nome unificado do app pra Ethereum, ver
// assetDatabase.ts) -> XETUSD (nome literal do contrato Ethereum na
// Infinox, já validado ao vivo nesta cesta) -- mesmo padrão dos 3 aliases
// anteriores.
const INVERSE_ALIAS: Record<string, string> = { BTCBNB: "BTCXBN", DOGEUSD: "DOGUSD", LINKUSD: "LNKUSD", ETHUSD: "XETUSD" };
const SUPPORTED_TIMEFRAMES_SET = new Set(["1m", "5m", "15m", "1H", "4H"]);

const userConfigCache = new Map<string, { value: UserTradingConfig; fetchedAt: number }>();
const USER_CONFIG_CACHE_MS = 60_000;

export async function getUserTradingConfig(userId: string, fullBasket: string[]): Promise<UserTradingConfig> {
  const cached = userConfigCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < USER_CONFIG_CACHE_MS) return cached.value;

  const fallback: UserTradingConfig = {
    riskPerTradePct: null,
    allocatedCapitalUsd: null,
    dailyLossLimitPct: null,
    direction: "AUTO",
    activeAssets: null,
    maxSimultaneousAssets: null,
    cadence: "NORMAL",
    timeframe: "5m",
    targetPoints: null,
    marketMode: null,
    strategyLabel: null,
    maxLotsPerTrade: null,
    maxOpenPositionsTotal: null,
  };
  try {
    const sb = getClient();
    const { data, error } = await sb
      .from("ai_user_config")
      .select("config")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const raw = (data?.config ?? {}) as Record<string, unknown>;

    const rawAssets = Array.isArray(raw.activeAssets) ? (raw.activeAssets as string[]) : null;
    const translatedAssets = rawAssets?.map((s) => INVERSE_ALIAS[s] ?? s) ?? null;
    const intersected = translatedAssets ? translatedAssets.filter((s) => fullBasket.includes(s)) : null;
    // 🔴 2026-09-06 (achado real: Cleber configurou 16 criptos no Setup, só 3
    // apareciam na cesta efetiva -- MT5_ASSET_BASKET tinha ficado desatualizado,
    // dropando o resto em silêncio, sem log, sem erro visível). Log explícito
    // sempre que o Setup pede mais ativos do que este motor reconhece --
    // visibilidade automática em vez de o usuário ter que notar "poucas
    // entradas" e alguém investigar do zero cada vez que a lista crescer.
    if (translatedAssets && intersected && intersected.length < translatedAssets.length) {
      const dropped = translatedAssets.filter((s) => !fullBasket.includes(s));
      console.warn(
        `[neuralBridge] ⚠️ Setup configurou ${translatedAssets.length} ativo(s), mas ${dropped.length} não existe(m) em MT5_ASSET_BASKET (assetBasket.ts) e foi(ram) ignorado(s) silenciosamente: ${dropped.join(", ")}. Cesta efetiva ficou menor do que o usuário pediu -- adicionar ao array se forem símbolos reais.`
      );
    }

    const value: UserTradingConfig = {
      riskPerTradePct: typeof raw.riskPerTrade === "number" && raw.riskPerTrade > 0 ? raw.riskPerTrade : null,
      allocatedCapitalUsd: typeof raw.allocatedCapital === "number" && raw.allocatedCapital > 0 ? raw.allocatedCapital : null,
      dailyLossLimitPct: typeof raw.dailyLossLimit === "number" && raw.dailyLossLimit > 0 ? raw.dailyLossLimit : null,
      direction: raw.direction === "LONG" || raw.direction === "SHORT" ? raw.direction : "AUTO",
      // cesta do usuario intersectada com a cesta real vazia (nenhum ativo em comum) =
      // sem filtro util, cai pra cesta inteira em vez de travar o motor sem nenhum ativo pra operar.
      activeAssets: intersected && intersected.length > 0 ? intersected : null,
      maxSimultaneousAssets: typeof raw.maxAssets === "number" && raw.maxAssets > 0 ? Math.floor(raw.maxAssets) : null,
      cadence: raw.cadence === "CONSERVADORA" || raw.cadence === "AGRESSIVA" ? raw.cadence : "NORMAL",
      timeframe: typeof raw.timeframe === "string" && SUPPORTED_TIMEFRAMES_SET.has(raw.timeframe)
        ? (raw.timeframe as import("./atr.js").SupportedTimeframe)
        : "5m",
      targetPoints: raw.targetPoints === "POUCOS" || raw.targetPoints === "MÉDIO" || raw.targetPoints === "MUITOS" ? raw.targetPoints : null,
      marketMode: raw.marketMode === "TREND" || raw.marketMode === "COUNTER" ? raw.marketMode : null,
      strategyLabel: typeof raw.activeStrategyId === "string" ? STRATEGY_PRESET_NAMES[raw.activeStrategyId] ?? null : null,
      maxLotsPerTrade: typeof raw.maxContracts === "number" && raw.maxContracts > 0 ? raw.maxContracts : null,
      maxOpenPositionsTotal: typeof raw.maxPositions === "number" && raw.maxPositions > 0 ? Math.floor(raw.maxPositions) : null,
    };
    userConfigCache.set(userId, { value, fetchedAt: Date.now() });
    return value;
  } catch (err) {
    console.warn("[neuralBridge] falha ao buscar ai_user_config, seguindo com defaults do motor:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

export interface EligibleMt5Session {
  id: string;
  userId: string;
  symbols: string[];
  status: "RUNNING" | "STOPPED";
}

/**
 * Lista as sessões do trilho MT5 elegíveis pro loop principal processar
 * neste ciclo (Fase 2 multi-tenant, 2026-08-31). Mesmo filtro
 * `strategy_name=LLM_ACTIVE_BRAIN_MT5` usado por `getOrCreateMt5Session`
 * acima.
 *
 * 🔴 2026-08-31 (decisão definitiva do Cleber, motor mecânico desativado):
 * filtro trocado de `status='PAUSED'` pra `status='RUNNING'` -- acompanha a
 * mudança em `getOrCreateMt5Session` acima (ver comentário lá pro porquê).
 * Sessões antigas (08-29 até 08-31) ficaram com `status='PAUSED'` de quando
 * o hack ainda era necessário -- ficam paradas/históricas, não processadas
 * por este loop, o que é o comportamento correto (não devem reviver).
 *
 * 🔴 2026-08-31 (achado ao vivo, mesma sessão): histórico de sessões antigas
 * ficavam acumuladas sem nunca serem apagadas. A query original trazia
 * TODAS -- um bug multi-tenant real onde 6 cérebros independentes
 * processavam o mesmo user_id/conta MT5 no mesmo ciclo, cegos entre si sobre
 * teto de posição/exposição. Agora retorna só a sessão mais recente por
 * `user_id` (a que está realmente ativa naquele tenant).
 */
export async function listEligibleMt5Sessions(): Promise<EligibleMt5Session[]> {
  const sb = getClient();
  // 🔴 2026-08-31 (achado ao vivo, pedido do Cleber): "Desligar IA" muda o
  // status da sessão pra STOPPED (ver stopSession em
  // AITradingPersistenceService.ts) -- inclui aqui de propósito, senão a
  // sessão desaparece deste loop inteira, as posições OPEN dela ficam sem
  // ninguém gerenciando (breakeven/trailing/SL/TP nunca mais rodam) e o
  // próximo ciclo cria uma sessão NOVA do zero, orfanizando tudo que estava
  // aberto (bug real, confirmado: 5 posições BTCUSD ficaram presas assim,
  // saldo "voltou" pra $100 sem nenhuma posição ter sido fechada de
  // verdade). RUNNING+STOPPED sempre elegíveis pro loop de MONITORAMENTO;
  // quem decide se pode abrir posição NOVA é o open_position tool (tools.ts),
  // que recusa quando session.status === 'STOPPED'.
  const { data, error } = await sb
    .from("ai_sessions")
    .select("id, user_id, symbols, status, created_at")
    .eq("strategy_name", MT5_STRATEGY_NAME)
    .in("status", ["RUNNING", "STOPPED"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Mantém só a mais recente por user_id (a sessão "atual" daquele tenant)
  const byUser = new Map<string, (typeof data)[0]>();
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    if (!byUser.has(userId)) {
      byUser.set(userId, row);
    }
  }

  return Array.from(byUser.values()).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    symbols: (row.symbols ?? []) as string[],
    status: row.status as "RUNNING" | "STOPPED",
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
  // 🔴 2026-09-02 (pedido do Cleber, achado real: coluna "Confiança" do log
  // de operações sempre vazia -- ai_confidence só era gravado pelo motor
  // mecânico antigo, aposentado em 2026-08-31. O LLM Brain agora declara a
  // própria confiança (0-100) junto da tool-call de open_position, ver
  // schema em tools.ts. Null quando o modelo não devolveu um número válido.
  confidence?: number | null;
  // 🔴 2026-09-02 (pedido do Cleber): regime de mercado (sessão/volume/
  // volatilidade real) capturado no MOMENTO da decisão -- só pra permitir
  // validar estatisticamente mais tarde se dar esse contexto ao LLM ajudou
  // (ver GENESIS_PROMPT_MT5 princípio 1g). Opcional -- null quando o regime
  // não estava disponível (candle insuficiente), nunca fabricado.
  sessionAtEntry?: string | null;
  volumeLabelAtEntry?: string | null;
  volatilityLabelAtEntry?: string | null;
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
        // 🔴 2026-09-04: distância original do stop, gravada uma única vez --
        // ver comentário completo na migration 20260904_add_original_stop_
        // distance_to_ai_trades.sql. `stop_loss` muda com breakeven/trailing,
        // este campo não.
        original_stop_distance: params.stopLoss != null ? Math.abs(params.entryPrice - params.stopLoss) : null,
        ai_reasoning: params.reasoning,
        ai_confidence: params.confidence ?? null,
        entry_time: new Date().toISOString(),
        status: "OPEN",
        commission: 0,
        is_test_data: true,
        test_data_reason: MT5_TEST_DATA_REASON,
        session_at_entry: params.sessionAtEntry ?? null,
        volume_label_at_entry: params.volumeLabelAtEntry ?? null,
        volatility_label_at_entry: params.volatilityLabelAtEntry ?? null,
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
  pyramid_adds_count: number;
  partial_tp_taken: boolean | null;
  original_stop_distance: number | null;
  session_id: string;
}

/**
 * 🔴 2026-09-02 (pedido do Cleber -- "agente de risco interno", perder pouco
 * e ganhar muito dentro da taxa de acerto atual): amplia uma posição JÁ
 * vencedora (pyramiding), misturando o preço médio real de entrada e
 * puxando o stop pra breakeven-ou-melhor no mesmo movimento -- nunca deixa
 * o add novo reabrir risco sobre o lote original. Todos os gates (lucro
 * real, confluência ainda válida, teto de adds, teto de risco/grupo
 * correlacionado) ficam em tools.ts (increase_position); esta função só
 * executa a escrita já validada. Falha fechada (false) em vez de lançar --
 * mesmo padrão de updateStopLoss logo abaixo.
 */
export async function increaseMt5Position(params: {
  tradeId: string;
  addAmountUsd: number;
  addFillPrice: number;
  newStopLoss: number;
  reasoningAppend: string;
}): Promise<boolean> {
  try {
    const sb = getClient();
    const { data: current, error: readError } = await sb
      .from("ai_trades")
      .select("entry_price, quantity, ai_reasoning, pyramid_adds_count")
      .eq("id", params.tradeId)
      .eq("status", "OPEN")
      .single();
    if (readError || !current) {
      console.error("[neuralBridge/mt5] increaseMt5Position: posicao nao encontrada/OPEN:", readError?.message);
      return false;
    }
    const oldQuantity = Number(current.quantity);
    const oldEntryPrice = Number(current.entry_price);
    const newQuantity = oldQuantity + params.addAmountUsd;
    // Média ponderada pelo NOTIONAL (quantity = exposição em USD, ver
    // convenção documentada em openMt5Position acima) -- não pela contagem
    // de trades, cada add pesa pelo tamanho real que entrou.
    const blendedEntryPrice = (oldEntryPrice * oldQuantity + params.addFillPrice * params.addAmountUsd) / newQuantity;
    const { error: updateError } = await sb
      .from("ai_trades")
      .update({
        quantity: newQuantity,
        entry_price: blendedEntryPrice,
        stop_loss: params.newStopLoss,
        ai_reasoning: `${current.ai_reasoning ?? ""} || PYRAMID_ADD #${(current.pyramid_adds_count ?? 0) + 1}: ${params.reasoningAppend}`,
        pyramid_adds_count: (current.pyramid_adds_count ?? 0) + 1,
      })
      .eq("id", params.tradeId)
      .eq("status", "OPEN");
    if (updateError) throw updateError;
    return true;
  } catch (err) {
    console.error("[neuralBridge/mt5] falha ao ampliar posicao (increase_position):", err instanceof Error ? err.message : err);
    return false;
  }
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
    .select(
      "id, symbol, side, entry_price, quantity, entry_time, stop_loss, take_profit, pyramid_adds_count, partial_tp_taken, original_stop_distance, session_id"
    )
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

/**
 * PnL realizado (soma de net_pnl dos trades FECHADOS) desde 00:00 no fuso
 * de Brasília (America/Sao_Paulo) de hoje -- usado pelo gate de "Limite de
 * Perda Diária" do Setup do AI Trader (tools.ts, open_position). Só
 * considera fechamentos de HOJE, não o total acumulado da sessão inteira
 * (que pode ter dias).
 *
 * 🔴 2026-09-03 (achado real): antes usava 00:00 UTC, que corresponde a
 * 21:00 no fuso de Brasília -- um trade fechado às 21:02 (ainda "ontem"
 * pro usuário) já contava como perda de "hoje" em UTC, esgotando o teto
 * diário 3h antes do fim do dia local e travando o motor pelo dia inteiro
 * seguinte, mesmo com o mercado em alta e nenhuma perda real nesse dia.
 */
export async function getTodayRealizedPnl(sessionId: string): Promise<number> {
  const sb = getClient();
  const nowSp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const todayStartSp = new Date(nowSp.getFullYear(), nowSp.getMonth(), nowSp.getDate());
  const offsetMs = new Date().getTime() - nowSp.getTime();
  const todayStartUtc = new Date(todayStartSp.getTime() + offsetMs);
  const { data: trades, error } = await sb
    .from("ai_trades")
    .select("net_pnl")
    .eq("session_id", sessionId)
    .eq("status", "CLOSED")
    .gte("exit_time", todayStartUtc.toISOString());
  if (error) throw error;
  return (trades ?? []).reduce((sum, t) => sum + (Number(t.net_pnl) || 0), 0);
}

/**
 * 🔴 2026-09-05 (pedido direto do Cleber): quantidade de entradas NOVAS
 * abertas nas últimas 24h corridas (janela deslizante, não "hoje" por
 * fuso) -- usado por `open_position` (tools.ts) pra impor um teto de
 * frequência (`mt5MaxEntriesPer24h`). Achado real que motivou isto: nos
 * dias de pior PnL líquido da sessão do LLM Brain, a frequência de trades
 * era sistematicamente MAIOR (ex: 21 trades em 04/09 vs. 11 em 03/09),
 * sem a assertividade acompanhar -- teto explícito força qualidade sobre
 * quantidade em vez de deixar a cadência (Setup) ser o único freio. Conta
 * por `entry_time`, não `exit_time` (mede RITMO DE ABERTURA, independente
 * de quanto tempo cada trade fica aberto). Propaga erro em vez de engolir
 * (mesmo motivo de getTodayRealizedPnl/getClosedTradesForMemory acima --
 * uma falha transitória virando "0 trades" furaria o teto, não travaria
 * ele).
 */
export async function getEntriesCountLast24h(sessionId: string): Promise<number> {
  const sb = getClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count, error } = await sb
    .from("ai_trades")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .gte("entry_time", since.toISOString());
  if (error) throw error;
  return count ?? 0;
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

export interface PartialTpResult {
  tradeId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  realizedQuantity: number;
  realizedPnl: number;
  favorableMoveR: number;
}

/**
 * 🔴 2026-09-04 (achado real, sessao 02/09 -- ver config.ts mt5PartialTpTriggerR):
 * realiza uma fracao (mt5PartialTpFraction) do lucro flutuante ao atingir o
 * gatilho de R, registrando como um trade CLOSED NOVO (nunca UPDATE
 * silencioso no original -- mesma convencao de mirrorSell acima e da regra
 * "corrigir registro financeiro nunca e um UPDATE silencioso" em CLAUDE.md).
 * Reduz a quantidade do trade OPEN original e marca partial_tp_taken=true
 * (so dispara 1x por posicao -- reforcos de pyramiding, se houver, nao geram
 * nova parcial). Nunca lanca -- falha so registra erro, tenta de novo no
 * proximo ciclo (partial_tp_taken so vira true se a operacao inteira suceder).
 */
async function realizePartialProfit(args: {
  pos: Mt5OpenPosition;
  price: number;
  favorableMoveR: number;
}): Promise<PartialTpResult | null> {
  const { pos, price, favorableMoveR } = args;
  try {
    const sb = getClient();
    const totalQty = Number(pos.quantity);
    const realizedQty = totalQty * config.mt5PartialTpFraction;
    const remainingQty = totalQty - realizedQty;
    const entryPrice = Number(pos.entry_price);
    const pnl = pos.side === "LONG" ? (price - entryPrice) * (realizedQty / entryPrice) : (entryPrice - price) * (realizedQty / entryPrice);
    const pnlPercentage = ((price - entryPrice) / entryPrice) * 100 * (pos.side === "LONG" ? 1 : -1);
    const nowIso = new Date().toISOString();

    const { error: insertError } = await sb.from("ai_trades").insert({
      session_id: pos.session_id,
      user_id: config.neuralUserId,
      symbol: pos.symbol,
      type: pos.side === "LONG" ? "SELL" : "BUY",
      side: pos.side,
      entry_price: entryPrice,
      exit_price: price,
      quantity: realizedQty,
      entry_time: pos.entry_time,
      exit_time: nowIso,
      status: "CLOSED",
      exit_reason: "TP",
      pnl,
      pnl_percentage: pnlPercentage,
      net_pnl: pnl,
      commission: 0,
      ai_reasoning: `Realizacao PARCIAL de lucro (${(favorableMoveR * 100).toFixed(0)}% de 1R alcancado, ${(config.mt5PartialTpFraction * 100).toFixed(0)}% da posicao) -- mecanico, nao depende de decisao do LLM neste ciclo.`,
      is_test_data: true,
      test_data_reason: MT5_TEST_DATA_REASON,
    });
    if (insertError) throw insertError;

    const { error: updateError } = await sb
      .from("ai_trades")
      .update({ quantity: remainingQty, partial_tp_taken: true })
      .eq("id", pos.id)
      .eq("status", "OPEN");
    if (updateError) throw updateError;

    return { tradeId: pos.id, symbol: pos.symbol, side: pos.side, realizedQuantity: realizedQty, realizedPnl: pnl, favorableMoveR };
  } catch (err) {
    console.error("[neuralBridge/mt5] falha ao realizar parcial de lucro:", err instanceof Error ? err.message : err);
    return null;
  }
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
): Promise<{
  closed: StopEnforcementResult[];
  breakevens: BreakevenMoveResult[];
  trails: TrailMoveResult[];
  partials: PartialTpResult[];
}> {
  const positions = await listMt5OpenPositions(sessionId);
  const closed: StopEnforcementResult[] = [];
  const breakevens: BreakevenMoveResult[] = [];
  const trails: TrailMoveResult[] = [];
  const partials: PartialTpResult[] = [];
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

    // 🔴 2026-09-04 (achado real via SQL, sessao 02/09 -- ver comentario
    // completo em config.ts mt5PartialTpTriggerR): a distancia ORIGINAL do
    // stop (gravada uma unica vez na abertura) e a unica referencia estavel
    // de "1R" -- pos.stop_loss muda depois do breakeven/trailing, entao NAO
    // pode ser usada aqui pra medir quantos R o preco ja andou. Sem essa
    // distancia original (posicao antiga, de antes deste fix), pula parcial/
    // trail largo -- mantem so o trailing apertado de sempre.
    const originalStopDistance = pos.original_stop_distance;
    if (
      config.mt5PartialTpEnabled &&
      !pos.partial_tp_taken &&
      originalStopDistance != null &&
      originalStopDistance > 0 &&
      favorableMove >= originalStopDistance * config.mt5PartialTpTriggerR
    ) {
      const partialResult = await realizePartialProfit({ pos, price, favorableMoveR: favorableMove / originalStopDistance });
      if (partialResult) partials.push(partialResult);
    }

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
    // 🔴 2026-09-04: uma vez que o lucro flutuante ja passou de
    // mt5TrailWidenTriggerR (em unidades do stop ORIGINAL, nao do atual --
    // ver originalStopDistance acima), troca pro multiplicador largo. So
    // relevante em trades com original_stop_distance gravado (pos-fix); sem
    // isso, mantem sempre o multiplicador apertado de sempre.
    const favorableMoveR = originalStopDistance != null && originalStopDistance > 0 ? favorableMove / originalStopDistance : null;
    const useWideTrail = favorableMoveR != null && favorableMoveR >= config.mt5TrailWidenTriggerR;
    const trailDistancePct = trailPct * (useWideTrail ? config.mt5TrailAtrMultiplierWide : config.mt5TrailAtrMultiplier);
    const candidateStop = pos.side === "LONG" ? price * (1 - trailDistancePct) : price * (1 + trailDistancePct);
    const isMoreProtective = pos.side === "LONG" ? candidateStop > pos.stop_loss : candidateStop < pos.stop_loss;
    if (!isMoreProtective) continue;

    const ok = await updateStopLoss(pos.id, candidateStop);
    if (ok) {
      trails.push({ tradeId: pos.id, symbol: pos.symbol, side: pos.side, oldStopLoss: pos.stop_loss, newStopLoss: candidateStop });
    }
  }

  return { closed, breakevens, trails, partials };
}

// 🔴 2026-09-06 (pedido do Cleber: "logs do sistema" da tela do AI Trader
// ficava sempre vazio em modo DEMO -- achado ja catalogado desde 2026-08-17
// em useApexLogic.ts, aquele painel so recebia linha de um ciclo que rodava
// NO NAVEGADOR, e o motor unico hoje e este processo Node rodando local/
// servidor). Este e o canal real: cada consulta de cotacao, chamada de
// ferramenta, pensamento (log_thought) e decisao (open/close/increase) que o
// agente de fato faz, gravado ciclo a ciclo -- nunca fabricado, sempre o
// que realmente aconteceu. Fire-and-forget por design (mesma filosofia do
// resto deste arquivo): uma falha aqui e so perda de visibilidade, nunca
// pode derrubar ou atrasar o ciclo de decisao real.
export type BrainActivityType = "cycle_start" | "tool_call" | "thought" | "decision" | "error";

export function logBrainActivity(params: {
  sessionId: string;
  userId: string;
  cycle: number;
  type: BrainActivityType;
  message: string;
  symbol?: string;
  detail?: unknown;
}): void {
  const sb = getClient();
  // Teto defensivo -- alguns resultados de ferramenta (get_mt5_quote) sao
  // JSON grandes; a UI so precisa de um resumo legivel, nao o payload inteiro.
  const MAX_MESSAGE_LEN = 2000;
  const message = params.message.length > MAX_MESSAGE_LEN ? params.message.slice(0, MAX_MESSAGE_LEN) + "…" : params.message;
  sb.from("ai_brain_activity_log")
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      cycle: params.cycle,
      type: params.type,
      symbol: params.symbol ?? null,
      message,
      detail: params.detail ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn("[neuralBridge] falha ao gravar ai_brain_activity_log (nao bloqueia o ciclo):", error.message);
    });
}
