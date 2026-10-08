// Revisor de entradas do LLM Brain (2026-10-07, pedido do Cleber): ele revisa operacao por operacao, COM contexto
// (graficos 1H e 5m com medias/MACD/estocastico, % do dia, sessao, manchetes que a IA viu, raciocinio da IA).
// Servidor LOCAL (127.0.0.1). SOMENTE LEITURA no Supabase (chave de servico fica so aqui, nunca vai ao navegador).
// O RESULTADO do trade so e devolvido DEPOIS que o Cleber envia a revisao (o servidor nao manda antes), pra nao enviesar.
// Grava em research/experiments/2026-10-07-ml-leitura-do-cleber/revisoes.jsonl. Nao altera o motor nem o banco.
// Uso: node scripts/revisor-de-entradas.mjs     (porta 5175; REVISOR_PORT / REVISOR_FILE sobrescrevem)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PORT = Number(process.env.REVISOR_PORT || 5175);
const FILE = process.env.REVISOR_FILE || path.resolve(ROOT, "../research/experiments/2026-10-07-ml-leitura-do-cleber/revisoes.jsonl");
const PACOTE_MARK = "padrao-candle-confirmado-v2";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const ENV = loadEnv();
const SB = ENV.NEURAL_SUPABASE_URL, KEY = ENV.NEURAL_SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) throw new Error("NEURAL_SUPABASE_URL / NEURAL_SUPABASE_SERVICE_ROLE_KEY ausentes no .env");
async function rest(table, query) {
  const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ---------- indicadores (mesmos parametros do motor) ----------
const ema = (v, p) => { const k = 2 / (p + 1); let e = v.slice(0, p).reduce((a, b) => a + b, 0) / p; const o = new Array(v.length).fill(null); o[p - 1] = e; for (let i = p; i < v.length; i++) { e = v[i] * k + e * (1 - k); o[i] = e; } return o; };
const sma = (v, n) => v.map((_, i) => (i < n - 1 || v.slice(i - n + 1, i + 1).some((x) => x == null) ? null : v.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n));
function indicators(c, tail) {
  const cl = c.map((x) => x.c);
  const e9 = ema(cl, 9), e20 = ema(cl, 20), m12 = ema(cl, 12), m26 = ema(cl, 26);
  const macd = m12.map((v, j) => (v == null || m26[j] == null ? null : v - m26[j]));
  const first = macd.findIndex((x) => x != null);
  const sig = first < 0 ? macd.map(() => null) : new Array(first).fill(null).concat(ema(macd.slice(first), 9));
  const K0 = c.map((_, j) => { if (j < 4) return null; let hh = -1e18, ll = 1e18; for (let t = j - 4; t <= j; t++) { hh = Math.max(hh, c[t].h); ll = Math.min(ll, c[t].l); } return hh === ll ? 50 : (100 * (c[j].c - ll)) / (hh - ll); });
  const K = sma(K0, 3), D = sma(K, 3), s = (a) => a.slice(-tail);
  return { velas: s(c), e9: s(e9), e20: s(e20), macd: s(macd), sig: s(sig), K: s(K), D: s(D) };
}
async function candles(symbol, tf, beforeIso, closedMs, need, tail) {
  const lim = new Date(new Date(beforeIso).getTime() - closedMs + 1).toISOString(); // so velas JA fechadas no momento da entrada
  const rows = await rest("ohlcv_data", `asset_symbol=eq.${encodeURIComponent(symbol)}&timeframe=eq.${tf}&timestamp=lte.${encodeURIComponent(lim)}&order=timestamp.desc&limit=${need}&select=timestamp,open,high,low,close`);
  const c = rows.reverse().map((r) => ({ t: new Date(r.timestamp).getTime(), o: +r.open, h: +r.high, l: +r.low, c: +r.close }));
  if (c.length < 20) return { erro: `so ${c.length} velas de ${tf} arquivadas perto desse horario`, velas: c };
  return indicators(c, Math.min(tail, c.length));
}

// ---------- entradas ----------
const keyOf = (l) => `${l.session_id}|${l.symbol}|${l.side}|${l.entry_time}`;
async function listEntries(desde) {
  const legs = [];
  for (let off = 0; ; off += 1000) {
    const r = await rest("ai_trades", `status=eq.CLOSED&is_test_data=eq.true&entry_time=gte.${encodeURIComponent(desde)}&order=entry_time.desc&limit=1000&offset=${off}&select=session_id,symbol,side,entry_time,entry_price,exit_price,quantity,stop_loss,take_profit,net_pnl,pnl,commission,ai_confidence,ai_reasoning,indicators_snapshot,exit_reason,exit_time,duration_seconds,mfe_usd,original_stop_distance`);
    legs.push(...r);
    if (r.length < 1000) break;
  }
  const g = new Map();
  for (const l of legs) (g.get(keyOf(l)) ?? g.set(keyOf(l), []).get(keyOf(l))).push(l);
  const out = [];
  for (const [id, ls] of g) {
    const head = ls.find((l) => l.indicators_snapshot && Object.keys(l.indicators_snapshot).length) ?? ls[0];
    const dist = ls.map((l) => l.original_stop_distance).find((x) => x > 0) ?? null;
    const qty = ls.reduce((s, l) => s + (l.quantity ?? 0), 0);
    out.push({ id, head, legs: ls, risk: dist && head.entry_price > 0 && qty > 0 ? (dist * qty) / head.entry_price : null, net: ls.reduce((s, l) => s + (l.net_pnl ?? l.pnl ?? 0), 0), dist, snap: head.indicators_snapshot ?? {} });
  }
  return out.sort((a, b) => b.head.entry_time.localeCompare(a.head.entry_time));
}
const reviewed = () => (fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const splitReasoning = (t) => { const s = (t ?? "").split(/\|\|\s*SAIDA:/i); return { entrada: s[0].trim(), saida: s.slice(1).join(" || SAIDA:").trim() }; };
const brt = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

async function detail(id, desde) {
  const e = (await listEntries(desde)).find((x) => x.id === id);
  if (!e) throw new Error("entrada nao encontrada (fora do periodo?)");
  const h = e.head, t0 = h.entry_time, T = new Date(t0).getTime();
  const [c1h, c5m] = await Promise.all([candles(h.symbol, "1h", t0, 3600000, 100, 60), candles(h.symbol, "5m", t0, 300000, 120, 80)]);
  const news = await rest("ai_brain_activity_log", `type=eq.news&created_at=lte.${encodeURIComponent(t0)}&order=created_at.desc&limit=1&select=created_at,message`).catch(() => []);
  const w0 = new Date(T - 20 * 60000).toISOString(), w1 = new Date(T + 90000).toISOString();
  const thoughts = await rest("ai_brain_activity_log", `type=in.(thought,decision)&created_at=gte.${encodeURIComponent(w0)}&created_at=lte.${encodeURIComponent(w1)}&message=ilike.*${encodeURIComponent(h.symbol)}*&order=created_at.asc&limit=6&select=created_at,type,message`).catch(() => []);
  const s = e.snap, r = splitReasoning(h.ai_reasoning);
  const pick = ["setupType", "trendLabel", "trendLongTermLabel", "stochasticLabel", "stochasticLongTermLabel", "macdLabel", "volumeLabel", "volatilityLabel", "session", "dayChangePct", "spreadPct", "marketDirectionConsensus", "marketDirectionAgreement", "candlePatternLabels", "reversalConfirmation"];
  return {
    id, simbolo: h.symbol, lado: h.side, entrada_brt: brt(t0), entrada_utc: t0, preco: h.entry_price, confianca: h.ai_confidence,
    stop: h.entry_price && e.dist ? (h.side === "LONG" ? h.entry_price - e.dist : h.entry_price + e.dist) : null, alvo: h.take_profit, risco_usd: e.risk,
    snapshot: Object.fromEntries(pick.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])),
    raciocinio_ia: r.entrada, h1: c1h, m5: c5m,
    noticias: news[0] ? { lido_em_brt: brt(news[0].created_at), texto: news[0].message.slice(0, 2500) } : null,
    pensamentos: thoughts.map((x) => ({ brt: brt(x.created_at), tipo: x.type, texto: x.message.slice(0, 700) })),
    pacote: s.reversalRule === PACOTE_MARK,
  };
}
function outcome(e) {
  const h = e.head, r = splitReasoning(h.ai_reasoning), last = e.legs.map((l) => l.exit_time).filter(Boolean).sort().at(-1);
  return { pnl_liquido_usd: +e.net.toFixed(2), r: e.risk ? +(e.net / e.risk).toFixed(2) : null, saiu_por: [...new Set(e.legs.map((l) => l.exit_reason).filter(Boolean))].join(" + "), duracao_min: h.duration_seconds ? Math.round(h.duration_seconds / 60) : null, saida_brt: last ? brt(last) : null, mfe_r: e.risk && e.legs.some((l) => l.mfe_usd) ? +(Math.max(...e.legs.map((l) => l.mfe_usd ?? 0)) / e.risk).toFixed(2) : null, raciocinio_na_saida: r.saida || null };
}

const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok, bad) => { let b = ""; req.on("data", (x) => { b += x; if (b.length > 2e5) bad(new Error("grande demais")); }); req.on("end", () => ok(b)); req.on("error", bad); });
const DESDE_PADRAO = "2026-09-22T03:00:00Z";
const ENTRADAS = new Set(["SIM", "NAO", "OUTRO_LADO", "ESPERARIA"]);
const NOTICIA = new Set(["SIM", "NAO", "NAO_SEI"]);

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const desde = url.searchParams.get("desde") || DESDE_PADRAO;
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, PAGE, "text/html");
    if (req.method === "GET" && url.pathname === "/fila") {
      const done = new Set(reviewed().map((x) => x.id)), all = await listEntries(desde);
      const escopo = url.searchParams.get("escopo") === "pacote" ? all.filter((e) => e.snap.reversalRule === PACOTE_MARK) : all;
      const pend = escopo.filter((e) => !done.has(e.id));
      return send(res, 200, { pendentes: pend.map((e) => ({ id: e.id, simbolo: e.head.symbol, lado: e.head.side, brt: brt(e.head.entry_time) })), total_escopo: escopo.length, revisadas: escopo.length - pend.length, pacote_total: all.filter((e) => e.snap.reversalRule === PACOTE_MARK).length });
    }
    if (req.method === "GET" && url.pathname === "/entrada") return send(res, 200, await detail(url.searchParams.get("id"), desde));
    if (req.method === "POST" && url.pathname === "/revisao") {
      const b = JSON.parse(await readBody(req));
      if (!ENTRADAS.has(b.entraria) || !NOTICIA.has(b.noticia)) return send(res, 400, { erro: "resposta invalida" });
      if (reviewed().some((x) => x.id === b.id)) return send(res, 400, { erro: "essa entrada ja foi revisada" });
      const e = (await listEntries(desde)).find((x) => x.id === b.id);
      if (!e) return send(res, 400, { erro: "entrada nao encontrada" });
      const d = await detail(b.id, desde), out = outcome(e);
      const row = { id: b.id, revisado_em: new Date().toISOString(), entraria: b.entraria, noticia: b.noticia, mudaria: String(b.mudaria ?? "").slice(0, 2000), lado_ia: d.lado, simbolo: d.simbolo, entrada_utc: d.entrada_utc, pacote: d.pacote, contexto: { snapshot: d.snapshot, raciocinio_ia: d.raciocinio_ia, noticias: d.noticias, h1: d.h1, m5: d.m5 }, resultado_visto_depois: out };
      fs.appendFileSync(FILE, JSON.stringify(row) + "\n");
      return send(res, 200, { ok: true, resultado: out });
    }
    if (req.method === "GET" && url.pathname === "/stats") {
      const rv = reviewed(), by = (k) => rv.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {});
      const r = (xs) => (xs.length ? +(xs.reduce((s, x) => s + (x.resultado_visto_depois.r ?? 0), 0) / xs.length).toFixed(2) : null);
      return send(res, 200, { total: rv.length, entraria: by("entraria"), noticia: by("noticia"), r_medio_quando_entraria: r(rv.filter((x) => x.entraria === "SIM")), r_medio_quando_nao_entraria: r(rv.filter((x) => x.entraria !== "SIM")), n_entraria: rv.filter((x) => x.entraria === "SIM").length, n_nao: rv.filter((x) => x.entraria !== "SIM").length });
    }
    send(res, 404, { erro: "nao encontrado" });
  } catch (e) { send(res, 500, { erro: String(e?.message || e) }); }
}).listen(PORT, "127.0.0.1", () => console.log(`Revisor em http://127.0.0.1:${PORT}  (grava em ${FILE})`));

const PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisor de entradas</title>
<style>
:root{--bg:#fff;--card:#f6f6f4;--tx:#1a1a18;--mut:#6b6b66;--bd:#d9d9d4;--ac:#2563eb;--up:#16a34a;--dn:#dc2626;--wa:#d97706}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--tx:#ecebe6;--mut:#9a9a93;--bd:#34342f;--ac:#6ea0ff;--up:#4ade80;--dn:#f87171;--wa:#fbbf24}}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,sans-serif}
main{max-width:820px;margin:0 auto;padding:16px}
h1{font-size:20px;font-weight:500;margin:0}h2{font-size:16px;font-weight:500;margin:0 0 6px}
.mut{color:var(--mut);font-size:14px}.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px;margin:12px 0}
svg{width:100%;display:block}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
button,select{font:inherit;border:1px solid var(--bd);background:var(--bg);color:var(--tx);border-radius:8px;padding:9px 12px;cursor:pointer}
button.big{flex:1;min-width:130px}button[aria-pressed=true]{background:var(--ac);border-color:var(--ac);color:#fff}button:disabled{opacity:.5;cursor:default}
textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--tx);padding:8px;margin-top:6px}
.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:4px 12px;font-size:14px}.k b{font-weight:500;color:var(--mut)}
pre{white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace;margin:4px 0}
.badge{display:inline-block;border-radius:999px;padding:2px 10px;font-size:13px;color:#fff}
.leg{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--mut)}.leg i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:4px}
#msg{color:var(--dn);min-height:20px;font-size:14px}
</style></head><body><main>
<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline"><h1>Revisor de entradas</h1><span class="mut" id="st"></span></div>
<div class="row" style="align-items:center"><span class="mut">Quais:</span><select id="esc"><option value="todas">Todas desde 22/09</option><option value="pacote">Só o pacote de 07/10</option></select><span class="mut" id="fila"></span></div>
<div id="vazio" class="card" style="display:none"></div>
<div id="tela" style="display:none">
<div class="card"><div id="cab"></div><div class="k" id="kv"></div></div>
<div class="card"><h2>Gráfico de 1H (antes da entrada)</h2><div id="g1"></div><div class="leg"><span><i style="background:var(--ac)"></i>média 9 / MACD / %K</span><span><i style="background:var(--wa)"></i>média 20 / sinal / %D</span></div></div>
<div class="card"><h2>Gráfico de 5m (antes da entrada)</h2><div id="g5"></div><div class="leg"><span>tracejado: entrada, stop e alvo da IA</span></div></div>
<div class="card"><h2>O que a IA escreveu ao entrar</h2><pre id="rac"></pre><h2 style="margin-top:10px">Pensamentos desse momento</h2><pre id="pen" class="mut"></pre></div>
<div class="card"><h2>Manchetes que a IA via (última leitura antes da entrada)</h2><pre id="not" class="mut"></pre></div>
<div class="card" id="form"><h2>Sua revisão</h2>
<div class="mut">Você entraria nesse momento?</div><div class="row" id="q1"><button class="big" data-v="SIM">Sim, entraria</button><button class="big" data-v="NAO">Não entraria</button><button class="big" data-v="OUTRO_LADO">Entraria do outro lado</button><button class="big" data-v="ESPERARIA">Esperaria mais</button></div>
<div class="mut" style="margin-top:10px">Parece notícia ou evento?</div><div class="row" id="q2"><button class="big" data-v="SIM">Sim</button><button class="big" data-v="NAO">Não</button><button class="big" data-v="NAO_SEI">Não sei</button></div>
<textarea id="mud" rows="3" placeholder="O que você mudaria? Ex.: esperaria o estocástico cruzar; o MACD estava contra; ativo confuso, iria para outro."></textarea>
<div class="row"><button id="env" class="big" disabled>Enviar revisão e ver o resultado</button></div><div id="msg"></div></div>
<div class="card" id="res" style="display:none"><h2>Resultado do trade</h2><div id="resk" class="k"></div><pre id="ressai" class="mut"></pre><div class="row"><button id="prox" class="big">Próxima entrada</button></div></div>
</div>
<script>
const $=(i)=>document.getElementById(i);let fila=[],cur=null,a1=null,a2=null;
const sw=(c,id)=>[...$(id).children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===c?"true":"false"));
$("q1").onclick=e=>{const b=e.target.closest("button");if(!b)return;a1=b.dataset.v;sw(a1,"q1");chk();};
$("q2").onclick=e=>{const b=e.target.closest("button");if(!b)return;a2=b.dataset.v;sw(a2,"q2");chk();};
function chk(){$("env").disabled=!(a1&&a2&&cur);}
const W=380,x=i=>8+i*((W-12)/60);
const L=(p,c,w)=>'<polyline points="'+p.join(" ")+'" fill="none" stroke="'+c+'" stroke-width="'+w+'"/>';
function chart(g,n,lines){
  if(!g||!g.velas||g.velas.length<5)return '<div class="mut">Sem candles arquivados suficientes para esse horário.</div>'+(g&&g.erro?'<div class="mut">'+g.erro+'</div>':'');
  const v=g.velas,N=v.length,xx=i=>8+i*((W-12)/Math.max(1,N-1));
  let lo=Math.min(...v.map(k=>k.l)),hi=Math.max(...v.map(k=>k.h));(lines||[]).forEach(p=>{if(p!=null){lo=Math.min(lo,p);hi=Math.max(hi,p);}});
  const yp=p=>8+150*(1-(p-lo)/(hi-lo));let a="";
  v.forEach((k,i)=>{const c=k.c>=k.o?"var(--up)":"var(--dn)",t=yp(Math.max(k.o,k.c)),b=yp(Math.min(k.o,k.c));a+='<line x1="'+xx(i)+'" x2="'+xx(i)+'" y1="'+yp(k.h)+'" y2="'+yp(k.l)+'" stroke="'+c+'"/><rect x="'+(xx(i)-Math.min(2,(W/N)/2.4))+'" y="'+t+'" width="'+Math.min(4,(W/N)/1.2)+'" height="'+Math.max(1,b-t)+'" fill="'+c+'"/>';});
  const pl=(arr,c,w,f)=>L(arr.map((p,i)=>p==null?null:xx(i).toFixed(1)+","+f(p).toFixed(1)).filter(Boolean),c,w);
  a+=pl(g.e9,"var(--ac)",1.4,yp)+pl(g.e20,"var(--wa)",1.4,yp);
  const cols=["var(--tx)","var(--dn)","var(--up)"];(lines||[]).forEach((p,i)=>{if(p!=null)a+='<line x1="8" x2="'+(W-4)+'" y1="'+yp(p)+'" y2="'+yp(p)+'" stroke="'+cols[i]+'" stroke-dasharray="4 3" opacity=".8"/>';});
  const all=[...g.macd,...g.sig].filter(z=>z!=null),hs=g.macd.map((m,i)=>m==null||g.sig[i]==null?null:m-g.sig[i]).filter(z=>z!=null);
  if(!all.length)return '<svg viewBox="0 0 '+W+' 166">'+a+'</svg>';
  const ml=Math.min(...all,...hs),mh=Math.max(...all,...hs),ym=p=>6+60*(1-(p-ml)/(mh-ml));
  let m='<line x1="8" x2="'+(W-4)+'" y1="'+ym(0)+'" y2="'+ym(0)+'" stroke="var(--bd)"/>';
  g.macd.forEach((mv,i)=>{if(mv==null||g.sig[i]==null)return;const h=mv-g.sig[i];m+='<rect x="'+(xx(i)-1.4)+'" y="'+Math.min(ym(0),ym(h))+'" width="2.8" height="'+Math.max(.5,Math.abs(ym(h)-ym(0)))+'" fill="'+(h>=0?"var(--up)":"var(--dn)")+'" opacity=".55"/>';});
  m+=pl(g.macd,"var(--ac)",1.2,ym)+pl(g.sig,"var(--wa)",1.2,ym);
  const ys=p=>6+60*(1-p/100);
  const s='<line x1="8" x2="'+(W-4)+'" y1="'+ys(80)+'" y2="'+ys(80)+'" stroke="var(--bd)" stroke-dasharray="3 3"/><line x1="8" x2="'+(W-4)+'" y1="'+ys(20)+'" y2="'+ys(20)+'" stroke="var(--bd)" stroke-dasharray="3 3"/>'+pl(g.K,"var(--ac)",1.2,ys)+pl(g.D,"var(--wa)",1.2,ys);
  return '<svg viewBox="0 0 '+W+' 166">'+a+'</svg><svg viewBox="0 0 '+W+' 72">'+m+'</svg><svg viewBox="0 0 '+W+' 72">'+s+'</svg>';
}
const esc=s=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
async function fetchFila(){
  const r=await(await fetch("/fila?escopo="+$("esc").value)).json();fila=r.pendentes;
  $("fila").textContent=r.pendentes.length+" a revisar · "+r.revisadas+" já revisadas · pacote: "+r.pacote_total+" entradas";
  const s=await(await fetch("/stats")).json();$("st").textContent=s.total+" revisões"+(s.total?" · você entraria em "+(s.entraria.SIM||0)+" de "+s.total:"");
}
async function carrega(){
  $("msg").textContent="";a1=a2=null;sw(null,"q1");sw(null,"q2");$("mud").value="";$("res").style.display="none";$("form").style.display="";chk();
  if(!fila.length){$("tela").style.display="none";$("vazio").style.display="";$("vazio").textContent=$("esc").value==="pacote"?"Nenhuma entrada do pacote fechada ainda. Volte depois, ou mude para Todas desde 22/09.":"Nada pendente. Tudo revisado.";return;}
  $("vazio").style.display="none";$("tela").style.display="";cur=null;$("cab").innerHTML="carregando…";
  try{
    const d=await(await fetch("/entrada?id="+encodeURIComponent(fila[0].id))).json();if(d.erro)throw new Error(d.erro);cur=d;
    $("cab").innerHTML='<h2>'+esc(d.simbolo)+' <span class="badge" style="background:'+(d.lado==="LONG"?"var(--up)":"var(--dn)")+'">'+(d.lado==="LONG"?"COMPRA":"VENDA")+'</span> <span class="mut">'+esc(d.entrada_brt)+' (Brasília)'+(d.pacote?" · pacote":"")+'</span></h2>';
    const s=d.snapshot||{},kv=[["Preço",d.preco],["Stop da IA",d.stop?+d.stop.toFixed(5):"-"],["Alvo da IA",d.alvo??"-"],["Confiança da IA",d.confianca??"-"],["Setup declarado",s.setupType??"-"],["Sessão",s.session??"-"],["% do dia",s.dayChangePct!=null?(+s.dayChangePct).toFixed(2)+"%":"-"],["Tendência 5m",s.trendLabel??"-"],["Tendência 1H (motor)",s.trendLongTermLabel??"-"],["Estocástico 5m",s.stochasticLabel??"-"],["Estocástico 1H",s.stochasticLongTermLabel??"-"],["MACD 5m",s.macdLabel??"-"],["Volume",s.volumeLabel??"-"],["Veredito 5m+1H",s.marketDirectionConsensus??"-"],["Padrões de candle",(s.candlePatternLabels||[]).join(", ")||"nenhum"]];
    $("kv").innerHTML=kv.map(k=>"<div><b>"+k[0]+"</b><br>"+esc(k[1])+"</div>").join("");
    $("g1").innerHTML=chart(d.h1,60);$("g5").innerHTML=chart(d.m5,80,[d.preco,d.stop,d.alvo]);
    $("rac").textContent=d.raciocinio_ia||"(sem texto)";
    $("pen").textContent=d.pensamentos.length?d.pensamentos.map(p=>"["+p.brt+" · "+p.tipo+"] "+p.texto).join("\\n\\n"):"(nenhum pensamento sobre esse ativo nessa janela)";
    $("not").textContent=d.noticias?"Lido em "+d.noticias.lido_em_brt+"\\n"+d.noticias.texto:"(sem leitura de notícias arquivada antes dessa entrada)";
    chk();window.scrollTo(0,0);
  }catch(e){$("cab").innerHTML='<span style="color:var(--dn)">Erro: '+esc(e.message)+'</span>';}
}
$("env").onclick=async()=>{$("env").disabled=true;
  const r=await(await fetch("/revisao",{method:"POST",body:JSON.stringify({id:cur.id,entraria:a1,noticia:a2,mudaria:$("mud").value})})).json();
  if(!r.ok){$("msg").textContent="Erro: "+(r.erro||"falhou");$("env").disabled=false;return;}
  const o=r.resultado;$("form").style.display="none";$("res").style.display="";
  $("resk").innerHTML=[["P&L líquido","$"+o.pnl_liquido_usd],["Em R",o.r],["Saiu por",o.saiu_por||"-"],["Duração",o.duracao_min!=null?o.duracao_min+" min":"-"],["Foi a favor até",o.mfe_r!=null?o.mfe_r+"R":"-"]].map(k=>"<div><b>"+k[0]+"</b><br>"+esc(k[1])+"</div>").join("");
  $("ressai").textContent=o.raciocinio_na_saida||"";fila.shift();fetchFila();
};
$("prox").onclick=carrega;$("esc").onchange=async()=>{await fetchFila();carrega();};
(async()=>{const p=await(await fetch("/fila?escopo=pacote")).json();if(p.total_escopo>0)$("esc").value="pacote";await fetchFila();carrega();})();
</script></main></body></html>`;
