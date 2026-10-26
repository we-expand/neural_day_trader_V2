// Monta o conjunto de treino com as marcacoes do Cleber (cada linha = 1 grafico de 1H, 60 velas, rotulo dele + motivo dito por ele).
// Rotulo "FORA" = ele marcou "de lado": na pratica significa "na duvida, fico fora" (nao necessariamente mercado sem tendencia).
// Atencao: so a PARTE B (12 graficos novos) foi marcada com MACD e estocastico na tela; a PARTE A viu so velas e medias.
import fs from "node:fs";
const L = { subindo:"ALTA", descendo:"BAIXA", "de lado":"FORA" };
const oldMine = ["descendo","subindo","descendo","subindo","de lado","subindo","subindo","descendo","descendo","de lado","descendo","de lado"].map(x=>L[x]);
const newMine = "descendo,subindo,subindo,de lado,de lado,subindo,subindo,subindo,de lado,de lado,subindo,subindo".split(",").map(x=>L[x]);
const reasonsOld = { 1:"cruza das medias 9 e 20 quase acontecendo (para baixo)", 2:"media de 9 quase cruzando para cima (esperar o cruzamento)", 8:"media de 9 ja curvada para baixo, comeco de queda", 9:"media de 9 quase cruzando para baixo (esperar o cruzamento)", 12:"lateralizacao: preco trabalhando em cima das medias quase o grafico todo", 7:"duvida" };
const reasonsNew = { 2:"estocastico cruzando na regiao inferior (pesa mais que o MACD) + martelo -> proximo candle de alta", 12:"MACD diminuindo ate virar alta + estocastico em formato de alta + torre gemea nos 2 ultimos candles -> reversao" };
const ema=(v,p)=>{const k=2/(p+1);let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p;const o=new Array(v.length).fill(NaN);o[p-1]=e;for(let i=p;i<v.length;i++){e=v[i]*k+e*(1-k);o[i]=e;}return o;};
const sma=(v,n)=>v.map((_,i)=>(i<n-1||v.slice(i-n+1,i+1).some(Number.isNaN))?NaN:v.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n);
function ind(c){const cl=c.map(x=>x.c);const K=c.map((_,j)=>{if(j<4)return NaN;let hh=-1e18,ll=1e18;for(let t=j-4;t<=j;t++){hh=Math.max(hh,c[t].h);ll=Math.min(ll,c[t].l);}return hh===ll?50:100*(c[j].c-ll)/(hh-ll);});
  const Ks=sma(K,3),D=sma(Ks,3);const m=ema(cl,12).map((v,j)=>v-ema(cl,26)[j]);const sig=new Array(25).fill(NaN).concat(ema(m.slice(25),9));return {K:Ks,D,macd:m,sig,hist:m.map((v,j)=>v-sig[j]),e9:ema(cl,9),e20:ema(cl,20)};}
const rows=[];
JSON.parse(fs.readFileSync("validacao_1h.json","utf8")).forEach((x,i)=>{const c=x.win.map(k=>({o:k.o,h:k.h,l:k.l,c:k.c}));rows.push({id:`A${i+1}`,parte:"A",viu_macd_estocastico:false,simbolo:x.symbol,momento_utc:new Date(x.ts*1000).toISOString(),rotulo_cleber:oldMine[i],motivo_cleber:reasonsOld[i+1]||null,velas:c,...(({K,D,macd,sig,hist,e9,e20})=>({K,D,macd,sig,hist,e9,e20}))(ind(c))});});
const gab=JSON.parse(fs.readFileSync("gabarito_novo.json","utf8"));
JSON.parse(fs.readFileSync("graficos_novos_raw.json","utf8")).forEach((w,i)=>{const c=w.map(k=>({o:k.o,h:k.h,l:k.l,c:k.c}));rows.push({id:`B${i+1}`,parte:"B",viu_macd_estocastico:true,simbolo:gab[i].sym,momento_utc:gab[i].t,rotulo_cleber:newMine[i],motivo_cleber:reasonsNew[i+1]||null,velas:c,...(({K,D,macd,sig,hist,e9,e20})=>({K,D,macd,sig,hist,e9,e20}))(ind(c))});});
fs.writeFileSync("dataset.json",JSON.stringify(rows));
const cnt=rows.reduce((m,r)=>(m[r.parte+":"+r.rotulo_cleber]=(m[r.parte+":"+r.rotulo_cleber]||0)+1,m),{});
console.log("linhas:",rows.length,JSON.stringify(cnt),"| com motivo:",rows.filter(r=>r.motivo_cleber).length,"| NaN em K/D/hist no fim:",rows.filter(r=>[r.K.at(-1),r.D.at(-1),r.hist.at(-1)].some(Number.isNaN)).length);
