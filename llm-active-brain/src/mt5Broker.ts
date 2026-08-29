/**
 * Preço real do MESMO pipeline que o motor mecânico do Neural Day Trader usa
 * (rota `/mt5-prices` do Supabase, autenticada com METAAPI_TOKEN — conta de
 * plataforma, não credencial do usuário) — ver `RealMarketDataService.ts`
 * (`fetchMT5Data`) no repo principal, esta função espelha exatamente aquela
 * chamada. Nenhuma dependência de Binance/cripto: 2026-08-29, pedido do
 * Cleber — "não precisamos utilizar a Binance... com a nossa cesta de
 * ativos... como se estivesse no lugar do motor que a gente tinha
 * desenvolvido".
 */
import { config } from "./config.js";

interface Mt5PriceTick {
  price: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
}

export async function getQuote(symbol: string): Promise<{ symbol: string; price: number; changePercent: number } | null> {
  const url = `${config.neuralSupabaseUrl}/functions/v1/server/mt5-prices`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.neuralSupabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbols: [symbol] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const result = await res.json();
    const tick: Mt5PriceTick | null = Array.isArray(result?.prices) ? result.prices[0] : null;
    if (!tick || !Number.isFinite(tick.price) || tick.price <= 0 || result.source === "SIMULATED") return null;
    return { symbol, price: tick.price, changePercent: tick.changePercent ?? 0 };
  } catch {
    return null;
  }
}
