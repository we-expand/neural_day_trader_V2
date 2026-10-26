// Acrescenta a regra do Cleber: EMA9 "curvando" (inclinacao das ultimas k velas) antecipa a virada. Parametros fixos antes de rodar.
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("validacao_1h.json", "utf8"));
const mine = ["BAIXA","ALTA","BAIXA","ALTA","LATERAL","ALTA","ALTA","BAIXA","BAIXA","LATERAL","BAIXA","LATERAL"];
const atr = (c) => { const tr=c.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-c[i-1].c),Math.abs(x.l-c[i-1].c)):x.h-x.l); let a=tr.slice(0,14).reduce((s,x)=>s+x,0)/14; for(let i=14;i<tr.length;i++)a=(a*13+tr[i])/14; return a; };
function read(win, e9, e20, P) {
  const A = atr(win), n = win.length;
  const gap = (i) => (e9[i]-e20[i])/A;
  let cross = 0; for (let i=n-29;i<n;i++) if ((win[i].c-e20[i])*(win[i-1].c-e20[i-1])<0) cross++;
  if (cross >= P.crossMax) return "LATERAL";
  const g = gap(n-1), dg = g - gap(n-1-5);
  const proj = g + dg*2;
  const slope9 = (e9[n-1]-e9[n-1-P.k])/A;                  // curvatura/inclinacao recente da EMA9
  if (Math.abs(proj) > 0.1) return proj > 0 ? "ALTA" : "BAIXA";
  return slope9 > P.s ? "ALTA" : slope9 < -P.s ? "BAIXA" : "LATERAL";
}
const grid=[]; for (const k of [3,4]) for (const s of [0.15,0.25,0.4]) for (const crossMax of [5,6]) grid.push({k,s,crossMax});
const res = grid.map(P=>{const out=d.map(x=>read(x.win,x.e9,x.e20,P));return{P,out,ok:out.filter((o,i)=>o===mine[i]).length,opp:out.filter((o,i)=>o!=="LATERAL"&&mine[i]!=="LATERAL"&&o!==mine[i]).length};}).sort((a,b)=>b.ok-a.ok||a.opp-b.opp);
console.log("combinacoes:",res.length);
for (const r of res.slice(0,5)) console.log(JSON.stringify(r.P),`${r.ok}/12`,`${r.opp} opostos`,r.out.map(o=>o[0]).join(""));
console.log("mediana:",res[Math.floor(res.length/2)].ok+"/12","pior:",res.at(-1).ok+"/12");
console.log("voce".padEnd(40),mine.map(o=>o[0]).join(""));
