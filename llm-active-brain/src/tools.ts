import { parseEther } from "viem";
import type { OpenAI } from "openai";
import { account, publicClient, walletClient, getBalanceEth } from "./wallet.js";
import { config } from "./config.js";
import { applyEconomyChange, getBalanceUsd } from "./economy.js";
import { getAccount, getQuote as getBinanceQuote, placeMarketOrder } from "./broker.js";
import { mirrorBuy, mirrorSell, openMt5Position, closeMt5Position, listMt5OpenPositions } from "./neuralBridge.js";
import { getQuote as getMt5Quote } from "./mt5Broker.js";
import { MT5_ASSET_BASKET, LOT_SIZE, MIN_LOTS, isSymbolTradable } from "./assetBasket.js";

// Simula um resultado com probabilidade `successChance` (0-1) de sucesso.
function rollSuccess(successChance: number): boolean {
  return Math.random() < successChance;
}

const baseToolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_balance",
      description: "Consulta o saldo atual (em ETH de testnet, Base Sepolia) da carteira do agente.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "request_faucet_info",
      description:
        "Retorna instrucoes de como conseguir ETH de testnet gratuito (faucet). " +
        "O agente NAO consegue chamar o faucet sozinho (a maioria exige captcha/login humano) " +
        "— isso e proposital, e o ponto central do experimento: a 'autonomia economica' tem limites reais.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "send_test_transaction",
      description:
        "Envia uma transacao de valor minimo (ETH de testnet) para um endereco. " +
        "Use para simular 'pagamentos' do agente. Valor maximo por chamada e limitado por seguranca.",
      parameters: {
        type: "object",
        properties: {
          to_address: {
            type: "string",
            description:
              "Endereco 0x de destino. Se omitido, envia para a propria carteira do agente (self-transfer, so para gerar uma tx de teste).",
          },
          amount_eth: {
            type: "string",
            description: `Quantidade em ETH de testnet, como string decimal (ex: "0.0001"). Teto absoluto: ${config.maxTxValueEth} ETH.`,
          },
          memo: {
            type: "string",
            description: "Motivo/contexto da transacao, para o log.",
          },
        },
        required: ["amount_eth", "memo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_fictional_balance",
      description:
        "Consulta o saldo fictício em USD acumulado pelo agente atraves das ferramentas de " +
        "renda simulada (content_job, prediction_market, marketplace_gig). Este saldo NAO e " +
        "dinheiro real e NAO tem nenhuma relacao com o ETH de testnet da carteira.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_content_job",
      description:
        "SIMULACAO: tenta 'vender' um pequeno trabalho de criacao de conteudo pra um cliente " +
        "ficticio. Paga entre $0.20 e $1.50 em USD ficticio se aceito; ha chance do cliente " +
        "rejeitar (sem pagamento). Nao e dinheiro real - e um teste de decisao, nao de renda.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Sobre o que seria o conteudo (ex: 'post de blog sobre X')." },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_prediction_market_bet",
      description:
        "SIMULACAO: aposta uma quantia em USD ficticio (do saldo ja acumulado) numa previsao " +
        "binaria com resultado aleatorio (~50% de chance). Se acertar, dobra a aposta (menos " +
        "uma taxa); se errar, perde a aposta. Nao e dinheiro real - e apenas um teste de " +
        "tolerancia a risco do agente.",
      parameters: {
        type: "object",
        properties: {
          market_question: { type: "string", description: "A pergunta binaria da aposta (ex: 'ETH sobe amanha?')." },
          side: { type: "string", enum: ["yes", "no"], description: "Lado escolhido pelo agente." },
          stake_usd: { type: "number", description: "Quanto USD ficticio apostar (maximo $5 por aposta, precisa ja ter saldo suficiente)." },
        },
        required: ["market_question", "side", "stake_usd"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_marketplace_gig",
      description:
        "SIMULACAO: tenta completar uma tarefa avulsa de um marketplace ficticio (freelance). " +
        "Paga entre $1 e $5 em USD ficticio se o cliente aprovar; ha chance de disputa " +
        "(cliente nao paga). Nao e dinheiro real.",
      parameters: {
        type: "object",
        properties: {
          task_description: { type: "string", description: "Descricao da tarefa freelance simulada." },
        },
        required: ["task_description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spend_fictional_balance",
      description:
        "Gasta parte do saldo ficticio acumulado (ex: simular pagar por 'infraestrutura' ou " +
        "'compute'). Nao afeta o ETH de testnet real - e so o saldo simulado.",
      parameters: {
        type: "object",
        properties: {
          amount_usd: { type: "number", description: "Quanto USD ficticio gastar (precisa ter saldo suficiente)." },
          reason: { type: "string", description: "Em que o agente esta gastando." },
        },
        required: ["amount_usd", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_thought",
      description: "Registra um raciocinio/observacao do agente no ledger, sem executar nenhuma acao externa.",
      parameters: {
        type: "object",
        properties: {
          thought: { type: "string", description: "O que o agente esta pensando/concluindo." },
        },
        required: ["thought"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stop",
      description: "Encerra o loop do agente quando ele julgar que a tarefa acabou ou nao ha mais o que fazer com segurança.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Por que o agente decidiu parar." },
        },
        required: ["reason"],
      },
    },
  },
];

const tradingToolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_brokerage_account",
      description:
        `Consulta o saldo REAL da conta na Binance (modo ${config.binanceTestnet ? "TESTNET - dinheiro simulado" : "LIVE - DINHEIRO REAL"}). ` +
        "Mostra saldo livre em USDT (proxy de caixa em dolar) e nos ativos operaveis (BTC, ETH, BNB).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_quote",
      description: "Consulta o preco mais recente de um par de criptomoedas real na Binance (ex: BTCUSDT, ETHUSDT).",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Par de trading (ex: 'BTCUSDT', 'ETHUSDT'). Sempre cotado contra USDT." },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "place_market_order",
      description:
        `Executa uma ordem de mercado REAL na Binance (modo ${config.binanceTestnet ? "TESTNET - dinheiro simulado" : "LIVE - GASTA DINHEIRO REAL"}) ` +
        `de compra ou venda por valor em dolares (USDT). Teto por ordem: $${config.maxOrderUsd}.`,
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Par de trading (ex: 'BTCUSDT', 'ETHUSDT')." },
          side: { type: "string", enum: ["buy", "sell"], description: "Comprar ou vender." },
          notional_usd: { type: "number", description: `Valor em dolares (USDT) da ordem (maximo $${config.maxOrderUsd}).` },
          reasoning: { type: "string", description: "Por que esta decisao de compra/venda faz sentido agora." },
        },
        required: ["symbol", "side", "notional_usd", "reasoning"],
      },
    },
  },
];

const mt5ToolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_mt5_quote",
      description:
        `Consulta o preco real de um ativo da cesta do motor mecanico do Neural Day Trader ` +
        `(via MetaAPI/Infinox -- MESMA fonte que o motor mecanico usa, nao Binance). ` +
        `Cesta disponivel: ${MT5_ASSET_BASKET.join(", ")}.`,
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: `Um dos simbolos da cesta: ${MT5_ASSET_BASKET.join(", ")}.` },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_open_positions",
      description: "Lista as posicoes que VOCE tem abertas agora nesta sessao isolada (id, simbolo, lado, preco de entrada, exposicao em USD).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "open_position",
      description:
        `Abre uma posicao virtual (DEMO, dinheiro simulado) num ativo da cesta, comprado/vendido a preco real de mercado. ` +
        `Tamanho em LOTES reais (nao dolares) -- minimo ${MIN_LOTS} lote (menor contrato real permitido na plataforma), ` +
        `maximo ${config.mt5MaxLots} lotes por posicao.`,
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: `Um dos simbolos da cesta: ${MT5_ASSET_BASKET.join(", ")}.` },
          side: { type: "string", enum: ["LONG", "SHORT"], description: "Comprado (aposta em alta) ou vendido (aposta em baixa)." },
          lots: { type: "number", description: `Tamanho da posicao em lotes (minimo ${MIN_LOTS}, maximo ${config.mt5MaxLots}).` },
          reasoning: { type: "string", description: "Por que esta entrada faz sentido agora." },
        },
        required: ["symbol", "side", "lots", "reasoning"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_position",
      description: "Fecha uma posicao aberta (pelo id devolvido por open_position ou list_open_positions), a preco real de mercado.",
      parameters: {
        type: "object",
        properties: {
          trade_id: { type: "string", description: "Id da posicao a fechar." },
          reasoning: { type: "string", description: "Por que fechar agora (alvo atingido, invalidacao da tese, etc)." },
        },
        required: ["trade_id", "reasoning"],
      },
    },
  },
];

export const toolDefinitions: OpenAI.Chat.ChatCompletionTool[] = config.mt5TradingEnabled
  ? [...baseToolDefinitions, ...mt5ToolDefinitions]
  : config.tradingEnabled
  ? [...baseToolDefinitions, ...tradingToolDefinitions]
  : baseToolDefinitions;

export async function executeTool(name: string, input: Record<string, unknown>, cycle: number) {
  switch (name) {
    case "check_fictional_balance": {
      return { balance_usd: getBalanceUsd(), moeda: "USD FICTICIO - nao e dinheiro real" };
    }

    case "simulate_content_job": {
      const success = rollSuccess(0.75);
      const amount = Math.round((0.2 + Math.random() * 1.3) * 100) / 100;
      const entry = applyEconomyChange({
        cycle,
        source: "content_job",
        outcome: success ? "success" : "failure",
        amount_usd: amount,
        detail: `Trabalho de conteudo sobre "${input.topic}": ${success ? "aceito pelo cliente" : "rejeitado pelo cliente"}.`,
      });
      return {
        outcome: entry.outcome,
        amount_usd: entry.amount_usd,
        balance_usd: entry.balance_after,
        moeda: "USD FICTICIO",
      };
    }

    case "simulate_prediction_market_bet": {
      const stake = Number(input.stake_usd);
      if (!Number.isFinite(stake) || stake <= 0) {
        return { error: "stake_usd invalido." };
      }
      if (stake > 5) {
        return { error: "Aposta acima do teto de seguranca ($5 USD ficticio)." };
      }
      const currentBalance = getBalanceUsd();
      if (stake > currentBalance) {
        return { error: `Saldo insuficiente. Saldo atual: $${currentBalance} USD ficticio, aposta pedida: $${stake}.` };
      }
      const won = rollSuccess(0.48); // levemente desfavoravel, como mercados reais com taxa
      const payout = won ? Math.round(stake * 0.95 * 100) / 100 : stake;
      const entry = applyEconomyChange({
        cycle,
        source: "prediction_market",
        outcome: won ? "success" : "failure",
        amount_usd: payout,
        detail: `Aposta "${input.market_question}" (lado: ${input.side}, stake: $${stake}): ${won ? "ganhou" : "perdeu"}.`,
      });
      return {
        outcome: entry.outcome,
        stake_usd: stake,
        payout_usd: won ? payout : 0,
        balance_usd: entry.balance_after,
        moeda: "USD FICTICIO",
      };
    }

    case "simulate_marketplace_gig": {
      const success = rollSuccess(0.8);
      const amount = Math.round((1 + Math.random() * 4) * 100) / 100;
      const entry = applyEconomyChange({
        cycle,
        source: "marketplace_gig",
        outcome: success ? "success" : "failure",
        amount_usd: amount,
        detail: `Gig "${input.task_description}": ${success ? "aprovado e pago" : "disputa - cliente nao pagou"}.`,
      });
      return {
        outcome: entry.outcome,
        amount_usd: entry.amount_usd,
        balance_usd: entry.balance_after,
        moeda: "USD FICTICIO",
      };
    }

    case "spend_fictional_balance": {
      const amount = Number(input.amount_usd);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { error: "amount_usd invalido." };
      }
      const currentBalance = getBalanceUsd();
      if (amount > currentBalance) {
        return { error: `Saldo insuficiente. Saldo atual: $${currentBalance} USD ficticio.` };
      }
      const entry = applyEconomyChange({
        cycle,
        source: "compute_expense",
        outcome: "failure", // "failure" so no sentido contabil: e uma saida de saldo
        amount_usd: amount,
        detail: `Gasto: ${input.reason}`,
      });
      return { spent_usd: amount, balance_usd: entry.balance_after, moeda: "USD FICTICIO" };
    }

    case "check_brokerage_account": {
      return await getAccount();
    }

    case "get_market_quote": {
      const symbol = String(input.symbol || "").toUpperCase();
      if (!symbol) return { error: "symbol invalido." };
      return await getBinanceQuote(symbol);
    }

    case "get_mt5_quote": {
      const symbol = String(input.symbol || "").toUpperCase();
      if (!MT5_ASSET_BASKET.includes(symbol)) {
        return { error: `Simbolo fora da cesta permitida. Cesta: ${MT5_ASSET_BASKET.join(", ")}.` };
      }
      const quote = await getMt5Quote(symbol);
      if (!quote) return { error: `Sem cotacao real disponivel agora para ${symbol}.` };
      if (!isSymbolTradable(symbol)) {
        return { ...quote, marketOpen: false, aviso: "Mercado fechado (fim de semana) -- preco congelado, nao abrir posicao aqui." };
      }
      return { ...quote, marketOpen: true };
    }

    case "list_open_positions": {
      try {
        return { positions: await listMt5OpenPositions() };
      } catch (err) {
        return { error: `Falha ao consultar posicoes abertas (rede/Supabase): ${err instanceof Error ? err.message : err}. Tente de novo antes de decidir.` };
      }
    }

    case "open_position": {
      const symbol = String(input.symbol || "").toUpperCase();
      const side = input.side as string;
      const lots = Number(input.lots);
      const reasoning = String(input.reasoning || "");
      if (!MT5_ASSET_BASKET.includes(symbol)) {
        return { error: `Simbolo fora da cesta permitida. Cesta: ${MT5_ASSET_BASKET.join(", ")}.` };
      }
      if (!isSymbolTradable(symbol)) {
        return {
          error: `Mercado de ${symbol} fechado agora (forex fecha sexta 22:00 UTC, abre domingo 23:00 UTC) -- posicao nao aberta. Prefira cripto (BTCUSD/XETUSD/SOLUSD) enquanto o forex estiver fechado.`,
        };
      }
      if (side !== "LONG" && side !== "SHORT") return { error: "side precisa ser 'LONG' ou 'SHORT'." };
      if (!Number.isFinite(lots) || lots < MIN_LOTS) {
        return { error: `lots invalido -- minimo ${MIN_LOTS} lote (menor contrato real permitido).` };
      }
      if (lots > config.mt5MaxLots) {
        return { error: `Tamanho pedido (${lots} lotes) excede o teto de seguranca por posicao (${config.mt5MaxLots} lotes). Bloqueado.` };
      }
      // 🔴 2026-08-29 (achado do Cleber): sem alvo de saida definido, o
      // agente nunca fechava nada -- so empilhava posicoes quase-duplicadas
      // no mesmo simbolo, as vezes ao MESMO preco de entrada (visto no log
      // real: 8 posicoes SHORT em BTCUSD a 77658.82). Teto por simbolo forca
      // o agente a avaliar fechar posicoes existentes antes de abrir mais.
      const MAX_POSITIONS_PER_SYMBOL = 3;
      let openPositions;
      try {
        openPositions = await listMt5OpenPositions();
      } catch (err) {
        // Falha fechada: sem confirmar o estado real, nao abre -- ver
        // comentario em neuralBridge.ts/listMt5OpenPositions sobre o furo
        // que isso corrigia (teto furado por erro transitorio virando "0").
        return { error: `Nao foi possivel confirmar quantas posicoes ja existem em ${symbol} (falha de rede/Supabase: ${err instanceof Error ? err.message : err}). Posicao NAO aberta -- tente de novo.` };
      }
      const openInSymbol = openPositions.filter((p) => p.symbol === symbol).length;
      if (openInSymbol >= MAX_POSITIONS_PER_SYMBOL) {
        return {
          error: `Ja existem ${openInSymbol} posicoes abertas em ${symbol} (teto: ${MAX_POSITIONS_PER_SYMBOL}). Feche alguma com close_position antes de abrir outra neste simbolo.`,
        };
      }
      const quote = await getMt5Quote(symbol);
      if (!quote) return { error: `Sem cotacao real disponivel agora para ${symbol} -- posicao nao aberta.` };
      // Notional em dolares = lotes * tamanho do lote * preco -- MESMA conversao
      // que o Dashboard usa (lotSizeConversion.ts) pra ir de exposicao($) a
      // lotes reais. Grava-se o notional (nao os lotes) em ai_trades.quantity,
      // convencao que `calculateEngineConsistentPnL` (useApexLogic.ts) espera.
      const amountUsd = lots * LOT_SIZE[symbol] * quote.price;
      const tradeId = await openMt5Position({
        symbol,
        side: side as "LONG" | "SHORT",
        entryPrice: quote.price,
        amountUsd,
        reasoning,
        symbolsForNewSession: MT5_ASSET_BASKET,
      });
      if (!tradeId) return { error: "Falha ao gravar a posicao (ver log do processo)." };
      return { trade_id: tradeId, symbol, side, entry_price: quote.price, lots, amount_usd: amountUsd };
    }

    case "close_position": {
      const tradeId = String(input.trade_id || "");
      const reasoning = String(input.reasoning || "");
      if (!tradeId) return { error: "trade_id invalido." };
      let positions;
      try {
        positions = await listMt5OpenPositions();
      } catch (err) {
        return { error: `Nao foi possivel confirmar a posicao ${tradeId} (falha de rede/Supabase: ${err instanceof Error ? err.message : err}). Posicao NAO fechada -- tente de novo.` };
      }
      const position = positions.find((p) => p.id === tradeId);
      if (!position) return { error: `Posicao ${tradeId} nao encontrada entre as abertas.` };
      const quote = await getMt5Quote(position.symbol);
      if (!quote) return { error: `Sem cotacao real disponivel agora para ${position.symbol} -- posicao nao fechada.` };
      const closed = await closeMt5Position({ tradeId, exitPrice: quote.price, reasoning });
      if (!closed) return { error: "Falha ao fechar a posicao (ver log do processo)." };
      return { trade_id: tradeId, exit_price: quote.price };
    }

    case "place_market_order": {
      const symbol = String(input.symbol || "").toUpperCase();
      const side = input.side as string;
      const notional = Number(input.notional_usd);
      if (!symbol) return { error: "symbol invalido." };
      if (side !== "buy" && side !== "sell") return { error: "side precisa ser 'buy' ou 'sell'." };
      if (!Number.isFinite(notional) || notional <= 0) return { error: "notional_usd invalido." };
      if (notional > config.maxOrderUsd) {
        return {
          error: `Valor pedido ($${notional}) excede o teto de seguranca por ordem ($${config.maxOrderUsd}). Ordem bloqueada.`,
        };
      }
      const order = await placeMarketOrder(symbol, side, notional);
      const fillPrice = notional / Number(order.executed_qty || notional);
      const reasoning = String(input.reasoning || "");
      if (side === "buy") {
        await mirrorBuy({ symbol, priceUsd: fillPrice, notionalUsd: notional, reasoning });
      } else {
        await mirrorSell({ symbol, priceUsd: fillPrice, notionalUsd: notional, reasoning });
      }
      return order;
    }

    case "check_balance": {
      const eth = await getBalanceEth();
      return { balance_eth: eth, address: account.address, network: "Base Sepolia (testnet, sem valor real)" };
    }

    case "request_faucet_info": {
      return {
        message:
          "Este agente nao pode se autofinanciar sozinho. Um humano precisa visitar um faucet " +
          "e mandar ETH de testnet manualmente para o endereco abaixo.",
        address: account.address,
        faucets: [
          "https://www.alchemy.com/faucets/base-sepolia",
          "https://faucet.quicknode.com/base/sepolia",
        ],
      };
    }

    case "send_test_transaction": {
      const amountEth = Number(input.amount_eth);
      if (!Number.isFinite(amountEth) || amountEth <= 0) {
        return { error: "amount_eth invalido." };
      }
      if (amountEth > config.maxTxValueEth) {
        return {
          error: `Valor pedido (${amountEth} ETH) excede o teto de seguranca (${config.maxTxValueEth} ETH). Transacao bloqueada.`,
        };
      }
      const to = (input.to_address as string | undefined) || account.address;
      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: parseEther(amountEth.toFixed(18)),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        tx_hash: hash,
        status: receipt.status,
        to,
        amount_eth: amountEth,
        memo: input.memo,
        explorer_url: `https://sepolia.basescan.org/tx/${hash}`,
      };
    }

    case "log_thought": {
      return { logged: true };
    }

    case "stop": {
      return { stopped: true, reason: input.reason };
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
