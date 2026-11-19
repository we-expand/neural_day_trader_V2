// Extrai do ledger do motor (llm-active-brain/ledger/actions.json) cada tentativa de open_position:
// horario, ativo, lado, se abriu ou qual gate barrou. Agrupa tentativas repetidas do mesmo
// ativo+lado em 30 min numa decisao so (a LLM costuma insistir 2-3x no mesmo ciclo).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEDGER = path.resolve(HERE, "../../../llm-active-brain/ledger/actions.json");

export function classifyGate(err) {
  if (!err) return "ABRIU";
  if (/MACD 5m/.test(err)) return "MACD";
  if (/veredito de direcao/.test(err)) return "CONSENSO";
  if (/Contradicao semantica/.test(err)) return "VALIDADOR_SEMANTICO";
  if (/Estocastico RAPIDO/i.test(err)) return "ESTOC_RAPIDO";
  if (/Risco minimo possivel/.test(err)) return "RISCO_MINIMO";
  if (/tendencia de (ALTA|BAIXA) na ultima/.test(err)) return "TENDENCIA_60M";
  if (/Cadencia|teto|janela deslizante|limite/i.test(err)) return "LIMITE_OPERACIONAL";
  return "OUTRO";
}

export function loadDecisions({ from, to, symbols, clusterMin = 30 }) {
  const all = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  const raw = [];
  for (const x of all) {
    if (x.type !== "trade" || x.timestamp < from || x.timestamp >= to) continue;
    let d; try { d = JSON.parse(x.detail); } catch { continue; }
    const i = d.input ?? {}, r = d.result ?? {};
    if (!i.symbol || (i.side !== "LONG" && i.side !== "SHORT")) continue; // close_position etc.
    if (symbols && !symbols.includes(i.symbol)) continue;
    const opened = r.trade_id != null;
    const gate = opened ? "ABRIU" : classifyGate(typeof r.error === "string" ? r.error : JSON.stringify(r));
    raw.push({ t: Date.parse(x.timestamp), ts: x.timestamp, symbol: i.symbol, side: i.side, opened, gate, setupType: i.setupType ?? null, confidence: i.confidence ?? null });
  }
  raw.sort((a, b) => a.t - b.t);
  const out = [];
  const lastBy = new Map();
  for (const a of raw) {
    const key = `${a.symbol}|${a.side}`;
    const prev = lastBy.get(key);
    if (prev && a.t - prev.lastT <= clusterMin * 60_000) {
      prev.lastT = a.t; prev.attempts++;
      if (a.opened && !prev.opened) { prev.opened = true; prev.gate = "ABRIU"; prev.tOpen = a.t; }
      continue;
    }
    const dec = { ...a, lastT: a.t, attempts: 1, tOpen: a.opened ? a.t : null };
    lastBy.set(key, dec);
    out.push(dec);
  }
  return { decisions: out, rawCount: raw.length };
}
