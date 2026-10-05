// Testa: queda/alta forte no dia (24h rolante) + horario 17h-21h Brasilia (20-00 UTC) -> retorno forward
const sym = process.argv[2] || 'ETHUSDT';
async function klines(interval, n){
  let out=[]; let end=Date.now();
  while(out.length<n){
    const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=1000&endTime=${end}`);
    const j=await r.json(); if(!j.length) break;
    out=j.concat(out); end=j[0][0]-1;
  }
  return out.map(k=>({t:k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4]}));
}
function stochSlow(c,i,p=14){ // %K lento = SMA3 do %K rapido
  const fast=[];
  for(let j=i-2;j<=i;j++){ if(j-p+1<0) return null;
    let hh=-Infinity,ll=Infinity; for(let q=j-p+1;q<=j;q++){hh=Math.max(hh,c[q].h);ll=Math.min(ll,c[q].l);}
    fast.push(hh===ll?50:100*(c[j].c-ll)/(hh-ll)); }
  return fast.reduce((a,b)=>a+b)/3;
}
const h1=await klines('1h', 26280); // ~3 anos
const h4=await klines('4h', 6600);
const h4idx=new Map(); h4.forEach((k,i)=>h4idx.set(k.t,i));
function st4(t){ // ultimo candle 4H FECHADO antes de t
  const base=Math.floor(t/14400000)*14400000-14400000; const i=h4idx.get(base); return i==null?null:stochSlow(h4,i);
}
const rows=[];
for(let i=30;i<h1.length-4;i++){
  const closeT=h1[i].t+3600000; const hourUTC=new Date(closeT).getUTCHours();
  const ch24=(h1[i].c/h1[i-24].c-1)*100;
  const f1=(h1[i+1].c/h1[i].c-1)*100, f2=(h1[i+2].c/h1[i].c-1)*100, f4=(h1[i+4].c/h1[i].c-1)*100;
  rows.push({hourUTC,ch24,f1,f2,f4,s1:stochSlow(h1,i),s4:st4(closeT), year:new Date(closeT).getUTCFullYear()});
}
function stats(sel,label){
  const r=['f1','f2','f4'].map(k=>{const v=sel.map(x=>x[k]);const n=v.length;const m=v.reduce((a,b)=>a+b,0)/n;
    const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/(n-1));const up=v.filter(x=>x>0).length/n;
    return `${k}: media ${m.toFixed(3)}% up ${(up*100).toFixed(1)}% t=${(m/(sd/Math.sqrt(n))).toFixed(2)}`});
  console.log(`${label.padEnd(58)} n=${String(sel.length).padStart(5)} | ${r.join(' | ')}`);
}
const eve=r=>r.hourUTC>=20&&r.hourUTC<=23;
console.log(`== ${sym} ${h1.length} velas 1H (${new Date(h1[0].t).toISOString().slice(0,10)} a hoje) ==`);
stats(rows,'BASE todas as horas');
stats(rows.filter(eve),'BASE 17h-20h BRT');
stats(rows.filter(r=>eve(r)&&r.ch24<=-2),'17-20h BRT & 24h <= -2%');
stats(rows.filter(r=>!eve(r)&&r.ch24<=-2),'OUTROS horarios & 24h <= -2%');
stats(rows.filter(r=>eve(r)&&r.ch24<=-2&&r.s1!=null&&r.s1<=20),'17-20h & 24h<=-2% & stoch1H<=20');
stats(rows.filter(r=>eve(r)&&r.ch24<=-2&&r.s1!=null&&r.s1<=20&&r.s4!=null&&r.s4<=20),'17-20h & 24h<=-2% & stoch1H<=20 & stoch4H<=20');
stats(rows.filter(r=>r.ch24<=-2&&r.s1!=null&&r.s1<=20&&r.s4!=null&&r.s4<=20),'qualquer hora & 24h<=-2% & st1H<=20 & st4H<=20');
stats(rows.filter(r=>eve(r)&&r.ch24>=2),'17-20h BRT & 24h >= +2% (espelho)');
stats(rows.filter(r=>eve(r)&&r.ch24>=2&&r.s1!=null&&r.s1>=80&&r.s4!=null&&r.s4>=80),'17-20h & 24h>=+2% & st1H>=80 & st4H>=80');
for(const y of [...new Set(rows.map(r=>r.year))]) stats(rows.filter(r=>r.year===y&&eve(r)&&r.ch24<=-2),`  por ano ${y}: 17-20h & 24h<=-2%`);
