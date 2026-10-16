// Teste 2 (Cleber, 14/10): "dentro do corredor de Fibonacci o preco dificilmente volta" e "se perde na entrada, nao na saida".
// Sem look-ahead (corredor calculado so com velas ate a vela t). Para cada perna, em 2 pontos de entrada:
//   E0  = fechamento que ROMPE o 0 (inicio da expansao): alvo 61,8% ou 100%; invalidacao = preco voltar a tocar o 0.
//   E61 = fechamento que rompe o 61,8%: alvo 100% ou 161,8%; invalidacao = voltar a tocar o 0.
// Barra que toca alvo e invalidacao ao mesmo tempo conta como INVALIDACAO (conservador). Sem custos. Resultado em R
// (R = distancia da entrada ate a invalidacao). Referencia: passeio aleatorio, P(alvo antes) = risco/(risco+alvo).
// Uso: npx tsx scripts/fib-backtest2.ts [SIMBOLO=BTCUSDT] [anos=2] [janela=72] [horizonte_velas=96]
import { computeFibCorridor, type FibCandle } from "../src/fibCorridor.js";
const symbol = process.argv[2] ?? "BTCUSDT", years = Number(process.argv[3] ?? 2), window = Number(process.argv[4] ?? 72), horizon = Number(process.argv[5] ?? 96);
async function klines(): Promise<FibCandle[]> {
  const out: FibCandle[] = []; let start = Date.now() - years * 365 * 86400_000;
  while (start < Date.now()) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${start}&limit=1000`);
    if (!r.ok) throw new Error(`binance ${r.status}`);
    const rows = (await r.json()) as unknown[][]; if (!rows.length) break;
    for (const k of rows) out.push({ timestamp: Number(k[0]), open: +k[1]!, high: +k[2]!, low: +k[3]!, close: +k[4]! });
    start = Number(rows[rows.length - 1]![0]) + 3600_000; if (rows.length < 1000) break;
  }
  return out;
}
const c = await klines();
console.log(`${symbol}: ${c.length} velas de 1H, janela ${window}, horizonte ${horizon}h`);
type Acc = { n: number; alvo: number; r: number; refP: number };
const novo = (): Acc => ({ n: 0, alvo: 0, r: 0, refP: 0 });
const acc: Record<string, Acc> = {};
const vistoE0 = new Set<string>(), vistoE61 = new Set<string>();
function simula(dir: "BAIXA" | "ALTA", t: number, entry: number, zero: number, alvo: number, nome: string) {
  const risco = Math.abs(zero - entry), ganho = Math.abs(entry - alvo);
  if (!(risco > 0) || !(ganho > 0)) return;
  let res = 0;
  for (const k of c.slice(t + 1, t + 1 + horizon)) {
    const invalidou = dir === "BAIXA" ? k.high >= zero : k.low <= zero;
    const bateu = dir === "BAIXA" ? k.low <= alvo : k.high >= alvo;
    if (invalidou) { res = -1; break; }
    if (bateu) { res = ganho / risco; break; }
  }
  const a = (acc[nome] ??= novo());
  a.n++; if (res > 0) a.alvo++; a.r += res; a.refP += risco / (risco + ganho);
}
for (let t = window + 5; t < c.length - horizon; t++) {
  const cor = computeFibCorridor(c.slice(t - window - 1, t + 1), { tf: "1H", window });
  if (!cor) continue;
  const key = `${cor.direcao}:${cor.pontoA.toFixed(2)}:${cor.pontoB.toFixed(2)}`;
  const entry = c[t].close, prev = c[t - 1].close, [d618, d100, d161] = cor.degraus;
  const baixa = cor.direcao === "BAIXA";
  if (!vistoE0.has(key)) { vistoE0.add(key); // primeira vez que o corredor existe = fechamento rompeu o 0
    simula(cor.direcao, t, entry, cor.pontoB, d618.price, `${cor.direcao} E0->61,8%`);
    simula(cor.direcao, t, entry, cor.pontoB, d100.price, `${cor.direcao} E0->100%`);
  }
  const cruz618 = baixa ? entry < d618.price && prev >= d618.price : entry > d618.price && prev <= d618.price;
  if (cruz618 && !vistoE61.has(key)) { vistoE61.add(key);
    simula(cor.direcao, t, entry, cor.pontoB, d100.price, `${cor.direcao} E61->100%`);
    simula(cor.direcao, t, entry, cor.pontoB, d161.price, `${cor.direcao} E61->161,8%`);
  }
}
for (const [nome, a] of Object.entries(acc).sort()) {
  const p = a.alvo / a.n, ref = a.refP;
  console.log(`${nome.padEnd(16)} n=${String(a.n).padStart(3)} | alvo antes da invalidação: ${(p * 100).toFixed(1)}% | referência do acaso (passeio aleatório, P=risco/(risco+alvo)): ${((ref / a.n) * 100).toFixed(1)}% | média ${(a.r / a.n).toFixed(2)} R por entrada`);
}
