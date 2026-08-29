import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { assertOnTestnet, getBalanceEth } from "./wallet.js";
import { runAgent } from "./agent.js";
import { config } from "./config.js";
import { getBalanceUsd } from "./economy.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Trava de instancia unica: dois processos escrevendo no mesmo
// ledger/actions.json ao mesmo tempo corrompe o arquivo (JSON.parse quebra
// em todo ciclo seguinte, travando o agente antes de decidir qualquer
// trade -- ja aconteceu 2026-08-29). Um segundo processo que tentar subir
// com o primeiro ainda vivo deve morrer imediatamente, nao competir.
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

    let calledStop = false;
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

    const ethBalance = Number(await getBalanceEth());
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
