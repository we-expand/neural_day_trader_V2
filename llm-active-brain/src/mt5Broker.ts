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
import { recordTick } from "./tickHistory.js";

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

// 🔴 2026-08-29 (pedido do Cleber, "as entradas nao estao contemplando o
// spread"): antes, abertura/fechamento/PnL flutuante usavam um unico "price"
// (o mid/last tick) -- isso escondia o custo real de operar (o LLM comprava e
// vendia no MESMO preco, como se o spread nao existisse). Agora devolve
// bid/ask reais do MESMO tick da MetaAPI -- quem usa esta cotacao pra abrir/
// fechar posicao (tools.ts, neuralBridge.ts) preenche no lado certo: LONG
// compra no ask e vende (fecha) no bid, SHORT vende no bid e compra (fecha)
// no ask. Efeito esperado (pedido explicito): uma posicao recem-aberta ja
// mostra PnL flutuante igual a -spread ate o preco andar o suficiente pra
// cobrir esse custo -- exatamente como uma corretora real mostra. Se o
// provedor nao devolver bid/ask (raro), cai pra price em ambos -- spread
// vira 0 nesse caso, nunca inventa um spread fabricado.
export async function getQuote(
  symbol: string
): Promise<{ symbol: string; price: number; bid: number; ask: number; changePercent: number } | null> {
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

    const bid = Number.isFinite(tick.bid) ? (tick.bid as number) : tick.price;
    const ask = Number.isFinite(tick.ask) ? (tick.ask as number) : tick.price;

    // 🔴 2026-08-29 (achado do Cleber: "não está conseguindo ver pra onde o
    // mercado está indo"): todo tick REAL (nunca chega aqui se for SIMULATED,
    // ver checagem acima) alimenta o histórico em memória deste processo --
    // ver tickHistory.ts. É o que passa a sustentar tendência/volatilidade/
    // momentum quando o endpoint de candles (fonte original dessas métricas)
    // está fora do ar, como está agora.
    recordTick(symbol, tick.price);

    return { symbol, price: tick.price, bid, ask, changePercent: tick.changePercent ?? 0 };
  } catch {
    return null;
  }
}
