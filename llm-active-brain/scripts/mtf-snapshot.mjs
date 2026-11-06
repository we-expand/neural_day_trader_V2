// Snapshot multi-timeframe (5m, 15m, 1H, 2H, 4H) de estocastico (5,3,3 e 14,3,3) e MACD, a partir dos candles que o motor arquiva em ohlcv_data.
// Somente leitura. Uso: node scripts/mtf-snapshot.mjs BTCUSD   (2H/4H sao agregadas das velas de 1H; so conta bloco completo)

import fs from "node:fs";
const SYM=(process.argv[2]||"BTCUSD").toUpperCase();
const env={};for(const l of fs.readFileSync(".env","utf8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"");}
const get=async(tf,n)=>{const r=await fetch(`${env.NEURAL_SUPABASE_URL}/rest/v1/ohlcv_data?asset_symbol=eq.${SYM}&timeframe=eq.${tf}&order=timestamp.desc&limit=${n}&select=timestamp,open,high,low,close`,{headers:{apikey:env.NEURAL_SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+env.NEURAL_SUPABASE_SERVICE_ROLE_KEY}});return(await r.json()).reverse().map(x=>({t:new Date(x.timestamp).getTime(),o:+x.open,h:+x.high,l:+x.low,c:+x.close}));};
const agg=(c,h)=>{const ms=h*3600000,m=new Map();for(const x of c){const k=Math.floor(x.t/ms)*ms;const g=m.get(k);if(!g)m.set(k,{t:k,o:x.o,h:x.h,l:x.l,c:x.c,n:1});else{g.h=Math.max(g.h,x.h);g.l=Math.min(g.l,x.l);g.c=x.c;g.n++;}}return[...m.values()].filter(g=>g.n===h);};
const ema=(v,p)=>{const k=2/(p+1);let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p;const o=new Array(v.length).fill(null);o[p-1]=e;for(let i=p;i<v.length;i++){e=v[i]*k+e*(1-k);o[i]=e;}return o;};
const sma=(v,n)=>v.map((_,i)=>(i<n-1||v.slice(i-n+1,i+1).some(x=>x==null))?null:v.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n);
function st(c,p){const K0=c.map((_,j)=>{if(j<p-1)return null;let hh=-1e18,ll=1e18;for(let t=j-p+1;t<=j;t++){hh=Math.max(hh,c[t].h);ll=Math.min(ll,c[t].l);}return hh===ll?50:100*(c[j].c-ll)/(hh-ll);});const K=sma(K0,3),D=sma(K,3);return{K:K.at(-1),D:D.at(-1),Kp:K.at(-2),Dp:D.at(-2)};}
function macd(c){const cl=c.map(x=>x.c),a=ema(cl,12),b=ema(cl,26),m=a.map((v,i)=>v==null||b[i]==null?null:v-b[i]),f=m.findIndex(x=>x!=null),s=new Array(f).fill(null).concat(ema(m.slice(f),9)),h=m.map((v,i)=>v==null||s[i]==null?null:v-s[i]);return{h:h.at(-1),h1:h.at(-2),h2:h.at(-3),m:m.at(-1),s:s.at(-1)};}
const m5=await get("5m",150),m15=await get("15m",150),h1=await get("1h",400);
const set={"5m":m5,"15m":m15,"1H":h1,"2H":agg(h1,2),"4H":agg(h1,4)};
const f=(x)=>x==null?"n/d":x.toFixed(1);
console.log(""+SYM+" ultimo preco (ultima vela 5m):",m5.at(-1).c,"em",new Date(m5.at(-1).t).toISOString());
for(const[k,c]of Object.entries(set)){const a=st(c,5),b=st(c,14),M=macd(c);const dir=M.h>M.h1?"hist subindo":"hist caindo";
console.log(k.padEnd(4),"velas",String(c.length).padStart(3),"| estoc 5,3,3: K",f(a.K),"D",f(a.D),a.K>a.D?"(K>D)":"(K<D)","| estoc 14,3,3: K",f(b.K),"D",f(b.D),"| MACD hist",M.h.toFixed(2),dir,"| macd>sinal",M.m>M.s);}
