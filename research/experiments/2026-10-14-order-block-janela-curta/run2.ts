import { analyzeSmc, type SmcCandle, type SmcZone } from "../../../llm-active-brain/src/smc.ts";
import fs from "node:fs";
const sym = process.argv[2] || "BTCUSDT"; const tf = process.argv[3] || "5m";
const COSTS: Record<string, number> = { BTCUSDT: 0.0008, ETHUSDT: 0.001, UKOUSD: 0.00106, NAS100: 0.00003, XAUUSD: 0.000045, EURUSD: 0.00009 }; const COST = COSTS[sym] ?? 0.001; const MINSTOP = +(process.env.MINSTOP || 0); const WIN = 200, STEP = 6, TIMEOUT = 36;
const cache = `${process.env.CACHE_DIR || "/tmp"}/ob_${sym}_${tf}.json`;
async function kl(): Promise<SmcCandle[]> {
  const mf = `${process.env.CACHE_DIR}/mt5_${sym}_${tf}.json`; if (!sym.endsWith("USDT") && fs.existsSync(mf)) return JSON.parse(fs.readFileSync(mf, "utf8")).map((c: any) => ({ timestamp: c.timestamp ?? c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));
  let out: any[] = [], cur = Date.now() - 2 * 365 * 864e5;
  while (true) { const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=1000&startTime=${cur}`); const j: any = await r.json(); if (!j.length) break; out = out.concat(j); cur = j[j.length - 1][0] + 1; if (j.length < 1000) break; }
  const c = out.map((k) => ({ timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
  fs.writeFileSync(cache, JSON.stringify(c)); return c;
}
const m = await kl(); console.log(sym, tf, "candles", m.length);
const atr: number[] = []; { let s = 0; for (let i = 0; i < m.length; i++) { const tr = i ? Math.max(m[i].high - m[i].low, Math.abs(m[i].high - m[i - 1].close), Math.abs(m[i].low - m[i - 1].close)) : m[i].high - m[i].low; s = i < 14 ? s + tr : (s * 13 + tr) / 14; atr.push(i < 13 ? NaN : i === 13 ? s / 14 : s); } }
const ema = (v: number[], p: number) => { const k = 2 / (p + 1); const o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; };
const e12 = ema(m.map((x) => x.close), 12), e26 = ema(m.map((x) => x.close), 26); const macdL = e12.map((v, i) => v - e26[i]); const sg = ema(macdL, 9); const hist = macdL.map((v, i) => v - sg[i]);
const K: (number | null)[] = []; { const raw: (number | null)[] = m.map((_, i) => { if (i < 4) return null; let hh = -1e18, ll = 1e18; for (let q = i - 4; q <= i; q++) { hh = Math.max(hh, m[q].high); ll = Math.min(ll, m[q].low); } return hh === ll ? 50 : 100 * (m[i].close - ll) / (hh - ll); }); for (let i = 0; i < m.length; i++) { const w = raw.slice(i - 2, i + 1); K.push(i < 6 || w.some((x) => x == null) ? null : w.reduce((s, x) => s + (x as number), 0) / 3); } }
const Dl = K.map((_, i) => { const w = K.slice(i - 2, i + 1); return i < 8 || w.some((x) => x == null) ? null : w.reduce((s, x) => s + (x as number), 0) / 3; });
type Ev = { i: number; zone: SmcZone; sup: boolean; rej: boolean; stoOk: boolean; macdOk: boolean };
const events: Ev[] = []; const used = new Set<string>(); let zones: SmcZone[] = [];
for (let i = WIN; i < m.length - TIMEOUT - 1; i++) {
  if ((i - WIN) % STEP === 0) zones = analyzeSmc(m.slice(i - WIN + 1, i + 1), sym, tf).orderBlocks.filter((z) => !z.mitigated);
  const c = m[i], p = m[i - 1];
  for (const z of zones) {
    if (used.has(z.id) || z.startTime >= c.timestamp) continue;
    const sup = z.type === "order_block_bullish";
    const touch = sup ? p.close > z.priceHigh && c.low <= z.priceHigh && c.close >= z.priceLow : p.close < z.priceLow && c.high >= z.priceLow && c.close <= z.priceHigh;
    if (touch) { used.add(z.id); const k = K[i], d = Dl[i];
      const stoOk = k != null && d != null && (sup ? (k <= 30 || (K[i - 1]! <= Dl[i - 1]! && k > d)) : (k >= 70 || (K[i - 1]! >= Dl[i - 1]! && k < d)));
      const macdOk = sup ? hist[i] > hist[i - 1] : hist[i] < hist[i - 1];
      events.push({ i, zone: z, sup, rej: sup ? c.close > c.open : c.close < c.open, stoOk, macdOk }); }
  }
}
console.log("eventos de toque:", events.length);
function sim(ev: Ev, side: "L" | "S", mode: string) {
  const i = ev.i, entry = m[i].close, a = atr[i]; if (!(a > 0)) return null;
  const stop = ev.sup ? ev.zone.priceLow - 0.1 * a : ev.zone.priceHigh + 0.1 * a; // stop sempre na borda distante da zona
  // lado L = quicar no suporte / S = quicar na resistência; controle inverte lado e usa a mesma distancia de stop
  let R = Math.abs(entry - stop); if (!(R > 0) || R / entry > 0.03) return null; R = Math.max(R, MINSTOP * entry);
  const st = side === "L" ? entry - R : entry + R;
  const tgtDist = mode === "1R" ? R : mode === "2R" ? 2 * R : 0.0025 * entry; const tg = side === "L" ? entry + tgtDist : entry - tgtDist;
  let res: number | null = null, mfe = 0;
  for (let q = i + 1; q <= i + TIMEOUT; q++) {
    const hs = side === "L" ? m[q].low <= st : m[q].high >= st, ht = side === "L" ? m[q].high >= tg : m[q].low <= tg;
    mfe = Math.max(mfe, (side === "L" ? m[q].high - entry : entry - m[q].low) / R);
    if (hs) { res = -1; break; } if (ht) { res = tgtDist / R; break; }
  }
  if (res == null) res = Math.max(-1, Math.min(tgtDist / R, ((side === "L" ? m[i + TIMEOUT].close - entry : entry - m[i + TIMEOUT].close)) / R));
  return { res, gross: res, net: res - COST * entry / R, mfe, y: new Date(m[i].timestamp).getUTCFullYear(), Rp: R / entry };
}
function report(name: string, sel: (e: Ev) => boolean, quicar: boolean, mode: string) {
  const tr: any[] = []; let lastEnd = -1;
  for (const e of events) { if (e.i <= lastEnd || !sel(e)) continue; const side = (e.sup === quicar) ? "L" : "S"; const t = sim(e, side as any, mode); if (!t) continue; tr.push(t); lastEnd = e.i + TIMEOUT; }
  const n = tr.length; if (n < 20) { console.log(name.padEnd(44), "n=", n); return; }
  const w = tr.filter((x) => x.res > 0).length / n, e = tr.reduce((s, x) => s + x.net, 0) / n, sd = Math.sqrt(tr.reduce((s, x) => s + (x.net - e) ** 2, 0) / (n - 1));
  const by = [...new Set(tr.map((x) => x.y))].sort().map((y) => { const a = tr.filter((x) => x.y === y); return `${y}:${(100 * a.filter((x) => x.res > 0).length / a.length).toFixed(0)}%/${(a.reduce((s, x) => s + x.net, 0) / a.length).toFixed(2)}R(n${a.length})`; }).join(" ");
  const gr = tr.reduce((s, x) => s + x.gross, 0) / n; const mfe = tr.reduce((s, x) => s + x.mfe, 0) / n, rp = tr.reduce((s, x) => s + x.Rp, 0) / n * 100;
  console.log(`${name.padEnd(44)} n=${String(n).padStart(4)} acerto ${(w * 100).toFixed(1)}% E[R]bruto ${gr.toFixed(3)} liq ${e.toFixed(3)} t=${(e / (sd / Math.sqrt(n))).toFixed(2)} MFEmed ${mfe.toFixed(2)}R stop~${rp.toFixed(2)}% | ${by}`);
}
console.log(`== ${sym} ${tf} custo ${(COST * 100).toFixed(3)}% (spread mediano medido) candles=${m.length} ==`);
for (const mode of ["1R", "0.25%"]) {
  report(`1o toque simples (controle lado oposto) ${mode}`, () => true, false, mode);
  report(`QUICAR toque simples ${mode}`, () => true, true, mode);
  report(`QUICAR + estocastico ${mode}`, (e) => e.stoOk, true, mode);
  report(`QUICAR + MACD virando ${mode}`, (e) => e.macdOk, true, mode);
  report(`QUICAR + estoc + MACD ${mode}`, (e) => e.stoOk && e.macdOk, true, mode);
  report(`QUICAR + estoc + MACD + rejeicao ${mode}`, (e) => e.stoOk && e.macdOk && e.rej, true, mode);
  report(`CONTROLE estoc + MACD (lado oposto) ${mode}`, (e) => e.stoOk && e.macdOk, false, mode);
}
