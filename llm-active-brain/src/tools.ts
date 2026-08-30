import { parseEther } from "viem";
import type { OpenAI } from "openai";
import { account, publicClient, walletClient, getBalanceEth } from "./wallet.js";
import { config } from "./config.js";
import { applyEconomyChange, getBalanceUsd } from "./economy.js";
import { getAccount, getQuote as getBinanceQuote, placeMarketOrder } from "./broker.js";
import { mirrorBuy, mirrorSell, openMt5Position, closeMt5Position, listMt5OpenPositions, getRecentClosedTrades } from "./neuralBridge.js";
import { getQuote as getMt5Quote } from "./mt5Broker.js";
import { getAtrPercent, getTrendInfo, getVolumeConfirmation, getSupportResistance } from "./atr.js";
import { getPriceExtension } from "./tickHistory.js";
import { MT5_ASSET_BASKET, LOT_SIZE, MIN_LOTS, isSymbolTradable, getCorrelatedGroup } from "./assetBasket.js";

// 🔴 2026-08-30 (investigacao: "feed travado" + spread anormal em DOTUSD).
// Medicao REAL da cesta inteira, 6 chamadas seguidas a /mt5-prices em ~50s
// (2026-08-30 02:45-02:46 UTC, sabado, cripto em pregao 24/7):
//   BTCUSD 0,015% | XETUSD 0,106% | BTCXBN 0,177% | XPTUSD 0,463%
//   SOLUSD 0,505% | DOGUSD 1,30-1,42% | XRPUSD 1,469% | DOTUSD 10,44%
// Confirmado que NAO e bug de cache/staleness: o timestamp do tick de DOTUSD
// AVANCA normalmente (02:45:00 -> 02:46:10) com bid/ask vindos do MESMO
// objeto `current-tick` da MetaAPI -- e o spread cotado de verdade pela
// Infinox pra esse CFD (fim de semana, liquidez minima). Sendo dado real, a
// resposta certa e trava de risco, nao "fix de dado": com 10,4% de spread a
// posicao nasce ~10% negativa (foi exatamente o que aconteceu no LONG de
// DOTUSD observado nesta sessao, -9,46% flutuante instantaneo, stopado logo
// em seguida). 2,0% de teto bloqueia so o DOTUSD; o 2o pior da cesta
// (XRPUSD, 1,47%) segue liberado, com aviso a partir de 0,8%.
export const SPREAD_BLOCK_PCT = 2.0;
export const SPREAD_WARN_PCT = 0.8;

// Simula um resultado com probabilidade `successChance` (0-1) de sucesso.
function rollSuccess(successChance: number): boolean {
  return Math.random() < successChance;
}

// 🔴 2026-08-29/30 (achado do Cleber durante monitoramento ao vivo): em modo
// MT5, o agente estava recebendo TODAS as ferramentas do experimento legado
// (carteira ETH de testnet, "economia ficticia" de USD por gigs/apostas
// simuladas) mesmo sem nenhuma relacao com a missao real -- confirmado no
// log chamando check_balance/check_fictional_balance e RACIOCINANDO sobre o
// saldo ficticio ($3.51) como se fosse capital disponivel pra dimensionar
// entrada real. Isso e ruido puro na decisao, nao so ferramenta inutil.
// Agora `commonToolDefinitions` (usado em TODOS os modos) tem so log_thought
// e stop; as ferramentas do experimento ETH/economia ficticia viram
// `legacyToolDefinitions`, oferecidas SO no modo legado (nem MT5 nem
// Binance).
const commonToolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
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

const legacyToolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
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
        `Devolve tambem "trend" (variacao % e rotulo ALTA/BAIXA/LATERAL) e "volume" (razao de participacao e ` +
        `"elevated" true/false) -- proxies reais de direcao/participacao, nunca fabricados. Cada um tem um campo ` +
        `"source": trend.source e "candle" (candle oficial da MetaAPI, janela de 1h) ou "tick" (fallback: preco ` +
        `real deste processo, janela pode ser mais curta no inicio, ate 60min conforme o historico cresce). ` +
        `volume.source e "candle_volume" (tickVolume real) ou "tick_momentum" (fallback: aceleracao de preco -- ` +
        `nao e volume de verdade, mas e sinal real, nao inventado). AMBOS podem vir null so nos primeiros minutos ` +
        `apos reiniciar o processo (historico de tick ainda curto) -- nesse caso use "changePercent" (sempre ` +
        `preenchido) como proxy e opere pelo julgamento normal. So quando trend/volume vierem preenchidos e a ` +
        `entrada for CONTRA a tendencia SEM volume elevado, open_position bloqueia por codigo. ` +
        `Tambem devolve "supportResistance" (maxima/minima reais das ultimas ~2,5h de candle de 5m, distancia % ` +
        `do preco pra cada nivel, e "nearLevel" RESISTENCIA/SUPORTE/null quando o preco esta a menos de 0,15% de ` +
        `um deles) -- topo/fundo recente de verdade, calculado do mesmo candle oficial de "trend", null quando ` +
        `candle nao disponivel. ` +
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
        `O TAMANHO EM LOTES E CALCULADO PELO CODIGO, nao por voce -- ver "size" abaixo. ` +
        `Isso existe porque os simbolos da cesta tem precos MUITO diferentes entre si (ex: BTCUSD ~$77.000 vs XETUSD ~$2.400), ` +
        `entao o MESMO numero de lotes gera exposicoes em dolar completamente diferentes; o codigo normaliza isso ` +
        `automaticamente pra exposicao-alvo igual (~$${config.mt5TargetNotionalUsd}) em qualquer simbolo. ` +
        `Todos os simbolos da cesta (${MT5_ASSET_BASKET.join("/")}) sao cripto correlacionada -- ` +
        `exposicao combinada do MESMO lado nesse grupo tem teto proprio (nao e so por simbolo). ` +
        `Reentrar no mesmo simbolo+lado logo depois de bater stop 2x seguidas fica bloqueado por um tempo (cooldown). ` +
        `Entrar CONTRA a tendencia recente (ver "trend" em get_mt5_quote) SEM volume acima do normal (ver "volume") tambem e bloqueado -- ` +
        `contrarian trade e permitido, mas so com confirmacao real de participacao, nao no vacuo. ` +
        `Tambem e bloqueado abrir com cotacao OBSOLETA (ultimo tick real da corretora com mais de 120s -- mercado fechado/feed parado) ` +
        `ou com spread bid/ask acima de ${SPREAD_BLOCK_PCT}% (custo de entrada real alto demais; a cesta tipica fica entre 0,02% e 1,5%).`,
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: `Um dos simbolos da cesta: ${MT5_ASSET_BASKET.join(", ")}.` },
          side: { type: "string", enum: ["LONG", "SHORT"], description: "Comprado (aposta em alta) ou vendido (aposta em baixa)." },
          size: {
            type: "string",
            enum: ["normal", "forte"],
            description:
              `"normal" = exposicao-alvo padrao (~$${config.mt5TargetNotionalUsd}, igual pra qualquer simbolo). ` +
              `"forte" = ${config.mt5HeavyMultiplier}x essa exposicao -- use quando a conviccao no sinal for mais alta, ` +
              `nao como padrao pra tudo.`,
          },
          reasoning: { type: "string", description: "Por que esta entrada faz sentido agora." },
        },
        required: ["symbol", "side", "size", "reasoning"],
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
  ? [...commonToolDefinitions, ...mt5ToolDefinitions]
  : config.tradingEnabled
  ? [...commonToolDefinitions, ...legacyToolDefinitions, ...tradingToolDefinitions]
  : [...commonToolDefinitions, ...legacyToolDefinitions];

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
      // 🔴 2026-08-29 (otimização urgente pós-perda do dia): contexto de
      // tendência de curto prazo (1h) vai junto da cotação -- achado real foi
      // o agente abrindo SHORT repetido em cripto bem no meio de um rali de
      // horas, decidindo só a partir do preço do instante, sem nenhuma noção
      // de "isso já está subindo há um tempo". null quando não dá pra
      // calcular com dado real -- nunca inventa tendência.
      const trend = await getTrendInfo(symbol);
      // 🔴 2026-08-29: proxy honesto de participacao/forca por tras do
      // movimento (tickVolume real da MetaAPI, ver atr.ts) -- nao e order
      // flow/book de ofertas de verdade (o sistema nao tem esse dado), mas e
      // volume real, nao fabricado. null quando indisponivel.
      const volume = await getVolumeConfirmation(symbol);
      // 🔴 2026-08-29 (achado do Cleber: entrada LONG em XETUSD com preco ja
      // "longe das medias", Estocastico quase virando, MACD com exaustao --
      // sinais que este sistema nao tinha como enxergar). Na epoca, MACD/
      // Estocastico de verdade eram impossiveis porque /mt5-candles devolvia
      // SIMULATED pra esta cesta (endpoint chamava path errado da MetaAPI,
      // 404 sempre -- CORRIGIDO no mesmo dia, ver historico de sessao:
      // candle real confirmado chegando pros 8 simbolos). "extension" segue
      // como substituto honesto pra exaustao de curtissimo prazo (media do
      // proprio historico de tick, mais rapida de reagir que MACD/
      // Estocastico de candle), mas MACD/Estocastico REAIS agora sao
      // viaveis de implementar em cima do candle que ja chega -- nao feito
      // ainda nesta sessao, fica como proximo passo se quiser indicador de
      // exaustao mais forte que "extension".
      const extension = getPriceExtension(symbol);
      // 🔴 2026-08-29 (pedido do Cleber, "fundamentos completos de price
      // action"): suporte/resistencia real, so ficou honesto de calcular
      // depois do fix de /mt5-candles (era 404 na MetaAPI, sempre caia em
      // SIMULATED -- ver historico de sessao). null quando candle real nao
      // disponivel, nunca fabrica nivel.
      const supportResistance = await getSupportResistance(symbol);
      if (!isSymbolTradable(symbol)) {
        return { ...quote, marketOpen: false, trend, volume, extension, supportResistance, aviso: "Mercado fechado (fim de semana) -- preco congelado, nao abrir posicao aqui." };
      }
      // 🔴 2026-08-30 (investigacao de feed travado / spread anormal): dois
      // avisos REAIS que antes o agente nao tinha como enxergar -- ambos
      // medidos ao vivo neste dia, ver SESSAO_2026-08-30_FEED_TRAVADO_E_SPREAD.md.
      // (1) tick obsoleto: XPTUSD (platina) devolvia preco de ~30h atras, e o
      // calendario de mercado deste codigo so cobre FOREX (assetBasket.ts),
      // entao platina passava como "mercado aberto" no fim de semana.
      // (2) spread real absurdo: DOTUSD cotado com 10,4% de spread bid/ask --
      // dado REAL da corretora, nao bug, mas uma entrada ali ja nasce ~10%
      // negativa. Aviso aqui + bloqueio em open_position.
      const avisos: string[] = [];
      if (quote.stale) {
        avisos.push(
          `COTACAO OBSOLETA: ultimo tick real tem ${quote.tickAgeSeconds}s de idade (mercado provavelmente fechado ou feed parado). Nao abra posicao aqui.`
        );
      }
      if (Number.isFinite(quote.spreadPct) && quote.spreadPct >= SPREAD_WARN_PCT) {
        avisos.push(
          `SPREAD ALTO: ${quote.spreadPct.toFixed(2)}% entre bid e ask -- uma entrada aqui ja nasce ~${quote.spreadPct.toFixed(2)}% negativa ` +
            `so pelo custo de operar (${quote.spreadPct >= SPREAD_BLOCK_PCT ? "acima do teto: open_position BLOQUEIA" : "abaixo do teto de bloqueio"}). ` +
            `O CODIGO ja alarga o stop automaticamente pra nunca ficar menor que o spread (nao precisa/deve compensar isso na decisao de ENTRAR), ` +
            `mas um spread alto ainda encolhe a margem real de lucro ate o alvo -- prefira ativos com spread normal quando houver sinal equivalente em mais de um.`
        );
      }
      return {
        ...quote,
        marketOpen: true,
        trend,
        volume,
        extension,
        supportResistance,
        ...(avisos.length > 0 ? { aviso: avisos.join(" | ") } : {}),
      };
    }

    case "list_open_positions": {
      // 🔴 2026-08-29 (achado da auditoria): o LLM calculando %/PnL de cabeca
      // a partir de entry_price + preco atual errou pelo menos 2x na noite
      // de 2026-08-29 (uma vez inverteu lucro/prejuizo, outra escreveu
      // "Lucratividade alcancada: prejuizo de ~1.125%" na mesma frase).
      // Modelo pequeno/rapido fazendo aritmetica em texto livre erra com
      // frequencia nao-trivial -- a correcao nao e "pedir pra pensar melhor",
      // e tirar a conta da mao dele: devolver pnl_percentage/pnl_usd JA
      // CALCULADOS (mesma formula de closeMt5Position em neuralBridge.ts),
      // deterministico, nunca erra. O LLM so precisa ler o numero.
      let positions;
      try {
        positions = await listMt5OpenPositions();
      } catch (err) {
        return { error: `Falha ao consultar posicoes abertas (rede/Supabase): ${err instanceof Error ? err.message : err}. Tente de novo antes de decidir.` };
      }
      const quoteCache = new Map<string, { price: number; bid: number; ask: number } | null>();
      const enriched = await Promise.all(
        positions.map(async (pos) => {
          if (!quoteCache.has(pos.symbol)) {
            quoteCache.set(pos.symbol, await getMt5Quote(pos.symbol));
          }
          const quote = quoteCache.get(pos.symbol);
          if (!quote) {
            return { ...pos, current_price: null, pnl_percentage: null, pnl_usd: null, aviso: "Sem cotacao real agora -- nao foi possivel calcular PnL atual." };
          }
          // 🔴 2026-08-29 (pedido do Cleber, "as entradas nao estao
          // contemplando o spread"): PnL flutuante usa o preco que FECHARIA a
          // posicao agora de verdade -- bid pra LONG (venderia), ask pra
          // SHORT (compraria de volta) -- nao o mid/last tick. Efeito
          // esperado: uma posicao recem-aberta ja mostra -spread ate o preco
          // andar o suficiente pra cobrir esse custo, igual corretora real.
          const execPrice = pos.side === "LONG" ? quote.bid : quote.ask;
          const amountUsd = pos.quantity; // convencao: quantity = exposicao em dolar, ver comentario em neuralBridge.ts
          const pnlUsd =
            pos.side === "LONG"
              ? (execPrice - pos.entry_price) * (amountUsd / pos.entry_price)
              : (pos.entry_price - execPrice) * (amountUsd / pos.entry_price);
          const pnlPct = ((execPrice - pos.entry_price) / pos.entry_price) * 100 * (pos.side === "LONG" ? 1 : -1);
          return {
            ...pos,
            current_price: execPrice,
            pnl_percentage: Number(pnlPct.toFixed(4)),
            pnl_usd: Number(pnlUsd.toFixed(4)),
          };
        })
      );
      return { positions: enriched };
    }

    case "open_position": {
      const symbol = String(input.symbol || "").toUpperCase();
      const side = input.side as string;
      const sizeInput = String(input.size || "normal").toLowerCase();
      const reasoning = String(input.reasoning || "");
      if (!MT5_ASSET_BASKET.includes(symbol)) {
        return { error: `Simbolo fora da cesta permitida. Cesta: ${MT5_ASSET_BASKET.join(", ")}.` };
      }
      if (!isSymbolTradable(symbol)) {
        return {
          error: `Mercado de ${symbol} fechado agora (forex fecha sexta 22:00 UTC, abre domingo 23:00 UTC) -- posicao nao aberta. Prefira um dos criptos da cesta enquanto o forex estiver fechado.`,
        };
      }
      if (side !== "LONG" && side !== "SHORT") return { error: "side precisa ser 'LONG' ou 'SHORT'." };
      if (sizeInput !== "normal" && sizeInput !== "forte") return { error: "size precisa ser 'normal' ou 'forte'." };
      // 🔴 2026-08-30 (achado real, sessao de monitoramento): o schema desta
      // ferramenta ja declarava "reasoning" como campo obrigatorio, mas o
      // handler nunca validava isso -- so caia no fallback `|| ""`, entao
      // uma chamada sem reasoning abria a posicao normalmente com
      // justificativa vazia gravada em ai_reasoning. Isso quebra a exigencia
      // do projeto de que toda decisao da IA seja auditavel (CLAUDE.md,
      // "nunca fabricar dado... sempre justificar decisao"). Trade real
      // confirmado sem reasoning: SOLUSD SHORT aberta as 2026-08-30 09:25 UTC.
      if (reasoning.trim().length === 0) {
        return { error: "reasoning e obrigatorio -- explique por que esta entrada faz sentido agora antes de abrir a posicao." };
      }
      // 🔴 2026-08-30 (achado real, sessao de monitoramento -- pendencia de
      // politica de risco explicitamente listada no handoff anterior, agora
      // resolvida): o "reasoning" da PROPRIA entrada as vezes contradiz a
      // acao que ele esta justificando -- confirmado ao vivo pelo menos 5-6x
      // (texto termina "fora por enquanto"/"operacao bloqueada"/"preciso
      // analisar mais antes de abrir"/"devo evitar repetir padrao... sem
      // nova evidencia" e o open_position executa mesmo assim, com o mesmo
      // side/symbol que a propria frase acabou de descartar). Checagem
      // deliberadamente simples e conservadora (palavra-chave, nao NLP): so
      // bloqueia quando ha uma negacao explicita de ABRIR/ENTRAR sem nenhuma
      // reversao depois dela no mesmo texto -- prefere falso negativo (deixa
      // passar reasoning ambiguo) a falso positivo (bloquear entrada valida
      // por uma palavra solta).
      const NEGATION_CUES = [
        "nao abrir", "não abrir", "nao entrar", "não entrar", "nao devo abrir", "não devo abrir",
        "nao deveria abrir", "não deveria abrir", "evitar essa entrada", "evitar esta entrada",
        "fico de fora", "ficar de fora", "por enquanto fora", "operacao bloqueada", "operação bloqueada",
        "sem nova evidencia", "sem nova evidência", "preciso analisar mais antes de abrir",
      ];
      const REVERSAL_CUES = [
        "mas agora", "porem agora", "porém agora", "mudei de ideia", "reconsiderando", "na verdade vou abrir",
      ];
      const reasoningLower = reasoning.toLowerCase();
      const hasNegation = NEGATION_CUES.some((cue) => reasoningLower.includes(cue));
      const hasReversal = REVERSAL_CUES.some((cue) => reasoningLower.includes(cue));
      if (hasNegation && !hasReversal) {
        return {
          error:
            `Contradicao detectada: o proprio reasoning enviado contem uma negacao explicita de abrir/entrar ` +
            `("${NEGATION_CUES.find((cue) => reasoningLower.includes(cue))}"), mas voce chamou open_position mesmo assim. ` +
            `Posicao NAO aberta. Se realmente mudou de ideia DEPOIS de escrever isso, reescreva o reasoning deixando claro ` +
            `o motivo da mudanca (ex: "mudei de ideia: ...") e chame open_position de novo.`,
        };
      }
      // 🔴 2026-08-29 (achado do Cleber): sem alvo de saida definido, o
      // agente nunca fechava nada -- so empilhava posicoes quase-duplicadas
      // no mesmo simbolo, as vezes ao MESMO preco de entrada (visto no log
      // real: 8 posicoes SHORT em BTCUSD a 77658.82). Teto por simbolo forca
      // o agente a avaliar fechar posicoes existentes antes de abrir mais.
      //
      // 🔴 2026-08-30 (redesenho pos -$135 liquido -- pendencia de politica
      // de risco #1 do handoff anterior, resolvida): 3 -> 1. Empilhar ate 3
      // posicoes no MESMO simbolo+lado foi observado ao vivo (ex: 2x BTCXBN
      // LONG simultaneas) sem nenhum ganho real de informacao -- e so
      // "dobrar na mesma aposta" com dinheiro extra, exatamente o padrao que
      // o circuito de perda consecutiva (abaixo) tenta impedir depois do
      // fato. Uma posicao por simbolo de cada vez forca o agente a fechar
      // (ganhando ou perdendo) antes de reentrar, nunca empilhar.
      const MAX_POSITIONS_PER_SYMBOL = 1;
      let openPositions;
      try {
        openPositions = await listMt5OpenPositions();
      } catch (err) {
        // Falha fechada: sem confirmar o estado real, nao abre -- ver
        // comentario em neuralBridge.ts/listMt5OpenPositions sobre o furo
        // que isso corrigia (teto furado por erro transitorio virando "0").
        return { error: `Nao foi possivel confirmar quantas posicoes ja existem em ${symbol} (falha de rede/Supabase: ${err instanceof Error ? err.message : err}). Posicao NAO aberta -- tente de novo.` };
      }
      // 🔴 2026-08-30 (pendencia de politica de risco #2 do handoff anterior,
      // resolvida): guard contra posicoes OPOSTAS simultaneas no mesmo
      // simbolo. Confirmado ao vivo na sessao anterior: SOLUSD LONG e SOLUSD
      // SHORT abertas ao mesmo tempo por ~1min11s (entry_time 07:11:26 e
      // 07:12:02 UTC, ambas fechadas com prejuizo) -- paga spread 2x nas duas
      // pernas sem chance nenhuma de lucro liquido em qualquer direcao. O
      // teto por simbolo (abaixo) nao pegava isso porque MAX_POSITIONS_PER_SYMBOL
      // media o total independente do lado.
      const oppositeOpen = openPositions.find((p) => p.symbol === symbol && p.side !== side);
      if (oppositeOpen) {
        return {
          error:
            `Ja existe uma posicao ${oppositeOpen.side} aberta em ${symbol} -- abrir ${side} agora criaria posicoes ` +
            `opostas simultaneas no mesmo simbolo, pagando spread 2x sem chance real de lucro liquido em nenhuma ` +
            `direcao. Feche a posicao ${oppositeOpen.side} existente (close_position) antes de abrir ${side}.`,
        };
      }
      const openInSymbol = openPositions.filter((p) => p.symbol === symbol).length;
      if (openInSymbol >= MAX_POSITIONS_PER_SYMBOL) {
        return {
          error: `Ja existe ${openInSymbol} posicao aberta em ${symbol} (teto: ${MAX_POSITIONS_PER_SYMBOL}). Feche com close_position antes de abrir outra neste simbolo.`,
        };
      }
      // 🔴 2026-08-29 (otimizacao urgente pos-perda do dia): teto de exposicao
      // do GRUPO CORRELACIONADO inteiro no mesmo lado -- ver getCorrelatedGroup
      // (assetBasket.ts) e mt5MaxCorrelatedNotionalUsd (config.ts). Achado
      // real: o teto por simbolo sozinho deixou passar SHORT simultaneo em
      // BTCUSD+XETUSD+SOLUSD (cripto correlacionada) durante um rali que
      // pegou os 3 juntos -- isso e UMA aposta direcional triplicada, nao 3
      // independentes.
      const correlatedGroup = getCorrelatedGroup(symbol);
      if (correlatedGroup.length > 1) {
        const sameSideGroupExposure = openPositions
          .filter((p) => correlatedGroup.includes(p.symbol) && p.side === side)
          .reduce((sum, p) => sum + Number(p.quantity), 0);
        if (sameSideGroupExposure >= config.mt5MaxCorrelatedNotionalUsd) {
          return {
            error:
              `Exposicao ${side} combinada no grupo correlacionado (${correlatedGroup.join("/")}) ja e $${sameSideGroupExposure.toFixed(0)} ` +
              `(teto: $${config.mt5MaxCorrelatedNotionalUsd}). Esses ativos andam juntos -- empilhar mais ${side} em qualquer um deles ` +
              `e triplicar a MESMA aposta, nao diversificar. Feche alguma posicao do grupo ou opere o lado oposto.`,
          };
        }
      }
      // 🔴 2026-08-29 (otimizacao urgente pos-perda do dia): circuito de
      // perda consecutiva -- ver mt5LossStreakThreshold/mt5LossStreakCooldownMinutes
      // (config.ts). Achado real: o agente reabriu SHORT em cripto que ja
      // tinha acabado de bater stop no MESMO lado, minutos depois, repetidas
      // vezes, contra uma tendencia que ja tinha virado -- sem nada que o
      // fizesse parar e reavaliar a tese antes de reentrar igual.
      //
      // 🔴 2026-08-30 (achado real, sessao de monitoramento): a checagem so
      // contava exit_reason==="SL" -- perda fechada manualmente pelo LLM
      // (AI_SIGNAL) nao contava pra streak, furando o proprio proposito do
      // circuito. Confirmado ao vivo: SOLUSD SHORT perdeu 2x seguidas por
      // decisao manual (~-$6 e ~-$3, ambos AI_SIGNAL), cooldown nunca
      // disparou, e a 3a reentrada no MESMO simbolo+lado bateu stop de
      // verdade por -$7,12 -- maior perda da sessao ate entao. Agora conta
      // QUALQUER fechamento com resultado negativo (SL ou AI_SIGNAL), nao so
      // stop mecanico.
      try {
        const recentClosed = await getRecentClosedTrades(symbol, config.mt5LossStreakThreshold);
        const cooldownMs = config.mt5LossStreakCooldownMinutes * 60 * 1000;
        const isLoss = (t: Awaited<ReturnType<typeof getRecentClosedTrades>>[number]) => {
          const result = t.net_pnl ?? t.pnl;
          return t.exit_reason === "SL" || (result != null && result < 0);
        };
        const sameSideStreak =
          recentClosed.length >= config.mt5LossStreakThreshold &&
          recentClosed.every(
            (t) => t.side === side && isLoss(t) && Date.now() - new Date(t.exit_time).getTime() < cooldownMs
          );
        if (sameSideStreak) {
          return {
            error:
              `${symbol} perdeu ${config.mt5LossStreakThreshold}x seguidas no lado ${side} nos ultimos ${config.mt5LossStreakCooldownMinutes} minutos (stop mecanico ou fechamento manual negativo). ` +
              `Entrada ${side} neste simbolo em cooldown ate a tese ficar clara de novo -- opere outro ativo, ` +
              `avalie o lado oposto (com convicção real, nao so pra "tentar de novo"), ou aguarde o cooldown passar.`,
          };
        }
      } catch (err) {
        return { error: `Nao foi possivel confirmar o historico recente de ${symbol} (falha de rede/Supabase: ${err instanceof Error ? err.message : err}). Posicao NAO aberta -- tente de novo.` };
      }
      const quote = await getMt5Quote(symbol);
      if (!quote) return { error: `Sem cotacao real disponivel agora para ${symbol} -- posicao nao aberta.` };
      // 🔴 2026-08-30 (investigacao de feed travado): NUNCA abrir posicao em
      // cima de tick REAL porem MORTO. Medido ao vivo: XPTUSD (platina)
      // devolvia bid/ask com timestamp de ~30h antes -- mercado fechado no
      // fim de semana -- e passava direto por `isSymbolTradable`, que so tem
      // calendario de FOREX (assetBasket.ts). Guard generico por idade do
      // tick cobre qualquer simbolo/feriado/parada de feed sem precisar
      // manter calendario por instrumento.
      if (quote.stale) {
        return {
          error:
            `Cotacao de ${symbol} esta OBSOLETA: o ultimo tick real da corretora tem ${quote.tickAgeSeconds}s de idade ` +
            `(preco ${quote.price}). Mercado provavelmente fechado ou feed parado -- abrir aqui seria operar um preco morto, ` +
            `sem saber onde o mercado realmente esta. Posicao NAO aberta. Opere um ativo com tick vivo.`,
        };
      }
      // 🔴 2026-08-30: teto de spread -- ver SPREAD_BLOCK_PCT acima pra
      // medicao real da cesta que sustenta o numero.
      if (Number.isFinite(quote.spreadPct) && quote.spreadPct > SPREAD_BLOCK_PCT) {
        return {
          error:
            `Spread de ${symbol} esta em ${quote.spreadPct.toFixed(2)}% (bid ${quote.bid} / ask ${quote.ask}), acima do teto de ${SPREAD_BLOCK_PCT}%. ` +
            `Esse e o custo REAL de operar esse ativo agora: a posicao nasceria ~${quote.spreadPct.toFixed(2)}% negativa e precisaria de um movimento ` +
            `maior que isso so pra empatar -- o stop mecanico dispararia bem antes. Posicao NAO aberta. Opere um ativo com spread normal ` +
            `(cesta tipica: 0,02%-1,5%).`,
        };
      }
      // 🔴 2026-08-29 (pedido do Cleber, "as entradas nao estao contemplando
      // o spread"): preco de PREENCHIMENTO real -- LONG compra no ask, SHORT
      // vende no bid (nunca no mid/last, que escondia o custo de operar).
      // Usado como entry_price gravado no trade -- a partir dele, o PnL
      // flutuante (list_open_positions) e o fechamento (enforceMt5Stops...)
      // ja nascem descontando o spread automaticamente.
      const fillPrice = side === "LONG" ? quote.ask : quote.bid;
      // 🔴 2026-08-29 (otimizacao pos-conversa sobre Rotter/Pulcini/Antunes):
      // os 3 sao scalpers de order flow -- este sistema nao tem book de
      // ofertas, entao nao da pra imitar a tecnica de verdade. O que da pra
      // aproveitar de forma honesta (dado real, tickVolume da MetaAPI, nao
      // fabricado) e a mesma ideia por tras dela: um movimento contra a
      // tendencia recente SEM volume acima do normal e uma entrada de baixa
      // conviccao -- exatamente o padrao (SHORT repetido durante um rali,
      // sem nenhuma leitura de forca/fraqueza) que gerou o prejuizo de
      // 2026-08-29. Bloqueia so a combinacao contra-tendencia + volume fraco;
      // a favor da tendencia (ou lateral, ou volume elevado mesmo contra)
      // continua liberado -- nao e proibir contrarian trade (Kotegawa fez
      // fortuna com isso), e proibir contrarian trade SEM confirmacao.
      const [trend, volume] = await Promise.all([getTrendInfo(symbol), getVolumeConfirmation(symbol)]);
      if (trend && trend.label !== "LATERAL" && volume) {
        const counterTrend = (trend.label === "ALTA" && side === "SHORT") || (trend.label === "BAIXA" && side === "LONG");
        if (counterTrend && !volume.elevated) {
          return {
            error:
              `${symbol} esta em tendencia de ${trend.label} na ultima ${trend.lookbackMinutes}min (${trend.changePct > 0 ? "+" : ""}${trend.changePct}%) ` +
              `e o volume recente NAO esta acima do normal (razao ${volume.ratio}x) -- ${side} aqui seria ir contra o movimento sem confirmacao real de forca por tras dele. ` +
              `Posicao NAO aberta. Espere volume elevado confirmando reversao, opere a favor da tendencia, ou avalie outro ativo.`,
          };
        }
      }
      // 🔴 2026-08-29 (achado da auditoria): confirmado ao vivo 7 posicoes
      // BTCUSD SHORT abertas no MESMO preco exato (77658.82) ao longo de 12
      // minutos -- estatisticamente improvavel pra um ativo que nunca fica
      // parado, indicio de cotacao obsoleta vinda da propria MetaAPI (o
      // feed ja teve quedas confirmadas na mesma madrugada). O LLM nao tem
      // como perceber isso sozinho (so ve o preco que a ferramenta devolve),
      // entao a trava e aqui: nunca abre uma posicao identica (mesmo
      // simbolo+lado+preco ao centavo) a uma ja aberta -- nao importa a
      // causa, duplicar nao agrega informacao nova, so duplica risco.
      const duplicatePrice = openPositions.find((p) => p.symbol === symbol && p.side === side && p.entry_price === fillPrice);
      if (duplicatePrice) {
        return {
          error:
            `Ja existe uma posicao aberta em ${symbol} ${side} no MESMO preco exato (${fillPrice}) -- ` +
            `provavel cotacao obsoleta (feed pode estar travado). Posicao NAO aberta. Tente de novo em instantes ou avalie outro ativo.`,
        };
      }
      // 🔴 2026-08-29 (achado da auditoria, redesenhado no mesmo dia a
      // pedido do Cleber): LOT_SIZE=1 pros 3 criptos faz a exposicao em
      // dolar escalar direto com o preco do ativo -- BTCUSD (~$77.600) gera
      // dezenas de vezes mais exposicao que SOL/XET pro MESMO numero de
      // lotes. Antes isso so tinha um TETO uniforme (deixava SOL/XET presos
      // perto do minimo, sem forcar pra cima) -- agora o lote e CALCULADO
      // pelo codigo a partir de uma exposicao-ALVO uniforme
      // (mt5TargetNotionalUsd), nao escolhido livremente pelo LLM. SOL/XET
      // passam a abrir MUITO mais lotes que antes pra alcancar a MESMA
      // exposicao em $ que o BTC -- resolve o achado "SOL/XET capturam
      // pouco $" na raiz (exposicao, nao so pontos de saida).
      const targetNotional = config.mt5TargetNotionalUsd * (sizeInput === "forte" ? config.mt5HeavyMultiplier : 1);
      let lots = targetNotional / (LOT_SIZE[symbol] * quote.price);
      lots = Math.max(MIN_LOTS, Math.min(lots, config.mt5SafetyMaxLots));
      lots = Math.round(lots / MIN_LOTS) * MIN_LOTS; // arredonda pro incremento minimo real da plataforma
      let amountUsd = lots * LOT_SIZE[symbol] * quote.price;
      // Teto absoluto de seguranca -- so deveria disparar em caso degenerado
      // (preco anormal), o calculo acima ja mira dentro do alvo normalmente.
      if (amountUsd > config.mt5MaxNotionalUsd) {
        lots = Math.floor(config.mt5MaxNotionalUsd / (LOT_SIZE[symbol] * quote.price) / MIN_LOTS) * MIN_LOTS;
        if (lots < MIN_LOTS) {
          return {
            error: `Exposicao minima possivel para ${symbol} neste preco excede o teto absoluto de seguranca ($${config.mt5MaxNotionalUsd}). Posicao NAO aberta.`,
          };
        }
        amountUsd = lots * LOT_SIZE[symbol] * quote.price;
      }
      // 🔴 2026-08-29 (achado da auditoria): antes o "stop"/"alvo" so existia
      // como texto no prompt (GENESIS_PROMPT_MT5) -- o LLM decidia a cada
      // ciclo se fechava, e por 2x deixou a perda correr MUITO alem do alvo
      // declarado (0.5%) antes de agir (uma vez ate -3.5%/-$5,96). Agora o
      // preco de stop/alvo e calculado e GRAVADO no trade na abertura --
      // enforceMt5StopsAndTargets (neuralBridge.ts) fecha sozinho por codigo
      // a cada ciclo, antes do LLM decidir qualquer coisa, sem depender do
      // modelo perceber ou lembrar.
      //
      // 🔴 2026-08-29 (pedido do Cleber, mesma sessao): stop/alvo agora e
      // DINAMICO por volatilidade real (ATR, ver atr.ts) em vez de % fixo
      // igual pros 3 simbolos. Cai pro % fixo de seguranca
      // (mt5StopFallbackPct) so se o ATR nao vier de dado real (candle
      // simulado/indisponivel) -- nunca abre posicao sem stop.
      let stopPct = await getAtrPercent(symbol).then((atrPct) => {
        if (atrPct == null) return null;
        const dynamicStopPct = atrPct * config.mt5StopAtrMultiplier;
        if (dynamicStopPct < config.mt5StopMinPct || dynamicStopPct > config.mt5StopMaxPct) return null;
        return dynamicStopPct;
      });
      let usedFallbackStop = stopPct == null;
      if (stopPct == null) stopPct = config.mt5StopFallbackPct;
      // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, primeiros 3 trades
      // reais depois do redesenho R:R 1:2 -- ver mt5SpreadStopSafetyMultiplier
      // em config.ts pro detalhe completo): 2 de 3 trades (XRPUSD LONG)
      // bateram stop em 64s/14s por o stop (0,500%) ser MENOR que o spread
      // (~1,47%) -- a posicao ja nascia derrotada, sem nenhum movimento real
      // de preco. Aqui o stop e alargado (nunca encolhido) pra sempre ficar
      // pelo menos mt5SpreadStopSafetyMultiplier vezes o spread pago; se nem
      // o teto maximo (mt5StopMaxPct) alcanca essa margem, bloqueia a
      // entrada em vez de abrir com stop artificialmente apertado.
      const spreadPctFrac = Number.isFinite(quote.spreadPct) ? quote.spreadPct / 100 : 0;
      const minStopForSpread = spreadPctFrac * config.mt5SpreadStopSafetyMultiplier;
      let widenedForSpread = false;
      if (minStopForSpread > stopPct) {
        if (minStopForSpread > config.mt5StopMaxPct) {
          return {
            error:
              `Spread de ${symbol} (${quote.spreadPct.toFixed(2)}%) e alto demais pro stop ficar com margem real ` +
              `(precisaria de ${(minStopForSpread * 100).toFixed(2)}%, acima do teto maximo de ${(config.mt5StopMaxPct * 100).toFixed(2)}%) -- ` +
              `a posicao nasceria com o stop mais perto do preco de entrada do que o proprio custo de operar, disparando quase sem ` +
              `movimento real. Posicao NAO aberta. Opere um ativo com spread menor ou aguarde o spread normalizar.`,
          };
        }
        stopPct = minStopForSpread;
        widenedForSpread = true;
        usedFallbackStop = true;
      }
      // 🔴 2026-08-30 (achado real, confirmado NO PRIMEIRO trade real depois
      // do redesenho R:R 1:2 -- BTCUSD LONG, ciclo 2 da sessao reiniciada):
      // quando o ATR real nao vem (usedFallbackStop=true), a linha antiga
      // jogava takeProfitPct = mt5StopFallbackPct DIRETO, ignorando por
      // completo o multiplicador de R:R -- colapsava pra R:R 1:1 mesmo
      // sozinho, e SOMADO ao encolhimento de baixo volume (removido abaixo)
      // o alvo saiu MENOR que o stop (0,300% de alvo contra 0,500% de risco,
      // R:R 0,6:1 -- pior que aleatorio, o oposto do redesenho). Agora o
      // fallback tambem respeita o MESMO multiplicador R:R do caminho
      // dinamico -- nunca colapsa pra 1:1 por acidente so por falta de ATR.
      let takeProfitPct = stopPct * (config.mt5TakeProfitAtrMultiplier / config.mt5StopAtrMultiplier);
      // 🔴 2026-08-30 (mesmo achado, mesmo redesenho): o encolhimento extra de
      // alvo em dia de baixo volume (0,6x) foi REMOVIDO -- existia
      // especificamente pra servir a filosofia "giro rapido, alvo curto"
      // (2026-08-29), que a sessao real mostrou nunca alcancar o alvo (0 de
      // 66 trades bateram take-profit). Encolher o alvo ainda mais nessas
      // condicoes so pioraria o MESMO problema que o redesenho tenta
      // resolver -- o risco (stop) ja e o mesmo independente do volume, e o
      // R:R 1:2 ja da margem suficiente sem precisar de um ajuste extra.
      const lowVolumeAdjusted = false;

      // 🔴 2026-08-29: stop/alvo calculados a partir do fillPrice (preco real
      // de preenchimento, ver acima) -- nao do mid/last tick.
      const stopLoss = side === "LONG" ? fillPrice * (1 - stopPct) : fillPrice * (1 + stopPct);
      const takeProfit = side === "LONG" ? fillPrice * (1 + takeProfitPct) : fillPrice * (1 - takeProfitPct);
      const tradeId = await openMt5Position({
        symbol,
        side: side as "LONG" | "SHORT",
        entryPrice: fillPrice,
        amountUsd,
        stopLoss,
        takeProfit,
        reasoning,
        symbolsForNewSession: MT5_ASSET_BASKET,
      });
      if (!tradeId) return { error: "Falha ao gravar a posicao (ver log do processo)." };
      return {
        trade_id: tradeId,
        symbol,
        side,
        size: sizeInput,
        entry_price: fillPrice,
        spread_pago: Number(Math.abs(quote.ask - quote.bid).toFixed(6)),
        lots,
        amount_usd: amountUsd,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        stop_dinamico: !usedFallbackStop,
        stop_pct: (stopPct * 100).toFixed(3) + "%",
        take_profit_pct: (takeProfitPct * 100).toFixed(3) + "%",
        alvo_encolhido_por_baixo_volume: lowVolumeAdjusted,
        stop_alargado_por_spread: widenedForSpread,
        aviso:
          "stop_loss/take_profit acima sao MECANICOS -- o codigo fecha sozinho quando baterem, voce nao precisa (nem deve tentar) fechar antes por conta propria a nao ser que a tese tenha mudado." +
          (widenedForSpread
            ? ` ATENCAO: o stop foi ALARGADO automaticamente pra ${(stopPct * 100).toFixed(3)}% (em vez do normal) porque o spread deste ativo (${quote.spreadPct.toFixed(2)}%) e alto -- um stop mais apertado bateria so pelo custo de operar, sem nenhum movimento real de preco.`
            : ""),
      };
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
      // 🔴 2026-08-29: fechar um LONG e VENDER (recebe o bid); fechar um
      // SHORT e COMPRAR de volta (paga o ask) -- nao o mid/last tick.
      const exitPrice = position.side === "LONG" ? quote.bid : quote.ask;
      const closed = await closeMt5Position({ tradeId, exitPrice, reasoning });
      if (!closed) return { error: "Falha ao fechar a posicao (ver log do processo)." };
      return { trade_id: tradeId, exit_price: exitPrice };
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
