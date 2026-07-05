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
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
  message?: string;
  price?: number;
  volume?: number;
}

export interface OrderParams {
  symbol: string;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  magic?: number;
}

export interface BrokerCredentialsStatus {
  configured: boolean;
  accountId?: string;
  mt5Login?: string;
  mt5Server?: string;
  updatedAt?: string;
}

async function invokeBroker(path: string, options: { method?: string; body?: Record<string, any> } = {}) {
  if (!supabase) throw new Error('Supabase não inicializado');

  const { data, error } = await supabase.functions.invoke(`server/broker/${path}`, {
    method: options.method || 'POST',
    body: options.body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
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

export async function getBrokerCredentialsStatus(): Promise<BrokerCredentialsStatus> {
  try {
    return await invokeBroker('credentials/status', { method: 'GET' });
  } catch (error) {
    console.error('[BrokerClient] Erro ao checar status das credenciais:', error);
    return { configured: false };
  }
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

export async function createMarketBuyOrder(params: OrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createMarketBuyOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao executar compra' };
  }
}

export async function createMarketSellOrder(params: OrderParams): Promise<TradeResult> {
  try {
    return await invokeBroker('execute', { body: { action: 'createMarketSellOrder', ...params } });
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao executar venda' };
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
