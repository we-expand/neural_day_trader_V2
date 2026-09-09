import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Execução REAL de ordens na Infinox via MetaAPI, chamando a MESMA Edge
 * Function `/broker/execute` que o frontend já usa (supabase/functions/
 * server/index.ts) -- reaproveita o gate de risco fail-closed e o ledger de
 * auditoria (`broker_order_executions`) que já existem lá, em vez de
 * duplicar essa lógica aqui.
 *
 * 2026-09-08 (pedido explícito do Cleber, após aviso de risco do
 * llm-council rodado nesta sessão -- ver CLAUDE.md): o `llm-active-brain`
 * roda como processo Node headless, sem sessão de navegador. `/broker/
 * execute` exige um JWT real de usuário (`getAuthenticatedUserId`,
 * `supabase/functions/server/index.ts`). Em vez de duplicar a chave de
 * criptografia do token MetaAPI (`BROKER_CREDENTIALS_ENCRYPTION_KEY`) aqui
 * -- o que dobraria a superfície de risco desse segredo --, este módulo
 * gera uma sessão real de usuário via `admin.generateLink` + `verifyOtp`
 * (MESMO padrão já usado em `supabase/functions/webauthn/index.ts` pro
 * login biométrico) e chama a Edge Function por HTTP normal, como o
 * navegador faria.
 *
 * FAIL-CLOSED SEMPRE: qualquer erro/timeout nesta chamada (rede, MetaAPI
 * fora do ar, JWT expirado) aborta a ação e NUNCA assume sucesso silencioso
 * -- ver `tripCircuitBreaker`. Nenhuma ordem é reenviada automaticamente em
 * caso de falha (evita duplicar ordem real numa rede instável já
 * documentada travando -- ver CLAUDE.md, item de 2026-09-08 sobre a conta
 * MetaAPI dedicada).
 */

const BROKER_EXECUTE_TIMEOUT_MS = 15_000;

// Circuit breaker: uma vez disparado, fica assim até o processo ser
// reiniciado manualmente -- de propósito (ver plano aprovado). $22 de
// capital não sobrevive a uma sequência automática de erros sem alguém
// olhar antes de religar.
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
    `[liveExecution] 🔴 CIRCUIT BREAKER ACIONADO -- execucao real DESLIGADA ate restart manual. Motivo: ${reason}`
  );
}

/** Execução real está ligada de fato: flag do .env E breaker ainda não disparou. */
export function isLiveExecutionActive(): boolean {
  return config.mt5LiveExecutionEnabled && !circuitBreakerTripped;
}

let cachedJwt: { token: string; obtainedAtMs: number } | null = null;
const JWT_TTL_MS = 50 * 60 * 1000; // magic link vira sessão de ~1h; renova aos 50min por margem.

async function getLiveUserJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.obtainedAtMs < JWT_TTL_MS) {
    return cachedJwt.token;
  }
  if (!config.neuralSupabaseUrl || !config.neuralSupabaseServiceRoleKey || !config.neuralUserId) {
    throw new Error(
      "NEURAL_SUPABASE_URL/NEURAL_SUPABASE_SERVICE_ROLE_KEY/NEURAL_USER_ID ausentes -- necessarios pra execucao real."
    );
  }
  const svc = createClient(config.neuralSupabaseUrl, config.neuralSupabaseServiceRoleKey);

  const { data: userData, error: userError } = await svc.auth.admin.getUserById(config.neuralUserId);
  if (userError || !userData?.user?.email) {
    throw new Error(`Falha ao obter email do usuario (NEURAL_USER_ID): ${userError?.message ?? "email ausente"}`);
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
  if (!config.neuralSupabaseAnonKey) {
    throw new Error("NEURAL_SUPABASE_ANON_KEY ausente -- necessaria pra trocar o magic link por sessao.");
  }
  const anon = createClient(config.neuralSupabaseUrl, config.neuralSupabaseAnonKey);
  const { data: sessionData, error: verifyError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session?.access_token) {
    throw new Error(`Falha ao trocar magic link por sessao: ${verifyError?.message ?? "access_token ausente"}`);
  }

  cachedJwt = { token: sessionData.session.access_token, obtainedAtMs: Date.now() };
  return cachedJwt.token;
}

interface BrokerExecuteResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

async function callBrokerExecute(body: Record<string, unknown>): Promise<BrokerExecuteResult> {
  try {
    const jwt = await getLiveUserJwt();
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
      if (res.status === 401) cachedJwt = null;
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

/** Envia ordem de mercado REAL. FAIL-CLOSED: qualquer falha devolve success:false, nunca assume execução. */
export async function executeLiveMarketOrder(params: {
  side: "LONG" | "SHORT";
  symbol: string;
  volume: number;
  stopLoss: number;
  takeProfit: number;
  comment: string;
}): Promise<LiveOrderResult> {
  if (!isLiveExecutionActive()) return { success: false, error: "Execucao real desligada (flag ou circuit breaker)." };

  const result = await callBrokerExecute({
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
  const positions = await getLivePositions();
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

/** Fecha posição REAL por id. FAIL-CLOSED: se não confirmar preço real de saída, aciona o breaker em vez de inventar. */
export async function executeLiveClose(brokerPositionId: string): Promise<LiveCloseResult> {
  if (!isLiveExecutionActive()) return { success: false, error: "Execucao real desligada (flag ou circuit breaker)." };

  const before = await getLivePositions();
  const target = before.find((p) => String(p.id) === brokerPositionId);

  const result = await callBrokerExecute({ action: "closePosition", positionId: brokerPositionId });
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

/** Saldo/equity REAIS da conta MetaAPI -- nunca simulado. null se a chamada falhar (fail-closed pro chamador decidir). */
export async function getLiveAccountInfo(): Promise<LiveAccountInfo | null> {
  const result = await callBrokerExecute({ action: "getAccountInfo" });
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

/** Posições REAIS abertas na corretora agora -- usado pra confirmar preenchimento e pra reconciliação. Lança em falha (chamador decide fail-closed). */
export async function getLivePositions(): Promise<LivePosition[]> {
  const result = await callBrokerExecute({ action: "getPositions" });
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
