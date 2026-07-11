/**
 * 🌐 REAL PRICE PROVIDER
 *
 * ✅ REATIVADO 2026-07-11: esta função ficava desabilitada (sempre retornava
 * `{}`), mas continuava sendo chamada por `InfinoxAssetsBrowser.tsx` pra
 * popular o preço de TODOS os ~220 ativos do catálogo — resultado: a lista de
 * ativos sempre aparecia zerada, pra qualquer ativo, independente de mercado
 * aberto ou fechado. Delega pra `getBatchedMT5Data()` (RealMarketDataService.ts),
 * já usado e comprovadamente saudável em produção (loop de P&L do AI Trading
 * Engine) — uma única chamada em lote pro backend em vez de N requisições.
 */

import { getBatchedMT5Data } from '@/app/services/RealMarketDataService';

export interface RealPrice {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface BatchPriceResult {
  symbol: string;
  price: number;
  change24h: number;
  changePercent: number;
  timestamp: number;
  source: string;
}

export async function fetchRealPricesBatch(symbols: string[]): Promise<Record<string, BatchPriceResult>> {
  if (symbols.length === 0) return {};

  const data = await getBatchedMT5Data(symbols);
  const result: Record<string, BatchPriceResult> = {};

  Object.entries(data).forEach(([symbol, marketData]) => {
    result[symbol] = {
      symbol,
      price: marketData.price,
      change24h: marketData.change ?? 0,
      changePercent: marketData.changePercent ?? 0,
      timestamp: marketData.timestamp,
      source: marketData.isRealData ? marketData.source : 'FALLBACK',
    };
  });

  return result;
}
