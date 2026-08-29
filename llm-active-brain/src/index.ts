import { assertOnTestnet, getBalanceEth } from "./wallet.js";
import { runAgent } from "./agent.js";
import { config } from "./config.js";
import { getBalanceUsd } from "./economy.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    console.log(`\n[resumo ciclo ${cycle}] ETH testnet: ${ethBalance} | USD ficticio: $${usdBalance}`);

    if (ethBalance <= 0 && usdBalance <= 0) {
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
