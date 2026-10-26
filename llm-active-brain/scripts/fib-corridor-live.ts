// Mostra o corredor de Fibonacci calculado em candles REAIS (15m e 1H) para comparar com o desenho do Cleber.
// Uso: npx tsx scripts/fib-corridor-live.ts [SIMBOLO ...]   (precisa de rede; padrao: JPN225)
import { getFibLive } from "../src/fibLive.js";
const symbols = process.argv.slice(2).length ? process.argv.slice(2) : ["JPN225"];
for (const s of symbols) {
  const f = await getFibLive(s);
  console.log(`\n=== ${s} ===`);
  if (!f) { console.log("sem candles reais"); continue; }
  console.log(f.texto);
  console.log("principal:", f.principal ? `${f.principal.tf} ${f.principal.direcao}` : "nenhum");
}
