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
// Groq por 403 misterioso, e Groq -> NVIDIA por cota diaria curta demais
// pro modo continuo - ver CONTEXT.md).
type LlmProvider = "nvidia" | "groq";

const LLM_PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string; apiKeyEnv: string }> = {
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    // Mesmo modelo usado no Groq - o NVIDIA API Catalog tambem hospeda
    // openai/gpt-oss-120b, e o codigo ja sanitiza o vazamento de tokens
    // Harmony dele (ver agent.ts). "meta/llama-3.3-70b-instruct" nao
    // existe mais no catalogo (confirmado via GET /v1/models -> 410).
    model: "openai/gpt-oss-120b",
    apiKeyEnv: "NVIDIA_API_KEY",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    apiKeyEnv: "GROQ_API_KEY",
  },
};

const llmProvider = (process.env.LLM_PROVIDER || "nvidia") as LlmProvider;
if (!LLM_PROVIDER_DEFAULTS[llmProvider]) {
  throw new Error(`LLM_PROVIDER invalido: "${llmProvider}". Use "nvidia" ou "groq".`);
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
  // Trading real/testnet via Binance. Tudo opcional - so exigido se
  // ENABLE_TRADING=true (o agente so ganha as ferramentas de trading
  // quando isso esta ligado).
  tradingEnabled: process.env.ENABLE_TRADING === "true",
  binanceApiKey: process.env.BINANCE_API_KEY ?? "",
  binanceSecretKey: process.env.BINANCE_SECRET_KEY ?? "",
  // TESTNET (dinheiro simulado) e o padrao. So vira LIVE (dinheiro real) se
  // a pessoa explicitamente setar BINANCE_TESTNET=false no .env.
  binanceTestnet: process.env.BINANCE_TESTNET !== "false",
  // 5 e o valor minimo tipico de ordem na Binance (varia por par) - abaixo
  // disso, quase toda ordem e recusada com "Filter failure: NOTIONAL".
  maxOrderUsd: Number(process.env.MAX_ORDER_USD ?? 5),
  maxLiveBudgetUsd: Number(process.env.MAX_LIVE_BUDGET_USD ?? 5),
  // Ponte opcional pro Neural Day Trader: espelha cada ordem executada aqui
  // (fill real de Binance, testnet ou live) como um trade virtual isolado
  // em ai_trades/ai_sessions daquele projeto, pra o resultado aparecer na
  // plataforma (Dashboard) em vez de so no ledger local deste repo. Nunca
  // bloqueia nem derruba o agente se falhar - e so espelhamento.
  neuralBridgeEnabled: process.env.NEURAL_BRIDGE_ENABLED === "true",
  neuralSupabaseUrl: process.env.NEURAL_SUPABASE_URL ?? "",
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
if (config.maxCycles > 1000) {
  // Trava dura contra loop continuo sem fim: 1000 ciclos ja e um teto
  // generoso pra um experimento educacional.
  throw new Error("MAX_CYCLES acima do teto permitido (1000).");
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
