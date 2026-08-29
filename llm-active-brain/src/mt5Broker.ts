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

// 🔴 2026-08-29 (achado da auditoria): 7 posicoes BTCUSD abertas no MESMO
// preco exato ao longo de 12min (feed provavelmente travado num tick velho
// sem sinalizar SIMULATED, que so cobre preco FABRICADO, nao preco REAL
// porem obsoleto). Isso so registra/avisa -- a trava de bloqueio de verdade
// fica em tools.ts/open_position (nao abre 2x no mesmo preco). Aqui e so
// para deixar rastro no log quando acontecer, pra confirmar se e feed
// travado ou coincidencia de mercado muito parado.
let lastPriceBySymbol: Record<string, number> = {};
let repeatCountBySymbol: Record<string, number> = {};

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

    if (lastPriceBySymbol[symbol] === tick.price) {
      repeatCountBySymbol[symbol] = (repeatCountBySymbol[symbol] ?? 1) + 1;
      if (repeatCountBySymbol[symbol] >= 3) {
        console.warn(
          `[mt5Broker] ⚠️ ${symbol} devolveu o MESMO preco (${tick.price}) ${repeatCountBySymbol[symbol]}x seguidas -- ` +
            `possivel feed travado (tick obsoleto, nao SIMULATED). Investigar se persistir.`
        );
      }
    } else {
      repeatCountBySymbol[symbol] = 1;
      lastPriceBySymbol[symbol] = tick.price;
    }

    return { symbol, price: tick.price, changePercent: tick.changePercent ?? 0 };
  } catch {
    return null;
  }
}
