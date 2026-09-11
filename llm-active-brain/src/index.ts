import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { assertOnTestnet, getBalanceEth } from "./wallet.js";
import { runAgent, type Mt5Session } from "./agent.js";
import { config } from "./config.js";
import { getBalanceUsd } from "./economy.js";
import { getOrCreateMt5Session, listEligibleMt5Sessions, getUserTradingConfig, enforceMt5StopsAndTargets, listMt5OpenPositions, closeMt5Position, type Mt5OpenPosition } from "./neuralBridge.js";
import { MT5_ASSET_BASKET } from "./assetBasket.js";
import { primeQuotes, getQuote as getMt5Quote, getQuoteSingleAttempt } from "./mt5Broker.js";
import { isLiveExecutionActive, getLivePositions, tripLiveCircuitBreaker } from "./liveExecution.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 🔴 2026-09-03 (achado do Cleber, ao vivo: candle claramente encostou no
// nivel de stop no grafico mas a posicao continuou aberta): a trava
// MECANICA de stop/alvo (enforceMt5StopsAndTargets) so rodava 1x por CICLO
// INTEIRO do LLM (agent.ts, no inicio de runAgent) -- e um ciclo inclui
// varias chamadas de ferramenta + raciocinio do modelo local (Ollama),
// podendo levar minutos. Um pavio de candle que fura o stop e volta ANTES
// da proxima checagem nunca era visto -- nao por o codigo comparar preco
// errado, mas por checar preco raro demais (alem disso, cada checagem usa
// 1 tick pontual, nunca o high/low real do periodo -- limite conhecido,
// nao resolvido aqui). Fix: watchdog independente, rodando sozinho a cada
// poucos segundos, DESACOPLADO do ciclo de raciocinio do LLM -- fecha a
// posicao no instante em que o preco real (mesmo getQuote usado em todo o
// resto do motor, cache de 8s em mt5Broker.ts) cruzar o nivel, nao quando
// o LLM terminar de pensar. Idempotente e seguro rodar em paralelo ao
// enforceMt5StopsAndTargets que roda no inicio de cada ciclo (closeMt5Position
// so age em posicao ainda OPEN).
const STOP_WATCHDOG_INTERVAL_MS = 3_000;
// 🔴 2026-09-09 (achado real via log + llm-council: overshoot de stop de
// ~115 pontos em BTCUSD, ver comentario em mt5Broker.ts/getQuoteSingleAttempt):
// o watchdog rodava a cada 3s mas aceitava cotacao com ate 12s de idade (TTL
// do cache compartilhado com o caminho de raciocinio do LLM) -- podia ficar
// ate 4x mais "cego" do que o proprio intervalo de checagem sugere. Agora
// exige cotacao com no maximo este teto (um pouco acima do intervalo, pra
// nao forcar fetch novo em toda unica tick por 1ms de atraso). Sempre
// atendido via prime EM LOTE (ver stopWatchdogTick abaixo) -- nunca fetch
// individual por simbolo com posicao aberta, pra nao reintroduzir o
// incidente de rate-limit que forcou o TTL geral a subir pra 12s.
const STOP_WATCHDOG_MAX_QUOTE_AGE_MS = 4_000;
let stopWatchdogSessions: Mt5Session[] = [];
let stopWatchdogBusy = false;
let stopWatchdogTimer: ReturnType<typeof setInterval> | undefined;

async function stopWatchdogTick(): Promise<void> {
  if (stopWatchdogBusy || stopWatchdogSessions.length === 0) return;
  stopWatchdogBusy = true;
  try {
    for (const session of stopWatchdogSessions) {
      // 🔴 2026-09-06 (pedido do Cleber: "ao encostar no alvo, tem que
      // fechar a posicao"): antes, uma falha de rede transitoria (timeout
      // de conexao com o Supabase, confirmado ao vivo: ConnectTimeoutError
      // apos 10s) fazia esta checagem pular pro proximo tick inteiro (mais
      // 5s de espera), empurrando a deteccao de stop/alvo bem alem da
      // cadencia pretendida. Retry imediato (ate 2x, 1s de intervalo) DENTRO
      // do mesmo tick antes de desistir -- cobre blips curtos sem esperar o
      // proximo setInterval.
      // 🔴 2026-09-09 (achado do llm-council na revisao do fix acima: com
      // ate 5 posicoes simultaneas nesta sessao -- ja documentado ao vivo --
      // baixar o teto de idade do watchdog pra 4s SEM batchar reintroduziria
      // o mesmo incidente que forcou o TTL a subir pra 12s em 2026-09-03
      // (NAS100 sozinho, 1 simbolo so, ja saturou a conta compartilhada com
      // fetch individual). Prime em lote (1 requisicao HTTP pra N simbolos,
      // mesma infraestrutura que primeQuotes ja usa 1x por ciclo do LLM)
      // ANTES de checar stop/alvo -- o teto de 4s passa a ser atendido pelo
      // cache recem-preenchido na maioria das vezes, sem virar N fetches
      // individuais por tick.
      let result: Awaited<ReturnType<typeof enforceMt5StopsAndTargets>> | undefined;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const openPositions = await listMt5OpenPositions(session.sessionId);
          const symbols = Array.from(new Set(openPositions.map((p) => p.symbol)));
          if (symbols.length > 0) await primeQuotes(symbols);
          result = await enforceMt5StopsAndTargets(session.sessionId, (symbol) =>
            getQuoteSingleAttempt(symbol, STOP_WATCHDOG_MAX_QUOTE_AGE_MS)
          );
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 2) await sleep(1000);
        }
      }
      if (!result) {
        console.error(
          `[stop-watchdog] falha ao checar stop/alvo da sessao ${session.sessionId} (3 tentativas):`,
          lastErr instanceof Error ? lastErr.message : lastErr
        );
        continue;
      }
      for (const c of result.closed) {
        console.log(
          `[stop-watchdog] Fechamento mecanico IMEDIATO: ${c.symbol} ${c.side} (${c.reason}) ` +
            `entrada=${c.entryPrice} saida=${c.exitPrice} (sessao ${session.sessionId})`
        );
      }
      for (const p of result.partials) {
        console.log(
          `[stop-watchdog] Parcial de lucro realizada: ${p.symbol} ${p.side} ` +
            `(${(p.favorableMoveR * 100).toFixed(0)}% de 1R, $${p.realizedPnl.toFixed(2)}) (sessao ${session.sessionId})`
        );
      }
    }
  } finally {
    stopWatchdogBusy = false;
  }
}

function startStopWatchdog(): void {
  if (stopWatchdogTimer) return;
  stopWatchdogTimer = setInterval(() => {
    void stopWatchdogTick();
  }, STOP_WATCHDOG_INTERVAL_MS);
}

// 🔴 2026-09-08 (execucao REAL, salvaguarda minima pedida pelo llm-council
// rodado nesta sessao -- ver CLAUDE.md/liveExecution.ts): a cada ciclo,
// compara o que o motor ACHA que tem aberto (ai_trades com
// broker_position_id, ou seja, aberto em modo LIVE) contra o que a
// corretora REALMENTE tem aberto agora (getPositions). Qualquer divergencia
// (posicao que o motor acha aberta mas sumiu da corretora, ou vice-versa)
// significa que o estado interno nao bate mais com a realidade -- aciona o
// circuit breaker (desliga execucao real ate restart manual) em vez de
// continuar operando as cegas.
const LIVE_RECONCILE_INTERVAL_MS = 15_000;
let liveReconcileBusy = false;
let liveReconcileTimer: ReturnType<typeof setInterval> | undefined;
let liveReconcileSessions: Mt5Session[] = [];

// 🔴 2026-09-09 (achado ao vivo, grave: Stop Out real da corretora --
// margem esgotada -- fechou as 4 posicoes reais, mas o banco continuou
// mostrando todas como OPEN ate alguem notar e corrigir na mao via SQL):
// a versao anterior desta funcao SAIA CEDO (`continue`) sempre que
// `isLiveExecutionActive` fosse false -- e o circuit breaker (que essa
// mesma checagem consulta) tinha acabado de disparar por um 504
// TRANSITORIO da MetaAPI, minutos ANTES do stop out de verdade acontecer.
// Resultado: o unico mecanismo que poderia ter detectado e fechado a
// posicao automaticamente ficou cego bem na hora que mais importava --
// o circuit breaker (que so deveria impedir ORDEM NOVA) tambem desligava
// a RECONCILIACAO (que so le e sincroniza, nunca abre nada). Agora
// reconciliacao roda SEMPRE que o usuario tem posicoes reais esperadas
// (`expected`), independente do circuit breaker -- e quando uma posicao
// esperada sumiu da corretora (fechada por Stop Out, ou manualmente no
// proprio MT5, fora da nossa plataforma), fecha ela de verdade no banco
// usando o ultimo preco real conhecido (cache de tick, nunca fabricado).
async function liveReconcileTick(): Promise<void> {
  if (liveReconcileBusy || liveReconcileSessions.length === 0) return;
  liveReconcileBusy = true;
  try {
    for (const session of liveReconcileSessions) {
      let expected: Mt5OpenPosition[];
      try {
        expected = await listMt5OpenPositions(session.sessionId);
      } catch (err) {
        console.error(`[live-reconcile] Falha ao listar posicoes esperadas (sessao ${session.sessionId}):`, err instanceof Error ? err.message : err);
        continue;
      }
      const expectedLive = expected.filter((p): p is Mt5OpenPosition & { broker_position_id: string } => Boolean(p.broker_position_id));
      if (expectedLive.length === 0) continue; // nada real aberto pra este usuario -- nada pra reconciliar.

      let real: Awaited<ReturnType<typeof getLivePositions>>;
      try {
        real = await getLivePositions(session.userId);
      } catch (err) {
        // Falha de LEITURA (ex: 504 transitorio) -- nao sabemos o estado real,
        // entao NAO fechamos nada por seguranca (fail-closed pra fechamento
        // tambem: melhor continuar achando que esta aberto do que fechar
        // errado). O circuit breaker aqui e apropriado -- protege ORDEM NOVA
        // enquanto o estado real e desconhecido.
        tripLiveCircuitBreaker(
          `Falha ao buscar posicoes reais pra reconciliacao (sessao ${session.sessionId}): ${err instanceof Error ? err.message : err}`
        );
        continue;
      }

      const realIds = new Set(real.map((p) => p.id));
      const missingOnBroker = expectedLive.filter((p) => !realIds.has(p.broker_position_id));
      const unexpectedOnBroker = real.filter((p) => !expectedLive.some((e) => e.broker_position_id === p.id));

      for (const trade of missingOnBroker) {
        // Ultimo preco real conhecido (cache de tick, ver mt5Broker.ts) --
        // nunca fabrica preco; se nem isso existir, usa o proprio preco de
        // entrada (aproximacao honesta, resultado ~0, melhor que travar).
        let exitPrice = trade.entry_price;
        try {
          const quote = await getQuoteSingleAttempt(trade.symbol);
          if (quote) exitPrice = quote.price;
        } catch {
          // mantem a aproximacao acima.
        }
        const closed = await closeMt5Position({
          tradeId: trade.id,
          exitPrice,
          reasoning:
            `FECHADA automaticamente pela reconciliacao -- posicao real (${trade.broker_position_id}) nao existe mais na corretora ` +
            `(provavel Stop Out por margem esgotada, ou fechamento manual direto no MT5, fora da plataforma). Preco de saida = ultimo tick real ` +
            `conhecido no momento da deteccao, nao o preco exato do fechamento na corretora (MetaAPI nao expoe historico de deals nesta integracao).`,
          exitReason: "SL",
        });
        if (closed) {
          console.warn(`[live-reconcile] 🔴 Posicao real ${trade.broker_position_id} (${trade.symbol}) sumiu da corretora -- fechada no banco (Stop Out/externo).`);
        } else {
          console.error(`[live-reconcile] Falha ao fechar no banco a posicao ${trade.broker_position_id} (${trade.symbol}) que sumiu da corretora.`);
        }
      }

      if (unexpectedOnBroker.length > 0) {
        // Corretora tem posicao real que o motor nao reconhece -- isso SIM
        // e perigoso pra ORDEM NOVA (estado real diverge do que o motor
        // pensa que existe), trava a execucao ate alguem olhar.
        tripLiveCircuitBreaker(
          `Corretora tem posicoes reais [${unexpectedOnBroker.map((p) => p.id).join(",")}] que o motor nao reconhece (sessao ${session.sessionId}).`
        );
      }
    }
  } finally {
    liveReconcileBusy = false;
  }
}

function startLiveReconcileWatchdog(): void {
  if (liveReconcileTimer) return;
  liveReconcileTimer = setInterval(() => {
    void liveReconcileTick();
  }, LIVE_RECONCILE_INTERVAL_MS);
}

// 🔴 2026-08-31 (Fase 2 multi-tenant): a trava de instância única por PID
// existia pra impedir 2 processos concorrentes escrevendo no MESMO
// ledger/actions.json (corrompia o arquivo, JSON.parse quebrava todo ciclo
// seguinte -- achado real de 2026-08-29). Esse motivo ainda é válido (o
// ledger local continua sendo 1 arquivo por processo), então a trava de
// processo único CONTINUA -- o que muda é que agora o loop dentro de um
// único processo processa N sessões, não mais 1. Nunca processar a MESMA
// sessão duas vezes AO MESMO TEMPO dentro do processo é garantido pelo loop
// ser serial (for..of sequencial em runContinuous abaixo), não paralelo --
// não precisa de lock adicional por sessão enquanto isso for verdade.
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCK_FILE = join(__dirname, "..", "llm-brain.pid");

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireSingleInstanceLock() {
  if (existsSync(LOCK_FILE)) {
    const existingPid = Number(readFileSync(LOCK_FILE, "utf-8").trim());
    if (existingPid && isProcessAlive(existingPid)) {
      console.error(
        `Ja existe um processo do llm-active-brain rodando (PID ${existingPid}). ` +
          `Nao vou subir um segundo em paralelo -- isso corrompe o ledger compartilhado. ` +
          `Mate o processo antigo primeiro se quiser reiniciar.`
      );
      process.exit(1);
    }
    // PID morto (crash sem limpar o lock) -- pode seguir.
  }
  writeFileSync(LOCK_FILE, String(process.pid), "utf-8");
  const releaseLock = () => {
    try {
      if (existsSync(LOCK_FILE) && readFileSync(LOCK_FILE, "utf-8").trim() === String(process.pid)) {
        unlinkSync(LOCK_FILE);
      }
    } catch {
      // melhor esforco -- nao deixa o shutdown travar por causa do lock
    }
  };
  process.on("exit", releaseLock);
  process.on("SIGINT", () => {
    releaseLock();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    releaseLock();
    process.exit(0);
  });
}

/**
 * Sessões MT5 a processar neste ciclo (Fase 2 multi-tenant, 2026-08-31).
 * Consulta `ai_sessions` (mesmo padrão do `ai-runner`, ver item 4 do handoff
 * da Fase 2) -- se nenhuma existir ainda (primeira execução), cria a sessão
 * bootstrap a partir de `NEURAL_USER_ID`/env, preservando o comportamento de
 * hoje (single-tenant) como caso particular de N=1.
 */
async function resolveMt5Sessions(): Promise<Mt5Session[]> {
  console.log("[DEBUG] resolveMt5Sessions() chamada");
  const eligible = await listEligibleMt5Sessions();
  console.log(`[DEBUG] eligible.length=${eligible.length}`);
  if (eligible.length > 0) {
    console.log(`[DEBUG] Retornando ${eligible.length} sessões elegíveis`);
    // 🔴 2026-08-31 (pedido do Cleber): busca a config real do Setup do AI
    // Trader por usuario (risco/trade, capital, cesta, perda diaria,
    // direcao) -- cache de 60s dentro de getUserTradingConfig, seguro
    // chamar todo ciclo.
    return Promise.all(
      eligible.map(async (s) => ({
        sessionId: s.id,
        userId: s.userId,
        userConfig: await getUserTradingConfig(s.userId, MT5_ASSET_BASKET),
        status: s.status,
      }))
    );
  }
  if (!config.neuralUserId) {
    throw new Error(
      "Nenhuma sessao MT5 elegivel encontrada e NEURAL_USER_ID ausente no .env -- nao ha sessao bootstrap pra criar."
    );
  }
  console.log(`[DEBUG] Criando nova sessão para user ${config.neuralUserId}`);
  const sessionId = await getOrCreateMt5Session(config.neuralUserId, MT5_ASSET_BASKET);
  console.log(`[DEBUG] Sessão criada: ${sessionId}`);
  const userConfig = await getUserTradingConfig(config.neuralUserId, MT5_ASSET_BASKET);
  return [{ sessionId, userId: config.neuralUserId, userConfig, status: "RUNNING" }];
}

async function runSingleCycle() {
  console.log("Iniciando agente em Base Sepolia (testnet — sem valor real)...\n");
  await runAgent(1);
  console.log("\nFim da execucao. Veja o log completo com `npm run ledger` e `npm run economy`.");
}

async function runContinuous() {
  console.log(
    `Modo continuo ligado: ate ${config.maxCycles} ciclos, ` +
      `${config.cycleDelaySeconds}s de intervalo entre eles. Ctrl+C pra parar a qualquer momento.\n`
  );

  let cyclesWithoutFunds = 0;
  const STOP_AFTER_EMPTY_CYCLES = 3;

  for (let cycle = 1; cycle <= config.maxCycles; cycle++) {
    console.log(`\n========== CICLO ${cycle}/${config.maxCycles} ==========`);
    if (cycle === 1) console.log(`[DEBUG] MT5_TRADING_ENABLED=${config.mt5TradingEnabled}`);

    let calledStop = false;
    if (config.mt5TradingEnabled) {
      // 🔴 2026-08-31 (Fase 2 multi-tenant): processa TODAS as sessoes
      // elegiveis, SERIALMENTE (nunca em paralelo -- a conta MetaAPI
      // compartilhada nao aguenta chamadas concorrentes, ver aviso em
      // CLAUDE.md sobre rate-limit 429/504). Uma sessao falhando nao aborta
      // as demais deste ciclo.
      let sessions: Mt5Session[];
      try {
        sessions = await resolveMt5Sessions();
      } catch (err) {
        console.error(`\nErro ao resolver sessoes MT5 elegiveis no ciclo ${cycle}:`, err instanceof Error ? err.message : err);
        console.log(`Aguardando ${config.cycleDelaySeconds}s antes de tentar o proximo ciclo...`);
        await sleep(config.cycleDelaySeconds * 1000);
        continue;
      }
      // 🔴 2026-09-02 (rate-limit crônico, ver mt5Broker.ts): busca a cesta
      // inteira UMA VEZ por ciclo (nao mais uma requisicao HTTP separada por
      // simbolo, por sessao, por chamada de ferramenta) -- todas as sessoes
      // deste ciclo reaproveitam o mesmo cache de curta duracao. Falha
      // silenciosa (nunca lanca): se der errado, cada getQuote() cai pro
      // fetch individual de sempre, sem perder protecao nenhuma.
      //
      // 🔴 2026-09-11 (achado real, pedido do Cleber pra reduzir rate-limit):
      // isto primava o array FIXO `MT5_ASSET_BASKET` (28 simbolos, universo
      // POSSIVEL) inteiro todo ciclo, mesmo com a cesta REAL do usuario
      // (`ai_user_config.activeAssets`) tendo so 11 -- quase 3x mais simbolos
      // pedidos ao endpoint compartilhado da MetaAPI do que qualquer sessao
      // ia de fato usar naquele ciclo. Agora prima so a UNIAO das cestas
      // efetivas de cada sessao elegivel + simbolos de posicao aberta fora da
      // cesta (mesma excecao ja existente em get_mt5_quote/tools.ts, pra nao
      // deixar de cotar uma posicao herdada de uma cesta antiga) -- reduz a
      // carga por ciclo pro que realmente importa, sem mudar nenhum
      // parametro de risco/mecanica de trading.
      const primeSymbols = new Set<string>();
      for (const s of sessions) {
        for (const sym of s.userConfig?.activeAssets ?? MT5_ASSET_BASKET) primeSymbols.add(sym);
      }
      try {
        for (const s of sessions) {
          const openPositions = await listMt5OpenPositions(s.sessionId);
          for (const pos of openPositions) primeSymbols.add(pos.symbol);
        }
      } catch (err) {
        console.warn(
          "[DEBUG] falha ao coletar simbolos de posicao aberta pra prime desta cesta reduzida (nao bloqueante):",
          err instanceof Error ? err.message : err
        );
      }
      await primeQuotes(Array.from(primeSymbols));

      // 🔴 2026-09-03: mantem o watchdog independente (acima) sempre com a
      // lista atual de sessoes elegiveis -- ele roda no seu proprio timer,
      // fora deste loop, entao precisa ler o estado mais recente possivel.
      stopWatchdogSessions = sessions;
      liveReconcileSessions = sessions;

      for (const session of sessions) {
        try {
          console.log(`[DEBUG] Session antes de runAgent:`, JSON.stringify(session));
          const stoppedThisSession = await runAgent(cycle, session);
          calledStop = calledStop || stoppedThisSession;
        } catch (err) {
          console.error(
            `\nErro no ciclo ${cycle} (sessao ${session.sessionId}):`,
            err instanceof Error ? err.message : err
          );
          // 2026-09-01 (achado ao vivo): faltava esta espera aqui -- uma
          // falha persistente (413 de TPM estourado, 410 de modelo aposentado
          // etc) fazia o loop martelar a proxima sessao/ciclo sem pausa
          // nenhuma, queimando o teto inteiro de MAX_CYCLES em minutos em vez
          // de horas (confirmado: 1700+ ciclos em 15s). O branch irmao (else
          // logo abaixo, modo legado sem sessao) ja tinha essa espera.
          await sleep(config.cycleDelaySeconds * 1000);
        }
      }
    } else {
      try {
        calledStop = await runAgent(cycle);
      } catch (err) {
        // Um erro nao recuperavel num ciclo (ex: rate limit persistente,
        // API fora do ar) nao deve derrubar o modo continuo inteiro - loga,
        // espera, e tenta o proximo ciclo.
        console.error(`\nErro no ciclo ${cycle}:`, err instanceof Error ? err.message : err);
        console.log(`Aguardando ${config.cycleDelaySeconds}s antes de tentar o proximo ciclo...`);
        await sleep(config.cycleDelaySeconds * 1000);
        continue;
      }
    }

    // Saldo ETH testnet (Base Sepolia) e do trilho Binance/economia simulada
    // ANTIGO, morto desde que o MT5 assumiu -- so consultado fora do modo MT5.
    // Achado real 2026-09-06: chamar isso incondicionalmente (mesmo em modo
    // MT5, onde o valor nunca e usado) derrubava o processo inteiro sem
    // try/catch sempre que o RPC externo da Base Sepolia ficava inacessivel
    // (queda de internet), matando tambem o monitoramento real de stop/
    // posicoes MT5 -- confirmado 1259 crash-loops do watchdog em ~19h.
    const ethBalance = config.mt5TradingEnabled ? 0 : Number(await getBalanceEth());
    const usdBalance = getBalanceUsd();

    // 🔴 2026-08-29 (achado do Cleber): esse resumo (saldo ETH testnet/USD
    // ficticio) e do trilho Binance/economia simulada ANTIGO -- morto desde
    // que o trilho MT5 assumiu (ENABLE_TRADING=false). Sempre igual porque
    // nada mais escreve nele; imprimir isso a cada ciclo so confundia,
    // parecendo que "o robo esta sempre com o mesmo valor". Omitido em modo
    // MT5 (o estado real esta no Dashboard/Supabase, nao aqui).
    if (!config.mt5TradingEnabled) {
      console.log(`\n[resumo ciclo ${cycle}] ETH testnet: ${ethBalance} | USD ficticio: $${usdBalance}`);
    }

    if (ethBalance <= 0 && usdBalance <= 0 && !config.mt5TradingEnabled) {
      cyclesWithoutFunds++;
      console.log(
        `Sem saldo em nenhuma das duas moedas (${cyclesWithoutFunds}/${STOP_AFTER_EMPTY_CYCLES} ciclos seguidos).`
      );
      if (cyclesWithoutFunds >= STOP_AFTER_EMPTY_CYCLES) {
        console.log("\nSem fundos por ciclos consecutivos. Encerrando modo continuo.");
        break;
      }
    } else {
      cyclesWithoutFunds = 0;
    }

    if (calledStop && cycle < config.maxCycles) {
      console.log(`\nAguardando ${config.cycleDelaySeconds}s antes do proximo ciclo...`);
      await sleep(config.cycleDelaySeconds * 1000);
    }
  }

  console.log("\nModo continuo encerrado. Veja `npm run ledger` e `npm run economy` para o historico completo.");
}

async function main() {
  acquireSingleInstanceLock();
  await assertOnTestnet();
  if (config.mt5TradingEnabled) startStopWatchdog();
  if (config.mt5LiveExecutionEnabled) {
    // Kill-switch mestre ligado -- a partir daqui, QUALQUER usuario que
    // conectar broker_credentials pela UI passa a operar com dinheiro real
    // no proximo ciclo, sem precisar de novo restart (ver liveExecution.ts).
    startLiveReconcileWatchdog();
    console.warn(
      "[live] ⚠️ MT5_LIVE_EXECUTION_ENABLED=true -- usuarios com broker conectado podem ter ordens REAIS enviadas com dinheiro de verdade na Infinox."
    );
  }
  if (config.continuousMode) {
    await runContinuous();
  } else {
    await runSingleCycle();
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
