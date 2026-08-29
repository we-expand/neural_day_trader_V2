import "dotenv/config";
import { baseSepolia } from "viem/chains";

// Guardrail de design: este projeto so conhece uma chain, e e testnet.
// Nao existe opcao de configurar mainnet aqui de proposito.
export const CHAIN = baseSepolia;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variavel de ambiente ${name} ausente. Copie .env.example para .env e preencha.`
    );
  }
  return value;
}

// Provedor de LLM: endpoint compativel com a API da OpenAI, trocavel por
// env var pra nao depender de um unico free tier (ja migramos NVIDIA ->
// Groq por 403 misterioso, Groq -> NVIDIA por cota diaria curta demais pro
// modo continuo, NVIDIA de volta -> Groq/Cerebras em 2026-08-29 quando o
// endpoint de chat completions da NVIDIA ficou fora do ar, Groq -> Gemini
// no mesmo dia quando a cota diaria do Groq esgotou de novo mesmo com
// modelo menor, e Gemini -> SambaNova quando nem Cerebras (pede cartao) nem
// Gemini (conta Google do Cleber bloqueada) deram certo - ver CONTEXT.md).
type LlmProvider = "nvidia" | "groq" | "cerebras" | "gemini" | "sambanova";

const LLM_PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string; apiKeyEnv: string }> = {
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    // 🔴 2026-08-29 (achado do Cleber): "openai/gpt-oss-120b" especificamente
    // trava o endpoint de chat completions da NVIDIA (testado 2x, HTTP 000
    // apos 25-60s, sem resposta nenhuma). NAO e a API da NVIDIA fora do ar
    // -- o NEXUS (nexus-brain) usa a MESMA API com OUTRO modelo e funciona
    // normal. Trocado pro mesmo modelo do NEXUS, testado e confirmado (HTTP
    // 200, ~0.7s, tool-calling funcionando): "nvidia/nemotron-3-nano-30b-a3b".
    model: "nvidia/nemotron-3-nano-30b-a3b",
    apiKeyEnv: "NVIDIA_API_KEY",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    apiKeyEnv: "GROQ_API_KEY",
  },
  // 2026-08-29: Cerebras hospeda o MESMO modelo (openai/gpt-oss-120b) com
  // free tier de cota diaria bem maior que o do Groq pra esse modelo,
  // pensado pra inferencia continua/alta frequencia. Precisa de conta
  // gratuita em cloud.cerebras.ai (chave gerada la, nao pode ser criada por
  // automacao).
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1",
    model: "gpt-oss-120b",
    apiKeyEnv: "CEREBRAS_API_KEY",
  },
  // 2026-08-29: Google AI Studio (nao Vertex AI/GCP billing) -- tier
  // gratuito historicamente NAO pede cartao de credito (confirmado pelo
  // Cleber que o Cerebras pedia, Gemini via aistudio.google.com nao pede).
  // Endpoint compativel com a API da OpenAI, cota bem mais folgada que o
  // free tier do Groq pro modelo Flash.
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
  },
  // 2026-08-29: SambaNova Cloud -- historicamente sem cartao de credito no
  // tier gratuito (cloud.sambanova.ai), endpoint compativel com OpenAI,
  // hospeda modelos abertos com tool-calling (Llama 3.3 70B confirmado
  // suportado na doc oficial deles). Confirmar o nome exato do modelo via
  // GET /v1/models com a chave real antes de rodar em modo continuo --
  // catalogo deles muda; "Meta-Llama-3.3-70B-Instruct" e o nome documentado
  // no momento desta escrita, pode ter mudado.
  sambanova: {
    baseUrl: "https://api.sambanova.ai/v1",
    model: "Meta-Llama-3.3-70B-Instruct",
    apiKeyEnv: "SAMBANOVA_API_KEY",
  },
};

const llmProvider = (process.env.LLM_PROVIDER || "nvidia") as LlmProvider;
if (!LLM_PROVIDER_DEFAULTS[llmProvider]) {
  throw new Error(`LLM_PROVIDER invalido: "${llmProvider}". Use "nvidia", "groq", "cerebras", "gemini" ou "sambanova".`);
}
const llmProviderDefaults = LLM_PROVIDER_DEFAULTS[llmProvider];

export const config = {
  llmProvider,
  llmApiKey: requireEnv(llmProviderDefaults.apiKeyEnv),
  llmBaseUrl: process.env.LLM_BASE_URL || llmProviderDefaults.baseUrl,
  llmModel: process.env.LLM_MODEL || llmProviderDefaults.model,
  agentPrivateKey: requireEnv("AGENT_PRIVATE_KEY") as `0x${string}`,
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || undefined,
  maxIterations: Number(process.env.MAX_ITERATIONS ?? 15),
  maxTxValueEth: Number(process.env.MAX_TX_VALUE_ETH ?? 0.0002),
  // Modo continuo: roda varios ciclos de decisao em sequencia, ate atingir
  // maxCycles ou uma condicao de parada (sem saldo em nenhuma das duas
  // "moedas" por rodadas consecutivas).
  continuousMode: process.env.CONTINUOUS_MODE === "true",
  cycleDelaySeconds: Number(process.env.CYCLE_DELAY_SECONDS ?? 30),
  maxCycles: Number(process.env.MAX_CYCLES ?? 100),
  // 🔴 2026-08-29 (pedido do Cleber): "não precisamos utilizar a Binance...
  // com a nossa cesta de ativos... como se estivesse no lugar do motor que a
  // gente tinha desenvolvido". A partir daqui o agente opera sobre a MESMA
  // cesta/preço/execução do motor mecânico do Neural Day Trader (MT5 via
  // Infinox, ver mt5Broker.ts) — Binance/cripto deixa de ser usado por
  // padrão (código antigo mantido só pro experimento já rodado, não apagado).
  tradingEnabled: process.env.ENABLE_TRADING === "true",
  binanceApiKey: process.env.BINANCE_API_KEY ?? "",
  binanceSecretKey: process.env.BINANCE_SECRET_KEY ?? "",
  binanceTestnet: process.env.BINANCE_TESTNET !== "false",
  maxOrderUsd: Number(process.env.MAX_ORDER_USD ?? 5),
  maxLiveBudgetUsd: Number(process.env.MAX_LIVE_BUDGET_USD ?? 5),
  // Trading MT5 (cesta real do motor mecânico) — ligado por padrão. Único
  // caminho de trading real deste agente a partir de 2026-08-29.
  mt5TradingEnabled: process.env.MT5_TRADING_ENABLED !== "false",
  // 🔴 2026-08-29: teto em LOTES (0,01 = menor contrato real permitido,
  // confirmado pelo Cleber), não mais em dólares fixos -- ver assetBasket.ts
  // pro porquê (um valor fixo em dólar não respeita o tamanho real de
  // contrato de cada símbolo).
  mt5MaxLots: Number(process.env.MT5_MAX_LOTS ?? 0.02),
  // Ponte pro Neural Day Trader: grava cada posição aberta/fechada pelo
  // agente como trade virtual isolado em ai_trades/ai_sessions daquele
  // projeto, pra aparecer na plataforma (Dashboard) em vez de só no ledger
  // local deste repo. Nunca bloqueia nem derruba o agente se falhar.
  neuralBridgeEnabled: process.env.NEURAL_BRIDGE_ENABLED === "true",
  neuralSupabaseUrl: process.env.NEURAL_SUPABASE_URL ?? "",
  neuralSupabaseAnonKey: process.env.NEURAL_SUPABASE_ANON_KEY ?? "",
  neuralSupabaseServiceRoleKey: process.env.NEURAL_SUPABASE_SERVICE_ROLE_KEY ?? "",
  neuralUserId: process.env.NEURAL_USER_ID ?? "",
};

if (!Number.isFinite(config.maxIterations) || config.maxIterations <= 0) {
  throw new Error("MAX_ITERATIONS precisa ser um numero positivo.");
}
if (!Number.isFinite(config.maxTxValueEth) || config.maxTxValueEth <= 0) {
  throw new Error("MAX_TX_VALUE_ETH precisa ser um numero positivo.");
}
if (config.maxTxValueEth > 0.01) {
  // Trava dura: mesmo que alguem edite o .env, o codigo nao deixa passar
  // de uma fracao minima de ETH de testnet por transacao.
  throw new Error(
    "MAX_TX_VALUE_ETH acima do teto permitido (0.01). Isso e testnet, nao precisa de mais que isso."
  );
}
if (!Number.isFinite(config.cycleDelaySeconds) || config.cycleDelaySeconds < 5) {
  throw new Error("CYCLE_DELAY_SECONDS precisa ser um numero >= 5.");
}
if (!Number.isFinite(config.maxCycles) || config.maxCycles <= 0) {
  throw new Error("MAX_CYCLES precisa ser um numero positivo.");
}
if (config.maxCycles > 20_000) {
  // 🔴 2026-08-29 (pedido do Cleber): rodar o fim de semana inteiro
  // (sexta-noite -> segunda-manhã, ~60h) com CYCLE_DELAY_SECONDS=30 precisa
  // de bem mais que os 1000 ciclos originais (~20 000 cobrem folgadamente
  // mesmo com iterações mais longas por ciclo). Teto subiu de 1000 -> 20 000,
  // mas continua sendo uma trava dura -- nunca vira loop realmente infinito.
  throw new Error("MAX_CYCLES acima do teto permitido (20000).");
}
if (config.tradingEnabled) {
  if (!config.binanceApiKey || !config.binanceSecretKey) {
    throw new Error(
      "ENABLE_TRADING=true mas BINANCE_API_KEY/BINANCE_SECRET_KEY nao estao preenchidos no .env."
    );
  }
  if (!Number.isFinite(config.maxOrderUsd) || config.maxOrderUsd <= 0) {
    throw new Error("MAX_ORDER_USD precisa ser um numero positivo.");
  }
  if (!Number.isFinite(config.maxLiveBudgetUsd) || config.maxLiveBudgetUsd <= 0) {
    throw new Error("MAX_LIVE_BUDGET_USD precisa ser um numero positivo.");
  }
  if (config.maxLiveBudgetUsd > 5) {
    // Trava dura: o orcamento combinado pra este experimento e US$5. Nenhuma
    // variavel de ambiente consegue ultrapassar isso em modo LIVE.
    throw new Error(
      "MAX_LIVE_BUDGET_USD acima do teto combinado para este experimento (US$5)."
    );
  }
  if (config.maxOrderUsd > config.maxLiveBudgetUsd) {
    throw new Error("MAX_ORDER_USD nao pode ser maior que MAX_LIVE_BUDGET_USD.");
  }
}
