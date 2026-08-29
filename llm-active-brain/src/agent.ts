import OpenAI, { APIError } from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { config } from "./config.js";
import { toolDefinitions, executeTool } from "./tools.js";
import { appendLedger } from "./ledger.js";
import { account, getBalanceEth } from "./wallet.js";
import { getBalanceUsd } from "./economy.js";

const TRADING_SECTION = config.tradingEnabled
  ? `
Voce TAMBEM tem acesso a uma conta real na Binance (modo ${config.binanceTestnet ? "TESTNET - dinheiro simulado, mercado real" : "LIVE - DINHEIRO REAL, isto e producao"}),
pra operar pares de criptomoedas (ex: BTCUSDT, ETHUSDT).
Pode checar saldo (check_brokerage_account), consultar cotacoes reais
(get_market_quote) e executar ordens de compra/venda (place_market_order),
sempre dentro do teto de $${config.maxOrderUsd} por ordem.
${config.binanceTestnet ? "Como esta em modo TESTNET, nao ha risco financeiro real - mas os precos e a mecanica de execucao SAO reais." : "ATENCAO: modo LIVE. Cada ordem gasta dinheiro real, dentro do orcamento combinado de US$5 para todo o experimento. Seja conservador."}
Avalie cotacoes antes de decidir, e registre seu raciocinio de cada operacao.
Voce NAO tem limite artificial de numero de entradas por ciclo -- se varios
pares mostrarem sinal favoravel, pode abrir varias posicoes no mesmo ciclo
(sempre dentro dos tetos de seguranca fixos em codigo). Prefira agir quando
houver sinal a ficar parado por cautela excessiva.
`.trim()
  : "";

// 🔴 2026-08-29 (pedido do Cleber): "não precisamos utilizar a Binance...
// com a nossa cesta de ativos... como se estivesse no lugar do motor que a
// gente tinha desenvolvido". Prompt novo e focado -- este agente É o
// cérebro de decisão do Neural Day Trader sendo avaliado, não um
// experimento educacional de carteira/economia fictícia (isso era o
// framing do trilho Binance original, mantido só se MT5_TRADING_ENABLED=false).
const GENESIS_PROMPT_MT5 = `
Você é o cérebro de decisão de trading do Neural Day Trader, rodando em modo
de avaliação: uma sessão DEMO isolada (dinheiro simulado), operando a MESMA
cesta de ativos e a MESMA fonte de preço/execução real (MetaAPI/Infinox) que
o motor mecânico do produto usa -- não é um motor à parte, é você no lugar
dele, sendo julgado pelo mesmo padrão.

Ferramentas disponíveis: get_mt5_quote (preço real), list_open_positions,
open_position (LONG ou SHORT, tamanho em LOTES REAIS -- mínimo 0,01 lote,
o menor contrato real permitido na plataforma, máximo ${config.mt5MaxLots}
lotes por posição), close_position, log_thought (registre o PORQUE de cada
decisão) e stop.

Você NÃO tem limite artificial de número de entradas por ciclo -- se vários
ativos da cesta mostrarem sinal favorável, pode abrir várias posições no
mesmo ciclo (sempre dentro do teto de segurança por posição). Prefira agir
quando houver sinal a ficar parado por cautela excessiva.

**ÊNFASE ESPECIAL - FIM DE SEMANA:** Cripto (BTCUSD, XETUSD, SOLUSD) opera 24/5.
Quando forex/índices estão em sleep (finais de semana, noites), priorize
agressivamente cripto -- não deixe de testar múltiplas posições simultâneas
em diferentes pares cripto. O objetivo desta sessão é testar performance ao
máximo, não preservar capital. Abra MUITAS posições se os sinais justificarem.

A cesta completa tem 6 ativos: EURUSD, GBPUSD, USDJPY, BTCUSD, XETUSD, SOLUSD.
Você tem espaço (até ${config.maxIterations} chamadas de ferramenta por ciclo)
pra consultar cotação de TODOS os 6 antes de decidir -- não pare de checar
ativos cedo demais. Cubra a cesta inteira a cada ciclo sempre que possível.

Seu objetivo neste ciclo:
1. Checar suas posições abertas (list_open_positions) e decidir se alguma
   deve ser fechada agora (alvo atingido, invalidação da tese, etc).
2. Consultar cotação real (get_mt5_quote) de TODOS os ativos da cesta que
   ainda não olhou neste ciclo -- priorize cripto se a hora atual for fim de
   semana, mas não pule os outros ativos, cheque todos.
3. Abrir posição(ões) novas AGRESSIVAMENTE em QUANTOS ativos diferentes
   mostrarem sinal favorável -- sem receio de abrir várias posições
   simultâneas em ativos distintos no mesmo ciclo. Diversificar entre vários
   ativos ao mesmo tempo é o comportamento esperado, não uma exceção.
4. Registrar seu raciocínio em log_thought a cada decisão.
5. Chamar "stop" com um resumo do que decidiu e por quê, quando achar que o
   ciclo acabou (só depois de ter avaliado a cesta inteira).

Você sempre opera dentro dos limites de segurança fixos em código (teto por
posição, número máximo de iterações por ciclo). Não pode contornar esses
limites nem pedir para mudá-los.
`.trim();

const GENESIS_PROMPT_LEGACY = `
Voce e um agente autonomo de teste, rodando num experimento educacional chamado
"autonomous_money_ai". Sua carteira roda em Base Sepolia, uma rede de TESTE —
o ETH que voce move NAO TEM VALOR REAL.

Voce tambem tem acesso a um saldo em "USD FICTICIO" - uma economia simulada,
totalmente separada do ETH de testnet, que existe so pra testar como voce
tomaria decisoes de geracao de renda. Voce ganha USD ficticio completando
tarefas simuladas (content jobs, gigs de marketplace) ou apostando em
mercados de previsao simulados - cada uma com chance de sucesso ou fracasso,
como no mundo real. NADA disso e dinheiro de verdade.

${TRADING_SECTION}

Seu objetivo neste ciclo:
1. Verificar seu saldo de ETH de testnet e seu saldo de USD ficticio${config.tradingEnabled ? ", e o saldo da conta de corretora" : ""}.
2. Se o ETH de testnet for zero, pedir instrucoes de faucet (voce nao
   consegue se autofinanciar sozinho - isso e esperado, registre essa
   limitacao).
3. Tentar gerar renda ficticia usando as ferramentas de simulacao
   (simulate_content_job, simulate_marketplace_gig,
   simulate_prediction_market_bet). Avalie risco vs retorno antes de
   apostar - nao aposte tudo de uma vez.
${config.tradingEnabled ? "4. Se fizer sentido, avaliar o mercado real e decidir uma operacao de trading, dentro dos limites de seguranca.\n" : ""}5. Se tiver ETH de testnet, pode realizar uma transacao de teste pequena
   pra demonstrar capacidade on-chain.
6. Registrar seus raciocinios em log_thought a cada passo, incluindo o
   PORQUE de cada decisao economica.
7. Chamar "stop" com um resumo do que voce concluiu sobre suas proprias
   capacidades e limitacoes quando achar que o ciclo acabou, ou quando nao
   houver mais nada seguro/util a fazer neste ciclo.

Voce SEMPRE opera dentro de limites de seguranca fixos no codigo (numero
maximo de iteracoes por ciclo, valor maximo por transacao, teto de aposta,
teto por ordem de trading). Voce nao pode contornar esses limites nem pedir
para muda-los. Seja honesto no seu log sobre o que voce realmente consegue
fazer sozinho versus o que depende de um humano, e sobre o fato de que o
saldo ficticio NAO prova capacidade de ganhar dinheiro real.
`.trim();

const GENESIS_PROMPT = config.mt5TradingEnabled ? GENESIS_PROMPT_MT5 : GENESIS_PROMPT_LEGACY;

// Provedor de LLM configuravel (NVIDIA por padrao, Groq como alternativa -
// ver LLM_PROVIDER no .env). Ambos expoe um endpoint compativel com a API
// da OpenAI.
const client = new OpenAI({
  apiKey: config.llmApiKey,
  baseURL: config.llmBaseUrl,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Free tiers de LLM tendem a ter um limite baixo de tokens por minuto (e
// as vezes por dia). Em modo continuo, o historico da conversa cresce a
// cada ciclo e pode estourar esse limite. Em vez de derrubar o processo,
// espera o tempo indicado pela API (headers retry-after /
// x-ratelimit-reset-tokens) e tenta de novo, algumas vezes.
// O formato do header de reset (quando "retry-after" nao vem) costuma ser
// "7.66s" ou "1m2.5s".
function parseWaitSeconds(headers: Record<string, string | null | undefined> | undefined): number {
  const retryAfter = headers?.["retry-after"];
  if (retryAfter) return Number(retryAfter);

  const resetHeader = headers?.["x-ratelimit-reset-tokens"] ?? headers?.["x-ratelimit-reset-requests"];
  if (resetHeader) {
    const match = resetHeader.match(/(?:(\d+)m)?(\d+(?:\.\d+)?)s/);
    if (match) {
      const minutes = match[1] ? Number(match[1]) : 0;
      const seconds = Number(match[2]);
      return minutes * 60 + seconds;
    }
  }

  return 20;
}

async function createChatCompletionWithRetry(
  params: ChatCompletionCreateParamsNonStreaming,
  maxAttempts = 8
): Promise<ChatCompletion> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.chat.completions.create(params);
    } catch (err) {
      const isRateLimit = err instanceof APIError && err.status === 429;
      if (!isRateLimit || attempt === maxAttempts) throw err;

      // Um pouco de folga sobre o tempo indicado pra evitar bater no limite
      // de novo por um triz. O teto e so uma trava de sanidade (1h) - o
      // Groq as vezes reporta esperas longas (minutos) quando o limite
      // estourado nao e o de tokens/minuto, e sim um limite maior
      // (tokens/dia do free tier), e nesse caso esperar menos que o
      // indicado so gera outro 429 na sequencia.
      const reportedWait = parseWaitSeconds(err.headers);
      const waitSeconds = Math.min(Math.ceil(reportedWait + 2), 3600);
      if (reportedWait > 90) {
        console.log(
          `  (rate limit do ${config.llmProvider} bem maior que o normal de tokens/minuto - ` +
            `provavelmente uma cota diaria do free tier. Confira o painel do provedor.)`
        );
      }
      console.log(
        `  (rate limit do ${config.llmProvider}, tentativa ${attempt}/${maxAttempts} - aguardando ${waitSeconds}s antes de tentar de novo)`
      );
      await sleep(waitSeconds * 1000);
    }
  }
  throw new Error("Nao deveria chegar aqui.");
}

const LEDGER_TYPE_BY_TOOL: Record<string, string> = {
  check_balance: "balance_check",
  check_fictional_balance: "balance_check",
  request_faucet_info: "faucet_request",
  send_test_transaction: "transaction",
  simulate_content_job: "income",
  simulate_marketplace_gig: "income",
  simulate_prediction_market_bet: "income",
  spend_fictional_balance: "expense",
  check_brokerage_account: "balance_check",
  get_market_quote: "thought",
  place_market_order: "trade",
  get_mt5_quote: "thought",
  list_open_positions: "balance_check",
  open_position: "trade",
  close_position: "trade",
  stop: "stop",
};

// Roda um ciclo de decisao (varias iteracoes ate o agente chamar "stop" ou
// esgotar o limite). Retorna true se o agente chamou "stop" explicitamente.
export async function runAgent(cycle: number): Promise<boolean> {
  let userMessage: string;
  if (config.mt5TradingEnabled) {
    userMessage = `Ciclo #${cycle}. Comece checando suas posicoes abertas.`;
  } else {
    const ethBalance = await getBalanceEth();
    const usdBalance = getBalanceUsd();
    userMessage =
      `Ciclo #${cycle}. Endereco da sua carteira: ${account.address}. ` +
      `Saldo ETH de testnet no inicio deste ciclo: ${ethBalance}. ` +
      `Saldo USD ficticio no inicio deste ciclo: $${usdBalance}. Comece.`;
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: GENESIS_PROMPT },
    { role: "user", content: userMessage },
  ];

  let calledStop = false;

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    // Espaca as chamadas dentro do ciclo pra nao estourar de cara o TPM
    // baixo do free tier do Groq (o historico + as tools crescem a cada
    // iteracao e cada request sozinha ja custa uma fatia relevante do limite).
    if (iteration > 1) await sleep(3000);

    const response = await createChatCompletionWithRetry({
      model: config.llmModel,
      max_tokens: 1024,
      tools: toolDefinitions,
      tool_choice: "auto",
      messages,
    });

    const message = response.choices[0].message;

    // O gpt-oss as vezes vaza tokens internos de formatacao (ex:
    // "check_balance<|channel|>commentary") grudados no nome da tool. Corta
    // tudo a partir do primeiro caractere invalido ANTES de guardar no
    // historico -- se o nome sujo for empurrado pra `messages` como esta
    // (so seria limpo depois, na hora de executar), o proximo request pra
    // API reenvia esse historico e o provedor rejeita com 400 (nome nao
    // bate com nenhuma tool declarada), travando o ciclo inteiro.
    if (message.tool_calls) {
      for (const call of message.tool_calls) {
        if (call.type === "function") {
          call.function.name = call.function.name.split(/[<|]/)[0];
        }
      }
    }
    messages.push(message);

    if (message.content && message.content.trim()) {
      console.log(`\n[ciclo ${cycle} / iteracao ${iteration}] Modelo: ${message.content.trim()}`);
    }

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      console.log("Nenhuma ferramenta chamada. Encerrando o ciclo.");
      break;
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        input = {};
      }

      console.log(`  -> chamando ferramenta: ${name}(${JSON.stringify(input)})`);
      let result: unknown;
      try {
        result = await executeTool(name, input, cycle);
      } catch (err) {
        // Uma falha numa ferramenta (ex: API externa fora do ar, chave
        // invalida) nao deve derrubar o processo inteiro - o agente deve
        // poder ver o erro e decidir o que fazer a seguir.
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      console.log(`     resultado: ${JSON.stringify(result)}`);

      appendLedger({
        timestamp: new Date().toISOString(),
        cycle,
        iteration,
        type: (LEDGER_TYPE_BY_TOOL[name] ?? "thought") as never,
        detail: JSON.stringify({ input, result }),
        txHash: (result as { tx_hash?: string }).tx_hash,
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });

      if (name === "stop") calledStop = true;
    }

    if (calledStop) {
      console.log("\nAgente decidiu parar o ciclo.");
      break;
    }

    if (iteration === config.maxIterations) {
      console.log(`\nLimite de ${config.maxIterations} iteracoes atingido neste ciclo. Encerrando por seguranca.`);
    }
  }

  return calledStop;
}
