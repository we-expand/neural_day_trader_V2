// Metodo do Cleber: 1H = lado (stoch K vs D), 5m = gatilho (cruzamento %K/%D), MACD 5m confirma.
// Regras declaradas ANTES de rodar. stop=1.5xATR14(5m), alvo=2R, timeout 3h, empate na mesma vela = stop. 1 trade aberto por vez.
const sym=process.argv[2]||'BTCUSDT'; const COST=+(process.argv[3]||0.0008); // custo round-trip como fracao do preco
async function kl(interval,startMs){let out=[],cur=startMs;while(true){const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=1000&startTime=${cur}`);const j=await r.json();if(!j.length)break;out=out.concat(j);cur=j[j.length-1][0]+1;if(j.length<1000)break;}return out.map(k=>({t:k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4]}));}
const start=Date.now()-2*365*864e5;
const m5=await kl('5m',start), h1=await kl('1h',start-30*864e5);
function ema(v,p){const k=2/(p+1);const o=[v[0]];for(let i=1;i<v.length;i++)o.push(v[i]*k+o[i-1]*(1-k));return o;}
function stochSeries(c,p=14){const K=[];for(let i=0;i<c.length;i++){if(i<p-1){K.push(null);continue;}let hh=-1e18,ll=1e18;for(let q=i-p+1;q<=i;q++){hh=Math.max(hh,c[q].h);ll=Math.min(ll,c[q].l);}K.push(hh===ll?50:100*(c[i].c-ll)/(hh-ll));}
  const sma=(a,n)=>a.map((_,i)=>i<n+p-2||a.slice(i-n+1,i+1).some(x=>x==null)?null:a.slice(i-n+1,i+1).reduce((s,x)=>s+x,0)/n);
  const Ks=sma(K,3), D=sma(Ks,3); return {K:Ks,D};}
const s5=stochSeries(m5), s1=stochSeries(h1);
const e12=ema(m5.map(x=>x.c),12), e26=ema(m5.map(x=>x.c),26); const macd=e12.map((v,i)=>v-e26[i]); const sig=ema(macd,9); const hist=macd.map((v,i)=>v-sig[i]);
const atr=[];{let s=0;for(let i=0;i<m5.length;i++){const tr=i?Math.max(m5[i].h-m5[i].l,Math.abs(m5[i].h-m5[i-1].c),Math.abs(m5[i].l-m5[i-1].c)):m5[i].h-m5[i].l;s=i<14?s+tr:(s*13+tr)/14;atr.push(i<13?null:i===13?s/14:s);}}
// mapa 1H: ultimo candle 1H FECHADO antes do t
const h1t=h1.map(x=>x.t); function h1idx(t){let lo=0,hi=h1t.length-1,r=-1;while(lo<=hi){const m=(lo+hi)>>1;if(h1t[m]+3600000<=t){r=m;lo=m+1}else hi=m-1}return r;}
// variacao 24h rolante pelo 5m (288 velas)
function run(name,filter,sideFilter){
  const tr=[];let i=300;
  while(i<m5.length-40){
    const k=s5.K[i],d=s5.D[i],kp=s5.K[i-1],dp=s5.D[i-1]; if(k==null||d==null||kp==null||dp==null||atr[i]==null){i++;continue;}
    let side=null; if(kp<=dp&&k>d) side='L'; else if(kp>=dp&&k<d) side='S'; if(!side){i++;continue;}
    if(sideFilter&&sideFilter!==side){i++;continue;}
    const j=h1idx(m5[i].t+300000); if(j<20){i++;continue;}
    const ctx={side,i,macdUp:hist[i]>hist[i-1],h1up:s1.K[j]>s1.D[j],ch24:(m5[i].c/m5[i-288].c-1)*100,hourBrt:(new Date(m5[i].t+300000).getUTCHours()+21)%24,e20:null};
    if(!filter(ctx)){i++;continue;}
    const entry=m5[i].c, R=1.5*atr[i]; const stop=side==='L'?entry-R:entry+R, tgt=side==='L'?entry+2*R:entry-2*R;
    let res=null,exit=i;
    for(let q=i+1;q<=i+36;q++){const hs=side==='L'?m5[q].l<=stop:m5[q].h>=stop, ht=side==='L'?m5[q].h>=tgt:m5[q].l<=tgt;
      if(hs){res=-1;exit=q;break;} if(ht){res=2;exit=q;break;}}
    if(res==null){exit=i+36;const r=(side==='L'?m5[exit].c-entry:entry-m5[exit].c)/R;res=Math.max(-1,Math.min(2,r));}
    const net=res-COST*entry/R; tr.push({res,net,y:new Date(m5[i].t).getUTCFullYear(),ch24:ctx.ch24,hourBrt:ctx.hourBrt,side});
    i=exit+1;
  }
  const n=tr.length; if(n<10){console.log(name.padEnd(46),'n=',n);return tr;}
  const w=tr.filter(x=>x.res>0).length/n, e=tr.reduce((s,x)=>s+x.net,0)/n, sd=Math.sqrt(tr.reduce((s,x)=>s+(x.net-e)**2,0)/(n-1));
  const byY=[...new Set(tr.map(x=>x.y))].sort().map(y=>{const a=tr.filter(x=>x.y===y);return `${y}:${(100*a.filter(x=>x.res>0).length/a.length).toFixed(0)}%/${(a.reduce((s,x)=>s+x.net,0)/a.length).toFixed(2)}R(n${a.length})`}).join(' ');
  console.log(`${name.padEnd(46)} n=${String(n).padStart(5)} acerto ${(w*100).toFixed(1)}% E[R] liq ${e.toFixed(3)} (t=${(e/(sd/Math.sqrt(n))).toFixed(2)}) | ${byY}`);return tr;
}
console.log(`== ${sym} 2 anos, ${m5.length} velas 5m, custo ${(COST*100).toFixed(2)}% r/t | stop 1.5xATR5m alvo 2R (breakeven acerto ~ 33% + custo) ==`);
run('V1 gatilho: cruzamento estoc 5m (so isso)',()=>true);
run('V2 + MACD 5m a favor (histograma na direcao)',c=>c.side==='L'?c.macdUp:!c.macdUp);
run('V3 + 1H alinhado (stoch 1H K>D p/ LONG)',c=>(c.side==='L'?c.macdUp&&c.h1up:!c.macdUp&&!c.h1up));
console.log('-- contexto do Cleber: dia <= -2%, 17h-20h BRT --');
run('V3 & 24h<=-2% & 17-20h BRT (LONG e SHORT)',c=>c.ch24<=-2&&c.hourBrt>=17&&c.hourBrt<20&&(c.side==='L'?c.macdUp&&c.h1up:!c.macdUp&&!c.h1up));
run('V3 & 24h<=-2% & 17-20h BRT so LONG',c=>c.ch24<=-2&&c.hourBrt>=17&&c.hourBrt<20&&c.macdUp&&c.h1up,'L');
run('V3 & 24h<=-2% & 17-20h BRT so SHORT',c=>c.ch24<=-2&&c.hourBrt>=17&&c.hourBrt<20&&!c.macdUp&&!c.h1up,'S');
run('V3 & 24h<=-2% (qualquer hora) so LONG',c=>c.ch24<=-2&&c.macdUp&&c.h1up,'L');
