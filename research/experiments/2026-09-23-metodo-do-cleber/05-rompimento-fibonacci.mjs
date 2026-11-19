const sym=process.argv[2]||'BTCUSDT'; const COST=+(process.argv[3]||0.0008);
async function kl(startMs){let out=[],cur=startMs;while(true){const j=await (await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=1000&startTime=${cur}`)).json();if(!j.length)break;out=out.concat(j);cur=j[j.length-1][0]+1;if(j.length<1000)break;}return out.map(k=>({t:k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]}));}
const h=await kl(Date.now()-3*365*864e5);
const N=5, atr=[];{let s=0;for(let i=0;i<h.length;i++){const tr=i?Math.max(h[i].h-h[i].l,Math.abs(h[i].h-h[i-1].c),Math.abs(h[i].l-h[i-1].c)):h[i].h-h[i].l;s=i<14?s+tr:(s*13+tr)/14;atr.push(i<13?null:i===13?s/14:s);}}
const isPH=i=>{for(let q=1;q<=N;q++)if(h[i-q].h>=h[i].h||h[i+q].h>h[i].h)return false;return true;};
const isPL=i=>{for(let q=1;q<=N;q++)if(h[i-q].l<=h[i].l||h[i+q].l<h[i].l)return false;return true;};
const MODE=process.argv[4]||'base'; const trades=[];
const vavg=i=>{let x=0;for(let q=i-24;q<i;q++)x+=h[q].v;return x/24;};
// retorna indice da vela em que a entrada e' decidida (entrada na abertura da seguinte) ou -1
function confirm(side,lvl,q){const a=atr[q],up=side==='L';const beyond=(k,m=0)=>up?h[k].c>lvl+m:h[k].c<lvl-m;
 if(!beyond(q))return -1;
 if(MODE==='base')return q;
 if(MODE==='margem')return beyond(q,0.25*a)?q:-1;
 if(MODE==='duas')return beyond(q+1)?q+1:-1;
 if(MODE==='volume')return h[q].v>1.5*vavg(q)?q:-1;
 if(MODE==='reteste'){for(let k=q+1;k<=q+12&&k<h.length-1;k++){const touch=up?h[k].l<=lvl+0.1*a:h[k].h>=lvl-0.1*a;if(touch)return beyond(k)?k:-1;}return -1;}
 return -1;}
function trade(side,lvl,range,i0){ // i0 = indice da vela de rompimento (fechou alem do nivel)
  const e=i0+1; if(e>=h.length-50)return; const entry=h[e].o; const a=atr[i0];
  const stop=side==='L'?lvl-a:lvl+a; const R=Math.abs(entry-stop); if(R<=0||R>3*a+Math.abs(entry-lvl))return;
  const T=[.618,1,1.618].map(f=>side==='L'?lvl+f*range:lvl-f*range);
  let hit=[false,false,false],stopped=false,pnl=0,open=3,exitPx=null;
  for(let q=e;q<=e+48&&q<h.length;q++){
    const st=side==='L'?h[q].l<=stop:h[q].h>=stop;
    if(st){ // conservador: stop antes de alvo na mesma vela
      const r=(side==='L'?stop-entry:entry-stop)/R; pnl+=open*r/3; stopped=true;open=0;break;}
    for(let k=0;k<3;k++) if(!hit[k]&&(side==='L'?h[q].h>=T[k]:h[q].l<=T[k])){hit[k]=true;pnl+=((side==='L'?T[k]-entry:entry-T[k])/R)/3;open--;}
    if(open===0)break;
  }
  if(open>0&&!stopped){const px=h[Math.min(e+48,h.length-1)].c;pnl+=open*((side==='L'?px-entry:entry-px)/R)/3;}
  const net=pnl-COST*entry/R;
  trades.push({side,y:new Date(h[e].t).getUTCFullYear(),t1:hit[0],t2:hit[1],t3:hit[2],stopped,net,gross:pnl,rangeAtr:range/a,Rpct:R/entry*100});
}
for(let i=N+20;i<h.length-N-60;i++){
  if(isPH(i)){ // achar minima anterior (ultimo pivot low antes do topo, ate 60 velas)
    let lo=null;for(let q=i-1;q>i-60&&q>N;q--){if(isPL(q)){lo=h[q].l;break;}}
    if(lo==null)continue; const range=h[i].h-lo; const conf=i+N; if(range<1.5*atr[conf])continue;
    for(let q=conf+1;q<=i+72;q++){ if(h[q].c>h[i].h){const z=confirm('L',h[i].h,q);if(z>=0)trade('L',h[i].h,range,z);break;} if(h[q].l<lo)break; }
  }
  if(isPL(i)){
    let hi=null;for(let q=i-1;q>i-60&&q>N;q--){if(isPH(q)){hi=h[q].h;break;}}
    if(hi==null)continue; const range=hi-h[i].l; const conf=i+N; if(range<1.5*atr[conf])continue;
    for(let q=conf+1;q<=i+72;q++){ if(h[q].c<h[i].l){const z=confirm('S',h[i].l,q);if(z>=0)trade('S',h[i].l,range,z);break;} if(h[q].h>hi)break; }
  }
}
function rep(lab,a){const n=a.length;if(n<10){console.log(lab.padEnd(30),'n=',n);return;}
 const m=a.reduce((s,x)=>s+x.net,0)/n,sd=Math.sqrt(a.reduce((s,x)=>s+(x.net-m)**2,0)/(n-1)),g=a.reduce((s,x)=>s+x.gross,0)/n;
 const p=k=>(100*a.filter(x=>x[k]).length/n).toFixed(0);
 console.log(`${lab.padEnd(30)} n=${String(n).padStart(4)} | T1 ${p('t1')}% T2 ${p('t2')}% T3 ${p('t3')}% stop-antes-do-T1 ${(100*a.filter(x=>x.stopped&&!x.t1).length/n).toFixed(0)}% | E[R] bruto ${g.toFixed(2)} liq ${m.toFixed(2)} (t=${(m/(sd/Math.sqrt(n))).toFixed(2)}) | risco/trade ${(a.reduce((s,x)=>s+x.Rpct,0)/n).toFixed(2)}% do preco`);}
console.log(`== ${sym} [${MODE}] 3 anos 1H | rompimento Fibonacci (alvos 61.8/100/161.8%), stop 1 ATR, 1/3 por alvo, 48h | custo ${(COST*100).toFixed(2)}% ==`);
rep('TODOS',trades); rep('LONG (rompe topo)',trades.filter(x=>x.side==='L')); rep('SHORT (rompe fundo)',trades.filter(x=>x.side==='S'));

