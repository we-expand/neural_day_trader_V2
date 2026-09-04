import { parseEther } from "viem";
import type { OpenAI } from "openai";
import { account, publicClient, walletClient, getBalanceEth } from "./wallet.js";
import { config } from "./config.js";
import { applyEconomyChange, getBalanceUsd } from "./economy.js";
import { getAccount, getQuote as getBinanceQuote, placeMarketOrder } from "./broker.js";
import { mirrorBuy, mirrorSell, openMt5Position, closeMt5Position, increaseMt5Position, listMt5OpenPositions, getRecentClosedTrades, getMt5AccountBalance, getTodayRealizedPnl, enforceMt5StopsAndTargets, type UserTradingConfig } from "./neuralBridge.js";
import { getQuote as getMt5Quote } from "./mt5Broker.js";
import { getAtrPercent, getTrendInfo, getVolumeConfirmation, getSupportResistance, getMacd, getSlowStochastic, getCandlePatterns, getMarketRegime } from "./atr.js";
import { getPriceExtension, getLastKnownPrice } from "./tickHistory.js";
import { MT5_ASSET_BASKET, LOT_SIZE, MIN_LOTS, isSymbolTradable, getCorrelatedGroup } from "./assetBasket.js";
import { checkReasoningConsistency } from "./reasoningValidator.js";

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
// 🔴 2026-08-31 (teste): afrouxado pra 5.0 pra permitir entradas em spreads normais de fim de semana
export const SPREAD_BLOCK_PCT = 5.0;
export const SPREAD_WARN_PCT = 2.0;

// 🔴 2026-09-02 (pedido do Cleber -- agente de risco interno, "perder pouco,
// ganhar muito" dentro da mesma taxa de acerto): teto de quantas vezes UMA
// posição pode ser ampliada (pyramiding) via increase_position. Cada add já
// exige lucro real + confluência ainda válida (ver case increase_position),
// mas o teto aqui é a última linha de defesa contra compounding descontrolado
// sobre um único símbolo -- 2 adds no máximo (posição original + 2 reforços).
export const MAX_PYRAMID_ADDS = 2;

// 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, root cause confirmado
// rastreando o log ciclo a ciclo, pedido explicito do Cleber -- "perdeu
// $2,49 a toa"): a IA fechou uma posicao LONG lucrativa em BTCUSD citando
// "resistencia de 2471.26, volume ratio 0.4" -- numeros REAIS, mas do
// XETUSD (cotado 2 chamadas antes, apos um open_position em XETUSD ser
// bloqueado pela guarda de contradicao acima). Ela NUNCA chamou
// get_mt5_quote(BTCUSD) naquele ciclo antes de decidir fechar -- decidiu
// com dado de 2 ciclos atras (ou de outro simbolo). Mecanismo: quando uma
// tentativa de abrir e bloqueada, o mesmo impulso as vezes "migra" pra
// fechar uma posicao aberta usando o raciocinio/numeros que acabaram de
// ser escritos pro simbolo errado. Fix: exige get_mt5_quote do MESMO
// simbolo no MESMO ciclo antes de aceitar um close_position manual nele --
// forca a decisao a se basear em dado fresco e do ativo certo, nao em
// memoria stale ou contaminacao cruzada entre simbolos.
// 🔴 2026-08-31 (Fase 2 multi-tenant): estes 3 caches eram globais por
// simbolo -- corretos so quando o processo tinha 1 sessao. Agora cada um vira
// um mapa aninhado por `sessionId`, pra uma sessao nunca ler/contaminar o
// estado de outra rodando no mesmo processo.
function perSession<K, V>(store: Map<string, Map<K, V>>, sessionId: string): Map<K, V> {
  let inner = store.get(sessionId);
  if (!inner) {
    inner = new Map<K, V>();
    store.set(sessionId, inner);
  }
  return inner;
}

const lastQuotedCycleBySymbolStore = new Map<string, Map<string, number>>();

// 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, pedido do Cleber apos
// BTCUSD SHORT perder $5,58): o guard de "cotacao fresca no mesmo ciclo"
// acima so garante que o agente CHAMOU get_mt5_quote antes de decidir --
// nao garante que o reasoning escrito reflete o que aquela chamada
// devolveu. Confirmado no log (linha do open_position BTCUSD SHORT,
// 2026-08-30 15:58 UTC): o get_mt5_quote imediatamente anterior devolveu
// trend.label="LATERAL" e volume.elevated=false, mas o reasoning da
// entrada afirmou "trend currently LOW, volume elevated" -- fatos
// inventados que contradizem o proprio dado real recem-recebido (BTCUSD
// estava de fato em ALTA persistente nos ciclos vizinhos; o SHORT foi
// contra a tendencia real). O validador semantico (reasoningValidator.ts)
// so checa autocontradicao (reasoning vs a propria acao), nunca checou
// reasoning vs o dado real que o motivou -- por isso nao pegou. Cache aqui
// guarda o ultimo snapshot renderizado por get_mt5_quote por simbolo, pra
// alimentar o validador com o dado real e ele comparar contra o texto.
const lastQuoteSnapshotBySymbolStore = new Map<
  string,
  Map<
    string,
    {
      trendLabel: string | null;
      volumeElevated: boolean | null;
      macdLabel: string | null;
      stochasticLabel: string | null;
      // 🔴 2026-09-02: regime (sessão/volume/volatilidade) do momento da
      // cotação -- reaproveitado na abertura pra gravar junto do trade (ver
      // openMt5Position em neuralBridge.ts), permitindo validar depois se
      // esse contexto ajudou. null quando regime não estava disponível.
      session: string | null;
      volumeLabel: string | null;
      volatilityLabel: string | null;
    }
  >
>();

// 🔴 2026-08-30 (pedido do Cleber, "não podemos ter teses fracas" -- 3
// ocorrencias reais na mesma sessao: BTCUSD LONG fechado com +$1,39
// flutuante, depois de novo a -$2,49 usando dado do XETUSD, depois de novo
// a -$0,47 quase no zero a zero -- todas pra abrir o lado OPOSTO no mesmo
// simbolo). Quando open_position e bloqueado por ja existir posicao oposta
// no simbolo, o mesmo impulso de inverter direcao as vezes vira um
// close_position na posicao existente com tese fraca (PnL perto de zero,
// nem perto do stop nem do alvo) so pra abrir espaco pro lado novo. Fix:
// se esse simbolo teve uma tentativa de inversao bloqueada NESTE ciclo, o
// fechamento so e aceito se a posicao ja consumiu pelo menos metade da
// distancia ate o stop (tese realmente enfraquecendo) OU ja capturou
// metade da distancia ate o alvo (ja realizou boa parte do lucro) -- barra
// especificamente a zona "mal se moveu" onde o motivo real e "quero
// apostar no lado contrario", nao "a tese morreu".
const flipAttemptBlockedThisCycleStore = new Map<string, Map<string, number>>();
const MIN_STOP_OR_TARGET_CONSUMED_PCT_FOR_FLIP_CLOSE = 0.5;

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
        `Tambem devolve "supportResistance" (maxima/minima reais da janela ESTABELECIDA de candle de 5m, ~2,5h ` +
        `excluindo as 2 velas mais recentes, distancia % pra cada nivel -- pode ser NEGATIVA, rompimento real -- ` +
        `"brokeAboveResistance"/"brokeBelowSupport" true quando o rompimento ja esta em andamento AGORA, e ` +
        `"nearLevel" RESISTENCIA/SUPORTE/null quando o preco esta a menos de 0,15% de um deles sem ainda ter ` +
        `rompido) -- topo/fundo recente de verdade, calculado do mesmo candle oficial de "trend", null quando ` +
        `candle nao disponivel. Rompimento confirmado (brokeAboveResistance/brokeBelowSupport) merece atencao ` +
        `redobrada mesmo com pouco volume -- todo rompimento pode ser inicio de movimento grande, nao descarte so ` +
        `por falta de volume. ` +
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
        `O codigo dimensiona cada entrada por % DE RISCO DO SALDO REAL da conta (nao um valor fixo em dolar) -- ` +
        `"normal" arrisca ~${(config.mt5RiskPctPerTrade * 100).toFixed(1)}% do saldo se o stop bater, "forte" arrisca ` +
        `${(config.mt5RiskPctPerTrade * config.mt5HeavyMultiplier * 100).toFixed(1)}%. Numa conta pequena isso pode fazer o codigo RECUSAR ` +
        `a entrada (erro explicito) se o lote minimo do ativo ja forcar risco acima do teto tolerado -- isso e intencional, nao um bug. ` +
        `A cesta (${MT5_ASSET_BASKET.join("/")}) mistura cripto, forex, metal, energia e indices -- simbolos do MESMO grupo ` +
        `correlacionado (ex: as 10 criptos entre si, ou os 4 indices globais entre si) tem exposicao combinada do MESMO lado ` +
        `com teto proprio (nao e so por simbolo, ver get_mt5_quote/log de erro pra saber o grupo de um simbolo especifico). ` +
        `Reentrar no mesmo simbolo+lado logo depois de bater stop 2x seguidas fica bloqueado por um tempo (cooldown). ` +
        `Entrar CONTRA a tendencia recente (ver "trend" em get_mt5_quote) SEM volume acima do normal E SEM Estocastico em ` +
        `extremo (SOBRECOMPRADO pra SHORT, SOBREVENDIDO pra LONG, ver "stochastic") tambem e bloqueado -- ` +
        `contrarian trade e permitido, mas so com confirmacao real (volume de participacao OU exaustao real de curto prazo), nao no vacuo. ` +
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
              `"normal" = arrisca ~${(config.mt5RiskPctPerTrade * 100).toFixed(1)}% do saldo real da conta se o stop bater. ` +
              `"forte" = ${config.mt5HeavyMultiplier}x esse risco -- use quando a conviccao no sinal for mais alta, ` +
              `nao como padrao pra tudo.`,
          },
          reasoning: { type: "string", description: "Por que esta entrada faz sentido agora." },
          confidence: {
            type: "number",
            description:
              "Sua confianca de 0 a 100 nesta entrada especifica, dado o que get_mt5_quote mostrou (trend/volume/MACD/" +
              "estocastico/spread/padroes de candle) e o reasoning acima -- nao e um numero mecanico, e o seu julgamento " +
              "de o quanto os fatores reais convergem a favor desta tese. So pra registro/auditoria, nao afeta o tamanho " +
              "calculado pelo codigo (isso e o campo 'size').",
          },
        },
        required: ["symbol", "side", "size", "reasoning", "confidence"],
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
  {
    type: "function",
    function: {
      name: "increase_position",
      description:
        `AMPLIA (pyramiding) uma posicao SUA que ja esta ganhando de verdade -- "deixar o lucro correr" com o stop ` +
        `subindo atras do preco pra travar o ganho, em vez de so esperar parado o alvo original. NAO e pra recuperar ` +
        `posicao perdedora nem pra "dobrar a aposta" -- so funciona com lucro real ja capturado (acima do custo do ` +
        `spread) E pelo menos 1 fator tecnico real (tendencia/MACD/Estocastico/padrao de candle) ainda alinhado com o ` +
        `lado da posicao (sinal ainda nao esgotado). O codigo dimensiona o reforco pela MESMA formula de risco de ` +
        `open_position (nunca maior que o risco da entrada original) e MOVE O STOP pra breakeven-ou-melhor no mesmo ` +
        `movimento -- o lote original nunca fica exposto de novo por causa do reforco. Maximo de ${MAX_PYRAMID_ADDS} ` +
        `reforcos por posicao. Bloqueado se a posicao nao estiver em lucro real, se faltar confluencia, ou se o teto ` +
        `de adds/exposicao do grupo correlacionado ja tiver sido atingido.`,
      parameters: {
        type: "object",
        properties: {
          trade_id: { type: "string", description: "Id da posicao vencedora a ampliar." },
          reasoning: { type: "string", description: "Por que o movimento a favor e real e vale reforcar agora (cite os fatores tecnicos ainda alinhados)." },
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

export interface ExecuteToolSession {
  sessionId: string;
  userId: string;
  userConfig?: UserTradingConfig;
  status: "RUNNING" | "STOPPED";
}

/** Cesta efetiva desta sessao: intersecao com `activeAssets` do Setup do usuario, ou a cesta inteira se ele nao filtrou nada. */
function effectiveBasket(session: ExecuteToolSession): string[] {
  return session.userConfig?.activeAssets ?? MT5_ASSET_BASKET;
}

export async function executeTool(name: string, input: Record<string, unknown>, cycle: number, session: ExecuteToolSession) {
  const lastQuotedCycleBySymbol = perSession(lastQuotedCycleBySymbolStore, session.sessionId);
  const lastQuoteSnapshotBySymbol = perSession(lastQuoteSnapshotBySymbolStore, session.sessionId);
  const flipAttemptBlockedThisCycle = perSession(flipAttemptBlockedThisCycleStore, session.sessionId);
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
      const basket = effectiveBasket(session);
      if (!basket.includes(symbol)) {
        return { error: `Simbolo fora da cesta permitida. Cesta: ${basket.join(", ")}.` };
      }
      // 🔴 2026-08-31 (fix de paralisia por dados incompletos): antes, um
      // getMt5Quote falhado retornava erro pro agente, travando a sessão.
      // Se falhar, devolve um quote VÁLIDO mas com trend/volume/etc = null
      // (agente entende "dados indisponíveis" como "ok, trabalho com o que
      // tenho"). Garante que o agente NUNCA fica preso esperando por um
      // endpoint que está fora/lento/rate-limited -- pode tentar entrar
      // mesmo com dados parciais, o stop mecânico protege o pior caso.
      //
      // 🔴 2026-09-01 (achado real, monitoramento ao vivo): esta camada tinha
      // MAIS 2 retries por cima dos 3 que `mt5Broker.getQuote` já faz
      // internamente (8s de timeout cada) -- 5 tentativas empilhadas no
      // total. Confirmado ao vivo: um ciclo travou ~10min numa única
      // chamada de XAUUSD enquanto a MetaAPI compartilhada estava lenta
      // (endpoint /mt5-prices devolvendo HTTP 504 depois de ~20s por
      // tentativa -- risco crônico já documentado no CLAUDE.md). Removido o
      // retry duplicado: `getQuote` já é resiliente sozinho (3 tentativas),
      // sem essa camada extra o pior caso cai de ~5 tentativas pra 3 sem
      // perder proteção real contra falha transitória.
      const quote = await getMt5Quote(symbol);
      // Se não conseguiu, devolve fallback válido (não erro)
      if (!quote) {
        const lastPrice = getLastKnownPrice(symbol);
        console.warn(`[tools.ts] Cotação de ${symbol} indisponível depois de retry -- devolvendo fallback com preço ${lastPrice || "nenhum histórico"}`);
        return {
          symbol,
          // 🔴 2026-08-31: usa último preço conhecido do histórico (ou 1.0 como padrão honesto)
          // nunca usa 0, porque agente recusaria abrir com preço zero
          price: lastPrice ?? 1.0,
          bid: lastPrice ?? 1.0,
          ask: lastPrice ?? 1.0,
          changePercent: 0,
          spreadPct: NaN,
          tickAgeSeconds: null,
          stale: true,
          marketOpen: true,
          trend: null,
          volume: null,
          extension: null,
          supportResistance: null,
          macd: null,
          stochastic: null,
          candlePatterns: null,
          regime: null,
          aviso: `Cotacao de ${symbol} temporariamente indisponível (endpoint lento/rate-limited/off). Preço usado: ${lastPrice ? `último conhecido ($${lastPrice.toFixed(2)})` : "padrão $1.0 (sem histórico)"} -- você PODE tentar entrar mesmo assim (confie no stop mecanico para proteger), ou esperar o proximo ciclo pra dados reais.`
        };
      }
      lastQuotedCycleBySymbol.set(symbol, cycle);
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Timeframe
      // Operacional"): todos os indicadores derivados de candle (trend/
      // volume/S&R/MACD/estocastico/padroes) passam a calcular em cima do
      // timeframe escolhido pelo usuario, nao mais fixo em 5m -- ver
      // SUPPORTED_TIMEFRAMES/fetchRecentCandles em atr.ts. Default "5m"
      // preserva o comportamento de sessoes sem essa config.
      const timeframe = (session.userConfig?.timeframe ?? "5m") as import("./atr.js").SupportedTimeframe;
      // snapshot atualizado logo abaixo, depois de trend/volume/macd/stochastic serem calculados
      // 🔴 2026-08-29 (otimização urgente pós-perda do dia): contexto de
      // tendência de curto prazo (1h) vai junto da cotação -- achado real foi
      // o agente abrindo SHORT repetido em cripto bem no meio de um rali de
      // horas, decidindo só a partir do preço do instante, sem nenhuma noção
      // de "isso já está subindo há um tempo". null quando não dá pra
      // calcular com dado real -- nunca inventa tendência.
      const trend = await getTrendInfo(symbol, timeframe);
      // 🔴 2026-08-29: proxy honesto de participacao/forca por tras do
      // movimento (tickVolume real da MetaAPI, ver atr.ts) -- nao e order
      // flow/book de ofertas de verdade (o sistema nao tem esse dado), mas e
      // volume real, nao fabricado. null quando indisponivel.
      const volume = await getVolumeConfirmation(symbol, timeframe);
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
      const supportResistance = await getSupportResistance(symbol, timeframe);
      // 🔴 2026-08-30 (pedido do Cleber, XETUSD SHORT com tese fraca sem
      // checar MACD): MACD real, calculado em cima do MESMO candle oficial
      // que trend/volume/supportResistance já usam (ver atr.ts) -- antes
      // era impossível porque a corretora devolvia candle SIMULATED pra
      // esta cesta, corrigido numa sessão anterior. null quando não há
      // candle real suficiente, nunca fabrica indicador.
      const macd = await getMacd(symbol, timeframe);
      // 🔴 2026-08-30 (pedido do Cleber, junto do MACD -- "MACD e Estocastico
      // lento sao fundamentais"): Estocastico LENTO real (%K/%D classicos,
      // periodo 14, suavizacao 3+3), mesmo candle oficial que os outros
      // indicadores acima ja usam (ver atr.ts). Mede sobrecompra/sobrevenda
      // de curto prazo -- complementa o MACD (momentum de tendencia) com uma
      // leitura de exaustao classica. null quando nao ha candle real
      // suficiente, nunca fabrica indicador.
      const stochastic = await getSlowStochastic(symbol, timeframe);
      // 🔴 2026-08-30 (pedido do Cleber, "10 padroes de candle mais
      // famosos"): primeira vez que o LLM recebe a FORMA da vela (corpo vs
      // pavios), nao so o fechamento -- ver getCandlePatterns em atr.ts pra
      // detalhe dos 10 padroes e criterio geometrico de cada um.
      const candlePatterns = await getCandlePatterns(symbol, timeframe);
      // 🔴 2026-09-02 (pedido do Cleber): regime de mercado (sessão + volume
      // real + volatilidade real vs a própria história do símbolo) -- só
      // CONTEXTO adicional pro LLM julgar (ver GENESIS_PROMPT_MT5 em
      // agent.ts), nunca uma trava mecânica nova. null quando não há candle
      // real suficiente, mesma disciplina dos outros campos acima.
      const regime = await getMarketRegime(symbol, timeframe);
      lastQuoteSnapshotBySymbol.set(symbol, {
        trendLabel: trend?.label ?? null,
        volumeElevated: volume?.elevated ?? null,
        macdLabel: macd?.label ?? null,
        stochasticLabel: stochastic?.label ?? null,
        session: regime?.session ?? null,
        volumeLabel: regime?.volumeLabel ?? null,
        volatilityLabel: regime?.volatilityLabel ?? null,
      });
      if (!isSymbolTradable(symbol)) {
        return { ...quote, marketOpen: false, trend, volume, extension, supportResistance, macd, stochastic, candlePatterns, regime, aviso: "Mercado fechado (fim de semana) -- preco congelado, nao abrir posicao aqui." };
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
        macd,
        stochastic,
        candlePatterns,
        regime,
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
        positions = await listMt5OpenPositions(session.sessionId);
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
      // 🔴 2026-08-31 (pedido do Cleber, achado ao vivo: "Desligar IA" estava
      // orfanizando posição aberta em vez de só parar de abrir posição nova
      // -- comportamento esperado, igual ao motor mecânico antigo: parar
      // bloqueia SÓ entrada nova, posições já abertas seguem monitoradas
      // (breakeven/trailing/SL/TP) até fechar sozinhas). Session.status vem
      // de listEligibleMt5Sessions/resolveMt5Sessions -- 'STOPPED' é setado
      // pelo botão "Desligar IA" (stopSession em
      // AITradingPersistenceService.ts), sem encerrar a sessão nem fechar
      // nada à força.
      if (session.status === "STOPPED") {
        return {
          error: "IA desligada pelo usuário (Setup do AI Trader) -- nenhuma posição nova é aberta enquanto estiver assim. " +
            "Posições já abertas continuam sendo monitoradas normalmente até fechar por stop/alvo.",
        };
      }
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Cadencia
      // Agressiva"): o loop de ciclos e UM SO por processo, compartilhado
      // por todas as sessoes multi-tenant (serial, ver index.ts sobre
      // rate-limit da conta MetaAPI compartilhada) -- nao da pra ter um
      // intervalo entre ciclos diferente por usuario sem um scheduler por
      // sessao, que nao existe hoje. Em vez de pular runAgent (o que
      // deixaria a posicao aberta sem checagem de stop/breakeven/trailing
      // naquele ciclo -- enforceMt5StopsAndTargets roda ANTES disto, sempre,
      // todo ciclo, pra toda sessao), a cadencia so restringe AVALIACAO DE
      // ENTRADA NOVA: usando o numero global do ciclo (determinismo, sem
      // Map/estado por sessao), AGRESSIVA avalia todo ciclo, NORMAL 1 a
      // cada 2, CONSERVADORA 1 a cada 4.
      const cadence = session.userConfig?.cadence ?? "NORMAL";
      const CADENCE_CYCLE_INTERVAL: Record<string, number> = { AGRESSIVA: 1, NORMAL: 2, CONSERVADORA: 4 };
      const requiredEvery = CADENCE_CYCLE_INTERVAL[cadence] ?? 2;
      if (requiredEvery > 1 && cycle % requiredEvery !== 0) {
        return {
          error: `Cadencia "${cadence}" do Setup do AI Trader: avaliacao de entrada nova so roda a cada ${requiredEvery} ciclos (proxima janela no ciclo ${Math.ceil(cycle / requiredEvery) * requiredEvery}). Posicoes ja abertas seguem monitoradas normalmente (stop/breakeven/trailing).`,
        };
      }
      const symbol = String(input.symbol || "").toUpperCase();
      const side = input.side as string;
      const sizeInput = String(input.size || "normal").toLowerCase();
      const reasoning = String(input.reasoning || "");
      const confidenceRaw = Number(input.confidence);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, confidenceRaw)) : null;
      const basket = effectiveBasket(session);
      if (!basket.includes(symbol)) {
        return { error: `Simbolo fora da cesta permitida. Cesta: ${basket.join(", ")}.` };
      }
      // 🔴 2026-08-31 (pedido do Cleber, Setup do AI Trader reconectado):
      // direcao preferencial do usuario (AUTO/LONG/SHORT) -- AUTO nao
      // restringe nada, LONG/SHORT bloqueia o lado oposto antes de qualquer
      // outra checagem (barato, sem chamar cotacao/validador por nada).
      const userDirection = session.userConfig?.direction ?? "AUTO";
      if (userDirection !== "AUTO" && side !== userDirection) {
        return {
          error: `Direcao "${side}" bloqueada pela preferencia do usuario no Setup do AI Trader (direcao travada em ${userDirection}). ` +
            `Opere só ${userDirection} enquanto essa preferencia estiver ativa, ou avalie outro ativo.`,
        };
      }
      // Limite de perda diaria (%) do Setup -- bloqueia NOVA entrada se o
      // prejuizo realizado do dia (00:00 America/Sao_Paulo) ja bateu o teto
      // configurado. Nao fecha posicao existente, so impede abrir mais uma
      // no dia ruim.
      const dailyLossLimitPct = session.userConfig?.dailyLossLimitPct;
      if (dailyLossLimitPct != null) {
        const todayNetPnl = await getTodayRealizedPnl(session.sessionId);
        const balanceForLimit = await getMt5AccountBalance(session.sessionId);
        const lossPct = todayNetPnl < 0 ? (-todayNetPnl / balanceForLimit) * 100 : 0;
        if (lossPct >= dailyLossLimitPct) {
          return {
            error: `Limite de perda diaria do Setup (${dailyLossLimitPct.toFixed(1)}%) ja atingido hoje ` +
              `(prejuizo real: ${lossPct.toFixed(2)}%). Nenhuma nova posicao ate 00:00 no fuso de Brasilia. Posicoes ja abertas nao sao afetadas.`,
          };
        }
      }
      if (!isSymbolTradable(symbol)) {
        return {
          error: `Mercado de ${symbol} fechado agora (CFDs de forex/metal/energia/indices fecham sexta 22:00 UTC, abrem domingo 23:00 UTC) -- posicao nao aberta. Prefira um dos criptos da cesta enquanto este mercado estiver fechado.`,
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
      // 🔴 2026-08-31 (teste): comentado para permitir entradas sem reasoning detalhado
      // if (reasoning.trim().length === 0) {
      //   return { error: "reasoning e obrigatorio -- explique por que esta entrada faz sentido agora antes de abrir a posicao." };
      // }
      // 🔴 2026-08-30 (pedido direto do Cleber, "ela nao pode ter raciocinio
      // raso e muito menos entrar porque fez um raciocinio raso"): confirmado
      // ao vivo rastreando o log ciclo a ciclo -- open_position(BTCXBN,
      // SHORT) foi chamado como a PRIMEIRA acao do ciclo #3, ANTES de
      // qualquer get_mt5_quote naquele ciclo. Decisao pura de "memoria de
      // trades" (perdas passadas), zero trend/volume/macd/stochastic/spread
      // AO VIVO consultado pro simbolo sendo negociado. Mesma trava que ja
      // existe em close_position (ver lastQuotedCycleBySymbol acima) --
      // exige get_mt5_quote do MESMO simbolo no MESMO ciclo antes de aceitar
      // abrir posicao nele. Isso forca a decisao a estar ancorada em dado
      // real e atual do ativo, nao so em memoria de trades passados.
      if (lastQuotedCycleBySymbol.get(symbol) !== cycle) {
        return {
          error:
            `Voce ainda nao chamou get_mt5_quote("${symbol}") NESTE ciclo -- abrir posicao sem consultar tendencia/volume/` +
            `MACD/estocastico/spread REAIS e ATUAIS deste ativo especifico e raciocinio raso, baseado so em memoria de ` +
            `trades passados. Chame get_mt5_quote("${symbol}") primeiro, avalie o dado de verdade, depois chame open_position de novo.`,
        };
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
        // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, pedido explicito do
        // Cleber apos ver o padrao 2x na mesma sessao): a lista acima so pega
        // negacao direta de "abrir/entrar" -- nao pegava o reasoning admitir a
        // PROPRIA falta de confirmacao e abrir mesmo assim. Visto ao vivo:
        // XETUSD SHORT ("confirmacao de exaustao, que nao esta presente.
        // Contudo... operar um SHORT pequeno como teste") e BTCUSD LONG
        // ("Entro com LONG apenas se houver confirmacao... o que ainda nao
        // ocorreu"). Ambos descreveram o proprio criterio como NAO cumprido e
        // entraram de qualquer forma -- mesmo padrao de contradicao, frases
        // diferentes. Adicionadas aqui, nao numa lista separada, pra reusar a
        // MESMA logica de bloqueio + REVERSAL_CUES ja testada.
        "como teste", "para teste", "ainda nao ocorreu", "ainda não ocorreu",
        "nao esta presente", "não está presente", "sem confirmacao real", "sem confirmação real",
        "nao ha confirmacao", "não há confirmação",
        // 🔴 2026-08-30 (mesma sessao, 3a ocorrencia -- BTCXBN SHORT, perda de
        // $5,56): "nao ha razao para entrar contra a tendencia... pode levar
        // a perdas" no proprio reasoning da entrada, aberta mesmo assim. Cada
        // ocorrencia usa uma frase nova -- esta lista nunca vai cobrir todas
        // as variacoes possiveis (limite conhecido de checagem por
        // palavra-chave, ver comentario acima), mas cada padrao real
        // observado entra aqui assim que aparece.
        "nao ha razao para entrar", "não há razão para entrar", "pode levar a perdas", "pode levar a perda",
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
      // 🔴 2026-08-30 (pedido do Cleber): camada semantica ADICIONAL, alem da
      // trava por palavra-chave acima -- so roda quando a trava por
      // palavra-chave NAO bloqueou. Ver reasoningValidator.ts.
      const consistencyCheckOpen = await checkReasoningConsistency({
        actionKind: "open_position",
        symbol,
        side: side as "LONG" | "SHORT",
        reasoning,
        realSnapshot: lastQuoteSnapshotBySymbol.get(symbol),
      });
      if (!consistencyCheckOpen.consistent) {
        return {
          error:
            `Contradicao semantica detectada pelo validador: ${consistencyCheckOpen.note || "raciocinio parece argumentar contra a propria acao"}. ` +
            `Posicao NAO aberta. Revise o raciocinio -- se a decisao de abrir ainda fizer sentido, reescreva deixando claro o motivo real, ou avalie outro ativo/lado.`,
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
      // 🔴 2026-08-31 (teste): afrouxado de 1 para 5 pra permitir múltiplas posições
      const MAX_POSITIONS_PER_SYMBOL = 5;
      let openPositions;
      try {
        openPositions = await listMt5OpenPositions(session.sessionId);
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
        // 🔴 2026-08-30 (pedido do Cleber, "não podemos ter teses fracas"):
        // marca que este simbolo teve uma tentativa de INVERSAO bloqueada
        // neste ciclo -- close_position usa isso pra exigir invalidacao real
        // (nao so PnL neutro) antes de aceitar fechar a posicao existente
        // logo em seguida. Ver bloco irmao em close_position.
        flipAttemptBlockedThisCycle.set(symbol, cycle);
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
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Ativos Simultaneos"):
      // teto de SIMBOLOS DISTINTOS com posicao aberta ao mesmo tempo, definido
      // pelo usuario. So bloqueia quando o simbolo novo AINDA NAO tem posicao
      // aberta -- reforcar um simbolo ja dentro do teto (checagem acima) segue
      // liberado ate MAX_POSITIONS_PER_SYMBOL.
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Maximo de Posicoes
      // Abertas"): teto AGREGADO de TODAS as posicoes da sessao (qualquer
      // simbolo), diferente do teto de ATIVOS SIMULTANEOS abaixo (que conta
      // simbolos DISTINTOS) -- ex: 2 posicoes em BTCUSD conta 2 aqui, mas 1
      // symbolo la.
      const maxOpenPositionsTotal = session.userConfig?.maxOpenPositionsTotal;
      if (maxOpenPositionsTotal != null && openPositions.length >= maxOpenPositionsTotal) {
        return {
          error: `Teto de posicoes abertas do usuario (${maxOpenPositionsTotal}) atingido -- ja ha ${openPositions.length} posicao(oes) aberta(s) no total. Feche alguma posicao antes de abrir em ${symbol}.`,
        };
      }
      const maxSimultaneousAssets = session.userConfig?.maxSimultaneousAssets;
      if (maxSimultaneousAssets != null && openInSymbol === 0) {
        const distinctSymbolsOpen = new Set(openPositions.map((p) => p.symbol)).size;
        if (distinctSymbolsOpen >= maxSimultaneousAssets) {
          return {
            error: `Teto de ativos simultaneos do usuario (${maxSimultaneousAssets}) atingido -- ja ha posicao aberta em ${distinctSymbolsOpen} simbolo(s) diferente(s). Feche alguma posicao antes de abrir em ${symbol}.`,
          };
        }
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
        const recentClosed = await getRecentClosedTrades(session.sessionId, symbol, config.mt5LossStreakThreshold);
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
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Timeframe Operacional")
      const openPositionTimeframe = (session.userConfig?.timeframe ?? "5m") as import("./atr.js").SupportedTimeframe;
      const [trend, volume, supportResistanceForTarget, stochasticForReversalCheck, macdForConfluenceCheck, candlePatternsForConfluenceCheck] = await Promise.all([
        getTrendInfo(symbol, openPositionTimeframe),
        getVolumeConfirmation(symbol, openPositionTimeframe),
        getSupportResistance(symbol, openPositionTimeframe),
        getSlowStochastic(symbol, openPositionTimeframe),
        getMacd(symbol, openPositionTimeframe),
        getCandlePatterns(symbol, openPositionTimeframe),
      ]);
      // 🔴 2026-09-02 (achado do Cleber, ao vivo -- XETUSD LONG aberto num
      // mercado LATERAL com "trend BAIXA" evidente logo depois): o proprio
      // reasoning da entrada admitiu "entrada moderada por conviccao unica
      // num setup nao-trend-clear" -- MACD positivo foi o UNICO fator usado,
      // trend era LATERAL (nenhum padrao de venda existia AINDA no momento
      // da entrada, mas tambem nenhuma confluencia real apoiava LONG).
      // O guard de contra-tendencia acima (linha ~1149) so roda quando
      // trend.label !== "LATERAL" -- em mercado LATERAL nao havia NENHUMA
      // trava de confluencia, um unico indicador bastava pra abrir. Fecha
      // esse buraco: em trend LATERAL, exige pelo menos 2 dos 4 fatores reais
      // (MACD, Estocastico em extremo, volume elevado, padrao de candle)
      // alinhados com o lado da entrada -- mesmo espirito da trava de
      // contra-tendencia (nao proibe convicção baixa, proibe convicção ÚNICA
      // sem nenhuma segunda confirmacao real).
      if (trend && trend.label === "LATERAL") {
        const confluenceFactors: string[] = [];
        if (macdForConfluenceCheck) {
          const macdAligned = (side === "LONG" && macdForConfluenceCheck.label === "ALTA") || (side === "SHORT" && macdForConfluenceCheck.label === "BAIXA");
          if (macdAligned) confluenceFactors.push(`MACD ${macdForConfluenceCheck.label}`);
        }
        if (stochasticForReversalCheck) {
          const stochAligned =
            (side === "LONG" && stochasticForReversalCheck.label === "SOBREVENDIDO") ||
            (side === "SHORT" && stochasticForReversalCheck.label === "SOBRECOMPRADO");
          if (stochAligned) confluenceFactors.push(`Estocastico ${stochasticForReversalCheck.label}`);
        }
        if (volume?.elevated) confluenceFactors.push(`volume elevado (${volume.ratio}x)`);
        if (candlePatternsForConfluenceCheck?.bias) {
          const patternAligned =
            (side === "LONG" && candlePatternsForConfluenceCheck.bias === "ALTA") ||
            (side === "SHORT" && candlePatternsForConfluenceCheck.bias === "BAIXA");
          if (patternAligned) confluenceFactors.push(`padrao de candle ${candlePatternsForConfluenceCheck.detected.join("/")} (bias ${candlePatternsForConfluenceCheck.bias})`);
        }
        if (confluenceFactors.length < 2) {
          return {
            error:
              `${symbol} esta em tendencia LATERAL (sem direcao clara) e so ha ${confluenceFactors.length} fator real alinhado com ${side} ` +
              `(${confluenceFactors.join(", ") || "nenhum"}). Em mercado lateral, exige-se pelo menos 2 fatores reais confirmando (MACD, Estocastico ` +
              `em extremo, volume elevado, ou padrao de candle) antes de abrir -- conviccao unica num unico indicador nao e suficiente. ` +
              `Posicao NAO aberta. Espere segunda confirmacao real ou avalie outro ativo.`,
          };
        }
      }
      if (trend && trend.label !== "LATERAL" && volume) {
        const counterTrend = (trend.label === "ALTA" && side === "SHORT") || (trend.label === "BAIXA" && side === "LONG");
        // 🔴 2026-09-02 (pedido do Cleber): Estocastico em extremo real
        // (SOBRECOMPRADO/SOBREVENDIDO) e sinal genuino de exaustao de curto
        // prazo -- antes o gate abaixo so aceitava volume elevado como
        // confirmacao pra contrarian trade, ignorando esse sinal por
        // completo (achado ao vivo: BTCUSD/XETUSD/GER40 com Estocastico
        // 91-96, tendencia de ALTA, volume normal -- SHORT de reversao
        // ficaria bloqueado mesmo com exaustao real e clara). Agora conta
        // como confirmacao alternativa, ao lado do volume -- ainda exige
        // ALGUMA confirmacao real (nao remove a trava, so reconhece outro
        // sinal legitimo de reversao).
        const stochasticExtremeConfirmsReversal =
          stochasticForReversalCheck != null &&
          ((side === "SHORT" && stochasticForReversalCheck.label === "SOBRECOMPRADO") ||
            (side === "LONG" && stochasticForReversalCheck.label === "SOBREVENDIDO"));
        // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Fluxo de
        // Operacao"): quando o usuario NAO escolheu nada (marketMode=null),
        // mantem o guard existente (bloqueia contra-tendencia só sem volume
        // confirmando). Quando escolheu explicitamente: TREND aperta (bloqueia
        // contra-tendencia SEMPRE, mesmo com volume) e COUNTER inverte
        // (bloqueia A FAVOR da tendencia, só libera contra-tendencia/lateral --
        // "buscar entradas em suporte/resistencia", mesmo espirito do texto
        // que ja existia na UI antiga).
        const marketMode = session.userConfig?.marketMode;
        if (marketMode === "TREND" && counterTrend) {
          return {
            error:
              `Fluxo de Operacao "A Favor (Trend)" do Setup do AI Trader: ${symbol} esta em tendencia de ${trend.label} ` +
              `(${trend.changePct > 0 ? "+" : ""}${trend.changePct}% na ultima ${trend.lookbackMinutes}min) -- ${side} aqui seria contra a tendencia, ` +
              `bloqueado enquanto essa preferencia estiver ativa. Opere a favor da tendencia ou avalie outro ativo.`,
          };
        }
        if (marketMode === "COUNTER" && !counterTrend) {
          return {
            error:
              `Fluxo de Operacao "Contra (Reversal)" do Setup do AI Trader: ${symbol} esta em tendencia de ${trend.label} ` +
              `(${trend.changePct > 0 ? "+" : ""}${trend.changePct}% na ultima ${trend.lookbackMinutes}min) -- ${side} aqui seria A FAVOR da tendencia, ` +
              `bloqueado enquanto essa preferencia estiver ativa (busca reversao em suporte/resistencia). Opere contra a tendencia ou avalie outro ativo.`,
          };
        }
        if (marketMode == null && counterTrend && !volume.elevated && !stochasticExtremeConfirmsReversal) {
          return {
            error:
              `${symbol} esta em tendencia de ${trend.label} na ultima ${trend.lookbackMinutes}min (${trend.changePct > 0 ? "+" : ""}${trend.changePct}%), ` +
              `o volume recente NAO esta acima do normal (razao ${volume.ratio}x) e o Estocastico ${stochasticForReversalCheck ? `NAO esta em extremo (${stochasticForReversalCheck.label})` : "nao esta disponivel"} -- ` +
              `${side} aqui seria ir contra o movimento sem nenhuma confirmacao real de reversao. ` +
              `Posicao NAO aberta. Espere volume elevado OU Estocastico em extremo real confirmando exaustao, opere a favor da tendencia, ou avalie outro ativo.`,
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
      //
      // 🔴 2026-08-31: movido pra ANTES do sizing (era depois) -- o sizing por
      // % de risco (abaixo) precisa da distancia do stop em % pra calcular o
      // notional-alvo (notional = risco_usd / stop_pct), entao o stop
      // precisa existir primeiro.
      let stopPct = await getAtrPercent(symbol, openPositionTimeframe).then((atrPct) => {
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
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Alvo de Lucro
      // (Range)"): POUCOS/MÉDIO/MUITOS sobrepoe o R:R (take-profit/stop)
      // default do motor quando o usuario configurou. null (usuario nunca
      // tocou) preserva o comportamento atual (baseline mt5TakeProfitAtrMultiplier/mt5StopAtrMultiplier).
      const RR_BY_TARGET_POINTS: Record<string, number> = { POUCOS: 1.5, "MÉDIO": 3, MUITOS: 5 };
      const rrMultiplier = session.userConfig?.targetPoints != null
        ? RR_BY_TARGET_POINTS[session.userConfig.targetPoints]
        : config.mt5TakeProfitAtrMultiplier / config.mt5StopAtrMultiplier;
      let takeProfitPct = stopPct * rrMultiplier;
      // 🔴 2026-09-02 (pedido direto do Cleber): alvo por ATR e cego a
      // estrutura real do preco -- capado aqui pela distancia real ate o
      // proximo suporte/resistencia (candle oficial, mesma fonte que MACD/
      // Estocastico) na direcao do trade, pra TODOS os ativos da cesta. Sem
      // candle real suficiente (supportResistanceForTarget == null), mantem
      // o alvo por ATR puro -- nunca fabrica nivel.
      let takeProfitCappedBySR = false;
      // 🔴 2026-09-04 (pedido direto do Cleber -- "todo rompimento de topo
      // pode ser o inicio de uma grande movimentacao... a IA tem que estar
      // atenta com todos os rompimentos, sobretudo com pouco volume, pouco
      // volume nao quer dizer que nao vai existir uma grande movimentacao"):
      // achado real -- o cap de S/R abaixo usava resistance/support
      // calculados COM a propria vela mais recente, entao bem na hora de um
      // rompimento real (preco fazendo a nova maxima/minima da janela) a
      // distancia dava ~0%, capando o alvo pra quase zero e bloqueando ou
      // encolhendo drasticamente a entrada JUSTO no momento do rompimento --
      // o oposto do que deveria acontecer. getSupportResistance (atr.ts)
      // agora calcula o nivel so da janela ESTABELECIDA (exclui as ultimas 2
      // velas) e expoe brokeAboveResistance/brokeBelowSupport -- quando o
      // rompimento e A FAVOR do lado sendo aberto, o nivel antigo ja nao e
      // mais um teto real, entao o cap e desligado (alvo por ATR puro, sem
      // limitar por um nivel que o proprio preco ja superou).
      const confirmedBreakoutInTradeDirection = supportResistanceForTarget
        ? side === "LONG"
          ? supportResistanceForTarget.brokeAboveResistance
          : supportResistanceForTarget.brokeBelowSupport
        : false;
      if (supportResistanceForTarget && !confirmedBreakoutInTradeDirection) {
        const distanceToLevelPct =
          (side === "LONG" ? supportResistanceForTarget.distanceToResistancePct : supportResistanceForTarget.distanceToSupportPct) / 100;
        const srCappedTakeProfitPct = distanceToLevelPct * config.mt5SrTargetMarginPct;
        if (srCappedTakeProfitPct < takeProfitPct) {
          if (srCappedTakeProfitPct < stopPct * config.mt5MinRrAfterSrCap) {
            const levelName = side === "LONG" ? "resistencia" : "suporte";
            return {
              error:
                `${symbol}: o ${levelName} real mais proximo esta a so ${(distanceToLevelPct * 100).toFixed(3)}% de distancia -- ` +
                `alvo (${(takeProfitPct * 100).toFixed(3)}% por ATR) exigiria romper esse nivel antes de ter qualquer chance de ser alcancado, ` +
                `e o espaco disponivel ate la nem cobre um R:R minimo de ${config.mt5MinRrAfterSrCap.toFixed(1)}:1 acima do stop (${(stopPct * 100).toFixed(3)}%). ` +
                `Posicao NAO aberta -- risco/retorno desfavoravel de partida. Espere o preco se afastar do nivel ou avalie outro ativo/lado.`,
            };
          }
          takeProfitPct = srCappedTakeProfitPct;
          takeProfitCappedBySR = true;
        }
      }
      // 🔴 2026-08-30 (mesmo achado, mesmo redesenho): o encolhimento extra de
      // alvo em dia de baixo volume (0,6x) foi REMOVIDO -- existia
      // especificamente pra servir a filosofia "giro rapido, alvo curto"
      // (2026-08-29), que a sessao real mostrou nunca alcancar o alvo (0 de
      // 66 trades bateram take-profit). Encolher o alvo ainda mais nessas
      // condicoes so pioraria o MESMO problema que o redesenho tenta
      // resolver -- o risco (stop) ja e o mesmo independente do volume, e o
      // R:R 1:2 ja da margem suficiente sem precisar de um ajuste extra.
      const lowVolumeAdjusted = false;

      // 🔴 2026-08-31 (achado ao vivo, pedido do Cleber -- "quando perde,
      // perde pouco, quando ganha, ganha muito" / "não pode quebrar o caixa
      // do usuário"): sizing por % de RISCO DO SALDO REAL, nao mais notional
      // fixo em dolar (mt5TargetNotionalUsd, removido -- ver config.ts pro
      // achado completo: numa conta de $50 o notional fixo de $1200-1800 era
      // 24x-36x de alavancagem implicita, e um stop de so 0,79% ja produziu
      // -$16,05 num unico trade). notional-alvo = risco_usd / stop_pct --
      // quanto mais apertado o stop, MAIOR o notional pode ser pro MESMO
      // risco em dolar (matematica de risco fixo por trade, padrao de mesa
      // proprietaria). getMt5AccountBalance() soma initial_balance + net_pnl
      // realizado desta sessao -- o tamanho da posicao ENCOLHE se a conta
      // perdeu e CRESCE se ganhou, sem precisar reconfigurar nada.
      const accountBalance = await getMt5AccountBalance(session.sessionId);
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Capital para IA"):
      // se o usuario alocou um valor menor que o saldo real da conta pro
      // motor operar, o sizing usa o valor alocado como base de risco, nunca
      // o saldo inteiro -- allocatedCapitalUsd nunca ultrapassa o saldo real
      // (senao a IA arriscaria dinheiro que nao esta de fato liberado pra ela).
      const allocated = session.userConfig?.allocatedCapitalUsd;
      const balance = allocated != null ? Math.min(allocated, accountBalance) : accountBalance;
      // 🔴 2026-08-31 (Setup do AI Trader reconectado): risco por trade (%)
      // configurado pelo usuario sobrepoe o default global do motor quando
      // presente -- ver getUserTradingConfig em neuralBridge.ts.
      const baseRiskPct = session.userConfig?.riskPerTradePct != null
        ? session.userConfig.riskPerTradePct / 100
        : config.mt5RiskPctPerTrade;
      const riskPct = baseRiskPct * (sizeInput === "forte" ? config.mt5HeavyMultiplier : 1);
      const riskUsd = balance * riskPct;
      const targetNotional = riskUsd / stopPct;
      let lots = targetNotional / (LOT_SIZE[symbol] * quote.price);
      lots = Math.min(lots, config.mt5SafetyMaxLots);
      // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Lotes Maximos por
      // Trade"): teto do usuario, quando configurado, nunca frouxo o teto de
      // seguranca global (mt5SafetyMaxLots) -- so aperta.
      if (session.userConfig?.maxLotsPerTrade != null) {
        lots = Math.min(lots, session.userConfig.maxLotsPerTrade);
      }
      lots = Math.round(lots / MIN_LOTS) * MIN_LOTS; // arredonda pro incremento minimo real da plataforma
      if (lots < MIN_LOTS) lots = MIN_LOTS; // nao da pra abrir posicao com lote zero -- MIN_LOTS e o menor lote executavel
      let amountUsd = lots * LOT_SIZE[symbol] * quote.price;
      // 🔴 2026-08-31 (mesmo achado): gate DURO -- se o incremento minimo de
      // lote (MIN_LOTS/LOT_SIZE) ja forca um risco em $ maior que o teto
      // absoluto tolerado por esta conta, a entrada e RECUSADA, nunca aberta
      // maior "porque o piso obriga". Achado real e concreto que motivou
      // isso: MIN_LOTS=0,01 e global pra todos os simbolos, mas o preco nao
      // e -- 0,01 lote de BTCUSD (~$78.000) ja forca ~$780 de notional, que
      // sozinho (mesmo com stop de so 0,3%) ja arrisca ~$2,34, MUITO acima
      // de 1% de risco-alvo numa conta de $50 ($0,50). Nao existe fracionar
      // mais o lote pra baixo disso -- a resposta correta e nao operar esse
      // ativo nesse tamanho de conta, nao absorver o excesso de risco.
      const actualRiskUsd = amountUsd * stopPct;
      const maxRiskUsd = balance * config.mt5MaxRiskPctPerTrade;
      if (actualRiskUsd > maxRiskUsd) {
        return {
          error:
            `Risco minimo possivel para ${symbol} neste preco e lote minimo ($${actualRiskUsd.toFixed(2)}) excede o teto de risco por trade ` +
            `desta conta ($${maxRiskUsd.toFixed(2)}, ${(config.mt5MaxRiskPctPerTrade * 100).toFixed(1)}% do saldo real de $${balance.toFixed(2)}). ` +
            `Este ativo exige exposicao minima incompativel com o tamanho atual da conta -- posicao NAO aberta. Opere outro ativo da cesta ` +
            `ou aguarde a conta crescer o suficiente pra suportar o lote minimo de ${symbol} dentro do teto de risco.`,
        };
      }
      // Teto absoluto de seguranca em notional -- so deveria disparar em caso
      // degenerado (preco anormal fazendo o lote explodir), o gate de risco
      // acima ja e o limite normal de operacao.
      if (amountUsd > config.mt5MaxNotionalUsd) {
        lots = Math.floor(config.mt5MaxNotionalUsd / (LOT_SIZE[symbol] * quote.price) / MIN_LOTS) * MIN_LOTS;
        if (lots < MIN_LOTS) {
          return {
            error: `Exposicao minima possivel para ${symbol} neste preco excede o teto absoluto de seguranca ($${config.mt5MaxNotionalUsd}). Posicao NAO aberta.`,
          };
        }
        amountUsd = lots * LOT_SIZE[symbol] * quote.price;
      }
      // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, monitoramento pos-
      // deploy): a checagem de teto do grupo correlacionado (acima, logo
      // apos o teto por simbolo) so soma o que JA esta aberto -- nunca inclui
      // a entrada que esta sendo aberta agora. Confirmado ao vivo: XETUSD
      // SHORT ($1.212) estava abaixo do teto ($2.700), entao um SOLUSD SHORT
      // "forte" ($1.800) passou direto (a soma ANTES da nova entrada, unica
      // coisa checada, ainda estava sob o teto) e deixou a exposicao real em
      // $3.012 -- so as tentativas SEGUINTES foram bloqueadas, depois do
      // estrago feito. Segunda checagem aqui, agora com o amountUsd REAL da
      // entrada que esta prestes a acontecer, fecha esse buraco sem remover
      // a checagem antecipada (que ainda evita gastar a chamada de cotacao
      // quando o grupo ja esta no teto de partida).
      if (correlatedGroup.length > 1) {
        const sameSideGroupExposure = openPositions
          .filter((p) => correlatedGroup.includes(p.symbol) && p.side === side)
          .reduce((sum, p) => sum + Number(p.quantity), 0);
        const projectedExposure = sameSideGroupExposure + amountUsd;
        if (projectedExposure > config.mt5MaxCorrelatedNotionalUsd) {
          return {
            error:
              `Esta entrada ($${amountUsd.toFixed(0)}) levaria a exposicao ${side} combinada do grupo correlacionado ` +
              `(${correlatedGroup.join("/")}) de $${sameSideGroupExposure.toFixed(0)} para $${projectedExposure.toFixed(0)}, ` +
              `acima do teto ($${config.mt5MaxCorrelatedNotionalUsd}). Esses ativos andam juntos -- essa entrada sozinha ` +
              `estouraria o limite. Posicao NAO aberta. Reduza o tamanho, feche outra posicao do grupo, ou opere o lado oposto.`,
          };
        }
      }

      // 🔴 2026-08-29: stop/alvo calculados a partir do fillPrice (preco real
      // de preenchimento, ver acima) -- nao do mid/last tick.
      const stopLoss = side === "LONG" ? fillPrice * (1 - stopPct) : fillPrice * (1 + stopPct);
      const takeProfit = side === "LONG" ? fillPrice * (1 + takeProfitPct) : fillPrice * (1 - takeProfitPct);
      const regimeAtEntry = lastQuoteSnapshotBySymbol.get(symbol);
      const tradeId = await openMt5Position({
        sessionId: session.sessionId,
        userId: session.userId,
        symbol,
        side: side as "LONG" | "SHORT",
        entryPrice: fillPrice,
        amountUsd,
        stopLoss,
        takeProfit,
        reasoning,
        confidence,
        sessionAtEntry: regimeAtEntry?.session ?? null,
        volumeLabelAtEntry: regimeAtEntry?.volumeLabel ?? null,
        volatilityLabelAtEntry: regimeAtEntry?.volatilityLabel ?? null,
      });
      if (!tradeId) return { error: "Falha ao gravar a posicao (ver log do processo)." };
      return {
        trade_id: tradeId,
        symbol,
        side,
        size: sizeInput,
        confidence,
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
        alvo_capado_por_suporte_resistencia: takeProfitCappedBySR,
        stop_alargado_por_spread: widenedForSpread,
        aviso:
          "stop_loss/take_profit acima sao MECANICOS -- o codigo fecha sozinho quando baterem, voce nao precisa (nem deve tentar) fechar antes por conta propria a nao ser que a tese tenha mudado." +
          (widenedForSpread
            ? ` ATENCAO: o stop foi ALARGADO automaticamente pra ${(stopPct * 100).toFixed(3)}% (em vez do normal) porque o spread deste ativo (${quote.spreadPct.toFixed(2)}%) e alto -- um stop mais apertado bateria so pelo custo de operar, sem nenhum movimento real de preco.`
            : "") +
          (takeProfitCappedBySR
            ? ` ATENCAO: o alvo foi ENCOLHIDO automaticamente pra ${(takeProfitPct * 100).toFixed(3)}% (em vez do alvo por ATR) porque o suporte/resistencia real esta mais perto -- mirando logo antes do nivel, nao alem dele.`
            : ""),
      };
    }

    case "close_position": {
      const tradeId = String(input.trade_id || "");
      const reasoning = String(input.reasoning || "");
      if (!tradeId) return { error: "trade_id invalido." };
      // 🔴 2026-09-02 (achado ao vivo, 2a ocorrencia confirmada: exit_price
      // ja alem do stop_loss registrado no fechamento manual, mesmo padrao
      // do achado de 02/09 tarde/noite com XETUSD) -- enforceMt5StopsAndTargets
      // so roda uma vez no INICIO de cada ciclo, mas o ciclo inteiro (varias
      // chamadas de LLM local via Ollama, cada uma podendo levar dezenas de
      // segundos) pode durar bem mais que isso ate chegar aqui. Resultado:
      // o preco real ja tinha furado o stop antes do fechamento manual
      // avaliar/executar, e a saida discricionaria (AI_SIGNAL) executava na
      // cotacao JA PIOR que o stop, em vez do stop mecanico pegar a tempo.
      // Re-rodar a mesma checagem (idempotente -- so fecha o que realmente
      // ja bateu SL/TP com cotacao fresca) bem aqui, ANTES de avaliar o
      // fechamento discricionario, fecha a posicao pelo canal mecanico
      // correto (exit_reason='SL'/'TP', ja na mesma cotacao que seria usada
      // de qualquer jeito) assim que ela e detectada, em vez de esperar o
      // proximo ciclo -- reduz a janela de slippage, nao elimina.
      try {
        const preCheck = await enforceMt5StopsAndTargets(session.sessionId, getMt5Quote);
        const mechanicalClose = preCheck.closed.find((c) => c.tradeId === tradeId);
        if (mechanicalClose) {
          return {
            closed: true,
            mechanical: true,
            reason: mechanicalClose.reason,
            exit_price: mechanicalClose.exitPrice,
            note: `Posicao ja fechada mecanicamente (${mechanicalClose.reason}) ao rechecar stop/alvo com cotacao fresca antes do fechamento manual -- nao ha mais nada pra fechar aqui.`,
          };
        }
      } catch (err) {
        console.warn("[tools/close_position] falha ao rechecar stop/alvo mecanico, seguindo com fechamento manual:", err instanceof Error ? err.message : err);
      }
      let positions;
      try {
        positions = await listMt5OpenPositions(session.sessionId);
      } catch (err) {
        return { error: `Nao foi possivel confirmar a posicao ${tradeId} (falha de rede/Supabase: ${err instanceof Error ? err.message : err}). Posicao NAO fechada -- tente de novo.` };
      }
      const position = positions.find((p) => p.id === tradeId);
      if (!position) return { error: `Posicao ${tradeId} nao encontrada entre as abertas.` };
      // 🔴 2026-08-30 (pedido do Cleber): mesma camada semantica de
      // open_position -- close_position nao tem trava por palavra-chave
      // equivalente hoje, entao esta roda direto aqui, ANTES da logica de
      // fechamento em si (cotacao/preco de saida). Ver reasoningValidator.ts.
      const consistencyCheckClose = await checkReasoningConsistency({
        actionKind: "close_position",
        symbol: position.symbol,
        reasoning,
        realSnapshot: lastQuoteSnapshotBySymbol.get(position.symbol),
      });
      if (!consistencyCheckClose.consistent) {
        return {
          error:
            `Contradicao semantica detectada pelo validador: ${consistencyCheckClose.note || "raciocinio parece argumentar contra a propria acao"}. ` +
            `Posicao NAO fechada. Revise o raciocinio -- se a decisao de fechar ainda fizer sentido, reescreva deixando claro o motivo real.`,
        };
      }
      if (lastQuotedCycleBySymbol.get(position.symbol) !== cycle) {
        return {
          error:
            `Voce ainda nao chamou get_mt5_quote("${position.symbol}") NESTE ciclo -- fechar com dado velho (ou de outro ` +
            `simbolo) foi exatamente o erro que fechou um BTCUSD lucrativo usando numeros do XETUSD. Chame get_mt5_quote("${position.symbol}") ` +
            `primeiro pra confirmar tendencia/volume/preco REAIS e atuais deste ativo especifico, depois chame close_position de novo.`,
        };
      }
      const quote = await getMt5Quote(position.symbol);
      if (!quote) return { error: `Sem cotacao real disponivel agora para ${position.symbol} -- posicao nao fechada.` };
      // 🔴 2026-08-29: fechar um LONG e VENDER (recebe o bid); fechar um
      // SHORT e COMPRAR de volta (paga o ask) -- nao o mid/last tick.
      const exitPrice = position.side === "LONG" ? quote.bid : quote.ask;
      // 🔴 2026-08-30 (pedido do Cleber, "nao podemos ter teses fracas" --
      // generalizado apos achado ao vivo: XETUSD SHORT e BTCXBN SHORT
      // fechados MANUALMENTE perto do zero a zero, citando sinal
      // fraco/ambiguo -- em AMBOS os casos o preco voltou a favor da posicao
      // logo depois do fechamento, confirmado consultando cotacao real
      // minutos depois. Nao era flip (nenhum tinha tentativa de lado oposto
      // bloqueada), era so fechamento nervoso em ruido normal de mercado,
      // nao invalidacao real da tese. Antes esta regra so valia pos-flip-
      // bloqueado; agora vale pra QUALQUER fechamento manual -- exige que a
      // posicao ja tenha percorrido pelo menos metade do caminho ate o stop
      // (tese realmente enfraquecendo) ou ate o alvo (lucro real capturado)
      // antes de aceitar o fechamento discricionario. Contrapartida
      // conhecida e aceita pelo Cleber: atrasa tambem cortes rapidos em
      // teses genuinamente invalidadas cedo -- decisao de politica de risco,
      // nao bug.
      if (position.stop_loss != null && position.take_profit != null) {
        const stopDistance = Math.abs(position.entry_price - position.stop_loss);
        const targetDistance = Math.abs(position.take_profit - position.entry_price);
        const adverseMove = position.side === "LONG" ? position.entry_price - exitPrice : exitPrice - position.entry_price;
        const favorableMove = -adverseMove;
        const stopConsumedPct = stopDistance > 0 ? adverseMove / stopDistance : 0;
        const targetConsumedPct = targetDistance > 0 ? favorableMove / targetDistance : 0;
        // 🔴 2026-09-02 (pedido do Cleber): excecao a regra dos >=50% do
        // caminho acima -- se a posicao ja estiver em lucro REAL, alem do
        // custo do proprio spread (nao so "positiva na tela" por um tick
        // dentro do spread), o fechamento manual e permitido mesmo antes do
        // alvo. Diferente do caso que gerou a regra original (fechamento
        // NERVOSO perto do zero a zero, sem lucro nenhum capturado) -- aqui
        // ja existe ganho real na mao, travar isso so pra forcar esperar o
        // alvo mecanico e risco sem contrapartida quando a tese enfraquece
        // no meio do caminho.
        const spreadAbs = Math.abs(quote.ask - quote.bid);
        const clearsSpread = favorableMove > spreadAbs;
        // 🔴 2026-09-02 (pedido direto do Cleber): "inteligencia de operacao"
        // -- se a IA ve que a tese realmente inverteu (nao ruido ambiguo),
        // ela tem que poder cortar a perda ANTES de bater o stop cheio,
        // tomando um prejuizo MENOR que o stop tracado, em vez de esperar
        // passivamente o stop mecanico bater inteiro. A regra dos >=50% acima
        // existe pra bloquear fechamento NERVOSO em ruido (confirmado ao vivo
        // 2x: preco voltou a favor logo depois) -- a diferenca entre "ruido"
        // e "invalidacao real" e a mesma usada no gate de confluencia de
        // open_position (ver acima): >=2 fatores tecnicos REAIS (tendencia,
        // MACD, Estocastico, padrao de candle) apontando CONTRA o lado da
        // posicao, nao so o reasoning do modelo dizendo que mudou de ideia.
        // So aplica quando a posicao esta em perda (adverseMove > 0) -- lucro
        // ja tem o carve-out de clearsSpread acima.
        let realInvalidationConfirmed = false;
        let realInvalidationFactors: string[] = [];
        if (adverseMove > 0) {
          const timeframeForInvalidation = (session.userConfig?.timeframe ?? "5m") as import("./atr.js").SupportedTimeframe;
          const [trendForInvalidation, macdForInvalidation, stochasticForInvalidation, candlePatternsForInvalidation] = await Promise.all([
            getTrendInfo(position.symbol, timeframeForInvalidation),
            getMacd(position.symbol, timeframeForInvalidation),
            getSlowStochastic(position.symbol, timeframeForInvalidation),
            getCandlePatterns(position.symbol, timeframeForInvalidation),
          ]);
          if (trendForInvalidation) {
            const trendAgainst =
              (position.side === "LONG" && trendForInvalidation.label === "BAIXA") ||
              (position.side === "SHORT" && trendForInvalidation.label === "ALTA");
            if (trendAgainst) realInvalidationFactors.push(`tendencia ${trendForInvalidation.label}`);
          }
          if (macdForInvalidation) {
            const macdAgainst =
              (position.side === "LONG" && macdForInvalidation.label === "BAIXA") ||
              (position.side === "SHORT" && macdForInvalidation.label === "ALTA");
            if (macdAgainst) realInvalidationFactors.push(`MACD ${macdForInvalidation.label}`);
          }
          if (stochasticForInvalidation) {
            const stochAgainst =
              (position.side === "LONG" && stochasticForInvalidation.label === "SOBRECOMPRADO") ||
              (position.side === "SHORT" && stochasticForInvalidation.label === "SOBREVENDIDO");
            if (stochAgainst) realInvalidationFactors.push(`Estocastico ${stochasticForInvalidation.label}`);
          }
          if (candlePatternsForInvalidation?.bias) {
            const patternAgainst =
              (position.side === "LONG" && candlePatternsForInvalidation.bias === "BAIXA") ||
              (position.side === "SHORT" && candlePatternsForInvalidation.bias === "ALTA");
            if (patternAgainst) realInvalidationFactors.push(`padrao ${candlePatternsForInvalidation.detected.join("/")}`);
          }
          realInvalidationConfirmed = realInvalidationFactors.length >= 2;
        }
        if (
          stopConsumedPct < MIN_STOP_OR_TARGET_CONSUMED_PCT_FOR_FLIP_CLOSE &&
          targetConsumedPct < MIN_STOP_OR_TARGET_CONSUMED_PCT_FOR_FLIP_CLOSE &&
          !clearsSpread &&
          !realInvalidationConfirmed
        ) {
          return {
            error:
              `Fechamento manual de ${position.symbol} recusado: a posicao mal se moveu (${(stopConsumedPct * 100).toFixed(0)}% do caminho ate ` +
              `o stop, ${(targetConsumedPct * 100).toFixed(0)}% do caminho ate o alvo), o lucro flutuante ainda nao supera o custo do spread, e nao ha ` +
              `pelo menos 2 fatores tecnicos reais confirmando inversao contra a posicao (so ${realInvalidationFactors.length}: ${realInvalidationFactors.join(", ") || "nenhum"}). ` +
              `Fechar aqui e reagir a ruido normal de mercado ou a um sinal ambiguo, nao a invalidacao real da tese -- confirmado ao vivo 2x hoje ` +
              `(posicoes fechadas perto do zero a zero cujo preco voltou a favor logo depois). Posicao NAO fechada. So aceita fechamento manual ` +
              `quando a posicao ja percorreu pelo menos ${(MIN_STOP_OR_TARGET_CONSUMED_PCT_FOR_FLIP_CLOSE * 100).toFixed(0)}% do caminho ate o stop ` +
              `(tese realmente enfraquecendo), ate o alvo (lucro real ja capturado), ja estiver com lucro real acima do custo do spread, ou tiver ` +
              `pelo menos 2 fatores tecnicos reais confirmando inversao (tendencia + MACD/Estocastico/padrao de candle contra o lado) -- antes ` +
              `disso, deixe o stop/alvo mecanico decidir.`,
          };
        }
        if (realInvalidationConfirmed) {
          console.log(`[tools.ts] Corte de perda antecipado em ${position.symbol}: invalidacao tecnica real confirmada (${realInvalidationFactors.join(", ")}), prejuizo menor que o stop tracado.`);
        }
      }
      const closed = await closeMt5Position({ tradeId, exitPrice, reasoning });
      if (!closed) return { error: "Falha ao fechar a posicao (ver log do processo)." };
      return { trade_id: tradeId, exit_price: exitPrice };
    }

    // 🔴 2026-09-02 (pedido do Cleber -- "agente de risco interno": ganhar
    // muito, perder pouco, dentro da mesma taxa de acerto). Pyramiding
    // controlado: so amplia posicao ja em lucro REAL (acima do spread), com
    // pelo menos 1 fator tecnico real ainda a favor (nao esgotado), nunca
    // com exaustao real contra o proprio lado. Sizing usa a MESMA formula de
    // risco de open_position, capado pelo notional do lote original (nunca
    // reforça mais do que a entrada inicial), e o stop e movido pra
    // breakeven-ou-melhor no mesmo movimento -- travando o ganho antes de
    // aumentar exposicao, nunca reabrindo risco sobre o lote que ja ganhava.
    case "increase_position": {
      const tradeId = String(input.trade_id || "");
      const reasoning = String(input.reasoning || "");
      if (!tradeId) return { error: "trade_id invalido." };

      try {
        const preCheck = await enforceMt5StopsAndTargets(session.sessionId, getMt5Quote);
        const mechanicalClose = preCheck.closed.find((c) => c.tradeId === tradeId);
        if (mechanicalClose) {
          return {
            error: `Posicao ja foi fechada mecanicamente (${mechanicalClose.reason}) antes deste reforco poder ser aplicado -- nao ha mais nada pra ampliar.`,
          };
        }
      } catch (err) {
        console.warn("[tools/increase_position] falha ao rechecar stop/alvo mecanico:", err instanceof Error ? err.message : err);
      }

      let positions;
      try {
        positions = await listMt5OpenPositions(session.sessionId);
      } catch (err) {
        return { error: `Nao foi possivel confirmar a posicao ${tradeId} (falha de rede/Supabase: ${err instanceof Error ? err.message : err}). Reforco NAO aplicado -- tente de novo.` };
      }
      const position = positions.find((p) => p.id === tradeId);
      if (!position) return { error: `Posicao ${tradeId} nao encontrada entre as abertas.` };

      if (position.pyramid_adds_count >= MAX_PYRAMID_ADDS) {
        return {
          error: `${position.symbol} ja recebeu o maximo de ${MAX_PYRAMID_ADDS} reforcos permitidos nesta posicao. Nenhum reforco adicional -- deixe o stop/alvo mecanico (ja travado a favor pelos reforcos anteriores) decidir a partir daqui.`,
        };
      }
      if (position.stop_loss == null) {
        return { error: `Posicao ${position.symbol} sem stop_loss registrado -- nao da pra calcular o risco do reforco com seguranca. Reforco NAO aplicado.` };
      }
      if (lastQuotedCycleBySymbol.get(position.symbol) !== cycle) {
        return {
          error: `Voce ainda nao chamou get_mt5_quote("${position.symbol}") NESTE ciclo -- reforcar com dado velho (ou de outro simbolo) e o mesmo erro ja catalogado pra close_position. Chame get_mt5_quote("${position.symbol}") primeiro, depois chame increase_position de novo.`,
        };
      }
      const quote = await getMt5Quote(position.symbol);
      if (!quote) return { error: `Sem cotacao real disponivel agora para ${position.symbol} -- reforco NAO aplicado.` };
      if (quote.stale) {
        return { error: `Cotacao de ${position.symbol} esta OBSOLETA (tick de ${quote.tickAgeSeconds}s de idade). Reforco NAO aplicado.` };
      }
      if (Number.isFinite(quote.spreadPct) && quote.spreadPct > SPREAD_BLOCK_PCT) {
        return { error: `Spread de ${position.symbol} esta em ${quote.spreadPct.toFixed(2)}%, acima do teto de ${SPREAD_BLOCK_PCT}%. Reforco NAO aplicado.` };
      }

      const fillPrice = position.side === "LONG" ? quote.ask : quote.bid;
      const spreadAbs = Math.abs(quote.ask - quote.bid);
      const favorableMove = position.side === "LONG" ? fillPrice - position.entry_price : position.entry_price - fillPrice;
      if (!(favorableMove > spreadAbs)) {
        return {
          error:
            `Reforco de ${position.symbol} recusado: a posicao nao esta em lucro real acima do custo do spread ` +
            `(movimento a favor: ${favorableMove.toFixed(6)}, spread: ${spreadAbs.toFixed(6)}). Reforcar aqui seria aumentar risco sem ` +
            `ganho ja capturado -- increase_position so amplia posicao GANHANDO de verdade, nunca pra "recuperar" ou "dobrar a aposta".`,
        };
      }

      const timeframeForIncrease = (session.userConfig?.timeframe ?? "5m") as import("./atr.js").SupportedTimeframe;
      const [trendForIncrease, macdForIncrease, stochasticForIncrease, candleForIncrease] = await Promise.all([
        getTrendInfo(position.symbol, timeframeForIncrease),
        getMacd(position.symbol, timeframeForIncrease),
        getSlowStochastic(position.symbol, timeframeForIncrease),
        getCandlePatterns(position.symbol, timeframeForIncrease),
      ]);
      const alignedFactors: string[] = [];
      if (trendForIncrease) {
        const trendAligned = (position.side === "LONG" && trendForIncrease.label === "ALTA") || (position.side === "SHORT" && trendForIncrease.label === "BAIXA");
        if (trendAligned) alignedFactors.push(`tendencia ${trendForIncrease.label}`);
      }
      if (macdForIncrease) {
        const macdAligned = (position.side === "LONG" && macdForIncrease.label === "ALTA") || (position.side === "SHORT" && macdForIncrease.label === "BAIXA");
        if (macdAligned) alignedFactors.push(`MACD ${macdForIncrease.label}`);
      }
      if (candleForIncrease?.bias) {
        const patternAligned = (position.side === "LONG" && candleForIncrease.bias === "ALTA") || (position.side === "SHORT" && candleForIncrease.bias === "BAIXA");
        if (patternAligned) alignedFactors.push(`padrao ${candleForIncrease.detected.join("/")} (bias ${candleForIncrease.bias})`);
      }
      // Estocastico em extremo NO SENTIDO do proprio movimento e sinal de
      // exaustao (nao de continuidade) -- ao contrario do gate de abertura,
      // aqui ele NUNCA soma como fator a favor, e bloqueia o reforco se
      // apontar exaustao contra o lado (mesmo com lucro real e outros
      // fatores alinhados -- perseguir o topo/fundo com posicao maior e
      // exatamente o oposto de "perder pouco, ganhar muito").
      const exhaustionAgainst = !!(
        stochasticForIncrease &&
        ((position.side === "LONG" && stochasticForIncrease.label === "SOBRECOMPRADO") ||
          (position.side === "SHORT" && stochasticForIncrease.label === "SOBREVENDIDO"))
      );
      if (alignedFactors.length < 1 || exhaustionAgainst) {
        return {
          error:
            exhaustionAgainst
              ? `Reforco de ${position.symbol} recusado: Estocastico em extremo (${stochasticForIncrease?.label}) sugere exaustao do proprio movimento -- reforcar aqui e perseguir o topo/fundo, nao aproveitar tendencia real. Posicao mantida como esta, sem reforco.`
              : `Reforco de ${position.symbol} recusado: nenhum fator tecnico real (tendencia/MACD/padrao de candle) ainda alinhado com o lado ${position.side} -- o sinal pode ja ter perdido forca, mesmo com lucro flutuante. Posicao mantida como esta, sem reforco.`,
        };
      }

      const accountBalance = await getMt5AccountBalance(session.sessionId);
      const allocated = session.userConfig?.allocatedCapitalUsd;
      const balance = allocated != null ? Math.min(allocated, accountBalance) : accountBalance;
      const baseRiskPct = session.userConfig?.riskPerTradePct != null ? session.userConfig.riskPerTradePct / 100 : config.mt5RiskPctPerTrade;
      const stopDistancePct = Math.abs(fillPrice - position.stop_loss) / fillPrice;
      const riskUsd = balance * baseRiskPct;
      let lots = stopDistancePct > 0 ? riskUsd / stopDistancePct / (LOT_SIZE[position.symbol] * fillPrice) : 0;
      lots = Math.min(lots, config.mt5SafetyMaxLots);
      if (session.userConfig?.maxLotsPerTrade != null) lots = Math.min(lots, session.userConfig.maxLotsPerTrade);
      lots = Math.round(lots / MIN_LOTS) * MIN_LOTS;
      if (lots < MIN_LOTS) lots = MIN_LOTS;
      let addAmountUsd = lots * LOT_SIZE[position.symbol] * fillPrice;
      // Teto extra de seguranca, independente do calculo de risco acima:
      // o reforco nunca pode ser MAIOR que o lote original -- pyramiding
      // aumenta exposicao gradualmente, nunca dobra ou mais de uma vez so.
      if (addAmountUsd > position.quantity) {
        addAmountUsd = position.quantity;
      }
      const actualRiskUsd = addAmountUsd * stopDistancePct;
      const maxRiskUsd = balance * config.mt5MaxRiskPctPerTrade;
      if (actualRiskUsd > maxRiskUsd) {
        return {
          error: `Risco minimo possivel para reforcar ${position.symbol} ($${actualRiskUsd.toFixed(2)}) excede o teto de risco por trade desta conta ($${maxRiskUsd.toFixed(2)}). Reforco NAO aplicado.`,
        };
      }

      const correlatedGroup = getCorrelatedGroup(position.symbol);
      if (correlatedGroup.length > 1) {
        const sameSideGroupExposure = positions
          .filter((p) => correlatedGroup.includes(p.symbol) && p.side === position.side)
          .reduce((sum, p) => sum + Number(p.quantity), 0);
        const projectedExposure = sameSideGroupExposure + addAmountUsd;
        if (projectedExposure > config.mt5MaxCorrelatedNotionalUsd) {
          return {
            error:
              `Reforco de ${position.symbol} ($${addAmountUsd.toFixed(0)}) levaria a exposicao ${position.side} combinada do grupo correlacionado ` +
              `(${correlatedGroup.join("/")}) de $${sameSideGroupExposure.toFixed(0)} para $${projectedExposure.toFixed(0)}, acima do teto ` +
              `($${config.mt5MaxCorrelatedNotionalUsd}). Reforco NAO aplicado.`,
          };
        }
      }

      // Trava o stop pra breakeven-ou-melhor no MESMO movimento -- o lote
      // original nunca volta a ficar exposto por causa deste reforco.
      // Usa o entry_price ORIGINAL (pre-blend) + o custo do proprio spread
      // como piso de protecao real, nao so o preco cravado.
      const newStopLoss = position.side === "LONG"
        ? Math.max(position.stop_loss, position.entry_price + spreadAbs)
        : Math.min(position.stop_loss, position.entry_price - spreadAbs);

      const ok = await increaseMt5Position({
        tradeId,
        addAmountUsd,
        addFillPrice: fillPrice,
        newStopLoss,
        reasoningAppend: reasoning,
      });
      if (!ok) return { error: "Falha ao ampliar a posicao (ver log do processo)." };
      return {
        trade_id: tradeId,
        symbol: position.symbol,
        add_amount_usd: Number(addAmountUsd.toFixed(2)),
        add_fill_price: fillPrice,
        new_stop_loss: newStopLoss,
        fatores_confirmando: alignedFactors,
        reforcos_usados: position.pyramid_adds_count + 1,
        reforcos_maximo: MAX_PYRAMID_ADDS,
        aviso: "Stop movido para breakeven-ou-melhor -- o lote original nao volta a ficar exposto por causa deste reforco.",
      };
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
