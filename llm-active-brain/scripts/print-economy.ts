import { readEconomy } from "../src/economy.js";

const state = readEconomy();

console.log(`Saldo ficticio atual: $${state.balance_usd} USD (NAO E DINHEIRO REAL)\n`);

if (state.history.length === 0) {
  console.log("Nenhuma atividade economica ainda. Rode `npm start` (ou `CONTINUOUS_MODE=true npm start`) primeiro.");
  process.exit(0);
}

const bySource: Record<string, { success: number; failure: number; net: number }> = {};
for (const entry of state.history) {
  bySource[entry.source] ??= { success: 0, failure: 0, net: 0 };
  if (entry.outcome === "success") {
    bySource[entry.source].success++;
    bySource[entry.source].net += entry.amount_usd;
  } else {
    bySource[entry.source].failure++;
    bySource[entry.source].net -= entry.amount_usd;
  }
}

console.log("Resumo por fonte:");
for (const [source, stats] of Object.entries(bySource)) {
  const total = stats.success + stats.failure;
  const winRate = total > 0 ? ((stats.success / total) * 100).toFixed(0) : "0";
  console.log(
    `  ${source}: ${stats.success}/${total} sucesso (${winRate}%) | saldo liquido: $${stats.net.toFixed(2)}`
  );
}

console.log(`\nHistorico completo (${state.history.length} eventos):`);
for (const entry of state.history) {
  const sign = entry.outcome === "success" ? "+" : "-";
  console.log(
    `  [ciclo ${entry.cycle}] [${entry.timestamp}] ${entry.source} ${sign}$${entry.amount_usd} -> saldo: $${entry.balance_after} | ${entry.detail}`
  );
}
