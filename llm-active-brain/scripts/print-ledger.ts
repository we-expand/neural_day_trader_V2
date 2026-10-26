import { readLedger } from "../src/ledger.js";

const entries = readLedger();
if (entries.length === 0) {
  console.log("Ledger vazio. Rode `npm start` primeiro.");
} else {
  for (const e of entries) {
    console.log(`[${e.timestamp}] #${e.iteration} ${e.type}${e.txHash ? ` (tx: ${e.txHash})` : ""}`);
    console.log(`   ${e.detail}`);
  }
}
