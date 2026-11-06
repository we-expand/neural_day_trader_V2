// Marcador de graficos do Cleber (2026-10-07). Servidor LOCAL (so 127.0.0.1) + pagina unica.
// Mostra 60 velas de 1H (Binance, momento sorteado nos ultimos 2 anos) com medias 9/20, MACD 12/26/9 e estocastico lento 5,3,3,
// SEM mostrar a regra do motor nem o que aconteceu depois. Cada marcacao e gravada em marcacoes.jsonl (1 linha por grafico),
// ja com as velas e os indicadores, pronta pra virar conjunto de treino. Nada e enviado pra fora alem da consulta publica de candles.
// Uso: node marcador.mjs   (porta 5174; MARCADOR_PORT e MARCADOR_FILE sobrescrevem)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MARCADOR_PORT || 5174);
const FILE = process.env.MARCADOR_FILE || path.join(DIR, "marcacoes.jsonl");
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT", "LINKUSDT"];
const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
const LABELS = new Set(["ALTA", "BAIXA", "LATERAL", "FORA"]);
const PATTERNS = new Set(["martelo", "estrela cadente", "torre gemea", "engolfo", "doji", "outro", "nenhum"]);

const ema = (v, p) => { const k = 2 / (p + 1); let e = v.slice(0, p).reduce((a, b) => a + b, 0) / p; const o = new Array(v.length).fill(null); o[p - 1] = e; for (let i = p; i < v.length; i++) { e = v[i] * k + e * (1 - k); o[i] = e; } return o; };
const sma = (v, n) => v.map((_, i) => (i < n - 1 || v.slice(i - n + 1, i + 1).some((x) => x == null) ? null : v.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n));

function indicators(c) { // c: 100 velas; devolve as ultimas 60 com EMA9/20, MACD 12/26/9 e estocastico lento 5,3,3 (parametros do motor)
  const cl = c.map((x) => x.c);
  const e9 = ema(cl, 9), e20 = ema(cl, 20), m12 = ema(cl, 12), m26 = ema(cl, 26);
  const macd = m12.map((v, j) => (v == null || m26[j] == null ? null : v - m26[j]));
  const first = macd.findIndex((x) => x != null);
  const sigTail = ema(macd.slice(first), 9);
  const sig = new Array(first).fill(null).concat(sigTail);
  const K = c.map((_, j) => { if (j < 4) return null; let hh = -1e18, ll = 1e18; for (let t = j - 4; t <= j; t++) { hh = Math.max(hh, c[t].h); ll = Math.min(ll, c[t].l); } return hh === ll ? 50 : (100 * (c[j].c - ll)) / (hh - ll); });
  const Ks = sma(K, 3), D = sma(Ks, 3);
  const s = (a) => a.slice(-60);
  return { velas: s(c), e9: s(e9), e20: s(e20), macd: s(macd), sig: s(sig), K: s(Ks), D: s(D) };
}

async function klines(symbol, startMs, endMs) {
  for (const host of HOSTS) {
    try {
      const r = await fetch(`${host}/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${startMs}&endTime=${endMs}&limit=100`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      return (await r.json()).map((x) => ({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] }));
    } catch { /* tenta o proximo host */ }
  }
  return null;
}

const readLabels = () => (fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const pending = new Map(); // id -> grafico entregue (guarda os dados pra gravar so quando ele marcar)

async function nextChart() {
  const done = new Set(readLabels().map((x) => x.id));
  for (let tries = 0; tries < 20; tries++) {
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const now = Math.floor(Date.now() / 3600000) * 3600000;
    const end = now - 24 * 3600000 - Math.floor(Math.random() * 2 * 365 * 24) * 3600000; // ultima vela fechada de um momento sorteado
    const id = `${symbol}-${end}`;
    if (done.has(id) || pending.has(id)) continue;
    const c = await klines(symbol, end - 99 * 3600000, end);
    if (!c || c.length < 100 || c.some((x) => !Number.isFinite(x.c))) continue;
    const g = { id, symbol, fim_utc: new Date(end + 3600000).toISOString(), ...indicators(c) };
    pending.set(id, g);
    if (pending.size > 50) pending.delete(pending.keys().next().value);
    return g;
  }
  throw new Error("nao consegui buscar candles agora (Binance indisponivel?)");
}

const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok, bad) => { let b = ""; req.on("data", (x) => { b += x; if (b.length > 1e5) bad(new Error("grande demais")); }); req.on("end", () => ok(b)); req.on("error", bad); });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, PAGE, "text/html");
    if (req.method === "GET" && url.pathname === "/next") { const g = await nextChart(); return send(res, 200, { id: g.id, symbol: g.symbol, velas: g.velas, e9: g.e9, e20: g.e20, macd: g.macd, sig: g.sig, K: g.K, D: g.D }); }
    if (req.method === "GET" && url.pathname === "/stats") { const l = readLabels(); const by = {}; l.forEach((x) => { by[x.rotulo] = (by[x.rotulo] || 0) + 1; }); return send(res, 200, { total: l.length, por_rotulo: by, arquivo: FILE }); }
    if (req.method === "POST" && url.pathname === "/label") {
      const b = JSON.parse(await readBody(req));
      const g = pending.get(b.id);
      if (!g) return send(res, 400, { erro: "grafico desconhecido ou expirado; recarregue" });
      if (!LABELS.has(b.rotulo)) return send(res, 400, { erro: "rotulo invalido" });
      const padroes = (Array.isArray(b.padroes) ? b.padroes : []).filter((p) => PATTERNS.has(p));
      const motivo = typeof b.motivo === "string" ? b.motivo.slice(0, 1000) : "";
      const row = { id: g.id, simbolo: g.symbol, fim_utc: g.fim_utc, marcado_em: new Date().toISOString(), rotulo: b.rotulo, padroes, motivo, viu_macd_estocastico: true, velas: g.velas, e9: g.e9, e20: g.e20, macd: g.macd, sig: g.sig, K: g.K, D: g.D };
      fs.appendFileSync(FILE, JSON.stringify(row) + "\n");
      pending.delete(g.id);
      return send(res, 200, { ok: true, total: readLabels().length });
    }
    if (req.method === "POST" && url.pathname === "/undo") { // desfaz a ULTIMA marcacao (erro de clique)
      const l = readLabels(); if (!l.length) return send(res, 200, { ok: true, total: 0 });
      const last = l.pop(); fs.writeFileSync(FILE, l.map((x) => JSON.stringify(x)).join("\n") + (l.length ? "\n" : ""));
      return send(res, 200, { ok: true, total: l.length, desfeito: last.id });
    }
    send(res, 404, { erro: "nao encontrado" });
  } catch (e) { send(res, 500, { erro: String(e?.message || e) }); }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Marcador em http://127.0.0.1:${PORT}  (grava em ${FILE})`));

const PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marcador de gráficos</title>
<style>
:root{--bg:#fff;--card:#f6f6f4;--tx:#1a1a18;--mut:#6b6b66;--bd:#d9d9d4;--ac:#2563eb;--up:#16a34a;--dn:#dc2626;--wa:#d97706}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--tx:#ecebe6;--mut:#9a9a93;--bd:#34342f;--ac:#6ea0ff;--up:#4ade80;--dn:#f87171;--wa:#fbbf24}}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}
header{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px}
h1{font-size:20px;font-weight:500;margin:0}
.mut{color:var(--mut);font-size:14px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px;margin:12px 0}
svg{width:100%;display:block}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
button{font:inherit;border:1px solid var(--bd);background:var(--bg);color:var(--tx);border-radius:8px;padding:10px 14px;cursor:pointer}
button.big{flex:1;min-width:120px}
button[aria-pressed=true]{background:var(--ac);border-color:var(--ac);color:#fff}
button.ghost{background:transparent}
button:disabled{opacity:.5;cursor:default}
label.chip{border:1px solid var(--bd);border-radius:999px;padding:4px 12px;font-size:14px;cursor:pointer}
label.chip:has(input:checked){background:var(--ac);border-color:var(--ac);color:#fff}
label.chip input{display:none}
textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--tx);padding:8px;margin-top:8px}
#msg{min-height:22px;font-size:14px;color:var(--dn)}
.key{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--mut)}
.key i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:4px}
</style></head><body><main>
<header><h1>Marcador de gráficos 1H</h1><span class="mut" id="stats">carregando…</span></header>
<p class="mut">Marque como você lê o gráfico agora. "De lado" = mercado sem direção; "Fora" = na dúvida, você não entraria. Sem pressa: cada marcação fica salva.</p>
<div class="card"><div id="title" class="mut"></div><div id="charts"></div>
<div class="key"><span><i style="background:var(--ac)"></i>média 9 / MACD / %K</span><span><i style="background:var(--wa)"></i>média 20 / sinal / %D</span></div></div>
<div class="card"><div class="row" id="labels">
<button class="big" data-l="ALTA">Subindo</button><button class="big" data-l="BAIXA">Descendo</button><button class="big" data-l="LATERAL">De lado</button><button class="big" data-l="FORA">Fora (na dúvida)</button></div>
<div class="row" id="pats"><span class="mut" style="align-self:center">Padrão de candle que você vê:</span></div>
<textarea id="motivo" rows="2" placeholder="Por que? (opcional, mas vale ouro: ex. estocástico cruzando embaixo + martelo)"></textarea>
<div class="row"><button id="save" class="big" disabled>Salvar e próximo</button><button id="skip" class="ghost">Pular</button><button id="undo" class="ghost">Desfazer a última</button></div>
<div id="msg"></div></div>
<script>
const $=(i)=>document.getElementById(i);let cur=null,lab=null;
const PATS=["martelo","estrela cadente","torre gemea","engolfo","doji","outro","nenhum"];
PATS.forEach(p=>{const l=document.createElement("label");l.className="chip";l.innerHTML='<input type="checkbox" value="'+p+'">'+p;$("pats").appendChild(l);});
const W=360,x=i=>8+i*((W-12)/60);
const line=(pts,c,w)=>'<polyline points="'+pts.join(" ")+'" fill="none" stroke="'+c+'" stroke-width="'+w+'"/>';
function draw(g){
  const v=g.velas;let lo=Math.min(...v.map(k=>k.l)),hi=Math.max(...v.map(k=>k.h));const yp=p=>8+150*(1-(p-lo)/(hi-lo));
  let a="";v.forEach((k,i)=>{const c=k.c>=k.o?"var(--up)":"var(--dn)",t=yp(Math.max(k.o,k.c)),b=yp(Math.min(k.o,k.c));a+='<line x1="'+x(i)+'" x2="'+x(i)+'" y1="'+yp(k.h)+'" y2="'+yp(k.l)+'" stroke="'+c+'"/><rect x="'+(x(i)-2)+'" y="'+t+'" width="4" height="'+Math.max(1,b-t)+'" fill="'+c+'"/>';});
  const pl=(arr,c,w,fy)=>line(arr.map((p,i)=>p==null?null:x(i).toFixed(1)+","+fy(p).toFixed(1)).filter(Boolean),c,w);
  a+=pl(g.e9,"var(--ac)",1.4,yp)+pl(g.e20,"var(--wa)",1.4,yp);
  const all=[...g.macd,...g.sig].filter(z=>z!=null),hs=g.macd.map((m,i)=>m==null||g.sig[i]==null?null:m-g.sig[i]).filter(z=>z!=null);
  const ml=Math.min(...all,...hs),mh=Math.max(...all,...hs),ym=p=>6+60*(1-(p-ml)/(mh-ml));
  let m='<line x1="8" x2="'+(W-4)+'" y1="'+ym(0)+'" y2="'+ym(0)+'" stroke="var(--bd)"/>';
  g.macd.forEach((mv,i)=>{if(mv==null||g.sig[i]==null)return;const h=mv-g.sig[i];m+='<rect x="'+(x(i)-1.6)+'" y="'+Math.min(ym(0),ym(h))+'" width="3.2" height="'+Math.max(.5,Math.abs(ym(h)-ym(0)))+'" fill="'+(h>=0?"var(--up)":"var(--dn)")+'" opacity=".55"/>';});
  m+=pl(g.macd,"var(--ac)",1.2,ym)+pl(g.sig,"var(--wa)",1.2,ym);
  const ys=p=>6+60*(1-p/100);
  let s='<line x1="8" x2="'+(W-4)+'" y1="'+ys(80)+'" y2="'+ys(80)+'" stroke="var(--bd)" stroke-dasharray="3 3"/><line x1="8" x2="'+(W-4)+'" y1="'+ys(20)+'" y2="'+ys(20)+'" stroke="var(--bd)" stroke-dasharray="3 3"/>'+pl(g.K,"var(--ac)",1.2,ys)+pl(g.D,"var(--wa)",1.2,ys);
  $("charts").innerHTML='<svg viewBox="0 0 '+W+' 166">'+a+'</svg><svg viewBox="0 0 '+W+' 72">'+m+'</svg><svg viewBox="0 0 '+W+' 72">'+s+'</svg>';
}
async function load(){
  $("msg").textContent="";lab=null;$("save").disabled=true;$("motivo").value="";
  document.querySelectorAll("#labels button").forEach(b=>b.setAttribute("aria-pressed","false"));
  document.querySelectorAll("#pats input").forEach(i=>i.checked=false);
  $("title").textContent="buscando gráfico…";
  try{const r=await fetch("/next");const g=await r.json();if(g.erro)throw new Error(g.erro);cur=g;draw(g);$("title").textContent=g.symbol.replace("USDT","")+" · 60 velas de 1H (a última é a mais recente)";}
  catch(e){$("title").textContent="";$("msg").textContent="Erro: "+e.message;}
  stats();
}
async function stats(){try{const s=await(await fetch("/stats")).json();const p=s.por_rotulo||{};$("stats").textContent=s.total+" marcados · subindo "+(p.ALTA||0)+" · descendo "+(p.BAIXA||0)+" · de lado "+(p.LATERAL||0)+" · fora "+(p.FORA||0);}catch{}}
$("labels").addEventListener("click",e=>{const b=e.target.closest("button[data-l]");if(!b)return;lab=b.dataset.l;document.querySelectorAll("#labels button").forEach(o=>o.setAttribute("aria-pressed",o===b?"true":"false"));$("save").disabled=!cur;});
$("save").addEventListener("click",async()=>{if(!cur||!lab)return;$("save").disabled=true;
  const padroes=[...document.querySelectorAll("#pats input:checked")].map(i=>i.value);
  const r=await fetch("/label",{method:"POST",body:JSON.stringify({id:cur.id,rotulo:lab,padroes,motivo:$("motivo").value})});const j=await r.json();
  if(!j.ok){$("msg").textContent="Erro: "+(j.erro||"falhou");$("save").disabled=false;return;}load();});
$("skip").addEventListener("click",load);
$("undo").addEventListener("click",async()=>{const j=await(await fetch("/undo",{method:"POST"})).json();$("msg").style.color="var(--mut)";$("msg").textContent=j.desfeito?"Desfeita a última marcação.":"Nada para desfazer.";stats();});
load();
</script></main></body></html>`;
