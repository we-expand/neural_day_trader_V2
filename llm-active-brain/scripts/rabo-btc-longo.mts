// Pesquisa 21/10/2026 (2o teste, pedido do Cleber: "so que colocando o stop"): VERSAO LONGA do metodo dele -- entrada no "rabo" e alvo na media de 9 do 1h. (1o teste: alvo curto
// de US$2-3 LIQUIDOS por operacao de 0,02 BTC. Dados: Binance BTCUSDT 5m (publico), ~90 dias.
//
// Regras fixadas ANTES de rodar (nada de ajustar depois de ver o resultado):
//   Extremo  = maxima (venda) / minima (compra) das ultimas 12 velas de 5m (1h), conhecida NA HORA (sem olhar o futuro).
//   Gatilho V1 = estocastico lento 5m (5,3,3): %K cruza %D PARA BAIXO (venda) / PARA CIMA (compra), tendo estado em zona
//                extrema (>80 / <20) em alguma das 6 velas anteriores. Entra na ABERTURA da vela seguinte ao sinal.
//   V2 = V1 + estocastico 1h tambem em zona extrema (todos os tempos graficos, como ele descreve).
//   V3 = V1 + fechamento da vela de sinal do lado certo da EMA9 de 5m (abaixo p/ venda, acima p/ compra).
//   Stop     = no extremo (nao pode ser menor que 60 pontos). Alvo = custo + lucro liquido desejado (US$2 ou US$3), em pontos.
//   "Barato" (filtro opcional, a regra dele) = so entra se distancia ate o alvo >= 3x a distancia ate o stop.
//   Saida por tempo: 24 velas (2h) no fechamento. Stop e alvo na mesma vela = conta o STOP. Gap alem do stop = sai na abertura.
//   Tamanho 0,02 BTC. Custo de ida e volta = 0,077% do nocional (o que a plataforma cobrou nas saidas manuais dele hoje: ~US$1,30).
// Uso: npx tsx scripts/rabo-btc-backtest.mts [dias=90]
// Regras fixadas ANTES de rodar:
//   Entrada = mesmos gatilhos V1 (estocastico 5m cruza de volta vindo da zona extrema) e V2 (V1 + estocastico 1h tambem extremo), abre na vela seguinte.
//   Alvo   = SMA9 das velas de 1h COMPLETAS (conhecida na hora). So entra se o alvo esta do lado certo; filtro 'barato' opcional: alvo >= 3x o risco.
//   Stops  = S1: no extremo das ultimas 12 velas de 5m, fixo.  S2: no extremo, e vai pro ZERO A ZERO (entrada) depois que o preco anda 1x o risco a favor.
//            S3: no extremo, e vai pro zero a zero depois de +US$3 brutos a favor (~150 pontos) -- o jeito que ele usou hoje.
//   Saida por tempo: 72 velas (6h) no fechamento. Mesma execucao conservadora do 1o teste (stop primeiro; gap = abertura). Custo 0,077% ida e volta.
// Uso: npx tsx scripts/rabo-btc-longo.mts [dias=90]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type C = { t: number; o: number; h: number; l: number; c: number };
const DAYS = Number(process.argv[2] ?? 90);
const CACHE = join(process.env.TMPDIR ?? "/tmp", "rabo_btc_5m_" + DAYS + ".json");
const LOT_BTC = 0.02;
const COST_PCT = 0.00077;

async function load5m(): Promise<C[]> {
  if (existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, "utf8"));
  const out: C[] = [];
  let end = Date.now();
  const startMs = end - DAYS * 86400_000;
  while (end > startMs) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=1000&endTime=${end}`);
    const k = (await r.json()) as any[][];
    if (!Array.isArray(k) || k.length === 0) break;
    for (const x of k) out.push({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] });
    end = k[0][0] - 1;
  }
  out.sort((a, b) => a.t - b.t);
  const uniq = out.filter((x, i) => i === 0 || x.t !== out[i - 1].t);
  writeFileSync(CACHE, JSON.stringify(uniq));
  return uniq;
}

const sma = (v: number[], n: number, i: number) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += v[k]; return s / n; };
function stoch(c: C[], kLen = 5, kSmooth = 3, dSmooth = 3) {
  const raw: number[] = c.map((_, i) => {
    if (i < kLen - 1) return NaN;
    let hh = -Infinity, ll = Infinity;
    for (let k = i - kLen + 1; k <= i; k++) { hh = Math.max(hh, c[k].h); ll = Math.min(ll, c[k].l); }
    return hh === ll ? 50 : (100 * (c[i].c - ll)) / (hh - ll);
  });
  const K = raw.map((_, i) => (i < kLen - 1 + kSmooth - 1 ? NaN : sma(raw, kSmooth, i)));
  const D = K.map((_, i) => (i < kLen - 1 + kSmooth - 1 + dSmooth - 1 ? NaN : sma(K, dSmooth, i)));
  return { K, D };
}
function ema(v: number[], n: number) { const a = 2 / (n + 1); const o: number[] = []; let e = v[0]; for (let i = 0; i < v.length; i++) { e = i === 0 ? v[0] : a * v[i] + (1 - a) * e; o.push(e); } return o; }

// 1h a partir das velas de 5m (so velas 1h COMPLETAS entram, evitando olhar o futuro)
function hourly(c: C[]): C[] {
  const m = new Map<number, C>();
  for (const x of c) {
    const b = Math.floor(x.t / 3600_000) * 3600_000;
    const cur = m.get(b);
    if (!cur) m.set(b, { t: b, o: x.o, h: x.h, l: x.l, c: x.c });
    else { cur.h = Math.max(cur.h, x.h); cur.l = Math.min(cur.l, x.l); cur.c = x.c; }
  }
  return [...m.values()].sort((a, b) => a.t - b.t);
}


type Trade = { t: number; side: "S" | "L"; net: number; win: boolean; hit: "TP" | "SL" | "BE" | "TIME" };
type StopMode = "S1" | "S2" | "S3";
function run(c: C[], variant: "V1" | "V2", stopMode: StopMode, cheapOnly: boolean, onlyBrtWindow: boolean): Trade[] {
  const { K, D } = stoch(c);
  const h1 = hourly(c);
  const h1c = stoch(h1);
  const h1idx = new Map(h1.map((x, i) => [x.t, i] as const));
  const h1close = h1.map((x) => x.c);
  const trades: Trade[] = [];
  let busyUntil = -1;
  for (let i = 60; i < c.length - 80; i++) {
    if (i <= busyUntil) continue;
    const tHour = Math.floor(c[i].t / 3600_000) * 3600_000;
    const hr = new Date(c[i].t).getUTCHours();
    if (onlyBrtWindow && !(hr >= 13 && hr < 15)) continue;
    if (!(K[i] >= 0) || !(D[i] >= 0) || !(K[i - 1] >= 0) || !(D[i - 1] >= 0)) continue;
    const crossDown = K[i - 1] >= D[i - 1] && K[i] < D[i];
    const crossUp = K[i - 1] <= D[i - 1] && K[i] > D[i];
    let wasOver = false, wasUnder = false;
    for (let k = i - 6; k < i; k++) { if (K[k] > 80) wasOver = true; if (K[k] < 20) wasUnder = true; }
    let side: "S" | "L" | null = null;
    if (crossDown && wasOver) side = "S"; else if (crossUp && wasUnder) side = "L";
    if (!side) continue;
    const jh = h1idx.get(tHour - 3600_000); // ultima vela de 1h completa
    if (jh === undefined || jh < 9) continue;
    if (variant === "V2") {
      if (!(h1c.K[jh] >= 0)) continue;
      if (side === "S" && !(h1c.K[jh] > 80)) continue;
      if (side === "L" && !(h1c.K[jh] < 20)) continue;
    }
    let sum = 0; for (let k = jh - 8; k <= jh; k++) sum += h1close[k];
    const target = sum / 9; // SMA9 do 1h
    let ext = side === "S" ? -Infinity : Infinity;
    for (let k = i - 11; k <= i; k++) ext = side === "S" ? Math.max(ext, c[k].h) : Math.min(ext, c[k].l);
    const entry = c[i + 1].o;
    const riskPts = side === "S" ? ext - entry : entry - ext;
    const tpPts = side === "S" ? entry - target : target - entry;
    if (!(riskPts >= 60) || !(tpPts > 0)) continue;
    if (cheapOnly && !(tpPts >= 3 * riskPts)) continue;
    const costUsd = entry * LOT_BTC * COST_PCT;
    let stop = side === "S" ? entry + riskPts : entry - riskPts;
    const tp = target;
    const beTrigPts = stopMode === "S2" ? riskPts : stopMode === "S3" ? 3 / LOT_BTC : Infinity;
    let moved = false, exit = NaN, hit: Trade["hit"] = "TIME";
    let j = i + 1;
    for (; j <= i + 72 && j < c.length; j++) {
      const x = c[j];
      const stopHit = side === "S" ? x.h >= stop : x.l <= stop;
      const tpHit = side === "S" ? x.l <= tp : x.h >= tp;
      if (stopHit) { exit = side === "S" ? Math.max(x.o, stop) : Math.min(x.o, stop); hit = moved ? "BE" : "SL"; break; }
      if (tpHit) { exit = tp; hit = "TP"; break; }
      if (!moved && stopMode !== "S1") {
        const fav = side === "S" ? entry - x.l : x.h - entry;
        if (fav >= beTrigPts) { stop = entry; moved = true; } // vale a partir da PROXIMA vela
      }
      if (j === i + 72) { exit = x.c; hit = "TIME"; }
    }
    if (!Number.isFinite(exit)) continue;
    const gross = (side === "S" ? entry - exit : exit - entry) * LOT_BTC;
    const net = gross - costUsd;
    trades.push({ t: c[i + 1].t, side, net, win: net > 0, hit });
    busyUntil = j;
  }
  return trades;
}

function line(nome: string, tr: Trade[]) {
  if (tr.length === 0) return `${nome}: n=0`;
  const w = tr.filter((x) => x.win), l = tr.filter((x) => !x.win);
  const tot = tr.reduce((a, x) => a + x.net, 0), mean = tot / tr.length;
  const sd = Math.sqrt(tr.reduce((a, x) => a + (x.net - mean) ** 2, 0) / Math.max(1, tr.length - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(tr.length)) : 0;
  const aw = w.length ? w.reduce((a, x) => a + x.net, 0) / w.length : 0, al = l.length ? l.reduce((a, x) => a + x.net, 0) / l.length : 0;
  const tp = tr.filter((x) => x.hit === "TP").length, be = tr.filter((x) => x.hit === "BE").length, sl = tr.filter((x) => x.hit === "SL").length;
  return `${nome}: n=${String(tr.length).padStart(4)} acerto ${(100 * w.length / tr.length).toFixed(0).padStart(3)}% | ganho ${aw.toFixed(2).padStart(6)} perda ${al.toFixed(2).padStart(7)} | liq/op ${mean.toFixed(2).padStart(6)} total ${tot.toFixed(0).padStart(6)} t=${t.toFixed(2).padStart(5)} | alvo ${tp} zero-a-zero ${be} stop ${sl}`;
}

const c = await load5m();
const cut = c[Math.floor(c.length * 0.67)].t;
console.log(`BTCUSDT 5m: ${c.length} velas, ${new Date(c[0].t).toISOString().slice(0, 10)} a ${new Date(c[c.length - 1].t).toISOString().slice(0, 10)} | 0,02 BTC | alvo = SMA9 do 1h`);
for (const win of [false, true]) {
  console.log(`\n===== ${win ? "SO 10h-12h BRT (13-15h UTC)" : "dia inteiro (24h)"} =====`);
  for (const v of ["V1", "V2"] as const) for (const cheap of [false, true]) for (const sm of ["S1", "S2", "S3"] as const) {
    const all = run(c, v, sm, cheap, win);
    const oos = all.filter((x) => x.t >= cut);
    console.log(`${v} ${sm}${cheap ? " +barato" : "        "} | ${line("TUDO", all)}`);
    console.log(`${" ".repeat(18)} | ${line("fora (33% final)", oos)}`);
  }
}
