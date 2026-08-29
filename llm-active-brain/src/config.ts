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
  // 🔴 2026-08-29 (pedido do Cleber): 30 -> 10, pra reduzir o tempo de reacao
  // da LLM em relacao ao mercado -- boa parte dos 30s antigos era espera
  // ociosa (a chamada ao Nemotron responde em ~0.7s, o ciclo inteiro com
  // poucas iteracoes de tool-calling termina bem antes do delay configurado).
  // Risco monitorado: cota de free tier do provedor de LLM (ja trocamos de
  // provedor 5x por esgotamento de cota, ver LLM_PROVIDER acima) -- se
  // aparecerem 429 recorrentes no log apos essa mudanca, e sinal de subir
  // esse valor de novo.
  cycleDelaySeconds: Number(process.env.CYCLE_DELAY_SECONDS ?? 10),
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
  // 🔴 2026-08-29 (pedido do Cleber): sizing por EXPOSIÇÃO-ALVO EM DÓLAR,
  // não mais lotes livres escolhidos pelo LLM. Causa raiz do achado
  // "SOL/XET capturam muito pouco $": o LLM escolhia um número de lotes
  // (0,01-0,02) igual pra qualquer símbolo, sem noção de que 0,02 lote de
  // BTCUSD (~$77.600) e 0,02 lote de SOLUSD (~$103) são exposições em dólar
  // MUITO diferentes (LOT_SIZE=1 pros 3 -- ver assetBasket.ts). O código
  // agora calcula o lote sozinho: lots = mt5TargetNotionalUsd / (LOT_SIZE *
  // preço), arredondado pro incremento mínimo (MIN_LOTS) -- SOL/XET passam
  // a abrir MUITO mais lotes que antes pra alcançar o MESMO $ de exposição
  // que o BTC, exatamente o "entrar com a mão mais pesada" pedido. BTCUSD
  // já bate perto do alvo com o próprio lote mínimo (0,01 ≈ $775-780), então
  // não muda muito pra ele -- o alvo foi calibrado logo acima disso de
  // propósito, pra não forçar BTC pra baixo do menor contrato real.
  //
  // 🔴 2026-08-29 (pedido do Cleber, mesmo dia): subido 800 -> 1200 pra
  // "entrar com a mão um pouco mais forte, nos ativos em geral" -- aumenta o
  // $ de exposição de toda posição nova (normal e forte) proporcionalmente
  // em qualquer símbolo da cesta, sem mexer em stop/alvo/breakeven/trailing
  // (só o tamanho, não a lógica de saída). mt5MaxNotionalUsd reajustado junto
  // pra manter a mesma margem de segurança acima do "forte".
  mt5TargetNotionalUsd: Number(process.env.MT5_TARGET_NOTIONAL_USD ?? 1200),
  // Alavanca de "mão mais pesada": open_position aceita size:"forte", que
  // multiplica a exposição-alvo por este fator (aplicado a QUALQUER
  // símbolo, mantendo a equiparação entre eles).
  mt5HeavyMultiplier: Number(process.env.MT5_HEAVY_MULTIPLIER ?? 1.5),
  // Teto absoluto de segurança em lotes (sanity check contra valor
  // degenerado, ex: preço anormalmente baixo fazendo o cálculo explodir) --
  // não é o valor normal de operação, é só uma trava de última instância.
  mt5SafetyMaxLots: Number(process.env.MT5_SAFETY_MAX_LOTS ?? 20),
  // 🔴 2026-08-29 (achado da auditoria pós-noite): o "stop" e o "alvo" antes
  // só existiam como texto no prompt (GENESIS_PROMPT_MT5) -- o LLM decidia a
  // cada ciclo se fechava, e pelo menos 2x deixou a perda correr MUITO além
  // do alvo declarado (0.5%) antes de agir: uma posição BTCUSD chegou a
  // -3.5% (-$5,96, sozinha quase o prejuízo líquido da noite inteira) e
  // outra a -3.5%/-$3,50 (ver SESSAO_2026-08-29_AUDITORIA_...). Estes dois
  // valores agora viram um stop/alvo MECÂNICO (preço gravado no trade na
  // abertura, fechado por código -- ver enforceMt5StopsAndTargets em
  // neuralBridge.ts), não sugestão pro modelo.
  //
  // 🔴 2026-08-29 (pedido do Cleber, mesma sessão): % fixo virou DINÂMICO --
  // calculado por símbolo a partir do ATR real (ver atr.ts), não um número
  // igual pra BTCUSD/XETUSD/SOLUSD independente da volatilidade de cada um.
  // stopLoss = ATR% * mt5StopAtrMultiplier, takeProfit = ATR% *
  // mt5TakeProfitAtrMultiplier (2x o do stop -- mesmo espírito de R:R de
  // pelo menos 1:2 que o motor mecânico já usa, "stop sempre 2×ATR" no
  // CLAUDE.md, aqui o stop e 1.5x ATR e o alvo 3x ATR, R:R 1:2). Clamps
  // (mt5StopMinPct/mt5StopMaxPct) evitam stop degenerado (ATR indisponível,
  // símbolo anormalmente parado ou anormalmente errático) -- fora desse
  // range, ou se o ATR não vier de dado real, cai pro mt5StopFallbackPct
  // fixo (mesmo valor que era o único modo antes), nunca fica sem stop.
  mt5StopAtrMultiplier: Number(process.env.MT5_STOP_ATR_MULTIPLIER ?? 1.5),
  mt5TakeProfitAtrMultiplier: Number(process.env.MT5_TAKE_PROFIT_ATR_MULTIPLIER ?? 3),
  mt5StopMinPct: Number(process.env.MT5_STOP_MIN_PCT ?? 0.002),
  mt5StopMaxPct: Number(process.env.MT5_STOP_MAX_PCT ?? 0.02),
  mt5StopFallbackPct: Number(process.env.MT5_STOP_FALLBACK_PCT ?? 0.005),
  // 🔴 2026-08-29 (pedido do Cleber): breakeven MECÂNICO -- assim que o
  // preço andar a favor `mt5BreakevenTriggerR` vezes a distância original do
  // stop (0.5 = meio caminho até bater o stop, na direção contrária), o
  // código move o stop_loss pro preço de entrada. Dali em diante o pior
  // caso da posição vira ~$0 em vez do stop cheio -- mesmo espírito do
  // "breakeven em 0,5R" que o motor mecânico já usa (ver CLAUDE.md,
  // 2026-08-28). Só anda pra frente (nunca afrouxa um stop já em
  // breakeven) -- ver enforceMt5StopsAndTargets em neuralBridge.ts.
  mt5BreakevenTriggerR: Number(process.env.MT5_BREAKEVEN_TRIGGER_R ?? 0.5),
  // 🔴 2026-08-29 (achado da auditoria, recalibrado no mesmo dia): teto
  // ABSOLUTO de segurança (mesmo em size:"forte") -- precisa ficar
  // folgadamente ACIMA de mt5TargetNotionalUsd * mt5HeavyMultiplier (senão
  // o próprio "mão pesada" fica bloqueado) e acima do que MIN_LOTS de
  // BTCUSD já produz sozinho (~$775-780) -- um valor de $60 aqui (tentativa
  // anterior, mesmo dia) deixaria o BTCUSD incapaz de abrir QUALQUER
  // posição, mesmo no menor lote possível. 1500 dá margem confortável acima
  // do alvo "forte" (800*1.5=1200) e do maior valor histórico observado.
  //
  // 🔴 2026-08-29 (mesmo dia, junto com o aumento de mt5TargetNotionalUsd
  // 800->1200): reajustado 1500 -> 2200 pra manter a MESMA margem
  // proporcional acima do novo "forte" (1200*1.5=1800) -- sem isso, o
  // próprio teto de segurança bloquearia o "mão mais forte" pedido.
  mt5MaxNotionalUsd: Number(process.env.MT5_MAX_NOTIONAL_USD ?? 2200),
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
