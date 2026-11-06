// 1 observacao por DIA (vela que fecha 20:00 UTC = 17h BRT), sem sobreposicao.
// Simula LONG e SHORT com stop = alvo = k * ATR(14) de 1H, primeiro toque em ate 4h (vela 5m? usa 1H high/low; empate na mesma vela = conta como stop, conservador)
const sym=process.argv[2]||'ETHUSDT';
async function kl(interval,n){let out=[],end=Date.now();while(out.length<n){const j=await (await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=1000&endTime=${end}`)).json();if(!j.length)break;out=j.concat(out);end=j[0][0]-1;}return out.map(k=>({t:k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4]}));}
function stoch(c,i,p=14){const f=[];for(let j=i-2;j<=i;j++){let hh=-1e18,ll=1e18;for(let q=j-p+1;q<=j;q++){hh=Math.max(hh,c[q].h);ll=Math.min(ll,c[q].l);}f.push(hh===ll?50:100*(c[j].c-ll)/(hh-ll));}return f.reduce((a,b)=>a+b)/3;}
function atr(c,i,p=14){let s=0;for(let j=i-p+1;j<=i;j++){s+=Math.max(c[j].h-c[j].l,Math.abs(c[j].h-c[j-1].c),Math.abs(c[j].l-c[j-1].c));}return s/p;}
const h=await kl('1h',26280);
const m5=await kl('5m',1); // nada, so pra manter assinatura
const res=[];
for(let i=30;i<h.length-5;i++){
  const close=h[i].t+3600000; if(new Date(close).getUTCHours()!==20) continue;
  const ch=(h[i].c/h[i-24].c-1)*100, s1=stoch(h,i), a=atr(h,i), p=h[i].c;
  const sim=(side,k)=>{const up=p+k*a,dn=p-k*a;for(let j=i+1;j<=i+4;j++){const hitUp=h[j].h>=up,hitDn=h[j].l<=dn;
      if(hitUp&&hitDn) return -1; // ambiguo -> conservador: stop
      if(side==='L'){if(hitUp)return 1;if(hitDn)return -1;} else {if(hitDn)return 1;if(hitUp)return -1;}}
    const r=(h[i+4].c-p)/(k*a); return side==='L'?Math.max(-1,Math.min(1,r)):Math.max(-1,Math.min(1,-r));};
  res.push({y:new Date(close).getUTCFullYear(),ch,s1,f2:(h[i+2].c/p-1)*100,L:sim('L',1),S:sim('S',1),cost:0.001*p/a});
}
function rep(sel,lab){const n=sel.length;const up=sel.filter(r=>r.f2>0).length/n;
  const eL=sel.reduce((s,r)=>s+r.L,0)/n, eS=sel.reduce((s,r)=>s+r.S,0)/n, c=sel.reduce((s,r)=>s+r.cost,0)/n;
  const wL=sel.filter(r=>r.L>0).length/n, wS=sel.filter(r=>r.S>0).length/n;
  const sdL=Math.sqrt(sel.reduce((s,r)=>s+(r.L-eL)**2,0)/(n-1));
  console.log(`${lab.padEnd(40)} n=${String(n).padStart(4)} up2h ${(up*100).toFixed(1)}% | LONG acerto ${(wL*100).toFixed(1)}% E[R] ${eL.toFixed(3)} (t=${(eL/(sdL/Math.sqrt(n))).toFixed(2)}) | SHORT acerto ${(wS*100).toFixed(1)}% E[R] ${eS.toFixed(3)} | custo ~${c.toFixed(2)}R`);}
console.log(`== ${sym}: 1 obs/dia as 17h BRT, stop=alvo=1x ATR1H, horizonte 4h ==`);
rep(res,'todos os dias');
rep(res.filter(r=>r.ch<=-2),'dia <= -2%');
rep(res.filter(r=>r.ch<=-2&&r.s1<=20),'dia <= -2% & estoc1H <= 20');
rep(res.filter(r=>r.ch>=2),'dia >= +2%');
for(const y of [2023,2024,2025,2026]) rep(res.filter(r=>r.y===y&&r.ch<=-2),`  ${y} dia<=-2%`);
