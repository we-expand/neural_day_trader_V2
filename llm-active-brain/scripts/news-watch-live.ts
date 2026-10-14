// Mostra o que o vigia de notícias de choque enxerga AGORA nos feeds gratuitos. Uso: npx tsx scripts/news-watch-live.ts
import { getNewsShock, formatShockBlock } from "../src/newsWatch.js";
const t0 = Date.now();
const itens = await getNewsShock();
console.log(`${itens.length} manchete(s) de choque (últimas horas) em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(formatShockBlock(itens, 12) || "nada grave nos feeds neste momento");
