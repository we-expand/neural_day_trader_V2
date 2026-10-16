import crypto from "node:crypto";
import { config } from "./config.js";

// Binance Spot Testnet (dados de mercado reais, saldo simulado) ou
// Binance real, dependendo de BINANCE_TESTNET no .env.
const BASE_URL = config.binanceTestnet
  ? "https://testnet.binance.vision"
  : "https://api.binance.com";

function sign(query: string): string {
  return crypto.createHmac("sha256", config.binanceSecretKey).update(query).digest("hex");
}

async function signedRequest(path: string, method: "GET" | "POST", params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, timestamp: Date.now().toString() }).toString();
  const signature = sign(query);
  const url = `${BASE_URL}${path}?${query}&signature=${signature}`;
  const res = await fetch(url, {
    method,
    headers: { "X-MBX-APIKEY": config.binanceApiKey },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Binance API error ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function publicRequest(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}${path}?${query}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Binance API error ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

// A conta testnet da Binance vem pre-carregada com centenas de ativos
// ficticios. Retornamos so o saldo em USDT (proxy de "caixa em dolar") e os
// ativos que o agente realmente pode operar (ver TRADABLE_ASSETS em
// tools.ts) - isso evita estourar o limite de tokens do modelo com uma
// lista gigante e irrelevante.
const RELEVANT_ASSETS = ["USDT", "BTC", "ETH", "BNB"];

export async function getAccount() {
  const account = await signedRequest("/api/v3/account", "GET", {});
  const balances = (account.balances as Array<{ asset: string; free: string; locked: string }>) ?? [];
  const relevant = balances.filter((b) => RELEVANT_ASSETS.includes(b.asset));
  const usdt = relevant.find((b) => b.asset === "USDT");

  return {
    cash_usd: usdt ? Number(usdt.free) : 0,
    balances: relevant.map((b) => ({ asset: b.asset, free: Number(b.free), locked: Number(b.locked) })),
    mode: config.binanceTestnet ? "TESTNET (dinheiro simulado)" : "LIVE (dinheiro real)",
  };
}

export async function getQuote(symbol: string) {
  const data = await publicRequest("/api/v3/ticker/price", { symbol });
  return {
    symbol,
    price_usd: Number(data.price),
  };
}

export async function placeMarketOrder(symbol: string, side: "buy" | "sell", notionalUsd: number) {
  let order;
  try {
    order = await signedRequest("/api/v3/order", "POST", {
      symbol,
      side: side.toUpperCase(),
      type: "MARKET",
      quoteOrderQty: notionalUsd.toFixed(2),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NOTIONAL")) {
      throw new Error(
        `${message} - a Binance tem um valor minimo de ordem por par (geralmente ~$5 USDT), ` +
          `e $${notionalUsd} ficou abaixo disso para ${symbol}. Tente um valor maior (respeitando o teto MAX_ORDER_USD) ou desista dessa operacao.`
      );
    }
    throw err;
  }
  return {
    order_id: order.orderId,
    symbol: order.symbol,
    side: order.side,
    notional_usd: notionalUsd,
    status: order.status,
    executed_qty: order.executedQty,
    mode: config.binanceTestnet ? "TESTNET (dinheiro simulado)" : "LIVE (dinheiro real)",
  };
}
