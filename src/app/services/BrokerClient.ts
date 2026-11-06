/**
 * BROKER CLIENT (Fase 1 — substitui o MetaAPIDirectClient)
 *
 * O token MetaAPI nunca mais fica no browser: é salvo uma vez via saveBrokerCredentials()
 * e passa a viver criptografado no Supabase, acessível só pela Edge Function.
 * Toda leitura/ordem daqui em diante chama a Edge Function autenticada pelo JWT da sessão
 * (supabase.functions.invoke já injeta o Authorization Bearer automaticamente).
 */

import { supabase } from '@/lib/supabaseClient';

export interface DirectPriceData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  spread: number;
  timestamp: number;
}

export interface DirectAccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  // 🔴 2026-09-09: campo real já devolvido pela MetaAPI (account-information),
  // só não estava tipado aqui ainda — usado pro card de margem no Dashboard.
  marginLevel?: number;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
  message?: string;
  price?: number;
  volume?: number;
  /** true quando a falha veio do gate de risco server-side (/broker/execute), não de erro de rede/MetaAPI. */
  riskBlocked?: boolean;
}

export interface OrderParams {
  symbol: string;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  magic?: number;
}

export interface PendingOrderParams extends OrderParams {
  /** Preço de gatilho da ordem (limit/stop). */
  price: number;
}

export interface StopLimitOrderParams extends PendingOrderParams {
  /** Preço-limite aplicado depois que o stop dispara (ORDER_TYPE_*_STOP_LIMIT). */
  stopLimitPrice: number;
}

export interface BrokerCredentialsStatus {
  configured: boolean;
  accountId?: string;
  mt5Login?: string;
  mt5Server?: string;
  updatedAt?: string;
}

type BrokerHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function invokeBroker(path: string, options: { method?: BrokerHttpMethod; body?: Record<string, any> } = {}) {
  if (!supabase) throw new Error('Supabase não inicializado');

  const { data, error } = await supabase.functions.invoke(`server/broker/${path}`, {
    method: options.method || 'POST',
    body: options.body,
  });

  if (error) {
    // FunctionsHttpError.message é sempre o texto genérico "Edge Function
    // returned a non-2xx status code" — o corpo JSON real (que traz
    // {error, riskBlocked} do gate de risco em /broker/execute) fica em
    // error.context (um Response), não em error.message. Sem isso, o
    // motivo específico do bloqueio de risco nunca chega ao usuário.
    const context = (error as any)?.context;
    let body: any = null;
    if (context && typeof context.json === 'function') {
      try {
        body = await context.json();
      } catch {
        body = null;
      }
    }
    if (body) {
      throw Object.assign(new Error(body.error || error.message), {
        riskBlocked: body.riskBlocked === true,
      });
    }
    throw error;
  }
  if (data?.error) throw Object.assign(new Error(data.error), { riskBlocked: data?.riskBlocked === true });
  return data;
}

export async function saveBrokerCredentials(
  token: string,
  accountId: string,
  mt5Login?: string,
  mt5Server?: string
): Promise<{ success: boolean; message?: string }> {
  return invokeBroker('credentials', { method: 'POST', body: { token, accountId, mt5Login, mt5Server } });
}

// 🔴 2026-09-11 (achado: saldo LIVE "oscilando" entre o real e o $100 do DEMO):
// esta função engolia QUALQUER erro transitório (rede, instabilidade da
// MetaAPI já documentada neste projeto) e devolvia `{configured: false}` —
// indistinguível de "usuário nunca conectou corretora". Os 2 chamadores
// (useApexLogic.ts reconcile() e TradingContext.tsx checkConnected()) já
// tinham lógica pra MANTER o último estado conhecido numa falha transitória
// (comentários "falha transitória -- mantém o último estado"), mas essa
// lógica nunca disparava porque o erro nunca chegava até eles — sempre virava
// um `configured: false` "de sucesso". Cada poll de 10-20s que batesse numa
// falha transitória derrubava `isLiveConnected`/`brokerConnectedCacheRef` pra
// false, fazendo o Dashboard cair pro cálculo de saldo simulado (DEMO) até o
// próximo poll ter sucesso. Deixa o erro propagar — quem chama já sabe tratar.
export async function getBrokerCredentialsStatus(): Promise<BrokerCredentialsStatus> {
  return await invokeBroker('credentials/status', { method: 'GET' });
}

export async function deleteBrokerCredentials(): Promise<{ success: boolean }> {
  return invokeBroker('credentials', { method: 'DELETE' });
}

export async function getPrices(symbols: string[]): Promise<DirectPriceData[]> {
  try {
    const result = await invokeBroker('execute', { body: { action: 'getPrices', symbols } });
    return result.prices || [];
  } catch (error) {
    console.error('[BrokerClient] Erro ao buscar preços:', error);
    return [];
  }
}

export async function getAccountInfo(): Promise<DirectAccountInfo | null> {
  try {
    const result = await invokeBroker('execute', { body: { action: 'getAccountInfo' } });
    return result.accountInfo || null;
  } catch (error) {
    console.error('[BrokerClient] Erro ao buscar info da conta:', error);
    return null;
  }
}

export async function getPositions(): Promise<any[]> {
  try {
    const result = await invokeBroker('execute', { body: { action: 'getPositions' } });
    return result.positions || [];
  } catch (error) {
    console.error('[BrokerClient] Erro ao buscar posições:', error);
    return [];
  }
}

// 🔴 2026-09-11: variantes que NÃO engolem erro de rede/MetaAPI -- usadas pelo
// polling de reconciliação LIVE (useApexLogic.ts). `getPositions()`/
// `getAccountInfo()` acima devolvem []/null tanto pra "sem posição real"
// quanto pra falha transitória, indistinguíveis pra quem chama -- mesmo bug
// já catalogado no caminho DEMO (reconcile() de ai_trades) que apagava a
// posição da tela numa falha de rede até o próximo poll ter sucesso.
export async function getPositionsOrThrow(): Promise<any[]> {
  const result = await invokeBroker('execute', { body: { action: 'getPositions' } });
  return result.positions || [];
}

export async function getAccountInfoOrThrow(): Promise<DirectAccountInfo | null> {
  const result = await invokeBroker('execute', { body: { action: 'getAccountInfo' } });
  return result.accountInfo || null;
}

export async function createMarketBuyOrder(params: OrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createMarketBuyOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao executar compra', riskBlocked: error?.riskBlocked === true };
  }
}

export async function createMarketSellOrder(params: OrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createMarketSellOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao executar venda', riskBlocked: error?.riskBlocked === true };
  }
}

export async function closePosition(positionId: string): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'closePosition', positionId } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao fechar posição' };
  }
}

export async function closePositionPartially(positionId: string, volume: number): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'closePositionPartially', positionId, volume } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao fechar parcialmente' };
  }
}

export async function modifyPosition(positionId: string, stopLoss?: number, takeProfit?: number): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'modifyPosition', positionId, stopLoss, takeProfit } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao modificar posição' };
  }
}

export async function closeAllPositionsBySymbol(symbol: string): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'closeAllPositionsBySymbol', symbol } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao fechar posições do símbolo' };
  }
}

export async function closeAllPositions(): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'closeAllPositions' } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao fechar todas as posições' };
  }
}

// --- Ordens pendentes (limit/stop/stop-limit) — reais, a MetaAPI monitora o
// preço e dispara sozinha; não existe simulação client-side pro caminho LIVE. ---

export async function createLimitBuyOrder(params: PendingOrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createLimitBuyOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao criar ordem limit de compra', riskBlocked: error?.riskBlocked === true };
  }
}

export async function createLimitSellOrder(params: PendingOrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createLimitSellOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao criar ordem limit de venda', riskBlocked: error?.riskBlocked === true };
  }
}

export async function createStopBuyOrder(params: PendingOrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createStopBuyOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao criar ordem stop de compra', riskBlocked: error?.riskBlocked === true };
  }
}

export async function createStopSellOrder(params: PendingOrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createStopSellOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao criar ordem stop de venda', riskBlocked: error?.riskBlocked === true };
  }
}

export async function createStopLimitBuyOrder(params: StopLimitOrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createStopLimitBuyOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao criar ordem stop limit de compra', riskBlocked: error?.riskBlocked === true };
  }
}

export async function createStopLimitSellOrder(params: StopLimitOrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createStopLimitSellOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao criar ordem stop limit de venda', riskBlocked: error?.riskBlocked === true };
  }
}

export async function cancelPendingOrder(orderId: string): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'cancelPendingOrder', orderId } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao cancelar ordem pendente' };
  }
}

export async function getPendingOrders(): Promise<any[]> {
  try {
    const result = await invokeBroker('execute', { body: { action: 'getOrders' } });
    return result.orders || [];
  } catch (error) {
    console.error('[BrokerClient] Erro ao buscar ordens pendentes:', error);
    return [];
  }
}
