/**
 * 📊 MARKET DATA SERVICE — adapter fino sobre RealMarketDataService
 *
 * ✅ REESCRITO 2026-07-12: este arquivo era um pipeline de preço TOTALMENTE
 * separado do resto do app (nunca falava com a MetaAPI/conta de plataforma) —
 * usava `exchangerate-api.com` pra forex (sem histórico, então `previousClose`
 * era `rate * jitter aleatório`: o preço até era real, mas a variação % era
 * SEMPRE fabricada), Yahoo Finance nunca implementado (retornava null direto,
 * "TODO"), e qualquer falha caía em `generateMockMarketData()` — gerador com
 * tabela de preço-base hardcoded + Math.random(), sem nenhum aviso visual.
 * Índices (SPX500, NAS100 etc.) nunca tinham rota real nenhuma — sempre mock.
 *
 * Consumido por ChartView, AITrader, MarketScore, AssetPriceTag,
 * MarketDataControlPanel (via hooks/useMarketData.ts) — ou seja, esse mock
 * também aparecia fora do Dashboard. Requisito do produto: o app precisa
 * mostrar dado real mesmo pra quem não conectou corretora própria (maioria
 * dos usuários vai usar só como demo/treino) — a conta MetaAPI é da
 * PLATAFORMA, não do usuário, então isso já é possível sem credencial pessoal.
 *
 * Mantém a MESMA assinatura exportada (MarketData, getMarketData,
 * getMultipleMarketData, subscribeToRealTimeUpdates) pra não exigir mudança
 * nos consumidores — só troca o que alimenta esses dados por dentro:
 * RealMarketDataService, que já roteia cripto (Binance/CFD) vs forex/índice/
 * commodity (MetaAPI de plataforma, com fallback Yahoo real) e nunca inventa
 * preço (retorna isRealData: false explícito em vez de número fabricado).
 */

import {
  getRealMarketData,
  getBatchedMT5Data,
  subscribeToMarketData,
  type RealMarketData,
} from './RealMarketDataService';

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  signal: '🟢' | '🔴' | '⚪';
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  lastUpdate: string;
  source: 'binance' | 'metaapi' | 'yahoo' | 'yahoo-fallback' | 'twelvedata' | 'generated';
  isRealData: boolean;
}

function toMarketData(symbol: string, data: RealMarketData): MarketData {
  const changePercent = data.changePercent ?? 0;
  const change = data.change ?? 0;
  return {
    symbol,
    name: symbol,
    price: data.price,
    previousClose: data.previousClose ?? (data.price - change),
    change,
    changePercent,
    signal: changePercent > 0.1 ? '🟢' : changePercent < -0.1 ? '🔴' : '⚪',
    direction: changePercent > 0 ? 'UP' : changePercent < 0 ? 'DOWN' : 'NEUTRAL',
    lastUpdate: new Date(data.timestamp).toISOString(),
    source: data.source as MarketData['source'],
    isRealData: data.isRealData,
  };
}

// ============================================================================
// 🎯 FUNÇÃO PRINCIPAL — GET MARKET DATA (um símbolo)
// ============================================================================

export async function getMarketData(symbol: string): Promise<MarketData> {
  const data = await getRealMarketData(symbol);
  return toMarketData(symbol, data);
}

// ============================================================================
// 🔄 ATUALIZAÇÃO EM LOTE (Batch Updates)
// ============================================================================

export async function getMultipleMarketData(symbols: string[]): Promise<Map<string, MarketData>> {
  const results = new Map<string, MarketData>();
  if (symbols.length === 0) return results;

  const batched = await getBatchedMT5Data(symbols);
  for (const symbol of symbols) {
    const data = batched[symbol.toUpperCase().replace('/', '').replace(' ', '')] ?? batched[symbol];
    if (data) results.set(symbol, toMarketData(symbol, data));
  }

  return results;
}

// ============================================================================
// 📡 ATUALIZAÇÕES EM TEMPO REAL (polling via RealMarketDataService)
// ============================================================================

export function subscribeToRealTimeUpdates(
  symbols: string[],
  callback: (data: MarketData) => void,
  intervalMs: number = 5000
): () => void {
  return subscribeToMarketData(symbols, (symbol, data) => {
    callback(toMarketData(symbol, data));
  }, intervalMs);
}
