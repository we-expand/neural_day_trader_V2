import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = join(__dirname, "..", "ledger");
const LEDGER_FILE = join(LEDGER_DIR, "actions.json");

export type LedgerEntry = {
  timestamp: string;
  cycle: number;
  iteration: number;
  type:
    | "thought"
    | "balance_check"
    | "faucet_request"
    | "transaction"
    | "income"
    | "expense"
    | "trade"
    | "stop";
  detail: string;
  txHash?: string;
};

function ensureLedger() {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
  if (!existsSync(LEDGER_FILE)) writeFileSync(LEDGER_FILE, "[]", "utf-8");
}

export function readLedger(): LedgerEntry[] {
  ensureLedger();
  return JSON.parse(readFileSync(LEDGER_FILE, "utf-8"));
}

export function appendLedger(entry: LedgerEntry) {
  ensureLedger();
  const entries = readLedger();
  entries.push(entry);
  writeFileSync(LEDGER_FILE, JSON.stringify(entries, null, 2), "utf-8");
}
