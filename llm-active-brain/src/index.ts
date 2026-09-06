import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { assertOnTestnet, getBalanceEth } from "./wallet.js";
import { runAgent, type Mt5Session } from "./agent.js";
import { config } from "./config.js";
import { getBalanceUsd } from "./economy.js";
import { getOrCreateMt5Session, listEligibleMt5Sessions, getUserTradingConfig, enforceMt5StopsAndTargets } from "./neuralBridge.js";
import { MT5_ASSET_BASKET } from "./assetBasket.js";
import { primeQuotes, getQuote as getMt5Quote, getQuoteSingleAttempt } from "./mt5Broker.js";

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
const STOP_WATCHDOG_INTERVAL_MS = 5_000;
let stopWatchdogSessions: Mt5Session[] = [];
let stopWatchdogBusy = false;
let stopWatchdogTimer: ReturnType<typeof setInterval> | undefined;

async function stopWatchdogTick(): Promise<void> {
  if (stopWatchdogBusy || stopWatchdogSessions.length === 0) return;
  stopWatchdogBusy = true;
  try {
    for (const session of stopWatchdogSessions) {
      try {
        const result = await enforceMt5StopsAndTargets(session.sessionId, getQuoteSingleAttempt);
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
      } catch (err) {
        console.error(
          `[stop-watchdog] falha ao checar stop/alvo da sessao ${session.sessionId}:`,
          err instanceof Error ? err.message : err
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
      await primeQuotes(MT5_ASSET_BASKET);

      // 🔴 2026-09-03: mantem o watchdog independente (acima) sempre com a
      // lista atual de sessoes elegiveis -- ele roda no seu proprio timer,
      // fora deste loop, entao precisa ler o estado mais recente possivel.
      stopWatchdogSessions = sessions;

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
