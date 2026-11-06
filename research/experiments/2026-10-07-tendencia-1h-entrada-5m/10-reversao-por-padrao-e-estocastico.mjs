// Regra descrita pelo Cleber (2026-10-07, graficos 2 e 12): se o grafico deixa padrao de reversao (martelo, torre gemea/pinca, engolfo)
// NAS ULTIMAS 2 VELAS e o estocastico vira a favor (K cruza D, ou K sobe/desce 2 velas seguidas saindo de zona extrema),
// a direcao e a da reversao -- o estocastico pesa mais que o MACD, o MACD so reforca. Sem sinal de reversao: cai na regra congelada
// (convergencia + curvatura das medias). Parametros fixados ANTES de rodar. Os 12 graficos novos fazem parte do que motivou a regra (2 e 12),
// entao o resultado aqui e EM AMOSTRA: so vale como teste honesto numa 3a rodada de graficos.
import fs from "node:fs";
const labelMap = { subindo:"ALTA", descendo:"BAIXA", "de lado":"LATERAL" };
const oldMine = ["BAIXA","ALTA","BAIXA","ALTA","LATERAL","ALTA","ALTA","BAIXA","BAIXA","LATERAL","BAIXA","LATERAL"];
const newMine = "descendo,subindo,subindo,de lado,de lado,subindo,subindo,subindo,de lado,de lado,subindo,subindo".split(",").map(x=>labelMap[x]);
const ema = (v,p)=>{const k=2/(p+1);let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p;const o=new Array(v.length).fill(NaN);o[p-1]=e;for(let i=p;i<v.length;i++){e=v[i]*k+e*(1-k);o[i]=e;}return o;};
const sma = (v,n)=>v.map((_,i)=>(i<n-1||v.slice(i-n+1,i+1).some(Number.isNaN))?NaN:v.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n);
const atr = (c)=>{const tr=c.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-c[i-1].c),Math.abs(x.l-c[i-1].c)):x.h-x.l);let a=tr.slice(0,14).reduce((s,x)=>s+x,0)/14;for(let i=14;i<tr.length;i++)a=(a*13+tr[i])/14;return a;};
function indicators(win){ // win: [{o,h,l,c}] 60 velas -> estocastico lento 5,3,3 e MACD 12/26/9 (mesmos parametros do motor)
  const closes=win.map(x=>x.c);
  const K=win.map((_,j)=>{if(j<4)return NaN;let hh=-1e18,ll=1e18;for(let t=j-4;t<=j;t++){hh=Math.max(hh,win[t].h);ll=Math.min(ll,win[t].l);}return hh===ll?50:100*(win[j].c-ll)/(hh-ll);});
  const Ks=sma(K,3),D=sma(Ks,3);
  const m12=ema(closes,12),m26=ema(closes,26),macd=m12.map((v,j)=>v-m26[j]);
  const sig=new Array(25).fill(NaN).concat(ema(macd.slice(25),9));
  return {K:Ks,D,hist:macd.map((v,j)=>v-sig[j])};
}
function patterns(win,A){ // devolve {up,down,names} para as ultimas 2 velas
  const up=[],down=[];
  for(const i of [win.length-1,win.length-2]){
    const c=win[i],p=win[i-1],rng=c.h-c.l; if(!(rng>0.4*A))continue;
    const body=Math.abs(c.c-c.o),lower=Math.min(c.o,c.c)-c.l,upper=c.h-Math.max(c.o,c.c);
    if(body<=0.4*rng&&lower>=2*Math.max(body,0.05*rng)&&upper<=0.25*rng) up.push("martelo");
    if(body<=0.4*rng&&upper>=2*Math.max(body,0.05*rng)&&lower<=0.25*rng) down.push("estrela cadente");
    if(Math.abs(c.l-p.l)<=0.15*A&&p.c<p.o&&c.c>c.o) up.push("torre gemea (fundo)");
    if(Math.abs(c.h-p.h)<=0.15*A&&p.c>p.o&&c.c<c.o) down.push("torre gemea (topo)");
    if(p.c<p.o&&c.c>c.o&&c.c>=p.o&&c.o<=p.c) up.push("engolfo de alta");
    if(p.c>p.o&&c.c<c.o&&c.c<=p.o&&c.o>=p.c) down.push("engolfo de baixa");
  }
  return {up,down};
}
function frozen(win,e9,e20,A){ // regra congelada (convergencia + curvatura da EMA9)
  const n=win.length,gap=(i)=>(e9[i]-e20[i])/A;let cross=0;for(let i=n-29;i<n;i++)if((win[i].c-e20[i])*(win[i-1].c-e20[i-1])<0)cross++;
  if(cross>=5)return "LATERAL";const g=gap(n-1),dg=g-gap(n-6),proj=g+dg*2;if(Math.abs(proj)>0.1)return proj>0?"ALTA":"BAIXA";
  const s9=(e9[n-1]-e9[n-4])/A;return s9>0.15?"ALTA":s9<-0.15?"BAIXA":"LATERAL";
}
function read(win,e9,e20){
  const A=atr(win),n=win.length,I=indicators(win),pt=patterns(win,A);
  const K=I.K,D=I.D,h=I.hist;
  const stochUp=(K[n-1]>D[n-1]&&(K[n-2]<=D[n-2]||K[n-3]<=D[n-3]))||(K[n-1]>K[n-2]&&K[n-2]>K[n-3]&&Math.min(K[n-1],K[n-2],K[n-3],K[n-4])<30);
  const stochDown=(K[n-1]<D[n-1]&&(K[n-2]>=D[n-2]||K[n-3]>=D[n-3]))||(K[n-1]<K[n-2]&&K[n-2]<K[n-3]&&Math.max(K[n-1],K[n-2],K[n-3],K[n-4])>70);
  const macdUp=h[n-1]>h[n-2]&&h[n-2]>h[n-3], macdDown=h[n-1]<h[n-2]&&h[n-2]<h[n-3];
  const bull=pt.up.length>0&&stochUp&&!(macdDown&&!(K[n-1]>D[n-1])), bear=pt.down.length>0&&stochDown&&!(macdUp&&!(K[n-1]<D[n-1]));
  if(bull&&!bear)return {l:"ALTA",why:"reversao: "+pt.up[0]+" + estocastico virando"+(macdUp?" + MACD melhorando":"")};
  if(bear&&!bull)return {l:"BAIXA",why:"reversao: "+pt.down[0]+" + estocastico virando"+(macdDown?" + MACD piorando":"")};
  return {l:frozen(win,e9,e20,A),why:"medias"};
}
const oldD=JSON.parse(fs.readFileSync("validacao_1h.json","utf8")), newRaw=JSON.parse(fs.readFileSync("graficos_novos_raw.json","utf8"));
const run=(name,rows,mine)=>{
  let ok=0,opp=0,dir=0,dirOk=0;const lines=[];
  rows.forEach((r,i)=>{const o=read(r.win,r.e9,r.e20),m=mine[i];if(o.l===m)ok++;const isOpp=(o.l==="ALTA"&&m==="BAIXA")||(o.l==="BAIXA"&&m==="ALTA");if(isOpp)opp++;if(m!=="LATERAL"){dir++;if(o.l===m)dirOk++;}
    lines.push(`${String(i+1).padStart(2)} voce:${m.padEnd(8)} regra:${o.l.padEnd(8)}${o.l===m?"":(isOpp?" OPOSTO":" difere")}  (${o.why})`);});
  console.log(`\n== ${name}: bate ${ok}/12 | opostos ${opp} | onde voce viu direcao: ${dirOk}/${dir} ==`);lines.forEach(l=>console.log(l));
};
run("12 graficos NOVOS (com MACD+estocastico na tela; 2 e 12 motivaram a regra)",newRaw.map(w=>({win:w.map(x=>({o:x.o,h:x.h,l:x.l,c:x.c})),e9:w.map(x=>x.e9),e20:w.map(x=>x.e20)})),newMine);
run("12 graficos ANTIGOS (so candles+medias na tela; ele NAO viu MACD/estocastico)",oldD.map(x=>({win:x.win.map(k=>({o:k.o,h:k.h,l:k.l,c:k.c})),e9:x.e9,e20:x.e20})),oldMine);
