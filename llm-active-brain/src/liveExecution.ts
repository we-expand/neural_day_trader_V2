import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Execução REAL de ordens na Infinox via MetaAPI, chamando a MESMA Edge
 * Function `/broker/execute` que o frontend já usa (supabase/functions/
 * server/index.ts) -- reaproveita o gate de risco fail-closed e o ledger de
 * auditoria (`broker_order_executions`) que já existem lá, em vez de
 * duplicar essa lógica aqui.
 *
 * 2026-09-08 (pedido explícito do Cleber): a decisão DEMO vs LIVE é
 * DINÂMICA, por usuário, olhando o banco a cada ciclo -- nunca uma flag de
 * `.env` presa que exige restart. "Conectar" na tela (grava uma linha em
 * `broker_credentials`) já é o que liga a execução real pro próximo ciclo;
 * "desconectar" (remove a linha) já volta pra DEMO no ciclo seguinte, sem
 * perder sessão nem trades (nunca apagados, só deixam de receber ordem
 * real nova). `MT5_LIVE_EXECUTION_ENABLED` continua existindo como
 * interruptor mestre de segurança (kill-switch do deployment inteiro) --
 * precisa estar true E o usuário ter broker conectado pra operar de
 * verdade.
 *
 * O `llm-active-brain` roda como processo Node headless, sem sessão de
 * navegador. `/broker/execute` exige um JWT real de usuário
 * (`getAuthenticatedUserId`, `supabase/functions/server/index.ts`). Em vez
 * de duplicar a chave de criptografia do token MetaAPI
 * (`BROKER_CREDENTIALS_ENCRYPTION_KEY`) aqui -- o que dobraria a superfície
 * de risco desse segredo --, este módulo gera uma sessão real de usuário
 * via `admin.generateLink` + `verifyOtp` (MESMO padrão já usado em
 * `supabase/functions/webauthn/index.ts` pro login biométrico) e chama a
 * Edge Function por HTTP normal, como o navegador faria.
 *
 * FAIL-CLOSED SEMPRE: qualquer erro/timeout nesta chamada (rede, MetaAPI
 * fora do ar, JWT expirado) aborta a ação e NUNCA assume sucesso silencioso
 * -- ver `tripLiveCircuitBreaker`. Nenhuma ordem é reenviada automaticamente
 * em caso de falha (evita duplicar ordem real numa rede instável já
 * documentada travando -- ver CLAUDE.md, item de 2026-09-08 sobre a conta
 * MetaAPI dedicada).
 */

const BROKER_EXECUTE_TIMEOUT_MS = 15_000;

// Circuit breaker: uma vez disparado, fica assim até o processo ser
// reiniciado manualmente -- de propósito (ver plano aprovado). $22 de
// capital não sobrevive a uma sequência automática de erros sem alguém
// olhar antes de religar. Global (não por usuário) -- um erro de rede/API
// afeta a conta MetaAPI inteira, não só um usuário.
let circuitBreakerTripped = false;
let circuitBreakerReason: string | null = null;

export function isLiveCircuitBreakerTripped(): boolean {
  return circuitBreakerTripped;
}

export function getLiveCircuitBreakerReason(): string | null {
  return circuitBreakerReason;
}

export function tripLiveCircuitBreaker(reason: string): void {
  if (circuitBreakerTripped) return;
  circuitBreakerTripped = true;
  circuitBreakerReason = reason;
  console.error(
    `[liveExecution] 🔴 CIRCUIT BREAKER ACIONADO -- execucao real DESLIGADA (todos os usuarios) ate restart manual. Motivo: ${reason}`
  );
}

let serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseServiceRoleKey) {
    throw new Error("NEURAL_SUPABASE_URL/NEURAL_SUPABASE_SERVICE_ROLE_KEY ausentes -- necessarios pra execucao real.");
  }
  serviceClient = createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);
  return serviceClient;
}

const BROKER_CONNECTED_CACHE_TTL_MS = 10_000;
const brokerConnectedCache = new Map<string, { connected: boolean; fetchedAtMs: number }>();

/**
 * true quando este usuário tem uma linha REAL em `broker_credentials`
 * (conectou pela UI) -- é isso, não uma flag de código, que decide se ele
 * opera DEMO ou LIVE. Cache curto (10s) só pra não bater no banco em toda
 * chamada de ferramenta do mesmo ciclo.
 */
export async function isUserBrokerConnected(userId: string): Promise<boolean> {
  const cached = brokerConnectedCache.get(userId);
  if (cached && Date.now() - cached.fetchedAtMs < BROKER_CONNECTED_CACHE_TTL_MS) return cached.connected;
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("broker_credentials")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    const connected = !error && !!data;
    brokerConnectedCache.set(userId, { connected, fetchedAtMs: Date.now() });
    return connected;
  } catch {
    // Falha ao consultar -- fail-closed (trata como NAO conectado, nunca
    // opera real por engano numa falha transitoria de leitura).
    return false;
  }
}

/** Execução real está ligada de fato PRA ESTE USUARIO: kill-switch mestre + breaker + broker conectado no banco. */
export async function isLiveExecutionActive(userId: string): Promise<boolean> {
  if (!config.mt5LiveExecutionEnabled || circuitBreakerTripped) return false;
  return isUserBrokerConnected(userId);
}

const jwtCacheByUser = new Map<string, { token: string; obtainedAtMs: number }>();
const JWT_TTL_MS = 50 * 60 * 1000; // magic link vira sessão de ~1h; renova aos 50min por margem.

async function getLiveUserJwt(userId: string): Promise<string> {
  const cached = jwtCacheByUser.get(userId);
  if (cached && Date.now() - cached.obtainedAtMs < JWT_TTL_MS) return cached.token;

  if (!config.neuralSupabaseAnonKey) {
    throw new Error("NEURAL_SUPABASE_ANON_KEY ausente -- necessaria pra trocar o magic link por sessao.");
  }
  const svc = getServiceClient();

  const { data: userData, error: userError } = await svc.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    throw new Error(`Falha ao obter email do usuario ${userId}: ${userError?.message ?? "email ausente"}`);
  }

  const { data: linkData, error: linkError } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(`Falha ao gerar link de sessao: ${linkError?.message ?? "hashed_token ausente"}`);
  }

  // Troca o token_hash por uma sessao real -- precisa do client com a ANON
  // key (mesmo fluxo que o browser faria via supabase.auth.verifyOtp),
  // nunca a service role pra essa etapa.
  const anon = createClient(config.neuralSupabaseUrl, config.neuralSupabaseAnonKey);
  const { data: sessionData, error: verifyError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session?.access_token) {
    throw new Error(`Falha ao trocar magic link por sessao: ${verifyError?.message ?? "access_token ausente"}`);
  }

  const token = sessionData.session.access_token;
  jwtCacheByUser.set(userId, { token, obtainedAtMs: Date.now() });
  return token;
}

interface BrokerExecuteResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

async function callBrokerExecute(userId: string, body: Record<string, unknown>): Promise<BrokerExecuteResult> {
  try {
    const jwt = await getLiveUserJwt(userId);
    const res = await fetch(`${config.neuralSupabaseUrl}/functions/v1/server/broker/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BROKER_EXECUTE_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.success === false) {
      const reason = String(json.error ?? `HTTP ${res.status}`);
      // Se o proprio token expirou no meio do caminho, forca gerar um novo
      // na proxima tentativa -- nao insiste com o mesmo JWT ruim.
      if (res.status === 401) jwtCacheByUser.delete(userId);
      return { success: false, error: reason };
    }
    return { success: true, ...json };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    tripLiveCircuitBreaker(`Erro/timeout chamando /broker/execute: ${reason}`);
    return { success: false, error: reason };
  }
}

export interface LiveOrderResult {
  success: boolean;
  error?: string;
  fillPrice?: number;
  brokerPositionId?: string;
}

/** Envia ordem de mercado REAL pro usuario dono da sessao. FAIL-CLOSED: qualquer falha devolve success:false, nunca assume execução. */
export async function executeLiveMarketOrder(
  userId: string,
  params: { side: "LONG" | "SHORT"; symbol: string; volume: number; stopLoss: number; takeProfit: number; comment: string }
): Promise<LiveOrderResult> {
  if (!(await isLiveExecutionActive(userId))) return { success: false, error: "Execucao real desligada (kill-switch, circuit breaker ou broker nao conectado)." };

  const result = await callBrokerExecute(userId, {
    action: params.side === "LONG" ? "createMarketBuyOrder" : "createMarketSellOrder",
    symbol: params.symbol,
    volume: params.volume,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    comment: params.comment,
  });
  if (!result.success) return { success: false, error: result.error };

  const brokerPositionId = String(result.positionId ?? "");
  if (!brokerPositionId) {
    tripLiveCircuitBreaker("Ordem real aceita pela corretora mas sem positionId na resposta -- estado real desconhecido.");
    return { success: false, error: "Ordem enviada mas resposta sem positionId -- circuit breaker acionado por seguranca." };
  }

  // Preco de preenchimento real: /broker/execute nao devolve o preco de
  // execucao no corpo (a MetaAPI confirma via trade result, nem sempre com
  // openPrice pronto na resposta síncrona) -- busca a posicao recem-aberta
  // pra pegar o preco real que a corretora de fato preencheu.
  const positions = await getLivePositions(userId);
  const opened = positions.find((p) => String(p.id) === brokerPositionId);
  if (!opened || !Number.isFinite(opened.openPrice)) {
    tripLiveCircuitBreaker(
      `Ordem real ${brokerPositionId} aceita mas nao encontrada/sem preco em getPositions logo em seguida -- estado real incerto.`
    );
    return { success: false, error: "Ordem enviada mas nao foi possivel confirmar preco real de preenchimento -- circuit breaker acionado." };
  }

  return { success: true, fillPrice: opened.openPrice, brokerPositionId };
}

export interface LiveCloseResult {
  success: boolean;
  error?: string;
  exitPrice?: number;
}

/** Fecha posição REAL por id, pro usuario dono da sessao. FAIL-CLOSED: se não confirmar preço real de saída, aciona o breaker em vez de inventar. */
export async function executeLiveClose(userId: string, brokerPositionId: string): Promise<LiveCloseResult> {
  if (!(await isLiveExecutionActive(userId))) return { success: false, error: "Execucao real desligada (kill-switch, circuit breaker ou broker nao conectado)." };

  const before = await getLivePositions(userId);
  const target = before.find((p) => String(p.id) === brokerPositionId);

  const result = await callBrokerExecute(userId, { action: "closePosition", positionId: brokerPositionId });
  if (!result.success) return { success: false, error: result.error };

  // A resposta de fechamento da MetaAPI nao traz sempre um preco de saida
  // pronto -- usa o preco corrente (bid/ask) da posicao no momento do
  // fechamento, ja carregado em `before`, como aproximacao real mais
  // proxima disponivel sem outra chamada. Sem isso, nao fabrica preco.
  if (!target || !Number.isFinite(target.currentPrice)) {
    tripLiveCircuitBreaker(
      `Posicao ${brokerPositionId} fechada na corretora mas sem preco de referencia confiavel -- estado de PnL real incerto.`
    );
    return { success: false, error: "Posicao fechada na corretora mas sem preco confiavel pra registrar -- circuit breaker acionado." };
  }

  return { success: true, exitPrice: target.currentPrice };
}

export interface LiveAccountInfo {
  balance: number;
  equity: number;
}

/** Saldo/equity REAIS da conta MetaAPI do usuario -- nunca simulado. null se a chamada falhar (fail-closed pro chamador decidir) ou se ele nao tiver broker conectado. */
export async function getLiveAccountInfo(userId: string): Promise<LiveAccountInfo | null> {
  if (!(await isUserBrokerConnected(userId))) return null;
  const result = await callBrokerExecute(userId, { action: "getAccountInfo" });
  if (!result.success) return null;
  const info = result.accountInfo as { balance?: number; equity?: number } | undefined;
  if (!info || !Number.isFinite(info.balance)) return null;
  return { balance: Number(info.balance), equity: Number(info.equity ?? info.balance) };
}

export interface LivePosition {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
}

/** Posições REAIS abertas na corretora agora, do usuario. Lança em falha (chamador decide fail-closed). */
export async function getLivePositions(userId: string): Promise<LivePosition[]> {
  const result = await callBrokerExecute(userId, { action: "getPositions" });
  if (!result.success) throw new Error(result.error ?? "Falha ao buscar posicoes reais");
  const raw = (result.positions as any[]) ?? [];
  return raw.map((p) => ({
    id: String(p.id),
    symbol: String(p.symbol),
    type: String(p.type),
    volume: Number(p.volume),
    openPrice: Number(p.openPrice),
    currentPrice: Number(p.currentPrice),
  }));
}
