// 12 momentos NOVOS (6 BTC + 6 ETH, sorteio com semente fixa) com o que o Cleber usa: EMA9/EMA20, MACD 12/26/9 e Estocastico lento 5,3,3.
// A regra congelada (convergencia + curvatura da EMA9, k=3, s=0,15, crossMax=5) e calculada ANTES de ele marcar e guardada em gabarito_novo.json.
import fs from "node:fs";
import path from "node:path";
const cache = process.env.KLINE_CACHE_DIR;
const seed = (s) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const rnd = seed(20261007);
const ema = (v, p) => { const k=2/(p+1); let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p; const o=new Array(v.length).fill(NaN); o[p-1]=e; for(let i=p;i<v.length;i++){e=v[i]*k+e*(1-k);o[i]=e;} return o; };
const sma = (v, n) => v.map((_, i) => (i < n-1 || v.slice(i-n+1,i+1).some(Number.isNaN)) ? NaN : v.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n);
const atr = (c) => { const tr=c.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-c[i-1].c),Math.abs(x.l-c[i-1].c)):x.h-x.l); let a=tr.slice(0,14).reduce((s,x)=>s+x,0)/14; for(let i=14;i<tr.length;i++)a=(a*13+tr[i])/14; return a; };
function frozenRule(win) { // identico a 08-convergencia-e-curvatura.mjs com {k:3,s:0.15,crossMax:5}
  const e9=ema(win.map(x=>x.c),9), e20=ema(win.map(x=>x.c),20), A=atr(win), n=win.length, gap=(i)=>(e9[i]-e20[i])/A;
  let cross=0; for(let i=n-29;i<n;i++) if((win[i].c-e20[i])*(win[i-1].c-e20[i-1])<0) cross++;
  if (cross>=5) return "LATERAL";
  const g=gap(n-1), dg=g-gap(n-6), proj=g+dg*2;
  if (Math.abs(proj)>0.1) return proj>0?"ALTA":"BAIXA";
  const s9=(e9[n-1]-e9[n-4])/A; return s9>0.15?"ALTA":s9<-0.15?"BAIXA":"LATERAL";
}
const q = (v, lo, hi) => Math.max(0, Math.min(1295, Math.round((v-lo)/(hi-lo)*1295))).toString(36).padStart(2,"0");
const out = [], key = [], used = [];
for (const [sym, n] of [["BTCUSDT",6],["ETHUSDT",6]]) {
  const f = fs.readdirSync(cache).find(x=>x.startsWith(`kl_${sym}_1h_`));
  const h = JSON.parse(fs.readFileSync(path.join(cache,f),"utf8"));
  let got = 0;
  while (got < n) {
    const i = 120 + Math.floor(rnd()*(h.length-130));
    if (used.some(u=>u.sym===sym&&Math.abs(u.i-i)<72)) continue;
    used.push({sym,i}); got++;
    const full = h.slice(i-99, i+1), win = full.slice(-60);
    const closes = full.map(x=>x.c);
    const e9=ema(closes,9).slice(-60), e20=ema(closes,20).slice(-60);
    const m12=ema(closes,12), m26=ema(closes,26), macdFull=m12.map((v,j)=>v-m26[j]);
    const macdValid = macdFull.slice(25), sigPart = ema(macdValid,9), sig = new Array(25).fill(NaN).concat(sigPart);
    const macd = macdFull.slice(-60), sg = sig.slice(-60);
    const K = full.map((_,j)=>{ if(j<4) return NaN; let hh=-1e18,ll=1e18; for(let t=j-4;t<=j;t++){hh=Math.max(hh,full[t].h);ll=Math.min(ll,full[t].l);} return hh===ll?50:100*(full[j].c-ll)/(hh-ll); });
    const Ks = sma(K,3), D = sma(Ks,3);
    const lo=Math.min(...win.map(x=>x.l)), hi=Math.max(...win.map(x=>x.h));
    const ml=Math.min(...macd, ...sg), mh=Math.max(...macd, ...sg);
    let s = "";
    for (let j=0;j<60;j++) s += q(win[j].o,lo,hi)+q(win[j].h,lo,hi)+q(win[j].l,lo,hi)+q(win[j].c,lo,hi)+q(e9[j],lo,hi)+q(e20[j],lo,hi)+q(macd[j],ml,mh)+q(sg[j],ml,mh)+q(Ks.slice(-60)[j],0,100)+q(D.slice(-60)[j],0,100);
    out.push({sym, s, ml, mh, raw: win.map((x,j)=>({o:x.o,h:x.h,l:x.l,c:x.c,e9:e9[j],e20:e20[j],macd:macd[j],sig:sg[j],K:Ks.slice(-60)[j],D:D.slice(-60)[j]}))});
    key.push({ n: 0, sym, t: new Date(win.at(-1).t).toISOString(), regra_congelada: frozenRule(win) });
  }
}
// ordem embaralhada fixa
const order = out.map((_,i)=>i).sort(()=>rnd()-0.5);
const shuffledKey = order.map((i,p)=>({ ...key[i], n: p+1 }));
fs.writeFileSync("gabarito_novo.json", JSON.stringify(shuffledKey, null, 1));
fs.writeFileSync("graficos_novos.json", JSON.stringify(order.map(i=>({s:out[i].s, ml:out[i].ml, mh:out[i].mh}))));
fs.writeFileSync("graficos_novos_raw.json", JSON.stringify(order.map(i=>out[i].raw)));
console.log("gerados:", order.length, "| distribuicao da regra congelada:", JSON.stringify(shuffledKey.reduce((m,k)=>(m[k.regra_congelada]=(m[k.regra_congelada]||0)+1,m),{})));
