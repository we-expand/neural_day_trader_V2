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
type LlmProvider = "nvidia" | "groq" | "cerebras" | "gemini" | "sambanova" | "ollama";

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
  // 2026-09-01 (achado ao vivo): todo provedor gratuito na nuvem (NVIDIA
  // aposentou o modelo em uso, Groq com teto de 8000 TPM + cota diaria curta
  // demais pro modo continuo) esbarrou em algum limite real no mesmo dia --
  // rodar local elimina cota/rate-limit por definicao (so usa CPU/GPU/RAM
  // da propria maquina, que ja roda este processo). Ollama expoe endpoint
  // compativel com a API da OpenAI em localhost:11434/v1, sem autenticacao
  // de verdade (apiKeyEnv aponta pra um valor fixo no .env so pra satisfazer
  // o SDK, o Ollama ignora). Qwen3 8B escolhido apos pesquisa (2026-09-01):
  // suporte nativo a tool-calling, ~4.9GB em Q4_K_M (cabe nos 16GB do Mac
  // M2 Pro que roda este processo), melhor equilibrio de raciocinio entre
  // as opcoes testadas pra esse tamanho de RAM.
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    // 🔴 2026-09-01 (achado ao vivo, critico): Ollama trunca o contexto em
    // ~2048 tokens por padrao (num_ctx), silenciosamente -- confirmado
    // mandando o prompt real (27K caracteres, ~8400 tokens) e recebendo de
    // volta "prompt_tokens":2050 (cortado) com o modelo raciocinando sobre
    // fragmentos soltos do prompt, sem entender o proprio papel. NUNCA usar
    // um nome de modelo Ollama "cru" (ex: "qwen3.5:4b") direto -- sempre um
    // modelo customizado com `PARAMETER num_ctx 16384` (Modelfile, criado
    // via `ollama create <nome> -f Modelfile`).
    // 🔴 2026-09-01 (troca pedido do Cleber: mais velocidade, cesta de 9
    // ativos precisa de ciclos mais rapidos): testado lado a lado com o
    // mesmo prompt real (8400 tokens) -- "qwen3-trading" (8B, Modelfile
    // dedicado) levou 58s na 1a chamada fria; "qwen35-trading" (Qwen3.5 4B,
    // mesmo esquema de Modelfile) levou 30s, ~2x mais rapido, raciocinio e
    // tool_call igualmente corretos no teste. Trocado pro mais rapido --
    // qwen3-trading continua criado no Ollama local como fallback de
    // qualidade se a velocidade deixar de ser a prioridade. Se recriar do
    // zero: `ollama pull qwen3.5:4b` + Modelfile com `FROM qwen3.5:4b` +
    // `PARAMETER num_ctx 16384`, depois `ollama create qwen35-trading -f
    // Modelfile.qwen35-trading`.
    model: "qwen35-trading",
    apiKeyEnv: "OLLAMA_API_KEY",
  },
};

const llmProvider = (process.env.LLM_PROVIDER || "nvidia") as LlmProvider;
if (!LLM_PROVIDER_DEFAULTS[llmProvider]) {
  throw new Error(`LLM_PROVIDER invalido: "${llmProvider}". Use "nvidia", "groq", "cerebras", "gemini", "sambanova" ou "ollama".`);
}
const llmProviderDefaults = LLM_PROVIDER_DEFAULTS[llmProvider];

export const config = {
  llmProvider,
  llmApiKey: requireEnv(llmProviderDefaults.apiKeyEnv),
  llmBaseUrl: process.env.LLM_BASE_URL || llmProviderDefaults.baseUrl,
  llmModel: process.env.LLM_MODEL || llmProviderDefaults.model,
  agentPrivateKey: requireEnv("AGENT_PRIVATE_KEY") as `0x${string}`,
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || undefined,
  // 🔴 2026-08-29 (pedido do Cleber): cesta de hoje tem 8 ativos (5 deles
  // novos, com missao explicita de reconhecimento no prompt -- ver
  // agent.ts) -- 15 -> 25 pra sobrar espaco real pra list_open_positions +
  // get_mt5_quote de cada um dos 8 + log_thought detalhado por ativo novo +
  // possiveis open_position/close_position + stop, sem esbarrar no teto.
  maxIterations: Number(process.env.MAX_ITERATIONS ?? 25),
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
  // 🔴 2026-08-31 (achado ao vivo, pedido do Cleber -- "quando perde, perde
  // pouco, quando ganha, ganha muito" / "não pode quebrar o caixa do
  // usuário"): mt5TargetNotionalUsd (notional FIXO em dólar, $1200-1800)
  // REMOVIDO -- nunca olhava o saldo real da conta. Numa conta de $50 isso
  // era 24x-36x de alavancagem implícita; um stop de só 0,79% sobre $1200
  // já produziu -$16,05 num único trade (quase 1/3 da conta), e o piso de
  // lote mínimo (MIN_LOTS) sozinho já força ~$780 de notional em BTCUSD
  // (0,01 lote * ~$78.000), incompatível com qualquer teto de risco
  // razoável pra uma conta pequena. Sizing agora é % de risco do SALDO REAL
  // (ver getMt5AccountBalance em neuralBridge.ts e open_position em
  // tools.ts): notional = (saldo_atual * risco%) / distância_do_stop%.
  // Risco default 1% do saldo em posição "normal" (≈$0,50 numa conta de
  // $50), mt5HeavyMultiplier (abaixo) escala o risco em "forte" (1,5% ≈
  // $0,75), nunca o notional direto. Alavanca de "mão mais pesada":
  // open_position aceita size:"forte", que multiplica o RISCO-alvo (não
  // mais o notional) por este fator.
  mt5HeavyMultiplier: Number(process.env.MT5_HEAVY_MULTIPLIER ?? 1.5),
  // Risco-alvo por trade em posição "normal", como fração do saldo REAL da
  // sessão (não do caixa total da plataforma, só desta conta/sessão MT5).
  // 1% numa conta de $50 = ~$0,50 de perda esperada se o stop bater --
  // cresce/encolhe automaticamente junto com o saldo real (ganhou, o
  // próximo risco em $ é maior; perdeu, encolhe), sem precisar reconfigurar
  // manualmente a cada patamar de conta.
  mt5RiskPctPerTrade: Number(process.env.MT5_RISK_PCT_PER_TRADE ?? 0.01),
  // Teto DURO de risco por trade (como fração do saldo real) -- se o lote
  // mínimo do símbolo (MIN_LOTS/LOT_SIZE em assetBasket.ts) força um risco
  // maior que isso mesmo no menor lote possível, open_position BLOQUEIA a
  // entrada em vez de abrir maior "porque o piso obriga" (achado real do
  // BTCUSD: 0,01 lote força ~$780 de notional, incompatível com risco
  // pequeno numa conta de $50 mesmo com stop apertado). 2x o risco "forte"
  // (1,5%) dá alguma folga pro arredondamento de MIN_LOTS sem abrir a porta
  // pra um risco descontrolado.
  mt5MaxRiskPctPerTrade: Number(process.env.MT5_MAX_RISK_PCT_PER_TRADE ?? 0.03),
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
  // 🔴 2026-08-30 (redesenho pós -$135 líquido / 1,7% de acerto, sessão
  // e7eef768): 1.5 -> 2.0. Diagnóstico via SQL direto (ver assetBasket.ts,
  // remoção de SOLUSD) confirmou dois problemas concorrentes com o desenho
  // "giro rápido" de 2026-08-29: (1) ZERO das 66 posições fechadas bateram
  // take-profit -- o alvo nunca é alcançado, só stop ou fechamento manual
  // (2) o stop apertado (0,2%-2%, R:R ~1:1,13) é vulnerável demais a ruído
  // de tick-a-tick + custo de spread pago 2x (entrada e saída), sem sobrar
  // margem real pra qualquer edge direcional que exista se expressar.
  // Voltando pro stop mais largo (respira mais o ruído) + alvo assimétrico
  // (ver mt5TakeProfitAtrMultiplier abaixo) -- MESMA convenção de R:R 1:2 que
  // o motor mecânico principal do produto já usa (CLAUDE.md, "stop sempre
  // 2×ATR").
  mt5StopAtrMultiplier: Number(process.env.MT5_STOP_ATR_MULTIPLIER ?? 2.0),
  // 🔴 2026-08-29 (pedido do Cleber, mudança de filosofia pós-otimizações do
  // dia): 3 -> 1.5 -- VOLTA a ser gatilho de saída MECÂNICO de verdade (ver
  // enforceMt5StopsAndTargets em neuralBridge.ts), mas agora com alvo CURTO
  // por design, não o teto de 2R que tinha sido removido antes. Pedido
  // explícito: "entra na operação, deixa correr um alvo pequeno, recolhe e
  // parte pra outra" -- em vez de tentar deixar um vencedor correr
  // indefinidamente com o trailing (o que só fez sentido enquanto havia
  // volume/tendência real sustentando o movimento), a estratégia agora é
  // giro: capturar um alvo pequeno e reciclar o capital pra próxima entrada.
  // 1.5x ATR = MESMA distância do stop (R:R ~1:1) -- alvo pequeno de
  // propósito, alcançável rápido, não uma aposta em tendência longa.
  //
  // 🔴 2026-08-29 (pedido do Cleber, mesmo dia): 1.5 -> 1.7, um pouco só, pra
  // já contemplar o SPREAD depois que entrada/saída passaram a preencher no
  // bid/ask real (ver mt5Broker.ts/tools.ts) em vez do mid -- sem esse
  // reajuste, o giro rapido bateria o alvo mas ainda saisse com PnL liquido
  // negativo (spread pago na entrada + na saida) mesmo "acertando" o alvo.
  // 🔴 2026-08-30 (mesmo redesenho): 1.7 -> 4.0. Com stop em 2.0x ATR (acima),
  // isso da R:R 1:2 (4.0/2.0) -- abandona deliberadamente a filosofia "giro
  // rápido, alvo curto" (testada de verdade em 66 trades reais na sessão
  // e7eef768, resultado: 0 TP hits, -$135 líquido, 1,7%-3% de acerto) em
  // favor do MESMO R:R que o motor mecânico principal já usa e que a
  // pesquisa de julho/agosto deste projeto já estabeleceu como a referência
  // de disciplina do produto (ver CLAUDE.md, "Cérebro de decisão da IA").
  // Alvo mais largo tambem sobra mais margem acima do custo de spread
  // pago 2x (entrada+saida) -- no desenho anterior, o spread sozinho podia
  // consumir uma fração grande demais de um alvo de 1,7% ATR.
  mt5TakeProfitAtrMultiplier: Number(process.env.MT5_TAKE_PROFIT_ATR_MULTIPLIER ?? 4.0),
  // 🔴 2026-08-30 (mesmo redesenho): 0.002 -> 0.003 -- piso um pouco mais
  // largo, margem extra de segurança contra whipsaw por ruído puro em
  // símbolo de volatilidade muito baixa (mesmo espírito do achado SOLUSD:
  // stop apertado demais bate por ruído antes de qualquer tese ter chance).
  mt5StopMinPct: Number(process.env.MT5_STOP_MIN_PCT ?? 0.003),
  mt5StopMaxPct: Number(process.env.MT5_STOP_MAX_PCT ?? 0.02),
  mt5StopFallbackPct: Number(process.env.MT5_STOP_FALLBACK_PCT ?? 0.005),
  // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, monitoramento pos-
  // redesenho R:R 1:2): 2 dos primeiros 3 trades reais (XRPUSD LONG) bateram
  // stop em 64s e 14s -- nao por movimento de preco, mas porque o stop
  // calculado (0,500% fallback) era MENOR que o proprio spread do ativo
  // (~1,47%). fillPrice = ask (LONG) e o preco de fechamento e o bid
  // (enforceMt5StopsAndTargets) -- se stopPct < spreadPct, a posicao ja
  // nasce abaixo do proprio stop, ANTES de qualquer movimento real. O aviso
  // de SPREAD ALTO em tools.ts so alertava sobre o ALVO precisar ser maior,
  // nunca sobre o STOP -- por isso o modelo raciocinava (errado) que R:R 1:2
  // "mitigava" o custo do spread. Fix: stop nunca fica menor que
  // spreadPct * mt5SpreadStopSafetyMultiplier (margem REAL alem do custo de
  // ida-e-volta do spread, nao so empatar) -- ver open_position em tools.ts.
  mt5SpreadStopSafetyMultiplier: Number(process.env.MT5_SPREAD_STOP_SAFETY_MULTIPLIER ?? 1.5),
  // 🔴 2026-09-02 (pedido direto do Cleber, achado ao vivo: alvo de 4x ATR
  // do EURUSD aberto na sessao 1d73c50a pedia 0,71% de movimento com a
  // resistencia real a so 0,08% de distancia -- alvo cego a estrutura real
  // do preco, quase impossivel de alcancar sem romper o nivel primeiro).
  // O alvo (takeProfitPct, calculado por ATR acima) agora e CAPADO pela
  // distancia real ate o proximo suporte/resistencia (getSupportResistance
  // em atr.ts, mesmo candle oficial que MACD/Estocastico ja usam) na
  // direcao do trade -- nunca pede pro preco correr alem do nivel real mais
  // proximo. Aplica pra TODOS os ativos da cesta (nao so EURUSD), sempre
  // que houver candle real suficiente pra calcular o nivel; sem candle real
  // (null), mantem o comportamento antigo (ATR puro), nunca fabrica nivel.
  // Fator abaixo mira LOGO ANTES do nivel (nao em cima dele), pra ter mais
  // chance de preencher antes de uma rejeicao/reversao no proprio nivel.
  mt5SrTargetMarginPct: Number(process.env.MT5_SR_TARGET_MARGIN_PCT ?? 0.9),
  // Se o teto de suporte/resistencia deixar o alvo com R:R pior que isto
  // (nivel real perto demais pra dar espaco decente acima do stop), a
  // entrada e RECUSADA em vez de aceitar uma aposta com risco/retorno ruim
  // so porque "o ATR mandou entrar" -- mesmo espirito do gate de spread
  // acima (nao abre posicao com matematica desfavoravel de partida).
  mt5MinRrAfterSrCap: Number(process.env.MT5_MIN_RR_AFTER_SR_CAP ?? 1.0),
  // 🔴 2026-08-29 (mesmo pedido): "ela não pode ter alvos longos num dia em
  // que o dia não tem volume" -- em dia/momento de baixa participação (ver
  // getVolumeConfirmation em atr.ts, proxy real de tickVolume da MetaAPI), o
  // alvo normal ainda pode ser grande demais pra esse ativo alcançar rápido.
  // Quando o volume recente está ABAIXO da própria média de 1h (ratio < 1,
  // não é "elevated"), o alvo (não o stop -- risco continua igual) encolhe
  // por este fator extra na abertura da posição (tools.ts open_position).
  mt5LowVolumeTakeProfitMultiplier: Number(process.env.MT5_LOW_VOLUME_TAKE_PROFIT_MULTIPLIER ?? 0.6),
  // 🔴 2026-08-29 (pedido do Cleber): breakeven MECÂNICO -- assim que o
  // preço andar a favor `mt5BreakevenTriggerR` vezes a distância original do
  // stop (0.5 = meio caminho até bater o stop, na direção contrária), o
  // código move o stop_loss pro preço de entrada. Dali em diante o pior
  // caso da posição vira ~$0 em vez do stop cheio -- mesmo espírito do
  // "breakeven em 0,5R" que o motor mecânico já usa (ver CLAUDE.md,
  // 2026-08-28). Só anda pra frente (nunca afrouxa um stop já em
  // breakeven) -- ver enforceMt5StopsAndTargets em neuralBridge.ts.
  mt5BreakevenTriggerR: Number(process.env.MT5_BREAKEVEN_TRIGGER_R ?? 0.5),
  // 🔴 2026-08-30 (achado ao vivo, pedido explicito do Cleber -- "chegou a
  // ganhar $3, saiu a -$0,10, isso nao pode acontecer"): o trailing em
  // enforceMt5StopsAndTargets usava a MESMA distancia do stop de abertura
  // (mt5StopAtrMultiplier, 2.0x ATR) pro trailing continuo pos-breakeven.
  // Como o breakeven dispara com so mt5BreakevenTriggerR (0.5x = 1x ATR de
  // lucro), existia uma faixa morta entre 1x e 2x ATR de lucro em que o
  // trailing calculado (preco - 2x ATR) NUNCA ficava mais protetor que o
  // breakeven (preco de entrada) -- o stop simplesmente nao subia, apesar do
  // preco continuar correndo a favor. Foi exatamente o caso real: BTCUSD
  // SHORT chegou a +$3 (dentro dessa faixa morta), reverteu, e foi fechado
  // no breakeven + custo de spread (-$0,19) sem nunca ter protegido nenhum
  // fragmento do lucro que passou por ali. Multiplicador dedicado, mais
  // apertado que o stop inicial, faz o trailing comecar a proteger lucro
  // real assim que o preco sair do breakeven, em vez de exigir dobrar a
  // distancia do stop original antes de mexer. Sem validacao estatistica de
  // que isso melhora o liquido -- e correcao de mecanica de protecao de
  // lucro, nao alegacao de edge.
  mt5TrailAtrMultiplier: Number(process.env.MT5_TRAIL_ATR_MULTIPLIER ?? 0.8),
  // Teto ABSOLUTO de segurança em notional -- desde 2026-08-31 (sizing por %
  // de risco do saldo real, ver mt5RiskPctPerTrade acima) o notional
  // calculado normalmente fica bem abaixo disto (dezenas de dólares numa
  // conta de $50) -- este valor é só um sanity check de última instância
  // contra cálculo degenerado (ex: preço anormalmente baixo fazendo o lote
  // explodir), não um alvo de operação.
  mt5MaxNotionalUsd: Number(process.env.MT5_MAX_NOTIONAL_USD ?? 2200),
  // 🔴 2026-08-29 (otimização urgente pós-perda do dia: -$119 realizados,
  // 96% concentrados em 56 trades depois do aumento de exposição/remoção do
  // teto de TP). Achado real no log de trades: BTCUSD, XETUSD e SOLUSD são
  // cripto correlacionada (mesmo regime de mercado) -- o agente empilhou
  // SHORT nos 3 ao mesmo tempo (até o teto de 3/símbolo em cada um) bem no
  // meio de um rali de horas que atingiu os 3 juntos, o que é UMA aposta
  // direcional triplicada, não 3 independentes. Este teto limita a exposição
  // TOTAL do mesmo lado (LONG ou SHORT) somada em todo o grupo correlacionado
  // (ver getCorrelatedGroup em assetBasket.ts) -- 2x o "forte" de um símbolo
  // sozinho dá espaço real pra operar mais de um ativo do grupo sem permitir
  // a mesma aposta triplicada de hoje.
  mt5MaxCorrelatedNotionalUsd: Number(process.env.MT5_MAX_CORRELATED_NOTIONAL_USD ?? 2700),
  // 🔴 2026-08-29 (mesma otimização): circuito de perda consecutiva por
  // símbolo+lado. Achado real: o agente reabriu SHORT em SOLUSD/XETUSD/BTCUSD
  // repetidamente (a cada poucos minutos) mesmo depois de perder no MESMO
  // lado, no MESMO símbolo, contra uma tendência que já tinha virado contra
  // ele -- sem nenhum mecanismo que o fizesse parar e reavaliar. Depois de
  // `mt5LossStreakThreshold` fechamentos consecutivos por STOP_LOSS no mesmo
  // símbolo+lado, novas entradas nesse símbolo+lado ficam bloqueadas por
  // `mt5LossStreakCooldownMinutes` -- o lado oposto (ou outro símbolo)
  // continua livre, isso não pausa o agente inteiro, só impede reentrar
  // teimosamente numa mesma tese que acabou de ser invalidada 2x seguidas.
  // 🔴 2026-08-30 (pedido do Cleber, monitoramento ao vivo): afrouxado um
  // pouco -- threshold 2->3 e cooldown 30->20min. Motivo: com threshold=2 a
  // cesta inteira (10 ativos) ficou 1h+ com so 1 posicao aberta porque quase
  // todo simbolo tinha acabado de bater 2 perdas seguidas em algum lado e
  // ficava travado por meia hora, mesmo com sinal novo aparecendo. Ainda e
  // uma trava real (3 perdas seguidas no mesmo simbolo+lado ainda bloqueia),
  // so um pouco menos agressiva. Sem validacao estatistica de que isso
  // melhora o resultado liquido -- e afrouxamento de frequencia, nao alegacao
  // de edge.
  // 🔴 2026-08-31 (ajuste pós-paralisia): 3->5 (threshold) e 20->5min (cooldown).
  // Razão: com threshold=3, apenas 3 perdas consecutivas já bloqueavam o ativo
  // por 20min, deixando o agente paralisado. Novo: 5 perdas pra ativar bloqueio,
  // e só 5min de espera (Fase 2: menos conservador, mais experimental).
  mt5LossStreakThreshold: Number(process.env.MT5_LOSS_STREAK_THRESHOLD ?? 5),
  mt5LossStreakCooldownMinutes: Number(process.env.MT5_LOSS_STREAK_COOLDOWN_MINUTES ?? 5),
  // Ponte pro Neural Day Trader: grava cada posição aberta/fechada pelo
  // agente como trade virtual isolado em ai_trades/ai_sessions daquele
  // projeto, pra aparecer na plataforma (Dashboard) em vez de só no ledger
  // local deste repo. Nunca bloqueia nem derruba o agente se falhar.
  neuralBridgeEnabled: process.env.NEURAL_BRIDGE_ENABLED === "true",
  neuralSupabaseUrl: process.env.NEURAL_SUPABASE_URL ?? "",
  neuralSupabaseAnonKey: process.env.NEURAL_SUPABASE_ANON_KEY ?? "",
  neuralSupabaseServiceRoleKey: process.env.NEURAL_SUPABASE_SERVICE_ROLE_KEY ?? "",
  neuralUserId: process.env.NEURAL_USER_ID ?? "",
  // 🔴 2026-08-30 (pedido do Cleber): camada de validacao SEMANTICA do
  // reasoning, alem da trava por palavra-chave (NEGATION_CUES/REVERSAL_CUES
  // em tools.ts). Achado real da sessao: 3 variacoes diferentes de
  // contradicao ("como teste", "ainda nao ocorreu", "nao ha razao para
  // entrar") apareceram na MESMA sessao e precisaram ser adicionadas uma a
  // uma na lista fixa -- ela nunca cobre todas as formas possiveis do
  // modelo se contradizer em linguagem natural. Ver reasoningValidator.ts.
  // Desligavel sem custo nenhum (nao chama API nenhuma quando false).
  mt5ReasoningValidatorEnabled: (process.env.MT5_REASONING_VALIDATOR_ENABLED ?? "true") === "true",
  // 🔴 2026-08-30: nao existe hoje, em nenhum provedor ja configurado neste
  // projeto (ver LLM_PROVIDER_DEFAULTS acima), um modelo obviamente mais
  // barato/rapido que o principal disponivel pronto pra uso -- default cai
  // pro MESMO modelo do cerebro principal (llmModel) como fail-safe.
  // Limitacao conhecida: isso NAO garante que o validador seja mais
  // barato/rapido que a decisao principal, so garante que funciona com a
  // mesma chave/endpoint ja configurados. Trocar via env var assim que um
  // modelo mais leve for confirmado disponivel no provedor em uso.
  mt5ReasoningValidatorModel: process.env.MT5_REASONING_VALIDATOR_MODEL || process.env.LLM_MODEL || llmProviderDefaults.model,
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
