// Acompanha a posicao MANUAL do Cleber no JPN225 (SHORT a 66365.10, alvo 65763.54): preco, distancia ao alvo,
// extremos desde a entrada e degraus do Fibonacci. Uso: npx tsx scripts/watch-jpn225.ts
import { getDeepCandles } from "../src/atr.js";
import { getFibLive } from "../src/fibLive.js";
const ENTRY = 66365.1, TARGET = 65763.54, SINCE = Date.parse("2026-10-14T20:52:00Z"); // 17h52 BRT
const c15 = await getDeepCandles("JPN225", "15m");
if (!c15) { console.log("sem candles reais agora"); process.exit(0); }
const last = c15[c15.length - 1];
const desde = c15.filter((k) => k.timestamp + 15 * 60_000 > SINCE);
const minimo = Math.min(...desde.map((k) => k.low)), maximo = Math.max(...desde.map((k) => k.high));
const pts = (v: number) => v.toFixed(2);
console.log(`hora ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })} | preço ${pts(last.close)} (vela 15m ${new Date(last.timestamp).toISOString().slice(11, 16)}Z)`);
console.log(`SHORT ${ENTRY}: resultado em pontos ${pts(ENTRY - last.close)} | falta ${pts(last.close - TARGET)} pts até o alvo ${TARGET} (${(((last.close - TARGET) / last.close) * 100).toFixed(2)}%) | já percorreu ${(((ENTRY - last.close) / (ENTRY - TARGET)) * 100).toFixed(0)}% do caminho`);
console.log(`desde a entrada: mínima ${pts(minimo)} (${pts(ENTRY - minimo)} pts a favor) | máxima ${pts(maximo)} (${pts(maximo - ENTRY)} pts contra)`);
const f = await getFibLive("JPN225");
if (f) console.log(f.texto);
