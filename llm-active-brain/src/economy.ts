import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = join(__dirname, "..", "ledger");
const ECONOMY_FILE = join(LEDGER_DIR, "economy.json");

export type EconomyEntry = {
  timestamp: string;
  cycle: number;
  source: "content_job" | "prediction_market" | "marketplace_gig" | "compute_expense";
  outcome: "success" | "failure";
  amount_usd: number;
  balance_after: number;
  detail: string;
};

type EconomyState = {
  balance_usd: number;
  history: EconomyEntry[];
};

function ensureFile() {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
  if (!existsSync(ECONOMY_FILE)) {
    writeFileSync(ECONOMY_FILE, JSON.stringify({ balance_usd: 0, history: [] }, null, 2), "utf-8");
  }
}

export function readEconomy(): EconomyState {
  ensureFile();
  return JSON.parse(readFileSync(ECONOMY_FILE, "utf-8"));
}

function writeEconomy(state: EconomyState) {
  writeFileSync(ECONOMY_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function getBalanceUsd(): number {
  return readEconomy().balance_usd;
}

// Aplica uma variacao de saldo (positiva ou negativa) e registra no historico.
// Retorna o novo saldo. O saldo fictício nao pode ficar negativo - operacoes
// que exigiriam isso sao rejeitadas por quem chama esta funcao antes de invocar.
export function applyEconomyChange(entry: Omit<EconomyEntry, "timestamp" | "balance_after">): EconomyEntry {
  const state = readEconomy();
  const delta = entry.outcome === "success" ? entry.amount_usd : -entry.amount_usd;
  state.balance_usd = Math.round((state.balance_usd + delta) * 100) / 100;
  const fullEntry: EconomyEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    balance_after: state.balance_usd,
  };
  state.history.push(fullEntry);
  writeEconomy(state);
  return fullEntry;
}
